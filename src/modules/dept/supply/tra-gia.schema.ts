import { z } from 'zod'

/** Kỳ giá chọn được, tháng — 0 = mọi lúc. Mặc định 6 (câu Q2 của bản vẽ 28/10). */
export const TRA_GIA_THANG = [3, 6, 12, 0] as const

const mon = z.object({
  text: z.string().trim().min(1, 'Món trống').max(200),
  sl: z.number().nonnegative().max(1e9).nullable().optional(),
  dvt: z.string().trim().max(20).nullable().optional(),
  /** Quy cách người mua đã chọn khi màn hỏi lại vì món mơ hồ. */
  key: z.string().max(300).nullable().optional(),
})

const MON_TOI_DA = 200
const thang = z
  .union([z.literal(3), z.literal(6), z.literal(12), z.literal(0)])
  .default(6)

/**
 * Danh sách món cần tra giá. Trần 200 món một lượt: một đề nghị mua / bảng kê
 * lệnh dài nhất đo được ~120 dòng; quá nữa thì nên chia.
 */
export const traGiaSchema = z.object({
  items: z
    .array(mon)
    .min(1, 'Chưa có món nào để tra')
    .max(MON_TOI_DA, 'Tối đa 200 món một lượt — chia danh sách ra'),
  thang,
})

export type TraGiaInput = z.infer<typeof traGiaSchema>

/** Giá người mua gọi hỏi được — chỉ đi theo file Excel, không lưu (câu Q4 bản vẽ). */
const giaHoi = z.object({
  id: z.string().min(1).max(40),
  ncc: z.string().trim().min(1, 'Giá hỏi thiếu tên NCC').max(120),
  gia: z.number().positive('Giá hỏi phải lớn hơn 0').max(1e12),
  ghi_chu: z.string().trim().max(200).nullable(),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * XUẤT EXCEL: cùng danh sách món + lựa chọn của người mua (NCC chọn, giá hỏi).
 * Server TRA LẠI giá rồi mới ghi file — không nhận con số client gửi lên.
 */
export const traGiaExcelSchema = z.object({
  items: z
    .array(
      mon.extend({
        /** Khoá phương án đang chọn (`lib/tra-gia-chon`) — trống = rẻ nhất. */
        chon: z.string().max(120).nullable().optional(),
        hoi: z.array(giaHoi).max(20).optional(),
      }),
    )
    .min(1, 'Chưa có món nào để xuất')
    .max(MON_TOI_DA, 'Tối đa 200 món một lượt — chia danh sách ra'),
  thang,
})

export type TraGiaExcelInput = z.infer<typeof traGiaExcelSchema>
