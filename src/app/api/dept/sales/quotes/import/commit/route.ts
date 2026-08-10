import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quoteImportService } from '@/modules/dept/sales/quote-import.service'

// `.default(null)` để ô bỏ trống ra `null` chứ không `undefined` — service khai
// các trường này là bắt buộc-có-mặt (giá trị có thể null), khỏi phải ?? null khắp nơi.
const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().default(null)
const optNum = z.coerce.number().optional().nullable().default(null)

/**
 * NHỊP 2: người dùng đã soi màn xem trước và bỏ bớt dòng — giờ mới ghi thật.
 * Client gửi lên đúng những dòng giữ lại; server đọc lại file nguồn để bóc ảnh.
 */
const commitSchema = z.object({
  source_file_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  currency: z.string().trim().toUpperCase().length(3).default('USD'),
  rows: z
    .array(
      z.object({
        row: z.coerce.number().int().positive(),
        product_id: z.string().uuid().nullable(),
        code: optText(100),
        name: z.string().trim().min(1, 'Thiếu tên sản phẩm').max(200),
        description_en: optText(2000),
        customer_item_code: optText(100),
        unit: optText(30),
        unit_price: z.coerce.number().min(0),
        length_mm: optNum,
        width_mm: optNum,
        height_mm: optNum,
        material: optText(300),
        qty_per_carton: optNum,
        carton_l_cm: optNum,
        carton_w_cm: optNum,
        carton_h_cm: optNum,
        nw_kg: optNum,
        gw_kg: optNum,
        loading_40hc: optNum,
        note: optText(500),
      }),
    )
    .min(1, 'Không có dòng nào để lưu')
    .max(300),
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, commitSchema)
  const result = await quoteImportService.commit(user, input)
  return NextResponse.json(result, { status: 201 })
})
