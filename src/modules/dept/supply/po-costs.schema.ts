import { z } from 'zod'
import { PO_COST_KINDS } from '@/lib/po-cost'

const optText = (max: number) => z.string().trim().max(max).optional().nullable()

/** Lập phiếu chi phí mua hàng (0211) — một phiếu, một hoặc nhiều đơn. */
export const poCostCreateSchema = z.object({
  payee_supplier_id: z.string().uuid('Chọn người nhận tiền (NCC của đơn hoặc nhà xe)'),
  kind: z.enum(PO_COST_KINDS).default('van_chuyen'),
  cost_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phát sinh dạng YYYY-MM-DD'),
  doc_no: optText(60),
  /** Tiền CHƯA VAT. */
  amount: z.coerce.number().positive('Tiền phí phải lớn hơn 0').max(1e13),
  vat_rate: z.coerce.number().min(0).max(100).nullish(),
  note: optText(1000),
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

export const poCostListQuery = z.object({
  po_id: z.string().uuid(),
})

/** Hộp ghi phí: đơn đang mở + gợi ý cùng chuyến + ô tìm đơn (mã / tên NCC). */
export const poCostCandidatesQuery = z.object({
  po_id: z.string().uuid(),
  q: z.string().trim().max(60).optional(),
})

/** Thêm nhà xe ngay trong hộp ghi phí — chỉ tên + SĐT (Q1, 26/09/2026). */
export const poCostCarrierSchema = z.object({
  name: z.string().trim().min(2, 'Ghi tên nhà xe').max(200),
  phone: optText(30),
})
