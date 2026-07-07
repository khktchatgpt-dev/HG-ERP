'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
}

type BomStatus = 'none' | 'drawing' | 'done'

type Product = {
  id: string
  code: string
  name: string
  category: string | null
  customer_id: string | null
  customer_item_code: string | null
  description_en: string | null
  unit: string
  bom_status: BomStatus
  packing: Packing
  drawing_url: string | null
  bom_url: string | null
  notes: string | null
  is_active: boolean
}

type CustomerOption = { id: string; name: string }

type StatusFilter = 'all' | 'active' | 'inactive'
type BomFilter = 'all' | BomStatus

const BOM_LABEL: Record<BomStatus, string> = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
}
const BOM_TONE: Record<BomStatus, 'gray' | 'amber' | 'green'> = {
  none: 'gray',
  drawing: 'amber',
  done: 'green',
}

export function ProductsManager({
  products,
  customers,
  canEdit,
}: {
  products: Product[]
  customers: CustomerOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  // Deep-link ?new=1 mở sẵn form tạo (chỉ đọc lúc mount).
  const [openCreate, setOpenCreate] = useState(() => canEdit && sp.get('new') === '1')
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [cloning, setCloning] = useState<Product | null>(null)

  const [q, setQ] = useState('')
  const [customerFilter, setCustomerFilter] = useState<string>('all')
  const [bomFilter, setBomFilter] = useState<BomFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const customerName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of customers) m.set(c.id, c.name)
    return m
  }, [customers])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return products.filter((p) => {
      if (customerFilter === 'common' && p.customer_id) return false
      if (
        customerFilter !== 'all' &&
        customerFilter !== 'common' &&
        p.customer_id !== customerFilter
      )
        return false
      if (bomFilter !== 'all' && p.bom_status !== bomFilter) return false
      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'inactive' && p.is_active) return false
      if (ql) {
        const hay =
          `${p.code} ${p.name} ${p.category ?? ''} ${p.customer_item_code ?? ''} ` +
          `${p.customer_id ? (customerName.get(p.customer_id) ?? '') : ''}`
        if (!hay.toLowerCase().includes(ql)) return false
      }
      return true
    })
  }, [products, q, customerFilter, bomFilter, statusFilter, customerName])

  const stats = useMemo(() => {
    let active = 0
    const bom: Record<BomStatus, number> = { none: 0, drawing: 0, done: 0 }
    for (const p of products) {
      if (p.is_active) active++
      bom[p.bom_status]++
    }
    return { active, bom }
  }, [products])

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<boolean> {
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

  async function deleteProduct(p: Product) {
    const ok = await confirm({
      title: `Xoá sản phẩm "${p.name}"?`,
      description: 'BOM của sản phẩm cũng bị xoá theo. Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/technical/products/${p.id}`, 'DELETE')
    if (ok2) toast.success('Đã xoá', p.name)
  }

  function exportCsv() {
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'code', header: 'Mã' },
      {
        key: 'customer_item_code',
        header: 'Mã KH đặt',
        get: (p) => p.customer_item_code ?? '',
      },
      { key: 'name', header: 'Tên' },
      {
        key: 'customer_id',
        header: 'Khách hàng',
        get: (p) =>
          p.customer_id ? (customerName.get(p.customer_id) ?? '') : 'Mẫu chung',
      },
      { key: 'category', header: 'Danh mục' },
      { key: 'unit', header: 'ĐVT' },
      { key: 'bom_status', header: 'BOM', get: (p) => BOM_LABEL[p.bom_status] },
      {
        key: 'packing',
        header: 'Loading 40HC',
        get: (p) =>
          p.packing?.loading_40hc != null ? String(p.packing.loading_40hc) : '',
      },
      {
        key: 'is_active',
        header: 'Trạng thái',
        get: (p) => (p.is_active ? 'Đang dùng' : 'Ngừng'),
      },
    ])
    toast.success(`Đã xuất ${filtered.length} dòng CSV`)
  }

  const columns: Column<Product>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (p) => p.code,
      cell: (p) => (
        <button
          onClick={() => setViewing(p)}
          className="flex min-w-0 flex-col text-left hover:text-sky-600 dark:hover:text-sky-400"
        >
          <span className="font-mono text-xs text-zinc-400">
            {p.code}
            {p.customer_item_code && (
              <span className="ml-1 text-sky-600 dark:text-sky-400">
                · KH: {p.customer_item_code}
              </span>
            )}
          </span>
          <span className="truncate font-medium">{p.name}</span>
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      sortValue: (p) => (p.customer_id ? (customerName.get(p.customer_id) ?? 'zzz') : ''),
      width: '160px',
      cell: (p) =>
        p.customer_id ? (
          <span className="truncate">{customerName.get(p.customer_id) ?? '?'}</span>
        ) : (
          <Badge tone="gray">Mẫu chung</Badge>
        ),
    },
    {
      key: 'bom',
      header: 'BOM',
      sortValue: (p) => p.bom_status,
      width: '120px',
      cell: (p) => <Badge tone={BOM_TONE[p.bom_status]}>{BOM_LABEL[p.bom_status]}</Badge>,
    },
    {
      key: 'docs',
      header: 'Tài liệu',
      width: '140px',
      cell: (p) => (
        <div className="flex items-center gap-2 text-xs">
          {p.drawing_url ? (
            <a
              href={p.drawing_url}
              target="_blank"
              rel="noopener"
              className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
              onClick={(e) => e.stopPropagation()}
            >
              Bản vẽ
            </a>
          ) : (
            <span className="text-amber-600">Thiếu BV</span>
          )}
          {p.bom_url && (
            <a
              href={p.bom_url}
              target="_blank"
              rel="noopener"
              className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
              onClick={(e) => e.stopPropagation()}
            >
              File BOM
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (p) => (p.is_active ? 0 : 1),
      width: '110px',
      cell: (p) =>
        p.is_active ? (
          <Badge tone="green">Đang dùng</Badge>
        ) : (
          <Badge tone="gray">Ngừng</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (p) => {
        const items = [{ label: 'Xem chi tiết', onClick: () => setViewing(p) }]
        if (canEdit) {
          items.push(
            { label: 'Sửa', onClick: () => setEditing(p) },
            { label: 'Nhân bản mẫu', onClick: () => setCloning(p) },
            {
              label: p.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
              onClick: () =>
                send(`/api/dept/technical/products/${p.id}`, 'PATCH', {
                  is_active: !p.is_active,
                }),
            },
          )
        }
        const menuItems = canEdit
          ? [...items, { label: 'Xoá', onClick: () => deleteProduct(p), danger: true }]
          : items
        return <RowMenu items={menuItems} />
      },
    },
  ]

  const customerOptions = [
    { value: 'all', label: 'Mọi khách hàng' },
    { value: 'common', label: 'Mẫu chung' },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ]
  const bomOptions = [
    { value: 'all' as const, label: 'BOM: tất cả' },
    { value: 'none' as const, label: 'Chưa có BOM' },
    { value: 'drawing' as const, label: 'Đang vẽ' },
    { value: 'done' as const, label: 'Đã vẽ' },
  ]
  const statusOptions = [
    { value: 'all' as const, label: 'Mọi trạng thái' },
    { value: 'active' as const, label: 'Đang dùng' },
    { value: 'inactive' as const, label: 'Ngừng' },
  ]

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'
  const btnPrimary =
    'rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Thư viện sản phẩm' },
        ]}
        title="Thư viện sản phẩm"
        description={`${filtered.length} / ${products.length} sản phẩm — tổ chức theo khách hàng, kèm cờ BOM.`}
        actions={
          <>
            <button onClick={exportCsv} className={btnSecondary}>
              Export CSV
            </button>
            {canEdit && (
              <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                + Thêm sản phẩm
              </button>
            )}
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng SP', value: products.length, tone: 'default' },
          { label: 'Đang dùng', value: stats.active, tone: 'green' },
          { label: 'BOM đã vẽ', value: stats.bom.done, tone: 'green' },
          {
            label: 'Đang vẽ',
            value: stats.bom.drawing,
            tone: stats.bom.drawing ? 'amber' : 'gray',
          },
          {
            label: 'Chưa có BOM',
            value: stats.bom.none,
            tone: stats.bom.none ? 'amber' : 'gray',
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
                placeholder="Tìm mã, tên, mã KH đặt, khách hàng…"
                icon="⌕"
                className="w-72"
              />
              <ToolbarSelect
                value={customerFilter}
                onChange={setCustomerFilter}
                options={customerOptions}
              />
              <ToolbarSelect
                value={bomFilter}
                onChange={(v) => setBomFilter(v)}
                options={bomOptions}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              {(q ||
                customerFilter !== 'all' ||
                bomFilter !== 'all' ||
                statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    setCustomerFilter('all')
                    setBomFilter('all')
                    setStatusFilter('all')
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Xoá lọc
                </button>
              )}
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

        <DataTable<Product>
          rows={filtered}
          columns={columns}
          storageKey="tech-products"
          rowClassName={(p) => (!p.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="◇"
              title={
                products.length === 0 ? 'Thư viện sản phẩm trống' : 'Không khớp bộ lọc'
              }
              description={
                products.length === 0
                  ? canEdit
                    ? 'Thêm sản phẩm đầu tiên để khởi tạo thư viện.'
                    : 'Chưa có sản phẩm nào — liên hệ Kỹ thuật để bổ sung.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && products.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Thêm sản phẩm
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Create */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm sản phẩm"
        maxWidth="sm:max-w-2xl"
      >
        <ProductForm
          customers={customers}
          submitLabel="Thêm sản phẩm"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/technical/products', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm sản phẩm', String(body.name))
            }
          }}
        />
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
        maxWidth="sm:max-w-2xl"
      >
        {editing && (
          <ProductForm
            initial={editing}
            customers={customers}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/technical/products/${editing.id}`,
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

      {/* Clone (FR-ENG-02: tái sử dụng mẫu) */}
      <Modal
        open={!!cloning}
        onClose={() => setCloning(null)}
        title={cloning ? `Nhân bản mẫu — ${cloning.name}` : ''}
      >
        {cloning && (
          <CloneForm
            source={cloning}
            customers={customers}
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/technical/products/${cloning.id}/clone`,
                'POST',
                body,
              )
              if (ok) {
                setCloning(null)
                toast.success('Đã nhân bản', `${cloning.code} → ${String(body.code)}`)
              }
            }}
          />
        )}
      </Modal>

      {/* View detail */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? 'Chi tiết sản phẩm'}
        maxWidth="sm:max-w-2xl"
      >
        {viewing && (
          <ProductDetail
            product={viewing}
            customerName={
              viewing.customer_id ? (customerName.get(viewing.customer_id) ?? null) : null
            }
            canEdit={canEdit}
            onEdit={() => {
              setEditing(viewing)
              setViewing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────

function ProductDetail({
  product,
  customerName,
  canEdit,
  onEdit,
}: {
  product: Product
  customerName: string | null
  canEdit: boolean
  onEdit: () => void
}) {
  const pk = product.packing ?? {}
  const dims = [pk.l_cm, pk.w_cm, pk.h_cm].every((v) => v != null)
    ? `${pk.l_cm} × ${pk.w_cm} × ${pk.h_cm} cm`
    : null
  const carton = [pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm].every((v) => v != null)
    ? `${pk.carton_l_cm} × ${pk.carton_w_cm} × ${pk.carton_h_cm} cm`
    : null
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Row label="Mã nội bộ" value={<span className="font-mono">{product.code}</span>} />
      <Row
        label="Mã KH đặt"
        value={
          product.customer_item_code ? (
            <span className="font-mono">{product.customer_item_code}</span>
          ) : (
            '—'
          )
        }
      />
      <Row label="Khách hàng" value={customerName ?? 'Mẫu chung'} />
      <Row label="Danh mục" value={product.category ?? '—'} />
      <Row label="ĐVT" value={product.unit} />
      <Row
        label="BOM"
        value={
          <Badge tone={BOM_TONE[product.bom_status]}>
            {BOM_LABEL[product.bom_status]}
          </Badge>
        }
      />
      {product.description_en && (
        <Row label="Mô tả (EN)" value={product.description_en} />
      )}
      {(dims || carton || pk.qty_per_carton != null || pk.loading_40hc != null) && (
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <div className="mb-2 text-xs font-semibold text-zinc-500 uppercase">
            Đóng gói xuất khẩu
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {dims && <Row label="Kích thước SP" value={dims} />}
            {carton && <Row label="Carton" value={carton} />}
            {pk.qty_per_carton != null && (
              <Row label="SP / thùng" value={String(pk.qty_per_carton)} />
            )}
            {pk.loading_40hc != null && (
              <Row label="Loading 40'HC" value={String(pk.loading_40hc)} />
            )}
          </div>
        </div>
      )}
      <Row
        label="Bản vẽ"
        value={
          product.drawing_url ? (
            <a
              href={product.drawing_url}
              target="_blank"
              rel="noopener"
              className="text-sky-600 underline"
            >
              Mở bản vẽ ↗
            </a>
          ) : (
            <span className="text-amber-600">Chưa có</span>
          )
        }
      />
      {product.bom_url && (
        <Row
          label="File BOM"
          value={
            <a
              href={product.bom_url}
              target="_blank"
              rel="noopener"
              className="text-sky-600 underline"
            >
              Mở file BOM ↗
            </a>
          }
        />
      )}
      <Row label="Trạng thái" value={product.is_active ? 'Đang dùng' : 'Ngừng sử dụng'} />
      {product.notes && (
        <div className="rounded-md bg-zinc-50 p-3 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="mb-1 text-xs font-semibold text-zinc-500 uppercase">
            Ghi chú
          </div>
          {product.notes}
        </div>
      )}
      {canEdit && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={onEdit}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sửa sản phẩm
          </button>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-xs font-medium text-zinc-500 uppercase">
        {label}
      </span>
      <span className="min-w-0 flex-1">{value}</span>
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────

function numOrUndef(v: FormDataEntryValue | null): number | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function ProductForm({
  initial,
  customers,
  submitLabel,
  onSubmit,
}: {
  initial?: Product
  customers: CustomerOption[]
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const packing: Packing = {
      l_cm: numOrUndef(fd.get('l_cm')),
      w_cm: numOrUndef(fd.get('w_cm')),
      h_cm: numOrUndef(fd.get('h_cm')),
      carton_l_cm: numOrUndef(fd.get('carton_l_cm')),
      carton_w_cm: numOrUndef(fd.get('carton_w_cm')),
      carton_h_cm: numOrUndef(fd.get('carton_h_cm')),
      qty_per_carton: numOrUndef(fd.get('qty_per_carton')),
      loading_40hc: numOrUndef(fd.get('loading_40hc')),
    }
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      category: String(fd.get('category') ?? '').trim() || null,
      customer_id: String(fd.get('customer_id') ?? '') || null,
      customer_item_code: String(fd.get('customer_item_code') ?? '').trim() || null,
      description_en: String(fd.get('description_en') ?? '').trim() || null,
      unit: String(fd.get('unit') ?? '').trim() || 'cai',
      packing,
      drawing_url: String(fd.get('drawing_url') ?? '').trim() || null,
      bom_url: String(fd.get('bom_url') ?? '').trim() || null,
      notes: String(fd.get('notes') ?? '').trim() || null,
    }
    if (initial) {
      body.bom_status = String(fd.get('bom_status') ?? initial.bom_status)
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  const pk = initial?.packing ?? {}

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã nội bộ <span className="text-red-500">*</span>
        <input
          name="code"
          required
          maxLength={100}
          defaultValue={initial?.code ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mã KH đặt (Customer Item)
        <input
          name="customer_item_code"
          maxLength={100}
          defaultValue={initial?.customer_item_code ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên SP <span className="text-red-500">*</span>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Khách hàng
        <select
          name="customer_id"
          defaultValue={initial?.customer_id ?? ''}
          className={cls}
        >
          <option value="">Mẫu chung (không gắn khách)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Danh mục
        <input
          name="category"
          maxLength={100}
          defaultValue={initial?.category ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ĐVT bán
        <input
          name="unit"
          maxLength={30}
          defaultValue={initial?.unit ?? 'cai'}
          className={cls}
        />
      </label>
      {initial && (
        <label className="flex flex-col gap-1 text-sm">
          Trạng thái BOM
          <select name="bom_status" defaultValue={initial.bom_status} className={cls}>
            <option value="none">Chưa có BOM</option>
            <option value="drawing">Đang vẽ</option>
            <option value="done">Đã vẽ</option>
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Mô tả tiếng Anh (in báo giá)
        <textarea
          name="description_en"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.description_en ?? ''}
          className={cls}
          placeholder="Materials: FSC eucalyptus wood with powder-coated aluminium frame…"
        />
      </label>

      <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-semibold text-zinc-500 uppercase">
          Đóng gói xuất khẩu (in báo giá / xếp cont)
        </legend>
        <label className="flex flex-col gap-1 text-xs">
          Dài (cm)
          <input
            name="l_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.l_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Rộng (cm)
          <input
            name="w_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.w_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Cao (cm)
          <input
            name="h_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.h_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          SP / thùng
          <input
            name="qty_per_carton"
            type="number"
            step="1"
            min="0"
            defaultValue={pk.qty_per_carton ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Carton dài (cm)
          <input
            name="carton_l_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.carton_l_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Carton rộng (cm)
          <input
            name="carton_w_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.carton_w_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Carton cao (cm)
          <input
            name="carton_h_cm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={pk.carton_h_cm ?? ''}
            className={cls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Loading 40&apos;HC
          <input
            name="loading_40hc"
            type="number"
            step="1"
            min="0"
            defaultValue={pk.loading_40hc ?? ''}
            className={cls}
          />
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Link bản vẽ
        <input
          name="drawing_url"
          type="url"
          placeholder="https://…"
          defaultValue={initial?.drawing_url ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link file BOM
        <input
          name="bom_url"
          type="url"
          placeholder="https://…"
          defaultValue={initial?.bom_url ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.notes ?? ''}
          className={cls}
        />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
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

// ── Clone form (FR-ENG-02) ───────────────────────────────────────────────

function CloneForm({
  source,
  customers,
  onSubmit,
}: {
  source: Product
  customers: CustomerOption[]
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim() || undefined,
      customer_id: String(fd.get('customer_id') ?? '') || null,
      customer_item_code: String(fd.get('customer_item_code') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Copy toàn bộ thuộc tính + BOM của <span className="font-mono">{source.code}</span>{' '}
        sang sản phẩm mới — dùng khi khách đặt lại mẫu cũ.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Mã SP mới <span className="text-red-500">*</span>
        <input name="code" required maxLength={100} className={`${cls} font-mono`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tên (bỏ trống = giữ tên gốc)
        <input name="name" maxLength={200} placeholder={source.name} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Gắn cho khách hàng
        <select
          name="customer_id"
          defaultValue={source.customer_id ?? ''}
          className={cls}
        >
          <option value="">Mẫu chung (không gắn khách)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mã KH đặt (Customer Item)
        <input name="customer_item_code" maxLength={100} className={`${cls} font-mono`} />
      </label>
      <div className="mt-1 flex justify-end">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang nhân bản…' : 'Nhân bản'}
        </button>
      </div>
    </form>
  )
}
