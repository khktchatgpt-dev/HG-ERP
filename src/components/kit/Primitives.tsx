'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import Link from 'next/link'
import { Ico, type IcoName } from './Icon'
import { cn } from '@/lib/utils'
import type { Tone } from './kit-core'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — NGUYÊN LIỆU
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Chia theo VIỆC người dùng làm, không theo hình dạng.
 *
 * v3 chia theo hình dạng và đẻ ra cặp `StatTile` / `StatsBar` khác nhau chỉ
 * ở chỗ "bấm được hay không" — người dùng không nghĩ bằng hình dạng, nên
 * hai component đó phải giữ đồng bộ bằng tay và sớm muộn lệch nhau. Ở v4,
 * bấm được hay không là một PROP, không phải một component khác.
 */

/* ── TONE ───────────────────────────────────────────────────────────────
   Vòng đời dữ liệu, tuyệt đối không dùng cho trạng thái điều khiển. */
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-[var(--ink-2)]',
  stop: 'text-[var(--stop)]',
  warn: 'text-[var(--warn)]',
  done: 'text-[var(--done)]',
}
const TONE_WASH: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-raised)] text-[var(--ink-2)]',
  stop: 'bg-[var(--stop-wash)] text-[var(--stop)]',
  warn: 'bg-[var(--warn-wash)] text-[var(--warn)]',
  done: 'bg-[var(--done-wash)] text-[var(--done)]',
}

/**
 * NHÃN — một từ về tình trạng của dòng.
 *
 * Không có tone 'primary': màu hành động không được dùng cho nhãn đọc, nếu
 * không thì cái bấm được và cái chỉ để đọc trông giống hệt nhau.
 */
export function Tag({
  tone = 'neutral',
  children,
}: {
  /**
   * Vòng đời của dòng: `stop` hỏng/quá hạn, `warn` đang chờ/sắp trễ, `done` xong,
   * `neutral` chưa có gì đáng nói. Không có tone màu hành động — nhãn chỉ để đọc.
   */
  tone?: Tone
  /** Một từ hoặc cụm ngắn nói tình trạng ("Quá hạn", "Chờ duyệt"). Chữ phải tự đủ nghĩa — màu chỉ là phần phụ. */
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[19px] items-center rounded-[var(--radius-sm)] px-2',
        'text-k-label font-semibold tracking-[.03em] whitespace-nowrap',
        TONE_WASH[tone],
      )}
    >
      {children}
    </span>
  )
}

/**
 * MÃ CHỨNG TỪ / MÃ VẬT TƯ — mono, màu hành động vì luôn bấm được.
 *
 * Khác `DocChip` của v3: bỏ khung viền. Đo trên bảng 68 dòng, mỗi dòng một
 * khung nhỏ làm bảng đọc thành lưới ô vuông; chữ mono + màu xanh đã đủ nói
 * "đây là mã, bấm được" mà không thêm nét.
 */
export function Code({
  children,
  as: As = 'span',
  ...rest
}: {
  /** Mã chứng từ hoặc mã vật tư, đúng như in trên giấy (`PO-2609-014`, `VT-00123`). */
  children: ReactNode
  /**
   * Thẻ gốc. `a` + `href` nội bộ (bắt đầu bằng `/`) đi bằng `next/link`; `button` cho
   * mã mở khay tại chỗ — mặc định `type="button"`, bấm trong `<form>` không nộp form.
   * Mọi prop khác (`href`, `onClick`, `aria-*`, cả `type`) chuyển thẳng xuống thẻ.
   */
  as?: 'span' | 'a' | 'button'
} & Record<string, unknown>) {
  const cls =
    'font-[family-name:var(--font-mono)] text-k-sm font-semibold text-[var(--act)] tabular-nums'
  /*
    `as="a"` + href nội bộ thì đi bằng `next/link`, không phải `<a>` trần: mã
    chứng từ là đường vào chứng từ dùng nhiều nhất trên màn danh sách, mà `<a>`
    trần là tải lại cả tài liệu — trắng màn và mất bộ lọc đang đặt. Giữ `<a>`
    cho href ngoài miền và cho chỗ gọi không truyền href.
  */
  if (As === 'a' && typeof rest.href === 'string' && rest.href.startsWith('/')) {
    const { href, ...r } = rest as { href: string } & Record<string, unknown>
    return (
      <Link href={href} className={cls} {...r}>
        {children}
      </Link>
    )
  }
  return (
    <As
      // Nút mặc định của HTML là `submit`: mã mở khay đặt trong một `<form>`
      // (form sửa đầu đơn) thì bấm mã là NỘP form. Đặt trước `rest` để chỗ gọi
      // vẫn đổi được nếu thật sự muốn.
      type={As === 'button' ? 'button' : undefined}
      className={cls}
      {...rest}
    >
      {children}
    </As>
  )
}

/**
 * SỐ — con số trong bảng.
 *
 * `strong` dành cho con số NGƯỜI DÙNG MANG ĐI LÀM VIỆC (còn phải đặt, thành
 * tiền). Trên một dòng có 6 con số, phải có đúng một số to hơn — không thì
 * mắt phải đọc cả 6 để tìm cái cần.
 *
 * BA TRẠNG THÁI RỖNG KHÁC NHAU, đừng gộp (lỗi phát hiện 08/09/2026 trên
 * trang trưng bày: dòng "đã đủ" hiện dấu — ở cột Cần mua, đọc ra thành
 * "thiếu dữ liệu" trong khi ý là "hết việc rồi"):
 *
 *   · `zero='dash'` (mặc định) — chưa có số. Dùng cho ô thật sự trống:
 *     chưa ai nhập giá, chưa có ngày.
 *   · `zero='zero'` — số 0 có nghĩa, hiện "0". Dùng khi 0 là một câu trả
 *     lời: tồn kho 0, đã về 0.
 *   · `zero='done'` — hết việc, hiện dấu ✓ mờ. Dùng cho cột "còn phải làm"
 *     khi đã xong.
 */
export function Num({
  value,
  strong = false,
  muted = false,
  zero = 'dash',
}: {
  /**
   * Số ĐÃ ĐỊNH DẠNG sẵn (`25.132.800`) — thành phần không tự định dạng. Chuỗi rỗng
   * = không có số, hiện theo `zero`. Muốn hiện "0" có nghĩa thì truyền '' + `zero='zero'`.
   */
  value: string
  /** Con số người dùng MANG ĐI LÀM VIỆC (còn phải đặt, thành tiền) — đậm, to hơn. Mỗi dòng đúng một số như vậy. */
  strong?: boolean
  /** Số phụ, chỉ để đối chiếu (đã về, số kỳ trước) — chữ nhạt hơn. */
  muted?: boolean
  /**
   * Cách hiện khi `value` rỗng: `dash` chưa có số (—), `zero` số 0 có nghĩa (0),
   * `done` hết việc (✓ xanh). Ba nghĩa khác nhau, đừng gộp. `dash`/`done` nói nghĩa
   * bằng `title` (rê chuột) VÀ chữ ẩn cho trình đọc ("Chưa có số", "Không còn phải làm").
   */
  zero?: 'dash' | 'zero' | 'done'
}) {
  if (!value) {
    /*
      Nghĩa của ô rỗng nói HAI lần: `title` cho người rê chuột, chữ `sr-only`
      cho trình đọc màn hình. `title` trên một `span` thường KHÔNG được đọc ra
      — trước B7½ người nghe chỉ nhận "gạch ngang" / "dấu tích" (có trình đọc
      im luôn), không phân biệt được "chưa có số" với "hết việc". Ký hiệu thì
      ẩn khỏi trình đọc để khỏi đọc đôi.
    */
    if (zero === 'done')
      return (
        <span className="text-[var(--done)]" title="Không còn phải làm">
          <span aria-hidden>✓</span>
          <span className="sr-only">Không còn phải làm</span>
        </span>
      )
    if (zero === 'zero') return <span className="num text-[var(--ink-3)]">0</span>
    return (
      <span className="text-[var(--ink-empty)]" title="Chưa có số">
        <span aria-hidden>—</span>
        <span className="sr-only">Chưa có số</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'num',
        strong
          ? 'text-k-body font-bold text-[var(--ink)]'
          : 'text-k-sm text-[var(--ink-2)]',
        muted && 'text-[var(--ink-3)]',
      )}
    >
      {value}
    </span>
  )
}

/**
 * THANH ĐỘ PHỦ — gộp 5 cột số thành một câu trả lời.
 *
 * Xem `coverage()` ở kit-core để biết vì sao. Chi tiết từng cột không mất,
 * nó nằm ở khay kiểm tra.
 */
export function CoverageBar({
  ratio,
  label,
}: {
  /**
   * Tỉ lệ đã phủ, 0–1 — lấy từ `coverage()` của kit (đã kẹp về 0–1). Từ 1 trở lên
   * thanh chuyển xanh "đủ". Thành phần không tự kẹp số âm.
   */
  ratio: number
  /** Chữ đứng cạnh thanh, thường là `coveragePct(ratio)`. Đây là phần DUY NHẤT trình đọc màn hình đọc được. */
  label: string
}) {
  const full = ratio >= 1
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="h-[5px] w-[52px] shrink-0 overflow-hidden rounded-[3px] bg-[var(--track)]">
        <i
          /*
            PHẦN ĐÃ LÀM DÙNG `--fill`, KHÔNG DÙNG `--act` (đổi 23/09/2026).

            Thanh này là DỮ LIỆU, không bấm được — mà từ 16/09 `--act` chỉ còn
            nghĩa "bấm được". Chi tiết ở token `--fill` trong tokens.css.
          */
          className={cn('block h-full', full ? 'bg-[var(--done)]' : 'bg-[var(--fill)]')}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="num text-k-label min-w-[30px] text-[var(--ink-2)]">{label}</span>
    </div>
  )
}

/*
  BIẾN THỂ NÚT — `cva` (B4, 24/09/2026). Trước đó là một chuỗi ba-ngôi lồng
  nhau trong thân hàm; thêm một trạng thái (khoá, đang chạy) là thêm một tầng
  lồng. Ở đây mỗi trục là một cột: NGHĨA của nút × có KHOÁ không.

  Khoá KHÔNG làm mờ bằng `opacity`: chữ mờ 45% trên nền trắng tụt còn ~2,2:1.
  WCAG 1.4.3 miễn tương phản cho điều khiển đang tắt, nhưng nút khoá theo quyền
  vẫn phải ĐỌC được — người dùng cần biết việc gì bị chặn mới hỏi đúng người.
  Cùng cách `Action` đã sửa ngày 16/09: nền xám đặc + chữ `--ink-3` (5,3:1), và
  KHÔNG giữ nền màu của nút chính — nền đặc là tín hiệu "bấm được", nút khoá
  không được phát tín hiệu đó.
*/
const btnVariants = cva(
  'text-k-sm inline-flex h-[var(--ctl-h)] items-center gap-2 rounded-[var(--radius)] border px-3 whitespace-nowrap',
  {
    variants: {
      tone: {
        thuong:
          'border-[var(--line)] bg-[var(--surface-card)] font-medium text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--surface)]',
        chinh:
          'border-[var(--act)] bg-[var(--act)] font-semibold text-[var(--act-ink)] hover:bg-[var(--act-hover)]',
        nguyHiem:
          'border-[var(--stop)] bg-[var(--surface-card)] font-medium text-[var(--stop)] hover:bg-[var(--stop-wash)]',
        chinhNguyHiem:
          'border-[var(--stop)] bg-[var(--stop)] font-semibold text-white hover:brightness-110',
      },
      locked: {
        true: 'cursor-not-allowed border-[var(--line-faint)] bg-[var(--surface-raised)] font-normal text-[var(--ink-3)] hover:border-[var(--line-faint)] hover:bg-[var(--surface-raised)] hover:brightness-100',
        false: '',
      },
    },
    defaultVariants: { tone: 'thuong', locked: false },
  },
)

/*
  Thuộc tính CHỈ nút mới hiểu — không được rơi xuống `<a>` khi `Btn` có
  `href`: `type="submit"` hay `disabled` trên thẻ `<a>` là HTML sai, còn
  `form*`/`name`/`value` là phần của việc nộp form mà liên kết không tham gia.
*/
const BUTTON_ONLY = new Set([
  'type',
  'disabled',
  'form',
  'formAction',
  'formEncType',
  'formMethod',
  'formNoValidate',
  'formTarget',
  'name',
  'value',
])

/**
 * NÚT — một biến thể chính, một phụ, một cho việc không lùi được.
 *
 * `blockedBy` là điểm khác v3 rõ nhất: quyền hạn phải THẤY ĐƯỢC. Nút bấm vào
 * mới báo "không có quyền" là thiết kế tệ — đúng ca `min_stock` ngày
 * 08/09/2026, người dùng thấy lỗi về một ô mà hộp thoại không hề có.
 *
 * Nút khoá theo quyền là KHOÁ MỀM (`aria-disabled`), không `disabled` thật: nút
 * `disabled` rơi khỏi thứ tự Tab, nên người dùng trình đọc màn hình không bao
 * giờ tới được nó để nghe lý do. Khoá mềm vẫn nhận tiêu điểm, đọc được "mờ" +
 * lý do (qua `aria-describedby`), và cú bấm bị nuốt. `disabled` thường (không
 * kèm lý do) vẫn là khoá cứng như cũ.
 *
 * `href` biến nút thành LIÊN KẾT THẬT, không phải button gọi router.push:
 * điều hướng phải mở được bằng chuột giữa / Ctrl+click và phải hiện URL ở
 * thanh trạng thái. Ở màn ERP, người dùng mở đơn ra tab mới suốt.
 */
export function Btn({
  children,
  primary = false,
  danger = false,
  blockedBy,
  busy = false,
  icon,
  href,
  target,
  rel,
  className,
  onClick,
  ...rest
}: {
  /** Nhãn nút — động từ + đối tượng ("Gửi duyệt", "Xoá dòng"). Nút chỉ có icon thì phải kèm `aria-label`. */
  children: ReactNode
  /**
   * Nút CHÍNH — nền đặc màu hành động, cho việc nên làm tiếp. Thanh hành động ERP
   * là một nút chính + các nút phụ (CLAUDE.md): nhiều nút đặc thì hết tín hiệu.
   */
  primary?: boolean
  /**
   * Icon ĐỨNG TRƯỚC CHỮ — khái niệm nghiệp vụ, không phải tên hình. Xem từ
   * vựng ở `kit/Icon.tsx`. Không có icon thì nút vẫn đúng: chữ mới là nội
   * dung, icon là mốc cho mắt quét một thanh 6-8 nút.
   */
  icon?: IcoName
  /**
   * Việc KHÔNG lùi lại được (xoá, huỷ đơn đã gửi). Đỏ chỉ dùng ở đây — dùng
   * cho cả việc thường thì hết là tín hiệu, đúng lỗi badge đỏ của v3.
   */
  danger?: boolean
  /** Tên bộ phận giữ quyền. Có giá trị = nút khoá mềm và NÓI ai giữ quyền. */
  blockedBy?: string
  /**
   * Việc đang chạy (đang lưu, đang gửi). Vòng quay thay icon, `aria-busy`, cú
   * bấm thứ hai bị nuốt — chặn gửi đôi mà KHÔNG đánh rơi tiêu điểm như
   * `disabled` (tiêu điểm rơi về `<body>` giữa lúc người dùng đang thao tác).
   */
  busy?: boolean
  /**
   * Có href = render thành liên kết. Bị khoá thì vẫn là nút, không điều hướng.
   * Mọi prop khác (`aria-*`, `id`, `onClick`, `target`, `rel`, `data-*`, `title`…)
   * chuyển xuống liên kết; riêng `type`, `disabled`, `form*`, `name`, `value` bị bỏ.
   */
  href?: string
  /** Chỉ có nghĩa khi có `href` — mở ở đâu (`_blank` = tab mới). Không bao giờ rơi xuống thẻ nút. */
  target?: React.AnchorHTMLAttributes<HTMLAnchorElement>['target']
  /** Chỉ có nghĩa khi có `href` — quan hệ liên kết (`noopener` khi mở tab mới ra ngoài miền). */
  rel?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const whyId = useId()
  // `aria-disabled` của chỗ gọi CŨNG là khoá mềm (B7½, 24/09/2026): trước đây
  // Btn tự đặt `aria-disabled` SAU prop của chỗ gọi nên giá trị đó bị đè mất,
  // và `PrimaryStep why` phải khoá cứng bằng `disabled` — rơi khỏi thứ tự Tab.
  const ariaOff = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true'
  const soft = !!blockedBy || busy || ariaOff
  const locked = soft || !!rest.disabled
  const cls = cn(
    btnVariants({
      tone: primary
        ? danger
          ? 'chinhNguyHiem'
          : 'chinh'
        : danger
          ? 'nguyHiem'
          : 'thuong',
      locked,
    }),
    className,
  )
  const lead = busy ? (
    <span
      aria-hidden
      // `motion-safe:` — người bật "giảm chuyển động" (WCAG 2.3.3) thấy vòng
      // đứng yên, hở một góc: vẫn đọc ra "đang chạy" mà không quay. Token thời
      // lượng của kit không phủ tới đây vì `animate-spin` mang thời lượng riêng.
      className="size-[14px] shrink-0 rounded-full border-[1.5px] border-current border-t-transparent motion-safe:animate-spin"
    />
  ) : (
    icon && <Ico name={icon} />
  )

  if (href && !locked) {
    /*
      `next/link` chứ không `<a>`: trong App Router thẻ `<a>` là tải lại cả
      tài liệu — trắng màn một nhịp, mất trạng thái vỏ, và `loading.tsx` không
      bao giờ được chạy. Link ngoài miền (http…) thì Link tự trả về điều hướng
      thường, nên không phải tách nhánh.

      Chuyển MỌI prop xuống liên kết trừ thứ chỉ nút mới có. Trước B7½ nhánh
      này chỉ chuyển `title`: `aria-label` của nút chỉ có icon, `onClick` (ghi
      vết, đóng khay), `target="_blank"`, `id`, `data-*` đều rơi mất — liên kết
      icon thành liên kết câm. Link gọi `onClick` trước rồi mới điều hướng, và
      bỏ điều hướng nếu `onClick` đã `preventDefault`.
    */
    const anchor = Object.fromEntries(
      Object.entries(rest).filter(([k]) => !BUTTON_ONLY.has(k)),
    ) as React.AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <Link
        href={href}
        {...anchor}
        target={target}
        rel={rel}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        className={cls}
      >
        {lead}
        {children}
      </Link>
    )
  }
  const why = blockedBy ? `Việc này do ${blockedBy} quản lý` : undefined
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled && !soft}
      aria-disabled={locked || undefined}
      aria-busy={busy || undefined}
      aria-describedby={why ? whyId : rest['aria-describedby']}
      title={why ?? rest.title}
      className={cls}
      onClick={(e) => {
        if (locked) return e.preventDefault()
        onClick?.(e)
      }}
    >
      {lead}
      {children}
      {why && (
        <span id={whyId} hidden>
          {why}
        </span>
      )}
    </button>
  )
}

/**
 * LỜI GIẢI THÍCH QUYỀN — đi kèm nút bị khoá.
 *
 * Tách khỏi `Btn` vì nó là câu nói với người dùng, không phải phần của nút:
 * một khối hành động có thể có 3 nút mà chỉ cần một dòng giải thích.
 */
export function PermHint({
  owner,
  children,
}: {
  /** Tên bộ phận giữ quyền ("Kế toán") — nên trùng chữ với `blockedBy` của nút đi kèm. */
  owner: string
  /** Câu giải thích riêng, thay câu mặc định "Việc này do … giữ. Nhờ bộ phận … làm giúp, hoặc xin quyền." */
  children?: ReactNode
}) {
  return (
    <p className="text-k-label text-center leading-relaxed text-[var(--ink-3)]">
      {children ?? (
        <>
          Việc này do <b className="text-[var(--ink-2)]">{owner}</b> giữ. Nhờ bộ phận{' '}
          {owner} làm giúp, hoặc xin quyền.
        </>
      )}
    </p>
  )
}

/**
 * DẢI NÓI VIỆC — thay cho "cảnh báo: có lỗi".
 *
 * Bắt buộc có `action`: một dải cảnh báo không chỉ được lối đi tiếp thì chỉ
 * làm người đọc lo mà không giúp họ xử lý. Công thức: hiện trạng → vì sao →
 * ai phải làm gì.
 */
export function NoticeBar({
  tone = 'warn',
  tag,
  children,
  action,
}: {
  /**
   * `stop` = nền đỏ nhạt (hỏng, chặn việc); mọi tone khác dùng NỀN VÀNG, chỉ đổi màu
   * chữ nhãn. Tức `done`/`neutral` vẫn ra dải vàng — dải này sinh ra cho tin phải để ý.
   * Tone cũng quyết cách thông báo: `stop` là `role="alert"` (chen ngang trình đọc),
   * mọi tone khác `role="status"` (lịch sự).
   */
  tone?: Tone
  /** Nhãn ngắn in hoa đầu dải ("Lưu ý", "Cắt đuôi", "Lệnh trống") — gọi tên loại tin trong một hai từ. */
  tag: string
  /** Hiện trạng + vì sao, MỘT câu. Việc phải làm đã nằm ở `action`, đừng nhắc lại trong câu. */
  children: ReactNode
  /**
   * Đường đi tiếp. KHÔNG CÓ = thanh chỉ để BIẾT.
   *
   * Trước 17/09/2026 prop này bắt buộc, nên mấy thanh thuần thông báo ("sổ
   * chạm trần", "chưa dựng") phải bịa ra một nhãn rồi để trống `onClick` —
   * ra một cái nút gạt người: trông bấm được, bấm thì không có gì xảy ra.
   */
  action?: { label: string; onClick?: () => void }
}) {
  return (
    <div
      /*
        Vùng thông báo: dải hay hiện ra SAU một thao tác (lọc xong thì "sổ chạm
        trần", bấm gửi thì "chặn gửi") — không có vai trò thì người không nhìn
        màn hình không bao giờ biết nó đã xuất hiện. `stop` là thứ đang CHẶN
        việc chính nên chen ngang (`alert`); mọi tone khác chờ trình đọc nói
        xong câu đang đọc (`status`, lịch sự).
      */
      role={tone === 'stop' ? 'alert' : 'status'}
      className={cn(
        'text-k-sm flex items-center gap-3 border-b px-[var(--gutter)] py-2',
        tone === 'stop'
          ? 'border-[var(--stop-line)] bg-[var(--stop-wash)]'
          : 'border-[var(--warn-line)] bg-[var(--warn-wash)]',
      )}
    >
      <span
        className={cn(
          'text-k-label shrink-0 font-bold tracking-[.06em] uppercase',
          TONE_TEXT[tone],
        )}
      >
        {tag}
      </span>
      <span className="text-[var(--ink-2)]">{children}</span>
      {action && (
        <button
          // Không có `type` thì là `submit`: dải nằm trong form sửa đơn thì bấm
          // "Xem hạn mức" là nộp form.
          type="button"
          onClick={action.onClick}
          className={cn(
            'text-k-sm ml-auto font-semibold whitespace-nowrap hover:underline',
            TONE_TEXT[tone],
          )}
        >
          {action.label}
          {/* Mũi tên là dấu cho mắt; để trong tên thì trình đọc đọc "mũi tên phải". */}
          <span aria-hidden> →</span>
        </button>
      )}
    </div>
  )
}

/**
 * Ô NHẬP SỐ trong lưới — gõ được số thập phân.
 *
 * BẪY đã dính hai lần ở v3 (commit 2c7e4e8, f6545e9): dùng `type="number"`
 * với `onChange` ép về Number thì người dùng gõ "1." là mất luôn dấu chấm,
 * không nhập nổi "1.5". Giữ CHUỖI trong lúc gõ, chỉ ép kiểu khi blur.
 *
 * `inputMode="decimal"` để điện thoại/máy tính bảng bật bàn phím số — quản
 * đốc xưởng dùng tablet.
 */
export function NumInput({
  value,
  onCommit,
  align = 'right',
  ...rest
}: {
  /** Giá trị đã chốt, dạng CHUỖI. Ô giữ bản nháp riêng trong lúc gõ; đổi từ ngoài chỉ hiện khi không có nháp. */
  value: string
  /**
   * Gọi khi rời ô, KHÔNG gọi mỗi lần gõ. Nhận chuỗi thô người dùng gõ — ô không tự
   * đổi "1.390" ra số; chỗ gọi tự hiểu và kiểm. `onBlur` / `onWheel` của chỗ gọi được
   * GHÉP (chạy sau việc chốt), `className` cộng vào kiểu của ô — không đè.
   */
  onCommit: (v: string) => void
  /**
   * Căn chữ. Số trong lưới căn phải cho thẳng hàng đơn vị; `left` cho ô số đứng riêng
   * trong form. `left` gắn `text-align` INLINE (B7½) — `.kit .num` ở tokens.css nằm
   * ngoài layer nên thắng mọi lớp tiện ích `text-left`. `style.textAlign` của chỗ gọi
   * vẫn thắng cả hai.
   */
  align?: 'right' | 'left'
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const { onBlur, onWheel, className, style, ...pass } = rest
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  return (
    <input
      inputMode="decimal"
      {...pass}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      /*
        GHÉP, không ĐÈ (B7½). Trước đó `...rest` rải CUỐI: chỗ gọi truyền
        `onBlur` là mất luôn việc chốt — `onCommit` không bao giờ được gọi, số
        gõ vào biến mất khi rời ô. Nay chốt trước rồi mới gọi `onBlur` của chỗ
        gọi. Không có cửa "preventDefault để bỏ chốt": blur không huỷ được, và
        ô số không chốt khi rời ô thì không còn là ô số của kit.
      */
      onBlur={(e) => {
        if (draft != null) onCommit(draft)
        setDraft(null)
        onBlur?.(e)
      }}
      // Lăn chuột trên ô số đang focus sẽ ĐỔI SỐ trong mọi trình duyệt. Nhả
      // focus rồi để trang cuộn như thường — không preventDefault, kẻo người
      // dùng tưởng trang treo.
      onWheel={(e) => {
        ;(e.target as HTMLInputElement).blur()
        onWheel?.(e)
      }}
      /*
        CĂN TRÁI PHẢI INLINE. `.kit .num` (tokens.css) nằm NGOÀI mọi @layer,
        còn `text-left` của Tailwind v4 nằm trong `@layer utilities` — luật
        ngoài layer luôn thắng luật trong layer, bất kể độ ưu tiên, nên lớp
        `text-left` chưa bao giờ có tác dụng trong vùng `.kit`. Khai báo inline
        đứng trên cả hai tầng đó. Không bỏ lớp `num` khi căn trái: nó còn mang
        chữ mono + `tabular-nums`, thứ ô số vẫn cần.
      */
      style={align === 'left' ? { textAlign: 'left', ...style } : style}
      className={cn(
        'num h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)]',
        'text-k-sm bg-[var(--surface-card)] px-2',
        'hover:border-[var(--ink-3)] focus:border-[var(--act)]',
        className,
      )}
    />
  )
}

/**
 * KHỐI ĐANG TẢI — giữ đúng chỗ của nội dung sắp hiện.
 *
 * `rows` bằng số dòng bảng thật sẽ có. Khung xương ít dòng hơn nội dung thì
 * trang nhảy giật khi dữ liệu về — người dùng đang định bấm sẽ bấm nhầm.
 *
 * Là `role="status"` với câu ẩn "Đang tải…"; khung xương `aria-hidden`, chỉ
 * nhấp nháy khi người dùng không bật giảm chuyển động.
 */
export function Loading({
  rows = 6,
}: {
  /** Số dòng khung xương — đặt bằng số dòng bảng thật sắp hiện (hoặc cỡ trang), để trang không nhảy khi dữ liệu về. */
  rows?: number
}) {
  /*
    TRUY CẬP (B7½). Trước đó khối không có chữ, không vai trò: người không nhìn
    màn hình không biết vùng này đang tải, chỉ gặp bảng khi nó đã về. Nay vỏ là
    `role="status"` mang một câu ẩn; khung xương là hình cho mắt nên
    `aria-hidden`. Lưu ý: vùng status XUẤT HIỆN cùng lúc với câu của nó thì
    không phải trình đọc nào cũng đọc (NVDA thường đọc, VoiceOver có khi không)
    — muốn chắc thì vùng chứa đặt thêm `aria-busy` trong lúc chờ.

    Nhấp nháy dưới `motion-safe:` — người bật "giảm chuyển động" (WCAG 2.3.3)
    thấy khung xương đứng yên. `animate-pulse` mang thời lượng riêng nên token
    `--dur-*` (về 0 khi giảm chuyển động) không phủ tới.
  */
  return (
    <div role="status">
      <span className="sr-only">Đang tải…</span>
      <div aria-hidden className="motion-safe:animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex h-[var(--row-h)] items-center gap-3 border-b border-[var(--hair)] px-[var(--pad-x)]"
          >
            <span className="h-2.5 w-[90px] rounded bg-[var(--surface-raised)]" />
            <span className="h-2.5 flex-1 rounded bg-[var(--surface-raised)]" />
            <span className="h-2.5 w-[60px] rounded bg-[var(--surface-raised)]" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   Ô NHẬP — mảng kit thiếu, lộ ra ngày 10/09/2026 khi dựng hộp thư việc.

   Kit ra đời cho màn ĐỌC một tờ chứng từ, nên nó chỉ có `NumInput`. Vừa cho
   người dùng LÀM VIỆC ngay trên màn danh sách là thiếu ngay ba thứ cơ bản:
   ô tick, ô ngày, ô chữ nhiều dòng. Cổng `hg/no-raw-control` chặn thẻ thô nên
   chỗ thiếu lộ ra lập tức — đúng việc mà cổng đó sinh ra để làm.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Ô TICK. Tên `Tick` chứ không `Check` — `Check` đã là type của MỘT DÒNG
 * trong bảng kiểm (Erp.tsx), hai thứ không liên quan gì nhau.
 *
 * `label` BẮT BUỘC và phải nói chọn CÁI GÌ, không phải "chọn": một cột toàn ô
 * tick không nhãn là cột câm với trình đọc màn hình, và người dùng ERP đi bằng
 * bàn phím rất nhiều.
 *
 * Tự chặn nổi bọt sự kiện: ô tick gần như luôn nằm trong một dòng bấm được, và
 * bấm vào ô tick mà dòng cũng mở theo là thao tác không ai muốn.
 *
 * Ô vẽ 13px nhưng VÙNG BẤM 25×25 (WCAG 2.5.8) — lớp đệm vô hình quanh ô, bố cục
 * không đổi. Xem chú thích trong thân hàm.
 */
export function Tick({
  checked,
  onChange,
  label,
  disabled,
}: {
  /** Đang tick hay không. Ô KIỂM SOÁT hoàn toàn: không đổi `checked` trong `onChange` thì ô không đổi. */
  checked: boolean
  /** Nhận giá trị MỚI sau cú bấm. Cú bấm không nổi bọt lên dòng chứa ô. */
  onChange: (next: boolean) => void
  /**
   * Tên ô cho trình đọc màn hình (`aria-label`) — BẮT BUỘC, và phải nói chọn CÁI GÌ
   * ("Chọn PO-2609-014"), không phải "chọn". Không hiện ra bằng chữ.
   */
  label: string
  /**
   * Khoá ô — mờ 45% và rơi khỏi thứ tự Tab (khoá cứng); bấm vào vùng đệm quanh ô
   * cũng không lật. Chưa có chỗ nói vì sao khoá.
   */
  disabled?: boolean
}) {
  /*
    VÙNG BẤM 25×25 QUANH Ô 13px (B7½, WCAG 2.5.8 đòi tối thiểu 24×24). Ô 13px
    trần khó bấm trên máy tính bảng ở xưởng. Bọc ô trong một lớp đệm `p-1.5`
    (13 + 2×6 = 25px) rồi trả lại đúng chỗ cũ bằng lề âm `-m-1.5`: hộp lề của
    lớp bọc vẫn 13×13, nên bố cục quanh ô KHÔNG đổi, chỉ vùng nhận chuột nở ra.

    Không dùng `<label>` làm lớp bọc: có chỗ gọi đã tự bọc Tick trong `<label>`
    (ApprovalCenterScreen) — label lồng label là HTML sai. Nên phần ĐỆM tự bắt
    cú bấm và lật ô; `preventDefault` để `<label>` bên ngoài (nếu có) không
    kích hoạt ô thêm lần nữa. Phần đệm chỉ là vùng chuột — bàn phím vẫn đi vào
    chính ô checkbox như cũ.
  */
  return (
    <span
      className={cn(
        '-m-1.5 inline-flex p-1.5',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={(e) => {
        e.stopPropagation()
        // Cú bấm trúng chính ô thì ô đã tự lật (qua onChange) — chỉ xử lý phần đệm.
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        if (!disabled) onChange(!checked)
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[13px] accent-[var(--act)] disabled:opacity-45"
      />
    </span>
  )
}

/*
  Phần cao KHÔNG phải chữ của TextArea: `py-1.5` (6px × 2) + viền 1px × 2.
  Tailwind v4 đặt `box-sizing: border-box`, nên sàn/trần chiều cao phải cộng
  phần này vào số dòng — không thì ô `maxRows={6}` chỉ chứa được ~5,5 dòng.
*/
const TEXTAREA_CHROME_PX = 14

/**
 * Ô CHỮ NHIỀU DÒNG.
 *
 * Có `maxRows` thì ô TỰ NỞ theo nội dung, từ `rows` tới `maxRows` dòng rồi mới
 * cuộn — ghi chú xử lý việc thường dài 1–3 dòng, để ô cố định 3 dòng thì lúc
 * nào cũng thừa hoặc thiếu. Làm bằng CSS `field-sizing: content` (B7½), không
 * đo chiều cao bằng JS. Không có `maxRows` thì như cũ: cao cố định `rows`.
 */
export function TextArea({
  value,
  onChange,
  rows = 3,
  maxRows,
  placeholder,
  disabled,
  className,
  style,
  ...rest
}: {
  /** Nội dung đang có. Ô kiểm soát: mỗi phím gọi `onChange`, khác `TextInput` chỉ chốt khi rời ô. */
  value: string
  /** Nhận chuỗi mới MỖI LẦN GÕ. Muốn lưu thì lưu khi người dùng bấm nút, đừng gọi API ở đây. */
  onChange: (v: string) => void
  /** Chiều cao ban đầu, tính bằng dòng chữ. Có `maxRows` thì đây là SÀN: ô không co thấp hơn số dòng này. */
  rows?: number
  /**
   * Trần tự nở, tính bằng dòng. Có giá trị = ô nở theo nội dung từ `rows` tới đây rồi mới
   * cuộn. Dựa vào CSS `field-sizing: content` — chắc ở Chrome/Edge 123+; trình duyệt chưa
   * hỗ trợ thì ô đứng yên ở `rows` dòng như khi không truyền.
   */
  maxRows?: number
  /** Gợi ý nội dung cần ghi ("Lý do trả lại…"). Không thay nhãn — ô vẫn cần `aria-label` hoặc `<label>`. */
  placeholder?: string
  /** Khoá ô — mờ 45%, rơi khỏi thứ tự Tab. */
  disabled?: boolean
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'rows'
>) {
  /*
    TỰ NỞ BẰNG CSS. `field-sizing: content` cho ô cao theo chữ — không cần
    `useLayoutEffect` đo `scrollHeight` mỗi phím (cách cũ: giật một nhịp, và
    đo sai khi ô đang ẩn trong khay đóng). Đổi lại: lúc viết chỉ CHẮC ở
    Chromium (Chrome/Edge 123+, 03/2024); Firefox
    và Safari chưa kiểm, coi như chưa có. Trình duyệt không hiểu thì bỏ qua
    thuộc tính: ô cao theo `rows` như
    trước, `min-height` ≈ đúng chiều cao đó, `max-height` không chạm — tức
    xuống cấp về đúng hành vi cũ, không vỡ.

    Sàn/trần tính bằng đơn vị `lh` (một dòng theo `line-height` thật của ô) —
    đổi cỡ chữ hay `leading-*` thì trần vẫn đúng số dòng. `field-sizing` bỏ
    qua `rows` khi tính cao, nên sàn phải khai bằng `min-height`.
  */
  const grow: React.CSSProperties | undefined = maxRows
    ? {
        fieldSizing: 'content',
        minHeight: `calc(${rows}lh + ${TEXTAREA_CHROME_PX}px)`,
        maxHeight: `calc(${Math.max(maxRows, rows)}lh + ${TEXTAREA_CHROME_PX}px)`,
      }
    : undefined
  return (
    <textarea
      {...rest}
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={grow || style ? { ...grow, ...style } : undefined}
      // `className` của chỗ gọi CỘNG vào kiểu của ô (B7½) — trước đó `...rest`
      // rải cuối nên truyền `className` là xoá sạch viền, nền, cỡ chữ.
      className={cn(
        'w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)]',
        'text-k-body bg-[var(--surface-card)] px-2 py-1.5 leading-relaxed',
        'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]',
        'disabled:opacity-45',
        className,
      )}
    />
  )
}

/**
 * Ô CHỌN — `<select>` thật, không portal.
 *
 * Thanh lọc ERP cần bốn năm ô chọn nằm cạnh nhau, đi bằng bàn phím, không nhảy
 * portal. `<select>` bản địa làm đúng cả ba mà không tốn một dòng JS; cái giá là
 * không tự vẽ được menu — chấp nhận, vì đây là ô lọc chứ không phải ô tìm.
 *
 * `label` BẮT BUỘC: ô chọn không nhãn nhìn bằng mắt đoán được, đi bằng bàn phím
 * thì không.
 */
export function Pick({
  value,
  onChange,
  options,
  label,
  disabled,
  width,
}: {
  /** `value` của lựa chọn đang chọn. Phải khớp một dòng trong `options`, không thì trình duyệt tự hiện dòng đầu. */
  value: string
  /** Nhận `value` của dòng vừa chọn. Ô kiểm soát: không cập nhật `value` thì ô nhảy về như cũ. */
  onChange: (v: string) => void
  /**
   * Các lựa chọn, theo thứ tự hiện. Danh sách NGẮN (dưới vài chục dòng) — dài hơn
   * thì dùng `Combobox`. Dòng `disabled` hiện nhưng không chọn được.
   */
  options: { value: string; label: string; disabled?: boolean }[]
  /** Tên ô (`aria-label`) — BẮT BUỘC: ô chọn không nhãn nhìn thì đoán được, đi bằng bàn phím thì không. */
  label: string
  /** Khoá ô — mờ 45%, rơi khỏi thứ tự Tab. */
  disabled?: boolean
  /** Bề ngang cố định, px. Bỏ trống = rộng theo lựa chọn dài nhất. */
  width?: number
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={width ? { width } : undefined}
      className={cn(
        'h-[var(--ctl-h)] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]',
        'text-k-sm px-2 pr-6 text-[var(--ink)]',
        'hover:border-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/**
 * Ô CHỮ MỘT DÒNG — cho ô đầu đơn ở chế độ sửa và ô lưới kiểu `text`.
 *
 * Cùng cỡ với `NumInput` để một hàng lưới có ô số lẫn ô chữ không nhấp nhô.
 * `onCommit` gọi khi rời ô hoặc Enter — cùng luật với ô số: gõ dở không ghi.
 */
export function TextInput({
  value,
  onCommit,
  placeholder,
  disabled,
  mono = false,
  label,
  ...rest
}: {
  /** Giá trị đã chốt. Ô giữ bản nháp riêng trong lúc gõ; đổi từ ngoài chỉ hiện khi không có nháp. */
  value: string
  /**
   * Gọi khi rời ô hoặc Enter, và CHỈ khi chữ đã khác `value`. Esc bỏ bản nháp, trả chữ cũ.
   * `onKeyDown` của chỗ gọi chạy TRƯỚC và được GHÉP (không đè Enter/Esc); chỗ gọi
   * `preventDefault` một phím thì ô nhường phím đó. `className` cộng vào kiểu của ô.
   */
  onCommit: (v: string) => void
  /** Gợi ý cách ghi ("VD: 1200x600x18"). Không thay nhãn. */
  placeholder?: string
  /** Khoá ô — mờ 45%, rơi khỏi thứ tự Tab. */
  disabled?: boolean
  /** Mã, quy cách, kích thước → mono cho thẳng cột. */
  mono?: boolean
  /**
   * Tên ô (`aria-label`). Không bắt buộc ở tầng kiểu vì ô có thể nằm trong `<label>`
   * hoặc `Field` — nhưng ô trong lưới không có nhãn bao ngoài thì PHẢI truyền.
   */
  label?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const { onKeyDown, className, ...pass } = rest
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  const commit = () => {
    if (draft != null && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return (
    <input
      type="text"
      {...pass}
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      // `aria-label` truyền thẳng vẫn dùng được khi không có `label` — trước B7½
      // nó đè `label` vì rải cuối, giữ đúng thứ tự ưu tiên đó.
      aria-label={pass['aria-label'] ?? label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      /*
        GHÉP, không ĐÈ (B7½). Trước đó `...rest` rải CUỐI: chỗ gọi truyền
        `onKeyDown` (lưới nhập liệu đi ô bằng phím) là mất luôn Enter-chốt và
        Esc-bỏ-nháp. Nay theo lối của Radix: chỗ gọi chạy TRƯỚC; nếu nó đã
        `preventDefault` phím đó thì ô NHƯỜNG — lưới nhận Enter để chuyển tiêu
        điểm sang ô kế (rời ô vẫn chốt qua onBlur, nên không mất chữ). Phím chỗ
        gọi không đụng tới thì ô xử lý như thường.
      */
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      className={cn(
        'h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)]',
        'text-k-sm bg-[var(--surface-card)] px-2',
        mono && 'text-k-sm font-[family-name:var(--font-mono)]',
        'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
        className,
      )}
    />
  )
}
