import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { soDaGhiService } from '@/modules/dept/production/so-da-ghi.service'
import { soDaGhiSaveSchema } from '@/modules/dept/production/entries.schema'
import { buildSoDaGhiExcel } from '@/modules/dept/production/so-da-ghi-excel'

const querySchema = z.object({
  date: z.string().optional(),
  to: z.string().optional(),
  phieu: z.string().optional(),
  cd: z.string().optional(),
})

/**
 * EXCEL Sổ theo ngày (tên cũ Sổ đã ghi) — cùng tham số URL với màn `/thongke/da-ghi`, đổ từ CÙNG
 * payload `soDaGhiService.load`. Đọc: mọi NV đã đăng nhập (như Năng suất).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const p = await soDaGhiService.load(user, q)
  const buf = await buildSoDaGhiExcel(p)
  const filename = `so-theo-ngay_${p.date}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})

/** "Lưu thay đổi" — sửa số trên dòng đã ghi + xoá dòng (service gác từng dòng). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const body = await parseJson(req, soDaGhiSaveSchema)
  const res = await soDaGhiService.save(user, body)
  return NextResponse.json(res)
})
