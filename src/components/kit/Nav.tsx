'use client'

import {
  Fragment,
  isValidElement,
  useId,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { DropdownMenu, Tabs, ToggleGroup, Tooltip } from 'radix-ui'
import Link, { useLinkStatus } from 'next/link'
import { cn } from '@/lib/utils'
import type { Tone } from './kit-core'
import { Tag } from './Primitives'
import { Ico, type IcoName } from './Icon'

/**
 * ĐIỀU HƯỚNG PHẢI LÀ `next/link`, KHÔNG PHẢI `<a>` TRẦN.
 *
 * Tới 14/09/2026 rail dùng `<a href>`: trong App Router đó là TẢI LẠI CẢ
 * TRANG — không prefetch, không dùng được `loading.tsx`, mất trạng thái vỏ
 * (rail đang mở rộng, vị trí cuộn), và màn trắng một nhịp trước khi dựng lại
 * từ đầu. Chủ dự án báo "chuyển trang không có loading": đúng là không có,
 * vì full reload thì Suspense của Next không bao giờ được chạy.
 *
 * `NavPending` đọc cờ pending của `Link` gần nhất nên spinner mọc ngay tại
 * item vừa bấm, thay chỗ icon của nó — không chiếm thêm chỗ trên rail 52px.
 */
function NavPending({ fallback }: { fallback: ReactNode }) {
  const { pending } = useLinkStatus()
  if (!pending) return <>{fallback}</>
  return (
    <span
      aria-label="Đang mở"
      className="size-[13px] animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-70"
    />
  )
}

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
   Không dùng `title` của trình duyệt: trên thanh điều hướng thu gọn, tooltip
   là phương tiện duy nhất cho biết icon nghĩa gì — trễ 1–2 giây là hỏng hẳn
   chức năng. Hiện sau 120ms, đủ để không nhấp nháy khi rê chuột lướt qua.

   ĐỨNG TRÊN RADIX TOOLTIP TỪ 24/09/2026 (B1). Bản tự viết trước đó có ba lỗ:
    · khai `role="tooltip"` nhưng nút kích hoạt KHÔNG trỏ `aria-describedby`
      tới nó — trình đọc màn hình không biết tooltip thuộc về nút nào;
    · không tắt được bằng Esc — trượt WCAG 1.4.13 (nội dung hiện khi rê/focus
      phải tắt được mà không phải dời chuột/tiêu điểm);
    · nằm `absolute` trong cây DOM của nơi gọi, nên bị CẮT bởi mọi vùng
      `overflow` (thanh điều hướng cuộn, bảng, hộp thoại).
   Radix lo cả ba, cộng tự lật phía khi chạm mép màn. */
export function Tip({
  label,
  side = 'right',
  children,
}: {
  /**
   * Chữ chú giải — một cụm ngắn, một dòng (khung không xuống dòng). Trình đọc
   * màn hình nhận nó làm MÔ TẢ của phần tử con (`aria-describedby`), không phải
   * tên — phần tử con vẫn phải tự có tên.
   */
  label: ReactNode
  /**
   * Phía hiện khung so với phần tử con. Mặc định `right` vì chỗ dùng gốc là rail
   * điều hướng thu gọn. Chạm mép màn thì Radix tự lật sang phía đối diện.
   */
  side?: 'right' | 'top' | 'bottom'
  /**
   * Thứ được chú giải. Nên là MỘT phần tử nhận tiêu điểm (nút, link) và chuyển
   * tiếp thuộc tính xuống DOM — Radix gắn sự kiện + `aria-describedby` thẳng vào
   * nó. Chữ trần / nhiều nút thì kit tự bọc một `<span>`, và khi đó bàn phím
   * không tới được.
   */
  children: ReactNode
}) {
  /*
    Gắn THẲNG vào phần tử con khi nó là một phần tử — để `aria-describedby`
    nằm trên chính thứ nhận tiêu điểm (link, nút). Bọc thêm một `<span>` rồi
    gắn vào span thì tooltip vẫn hiện khi Tab tới, nhưng trình đọc màn hình đọc
    thuộc tính của phần tử ĐANG FOCUS, không đọc của cha nó — tức lại câm.
    Chỉ khi con là chữ trần / nhiều nút mới phải bọc.
  */
  const trigger = isValidElement(children) ? (
    children
  ) : (
    <span className="inline-flex">{children}</span>
  )
  return (
    // Provider riêng từng tooltip (cùng cách `shadcn/tooltip` đang làm) để nơi
    // gọi KHÔNG phải bọc gì thêm — giữ nguyên API cho mọi chỗ đang dùng.
    <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          {/* Token kit chỉ sống trong `.kit` — portal ra `<body>` thì phải đeo lại. */}
          <div className="kit contents">
            <Tooltip.Content
              side={side}
              sideOffset={side === 'right' ? 8 : 6}
              collisionPadding={8}
              className={cn(
                // `--z-pop` > `--z-modal`: tooltip trong hộp thoại phải nổi TRÊN hộp.
                'z-[var(--z-pop)] rounded-[var(--radius-sm)]',
                'text-k-sm bg-[var(--ink)] px-2 py-1 font-medium whitespace-nowrap text-white',
                'shadow-[var(--shadow-float)]',
              )}
            >
              {label}
            </Tooltip.Content>
          </div>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

/* ── SỐ ĐẾM ─────────────────────────────────────────────────────────────
   Badge trên nav là SỐ VIỆC, không phải trang trí. Ba luật:
    · 0 thì KHÔNG hiện — badge "0" bắt mắt phải dừng lại đọc để biết là
      không có gì, tốn một nhịp chú ý cho một tin vô nghĩa;
    · trên 99 thì "99+" — con số chính xác không đổi được hành vi;
    · tone `stop` chỉ dành cho việc QUÁ HẠN. Đỏ ở mọi chỗ thì đỏ hết nghĩa. */
export function Count({
  n,
  tone = 'neutral',
}: {
  /** Số việc. `0` (hoặc giá trị rỗng) thì KHÔNG vẽ gì; trên 99 thì hiện "99+". */
  n: number
  /**
   * Sắc thái: `stop` chỉ cho việc QUÁ HẠN, `warn` cho việc sắp trễ; còn lại để
   * `neutral` (xám). `done` hiện như `neutral` — huy hiệu không có màu xanh lục.
   */
  tone?: Tone
}) {
  if (!n) return null
  return (
    <span
      className={cn(
        'num grid h-[17px] min-w-[17px] place-items-center rounded-[9px] px-1',
        'text-k-label font-bold',
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
  /**
   * Các nhóm mục điều hướng. Thu gọn thì nhóm ngăn bằng vạch; mở rộng thì hiện
   * `heading`. Mỗi mục: `href`, `label`, `icon`, và `count`/`countTone` cho số
   * việc (thu gọn co thành chấm, màu theo `countTone` như `Count`). Thu gọn thì
   * `label` thành tên đọc được của link — `icon` không cần tự mang nhãn.
   */
  groups: NavGroup[]
  /**
   * Đường dẫn đang xem. Mục sáng khi `href` trùng hẳn, hoặc là tiền tố theo
   * từng đoạn (`/mua-hang/don` sáng cả ở `/mua-hang/don/123`).
   */
  activeHref: string
  /**
   * `false` = rail 52px chỉ icon, nhãn nằm trong tooltip; `true` = 212px có
   * nhãn, tiêu đề nhóm và số đếm. Nơi gọi giữ trạng thái (nhớ theo máy).
   */
  expanded?: boolean
  /**
   * Bấm nút « / » ở đáy rail (nút mang `aria-expanded` theo `expanded`). Bỏ trống
   * thì KHÔNG có nút thu/mở.
   */
  onToggle?: () => void
  /** Ô thương hiệu / tên phòng ở đầu rail, cao 44px — khớp với `TopBar`. */
  brand: ReactNode
  /** Phần đáy, không cuộn theo danh sách — thường là `UserCard`. */
  footer?: ReactNode
}) {
  return (
    <nav
      /*
        CÓ TÊN vì trang có HAI vùng điều hướng — rail này và đường dẫn của
        `TopBar`. Hai `<nav>` không tên thì trình đọc liệt kê hai mốc "điều
        hướng" giống hệt nhau, người nghe không biết nhảy vào cái nào (axe:
        `landmark-unique`, đo được ở sách tra B7).
      */
      aria-label="Điều hướng chính"
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
          <div key={g.heading} className="flex flex-col gap-0.5">
            {expanded ? (
              <div className="text-k-label px-3 pt-2 pb-1 font-bold tracking-[.08em] text-[var(--ink-3)] uppercase">
                {g.heading}
              </div>
            ) : (
              gi > 0 && <div className="mx-3 my-1.5 border-t border-[var(--hair)]" />
            )}
            {g.items.map((it) => {
              const on = activeHref === it.href || activeHref.startsWith(`${it.href}/`)
              const body = (
                <Link
                  href={it.href}
                  prefetch
                  aria-current={on ? 'page' : undefined}
                  /*
                    Thu gọn thì link CHỈ có icon — không có chữ nào làm tên.
                    Trước B7½ kit trông vào nơi gọi tự đưa icon có `label`; quên
                    là link câm ("liên kết" trơn). Tooltip không cứu được: nó là
                    MÔ TẢ và chỉ có khi đang mở. Mở rộng thì nhãn đã in ra.
                  */
                  aria-label={expanded ? undefined : it.label}
                  className={cn(
                    'relative mx-2 flex h-[30px] items-center rounded-[var(--radius-sm)]',
                    expanded ? 'gap-2.5 px-2.5' : 'justify-center px-0',
                    on
                      ? 'bg-[var(--act-wash)] font-semibold text-[var(--act)] shadow-[inset_2px_0_0_var(--act)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
                  )}
                >
                  <span className="relative grid w-4 shrink-0 place-items-center">
                    {/*
                      ĐANG ĐI THÌ PHẢI NÓI. `useLinkStatus` (Next 16) trả cờ
                      pending của CHÍNH `Link` cha, nên spinner mọc đúng chỗ
                      vừa bấm — không phải một thanh chạy ở đâu đó trên đỉnh
                      màn. Trang danh sách của module này dựng ở server và có
                      trang mất một nhịp; không có tín hiệu nào thì người dùng
                      bấm lại lần hai, rồi lần ba.
                    */}
                    <NavPending fallback={it.icon} />{' '}
                    {/* Thu gọn: số đếm co thành chấm — con số không đọc được
                        ở 17px cạnh icon 16px, nhưng "có việc" thì thấy được. */}
                    {!expanded && !!it.count && (
                      <span
                        aria-hidden
                        data-count-dot=""
                        className={cn(
                          'absolute -top-[3px] -right-[5px] size-[7px] rounded-full ring-2 ring-[var(--surface-card)]',
                          /*
                            Chấm THEO TONE của số, cùng luật với `Count`: đỏ =
                            quá hạn, vàng = sắp trễ, còn lại xám. Bản trước tô
                            `--act` cho mọi thứ không phải `stop` — tức "sắp trễ"
                            hiện thành chấm XANH HÀNH ĐỘNG, màu mà từ 16/09 chỉ
                            còn nghĩa "bấm được". Xám đậm (`--ink-3`) để chấm
                            trung tính vẫn thấy được trên nền thẻ.
                          */
                          it.countTone === 'stop'
                            ? 'bg-[var(--stop)]'
                            : it.countTone === 'warn'
                              ? 'bg-[var(--warn)]'
                              : 'bg-[var(--ink-3)]',
                        )}
                      />
                    )}
                  </span>
                  {expanded && (
                    <>
                      <span className="text-k-sm truncate">{it.label}</span>
                      <span className="ml-auto">
                        <Count n={it.count ?? 0} tone={it.countTone} />
                      </span>
                    </>
                  )}
                </Link>
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
          // `type="button"`: rail có thể nằm trong một `<form>` của layout —
          // nút mặc định là `submit`, bấm thu gọn menu là nộp form.
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          // Nói TRẠNG THÁI chứ không chỉ đổi nhãn: người nghe biết rail đang mở.
          aria-expanded={expanded}
          className={cn(
            'text-k-sm mx-2 mb-1 flex h-[26px] items-center rounded-[var(--radius-sm)] text-[var(--ink-3)]',
            'hover:bg-[var(--surface)] hover:text-[var(--ink-2)]',
            expanded ? 'gap-2 px-2.5' : 'justify-center',
          )}
        >
          <span className="text-k-body leading-none">{expanded ? '«' : '»'}</span>
          {expanded && 'Thu gọn'}
        </button>
      )}

      {footer && <div className="shrink-0 border-t border-[var(--line)]">{footer}</div>}
    </nav>
  )
}

/* ── PHÍM TẮT THEO MÁY ──────────────────────────────────────────────────
   Người dùng ở đây gần như toàn Windows — gợi ý "⌘ K" là gợi ý một phím họ
   không có. Nhưng chỉ TRÌNH DUYỆT biết máy gì; server dựng HTML thì không.

   Vì thế đi bằng `useSyncExternalStore` với ẢNH CHỤP PHÍA SERVER = "Ctrl":
   lúc hydrate React dùng ảnh server (HTML hai bên trùng từng chữ, không báo
   lệch), rồi TỰ dựng lại với ảnh thật của trình duyệt ngay sau đó. Máy Mac
   thấy "Ctrl" một nhịp rồi thành "⌘" — cái giá nhỏ hơn lệch hydrate. Không
   dùng `useEffect` + `setState`: cùng kết quả nhưng tốn thêm một vòng dựng ở
   MỌI máy, kể cả khi không phải hydrate. */
const khongDoi = () => () => {}
function laMac(): boolean {
  const n = navigator as Navigator & { userAgentData?: { platform?: string } }
  return /mac|iphone|ipad|ipod/i.test(n.userAgentData?.platform || n.platform || '')
}

/**
 * Nhãn phím bổ trợ cho gợi ý phím tắt: `'⌘'` trên máy Apple, `'Ctrl'` ở mọi
 * máy khác — và LUÔN `'Ctrl'` ở lượt dựng phía server, để HTML server và lượt
 * hydrate đầu tiên trùng nhau.
 */
export function useModKeyLabel(): '⌘' | 'Ctrl' {
  return useSyncExternalStore(
    khongDoi,
    () => (laMac() ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  )
}

/** Hai phím gợi ý ở ô tìm — dùng chung cho `TopBar` (và cùng luật ở `CommandBar`). */
function SearchKeys() {
  const mod = useModKeyLabel()
  const kbd =
    'text-k-label rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-1 font-[family-name:var(--font-mono)]'
  return (
    <span className="ml-auto flex gap-1">
      <kbd className={kbd}>{mod}</kbd>
      <kbd className={kbd}>K</kbd>
    </span>
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
  /**
   * Đường dẫn, bắt đầu từ mục đang xem — KHÔNG lặp tên phòng (rail đã nói).
   * Mảnh có `href` là `next/link`; mảnh cuối không có `href` là trang hiện tại,
   * in đậm. Mảnh cuối luôn mang `aria-current="page"`.
   */
  crumbs: { label: string; href?: string }[]
  /**
   * Bấm ô "Đi tới lệnh, đơn, vật tư…". Bỏ trống thì KHÔNG vẽ ô tìm (không để một
   * nút chết). TopBar KHÔNG tự bắt phím tắt — "Ctrl K" (máy Apple: "⌘ K") chỉ là
   * gợi ý; nơi gọi tự gắn phím và mở bảng lệnh.
   */
  onSearch?: () => void
  /** Vùng bên phải ô tìm — nút thông báo, `Menu` tài khoản. */
  right?: ReactNode
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-3">
      {/* Tên "Đường dẫn": cùng trang với rail "Điều hướng chính" — hai mốc
          `navigation` phải phân biệt được bằng tai. */}
      <nav
        aria-label="Đường dẫn"
        className="text-k-sm flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap"
      >
        {crumbs.map((c, i) => {
          // Mảnh CUỐI là trang đang đứng — nói bằng `aria-current`, không chỉ
          // bằng chữ đậm (người nghe không thấy chữ đậm).
          const cuoi = i === crumbs.length - 1
          return (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-[var(--line-faint)]">
                  /
                </span>
              )}
              {c.href ? (
                /* `next/link`, cùng lý do với rail (chú thích đầu file): `<a>`
                   trần là tải lại CẢ TRANG — màn trắng một nhịp, mất trạng thái
                   vỏ, `loading.tsx` không chạy. */
                <Link
                  href={c.href}
                  aria-current={cuoi ? 'page' : undefined}
                  className="text-[var(--ink-2)] hover:text-[var(--act)] hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={cuoi ? 'page' : undefined}
                  className="font-semibold text-[var(--ink)]"
                >
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      {onSearch ? (
        <button
          type="button"
          onClick={onSearch}
          className="text-k-sm ml-auto flex h-7 w-full max-w-[240px] min-w-[120px] shrink items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[var(--ink-3)] hover:border-[var(--act)] hover:text-[var(--ink-2)]"
        >
          <span className="truncate">Đi tới lệnh, đơn, vật tư…</span>
          <SearchKeys />
        </button>
      ) : (
        /* KHÔNG có `onSearch` thì KHÔNG vẽ ô tìm. Bản trước vẫn vẽ: một nút
           trông bấm được, bấm thì không có gì — đúng loại "nút gạt người" mà
           `NoticeBar` đã bỏ ngày 17/09. Chỉ giữ khoảng đẩy `right` sang phải. */
        <span className="flex-1" />
      )}

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
  ariaLabel,
}: {
  /**
   * Các mục, theo thứ tự hiện. `danger` (xoá, huỷ) tô màu dừng và tự tách
   * xuống dưới một vạch; `blockedBy` khoá mục và in lý do dưới nhãn; `disabled`
   * khoá câm — chỉ dùng khi lý do đã nói ở chỗ khác. Mục khoá (cả hai kiểu) là
   * khoá MỀM: mũi tên vẫn dừng trên nó, `aria-disabled`, chọn thì không chạy.
   */
  items: {
    label: string
    onClick?: () => void
    danger?: boolean
    disabled?: boolean
    /**
     * Bộ phận giữ quyền — có giá trị thì mục bị khoá và NÓI LÝ DO ngay dưới
     * nhãn, cùng luật với `Btn blockedBy`; câu lý do là mô tả đọc được
     * (`aria-describedby`) của mục. Mục khoá câm là mục người ta bấm mãi rồi đi
     * hỏi vòng quanh.
     */
    blockedBy?: string
    /**
     * Câu LÝ DO khoá, in NGUYÊN VĂN dưới nhãn ("NCC chưa xác nhận — bấm NCC xác
     * nhận trước"). Dùng khi vướng là NGHIỆP VỤ chứ không phải bộ phận giữ quyền
     * — `blockedBy` ghép thành "Việc này do … quản lý", đọc sai với một câu lý do.
     * Có giá trị = mục khoá mềm, câu là mô tả đọc được (`aria-describedby`).
     */
    why?: string
    /**
     * Tên NHÓM của mục ("Giao & nhận", "Đơn"). Nhóm đổi thì menu kẻ một vạch và
     * in tên nhóm làm tiêu đề — menu dài hơn ~8 mục mà không nhóm thì mắt phải
     * đọc từng dòng. Các mục cùng nhóm phải đứng LIỀN nhau.
     */
    group?: string
  }[]
  /**
   * Chữ trên nút mở. Một ký tự ("⋯") thì nút vuông; có chữ ("Thao tác ▾")
   * thì nút giãn theo chữ. Menu luôn canh mép phải nút.
   */
  label?: string
  /**
   * Tên đọc được của nút mở. Bỏ trống thì: nhãn MỘT KÝ TỰ ("⋯") tự nhận
   * "Thêm thao tác"; nhãn có chữ ("Thao tác ▾") thì chính chữ đó là tên.
   */
  ariaLabel?: string
}) {
  /*
    ĐỨNG TRÊN RADIX DROPDOWN MENU TỪ 24/09/2026 (B1). Bản tự viết trước đó khai
    `role="menu"` + `role="menuitem"` nhưng:
     · KHÔNG có phím mũi tên — trong khi vai `menu` bảo trình đọc màn hình
       rằng mũi tên là cách đi, nên người dùng bàn phím bấm ↓ và không có gì;
     · không đưa tiêu điểm vào menu khi mở, không trả về nút khi đóng;
     · nút "⋯" không có tên — trình đọc màn hình đọc ra "dấu ba chấm ngang";
     · mục khoá dùng `opacity-45` — đúng lỗi tương phản đã bị cấm ở `Btn`
       ngày 16/09 (chữ 2,2:1, trượt AA);
     · nằm `absolute` trong DOM nơi gọi → bị cắt trong vùng `overflow`, và
       nằm dưới hộp thoại khi mở từ trong hộp.
    Giữ nguyên API (`items`, `label`) — chỉ THÊM `ariaLabel`, `blockedBy`, và
    (26/09/2026) `why` + `group` cho thanh hành động một hàng của đơn mua.
  */
  const ten = ariaLabel ?? ([...label].length === 1 ? 'Thêm thao tác' : undefined)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={ten}
          className={cn(
            /* Nút vuông chỉ đúng cho nhãn MỘT KÝ TỰ ("⋯"). Nhãn có chữ
               ("Thao tác ▾") mà ép vào ô vuông --ctl-h thì gãy hai dòng — lộ ra
               khi dựng /design-lab/mau-odoo-chung-tu (11/09/2026). */
            'grid h-[var(--ctl-h)] place-items-center rounded-[var(--radius)] whitespace-nowrap',
            [...label].length > 1 ? 'text-k-sm px-2.5' : 'text-k-lg w-[var(--ctl-h)]',
            'border border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink-2)]',
            'hover:border-[var(--ink-3)] hover:text-[var(--ink)]',
            'data-[state=open]:border-[var(--ink-3)] data-[state=open]:text-[var(--ink)]',
          )}
        >
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        {/* Token kit chỉ sống trong `.kit` — portal ra `<body>` thì phải đeo lại. */}
        <div className="kit contents">
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            collisionPadding={8}
            /* Menu dài (thanh một hàng của đơn mua gom ~20 mục) không được tràn
               khỏi màn: cao tối đa đúng phần Radix đo còn trống, dư thì cuộn. */
            className="z-[var(--z-pop)] max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[196px] overflow-y-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[var(--shadow-drop)]"
          >
            {items.map((it, i) => {
              const newGroup = !!it.group && it.group !== items[i - 1]?.group
              return (
                <Fragment key={i}>
                  {/* Mục NGUY HIỂM tách xuống dưới một vạch — kề sát mục thường
                      thì sớm muộn có người bấm nhầm. Một vạch cho cả CỤM mục
                      nguy hiểm, không phải mỗi mục một vạch. Nhóm mới cũng mở
                      bằng một vạch — nhưng không vạch trên mục đầu tiên. */}
                  {i > 0 && (newGroup || (it.danger && !items[i - 1].danger)) && (
                    <DropdownMenu.Separator className="my-1 h-px bg-[var(--hair)]" />
                  )}
                  {newGroup && (
                    <DropdownMenu.Label className="text-k-label px-3 pt-1 pb-0.5 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
                      {it.group}
                    </DropdownMenu.Label>
                  )}
                  <MenuRow it={it} />
                </Fragment>
              )
            })}
          </DropdownMenu.Content>
        </div>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/*
  MỘT MỤC MENU. Tách hàm riêng chỉ để có `useId` cho từng mục.

  MỤC KHOÁ VẪN NHẬN TIÊU ĐIỂM (B7½). Bản B1 đưa `disabled` cho Radix — Radix
  cho mũi tên NHẢY QUA mục đó, nên người dùng trình đọc màn hình không bao giờ
  đứng trên nó và không bao giờ nghe dòng "Việc này do Kế toán quản lý": lý do
  chỉ tới được người nhìn. Nay khoá kiểu `Btn blockedBy`: `aria-disabled` (đọc
  "mờ"), cú chọn bị nuốt trong `onSelect`, lý do là MÔ TẢ (`aria-describedby`)
  còn TÊN chỉ là nhãn — để trong nội dung thì câu lý do bị gộp vào tên.
  WAI-ARIA APG (mẫu Menu) cũng để mục khoá nhận tiêu điểm theo mặc định.
*/
function MenuRow({
  it,
}: {
  it: {
    label: string
    onClick?: () => void
    danger?: boolean
    disabled?: boolean
    blockedBy?: string
    why?: string
  }
}) {
  const id = useId()
  const khoa = !!it.blockedBy || !!it.why || !!it.disabled
  return (
    <DropdownMenu.Item
      aria-disabled={khoa || undefined}
      aria-labelledby={`${id}-ten`}
      aria-describedby={it.blockedBy || it.why ? `${id}-vi-sao` : undefined}
      // Gõ chữ cái để nhảy: Radix đọc `textContent`, mà nội dung có cả câu lý do.
      textValue={it.label}
      onSelect={(e) => {
        // Nuốt cú chọn VÀ giữ menu mở — đóng lại thì người dùng tưởng đã làm.
        if (khoa) return e.preventDefault()
        it.onClick?.()
      }}
      className={cn(
        'text-k-sm block w-full cursor-default px-3 py-1.5 text-left outline-none',
        /*
          Mục khoá dùng MỰC XÁM đọc được (`--ink-empty`, ~4,7:1), không dùng
          `opacity`. Mờ bằng opacity là mờ CẢ chữ lý do — đúng thứ người dùng cần
          đọc nhất. Nay nó nhận tiêu điểm nên cần nền khi đang trỏ — nền XÁM, không
          nền màu hành động: trỏ tới không có nghĩa là bấm được.
        */
        khoa
          ? 'cursor-not-allowed text-[var(--ink-empty)] data-[highlighted]:bg-[var(--surface-hover)]'
          : it.danger
            ? 'text-[var(--stop)] data-[highlighted]:bg-[var(--stop-wash)]'
            : 'text-[var(--ink)] data-[highlighted]:bg-[var(--act-wash)]',
      )}
    >
      <span id={`${id}-ten`}>{it.label}</span>
      {it.blockedBy && (
        <span
          id={`${id}-vi-sao`}
          className="text-k-label mt-px block text-[var(--ink-3)]"
        >
          Việc này do {it.blockedBy} quản lý
        </span>
      )}
      {it.why && !it.blockedBy && (
        <span
          id={`${id}-vi-sao`}
          className="text-k-label mt-px block text-[var(--ink-3)]"
        >
          {it.why}
        </span>
      )}
    </DropdownMenu.Item>
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
  /** Hai chữ cái trên ô tròn đại diện (vd. "LT"). */
  initials: string
  /**
   * Họ tên đầy đủ. Thu gọn thì hiện trong tooltip của ô tròn, và là TÊN đọc được
   * của ô tròn — ô nhận tiêu điểm nên bàn phím cũng mở được tooltip.
   */
  name: string
  /** Dòng phụ: vai trò hoặc phòng ("Cung ứng · Trưởng nhóm"). */
  sub: string
  /** Theo `NavRail`: `false` chỉ ô tròn, `true` ô tròn + tên + dòng phụ. */
  expanded?: boolean
  /** Bấm nút ⚙ "Tài khoản". Chỉ hiện ở chế độ mở rộng, và chỉ khi có hàm này. */
  onSettings?: () => void
}) {
  const avatar = (
    <span className="text-k-label grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--act-wash)] font-bold text-[var(--act)]">
      {initials}
    </span>
  )
  if (!expanded)
    return (
      <div className="flex justify-center py-2">
        {/*
          Thu gọn thì tên người dùng CHỈ nằm trong tooltip — mà tooltip chỉ mở
          khi rê chuột hoặc khi phần tử NHẬN TIÊU ĐIỂM. Ô tròn trước B7½ là
          `<span>` trơn nên bàn phím không tới được: tên người đang đăng nhập
          chỉ dành cho người cầm chuột. `tabIndex={0}` + vai `img` có tên (tên
          là họ tên; dòng phụ đi theo tooltip thành mô tả).
        */}
        <Tip label={`${name} · ${sub}`}>
          <span
            role="img"
            aria-label={name}
            tabIndex={0}
            className="text-k-label grid size-[26px] shrink-0 place-items-center rounded-full bg-[var(--act-wash)] font-bold text-[var(--act)]"
          >
            <span aria-hidden>{initials}</span>
          </span>
        </Tip>
      </div>
    )
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="text-k-sm block truncate font-semibold">{name}</span>
        <span className="text-k-label block truncate text-[var(--ink-3)]">{sub}</span>
      </span>
      {onSettings && (
        <Tip label="Tài khoản" side="top">
          <button
            type="button"
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

/* ══════════════════════════════════════════════════════════════════════
   MENU NGANG CỦA CHỨNG TỪ — bấm mục nào, thân trang CHỈ hiện mục đó.

   Thêm 27/09/2026 cho màn đơn mua (canvas "Đơn mua", trang "Menu tách thông
   tin", chủ dự án chốt menu NGANG). Màn chi tiết là trang đa nhiệm: Cung ứng
   xem dòng hàng, Kho xem giao nhận, Kế toán xem tiền — bày tất cả cùng lúc
   (khối gập + cột phải) là 2,6 màn cuộn và người dùng chê "rối". Chép Odoo
   notebook / SAP Object Page anchor bar, nhưng mỗi mục THAY thân trang chứ
   không cuộn tới.

   ĐỨNG TRÊN RADIX TABS: đúng vai `tablist/tab/tabpanel`, mũi tên trái/phải
   đi giữa các mục, Home/End, `aria-controls` — thứ bản tự viết `DocTabs`
   (gỡ 26/09/2026) phải tự làm. Có kiểm soát (`value` + `onValueChange`)
   để màn ghi mục đang mở vào đường dẫn (?muc=…) — gửi link là mở đúng mục.
   ══════════════════════════════════════════════════════════════════════ */
export type DocMenuItem = {
  /** Khoá của mục — trùng `value` của `DocMenuPanel` tương ứng, và là chữ trên đường dẫn (`?muc=tai-chinh`). */
  id: string
  /** Tên mục — danh từ ngắn nói câu hỏi mục đó trả lời ("Tài chính", "Giao & nhận"). */
  label: string
  /** Icon theo khái niệm nghiệp vụ, đứng trước chữ. */
  icon?: IcoName
  /**
   * TÍN HIỆU cạnh tên — cho biết mục có chuyện mà không phải mở ("chờ HĐ",
   * "hạn 29/09", "3"). Phải đếm/suy bằng ĐÚNG hàm mà mục đó dùng (nguyên tắc
   * 3). Không có gì đáng nói thì bỏ trống — đừng in "0" cho đủ bộ.
   */
  signal?: { text: string; tone?: Tone }
}

export function DocMenu({
  items,
  value,
  onValueChange,
  label,
  children,
}: {
  /** Các mục theo thứ tự hiện. Mục đầu thường là "Tổng quan" — màn mở sẵn mục đó. */
  items: DocMenuItem[]
  /** `id` của mục đang mở. Có kiểm soát: kit không giữ trạng thái. */
  value: string
  /** Gọi với `id` của mục vừa chọn (bấm hoặc mũi tên). Màn đổi `value` và ghi đường dẫn. */
  onValueChange: (id: string) => void
  /** Tên của menu cho trình đọc màn hình ("Nội dung đơn"). */
  label: string
  /** Các `DocMenuPanel` — MỘT cho mỗi mục. Chỉ panel đang mở được dựng. */
  children: ReactNode
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={onValueChange}
      activationMode="manual"
      className="flex min-h-0 flex-col"
    >
      <Tabs.List
        aria-label={label}
        className="flex shrink-0 gap-0.5 overflow-x-auto overflow-y-hidden border-b border-[var(--line)] bg-[var(--surface-card)] px-3"
      >
        {items.map((it) => (
          <Tabs.Trigger
            key={it.id}
            value={it.id}
            className={cn(
              'text-k-body -mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3.5 py-2.5 whitespace-nowrap',
              'text-[var(--ink-2)] outline-none hover:text-[var(--act)]',
              'focus-visible:shadow-[inset_0_0_0_2px_var(--act)]',
              'data-[state=active]:border-[var(--act)] data-[state=active]:font-semibold data-[state=active]:text-[var(--act)]',
            )}
          >
            {it.icon && <Ico name={it.icon} size={16} />}
            {it.label}
            {it.signal && <Tag tone={it.signal.tone}>{it.signal.text}</Tag>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  )
}

export function DocMenuPanel({
  value,
  children,
}: {
  /** `id` của mục trong `DocMenu` mà panel này thuộc về. */
  value: string
  /** Nội dung CHỈ của mục này — không lặp khối của mục khác. */
  children: ReactNode
}) {
  return (
    <Tabs.Content
      value={value}
      className="min-h-0 bg-[var(--surface-card)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--act)]"
    >
      {children}
    </Tabs.Content>
  )
}

/** Một lựa chọn của `ScopeSwitch`. */
export type ScopeOption<V extends string = string> = {
  /** Giá trị gửi về `onChange` và ghi lên địa chỉ trang (`?pham_vi=toi`). */
  value: V
  /** Nhãn ngắn — "Của tôi", "Cả phòng". Không nhồi số vào đây, số đi `count`. */
  label: string
  /**
   * Số dòng màn sẽ bày khi chọn phạm vi này — đếm bằng ĐÚNG hàm lọc của màn
   * (nguyên tắc 3: con số là lời hứa). Bỏ trống thì không in số.
   */
  count?: number
  /** Nói rõ phạm vi này gồm gì ("đơn tôi phụ trách") — thành `title` + mô tả cho trình đọc màn hình. */
  hint?: string
}

/**
 * CÔNG TẮC PHẠM VI — "Của tôi | Cả phòng" (27/09/2026).
 *
 * Mọi màn danh sách của một phòng trả lời cùng một câu hỏi ở HAI cỡ: việc của
 * tôi, hay của cả phòng. Trước đây mỗi màn tự chế một kiểu (chip "Của tôi" ở
 * Đơn mua, nút "Xem cả phòng" ở Hộp thư, không có gì ở Nhận hàng) — người dùng
 * không học được một chỗ bấm. Đây là MỘT thành phần cho mọi màn.
 *
 * Khác `Chip`: chip là bộ lọc BẬT/TẮT độc lập; phạm vi là chọn ĐÚNG MỘT trong
 * vài lựa chọn loại trừ nhau, nên dựng trên Radix `ToggleGroup` kiểu `single`:
 * Radix dựng `radiogroup`/`radio` + `aria-checked`, phím mũi tên đi giữa các
 * lựa chọn; không cho bỏ chọn — bấm lại lựa chọn đang bật thì giữ nguyên.
 *
 * Thành phần KHÔNG tự nhớ lựa chọn: màn giữ `value` (thường qua
 * `useScopePref`, nhớ theo tài khoản trên máy).
 */
export function ScopeSwitch<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Tên nhóm cho trình đọc màn hình và nhãn nhỏ đứng trước ("Phạm vi"). */
  label: string
  /** Lựa chọn đang bật. */
  value: V
  /** Các phạm vi, theo thứ tự hiện — thường 2: của tôi trước, cả phòng sau. */
  options: ScopeOption<V>[]
  /** Người dùng chọn phạm vi khác. Không gọi khi bấm lại lựa chọn đang bật. */
  onChange: (v: V) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-k-label font-semibold tracking-[.04em] text-[var(--ink-3)] uppercase">
        {label}
      </span>
      <ToggleGroup.Root
        type="single"
        value={value}
        aria-label={label}
        onValueChange={(v) => {
          if (v && v !== value) onChange(v as V)
        }}
        className="inline-flex h-[var(--chip-h)] overflow-hidden rounded-[13px] border border-[var(--line)] bg-[var(--surface-card)]"
      >
        {options.map((o) => {
          const on = o.value === value
          return (
            <ToggleGroup.Item
              key={o.value}
              value={o.value}
              title={o.hint}
              className={cn(
                'text-k-sm inline-flex items-center gap-1.5 px-2.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--act)] focus-visible:ring-inset',
                'not-first:border-l not-first:border-[var(--line)]',
                on
                  ? 'bg-[var(--act-wash)] font-semibold text-[var(--act)]'
                  : 'text-[var(--ink-2)] hover:text-[var(--ink)]',
              )}
            >
              {o.label}
              {o.count != null && (
                <span className="num text-k-label opacity-80">
                  {o.count.toLocaleString('vi-VN')}
                </span>
              )}
            </ToggleGroup.Item>
          )
        })}
      </ToggleGroup.Root>
    </div>
  )
}
