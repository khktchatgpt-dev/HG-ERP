'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

export type Die = {
  id: string
  code: string
  name: string | null
  profile_spec: string | null
  weight_per_m: number | null
  supplier_name: string | null
}

const cache = new Map<string, Die[]>()

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
}: {
  value: string
  /** Chọn từ danh mục — form tự điền kg/m và quy cách. */
  onPick: (d: Die) => void
  /** Gõ tay — chỉ đổi mã, kg/m giữ nguyên. */
  onTextChange: (code: string) => void
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Die[]>([])
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const run = useCallback(async (term: string) => {
    try {
      setRows(await search(term))
      setActive(0)
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const term = value.trim()
    const instant = !term || cache.has(term)
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
        value={value}
        onChange={(e) => {
          onTextChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
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
        placeholder="TD-B768…"
        aria-label={ariaLabel}
        className="h-[30px] w-full rounded-md border border-zinc-300 px-2 font-mono text-[12px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      {open && rows.length > 0 && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-[320px] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
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
      )}
    </div>
  )
}
