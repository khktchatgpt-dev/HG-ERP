'use client'

import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { ApprovalCardList, type PendingLsx, type PendingPo } from './ApprovalCardList'

/**
 * Trung tâm phê duyệt — dạng THẺ mobile-first (07/2026): CEO/COO duyệt one-tap
 * từ điện thoại; PO ≥ ngưỡng hiện badge "Giá trị lớn". Logic duyệt + modal
 * PoDetail nằm trong ApprovalCardList (Báo cáo CEO nhúng lại bản compact).
 */
export function ApprovalsManager({
  pos,
  lsxs,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Ban Giám đốc' }]}
        title="Phê duyệt tập trung"
        description="Duyệt Lệnh sản xuất (FR-SAL-06) + đơn đặt vật tư trước khi gửi NCC (BR-05). Báo giá bán là hồ sơ riêng của Sales — không duyệt ở đây."
      />

      <StatsBar
        stats={[
          {
            label: 'LSX chờ duyệt',
            value: lsxs.length,
            tone: lsxs.length ? 'amber' : 'green',
          },
          {
            label: 'Đơn đặt vật tư chờ duyệt',
            value: pos.length,
            tone: pos.length ? 'amber' : 'green',
          },
        ]}
      />

      <ApprovalCardList pos={pos} lsxs={lsxs} />
    </div>
  )
}
