'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ACCENT_CLASSES,
  WORKSPACES,
  type WorkspaceId,
} from '@/workspaces/workspaces.config'

/**
 * Dropdown chuyển workspace nhanh — hiện trong sidebar dưới logo.
 *
 * Danh sách `switchable` do server tính từ `listAccessibleWorkspaces` (một nguồn
 * sự thật với layout guard). Workspace không phải phòng mình mang nhãn "chỉ xem"
 * — vào được nhưng mọi nút sửa sẽ bị service từ chối theo phòng chủ quản.
 */
export function WorkspaceSwitcher({
  current,
  switchable,
}: {
  current: WorkspaceId
  switchable: { id: WorkspaceId; readonly: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  const currentWs = WORKSPACES[current]
  const accent = ACCENT_CLASSES[currentWs.accent]

  // Workspace hiện tại luôn có trong list (kể cả khi không switchable — vd admin
  // đứng trong ws chưa ready) để dropdown hiển thị đúng chỗ đang đứng.
  const list = switchable.some((s) => s.id === current)
    ? switchable
    : [{ id: current, readonly: false }, ...switchable]

  if (list.length === 1) {
    // Chỉ 1 workspace → hiện label không có switcher.
    return (
      <div className="mx-1 flex items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1.5">
        <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
        <span className="text-xs font-medium text-slate-200">{currentWs.label}</span>
      </div>
    )
  }

  return (
    <div className="relative mx-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md bg-slate-800/60 px-2 py-1.5 text-left hover:bg-slate-800"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${accent.bg}`} />
        <span className="flex-1 truncate text-xs font-medium text-slate-200">
          {currentWs.label}
        </span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg">
          {list.map(({ id, readonly }) => {
            const ws = WORKSPACES[id]
            const a = ACCENT_CLASSES[ws.accent]
            const active = ws.id === current
            return (
              <Link
                key={ws.id}
                href={`${ws.route}/`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-800 ${
                  active ? 'text-white' : 'text-slate-300'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${a.bg}`} />
                <span className="flex-1 truncate">{ws.label}</span>
                {readonly && (
                  <span className="rounded bg-slate-700/80 px-1 py-px text-[9px] tracking-wide text-slate-400 uppercase">
                    chỉ xem
                  </span>
                )}
                {active && <span className="text-slate-500">•</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
