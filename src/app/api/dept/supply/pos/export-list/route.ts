import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { poMatches } from '@/app/(workspace)/planning/pos/po-filter'
import { decodeView } from '@/app/(mua-hang)/mua-hang/don/views'
import { buildPoListExcel, describeFilter } from '@/modules/dept/supply/po-list-excel'
import { todayVn } from '@/lib/date-vn'

/**
 * XUẤT DANH SÁCH ĐƠN MUA ĐANG LỌC.
 *
 * Nhận ĐÚNG bộ tham số mà URL của màn `/mua-hang/don` mang — `?nhin=`, `?q=`,
 * `?ncc=`, `?lsx=`, `?tu=`, `?den=`… — rồi lọc bằng CHÍNH `decodeView` +
 * `poMatches` mà màn dùng. Không viết luật lọc thứ hai: hai luật thì sớm muộn
 * lệch nhau, và lúc đó file nói một đằng màn nói một nẻo mà không ai biết bên
 * nào đúng.
 *
 * Nhờ vậy nút trên màn chỉ cần chuyển nguyên `location.search` sang đây, và
 * file LUÔN đúng bằng cái người dùng đang nhìn.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const url = new URL(req.url)
  const sp = Object.fromEntries(url.searchParams) as Record<string, string | undefined>

  const view = decodeView(sp)
  const today = todayVn()
  const PAGE_CAP = 1000
  const { rows: pos } = await posService.list(user, { page: 1, page_size: PAGE_CAP })
  const ids = pos.map((p) => p.id)
  const [totals, lineDone] = await Promise.all([
    posRepo.totalsByPoIds(ids),
    supplyRepo.lineDoneByPoIds(ids),
  ])

  const shown = pos
    .map((p) => ({
      ...p,
      total: totals[p.id] ?? 0,
      lines_done: lineDone.get(p.id)?.done ?? 0,
      lines_total: lineDone.get(p.id)?.total ?? 0,
    }))
    .filter((p) => poMatches(p, view.filter, { meId: user.id, today }))

  const buf = await buildPoListExcel({
    filterText: describeFilter(sp, shown.length),
    rows: shown.map((p) => ({
      code: p.code,
      supplier_name: p.supplier_name,
      lsx_code: p.lsx_code,
      order_code: p.order_code,
      status: p.status,
      created_at: p.created_at,
      expected_at: p.expected_at,
      assignee_name: p.assignee_name,
      currency: p.currency,
      total: p.total,
      lines_done: p.lines_done,
      lines_total: p.lines_total,
    })),
  })
  return xlsxResponse(buf, `danh-sach-don-mua_${today}.xlsx`)
})
