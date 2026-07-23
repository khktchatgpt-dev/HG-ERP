'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'

/** Bảng tổng thay sheet `quan li` (FR-RP-01) + xuất CSV (FR-RP-05). */

export type BoardRow = {
  lsx_id: string
  lsx_code: string
  customer_name: string
  product_code: string
  cluster: string | null
  name: string
  total_needed: number
  stages: { stage: string; done: number; missing: number; defect: number }[]
  /** Lộ trình giai đoạn của SP (0063); null = chưa định hình. */
  allowed_stages: string[] | null
  pct_total: number
  status: 'not_started' | 'in_progress' | 'done'
}

type Stage = { code: string; label: string }

const ST_LABEL = {
  not_started: 'Chưa làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
} as const
const ST_TONE = { not_started: 'gray', in_progress: 'amber', done: 'green' } as const

export function ProductionBoard({
  rows,
  stages,
  synced,
  lsxCount,
  riskByLsx = {},
}: {
  rows: BoardRow[]
  stages: Stage[]
  synced: { lsx_code: string; product_code: string; qty: number; sets: number }[]
  lsxCount: number
  /** Nguy cơ trễ per-LSX (tính server-side) — badge ở dòng đầu mỗi lệnh. */
  riskByLsx?: Record<string, 'overdue' | 'at_risk'>
}) {
  const [q, setQ] = useState('')
  const [lsxFilter, setLsxFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | BoardRow['status']>('all')

  const lsxOptions = useMemo(
    () => [...new Set(rows.map((r) => r.lsx_code))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (lsxFilter !== 'all' && r.lsx_code !== lsxFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (
        ql &&
        !`${r.lsx_code} ${r.customer_name} ${r.product_code} ${r.cluster ?? ''} ${r.name}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [rows, q, lsxFilter, statusFilter])

  const stats = useMemo(
    () => ({
      done: rows.filter((r) => r.status === 'done').length,
      doing: rows.filter((r) => r.status === 'in_progress').length,
      idle: rows.filter((r) => r.status === 'not_started').length,
    }),
    [rows],
  )

  // Chỉ hiện công đoạn ĐANG DÙNG (có trong lộ trình 1 SP nào đó / có sản lượng)
  // — bỏ cột trống, vì có 11 công đoạn nhưng mỗi loại SP chỉ đi vài cái.
  const usedStages = useMemo(() => {
    const used = new Set<string>()
    for (const r of rows) {
      if (r.allowed_stages) for (const c of r.allowed_stages) used.add(c)
      for (const s of r.stages) if (s.done > 0) used.add(s.stage)
    }
    const cols = stages.filter((s) => used.has(s.code))
    return cols.length > 0 ? cols : stages
  }, [rows, stages])

  /** Xuất CSV — UTF-8 BOM để Excel mở đúng tiếng Việt (FR-RP-05). */
  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = [
      'Lệnh SX',
      'Khách',
      'Mã SP',
      'Cụm',
      'Chi tiết',
      'Tổng cần',
      ...usedStages.flatMap((s) => [`${s.label} - đã làm`, `${s.label} - thiếu/(dư)`]),
      '%HT',
      'Trạng thái',
    ]
    const lines = filtered.map((r) =>
      [
        r.lsx_code,
        r.customer_name,
        r.product_code,
        r.cluster ?? '',
        r.name,
        r.total_needed,
        ...usedStages.flatMap((s): (string | number)[] => {
          const st = r.stages.find((x) => x.stage === s.code)
          // Không qua công đoạn này (final_stage 0041 / lộ trình 0063) → để
          // trống, đừng ghi 0 gây hiểu nhầm. Có sản lượng lịch sử thì vẫn ghi.
          const outsideRoute =
            r.allowed_stages !== null && !r.allowed_stages.includes(s.code)
          if (!st || (outsideRoute && st.done === 0)) return ['', '']
          return [st.done, st.missing]
        }),
        `${Math.round(r.pct_total * 100)}%`,
        ST_LABEL[r.status],
      ]
        .map(esc)
        .join(','),
    )
    const csv = '﻿' + [header.map(esc).join(','), ...lines].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bang-tong-tien-do-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Sản xuất', href: '/production' }, { label: 'Bảng tổng' }]}
        title="Bảng tổng tiến độ sản xuất"
        description="Toàn cảnh mọi chi tiết × công đoạn của các lệnh đang chạy — giám sát tiến độ, nghẽn, %HT toàn xưởng. Chỉ hiện công đoạn đang dùng. Số liệu từ sổ sản lượng các tổ báo hằng ngày."
        actions={
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ⇩ Xuất Excel (CSV)
          </button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Lệnh đang chạy', value: lsxCount, tone: 'default' },
          { label: 'Chi tiết đang làm', value: stats.doing, tone: 'amber' },
          { label: 'Chưa làm', value: stats.idle, tone: stats.idle ? 'red' : 'gray' },
          { label: 'Hoàn thành', value: stats.done, tone: 'green' },
        ]}
      />

      {synced.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {synced.map((s) => (
            <Badge
              key={`${s.lsx_code}-${s.product_code}`}
              tone={s.sets >= s.qty ? 'green' : 'blue'}
            >
              {s.lsx_code} · {s.product_code}: đồng bộ {s.sets}/{s.qty} bộ
            </Badge>
          ))}
        </div>
      )}

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm lệnh, khách, cụm, chi tiết…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={lsxFilter}
                onChange={setLsxFilter}
                options={[
                  { value: 'all', label: 'Mọi lệnh' },
                  ...lsxOptions.map((c) => ({ value: c, label: c })),
                ]}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  { value: 'not_started' as const, label: 'Chưa làm' },
                  { value: 'in_progress' as const, label: 'Đang làm' },
                  { value: 'done' as const, label: 'Hoàn thành' },
                ]}
              />
            </>
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="▦"
            title={rows.length === 0 ? 'Chưa có dữ liệu' : 'Không khớp bộ lọc'}
            description="Kế hoạch nhập bảng chi tiết cho LSX đã duyệt, tổ báo sản lượng — bảng tổng sẽ tự cập nhật."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                  <th className="px-3 py-2">Lệnh / Khách</th>
                  <th className="px-2 py-2">Cụm · Chi tiết</th>
                  <th className="w-16 px-2 py-2 text-right">Tổng cần</th>
                  {usedStages.map((s) => (
                    <th key={s.code} className="w-24 px-2 py-2 text-right">
                      {s.label}
                    </th>
                  ))}
                  <th className="w-16 px-2 py-2 text-right">%HT</th>
                  <th className="w-24 px-2 py-2 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={`${r.lsx_id}-${i}`}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/production/lsx/${r.lsx_id}`}
                        className="flex min-w-0 flex-col hover:text-sky-600 dark:hover:text-sky-400"
                      >
                        <span className="flex items-center gap-1.5 font-mono">
                          {r.lsx_code}
                          {(() => {
                            const firstOfLsx =
                              i === 0 || filtered[i - 1].lsx_id !== r.lsx_id
                            const risk = firstOfLsx ? riskByLsx[r.lsx_id] : undefined
                            return risk ? (
                              <Badge tone={risk === 'overdue' ? 'red' : 'amber'}>
                                {risk === 'overdue' ? '⚠ Trễ' : '⚠ Sát hạn'}
                              </Badge>
                            ) : null
                          })()}
                        </span>
                        <span className="truncate text-zinc-400">{r.customer_name}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-[10px] text-zinc-400">
                          <span className="font-mono">{r.product_code}</span>
                          {r.cluster ? ` · ${r.cluster}` : ''}
                        </span>
                        <span className="font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium">
                      {r.total_needed.toLocaleString('vi-VN')}
                    </td>
                    {usedStages.map((s) => {
                      const st = r.stages.find((x) => x.stage === s.code)
                      // Ngoài lộ trình đã định hình (0063) → mờ như "không qua
                      // công đoạn"; có sản lượng lịch sử thì vẫn hiện số.
                      const outsideRoute =
                        r.allowed_stages !== null && !r.allowed_stages.includes(s.code)
                      if (!st || (outsideRoute && st.done === 0))
                        return (
                          <td
                            key={s.code}
                            className="px-2 py-1.5 text-right text-zinc-300 dark:text-zinc-600"
                            title="Chi tiết không qua công đoạn này"
                          >
                            —
                          </td>
                        )
                      const done = st.done
                      const missing = st.missing
                      return (
                        <td key={s.code} className="px-2 py-1.5 text-right">
                          <span
                            className={
                              done === 0
                                ? 'text-zinc-300 dark:text-zinc-600'
                                : missing <= 0
                                  ? 'font-medium text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                            title={`Thiếu/(Dư): ${missing}${st.defect ? ` · Phế: ${st.defect}` : ''}`}
                          >
                            {done.toLocaleString('vi-VN')}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              r.pct_total >= 1
                                ? 'bg-emerald-500'
                                : r.pct_total > 0
                                  ? 'bg-amber-500'
                                  : 'bg-zinc-300 dark:bg-zinc-700',
                            )}
                            style={{ width: `${Math.round(r.pct_total * 100)}%` }}
                          />
                        </div>
                        <span className="w-9 text-right font-medium tabular-nums">
                          {Math.round(r.pct_total * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Badge tone={ST_TONE[r.status]}>{ST_LABEL[r.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
