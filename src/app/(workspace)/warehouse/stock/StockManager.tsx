'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Stock = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  on_hand: number
  is_low: boolean
}

type Movement = {
  id: string
  direction: 'in' | 'out'
  qty: number
  qty_rejected: number
  qc_status: string | null
  ref_type: string
  ref_no: string | null
  note: string | null
  created_at: string
  material_code: string | null
}

type StatusFilter = 'all' | 'low' | 'out' | 'ok'

const REF_LABEL: Record<string, string> = {
  po: 'Theo đơn đặt',
  external: 'Mua ngoài',
  lsx: 'Theo LSX',
  daily: 'Thường ngày',
}

export function StockManager({ stock, canEdit }: { stock: Stock[]; canEdit: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [receiveFor, setReceiveFor] = useState<Stock | null>(null)
  const [issueFor, setIssueFor] = useState<Stock | null>(null)
  const [historyFor, setHistoryFor] = useState<Stock | null>(null)

  const [q, setQ] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const s of stock) if (s.group_name) set.add(s.group_name)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [stock])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return stock.filter((s) => {
      if (groupFilter !== 'all' && (s.group_name ?? '') !== groupFilter) return false
      if (statusFilter === 'low' && !s.is_low) return false
      if (statusFilter === 'out' && s.on_hand > 0) return false
      if (statusFilter === 'ok' && (s.is_low || s.on_hand === 0)) return false
      if (ql && !`${s.code} ${s.name} ${s.group_name ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [stock, q, groupFilter, statusFilter])

  const stats = useMemo(() => {
    let low = 0
    let out = 0
    let has = 0
    for (const s of stock) {
      if (s.on_hand === 0) out++
      else has++
      if (s.is_low) low++
    }
    return { low, out, has }
  }, [stock])

  async function post(url: string, body: unknown, okMsg: string): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method: 'POST', body })
      router.refresh()
      toast.success(okMsg)
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    downloadCsv(`ton-kho-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Tên' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'on_hand', header: 'Tồn hiện có', get: (s) => String(s.on_hand) },
      { key: 'min_stock', header: 'Tồn tối thiểu', get: (s) => String(s.min_stock) },
      { key: 'shelf_location', header: 'Vị trí kệ', get: (s) => s.shelf_location ?? '' },
      {
        key: 'is_low',
        header: 'Trạng thái',
        get: (s) => (s.on_hand === 0 ? 'Hết' : s.is_low ? 'Thấp' : 'Đủ'),
      },
    ])
    toast.success(`Đã xuất ${filtered.length} dòng CSV`)
  }

  const columns: Column<Stock>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (s) => s.code,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{s.code}</span>
          <span className="truncate font-medium">{s.name}</span>
        </div>
      ),
    },
    {
      key: 'on_hand',
      header: 'Tồn hiện có',
      width: '130px',
      align: 'right',
      sortValue: (s) => s.on_hand,
      cell: (s) => (
        <span
          className={`font-semibold tabular-nums ${
            s.on_hand === 0 ? 'text-red-600' : s.is_low ? 'text-amber-600' : ''
          }`}
        >
          {s.on_hand} <span className="text-xs font-normal text-zinc-400">{s.unit}</span>
        </span>
      ),
    },
    {
      key: 'min_stock',
      header: 'Tối thiểu',
      width: '100px',
      align: 'right',
      sortValue: (s) => s.min_stock,
      cell: (s) => <span className="text-zinc-500 tabular-nums">{s.min_stock}</span>,
    },
    {
      key: 'shelf_location',
      header: 'Kệ',
      width: '90px',
      sortValue: (s) => s.shelf_location ?? 'zzz',
      cell: (s) =>
        s.shelf_location ? (
          <span className="font-mono text-xs">{s.shelf_location}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      sortValue: (s) => (s.on_hand === 0 ? 0 : s.is_low ? 1 : 2),
      cell: (s) =>
        s.on_hand === 0 ? (
          <Badge tone="red">Hết hàng</Badge>
        ) : s.is_low ? (
          <Badge tone="amber">Tồn thấp</Badge>
        ) : (
          <Badge tone="green">Đủ</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (s) => {
        const items = [{ label: 'Lịch sử nhập/xuất', onClick: () => setHistoryFor(s) }]
        if (canEdit) {
          items.unshift(
            { label: '↑ Nhập kho', onClick: () => setReceiveFor(s) },
            { label: '↓ Xuất kho', onClick: () => setIssueFor(s) },
          )
        }
        return <RowMenu items={items} />
      },
    },
  ]

  const groupOptions = [
    { value: 'all', label: 'Mọi nhóm' },
    ...groups.map((g) => ({ value: g, label: g })),
  ]
  const statusOptions = [
    { value: 'all' as const, label: 'Mọi trạng thái' },
    { value: 'low' as const, label: 'Tồn thấp' },
    { value: 'out' as const, label: 'Hết hàng' },
    { value: 'ok' as const, label: 'Đủ' },
  ]

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Tồn kho' }]}
        title="Tồn kho"
        description={`${filtered.length} / ${stock.length} vật tư. Tồn realtime = tổng nhập (đạt) − tổng xuất.`}
        actions={
          <button onClick={exportCsv} className={btnSecondary}>
            Export CSV
          </button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng VT', value: stock.length, tone: 'default' },
          { label: 'Đang có tồn', value: stats.has, tone: 'green' },
          { label: 'Tồn thấp', value: stats.low, tone: stats.low ? 'amber' : 'gray' },
          { label: 'Hết hàng', value: stats.out, tone: stats.out ? 'red' : 'gray' },
        ]}
      />

      {stats.low > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠ Có <strong>{stats.low}</strong> vật tư tồn dưới mức tối thiểu — cần đề xuất
          mua bổ sung.
        </div>
      )}

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm theo mã, tên, nhóm…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={groupFilter}
                onChange={setGroupFilter}
                options={groupOptions}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
            </>
          }
          right={
            busy ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Spinner size={12} /> Đang xử lý…
              </span>
            ) : undefined
          }
        />

        <DataTable<Stock>
          rows={filtered}
          columns={columns}
          storageKey="warehouse-stock"
          emptyState={
            <EmptyState
              icon="▦"
              title={stock.length === 0 ? 'Chưa có vật tư' : 'Không khớp bộ lọc'}
              description={
                stock.length === 0
                  ? 'Thêm vật tư ở Danh mục vật tư trước, rồi nhập kho.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
            />
          }
        />
      </div>

      {/* Nhập kho */}
      <Modal
        open={!!receiveFor}
        onClose={() => setReceiveFor(null)}
        title={receiveFor ? `Nhập kho — ${receiveFor.name}` : ''}
      >
        {receiveFor && (
          <ReceiveForm
            material={receiveFor}
            onSubmit={async (body) => {
              const ok = await post(
                '/api/dept/warehouse/receipts',
                { material_id: receiveFor.material_id, ...body },
                `Đã nhập ${body.qty} ${receiveFor.unit}`,
              )
              if (ok) setReceiveFor(null)
            }}
          />
        )}
      </Modal>

      {/* Xuất kho */}
      <Modal
        open={!!issueFor}
        onClose={() => setIssueFor(null)}
        title={issueFor ? `Xuất kho — ${issueFor.name}` : ''}
      >
        {issueFor && (
          <IssueForm
            material={issueFor}
            onSubmit={async (body) => {
              const ok = await post(
                '/api/dept/warehouse/issues',
                { material_id: issueFor.material_id, ...body },
                `Đã xuất ${body.qty} ${issueFor.unit}`,
              )
              if (ok) setIssueFor(null)
            }}
          />
        )}
      </Modal>

      {/* Lịch sử */}
      <Modal
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title={historyFor ? `Lịch sử — ${historyFor.name}` : ''}
      >
        {historyFor && (
          <MovementHistory materialId={historyFor.material_id} unit={historyFor.unit} />
        )}
      </Modal>
    </div>
  )
}

// ── Forms ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

function ReceiveForm({
  material,
  onSubmit,
}: {
  material: Stock
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const rejected = Number(fd.get('qty_rejected') ?? 0) || 0
    const body: Record<string, unknown> = {
      qty: Number(fd.get('qty') ?? 0) || 0,
      qty_rejected: rejected,
      qc_status: rejected > 0 ? 'partial' : 'pass',
      ref_type: String(fd.get('ref_type') ?? 'external'),
      ref_no: String(fd.get('ref_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }
  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <div className="text-xs text-zinc-500 sm:col-span-2">
        Tồn hiện có: <strong>{material.on_hand}</strong> {material.unit}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Số đạt (vào kho) <span className="text-red-500">*</span>
        <input
          name="qty"
          type="number"
          min="0.01"
          step="0.01"
          required
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số không đạt (QC)
        <input
          name="qty_rejected"
          type="number"
          min="0"
          step="0.01"
          defaultValue={0}
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nguồn nhập
        <select name="ref_type" defaultValue="external" className={inputCls}>
          <option value="external">Mua ngoài</option>
          <option value="po">Theo đơn đặt hàng</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số đơn đặt / chứng từ
        <input name="ref_no" maxLength={60} placeholder="(nếu có)" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}↑ Nhập kho
        </button>
      </div>
    </form>
  )
}

function IssueForm({
  material,
  onSubmit,
}: {
  material: Stock
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      qty: Number(fd.get('qty') ?? 0) || 0,
      ref_type: String(fd.get('ref_type') ?? 'daily'),
      ref_no: String(fd.get('ref_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }
  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <div className="text-xs text-zinc-500 sm:col-span-2">
        Tồn hiện có: <strong>{material.on_hand}</strong> {material.unit} — không xuất quá
        số này.
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Số lượng xuất <span className="text-red-500">*</span>
        <input
          name="qty"
          type="number"
          min="0.01"
          step="0.01"
          max={material.on_hand}
          required
          className={`${inputCls} tabular-nums`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mục đích
        <select name="ref_type" defaultValue="daily" className={inputCls}>
          <option value="daily">Xuất thường ngày</option>
          <option value="lsx">Theo lệnh sản xuất (LSX)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Mã LSX / lý do
        <input
          name="ref_no"
          maxLength={60}
          placeholder="(nếu xuất theo LSX)"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}↓ Xuất kho
        </button>
      </div>
    </form>
  )
}

function MovementHistory({ materialId, unit }: { materialId: string; unit: string }) {
  const [rows, setRows] = useState<Movement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ rows: Movement[] }>(`/api/dept/warehouse/movements?material_id=${materialId}`)
      .then((r) => alive && setRows(r.rows))
      .catch(
        (e) =>
          alive && setError(e instanceof ApiError ? e.message : 'Không tải được lịch sử'),
      )
    return () => {
      alive = false
    }
  }, [materialId])

  if (error) return <div className="text-sm text-red-600">{error}</div>
  if (rows === null)
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
        <Spinner size={14} /> Đang tải…
      </div>
    )
  if (rows.length === 0)
    return (
      <div className="py-6 text-center text-sm text-zinc-500">
        Chưa có phiếu nhập/xuất nào.
      </div>
    )

  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-zinc-50 text-[10px] tracking-wider text-zinc-500 uppercase dark:bg-zinc-900">
          <tr>
            <th className="px-2 py-1.5">Thời gian</th>
            <th className="px-2 py-1.5">Loại</th>
            <th className="px-2 py-1.5 text-right">SL</th>
            <th className="px-2 py-1.5">Nguồn</th>
            <th className="px-2 py-1.5">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500">
                {new Date(m.created_at).toLocaleString('vi-VN')}
              </td>
              <td className="px-2 py-1.5">
                {m.direction === 'in' ? (
                  <span className="font-medium text-green-600">↑ Nhập</span>
                ) : (
                  <span className="font-medium text-sky-600">↓ Xuất</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {m.qty} {unit}
                {m.qty_rejected > 0 && (
                  <span className="ml-1 text-red-500">(loại {m.qty_rejected})</span>
                )}
              </td>
              <td className="px-2 py-1.5">
                {REF_LABEL[m.ref_type] ?? m.ref_type}
                {m.ref_no && <span className="ml-1 text-zinc-400">#{m.ref_no}</span>}
              </td>
              <td className="px-2 py-1.5 text-zinc-500">{m.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
