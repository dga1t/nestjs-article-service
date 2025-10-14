import { z } from 'zod'

export const createArticleSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(5000).nullish(),
    publishedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .nullish(),
  })
  .strict()

export const updateArticleSchema = createArticleSchema.partial()
