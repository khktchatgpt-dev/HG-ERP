'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
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
import {
  Field,
  FormSection,
  MaterialCoreFields,
  coreFromMaterial,
  useMaterialCore,
} from '@/components/warehouse/MaterialCoreFields'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { PAGE_SIZE } from './constants'

type Material = {
  id: string
  code: string
  name: string
  unit: string
  /** Mã vạch NCC (0078) — quét khớp cả code lẫn barcode. */
  barcode: string | null
  spec: string | null
  price_unit: string | null
  unit2_factor: number | null
  group_name: string | null
  /*
   * Trường PHÂN LOẠI + barem. Repo đã trả về từ lâu nhưng form danh mục không
   * hỏi, nên vật tư khai ở đây ra đời thiếu barem — không tính được tiền ở đơn
   * nhôm/inox. Nay khai chung một khối với form trong đơn đặt. (Mẫu đơn KHÔNG
   * gắn theo vật tư — bỏ 08/08/2026, mẫu là thuộc tính của đơn.)
   */
  sub_group: string | null
  kg_per_m: number | null
  default_bar_length_m: number | null
  /** kg mỗi đơn vị đặt (0112) — hàng tấm/cuộn khai thẳng, không suy theo mét. */
  kg_per_unit: number | null
  /*
   * Đóng gói mua + vật liệu (0124). PHẢI có mặt ở đây: form sửa nạp giá trị qua
   * `coreFromMaterial(initial)` — thiếu trường thì ô trống, và lượt LƯU kế tiếp
   * ghi null đè lên số đã khai (mất dữ liệu im lặng).
   */
  pack_size: number | null
  pack_unit: string | null
  material_grade: string | null
  min_stock: number
  /** Bù tồn (0079): trần tồn + ngưỡng/lô đặt lại — Kho quản. */
  max_stock: number | null
  reorder_point: number | null
  reorder_qty: number | null
  shelf_location: string | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  note: string | null
  is_active: boolean
}

type SupplierOption = { id: string; name: string }

type StatusFilter = 'all' | 'active' | 'inactive'

export function MaterialsManager({
  materials,
  suppliers,
  canEdit,
  counts,
  page,
  filters,
  taxonomy,
  scope = 'warehouse',
}: {
  materials: Material[]
  suppliers: SupplierOption[]
  canEdit: boolean
  /** Đếm ở DB theo bộ lọc — KHÔNG phải số dòng đang hiện trên trang. */
  counts: { total: number; active: number; noShelf: number }
  page: number
  filters: { q: string; group: string }
  /**
   * ĐVT + nhóm + nhóm phụ chuẩn, nạp sẵn ở server (trang đã gọi `materialTaxonomy`
   * cho bộ lọc rồi). Đưa cả cụm xuống thì form khai vật tư khỏi gọi lại API.
   */
  taxonomy: MaterialTaxonomy
  /**
   * Chia chủ quyền danh mục (1 danh mục chung): 'warehouse' = Kho sửa đủ trường;
   * 'purchasing' = view cho Cung ứng (/planning/materials) — trường tồn trữ
   * (min/max, kệ, barcode, ngừng dùng/xoá) khoá lại, server cũng enforce.
   */
  scope?: 'warehouse' | 'purchasing'
}) {
  const purchasing = scope === 'purchasing'
  const groups = useMemo(() => taxonomy.groups.map((g) => g.name), [taxonomy])
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  const sp = useSearchParams()
  const [navigating, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q)

  /*
   * BỘ LỌC ĐẨY XUỐNG URL để SERVER lọc lại.
   *
   * Bản cũ lọc trong mảng đã nạp — mà trang chỉ nạp 1.000 dòng đầu trong khi
   * danh mục có 12.991. Gõ "Thép hộp mạ kẽm" ra "Không khớp bộ lọc" dù mã có
   * thật, chỉ vì nó nằm ngoài 1.000 mã đầu theo thứ tự chữ cái.
   */
  const pushFilter = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page') // đổi lọc → về trang 1
      const qs = next.toString()
      // replace: lọc không phải "đi tới trang khác"; push vào lịch sử chỉ khiến
      // nút Back phải bấm hàng chục lần mới thoát khỏi danh sách.
      startTransition(() => router.replace(qs ? `?${qs}` : '?'))
    },
    [router, sp],
  )

  /** Trạng thái lọc ở client — server chưa nhận tham số này, giữ trong trang. */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const filtered = useMemo(
    () =>
      materials.filter((m) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? m.is_active
            : !m.is_active,
      ),
    [materials, statusFilter],
  )
  const stats = { active: counts.active, noShelf: counts.noShelf }

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

  async function deleteMaterial(m: Material) {
    const ok = await confirm({
      title: `Xoá vật tư "${m.name}"?`,
      description: 'Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/dept/warehouse/materials/${m.id}`, 'DELETE')
    if (ok2) toast.success('Đã xoá', m.name)
  }

  function exportCsv() {
    downloadCsv(`vat-tu-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'code', header: 'Mã' },
      { key: 'name', header: 'Tên' },
      { key: 'spec', header: 'Quy cách', get: (m) => m.spec ?? '' },
      { key: 'barcode', header: 'Mã vạch', get: (m) => m.barcode ?? '' },
      { key: 'unit', header: 'ĐVT' },
      {
        key: 'price_unit',
        header: 'Đơn vị tính giá',
        get: (m) => m.price_unit ?? '',
      },
      { key: 'group_name', header: 'Nhóm', get: (m) => m.group_name ?? '' },
      { key: 'min_stock', header: 'Tồn tối thiểu', get: (m) => String(m.min_stock) },
      { key: 'shelf_location', header: 'Vị trí kệ', get: (m) => m.shelf_location ?? '' },
      {
        key: 'is_active',
        header: 'Trạng thái',
        get: (m) => (m.is_active ? 'Đang dùng' : 'Ngừng'),
      },
      { key: 'note', header: 'Ghi chú', get: (m) => m.note ?? '' },
    ])
    // Chỉ TRANG ĐANG XEM. Xuất cả 13k dòng là kéo về client một lượt — nếu
    // cần cả danh mục thì làm export ở server, đừng làm im lặng ở đây.
    toast.success(
      `Đã xuất ${filtered.length} dòng CSV`,
      counts.total > filtered.length
        ? `Chỉ trang đang xem — bộ lọc đang khớp ${counts.total.toLocaleString('vi-VN')} dòng`
        : undefined,
    )
  }

  const columns: Column<Material>[] = [
    {
      key: 'code',
      header: 'Mã / Tên',
      sortValue: (m) => m.code,
      cell: (m) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-xs text-zinc-400">{m.code}</span>
          <span className="truncate font-medium">{m.name}</span>
        </div>
      ),
    },
    {
      key: 'price_unit',
      header: 'Đơn vị tính giá',
      width: '150px',
      sortValue: (m) => m.price_unit ?? 'zzz',
      cell: (m) =>
        m.price_unit ? (
          <div className="flex flex-col gap-0.5">
            <Badge>giá/{m.price_unit}</Badge>
            {m.unit2_factor != null && (
              <span
                className="text-[10px] text-zinc-400"
                title={`Hệ số tham khảo ${m.unit2_factor} ${m.price_unit}/${m.unit}`}
              >
                {m.unit2_factor} {m.price_unit}/{m.unit}
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'unit',
      header: 'ĐVT',
      width: '90px',
      sortValue: (m) => m.unit,
      cell: (m) => <span className="text-zinc-600 dark:text-zinc-300">{m.unit}</span>,
    },
    {
      key: 'group_name',
      header: 'Nhóm',
      width: '160px',
      sortValue: (m) => m.group_name ?? 'zzz',
      cell: (m) =>
        m.group_name ? (
          <Badge>{m.group_name}</Badge>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: 'min_stock',
      header: 'Tồn tối thiểu',
      width: '120px',
      align: 'right',
      sortValue: (m) => m.min_stock,
      cell: (m) => <span className="tabular-nums">{m.min_stock}</span>,
    },
    {
      key: 'shelf_location',
      header: 'Vị trí kệ',
      width: '110px',
      sortValue: (m) => m.shelf_location ?? 'zzz',
      cell: (m) =>
        m.shelf_location ? (
          <span className="font-mono text-xs">{m.shelf_location}</span>
        ) : (
          <span className="text-amber-600">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      sortValue: (m) => (m.is_active ? 0 : 1),
      cell: (m) =>
        m.is_active ? (
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
      cell: (m) => {
        if (!canEdit) return null
        // Cung ứng: chỉ sửa trường mua hàng — ngừng dùng/xoá là việc của Kho.
        if (purchasing) {
          return <RowMenu items={[{ label: 'Sửa', onClick: () => setEditing(m) }]} />
        }
        return (
          <RowMenu
            items={[
              { label: 'Sửa', onClick: () => setEditing(m) },
              {
                label: m.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại',
                onClick: () =>
                  send(`/api/dept/warehouse/materials/${m.id}`, 'PATCH', {
                    is_active: !m.is_active,
                  }),
              },
              { label: 'Xoá', onClick: () => deleteMaterial(m), danger: true },
            ]}
          />
        )
      },
    },
  ]

  const groupOptions = [
    { value: '', label: 'Mọi nhóm' },
    ...groups.map((g) => ({ value: g, label: g })),
  ]
  const statusOptions = [
    { value: 'all' as const, label: 'Mọi trạng thái' },
    { value: 'active' as const, label: 'Đang dùng' },
    { value: 'inactive' as const, label: 'Ngừng' },
  ]

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'
  const btnPrimary =
    'rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={
          purchasing
            ? [
                { label: 'Kế hoạch - Cung ứng', href: '/planning' },
                { label: 'Vật tư & giá mua' },
              ]
            : [{ label: 'Kho', href: '/warehouse' }, { label: 'Danh mục vật tư' }]
        }
        title={purchasing ? 'Vật tư & giá mua' : 'Danh mục vật tư'}
        description={
          purchasing
            ? `${counts.total.toLocaleString('vi-VN')} vật tư khớp lọc (danh mục dùng chung với Kho). Cung ứng sửa trường mua hàng: NCC mặc định, VAT, loại quy đổi giá… Tồn tối thiểu/kệ/barcode do Kho quản.`
            : `${counts.total.toLocaleString('vi-VN')} vật tư khớp lọc. Mã, ĐVT, nhóm, tồn tối thiểu, vị trí kệ.`
        }
        actions={
          <>
            <button onClick={exportCsv} className={btnSecondary}>
              Export CSV
            </button>
            {canEdit && (
              <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                + Thêm vật tư
              </button>
            )}
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Khớp lọc', value: counts.total, tone: 'default' },
          { label: 'Đang dùng', value: stats.active, tone: 'green' },
          { label: 'Nhóm', value: groups.length, tone: 'blue' },
          {
            label: 'Chưa gán kệ',
            value: stats.noShelf,
            tone: stats.noShelf ? 'amber' : 'gray',
          },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              {/* Enter mới tìm, không tìm theo từng phím: mỗi lượt là một vòng
                  server + đếm lại trên 13k dòng. */}
              <ToolbarInput
                value={q}
                onChange={setQ}
                onEnter={() => pushFilter({ q })}
                placeholder="Tìm mã, tên, mã vạch… (Enter)"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={filters.group}
                onChange={(v) => pushFilter({ group: v })}
                options={groupOptions}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              {(filters.q || filters.group || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    setStatusFilter('all')
                    pushFilter({ q: '', group: '' })
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

        <DataTable<Material>
          rows={filtered}
          columns={columns}
          storageKey="warehouse-materials"
          rowClassName={(m) => (!m.is_active ? 'opacity-60' : '')}
          emptyState={
            <EmptyState
              icon="▤"
              title={
                materials.length === 0 ? 'Danh mục vật tư trống' : 'Không khớp bộ lọc'
              }
              description={
                materials.length === 0
                  ? canEdit
                    ? 'Thêm vật tư đầu tiên để khởi tạo danh mục.'
                    : 'Chưa có vật tư nào — liên hệ Kho để bổ sung.'
                  : 'Thử điều chỉnh bộ lọc.'
              }
              action={
                canEdit && materials.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Thêm vật tư
                  </button>
                ) : undefined
              }
            />
          }
        />

        {/* Phân trang — trang này từng nạp cứng 1.000 dòng đầu và im lặng cắt
            phần còn lại; giờ nói rõ đang ở đâu trong bao nhiêu. */}
        {counts.total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            <span>
              {((page - 1) * PAGE_SIZE + 1).toLocaleString('vi-VN')}–
              {Math.min(page * PAGE_SIZE, counts.total).toLocaleString('vi-VN')} trên{' '}
              <b className="text-zinc-700 dark:text-zinc-200">
                {counts.total.toLocaleString('vi-VN')}
              </b>
            </span>
            <span className="flex items-center gap-2">
              {navigating && <Spinner size={12} />}
              <button
                disabled={page <= 1 || navigating}
                onClick={() => pushFilter({ page: String(page - 1) })}
                className="rounded border border-zinc-300 px-2 py-0.5 disabled:opacity-40 dark:border-zinc-700"
              >
                ← Trước
              </button>
              <span>
                trang {page} / {Math.max(1, Math.ceil(counts.total / PAGE_SIZE))}
              </span>
              <button
                disabled={page * PAGE_SIZE >= counts.total || navigating}
                onClick={() => pushFilter({ page: String(page + 1) })}
                className="rounded border border-zinc-300 px-2 py-0.5 disabled:opacity-40 dark:border-zinc-700"
              >
                Sau →
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Form dài (tới 4 mảng) — modal rộng hơn mặc định để hai cột còn thở
          được, và `Modal` nay tự cuộn phần thân nên không tràn ra ngoài màn. */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm vật tư"
        maxWidth="sm:max-w-3xl"
      >
        <MaterialForm
          suppliers={suppliers}
          scope={scope}
          taxonomy={taxonomy}
          shelfOptions={materials}
          submitLabel="Thêm vật tư"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/warehouse/materials', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã thêm vật tư', String(body.name))
            }
          }}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
        maxWidth="sm:max-w-3xl"
      >
        {editing && (
          <MaterialForm
            suppliers={suppliers}
            scope={scope}
            taxonomy={taxonomy}
            shelfOptions={materials}
            initial={editing}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/warehouse/materials/${editing.id}`,
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

// ── Form ─────────────────────────────────────────────────────────────────

/**
 * KHAI VẬT TƯ Ở DANH MỤC — bốn mảng theo đúng thứ tự người khai nghĩ:
 * vật tư này là gì (Nhận dạng) → xếp vào đâu, tính tiền kiểu nào (Phân loại) →
 * NCC báo giá ra sao → Kho giữ bao nhiêu (Tồn trữ).
 *
 * Ba mảng đầu là `MaterialCoreFields`, DÙNG CHUNG với form thêm nhanh trong đơn
 * đặt. Trước đây hai chỗ hỏi lệch nhau: ở đây nhóm là ô GÕ TAY và không có ô
 * nhóm phụ / mẫu đơn / kg/m, nên vật tư khai từ danh mục ra đời thiếu mẫu và
 * barem — đơn nhôm/inox không tính được tiền cho nó.
 *
 * Cung ứng (`scope='purchasing'`) KHÔNG thấy mảng Tồn trữ và ô mã vạch. Bản cũ
 * vẫn vẽ ra rồi `disabled`: mười ô xám nằm giữa form, kéo dài thêm cái hộp vốn
 * đã cao 1234px trên màn 768px, mà bấm vào cũng không được gì.
 */
function MaterialForm({
  initial,
  suppliers,
  submitLabel,
  onSubmit,
  scope = 'warehouse',
  taxonomy,
  shelfOptions = [],
}: {
  initial?: Partial<Material>
  suppliers: SupplierOption[]
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
  scope?: 'warehouse' | 'purchasing'
  taxonomy: MaterialTaxonomy
  /** Dòng đang xem — chỉ để gợi ý lại các vị trí kệ đã dùng. */
  shelfOptions?: Pick<Material, 'shelf_location'>[]
}) {
  const purchasing = scope === 'purchasing'
  const [busy, setBusy] = useState(false)
  const core = useMaterialCore({
    active: true,
    initial: initial ? coreFromMaterial(initial) : undefined,
    taxonomy,
    excludeCode: initial?.code,
  })

  // Các kệ đã dùng → gợi ý để chọn lại, tránh gõ lệch tách một kệ làm nhiều.
  const shelves = useMemo(() => {
    const set = new Set<string>()
    for (const m of shelfOptions) if (m.shelf_location) set.add(m.shelf_location)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [shelfOptions])

  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (core.invalid || busy) return
    const fd = new FormData(e.currentTarget)
    // Ô số để trống → null, không phải 0.
    const numOrNull = (k: string) => {
      const v = fd.get(k)
      return v != null && String(v).trim() !== '' ? Number(v) : null
    }
    const body: Record<string, unknown> = {
      // Nhận dạng + phân loại + cách báo giá — chung với form trong đơn đặt.
      ...core.corePayload(),
      code: String(fd.get('code') ?? '').trim() || null,
      default_supplier_id: String(fd.get('default_supplier_id') ?? '') || null,
      vat_rate: numOrNull('vat_rate'),
      last_purchase_price: numOrNull('last_purchase_price'),
      note: String(fd.get('note') ?? '').trim() || null,
    }
    // Trường tồn trữ là của Kho — Cung ứng không gửi lên (server cũng chặn).
    if (!purchasing) {
      body.barcode = String(fd.get('barcode') ?? '').trim() || null
      body.min_stock = Number(fd.get('min_stock') ?? 0) || 0
      body.max_stock = numOrNull('max_stock')
      body.reorder_point = numOrNull('reorder_point')
      body.reorder_qty = numOrNull('reorder_qty')
      body.shelf_location = String(fd.get('shelf_location') ?? '').trim() || null
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <MaterialCoreFields
        s={core}
        inputClass={cls}
        unitListId="mat-dvt"
        subListId="mat-nhom-phu"
        /* Chỉ danh mục mới hỏi "NCC báo giá theo đơn vị nào" — form trong đơn đặt
           tắt đi, lý do ở khai báo `pricingNote`. */
        pricingNote
      />

      <FormSection title="Mua hàng" hint="tự điền lên đơn đặt">
        <Field label="NCC mặc định">
          <select
            name="default_supplier_id"
            defaultValue={initial?.default_supplier_id ?? ''}
            className={cls}
          >
            <option value="">— không —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="VAT mặc định (%)">
          <input
            name="vat_rate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            placeholder="VD: 10"
            defaultValue={initial?.vat_rate ?? ''}
            className={`${cls} tabular-nums`}
          />
        </Field>
        <Field label="Đơn giá tham chiếu" hint="Prefill đơn giá khi lên đơn đặt.">
          <input
            name="last_purchase_price"
            type="number"
            min={0}
            step="1"
            placeholder={core.dual ? `đ / ${core.f.price_unit}` : 'đ / đơn vị đặt'}
            defaultValue={initial?.last_purchase_price ?? ''}
            className={`${cls} tabular-nums`}
          />
        </Field>
        <Field
          label="Mã vật tư"
          hint={
            initial ? undefined : 'Bỏ trống là an toàn — server cấp mã nối tiếp của nhóm.'
          }
        >
          {/* Kho vẫn gõ tay được khi cần bám mã cũ; bỏ trống thì server cấp
              `XX-0000` nối tiếp tiền tố mà nhóm đó đang dùng. */}
          <input
            name="code"
            maxLength={60}
            defaultValue={initial?.code ?? ''}
            placeholder={initial ? '' : 'để trống → tự cấp theo nhóm'}
            className={`${cls} font-mono`}
          />
        </Field>
      </FormSection>

      {purchasing ? (
        <p className="text-xs text-zinc-400">
          Tồn tối thiểu, ngưỡng bù tồn, vị trí kệ và mã vạch do Kho quản — sửa ở
          <b> Kho › Danh mục vật tư</b>.
        </p>
      ) : (
        <FormSection title="Tồn trữ" hint="Kho quản — nuôi gợi ý mua bù ngoài LSX">
          <Field label="Tồn tối thiểu">
            <input
              name="min_stock"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial?.min_stock ?? 0}
              className={`${cls} tabular-nums`}
            />
          </Field>
          <Field
            label="Vị trí kệ"
            hint={
              shelves.length > 0
                ? 'Gõ để chọn lại kệ đã có — tránh tạo trùng do gõ lệch.'
                : undefined
            }
          >
            <input
              name="shelf_location"
              list="material-shelf-options"
              maxLength={60}
              placeholder="VD: A-01"
              defaultValue={initial?.shelf_location ?? ''}
              className={cls}
            />
            <datalist id="material-shelf-options">
              {shelves.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field
            label="Ngưỡng đặt lại"
            hint="Khả dụng + đang về tụt dưới mức này → gợi ý mua bù (PO ngoài LSX)."
          >
            <input
              name="reorder_point"
              type="number"
              min={0}
              step="0.01"
              placeholder="bỏ trống = dùng tồn tối thiểu"
              defaultValue={initial?.reorder_point ?? ''}
              className={`${cls} tabular-nums`}
            />
          </Field>
          <Field
            label="Lô đặt lại / Tồn tối đa"
            hint="Có lô → mỗi lần gợi ý đúng lô; không thì bù tới trần tồn."
          >
            <span className="flex gap-2">
              <input
                name="reorder_qty"
                type="number"
                min={0}
                step="0.01"
                placeholder="SL mỗi lần mua"
                defaultValue={initial?.reorder_qty ?? ''}
                className={`${cls} tabular-nums`}
              />
              <input
                name="max_stock"
                type="number"
                min={0}
                step="0.01"
                placeholder="trần tồn"
                defaultValue={initial?.max_stock ?? ''}
                className={`${cls} tabular-nums`}
              />
            </span>
          </Field>
          <Field
            label="Mã vạch (barcode NCC)"
            span
            hint="Ô quét ở phiếu nhập/xuất khớp cả mã vật tư lẫn mã vạch này. Không in tem."
          >
            <input
              name="barcode"
              maxLength={64}
              placeholder="Quét mã có sẵn trên bao bì NCC vào đây (nếu có)…"
              defaultValue={initial?.barcode ?? ''}
              className={`${cls} font-mono`}
            />
          </Field>
        </FormSection>
      )}

      <Field label="Ghi chú">
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </Field>

      {/* Nút lưu ghim đáy hộp thoại: form bốn mảng dài hơn một màn, cuộn tới
          cuối mới thấy nút là bắt người khai đi tìm. */}
      <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-end gap-3 border-t border-zinc-100 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        {core.invalid && (
          <span className="mr-auto text-xs text-amber-600 dark:text-amber-500">
            Cần tên vật tư và ĐVT.
          </span>
        )}
        <button
          disabled={busy || core.invalid}
          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
