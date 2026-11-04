import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxTaiLieuService } from '@/modules/dept/supply/lsx-tai-lieu.service'
import { todayVn } from '@/lib/date-vn'

type Params = { params: Promise<{ id: string }> }

/**
 * EXCEL ĐỊNH MỨC THEO SP của lệnh (B2, 04/11/2026): tờ Tổng hợp theo mã VT +
 * tờ Chưa gắn mã + mỗi SP một tờ. Xem `lsx-dinh-muc-excel.ts`.
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { buf, filename } = await lsxTaiLieuService.buildDinhMucExcel(user, id, todayVn())
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
