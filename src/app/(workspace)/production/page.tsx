import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { assessLateRisk } from '@/lib/late-risk'
import { Badge } from '@/components/Badge'

/**
 * Trang chủ workspace Sản xuất (plan-production-workspace P2): các LSX đang
 * chạy dạng CARD LỚN — cả card là nút bấm, hợp máy xưởng màn nhỏ / ít chuột.
 */
export default async function ProductionHomePage() {
  const user = (await authService.currentUser())!

  const [tracking, stages] = await Promise.all([
    productionRepo.listTracking(),
    productionRepo.listStages(),
  ])
  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : null

  const today = new Date().toISOString().slice(0, 10)
  // Xưởng chỉ cần lệnh đang chạy: đã duyệt (chờ bắt đầu) + đang sản xuất.
  const running = tracking.filter(
    (r) => r.lsx_status === 'approved' || r.lsx_status === 'in_progress',
  )

  // Tiến độ "bộ đồng bộ" per lệnh: Σ bộ hoàn chỉnh qua công đoạn cuối / Σ SL
  // đặt — thước đo xưởng hiểu ngay ("ra được bao nhiêu bộ hàng"). Lệnh đang
  // chạy chỉ vài cái nên tổng hợp tuần tự per lệnh là đủ nhanh (như board).
  const progressByLsx = new Map<string, { sets: number; qty: number }>()
  await Promise.all(
    running.map(async (r) => {
      try {
        const s = await outputsService.summary(user, r.production_order_id!)
        const withComps = s.synced_by_line.filter((l) => l.has_components)
        if (!withComps.length) return
        progressByLsx.set(r.production_order_id!, {
          sets: withComps.reduce((a, l) => a + l.synced_sets, 0),
          qty: withComps.reduce((a, l) => a + l.qty, 0),
        })
      } catch {
        /* thiếu tiến độ không làm hỏng trang chào */
      }
    }),
  )

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">
        Xưởng sản xuất — chào {user.name ?? user.email}
      </h1>
      <p className="mb-5 text-sm text-zinc-500">
        {running.length} lệnh đang chạy. Bấm vào lệnh để cập nhật giai đoạn, xác nhận nhận
        vật tư, báo hoàn thành.
      </p>

      {running.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Không có lệnh sản xuất nào đang chạy. LSX được Giám đốc duyệt sẽ hiện ở đây.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {running.map((r) => {
            const risk = assessLateRisk(r, today)
            const prog = progressByLsx.get(r.production_order_id!)
            const pct =
              prog && prog.qty > 0 ? Math.round((prog.sets / prog.qty) * 100) : null
            return (
              <Link
                key={r.production_order_id}
                href={`/production/lsx/${r.production_order_id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-400 hover:shadow-md active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-red-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-lg font-semibold">{r.lsx_code}</span>
                  {risk && (
                    <Badge tone={risk.level === 'overdue' ? 'red' : 'amber'}>
                      {risk.level === 'overdue' ? '⚠ Trễ hạn' : '⚠ Sát hạn'}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 truncate text-sm font-medium">{r.customer_name}</div>
                <div className="text-xs text-zinc-500">Đơn {r.code}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {r.lsx_status === 'in_progress' ? (
                    <Badge tone="amber">
                      {stageLabel(r.current_stage) ?? 'Đang sản xuất'}
                    </Badge>
                  ) : (
                    <Badge tone="blue">Chờ bắt đầu</Badge>
                  )}
                  <span className="ml-auto text-xs text-zinc-500">
                    Xuất:{' '}
                    <b>
                      {r.ship_date
                        ? new Date(r.ship_date).toLocaleDateString('vi-VN')
                        : '—'}
                    </b>
                  </span>
                </div>

                {/* Bộ đồng bộ = hàng hoàn chỉnh qua công đoạn cuối — liếc là
                    biết lệnh ra được bao nhiêu hàng, không cần mở bảng tổng. */}
                {pct != null && prog && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        Đồng bộ{' '}
                        <b className="text-zinc-700 dark:text-zinc-200">
                          {prog.sets.toLocaleString('vi-VN')}/
                          {prog.qty.toLocaleString('vi-VN')}
                        </b>{' '}
                        bộ
                      </span>
                      <span
                        className={
                          pct >= 100
                            ? 'font-semibold text-green-600 dark:text-green-400'
                            : 'font-semibold text-zinc-600 dark:text-zinc-300'
                        }
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 100
                            ? 'bg-green-500'
                            : risk?.level === 'overdue'
                              ? 'bg-red-500'
                              : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
