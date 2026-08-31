'use client'

import { Eye, EyeOff, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover'
import { Spinner } from '@/components/erp/Spinner'
import { FilterPanel } from './FilterPanel'
import type {
  CategoryOption,
  CustomerNameOption,
  Filters,
  ProductCounts,
  ToggleFilterKey,
} from './types'

/** Số điều kiện lọc đang bật — hiện lên nút để biết đang xem tập nào mà không phải mở bảng. */
function countActive(f: Filters): number {
  return [
    f.customer,
    f.bom,
    f.status,
    f.image,
    f.locked,
    f.lifecycle,
    f.type,
    f.category,
  ].filter((v) => v !== 'all').length
}

/** Nút bật/tắt ảnh — xem `ProductsManager` để biết vì sao ảnh không tự tải. */
function ImageToggle({
  on,
  count,
  onToggle,
}: {
  on: boolean
  count: number
  onToggle: () => void
}) {
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={
        on
          ? 'Ẩn ảnh — trang mở nhanh hơn'
          : `Hiện ảnh (${count} tấm). Ảnh tự hiện khi bạn tìm hoặc lọc.`
      }
      className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        on
          ? 'border-sky-600 bg-sky-600 text-white'
          : 'text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300'
      }`}
    >
      {on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      {on ? 'Ảnh' : `Hiện ảnh (${count})`}
    </button>
  )
}

/** Nút chuyển lưới ảnh ↔ bảng. */
function ViewToggle({
  view,
  onChange,
}: {
  view: 'grid' | 'list'
  onChange: (v: 'grid' | 'list') => void
}) {
  const cls = (on: boolean) =>
    `grid size-7 place-items-center rounded transition-colors ${
      on
        ? 'bg-sky-600 text-white shadow-sm'
        : 'text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300'
    }`
  return (
    <div className="inline-flex gap-0.5 rounded-md border p-0.5">
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-label="Xem dạng lưới ảnh"
        aria-pressed={view === 'grid'}
        className={cls(view === 'grid')}
      >
        <LayoutGrid className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-label="Xem dạng bảng"
        aria-pressed={view === 'list'}
        className={cls(view === 'list')}
      >
        <List className="size-4" />
      </button>
    </div>
  )
}

/**
 * Thanh lọc: MỘT hàng — ô tìm + nút "Bộ lọc (n)" + hai nút bày kết quả.
 *
 * Điều kiện lọc nằm trong bảng bung ra (`FilterPanel`) chứ không trải trên màn
 * như trước: xem lý do ở đầu file đó.
 */
export function FilterBar({
  filters,
  counts,
  customerNames,
  categories,
  q,
  onQChange,
  searching,
  view,
  onViewChange,
  showImages,
  imageCount,
  onToggleImages,
  onParamChange,
  onToggle,
  hasFilter,
  onClear,
}: {
  filters: Filters
  counts: ProductCounts
  customerNames: CustomerNameOption[]
  /** Danh mục SP đang hiệu lực; rỗng = chưa ai khai ở /admin/catalogs. */
  categories: CategoryOption[]
  q: string
  onQChange: (v: string) => void
  /** Đang chờ nhịp debounce / server trả về — để ô tìm nói "đang tìm…". */
  searching: boolean
  view: 'grid' | 'list'
  onViewChange: (v: 'grid' | 'list') => void
  /** Lưới đang tải ảnh hay để trống cho nhẹ (xem `ProductsManager`). */
  showImages: boolean
  /** Số SP CÓ ảnh trên trang này — để nút nói rõ bật lên sẽ tải bao nhiêu tấm. */
  imageCount: number
  onToggleImages: () => void
  onParamChange: (patch: Record<string, string | undefined>) => void
  onToggle: (key: ToggleFilterKey, value: string) => void
  hasFilter: boolean
  onClear: () => void
}) {
  const active = countActive(filters)

  return (
    <div className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-2 shadow-sm">
      <div className="relative min-w-56 flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          aria-label="Tìm sản phẩm"
          placeholder="Tìm mã HG, tên, mã KH đặt, tên khách…"
          className="bg-background placeholder:text-muted-foreground/70 focus-visible:ring-ring/50 h-9 w-full rounded-md border pr-14 pl-8 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {searching && <Spinner size={13} className="text-muted-foreground" />}
          {q && (
            <button
              type="button"
              onClick={() => onQChange('')}
              aria-label="Xoá từ khoá"
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${
              active > 0
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Bộ lọc
            {active > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 text-xs tabular-nums">
                {active}
              </span>
            )}
          </button>
        </PopoverTrigger>
        {/* BẪY theme: Radix vẽ ra <body>, ngoài wrapper `theme-v3` của shell —
            phải đeo lại class + `bg-card`, không thì hộp ra nền xám lạc lõng. */}
        <PopoverContent align="end" className="theme-v3 bg-card w-80">
          <FilterPanel
            filters={filters}
            counts={counts}
            customerNames={customerNames}
            categories={categories}
            onParamChange={onParamChange}
            onToggle={onToggle}
            hasFilter={hasFilter}
            onClear={onClear}
          />
        </PopoverContent>
      </Popover>

      <ImageToggle on={showImages} count={imageCount} onToggle={onToggleImages} />
      <ViewToggle view={view} onChange={onViewChange} />
    </div>
  )
}
