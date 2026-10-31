'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { Assignee } from '@/modules/workflow/tasks/tasks.service'
import { fieldCls, fold } from './phan-cong.shared'

/**
 * Ô CHỌN NGƯỜI NHẬN — gõ tên hoặc tên phòng, không dấu cũng được (Q2: mọi phòng).
 *
 * Viết tay theo mẫu combobox WAI-ARIA (không kit): ô nhập giữ tiêu điểm, mũi tên
 * lên/xuống đi trong danh sách, Enter chọn, Esc đóng. Chọn bằng chuột dùng
 * `onMouseDown` + preventDefault để ô không mất tiêu điểm trước khi nhận lựa chọn.
 */
export function ChonNguoi({
  id,
  people,
  value,
  onChange,
  meId,
  exclude = [],
  inputRef,
}: {
  id: string
  people: Assignee[]
  value: string | null
  onChange: (id: string | null) => void
  meId: string
  exclude?: string[]
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const listId = useId()
  const picked = people.find((p) => p.id === value) ?? null
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    const q = fold(text.trim())
    return people
      .filter((p) => !exclude.includes(p.id))
      .filter((p) => !q || fold(`${p.name} ${p.department ?? ''}`).includes(q))
      .slice(0, 40)
  }, [people, exclude, text])

  function choose(p: Assignee) {
    onChange(p.id)
    setText('')
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => {
        const n = matches.length
        if (n === 0) return 0
        const next = e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n
        listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault()
      choose(matches[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  // Đã chọn mà chưa gõ gì: ô hiện người được chọn. Gõ là bỏ chọn để tìm lại.
  const shown = picked && !open ? `${picked.name}${picked.department ? ` · ${picked.department}` : ''}` : text // prettier-ignore

  return (
    <div className="relative">
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        className={`${fieldCls} h-7`}
        placeholder="Gõ tên hoặc phòng…"
        value={shown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          if (value) onChange(null)
          setText(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKey}
      />
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute top-[calc(100%+2px)] right-0 left-0 z-20 max-h-60 overflow-auto rounded-md border border-[var(--input)] bg-[var(--card)] py-1 shadow-[0_4px_12px_rgb(16_24_40/0.12)]"
        >
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-[12px] text-[var(--muted-foreground)]">
              Không thấy ai khớp — gõ ít chữ hơn, hoặc tên phòng.
            </li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(p)
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-2 py-1 text-[13px] ${i === active ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'text-[var(--foreground)]'}`}
              >
                <span className="truncate">
                  {p.name}
                  {p.id === meId && (
                    <span className="text-[var(--muted-foreground)]"> (bạn)</span>
                  )}
                </span>
                <span className="shrink-0 text-[12px] text-[var(--muted-foreground)]">
                  {p.department ?? '—'}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
