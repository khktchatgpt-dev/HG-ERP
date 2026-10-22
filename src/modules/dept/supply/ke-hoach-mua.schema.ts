import { z } from 'zod'
import { PO_TEMPLATES } from '@/lib/po-template'

const uuid = z.string().uuid()

/** Ghi lựa chọn NCC + giá chào cho nhiều mã của một lệnh (0275). */
export const chonNccUpsertSchema = z.object({
  production_order_id: uuid,
  rows: z
    .array(
      z.object({
        material_id: uuid,
        supplier_id: uuid,
        price: z.number().min(0).max(1_000_000_000_000).nullable(),
        price_basis: z.enum(['unit', 'kg']).default('unit'),
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
})

export const chonNccDeleteSchema = z.object({
  production_order_id: uuid,
  material_ids: z.array(uuid).min(1).max(500),
})

export type ChonNccUpsertInput = z.infer<typeof chonNccUpsertSchema>
export type ChonNccDeleteInput = z.infer<typeof chonNccDeleteSchema>

/**
 * Bước 3 — tạo đơn nháp, mỗi NCC một đơn. Client gửi đúng thứ người mua thấy
 * (NCC, mẫu, SL, giá + cơ sở giá); server tự tính dòng theo mẫu (`deriveLine`)
 * và đổi giá về cơ sở dòng đơn — không nhận số tiền từ client.
 */
export const taoDonSchema = z.object({
  production_order_id: uuid,
  groups: z
    .array(
      z.object({
        supplier_id: uuid,
        template: z.enum(PO_TEMPLATES),
        lines: z
          .array(
            z.object({
              material_id: uuid,
              qty: z.number().positive().max(1_000_000_000),
              price: z.number().min(0).max(1_000_000_000_000).nullable(),
              co_so: z.enum(['unit', 'kg']),
            }),
          )
          .min(1)
          .max(200),
      }),
    )
    .min(1)
    .max(30),
})

export type TaoDonInput = z.infer<typeof taoDonSchema>
