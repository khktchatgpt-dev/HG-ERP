import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import {
  productPickQuerySchema,
  quickProductCreateSchema,
} from '@/modules/dept/technical/technical.schema'
import { toQuotePickPayload } from '@/modules/dept/sales/orders.view'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { customerLabelFrom, normalizeCustomerLabel } from '@/lib/customer-label'

/**
 * Ô chọn SP của form báo giá / đơn hàng: tìm phía server, trả ≤25 dòng cột hẹp.
 * `?ids=` = nạp lại đúng các SP đang nằm trên dòng (mở form sửa).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), productPickQuerySchema)
  // SP của khách nhận theo customer_id HOẶC nhãn chữ trên hồ sơ SP (cùng luật
  // `customerLabelFrom` mà Kinh doanh dùng khi tạo nhanh SP) — 13/10/2026.
  const customer = q.customer_id ? await customersRepo.findById(q.customer_id) : null
  const label = customer ? customerLabelFrom(customer) : null
  const { rows, fuzzy } = await productsService.pick(user, {
    ...q,
    customer_label: label,
  })
  const products = rows.map((r) => ({
    ...toQuotePickPayload(r),
    is_own:
      !!q.customer_id &&
      (r.customer_id === q.customer_id ||
        (!!label && normalizeCustomerLabel(r.customer_name) === label)),
  }))
  // SP của khách lên đầu, giữ nguyên thứ tự còn lại (sort ổn định).
  products.sort((a, b) => Number(b.is_own) - Number(a.is_own))
  return NextResponse.json({ products, fuzzy: fuzzy ?? false })
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
