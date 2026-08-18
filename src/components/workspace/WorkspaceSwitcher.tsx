'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import {
  WORKSPACES,
  ACCENT_CLASSES,
  type WorkspaceId,
} from '@/workspaces/workspaces.config'

/**
 * HEADER SIDEBAR kiêm nút chuyển workspace (thiết kế v3 — /design-lab mục 02):
 * logo HG (màu hành động) + "Hoàng Gia ERP / Khu <phòng>" + ChevronsUpDown.
 * Trước đây logo và switcher là hai khối rời; gộp một để đúng mẫu và bớt tầng.
 *
 * Danh sách `switchable` do server tính từ `listAccessibleWorkspaces` (một nguồn
 * sự thật với layout guard). Workspace không phải phòng mình mang nhãn "chỉ xem"
 * — vào được nhưng mọi nút sửa sẽ bị service từ chối theo phòng chủ quản.
 */
export function WorkspaceSwitcher({
  current,
  switchable,
  collapsed = false,
}: {
  current: WorkspaceId
  switchable: { id: WorkspaceId; readonly: boolean }[]
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const currentWs = WORKSPACES[current]
  const accent = ACCENT_CLASSES[currentWs.accent]

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Workspace hiện tại luôn có trong list (kể cả khi không switchable — vd admin
  // đứng trong ws chưa ready) để dropdown hiển thị đúng chỗ đang đứng.
  const list = switchable.some((s) => s.id === current)
    ? switchable
    : [{ id: current, readonly: false }, ...switchable]
  const single = list.length === 1

  /*
   * Logo box mang MÀU + CHỮ TẮT của phòng (CƯ, SL, KH…), không phải "HG" cobalt
   * đồng phục: nhân viên hai phòng đứng cạnh nhau phải phân biệt được màn hình
   * của nhau bằng một cái liếc. Accent phòng là DANH TÍNH; cobalt để dành cho
   * HÀNH ĐỘNG (nút, nav đang chọn) — hai vai không giẫm chân nhau.
   */
  const logo = (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[13px] font-bold text-white ${accent.bg}`}
    >
      {currentWs.logoText}
    </span>
  )
  const nameBlock = !collapsed && (
    <span className="min-w-0 flex-1 leading-tight">
      <span className="text-foreground block truncate text-[13px] font-semibold">
        Hoàng Gia ERP
      </span>
      <span className="text-muted-foreground block truncate text-[11px]">
        Khu {currentWs.label}
      </span>
    </span>
  )

  if (single) {
    return (
      <Link
        href={`${currentWs.route}/`}
        title={collapsed ? `Hoàng Gia ERP — ${currentWs.label}` : undefined}
        className={`hover:bg-accent flex items-center gap-2.5 rounded-lg py-1.5 transition-colors ${
          collapsed ? 'justify-center px-0' : 'px-2'
        }`}
      >
        {logo}
        {nameBlock}
      </Link>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={collapsed ? `Chuyển khu — đang ở ${currentWs.label}` : undefined}
        className={`hover:bg-accent flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left transition-colors ${
          collapsed ? 'justify-center px-0' : 'px-2'
        }`}
      >
        {logo}
        {nameBlock}
        {!collapsed && (
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>
      {open && (
        <div className="bg-popover absolute top-full left-0 z-20 mt-1 max-h-80 w-56 overflow-auto rounded-lg border py-1 shadow-md">
          {list.map(({ id, readonly }) => {
            const ws = WORKSPACES[id]
            const a = ACCENT_CLASSES[ws.accent]
            const active = ws.id === current
            return (
              <Link
                key={ws.id}
                href={`${ws.route}/`}
                onClick={() => setOpen(false)}
                className={`hover:bg-accent flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  active ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${a.bg}`} />
                <span className="flex-1 truncate">{ws.label}</span>
                {readonly && (
                  <span className="bg-muted text-muted-foreground rounded px-1 py-px text-[9px] tracking-wide uppercase">
                    chỉ xem
                  </span>
                )}
                {active && <span className="text-[var(--primary)]">•</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
