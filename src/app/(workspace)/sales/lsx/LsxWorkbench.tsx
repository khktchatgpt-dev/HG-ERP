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
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { LSX_STATUS } from '@/lib/lsx-status'

/**
 * TRANG LỆNH SẢN XUẤT của Sales — thay trang "Theo dõi đơn" cũ.
 *
 * Trước đây Sales chỉ có bảng trạng thái ĐƠN, muốn phát lệnh phải mở từng đơn;
 * mà từ 0113 một lệnh gộp nhiều đơn nên nhìn theo đơn là nhìn ngược. Trang này
 * lấy LỆNH làm trục:
 *
 *   · khối trên  — ĐƠN CHỜ PHÁT LỆNH, gom theo khách: tick nhiều đơn của cùng
 *     một khách rồi phát MỘT lệnh cho cả nhóm ngay tại đây;
 *   · khối dưới  — DANH SÁCH LỆNH: lọc theo trạng thái, vào hồ sơ, soạn dòng,
 *     in phiếu.
 *
 * Chọn chéo khách bị chặn ngay ở nút (server + trigger DB vẫn chặn lần nữa).
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
  const [picked, setPicked] = useState<string[]>([])
  const [form, setForm] = useState({ code: '', ship_date: '', container: '' })

  // Đơn chờ phát lệnh, gom theo khách — mỗi khách một khối tick riêng.
  const byCustomer = useMemo(() => {
    const m = new Map<string, { name: string; orders: AwaitingOrder[] }>()
    for (const o of awaiting) {
      const g = m.get(o.customer_id) ?? { name: o.customer_name, orders: [] }
      g.orders.push(o)
      m.set(o.customer_id, g)
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [awaiting])

  const pickedCustomer = useMemo(() => {
    const first = awaiting.find((o) => o.id === picked[0])
    return first?.customer_id ?? null
  }, [picked, awaiting])

  const pickedOrders = awaiting.filter((o) => picked.includes(o.id))
  const pickedQty = pickedOrders.reduce((s, o) => s + o.qty, 0)

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

  function toggle(o: AwaitingOrder) {
    setPicked((prev) => {
      if (prev.includes(o.id)) return prev.filter((x) => x !== o.id)
      // Đổi khách → bỏ chọn nhóm cũ, vì một lệnh chỉ gộp đơn của MỘT khách.
      if (pickedCustomer && pickedCustomer !== o.customer_id) return [o.id]
      return [...prev, o.id]
    })
  }

  async function issue() {
    if (!form.code.trim() || !picked.length) return
    setBusy(true)
    try {
      const { lsx } = await api<{ lsx: { id: string; code: string } }>(
        '/api/dept/production/lsx',
        {
          method: 'POST',
          body: JSON.stringify({
            code: form.code.trim(),
            order_ids: picked,
            ship_date: form.ship_date || null,
            container_summary: form.container.trim() || null,
          }),
        },
      )
      toast.success(
        `Đã phát lệnh ${lsx.code}`,
        `${picked.length} đơn · chờ Giám đốc duyệt`,
      )
      setPicked([])
      setForm({ code: '', ship_date: '', container: '' })
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

      {/* ── Đơn chờ phát lệnh ─────────────────────────────────────────────── */}
      {canIssue && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              Đơn chờ phát lệnh ({awaiting.length})
            </h2>
            <span className="text-xs text-zinc-500">
              tick các đơn của CÙNG một khách rồi phát chung một lệnh
            </span>
          </div>

          {awaiting.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Không còn đơn nào chờ — mọi đơn đã xác nhận đều đã có lệnh sản xuất.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {byCustomer.map(([cid, g]) => {
                const dim = pickedCustomer !== null && pickedCustomer !== cid
                return (
                  <div
                    key={cid}
                    className={`rounded-lg border p-2.5 ${
                      dim
                        ? 'border-zinc-200 opacity-50 dark:border-zinc-800'
                        : 'border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    <div className="mb-1.5 text-sm font-medium">
                      {g.name}{' '}
                      <span className="text-xs font-normal text-zinc-500">
                        {g.orders.length} đơn
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {g.orders.map((o) => (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 text-sm"
                          title={dim ? 'Bỏ chọn khách kia trước' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={picked.includes(o.id)}
                            onChange={() => toggle(o)}
                          />
                          <span className="font-mono">{o.code}</span>
                          <span className="text-xs text-zinc-500">
                            {o.line_count} dòng · {fmtN(o.qty)} SP
                            {o.due_date ? ` · hạn ${fmtD(o.due_date)}` : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}

              {picked.length > 0 && (
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <label className="flex flex-col gap-1 text-xs">
                    Số lệnh <span className="text-red-500">*</span>
                    <input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="01/26 - Rosco"
                      maxLength={50}
                      className="w-56 rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Hạn xuất dự kiến
                    <input
                      type="date"
                      value={form.ship_date}
                      onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Container
                    <input
                      value={form.container}
                      onChange={(e) => setForm({ ...form, container: e.target.value })}
                      placeholder="3 x 40'HC"
                      className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </label>
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    Đã chọn <b>{picked.length}</b> đơn · <b>{fmtN(pickedQty)}</b> SP
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setPicked([])}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-white dark:border-zinc-700"
                    >
                      Bỏ chọn
                    </button>
                    <button
                      disabled={busy || !form.code.trim()}
                      onClick={() => void issue()}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busy && <Spinner size={14} />}
                      Phát lệnh cho {picked.length} đơn
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
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
              description="Tick đơn ở khối trên rồi bấm Phát lệnh."
            />
          }
        />
      </div>
    </div>
  )
}
