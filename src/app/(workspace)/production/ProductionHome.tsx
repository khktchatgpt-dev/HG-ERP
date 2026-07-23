'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'

export type ProdCard = {
  id: string
  code: string
  customer_name: string | null
  order_code: string
  status: 'approved' | 'in_progress'
  stage_label: string | null
  ship_date: string | null
  /** 'overdue' = quá hạn, 'soon'/khác = sát hạn, null = an toàn. */
  risk_level: string | null
  pct: number | null
  sets: number | null
  qty: number | null
}

type Filter = 'all' | 'late' | 'in_progress' | 'approved'

const RISK_ORDER = (r: string | null) => (r === 'overdue' ? 0 : r ? 1 : 2)

export function ProductionHome({
  greeting,
  cards,
}: {
  greeting: string
  cards: ProdCard[]
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const inProgress = cards.filter((c) => c.status === 'in_progress').length
  const approved = cards.filter((c) => c.status === 'approved').length
  const atRisk = cards.filter((c) => c.risk_level).length

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (
      cards
        .filter((c) => {
          if (filter === 'late' && !c.risk_level) return false
          if (filter === 'in_progress' && c.status !== 'in_progress') return false
          if (filter === 'approved' && c.status !== 'approved') return false
          if (
            ql &&
            !`${c.code} ${c.customer_name ?? ''} ${c.order_code}`
              .toLowerCase()
              .includes(ql)
          )
            return false
          return true
        })
        // Trễ hạn lên đầu, rồi theo ngày xuất gần nhất.
        .sort((a, b) => {
          const r = RISK_ORDER(a.risk_level) - RISK_ORDER(b.risk_level)
          if (r !== 0) return r
          return (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999')
        })
    )
  }, [cards, q, filter])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Sản xuất' }]}
        title="Xưởng sản xuất"
        description={`${greeting} — bấm vào lệnh để cập nhật giai đoạn, xác nhận nhận vật tư, báo hoàn thành. Lệnh trễ hạn xếp lên đầu.`}
      />

      <StatsBar
        stats={[
          { label: 'Đang sản xuất', value: inProgress, tone: 'amber' },
          { label: 'Chờ bắt đầu', value: approved, tone: 'blue' },
          { label: 'Nguy cơ trễ', value: atRisk, tone: atRisk > 0 ? 'red' : 'gray' },
          { label: 'Tổng đang chạy', value: cards.length, tone: 'default' },
        ]}
      />

      <Toolbar
        left={
          <>
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã LSX, khách, đơn…"
              icon="⌕"
              className="w-64"
            />
            <ToolbarSelect
              value={filter}
              onChange={(v) => setFilter(v)}
              options={[
                { value: 'all' as const, label: 'Tất cả đang chạy' },
                { value: 'late' as const, label: 'Sắp / trễ hạn' },
                { value: 'in_progress' as const, label: 'Đang sản xuất' },
                { value: 'approved' as const, label: 'Chờ bắt đầu' },
              ]}
            />
          </>
        }
        right={<span className="text-xs text-zinc-500">{shown.length} lệnh</span>}
      />

      {shown.length === 0 ? (
        <EmptyState
          icon="◫"
          title={cards.length === 0 ? 'Không có lệnh đang chạy' : 'Không khớp bộ lọc'}
          description={
            cards.length === 0
              ? 'LSX được Giám đốc duyệt sẽ hiện ở đây.'
              : 'Thử đổi từ khoá hoặc bộ lọc.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <Link
              key={c.id}
              href={`/production/lsx/${c.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-red-400 hover:shadow-md active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-red-600"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-lg font-semibold">{c.code}</span>
                {c.risk_level && (
                  <Badge tone={c.risk_level === 'overdue' ? 'red' : 'amber'}>
                    {c.risk_level === 'overdue' ? '⚠ Trễ hạn' : '⚠ Sát hạn'}
                  </Badge>
                )}
              </div>
              <div className="mt-1 truncate text-sm font-medium">
                {c.customer_name ?? '—'}
              </div>
              <div className="text-xs text-zinc-500">Đơn {c.order_code}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {c.status === 'in_progress' ? (
                  <Badge tone="amber">{c.stage_label ?? 'Đang sản xuất'}</Badge>
                ) : (
                  <Badge tone="blue">Chờ bắt đầu</Badge>
                )}
                <span className="ml-auto text-xs text-zinc-500">
                  Xuất:{' '}
                  <b>
                    {c.ship_date
                      ? new Date(c.ship_date).toLocaleDateString('vi-VN')
                      : '—'}
                  </b>
                </span>
              </div>

              {c.pct != null && c.sets != null && c.qty != null && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      Đồng bộ{' '}
                      <b className="text-zinc-700 dark:text-zinc-200">
                        {c.sets.toLocaleString('vi-VN')}/{c.qty.toLocaleString('vi-VN')}
                      </b>{' '}
                      bộ
                    </span>
                    <span
                      className={
                        c.pct >= 100
                          ? 'font-semibold text-green-600 dark:text-green-400'
                          : 'font-semibold text-zinc-600 dark:text-zinc-300'
                      }
                    >
                      {c.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        c.pct >= 100
                          ? 'bg-green-500'
                          : c.risk_level === 'overdue'
                            ? 'bg-red-500'
                            : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, c.pct)}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
