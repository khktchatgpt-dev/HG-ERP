import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { financeReportService } from '@/modules/dept/accounting/finance-report.service'
import { lsxFinanceService } from '@/modules/dept/accounting/lsx-finance.service'
import { apAgingService } from '@/modules/dept/accounting/ap-aging.service'
import {
  buildFinanceExcel,
  financeExcelFilename,
} from '@/modules/dept/accounting/finance-excel'

/**
 * Tải BÁO CÁO TÀI CHÍNH MUA HÀNG dạng .xlsx — bốn sheet: phễu dòng tiền, tiền
 * theo lệnh SX, ước tính phải trả theo NCC, tuổi nợ.
 *
 * `?tatca=1` lấy cả lệnh đã đóng; mặc định chỉ lệnh đang chạy — cùng luật với
 * màn `/finance/theo-lenh` để file và màn không nói hai số khác nhau.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  await assertAction(user, 'accounting.payable.view')

  const activeOnly = !new URL(req.url).searchParams.get('tatca')
  const [report, aging] = await Promise.all([
    financeReportService.overview(user),
    apAgingService.overview(user),
  ])

  /*
   * Tiền theo lệnh phải lấy TỪNG TIỀN TỆ một: service trả về đúng một tiền tệ
   * mỗi lượt (có chủ ý — xem `totalOf`). Gọi lần đầu để biết có những tiền tệ
   * nào, rồi gọi tiếp cho các loại còn lại.
   */
  const first = await lsxFinanceService.overview(user, { activeOnly })
  const lsx = [{ rows: first.rows, currency: first.currency }]
  for (const c of first.currencies) {
    if (c.code === first.currency) continue
    const more = await lsxFinanceService.overview(user, { activeOnly, currency: c.code })
    lsx.push({ rows: more.rows, currency: more.currency })
  }

  const today = new Date().toISOString().slice(0, 10)
  const buf = await buildFinanceExcel({ report, lsx, aging, today })
  const filename = financeExcelFilename(today)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
