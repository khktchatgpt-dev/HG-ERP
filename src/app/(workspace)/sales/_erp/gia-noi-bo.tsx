'use client'

import type { ReactNode } from 'react'
import { Eye, EyeOff, Lock, Printer } from 'lucide-react'
import { useLocalPref } from '@/lib/use-local-pref'
import { PRICE_NAME } from '@/lib/sale-price'

/**
 * TÁCH GIÁ NỘI BỘ KHỎI GIÁ GỬI KHÁCH (artboard bước 2, duyệt 13/10/2026).
 *
 * Ba màn có lưới giá — lập báo giá, chi tiết báo giá, Điền đơn giá — bày hai nhóm
 * cột với cùng ba dấu hiệu, để Sale không lẫn số mình tự tính với số đưa khách:
 *   1. dòng tiêu đề NHÓM: máy in = "Gửi khách", khoá = "Nội bộ · không in";
 *   2. cột nội bộ nền xám lạnh + vạch đậm ở mép trái nhóm;
 *   3. nhóm nội bộ luôn đứng BÊN PHẢI (Q1) — che nó đi thì phần trái là tờ in.
 * Không dùng màu hành động (thứ bấm được) hay màu vòng đời cho nền nhóm; đỏ / vàng
 * chỉ đi lên SỐ lãi âm / ± âm.
 */

/** Nền ô thân lưới thuộc nhóm nội bộ. */
export const INT = 'bg-muted'
/** Nền ô tiêu đề cột thuộc nhóm nội bộ — đậm hơn tiêu đề thường một nấc. */
export const INT_HEAD = 'bg-[color-mix(in_srgb,var(--muted-foreground)_12%,var(--muted))]'
/** Vạch đậm mép trái nhóm nội bộ — đặt lên Ô, không lên hàng (bẫy pseudo trên tr). */
export const EDGE = 'shadow-[inset_2px_0_0_var(--muted-foreground)]'

/** Ô tiêu đề NHÓM (hàng trên tiêu đề cột). */
const GH =
  'h-6 border-b border-border bg-muted px-3 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-foreground/80 uppercase'
const STRIPES = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in srgb, var(--muted-foreground) 12%, transparent) 0 2px, transparent 2px 7px)',
}

/**
 * Một ô tiêu đề nhóm. `kind` quyết định biểu tượng + nền (nhóm nội bộ có vạch
 * mép trái). `plain` bỏ biểu tượng — màn Tính giá SP cả màn đã là nội bộ, khoá
 * trên mọi nhóm chỉ là nhiễu.
 */
export function NhomTh({
  kind,
  colSpan,
  plain,
  children,
}: {
  kind: 'khach' | 'noi-bo' | 'trong'
  colSpan: number
  plain?: boolean
  children?: ReactNode
}) {
  if (kind === 'trong') return <th colSpan={colSpan} className={GH} />
  const Icon = kind === 'khach' ? Printer : Lock
  return (
    <th
      colSpan={colSpan}
      className={`${GH} ${kind === 'noi-bo' ? `${INT_HEAD} ${EDGE}` : ''}`}
      style={kind === 'noi-bo' ? STRIPES : undefined}
    >
      <span className="inline-flex items-center gap-1.5">
        {!plain && <Icon className="size-3.5" strokeWidth={1.9} aria-hidden />}
        {children}
      </span>
    </th>
  )
}

/** Nhãn hai nhóm — một chỗ để ba màn nói cùng một câu. */
export const NHOM = {
  quote: 'Gửi khách · in lên báo giá',
  order: 'Gửi khách · in lên hợp đồng',
  int: 'Nội bộ · không in',
} as const

/** Chú giải tiêu đề cột nội bộ. */
export const GIA_TIP = {
  cost: `${PRICE_NAME.cost} = trực tiếp + chi phí chung (màn Tính giá SP). Nội bộ, không in.`,
  plan: `${PRICE_NAME.plan} = ${PRICE_NAME.cost} + ${PRICE_NAME.profit}: mức giá Sale tính trước khi chào.`,
  lai: `Lãi thực = (giá − ${PRICE_NAME.cost}) / giá`,
  vs: `So với ${PRICE_NAME.plan}: âm = thấp hơn mức đã tính`,
} as const

/** % một chữ số lẻ, dấu PHẨY thập phân như mọi số của khu Bán hàng (vi-VN), dấu trừ thật; `signed` thêm "+" cho số dương. */
export function fmtPct(v: number | null | undefined, signed = false): string {
  if (v == null) return '—'
  const s = Math.abs(v).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return v < 0 ? `−${s}%` : signed && v > 0 ? `+${s}%` : `${s}%`
}

/**
 * Ẩn nhóm nội bộ khi chia sẻ màn hình (Q4). Nhớ theo MÁY (localStorage), mặc
 * định HIỆN. Một khoá chung cho cả ba màn: ẩn ở báo giá rồi mở Điền đơn giá
 * trong cùng buổi họp thì vẫn đang ẩn — đúng điều người dùng chờ đợi.
 */
export function useAnGiaNoiBo(): { hidden: boolean; toggle: () => void } {
  const [v, set] = useLocalPref('hg:sales:an-gia-noi-bo', '0')
  return { hidden: v === '1', toggle: () => set(v === '1' ? '0' : '1') }
}

/** Nút thanh công cụ "Ẩn giá nội bộ" — chỉ dựng khi người xem có quyền thấy giá. */
export function NutAnGiaNoiBo({
  hidden,
  onToggle,
}: {
  hidden: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[13px] whitespace-nowrap ${
        hidden
          ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {hidden ? (
        <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      ) : (
        <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      )}
      {hidden ? 'Đang ẩn giá nội bộ' : 'Ẩn giá nội bộ'}
    </button>
  )
}

/**
 * Câu nhỏ trên thanh lưới nói vì sao không thấy cột nội bộ: không quyền, hoặc
 * đang ẩn (kèm nút hiện lại — để người dùng không tưởng dữ liệu đã mất).
 */
export function GhiChuNoiBo({
  canSee,
  hidden,
  cols,
  onShow,
}: {
  canSee: boolean
  hidden: boolean
  cols: number
  onShow: () => void
}) {
  if (!canSee)
    return (
      <span className="text-muted-foreground text-xs">
        {PRICE_NAME.cost} · {PRICE_NAME.plan} chỉ Sale, Kỹ thuật, BGĐ xem được
      </span>
    )
  if (!hidden) return null
  return (
    <span className="text-muted-foreground text-xs">
      Đã ẩn {cols} cột nội bộ ·{' '}
      <button
        type="button"
        onClick={onShow}
        className="text-[var(--primary)] underline underline-offset-2"
      >
        hiện lại
      </button>
    </span>
  )
}
