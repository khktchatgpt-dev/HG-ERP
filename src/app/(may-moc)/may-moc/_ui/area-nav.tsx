'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/may-moc', label: 'Việc hôm nay', exact: true },
  { href: '/may-moc/may', label: 'Máy móc' },
  { href: '/may-moc/bao-tri', label: 'Lịch bảo trì' },
  { href: '/may-moc/bao-hong', label: 'Báo hỏng' },
  { href: '/may-moc/chi-phi', label: 'Chi phí', cost: true },
  { href: '/may-moc/dung-cu', label: 'Dụng cụ theo người' },
] as const

/**
 * Dải điều hướng TRONG khu Máy móc — sáu trang của bản demo MOCA. Sidebar chỉ
 * giữ MỘT mục "Máy móc & bảo trì" để không đẻ sáu dòng vào menu mỗi phòng.
 * Mục "Chi phí" chỉ hiện với ai có quyền xem (service vẫn gác lại).
 */
export function AreaNav({ showCost }: { showCost: boolean }) {
  const path = usePathname()
  return (
    <nav
      aria-label="Khu máy móc và bảo trì"
      className="flex shrink-0 items-end gap-0 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)]"
    >
      {TABS.filter((t) => !('cost' in t) || showCost).map((t) => {
        const on =
          'exact' in t
            ? path === t.href
            : path === t.href || path.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'text-k-body border-b-2 px-3 py-2 whitespace-nowrap no-underline',
              on
                ? 'border-[var(--act)] font-semibold text-[var(--act-text)]'
                : 'border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
