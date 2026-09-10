'use client'

import { useRef, useState, type ReactNode } from 'react'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
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
export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-[19px] items-center rounded-[var(--radius-sm)] px-[7px]',
        'text-[10.5px] font-semibold tracking-[.03em] whitespace-nowrap',
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
  children: ReactNode
  as?: 'span' | 'a' | 'button'
} & Record<string, unknown>) {
  return (
    <As
      className="font-[family-name:var(--font-mono)] text-[11.5px] font-semibold text-[var(--act)] tabular-nums"
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
  value: string
  strong?: boolean
  muted?: boolean
  zero?: 'dash' | 'zero' | 'done'
}) {
  if (!value) {
    if (zero === 'done')
      return (
        <span className="text-[var(--done)]" title="Không còn phải làm">
          ✓
        </span>
      )
    if (zero === 'zero') return <span className="num text-[var(--ink-3)]">0</span>
    return (
      <span className="text-[var(--ink-empty)]" title="Chưa có số">
        —
      </span>
    )
  }
  return (
    <span
      className={cn(
        'num',
        strong
          ? 'text-[var(--fs-num)] font-bold text-[var(--ink)]'
          : 'text-[var(--fs-num-sm)] text-[var(--ink-2)]',
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
export function CoverageBar({ ratio, label }: { ratio: number; label: string }) {
  const full = ratio >= 1
  return (
    <div className="flex items-center justify-end gap-[7px]">
      <span className="h-[5px] w-[52px] shrink-0 overflow-hidden rounded-[3px] bg-[var(--track)]">
        <i
          className={cn('block h-full', full ? 'bg-[var(--done)]' : 'bg-[var(--act)]')}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="num min-w-[30px] text-[var(--fs-micro)] text-[var(--ink-2)]">
        {label}
      </span>
    </div>
  )
}

/**
 * NÚT — một biến thể chính, một phụ. Không có 6 variant.
 *
 * `blockedBy` là điểm khác v3 rõ nhất: quyền hạn phải THẤY ĐƯỢC. Nút bấm vào
 * mới báo "không có quyền" là thiết kế tệ — đúng ca `min_stock` ngày
 * 08/09/2026, người dùng thấy lỗi về một ô mà hộp thoại không hề có.
 * Có `blockedBy` thì nút mờ đi và NÓI LUÔN ai giữ quyền đó.
 *
 * `href` biến nút thành LIÊN KẾT THẬT (thẻ <a>), không phải button gọi
 * router.push: điều hướng phải mở được bằng chuột giữa / Ctrl+click và phải
 * hiện URL ở thanh trạng thái. Ở màn ERP, người dùng mở đơn ra tab mới suốt.
 */
export function Btn({
  children,
  primary = false,
  danger = false,
  blockedBy,
  href,
  className,
  ...rest
}: {
  children: ReactNode
  primary?: boolean
  /**
   * Việc KHÔNG lùi lại được (xoá, huỷ đơn đã gửi). Đỏ chỉ dùng ở đây — dùng
   * cho cả việc thường thì hết là tín hiệu, đúng lỗi badge đỏ của v3.
   */
  danger?: boolean
  /** Tên bộ phận giữ quyền. Có giá trị = nút bị khoá và giải thích lý do. */
  blockedBy?: string
  /** Có href = render thành <a>. Bị khoá thì vẫn là <span>, không điều hướng. */
  href?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(
    'inline-flex h-[var(--ctl-h)] items-center gap-[7px] rounded-[var(--radius)]',
    'border px-3 text-[12.5px] whitespace-nowrap',
    primary && danger
      ? 'border-[var(--stop)] bg-[var(--stop)] font-semibold text-white hover:brightness-110'
      : primary
        ? 'border-[var(--act)] bg-[var(--act)] font-semibold text-[var(--act-ink)] hover:bg-[var(--act-hover)]'
        : danger
          ? 'border-[var(--stop)] bg-[var(--surface-card)] font-medium text-[var(--stop)] hover:bg-[var(--stop-wash)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] font-medium text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--surface)]',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[var(--line)]',
    className,
  )
  const locked = !!blockedBy || rest.disabled

  if (href && !locked) {
    return (
      <a href={href} className={cls} title={rest.title}>
        {children}
      </a>
    )
  }
  return (
    <button
      disabled={locked}
      title={blockedBy ? `Việc này do ${blockedBy} quản lý` : rest.title}
      className={cls}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * LỜI GIẢI THÍCH QUYỀN — đi kèm nút bị khoá.
 *
 * Tách khỏi `Btn` vì nó là câu nói với người dùng, không phải phần của nút:
 * một khối hành động có thể có 3 nút mà chỉ cần một dòng giải thích.
 */
export function PermHint({ owner, children }: { owner: string; children?: ReactNode }) {
  return (
    <p className="text-center text-[var(--fs-micro)] leading-relaxed text-[var(--ink-3)]">
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
  tone?: Tone
  tag: string
  children: ReactNode
  action: { label: string; onClick?: () => void }
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-[11px] border-b px-[var(--gutter)] py-[9px] text-[12.5px]',
        tone === 'stop'
          ? 'border-[var(--stop-line)] bg-[var(--stop-wash)]'
          : 'border-[var(--warn-line)] bg-[var(--warn-wash)]',
      )}
    >
      <span
        className={cn(
          'shrink-0 text-[10.5px] font-bold tracking-[.06em] uppercase',
          TONE_TEXT[tone],
        )}
      >
        {tag}
      </span>
      <span className="text-[var(--ink-2)]">{children}</span>
      <button
        onClick={action.onClick}
        className={cn('ml-auto text-[12px] font-semibold whitespace-nowrap hover:underline', TONE_TEXT[tone])}
      >
        {action.label} →
      </button>
    </div>
  )
}

/**
 * VẠCH VÒNG ĐỜI — chứng từ đang ở bậc nào.
 *
 * Khác `PoStatusStepper` của v3 ở hai chỗ:
 *  · KHÔNG vẽ tròn + đường nối (chiếm hai hàng chiều cao cho một thông tin
 *    một dòng). Ở đây là dải liền, đọc như thanh tiến độ;
 *  · bậc đã qua KHÔNG tô đậm bằng màu hành động — chỉ bậc HIỆN TẠI mới có
 *    màu. Tô hết bậc đã qua thì cả dải sáng rực và mắt không tìm ra đang ở
 *    đâu, đúng lỗi của v3 trên đơn 8 bậc.
 */
export function StageBar({
  stages,
  current,
}: {
  stages: string[]
  /** Chỉ số bậc hiện tại, 0-based. */
  current: number
}) {
  return (
    <div className="flex items-stretch gap-px overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)]">
      {stages.map((s, i) => {
        const past = i < current
        const now = i === current
        return (
          <span
            key={s}
            className={cn(
              'px-[9px] py-[3px] text-[11px] whitespace-nowrap',
              now
                ? 'bg-[var(--act)] font-semibold text-[var(--act-ink)]'
                : past
                  ? 'bg-[var(--surface-raised)] text-[var(--ink-2)]'
                  : 'bg-[var(--surface-card)] text-[var(--ink-3)]',
            )}
          >
            {past && <span className="mr-1 text-[var(--done)]">✓</span>}
            {s}
          </span>
        )
      })}
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
  value: string
  /** Gọi khi rời ô, KHÔNG gọi mỗi lần gõ. */
  onCommit: (v: string) => void
  align?: 'right' | 'left'
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  return (
    <input
      inputMode="decimal"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft != null) onCommit(draft)
        setDraft(null)
      }}
      // Lăn chuột trên ô số đang focus sẽ ĐỔI SỐ trong mọi trình duyệt. Nhả
      // focus rồi để trang cuộn như thường — không preventDefault, kẻo người
      // dùng tưởng trang treo.
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      className={cn(
        'num h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)]',
        'bg-[var(--surface-card)] px-2 text-[var(--fs-num-sm)]',
        'hover:border-[var(--ink-3)] focus:border-[var(--act)]',
        align === 'left' && 'text-left',
      )}
      {...rest}
    />
  )
}

/**
 * KHỐI ĐANG TẢI — giữ đúng chỗ của nội dung sắp hiện.
 *
 * `rows` bằng số dòng bảng thật sẽ có. Khung xương ít dòng hơn nội dung thì
 * trang nhảy giật khi dữ liệu về — người dùng đang định bấm sẽ bấm nhầm.
 */
export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
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
 * trong bảng kiểm (Erp.tsx), hai thứ không liên quan gì nhau. Tên  chứ không  —  đã là type của MỘT DÒNG
 * trong bảng kiểm (Erp.tsx), và hai thứ đó không liên quan gì nhau.
 *
 * `label` BẮT BUỘC và phải nói chọn CÁI GÌ, không phải "chọn": một cột toàn ô
 * tick không nhãn là cột câm với trình đọc màn hình, và người dùng ERP đi bằng
 * bàn phím rất nhiều.
 *
 * Tự chặn nổi bọt sự kiện: ô tick gần như luôn nằm trong một dòng bấm được, và
 * bấm vào ô tick mà dòng cũng mở theo là thao tác không ai muốn.
 */
export function Tick({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.checked)}
      className="size-[13px] accent-[var(--act)] disabled:opacity-45"
    />
  )
}

/**
 * Ô CHỮ NHIỀU DÒNG.
 *
 * Tự nở theo nội dung tới `maxRows` rồi mới cuộn: ghi chú xử lý việc thường
 * dài 1–3 dòng, để ô cố định 3 dòng thì lúc nào cũng thừa hoặc thiếu.
 */
export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  disabled?: boolean
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'rows'
>) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full resize-y rounded-[var(--radius-sm)] border border-[var(--line)]',
        'bg-[var(--surface-card)] px-2 py-1.5 text-[var(--fs-body)] leading-relaxed',
        'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]',
        'disabled:opacity-45',
      )}
      {...rest}
    />
  )
}

/**
 * Ô NGÀY KIỂU VIỆT NAM.
 *
 * `<input type="date">` vẽ chữ theo NGÔN NGỮ TRÌNH DUYỆT chứ không theo app:
 * máy cài Chrome tiếng Anh (đa số máy ở xưởng) hiện `mm/dd/yyyy`, trong khi
 * mọi chứng từ giấy đọc `dd/mm/yyyy` — `03/08` với `08/03` là hai ngày khác
 * nhau mà không nhìn ra ô đang nói kiểu nào.
 *
 * DÙNG LẠI `@/lib/date-vn`, không chép logic: bản `components/erp/DateField`
 * của theme v3 cũng gọi đúng ba hàm này. Hai bản khác nhau ở LỚP VỎ, giống
 * nhau ở cách hiểu ngày — sửa luật ngày là sửa một chỗ.
 */
export function DateInput({
  value,
  onChange,
  disabled,
  label,
}: {
  /** ISO `yyyy-mm-dd`, hoặc '' khi để trống. */
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  label?: string
}) {
  const [text, setText] = useState(() => isoToVn(value))
  const picker = useRef<HTMLInputElement>(null)

  // Giá trị đổi từ bên ngoài thì vẽ lại chữ — nhưng đừng giẫm lên tay người
  // đang gõ. Chỉnh state ngay trong lượt render, không `useEffect`.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (vnToIso(text) !== (value || null)) setText(isoToVn(value))
  }

  return (
    <span className="relative block">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="dd/mm/yyyy"
        aria-label={label}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const next = maskVnDate(e.target.value)
          setText(next)
          const iso = vnToIso(next)
          if (iso) onChange(iso)
          else if (next === '') onChange('')
        }}
        onBlur={() => {
          // Gõ dở hoặc ngày không có thật thì trả ô về giá trị đang giữ, không
          // để người dùng tưởng đã nhập được.
          const iso = vnToIso(text)
          setText(text.trim() === '' ? '' : isoToVn(iso ?? value))
        }}
        className={cn(
          'num h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)]',
          'bg-[var(--surface-card)] px-2 pr-8 text-left text-[var(--fs-num-sm)]',
          'hover:border-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Mở lịch"
        onClick={() => {
          const el = picker.current
          if (!el) return
          try {
            el.showPicker()
          } catch {
            el.focus() // trình duyệt cũ: ít nhất cũng nhảy vào ô lịch
          }
        }}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-45"
      >
        ▦
      </button>
      {/* Ô lịch thật: trong suốt, nằm dưới nút. KHÔNG dùng `display:none` vì
          `showPicker()` từ chối phần tử không được vẽ. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setText(isoToVn(e.target.value))
        }}
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 opacity-0"
      />
    </span>
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
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
  label: string
  disabled?: boolean
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
        'px-2 pr-6 text-[var(--fs-sm)] text-[var(--ink)]',
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
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  disabled?: boolean
  /** Mã, quy cách, kích thước → mono cho thẳng cột. */
  mono?: boolean
  label?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  const commit = () => {
    if (draft != null && draft !== value) onCommit(draft)
    setDraft(null)
  }
  return (
    <input
      type="text"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      className={cn(
        'h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)]',
        'bg-[var(--surface-card)] px-2 text-[var(--fs-sm)]',
        mono && 'font-[family-name:var(--font-mono)] text-[var(--fs-num-sm)]',
        'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
      )}
      {...rest}
    />
  )
}

/**
 * Ô TRA CỨU — gõ để tìm ở server, chọn một dòng.
 *
 * Đây là ô người soạn đơn gõ nhiều nhất (mã vật tư), nên:
 *  · con trỏ Ở LẠI ô sau khi chọn — thêm dòng thứ hai không phải bấm chuột;
 *  · Enter chọn dòng đang sáng, mũi tên lên xuống đổi dòng, Escape đóng;
 *  · tìm sau 180ms ngừng gõ, KHÔNG tìm mỗi phím — danh mục 13k dòng.
 *
 * Không portal: danh sách nằm ngay dưới ô, trong cùng cây DOM, nên token và
 * cuộn của bảng cha vẫn đúng.
 */
export function Lookup<T>({
  search,
  onPick,
  render,
  keyOf,
  placeholder = 'Gõ mã hoặc tên…',
  label,
  width,
  disabled,
}: {
  search: (q: string) => Promise<T[]>
  onPick: (item: T) => void
  render: (item: T) => ReactNode
  keyOf: (item: T) => string
  placeholder?: string
  label: string
  width?: number
  disabled?: boolean
}) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const run = (text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (!text.trim()) {
      setItems([])
      setOpen(false)
      return
    }
    timer.current = setTimeout(async () => {
      const my = ++seq.current
      setBusy(true)
      try {
        const r = await search(text.trim())
        // Kết quả về muộn của từ khoá cũ thì bỏ — không để danh sách nhảy ngược.
        if (my === seq.current) {
          setItems(r)
          setIdx(0)
          setOpen(true)
        }
      } finally {
        if (my === seq.current) setBusy(false)
      }
    }, 180)
  }

  const pick = (it: T) => {
    onPick(it)
    setQ('')
    setItems([])
    setOpen(false)
  }

  return (
    <div className="relative" style={width ? { width } : undefined}>
      <input
        type="text"
        value={q}
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value)
          run(e.target.value)
        }}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIdx((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (items[idx]) pick(items[idx])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={cn(
          'h-[var(--ctl-h)] w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-[10px] text-[var(--fs-sm)]',
          'placeholder:text-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
        )}
      />
      {busy && (
        <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-[var(--ink-3)]">…</span>
      )}
      {open && (
        <div
          role="listbox"
          className="absolute top-[calc(100%+3px)] left-0 z-[var(--z-float)] max-h-[280px] w-full min-w-[320px] overflow-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[0_8px_24px_rgba(17,24,38,.14)]"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-[var(--fs-sm)] text-[var(--ink-3)]">Không thấy mã nào khớp.</div>
          ) : (
            items.map((it, i) => (
              <button
                key={keyOf(it)}
                type="button"
                role="option"
                aria-selected={i === idx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it)}
                onMouseEnter={() => setIdx(i)}
                className={cn(
                  'block w-full px-3 py-[5px] text-left text-[var(--fs-sm)]',
                  i === idx ? 'bg-[var(--act-wash)] text-[var(--act-text)]' : 'text-[var(--ink)]',
                )}
              >
                {render(it)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
