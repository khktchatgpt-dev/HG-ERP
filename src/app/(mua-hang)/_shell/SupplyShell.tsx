'use client'

import { usePathname, useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/erp/CommandPalette'
import { NavIcon } from '@/components/workspace/nav-icons'
import { NavRail, TopBar, UserCard, type NavGroup } from '@/components/kit'
import { INBOX_HREF, SUPPLY_NAV, activeSupplyHref } from './nav'
import { Count } from '@/components/kit'
import { useLocalPref } from './use-local-pref'

/**
 * VỎ của phòng Cung ứng bản mới.
 *
 * KHÁC `WorkspaceShell` (bản cũ, 168 file đang dùng) ở ba chỗ, và cả ba đều
 * là quyết định có lý do chứ không phải đổi cho khác:
 *
 *  1. RAIL 52px THAY SIDEBAR 240px. Sidebar cũ nuôi 10 link và bỏ trống nửa
 *     dưới; 240px là ~15% bề ngang lấy khỏi bảng — thứ duy nhất người dùng
 *     thật sự nhìn. Nhãn KHÔNG mất: hover ra tooltip sau 120ms, và có nút mở
 *     rộng cho người chưa thuộc vị trí.
 *  2. NHỚ TRẠNG THÁI MỞ RỘNG THEO MÁY. Người mới bật rộng ra dùng vài tuần
 *     rồi tự thu lại khi đã thuộc — không ép ai học ngay. Đây là bước 2 của
 *     ba bước gỡ điều hướng quen thuộc (thêm ⌘K + nút thu gọn → theo dõi →
 *     mới bỏ hẳn).
 *  3. ⌘K LÀ ĐƯỜNG ĐIỀU HƯỚNG CHÍNH. Bỏ sidebar mà không có ô tìm tử tế là
 *     khoá người dùng ra ngoài. Dùng lại đúng `CommandPalette` của bản cũ —
 *     KHÔNG viết bản thứ hai: hai bảng lệnh thì sớm muộn lệch nhau về danh
 *     sách đích, và người dùng học hai thứ.
 *
 * MẶC ĐỊNH MỞ RỘNG ở lần đầu (`expanded` khởi tạo `true` khi chưa có lựa chọn
 * lưu): phòng đang quen sidebar 240px, thả thẳng vào rail icon là mất phương
 * hướng ngày đầu.
 */

const KEY = 'hg.mua-hang.rail'
export const DENSE_KEY = 'hg.mua-hang.dense'

/**
 * HỘP THƯ Ở VỎ — chép SAP My Inbox / Dynamics work items: một cửa cho mọi
 * việc chờ mình, không phải một mục trong menu của một module. Số đếm do
 * layout tính bằng ĐÚNG hàm mà trang hộp thư dùng (`countMyTodos`).
 */
function InboxButton({ count, active }: { count: number; active: boolean }) {
  return (
    <a
      href={INBOX_HREF}
      aria-label={count > 0 ? `Hộp thư việc, ${count} việc chờ` : 'Hộp thư việc'}
      className={
        'flex h-7 items-center gap-2 rounded-[var(--radius)] border px-[10px] font-medium text-[var(--fs-sm)] ' +
        (active
          ? 'border-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink-2)] hover:border-[var(--act)] hover:text-[var(--ink)]')
      }
    >
      Hộp thư việc
      <Count n={count} tone={count > 0 ? 'warn' : 'neutral'} />
    </a>
  )
}
export function SupplyShell({
  user,
  badges,
  inboxCount = 0,
  children,
}: {
  user: { name: string; role: string }
  /** Số việc sống theo href. Đếm bằng ĐÚNG hàm mà trang đích dùng. */
  badges?: Record<string, number>
  /** Số việc đang chờ chính người này — hiện trên nút hộp thư ở thanh trên. */
  inboxCount?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [rail, setRail] = useLocalPref(KEY, '1')
  // Mật độ là của NGƯỜI DÙNG, không của trang: một thang cho cả module. Mặc
  // định 30px như màn mẫu ở /design-lab (chủ dự án chấm bản 25px "khá nhạt",
  // 10/09/2026); "Dày" 25px là tuỳ chọn cho người quen Excel.
  const [dense] = useLocalPref(DENSE_KEY, '0')
  const expanded = rail === '1'
  const toggle = () => setRail(expanded ? '0' : '1')

  const active = activeSupplyHref(pathname)

  const groups: NavGroup[] = SUPPLY_NAV.map((g) => ({
    heading: g.heading,
    items: g.items.map((i) => ({
      href: i.href,
      label: i.label,
      icon: <NavIcon name={i.icon} className="size-5" strokeWidth={active === i.href ? 2.1 : 1.8} />, // prettier-ignore
      count: badges?.[i.href],
    })),
  }))

  const crumbs = buildCrumbs(pathname)

  return (
    <div
      className={
        dense === '1'
          ? 'kit kit-dense flex h-dvh overflow-hidden'
          : 'kit flex h-dvh overflow-hidden'
      }
    >
      {' '}
      {/* prettier-ignore */}
      <NavRail
        groups={groups}
        activeHref={active}
        expanded={expanded}
        onToggle={toggle}
        brand={
          expanded ? (
            <span className="flex items-baseline gap-2">
              <span className="grid size-[22px] place-items-center rounded-[var(--radius-sm)] bg-[var(--act)] text-[10px] font-bold text-[var(--act-ink)]">
                MH
              </span>
              <span className="text-[13px] font-bold tracking-[-.01em]">Mua hàng</span>
            </span>
          ) : (
            <span className="grid size-[22px] place-items-center rounded-[var(--radius-sm)] bg-[var(--act)] text-[10px] font-bold text-[var(--act-ink)]">
              MH
            </span>
          )
        }
        footer={
          <UserCard
            initials={initials(user.name)}
            name={user.name}
            sub={user.role}
            expanded={expanded}
            onSettings={() => router.push('/tai-khoan')}
          />
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          crumbs={crumbs}
          onSearch={() => window.dispatchEvent(new Event('hg:open-command-palette'))}
          right={
            <InboxButton count={inboxCount} active={pathname.startsWith(INBOX_HREF)} />
          }
        />
        {/*
          `min-h-0` bắt buộc trên vùng nội dung: thiếu nó thì `ScreenFrame` của
          màn con không bao giờ chốt được chiều cao, bảng dài không cuộn trong
          khung, và tiêu đề cột lẫn chân tổng dính đều vô hiệu. Đây đúng là bẫy
          đã dính ngày 08/09/2026 trên màn nhà cung cấp 164 dòng.
        */}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  )
}

/**
 * Đường dẫn trên thanh trên.
 *
 * KHÔNG lặp tên phòng ở mảnh đầu: rail đã nói "Cung ứng" bằng ô chữ ở góc, in
 * lại lần nữa là tốn chỗ cho một thông tin người dùng đã biết.
 */
function buildCrumbs(pathname: string): { label: string; href?: string }[] {
  const item = SUPPLY_NAV.flatMap((g) => g.items).find(
    (i) =>
      i.href !== '/mua-hang' &&
      (pathname === i.href || pathname.startsWith(i.href + '/')),
  )
  if (pathname.startsWith(INBOX_HREF)) return [{ label: 'Hộp thư việc' }]
  if (!item) return [{ label: 'Bàn làm việc' }]
  if (pathname === item.href) return [{ label: item.label }]
  /*
   * Trang con: KHÔNG in đoạn cuối URL. Với chứng từ đó là một UUID 36 ký tự —
   * đo 10/09/2026 trên khung 708px: chuỗi id chiếm hai dòng, đẩy ô tìm và nút
   * hộp thư gãy xuống. Mã chứng từ thật đã nằm ở dải Crumb của chính màn đó,
   * ngay dưới thanh này; in thêm lần nữa là thừa, in id thì là rác.
   */
  const tail = pathname.slice(item.href.length + 1).split('/')[0]
  const human =
    tail === 'moi'
      ? 'Mới'
      : /^[0-9a-f-]{20,}$/i.test(tail)
        ? null
        : decodeURIComponent(tail)
  return human
    ? [{ label: item.label, href: item.href }, { label: human }]
    : [{ label: item.label, href: item.href }]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
