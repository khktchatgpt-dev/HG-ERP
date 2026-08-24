import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { reportsService } from '@/modules/dept/production/reports.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'

/**
 * BÁO CÁO THÁNG dạng MA TRẬN NGÀY (0090) — thay sheet công đoạn/tổ của Excel
 * ("Tổng TĐ SX- TK - KT.xlsx"): 1 cột = 1 ngày trong tháng, hàng = chi tiết ×
 * công đoạn; cuối hàng: Σ tháng, Kg, lũy kế, tổng cần, Thiếu/(Dư), %HT.
 * Đây là bản thống kê nộp kế toán → có nút In (print CSS ẩn shell + bộ lọc).
 * Số liệu từ reportsService.sanLuong (GĐ4) — cùng nguồn với API + file Excel.
 */

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString('vi-VN')

function monthRange(month: string): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return {
    from: `${month}-01`,
    to: `${month}-${String(days).padStart(2, '0')}`,
    days,
  }
}

export default async function MonthReportPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; stage?: string; month?: string }>
}) {
  const user = await authService.requireUser()
  const sp = await searchParams
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '')
    ? sp.month!
    : new Date().toISOString().slice(0, 7)
  const team = sp.team ?? ''
  const stage = sp.stage ?? ''
  const { from, to, days } = monthRange(month)

  const [report, stages, allDepts] = await Promise.all([
    reportsService.sanLuong(user, {
      from,
      to,
      team: team || undefined,
      stage: stage || undefined,
    }),
    productionRepo.listStages(),
    departmentsRepo.list(),
  ])
  const teams = allDepts.filter((d) => d.workspace_id === 'production')
  const sorted = report.rows
  const stageLabel = (code: string) => stages.find((s) => s.code === code)?.label ?? code
  const totQty = report.total_qty
  const totKg = report.total_kg
  const excelHref = `/api/dept/production/reports?type=san-luong&from=${from}&to=${to}&team=${team}&stage=${stage}&format=xlsx`

  return (
    <div className="flex flex-col gap-4">
      {/* Print CSS: ẩn shell (sidebar/header) + bộ lọc, trải bảng full trang. */}
      <style>{`@media print {
        aside, nav, header, .print-hide { display: none !important; }
        main { padding: 0 !important; margin: 0 !important; }
        body { background: white !important; }
      }`}</style>

      <div className="print-hide">
        <PageHeader
          breadcrumbs={[
            { label: 'Thống kê xưởng', href: '/thongke' },
            { label: 'Báo cáo tháng' },
          ]}
          title="Báo cáo sản lượng tháng (ma trận ngày)"
          description="Bảng 1 cột/ngày như sổ giấy: lọc theo tổ / công đoạn / tháng, cuối hàng là Σ tháng, kg, lũy kế và Thiếu/(Dư) so với tổng cần — dùng nộp kế toán."
          actions={
            <span className="flex items-center gap-2">
              <a
                href={excelHref}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                ⬇ Tải Excel
              </a>
              <PrintButton />
            </span>
          }
        />

        <form method="get" className="mt-2 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Tháng
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Tổ
            <select
              name="team"
              defaultValue={team}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Mọi tổ</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Công đoạn
            <select
              name="stage"
              defaultValue={stage}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Mọi công đoạn</option>
              {stages.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"
          >
            Xem
          </button>
        </form>
      </div>

      {/* Tiêu đề bản in */}
      <div className="hidden print:block">
        <h1 className="text-base font-bold">
          BÁO CÁO SẢN LƯỢNG THÁNG {month.slice(5, 7)}/{month.slice(0, 4)}
          {team && ` — ${teams.find((t) => t.id === team)?.name ?? ''}`}
          {stage && ` — ${stageLabel(stage)}`}
        </h1>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon="⎙"
          title="Không có sản lượng nào trong tháng khớp bộ lọc"
          description="Đổi tháng / tổ / công đoạn rồi bấm Xem."
        />
      ) : (
        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full text-[11px] print:text-[9px]">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[9px] text-zinc-500 uppercase dark:border-zinc-800">
                <th className="sticky left-0 bg-white px-2 py-1.5 dark:bg-zinc-950 print:static">
                  Lệnh / chi tiết
                </th>
                <th className="py-1.5 pr-1">CĐ</th>
                {Array.from({ length: days }, (_, i) => (
                  <th key={i} className="min-w-6 py-1.5 text-center tabular-nums">
                    {i + 1}
                  </th>
                ))}
                <th className="py-1.5 pr-1 text-right">Σ tháng</th>
                <th className="py-1.5 pr-1 text-right">Kg</th>
                <th className="py-1.5 pr-1 text-right">Lũy kế</th>
                <th className="py-1.5 pr-1 text-right">Cần</th>
                <th className="py-1.5 pr-1 text-right">Thiếu/(Dư)</th>
                <th className="py-1.5 pr-1 text-right">%HT</th>
                <th className="py-1.5 pr-1">Người làm</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const missing = r2(row.total_needed - row.done_all)
                const pct =
                  row.total_needed > 0 ? Math.min(row.done_all / row.total_needed, 1) : 0
                return (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="sticky left-0 bg-white px-2 py-1 whitespace-nowrap dark:bg-zinc-950 print:static">
                      <span className="font-mono text-zinc-400">{row.lsx}</span>{' '}
                      {row.cluster && (
                        <span className="text-zinc-400">{row.cluster} · </span>
                      )}
                      <span className="font-medium">{row.comp}</span>
                      {row.kind === 'assembly' && (
                        <span className="ml-1 text-[9px] text-indigo-500">CỤM</span>
                      )}
                    </td>
                    <td className="py-1 pr-1 whitespace-nowrap">
                      {stageLabel(row.stage)}
                    </td>
                    {row.by_day.map((q, d) => (
                      <td
                        key={d}
                        className={`py-1 text-center tabular-nums ${q > 0 ? '' : 'text-zinc-300 dark:text-zinc-700'}`}
                      >
                        {q > 0 ? fmt(q) : '·'}
                      </td>
                    ))}
                    <td className="py-1 pr-1 text-right font-semibold tabular-nums">
                      {fmt(row.total)}
                    </td>
                    <td className="py-1 pr-1 text-right tabular-nums">
                      {row.kg > 0 ? fmt(r2(row.kg)) : '—'}
                    </td>
                    <td className="py-1 pr-1 text-right tabular-nums">
                      {fmt(row.done_all)}
                    </td>
                    <td className="py-1 pr-1 text-right tabular-nums">
                      {fmt(row.total_needed)}
                    </td>
                    <td
                      className={`py-1 pr-1 text-right font-medium tabular-nums ${
                        missing > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {missing > 0
                        ? fmt(missing)
                        : missing < 0
                          ? `(${fmt(-missing)})`
                          : '0'}
                    </td>
                    <td className="py-1 pr-1 text-right tabular-nums">
                      {Math.round(pct * 100)}%
                    </td>
                    <td className="max-w-32 truncate py-1 pr-1 text-zinc-500">
                      {[...row.workers].join(', ') || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <td className="sticky left-0 bg-white px-2 py-1.5 dark:bg-zinc-950 print:static">
                  TỔNG ({sorted.length} dòng)
                </td>
                <td colSpan={days + 1} />
                <td className="py-1.5 pr-1 text-right tabular-nums">{fmt(totQty)}</td>
                <td className="py-1.5 pr-1 text-right tabular-nums">{fmt(r2(totKg))}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  )
}
