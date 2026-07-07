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

type CatalogType =
  'unit' | 'material_group' | 'product_category' | 'production_stage' | 'contract_type'

type Item = {
  id: string
  type: CatalogType
  code: string
  label: string
  sort_order: number
  is_active: boolean
}

const TYPE_LABEL: Record<CatalogType, string> = {
  unit: 'Đơn vị tính',
  material_group: 'Nhóm vật tư',
  product_category: 'Danh mục sản phẩm',
  production_stage: 'Giai đoạn sản xuất',
  contract_type: 'Loại hợp đồng',
}

const inputCls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function CatalogsManager({ items }: { items: Item[] }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CatalogType>('all')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter((it) => {
      if (typeFilter !== 'all' && it.type !== typeFilter) return false
      if (ql && !`${it.code} ${it.label}`.toLowerCase().includes(ql)) return false
      return true
    })
  }, [items, q, typeFilter])

  const countByType = useMemo(() => {
    const m = new Map<CatalogType, number>()
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1)
    return m
  }, [items])

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

  const columns: Column<Item>[] = [
    {
      key: 'type',
      header: 'Loại danh mục',
      sortValue: (it) => it.type,
      width: '170px',
      cell: (it) => <Badge>{TYPE_LABEL[it.type]}</Badge>,
    },
    {
      key: 'code',
      header: 'Code',
      sortValue: (it) => it.code,
      width: '150px',
      cell: (it) => <span className="font-mono text-xs">{it.code}</span>,
    },
    {
      key: 'label',
      header: 'Tên hiển thị',
      sortValue: (it) => it.label,
      cell: (it) => it.label,
    },
    {
      key: 'sort',
      header: 'Thứ tự',
      sortValue: (it) => it.sort_order,
      width: '80px',
      align: 'right',
      cell: (it) => it.sort_order,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      cell: (it) =>
        it.is_active ? (
          <Badge tone="green">Đang dùng</Badge>
        ) : (
          <Badge tone="gray">Ẩn</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (it) => (
        <RowMenu
          items={[
            { label: 'Sửa tên / thứ tự', onClick: () => setEditing(it) },
            {
              label: it.is_active ? 'Ẩn (ngừng dùng)' : 'Hiện lại',
              onClick: () =>
                void send(`/api/admin/catalogs/${it.id}`, 'PATCH', {
                  is_active: !it.is_active,
                }),
            },
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
          { label: 'Quản trị', href: '/admin' },
          { label: 'Danh mục dùng chung' },
        ]}
        title="Danh mục dùng chung"
        description="ĐVT, nhóm vật tư, giai đoạn SX, loại hợp đồng (FR-ADM-04). Code bất biến sau khi dùng — dữ liệu nghiệp vụ tham chiếu bằng code."
        actions={
          <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
            + Thêm mục
          </button>
        }
      />

      <StatsBar
        stats={(Object.keys(TYPE_LABEL) as CatalogType[]).map((t) => ({
          label: TYPE_LABEL[t],
          value: countByType.get(t) ?? 0,
          tone: (countByType.get(t) ?? 0) > 0 ? ('default' as const) : ('gray' as const),
        }))}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm code, tên…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
                options={[
                  { value: 'all' as const, label: 'Mọi loại' },
                  ...(Object.keys(TYPE_LABEL) as CatalogType[]).map((t) => ({
                    value: t,
                    label: TYPE_LABEL[t],
                  })),
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

        <DataTable<Item>
          rows={filtered}
          columns={columns}
          storageKey="admin-catalogs"
          rowClassName={(it) => (!it.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState icon="▤" title="Không có mục nào" description="Thử đổi bộ lọc." />
          }
        />
      </div>

      {/* Thêm */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm mục danh mục"
      >
        <CatalogForm
          onSubmit={async (body) => {
            const ok = await send('/api/admin/catalogs', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm', String(body.label))
            }
          }}
        />
      </Modal>

      {/* Sửa (label/sort) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.code}` : ''}
      >
        {editing && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const ok = await send(`/api/admin/catalogs/${editing.id}`, 'PATCH', {
                label: String(fd.get('label') ?? '').trim(),
                sort_order: Number(fd.get('sort_order') ?? 0),
              })
              if (ok) {
                setEditing(null)
                toast.success('Đã cập nhật', editing.code)
              }
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs text-zinc-500">
              Loại: <b>{TYPE_LABEL[editing.type]}</b> · Code:{' '}
              <span className="font-mono">{editing.code}</span> (bất biến)
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Tên hiển thị <span className="text-red-500">*</span>
              <input
                name="label"
                required
                maxLength={100}
                defaultValue={editing.label}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Thứ tự
              <input
                name="sort_order"
                type="number"
                min="0"
                defaultValue={editing.sort_order}
                className={inputCls}
              />
            </label>
            <div className="flex justify-end">
              <button className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
                Lưu
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function CatalogForm({
  onSubmit,
}: {
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    await onSubmit({
      type: String(fd.get('type') ?? 'unit'),
      code: String(fd.get('code') ?? '').trim(),
      label: String(fd.get('label') ?? '').trim(),
      sort_order: Number(fd.get('sort_order') ?? 0),
    })
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Loại danh mục <span className="text-red-500">*</span>
        <select name="type" required className={inputCls}>
          {(Object.keys(TYPE_LABEL) as CatalogType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Code <span className="text-red-500">*</span>
        <input
          name="code"
          required
          maxLength={50}
          pattern="[a-z0-9_-]+"
          placeholder="vd: hoan_thien, m2, nhom"
          className={`${inputCls} font-mono`}
        />
        <span className="text-xs text-zinc-500">
          Chữ thường/số/gạch. Bất biến sau khi dùng — nghiệp vụ tham chiếu bằng code.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tên hiển thị <span className="text-red-500">*</span>
        <input
          name="label"
          required
          maxLength={100}
          placeholder="vd: Hoàn thiện"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Thứ tự
        <input
          name="sort_order"
          type="number"
          min="0"
          defaultValue={0}
          className={inputCls}
        />
      </label>
      <div className="flex justify-end">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : 'Thêm mục'}
        </button>
      </div>
    </form>
  )
}
