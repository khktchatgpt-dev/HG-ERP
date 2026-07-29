'use client'

import {
  ChevronDown,
  CircleCheck,
  CircleSlash,
  FileCheck,
  FileQuestionMark,
  ImageOff,
  LayoutGrid,
  List,
  PencilRuler,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'
import { PRODUCT_TYPES } from '@/lib/product-code'
import { Spinner } from '@/components/erp/Spinner'
import {
  ACCENT_SOLID,
  NO_CUSTOMER,
  type CustomerNameOption,
  type Filters,
  type ProductCounts,
  type ToggleFilterKey,
} from './types'

/**
 * Chip lọc kiêm số đếm. Bấm lại chip đang bật = bỏ lọc, nên không cần thêm
 * chip "Tất cả" cho mỗi nhóm. Số đếm là số TOÀN THƯ VIỆN (không theo bộ lọc
 * đang bật) — đó là câu hỏi người dùng thực sự hỏi: "còn bao nhiêu SP chưa vẽ".
 */
function FilterChip({
  active,
  label,
  count,
  icon: Icon,
  iconClass,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  /** Icon mang luôn màu ngữ nghĩa của mục — thay cho chấm tròn vô nghĩa. */
  icon: LucideIcon
  iconClass: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-2 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${
        active
          ? `border-transparent shadow-sm ${ACCENT_SOLID}`
          : 'bg-card text-muted-foreground hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-300'
      }`}
    >
      <Icon className={`size-3.5 ${active ? 'text-white' : iconClass}`} aria-hidden />
      {label}
      {count != null && (
        <span
          className={`tabular-nums ${active ? 'text-white/75' : 'text-muted-foreground/60'}`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/** Select gọn cho toolbar — mũi tên tự vẽ vì `appearance-none` bỏ mũi tên gốc. */
function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-background focus-visible:ring-ring/50 h-9 w-full appearance-none rounded-md border pr-8 pl-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
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
    <div className="ms-auto inline-flex gap-0.5 rounded-md border p-0.5">
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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground/70 mr-0.5 text-[11px] tracking-wider uppercase">
      {children}
    </span>
  )
}

/**
 * Thanh lọc: ô tìm + hai dropdown + chip kiêm số đếm.
 *
 * Bộ chip gộp luôn số đếm — mỗi con số bấm được, thay cho StatsBar chỉ để nhìn
 * nằm chồng lên một hàng select có đúng các mục đó.
 */
export function FilterBar({
  filters,
  counts,
  customerNames,
  q,
  onQChange,
  searching,
  view,
  onViewChange,
  onParamChange,
  onToggle,
  hasFilter,
  onClear,
}: {
  filters: Filters
  counts: ProductCounts
  customerNames: CustomerNameOption[]
  q: string
  onQChange: (v: string) => void
  /** Đang chờ nhịp debounce / server trả về — để ô tìm nói "đang tìm…". */
  searching: boolean
  view: 'grid' | 'list'
  onViewChange: (v: 'grid' | 'list') => void
  onParamChange: (patch: Record<string, string | undefined>) => void
  onToggle: (key: ToggleFilterKey, value: string) => void
  hasFilter: boolean
  onClear: () => void
}) {
  const customerOptions = [
    { value: 'all', label: 'Mọi khách hàng' },
    { value: NO_CUSTOMER, label: 'Mẫu chung' },
    ...customerNames.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
  ]
  // Taxonomy CỐ ĐỊNH nên đổ thẳng từ hằng, không cần hỏi server: 7 mục, luôn
  // hiện đủ kể cả loại đang có ít SP. Nhãn khách thì ngược lại — gõ tự do, số
  // lượng không đoán được, nên vẫn phải lấy kèm số đếm từ DB.
  const typeOptions = [
    { value: 'all', label: 'Mọi loại sản phẩm' },
    ...PRODUCT_TYPES.map((t) => ({ value: t.code, label: t.label })),
  ]
  const inactiveCount = Math.max(0, counts.total - counts.active)

  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-2">
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

        <FilterSelect
          value={filters.customer}
          onChange={(v) => onParamChange({ customer: v })}
          label="Lọc theo khách hàng"
          options={customerOptions}
        />
        <FilterSelect
          value={filters.type}
          onChange={(v) => onParamChange({ type: v })}
          label="Lọc theo loại sản phẩm"
          options={typeOptions}
        />

        <ViewToggle view={view} onChange={onViewChange} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-2 py-2">
        <GroupLabel>Định mức</GroupLabel>
        <FilterChip
          active={filters.bom === 'done'}
          label="Đã vẽ"
          count={counts.bom_done}
          icon={FileCheck}
          iconClass="text-emerald-500"
          onClick={() => onToggle('bom', 'done')}
        />
        <FilterChip
          active={filters.bom === 'drawing'}
          label="Đang vẽ"
          count={counts.bom_drawing}
          icon={PencilRuler}
          iconClass="text-amber-500"
          onClick={() => onToggle('bom', 'drawing')}
        />
        <FilterChip
          active={filters.bom === 'none'}
          label="Chưa có"
          count={counts.bom_none}
          icon={FileQuestionMark}
          iconClass="text-zinc-400"
          onClick={() => onToggle('bom', 'none')}
        />

        <span className="bg-border mx-1.5 h-4 w-px" aria-hidden />

        <GroupLabel>Trạng thái</GroupLabel>
        <FilterChip
          active={filters.status === 'active'}
          label="Đang dùng"
          count={counts.active}
          icon={CircleCheck}
          iconClass="text-emerald-500"
          onClick={() => onToggle('status', 'active')}
        />
        <FilterChip
          active={filters.status === 'inactive'}
          label="Ngừng"
          count={inactiveCount}
          icon={CircleSlash}
          iconClass="text-zinc-400"
          onClick={() => onToggle('status', 'inactive')}
        />

        <span className="bg-border mx-1.5 h-4 w-px" aria-hidden />

        <GroupLabel>Ảnh</GroupLabel>
        <FilterChip
          active={filters.image === 'missing'}
          label="Thiếu ảnh"
          count={counts.no_image}
          icon={ImageOff}
          iconClass="text-amber-500"
          onClick={() => onToggle('image', 'missing')}
        />

        {hasFilter && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground ms-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs"
          >
            <X className="size-3.5" /> Xoá lọc
          </button>
        )}
      </div>
    </div>
  )
}
