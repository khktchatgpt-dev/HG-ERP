'use client'

import {
  AlertTriangle,
  CalendarOff,
  CheckCheck,
  Clock,
  PackageCheck,
  Search,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react'
import { FilterChip } from '@/components/erp/FilterChip'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Spinner } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { cn } from '@/lib/utils'
import {
  PO_BUCKETS,
  isFilterActive,
  type PoCounts,
  type PoFilterState,
} from './po-filter'
import type { SupplierOption } from './po-types'

/**
 * THANH LỌC ĐƠN MUA — ba tầng, "số và lối đi là một":
 *
 *   · THẺ SỐ bấm được — bốn chỗ cần động tay (chờ duyệt / đã duyệt chưa gửi /
 *     quá hẹn / về đủ). Bấm = lọc đúng nhóm đó.
 *   · TAB GẠCH CHÂN — nhóm vòng đời, chọn một (một đơn chỉ nằm ở một rổ).
 *   · THANH CÔNG CỤ — ô tìm, hai bộ lọc chọn, công tắc phụ NHÂN với tab.
 *
 * Ngữ nghĩa lọc không đổi: vẫn nguyên `po-filter.ts`, chỉ đổi cách bày.
 *
 * 04/09/2026 — DỌN BA BẢN TỰ CHÉP. Trước đó file này tự dựng `StatBtn`,
 * `ToggleChip` và `Tab` riêng; hai cái đầu chính là bản gốc mà `erp/StatTile`
 * và `erp/FilterChip` đã được rút lên kit để thay thế (đọc docblock của hai tệp
 * đó — chúng gọi thẳng tên tệp này). Giữ bản chép ở đây nghĩa là kit có một
 * đằng, màn chủ lực của phòng đi một nẻo, và mỗi lần sửa kit lại quên chỗ này.
 * Nay dùng đúng khuôn ba tầng của `/planning/stock` và `/planning/lsx`.
 *
 * HAI THAY ĐỔI HÀNH VI có chủ ý khi chuyển:
 *
 *  1. Chip "Quá hẹn giao" bị BỎ — nó với thẻ số thứ ba là MỘT bộ lọc
 *     (`filter.late`), cùng một `onClick`, chỉ khác chỗ ngồi. Hai công tắc cho
 *     một việc thì người dùng bấm cái này thấy cái kia tự sáng, tưởng hỏng.
 *     Giữ thẻ số vì nó bày luôn con số to.
 *  2. Chip phụ hết tô `--warn`/`--stop` khi đang chọn (luật theme v3: màu vòng
 *     đời không được mượn để mã hoá trạng thái điều khiển). Ý "gấp" nay do ICON
 *     chở, không do màu nền.
 */

export type PoView = 'lsx' | 'flat'

const TYPE_OPTIONS = [
  { value: 'all', label: 'Mọi loại đơn' },
  { value: 'lsx', label: 'Theo lệnh SX' },
  { value: 'standalone', label: 'Ngoài LSX' },
] as const

const VIEWS = [
  ['lsx', 'Theo lệnh SX'],
  ['flat', 'Danh sách'],
] as const

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

  const supplierOptions = [
    { value: 'all', label: 'Mọi NCC' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* ── Tầng 1 — bốn chỗ cần động tay ──────────────────────────────── */}
      <StatTiles>
        <StatTile
          label="Chờ duyệt"
          value={counts.pending}
          tone="warn"
          icon={Clock}
          hint="đang nằm ở bàn Giám đốc"
          active={filter.bucket === 'pending'}
          onClick={() => set({ bucket: 'pending' })}
        />
        <StatTile
          label="Đã duyệt · chưa gửi"
          value={counts.ready}
          tone="primary"
          icon={CheckCheck}
          hint="ký rồi nhưng NCC chưa nhận"
          active={filter.bucket === 'ready'}
          onClick={() => set({ bucket: 'ready' })}
        />
        <StatTile
          label="Quá hẹn giao"
          value={counts.late}
          tone="stop"
          icon={AlertTriangle}
          hint="qua ngày hẹn mà chưa về đủ"
          active={filter.late}
          onClick={() => set({ late: !filter.late })}
        />
        <StatTile
          label="Về đủ"
          value={counts.received}
          tone="done"
          icon={PackageCheck}
          hint="kho đã nhận hết dòng"
          active={filter.bucket === 'received'}
          onClick={() => set({ bucket: 'received' })}
        />
      </StatTiles>

      {/* ── Tầng 2 — tab vòng đời, chọn một ────────────────────────────────
          Bỏ chọn bằng tab "Tất cả" chứ không bấm lại tab đang sáng: Radix
          không phát `onValueChange` khi bấm đúng tab hiện hành, và "bấm lại để
          bỏ" vốn cũng là cử chỉ không ai đoán ra. */}
      <Tabs
        value={filter.bucket}
        onValueChange={(v) => set({ bucket: v as PoFilterState['bucket'] })}
      >
        <TabsList
          variant="line"
          className="flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"
        >
          <TabsTrigger value="all" className="group/tab gap-1.5">
            Tất cả <Count n={counts.all} />
          </TabsTrigger>
          {PO_BUCKETS.map((b) => (
            <TabsTrigger
              key={b.key}
              value={b.key}
              // Rổ rỗng thì không bấm được, nhưng VẪN BÀY: giấu đi là hàng tab
              // nhảy chỗ mỗi lần dữ liệu đổi, không ai nhắm trúng nút biết nhảy.
              disabled={counts[b.key] === 0 && filter.bucket !== b.key}
              className="group/tab gap-1.5"
            >
              {b.label} <Count n={counts[b.key]} />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── Tầng 3 — tìm, lọc chọn, công tắc phụ ───────────────────────── */}
      <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5">
        <ToolbarInput
          value={filter.q}
          onChange={(q) => set({ q })}
          placeholder="Tìm số PO, NCC, LSX, mã đơn hàng…"
          icon={<Search />}
          className="min-w-[220px] flex-1"
        />

        <ToolbarSelect
          value={filter.supplierId}
          onChange={(supplierId) => set({ supplierId })}
          options={supplierOptions}
          className="max-w-[200px]"
          aria-label="Lọc theo nhà cung cấp"
        />

        <ToolbarSelect
          value={filter.type}
          onChange={(type) => set({ type })}
          options={TYPE_OPTIONS}
          aria-label="Lọc theo loại đơn"
        />

        <span className="bg-border mx-0.5 hidden h-5 w-px sm:block" aria-hidden />

        <SlidersHorizontal
          className="text-muted-foreground size-3.5 shrink-0"
          aria-hidden
        />
        {showMine && (
          <FilterChip
            label="Của tôi"
            count={counts.mine}
            icon={User}
            title="Chỉ đơn do tôi lập"
            active={filter.mine}
            onClick={() => set({ mine: !filter.mine })}
          />
        )}
        <FilterChip
          label="Chưa hẹn giao"
          count={counts.noEta}
          icon={CalendarOff}
          title="Đơn chưa có ngày hẹn giao — không theo dõi trễ được"
          active={filter.noEta}
          onClick={() => set({ noEta: !filter.noEta })}
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {busy && (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Spinner size={12} /> Đang xử lý…
            </span>
          )}

          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilter({ ...filter, ...EMPTY })}
            >
              <X aria-hidden /> Bỏ lọc
            </Button>
          )}

          {/* Kiểu xem — "theo lệnh" để nắm việc, "danh sách" để soi một đơn.
              KHÔNG phải bộ lọc, nên tách hẳn sang phải và "Bỏ lọc" không đụng. */}
          <div className="border-border inline-flex rounded-lg border p-0.5">
            {VIEWS.map(([v, label]) => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={view === v}
                onClick={() => onView(v)}
                className={cn(
                  'h-7 px-2.5 text-[12px]',
                  view === v
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-muted-foreground',
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Số bên cạnh nhãn tab. Trong tab đang chọn thì ăn tint accent. */
function Count({ n }: { n: number }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-1.5 font-mono text-[11px] tabular-nums group-data-[state=active]/tab:bg-[var(--accent)] group-data-[state=active]/tab:text-[var(--accent-foreground)]">
      {n}
    </span>
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
