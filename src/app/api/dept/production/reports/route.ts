import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { reportsQuerySchema } from '@/modules/dept/production/production.schema'
import { reportsService } from '@/modules/dept/production/reports.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import {
  buildSanLuongExcel,
  buildPheExcel,
  buildNangSuatExcel,
  buildDinhMucExcel,
} from '@/modules/dept/production/reports-excel'

/**
 * BÁO CÁO SẢN XUẤT (GĐ4) — kỳ tự do, JSON hoặc Excel:
 *   ?type=san-luong|phe|nang-suat&from&to[&team][&stage][&format=xlsx]
 *   ?type=dinh-muc&lsx=<id>[&format=xlsx]
 * Đọc: mọi NV đã đăng nhập — cùng tư thế các màn thống kê.
 */

function xlsxResponse(buf: Buffer, filename: string): Response {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
}

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), reportsQuerySchema)

  if (q.type === 'dinh-muc') {
    const report = await reportsService.dinhMuc(user, q.lsx!)
    if (q.format === 'xlsx') {
      return xlsxResponse(
        await buildDinhMucExcel(report),
        `dinh-muc_${report.lsx.code}.xlsx`,
      )
    }
    return NextResponse.json(report)
  }

  const range = { from: q.from!, to: q.to!, team: q.team, stage: q.stage }
  if (q.type === 'san-luong') {
    const report = await reportsService.sanLuong(user, range)
    if (q.format === 'xlsx') {
      const stages = await productionRepo.listStages()
      const label = (c: string) => stages.find((s) => s.code === c)?.label ?? c
      return xlsxResponse(
        await buildSanLuongExcel(report, label),
        `san-luong_${q.from}_${q.to}.xlsx`,
      )
    }
    return NextResponse.json(report)
  }
  if (q.type === 'phe') {
    const report = await reportsService.phe(user, range)
    if (q.format === 'xlsx') {
      return xlsxResponse(await buildPheExcel(report), `phe_${q.from}_${q.to}.xlsx`)
    }
    return NextResponse.json(report)
  }
  const report = await reportsService.nangSuat(user, range)
  if (q.format === 'xlsx') {
    return xlsxResponse(
      await buildNangSuatExcel(report.from, report.to, report.rows),
      `nang-suat_${q.from}_${q.to}.xlsx`,
    )
  }
  return NextResponse.json(report)
})
