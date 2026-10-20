'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT — BÀY SỐ (B6, 24/09/2026)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bốn mảnh nhỏ cho màn Thống kê — docs/thong-ke-thiet-ke-tu-excel.md §8. Trước
 * B6 kit KHÔNG có thành phần nào vẽ dữ liệu, nên mọi màn muốn bày như file
 * Excel đều phải chế CSS tại chỗ. Vẽ bằng HTML/SVG nội tuyến, không thêm thư
 * viện biểu đồ: bốn mảnh này nhỏ, và thư viện biểu đồ mang theo bảng màu
 * riêng — đúng thứ kit phải giữ (xem `--viz-*` ở tokens.css).
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * Phần trăm TIẾN ĐỘ — làm tròn XUỐNG khi chưa đủ. 99,6% mà in "100%" là nói
 * xong trong khi còn thiếu; người đọc sẽ không đi tìm cái thiếu nữa.
 */
export function pctTienDo(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%'
  if (ratio >= 1) return '100%'
  return `${Math.min(99, Math.floor(ratio * 100))}%`
}

/* ── DualPct ─────────────────────────────────────────────────────────── */

/**
 * HAI MẪU SỐ CẠNH NHAU — `98% mảnh · 62% bộ`.
 *
 * Hai câu hỏi khác nhau, cả hai đều đúng: "xưởng có làm việc không" (đếm từng
 * cái) và "giao được bao nhiêu bộ" (bộ đủ mọi chi tiết). Bày một số một mình
 * là nói dối một nửa — đúng lỗi L3: ghi 150 cái chân xong màn vẫn báo "0%".
 * `null` = không áp dụng (không có mẫu số), khác với 0.
 */
export function DualPct({
  pieces,
  sets,
  stack = false,
}: {
  /** Theo MẢNH: tổng đã làm ÷ tổng cần, 0..1. */
  pieces: number | null
  /** Theo BỘ: số bộ đủ ÷ số bộ đặt, 0..1. */
  sets: number | null
  /** Xếp hai dòng — cho ô hẹp của bảng chéo. */
  stack?: boolean
}) {
  const one = (v: number | null, don: string, strong?: boolean) => (
    <span className="whitespace-nowrap">
      <span
        className={cn(
          'num',
          strong && 'font-semibold text-[var(--ink)]',
          strong && v != null && v >= 1 && 'text-[var(--done)]',
        )}
      >
        {v == null ? (
          /*
            Gạch dài trần bị nhiều trình đọc BỎ QUA — người nghe chỉ còn "bộ",
            tưởng là thiếu chữ. Ẩn gạch, đọc bằng lời (B7½, 24/09/2026).
          */
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">chưa có số</span>
          </>
        ) : (
          pctTienDo(v)
        )}
      </span>{' '}
      <span className="text-[var(--ink-3)]">{don}</span>
    </span>
  )
  return (
    <span
      className={cn('text-k-sm inline-flex', stack ? 'flex-col items-end leading-tight' : 'items-baseline gap-1')} // prettier-ignore
      title={GIAI_NGHIA}
    >
      {one(pieces, 'mảnh')}
      {!stack && <span className="text-[var(--ink-3)]">·</span>}
      {one(sets, 'bộ', true)}
      {/*
        `title` chỉ tới được bằng chuột, trên một thẻ không nhận focus — người
        dùng bàn phím và trình đọc màn hình không bao giờ nghe câu giải nghĩa.
        Chép nó thành chữ ẩn, nói bằng lời thay cho dấu chia.
      */}
      <span className="sr-only">. {GIAI_NGHIA_DOC}</span>
    </span>
  )
}

const GIAI_NGHIA =
  'Mảnh: tổng số cái đã làm ÷ tổng số cái cần, mọi chi tiết. Bộ: số bộ đã đủ MỌI chi tiết ÷ số bộ đặt.'
const GIAI_NGHIA_DOC =
  'Mảnh: tổng số cái đã làm trên tổng số cái cần, mọi chi tiết. Bộ: số bộ đã đủ mọi chi tiết trên số bộ đặt.'

/* ── DeltaNum ────────────────────────────────────────────────────────── */

/**
 * SỐ LỆCH theo quy ước của file Excel xưởng đang dùng:
 *
 *   thiếu → `(300)` trong ngoặc, `--stop`
 *   dư    → `+120`, `--warn` — DƯ CŨNG LÀ VẤN ĐỀ: phôi thừa là tiền chết
 *   bằng  → `—`, mờ
 *   không có số (null, NaN) → `?`, mờ — KHÔNG BAO GIỜ trông hay đọc như "đủ"
 *
 * Trình đọc màn hình đọc chữ ("thiếu 300"), không đọc dấu ngoặc: `(300)` đọc
 * lên chỉ còn "300", mất đúng cái nghĩa quan trọng nhất.
 */
export function DeltaNum({
  value,
  unit,
}: {
  /**
   * Số lệch = thực − cần. Âm là THIẾU `(300)`, dương là DƯ `+120`, 0 là đủ `—`.
   * `null` (hoặc NaN, ±∞ do phép tính trên dữ liệu thiếu) là CHƯA CÓ SỐ: `?` mờ,
   * trình đọc nghe "chưa có số" — khác hẳn "đủ".
   */
  value: number | null
  /**
   * Đơn vị ("bộ", "cái") — CHỈ vào câu cho trình đọc màn hình ("thiếu 300 bộ").
   * Mắt không thấy đơn vị: tiêu đề cột đã nói, lặp ở mọi ô là nhiễu.
   */
  unit?: string
}) {
  const u = unit ? ` ${unit}` : ''
  /*
    CHƯA CÓ SỐ ≠ ĐỦ (B7½, 24/09/2026). Bản cũ viết `if (!value)` — NaN (phép
    tính trên dữ liệu thiếu) cũng lọt nhánh đó, nên ô thiếu dữ liệu hiện "—" và
    trình đọc nghe "đủ": một lời hứa sai đúng kiểu nguyên tắc 3 của sổ cấm.
  */
  if (value == null || !Number.isFinite(value))
    return (
      <span className="num text-[var(--ink-3)]">
        <span aria-hidden>?</span>
        <span className="sr-only">chưa có số</span>
      </span>
    )
  if (value === 0)
    return (
      <span className="num text-[var(--ink-3)]">
        <span aria-hidden>—</span>
        <span className="sr-only">đủ</span>
      </span>
    )
  const thieu = value < 0
  const n = fmt(Math.abs(value))
  return (
    <span
      className={cn(
        'num font-semibold',
        thieu ? 'text-[var(--stop)]' : 'text-[var(--warn)]',
      )}
    >
      <span aria-hidden>{thieu ? `(${n})` : `+${n}`}</span>
      <span className="sr-only">
        {thieu ? 'thiếu' : 'dư'} {n}
        {u}
      </span>
    </span>
  )
}

/* ── DayStrip ────────────────────────────────────────────────────────── */

export type DayPoint = {
  /** ISO yyyy-mm-dd */
  date: string
  value: number
  /** Chữ phụ trong ô rê chuột — thường là số phiếu. */
  note?: string
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * DẢI N NGÀY — mỗi ngày một cột cao theo số, cột HÔM NAY có viền.
 *
 * Thay cho 100 cột ngày của sheet `CD_*`: nhìn ngang một dòng là thấy nhịp —
 * tổ làm liền 4 ngày rồi nghỉ 6 ngày. CHỈ ĐỌC: ma trận sửa trực tiếp chính là
 * thứ làm file Excel mất vết; sửa số ngày cũ đi qua đường "sửa lại, có lý do".
 *
 * Theo hướng dẫn dataviz: MỘT chuỗi nên một màu (`--viz-1`), không chú giải;
 * cột mảnh, khe 2px, đầu cột bo; ngày 0 vẫn có một vạch mốc để thấy "có ngày
 * đó, không làm" khác "không có dữ liệu". Rê chuột / mũi tên ra `18/09: 120 ·
 * PBS-0042`; mọi số cũng nằm trong bảng ẩn cho trình đọc màn hình (tooltip chỉ
 * làm giàu, không phải đường duy nhất để đọc số).
 *
 * `max` — thang CHUNG khi nhiều dải xếp chồng trong một bảng. Mỗi dải tự thang
 * thì cột cao nhất dòng nào cũng chạm đỉnh, và dòng 5 cái trông bằng dòng 500.
 */
export function DayStrip({
  days,
  today,
  label,
  max,
  onPick,
  width = 112,
  height = 24,
}: {
  /**
   * Các ngày theo thứ tự thời gian, MỖI NGÀY MỘT PHẦN TỬ kể cả ngày 0 — ngày
   * vắng khỏi mảng thì dải co lại, không còn thấy "có ngày đó, không làm".
   */
  days: DayPoint[]
  /** Ngày hôm nay (ISO yyyy-mm-dd) — cột đó có viền, và câu tóm tắt đọc thêm "hôm nay …". */
  today?: string
  /** Tên dải cho trình đọc màn hình — "Chân trước · 14 ngày". */
  label: string
  /**
   * Đỉnh thang CHUNG khi nhiều dải xếp chồng trong một bảng. Mỗi dải tự thang
   * thì dòng 5 cái trông cao bằng dòng 500. Bỏ trống = đỉnh là ngày cao nhất của dải.
   */
  max?: number
  /** Bấm cột (chuột) hoặc Enter trên ngày đang soi (phím) → mở ngày đó. Không có thì dải chỉ để đọc. */
  onPick?: (d: DayPoint) => void
  /** Bề rộng dải, px — chia đều cho số ngày; cột rộng 2–24px. */
  width?: number
  /** Chiều cao dải, px. */
  height?: number
}) {
  const [hi, setHi] = useState<number | null>(null)
  const tipId = useId()
  const n = Math.max(days.length, 1)
  const top = Math.max(max ?? 0, ...days.map((d) => d.value), 1)
  const slot = width / n
  const bw = Math.max(2, Math.min(24, slot - 2))
  const tong = days.reduce((a, d) => a + d.value, 0)
  const cao = days.reduce<DayPoint | null>(
    (a, d) => (!a || d.value > a.value ? d : a),
    null,
  )
  const homNay = days.find((d) => d.date === today)
  const tomTat =
    `${label}: tổng ${fmt(tong)} trong ${days.length} ngày` +
    (cao && cao.value > 0 ? `, cao nhất ${dm(cao.date)} ${fmt(cao.value)}` : '') +
    (homNay ? `, hôm nay ${fmt(homNay.value)}` : '')
  const d = hi != null ? days[hi] : null

  return (
    <span
      role="group"
      aria-label={tomTat}
      aria-describedby={d ? tipId : undefined}
      tabIndex={0}
      className="relative inline-block align-middle outline-offset-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          setHi((h) => {
            const cur = h ?? (e.key === 'ArrowLeft' ? n : -1)
            return Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1)))
          })
        } else if (e.key === 'Enter' && d && onPick) {
          onPick(d)
        } else if (e.key === 'Escape') {
          setHi(null)
        }
      }}
      onBlur={() => setHi(null)}
    >
      <svg
        width={width}
        height={height}
        aria-hidden
        className={cn('block', onPick && 'cursor-pointer')}
        onPointerMove={(e) => {
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left
          setHi(Math.max(0, Math.min(n - 1, Math.floor(x / slot))))
        }}
        onPointerLeave={() => setHi(null)}
        onClick={() => d && onPick?.(d)}
      >
        {days.map((p, i) => {
          const x = i * slot + (slot - bw) / 2
          const h = p.value > 0 ? Math.max(2, (p.value / top) * (height - 3)) : 0
          const la = p.date === today
          return (
            <g key={p.date}>
              {la && (
                // Viền cột hôm nay — người ghi biết mình đang ở đâu trong nhịp.
                <rect
                  x={i * slot + 0.5}
                  y={0.5}
                  width={slot - 1}
                  height={height - 1}
                  rx={2}
                  fill="none"
                  stroke="var(--ink-2)"
                  strokeWidth={1}
                />
              )}
              {h > 0 ? (
                <path
                  // Đầu cột bo 2px, chân cột VUÔNG trên đường gốc.
                  d={`M${x},${height - 1} v${-(h - 2)} q0,-2 2,-2 h${bw - 4} q2,0 2,2 v${h - 2} z`}
                  fill="var(--viz-1)"
                  opacity={hi == null || hi === i ? 1 : 0.55}
                />
              ) : (
                <rect x={x} y={height - 2} width={bw} height={1} fill="var(--line)" />
              )}
            </g>
          )
        })}
        <line
          x1={0}
          x2={width}
          y1={height - 0.5}
          y2={height - 0.5}
          stroke="var(--hair)"
        />
      </svg>
      {d && (
        <span
          id={tipId}
          role="tooltip"
          className="text-k-label pointer-events-none absolute bottom-full z-[var(--z-pop)] mb-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-0.5 whitespace-nowrap text-[var(--ink-2)] shadow-[var(--shadow-float)]"
          style={{ left: Math.min(Math.max(0, (hi ?? 0) * slot - 30), width - 60) }}
        >
          {/* Số đi trước, chữ theo sau — người đang rê chuột đã biết ngày, cần số. */}
          <b className="num text-[var(--ink)]">{fmt(d.value)}</b> · {dm(d.date)}
          {d.date === today && ' (hôm nay)'}
          {d.note && ` · ${d.note}`}
        </span>
      )}
      {/* Bảng ẩn — đường đọc số không cần rê chuột. */}
      <span className="sr-only">
        {days.map((p) => `${dm(p.date)}: ${fmt(p.value)}`).join('; ')}
      </span>
    </span>
  )
}

/* ── MiniBars ────────────────────────────────────────────────────────── */

export type MiniBar = {
  id: string
  label: ReactNode
  /** Chuỗi chính — cùng đơn vị với `max`. */
  value: number
  /** Chuỗi phụ, chồng tiếp sau chuỗi chính (vd: gia công ngoài). */
  value2?: number
  /** Chữ ở đầu thanh. Bỏ trống = phần trăm của `value + value2` trên `max`. */
  text?: string
  onClick?: () => void
}

/**
 * THANH NGANG SO SÁNH — % theo công đoạn, % theo sản phẩm.
 *
 * Một chuỗi: một màu, không chú giải (tên khối đã nói nó là gì). Hai chuỗi
 * (nội bộ + gia công ngoài): chồng tiếp, KHE 2px giữa hai đoạn, CHÚ GIẢI luôn
 * hiện, và số ở đầu thanh — `--viz-2` chỉ qua ngưỡng mù màu khi có đủ mã phụ
 * (xem tokens.css). Thanh ≤ 10px, đầu bo, gốc vuông; chữ số dùng mực chữ,
 * không bao giờ mang màu của thanh.
 */
/*
  HAI CHUỖI THÌ `series` BẮT BUỘC — ở TẦNG KIỂU (B7½, 24/09/2026). Trước đây
  chỉ là lời dặn trong chú thích: truyền `value2` mà quên `series` thì thanh vẫn
  chồng hai màu nhưng KHÔNG có chú giải — người nhìn không biết màu nào là gì,
  và `--viz-2` chỉ qua ngưỡng mù màu khi có mã phụ đi kèm (tokens.css).
*/
type MiniBarsProps = {
  /**
   * Giá trị ứng với thanh đầy. Mặc định 1 — tức `value` là tỉ lệ 0..1. Bày số
   * đếm thì đặt `max` là mẫu số chung; vượt `max` thì thanh kẹp ở 100%.
   */
  max?: number
  /** Tên khối cho trình đọc màn hình. */
  label: string
} & (
  | {
      /** Mỗi thanh một dòng: nhãn, giá trị, giá trị phụ, chữ đầu thanh. Có `onClick` thì cả dòng là nút. */
      rows: (Omit<MiniBar, 'value2'> & { value2?: undefined })[]
      /** Tên hai chuỗi — BẮT BUỘC khi có dòng mang `value2` (thành chú giải + chữ ẩn cho trình đọc). */
      series?: [string, string]
    }
  | {
      /** Mỗi thanh một dòng: nhãn, giá trị, giá trị phụ, chữ đầu thanh. Có `onClick` thì cả dòng là nút. */
      rows: MiniBar[]
      /** Tên hai chuỗi — BẮT BUỘC khi có dòng mang `value2` (thành chú giải + chữ ẩn cho trình đọc). */
      series: [string, string]
    }
)

export function MiniBars({ rows, max = 1, series, label }: MiniBarsProps) {
  const coHai = rows.some((r) => (r.value2 ?? 0) > 0)
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`
  // Chữ cho trình đọc: `max` = 1 nghĩa là giá trị là TỈ LỆ → đọc "55%", không
  // đọc số thô "0,55"; còn lại là số đếm cùng mẫu số → đọc nguyên số.
  const noi = (v: number) => (max === 1 ? pctTienDo(v) : fmt(v))
  return (
    <div className="grid gap-1.5" role="group" aria-label={label}>
      {coHai && series && (
        <div className="text-k-label flex items-center gap-3 text-[var(--ink-2)]">
          {series.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-[2px]"
                style={{ background: i === 0 ? 'var(--viz-1)' : 'var(--viz-2)' }}
              />
              {s}
            </span>
          ))}
        </div>
      )}
      <ul className="grid gap-1">
        {rows.map((r) => {
          const v2 = r.value2 ?? 0
          const text = r.text ?? pctTienDo((r.value + v2) / (max || 1))
          const Hang = r.onClick ? 'button' : 'div'
          return (
            <li key={r.id}>
              <Hang
                {...(r.onClick ? { type: 'button' as const, onClick: r.onClick } : {})}
                className={cn(
                  'text-k-sm grid w-full grid-cols-[minmax(80px,140px)_1fr_48px] items-center gap-2 text-left',
                  r.onClick &&
                    'rounded-[var(--radius-sm)] hover:bg-[var(--surface-hover)]',
                )}
                title={
                  coHai && series
                    ? `${series[0]} ${fmt(r.value)} · ${series[1]} ${fmt(v2)}`
                    : undefined
                }
              >
                <span className="truncate text-[var(--ink-2)]">{r.label}</span>
                <span className="relative flex h-2.5 items-center" aria-hidden>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-[var(--hair)]" />
                  <span
                    className="relative h-full rounded-r-[3px]"
                    style={{ width: w(r.value), background: 'var(--viz-1)' }}
                  />
                  {v2 > 0 && (
                    <span
                      // Khe 2px bằng màu nền giữa hai đoạn — không vẽ viền.
                      className="relative ml-0.5 h-full rounded-r-[3px]"
                      style={{ width: w(v2), background: 'var(--viz-2)' }}
                    />
                  )}
                </span>
                <span className="num text-right text-[var(--ink)]">{text}</span>
                {/* Hai chuỗi: phần chia giữa hai đoạn trước đây chỉ nằm trong
                    thanh ẩn + `title` — người nghe chỉ nghe TỔNG. Nói đủ tên +
                    số từng chuỗi, kể cả chuỗi phụ bằng 0 (B7½, 24/09/2026). */}
                {coHai && series && (
                  <span className="sr-only">
                    {`${series[0]} ${noi(r.value)}, ${series[1]} ${noi(v2)}`}
                  </span>
                )}
              </Hang>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
