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
    // Tab "Đóng gói" BỎ (user chốt 13/08/2026): quy cách đóng gói nằm luôn
    // trong tab Hồ sơ, không tách riêng. Route cũ giữ lại và tự chuyển hướng
    // về Hồ sơ cho link/bookmark cũ khỏi 404.
    { href: `${base}/thong-so`, label: 'Thông số kỹ thuật' },
    { href: `${base}/tai-lieu`, label: 'Tài liệu' },
    // Lịch sử phiên bản (0143) đứng CUỐI: tra cứu, không phải chỗ làm việc.
    { href: `${base}/lich-su`, label: 'Lịch sử' },
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
