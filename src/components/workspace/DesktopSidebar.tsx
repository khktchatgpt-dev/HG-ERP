'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import type { NavSection, WorkspaceId } from '@/workspaces/workspaces.config'
import { NavRailLink } from './NavRailLink'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

const STORAGE_KEY = 'hg-sidebar-collapsed'

/**
 * RAIL ĐIỀU HƯỚNG v4 (desktop).
 *
 * BỐN LỖI CỦA SIDEBAR v3 ĐƯỢC SỬA Ở ĐÂY:
 *
 * 1. KÉO DÀI THEO TRANG. Shell cũ dùng `min-h-screen` — đặt SÀN chứ không đặt
 *    TRẦN — nên trang dài bao nhiêu thì sidebar cao bấy nhiêu và cuộn mất khỏi
 *    tầm nhìn. Sửa ở WorkspaceShell (`h-screen overflow-hidden`); ở đây thêm
 *    `h-full` + vùng nav `min-h-0 overflow-y-auto` để danh sách dài tự cuộn
 *    TRONG rail, không đẩy thẻ người dùng ra ngoài màn.
 *
 * 2. MẶC ĐỊNH ĂN 240px = 16% BỀ NGANG để nuôi 12 link. Bảng ERP mới là thứ
 *    cần chỗ. Nay mặc định THU GỌN 52px, ai muốn rộng thì bấm — và lựa chọn
 *    đó vẫn nhớ trong localStorage như cũ.
 *
 * 3. ~400px TRỐNG dưới mục cuối. Rail hẹp thì không còn khoảng chết đó nữa.
 *
 * 4. THẺ NGƯỜI DÙNG BỊ CẮT trên màn thấp, vì nav dài đẩy nó ra ngoài. `shrink-0`
 *    + nav `min-h-0` giữ nó luôn dính đáy.
 *
 * KHÔNG ĐỔI: dữ liệu nav vẫn do server lọc quyền và truyền xuống nguyên si —
 * đây thuần là tầng hiển thị. Mọi đích đến giữ nguyên, không mục nào bị giấu
 * sau lớp menu con.
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
  route: string
  sections: NavSection[]
  switchable: { id: WorkspaceId; readonly: boolean }[]
  userName: string
  userSub: string
}) {
  // Mặc định THU GỌN. Người chưa thuộc vị trí bấm » một lần là xong, còn
  // người dùng hằng ngày (đa số) khỏi phải trả 240px mỗi lần mở app.
  const [compact, setCompact] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompact(localStorage.getItem(STORAGE_KEY) !== '0')
  }, [])

  function toggle() {
    setCompact((c) => {
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
    // `kit` để tooltip của kit đọc được token của nó (--ink, --z-float);
    // rail vẫn ăn màu nền/chữ của theme-v3 nên không lệch với phần còn lại.
    <aside
      className={`kit bg-card hidden h-full shrink-0 flex-col border-r pt-2.5 transition-[width] duration-150 lg:flex ${
        compact ? 'w-[52px] px-[7px]' : 'w-[212px] px-2.5'
      }`}
    >
      <WorkspaceSwitcher
        current={workspaceId}
        switchable={switchable}
        collapsed={compact}
      />

      {/* min-h-0 BẮT BUỘC: thiếu nó thì flex con không co được, danh sách dài
          đẩy thẻ người dùng ở đáy ra ngoài màn — đúng lỗi cắt chữ của v3. */}
      <nav className="mt-2 flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto">
        {sections.map((sec, si) => (
          <div key={sec.heading} className="mb-1.5">
            {compact ? (
              // Thu gọn: vạch ngăn thay chữ. Vạch đầu tiên thừa — nhóm đầu
              // đã có mép trên của rail làm ranh giới rồi.
              // Vạch phải ĐẬM hơn viền thường: trên rail 52px nó là thứ DUY
              // NHẤT chia nhóm (không còn chữ heading), mà border mặc định quá
              // nhạt để mắt bắt được khi lướt dọc một dãy icon.
              si > 0 && (
                <div className="border-muted-foreground/25 mx-1.5 my-2 border-t" />
              )
            ) : (
              <div className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-[.08em] uppercase">
                {sec.heading}
              </div>
            )}
            {sec.items.map((i) => (
              <NavRailLink
                key={i.href}
                href={i.href}
                label={i.label}
                icon={i.icon}
                compact={compact}
                exact={i.href === route || i.href === `${route}/` || i.href === '/'}
                badge={i.badge}
                /* Đỏ chỉ cho việc CHẶN. "Chờ tôi xử lý" là hàng đợi có người
                   đang đợi mình; các mục còn lại chỉ là danh sách. */
                urgent={/chờ|duyệt|ký|xử lý/i.test(i.label)}
              />
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        title={compact ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-label={compact ? 'Mở rộng menu' : 'Thu gọn menu'}
        className={`text-muted-foreground hover:bg-accent hover:text-foreground mb-1 flex h-7 shrink-0 items-center gap-2 rounded-[5px] text-[11.5px] transition-colors ${
          compact ? 'justify-center px-0' : 'px-2.5'
        }`}
      >
        <span className="text-[13px] leading-none">{compact ? '»' : '«'}</span>
        {!compact && <span>Thu gọn</span>}
      </button>

      {/* shrink-0: thẻ người dùng là mốc cố định, không bao giờ bị nav đẩy đi. */}
      <div
        className={`-mx-2.5 flex shrink-0 items-center gap-2 border-t px-3 py-2.5 ${
          compact ? 'justify-center px-0' : ''
        }`}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-foreground)]"
          title={compact ? `${userName} — ${userSub}` : undefined}
        >
          {initials || '·'}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-medium">{userName}</span>
              <span className="text-muted-foreground block truncate text-[10.5px]">
                {userSub}
              </span>
            </span>
            <Link
              href="/tai-khoan"
              aria-label="Tài khoản của tôi"
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <Settings className="size-[15px]" strokeWidth={1.8} />
            </Link>
          </>
        )}
      </div>
    </aside>
  )
}
