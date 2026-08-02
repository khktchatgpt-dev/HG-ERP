'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnchoredPopover } from '@/components/erp/AnchoredPopover'

export type SupplierOption = {
  id: string
  name: string
  /** Mã viết tắt trên số ĐH (TTL, MT, TN…) — nhân viên nhớ mã hơn nhớ tên đầy đủ. */
  code?: string | null
  type?: string | null
  rating?: string | null
}

/** Bỏ dấu để gõ "tuong nguyen" cũng ra "CÔNG TY TNHH SX-TM TƯỜNG NGUYÊN". */
function nod(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
}

/**
 * Ô CHỌN NHÀ CUNG CẤP CÓ TÌM.
 *
 * Trước đây là `<select>` thuần. Danh sách NCC ngày 02/08 đi từ 39 lên 150 —
 * cuộn một dropdown 151 mục để tìm "Tường Nguyên" giữa lúc soạn đơn là việc
 * không nên có, và trình duyệt chỉ cho gõ nhảy theo ký tự ĐẦU nên gõ "tường"
 * không tới được "CÔNG TY TNHH SX-TM TƯỜNG NGUYÊN".
 *
 * Tìm ở CLIENT: 150 NCC là danh sách nhỏ, trang đã nạp sẵn cho ô này rồi —
 * thêm một vòng server chỉ để lọc 150 dòng là thừa.
 */
export function SupplierPicker({
  value,
  onChange,
  suppliers,
  placeholder = '— chọn NCC —',
  className = '',
}: {
  value: string
  onChange: (id: string) => void
  suppliers: SupplierOption[]
  placeholder?: string
  className?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const chosen = suppliers.find((s) => s.id === value) ?? null

  const list = useMemo(() => {
    const k = nod(q.trim())
    if (!k) return suppliers.slice(0, 50)
    return suppliers
      .filter((s) => nod(s.name).includes(k) || nod(s.code ?? '').includes(k))
      .slice(0, 50)
  }, [suppliers, q])

  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement
      // Danh sách vẽ ở body (AnchoredPopover) nên KHÔNG nằm trong boxRef —
      // thiếu vế này thì cú bấm chọn NCC bị coi là "bấm ra ngoài" và đóng luôn.
      if (t.closest('[data-anchored-popover]')) return
      if (!boxRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function openList() {
    setOpen(true)
    setActive(0)
    const r = inputRef.current?.getBoundingClientRect()
    if (r) setAnchor(r)
  }

  function choose(s: SupplierOption) {
    onChange(s.id)
    setQ('')
    setOpen(false)
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
      const s = list[active]
      if (s) choose(s)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        ref={inputRef}
        value={open ? q : (chosen?.name ?? '')}
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
        placeholder={placeholder}
        className={className}
      />
      {open && anchor && (
        <AnchoredPopover
          anchor={anchor}
          onClose={() => setOpen(false)}
          width={Math.max(360, anchor.width)}
        >
          <div id={listId} role="listbox">
            {list.length === 0 && (
              <div className="px-3 py-3 text-sm text-zinc-500">
                Không có NCC nào khớp “{q.trim()}”.
              </div>
            )}
            {list.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                  i === active
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-sky-50 dark:hover:bg-sky-950/40'
                }`}
              >
                <span className="flex w-full items-center gap-2 text-[13px]">
                  {s.code && (
                    <span className="font-mono text-[11px] text-zinc-500">{s.code}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                </span>
                {(s.type || s.rating) && (
                  <span className="text-[11px] text-zinc-400">
                    {[s.type, s.rating && `hạng ${s.rating}`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
            {!q.trim() && suppliers.length > list.length && (
              <div className="border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800">
                Đang hiện {list.length}/{suppliers.length} — gõ để tìm tiếp.
              </div>
            )}
          </div>
        </AnchoredPopover>
      )}
    </div>
  )
}
