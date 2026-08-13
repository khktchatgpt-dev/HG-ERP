import { z } from 'zod'
import { passwordSchema } from '@/modules/core/auth/auth.schema'

/**
 * Số điện thoại để LIÊN HỆ NỘI BỘ, không phải để hệ thống gọi/nhắn — nên chỉ
 * chặn ký tự rác, không ép định dạng: máy bàn có đầu số vùng, người phụ trách
 * xuất khẩu hay ghi kèm số nước ngoài, có người ghi hai số cách nhau dấu phẩy.
 */
const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Số điện thoại tối đa 30 ký tự')
  .regex(/^[0-9+()., \-/]+$/, 'Số điện thoại chỉ gồm chữ số và + ( ) . , - /')

/** Ô trống trên form gửi lên chuỗi rỗng — hiểu là "xoá", lưu null. */
const emptyToNull = <T extends z.ZodTypeAny>(inner: T) =>
  z
    .union([inner, z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullable()

export const accountProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Chưa nhập họ tên').max(100),
    phone: emptyToNull(phoneSchema),
  })
  .partial()

export const accountPasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Chưa nhập mật khẩu hiện tại'),
    new_password: passwordSchema,
  })
  .refine((v) => v.current_password !== v.new_password, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['new_password'],
  })

export type AccountProfileInput = z.infer<typeof accountProfileSchema>
export type AccountPasswordInput = z.infer<typeof accountPasswordSchema>

// ── Ảnh đại diện ────────────────────────────────────────────────────────────

/**
 * Ảnh hiển thị ở góc màn hình cỡ 28–72px, không có chỗ nào phóng to — 2MB đã
 * quá dư. Giữ nhỏ vì ảnh này được ký URL và tải lại ở MỌI trang.
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** Đuôi file theo mime — cũng là danh sách mime được nhận. */
export const AVATAR_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

export type AvatarMime = keyof typeof AVATAR_EXT

export function isAvatarMime(mime: string): mime is AvatarMime {
  return mime in AVATAR_EXT
}
