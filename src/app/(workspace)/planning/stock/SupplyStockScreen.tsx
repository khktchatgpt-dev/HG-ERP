'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarClock, PackageSearch, Search, Truck, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import type {
  SupplyStockCounts,
  SupplyStockFilter,
  SupplyStockRow,
} from '@/modules/dept/supply/supply-stock.service'

const TABS: { value: SupplyStockFilter; label: string; hint: string }[] = [
  {
    value: 'incoming',
    label: 'Đang có đơn về',
    hint: 'Vật tư đã đặt còn phải về — nhìn trước khi định mua thêm',
  },
  { value: 'in_stock', label: 'Đang có tồn', hint: 'Tồn sổ lớn hơn 0' },
  { value: 'low', label: 'Dưới ngưỡng', hint: 'Vị thế thấp hơn ngưỡng Kho khai' },
  {
    value: 'short',
    label: 'Thiếu cho LSX',
    hint: 'Đã hứa cho lệnh nhiều hơn số đang có',
  },
  { value: 'all', label: 'Toàn danh mục', hint: 'Tra cứu bất kỳ mã nào' },
]

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Ngày về so với hôm nay — người mua chỉ cần biết "trễ / sắp / còn xa". */
function etaColor(eta: string | null, today: string): string | undefined {
  if (!eta) return undefined
  const d = eta.slice(0, 10)
  if (d < today) return 'var(--stop)'
  return d <= addDays(today, 7) ? 'var(--warn)' : undefined
}

/**
 * KHO & TỒN — góc nhìn người mua.
 *
 * Bố cục theo mẫu v3 ba tầng (/design-lab, giống `PoFilters`): THẺ SỐ bấm được
 * → TAB gạch chân → thanh tìm. Bản đầu (02/09) xếp cả năm bộ lọc thành một hàng
 * nút xám giống hệt nhau, và dải KPI thì im — người đọc thấy "3 mã đang có đơn
 * về" mà không bấm vào đâu được, phải đi tìm nút tương ứng ở hàng dưới. Nay số
 * CHÍNH LÀ lối đi.
 *
 * Cột xếp theo thứ tự câu hỏi: đang có gì (tồn · giữ · khả dụng) → đang về gì
 * (đã đặt · ngày · đơn) → mua thế nào (giá · NCC). Nhóm giữa được kẻ vạch tách
 * ở hai bên vì đó là phần người mua đọc trước.
 */
export function SupplyStockScreen({
  rows,
  total,
  counts,
  page,
  pageSize,
  groups,
  filters,
}: {
  rows: SupplyStockRow[]
  total: number
  counts: SupplyStockCounts
  page: number
  pageSize: number
  groups: { name: string }[]
  filters: { q: string; group: string; f: SupplyStockFilter }
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [navigating, startTransition] = useTransition()
  const [q, setQ] = useState(filters.q)
  const today = new Date().toISOString().slice(0, 10)

  const pushFilter = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (!v) next.delete(k)
        else next.set(k, v)
      }
      if (!('page' in patch)) next.delete('page')
      const qs = next.toString()
      startTransition(() => router.replace(qs ? `?${qs}` : '?'))
    },
    [router, sp],
  )

  const goFilter = (f: SupplyStockFilter) => pushFilter({ f: f === 'incoming' ? '' : f })

  const columns: Column<SupplyStockRow>[] = [
    {
      key: 'code',
      header: 'Mã / Tên vật tư',
      width: '240px',
      cell: (r) => (
        <div className="min-w-0">
          <DocChip className="text-[11px]">{r.code}</DocChip>
          <div className="mt-0.5 truncate font-medium">{r.name}</div>
          {r.group_name && (
            <div className="text-muted-foreground truncate text-[11px]">
              {r.group_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'on_hand',
      header: 'Tồn',
      align: 'right',
      width: '88px',
      sortValue: (r) => r.on_hand,
      cell: (r) => (
        <div className="flex flex-col items-end">
          <span className="t-data">{num(r.on_hand)}</span>
          <span className="text-muted-foreground text-[11px]">{r.unit}</span>
        </div>
      ),
    },
    {
      key: 'reserved',
      header: 'Giữ cho LSX',
      align: 'right',
      width: '96px',
      sortValue: (r) => r.reserved,
      cell: (r) =>
        r.reserved > 0 ? (
          <span className="t-data">{num(r.reserved)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'available',
      header: 'Khả dụng',
      align: 'right',
      width: '96px',
      headerClassName: 'border-l',
      className: 'border-l',
      sortValue: (r) => r.available,
      cell: (r) =>
        r.available < 0 ? (
          <span className="t-data font-semibold" style={{ color: 'var(--stop)' }}>
            {num(r.available)}
          </span>
        ) : (
          <span className="t-data">{num(r.available)}</span>
        ),
    },
    {
      key: 'ordered',
      header: 'Đã đặt, chưa về',
      align: 'right',
      width: '112px',
      sortValue: (r) => r.ordered || r.pending,
      cell: (r) => {
        if (r.ordered > 0) {
          return <span className="t-data font-semibold">{num(r.ordered)}</span>
        }
        if (r.pending > 0) {
          return (
            <div className="flex flex-col items-end">
              <span className="t-data" style={{ color: 'var(--warn)' }}>
                {num(r.pending)}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--warn)' }}>
                chờ duyệt
              </span>
            </div>
          )
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
    {
      key: 'eta',
      header: 'Về ngày / Đơn',
      width: '150px',
      headerClassName: 'border-r',
      className: 'border-r',
      sortValue: (r) => r.eta ?? '9999',
      cell: (r) => {
        if (!r.po_code) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-col gap-1">
            <span
              className="t-data inline-flex items-center gap-1.5"
              style={{ color: etaColor(r.eta, today) }}
            >
              <Truck size={13} strokeWidth={1.8} />
              {/* Không lặp lại "chờ duyệt" — cột bên trái đã nói rồi; ở đây chỉ
                  cần biết CÓ NGÀY hay không, và đơn nào để bấm sang. */}
              {r.eta ? dmy(r.eta) : r.ordered > 0 ? 'chưa hẹn ngày' : '—'}
            </span>
            <span className="flex items-center gap-1">
              {r.po_id ? (
                <Link href={`/planning/pos/${r.po_id}`} className="hover:underline">
                  <DocChip className="text-[11px]">{r.po_code}</DocChip>
                </Link>
              ) : (
                <DocChip className="text-[11px]">{r.po_code}</DocChip>
              )}
              {r.po_count > 1 && (
                <span className="text-muted-foreground text-[11px]">
                  +{r.po_count - 1} đơn
                </span>
              )}
            </span>
          </div>
        )
      },
    },
    {
      key: 'threshold',
      header: 'Ngưỡng',
      align: 'right',
      width: '90px',
      sortValue: (r) => r.threshold,
      cell: (r) =>
        r.threshold > 0 ? (
          <div className="flex flex-col items-end">
            <span className="t-data">{num(r.threshold)}</span>
            {r.shortage > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--warn)' }}>
                thiếu {num(r.shortage)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-[11px]">chưa khai</span>
        ),
    },
    {
      key: 'price',
      header: 'Giá mua gần nhất',
      align: 'right',
      width: '136px',
      sortValue: (r) => r.last_purchase_price ?? -1,
      cell: (r) => (
        <div className="flex flex-col items-end">
          {r.last_purchase_price != null ? (
            <span className="t-data">{num(r.last_purchase_price)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {r.supplier_name && (
            <span className="text-muted-foreground max-w-[140px] truncate text-[11px]">
              {r.supplier_name}
            </span>
          )}
        </div>
      ),
    },
  ]

  const from = (page - 1) * pageSize
  const tab = TABS.find((t) => t.value === filters.f)

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={navigating} />
      <PageHeader
        breadcrumbs={[{ label: 'Cung ứng', href: '/planning' }, { label: 'Kho & tồn' }]}
        title="Kho & tồn"
        description="Trước khi đặt thêm: mã này còn bao nhiêu, đã đặt bao nhiêu chưa về, bao giờ về và lần trước mua của ai."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/planning/hang-sap-ve">
              <CalendarClock /> Lịch hàng sắp về
            </Link>
          </Button>
        }
      />

      {/* Tầng 1 — số VÀ lối đi là một: bấm thẻ là lọc đúng nhóm nó đếm. */}
      <StatTiles>
        <StatTile
          label="Đang có đơn về"
          value={counts.incoming}
          icon={Truck}
          tone="primary"
          active={filters.f === 'incoming'}
          onClick={() => goFilter('incoming')}
          title="Vật tư đã đặt còn phải về"
        />
        {/* Việc GẤP NHẤT đứng thứ hai: đã hứa cho lệnh nhiều hơn số đang có. */}
        <StatTile
          label="Thiếu cho LSX"
          value={counts.short}
          icon={TriangleAlert}
          tone="stop"
          hint={counts.in_stock > 0 ? `${counts.in_stock} mã đang có tồn` : undefined}
          active={filters.f === 'short'}
          onClick={() => goFilter('short')}
          title="Đã giữ chỗ cho lệnh nhiều hơn tồn hiện có"
        />
        <StatTile
          label="Dưới ngưỡng"
          value={counts.low}
          icon={TriangleAlert}
          tone="warn"
          active={filters.f === 'low'}
          onClick={() => goFilter('low')}
          title="Vị thế thấp hơn ngưỡng Kho khai"
        />
        <StatTile
          label="Vật tư trong danh mục"
          value={counts.materials.toLocaleString('vi-VN')}
          icon={PackageSearch}
          hint="bấm để tra cứu bất kỳ mã nào"
          active={filters.f === 'all'}
          onClick={() => goFilter('all')}
        />
      </StatTiles>

      {/* Tầng 2 — tab gạch chân, chọn một (một mã chỉ nằm ở một rổ). */}
      <Tabs value={filters.f} onValueChange={(v) => goFilter(v as SupplyStockFilter)}>
        <TabsList
          variant="line"
          className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} title={t.hint}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                onEnter={() => pushFilter({ q })}
                icon={<Search size={14} strokeWidth={1.8} />}
                placeholder="Tìm mã hoặc tên vật tư… (Enter)"
                className="w-72"
              />
              <ToolbarSelect
                value={filters.group}
                onChange={(v) => pushFilter({ group: v })}
                aria-label="Lọc theo nhóm vật tư"
                options={[
                  { value: '', label: 'Mọi nhóm' },
                  ...groups.map((g) => ({ value: g.name, label: g.name })),
                ]}
              />
            </>
          }
          right={
            <span className="t-label text-muted-foreground">
              {total.toLocaleString('vi-VN')} mã · {tab?.label}
            </span>
          }
        />
        <DataTable
          rows={rows}
          columns={columns}
          keyFn={(r) => r.material_id}
          pagination={false}
          emptyState={
            <EmptyState
              icon={<PackageSearch />}
              title={
                filters.f === 'incoming'
                  ? 'Không có vật tư nào đang chờ về'
                  : 'Không khớp bộ lọc'
              }
              description={
                filters.f === 'incoming'
                  ? 'Mọi đơn đã đặt đều đã về đủ.'
                  : 'Thử bỏ bớt điều kiện, hoặc gõ thẳng mã vật tư ở ô tìm.'
              }
              action={
                filters.f !== 'all' && (
                  <Button size="sm" variant="outline" onClick={() => goFilter('all')}>
                    <PackageSearch /> Tra cứu toàn danh mục
                  </Button>
                )
              }
            />
          }
        />
        {total > pageSize && (
          <div className="bg-card flex items-center justify-between rounded-b-lg border border-t-0 px-3 py-2">
            <span className="t-label text-muted-foreground">
              {(from + 1).toLocaleString('vi-VN')}–
              {Math.min(from + pageSize, total).toLocaleString('vi-VN')} trên{' '}
              {total.toLocaleString('vi-VN')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || navigating}
                onClick={() => pushFilter({ page: String(page - 1) })}
              >
                Trước
              </Button>
              <span className="t-label text-muted-foreground">
                trang {page} / {Math.max(1, Math.ceil(total / pageSize))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={from + pageSize >= total || navigating}
                onClick={() => pushFilter({ page: String(page + 1) })}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
