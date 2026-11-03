'use client'

import { Fragment, useId, useMemo, useState } from 'react'
import type { Assignee } from '@/modules/workflow/tasks/tasks.service'
import { fold } from './phan-cong.shared'

/**
 * Ô CHỌN NGƯỜI NHẬN của phiếu giao (bản vẽ 3, lối ERP): gõ tên hoặc phòng, không dấu
 * cũng được; danh sách thả nhóm theo phòng. Combobox WAI-ARIA viết tay: mũi tên đi,
 * Enter chọn, Esc đóng; chuột dùng `onMouseDown` + preventDefault để ô giữ tiêu điểm.
 * Danh sách người đã lọc theo quyền ở máy chủ (Bán Hàng chỉ thấy Kỹ thuật + Cung ứng).
 */
export function ONguoi({
  id,
  people,
  value,
  onChange,
  exclude,
  inputRef,
  emptyHint,
}: {
  id: string
  people: Assignee[]
  value: string | null
  onChange: (id: string | null) => void
  exclude: string[]
  inputRef?: React.Ref<HTMLInputElement>
  emptyHint: string
}) {
  const listId = useId()
  const picked = people.find((p) => p.id === value) ?? null
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = fold(text.trim())
    return people
      .filter((p) => !exclude.includes(p.id))
      .filter((p) => !q || fold(`${p.name} ${p.department ?? ''}`).includes(q))
      .sort(
        (a, b) =>
          (a.department ?? '~').localeCompare(b.department ?? '~', 'vi') ||
          a.name.localeCompare(b.name, 'vi'),
      )
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
        document
          .getElementById(`${listId}-${next}`)
          ?.scrollIntoView?.({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault()
      choose(matches[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  const shown =
    picked && !open
      ? `${picked.name}${picked.department ? ` · ${picked.department}` : ''}`
      : text

  return (
    <div className="pick">
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
        className={open ? 'in on' : 'in'}
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
        <ul id={listId} role="listbox">
          {matches.length === 0 ? (
            <li className="none">{emptyHint}</li>
          ) : (
            matches.map((p, i) => (
              <Fragment key={p.id}>
                {(i === 0 || matches[i - 1].department !== p.department) && (
                  <li role="presentation" className="g">
                    {p.department ?? 'Chưa gán phòng'}
                  </li>
                )}
                <li
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="o"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(p)
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{p.name}</span>
                  <em>{p.department ?? '—'}</em>
                </li>
              </Fragment>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
