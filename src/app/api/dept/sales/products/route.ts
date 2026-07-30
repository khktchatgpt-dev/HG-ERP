import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import {
  productPickQuerySchema,
  quickProductCreateSchema,
} from '@/modules/dept/technical/technical.schema'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'

/**
 * Ô chọn SP của form báo giá / đơn hàng: tìm phía server, trả ≤25 dòng cột hẹp.
 * `?ids=` = nạp lại đúng các SP đang nằm trên dòng (mở form sửa).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), productPickQuerySchema)
  const { rows, fuzzy } = await productsService.pick(user, q)
  return NextResponse.json({
    products: rows.map(toQuotePickPayload),
    fuzzy: fuzzy ?? false,
  })
})

/**
 * Tạo nhanh sản phẩm từ màn Kinh doanh (báo giá/đơn) — cho phép Sales tự thêm SP
 * mới để quản lý; Kỹ thuật bổ sung BOM/thông số sau. Trả về SP để form gắn vào dòng.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, quickProductCreateSchema)
  const product = await productsService.quickCreate(user, input)
  return NextResponse.json(
    {
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        unit: product.unit,
        customer_id: product.customer_id,
        customer_item_code: product.customer_item_code,
        bom_status: product.bom_status,
        image_file_id: product.image_file_id,
        description_en: product.description_en,
        packing: product.packing,
      },
    },
    { status: 201 },
  )
})
