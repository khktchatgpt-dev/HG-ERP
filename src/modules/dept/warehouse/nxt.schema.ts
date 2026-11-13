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
