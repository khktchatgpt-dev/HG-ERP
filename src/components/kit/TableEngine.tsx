'use client'

import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  columnVisibilityFeature,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { DropdownMenu as D } from 'radix-ui'
import { Btn } from './Primitives'
import { Ico } from './Icon'
import { cn } from '@/lib/utils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MÁY BẢNG — một máy, hai vỏ (B5, 24/09/2026)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `@tanstack/react-table` (v9, không kèm kiểu) lo DỮ LIỆU: sắp xếp, ẩn/hiện
 * cột. Kit lo HÌNH: hai vỏ `Table` (màn danh sách toàn trang) và `Grid` (lưới
 * dòng chứng từ trong khối) cùng nhận `engine={…}` từ hook này.
 *
 * VÌ SAO GIỮ HAI VỎ. Chúng trả lời hai câu khác nhau (khuôn C vs khuôn D):
 * `Table` tự cuộn cả hai chiều, tiêu đề + chân dính; `Grid` cao theo nội dung,
 * nằm trong FastTab. Gộp vỏ là ép một bảng phải biết mình đang ở khuôn nào.
 * Cái từng trùng thật là PHẦN MÁY — giờ chung.
 *
 * VÌ SAO KHÔNG BỎ KIỂU GHÉP JSX. `Table` cũ không nhận `columns[]` có chủ ý:
 * `DataTable` v3 khai cột bằng cấu hình rồi cứ phải đục lỗ thoát cho mỗi ô
 * đặc biệt. Ở đây `cell` trả JSX TỰ DO — không có lỗ nào phải đục — và kiểu
 * ghép `<Row><Cell>` vẫn nguyên cho ~1.100 chỗ đang dùng. Màn nào cần sắp xếp,
 * chọn cột, hay có > 200 dòng thì chuyển sang máy khi có việc chạm tới.
 *
 * `columns` phải ỔN ĐỊNH (khai ở module hoặc `useMemo`) — mảng mới mỗi lượt vẽ
 * làm máy tính lại cả mô hình dòng.
 */

const FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnVisibilityFeature,
})

export type KitCol<T> = {
  id: string
  header: ReactNode
  /** Tên chữ trơn — cho menu chọn cột. Bỏ trống thì dùng `header` nếu là chuỗi. */
  label?: string
  cell: (row: T) => ReactNode
  /** Có = cột sắp xếp được, theo giá trị này. Chuỗi so theo tiếng Việt. */
  sort?: (row: T) => string | number | null | undefined
  num?: boolean
  grow?: boolean
  muted?: boolean
  /** Ghim trái khi cuộn ngang — cột ĐỊNH DANH. Cột ghim không ẩn được. */
  pin?: boolean
  /**
   * Ô của cột này là TIÊU ĐỀ DÒNG (`<th scope="row">`, hình không đổi) — đặt cho
   * cột định danh, một cột mỗi bảng. Khai riêng, không suy từ `pin`: cột ghim là
   * chuyện BỐ CỤC, tiêu đề dòng là chuyện NGHĨA, và có bảng ghim cột mã nhưng
   * tên dòng lại là cột tên. Chỉ vỏ `Table` đọc cờ này.
   */
  rowHeader?: boolean
  /** Bề rộng cố định (lưới `Grid`). */
  width?: number
  title?: (row: T) => string | undefined
  /** Nhấn theo vòng đời dữ liệu (`Grid`). */
  tone?: (row: T) => 'stop' | 'warn' | 'done' | undefined
  /** Ô tổng ở chân bảng. Không có = cột này thuộc dải gộp (xem `footRuns`). */
  foot?: ReactNode
  /** Mặc định ẩn — người dùng bật trong menu. */
  hidden?: boolean
  /** Mặc định: ẩn được, trừ cột ghim. */
  hideable?: boolean
}

export type Density = 'thuong' | 'day'
export type SortDir = 'asc' | 'desc' | false

export type KitEngine<T> = {
  rows: T[]
  cols: KitCol<T>[]
  allCols: KitCol<T>[]
  keyOf: (row: T) => string
  sortOf: (id: string) => SortDir
  toggleSort: (id: string) => void
  isVisible: (id: string) => boolean
  setVisible: (id: string, v: boolean) => void
  canHide: (col: KitCol<T>) => boolean
  density: Density
  setDensity: (d: Density) => void
  reset: () => void
  /** Chân bảng khai ở mức bảng: nhãn đầu dải, câu lưu ý cuối dải. */
  foot?: { label: ReactNode; note?: ReactNode }
}

const COLL = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })
function soSanh(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return COLL.compare(String(a), String(b))
}

/*
  LỰA CHỌN CỦA NGƯỜI XEM (cột ẩn, mật độ) — một KHO NGOÀI, đọc qua
  `useSyncExternalStore`, không phải `useState` + effect nạp lại.

  Vì sao: HTML vẽ ở server không biết localStorage. Đọc nó ngay trong lượt vẽ
  đầu là lệch hydrate; nạp trong effect rồi `setState` là vẽ hai lần và bị luật
  React chặn (setState đồng bộ trong effect). Kho ngoài có sẵn đường cho cả hai:
  server lấy `null` (mặc định), client lấy giá trị đã nhớ — React tự nối.

  Không có `prefsKey` thì nhớ trong bộ nhớ của trang (mất khi tải lại).
*/
type Prefs = { hidden?: string[]; density?: Density }
const PREF_KEY = (k: string) => `kit-table:${k}`
const boNho = new Map<string, string>()
const nghe = new Set<() => void>()

function docTho(k: string): string | null {
  if (k.startsWith('mem:')) return boNho.get(k) ?? null
  try {
    return localStorage.getItem(PREF_KEY(k))
  } catch {
    return null
  }
}
function ghiTho(k: string, p: Prefs) {
  const s = JSON.stringify(p)
  if (k.startsWith('mem:')) boNho.set(k, s)
  else
    try {
      localStorage.setItem(PREF_KEY(k), s)
    } catch {
      // Chế độ riêng tư / bị chặn lưu trữ: nhớ tạm trong trang, bảng vẫn chạy.
      boNho.set(`mem:${k}`, s)
    }
  nghe.forEach((f) => f())
}
function dangKy(f: () => void) {
  nghe.add(f)
  // Tab khác đổi lựa chọn → tab này theo luôn.
  window.addEventListener('storage', f)
  return () => {
    nghe.delete(f)
    window.removeEventListener('storage', f)
  }
}
function parse(s: string | null): Prefs {
  if (!s) return {}
  try {
    return JSON.parse(s) as Prefs
  } catch {
    return {}
  }
}

export function useKitTable<T>({
  rows,
  columns,
  rowKey,
  prefsKey,
  initialSort,
  foot,
}: {
  rows: T[]
  /** Phải ỔN ĐỊNH — khai ở module hoặc `useMemo`. Mảng mới = máy tính lại. */
  columns: KitCol<T>[]
  rowKey: (row: T) => string
  /**
   * Khoá nhớ lựa chọn của NGƯỜI XEM (cột ẩn, mật độ) trên máy họ. Carbon, Fiori
   * đều coi mật độ là tuỳ chọn người dùng — người quen Excel muốn dày, người
   * mới muốn thưa, không màn nào chọn thay được cho cả hai.
   */
  prefsKey?: string
  initialSort?: { id: string; desc?: boolean }
  foot?: { label: ReactNode; note?: ReactNode }
}): KitEngine<T> {
  const tuDat = useId()
  const khoa = prefsKey ?? `mem:${tuDat}`
  const tho = useSyncExternalStore(
    dangKy,
    () => docTho(khoa),
    () => null,
  )
  const prefs = useMemo(() => parse(tho), [tho])

  const macDinhAn = useMemo(
    () => columns.filter((c) => c.hidden).map((c) => c.id),
    [columns],
  )
  const hidden = prefs.hidden ?? macDinhAn
  const columnVisibility = useMemo(
    () => Object.fromEntries(hidden.map((id) => [id, false])),
    [hidden],
  )
  const density: Density = prefs.density ?? 'thuong'
  const luu = (p: Prefs) => ghiTho(khoa, { hidden, density, ...p })

  const batDau = initialSort ? [{ id: initialSort.id, desc: !!initialSort.desc }] : []
  const [sorting, setSorting] = useState(batDau)

  // Máy chỉ cần id + cách lấy giá trị sắp xếp; ô vẽ ra do kit tự lo từ `cell`.
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])
  const defs = useMemo(
    () =>
      columns.map((c) => ({
        id: c.id,
        accessorFn: (r: T) => c.sort?.(r) ?? undefined,
        enableSorting: !!c.sort,
        enableHiding: c.hideable ?? !c.pin,
        sortUndefined: 'last' as const,
        sortFn: (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }, cid: string) => soSanh(a.getValue(cid), b.getValue(cid)), // prettier-ignore
      })),
    [columns],
  )

  const table = useTable({
    features: FEATURES,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cột kit tự định kiểu ở KitCol; máy chỉ thấy id + accessor
    columns: defs as any,
    // `RowData` của TanStack là `object | unknown[]`; dòng kit là bất kỳ T nào.
    data: rows as unknown as object[],
    getRowId: (r: object) => rowKey(r as T),
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (u) => {
      const next = typeof u === 'function' ? u(columnVisibility) : u
      luu({ hidden: Object.keys(next).filter((k) => next[k] === false) })
    },
  })

  const sortOf = (id: string): SortDir => {
    const s = sorting.find((x) => x.id === id)
    return s ? (s.desc ? 'desc' : 'asc') : false
  }
  return {
    rows: table.getRowModel().rows.map((r) => r.original as T),
    cols: table
      .getVisibleLeafColumns()
      .map((c) => byId.get(c.id))
      .filter((c): c is KitCol<T> => !!c),
    allCols: columns,
    keyOf: rowKey,
    sortOf,
    // Vòng ba nhịp: tăng → giảm → bỏ. Một cột một lúc — sắp nhiều tầng là
    // việc của báo cáo, không phải của một danh sách để tìm dòng cần động.
    toggleSort: (id) => {
      const d = sortOf(id)
      setSorting(
        d === false ? [{ id, desc: false }] : d === 'asc' ? [{ id, desc: true }] : [],
      )
    },
    isVisible: (id) => !hidden.includes(id),
    setVisible: (id, v) =>
      luu({ hidden: v ? hidden.filter((x) => x !== id) : [...hidden, id] }),
    canHide: (c) => c.hideable ?? !c.pin,
    density,
    setDensity: (d) => luu({ density: d }),
    reset: () => {
      ghiTho(khoa, {})
      setSorting(batDau)
    },
    foot,
  }
}

/* ── Tiêu đề cột sắp xếp được ────────────────────────────────────────── */

/**
 * Nội dung ô tiêu đề. Cột sắp được thì là NÚT (Tab tới được, Enter đảo chiều);
 * `aria-sort` đặt ở `<th>` (xem `sortAria`). Mũi tên luôn hiện mờ ở cột sắp
 * được — ẩn tới khi rê chuột là giấu tính năng khỏi người không rê chuột.
 */
export function SortHead({
  children,
  dir,
  onSort,
  align,
}: {
  /** Chữ tiêu đề cột. */
  children: ReactNode
  /**
   * Chiều đang sắp của cột này: `'asc'`, `'desc'`, hoặc `false`/`undefined` =
   * chưa sắp (mũi tên hai đầu, mờ). `aria-sort` KHÔNG đặt ở đây mà ở `<th>` — dùng `sortAria(dir, true)`.
   */
  dir: SortDir | undefined
  /**
   * Bấm để đảo chiều. Bỏ trống = cột không sắp được: trả chữ trơn, không có nút
   * giả, không có mũi tên.
   */
  onSort?: () => void
  /** `'right'` cho cột số: mũi tên đứng TRƯỚC chữ, để chữ vẫn thẳng mép phải với số bên dưới. */
  align?: 'right'
}) {
  if (!onSort) return <>{children}</>
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'inline-flex items-center gap-1 uppercase hover:text-[var(--ink)]',
        align === 'right' && 'flex-row-reverse',
        dir && 'text-[var(--ink)]',
      )}
    >
      {children}
      <Ico
        name={dir === 'asc' ? 'sapTang' : dir === 'desc' ? 'sapGiam' : 'sapXep'}
        size={12}
        className={dir ? undefined : 'opacity-50'}
      />
    </button>
  )
}

export const sortAria = (dir: SortDir | undefined, sortable: boolean) =>
  !sortable
    ? undefined
    : dir === 'asc'
      ? 'ascending'
      : dir === 'desc'
        ? 'descending'
        : 'none'

/* ── Chân bảng: chia dải, không bao giờ lệch cột ──────────────────────── */

export type FootCell = {
  key: string
  span: number
  node: ReactNode
  num?: boolean
  /** Ô tổng của một cột (true) hay một dải gộp các cột không có tổng (false). */
  own: boolean
}

/**
 * Chân bảng của chế độ máy — TỰ ĐẾM cột nên không lệch được.
 *
 * Lệch cột chân bảng là lỗi đã dính 7 màn (xem `useColSpanGuard`): tác giả
 * tính `colSpan` bằng tay rồi thêm/bớt một cột mà quên sửa. Ở đây mỗi cột khai
 * ô tổng của RIÊNG nó (`foot`); các cột liền nhau không có tổng gộp thành một
 * dải. Dải ĐẦU nhận `label`, dải CUỐI (sau ô tổng cuối cùng) nhận `note` —
 * câu nói tổng KHÔNG gồm gì. Người dùng ẩn cột nào thì dải tự tính lại.
 */
export function footRuns<T>(
  cols: KitCol<T>[],
  foot: { label: ReactNode; note?: ReactNode },
): FootCell[] {
  const out: FootCell[] = []
  for (const c of cols) {
    const last = out[out.length - 1]
    if (c.foot !== undefined)
      out.push({ key: c.id, span: 1, node: c.foot, num: c.num, own: true })
    else if (last && !last.own) last.span++
    else out.push({ key: `dai-${c.id}`, span: 1, node: null, own: false })
  }
  if (out.length === 0) return out

  // NHÃN ở ô đầu. Cột đầu có tổng riêng thì nhãn đứng trước con số trong ô đó.
  const dau = out[0]
  dau.node = dau.own ? (
    <>
      {foot.label} {dau.node}
    </>
  ) : (
    foot.label
  )

  // LƯU Ý ở dải trống CUỐI (không phải chính ô nhãn); không còn chỗ thì nối
  // vào sau nhãn — câu "tổng không gồm gì" không bao giờ được rơi mất.
  if (foot.note != null) {
    const cuoi = out[out.length - 1]
    if (cuoi !== dau && !cuoi.own) cuoi.node = foot.note
    else
      dau.node = (
        <>
          {dau.node} · {foot.note}
        </>
      )
  }
  return out
}

/* ── Menu cột + mật độ ─────────────────────────────────────────────────── */

/**
 * Nút "Cột · mật độ" — đặt trên `FilterBar` của màn. Menu Radix: ô tick cho
 * từng cột (mũi tên + Space), nhóm chọn một cho mật độ, và "Đặt lại". Cột ghim
 * (định danh) khoá — bảng mất cột định danh thì mọi dòng thành vô danh.
 */
export function TableSettings<T>({
  engine,
}: {
  /** Máy của bảng — CÙNG đối tượng `useKitTable` trả về và đưa cho `<Table engine>`/`<Grid engine>`. */
  engine: KitEngine<T>
}) {
  const ten = (c: KitCol<T>) =>
    c.label ?? (typeof c.header === 'string' ? c.header : c.id)
  const an = engine.allCols.filter((c) => !engine.isVisible(c.id)).length
  return (
    <D.Root>
      <D.Trigger asChild>
        <Btn icon="cot" aria-label={`Cột và mật độ${an ? ` — đang ẩn ${an} cột` : ''}`}>
          Cột{an ? ` (ẩn ${an})` : ''}
        </Btn>
      </D.Trigger>
      <D.Portal>
        <div className="kit contents">
          <D.Content
            align="end"
            sideOffset={4}
            collisionPadding={8}
            className="text-k-sm z-[var(--z-pop)] min-w-[220px] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[var(--shadow-drop)]"
          >
            <D.Label className="text-k-label px-3 py-1 font-bold tracking-[.06em] text-[var(--ink-label)] uppercase">
              Cột hiển thị
            </D.Label>
            {engine.allCols.map((c) => (
              <D.CheckboxItem
                key={c.id}
                checked={engine.isVisible(c.id)}
                disabled={!engine.canHide(c)}
                // Giữ menu mở khi tick: chọn năm cột không phải mở menu năm lần.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(v) => engine.setVisible(c.id, v === true)}
                className={ITEM}
              >
                <span className="grid size-4 place-items-center">
                  <D.ItemIndicator>
                    <Ico name="tick" size={14} />
                  </D.ItemIndicator>
                </span>
                {ten(c)}
                {!engine.canHide(c) && (
                  <span className="text-k-label ml-auto text-[var(--ink-3)]">
                    định danh
                  </span>
                )}
              </D.CheckboxItem>
            ))}
            <D.Separator className="my-1 h-px bg-[var(--hair)]" />
            <D.Label className="text-k-label px-3 py-1 font-bold tracking-[.06em] text-[var(--ink-label)] uppercase">
              Mật độ dòng
            </D.Label>
            <D.RadioGroup
              value={engine.density}
              onValueChange={(v) => engine.setDensity(v as Density)}
            >
              {(
                [
                  ['thuong', 'Thường — dễ đọc'],
                  ['day', 'Dày — thấy nhiều dòng hơn'],
                ] as const
              ).map(([v, t]) => (
                <D.RadioItem
                  key={v}
                  value={v}
                  className={ITEM}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="grid size-4 place-items-center">
                    <D.ItemIndicator>
                      <Ico name="tick" size={14} />
                    </D.ItemIndicator>
                  </span>
                  {t}
                </D.RadioItem>
              ))}
            </D.RadioGroup>
            <D.Separator className="my-1 h-px bg-[var(--hair)]" />
            <D.Item className={ITEM} onSelect={() => engine.reset()}>
              <span className="size-4" />
              Đặt lại như mặc định
            </D.Item>
          </D.Content>
        </div>
      </D.Portal>
    </D.Root>
  )
}

const ITEM =
  'flex cursor-default items-center gap-2 px-3 py-1.5 outline-none select-none data-[disabled]:text-[var(--ink-empty)] data-[highlighted]:bg-[var(--act-wash)] data-[highlighted]:text-[var(--act-text)]'
