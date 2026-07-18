'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { LsxOutputPanel } from '@/components/production/LsxOutputPanel'
import { LsxOutsourcePanel } from '@/components/production/LsxOutsourcePanel'

export type RunningLsx = {
  id: string
  code: string
  customer_name: string
  order_code: string
  ship_date: string | null
  /** Trễ hạn / sát hạn — tính sẵn ở server (assessLateRisk). */
  late: 'overdue' | 'at_risk' | null
}

/**
 * Màn LÀM VIỆC THEO CHỨC NĂNG (không theo lệnh): nhiều LSX chạy song song nên
 * chọn lệnh ngay tại đây rồi nhập — khỏi chui vào chi tiết từng lệnh. Panel
 * (sản lượng / gia công) tự nạp lại khi đổi lệnh (self-fetch theo lsxId).
 */
export function EntryWorkbench({
  kind,
  title,
  description,
  lsxList,
  canRecord,
  initialStage,
}: {
  kind: 'output' | 'outsource'
  title: string
  description: string
  lsxList: RunningLsx[]
  canRecord: boolean
  /** Công đoạn mặc định theo tổ người nhập (chỉ dùng cho kind='output'). */
  initialStage?: string | null
}) {
  const [lsxId, setLsxId] = useState(lsxList[0]?.id ?? '')
  const selected = lsxList.find((l) => l.id === lsxId) ?? null

  // Nhớ lệnh đang làm dở (per chức năng) — nhiều lệnh song song, thống kê quay
  // lại màn là đứng đúng lệnh cũ thay vì lệnh đầu danh sách.
  const storageKey = `hg-entry-lsx-${kind}`
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved && lsxList.some((l) => l.id === saved)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLsxId(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function pick(id: string) {
    setLsxId(id)
    localStorage.setItem(storageKey, id)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Sản xuất', href: '/production' }, { label: title }]}
        title={title}
        description={description}
      />

      {lsxList.length === 0 ? (
        <EmptyState
          icon="▣"
          title="Không có lệnh nào đang chạy"
          description="Khi có LSX được duyệt, mở màn này là nhập được ngay."
        />
      ) : (
        <>
          {/* Chọn lệnh — nhiều lệnh song song là bình thường */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Lệnh sản xuất
            </label>
            <select
              value={lsxId}
              onChange={(e) => pick(e.currentTarget.value)}
              className="min-w-64 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              {lsxList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.customer_name}
                  {l.ship_date ? ` (xuất ${l.ship_date})` : ''}
                </option>
              ))}
            </select>
            {selected?.late && (
              <Badge tone={selected.late === 'overdue' ? 'red' : 'amber'}>
                {selected.late === 'overdue' ? '⚠ Trễ hạn' : '⚠ Sát hạn'}
              </Badge>
            )}
            {selected && (
              <Link
                href={`/production/lsx/${selected.id}`}
                className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                Xem chi tiết lệnh →
              </Link>
            )}
          </div>

          {/* key=lsxId: đổi lệnh là panel remount, nạp dữ liệu lệnh mới */}
          {lsxId &&
            (kind === 'output' ? (
              <LsxOutputPanel
                key={lsxId}
                lsxId={lsxId}
                canRecord={canRecord}
                active
                initialStage={initialStage}
              />
            ) : (
              <LsxOutsourcePanel key={lsxId} lsxId={lsxId} canRecord={canRecord} active />
            ))}
        </>
      )}
    </div>
  )
}
