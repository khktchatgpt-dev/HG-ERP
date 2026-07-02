'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Cmd = {
  id: string
  label: string
  hint?: string
  group: string
  action: () => void
}

const COMMANDS_STATIC: Omit<Cmd, 'action'>[] = [
  { id: 'nav-dashboard', label: 'Đi tới Tổng quan', group: 'Điều hướng', hint: '/admin' },
  { id: 'nav-users', label: 'Đi tới Người dùng', group: 'Điều hướng', hint: '/admin/users' },
  { id: 'nav-departments', label: 'Đi tới Phòng ban', group: 'Điều hướng', hint: '/admin/departments' },
  { id: 'nav-audit', label: 'Đi tới Nhật ký thao tác', group: 'Điều hướng', hint: '/admin/audit' },
  { id: 'nav-health', label: 'Đi tới Sức khoẻ hệ thống', group: 'Điều hướng', hint: '/admin/health' },
  { id: 'nav-settings', label: 'Đi tới Cấu hình', group: 'Điều hướng', hint: '/admin/settings' },
  { id: 'new-user', label: 'Tạo tài khoản mới', group: 'Thao tác', hint: '/admin/users?new=1' },
  { id: 'import-users', label: 'Import Excel người dùng', group: 'Thao tác', hint: '/admin/users?import=1' },
]

const HREF_MAP: Record<string, string> = {
  'nav-dashboard': '/admin',
  'nav-users': '/admin/users',
  'nav-departments': '/admin/departments',
  'nav-audit': '/admin/audit',
  'nav-health': '/admin/health',
  'nav-settings': '/admin/settings',
  'new-user': '/admin/users?new=1',
  'import-users': '/admin/users?import=1',
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQ('')
        setIdx(0)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const commands: Cmd[] = useMemo(
    () =>
      COMMANDS_STATIC.map((c) => ({
        ...c,
        action: () => {
          const href = HREF_MAP[c.id]
          if (href) router.push(href)
        },
      })),
    [router],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(ql) ||
        c.group.toLowerCase().includes(ql) ||
        c.hint?.toLowerCase().includes(ql),
    )
  }, [commands, q])

  function runIdx(i: number) {
    const c = filtered[i]
    if (!c) return
    c.action()
    setOpen(false)
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runIdx(idx)
    }
  }

  if (!open) return null

  // Group by
  const groups = new Map<string, { c: Cmd; realIdx: number }[]>()
  filtered.forEach((c, i) => {
    const arr = groups.get(c.group) ?? []
    arr.push({ c, realIdx: i })
    groups.set(c.group, arr)
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            onKeyDown={onSearchKey}
            placeholder="Tìm lệnh, ví dụ 'người dùng' hoặc 'tạo'…"
            className="w-full rounded-md bg-transparent px-2 py-1.5 text-sm focus:outline-none"
          />
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              Không tìm thấy lệnh nào.
            </div>
          )}
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {group}
              </div>
              {items.map(({ c, realIdx }) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setIdx(realIdx)}
                  onClick={() => runIdx(realIdx)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    realIdx === idx
                      ? 'bg-zinc-100 dark:bg-zinc-800'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span>{c.label}</span>
                  {c.hint && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{c.hint}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <span>↑↓ chọn · ↵ chạy · Esc thoát</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}
