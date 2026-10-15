import { z } from 'zod'

/** Tháng của bảng công: 'YYYY-MM'. */
export const bangCongQuerySchema = z.object({
  thang: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải dạng YYYY-MM'),
})

const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')

/** Khoảng ngày lấy về từ máy, tính cả hai đầu; tối đa 1 năm một lần. */
export const keoSchema = z
  .object({ tu: ngay, den: ngay })
  .refine((v) => v.den >= v.tu, {
    message: '"Đến ngày" phải sau hoặc bằng "Từ ngày"',
    path: ['den'],
  })
  .refine((v) => (Date.parse(v.den) - Date.parse(v.tu)) / 86400_000 <= 366, {
    message: 'Mỗi lần lấy tối đa 1 năm',
    path: ['den'],
  })
