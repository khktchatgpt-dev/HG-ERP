import { z } from 'zod'
import { TRIP_MODES } from '@/lib/chuyen-hang'

/** Chuyến hàng (0216) — chỉ nhận biết đơn về kho, không có tiền. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ')

export const tripInputSchema = z
  .object({
    mode: z.enum(TRIP_MODES),
    carrier_name: z.string().trim().min(2, 'Ghi tên chành hoặc nhà xe').max(200),
    carrier_id: z.string().uuid().nullable().optional(),
    receipt_no: optText(100),
    sent_on: isoDate,
    eta: isoDate.nullable().optional(),
    packages: z.coerce.number().int().positive().nullable().optional(),
    package_unit: optText(30),
    weight_kg: z.coerce.number().positive().nullable().optional(),
    note: optText(1000),
    po_ids: z
      .array(z.string().uuid())
      .min(1, 'Chọn ít nhất một đơn đi trong chuyến')
      .max(50),
  })
  .refine((v) => !v.eta || v.eta >= v.sent_on, {
    message: 'Ngày dự kiến tới trước ngày gửi',
    path: ['eta'],
  })
export type TripInput = z.infer<typeof tripInputSchema>

export const tripCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Ghi lý do huỷ chuyến').max(500),
})
