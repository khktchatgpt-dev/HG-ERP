'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Điều hướng các tab của trang chi tiết sản phẩm. Dùng ROUTE con (không phải
 * state) để chia sẻ được link đúng tab và mỗi tab chỉ nạp dữ liệu của nó — định
 * mức có SP tới 145 dòng, không nên nạp khi người dùng chỉ xem đóng gói.
 */
export function ProductTabs({
  productId,
  partCount,
}: {
  productId: string
  partCount: number
}) {
  const pathname = usePathname()
  const base = `/products/${productId}`
  const tabs = [
    { href: base, label: 'Hồ sơ' },
    { href: `${base}/dinh-muc`, label: 'Định mức', badge: partCount || undefined },
    { href: `${base}/dong-goi`, label: 'Đóng gói' },
    { href: `${base}/thong-so`, label: 'Thông số' },
    { href: `${base}/tai-lieu`, label: 'Tài liệu' },
  ]

  return (
    <nav className="flex gap-1 border-b" aria-label="Phần hồ sơ sản phẩm">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {t.label}
            {t.badge != null && (
              <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                {t.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
