import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
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
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
