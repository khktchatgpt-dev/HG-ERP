'use client'

import { Search, X } from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import {
  PO_BUCKETS,
  isFilterActive,
  type PoCounts,
  type PoFilterState,
} from './po-filter'
import type { SupplierOption } from './po-types'

/**
 * THANH LỌC — chip bấm được thay cho dải thống kê chết.
 *
 * Bản cũ tách làm hai khối rời nhau: một dải bảy ô thống kê (bấm không được) và
 * một hàng bốn dropdown. Đo trên khung 1440×900: dòng đơn ĐẦU TIÊN nằm ở y=606
 * — hai phần ba màn hình đầu là số 0 và ô lọc, còn lại vừa đủ hai ba dòng.
 *
 * Nay số VÀ lối đi là một: mỗi chip vừa nói có bao nhiêu đơn, vừa là nút lọc.
 *   · Hàng chip trên  — SÁU NHÓM vòng đời, chọn một (đơn chỉ ở một chỗ).
 *   · Hàng chip dưới  — BA CÔNG TẮC nhân thêm: của tôi / quá hẹn / chưa hẹn giao.
 * Nhờ tách hai tầng mới hỏi được "đơn chờ duyệt MÀ quá hẹn " — bản cũ nhét cảnh
 * báo chung ô với trạng thái nên phải chọn một trong hai.
 *
 * Chip số 0 vẫn hiện nhưng mờ và không bấm được: giấu hẳn thì hàng chip nhảy
 * chỗ mỗi lần dữ liệu đổi, mà một hàng nút biết nhảy thì không ai nhắm trúng.
 */

export type PoView = 'lsx' | 'flat'

const chipBase =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors'
const chipOff =
  'border-border bg-card hover:border-foreground/30 text-foreground/75'
const chipEmpty =
  'border-border/60 bg-card text-muted-foreground/40 cursor-default'
const select =
  'border-border bg-card text-foreground/85 h-8 rounded-lg border px-2 text-[12px]'

/** Số đứng sau nhãn — nền đậm hơn một bậc để đọc được cả khi chip đang bật. */
function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 text-[11px] tabular-nums ${
        on ? 'bg-card/25' : 'bg-muted'
      }`}
    >
      {n}
    </span>
  )
}

function Chip({
  label,
  n,
  on,
  tone = 'sky',
  onClick,
}: {
  label: string
  n: number
  on: boolean
  /** `amber`/`red` cho chip cảnh báo, `sky` cho chip thường. */
  tone?: 'sky' | 'amber' | 'red'
  onClick: () => void
}) {
  if (n === 0 && !on) {
    return (
      <span className={`${chipBase} ${chipEmpty}`} aria-disabled>
        {label} <Count n={0} on={false} />
      </span>
    )
  }
  const onCls = {
    sky: 'border-primary bg-primary text-primary-foreground',
    amber: 'border-[var(--warn)] bg-[var(--warn)] text-white',
    red: 'border-[var(--stop)] bg-[var(--stop)] text-white',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`${chipBase} ${on ? onCls : chipOff}`}
    >
      {label} <Count n={n} on={on} />
    </button>
  )
}

export function PoFilters({
  filter,
  onFilter,
  counts,
  suppliers,
  showMine,
  view,
  onView,
  busy,
}: {
  filter: PoFilterState
  onFilter: (f: PoFilterState) => void
  counts: PoCounts
  suppliers: SupplierOption[]
  /** Chỉ NV cung ứng đã đăng nhập mới có"đơn của tôi" để lọc. */
  showMine: boolean
  view: PoView
  onView: (v: PoView) => void
  busy: boolean
}) {
  const set = (patch: Partial<PoFilterState>) => onFilter({ ...filter, ...patch })
  const active = isFilterActive(filter)

  return (
    <div className="border-border bg-card flex flex-col gap-2.5 rounded-xl border px-3.5 py-3">
      {/* Hàng 1 — tìm, lọc phụ, đổi kiểu xem */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Tìm số PO, NCC, LSX, mã đơn hàng…"
            className="border-border bg-card focus:border-ring h-8 w-full rounded-lg border pr-2 pl-8 text-[13px] outline-none"
          />
        </label>

        <select
          value={filter.supplierId}
          onChange={(e) => set({ supplierId: e.target.value })}
          className={`${select} max-w-[200px]`}
          aria-label="Lọc theo nhà cung cấp"
        >
          <option value="all">Mọi NCC</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filter.type}
          onChange={(e) => set({ type: e.target.value as PoFilterState['type'] })}
          className={select}
          aria-label="Lọc theo loại đơn"
        >
          <option value="all">Mọi loại đơn</option>
          <option value="lsx">Theo lệnh SX</option>
          <option value="standalone">Ngoài LSX</option>
        </select>

        {busy && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <Spinner size={12} /> Đang xử lý…
          </span>
        )}

        {/* Kiểu xem —"theo lệnh" để nắm việc,"danh sách" để soi một đơn. */}
        <div className="border-border ml-auto inline-flex rounded-lg border p-0.5 text-[12px]">
          {(
            [
              ['lsx', 'Theo lệnh SX'],
              ['flat', 'Danh sách'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={
                'rounded-md px-2.5 py-1 font-medium transition-colors ' +
                (view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Hàng 2 — sáu nhóm vòng đời, chọn một */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip
          label="Tất cả"
          n={counts.all}
          on={filter.bucket === 'all'}
          onClick={() => set({ bucket: 'all' })}
        />
        <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
        {PO_BUCKETS.map((b) => (
          <Chip
            key={b.key}
            label={b.label}
            n={counts[b.key]}
            on={filter.bucket === b.key}
            tone={b.actionable ? 'amber' : 'sky'}
            onClick={() => set({ bucket: filter.bucket === b.key ? 'all' : b.key })}
          />
        ))}
      </div>

      {/* Hàng 3 — ba công tắc, cộng dồn với nhóm ở trên */}
      <div className="flex flex-wrap items-center gap-1.5">
        {showMine && (
          <Chip
            label="Của tôi"
            n={counts.mine}
            on={filter.mine}
            onClick={() => set({ mine: !filter.mine })}
          />
        )}
        <Chip
          label="Quá hẹn giao"
          n={counts.late}
          tone="red"
          on={filter.late}
          onClick={() => set({ late: !filter.late })}
        />
        <Chip
          label="Chưa hẹn giao"
          n={counts.noEta}
          tone="amber"
          on={filter.noEta}
          onClick={() => set({ noEta: !filter.noEta })}
        />
        {active && (
          <button
            type="button"
            onClick={() => onFilter({ ...filter, ...EMPTY })}
            className="text-muted-foreground ml-1 inline-flex items-center gap-1 text-xs hover:text-foreground"
          >
            <X className="size-3" aria-hidden /> Bỏ lọc
          </button>
        )}
      </div>
    </div>
  )
}

/** Giữ nguyên kiểu xem khi bấm"Bỏ lọc" — kiểu xem không phải bộ lọc. */
const EMPTY = {
  q: '',
  bucket: 'all',
  supplierId: 'all',
  type: 'all',
  mine: false,
  late: false,
  noEta: false,
} as const
