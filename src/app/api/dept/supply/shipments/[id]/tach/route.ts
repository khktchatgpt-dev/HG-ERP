import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tachDotTheoPhieuNhap } from '@/modules/dept/supply/po-shipments-tach.service'
import { poShipmentTachSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Tách một đợt theo phiếu nhập: mỗi phiếu một đợt "Đã nhận", phần còn chờ thành đợt hẹn mới. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poShipmentTachSchema)
  const r = await tachDotTheoPhieuNhap(user, id, input)
  return NextResponse.json(r)
})
