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
 * Chỉ admin thấy đầy đủ 10 workspace; user khác chỉ thấy workspace của mình + shared.
 */
export function WorkspaceSwitcher({
  current,
  userRole,
}: {
  current: WorkspaceId
  userRole: string
}) {
  const [open, setOpen] = useState(false)
  const currentWs = WORKSPACES[current]
  const accent = ACCENT_CLASSES[currentWs.accent]

  // Admin thấy các workspace đã ready + workspace hiện tại (kể cả chưa ready)
  const list =
    userRole === 'admin'
      ? Object.values(WORKSPACES).filter((w) => w.ready || w.id === current)
      : [currentWs]

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
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg">
          {list.map((ws) => {
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
                {active && <span className="text-slate-500">•</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
