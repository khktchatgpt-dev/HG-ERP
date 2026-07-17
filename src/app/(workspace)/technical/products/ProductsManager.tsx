'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isSvgUrl } from '@/lib/image'
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
  pack_unit_label?: string
  nw_kg?: number
  gw_kg?: number
}

/** Thông số sản xuất (jsonb tech_spec) — in trên LSX. */
type TechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
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
  image_file_id: string | null
  notes: string | null
  name_foreign: string | null
  shipping_mark: string | null
  barcode: string | null
  showroom_sample: boolean
  reference_price: number | null
  tech_spec: TechSpec
  // Thông tin XK + đặc tính nội thất (0037).
  hs_code: string | null
  origin_country: string | null
  material: string | null
  max_load_kg: number | null
  assembly: 'assembled' | 'kd' | null
  set_contents: string | null
  is_active: boolean
}

/**
 * Dòng nhẹ cho thư viện (thẻ/bảng) — chỉ trường cần; full nạp khi mở form sửa.
 * `has_drawing` / `has_bom` suy từ FILE đã upload (doc_type), không phải link cũ.
 */
type ProductRow = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'category'
  | 'customer_id'
  | 'customer_item_code'
  | 'unit'
  | 'bom_status'
  | 'packing'
  | 'image_file_id'
  | 'is_active'
> & { has_drawing: boolean; has_bom: boolean }

type ProductCounts = {
  total: number
  active: number
  bom_none: number
  bom_drawing: number
  bom_done: number
}
type Filters = { q: string; customer: string; bom: string; status: string }

type CustomerOption = { id: string; name: string }
type MaterialOption = { id: string; code: string; name: string; unit: string }

/** SP tối thiểu để mở BOM editor (nhận cả ProductRow lẫn Product đầy đủ). */
type BomTarget = Pick<Product, 'id' | 'code' | 'name' | 'bom_status'>

/** Dòng BOM đang biên tập (id chỉ có với dòng đã lưu). */
type BomRow = { material_id: string; qty_per_unit: number | ''; note: string }

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
  total,
  page,
  pageSize,
  counts,
  filters,
  customers,
  materials,
  imageUrls,
  canEdit,
}: {
  products: ProductRow[]
  total: number
  page: number
  pageSize: number
  counts: ProductCounts
  filters: Filters
  customers: CustomerOption[]
  materials: MaterialOption[]
  imageUrls: Record<string, string>
  canEdit: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [cloning, setCloning] = useState<Product | null>(null)
  const [bomFor, setBomFor] = useState<{ product: BomTarget; rows: BomRow[] } | null>(
    null,
  )

  // Ô tìm (debounce) — đẩy xuống URL để SERVER lọc, không lọc toàn bộ ở client.
  const [q, setQ] = useState(filters.q)

  const customerName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of customers) m.set(c.id, c.name)
    return m
  }, [customers])

  // Đổi bộ lọc/trang → cập nhật query param → server refetch đúng 1 trang.
  const applyParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || v === 'all') next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page') // đổi lọc → về trang 1
      const qs = next.toString()
      router.push(qs ? `/technical/products?${qs}` : '/technical/products')
    },
    [router, sp],
  )

  useEffect(() => {
    if (q === filters.q) return
    const t = setTimeout(() => applyParams({ q: q.trim() || undefined }), 400)
    return () => clearTimeout(t)
  }, [q, filters.q, applyParams])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilter =
    !!filters.q ||
    filters.customer !== 'all' ||
    filters.bom !== 'all' ||
    filters.status !== 'all'

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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

  async function deleteProduct(p: ProductRow) {
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

  /** Nạp SP ĐẦY ĐỦ (GET) — list chỉ giữ bản nhẹ nên clone cần full trước khi mở. */
  async function fetchFull(id: string): Promise<Product | null> {
    try {
      const { product } = await api<{ product: Product }>(
        `/api/dept/technical/products/${id}`,
      )
      return product
    } catch (e) {
      toast.error('Không tải được sản phẩm', e instanceof ApiError ? e.message : 'Có lỗi')
      return null
    }
  }
  async function openClone(id: string) {
    setBusy(true)
    const p = await fetchFull(id)
    setBusy(false)
    if (p) setCloning(p)
  }

  /**
   * Mở BOM editor: nạp dòng hiện có rồi mới mở modal (tránh setState trong effect).
   * Chỉ cần id/code/name/bom_status → nhận được cả dòng nhẹ lẫn SP đầy đủ.
   */
  async function openBom(p: BomTarget) {
    setBusy(true)
    try {
      const data = await api<{
        lines: { material_id: string; qty_per_unit: number; note: string | null }[]
      }>(`/api/dept/technical/products/${p.id}/bom`)
      setBomFor({
        product: p,
        rows: data.lines.map((l) => ({
          material_id: l.material_id,
          qty_per_unit: l.qty_per_unit,
          note: l.note ?? '',
        })),
      })
    } catch (e) {
      toast.error('Không tải được BOM', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  // Deep-link từ trang chi tiết: ?edit / ?clone / ?openbom = <id> → nạp full rồi mở
  // modal (SP có thể không ở trang hiện tại nên GET theo id). Dùng 'openbom' KHÁC
  // tham số lọc 'bom' của thư viện để không đụng nhau.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const clone = sp.get('clone')
    const openbom = sp.get('openbom')
    if (canEdit && clone) void openClone(clone)
    else if (openbom) void fetchFull(openbom).then((p) => p && openBom(p))
    if (clone || openbom) {
      // Gỡ tham số deep-link nhưng GIỮ bộ lọc/trang.
      const next = new URLSearchParams(sp.toString())
      next.delete('clone')
      next.delete('openbom')
      const qs = next.toString()
      router.replace(qs ? `/technical/products?${qs}` : '/technical/products')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function exportCsv() {
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, products, [
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
    toast.success(`Đã xuất ${products.length} dòng (trang hiện tại) ra CSV`)
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (p) => p.code,
      cell: (p) => (
        <Link
          href={`/technical/products/${p.id}`}
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
        </Link>
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
          {p.has_drawing ? (
            <span className="text-emerald-600 dark:text-emerald-400">Bản vẽ ✓</span>
          ) : (
            <span className="text-amber-600">Thiếu BV</span>
          )}
          {p.has_bom && (
            <span className="text-emerald-600 dark:text-emerald-400">BOM ✓</span>
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
        const items: { label: string; onClick: () => void; danger?: boolean }[] = [
          {
            label: 'Xem chi tiết',
            onClick: () => router.push(`/technical/products/${p.id}`),
          },
          { label: 'BOM định mức', onClick: () => void openBom(p) },
        ]
        if (canEdit) {
          items.push(
            {
              label: 'Sửa',
              onClick: () => router.push(`/technical/products/${p.id}/edit`),
            },
            { label: 'Nhân bản mẫu', onClick: () => void openClone(p.id) },
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

  // Nhóm SP theo khách (thư viện tổ chức theo khách; "Mẫu chung" xếp cuối).
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: ProductRow[] }>()
    for (const p of products) {
      const key = p.customer_id ?? '__common'
      const name = p.customer_id ? (customerName.get(p.customer_id) ?? '?') : 'Mẫu chung'
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(p)
    }
    return [...map.values()].sort((a, b) => {
      if (a.name === 'Mẫu chung') return 1
      if (b.name === 'Mẫu chung') return -1
      return a.name.localeCompare(b.name)
    })
  }, [products, customerName])

  function dims(p: ProductRow) {
    const k = p.packing ?? {}
    return k.l_cm != null && k.w_cm != null && k.h_cm != null
      ? `${k.l_cm}×${k.w_cm}×${k.h_cm}`
      : null
  }

  function renderCard(p: ProductRow) {
    const img = imageUrls[p.id]
    const d = dims(p)
    const load = p.packing?.loading_40hc
    const menuItems: { label: string; onClick: () => void; danger?: boolean }[] = [
      {
        label: 'Xem chi tiết',
        onClick: () => router.push(`/technical/products/${p.id}`),
      },
      { label: 'BOM định mức', onClick: () => void openBom(p) },
    ]
    if (canEdit) {
      menuItems.push(
        {
          label: 'Sửa',
          onClick: () => router.push(`/technical/products/${p.id}/edit`),
        },
        { label: 'Nhân bản mẫu', onClick: () => void openClone(p.id) },
        { label: 'Xoá', onClick: () => void deleteProduct(p), danger: true },
      )
    }
    return (
      <div
        key={p.id}
        className={`relative overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 ${!p.is_active ? 'opacity-60' : ''}`}
      >
        <div className="absolute top-2 right-2 z-10">
          <RowMenu items={menuItems} />
        </div>
        <Link href={`/technical/products/${p.id}`} className="block">
          <div className="flex h-28 items-center justify-center border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            {img ? (
              <Image
                src={img}
                alt={p.name}
                width={160}
                height={112}
                unoptimized={isSvgUrl(img)}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-500">
                chưa có ảnh
              </span>
            )}
            <span className="absolute top-2 left-2">
              <Badge tone={BOM_TONE[p.bom_status]}>{BOM_LABEL[p.bom_status]}</Badge>
            </span>
          </div>
          <div className="p-2.5">
            <div className="truncate font-mono text-[11px] text-zinc-400">
              {p.code}
              {p.customer_item_code && ` · KH: ${p.customer_item_code}`}
            </div>
            <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
              {d && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  📐 {d}
                </span>
              )}
              {load != null && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  40HC {load}
                </span>
              )}
              {!p.has_drawing && <span className="text-amber-600">Thiếu BV</span>}
            </div>
          </div>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Thư viện sản phẩm' },
        ]}
        title="Thư viện sản phẩm"
        description={`${total} sản phẩm · trang ${page}/${totalPages} — tổ chức theo khách hàng, kèm cờ BOM.`}
        actions={
          <>
            <button onClick={exportCsv} className={btnSecondary}>
              Export CSV
            </button>
            {canEdit && (
              <Link href="/technical/products/new" className={btnPrimary}>
                + Thêm sản phẩm
              </Link>
            )}
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng SP', value: counts.total, tone: 'default' },
          { label: 'Đang dùng', value: counts.active, tone: 'green' },
          { label: 'BOM đã vẽ', value: counts.bom_done, tone: 'green' },
          {
            label: 'Đang vẽ',
            value: counts.bom_drawing,
            tone: counts.bom_drawing ? 'amber' : 'gray',
          },
          {
            label: 'Chưa có BOM',
            value: counts.bom_none,
            tone: counts.bom_none ? 'amber' : 'gray',
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
                value={filters.customer}
                onChange={(v) => applyParams({ customer: v })}
                options={customerOptions}
              />
              <ToolbarSelect
                value={filters.bom}
                onChange={(v) => applyParams({ bom: v })}
                options={bomOptions}
              />
              <ToolbarSelect
                value={filters.status}
                onChange={(v) => applyParams({ status: v })}
                options={statusOptions}
              />
              {(filters.q ||
                filters.customer !== 'all' ||
                filters.bom !== 'all' ||
                filters.status !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    applyParams({
                      q: undefined,
                      customer: undefined,
                      bom: undefined,
                      status: undefined,
                    })
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Xoá lọc
                </button>
              )}
            </>
          }
          right={
            <div className="flex items-center gap-2">
              {busy && (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Spinner size={12} /> Đang xử lý…
                </span>
              )}
              <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700">
                <button
                  onClick={() => setView('grid')}
                  aria-label="Xem lưới"
                  title="Lưới (thư viện)"
                  className={`px-2.5 py-1.5 text-sm ${view === 'grid' ? 'bg-sky-600 text-white' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                >
                  ▦
                </button>
                <button
                  onClick={() => setView('list')}
                  aria-label="Xem danh sách"
                  title="Danh sách (bảng)"
                  className={`border-l border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 ${view === 'list' ? 'bg-sky-600 text-white' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                >
                  ☰
                </button>
              </div>
            </div>
          }
        />

        {products.length === 0 ? (
          <EmptyState
            icon="◇"
            title={hasFilter ? 'Không khớp bộ lọc' : 'Thư viện sản phẩm trống'}
            description={
              hasFilter
                ? 'Thử điều chỉnh bộ lọc.'
                : canEdit
                  ? 'Thêm sản phẩm đầu tiên để khởi tạo thư viện.'
                  : 'Chưa có sản phẩm nào — liên hệ Kỹ thuật để bổ sung.'
            }
            action={
              canEdit && !hasFilter ? (
                <Link href="/technical/products/new" className={btnPrimary}>
                  + Thêm sản phẩm
                </Link>
              ) : undefined
            }
          />
        ) : view === 'list' ? (
          <DataTable<ProductRow>
            rows={products}
            columns={columns}
            storageKey="tech-products"
            rowClassName={(p) => (!p.is_active ? 'opacity-60' : '')}
          />
        ) : (
          <div className="mt-1 flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.name}>
                <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-zinc-400">· {g.items.length} SP</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => applyParams({ page: String(page - 1) })}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              ‹ Trước
            </button>
            <span className="text-zinc-500">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => applyParams({ page: String(page + 1) })}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Sau ›
            </button>
          </div>
        )}
      </div>

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

      {/* BOM editor (FR-ENG-04) */}
      <Modal
        open={!!bomFor}
        onClose={() => setBomFor(null)}
        title={bomFor ? `BOM — ${bomFor.product.code} · ${bomFor.product.name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {bomFor && (
          <BomEditor
            key={bomFor.product.id}
            initialRows={bomFor.rows}
            bomStatus={bomFor.product.bom_status}
            materials={materials}
            canEdit={canEdit}
            onSave={async (rows) => {
              const ok = await send(
                `/api/dept/technical/products/${bomFor.product.id}/bom`,
                'PUT',
                {
                  lines: rows.map((r) => ({
                    material_id: r.material_id,
                    qty_per_unit: r.qty_per_unit,
                    note: r.note.trim() || null,
                  })),
                },
              )
              if (ok) {
                setBomFor(null)
                toast.success('Đã lưu BOM', bomFor.product.name)
              }
            }}
          />
        )}
      </Modal>
    </div>
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

// ── BOM editor (FR-ENG-04) ───────────────────────────────────────────────

function BomEditor({
  initialRows,
  bomStatus,
  materials,
  canEdit,
  onSave,
}: {
  initialRows: BomRow[]
  bomStatus: BomStatus
  materials: MaterialOption[]
  canEdit: boolean
  onSave: (
    rows: { material_id: string; qty_per_unit: number; note: string }[],
  ) => Promise<void>
}) {
  const [rows, setRows] = useState<BomRow[]>(initialRows)
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  const materialById = useMemo(() => {
    const m = new Map<string, MaterialOption>()
    for (const mt of materials) m.set(mt.id, mt)
    return m
  }, [materials])

  const usedIds = new Set(rows.map((r) => r.material_id))
  const dup = rows.length !== usedIds.size

  function setRow(i: number, patch: Partial<BomRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function handleSave() {
    const clean = rows.filter((r) => r.material_id)
    if (clean.some((r) => r.qty_per_unit === '' || Number(r.qty_per_unit) <= 0)) {
      return // nút save đã disable, đây chỉ là chốt chặn
    }
    setBusy(true)
    await onSave(
      clean.map((r) => ({
        material_id: r.material_id,
        qty_per_unit: Number(r.qty_per_unit),
        note: r.note,
      })),
    )
    setBusy(false)
  }

  const invalid =
    dup ||
    rows.some(
      (r) => !r.material_id || r.qty_per_unit === '' || Number(r.qty_per_unit) <= 0,
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">
          Định mức vật tư cho <b>1 sản phẩm</b> — mã vật tư dùng chung với danh mục Kho.
        </span>
        <Badge tone={BOM_TONE[bomStatus]}>{BOM_LABEL[bomStatus]}</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Vật tư</th>
              <th className="w-28 py-2 pr-2">Định mức / SP</th>
              <th className="w-16 py-2 pr-2">ĐVT</th>
              <th className="py-2 pr-2">Ghi chú</th>
              {canEdit && <th className="w-10 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-400">
                  Chưa có dòng vật tư nào.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const mat = materialById.get(r.material_id)
              return (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <select
                        value={r.material_id}
                        onChange={(e) => setRow(i, { material_id: e.target.value })}
                        className={cls}
                      >
                        <option value="">— chọn vật tư —</option>
                        {materials.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            disabled={usedIds.has(m.id) && m.id !== r.material_id}
                          >
                            {m.code} — {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>
                        <span className="font-mono text-xs text-zinc-400">
                          {mat?.code}
                        </span>{' '}
                        {mat?.name ?? '?'}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={r.qty_per_unit}
                        onChange={(e) =>
                          setRow(i, {
                            qty_per_unit:
                              e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className={cls}
                      />
                    ) : (
                      String(r.qty_per_unit)
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-zinc-500">{mat?.unit ?? ''}</td>
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <input
                        value={r.note}
                        maxLength={500}
                        onChange={(e) => setRow(i, { note: e.target.value })}
                        className={cls}
                        placeholder="vd: chân trước, khung ngồi…"
                      />
                    ) : (
                      r.note || '—'
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label="Xoá dòng"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {dup && <p className="text-xs text-red-600">Có vật tư bị chọn trùng 2 dòng.</p>}

      {canEdit && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setRows((rs) => [...rs, { material_id: '', qty_per_unit: '', note: '' }])
            }
            className="rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + Thêm dòng vật tư
          </button>
          <button
            type="button"
            disabled={busy || invalid}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang lưu…' : 'Lưu BOM'}
          </button>
        </div>
      )}
    </div>
  )
}
