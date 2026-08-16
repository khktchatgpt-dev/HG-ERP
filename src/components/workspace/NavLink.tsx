'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LinkPending } from '@/components/erp/LinkPending'
import { NavIcon } from './nav-icons'

/**
 * Item điều hướng sidebar — tự xác định active theo pathname hiện tại,
 * và hiện spinner khi đang điều hướng tới chính nó. Client component nên
 * dùng được kể cả khi sidebar nằm trong layout (không cần truyền `current`).
 *
 * Active mang MÀU CỦA PHÒNG (nền accent nhạt + vạch trái + chữ accent) trên
 * bề mặt token v2 — sidebar cùng hệ màu với nội dung, còn "đang ở phòng nào,
 * mục nào" thì accent nói. Trước đây sidebar slate đen tự chế một hệ màu
 * riêng, đứng cạnh trang v2 như hai app ghép lại.
 */
export function NavLink({
  href,
  label,
  icon,
  collapsed = false,
  exact = false,
  badge,
}: {
  href: string
  label: string
  icon: string
  /**
   * Ba prop accent cũ (accentShadow/SoftBg/Text) vẫn nằm trong type để hai
   * caller (DesktopSidebar, MobileDrawer) không phải sửa, nhưng KHÔNG dùng
   * nữa: active theo thiết kế v3 là MỘT màu hành động (--accent/--primary)
   * cho mọi workspace — danh tính phòng nằm ở logo box + vạch topbar.
   */
  accentShadow?: string
  accentSoftBg?: string
  accentText?: string
  /** Chế độ sidebar thu gọn: chỉ icon, label thành tooltip. */
  collapsed?: boolean
  /**
   * Chỉ khớp CHÍNH XÁC pathname — cho link gốc workspace ('/sales'): mọi trang
   * con đều startsWith nó nên nếu so tiền tố thì "Trang chủ" sáng vĩnh viễn,
   * lúc nào cũng có 2 item active.
   */
  exact?: boolean
  /** Số đếm sống (vd phiếu chờ ký). Thu gọn thì thành chấm đỏ góc icon. */
  badge?: number
}) {
  const pathname = usePathname()
  const active = exact
    ? pathname === href || pathname === `${href}/`
    : pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2.5 rounded-md py-1.5 text-sm transition-colors ${
        collapsed ? 'justify-center px-0' : 'px-3'
      } ${
        active
          ? 'bg-[var(--accent)] font-semibold text-[var(--accent-foreground)] shadow-[inset_3px_0_0_var(--primary)]'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <span
        className={`relative flex w-4 shrink-0 items-center justify-center ${
          active ? '' : 'text-muted-foreground/70'
        }`}
      >
        <LinkPending
          size={13}
          fallback={<NavIcon name={icon} className="size-4" strokeWidth={1.75} />}
        />
        {collapsed && badge != null && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500"
            aria-label={`${badge} phiếu chờ`}
          />
        )}
      </span>
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}
