import { createZodDto } from 'nestjs-zod/dto'
import { z } from 'zod'

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export class PublicUserDto extends createZodDto(publicUserSchema) {
  id!: string
  email!: string
  name!: string | null
  createdAt!: string
  updatedAt!: string
}
