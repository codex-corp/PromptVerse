import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { generateId } from '../src/lib/id'

const prisma = new PrismaClient()

const ENGINEERING_CATEGORIES = [
  { name: 'Code Quality', description: 'Reviews, testing, and debugging workflows', color: '#3B82F6' },
  { name: 'Architecture', description: 'System design and trade-off analysis', color: '#10B981' },
  { name: 'Operations', description: 'Migrations, incidents, and runbooks', color: '#F59E0B' },
]

const SUPPORTED_MODELS = [
  { name: 'gpt-4o', provider: 'openai' },
  { name: 'gpt-4o-mini', provider: 'openai' },
  { name: 'gpt-4.1', provider: 'openai' },
  { name: 'gpt-4.1-mini', provider: 'openai' },
  { name: 'o1-mini', provider: 'openai' },
  { name: 'LongCat-Flash-Chat', provider: 'longcat' },
  { name: 'LongCat-Flash-Thinking', provider: 'longcat' },
]

async function main() {
  const seedUserEmail = (process.env.SEED_USER_EMAIL ?? 'hany@codexc.com').trim()
  const seedUserName = (process.env.SEED_USER_NAME ?? 'Hany alsamman').trim()

  console.log('Resetting database...')

  await prisma.promptTag.deleteMany({})
  await prisma.rating.deleteMany({})
  await prisma.promptVersion.deleteMany({})
  await prisma.prompt.deleteMany({})
  await prisma.tag.deleteMany({})
  await prisma.category.deleteMany({})
  await prisma.user.deleteMany({})

  console.log('Creating base user...')
  const hany = await prisma.user.create({
    data: {
      email: seedUserEmail,
      name: seedUserName,
    },
  })

  await seedModelsIfPresent()

  console.log('Seeding categories...')
  const categories = await Promise.all(
    ENGINEERING_CATEGORIES.map((category) =>
      prisma.category.create({ data: category })
    )
  )

  const categoryByName = Object.fromEntries(categories.map((category) => [category.name, category]))

  console.log('Adding engineering templates...')

  const ensureTags = async (names: string[]) => {
    const results: Array<{ tagId: string }> = []
    for (const name of names) {
      let tag = await prisma.tag.findUnique({ where: { name } })
      if (!tag) {
        tag = await prisma.tag.create({ data: { name, color: '#6366F1' } })
      }
      results.push({ tagId: tag.id })
    }
    return results
  }

  const templates = [
    {
      title: 'Code review risk radar',
      description: 'Staff engineer review focused on regressions and missing tests.',
      category: 'Code Quality',
      content:
        'Review this pull request like a staff engineer. Highlight regressions, missing tests, and risk areas.\n\nProject: [repo]\nImpact: [blast radius]\nStandards: [tests/perf/docs]\nSummary: [paste]\nDiff: [paste]\n\nAnswer with Merge Blockers, High Priority, Questions, Test Gaps, Nice-to-haves.',
      tags: ['code-review', 'quality'],
    },
    {
      title: 'Architecture trade study',
      description: 'Compare implementation options with pros/cons and recommendation.',
      category: 'Architecture',
      content:
        'Act as a principal engineer. Compare Option A/B/C for [problem]. Include pros/cons, risks, mitigations, and recommend the best fit against success criteria [list].',
      tags: ['architecture', 'trade-off'],
    },
    {
      title: 'Migration runbook',
      description: 'Draft phased migration steps with readiness, rollback, and monitoring.',
      category: 'Operations',
      content:
        'Plan a phased migration for [change]. Include readiness checklist, execution steps per environment, rollback plan, monitoring, and comms.',
      tags: ['migration', 'runbook'],
    },
  ]

  for (const template of templates) {
    const prompt = await prisma.prompt.create({
      data: {
        title: template.title,
        description: template.description,
        content: template.content,
        targetModel: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 1024,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        notes: 'Seeded engineering template',
        authorId: hany.id,
        categoryId: categoryByName[template.category].id,
        tags: { create: await ensureTags(template.tags) },
      },
    })

    await prisma.promptVersion.create({
      data: {
        title: prompt.title,
        content: prompt.content,
        description: prompt.description,
        targetModel: prompt.targetModel,
        temperature: prompt.temperature,
        maxTokens: prompt.maxTokens,
        topP: prompt.topP,
        frequencyPenalty: prompt.frequencyPenalty,
        presencePenalty: prompt.presencePenalty,
        notes: prompt.notes,
        versionNote: 'Initial version',
        originalPromptId: prompt.id,
      },
    })
  }

  console.log('Seeding complete.')
}

async function seedModelsIfPresent() {
  const tableResult = await prisma.$queryRaw<{ name?: string }[]>`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Model'
  `

  if (!tableResult.length) {
    console.warn('Model table not found; skipping model seed.')
    return
  }

  console.log('Seeding models...')
  await prisma.$executeRaw`DELETE FROM "Model"`

  const timestamp = new Date().toISOString()
  for (const model of SUPPORTED_MODELS) {
    await prisma.$executeRaw`
      INSERT INTO "Model" ("id", "name", "provider", "createdAt", "updatedAt")
      VALUES (${generateId()}, ${model.name}, ${model.provider}, ${timestamp}, ${timestamp})
    `
  }
}

main()
  .catch((error) => {
    console.error('Seeding failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
