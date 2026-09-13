'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Lane, Tone } from './kit-core'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — KHUNG MÀN HÌNH
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ba thứ ở đây thay đổi hẳn cách bố cục so với v3.
 */

/**
 * THANH LỆNH — thay cho sidebar ghim 200px.
 *
 * Vì sao bỏ sidebar: người dùng ERP mở đúng vài màn mỗi ngày và họ đi bằng
 * TRÍ NHỚ, không "duyệt menu". 200px cố định là ~15% bề ngang lấy khỏi bảng
 * — thứ duy nhất người ta thật sự nhìn — để nuôi một danh sách mà sau tuần
 * đầu không ai đọc nữa.
 *
 * Đổi lại phải có ⌘K thật sự tốt, nếu không là khoá người dùng ra ngoài.
 * Chuyển đổi phải theo ba bước: thêm ⌘K + nút thu gọn → theo dõi 2 tuần →
 * đủ tự tin mới bỏ hẳn sidebar.
 */
export function CommandBar({
  brand,
  crumbs,
  onSearch,
  user,
}: {
  brand: ReactNode
  crumbs: { label: string; href?: string }[]
  onSearch?: () => void
  user: { initials: string; name: string; role: string }
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-[14px] border-b border-[var(--line)] bg-[var(--surface-card)] px-[14px]">
      <div className="text-[12.5px] font-bold tracking-[.02em]">{brand}</div>
      <nav className="flex min-w-0 items-center gap-[7px] text-[var(--fs-sm)] text-[var(--ink-3)]">
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
      <div className="flex-1" />
      <button
        onClick={onSearch}
        className="flex h-7 min-w-[190px] items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-[10px] text-[var(--fs-sm)] text-[var(--ink-3)] hover:border-[var(--act)] hover:text-[var(--ink-2)]"
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
      <div className="flex items-center gap-2 text-[var(--fs-sm)] text-[var(--ink-2)]">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--act-wash)] text-[10.5px] font-bold text-[var(--act)]">
          {user.initials}
        </span>
        {user.name} · {user.role}
      </div>
    </div>
  )
}

/**
 * HÀNG ĐỢI VIỆC — tab, nhưng KHÔNG phải để phân loại dữ liệu.
 *
 * Mỗi lane là việc của một người khác nhau (Cung ứng / Kỹ thuật / đã xong).
 * Số đếm là LỜI HỨA: bấm vào thấy đúng ngần đó dòng phải làm — cùng ranh
 * giới với các tờ trong file Excel, để giấy và màn không đếm khác nhau.
 *
 * Lane rỗng vẫn giữ chỗ: số 0 là thông tin ("hết việc rồi"), không phải lý
 * do giấu tab đi.
 */
export function WorkLanes<T>({
  lanes,
  activeId,
  onPick,
}: {
  lanes: Lane<T>[]
  activeId: string
  onPick: (id: string) => void
}) {
  return (
    <div
      role="tablist"
      className="-mb-px flex items-end gap-[2px] px-[var(--gutter)] pt-[13px]"
    >
      {lanes.map((l) => {
        const on = l.id === activeId
        return (
          <button
            key={l.id}
            role="tab"
            aria-selected={on}
            onClick={() => onPick(l.id)}
            className={cn(
              'relative flex h-[37px] items-center gap-[9px] rounded-t-[var(--radius)] border border-b-0 px-[15px] text-[13px]',
              on
                ? 'border-[var(--line)] bg-[var(--surface)] font-semibold text-[var(--ink)] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[var(--surface)] after:content-[""]'
                : 'border-transparent font-medium text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
            )}
          >
            {l.label}
            <span
              className={cn(
                'num grid h-[19px] min-w-[22px] place-items-center rounded-[10px] px-[6px] text-[11.5px] font-semibold',
                on
                  ? l.tone === 'stop'
                    ? 'bg-[var(--stop)] text-white'
                    : 'bg-[var(--act)] text-white'
                  : l.tone === 'stop'
                    ? 'bg-[var(--stop-wash)] text-[var(--stop)]'
                    : 'bg-[var(--surface-raised)] text-[var(--ink-2)]',
              )}
            >
              {l.rows.length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * KHAY KIỂM TRA — panel phải, thay cho việc nhảy sang trang khác.
 *
 * Vì sao: người đang rà 16 mã mà bấm một dòng rồi bị đẩy sang trang khác là
 * MẤT CHỖ ĐỨNG — quay lại phải cuộn tìm lại đúng dòng vừa xem. Với công
 * việc "duyệt qua một danh sách", giữ nguyên vị trí quan trọng hơn màn chi
 * tiết rộng.
 *
 * Ẩn dưới 1240px: dưới ngưỡng đó khay bóp bảng quá nhiều, lúc ấy mới đáng
 * đánh đổi sang trang riêng.
 */
export function InspectPanel({
  code,
  title,
  subtitle,
  children,
  actions,
}: {
  code: string
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}) {
  /*
    BẪY (08/09/2026): `shrink-0` một mình KHÔNG đủ. Trong flex row, phần tử
    có chiều rộng cố định vẫn bị bóp nếu anh em của nó không khai `min-w-0`
    — bảng 8 cột đẩy ngang, khay co lại và chữ trong khay bị cắt cụt
    ("5 đơ...", "Bao l..."). Khoá cả `w` lẫn `min-w`/`max-w` để khay là
    kích thước BẤT BIẾN, phần thừa dồn cho bảng tự cuộn ngang.
  */
  return (
    <aside className="hidden w-[316px] max-w-[316px] min-w-[316px] shrink-0 flex-col overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] xl:flex">
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-[15px] py-[13px]">
        <div className="font-[family-name:var(--font-mono)] text-[13px] font-bold text-[var(--act)]">
          {code}
        </div>
        <div className="mt-[3px] text-[13.5px] leading-snug font-semibold">{title}</div>
        {subtitle && (
          <div className="mt-1 font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--ink-3)]">
            {subtitle}
          </div>
        )}
      </div>
      {children}
      {actions && (
        <div className="mt-auto flex flex-col gap-2 px-[15px] py-[13px]">{actions}</div>
      )}
    </aside>
  )
}

/** Một khối trong khay. */
export function InspectSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-[var(--hair)] px-[15px] py-3">
      <h4 className="mb-[9px] text-[10.5px] font-bold tracking-[.08em] text-[var(--ink-3)] uppercase">
        {title}
      </h4>
      {children}
    </div>
  )
}

/**
 * PHÉP TÍNH BÀY RA — khối giải thích một con số.
 *
 * Đây là component quan trọng nhất của v4. Số nào người dùng không kiểm được
 * thì họ không tin; không tin thì họ mở Excel tính tay, và lúc đó ERP tụt
 * xuống thành nơi nhập liệu chứ không phải nơi ra quyết định.
 *
 * Nhận từng dòng phép tính để hiển thị nguyên văn cách tính — KHÔNG diễn
 * giải lại, không làm tròn khác với số trên bảng.
 */
export function WhyBox({ lines, result }: { lines: string[]; result: string }) {
  return (
    <div className="mt-[9px] rounded-[var(--radius)] border border-[var(--hair)] bg-[var(--surface)] px-[10px] py-[9px] font-[family-name:var(--font-mono)] text-[11.5px] leading-[1.75] text-[var(--ink-2)]">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      <div className="font-bold text-[var(--act)]">= {result}</div>
    </div>
  )
}

/**
 * TRẠNG THÁI RỖNG — bắt buộc nói LÝ DO và VIỆC PHẢI LÀM.
 *
 * `reason` và `next` không phải optional, có chủ ý: "Không có dữ liệu" là
 * ngõ cụt đẩy người dùng đi hỏi vòng quanh. Kiểu bắt buộc ở đây là cách rẻ
 * nhất để không ai viết được empty state vô nghĩa.
 */
export function Empty({
  headline,
  reason,
  next,
}: {
  headline: string
  reason: string
  next: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[560px] px-6 py-16 text-center">
      <div className="text-[15px] font-semibold text-[var(--ink)]">{headline}</div>
      <p className="mt-2 leading-relaxed text-[var(--fs-sm)] text-[var(--ink-2)]">
        {reason}
      </p>
      <div className="mt-4 flex justify-center gap-2">{next}</div>
    </div>
  )
}

/**
 * ĐẦU TRANG — danh tính chứng từ + hành động ở GÓC PHẢI.
 *
 * Chuỗi cha→con nằm ngay trong header dưới dạng chip bấm được, không tách
 * thành khối riêng chiếm thêm một hàng: nó là DANH TÍNH của trang, không
 * phải một mục nội dung.
 */
export function ScreenHeader({
  eyebrow,
  title,
  status,
  chain,
  facts,
  actions,
  children,
  compact = false,
}: {
  eyebrow: string
  title: ReactNode
  status?: ReactNode
  chain?: ReactNode
  facts?: { label: string; value: ReactNode; tone?: Tone }[]
  actions?: ReactNode
  children?: ReactNode
  /**
   * MỘT HÀNG — SAP List Report / Dynamics list page: tiêu đề, dữ kiện và nút
   * cùng hàng, cao ~38px. Đo 10/09/2026 ở 1366×768: đầu trang ba tầng (nhãn,
   * tiêu đề, dữ kiện) + hai hàng lọc đẩy bảng xuống 253px — một phần ba màn
   * trước khi thấy dòng đầu. Trang danh sách và bàn làm việc dùng biến thể này.
   */
  compact?: boolean
}) {
  if (compact) {
    return (
      <header className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)]">
        <div className="flex min-h-[38px] flex-wrap items-center gap-x-[14px] gap-y-1 py-1">
          <span className="font-semibold tracking-[.09em] text-[var(--fs-micro)] text-[var(--ink-3)] uppercase">
            {eyebrow}
          </span>
          <h1 className="flex items-center gap-[9px] text-[15px] font-semibold tracking-[-.01em]">
            {title}
            {status}
          </h1>
          {chain && <span className="flex flex-wrap items-center gap-2">{chain}</span>}
          {facts && (
            <span className="flex flex-wrap gap-x-[16px] text-[var(--fs-sm)] text-[var(--ink-2)]">
              {facts.map((f, i) => (
                <span key={i}>
                  {f.label}{' '}
                  <b
                    className={cn(
                      'num font-semibold',
                      f.tone === 'stop'
                        ? 'text-[var(--stop)]'
                        : f.tone === 'warn'
                          ? 'text-[var(--warn)]'
                          : 'text-[var(--ink)]',
                    )}
                  >
                    {f.value}
                  </b>
                </span>
              ))}
            </span>
          )}
          {actions && (
            <span className="ml-auto flex shrink-0 items-center gap-2">{actions}</span>
          )}
        </div>
        {children}
      </header>
    )
  }
  return (
    <header className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] pt-[14px]">
      <div className="flex items-start gap-[18px]">
        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-[.09em] text-[var(--fs-micro)] text-[var(--ink-3)] uppercase">
            {eyebrow}
          </div>
          <h1 className="mt-[3px] flex items-center gap-[11px] font-semibold tracking-[-.015em] text-[var(--fs-title)]">
            {title}
            {status}
          </h1>
          {chain && <div className="mt-2 flex flex-wrap items-center gap-2">{chain}</div>}
          {facts && (
            <div className="mt-[11px] flex flex-wrap gap-[22px] text-[var(--fs-sm)] text-[var(--ink-2)]">
              {facts.map((f, i) => (
                <span key={i}>
                  {f.label}{' '}
                  <b
                    className={cn(
                      'font-semibold',
                      f.tone === 'stop'
                        ? 'text-[var(--stop)]'
                        : f.tone === 'warn'
                          ? 'text-[var(--warn)]'
                          : 'text-[var(--ink)]',
                    )}
                  >
                    {f.value}
                  </b>
                </span>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/**
 * KHUNG MÀN — chốt chiều cao đúng bằng phần màn hình còn lại.
 *
 * BẪY ĐÃ DÍNH (08/09/2026, màn NCC 164 dòng): shell của app dùng
 * `min-h-screen` — chỉ đặt SÀN, không đặt TRẦN. Màn con đặt `min-h-...`
 * nữa thì `flex-1` của <main> không có gì giới hạn, `overflow-auto` của
 * bảng KHÔNG bao giờ kích hoạt, và bảng giãn hết chiều dài: trang cao
 * 5.842px thay vì 1.000px. Hậu quả người dùng thấy: cuộn cả trang thay vì
 * cuộn trong bảng, nên tiêu đề cột và chân bảng dính đều VÔ HIỆU — mất
 * đúng hai thứ khiến bảng dài dùng được.
 *
 * KHÔNG hard-code `calc(100vh - 3.5rem)`: chiều cao thanh trên do shell
 * quyết định và có thể đổi (topbar đo được 59px, không tròn số). Đo vị trí
 * TOP của chính khung này rồi lấy phần còn lại — đúng với mọi shell, kể cả
 * khi màn được nhúng ở chỗ khác.
 *
 * Dùng `100dvh` chứ không `100vh`: trên trình duyệt di động thanh địa chỉ
 * thu vào/nhả ra làm 100vh sai lệch.
 *
 * KHUNG TỰ HUỶ PADDING CỦA CHA bằng lề âm đo được — màn con KHÔNG tự kéo
 * `-m-4/-m-6` nữa. Đo 08/09/2026: hai bên cùng kéo âm thì khối con tràn ra
 * ngoài khung cha 24px và bị cắt mất mép trái (cột "Mã" chỉ còn đuôi, tiêu
 * đề trang cụt thành "UNG ỨNG"). Một chỗ giữ lề, một chỗ giữ chiều cao —
 * gộp về cùng component thì không còn hai bên đánh nhau.
 */
export function ScreenFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ h: string; m: string } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const host = el.parentElement
      const cs = host ? getComputedStyle(host) : null
      const pt = cs ? parseFloat(cs.paddingTop) || 0 : 0
      const pr = cs ? parseFloat(cs.paddingRight) || 0 : 0
      const pb = cs ? parseFloat(cs.paddingBottom) || 0 : 0
      const pl = cs ? parseFloat(cs.paddingLeft) || 0 : 0
      // top ĐO TRƯỚC khi bù lề âm, nên trừ luôn padding-top để không tính hai lần.
      const top = el.getBoundingClientRect().top - pt
      setBox({
        h: `calc(100dvh - ${Math.round(top)}px)`,
        m: `${-pt}px ${-pr}px ${-pb}px ${-pl}px`,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div
      ref={ref}
      style={{ height: box?.h ?? 'calc(100dvh - 60px)', margin: box?.m }}
      className="flex flex-col overflow-hidden"
    >
      {children}
    </div>
  )
}

/**
 * Ô VIỆC trên trang chủ theo vai trò — mẫu SAP Fiori launchpad tile.
 *
 * "Con số trên ô là MỘT LỜI HỨA": bấm vào phải ra đúng chừng ấy dòng cần xử
 * lý. Sai một dòng là hỏng niềm tin vào cả trang chủ, và người dùng quay lại
 * cách cũ — mở từng danh sách rồi tự lọc.
 *
 * BA ĐIỀU KHÁC THẺ KPI thường gặp:
 *
 * 1. Ô là CỬA VÀO VIỆC, không phải chỉ số. Mỗi ô dẫn tới một danh sách đã lọc
 *    sẵn đúng điều kiện nó vừa đếm — không phải "xem báo cáo".
 *
 * 2. SỐ 0 KHÔNG PHẢI LÚC NÀO CŨNG XẤU. "Đơn quá hạn: 0" là tin mừng, tô đỏ
 *    số 0 làm người ta hoảng vô cớ. Chỉ tô màu khi CÓ việc.
 *
 * 3. Ô nói VIỆC PHẢI LÀM, không nói tên trạng thái. "Chờ Giám đốc ký" thay vì
 *    "pending_approval".
 */
export function WorkTile({
  label,
  count,
  hint,
  href,
  onClick,
  on = false,
  tone = 'neutral',
  strong = false,
}: {
  label: string
  count: number
  /** Nói rõ đếm cái gì — người dùng phải kiểm được lời hứa của con số. */
  hint: string
  /**
   * DẪN ĐI nơi khác. Loại trừ nhau với `onClick`.
   *
   * Trước 11/09/2026 đây là prop BẮT BUỘC và ô luôn là thẻ <a> — nghĩa là ô
   * việc chỉ biết điều hướng, không bao giờ lọc được danh sách ngay tại chỗ.
   * Đó chính là lý do bàn làm việc thành BỆ PHÓNG chứ không thành BÀN LÀM
   * VIỆC: mọi ô đều bắn người dùng sang trang khác, mất bộ lọc, mất chỗ đứng.
   */
  href?: string
  /** LỌC TẠI CHỖ. Dynamics workspace làm vậy: ô số là bộ lọc, không phải link. */
  onClick?: () => void
  /** Ô đang là bộ lọc hiện hành — chỉ có nghĩa khi dùng `onClick`. */
  on?: boolean
  tone?: Tone
  /** Ô của CHÍNH người đang xem — nổi hơn các ô còn lại. */
  strong?: boolean
}) {
  // Hết việc thì về màu trung tính, dù ô khai tone gì.
  const t = count === 0 ? 'neutral' : tone
  const Box = href ? 'a' : 'button'
  return (
    <Box
      {...(href ? { href } : { type: 'button' as const, onClick })}
      aria-pressed={href ? undefined : on}
      className={cn(
        'group flex min-w-0 flex-col justify-between gap-2 rounded-[var(--radius)] border p-3 text-left transition-colors',
        on && 'ring-1 ring-[var(--act)]',
        strong
          ? 'border-[var(--act)] bg-[var(--act-wash)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] hover:border-[var(--ink-3)]',
      )}
    >
      <span className="leading-tight font-semibold tracking-[.05em] text-[var(--fs-micro)] text-[var(--ink-2)] uppercase">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        {/*
          HẾT VIỆC THÌ HIỆN ✓, KHÔNG HIỆN SỐ 0.

          Đo trên ảnh 09/09/2026: JetBrains Mono vẽ số 0 có gạch chéo bên
          trong, ở cỡ 26px nó rối mắt và HÚT nhìn ngang với số 66 bên cạnh —
          trong khi "0 việc" là thứ người dùng cần LƯỚT QUA, không cần đọc.
          Dấu ✓ nói cùng một điều trong một nét.
        */}
        {count === 0 ? (
          <span
            className="text-[22px] leading-none text-[var(--done)]"
            title="Không còn việc nào"
          >
            ✓
          </span>
        ) : (
          <span
            className={cn(
              'num text-[26px] leading-none font-bold tracking-[-.02em]',
              t === 'stop'
                ? 'text-[var(--stop)]'
                : t === 'warn'
                  ? 'text-[var(--warn)]'
                  : t === 'done'
                    ? 'text-[var(--done)]'
                    : count === 0
                      ? 'text-[var(--ink-3)]'
                      : 'text-[var(--ink)]',
            )}
          >
            {count}
          </span>
        )}
      </span>
      <span className="text-[10.5px] leading-snug text-[var(--ink-3)]">{hint}</span>
    </Box>
  )
}

/** Hàng ô việc — tự xuống dòng, không ép số cột. */
export function WorkTiles({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{children}</div>
  )
}
