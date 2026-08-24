import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'

type Params = { params: Promise<{ supplierId: string }> }

/** Chi tiết công nợ 1 NCC: per PO + lịch sử thanh toán. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { supplierId } = await params
  const data = await payablesService.supplierDetail(user, supplierId)
  return NextResponse.json(data)
})
