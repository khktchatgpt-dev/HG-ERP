import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { entriesService } from '@/modules/dept/production/entries.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'

export const dynamic = 'force-dynamic'

/**
 * SỔ TỔNG toàn xưởng (0090) — thay sheet `quan li` của Excel: mỗi LSX một
 * bảng, hàng = chi tiết/cụm, cột = công đoạn theo LỘ TRÌNH THẬT của dòng SP
 * (không chia đều 4 công đoạn như Excel); ô = đã làm / cần; kèm đồng bộ bộ SP
 * và trạng thái 5 mức quen mắt (⚪🟠🟡🟢✅).
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const r2 = (n: number) => Math.round(n * 100) / 100

/** Trạng thái emoji 5 mức như cột "Trạng thái" của Excel — theo %HT tổng. */
function statusEmoji(pct: number): string {
  if (pct >= 1) return '✅ Xong'
  if (pct >= 0.75) return '🟢 Sắp xong'
  if (pct >= 0.5) return '🟡 Đang làm'
  if (pct > 0) return '🟠 Mới bắt đầu'
  return '⚪ Chưa làm'
}

export default async function SoTongPage() {
  const user = (await authService.currentUser())!
  const [active, stages] = await Promise.all([
    productionRepo.listActive(),
    productionRepo.listStages(),
  ])
  // Toàn xưởng nhưng có trần an toàn — quá 20 lệnh chạy song song là bất thường.
  const shown = active.slice(0, 20)
  const summaries = await Promise.all(
    shown.map((l) => entriesService.summary(user, l.id)),
  )
  const stageLabel = (code: string) => stages.find((s) => s.code === code)?.label ?? code

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Sổ tổng' },
        ]}
        title="Sổ tổng sản lượng toàn xưởng"
        description="Mỗi lệnh một bảng: hàng = chi tiết/cụm, cột = công đoạn theo lộ trình thật; ô = đã làm/cần (phế trong ngoặc). Đồng bộ = số bộ SP đủ mọi chi tiết qua công đoạn cuối."
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="▦"
          title="Không có lệnh nào đang chạy"
          description="Có LSX được duyệt là sổ tổng hiện tại đây."
        />
      ) : (
        shown.map((lsx, i) => {
          const s = summaries[i]
          // Cột = công đoạn xuất hiện trong khoảng hiệu lực của BẤT KỲ dòng nào,
          // theo thứ tự danh mục.
          const usedStages = stages
            .map((st) => st.code)
            .filter((code) =>
              s.components.some((c) => c.summary.stages.some((x) => x.stage === code)),
            )
          // Σ kg đã làm per chi tiết (mọi công đoạn) — cột KL của sheet quan li.
          const kgByComp = new Map<string, number>()
          for (const en of s.entries) {
            if (en.kg == null) continue
            kgByComp.set(
              en.component_id,
              (kgByComp.get(en.component_id) ?? 0) + Number(en.kg),
            )
          }
          return (
            <section
              key={lsx.id}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <Link
                  href={`/thongke/lsx/${lsx.id}`}
                  className="font-mono text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                >
                  {lsx.code}
                </Link>
                <span className="text-xs text-zinc-500">{lsx.customer_name}</span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {s.synced_by_line.map((l) => (
                    <Badge
                      key={l.order_line_id}
                      tone={l.synced_sets >= l.qty ? 'green' : 'blue'}
                    >
                      {l.product_code}: đồng bộ {fmt(l.synced_sets)}/{fmt(l.qty)} bộ
                    </Badge>
                  ))}
                </span>
              </div>
              {s.components.length === 0 ? (
                <p className="px-4 py-4 text-xs text-zinc-400">
                  Chưa định hình bảng chi tiết.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                        <th className="px-3 py-1.5">Chi tiết / cụm</th>
                        <th className="w-16 py-1.5 pr-2 text-right">Cần</th>
                        {usedStages.map((code) => (
                          <th key={code} className="w-24 py-1.5 pr-2 text-right">
                            {stageLabel(code)}
                          </th>
                        ))}
                        <th className="w-20 py-1.5 pr-2 text-right">Kg đã làm</th>
                        <th className="w-28 py-1.5 pr-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.components.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-zinc-100 dark:border-zinc-900"
                        >
                          <td className="px-3 py-1.5">
                            {c.kind === 'assembly' && (
                              <span className="mr-1 rounded bg-indigo-100 px-1 py-0.5 text-[9px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                CỤM
                              </span>
                            )}
                            {c.cluster && (
                              <span className="text-[10px] text-zinc-400">
                                {c.cluster} ·{' '}
                              </span>
                            )}
                            <span className="font-medium">{c.name}</span>
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {fmt(c.total_needed)}
                          </td>
                          {usedStages.map((code) => {
                            const st = c.summary.stages.find((x) => x.stage === code)
                            if (!st) {
                              return (
                                <td
                                  key={code}
                                  className="py-1.5 pr-2 text-right text-zinc-300 dark:text-zinc-700"
                                >
                                  —
                                </td>
                              )
                            }
                            const full = c.total_needed > 0 && st.done >= c.total_needed
                            return (
                              <td
                                key={code}
                                className={`py-1.5 pr-2 text-right tabular-nums ${
                                  full
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : st.done > 0
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-zinc-400'
                                }`}
                                title={`Thiếu/(Dư): ${fmt(st.missing)}`}
                              >
                                {fmt(st.done)}
                                {st.defect > 0 && (
                                  <span className="text-red-500">
                                    {' '}
                                    ({fmt(st.defect)})
                                  </span>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-1.5 pr-2 text-right tabular-nums">
                            {kgByComp.has(c.id) ? fmt(r2(kgByComp.get(c.id)!)) : '—'}
                          </td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            {statusEmoji(c.summary.pct_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })
      )}
      {active.length > shown.length && (
        <p className="text-xs text-zinc-400">
          Đang hiện {shown.length}/{active.length} lệnh chạy — các lệnh còn lại xem ở hồ
          sơ từng lệnh.
        </p>
      )}
    </div>
  )
}
