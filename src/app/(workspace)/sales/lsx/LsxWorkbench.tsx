'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { LSX_STATUS } from '@/lib/lsx-status'
import { IssueLsxDialog, type IssueForm } from './IssueLsxDialog'

/**
 * TRANG LỆNH SẢN XUẤT của Sales — thay trang "Theo dõi đơn" cũ.
 *
 * Trước đây Sales chỉ có bảng trạng thái ĐƠN, muốn phát lệnh phải mở từng đơn;
 * mà từ 0113 một lệnh gộp nhiều đơn nên nhìn theo đơn là nhìn ngược. Trang này
 * lấy LỆNH làm trục: danh sách lệnh (lọc, vào hồ sơ, soạn dòng, in phiếu), còn
 * việc phát lệnh nằm gọn trong hộp thoại "Phát lệnh sản xuất" (khách → đơn,
 * xem IssueLsxDialog).
 */

export type AwaitingOrder = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  due_date: string | null
  line_count: number
  qty: number
}

export type LsxRow = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  order_codes: string[]
  status: string
  revision: number
  issued_at: string | null
  ship_date: string | null
  lines: number
  qty: number
}

const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
const fmtN = (n: number) => n.toLocaleString('vi-VN')

export function LsxWorkbench({
  awaiting,
  rows,
  canIssue,
}: {
  awaiting: AwaitingOrder[]
  rows: LsxRow[]
  canIssue: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [issuing, setIssuing] = useState(false)

  // Mã lệnh đã phát của từng khách — để hộp thoại gợi ý số lệnh kế tiếp.
  const codesByCustomer = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const r of rows) (m[r.customer_id] ??= []).push(r.code)
    return m
  }, [rows])

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (status && r.status !== status) return false
      if (!ql) return true
      return `${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`
        .toLowerCase()
        .includes(ql)
    })
  }, [rows, q, status])

  async function issue(orderIds: string[], form: IssueForm) {
    if (!form.code.trim() || !orderIds.length) return
    setBusy(true)
    try {
      const { lsx } = await api<{ lsx: { id: string; code: string } }>(
        '/api/dept/production/lsx',
        {
          method: 'POST',
          body: JSON.stringify({
            code: form.code.trim(),
            order_ids: orderIds,
            ship_date: form.ship_date || null,
            container_summary: form.container.trim() || null,
          }),
        },
      )
      toast.success(
        `Đã phát lệnh ${lsx.code}`,
        `${orderIds.length} đơn · chờ Giám đốc duyệt`,
      )
      setIssuing(false)
      // Đi thẳng sang soạn dòng: dòng vừa nạp tự động gần như luôn phải sửa.
      router.push(`/sales/lsx/${lsx.id}/dong`)
    } catch (e) {
      toast.error('Phát lệnh thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      setBusy(false)
    }
  }

  const columns: Column<LsxRow>[] = [
    {
      key: 'code',
      header: 'Số lệnh',
      width: '190px',
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/sales/lsx/${r.id}`}
            className="font-mono font-medium hover:underline"
          >
            {r.code}
          </Link>
          {r.revision > 1 && <Badge tone="amber">sửa lần {r.revision}</Badge>}
        </span>
      ),
    },
    { key: 'customer', header: 'Khách hàng', cell: (r) => r.customer_name },
    {
      key: 'orders',
      header: 'Đơn hàng',
      cell: (r) => (
        <span>
          {r.order_codes.length > 1 && (
            <b className="mr-1">{r.order_codes.length} đơn:</b>
          )}
          <span className="text-zinc-600 dark:text-zinc-400">
            {r.order_codes.join(', ') || '—'}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '130px',
      cell: (r) => {
        const st = LSX_STATUS[r.status as keyof typeof LSX_STATUS]
        return <Badge tone={st?.tone ?? 'gray'}>{st?.label ?? r.status}</Badge>
      },
    },
    {
      key: 'lines',
      header: 'Dòng / SL',
      width: '110px',
      align: 'right',
      cell: (r) => (r.lines ? `${r.lines} · ${fmtN(r.qty)}` : '—'),
      sortValue: (r) => r.qty,
    },
    {
      key: 'issued',
      header: 'Phát ngày',
      width: '100px',
      cell: (r) => fmtD(r.issued_at),
      sortValue: (r) => r.issued_at ?? '',
    },
    {
      key: 'ship',
      header: 'Hạn xuất',
      width: '100px',
      cell: (r) => fmtD(r.ship_date),
      sortValue: (r) => r.ship_date ?? '',
    },
    {
      key: 'act',
      header: '',
      width: '48px',
      cell: (r) => (
        <RowMenu
          items={[
            { label: 'Mở hồ sơ lệnh', onClick: () => router.push(`/sales/lsx/${r.id}`) },
            {
              label: 'Soạn dòng lệnh',
              onClick: () => router.push(`/sales/lsx/${r.id}/dong`),
              disabled: !canIssue || r.status === 'completed' || r.status === 'cancelled',
              disabledReason: 'Lệnh đã kết thúc',
            },
            {
              label: 'In phiếu lệnh',
              onClick: () => window.open(`/print/lsx/${r.id}`, '_blank'),
            },
          ]}
        />
      ),
    },
  ]

  const running = rows.filter(
    (r) => r.status === 'approved' || r.status === 'in_progress',
  )

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        title="Lệnh sản xuất"
        description="Phát một lệnh cho nhiều đơn của cùng khách, rồi theo dõi và sửa lệnh đang chạy."
        actions={
          canIssue && (
            <button
              onClick={() => setIssuing(true)}
              disabled={awaiting.length === 0}
              title={
                awaiting.length === 0
                  ? 'Không còn đơn nào chờ phát lệnh'
                  : `${awaiting.length} đơn đang chờ phát lệnh`
              }
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              ＋ Phát lệnh sản xuất
              {awaiting.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-xs">
                  {awaiting.length}
                </span>
              )}
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Đơn chờ phát lệnh', value: awaiting.length, tone: 'amber' },
          {
            label: 'Chờ duyệt',
            value: rows.filter((r) => r.status === 'pending_approval').length,
            tone: 'purple',
          },
          { label: 'Đang chạy', value: running.length, tone: 'blue' },
          {
            label: 'Bị từ chối',
            value: rows.filter((r) => r.status === 'rejected').length,
            tone: 'red',
          },
          {
            label: 'Hoàn thành',
            value: rows.filter((r) => r.status === 'completed').length,
            tone: 'green',
          },
          { label: 'Tổng lệnh', value: rows.length },
        ]}
      />

      {canIssue && (
        <IssueLsxDialog
          open={issuing}
          onClose={() => setIssuing(false)}
          awaiting={awaiting}
          codesByCustomer={codesByCustomer}
          busy={busy}
          onIssue={issue}
        />
      )}

      {/* ── Danh sách lệnh ────────────────────────────────────────────────── */}
      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm số lệnh, khách, mã đơn…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: '', label: 'Mọi trạng thái' },
                  ...Object.entries(LSX_STATUS).map(([v, s]) => ({
                    value: v,
                    label: s.label,
                  })),
                ]}
              />
            </>
          }
          right={
            <span className="text-xs text-zinc-500">
              {shown.length}/{rows.length} lệnh
            </span>
          }
        />
        <DataTable
          rows={shown}
          columns={columns}
          storageKey="sales-lsx"
          emptyState={
            <EmptyState
              title="Chưa có lệnh sản xuất nào"
              description={
                canIssue
                  ? 'Bấm "Phát lệnh sản xuất" ở góc trên để làm lệnh đầu tiên.'
                  : 'Sales sẽ phát lệnh từ các đơn đã xác nhận.'
              }
            />
          }
        />
      </div>
    </div>
  )
}
