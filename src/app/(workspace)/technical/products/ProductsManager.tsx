'use client'

import { useEffect, useMemo, useState } from 'react'
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

type Product = {
  id: string
  code: string
  name: string
  category: string | null
  drawing_url: string | null
  bom_url: string | null
  notes: string | null
  is_active: boolean
}

type StatusFilter = 'all' | 'active' | 'inactive'

export function ProductsManager({
  products,
  canEdit,
}: {
  products: Product[]
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)

  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    if (canEdit && sp.get('new') === '1') setOpenCreate(true)
  }, [sp, canEdit])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.category) set.add(p.category)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [products])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return products.filter((p) => {
      if (catFilter !== 'all' && (p.category ?? '') !== catFilter) return false
      if (statusFilter === 'active' && !p.is_active) return false
      if (statusFilter === 'inactive' && p.is_active) return false
      if (ql) {
        const hay = `${p.code} ${p.name} ${p.category ?? ''}`.toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
  }, [products, q, catFilter, statusFilter])

  const stats = useMemo(() => {
    let active = 0
    let noDrawing = 0
    let noBom = 0
    for (const p of products) {
      if (p.is_active) active++
      if (!p.drawing_url) noDrawing++
      if (!p.bom_url) noBom++
    }
    return { active, noDrawing, noBom }
  }, [products])

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<boolean> {
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
      description: 'Hành động không thể hoàn tác.',
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
      { key: 'name', header: 'Tên' },
      { key: 'category', header: 'Danh mục' },
      { key: 'drawing_url', header: 'Bản vẽ', get: (p) => p.drawing_url ?? '' },
      { key: 'bom_url', header: 'BOM', get: (p) => p.bom_url ?? '' },
      { key: 'is_active', header: 'Trạng thái', get: (p) => (p.is_active ? 'Đang dùng' : 'Ngừng') },
      { key: 'notes', header: 'Ghi chú' },
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
          <span className="font-mono text-xs text-zinc-400">{p.code}</span>
          <span className="truncate font-medium">{p.name}</span>
        </button>
      ),
    },
    {
      key: 'category',
      header: 'Danh mục',
      sortValue: (p) => p.category ?? 'zzz',
      width: '160px',
      cell: (p) =>
        p.category ? <Badge>{p.category}</Badge> : <span className="text-zinc-400">—</span>,
    },
    {
      key: 'docs',
      header: 'Tài liệu',
      width: '160px',
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
          {p.bom_url ? (
            <a
              href={p.bom_url}
              target="_blank"
              rel="noopener"
              className="text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
              onClick={(e) => e.stopPropagation()}
            >
              BOM
            </a>
          ) : (
            <span className="text-amber-600">Thiếu BOM</span>
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
        p.is_active ? <Badge tone="green">Đang dùng</Badge> : <Badge tone="gray">Ngừng</Badge>,
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

  const catOptions = [
    { value: 'all', label: 'Mọi danh mục' },
    ...categories.map((c) => ({ value: c, label: c })),
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
        description={`${filtered.length} / ${products.length} sản phẩm. Mã, bản vẽ và định mức vật tư.`}
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
          { label: 'Danh mục', value: categories.length, tone: 'blue' },
          { label: 'Thiếu bản vẽ', value: stats.noDrawing, tone: stats.noDrawing ? 'amber' : 'gray' },
          { label: 'Thiếu BOM', value: stats.noBom, tone: stats.noBom ? 'amber' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm theo mã, tên, danh mục…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect value={catFilter} onChange={setCatFilter} options={catOptions} />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              {(q || catFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    setCatFilter('all')
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
              title={products.length === 0 ? 'Thư viện sản phẩm trống' : 'Không khớp bộ lọc'}
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
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Thêm sản phẩm">
        <ProductForm
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
      >
        {editing && (
          <ProductForm
            initial={editing}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(`/api/dept/technical/products/${editing.id}`, 'PATCH', body)
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', String(body.name))
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
      >
        {viewing && <ProductDetail product={viewing} canEdit={canEdit} onEdit={() => { setEditing(viewing); setViewing(null) }} />}
      </Modal>
    </div>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────

function ProductDetail({
  product,
  canEdit,
  onEdit,
}: {
  product: Product
  canEdit: boolean
  onEdit: () => void
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Row label="Mã sản phẩm" value={<span className="font-mono">{product.code}</span>} />
      <Row label="Tên" value={product.name} />
      <Row label="Danh mục" value={product.category ?? '—'} />
      <Row
        label="Bản vẽ"
        value={
          product.drawing_url ? (
            <a href={product.drawing_url} target="_blank" rel="noopener" className="text-sky-600 underline">
              Mở bản vẽ ↗
            </a>
          ) : (
            <span className="text-amber-600">Chưa có</span>
          )
        }
      />
      <Row
        label="BOM"
        value={
          product.bom_url ? (
            <a href={product.bom_url} target="_blank" rel="noopener" className="text-sky-600 underline">
              Mở BOM ↗
            </a>
          ) : (
            <span className="text-amber-600">Chưa có</span>
          )
        }
      />
      <Row
        label="Trạng thái"
        value={product.is_active ? 'Đang dùng' : 'Ngừng sử dụng'}
      />
      {product.notes && (
        <div className="rounded-md bg-zinc-50 p-3 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">Ghi chú</div>
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
      <span className="w-28 shrink-0 text-xs font-medium uppercase text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
    </div>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────

function ProductForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<Product>
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
      code: String(fd.get('code') ?? '').trim(),
      name: String(fd.get('name') ?? '').trim(),
      category: String(fd.get('category') ?? '').trim() || null,
      drawing_url: String(fd.get('drawing_url') ?? '').trim() || null,
      bom_url: String(fd.get('bom_url') ?? '').trim() || null,
      notes: String(fd.get('notes') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã SP <span className="text-red-500">*</span>
        <input name="code" required maxLength={100} defaultValue={initial?.code ?? ''} className={`${cls} font-mono`} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Danh mục
        <input name="category" maxLength={100} defaultValue={initial?.category ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên SP <span className="text-red-500">*</span>
        <input name="name" required maxLength={200} defaultValue={initial?.name ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link bản vẽ
        <input name="drawing_url" type="url" placeholder="https://…" defaultValue={initial?.drawing_url ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Link BOM
        <input name="bom_url" type="url" placeholder="https://…" defaultValue={initial?.bom_url ?? ''} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="notes" rows={3} maxLength={2000} defaultValue={initial?.notes ?? ''} className={cls} />
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
