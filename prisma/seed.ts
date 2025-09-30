import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create sample users
  const user1 = await prisma.user.create({
    data: {
      email: 'john@example.com',
      name: 'John Doe',
    },
  })

  const user2 = await prisma.user.create({
    data: {
      email: 'hany@example.com',
      name: 'Hany alsamman',
    },
  })

  const user3 = await prisma.user.create({
    data: {
      email: 'mike@example.com',
      name: 'Mike Johnson',
    },
  })

  // Create categories
  const marketingCategory = await prisma.category.create({
    data: {
      name: 'Marketing',
      description: 'Marketing and content creation prompts',
      color: '#3B82F6',
    },
  })

  const codeCategory = await prisma.category.create({
    data: {
      name: 'Code Generation',
      description: 'Programming and development prompts',
      color: '#10B981',
    },
  })

  const creativeCategory = await prisma.category.create({
    data: {
      name: 'Creative Writing',
      description: 'Creative and storytelling prompts',
      color: '#F59E0B',
    },
  })

  const analysisCategory = await prisma.category.create({
    data: {
      name: 'Analysis',
      description: 'Data analysis and research prompts',
      color: '#EF4444',
    },
  })

  const businessCategory = await prisma.category.create({
    data: {
      name: 'Business',
      description: 'Business and strategy prompts',
      color: '#8B5CF6',
    },
  })

  // Create tags
  const tags = await Promise.all([
    prisma.tag.create({ data: { name: 'blog', color: '#3B82F6' } }),
    prisma.tag.create({ data: { name: 'content', color: '#10B981' } }),
    prisma.tag.create({ data: { name: 'marketing', color: '#F59E0B' } }),
    prisma.tag.create({ data: { name: 'react', color: '#06B6D4' } }),
    prisma.tag.create({ data: { name: 'typescript', color: '#3178C6' } }),
    prisma.tag.create({ data: { name: 'component', color: '#007ACC' } }),
    prisma.tag.create({ data: { name: 'ecommerce', color: '#059669' } }),
    prisma.tag.create({ data: { name: 'product', color: '#DC2626' } }),
    prisma.tag.create({ data: { name: 'sales', color: '#EA580C' } }),
  ])

  // Create prompts
  const prompt1 = await prisma.prompt.create({
    data: {
      title: 'Blog Post Introduction',
      content: 'Write a compelling introduction for a blog post about [topic]. The introduction should grab the reader\'s attention, present the main problem or question, and provide a brief overview of what will be covered.',
      description: 'Perfect for creating engaging blog post openings',
      targetModel: 'GPT-4',
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      notes: 'This prompt works best for informational blog posts. Adjust the temperature for more creative variations.',
      isFavorite: true,
      viewCount: 156,
      authorId: user1.id,
      categoryId: marketingCategory.id,
      tags: {
        create: [
          { tagId: tags[0].id }, // blog
          { tagId: tags[1].id }, // content
          { tagId: tags[2].id }, // marketing
        ],
      },
    },
  })

  const prompt2 = await prisma.prompt.create({
    data: {
      title: 'React Component Generator',
      content: 'Create a React component that [description]. The component should be functional, use hooks if necessary, and include proper TypeScript types. Make it reusable and well-documented.',
      description: 'Generate clean React components with TypeScript',
      targetModel: 'GPT-4',
      temperature: 0.3,
      maxTokens: 2000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      notes: 'Ideal for generating boilerplate components. Lower temperature ensures more consistent output.',
      isFavorite: true,
      viewCount: 203,
      authorId: user2.id,
      categoryId: codeCategory.id,
      tags: {
        create: [
          { tagId: tags[3].id }, // react
          { tagId: tags[4].id }, // typescript
          { tagId: tags[5].id }, // component
        ],
      },
    },
  })

  const prompt3 = await prisma.prompt.create({
    data: {
      title: 'Product Description',
      content: 'Write a persuasive product description for [product name]. Highlight the key features, benefits, and unique selling points. Use emotional language and include a call to action.',
      description: 'Create compelling product descriptions that convert',
      targetModel: 'Claude 3',
      temperature: 0.8,
      maxTokens: 800,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      notes: 'Higher temperature helps create more engaging and varied marketing copy.',
      isFavorite: false,
      viewCount: 89,
      authorId: user3.id,
      categoryId: marketingCategory.id,
      tags: {
        create: [
          { tagId: tags[6].id }, // ecommerce
          { tagId: tags[7].id }, // product
          { tagId: tags[8].id }, // sales
        ],
      },
    },
  })

  // Create ratings
  await prisma.rating.create({
    data: {
      value: 5,
      comment: 'Excellent prompt for creating engaging blog intros!',
      userId: user1.id,
      promptId: prompt1.id,
    },
  })

  await prisma.rating.create({
    data: {
      value: 4,
      comment: 'Great for boilerplate code, sometimes needs adjustments',
      userId: user2.id,
      promptId: prompt2.id,
    },
  })

  await prisma.rating.create({
    data: {
      value: 4,
      userId: user3.id,
      promptId: prompt1.id,
    },
  })

  // Create versions
  await prisma.promptVersion.create({
    data: {
      title: 'Blog Post Introduction',
      content: 'Write a compelling introduction for a blog post about [topic]. The introduction should grab the reader\'s attention, present the main problem or question, and provide a brief overview of what will be covered.',
      description: 'Perfect for creating engaging blog post openings',
      targetModel: 'GPT-4',
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      notes: 'This prompt works best for informational blog posts. Adjust the temperature for more creative variations.',
      versionNote: 'Initial version created',
      originalPromptId: prompt1.id,
    },
  })

  await prisma.promptVersion.create({
    data: {
      title: 'React Component Generator',
      content: 'Create a React component that [description]. The component should be functional, use hooks if necessary, and include proper TypeScript types. Make it reusable and well-documented.',
      description: 'Generate clean React components with TypeScript',
      targetModel: 'GPT-4',
      temperature: 0.3,
      maxTokens: 2000,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      notes: 'Ideal for generating boilerplate components. Lower temperature ensures more consistent output.',
      versionNote: 'Initial version with TypeScript support',
      originalPromptId: prompt2.id,
    },
  })

  await prisma.promptVersion.create({
    data: {
      title: 'React Component Generator v2',
      content: 'Create a React component that [description] with proper error handling and accessibility. The component should be functional, use hooks if necessary, and include comprehensive TypeScript types. Make it reusable, well-documented, and follow React best practices.',
      description: 'Generate clean React components with TypeScript and best practices',
      targetModel: 'GPT-4',
      temperature: 0.4,
      maxTokens: 2500,
      topP: 0.9,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      notes: 'Enhanced version with error handling and accessibility requirements.',
      versionNote: 'Added error handling and accessibility requirements',
      originalPromptId: prompt2.id,
    },
  })

  await prisma.promptVersion.create({
    data: {
      title: 'Product Description',
      content: 'Write a persuasive product description for [product name]. Highlight the key features, benefits, and unique selling points. Use emotional language and include a call to action.',
      description: 'Create compelling product descriptions that convert',
      targetModel: 'Claude 3',
      temperature: 0.8,
      maxTokens: 800,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      notes: 'Higher temperature helps create more engaging and varied marketing copy.',
      versionNote: 'Initial version focused on emotional language',
      originalPromptId: prompt3.id,
    },
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })