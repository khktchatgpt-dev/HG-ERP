import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ')
export const passwordSchema = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(200)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Chưa nhập mật khẩu'),
})
