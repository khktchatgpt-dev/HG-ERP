import { z } from 'zod'

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
