import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email')
export const passwordSchema = z.string().min(8, 'Password ≥ 8 chars').max(200)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})
