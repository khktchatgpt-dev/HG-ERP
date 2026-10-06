import { z } from 'zod'

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

/** Kế hoạch xuất của MỘT lệnh do Sale chia (0222) — lưu cả bộ, thay bộ cũ. */
export const shipPlanSaveSchema = z.object({
  lots: z
    .array(
      z.object({
        po_no: optText(80),
        po_ref: optText(80),
        order_no: optText(40),
        ship_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày xuất dạng yyyy-mm-dd')
          .nullish()
          .transform((v) => v ?? null),
        note: optText(500),
        lines: z
          .array(
            z.object({
              product_key: z.string().trim().min(1).max(120),
              qty: z.coerce.number().min(0).max(10_000_000),
            }),
          )
          .max(200),
      }),
    )
    .max(500),
})

export type ShipPlanSaveInput = z.infer<typeof shipPlanSaveSchema>
