import { z } from 'zod'

/**
 * CHỐT KỲ SỔ KHO (B2, 0297). `thang` là tháng chốt tới (`YYYY-MM`); `luu_y` là
 * khoá các lưu ý người chốt đã tích (`lib/kho-kiem-ky` · `luuYThang`) — máy chủ
 * tính lại danh sách phải tích và so, không tin số đếm từ màn.
 */
export const chotKySchema = z.object({
  thang: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng dạng YYYY-MM'),
  luu_y: z
    .array(z.string().regex(/^(lenh|gia|tygia):\d{4}-\d{2}$/, 'Khoá lưu ý không hợp lệ'))
    .max(120),
})
export type ChotKyInput = z.infer<typeof chotKySchema>

/**
 * MỞ LẠI KỲ SỔ KHO (B3, 0300). `thang` phải là tháng chốt mới nhất (service kiểm);
 * lý do bắt buộc ≥ 10 ký tự — cùng ngưỡng ràng buộc DB `warehouse_period_log`.
 */
export const moLaiKySchema = z.object({
  thang: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng dạng YYYY-MM'),
  ly_do: z
    .string()
    .trim()
    .min(10, 'Ghi lý do mở lại (ít nhất 10 ký tự)')
    .max(500, 'Lý do tối đa 500 ký tự'),
})
export type MoLaiKyInput = z.infer<typeof moLaiKySchema>
