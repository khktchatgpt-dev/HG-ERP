'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Supplier = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_no: string | null
  note: string | null
  is_active: boolean
  po_count: number
  open_po_count: number // PO chưa về đủ/chưa huỷ — cảnh báo khi ngừng giao dịch
  last_po: string | null
}

type MaterialOption = { id: string; code: string; name: string; unit: string }

type PriceRow = {
  id: string
  material_id: string
  material_code: string
  material_name: string
  material_unit: string
  price: number
  currency: string
  valid_from: string
  note: string | null
}

export function SuppliersManager({
  suppliers,
  materials,
  canEdit,
}: {
  suppliers: Supplier[]
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [pricing, setPricing] = useState<Supplier | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return suppliers.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false
      if (statusFilter === 'inactive' && s.is_active) return false
      if (ql && !`${s.code ?? ''} ${s.name} ${s.tax_no ?? ''}`.toLowerCase().includes(ql))
        return false
      return true
    })
  }, [suppliers, q, statusFilter])

  // Ngừng giao dịch khi còn PO mở là tình huống thật (NCC ngưng cung cấp) —
  // không chặn, nhưng confirm phải nói rõ để Cung ứng xử lý các PO dở dang.
  async function toggleActive(s: Supplier) {
    if (s.is_active) {
      const warn =
        s.open_po_count > 0
          ? ` CHÚ Ý: còn ${s.open_po_count} PO đang mở với NCC này — hàng chưa về đủ, cần xử lý (huỷ hoặc chờ về) trước khi ngừng hẳn.`
          : ''
      const ok = await confirm({
        title: `Ngừng giao dịch với ${s.name}?`,
        description: `NCC ngừng sẽ không chọn được khi tạo PO / so giá.${warn}`,
        tone: s.open_po_count > 0 ? 'danger' : undefined,
        confirmLabel: 'Ngừng giao dịch',
      })
      if (!ok) return
    }
    const ok2 = await send(`/api/dept/supply/suppliers/${s.id}`, 'PATCH', {
      is_active: !s.is_active,
    })
    if (ok2)
      toast.success(s.is_active ? 'Đã ngừng giao dịch' : 'Đã kích hoạt lại', s.name)
  }

  async function send(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'NCC',
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="flex min-w-0 flex-col">
          {s.code && <span className="font-mono text-xs text-zinc-400">{s.code}</span>}
          <span className="truncate font-medium">{s.name}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      cell: (s) => (
        <div className="flex flex-col text-xs text-zinc-500">
          {s.phone && <span>{s.phone}</span>}
          {s.email && <span className="truncate">{s.email}</span>}
          {!s.phone && !s.email && '—'}
        </div>
      ),
    },
    {
      key: 'tax',
      header: 'MST',
      width: '120px',
      cell: (s) => <span className="font-mono text-xs">{s.tax_no ?? '—'}</span>,
    },
    {
      key: 'history',
      header: 'Lịch sử mua',
      sortValue: (s) => s.po_count,
      width: '140px',
      cell: (s) =>
        s.po_count > 0 ? (
          <div className="flex flex-col text-xs">
            <span>{s.po_count} đơn đặt</span>
            {s.last_po && <span className="font-mono text-zinc-400">{s.last_po}</span>}
          </div>
        ) : (
          <span className="text-xs text-zinc-400">Chưa mua</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      cell: (s) =>
        s.is_active ? (
          <Badge tone="green">Đang giao dịch</Badge>
        ) : (
          <Badge tone="gray">Ngừng</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (s) => (
        <RowMenu
          items={[
            // Xem bảng giá: mọi NV; sửa trong panel theo canEdit (FR-SUP-06).
            { label: 'Bảng giá', onClick: () => setPricing(s) },
            ...(canEdit
              ? [
                  { label: 'Sửa', onClick: () => setEditing(s) },
                  {
                    label: s.is_active ? 'Ngừng giao dịch' : 'Kích hoạt lại',
                    onClick: () => void toggleActive(s),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Nhà cung cấp' },
        ]}
        title="Nhà cung cấp"
        description={`${filtered.length} / ${suppliers.length} NCC — mỗi đơn đặt vật tư gắn đúng 1 NCC (BR-06).`}
        actions={
          canEdit && (
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Thêm NCC
            </button>
          )
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng NCC', value: suppliers.length, tone: 'default' },
          {
            label: 'Đang giao dịch',
            value: suppliers.filter((s) => s.is_active).length,
            tone: 'green',
          },
          {
            label: 'Có lịch sử mua',
            value: suppliers.filter((s) => s.po_count > 0).length,
            tone: 'blue',
          },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm tên, mã, MST…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi trạng thái' },
                  { value: 'active' as const, label: 'Đang giao dịch' },
                  { value: 'inactive' as const, label: 'Ngừng' },
                ]}
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

        <DataTable<Supplier>
          rows={filtered}
          columns={columns}
          storageKey="supply-suppliers"
          rowClassName={(s) => (!s.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="◒"
              title={suppliers.length === 0 ? 'Chưa có NCC nào' : 'Không khớp bộ lọc'}
              description="Thêm NCC để tạo được đơn đặt vật tư."
              action={
                canEdit && suppliers.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Thêm NCC
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm nhà cung cấp"
      >
        <SupplierForm
          submitLabel="Thêm NCC"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/supply/suppliers', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm NCC', String(body.name))
            }
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
      >
        {editing && (
          <SupplierForm
            initial={editing}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/supply/suppliers/${editing.id}`,
                'PATCH',
                body,
              )
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', String(body.name))
              }
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!pricing}
        onClose={() => setPricing(null)}
        title={pricing ? `Bảng giá — ${pricing.name}` : ''}
      >
        {pricing && (
          <PricesPanel supplier={pricing} materials={materials} canEdit={canEdit} />
        )}
      </Modal>
    </div>
  )
}

// ── Bảng giá NCC (FR-SUP-06, G-1) ───────────────────────────────────────────
// Đổi giá = THÊM bản ghi mới (valid_from) — giữ lịch sử; bản ghi hiện hành có badge.

function PricesPanel({
  supplier,
  materials,
  canEdit,
}: {
  supplier: { id: string; name: string }
  materials: MaterialOption[]
  canEdit: boolean
}) {
  const toast = useToast()
  const [rows, setRows] = useState<PriceRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [materialId, setMaterialId] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('VND')
  const [validFrom, setValidFrom] = useState('')
  const [note, setNote] = useState('')

  async function reload() {
    const data = await api<{ prices: PriceRow[] }>(
      `/api/dept/supply/prices?supplier_id=${supplier.id}`,
    )
    setRows(data.prices)
  }

  useEffect(() => {
    let alive = true
    api<{ prices: PriceRow[] }>(`/api/dept/supply/prices?supplier_id=${supplier.id}`)
      .then((d) => {
        if (alive) setRows(d.prices)
      })
      .catch((e) => {
        if (alive) {
          setRows([])
          toast.error(
            'Không tải được bảng giá',
            e instanceof ApiError ? e.message : 'Có lỗi',
          )
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id])

  // Bản ghi hiện hành per vật tư: valid_from lớn nhất ≤ hôm nay.
  const today = new Date().toISOString().slice(0, 10)
  const currentIds = new Set<string>()
  if (rows) {
    const best = new Map<string, PriceRow>()
    for (const r of rows) {
      if (r.valid_from > today) continue
      const cur = best.get(r.material_id)
      if (!cur || r.valid_from > cur.valid_from) best.set(r.material_id, r)
    }
    for (const r of best.values()) currentIds.add(r.id)
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/api/dept/supply/prices', {
        method: 'POST',
        body: {
          supplier_id: supplier.id,
          material_id: materialId,
          price: Number(price),
          currency,
          valid_from: validFrom || undefined,
          note: note.trim() || null,
        },
      })
      toast.success('Đã thêm giá chào', supplier.name)
      setPrice('')
      setNote('')
      await reload()
    } catch (err) {
      toast.error('Thêm giá thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: PriceRow) {
    if (!window.confirm(`Xoá giá ${row.material_code} (${fmtMoney(row)})?`)) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/prices/${row.id}`, { method: 'DELETE' })
      await reload()
    } catch (err) {
      toast.error('Xoá thất bại', err instanceof ApiError ? err.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <form onSubmit={add} className="grid gap-2 sm:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            Vật tư <span className="text-red-500">*</span>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
              className={inp}
            >
              <option value="">— chọn vật tư —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Giá <span className="text-red-500">*</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className={inp}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Tiền tệ
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inp}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Hiệu lực từ
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={inp}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={busy || !materialId || price === ''}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}+ Thêm giá
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-6">
            Ghi chú (quy cách, MOQ…)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className={inp}
            />
          </label>
        </form>
      )}

      {rows === null ? (
        <p className="py-4 text-center text-xs text-zinc-400">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-400">
          Chưa có giá chào nào — thêm ở trên (giá giữ nguyên tệ, không quy đổi).
        </p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-1.5 pr-2">Vật tư</th>
                <th className="py-1.5 pr-2 text-right">Giá</th>
                <th className="py-1.5 pr-2">Hiệu lực từ</th>
                <th className="py-1.5 pr-2">Ghi chú</th>
                <th className="w-8 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {r.material_code}
                    </span>{' '}
                    {r.material_name}
                    {currentIds.has(r.id) && (
                      <span className="ml-1.5">
                        <Badge tone="green">Hiện hành</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-medium whitespace-nowrap">
                    {fmtMoney(r)}
                    <span className="text-xs text-zinc-400">/{r.material_unit}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-xs">
                    {new Date(r.valid_from).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="max-w-40 truncate py-1.5 pr-2 text-xs text-zinc-500">
                    {r.note ?? '—'}
                  </td>
                  <td className="py-1.5 text-right">
                    {canEdit && (
                      <button
                        onClick={() => void remove(r)}
                        className="text-xs text-red-500 hover:underline"
                        title="Xoá bản ghi giá"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function fmtMoney(r: { price: number; currency: string }) {
  return `${r.price.toLocaleString('vi-VN')} ${r.currency}`
}

function SupplierForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Supplier
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim() || null,
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim() || null,
      address: String(fd.get('address') ?? '').trim() || null,
      tax_no: String(fd.get('tax_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã NCC
        <input
          name="code"
          maxLength={50}
          defaultValue={initial?.code ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        MST
        <input
          name="tax_no"
          maxLength={30}
          defaultValue={initial?.tax_no ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên NCC <span className="text-red-500">*</span>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Điện thoại
        <input
          name="phone"
          maxLength={30}
          defaultValue={initial?.phone ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          defaultValue={initial?.email ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Địa chỉ
        <input
          name="address"
          maxLength={500}
          defaultValue={initial?.address ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </label>
      <div className="flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
