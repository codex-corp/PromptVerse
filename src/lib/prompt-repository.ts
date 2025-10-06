import type { DatabaseClient } from "@/lib/db";
import { generateId } from "@/lib/id";

export interface PromptFilterOptions {
  search?: string;
  categories?: string[];
  tags?: string[];
  targetModels?: string[];
  rating?: number | null;
  isFavorite?: boolean | null;
  dateRange?: "all" | "today" | "week" | "month" | "year";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function calculateDateThreshold(range: PromptFilterOptions["dateRange"]) {
  const now = new Date();
  switch (range) {
    case "today":
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case "week":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "month":
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    case "year":
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString();
    default:
      return null;
  }
}

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "title",
  "viewCount",
  "averageRating",
]);

interface PromptRow {
  id: string;
  title: string;
  content: string;
  description: string | null;
  targetModel: string;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  notes: string | null;
  isFavorite: 0 | 1;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  category: string | null;
  tags: string;
  averageRating: number;
  totalRatings: number;
}

export async function fetchPrompts(options: PromptFilterOptions, db: DatabaseClient) {
  const {
    search = "",
    categories = [],
    tags = [],
    targetModels = [],
    rating = null,
    isFavorite = null,
    dateRange = "all",
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const params: any[] = [];
  const whereClauses: string[] = [];

  if (search) {
    const pattern = `%${search}%`;
    whereClauses.push(
      "(p.title LIKE ? OR p.content LIKE ? OR p.description LIKE ?)"
    );
    params.push(pattern, pattern, pattern);
  }

  if (categories.length > 0) {
    const placeholders = categories.map(() => "?").join(",");
    whereClauses.push(`p.categoryId IN (${placeholders})`);
    params.push(...categories);
  }

  if (targetModels.length > 0) {
    const placeholders = targetModels.map(() => "?").join(",");
    whereClauses.push(`p.targetModel IN (${placeholders})`);
    params.push(...targetModels);
  }

  if (isFavorite !== null) {
    whereClauses.push("p.isFavorite = ?");
    params.push(isFavorite ? 1 : 0);
  }

  const threshold = calculateDateThreshold(dateRange);
  if (threshold) {
    whereClauses.push("datetime(p.createdAt) >= datetime(?)");
    params.push(threshold);
  }

  if (tags.length > 0) {
    const placeholders = tags.map(() => "?").join(",");
    whereClauses.push(
      `p.id IN (
        SELECT DISTINCT pt2.promptId
        FROM prompt_tags pt2
        JOIN Tag t2 ON t2.id = pt2.tagId
        WHERE t2.name IN (${placeholders})
      )`
    );
    params.push(...tags);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const orderField = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
  const orderDirection = sortOrder?.toLowerCase() === "asc" ? "ASC" : "DESC";

  const havingClauses: string[] = [];
  const havingParams: any[] = [];

  if (rating !== null) {
    havingClauses.push("COALESCE(AVG(r.value), 0) >= ?");
    havingParams.push(rating);
  }

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const baseQuery = `
    SELECT
      p.id,
      p.title,
      p.content,
      p.description,
      p.targetModel,
      p.temperature,
      p.maxTokens,
      p.topP,
      p.frequencyPenalty,
      p.presencePenalty,
      p.notes,
      p.isFavorite,
      p.viewCount,
      p.createdAt,
      p.updatedAt,
      json_object('id', u.id, 'name', u.name, 'email', u.email) as author,
      json_object('id', c.id, 'name', c.name, 'color', c.color) as category,
      COALESCE(json_group_array(
        DISTINCT CASE
          WHEN t.id IS NOT NULL THEN json_object('tag', json_object('id', t.id, 'name', t.name, 'color', t.color))
        END
      ), '[]') as tags,
      COALESCE(AVG(r.value), 0) as averageRating,
      COUNT(DISTINCT r.id) as totalRatings
    FROM prompts p
    JOIN User u ON u.id = p.authorId
    LEFT JOIN Category c ON c.id = p.categoryId
    LEFT JOIN prompt_tags pt ON pt.promptId = p.id
    LEFT JOIN Tag t ON t.id = pt.tagId
    LEFT JOIN ratings r ON r.promptId = p.id
    ${whereSQL}
    GROUP BY p.id
  `;

  const havingSQL = havingClauses.length > 0 ? `HAVING ${havingClauses.join(" AND ")}` : "";

  const totalQuery = `
    SELECT COUNT(*) as total
    FROM (
      ${baseQuery}
      ${havingSQL}
    ) as filtered
  `;

  const totalResult = (await db
    .prepare(totalQuery)
    .get(...params, ...havingParams)) as { total: number } | null;

  const offset = (safePage - 1) * safeLimit;

  const finalQuery = `
    ${baseQuery}
    ${havingSQL}
    ORDER BY ${orderField === "averageRating" ? "averageRating" : `p.${orderField}` } ${orderDirection}
    LIMIT ? OFFSET ?
  `;

  const rows = (await db
    .prepare(finalQuery)
    .all(...params, ...havingParams, safeLimit, offset)) as PromptRow[];

  const prompts = rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    description: row.description,
    targetModel: row.targetModel,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    topP: row.topP,
    frequencyPenalty: row.frequencyPenalty,
    presencePenalty: row.presencePenalty,
    notes: row.notes,
    isFavorite: Boolean(row.isFavorite),
    viewCount: row.viewCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: JSON.parse(row.author),
    category: row.category ? JSON.parse(row.category) : null,
    tags: JSON.parse(row.tags).filter(Boolean),
    averageRating: Math.round((row.averageRating ?? 0) * 10) / 10,
    totalRatings: row.totalRatings,
    userRating: null,
  }));

  return {
    prompts,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: totalResult?.total ?? 0,
      pages: Math.ceil((totalResult?.total ?? 0) / safeLimit) || 1,
    },
  };
}

interface PromptRowWithAuthor {
  id: string;
  title: string;
  content: string;
  description: string | null;
  targetModel: string;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  notes: string | null;
  isFavorite: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  category: string | null;
}

export async function fetchPromptById(id: string, db: DatabaseClient) {
  const promptRow = await db
    .prepare<PromptRowWithAuthor>(`
      SELECT
        p.id,
        p.title,
        p.content,
        p.description,
        p.targetModel,
        p.temperature,
        p.maxTokens,
        p.topP,
        p.frequencyPenalty,
        p.presencePenalty,
        p.notes,
        p.isFavorite,
        p.viewCount,
        p.createdAt,
        p.updatedAt,
        json_object('id', u.id, 'name', u.name, 'email', u.email) as author,
        json_object('id', c.id, 'name', c.name, 'color', c.color) as category
      FROM prompts p
      JOIN User u ON u.id = p.authorId
      LEFT JOIN Category c ON c.id = p.categoryId
      WHERE p.id = ?
    `)
    .get(id);

  if (!promptRow) {
    return null;
  }

  const tags = (await db
    .prepare<{ id: string; name: string; color: string | null }>(`
      SELECT t.id, t.name, t.color
      FROM prompt_tags pt
      JOIN Tag t ON t.id = pt.tagId
      WHERE pt.promptId = ?
      ORDER BY t.name ASC
    `)
    .all(id))
    .map((tag) => ({ tag }));

  const ratings = (await db
    .prepare<{
      id: string;
      value: number;
      comment: string | null;
      createdAt: string;
      updatedAt: string;
      userId: string;
      user: string;
    }>(`
      SELECT r.id, r.value, r.comment, r.createdAt, r.updatedAt, r.userId,
             json_object('id', u.id, 'name', u.name) as user
      FROM ratings r
      JOIN User u ON u.id = r.userId
      WHERE r.promptId = ?
      ORDER BY datetime(r.createdAt) DESC
    `)
    .all(id))
    .map((row: any) => ({
      id: row.id,
      value: row.value,
      comment: row.comment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      userId: row.userId,
      user: JSON.parse(row.user) as { id: string; name: string },
    }));

  const versions = (await db
    .prepare<{
      id: string;
      title: string;
      content: string;
      description: string | null;
      targetModel: string;
      temperature: number | null;
      maxTokens: number | null;
      topP: number | null;
      frequencyPenalty: number | null;
      presencePenalty: number | null;
      notes: string | null;
      versionNote: string | null;
      createdAt: string;
      originalPrompt: string;
    }>(`
      SELECT pv.id, pv.title, pv.content, pv.description, pv.targetModel,
             pv.temperature, pv.maxTokens, pv.topP, pv.frequencyPenalty,
             pv.presencePenalty, pv.notes, pv.versionNote, pv.createdAt,
             json_object('id', p.id, 'title', p.title) as originalPrompt
      FROM prompt_versions pv
      JOIN prompts p ON p.id = pv.originalPromptId
      WHERE pv.originalPromptId = ?
      ORDER BY datetime(pv.createdAt) DESC
    `)
    .all(id))
    .map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      description: row.description,
      targetModel: row.targetModel,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      topP: row.topP,
      frequencyPenalty: row.frequencyPenalty,
      presencePenalty: row.presencePenalty,
      notes: row.notes,
      versionNote: row.versionNote,
      createdAt: row.createdAt,
      originalPrompt: JSON.parse(row.originalPrompt),
    }));

  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.value, 0) / ratings.length
    : 0;

  const author = JSON.parse(promptRow.author) as { id: string; name: string; email: string };

  const versionsWithAuthor = versions.map((version) => ({
    ...version,
    author: author?.name ?? "Unknown",
  }));

  return {
    id: promptRow.id,
    title: promptRow.title,
    content: promptRow.content,
    description: promptRow.description,
    targetModel: promptRow.targetModel,
    temperature: promptRow.temperature,
    maxTokens: promptRow.maxTokens,
    topP: promptRow.topP,
    frequencyPenalty: promptRow.frequencyPenalty,
    presencePenalty: promptRow.presencePenalty,
    notes: promptRow.notes,
    isFavorite: Boolean(promptRow.isFavorite),
    viewCount: promptRow.viewCount,
    createdAt: promptRow.createdAt,
    updatedAt: promptRow.updatedAt,
    author,
    category: promptRow.category ? JSON.parse(promptRow.category) : null,
    tags,
    ratings,
    versions: versionsWithAuthor,
    averageRating: Math.round(averageRating * 10) / 10,
    totalRatings: ratings.length,
  };
}

interface CreatePromptInput {
  title: string;
  content: string;
  description?: string | null;
  targetModel: string;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  notes?: string | null;
  categoryId?: string | null;
  tags?: string[];
  authorId: string;
}

export async function createPrompt(data: CreatePromptInput, db: DatabaseClient) {
  const now = new Date().toISOString();
  const id = generateId();

  await db.prepare(
    `INSERT INTO prompts (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty,
      presencePenalty, notes, isFavorite, viewCount,
      createdAt, updatedAt, authorId, categoryId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `
  ).run(
    id,
    data.title,
    data.content,
    data.description ?? null,
    data.targetModel,
    data.temperature ?? null,
    data.maxTokens ?? null,
    data.topP ?? null,
    data.frequencyPenalty ?? null,
    data.presencePenalty ?? null,
    data.notes ?? null,
    now,
    now,
    data.authorId,
    data.categoryId ?? null
  );

  if (data.tags?.length) {
    const tagStmt = db.prepare("SELECT id FROM Tag WHERE name = ?");
    const insertTagStmt = db.prepare(
      `INSERT INTO Tag (id, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?)`
    );
    const linkStmt = db.prepare(
      `INSERT OR IGNORE INTO prompt_tags (id, promptId, tagId)
       VALUES (?, ?, ?)`
    );

    for (const name of data.tags) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      let tag = (await tagStmt.get(trimmed)) as { id: string } | undefined;
      if (!tag) {
        const tagId = generateId();
        const timestamp = new Date().toISOString();
        await insertTagStmt.run(tagId, trimmed, timestamp, timestamp);
        tag = { id: tagId };
      }

      await linkStmt.run(generateId(), id, tag.id);
    }
  }

  await db.prepare(
    `INSERT INTO prompt_versions (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty,
      presencePenalty, notes, versionNote, createdAt, originalPromptId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    generateId(),
    data.title,
    data.content,
    data.description ?? null,
    data.targetModel,
    data.temperature ?? null,
    data.maxTokens ?? null,
    data.topP ?? null,
    data.frequencyPenalty ?? null,
    data.presencePenalty ?? null,
    data.notes ?? null,
    "Initial version",
    now,
    id
  );

  return fetchPromptById(id, db);
}

export async function updatePrompt(
  id: string,
  data: Partial<CreatePromptInput> & { isFavorite?: boolean | null; tags?: string[]; viewCount?: number | null },
  db: DatabaseClient
) {
  const existing = await fetchPromptById(id, db);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  const newIsFavorite = data.isFavorite === null || data.isFavorite === undefined
    ? existing.isFavorite
    : data.isFavorite;

  await db.prepare(
    `UPDATE prompts SET
      title = ?,
      content = ?,
      description = ?,
      targetModel = ?,
      temperature = ?,
      maxTokens = ?,
      topP = ?,
      frequencyPenalty = ?,
      presencePenalty = ?,
      notes = ?,
      categoryId = ?,
      isFavorite = ?,
      viewCount = ?,
      updatedAt = ?
     WHERE id = ?`
  ).run(
    data.title ?? existing.title,
    data.content ?? existing.content,
    data.description ?? existing.description,
    data.targetModel ?? existing.targetModel,
    data.temperature ?? existing.temperature,
    data.maxTokens ?? existing.maxTokens,
    data.topP ?? existing.topP,
    data.frequencyPenalty ?? existing.frequencyPenalty,
    data.presencePenalty ?? existing.presencePenalty,
    data.notes ?? existing.notes,
    data.categoryId ?? existing.category?.id ?? null,
    newIsFavorite ? 1 : 0,
    data.viewCount ?? existing.viewCount,
    now,
    id
  );

  if (data.tags) {
    await db.prepare("DELETE FROM prompt_tags WHERE promptId = ?").run(id);

    const tagStmt = db.prepare("SELECT id FROM Tag WHERE name = ?");
    const insertTagStmt = db.prepare(
      `INSERT INTO Tag (id, name, createdAt, updatedAt)
       VALUES (?, ?, ?, ?)`
    );
    const linkStmt = db.prepare(
      `INSERT OR IGNORE INTO prompt_tags (id, promptId, tagId)
       VALUES (?, ?, ?)`
    );

    for (const name of data.tags) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      let tag = (await tagStmt.get(trimmed)) as { id: string } | undefined;
      if (!tag) {
        const tagId = generateId();
        const timestamp = new Date().toISOString();
        await insertTagStmt.run(tagId, trimmed, timestamp, timestamp);
        tag = { id: tagId };
      }

      await linkStmt.run(generateId(), id, tag.id);
    }
  }

  const updated = await fetchPromptById(id, db);

  if (!updated) {
    return null;
  }

  const significantChanges =
    (data.title !== undefined && data.title !== existing.title) ||
    (data.content !== undefined && data.content !== existing.content) ||
    (data.description !== undefined && data.description !== existing.description) ||
    (data.targetModel !== undefined && data.targetModel !== existing.targetModel);

  if (significantChanges) {
    await db.prepare(
      `INSERT INTO prompt_versions (
        id, title, content, description, targetModel,
        temperature, maxTokens, topP, frequencyPenalty,
        presencePenalty, notes, versionNote, createdAt, originalPromptId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateId(),
      updated.title,
      updated.content,
      updated.description ?? null,
      updated.targetModel,
      updated.temperature ?? null,
      updated.maxTokens ?? null,
      updated.topP ?? null,
      updated.frequencyPenalty ?? null,
      updated.presencePenalty ?? null,
      updated.notes ?? null,
      "Updated prompt",
      now,
      id
    );
  }

  return updated;
}

export async function deletePrompt(id: string, db: DatabaseClient) {
  await db.prepare("DELETE FROM prompt_tags WHERE promptId = ?").run(id);
  await db.prepare("DELETE FROM ratings WHERE promptId = ?").run(id);
  await db.prepare("DELETE FROM prompt_versions WHERE originalPromptId = ?").run(id);
  const result = await db.prepare("DELETE FROM prompts WHERE id = ?").run(id);
  return result.changes > 0;
}

export async function createPromptVersion(data: {
  originalPromptId: string;
  title: string;
  content: string;
  description?: string | null;
  targetModel: string;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  frequencyPenalty?: number | null;
  presencePenalty?: number | null;
  notes?: string | null;
  versionNote?: string | null;
}, db: DatabaseClient) {
  const prompt = await fetchPromptById(data.originalPromptId, db);
  if (!prompt) {
    return null;
  }

  const now = new Date().toISOString();
  const id = generateId();

  await db.prepare(
    `INSERT INTO prompt_versions (
      id, title, content, description, targetModel,
      temperature, maxTokens, topP, frequencyPenalty,
      presencePenalty, notes, versionNote, createdAt, originalPromptId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.title,
    data.content,
    data.description ?? null,
    data.targetModel,
    data.temperature ?? null,
    data.maxTokens ?? null,
    data.topP ?? null,
    data.frequencyPenalty ?? null,
    data.presencePenalty ?? null,
    data.notes ?? null,
    data.versionNote ?? "Cloned version",
    now,
    data.originalPromptId
  );

  const row = await db
    .prepare(
      `SELECT pv.id, pv.title, pv.content, pv.description, pv.targetModel,
              pv.temperature, pv.maxTokens, pv.topP, pv.frequencyPenalty,
              pv.presencePenalty, pv.notes, pv.versionNote, pv.createdAt,
              json_object('id', p.id, 'title', p.title) as originalPrompt,
              u.name as author
       FROM prompt_versions pv
       JOIN prompts p ON p.id = pv.originalPromptId
       JOIN User u ON u.id = p.authorId
       WHERE pv.id = ?`
    )
    .get(id) as any;

  return {
    ...row,
    originalPrompt: JSON.parse(row.originalPrompt),
  };
}

export async function fetchPromptVersions(originalPromptId: string, db: DatabaseClient) {
  const rows = await db
    .prepare(`
      SELECT pv.id, pv.title, pv.content, pv.description, pv.targetModel,
             pv.temperature, pv.maxTokens, pv.topP, pv.frequencyPenalty,
             pv.presencePenalty, pv.notes, pv.versionNote, pv.createdAt,
             json_object('id', p.id, 'title', p.title) as originalPrompt,
             u.name as author
      FROM prompt_versions pv
      JOIN prompts p ON p.id = pv.originalPromptId
      JOIN User u ON u.id = p.authorId
      WHERE pv.originalPromptId = ?
      ORDER BY datetime(pv.createdAt) DESC
    `)
    .all(originalPromptId);

  return rows
    .map((row: any) => ({
      ...row,
      originalPrompt: JSON.parse(row.originalPrompt),
    }));
}
