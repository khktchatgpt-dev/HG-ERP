'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { LsxOutsourcePanel } from '@/components/production/LsxOutsourcePanel'

/** Chọn lệnh → sổ gia công của lệnh đó (panel tự nạp theo lsxId). */
export function OutsourceWorkbench({
  lsxList,
  canRecord,
}: {
  lsxList: { id: string; code: string; customer_name: string }[]
  canRecord: boolean
}) {
  const [lsxId, setLsxId] = useState(lsxList[0]?.id ?? '')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Gia công ngoài' },
        ]}
        title="Gia công ngoài"
        description="Ghi GIAO đi / NHẬN về per chi tiết × nhà gia công — đối chiếu thiếu/dư tự tính."
        actions={
          lsxList.length > 0 ? (
            <select
              value={lsxId}
              onChange={(e) => setLsxId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {lsxList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.customer_name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />
      {lsxList.length === 0 ? (
        <EmptyState
          icon="⇄"
          title="Không có lệnh đang chạy"
          description="Có LSX được duyệt là ghi gia công được ngay tại đây."
        />
      ) : (
        <LsxOutsourcePanel key={lsxId} lsxId={lsxId} canRecord={canRecord} />
      )}
    </div>
  )
}
