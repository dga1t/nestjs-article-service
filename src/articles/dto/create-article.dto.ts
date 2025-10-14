import { createZodDto } from 'nestjs-zod/dto'

import { createArticleSchema } from '../schemas/article.schemas'

export class CreateArticleDto extends createZodDto(createArticleSchema) {
  title!: string
  description!: string | null | undefined
  publishedAt!: Date | null | undefined
}
