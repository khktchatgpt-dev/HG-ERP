'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Ico } from './Icon'
import { useModKeyLabel } from './Nav'
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
  /** Tên / logo ở đầu thanh, chữ đậm cỡ nhỏ. Kit không tự biến nó thành liên kết về trang chủ — cần thì truyền sẵn một thẻ link. */
  brand: ReactNode
  /**
   * Đường dẫn trái → phải. Mắt có `href` là thẻ `<a>` thật; mắt KHÔNG có `href`
   * là trang đang đứng, in đậm. Thường chỉ mắt cuối để trống `href`.
   */
  crumbs: { label: string; href?: string }[]
  /**
   * Gọi khi bấm ô "Đi tới…". Không có = không vẽ ô (nút không làm gì là lời hứa
   * suông). Thanh CHỈ vẽ ô và gợi ý phím ("Ctrl K", máy Apple "⌘ K") — nó không
   * tự bắt phím tắt, không tự mở hộp tìm. Màn gọi phải lo cả hai.
   */
  onSearch?: () => void
  /** Người đang đăng nhập: `initials` vào chấm tròn, `name · role` in cạnh. Chỉ để đọc, không phải menu. */
  user: { initials: string; name: string; role: string }
}) {
  const mod = useModKeyLabel()
  return (
    <div className="flex h-11 shrink-0 items-center gap-3.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-3.5">
      <div className="text-k-sm font-bold tracking-[.02em]">{brand}</div>
      {/*
        Mốc có TÊN + mảnh cuối `aria-current` (B7½, 24/09/2026): `<nav>` không
        tên đứng cạnh thanh điều hướng chính là hai mốc trùng tên — trình đọc
        đọc "điều hướng, điều hướng" và axe báo `landmark-unique`.
      */}
      <nav
        aria-label="Đường dẫn"
        className="text-k-sm flex min-w-0 items-center gap-2 text-[var(--ink-3)]"
      >
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-[var(--line-faint)]">
                /
              </span>
            )}
            {c.href ? (
              <a
                href={c.href}
                className="text-[var(--ink-2)] hover:text-[var(--act)] hover:underline"
              >
                {c.label}
              </a>
            ) : (
              <span
                aria-current={i === crumbs.length - 1 ? 'page' : undefined}
                className="font-semibold text-[var(--ink)]"
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex-1" />
      {/* Không `onSearch` thì không vẽ ô — một nút bấm không làm gì là lời hứa
          suông. Phím gợi ý theo máy người xem: Windows "Ctrl", Apple "⌘". */}
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          className="text-k-sm flex h-7 min-w-[190px] items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[var(--ink-3)] hover:border-[var(--act)] hover:text-[var(--ink-2)]"
        >
          Đi tới lệnh, đơn, vật tư…
          <span className="ml-auto flex gap-1">
            <kbd className="text-k-label rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-1 font-[family-name:var(--font-mono)]">
              {mod}
            </kbd>
            <kbd className="text-k-label rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-1 font-[family-name:var(--font-mono)]">
              K
            </kbd>
          </span>
        </button>
      )}
      <div className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
        <span className="text-k-label grid h-6 w-6 place-items-center rounded-full bg-[var(--act-wash)] font-bold text-[var(--act)]">
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
  panelId,
}: {
  /**
   * Các làn, theo thứ tự hiện. Số trên tab là `rows.length` — kit TỰ ĐẾM, không
   * nhận số rời, nên số trên tab và danh sách bên dưới không lệch được. Dựng bằng
   * `toLanes()`. Làn rỗng vẫn hiện, số 0 là thông tin.
   */
  lanes: Lane<T>[]
  /** `id` của làn đang mở. Có kiểm soát: kit không giữ trạng thái chọn. */
  activeId: string
  /** Gọi với `id` của làn khi bấm tab hoặc đi bằng mũi tên. Màn tự đổi `activeId` và lọc bảng. */
  onPick: (id: string) => void
  /**
   * Id vùng nội dung (`role="tabpanel"`) do MÀN dựng. Có thì mọi tab mang
   * `aria-controls` trỏ tới đó, và tab có id `${panelId}-tab-${lane.id}` để vùng
   * đặt `aria-labelledby` theo tab đang chọn. Không có = tab không trỏ đi đâu.
   */
  panelId?: string
}) {
  const auto = useId()
  const tabId = (id: string) => `${panelId ?? auto}-tab-${id}`
  /*
    PHÍM THEO MẪU TAB CỦA WAI-ARIA (B7½, 24/09/2026). Trước đây mỗi tab một
    điểm dừng Tab và không mũi tên nào chạy: đi qua bốn làn là bốn lần Tab mới
    tới bảng. Nay chỉ tab ĐANG CHỌN nhận Tab (roving tabindex); ← → vòng giữa
    các làn, Home/End về đầu/cuối, đi tới đâu CHỌN luôn tới đó (làn chỉ là bộ
    lọc, đổi làn không tốn gì nên không cần bước Enter).
  */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = lanes.findIndex((l) => l.id === activeId)
    const n = lanes.length
    const to =
      e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowLeft'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1
    if (to < 0 || !n) return
    e.preventDefault()
    const id = lanes[to].id
    onPick(id)
    document.getElementById(tabId(id))?.focus()
  }
  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className="-mb-px flex items-end gap-0.5 overflow-x-auto px-[var(--gutter)] pt-[var(--tab-top)]"
    >
      {lanes.map((l) => {
        const on = l.id === activeId
        return (
          <button
            key={l.id}
            id={tabId(l.id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onPick(l.id)}
            className={cn(
              'text-k-body relative flex h-[var(--tab-h)] shrink-0 items-center gap-2 rounded-t-[var(--radius)] border border-b-0 px-4 whitespace-nowrap',
              on
                ? 'border-[var(--line)] bg-[var(--surface)] font-semibold text-[var(--ink)] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[var(--surface)] after:content-[""]'
                : 'border-transparent font-medium text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
            )}
          >
            {l.icon && <Ico name={l.icon} size={15} />}
            {l.label}
            <span
              className={cn(
                'num text-k-sm grid h-[19px] min-w-[22px] place-items-center rounded-[10px] px-1.5 font-semibold',
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
 * Ẩn dưới 1280px (lớp `xl:flex` — mốc `xl` mặc định của Tailwind; chú thích
 * cũ ghi 1240px là lệch mã): dưới ngưỡng đó khay bóp bảng quá nhiều, lúc ấy
 * mới đáng đánh đổi sang trang riêng.
 */
export function InspectPanel({
  code,
  title,
  subtitle,
  children,
  actions,
}: {
  /** Mã chứng từ ở đỉnh khay — chữ đơn cách, màu hành động. Thứ mắt tìm đầu tiên khi khay vừa mở. */
  code: string
  /** Một dòng nói việc/đối tượng. Ở hộp thư là QUYẾT ĐỊNH cần ra ("Nhập đơn giá rồi gửi duyệt"), không phải tên trạng thái. */
  title: string
  /** Dòng phụ đơn cách dưới tiêu đề — thường "NCC · lệnh". Trống thì không vẽ. */
  subtitle?: string
  /** Thân khay — thường là các `InspectSection`. Khay tự cuộn dọc khi dài. */
  children: ReactNode
  /** Nút ở ĐÁY khay, xếp dọc, bị đẩy xuống đáy khi thân ngắn. Nút chính đặt trước. */
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
    // Mốc có TÊN (B7½, 24/09/2026): `<aside>` không tên cạnh một mốc bổ sung
    // khác (FactBox, khay thứ hai) là hai mốc trùng — trình đọc không phân biệt.
    <aside
      aria-label={`${code} — ${title}`}
      className="hidden w-[316px] max-w-[316px] min-w-[316px] shrink-0 flex-col overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] xl:flex"
    >
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="text-k-body font-[family-name:var(--font-mono)] font-bold text-[var(--act)]">
          {code}
        </div>
        <div className="text-k-body mt-1 leading-snug font-semibold">{title}</div>
        {subtitle && (
          <div className="text-k-sm mt-1 font-[family-name:var(--font-mono)] text-[var(--ink-3)]">
            {subtitle}
          </div>
        )}
      </div>
      {children}
      {actions && <div className="mt-auto flex flex-col gap-2 px-4 py-3">{actions}</div>}
    </aside>
  )
}

/** Một khối trong khay. */
export function InspectSection({
  title,
  children,
  level = 4,
}: {
  /** Tiêu đề khối, in hoa nhỏ, là thẻ tiêu đề cấp `level`. */
  title: string
  /** Nội dung khối. Các khối ngăn nhau bằng một vạch tóc, không đóng khung. */
  children: ReactNode
  /**
   * Cấp thẻ tiêu đề (mặc định 4 — giữ dàn tiêu đề các màn đang dùng). Màn chỉ
   * có `h1` thì truyền 2, để trình đọc không thấy thứ bậc nhảy cóc h1 → h4.
   * Đổi cấp không đổi hình.
   */
  level?: 2 | 3 | 4 | 5 | 6
}) {
  const H = `h${level}` as const
  return (
    <div className="border-b border-[var(--hair)] px-4 py-3">
      <H className="text-k-label mb-2 font-bold tracking-[.08em] text-[var(--ink-3)] uppercase">
        {title}
      </H>
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
export function WhyBox({
  lines,
  result,
}: {
  /**
   * Từng dòng phép tính, NGUYÊN VĂN, mỗi phần tử một dòng. Chữ đơn cách và GIỮ
   * khoảng trắng — dóng cột bằng nhiều dấu cách thì thẳng hàng; dòng quá dài vẫn
   * tự xuống dòng.
   */
  lines: string[]
  /** Kết quả — kit tự thêm `= ` phía trước, in đậm màu hành động. Phải trùng từng chữ số với con số đang được giải thích. */
  result: string
}) {
  return (
    <div className="text-k-sm mt-2 rounded-[var(--radius)] border border-[var(--hair)] bg-[var(--surface)] px-2.5 py-2 font-[family-name:var(--font-mono)] leading-[1.75] text-[var(--ink-2)]">
      {/* `whitespace-pre-wrap` (B7½, 24/09/2026): trước đây HTML gộp dãy dấu
          cách làm một, nên cột mà TheoLenhScreen / DoiChieuTable dóng bằng dấu
          cách bị xô lệch — đúng thứ "phép tính NGUYÊN VĂN" hứa không làm. */}
      {lines.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap">
          {l}
        </div>
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
  level,
}: {
  /** Một dòng: CHUYỆN GÌ. Viết như câu người nói, không phải mã trạng thái. */
  headline: string
  /** VÌ SAO trống. Nếu trống là đúng (lọc hẹp, đã xong hết) thì nói vậy. */
  reason: string
  /**
   * Việc làm tiếp — thường là một hai `Btn`. Không có việc gì để làm thì chính
   * điều đó là dấu hiệu nên xem lại vì sao màn này tồn tại.
   */
  next: ReactNode
  /**
   * Cấp thẻ tiêu đề cho dòng `headline`. Bỏ trống = `<div>` như cũ (không chen
   * một tiêu đề vào dàn tiêu đề của màn đang dùng). Truyền cấp khi khối rỗng
   * đứng thay cả một vùng nội dung — trình đọc nhảy tới được bằng phím tiêu đề.
   */
  level?: 2 | 3 | 4
}) {
  const H = level ? (`h${level}` as const) : 'div'
  return (
    <div className="mx-auto max-w-[560px] px-6 py-16 text-center">
      {/*
        VÙNG STATUS (B7½, 24/09/2026): bộ lọc làm bảng trống thì khối này hiện
        ra — trước đây trong im lặng, người không nhìn màn hình không biết bảng
        vừa trống. Chỉ bọc CHỮ (dòng đầu + lý do), không bọc nút: vùng thông báo
        mà chứa nút thì trình đọc đọc cả nhãn nút như một phần của tin.
      */}
      <div role="status">
        <H className="text-k-lg font-semibold text-[var(--ink)]">{headline}</H>
        <p className="text-k-sm mt-2 leading-relaxed text-[var(--ink-2)]">{reason}</p>
      </div>
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
/**
 * MỘT DỮ KIỆN đầu trang. Không `onClick` thì là chữ thuần, y như trước.
 *
 * Có `onClick` thì thành nút — nhưng vẫn giữ nguyên hình chữ: đây là dải nhận
 * diện, không phải hàng nút. Dấu hiệu bấm được nằm ở gạch chân mờ khi rê chuột
 * và ở nền nhạt khi đang chọn, đúng luật "nền đặc = bấm được" (không tô đặc
 * `--act` cho thứ chỉ là bộ lọc đang bật).
 */
function Fact({
  f,
  num = false,
}: {
  f: {
    label: string
    value: ReactNode
    tone?: Tone
    onClick?: () => void
    on?: boolean
  }
  num?: boolean
}) {
  const value = (
    <b
      className={cn(
        num && 'num',
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
  )
  if (!f.onClick) {
    return (
      <span>
        {f.label} {value}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={f.on}
      onClick={f.onClick}
      className={cn(
        '-mx-1 rounded-[var(--radius)] px-1 hover:bg-[var(--surface-hover)]',
        f.on && 'bg-[var(--act-wash)] font-semibold text-[var(--act-text)]',
      )}
    >
      {f.label} {value}
    </button>
  )
}

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
  /** Nhãn nhỏ in hoa trên tiêu đề: tên phòng hoặc loại chứng từ ("Cung ứng", "Đơn mua"). */
  eyebrow: string
  /** Tên màn hoặc mã chứng từ. Nằm trong `<h1>` — nên mỗi màn đúng một `ScreenHeader`. */
  title: ReactNode
  /** Nhãn trạng thái (thường một `Tag`) đứng ngay sau tiêu đề, trong cùng `<h1>` — trình đọc đọc liền với tên. */
  status?: ReactNode
  /** Chuỗi cha→con (`DocChain`) ngay trong đầu trang: nó là DANH TÍNH của trang, không phải một khối nội dung riêng. */
  chain?: ReactNode
  /**
   * Dữ kiện đầu trang. Có `onClick` = con số ĐƯA ĐI ĐƯỢC: bấm là lọc danh
   * sách xuống đúng chừng ấy dòng.
   *
   * Vì sao đáng thêm (đo 16/09/2026 ở `/mua-hang/don`): bốn dữ kiện chỉ đọc ở
   * đây lặp lại đúng số của ba chip lọc ngay bên dưới, nên cùng một khái niệm
   * hiện hai lần — một lần bấm được, một lần không. Cho chính chúng bấm được
   * thì bỏ được hàng chip trùng, và con số giữ đúng lời hứa của nó.
   */
  facts?: {
    /** Nhãn chữ thường, đứng trước giá trị. */
    label: string
    /** Giá trị in đậm; ở biến thể `compact` thì chữ đơn cách. */
    value: ReactNode
    /** Chỉ `stop`/`warn` đổi màu giá trị; tone khác giữ màu mực. */
    tone?: Tone
    /** Có thì dữ kiện thành nút lọc (`aria-pressed`), vẫn giữ hình chữ. */
    onClick?: () => void
    /** Đang là bộ lọc hiện hành — chỉ có nghĩa khi có `onClick`. */
    on?: boolean
  }[]
  /** Hành động ở GÓC PHẢI: nút chính + nút phụ + menu ⋯. Không co lại khi hàng chật — dữ kiện xuống dòng trước. */
  actions?: ReactNode
  /** Hàng thêm dưới đầu trang, vẫn nằm TRONG `<header>` — chỗ của `WorkLanes` hay một hàng gắn liền đầu trang. */
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
        <div className="flex min-h-[var(--head-h)] flex-wrap items-center gap-x-3.5 gap-y-1 py-0.5">
          <span className="text-k-label font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
            {eyebrow}
          </span>
          <h1 className="text-k-lg flex items-center gap-2 font-semibold tracking-[-.01em]">
            {title}
            {status}
          </h1>
          {chain && <span className="flex flex-wrap items-center gap-2">{chain}</span>}
          {facts && (
            <span className="text-k-sm flex flex-wrap gap-x-4 text-[var(--ink-2)]">
              {facts.map((f, i) => (
                <Fact key={i} f={f} num />
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
    <header className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] pt-3.5">
      <div className="flex items-start gap-4.5">
        <div className="min-w-0 flex-1">
          <div className="text-k-label font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
            {eyebrow}
          </div>
          <h1 className="text-k-title mt-1 flex items-center gap-3 font-semibold tracking-[-.015em]">
            {title}
            {status}
          </h1>
          {chain && <div className="mt-2 flex flex-wrap items-center gap-2">{chain}</div>}
          {facts && (
            <div className="text-k-sm mt-3 flex flex-wrap gap-5.5 text-[var(--ink-2)]">
              {facts.map((f, i) => (
                <Fact key={i} f={f} />
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
export function ScreenFrame({
  children,
  dense = false,
  tableMin,
  fill = false,
}: {
  /**
   * Cả màn, xếp dọc: đầu trang, hàng lọc, bảng, thanh đáy. Bảng chính phải là
   * con TRỰC TIẾP (không bọc thêm thẻ) để nhận `flex-1` — phần cao còn lại — và
   * tự cuộn bên trong, giữ tiêu đề cột và chân tổng dính.
   */
  children: ReactNode
  /**
   * Bề rộng tối thiểu của bảng chính, px — `Table` đọc qua biến `--table-min`.
   *
   * VÌ SAO LÀ PROP CHỨ KHÔNG PHẢI MỘT CON SỐ MẶC ĐỊNH TO HƠN: `Table` đã ghi
   * rõ "MÀN tự khai theo số cột của mình", nhưng trước 23/09/2026 kit KHÔNG
   * có cửa nào để khai — `ScreenFrame` không nhận `style`, mà bọc thêm một
   * thẻ quanh `Table` thì đứt chuỗi flex và bảng mất `flex-1`. Kết quả: cả
   * app đúng MỘT file khai được biến này (bên Mua hàng, nhờ nó tự dựng thẻ
   * bọc riêng), mọi màn còn lại rơi về 680px mặc định.
   *
   * 680px chỉ vừa cho bảng 4–5 cột. Bảng nào rộng hơn thì KHÔNG cuộn ngang
   * mà bị BÓP: cột co lại, chữ cắt cụt. Màn Lệnh sản xuất là ca nặng nhất —
   * riêng dải 12 công đoạn đã ~200px, cộng năm cột chữ nữa.
   */
  tableMin?: number
  /**
   * Bật mật độ DÀY (`.kit-dense`: hàng 25px thay 30px, đệm dọc 2px thay 5px)
   * cho riêng màn này.
   *
   * Dành cho MÀN NHẬP LƯỚI (khuôn F), nơi người dùng gõ hàng trăm dòng mỗi
   * ngày và thứ quý nhất là số hàng nhìn thấy cùng lúc. Fiori tách mật độ
   * thành ba bậc (cozy / compact / condensed) đúng vì lý do đó, và cảnh báo
   * **không trộn hai mật độ trong cùng một cây DOM** — nên bật ở ĐÂY, ngay
   * thẻ bọc cả màn, chứ đừng rắc `.kit-dense` vào vài khối con.
   */
  dense?: boolean
  /**
   * LẤP ĐẦY KHUNG CHA (`height: 100%`) thay vì tự đo "100dvh − vị trí". Dùng khi
   * màn được NHÚNG vào một khung đã có chiều cao (trang mẫu, xem trước, hộp
   * thoại lớn). Không bật thì khung cao theo cửa sổ: nhúng trong cửa sổ thấp là
   * bảng bị bóp còn vài chục px (đo 27/09/2026 khi soi hộp ký trong design-lab).
   */
  fill?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ h: string; m: string } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || fill) return
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
  }, [fill])

  return (
    <div
      ref={ref}
      style={
        {
          height: fill ? '100%' : (box?.h ?? 'calc(100dvh - 60px)'),
          margin: fill ? undefined : box?.m,
          ...(tableMin ? { '--table-min': `${tableMin}px` } : null),
        } as CSSProperties
      }
      // `kit` phải đi CÙNG `kit-dense` trên một thẻ: token dày khai ở
      // `.kit.kit-dense`, thiếu vế đầu là không ăn.
      className={cn('flex flex-col overflow-hidden', dense && 'kit kit-dense')}
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
  /** Việc phải làm, bằng lời nghiệp vụ ("Chờ Giám đốc ký") — không phải tên trạng thái trong DB. In hoa nhỏ. */
  label: string
  /**
   * Số việc. Phải đếm bằng ĐÚNG hàm mà trang đích dùng để lọc — con số là lời
   * hứa. Bằng 0 thì hiện dấu ✓ thay số và bỏ màu `tone`.
   */
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
  /** Màu con số khi CÓ việc: `stop` trễ, `warn` đang chờ, `done` xong. Số 0 luôn về trung tính — không tô đỏ tin mừng. */
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
      <span className="text-k-label leading-tight font-semibold tracking-[.05em] text-[var(--ink-2)] uppercase">
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
            className="text-k-doc leading-none text-[var(--done)]"
            title="Không còn việc nào"
          >
            ✓
          </span>
        ) : (
          <span
            className={cn(
              'num text-k-doc leading-none font-bold tracking-[-.02em]',
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
      <span className="text-k-label leading-snug text-[var(--ink-3)]">{hint}</span>
    </Box>
  )
}

/** Hàng ô việc — tự xuống dòng, không ép số cột. */
export function WorkTiles({
  children,
}: {
  /**
   * Các `WorkTile`. Lưới 2 cột, lên 3 khi KHUNG CHỨA rộng từ 448px, lên 6 từ
   * 768px; hơn sáu ô thì xuống hàng.
   */
  children: ReactNode
}) {
  /*
    CHIA CỘT THEO KHUNG CHỨA, KHÔNG THEO CỬA SỔ (28/09/2026). Bản cũ dùng
    `sm:`/`lg:` — bề rộng TRÌNH DUYỆT — nên ô việc đặt trong một cột hẹp (cột
    chính cạnh khay phải, khung xem nhúng) vẫn đòi 6 cột, hoặc ngược lại cột
    rộng trong cửa sổ hẹp chỉ được 2. Đo được khi soi màn Giám sát mua hàng.
  */
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @3xl:grid-cols-6">{children}</div>
    </div>
  )
}
