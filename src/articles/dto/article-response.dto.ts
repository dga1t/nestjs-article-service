import { createZodDto } from 'nestjs-zod/dto'
import { z } from 'zod'

import { publicUserSchema } from '../../users/dto/user-response.dto'

export const articleResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
  authorId: z.string().uuid(),
  author: publicUserSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const articleListResponseSchema = z.object({
  items: z.array(articleResponseSchema),
  meta: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
  }),
})

export class ArticleResponseDto extends createZodDto(articleResponseSchema) {}

export class ArticleListResponseDto extends createZodDto(articleListResponseSchema) {}
