'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'

/** Khớp payload `/api/dept/supply/po-materials`. */
export type PoMaterial = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  spec: string | null
  po_template: PoTemplate | null
  kg_per_m: number | null
  default_bar_length_m: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  on_hand: number
}

/**
 * Cache theo (mẫu đơn, từ khoá) — sống theo tab, DÙNG CHUNG mọi dòng của form.
 * Đơn 20 dòng vì thế tốn 1 request cho danh sách mặc định chứ không 20.
 */
const cache = new Map<string, PoMaterial[]>()
const CACHE_MAX = 60

export function invalidateMaterialPickCache(): void {
  cache.clear()
}

async function search(template: PoTemplate, q: string): Promise<PoMaterial[]> {
  const key = `${template}|${q}`
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({ limit: '25', template })
  if (q) params.set('q', q)
  const data = await api<{ materials: PoMaterial[] }>(
    `/api/dept/supply/po-materials?${params}`,
  )
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, data.materials)
  return data.materials
}

/** Nạp lại đúng các vật tư đang nằm trên dòng (mở form sửa đơn). */
export async function fetchMaterialsByIds(ids: string[]): Promise<PoMaterial[]> {
  if (ids.length === 0) return []
  const data = await api<{ materials: PoMaterial[] }>(
    `/api/dept/supply/po-materials?ids=${ids.join(',')}`,
  )
  return data.materials
}

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Ô chọn vật tư của form soạn đơn — TÌM Ở SERVER, lọc theo mẫu đơn đang soạn.
 *
 * Đây là ô nhập ĐẦU của mỗi dòng: chọn xong thì con trỏ tự nhảy sang SL (qua
 * `onPick` ở form), nên cả đơn nhập được bằng bàn phím. Thay hẳn lối cũ "sang
 * vùng nhu cầu bên trái, bấm +, quay lại bảng" — vùng nhu cầu vẫn còn nhưng
 * thành đường tắt, không phải cửa bắt buộc.
 */
export function MaterialPicker({
  template,
  usedIds,
  onPick,
  autoFocus,
  placeholder,
}: {
  template: PoTemplate
  /** Vật tư đã có trên dòng khác — chặn trùng dòng. */
  usedIds: Set<string>
  onPick: (m: PoMaterial) => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<PoMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

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
      const cached = cache.get(`${template}|${term}`)
      if (cached) {
        setRows(cached)
        setActive(0)
        return
      }
      setLoading(true)
      setError(null)
      try {
        setRows(await search(template, term))
        setActive(0)
      } catch {
        setRows([])
        setError('Không tải được danh sách vật tư')
      } finally {
        setLoading(false)
      }
    },
    [template],
  )

  /*
   * Gõ thêm → tìm sau 250ms (khỏi bắn request mỗi ký tự). Mọi setState nằm trong
   * `run` chạy từ timer, không gọi thẳng trong thân effect — cascading render.
   */
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    const instant = !term || cache.has(`${template}|${term}`)
    const t = setTimeout(() => void run(term), instant ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, q, template, run])

  const list = useMemo(() => rows.filter((m) => !usedIds.has(m.id)), [rows, usedIds])

  function choose(m: PoMaterial) {
    onPick(m)
    setQ('')
    setOpen(false)
    // Giữ focus lại ô tìm: thêm xong một dòng là gõ tiếp dòng sau, không phải
    // với chuột lên đầu bảng.
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((i) =>
        Math.max(0, Math.min(list.length - 1, e.key === 'ArrowDown' ? i + 1 : i - 1)),
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const m = list[active]
      if (m) choose(m)
    }
  }

  const meta = poTemplateMeta(template)

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={
          placeholder ?? `Gõ mã hoặc tên vật tư (${meta.label.toLowerCase()})…`
        }
        className="h-[34px] w-full rounded-md border border-sky-300 px-2.5 text-[13px] focus:border-sky-500 focus:outline-none dark:border-sky-800 dark:bg-zinc-900"
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full min-w-[380px] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-500">
              <Spinner size={14} /> Đang tìm…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {!loading && !error && list.length === 0 && (
            <div className="px-3 py-3 text-sm text-zinc-500">
              {q.trim()
                ? `Không có vật tư nào khớp “${q.trim()}” trong nhóm ${meta.label.toLowerCase()}.`
                : 'Gõ để tìm vật tư.'}
            </div>
          )}
          {!loading &&
            list.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                  i === active
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-sky-50 dark:hover:bg-sky-950/40'
                }`}
              >
                <span className="flex w-full items-center gap-2 text-[13px]">
                  <span className="font-mono text-[11px] text-zinc-500">{m.code}</span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-400">
                  <span>
                    tồn {num(m.on_hand)} {m.unit}
                  </span>
                  {m.spec && <span className="font-mono">{m.spec}</span>}
                  {m.kg_per_m != null && <span>{m.kg_per_m} kg/m</span>}
                  {m.po_template == null && (
                    <span className="text-amber-600 dark:text-amber-500">
                      chưa khai mẫu
                    </span>
                  )}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
