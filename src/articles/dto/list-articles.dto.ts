import { createZodDto } from 'nestjs-zod/dto'
import { z } from 'zod'

export const listArticlesSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    authorId: z.string().uuid().optional(),
    publishedFrom: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    publishedTo: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    search: z.string().max(255).optional(),
  })
  .strict()

export class ListArticlesDto extends createZodDto(listArticlesSchema) {
  page!: number
  limit!: number
  authorId?: string
  publishedFrom?: Date
  publishedTo?: Date
  search?: string
}
