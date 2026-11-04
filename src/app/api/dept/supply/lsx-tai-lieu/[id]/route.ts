import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxTaiLieuService } from '@/modules/dept/supply/lsx-tai-lieu.service'
import { todayVn } from '@/lib/date-vn'

type Params = { params: Promise<{ id: string }> }

/**
 * TẢI FILE CỦA LỆNH (.zip) — mọi file hồ sơ SP của các sản phẩm trong lệnh, mỗi
 * SP một thư mục. Luật chọn bản ở `lib/lsx-tai-lieu`, cùng luật tab "Tài liệu SP".
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { buf, filename } = await lsxTaiLieuService.buildZip(user, id, todayVn())
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      // Tên ascii cho trình duyệt cũ + `filename*` giữ dấu — như `server/xlsx`.
      'content-disposition': `attachment; filename="${filename.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
