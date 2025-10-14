import { createZodDto } from 'nestjs-zod/dto'

import { updateArticleSchema } from '../schemas/article.schemas'

export class UpdateArticleDto extends createZodDto(updateArticleSchema) {
  title?: string
  description?: string | null
  publishedAt?: Date | null
}
