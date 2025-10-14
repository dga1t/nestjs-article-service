import { createZodDto } from 'nestjs-zod/dto'

import { registerSchema } from '../schemas/auth.schemas'

export class RegisterDto extends createZodDto(registerSchema) {
  email!: string
  password!: string
  name?: string
}
