import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productFillSpecsSchema } from '@/modules/dept/technical/technical.schema'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'

type Params = { params: Promise<{ id: string }> }

/**
 * Kinh doanh bổ sung quy cách SP còn thiếu ngay trong form báo giá — chỉ những
 * trường in lên báo giá (xem `productsService.fillSpecs`). Trả về đúng phần ô chọn
 * SP cần để vẽ lại dòng.
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, productFillSpecsSchema)
  const product = await productsService.fillSpecs(user, id, input)
  return NextResponse.json({ product: toQuotePickPayload(product) })
})
