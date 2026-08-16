'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import type { NavSection, WorkspaceId } from '@/workspaces/workspaces.config'
import { NavLink } from './NavLink'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const STORAGE_KEY = 'hg-sidebar-collapsed'

/**
 * Sidebar desktop (thiết kế v3 — /design-lab mục 02): header = logo + switcher
 * gộp một khối, nav chia nhóm có heading, ĐÁY là thẻ người dùng (avatar chữ +
 * tên + vai, bánh răng mở trang tài khoản). Có thể thu gọn (đầy đủ ⇄ icon-only),
 * trạng thái lưu localStorage. Dữ liệu nav đã lọc quyền từ server.
 */
export function DesktopSidebar({
  workspaceId,
  route,
  sections,
  switchable,
  userName,
  userSub,
}: {
  workspaceId: WorkspaceId
  /** Route gốc workspace — để item "Tổng quan" chỉ active khi khớp CHÍNH XÁC. */
  route: string
  sections: NavSection[]
  switchable: { id: WorkspaceId; readonly: boolean }[]
  /** Tên người đăng nhập — thẻ đáy sidebar. */
  userName: string
  /** Dòng phụ dưới tên (vd "Cung ứng · supply_lead"). */
  userSub: string
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

  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <aside
      className={`bg-card hidden shrink-0 flex-col border-r pt-3 transition-[width] duration-200 lg:flex ${
        collapsed ? 'w-16 px-2' : 'w-60 px-3'
      }`}
    >
      <WorkspaceSwitcher
        current={workspaceId}
        switchable={switchable}
        collapsed={collapsed}
      />

      <nav className="mt-3 flex flex-1 flex-col gap-1 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.heading} className="mb-2">
            {collapsed ? (
              <div className="mx-2 mb-1 border-t" />
            ) : (
              <div className="t-label text-muted-foreground px-3 pt-2 pb-1.5">
                {sec.heading}
              </div>
            )}
            {sec.items.map((i) => (
              <NavLink
                key={i.href}
                href={i.href}
                label={i.label}
                icon={i.icon}
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
        className={`text-muted-foreground hover:bg-accent hover:text-foreground mb-1 flex items-center gap-2 rounded-md py-1.5 text-xs transition-colors ${
          collapsed ? 'justify-center px-0' : 'px-3'
        }`}
      >
        <span className="text-base leading-none">{collapsed ? '»' : '«'}</span>
        {!collapsed && <span>Thu gọn</span>}
      </button>

      {/* Thẻ người dùng — đáy sidebar theo mẫu. Bánh răng → hồ sơ tài khoản. */}
      <div
        className={`-mx-3 flex items-center gap-2.5 border-t px-4 py-3 ${
          collapsed ? 'justify-center px-0' : ''
        }`}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-foreground)]"
          title={collapsed ? `${userName} — ${userSub}` : undefined}
        >
          {initials || '·'}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12.5px] font-medium">{userName}</span>
              <span className="text-muted-foreground block truncate text-[11px]">
                {userSub}
              </span>
            </span>
            <Link
              href="/tai-khoan"
              aria-label="Tài khoản của tôi"
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <Settings className="size-4" strokeWidth={1.8} />
            </Link>
          </>
        )}
      </div>
    </aside>
  )
}
