'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavSection } from '@/workspaces/workspaces.config'
import { NavLink } from './NavLink'

/**
 * Điều hướng cho mobile: nút hamburger (chỉ hiện < lg) + drawer trượt từ trái.
 * Nhận dữ liệu nav đã lọc quyền từ server (MobileNav). Tự đóng khi đổi route.
 */
export function MobileDrawer({
  workspace,
  sections,
  accentBg,
  accentShadow,
}: {
  workspace: { route: string; short: string; logoText: string }
  sections: NavSection[]
  accentBg: string
  accentShadow: string
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Đóng drawer khi điều hướng sang trang khác.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [pathname])

  // Khoá scroll nền khi drawer mở.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        className="grid h-9 w-9 place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-900 px-3 py-4 text-slate-200 shadow-xl">
            <div className="mb-3 flex items-center justify-between px-2">
              <Link href={`${workspace.route}/`} className="flex items-center gap-2">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-md font-bold text-white ${accentBg}`}
                >
                  {workspace.logoText}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm leading-tight font-semibold text-white">
                    Hoàng Gia
                  </span>
                  <span className="text-[10px] tracking-wider text-slate-400 uppercase">
                    {workspace.short}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng menu"
                className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {sections.map((sec) => (
                <div key={sec.heading} className="mb-2">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {sec.heading}
                  </div>
                  {sec.items.map((i) => (
                    <NavLink
                      key={i.href}
                      href={i.href}
                      label={i.label}
                      icon={i.icon}
                      accentShadow={accentShadow}
                    />
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
