import { ApiError, apiErrorText } from '@/lib/api'

/**
 * Câu lỗi cho người dùng. `apiErrorText` chỉ đọc được lỗi API — lỗi tải file
 * (quá cỡ, sai kiểu, mất kết nối) là `Error` thường và bị thay bằng câu chung
 * "Không tải được ảnh", tức là nuốt mất lý do thật. Lấy nguyên câu của nó.
 */
export function errText(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return apiErrorText(e, fallback)
  return e instanceof Error && e.message ? e.message : fallback
}
