'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import {
  PO_BUCKETS,
  isFilterActive,
  type PoCounts,
  type PoFilterState,
} from './po-filter'
import type { SupplierOption } from './po-types'

/**
 * THANH LỌC theo thiết kế v3 (/design-lab mục 02) — ba tầng, số VÀ lối đi là một:
 *
 *   · THẺ SỐ bấm được — bốn chỗ cần động tay (chờ duyệt / đã duyệt chưa gửi /
 *     quá hẹn / về đủ). Bấm = lọc đúng nhóm đó, bấm lại = bỏ.
 *   · TAB GẠCH CHÂN — sáu nhóm vòng đời chọn một (đơn chỉ ở một chỗ).
 *   · CÔNG TẮC phụ — của tôi / quá hẹn / chưa hẹn giao, NHÂN với tab đang chọn.
 *
 * Vẫn giữ nguyên po-filter.ts: chỉ đổi cách bày, không đổi ngữ nghĩa lọc.
 * Tab số 0 vẫn hiện nhưng mờ và không bấm được — giấu hẳn thì hàng tab nhảy
 * chỗ mỗi lần dữ liệu đổi, không ai nhắm trúng nút biết nhảy.
 */

export type PoView = 'lsx' | 'flat'

const selectCls =
  'border-input bg-card text-foreground/85 h-8 rounded-lg border px-2 text-[12px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
        on
          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  )
}

/** Tab vòng đời — gạch chân màu hành động khi đang chọn. */
function Tab({
  label,
  n,
  on,
  onClick,
}: {
  label: string
  n: number
  on: boolean
  onClick: () => void
}) {
  const base =
    '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12.5px] font-medium transition-colors'
  if (n === 0 && !on) {
    return (
      <span className={cn(base, 'text-muted-foreground/40 border-transparent')}>
        {label} <Count n={0} on={false} />
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        base,
        on
          ? 'border-[var(--primary)] text-[var(--primary)]'
          : 'text-muted-foreground hover:text-foreground border-transparent',
      )}
    >
      {label} <Count n={n} on={on} />
    </button>
  )
}

/** Công tắc phụ — chip nhỏ, cộng dồn với tab. */
function ToggleChip({
  label,
  n,
  on,
  tone = 'primary',
  onClick,
}: {
  label: string
  n: number
  on: boolean
  tone?: 'primary' | 'amber' | 'red'
  onClick: () => void
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors'
  if (n === 0 && !on) {
    return (
      <span className={cn(base, 'border-border/60 bg-card text-muted-foreground/40')}>
        {label} <Count n={0} on={false} />
      </span>
    )
  }
  const onCls = {
    primary: 'border-[var(--primary)] bg-[var(--primary)] text-white',
    amber: 'border-[var(--warn)] bg-[var(--warn)] text-white',
    red: 'border-[var(--stop)] bg-[var(--stop)] text-white',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        base,
        on
          ? onCls
          : 'border-border bg-card hover:border-foreground/30 text-foreground/75',
      )}
    >
      {label}{' '}
      <span
        className={cn(
          'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
          on ? 'bg-white/25' : 'bg-muted',
        )}
      >
        {n}
      </span>
    </button>
  )
}

/** Thẻ số bấm được — như mục Màn hình mẫu của design-lab. */
function StatBtn({
  label,
  n,
  color,
  on,
  onClick,
}: {
  label: string
  n: number
  color: string
  on: boolean
  onClick: () => void
}) {
  const empty = n === 0 && !on
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={on}
      className={cn(
        'bg-card rounded-xl border px-3.5 py-2.5 text-left transition-colors',
        on
          ? 'border-[var(--primary)] bg-[var(--accent)]/60'
          : empty
            ? 'cursor-default opacity-55'
            : 'hover:border-[var(--primary)]/40',
      )}
    >
      <p className="t-label text-muted-foreground truncate">{label}</p>
      <p
        className="mt-1 font-mono text-[20px] leading-none font-semibold tabular-nums"
        style={{ color }}
      >
        {n}
      </p>
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
  /** Chỉ NV cung ứng đã đăng nhập mới có "đơn của tôi" để lọc. */
  showMine: boolean
  view: PoView
  onView: (v: PoView) => void
  busy: boolean
}) {
  const set = (patch: Partial<PoFilterState>) => onFilter({ ...filter, ...patch })
  const active = isFilterActive(filter)
  const toggleBucket = (b: PoFilterState['bucket']) =>
    set({ bucket: filter.bucket === b ? 'all' : b })

  return (
    <div className="flex flex-col gap-3">
      {/* Tầng 1 — bốn thẻ số cần động tay */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatBtn
          label="Chờ duyệt"
          n={counts.pending}
          color="var(--warn)"
          on={filter.bucket === 'pending'}
          onClick={() => toggleBucket('pending')}
        />
        <StatBtn
          label="Đã duyệt · chưa gửi"
          n={counts.ready}
          color="var(--primary)"
          on={filter.bucket === 'ready'}
          onClick={() => toggleBucket('ready')}
        />
        <StatBtn
          label="Quá hẹn giao"
          n={counts.late}
          color="var(--stop)"
          on={filter.late}
          onClick={() => set({ late: !filter.late })}
        />
        <StatBtn
          label="Về đủ"
          n={counts.received}
          color="var(--done)"
          on={filter.bucket === 'received'}
          onClick={() => toggleBucket('received')}
        />
      </div>

      {/* Tầng 2 — tìm & lọc phụ, đáy là tab bar vòng đời */}
      <div className="bg-card rounded-xl border">
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
          <label className="relative min-w-[220px] flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              value={filter.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Tìm số PO, NCC, LSX, mã đơn hàng…"
              className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border pr-2 pl-8 text-[13px] outline-none focus-visible:ring-[3px]"
            />
          </label>

          <select
            value={filter.supplierId}
            onChange={(e) => set({ supplierId: e.target.value })}
            className={cn(selectCls, 'max-w-[200px]')}
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
            className={selectCls}
            aria-label="Lọc theo loại đơn"
          >
            <option value="all">Mọi loại đơn</option>
            <option value="lsx">Theo lệnh SX</option>
            <option value="standalone">Ngoài LSX</option>
          </select>

          {busy && (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Spinner size={12} /> Đang xử lý…
            </span>
          )}

          {/* Kiểu xem — "theo lệnh" để nắm việc, "danh sách" để soi một đơn. */}
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
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  view === v
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-t px-2 pb-0">
          <Tab
            label="Tất cả"
            n={counts.all}
            on={filter.bucket === 'all'}
            onClick={() => set({ bucket: 'all' })}
          />
          {PO_BUCKETS.map((b) => (
            <Tab
              key={b.key}
              label={b.label}
              n={counts[b.key]}
              on={filter.bucket === b.key}
              onClick={() => toggleBucket(b.key)}
            />
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-1.5 py-1.5 pr-1.5">
            <SlidersHorizontal className="text-muted-foreground size-3.5" aria-hidden />
            {showMine && (
              <ToggleChip
                label="Của tôi"
                n={counts.mine}
                on={filter.mine}
                onClick={() => set({ mine: !filter.mine })}
              />
            )}
            <ToggleChip
              label="Quá hẹn giao"
              n={counts.late}
              tone="red"
              on={filter.late}
              onClick={() => set({ late: !filter.late })}
            />
            <ToggleChip
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
                className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-1 text-xs transition-colors"
              >
                <X className="size-3" aria-hidden /> Bỏ lọc
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Giữ nguyên kiểu xem khi bấm "Bỏ lọc" — kiểu xem không phải bộ lọc. */
const EMPTY = {
  q: '',
  bucket: 'all',
  supplierId: 'all',
  type: 'all',
  mine: false,
  late: false,
  noEta: false,
} as const
