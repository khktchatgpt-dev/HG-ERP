import { z } from 'zod'

/** Hàng mắc (Đợt 3 §2.3) — hàng rào ở biên API. */

const oO = {
  material_id: z.string().uuid(),
  /** Null = lượng chưa gắn khu (dòng sổ trước 0193). */
  bin_id: z.string().uuid().optional().nullable(),
  qty: z.coerce.number().positive('Lượng phải lớn hơn 0'),
}

export const doiTrangThaiSchema = z.object({
  ...oO,
  from: z.enum(['ok', 'qc', 'blocked']),
  to: z.enum(['ok', 'qc', 'blocked']),
  /*
   * Lý do BẮT BUỘC cả hai chiều. Mở khoá là nói "tôi đã kiểm lại và hàng này
   * dùng được" — câu đó phải có người ký tên, nếu không thì trạng thái khoá
   * chỉ là một nút ai bấm cũng được.
   */
  reason: z.string().trim().min(1, 'Đổi trạng thái phải kèm lý do').max(500),
})

export const huyHangMacSchema = z.object({
  ...oO,
  reason: z.string().trim().min(1, 'Xuất huỷ bắt buộc ghi rõ nguyên nhân').max(500),
})
