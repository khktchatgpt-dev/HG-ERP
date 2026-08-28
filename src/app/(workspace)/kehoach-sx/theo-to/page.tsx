import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'

export const dynamic = 'force-dynamic'

/**
 * TIẾN ĐỘ THEO TỔ (plan-hoan-thien-ke-hoach-sx #5): Kế hoạch nhìn một bảng
 * biết tổ nào chậm — KH / đã làm / còn / % / dự kiến xong so hạn. Số đã làm
 * do THỐNG KÊ nhập; Kế hoạch chỉ xem.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export default async function TeamProgressPage() {
  const user = await authService.requirePageUser()
  const { rows } = await jobsService.teamProgress(user)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
          { label: 'Theo tổ' },
        ]}
        title="Tiến độ theo tổ"
        description="Trên các lệnh đang chạy: kế hoạch = Σ cần các công đoạn tổ giữ; đã làm đọc từ sổ thống kê; dự kiến xong = còn lại ÷ nhịp 7 ngày có sổ. Tổ chậm nhất xếp trước."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="▤"
          title="Chưa có tổ nào được giao việc"
          description="Lên lộ trình + giao tổ ở màn Kế hoạch là bảng này có số."
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
                <th className="px-3 py-2">Tổ</th>
                <th className="px-2 py-2 text-right">Việc (chưa/đang/xong)</th>
                <th className="px-2 py-2 text-right">Kế hoạch</th>
                <th className="px-2 py-2 text-right">Đã làm</th>
                <th className="px-2 py-2 text-right">Còn lại</th>
                <th className="px-2 py-2 text-right">Tiến độ</th>
                <th className="px-2 py-2 text-right">Hạn muộn nhất</th>
                <th className="px-2 py-2 text-right">Dự kiến xong</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.department_id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {r.department_name}
                  </td>
                  <td className="t-data px-2 py-2 text-right whitespace-nowrap tabular-nums">
                    {r.todo} / {r.doing} / {r.done}
                  </td>
                  <td className="t-data px-2 py-2 text-right tabular-nums">
                    {fmt(r.needed)}
                  </td>
                  <td className="t-data px-2 py-2 text-right tabular-nums">
                    {fmt(r.done_qty)}
                  </td>
                  <td className="t-data px-2 py-2 text-right tabular-nums">
                    {fmt(r.remaining)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span
                      className={`t-data font-semibold tabular-nums ${
                        r.pct >= 0.9
                          ? 'text-[var(--done)]'
                          : r.pct < 0.5
                            ? 'text-[var(--warn)]'
                            : ''
                      }`}
                    >
                      {Math.round(r.pct * 100)}%
                    </span>
                  </td>
                  <td className="t-data px-2 py-2 text-right tabular-nums">
                    {fmtD(r.latest_planned_end)}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <span className="t-data tabular-nums">{fmtD(r.forecast_date)}</span>
                    {r.late_forecast && (
                      <span
                        className="ml-1.5"
                        title="Theo nhịp hiện tại, tổ sẽ xong MUỘN hơn hạn kế hoạch — trao đổi với tổ trưởng hoặc điều chỉnh kế hoạch (có ghi lý do)."
                      >
                        <Badge tone="red">Trễ dự kiến</Badge>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Tổ chưa ghi sổ ngày nào thì chưa có nhịp → cột dự kiến để trống (không đoán).
      </p>
    </div>
  )
}
