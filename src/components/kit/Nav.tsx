'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from './kit-core'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — TẦNG VỎ (điều hướng, tooltip, badge, menu)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ĐO ĐƯỢC TRÊN VỎ v3 (màn 1500×1000, khu Cung ứng, 08/09/2026):
 *  · sidebar 240px = 16% bề ngang, nuôi 12 link;
 *  · ~400px NỬA DƯỚI sidebar bỏ trống hoàn toàn;
 *  · topbar 44px chứa đúng 4 thứ, trong đó breadcrumb "Cung ứng" LẶP LẠI
 *    tên phòng đã in to ở đầu sidebar;
 *  · thẻ người dùng ở đáy bị cắt mất chữ khi màn thấp;
 *  · tooltip là `title=""` của trình duyệt — trễ 1–2 giây, không định dạng
 *    được, và trên nav thu gọn thì đó là thứ DUY NHẤT nói item là gì.
 */

/* ── TOOLTIP ────────────────────────────────────────────────────────────
   Tự dựng thay vì dùng `title`: trên thanh điều hướng thu gọn, tooltip là
   phương tiện duy nhất cho biết icon nghĩa gì — trễ 1–2 giây là hỏng hẳn
   chức năng. Hiện sau 120ms, đủ để không nhấp nháy khi rê chuột lướt qua. */
export function Tip({
  label,
  side = 'right',
  children,
}: {
  label: ReactNode
  side?: 'right' | 'top' | 'bottom'
  children: ReactNode
}) {
  const [on, setOn] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (t.current && clearTimeout(t.current)), [])

  const show = () => {
    t.current = setTimeout(() => setOn(true), 120)
  }
  const hide = () => {
    if (t.current) clearTimeout(t.current)
    setOn(false)
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      // Hiện cả khi đi bằng bàn phím: người dùng ERP Tab qua nav suốt.
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {on && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-[var(--z-float)] rounded-[var(--radius-sm)]',
            'bg-[var(--ink)] px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white',
            'shadow-[0_4px_14px_rgba(17,24,38,.22)]',
            side === 'right' && 'top-1/2 left-[calc(100%+8px)] -translate-y-1/2',
            side === 'top' && 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
            side === 'bottom' && 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}

/* ── SỐ ĐẾM ─────────────────────────────────────────────────────────────
   Badge trên nav là SỐ VIỆC, không phải trang trí. Ba luật:
    · 0 thì KHÔNG hiện — badge "0" bắt mắt phải dừng lại đọc để biết là
      không có gì, tốn một nhịp chú ý cho một tin vô nghĩa;
    · trên 99 thì "99+" — con số chính xác không đổi được hành vi;
    · tone `stop` chỉ dành cho việc QUÁ HẠN. Đỏ ở mọi chỗ thì đỏ hết nghĩa. */
export function Count({ n, tone = 'neutral' }: { n: number; tone?: Tone }) {
  if (!n) return null
  return (
    <span
      className={cn(
        'num grid h-[17px] min-w-[17px] place-items-center rounded-[9px] px-[5px]',
        'text-[10.5px] font-bold',
        tone === 'stop'
          ? 'bg-[var(--stop)] text-white'
          : tone === 'warn'
            ? 'bg-[var(--warn)] text-white'
            : 'bg-[var(--surface-raised)] text-[var(--ink-2)]',
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

/* ── ĐIỀU HƯỚNG ─────────────────────────────────────────────────────────

   THANH RAIL 52px thay cho sidebar 240px.

   v3 dùng 240px cố định để nuôi 12 link và bỏ trống ~400px nửa dưới. Rail
   giữ nguyên MỌI đích đến nhưng chỉ tốn 52px — trả lại ~12% bề ngang cho
   bảng, thứ duy nhất người dùng thật sự nhìn.

   Nhãn KHÔNG mất: hover/focus ra tooltip ngay (120ms), và nhóm được phân
   cách bằng vạch. Rail hợp vì người dùng ERP đi bằng TRÍ NHỚ VỊ TRÍ — icon
   ở đúng chỗ mỗi ngày thì sau tuần đầu không ai đọc nhãn nữa.

   Có nút mở rộng cho người chưa thuộc; trạng thái nhớ theo máy. Không ép
   ai phải học ngay — xem references/migration-ratchet.md, gỡ điều hướng
   quen thuộc phải đi ba bước. */
export type NavItem = {
  href: string
  label: string
  icon: ReactNode
  count?: number
  countTone?: Tone
}
export type NavGroup = { heading: string; items: NavItem[] }

export function NavRail({
  groups,
  activeHref,
  expanded = false,
  onToggle,
  brand,
  footer,
}: {
  groups: NavGroup[]
  activeHref: string
  expanded?: boolean
  onToggle?: () => void
  brand: ReactNode
  footer?: ReactNode
}) {
  return (
    <nav
      className={cn(
        'flex shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface-card)]',
        expanded ? 'w-[212px]' : 'w-[52px]',
      )}
    >
      <div
        className={cn(
          'flex h-11 shrink-0 items-center border-b border-[var(--line)]',
          expanded ? 'px-3' : 'justify-center',
        )}
      >
        {brand}
      </div>

      {/* min-h-0 bắt buộc: thiếu nó thì flex con không co được và danh sách
          dài đẩy thẻ người dùng ở đáy ra ngoài màn — đúng lỗi cắt chữ của
          v3 trên màn thấp.

          `scrollbar-none` vì trên rail 52px, thanh cuộn của trình duyệt ăn
          ~15px = gần 30% bề ngang và đè lên icon (thấy được ở khung demo
          cao 340px, ngoài đời gặp trên laptop màn thấp). Vẫn cuộn được
          bằng lăn chuột và bàn phím; ở chế độ mở rộng thì trả lại thanh
          cuộn bình thường vì 212px đủ chỗ. */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-2',
          !expanded && '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {groups.map((g, gi) => (
          <div key={g.heading} className="flex flex-col gap-[2px]">
            {expanded ? (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[.08em] text-[var(--ink-3)] uppercase">
                {g.heading}
              </div>
            ) : (
              gi > 0 && <div className="mx-3 my-1.5 border-t border-[var(--hair)]" />
            )}
            {g.items.map((it) => {
              const on = activeHref === it.href || activeHref.startsWith(`${it.href}/`)
              const body = (
                <a
                  href={it.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'relative mx-2 flex h-[30px] items-center rounded-[var(--radius-sm)]',
                    expanded ? 'gap-2.5 px-2.5' : 'justify-center px-0',
                    on
                      ? 'bg-[var(--act-wash)] font-semibold text-[var(--act)] shadow-[inset_2px_0_0_var(--act)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
                  )}
                >
                  <span className="relative grid w-4 shrink-0 place-items-center">
                    {it.icon}
                    {/* Thu gọn: số đếm co thành chấm — con số không đọc được
                        ở 17px cạnh icon 16px, nhưng "có việc" thì thấy được. */}
                    {!expanded && !!it.count && (
                      <span
                        className={cn(
                          'absolute -top-[3px] -right-[5px] size-[7px] rounded-full ring-2 ring-[var(--surface-card)]',
                          it.countTone === 'stop'
                            ? 'bg-[var(--stop)]'
                            : 'bg-[var(--act)]',
                        )}
                      />
                    )}
                  </span>
                  {expanded && (
                    <>
                      <span className="truncate text-[12.5px]">{it.label}</span>
                      <span className="ml-auto">
                        <Count n={it.count ?? 0} tone={it.countTone} />
                      </span>
                    </>
                  )}
                </a>
              )
              return expanded ? (
                <div key={it.href}>{body}</div>
              ) : (
                <Tip
                  key={it.href}
                  label={
                    it.count ? (
                      <>
                        {it.label} · <b>{it.count}</b> việc
                      </>
                    ) : (
                      it.label
                    )
                  }
                >
                  {body}
                </Tip>
              )
            })}
          </div>
        ))}
      </div>

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={expanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          className={cn(
            'mx-2 mb-1 flex h-[26px] items-center rounded-[var(--radius-sm)] text-[11.5px] text-[var(--ink-3)]',
            'hover:bg-[var(--surface)] hover:text-[var(--ink-2)]',
            expanded ? 'gap-2 px-2.5' : 'justify-center',
          )}
        >
          <span className="text-[13px] leading-none">{expanded ? '«' : '»'}</span>
          {expanded && 'Thu gọn'}
        </button>
      )}

      {footer && (
        <div className="shrink-0 border-t border-[var(--line)]">{footer}</div>
      )}
    </nav>
  )
}

/* ── THANH TRÊN ─────────────────────────────────────────────────────────
   KHÔNG lặp tên phòng: v3 in "Cung ứng" ở đầu sidebar RỒI in lại làm mảnh
   breadcrumb đầu tiên. Ở đây breadcrumb bắt đầu từ mục thật sự đang xem;
   phòng nào thì rail đã nói bằng ô chữ ở góc.

   Ô tìm chiếm chỗ giữa và luôn thấy: bỏ sidebar rồi thì đây là đường điều
   hướng chính, không được giấu sau một icon. */
export function TopBar({
  crumbs,
  onSearch,
  right,
}: {
  crumbs: { label: string; href?: string }[]
  onSearch?: () => void
  right?: ReactNode
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-3">
      <nav className="flex min-w-0 items-center gap-[7px] text-[var(--fs-sm)]">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-[7px]">
            {i > 0 && <span className="text-[var(--line-faint)]">/</span>}
            {c.href ? (
              <a
                href={c.href}
                className="text-[var(--ink-2)] hover:text-[var(--act)] hover:underline"
              >
                {c.label}
              </a>
            ) : (
              <span className="font-semibold text-[var(--ink)]">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <button
        onClick={onSearch}
        className="ml-auto flex h-7 w-[240px] items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-[10px] text-[var(--fs-sm)] text-[var(--ink-3)] hover:border-[var(--act)] hover:text-[var(--ink-2)]"
      >
        Đi tới lệnh, đơn, vật tư…
        <span className="ml-auto flex gap-1">
          <kbd className="rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-[5px] font-[family-name:var(--font-mono)] text-[10.5px]">
            ⌘
          </kbd>
          <kbd className="rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-[5px] font-[family-name:var(--font-mono)] text-[10.5px]">
            K
          </kbd>
        </span>
      </button>

      {right}
    </div>
  )
}

/* ── MENU ⋯ ─────────────────────────────────────────────────────────────
   Tác vụ phụ gom vào đây, nút chính đứng riêng ở góc phải header. Mục
   NGUY HIỂM (xoá, huỷ) tách xuống dưới một vạch và mang màu dừng — kề sát
   mục thường thì sớm muộn có người bấm nhầm. */
export function Menu({
  items,
  label = '⋯',
}: {
  items: { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'grid h-[var(--ctl-h)] w-[var(--ctl-h)] place-items-center rounded-[var(--radius)]',
          'border border-[var(--line)] bg-[var(--surface-card)] text-[15px] text-[var(--ink-2)]',
          'hover:border-[var(--ink-3)] hover:text-[var(--ink)]',
        )}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+4px)] right-0 z-[var(--z-float)] min-w-[196px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[0_8px_24px_rgba(17,24,38,.14)]"
        >
          {items.map((it, i) => (
            <span key={i}>
              {it.danger && i > 0 && <span className="my-1 block border-t border-[var(--hair)]" />}
              <button
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  it.onClick?.()
                  setOpen(false)
                }}
                className={cn(
                  'block w-full px-3 py-[6px] text-left text-[12.5px]',
                  it.danger ? 'text-[var(--stop)]' : 'text-[var(--ink)]',
                  it.disabled
                    ? 'cursor-not-allowed opacity-45'
                    : it.danger
                      ? 'hover:bg-[var(--stop-wash)]'
                      : 'hover:bg-[var(--surface)]',
                )}
              >
                {it.label}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── THẺ NGƯỜI DÙNG ─────────────────────────────────────────────────────
   Ở đáy rail. `shrink-0` để không bị danh sách nav dài đẩy ra khỏi màn —
   đúng lỗi cắt chữ của v3. */
export function UserCard({
  initials,
  name,
  sub,
  expanded = false,
  onSettings,
}: {
  initials: string
  name: string
  sub: string
  expanded?: boolean
  onSettings?: () => void
}) {
  const avatar = (
    <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--act-wash)] text-[10.5px] font-bold text-[var(--act)]">
      {initials}
    </span>
  )
  if (!expanded)
    return (
      <div className="flex justify-center py-2">
        <Tip label={`${name} · ${sub}`}>{avatar}</Tip>
      </div>
    )
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold">{name}</span>
        <span className="block truncate text-[11px] text-[var(--ink-3)]">{sub}</span>
      </span>
      {onSettings && (
        <Tip label="Tài khoản" side="top">
          <button
            onClick={onSettings}
            aria-label="Tài khoản"
            className="text-[var(--ink-3)] hover:text-[var(--ink)]"
          >
            ⚙
          </button>
        </Tip>
      )}
    </div>
  )
}
