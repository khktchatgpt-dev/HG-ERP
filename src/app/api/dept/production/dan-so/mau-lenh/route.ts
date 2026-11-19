import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import {
  buildMauLenhExcel,
  mauLenhFilename,
} from '@/modules/dept/production/dan-so-mau-lenh.excel'

/**
 * File mẫu nhập liệu theo lệnh (bản vẽ v2, 19/11/2026). `xem=1` → JSON tóm tắt (màn chọn phạm vi);
 * không có → tải file .xlsx.
 */
export const maxDuration = 60

const ngay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const querySchema = z.object({
  lsx_id: z.string().uuid(),
  /** Mã SP, ngăn bằng dấu phẩy; bỏ trống = cả lệnh. */
  ma: z.string().max(2000).optional(),
  tu: ngay,
  den: ngay,
  dien: z.enum(['0', '1']).optional(),
  xem: z.enum(['0', '1']).optional(),
})

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const m = await danSoService.mauLenh(user, {
    lsx_id: q.lsx_id,
    ma: q.ma ? q.ma.split(',').filter(Boolean) : undefined,
    tu: q.tu,
    den: q.den,
    dien: q.dien !== '0',
  })
  if (q.xem === '1') {
    return NextResponse.json({
      lsx_code: m.lsx_code,
      so_ngay: m.cot.length,
      to: m.to.map((t) => ({
        stage: t.stage,
        label: t.label,
        don_vi: t.don_vi,
        to: t.to?.name ?? null,
        so_dong: t.dong.length,
        so_o_co: t.so_o_co,
        ma: [...new Set(t.dong.map((d) => d.ma))],
      })),
    })
  }
  const buf = await buildMauLenhExcel(m)
  const filename = mauLenhFilename(m)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
