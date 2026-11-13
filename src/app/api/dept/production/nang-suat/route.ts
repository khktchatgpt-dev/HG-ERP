import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nangSuatService } from '@/modules/dept/production/nang-suat.service'
import { buildNangSuatExcel } from '@/modules/dept/production/nang-suat-excel'
import { parseKy } from '@/lib/nang-suat'

const querySchema = z.object({
  ky: z.string().optional(),
  theo: z.enum(['cong_doan', 'to']).default('cong_doan'),
})

/**
 * EXCEL màn Năng suất: `?ky=7|14|30&theo=cong_doan|to`. Đổ từ CÙNG payload
 * `nangSuatService.get` mà `/thongke/nang-suat` bày. Đọc: mọi NV đã đăng nhập,
 * cùng tư thế màn Báo cáo.
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const p = await nangSuatService.get({ ky: parseKy(q.ky) })
  const buf = await buildNangSuatExcel(p, q.theo)
  const filename = `nang-suat-${q.theo === 'to' ? 'to' : 'cong-doan'}_${p.from}_${p.to}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
