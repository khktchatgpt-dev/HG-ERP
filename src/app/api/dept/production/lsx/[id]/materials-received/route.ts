import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

type Params = { params: Promise<{ id: string }> }

/** Xác nhận đã nhận vật tư xuất theo LSX (FR-PROD-02) — mốc trên header. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const lsx = await lsxService.confirmMaterialsReceived(user, id)
  return NextResponse.json({ lsx })
})
