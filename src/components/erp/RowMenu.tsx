'use client'

import { useEffect, useRef, useState } from 'react'

export type RowMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
}

/** Menu ⋯ cho cell action — tiết kiệm chỗ so với xếp 5 nút. */
export function RowMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="rounded border border-zinc-200 px-2 py-0.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((it, i) => (
            <button
              key={i}
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
        </div>
      )}
    </div>
  )
}
