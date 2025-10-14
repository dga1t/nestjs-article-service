import { z } from 'zod'

export const registerSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(255),
    name: z.string().min(1).max(255).optional(),
  })
  .strict()

export const loginSchema = z
  .object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(255),
  })
  .strict()
