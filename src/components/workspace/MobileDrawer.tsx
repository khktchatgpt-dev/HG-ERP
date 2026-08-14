'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  accentSoftBg,
  accentText,
}: {
  workspace: { route: string; short: string; logoText: string }
  sections: NavSection[]
  accentBg: string
  accentShadow: string
  accentSoftBg: string
  accentText: string
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
        className="text-muted-foreground hover:bg-accent hover:text-foreground grid h-9 w-9 place-items-center rounded-md lg:hidden"
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

      {/*
        PORTAL ra document.body — bắt buộc, không phải tối ưu: nút hamburger nằm
        TRONG topbar, mà topbar có `backdrop-blur`. Phần tử mang backdrop-filter
        là containing block của mọi con `position: fixed`, nên nếu render tại
        chỗ thì `fixed inset-0` bị nhốt vào đúng cái hộp header cao 56px —
        drawer thành ô trắng tí hon, overlay chỉ tô đen thanh topbar.
        Ra ngoài body thì mất token theme-v2 của shell → gắn lại ngay trên gốc
        portal để bg-card/muted/accent vẫn đọc đúng.
      */}
      {open &&
        createPortal(
          <div className="theme-v2 fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside className="bg-card text-foreground absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col gap-1 overflow-y-auto border-r px-3 py-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between px-2">
                <Link href={`${workspace.route}/`} className="flex items-center gap-2">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-md font-bold text-white ${accentBg}`}
                  >
                    {workspace.logoText}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm leading-tight font-semibold">
                      Hoàng Gia
                    </span>
                    <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                      {workspace.short}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng menu"
                  className="text-muted-foreground hover:bg-accent hover:text-foreground grid h-8 w-8 place-items-center rounded-md"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {sections.map((sec) => (
                  <div key={sec.heading} className="mb-2">
                    <div className="text-muted-foreground/70 px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase">
                      {sec.heading}
                    </div>
                    {sec.items.map((i) => (
                      <NavLink
                        key={i.href}
                        href={i.href}
                        label={i.label}
                        icon={i.icon}
                        accentShadow={accentShadow}
                        accentSoftBg={accentSoftBg}
                        accentText={accentText}
                        exact={
                          i.href === workspace.route ||
                          i.href === `${workspace.route}/` ||
                          i.href === '/'
                        }
                        badge={i.badge}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  )
}
