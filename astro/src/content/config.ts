import { z, defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { resolve } from 'node:path'

const blogCollection = defineCollection({
  loader: glob(({ pattern: '**/*.md', base: resolve(import.meta.dirname, './blog') })),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string())
  })
})

export const collections = {
  'blog': blogCollection
} as const
