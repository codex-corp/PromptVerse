export interface DatabaseRunResult {
  changes: number;
  duration?: number;
  lastInsertRowid?: number | bigint | null;
}

type SQLitePreparedStatement = {
  all(...params: any[]): any[];
  get(...params: any[]): any;
  run(...params: any[]): { changes: number; lastInsertRowid?: number | bigint | null };
};

type SQLiteDatabase = {
  prepare(sql: string): SQLitePreparedStatement;
  pragma?: (pragma: string) => void;
};

type NodeRequireFunction = (id: string) => any;

declare const __non_webpack_require__: NodeRequireFunction | undefined;

export interface DatabasePreparedStatement<T = unknown> {
  all(...params: any[]): Promise<T[]>;
  get(...params: any[]): Promise<T | null>;
  run(...params: any[]): Promise<DatabaseRunResult>;
}

export interface DatabaseClient {
  prepare<T = unknown>(sql: string): DatabasePreparedStatement<T>;
  close?: () => void;
}

type D1Binding = {
  prepare(query: string): {
    bind(...params: any[]): any;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results?: T[] } | undefined>;
    run(): Promise<{
      success: boolean;
      error?: string;
      meta?: {
        changes?: number;
        duration?: number;
        last_row_id?: number;
      };
    }>;
  };
};

function mapD1Result(result: {
  success: boolean;
  error?: string;
  meta?: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
  };
}): DatabaseRunResult {
  if (!result.success) {
    throw new Error(result.error || "Failed to execute D1 statement");
  }

  return {
    changes: result.meta?.changes ?? 0,
    duration: result.meta?.duration,
    lastInsertRowid: result.meta?.last_row_id ?? null,
  };
}

function createSqliteStatement<T = unknown>(db: SQLiteDatabase, sql: string): DatabasePreparedStatement<T> {
  const statement = db.prepare(sql) as SQLitePreparedStatement;

  return {
    async all(...params: any[]) {
      return statement.all(...params) as T[];
    },
    async get(...params: any[]) {
      return (statement.get(...params) as T | undefined) ?? null;
    },
    async run(...params: any[]) {
      const result = statement.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid ?? null,
      };
    },
  };
}

function createD1Statement<T = unknown>(db: D1Binding, sql: string): DatabasePreparedStatement<T> {
  return {
    async all(...params: any[]) {
      const prepared = db.prepare(sql);
      const statement = params.length ? prepared.bind(...params) : prepared;
      const result = await statement.all();
      return (result?.results as T[] | undefined) ?? [];
    },
    async get(...params: any[]) {
      const prepared = db.prepare(sql);
      const statement = params.length ? prepared.bind(...params) : prepared;
      const row = await statement.first();
      return (row as T | undefined) ?? null;
    },
    async run(...params: any[]) {
      const prepared = db.prepare(sql);
      const statement = params.length ? prepared.bind(...params) : prepared;
      const result = await statement.run();
      return mapD1Result(result);
    },
  };
}

function createSqliteClient(db: SQLiteDatabase): DatabaseClient {
  const client: DatabaseClient = {
    prepare<T = unknown>(sql: string): DatabasePreparedStatement<T> {
      return createSqliteStatement<T>(db, sql);
    },
    close: () => {
      if (typeof (db as any).close === "function") {
        (db as any).close();
      }
    },
  };

  return client;
}

function createD1Client(db: D1Binding): DatabaseClient {
  return {
    prepare<T = unknown>(sql: string): DatabasePreparedStatement<T> {
      return createD1Statement<T>(db, sql);
    },
  };
}

let sqliteClient: DatabaseClient | null = null;

function createLocalDatabase(): SQLiteDatabase {
  if (typeof process === "undefined" || process.release?.name !== "node") {
    throw new Error("SQLite database is only available in a Node.js runtime");
  }

  let nodeRequire: NodeRequireFunction | undefined;

  try {
    nodeRequire = new Function(
      "return typeof require !== 'undefined' ? require : undefined;",
    )();
  } catch {
    nodeRequire = undefined;
  }

  if (!nodeRequire && typeof __non_webpack_require__ === "function") {
    nodeRequire = __non_webpack_require__;
  }

  if (!nodeRequire) {
    throw new Error(
      "Unable to load the SQLite driver. Ensure the API route runs with runtime \"nodejs\" or provide a D1 binding.",
    );
  }
  const Database = nodeRequire("better-sqlite3");
  const path = nodeRequire("path") as typeof import("node:path");
  const fs = nodeRequire("fs") as typeof import("node:fs");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  let dbPath = databaseUrl;
  if (databaseUrl.startsWith("file:")) {
    const relativePath = databaseUrl.replace(/^file:/, "");
    dbPath = path.resolve(process.cwd(), relativePath);
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const instance = new Database(dbPath, { fileMustExist: false }) as SQLiteDatabase & {
    pragma?: (pragma: string) => void;
  };

  instance.pragma?.("journal_mode = WAL");
  instance.pragma?.("foreign_keys = ON");

  return instance;
}

export function getLocalDatabase(): DatabaseClient {
  if (!sqliteClient) {
    const db = createLocalDatabase();
    sqliteClient = createSqliteClient(db);
  }
  return sqliteClient;
}

function resolveD1Binding(env: Record<string, any> | undefined | null) {
  if (!env) {
    return null;
  }

  return (
    env.DB ||
    env.db ||
    env.promptverse_db ||
    env.PROMPTVERSE_DB ||
    env.PromptverseDb ||
    env.promptverse_d1_db ||
    env.PROMPTVERSE_D1_DB ||
    env.PromptverseD1Db
  );
}

export function getD1FromEnv(env: Record<string, any> | undefined | null): DatabaseClient {
  const binding = resolveD1Binding(env);

  if (!binding) {
    throw new Error(
      "D1 binding not found. Expected 'DB', 'promptverse_db', or 'promptverse_d1_db' to be configured",
    );
  }

  return createD1Client(binding as D1Binding);
}

export function getDatabaseClient(env?: Record<string, any> | null): DatabaseClient {
  const isNodeRuntime =
    typeof process !== "undefined" && process.release?.name === "node";

  const bindingEnv =
    env ??
    ((globalThis as any).__ENV__ as Record<string, any> | null) ??
    ((globalThis as any).env as Record<string, any> | null) ??
    null;

  const binding = resolveD1Binding(bindingEnv);

  if (binding) {
    return getD1FromEnv(bindingEnv!);
  }

  if (!isNodeRuntime) {
    // Non-Node (Workers/Edge) must use D1 bindings; do not fallback to local SQLite.
    throw new Error(
      "D1 binding not found in non-Node runtime. Ensure wrangler.toml defines d1_databases and the binding name (e.g., 'promptverse_db') is available to the runtime."
    );
  }

  return getLocalDatabase();
}

export function getDatabaseFromRequest(request: Request | { env?: Record<string, any> }): DatabaseClient {
  const maybeEnv = (request as any)?.env ?? undefined;
  return getDatabaseClient(
    maybeEnv ??
      ((globalThis as any).__ENV__ as Record<string, any> | null) ??
      ((globalThis as any).env as Record<string, any> | null) ??
      null,
  );
}
