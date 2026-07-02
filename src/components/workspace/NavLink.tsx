'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LinkPending } from '@/components/erp/LinkPending'

/**
 * Item điều hướng sidebar — tự xác định active theo pathname hiện tại,
 * và hiện spinner khi đang điều hướng tới chính nó. Client component nên
 * dùng được kể cả khi sidebar nằm trong layout (không cần truyền `current`).
 */
export function NavLink({
  href,
  label,
  icon,
  accentShadow,
}: {
  href: string
  label: string
  icon: string
  /** class shadow-<color> cho thanh accent bên trái khi active. */
  accentShadow: string
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition ${
        active
          ? `bg-slate-800 text-white shadow-[inset_3px_0_0] ${accentShadow}`
          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <span className="flex w-4 items-center justify-center text-center text-slate-400">
        <LinkPending size={12} fallback={icon} />
      </span>
      <span className="flex-1">{label}</span>
    </Link>
  )
}
