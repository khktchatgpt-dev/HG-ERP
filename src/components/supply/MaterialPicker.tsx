'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'
import { AnchoredPopover } from '@/components/erp/AnchoredPopover'
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

/** Số ký tự tối thiểu mới gọi API — xem ghi chú ở effect tìm kiếm bên dưới. */
const MIN_CHARS = 2
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
  needs,
}: {
  template: PoTemplate
  /** Vật tư đã có trên dòng khác — chặn trùng dòng. */
  usedIds: Set<string>
  onPick: (m: PoMaterial) => void
  autoFocus?: boolean
  placeholder?: string
  /**
   * SL đề xuất mua theo nhu cầu BOM của LSX, theo `material_id`.
   *
   * Hiện ngay trong kết quả tìm thay vì bắt người dùng nhìn sang panel nhu cầu
   * riêng: lúc gõ tên vật tư mới đúng là lúc cần biết "lệnh này cần bao nhiêu".
   */
  needs?: Map<string, number>
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<PoMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement
      // Danh sách kết quả vẽ ở body (AnchoredPopover) nên KHÔNG nằm trong boxRef —
      // thiếu vế này thì cú bấm chọn vật tư bị coi là "bấm ra ngoài" và đóng luôn.
      if (t.closest('[data-anchored-popover]')) return
      if (!boxRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  /** Mở danh sách và ghi lại vị trí ô — popover vẽ ở body nên cần toạ độ tuyệt đối. */
  function openList() {
    setOpen(true)
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setAnchor(r)
  }

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
   * CHỈ GỌI API KHI ĐÃ GÕ ĐỦ `MIN_CHARS` KÝ TỰ.
   *
   * Trước đây mở ô là nạp sẵn 25 vật tư (term rỗng). Ô này nằm ở CUỐI MỖI DÒNG và
   * mở lại sau mỗi lần thêm dòng, nên soạn một đơn 20 dòng là ~20 request + 20×25
   * bản ghi kéo từ Supabase mà không ai đọc — chỉ để hiện một danh sách ngẫu nhiên
   * theo mã. Egress Supabase tính tiền theo byte nên đây là khoản phí thuần tuý.
   *
   * 1 ký tự cũng không tìm: "v" khớp gần hết danh mục, vừa tốn vừa vô dụng.
   * Mọi setState nằm trong callback của timer, không gọi thẳng trong thân effect.
   */
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < MIN_CHARS) {
      const t = setTimeout(() => setRows([]), 0)
      return () => clearTimeout(t)
    }
    // Đã tìm rồi thì lấy từ cache, không chờ debounce.
    const instant = cache.has(`${template}|${term}`)
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
          openList()
        }}
        onFocus={openList}
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
      {open && anchor && (
        <AnchoredPopover
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={Math.max(420, anchor.width)}
        >
          <div id={listId} role="listbox">
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
                {q.trim().length < MIN_CHARS
                  ? `Gõ ít nhất ${MIN_CHARS} ký tự để tìm vật tư.`
                  : `Không có vật tư nào khớp “${q.trim()}” trong nhóm ${meta.label.toLowerCase()}.`}
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
                    {needs?.get(m.id) ? (
                      <span className="rounded bg-sky-50 px-1.5 font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        lệnh cần {num(needs.get(m.id)!)} {m.unit}
                      </span>
                    ) : null}
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
        </AnchoredPopover>
      )}
    </div>
  )
}
