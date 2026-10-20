import { z } from 'zod'
import {
  CARRIER_KINDS,
  PAID_METHODS,
  PO_COST_KINDS,
  TRANSPORT_MODES,
} from '@/lib/po-cost'

const optText = (max: number) => z.string().trim().max(max).optional().nullable()
const isoDate = (msg: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg)

/**
 * Lập phiếu chi phí vận chuyển (0211 + 0215) — một chuyến, một hoặc nhiều đơn.
 *
 * Người thu: đơn vị trong danh mục (`payee_supplier_id`) HOẶC gõ tự do
 * (`payee_name` — ship lẻ). Ai trả: bỏ trống `paid` = chưa trả, Kế toán trả
 * theo chuyến; có `paid` = người trong công ty đã trả tại chỗ (chi hộ).
 * Ràng buộc chéo (chưa trả thì người thu phải có trong danh mục…) kiểm ở
 * service — nơi còn biết `save_to_catalog` có tạo đơn vị mới hay không.
 */
export const poCostCreateSchema = z.object({
  transport_mode: z.enum(TRANSPORT_MODES).default('nha_xe'),
  payee_supplier_id: z.string().uuid().optional().nullable(),
  payee_name: optText(200),
  payee_phone: optText(30),
  /** Ship lẻ dùng lặp → lưu người thu thành đơn vị trong danh mục. */
  save_to_catalog: z.boolean().optional(),
  kind: z.enum(PO_COST_KINDS).default('van_chuyen'),
  cost_date: isoDate('Ngày chuyến dạng YYYY-MM-DD'),
  doc_no: optText(60),
  /** Tiền CHƯA VAT. */
  amount: z.coerce.number().positive('Tiền phí phải lớn hơn 0').max(1e13),
  vat_rate: z.coerce.number().min(0).max(100).nullish(),
  note: optText(1000),
  paid: z
    .object({
      by: z.string().uuid('Chọn người đã trả'),
      on: isoDate('Ngày trả dạng YYYY-MM-DD'),
      method: z.enum(PAID_METHODS),
    })
    .optional()
    .nullable(),
  po_ids: z
    .array(z.string().uuid())
    .min(1, 'Gắn phiếu vào ít nhất một đơn')
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Một đơn chỉ gắn một lần'),
})
export type PoCostCreateInput = z.infer<typeof poCostCreateSchema>

export const poCostVoidSchema = z.object({
  reason: z.string().trim().min(5, 'Ghi rõ vì sao huỷ phiếu (ít nhất 5 ký tự)').max(1000),
})

/** Không `po_id` = sổ chuyến (mọi phiếu). */
export const poCostListQuery = z.object({
  po_id: z.string().uuid().optional(),
})

/** Hộp ghi phí: đơn đang mở (nếu có) + gợi ý cùng chuyến + ô tìm đơn. */
export const poCostCandidatesQuery = z.object({
  po_id: z.string().uuid().optional(),
  q: z.string().trim().max(60).optional(),
})

/**
 * Đơn vị vận chuyển — thêm nhanh từ hộp ghi phí hay từ danh mục: tên + SĐT là
 * đủ, phần còn lại khai dần ở hồ sơ. KHÔNG phải form NCC 40 ô.
 */
export const carrierCreateSchema = z.object({
  name: z.string().trim().min(2, 'Ghi tên đơn vị vận chuyển').max(200),
  phone: optText(30),
  contact_name: optText(120),
  carrier_kind: z.enum(CARRIER_KINDS).default('nha_xe'),
  address: optText(300),
  pay_method: z.enum(['ck', 'tien_mat']).optional().nullable(),
  payment_terms: optText(120),
  note: optText(1000),
})
export type CarrierCreateInput = z.infer<typeof carrierCreateSchema>

export const carrierPatchSchema = carrierCreateSchema
  .partial()
  .extend({ is_active: z.boolean().optional() })
export type CarrierPatchInput = z.infer<typeof carrierPatchSchema>

/** Giữ tên cũ cho route thêm nhà xe từ hộp ghi phí. */
export const poCostCarrierSchema = carrierCreateSchema
