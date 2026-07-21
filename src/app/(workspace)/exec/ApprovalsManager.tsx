'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { Button } from '@/components/shadcn/button'
import { type PendingLsx, type PendingPo } from './approval-types'
import { ApprovalCockpit } from './ApprovalCockpit'
import { KpiCard } from './orders/order-parts'
import { isBigApproval } from '@/lib/exec-ops'
import { waitingDays } from './approval-helpers'

/**
 * Trung tâm phê duyệt — dạng THẺ mobile-first (07/2026): CEO/COO duyệt one-tap
 * hoặc "duyệt nhanh" nhiều phiếu từ điện thoại; PO ≥ ngưỡng chặn khỏi duyệt
 * nhanh (mở chi tiết duyệt riêng). StatsBar tóm tắt tải + cam kết + phiếu chờ
 * lâu nhất. Buồng lái master-detail + logic duyệt nằm trong ApprovalCockpit.
 */
export function ApprovalsManager({
  pos,
  lsxs,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
}) {
  // Freeze mốc aging 1 lần cho toàn màn (nhất quán giữa StatsBar và các thẻ).
  const [nowIso] = useState(() => new Date().toISOString())

  const totalCommit = pos.reduce((s, p) => s + p.total, 0)
  const bigCount = pos.filter((p) => isBigApproval(p.total)).length
  const oldestDays = Math.max(
    0,
    ...lsxs.map((l) => waitingDays(l.created_at, nowIso)),
    ...pos.map((p) => waitingDays(p.created_at, nowIso)),
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc' }]}
        title="Phê duyệt tập trung"
        description="Duyệt Lệnh sản xuất (FR-SAL-06) + đơn đặt vật tư trước khi gửi NCC (BR-05). Báo giá bán là hồ sơ riêng của Sales — không duyệt ở đây."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/exec/approvals/history">Lịch sử phê duyệt →</Link>
          </Button>
        }
      />

      {/* KPI — đồng bộ với /exec/orders và /exec/production */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="LSX chờ duyệt"
          value={lsxs.length}
          tone={lsxs.length ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Đơn vật tư chờ"
          value={pos.length}
          tone={pos.length ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Cam kết đang chờ"
          value={
            totalCommit
              ? `${Math.round(totalCommit / 1_000_000).toLocaleString('vi-VN')} tr`
              : '0'
          }
          hint="Tổng tiền đơn vật tư"
        />
        <KpiCard
          label="Giá trị lớn"
          value={bigCount}
          hint="≥ 50tr — duyệt riêng"
          tone={bigCount ? 'red' : 'default'}
        />
        <KpiCard
          label="Chờ lâu nhất"
          value={oldestDays ? `${oldestDays} ngày` : '—'}
          tone={oldestDays >= 4 ? 'red' : oldestDays >= 2 ? 'amber' : 'default'}
        />
      </div>

      <ApprovalCockpit pos={pos} lsxs={lsxs} nowIso={nowIso} />
    </div>
  )
}
