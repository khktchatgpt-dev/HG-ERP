'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type RowMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
}

/**
 * Menu ⋯ cho cell action — tiết kiệm chỗ so với xếp 5 nút.
 *
 * Panel render qua PORTAL ra body + position:fixed theo vị trí nút, nên KHÔNG
 * bị `overflow` của bảng cắt (bug menu bị che ở dòng cuối). Tự lật lên khi gần
 * đáy màn hình; đóng khi cuộn / resize / Esc / click ngoài.
 */
export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  // Tính vị trí sau khi panel vào DOM (đo được chiều cao thật) — lật lên nếu tràn đáy.
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const b = btn.getBoundingClientRect()
    const mh = menu.offsetHeight
    const mw = menu.offsetWidth
    const gap = 4
    const pad = 8
    let top = b.bottom + gap
    if (top + mh > window.innerHeight - pad) {
      const up = b.top - gap - mh
      top = up >= pad ? up : Math.max(pad, window.innerHeight - pad - mh)
    }
    let left = b.right - mw // canh phải theo nút
    if (left < pad) left = pad
    if (left + mw > window.innerWidth - pad) left = window.innerWidth - pad - mw
    setCoords({ top, left })
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    // capture=true để bắt cuộn trong container con (bảng overflow) lẫn window.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded border border-zinc-200 px-2 py-0.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ⋯
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-50 min-w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? 'visible' : 'hidden',
            }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                title={it.disabled ? it.disabledReason : undefined}
                onClick={() => {
                  if (it.disabled) return
                  it.onClick()
                  setOpen(false)
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 ${
                  it.danger ? 'text-red-600 dark:text-red-400' : ''
                }`}
              >
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
