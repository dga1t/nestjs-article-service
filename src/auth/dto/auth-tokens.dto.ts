import { createZodDto } from 'nestjs-zod/dto'
import { z } from 'zod'

export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.string(),
})

export class AuthTokensDto extends createZodDto(authTokensSchema) {
  accessToken!: string
  expiresIn!: string
}
