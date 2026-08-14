'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { NavSection, WorkspaceId } from '@/workspaces/workspaces.config'
import { NavLink } from './NavLink'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const STORAGE_KEY = 'hg-sidebar-collapsed'

/**
 * Sidebar desktop có thể thu gọn (đầy đủ ⇄ icon-only). Trạng thái lưu localStorage
 * để nhớ giữa các lần vào. Dữ liệu nav đã lọc quyền từ server (WorkspaceSidebar).
 *
 * Bề mặt là TOKEN v2 (bg-card/border) — cùng hệ với nội dung trang, hết cảnh
 * khối slate đen đứng cạnh trang stone như hai app. Danh tính phòng nằm ở khối
 * logo màu accent + item nav active (NavLink).
 */
export function DesktopSidebar({
  workspaceId,
  route,
  short,
  logoText,
  accentBg,
  accentShadow,
  accentSoftBg,
  accentText,
  sections,
  switchable,
}: {
  workspaceId: WorkspaceId
  route: string
  short: string
  logoText: string
  accentBg: string
  accentShadow: string
  accentSoftBg: string
  accentText: string
  sections: NavSection[]
  switchable: { id: WorkspaceId; readonly: boolean }[]
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  function toggle() {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return (
    <aside
      className={`bg-card hidden shrink-0 flex-col border-r py-4 transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-16 px-2' : 'w-60 px-3'
      }`}
    >
      <Link
        href={`${route}/`}
        title={collapsed ? 'Hoàng Gia' : undefined}
        className={`mb-4 flex items-center gap-2 ${collapsed ? 'justify-center px-0' : 'px-2'}`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md font-bold text-white ${accentBg}`}
        >
          {logoText}
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground text-sm leading-tight font-semibold">
              Hoàng Gia
            </span>
            <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
              {short}
            </span>
          </div>
        )}
      </Link>

      {!collapsed && <WorkspaceSwitcher current={workspaceId} switchable={switchable} />}

      <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.heading} className="mb-2">
            {collapsed ? (
              <div className="mx-2 mb-1 border-t" />
            ) : (
              <div className="text-muted-foreground/70 px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                {sec.heading}
              </div>
            )}
            {sec.items.map((i) => (
              <NavLink
                key={i.href}
                href={i.href}
                label={i.label}
                icon={i.icon}
                accentShadow={accentShadow}
                accentSoftBg={accentSoftBg}
                accentText={accentText}
                collapsed={collapsed}
                exact={i.href === route || i.href === `${route}/` || i.href === '/'}
                badge={i.badge}
              />
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        className={`text-muted-foreground hover:bg-accent hover:text-foreground mt-2 flex items-center gap-2 rounded-md py-1.5 text-xs transition-colors ${
          collapsed ? 'justify-center px-0' : 'px-3'
        }`}
      >
        <span className="text-base leading-none">{collapsed ? '»' : '«'}</span>
        {!collapsed && <span>Thu gọn</span>}
      </button>
    </aside>
  )
}
