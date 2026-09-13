'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LinkPending } from '@/components/erp/LinkPending'
import { Tip } from '@/components/kit'
import { NavIcon } from './nav-icons'

/**
 * Item điều hướng của RAIL v4 (desktop). Tách khỏi `NavLink` v3 — NavLink vẫn
 * phục vụ MobileDrawer, nơi ngón tay cần vùng bấm cao và không có tooltip.
 *
 * BA KHÁC BIỆT SO VỚI v3:
 *
 * 1. TOOLTIP THẬT thay `title=""`. Ở chế độ thu gọn, tooltip là thứ DUY NHẤT
 *    cho biết icon nghĩa là gì — mà tooltip của trình duyệt trễ 1-2 giây và
 *    không định dạng được. Trễ như vậy là hỏng hẳn chức năng, không phải
 *    chuyện thẩm mỹ.
 *
 * 2. SỐ ĐẾM KHÔNG MẶC ĐỊNH MÀU ĐỎ. v3 tô đỏ mọi badge, kể cả "12 đơn nháp" —
 *    thứ chẳng có gì gấp. Đỏ dùng khắp nơi thì hết là tín hiệu. Đỏ chỉ dành
 *    cho việc CHẶN; còn lại là số xám.
 *
 * 3. VẠCH ACTIVE MẢNH + NỀN NHẠT thay nền đặc. Nền đặc trên item đang chọn
 *    ăn tương phản của chính chữ trong nó.
 */
export function NavRailLink({
  href,
  label,
  icon,
  compact = false,
  exact = false,
  badge,
  urgent = false,
}: {
  href: string
  label: string
  icon: string
  /** Rail hẹp: chỉ icon, nhãn nằm trong tooltip. */
  compact?: boolean
  exact?: boolean
  badge?: number
  /** Số đếm này là việc CHẶN (đỏ) hay chỉ là hàng đợi (xám). */
  urgent?: boolean
}) {
  const pathname = usePathname()
  const active = exact
    ? pathname === href || pathname === `${href}/`
    : pathname === href || (href !== '/' && pathname.startsWith(href))

  const item = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-8 items-center gap-2.5 rounded-[5px] text-[13px] transition-colors ${
        compact ? 'w-8 justify-center' : 'px-2.5'
      } ${
        active
          ? 'bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] font-semibold text-[var(--primary)]'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {/* Vạch trái chỉ 2px: đủ để mắt bắt được hàng đang chọn khi lướt dọc,
          không cần tô cả khối. */}
      {active && (
        <span className="absolute top-1 bottom-1 -left-[7px] w-[2px] rounded-full bg-[var(--primary)]" />
      )}
      <span className="relative flex w-4 shrink-0 items-center justify-center">
        <LinkPending
          size={13}
          fallback={<NavIcon name={icon} className="size-[15px]" strokeWidth={1.75} />}
        />
        {compact && badge != null && badge > 0 && (
          <span
            className={`absolute -top-[3px] -right-[3px] size-[6px] rounded-full ${
              urgent ? 'bg-[var(--destructive)]' : 'bg-muted-foreground/60'
            }`}
          />
        )}
      </span>
      {!compact && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!compact && badge != null && badge > 0 && (
        <span
          className={`shrink-0 text-[11px] leading-none font-semibold tabular-nums ${
            urgent ? 'text-[var(--destructive)]' : 'text-muted-foreground'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )

  if (!compact) return item
  return (
    <Tip
      label={badge != null && badge > 0 ? `${label} · ${badge} việc` : label}
      side="right"
    >
      {item}
    </Tip>
  )
}
