import { z } from 'zod'

export const PO_STATUSES = [
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
  'cancelled',
] as const
export type PoStatus = (typeof PO_STATUSES)[number]

/**
 * Dòng PO: ĐVT kép qua spec/qty2/unit2 (mẫu in nhôm cây↔kg, kính tấm↔m² — OI-10).
 * price_basis (0053): 'unit' = SL đặt × giá (mặc định); 'unit2' = qty2 × giá
 * (sắt mua theo cây nhưng giá theo kg) — khi đó qty2 + unit2 bắt buộc.
 */
export const poLineInputSchema = z
  .object({
    material_id: z.string().uuid(),
    qty_ordered: z.coerce.number().positive(),
    unit_price: z.coerce.number().min(0).optional().nullable(),
    price_basis: z.enum(['unit', 'unit2']).default('unit'),
    spec: z.string().trim().max(100).optional().nullable(), // quy cách: 25x50x1li…
    qty2: z.coerce.number().positive().optional().nullable(), // tổng kg / tổng m²
    unit2: z.string().trim().max(30).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(), // gắn bộ phận SP
  })
  .refine((l) => l.price_basis !== 'unit2' || (l.qty2 != null && !!l.unit2), {
    message: 'Giá tính theo đơn vị 2: cần nhập tổng số lượng và đơn vị (vd 54 kg)',
    path: ['qty2'],
  })

export const poCreateSchema = z.object({
  // Gắn LSX = PO theo lệnh sản xuất; null/bỏ trống = PO ngoài LSX (tiêu hao/dùng
  // chung — 0076 nới BR-06 phần LSX, phần 1-NCC giữ nguyên).
  production_order_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid(), // BR-06: đúng 1 NCC
  currency: z.string().trim().toUpperCase().length(3).default('VND'),
  vat_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  price_includes_vat: z.coerce.boolean().default(true),
  expected_at: z.string().date().optional().nullable(), // thời gian giao hàng
  terms: z.string().trim().max(1000).optional().nullable(), // bảo hành, điều kiện
  note: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(poLineInputSchema)
    .min(1, 'Đơn đặt phải có ít nhất 1 dòng vật tư')
    .max(200)
    .refine(
      (lines) => new Set(lines.map((l) => l.material_id)).size === lines.length,
      'Vật tư bị trùng dòng',
    ),
})

/** Chỉ PO chờ duyệt được sửa (service chặn). */
export const poUpdateSchema = poCreateSchema

export const poListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(PO_STATUSES).optional(),
  supplier_id: z.string().uuid().optional(),
  production_order_id: z.string().uuid().optional(),
  /** Lọc loại đơn: 'lsx' = theo lệnh SX, 'standalone' = ngoài LSX (0076). */
  scope: z.enum(['lsx', 'standalone']).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(1000).default(100),
})

/** GĐ duyệt / từ chối (BR-05, FR-ADM-03). Từ chối → cancelled + lý do. */
export const poDecideSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.decision !== 'reject' || (d.reason && d.reason.length > 0), {
    message: 'Từ chối phải kèm lý do',
  })

/** Tiến trạng thái sau duyệt: gửi NCC (BR-05) → NCC xác nhận → đang giao. */
export const poAdvanceSchema = z.object({
  to: z.enum(['ordered', 'confirmed', 'in_transit']),
})

export const poCancelSchema = z.object({
  reason: z.string().trim().min(1, 'Huỷ đơn phải kèm lý do').max(1000),
})
