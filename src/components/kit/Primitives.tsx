'use client'

import { useState, type ReactNode } from 'react'
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
 */
export function Btn({
  children,
  primary = false,
  blockedBy,
  className,
  ...rest
}: {
  children: ReactNode
  primary?: boolean
  /** Tên bộ phận giữ quyền. Có giá trị = nút bị khoá và giải thích lý do. */
  blockedBy?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={!!blockedBy || rest.disabled}
      title={blockedBy ? `Trường này do ${blockedBy} quản lý` : rest.title}
      className={cn(
        'inline-flex h-[var(--ctl-h)] items-center gap-[7px] rounded-[var(--radius)]',
        'border px-3 text-[12.5px] whitespace-nowrap',
        primary
          ? 'border-[var(--act)] bg-[var(--act)] font-semibold text-[var(--act-ink)] hover:bg-[var(--act-hover)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] font-medium text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--surface)]',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[var(--line)]',
        className,
      )}
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
