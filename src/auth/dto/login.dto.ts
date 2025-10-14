import { createZodDto } from 'nestjs-zod/dto'

import { loginSchema } from '../schemas/auth.schemas'

export class LoginDto extends createZodDto(loginSchema) {
  email!: string
  password!: string
}
