import { z } from 'zod'

const uuid = z.string().uuid()

/** Ghi bảng kê nhập tay: nhiều dòng một lượt (gõ tay, dán từ Excel). */
export const lsxNeedsUpsertSchema = z.object({
  production_order_id: uuid,
  rows: z
    .array(
      z.object({
        material_id: uuid,
        qty_needed: z.number().min(0).max(1_000_000_000),
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
})

export const lsxNeedsDeleteSchema = z.object({
  production_order_id: uuid,
  material_ids: z.array(uuid).min(1).max(500),
})

export type LsxNeedsUpsertInput = z.infer<typeof lsxNeedsUpsertSchema>
export type LsxNeedsDeleteInput = z.infer<typeof lsxNeedsDeleteSchema>
