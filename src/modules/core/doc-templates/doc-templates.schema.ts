import { z } from 'zod'
import { RESET_SCOPES } from '@/lib/doc-templates'

/**
 * Một cột chữ ký trên phiếu in.
 *
 * `slot` PHẢI có mặt ở đây dù màn cấu hình không cho sửa: zod LƯỢC BỎ mọi khoá
 * không khai, nên thiếu nó thì cứ bấm Lưu là chỗ móc tên người rụng mất và phiếu
 * kho in ra trống tên người lập / người giao hàng.
 */
const signatureSchema = z.object({
  role: z.string().trim().min(1).max(80),
  hint: z.string().trim().max(80).optional(),
  slot: z.enum(['creator', 'approver', 'counterparty']).optional(),
})

/**
 * Sửa mẫu chứng từ. MỌI trường tuỳ chọn — form gửi cả cụm nhưng người dùng có
 * thể chỉ đụng phần đánh số hoặc chỉ phần mẫu in.
 *
 * `kind` KHÔNG nằm ở đây: mã loại chứng từ là khoá nghiệp vụ (code gọi
 * `next_doc_code('PO')`), đổi được là mã cũ mồ côi. Nó đi trong đường dẫn.
 */
export const docTemplateUpdateSchema = z.object({
  prefix: z.string().trim().max(10).nullable().optional(),
  /**
   * Khuôn bắt buộc có `{seq}` — thiếu nó thì mọi phiếu cùng kỳ ra CÙNG MỘT MÃ,
   * và cột `code` unique sẽ ném lỗi ngay lần lập phiếu thứ hai.
   */
  pattern: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((v) => v.includes('{seq}'), {
      message: 'Khuôn phải có {seq} — thiếu thì mọi phiếu ra trùng mã',
    })
    .optional(),
  seq_pad: z.coerce.number().int().min(1).max(10).optional(),
  reset_scope: z.enum(RESET_SCOPES).optional(),

  title_vi: z.string().trim().min(1).max(120).optional(),
  title_en: z.string().trim().max(120).nullable().optional(),
  national_heading: z.boolean().optional(),
  form_no: z.string().trim().max(20).nullable().optional(),
  signatures: z.array(signatureSchema).max(6).optional(),
  default_terms: z.string().trim().max(2000).optional(),
})

export type DocTemplateUpdate = z.infer<typeof docTemplateUpdateSchema>
