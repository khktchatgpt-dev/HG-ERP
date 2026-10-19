import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nxtService } from '@/modules/dept/warehouse/nxt.service'
import { buildNxtExcel, nxtExcelFilename } from '@/modules/dept/warehouse/nxt-excel'
import { docKy } from '@/lib/kho-nxt'
import { todayVn } from '@/lib/date-vn'

/**
 * Tải BÁO CÁO NHẬP–XUẤT–TỒN dạng .xlsx (Kho B6) — `?tu=&den=` cùng kỳ với màn
 * `/warehouse/bao-cao`; `?tatca=1` gồm cả mã không phát sinh. Quyền: service.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams
  const ky = docKy(sp.get('tu') ?? undefined, sp.get('den') ?? undefined, todayVn())
  const bc = await nxtService.baoCao(user, ky)
  const buf = await buildNxtExcel(bc, !sp.get('tatca'))
  const filename = nxtExcelFilename(bc)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
