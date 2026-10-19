import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { napHoSoService } from '@/modules/dept/hr/cham-cong/nap-ho-so.service'
import { napHoSoSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Nạp hồ sơ nhân viên từ Excel (B4): `xem` trả xem trước, `ghi` đọc lại vùng dán rồi ghi. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, napHoSoSchema)
  const chon = Object.fromEntries(
    Object.entries(v.chon ?? {}).map(([k, id]) => [Number(k), id]),
  )
  if (v.viec === 'xem')
    return NextResponse.json(await napHoSoService.xem(user, v.text, v.ghiDe, chon))
  return NextResponse.json(await napHoSoService.ghi(user, v.text, v.ghiDe, chon))
})
