'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'
import { poStatusLabel, poStatusTone } from '@/lib/po-status'
import type { ExecPurchasing, ExecPoRow } from '@/modules/core/exec/exec.service'

/**
 * MUA HÀNG & NCC (/exec/purchasing) — vế MUA của Giám đốc. Chỉ đọc: xem tiền đang
 * cam kết với nhà cung cấp, đơn nào quá hẹn, đơn nào duyệt rồi mà nằm im. Mọi
 * thao tác vẫn ở màn của phòng Cung ứng (/planning/pos).
 */

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

type Filter = 'all' | 'late' | 'stuck' | 'pending_approval'

export function PurchasingOverview({ data }: { data: ExecPurchasing }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return data.rows.filter((r) => {
      if (filter === 'late' && r.days_late <= 0) return false
      if (filter === 'stuck' && r.days_idle <= 0) return false
      if (filter === 'pending_approval' && r.status !== 'pending_approval') return false
      if (
        ql &&
        !`${r.code} ${r.supplier_name} ${r.lsx_code ?? ''} ${r.assignee_name ?? ''}`
          .toLowerCase()
          .includes(ql)
      )
        return false
      return true
    })
  }, [data.rows, q, filter])

  const money = (rows: { currency: string; value: number }[]) =>
    rows.length === 0 ? '—' : rows.map((r) => `${fmt(r.value)} ${r.currency}`).join(' · ')

  const columns: Column<ExecPoRow>[] = [
    {
      key: 'code',
      header: 'Số đơn / NCC',
      width: '240px',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="text-muted-foreground font-mono text-xs">{r.code}</span>
          <span className="truncate font-medium">{r.supplier_name}</span>
        </div>
      ),
    },
    {
      key: 'lsx',
      header: 'Lệnh',
      width: '130px',
      sortValue: (r) => r.lsx_code ?? '',
      cell: (r) =>
        r.lsx_code ? (
          <span className="font-mono text-xs">{r.lsx_code}</span>
        ) : (
          <span className="text-muted-foreground text-xs">Ngoài lệnh</span>
        ),
    },
    {
      key: 'total',
      header: 'Giá trị',
      align: 'right',
      width: '150px',
      sortValue: (r) => r.total,
      cell: (r) => (
        <span className="font-medium tabular-nums">
          {fmt(r.total)}{' '}
          <span className="text-muted-foreground text-xs">{r.currency}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      sortValue: (r) => r.status,
      cell: (r) => <Badge tone={poStatusTone(r.status)}>{poStatusLabel(r.status)}</Badge>,
    },
    {
      key: 'expected',
      header: 'Hẹn giao',
      width: '150px',
      sortValue: (r) => r.expected_at ?? '9999',
      cell: (r) => (
        <div className="flex flex-col">
          <span>{fmtDate(r.expected_at)}</span>
          {r.days_late > 0 && (
            <span className="text-[11px] font-medium text-[var(--stop)]">
              ⚠ quá hẹn {r.days_late} ngày
            </span>
          )}
          {r.days_idle > 0 && (
            <span className="text-[11px] font-medium text-[var(--warn)]">
              duyệt {r.days_idle} ngày, chưa gửi NCC
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Phụ trách',
      width: '150px',
      sortValue: (r) => r.assignee_name ?? '',
      cell: (r) => (
        <span className="truncate">
          {r.assignee_name ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Ban Giám đốc', href: '/exec' },
          { label: 'Mua hàng & NCC' },
        ]}
        title="Mua hàng & nhà cung cấp"
        description="Tiền đang cam kết với nhà cung cấp, đơn quá hẹn giao và đơn đã duyệt còn nằm im. Chỉ xem — thao tác ở màn của phòng Cung ứng."
        actions={
          <Link
            href="/planning/pos"
            className="border-border hover:bg-muted dark:border-border dark:bg-card dark:hover:bg-card rounded-md border bg-white px-3 py-1.5 text-sm"
          >
            Mở màn Cung ứng →
          </Link>
        }
      />

      <StatsBar
        stats={[
          { label: 'Đơn đang chạy', value: data.rows.length, tone: 'default' },
          {
            label: 'Chờ bạn duyệt',
            value:
              data.by_status.find((s) => s.status === 'pending_approval')?.count ?? 0,
            tone: 'amber',
          },
          {
            label: 'Quá hẹn giao',
            value: data.late_count,
            tone: data.late_count ? 'red' : 'gray',
          },
          {
            label: 'Duyệt rồi chưa gửi',
            value: data.stuck_count,
            tone: data.stuck_count ? 'amber' : 'gray',
          },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-border dark:border-border dark:bg-card rounded-xl border bg-white p-4">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Giá trị đơn đang chạy
          </h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {money(data.open_value)}
          </p>
          <p className="text-muted-foreground text-[11px]">
            Đã duyệt trở đi, chưa về đủ — tiền đã cam kết với nhà cung cấp.
          </p>
        </div>
        <div className="border-border dark:border-border dark:bg-card rounded-xl border bg-white p-4">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Đang chờ chữ ký của bạn
          </h3>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {money(data.pending_value)}
          </p>
          <Link href="/exec" className="text-xs text-[var(--primary)] hover:underline">
            Sang màn phê duyệt →
          </Link>
        </div>
      </div>

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số đơn, NCC, lệnh, người phụ trách…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={filter}
                onChange={(v) => setFilter(v as Filter)}
                options={[
                  { value: 'all', label: 'Mọi đơn' },
                  { value: 'pending_approval', label: 'Chờ duyệt' },
                  { value: 'late', label: '⚠ Quá hẹn giao' },
                  { value: 'stuck', label: 'Duyệt rồi chưa gửi' },
                ]}
              />
            </>
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon="▩"
            title={
              data.rows.length === 0
                ? 'Chưa có đơn mua nào trên hệ thống'
                : 'Không khớp bộ lọc'
            }
            description={
              data.rows.length === 0
                ? 'Phòng Cung ứng lập đơn ở màn Quản lý đơn đặt hàng; đơn sẽ hiện tại đây ngay khi được tạo.'
                : 'Thử đổi bộ lọc hoặc từ khoá.'
            }
          />
        ) : (
          <DataTable<ExecPoRow>
            rows={rows}
            columns={columns}
            storageKey="exec-purchasing"
          />
        )}
      </div>

      {data.suppliers.length > 0 && (
        <div className="border-border dark:border-border dark:bg-card rounded-xl border bg-white p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Nhà cung cấp theo giá trị đang chạy
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {data.suppliers.slice(0, 10).map((s) => (
              <li
                key={`${s.name}${s.currency}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="truncate">{s.name}</span>
                <span className="whitespace-nowrap tabular-nums">
                  {fmt(s.value)}{' '}
                  <span className="text-muted-foreground text-xs">
                    {s.currency} · {s.pos} đơn
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
