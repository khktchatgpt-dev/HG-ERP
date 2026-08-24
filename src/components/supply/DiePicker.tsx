'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { AnchoredPopover } from '@/components/erp/AnchoredPopover'

export type Die = {
  id: string
  code: string
  name: string | null
  profile_spec: string | null
  weight_per_m: number | null
  supplier_name: string | null
}

const cache = new Map<string, Die[]>()

/** Chưa gõ đủ chừng này ký tự thì KHÔNG gọi API — xem ghi chú ở effect bên dưới. */
const MIN_CHARS = 2

async function search(q: string): Promise<Die[]> {
  const hit = cache.get(q)
  if (hit) return hit
  const params = new URLSearchParams({ limit: '20' })
  if (q) params.set('q', q)
  const data = await api<{ dies: Die[] }>(`/api/dept/technical/dies?${params}`)
  if (cache.size >= 60) cache.clear()
  cache.set(q, data.dies)
  return data.dies
}

/**
 * Ô mã khuôn trên dòng đơn NHÔM — chọn khuôn là kéo theo `kg/m`, thứ quyết định
 * tổng kg và do đó thành tiền của dòng.
 *
 * Vẫn cho GÕ TỰ DO: 136 khuôn trong danh mục không phủ hết trường hợp (khuôn mới
 * mở chưa kịp khai, hàng đặt theo quy cách chợ không qua khuôn riêng). Gõ tay thì
 * kg/m để nhân viên tự nhập ở ô bên cạnh.
 */
export function DiePicker({
  value,
  onPick,
  onTextChange,
  ariaLabel,
  inputClassName,
  placeholder = 'TD-B768…',
}: {
  value: string
  /** Chọn từ danh mục — form tự điền kg/m và quy cách. */
  onPick: (d: Die) => void
  /** Gõ tay — chỉ đổi mã, kg/m giữ nguyên. */
  onTextChange: (code: string) => void
  ariaLabel?: string
  /** Đè kiểu ô nhập — lưới định mức truyền kiểu ô bảng tính vào đây. */
  inputClassName?: string
  /** Đè placeholder — null = không hiện (dòng đã có dữ liệu, placeholder là nhiễu). */
  placeholder?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [rows, setRows] = useState<Die[]>([])
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement
      // Danh sách vẽ ở body (thoát khung cuộn của bảng) nên không nằm trong boxRef.
      if (t.closest('[data-anchored-popover]')) return
      if (!boxRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  /** Mở danh sách + ghi vị trí ô để popover neo đúng chỗ. */
  function openList() {
    setOpen(true)
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setAnchor(r)
  }

  const run = useCallback(async (term: string) => {
    try {
      setRows(await search(term))
      setActive(0)
    } catch {
      setRows([])
    }
  }, [])

  /*
   * Chỉ gọi API khi đã gõ đủ ký tự. Mỗi dòng đơn nhôm có một ô mã khuôn; mở ô là
   * nạp sẵn 20 khuôn (term rỗng) thì một đơn 15 dòng đi 15 request Supabase chỉ
   * để hiện danh sách chẳng liên quan tới thứ đang đặt.
   */
  useEffect(() => {
    if (!open) return
    const term = value.trim()
    if (term.length < MIN_CHARS) {
      const t = setTimeout(() => setRows([]), 0)
      return () => clearTimeout(t)
    }
    const instant = cache.has(term)
    const t = setTimeout(() => void run(term), instant ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, value, run])

  function choose(d: Die) {
    onPick(d)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onTextChange(e.target.value)
          openList()
        }}
        onFocus={openList}
        onKeyDown={(e) => {
          if (e.key === 'Escape') return setOpen(false)
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            setActive((i) =>
              Math.max(
                0,
                Math.min(rows.length - 1, e.key === 'ArrowDown' ? i + 1 : i - 1),
              ),
            )
            return
          }
          if (e.key === 'Enter' && open && rows[active]) {
            e.preventDefault()
            choose(rows[active])
          }
        }}
        placeholder={placeholder ?? undefined}
        aria-label={ariaLabel}
        className={
          inputClassName ??
          'h-[30px] w-full rounded-md border border-zinc-300 px-2 font-mono text-[12px] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
        }
      />
      {open && anchor && rows.length > 0 && (
        <AnchoredPopover
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={320}
          maxHeight={288}
        >
          <div role="listbox">
            {rows.map((d, i) => (
              <button
                key={d.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(d)}
                className={`flex w-full flex-col items-start px-3 py-1.5 text-left ${
                  i === active
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-sky-50 dark:hover:bg-sky-950/40'
                }`}
              >
                <span className="flex w-full items-center gap-2 text-[12px]">
                  <span className="font-mono">{d.code}</span>
                  {d.weight_per_m != null && (
                    <span className="ml-auto font-semibold text-violet-600 dark:text-violet-400">
                      {d.weight_per_m} kg/m
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-[11px] text-zinc-400">
                  {[d.profile_spec, d.name].filter(Boolean).join(' · ') || '—'}
                </span>
              </button>
            ))}
          </div>
        </AnchoredPopover>
      )}
    </div>
  )
}
