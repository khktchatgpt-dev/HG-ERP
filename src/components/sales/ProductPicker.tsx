'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/erp/Spinner'

/** Quy cách đóng gói (từ Kỹ thuật) — mọi field optional, thiếu = chưa khai. */
export type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
  nw_kg?: number
  gw_kg?: number
  pack_unit_label?: string
}

/** SP như ô chọn / dòng báo giá cần — khớp payload `/api/dept/sales/products`. */
export type ProductPick = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  description_en: string | null
  has_image: boolean
  packing: Packing
}

const BOM_LABEL = { none: 'Chưa có BOM', drawing: 'Đang vẽ', done: 'Đã vẽ' } as const
const BOM_TONE = { none: 'gray', drawing: 'amber', done: 'green' } as const

/**
 * Cache kết quả tìm theo (khách, từ khoá) — sống theo tab, DÙNG CHUNG mọi dòng của
 * form. Báo giá 8 dòng vì thế tốn 1 request cho danh sách mặc định chứ không 8;
 * gõ lại từ khoá cũ cũng không gọi lại Supabase.
 */
const cache = new Map<string, { rows: ProductPick[]; fuzzy: boolean }>()
const CACHE_MAX = 60

/** Xoá cache khi vừa tạo/sửa SP — danh sách cũ đã lạc hậu. */
export function invalidateProductPickCache(): void {
  cache.clear()
}

async function search(
  customerId: string | null,
  q: string,
): Promise<{ rows: ProductPick[]; fuzzy: boolean }> {
  const key = `${customerId ?? ''}|${q}`
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({ limit: '25' })
  if (q) params.set('q', q)
  else if (customerId) params.set('customer_id', customerId)
  const data = await api<{ products: ProductPick[]; fuzzy: boolean }>(
    `/api/dept/sales/products?${params}`,
  )
  const out = { rows: data.products, fuzzy: data.fuzzy }
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, out)
  return out
}

/** Nạp lại đúng các SP đang nằm trên dòng (mở form sửa báo giá/đơn). */
export async function fetchProductsByIds(ids: string[]): Promise<ProductPick[]> {
  if (ids.length === 0) return []
  const data = await api<{ products: ProductPick[] }>(
    `/api/dept/sales/products?ids=${ids.join(',')}&limit=50`,
  )
  return data.products
}

const inputCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-card w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]'

/**
 * Ô chọn sản phẩm cho form báo giá / đơn hàng — TÌM Ở SERVER.
 *
 * Thay cái `<select>` cũ nạp sẵn cả thư viện (537 SP ≈ 715 kB egress Supabase mỗi
 * lần mở trang, và một danh sách 537 dòng thì cũng không lướt nổi). Mặc định hiện
 * SP của khách đang chọn + mẫu chung; gõ để tìm toàn thư viện (chịu được lỗi gõ,
 * tìm cả theo mã cũ và mã KH đặt).
 */
export function ProductPicker({
  value,
  selected,
  customerId,
  usedIds,
  onPick,
  disabled,
}: {
  /** id SP đang chọn ('' = chưa chọn). */
  value: string
  /** Dữ liệu SP đang chọn — để hiện mã/tên khi chưa mở panel. */
  selected?: ProductPick
  customerId: string | null
  /** Các SP đã dùng ở dòng khác — chặn trùng dòng. */
  usedIds: Set<string>
  onPick: (p: ProductPick) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProductPick[]>([])
  const [fuzzy, setFuzzy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Đóng khi bấm ra ngoài / nhấn Esc.
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const run = useCallback(
    async (term: string) => {
      // Có trong cache thì dùng ngay, đừng nháy "Đang tìm…" cho một microtask.
      const cached = cache.get(`${customerId ?? ''}|${term}`)
      if (cached) {
        setRows(cached.rows)
        setFuzzy(cached.fuzzy)
        setActive(0)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const out = await search(customerId, term)
        setRows(out.rows)
        setFuzzy(out.fuzzy)
        setActive(0)
      } catch {
        setRows([])
        setError('Không tải được danh sách sản phẩm')
      } finally {
        setLoading(false)
      }
    },
    [customerId],
  )

  /*
   * Mở panel / gõ thêm → tìm sau 250ms (khỏi bắn request mỗi ký tự). Mọi setState
   * nằm trong `run` chạy từ timer, không gọi thẳng trong thân effect — cascading
   * render (react-hooks/set-state-in-effect).
   */
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    const instant = !term || cache.has(`${customerId ?? ''}|${term}`)
    const t = setTimeout(() => void run(term), instant ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, q, customerId, run])

  const groups = useMemo(() => {
    const own: ProductPick[] = []
    const common: ProductPick[] = []
    const others: ProductPick[] = []
    for (const p of rows) {
      if (customerId && p.customer_id === customerId) own.push(p)
      else if (!p.customer_id) common.push(p)
      else others.push(p)
    }
    return [
      { label: 'SP của khách này', items: own },
      { label: 'Mẫu chung', items: common },
      { label: 'SP khách khác', items: others },
    ].filter((g) => g.items.length > 0)
  }, [rows, customerId])

  // Thứ tự phẳng theo đúng thứ tự hiện trên panel — cho điều hướng bằng bàn phím.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  function choose(p: ProductPick) {
    if (usedIds.has(p.id) && p.id !== value) return
    onPick(p)
    setOpen(false)
    setQ('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1
        return Math.max(0, Math.min(flat.length - 1, next))
      })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const p = flat[active]
      if (p) choose(p)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className={`${inputCls} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        {selected ? (
          <span className="min-w-0 truncate">
            <span className="font-mono text-xs">{selected.code}</span> — {selected.name}
          </span>
        ) : (
          <span className="text-zinc-400">— chọn sản phẩm —</span>
        )}
        <span className="shrink-0 text-xs text-zinc-400">▾</span>
      </button>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Gõ mã SP, mã cũ, mã KH đặt hoặc tên…"
        className={inputCls}
      />
      <div
        id={listId}
        role="listbox"
        className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-500">
            <Spinner size={14} /> Đang tìm…
          </div>
        )}
        {!loading && error && (
          <div className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
        {!loading && !error && flat.length === 0 && (
          <div className="px-3 py-3 text-sm text-zinc-500">
            {q.trim()
              ? `Không tìm thấy SP nào khớp “${q.trim()}” — thử mã cũ, hoặc tạo SP mới bên dưới.`
              : 'Thư viện chưa có SP nào.'}
          </div>
        )}
        {!loading && fuzzy && flat.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-500">
            Không khớp chính xác — đây là các SP gần giống nhất.
          </div>
        )}
        {!loading &&
          groups.map((g) => (
            <div key={g.label}>
              <div className="sticky top-0 bg-zinc-50 px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800">
                {g.label}
              </div>
              {g.items.map((p) => {
                const i = flat.indexOf(p)
                const used = usedIds.has(p.id) && p.id !== value
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.id === value}
                    disabled={used}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(p)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                      i === active ? 'bg-accent' : ''
                    } ${used ? 'cursor-not-allowed opacity-40' : 'hover:bg-accent'}`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">{p.code}</span>
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {used && <span className="text-[10px] text-zinc-400">đã dùng</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                      <Badge tone={BOM_TONE[p.bom_status]}>
                        {BOM_LABEL[p.bom_status]}
                      </Badge>
                      {p.customer_item_code && (
                        <span className="font-mono">KH: {p.customer_item_code}</span>
                      )}
                      {!p.has_image && (
                        <span className="text-amber-600 dark:text-amber-500">
                          chưa có ảnh
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
      </div>
    </div>
  )
}
