'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

export type MaterialHit = {
  id: string
  code: string
  name: string
  unit: string
  /** Chiều dài cây tiêu chuẩn — điền hộ ô "dài cây" trên dòng định mức. */
  default_bar_length_m?: number | null
}

/** Nhãn hiển thị khi ô đã gắn vật tư — cùng lối viết với danh mục. */
export const materialLabel = (code: string, name: string) => `${code} · ${name}`

const cache = new Map<string, MaterialHit[]>()
const CACHE_MAX = 80

/**
 * Tìm vật tư trên TOÀN danh mục qua API (server tìm không dấu — 0127).
 *
 * Bảng chi tiết trước đây nhận sẵn 1.000 dòng đầu của danh mục rồi đổ vào một
 * `<select>`. Danh mục có 13.168 vật tư và xếp theo mã, nên 1.000 dòng ấy dừng
 * ở "BUL…": không có lấy MỘT mã nhôm (NH-…) hay inox (IX-…) nào — gắn vật tư
 * khung cho chi tiết là bất khả, và import file BOM luôn báo "không khớp danh
 * mục". Nạp theo từ khoá thì hết cận, mà cũng nhẹ hơn cho trang.
 */
export async function searchMaterials(q: string, limit = 20): Promise<MaterialHit[]> {
  const key = `${limit}|${q}`
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({
    active_only: 'true',
    page: '1',
    page_size: String(limit),
  })
  if (q) params.set('q', q)
  const { rows } = await api<{ rows: MaterialHit[] }>(
    `/api/dept/warehouse/materials?${params}`,
  )
  const out = rows.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    unit: m.unit,
    default_bar_length_m: m.default_bar_length_m ?? null,
  }))
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, out)
  return out
}

export function invalidateMaterialComboCache(): void {
  cache.clear()
}

/**
 * Ô gắn vật tư cho một dòng chi tiết: bấm để mở, gõ để tìm, Enter để chọn.
 *
 * Danh sách thả xuống dựng `position: fixed` theo toạ độ của ô — bảng chi tiết
 * nằm trong khung `overflow-x-auto` nên dropdown absolute sẽ bị cắt cụt.
 */
export function MaterialCombo({
  value,
  label,
  onPick,
  onFreeText,
  placeholder = '— chưa gắn —',
  disabled,
  className = '',
}: {
  /** Khoá đang gắn — id hay mã tuỳ nơi dùng; '' = chưa gắn (viền hổ phách). */
  value: string
  /** Nhãn "mã · tên" của vật tư đang gắn — trống thì hiện `placeholder`. */
  label: string
  onPick: (m: MaterialHit | null) => void
  /**
   * Cho phép GIỮ NGUYÊN chữ vừa gõ khi danh mục chưa có vật tư đó — hồ sơ SP
   * cần khai định mức trước cả khi Kho kịp mở mã. Bỏ trống prop này thì buộc
   * phải chọn trong danh mục (màn định hình cần material_id thật).
   */
  onFreeText?: (text: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MaterialHit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(
    null,
  )
  const boxRef = useRef<HTMLDivElement>(null)

  // Mở ô: neo dropdown vào đúng chỗ ô đang đứng (fixed → không bị khung cuộn cắt).
  function openPicker() {
    if (disabled) return
    const r = boxRef.current?.getBoundingClientRect()
    if (r) setRect({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 320) })
    setQ('')
    setActive(0)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    let alive = true
    // Gõ tới đâu tìm tới đó, chờ 220ms cho người gõ xong một từ.
    const t = setTimeout(() => {
      setLoading(true)
      void searchMaterials(q.trim())
        .then((rows) => {
          if (!alive) return
          setHits(rows)
          setActive(0)
        })
        .catch(() => alive && setHits([]))
        .finally(() => alive && setLoading(false))
    }, 220)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open])

  // Đóng khi bấm ra ngoài / cuộn trang — dropdown fixed không tự đi theo ô.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return
      if (boxRef.current?.contains(e.target)) return
      if ((e.target as Element).closest?.('[data-material-combo-list]')) return
      close()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function pick(m: MaterialHit) {
    onPick(m)
    setOpen(false)
  }

  function keepTyped() {
    const t = q.trim()
    if (!t || !onFreeText) return
    onFreeText(t)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {open ? (
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const m = hits[active]
              if (m) pick(m)
              else keepTyped()
            }
          }}
          placeholder="mã hoặc tên vật tư…"
          className="w-full rounded border border-sky-500 px-1.5 py-1 text-xs focus:outline-none dark:bg-zinc-900"
        />
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            title={label || 'Chưa gắn vật tư'}
            className={`w-full truncate rounded border px-1.5 py-1 text-left text-xs disabled:opacity-60 dark:bg-zinc-900 ${
              value
                ? 'border-zinc-300 dark:border-zinc-700'
                : 'border-amber-400 text-amber-700 dark:text-amber-400'
            }`}
          >
            {label || placeholder}
          </button>
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onPick(null)}
              title="Bỏ gắn vật tư"
              className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </div>
      )}

      {open && rect && (
        <div
          data-material-combo-list
          style={{ left: rect.left, top: rect.top, width: rect.width }}
          className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {loading && (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-zinc-500">
              <Spinner size={12} /> đang tìm…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="px-2 py-2 text-xs text-zinc-500">
              Không thấy vật tư nào khớp “{q}”.
            </div>
          )}
          {!loading &&
            hits.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
                className={`block w-full px-2 py-1.5 text-left text-xs ${
                  i === active ? 'bg-sky-50 dark:bg-sky-950/40' : ''
                }`}
              >
                <span className="font-mono text-[11px] text-zinc-500">{m.code}</span>{' '}
                {m.name}
                <span className="text-zinc-400"> · {m.unit}</span>
              </button>
            ))}
          {/* Lối thoát cuối danh sách — chọn trong kho vẫn là đường chính. */}
          {!loading && onFreeText && q.trim() !== '' && (
            <button
              type="button"
              onClick={keepTyped}
              className="block w-full border-t border-zinc-200 px-2 py-1.5 text-left text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400"
            >
              Dùng nguyên “<span className="font-mono">{q.trim()}</span>” — kho chưa có mã
              này
            </button>
          )}
        </div>
      )}
    </div>
  )
}
