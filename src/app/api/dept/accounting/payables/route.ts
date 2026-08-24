import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'

/** Sổ công nợ NCC — tổng hợp per NCC per tiền tệ (GĐ C.1). */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const data = await payablesService.list(user)
  return NextResponse.json(data)
})
