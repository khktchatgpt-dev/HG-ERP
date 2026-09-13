import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'

type Params = { params: Promise<{ poId: string }> }

/** Đối chiếu ba chiều của MỘT đơn mua: đặt / về / NCC đòi, theo từng dòng. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { poId } = await params
  return NextResponse.json(await supplierInvoicesService.matchForPo(user, poId))
})
