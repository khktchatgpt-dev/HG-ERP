import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { baoCaoExcelQuerySchema } from '@/modules/dept/production/production.schema'
import { baoCaoService } from '@/modules/dept/production/bao-cao.service'
import { buildTonExcel, buildTreoExcel } from '@/modules/dept/production/bao-cao-excel'

/**
 * EXCEL hai bảng mới của Báo cáo sản xuất (B6): `?bang=treo|ton&from&to[&team]`.
 * Đổ từ CÙNG payload `baoCaoService.get` mà màn `/thongke/bao-cao` bày — số
 * trên màn và trong file là một. Bốn bảng cũ vẫn qua `reports?format=xlsx`.
 * Đọc: mọi NV đã đăng nhập, cùng tư thế màn báo cáo.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), baoCaoExcelQuerySchema)
  const p = await baoCaoService.get(user, { from: q.from, to: q.to, team: q.team })
  const buf = q.bang === 'treo' ? await buildTreoExcel(p) : await buildTonExcel(p)
  const filename = `${q.bang === 'treo' ? 'sua-lai-treo' : 'ton-cong-doan'}_${p.today}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
