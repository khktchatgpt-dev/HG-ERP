'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar, type Stat } from '@/components/erp/StatsBar'
import { type PendingLsx, type PendingPo } from './approval-types'
import { ApprovalCockpit } from './ApprovalCockpit'
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

  const stats: Stat[] = [
    { label: 'LSX chờ duyệt', value: lsxs.length, tone: lsxs.length ? 'amber' : 'green' },
    { label: 'Đơn vật tư chờ', value: pos.length, tone: pos.length ? 'amber' : 'green' },
    {
      label: 'Cam kết đang chờ',
      value: totalCommit
        ? `${Math.round(totalCommit / 1_000_000).toLocaleString('vi-VN')} tr`
        : '0',
      tone: 'blue',
      hint: 'Tổng tiền đơn vật tư',
    },
    {
      label: 'Giá trị lớn',
      value: bigCount,
      tone: bigCount ? 'red' : 'gray',
      hint: '≥ 50tr — duyệt riêng',
    },
    {
      label: 'Chờ lâu nhất',
      value: oldestDays ? `${oldestDays} ngày` : '—',
      tone: oldestDays >= 4 ? 'red' : oldestDays >= 2 ? 'amber' : 'gray',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc' }]}
        title="Phê duyệt tập trung"
        description="Duyệt Lệnh sản xuất (FR-SAL-06) + đơn đặt vật tư trước khi gửi NCC (BR-05). Báo giá bán là hồ sơ riêng của Sales — không duyệt ở đây."
        actions={
          <Link
            href="/exec/approvals/history"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Lịch sử phê duyệt →
          </Link>
        }
      />

      <StatsBar stats={stats} />

      <ApprovalCockpit pos={pos} lsxs={lsxs} nowIso={nowIso} />
    </div>
  )
}
