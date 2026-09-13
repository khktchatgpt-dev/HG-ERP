import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { paymentTermsService } from '@/modules/dept/accounting/payment-terms.service'
import {
  companyDefaultTermSchema,
  supplierTermSchema,
} from '@/modules/dept/accounting/payment-terms.schema'

/**
 * Đặt MẶC ĐỊNH CÔNG TY — một dòng phủ mọi khoản nợ chưa có điều khoản riêng.
 * Đây là đường chính; ghi đè theo NCC là PATCH bên dưới.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { term } = await parseJson(req, companyDefaultTermSchema)
  return NextResponse.json(await paymentTermsService.setCompanyDefault(user, term))
})

/** Ghi đè cho MỘT nhà cung cấp — chỉ dùng khi NCC đó khác mặc định. */
export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { supplier_id, days } = await parseJson(req, supplierTermSchema)
  await paymentTermsService.setSupplierDays(user, supplier_id, days)
  return NextResponse.json({ ok: true })
})
