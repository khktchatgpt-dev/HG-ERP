import { z } from 'zod'

/** Loại chứng chỉ phổ biến DN sản xuất. */
export const CERT_TYPES = [
  'ISO 9001',
  'ISO 14001',
  'IATF 16949',
  'HACCP',
  'GMP',
  'FDA',
  'CE',
  'RoHS',
  'REACH',
  'Khác',
] as const

/** Thêm chứng chỉ NCC (M3) — không theo dõi hạn. */
export const certCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  cert_type: z.string().trim().min(1).max(100),
  cert_no: z.string().trim().max(100).optional().nullable(),
  issued_on: z.string().date().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
})

export const certListQuerySchema = z.object({
  supplier_id: z.string().uuid(),
})
