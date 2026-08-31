'use client'

import {
  CircleCheck,
  CircleSlash,
  FileCheck,
  FileQuestionMark,
  ImageOff,
  Lock,
  PencilRuler,
  X,
  type LucideIcon,
} from 'lucide-react'
import { PRODUCT_TYPES } from '@/lib/product-code'
import { LIFECYCLES, LIFECYCLE_LABEL } from '@/lib/product-lifecycle'
import { Button } from '@/components/shadcn/button'
import { SearchSelect } from './SearchSelect'
import {
  ACCENT_SOLID,
  NO_CATEGORY,
  NO_CUSTOMER,
  type CategoryOption,
  type CustomerNameOption,
  type Filters,
  type ProductCounts,
  type ToggleFilterKey,
} from './types'

/**
 * Ruột của nút "Bộ lọc" — TẤT CẢ điều kiện lọc nằm ở đây.
 *
 * Trước 31/08/2026 chúng nằm trải trên màn: 4 ô chọn + 2 hàng chip kèm số đếm,
 * ăn gần 1/3 chiều cao trước khi thấy sản phẩm nào. Gom vào một bảng bung ra vì
 * lọc là việc làm THEO ĐỢT (chọn xong rồi đọc kết quả), không phải thứ phải nhìn
 * suốt. Tình trạng định mức / thiếu ảnh của từng SP vẫn đọc được ở dải icon trên
 * mỗi thẻ — chỗ nó thuộc về.
 */
export function FilterPanel({
  filters,
  counts,
  customerNames,
  categories,
  onParamChange,
  onToggle,
  hasFilter,
  onClear,
}: {
  filters: Filters
  counts: ProductCounts
  customerNames: CustomerNameOption[]
  categories: CategoryOption[]
  onParamChange: (patch: Record<string, string | undefined>) => void
  onToggle: (key: ToggleFilterKey, value: string) => void
  hasFilter: boolean
  onClear: () => void
}) {
  const inactiveCount = Math.max(0, counts.total - counts.active)

  const customerOptions = [
    { value: NO_CUSTOMER, label: 'Mẫu chung' },
    ...customerNames.map((c) => ({
      value: c.name,
      label: c.name,
      hint: String(c.count),
    })),
  ]
  const typeOptions = PRODUCT_TYPES.map((t) => ({ value: t.code, label: t.label }))
  const categoryOptions = [
    { value: NO_CATEGORY, label: 'Chưa phân loại' },
    ...categories.map((c) => ({ value: c.code, label: c.label })),
  ]
  const lifecycleOptions = LIFECYCLES.map((s) => ({
    value: s,
    label: LIFECYCLE_LABEL[s],
  }))

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Khách hàng">
        <SearchSelect
          value={filters.customer}
          options={customerOptions}
          onChange={(v) => onParamChange({ customer: v })}
          label="Lọc theo khách hàng"
          allLabel="Mọi khách hàng"
          placeholder={`Gõ để tìm trong ${customerNames.length} khách…`}
        />
      </Field>

      <Field label="Loại sản phẩm">
        <SearchSelect
          value={filters.type}
          options={typeOptions}
          onChange={(v) => onParamChange({ type: v })}
          label="Lọc theo loại sản phẩm"
          allLabel="Mọi loại sản phẩm"
        />
      </Field>

      {/* Danh mục là DỮ LIỆU (admin khai ở /admin/catalogs), khác LOẠI SP suy từ
          mã. Chưa khai mục nào thì ẩn hẳn — một ô chọn rỗng là nhiễu. */}
      {categories.length > 0 && (
        <Field label="Danh mục">
          <SearchSelect
            value={filters.category}
            options={categoryOptions}
            onChange={(v) => onParamChange({ category: v })}
            label="Lọc theo danh mục"
            allLabel="Mọi danh mục"
          />
        </Field>
      )}

      <Field label="Trạng thái hồ sơ">
        <SearchSelect
          value={filters.lifecycle}
          options={lifecycleOptions}
          onChange={(v) => onParamChange({ lifecycle: v })}
          label="Lọc theo trạng thái hồ sơ"
          allLabel="Mọi trạng thái"
        />
      </Field>

      <Field label="Định mức">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filters.bom === 'done'}
            label="Đã vẽ"
            count={counts.bom_done}
            icon={FileCheck}
            iconClass="text-emerald-500"
            onClick={() => onToggle('bom', 'done')}
          />
          <Chip
            active={filters.bom === 'drawing'}
            label="Đang vẽ"
            count={counts.bom_drawing}
            icon={PencilRuler}
            iconClass="text-amber-500"
            onClick={() => onToggle('bom', 'drawing')}
          />
          <Chip
            active={filters.bom === 'none'}
            label="Chưa có"
            count={counts.bom_none}
            icon={FileQuestionMark}
            iconClass="text-zinc-400"
            onClick={() => onToggle('bom', 'none')}
          />
        </div>
      </Field>

      <Field label="Tình trạng">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filters.status === 'active'}
            label="Đang dùng"
            count={counts.active}
            icon={CircleCheck}
            iconClass="text-emerald-500"
            onClick={() => onToggle('status', 'active')}
          />
          <Chip
            active={filters.status === 'inactive'}
            label="Ngừng"
            count={inactiveCount}
            icon={CircleSlash}
            iconClass="text-zinc-400"
            onClick={() => onToggle('status', 'inactive')}
          />
          {/* 0140 — hồ sơ ĐÃ KHOÁ: bản đã chốt, mọi phòng dùng được ngay. */}
          <Chip
            active={filters.locked === 'yes'}
            label="Đã khoá"
            count={counts.locked}
            icon={Lock}
            iconClass="text-emerald-600"
            onClick={() => onToggle('locked', 'yes')}
          />
          <Chip
            active={filters.image === 'missing'}
            label="Thiếu ảnh"
            count={counts.no_image}
            icon={ImageOff}
            iconClass="text-zinc-400"
            onClick={() => onToggle('image', 'missing')}
          />
        </div>
      </Field>

      {hasFilter && (
        <Button variant="outline" size="sm" onClick={onClear} className="self-start">
          <X /> Xoá hết bộ lọc
        </Button>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[11px] tracking-wider uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

/** Chip lọc kiêm số đếm. Bấm lại chip đang bật = bỏ lọc, nên không cần chip "Tất cả". */
function Chip({
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
