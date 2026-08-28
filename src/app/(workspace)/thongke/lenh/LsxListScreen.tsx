'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput } from '@/components/erp/Toolbar'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import type { LsxCard } from '@/modules/dept/production/worklist.service'

/**
 * Tầng 1 — DANH SÁCH LỆNH. Mỗi lệnh một thẻ, không đổ hết việc ra đây.
 * Tiến độ nói bằng "x/y việc xong" thay vì một % có trọng số: thống kê cần
 * biết CÒN BAO NHIÊU VIỆC PHẢI GHI, không cần con số tổng hợp mơ hồ.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN')

/** Còn bao nhiêu ngày tới hạn xuất (âm = trễ) — tính theo ngày lịch. */
function daysLeft(ship: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${ship}T00:00:00`).getTime() - today.getTime()) / 86400000)
}

/** Chip hạn xuất: quá hạn đỏ, ≤7 ngày cam, còn xa thì chữ thường. */
function ShipChip({ ship }: { ship: string }) {
  const d = daysLeft(ship)
  const label =
    d < 0 ? `trễ ${fmt(-d)} ngày` : d === 0 ? 'xuất HÔM NAY' : `còn ${fmt(d)} ngày`
  const cls =
    d < 0
      ? 'text-[var(--stop)] font-semibold'
      : d <= 7
        ? 'text-[var(--warn)] font-semibold'
        : 'text-muted-foreground'
  return (
    <span className="text-xs">
      xuất <span className="t-data">{fmtDate(ship)}</span>{' '}
      <span className={cls}>· {label}</span>
    </span>
  )
}

export function LsxListScreen({
  cards,
  unroutedCount,
  canRecord,
}: {
  cards: LsxCard[]
  unroutedCount: number
  canRecord: boolean
}) {
  const [q, setQ] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(true)

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return cards.filter((c) => {
      if (onlyOpen && c.open_count === 0) return false
      if (
        kw &&
        !`${c.lsx_code} ${c.customer_name} ${c.order_codes.join(' ')}`
          .toLowerCase()
          .includes(kw)
      ) {
        return false
      }
      return true
    })
  }, [cards, q, onlyOpen])

  const totOpen = shown.reduce((a, c) => a + c.open_count, 0)
  const totPending = shown.reduce((a, c) => a + c.pending_sets, 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Thống kê xưởng' }]}
        title="Tiến độ theo lệnh"
        description="Xem lệnh đang tới đâu — bấm vào lệnh để mở chi tiết theo công đoạn."
      />

      <StatsBar
        stats={[
          { label: 'Lệnh có việc', value: shown.length, tone: 'blue' },
          { label: 'Việc đang mở', value: fmt(totOpen), tone: 'gray' },
          {
            label: 'Chờ duyệt (bộ)',
            value: fmt(totPending),
            tone: totPending > 0 ? 'amber' : 'gray',
          },
        ]}
      />

      {unroutedCount > 0 && (
        <section className="flex items-start gap-2 rounded-lg border border-[var(--warn)]/50 bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-xs">
          <TriangleAlert
            size={16}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0 text-[var(--warn)]"
            aria-hidden
          />
          <span>
            <b>{fmt(unroutedCount)} chi tiết chưa biết đi công đoạn nào</b> — chưa được
            phân nhóm vật tư ở hồ sơ sản phẩm nên không sinh việc ghi nhận.
          </span>
        </section>
      )}

      <Toolbar
        left={
          <>
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm lệnh, khách hàng, mã đơn…"
              className="min-w-64"
            />
            <button
              onClick={() => setOnlyOpen((v) => !v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                onlyOpen
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-input text-foreground border hover:bg-[var(--accent)]'
              }`}
            >
              Chỉ lệnh còn việc
            </button>
          </>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="☷"
          title="Không có lệnh nào khớp"
          description={
            cards.length === 0
              ? 'Chưa có lệnh đang chạy nào có chi tiết đã phân nhóm để sinh việc ghi nhận.'
              : 'Bỏ bớt bộ lọc, hoặc tắt "Chỉ lệnh còn việc".'
          }
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => {
            const inner = (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <DocChip>{c.lsx_code}</DocChip>
                  {c.pending_sets > 0 && (
                    <Badge tone="amber">chờ duyệt {fmt(c.pending_sets)}</Badge>
                  )}
                  {c.open_count === 0 && <Badge tone="green">hết việc</Badge>}
                </div>
                <p className="mt-1 truncate text-sm font-medium">{c.customer_name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.order_codes.length > 0 && (
                    <span className="t-data">{c.order_codes.join(' · ')}</span>
                  )}
                </p>
                {c.ship_date && (
                  <p className="mt-0.5">
                    <ShipChip ship={c.ship_date} />
                  </p>
                )}

                {/* Bao quát theo BỘ: xong cả chuỗi công đoạn mới tính là xong. */}
                <div className="mt-2">
                  <p className="flex items-baseline justify-between text-xs">
                    <span>
                      <b className="t-data">{fmt(c.done_sets)}</b>
                      <span className="text-muted-foreground">
                        {' '}
                        / {fmt(c.total_sets)} bộ xong
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      <b className="t-data text-[var(--warn)]">{fmt(c.open_count)}</b>/
                      {fmt(c.job_count)} việc · {fmt(c.product_count)} SP
                    </span>
                  </p>
                  <span className="bg-muted mt-1 block h-1.5 w-full overflow-hidden rounded">
                    <span
                      className={`block h-1.5 rounded ${
                        c.total_sets > 0 && c.done_sets >= c.total_sets
                          ? 'bg-[var(--done)]'
                          : 'bg-[var(--primary)]'
                      }`}
                      style={{
                        width: `${c.total_sets > 0 ? Math.min(100, Math.round((c.done_sets / c.total_sets) * 100)) : 0}%`,
                      }}
                    />
                  </span>
                </div>

                {/* Dải công đoạn có việc — nhìn là biết lệnh đang chạy tới đâu. */}
                <span className="mt-2 flex flex-wrap gap-1">
                  {c.stage_labels.map((s) => (
                    <span
                      key={s}
                      className="border-input rounded border px-1.5 py-0.5 text-[10px]"
                    >
                      {s}
                    </span>
                  ))}
                </span>
              </>
            )
            const cls =
              'bg-card focus-visible:ring-ring/50 block rounded-lg border p-3 outline-none focus-visible:ring-[3px]'
            return canRecord ? (
              <Link
                key={c.lsx_id}
                href={`/thongke/lsx/${c.lsx_id}`}
                className={`${cls} group hover:bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">{inner}</span>
                  <ChevronRight
                    size={20}
                    strokeWidth={1.8}
                    className="text-muted-foreground mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ) : (
              <div key={c.lsx_id} className={cls}>
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
