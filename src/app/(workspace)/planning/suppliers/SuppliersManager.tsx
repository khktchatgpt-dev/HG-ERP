'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
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
  last_po: string | null
}

export function SuppliersManager({
  suppliers,
  canEdit,
}: {
  suppliers: Supplier[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

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
      cell: (s) => {
        if (!canEdit) return null
        return (
          <RowMenu
            items={[
              { label: 'Sửa', onClick: () => setEditing(s) },
              {
                label: s.is_active ? 'Ngừng giao dịch' : 'Kích hoạt lại',
                onClick: () =>
                  void send(`/api/dept/supply/suppliers/${s.id}`, 'PATCH', {
                    is_active: !s.is_active,
                  }),
              },
            ]}
          />
        )
      },
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
    </div>
  )
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
