'use client'

import type { LucideIcon } from 'lucide-react'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'

/**
 * MẢNH GHÉP CỦA "TỜ PHIẾU SỐNG" — ngôn ngữ hình của màn chi tiết đơn đặt
 * (thiết kế lại 04/09/2026).
 *
 * Vì sao đổi hướng: bản cũ là một BẢNG ĐIỀU KHIỂN — sáu thẻ bo góc như nhau,
 * tiền nằm trong cột phải, trạng thái là một dải 8 bước nằm ngang ăn hết bề
 * ngang. Nhưng thứ người mua đang cầm không phải dashboard: nó là TỜ ĐƠN ĐẶT
 * HÀNG mà chính họ in ra, ký, rồi gửi Zalo cho NCC. Cả phòng nói chuyện bằng
 * "tờ 6/2026-HG/ATP", không ai nói "bản ghi PO id d05b...".
 *
 * Nên màn này dựng lại theo đúng vật thật:
 *   · ĐẦU PHIẾU mang số đơn cỡ lớn (chữ máy, giãn ký tự) + hai bên mua/bán —
 *     y như dòng "Kính gửi:" trên giấy.
 *   · CON DẤU trạng thái đóng lệch ở góc phải — trong phòng làm việc, tình
 *     trạng một chứng từ LÀ con dấu; cái nhãn bo tròn đọc ra phần mềm, con dấu
 *     đọc ra hồ sơ. Đây là điểm nhấn DUY NHẤT của trang, mọi thứ khác im lặng.
 *   · CỘT MỐC dọc ở lề trái thay dải 8 bước nằm ngang: vòng đời thật có 10-15
 *     mốc (gửi, xác nhận, từng đợt, từng phiếu nhập) — xếp dọc mới đủ chỗ, và
 *     lề trái vốn là chỗ người ta ghi chú lên giấy.
 *   · THANH VIỆC dính đáy màn: đọc phiếu xong mới hành động, nên nút nằm cuối
 *     đường mắt chứ không chiếm một cột suốt chiều dài trang.
 */

/** Sắc thái của một mốc / con dấu — dùng lại token vòng đời, không đẻ màu mới. */
export type DocTone = 'gray' | 'amber' | 'green' | 'red' | 'blue'

export const TONE_COLOR: Record<DocTone, string> = {
  gray: 'var(--muted-foreground)',
  amber: 'var(--warn)',
  green: 'var(--done)',
  red: 'var(--stop)',
  blue: 'var(--primary)',
}

/** Con dấu trạng thái — nét viền, nghiêng nhẹ, chữ hoa giãn. */
export function StatusStamp({
  status,
  tone,
  date,
}: {
  status: PoStatus
  tone: DocTone
  date?: string | null
}) {
  const color = TONE_COLOR[tone]
  return (
    <div
      className="pointer-events-none flex shrink-0 -rotate-3 flex-col items-center rounded-[3px] border-2 px-3 py-1.5 select-none"
      style={{ borderColor: color, color }}
      aria-hidden
    >
      <span className="text-[15px] leading-none font-extrabold tracking-[0.14em] uppercase">
        {PO_STATUS_LABEL[status]}
      </span>
      {date && (
        <span className="t-data mt-1 text-[10px] leading-none tracking-[0.12em] opacity-80">
          {date}
        </span>
      )}
    </div>
  )
}

/** Một ô dữ kiện ở đầu phiếu: nhãn nhỏ chữ hoa, giá trị đậm. */
export function DocFact({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </span>
      <span className={`min-w-0 truncate text-[13px] ${mono ? 't-data' : ''}`}>
        {children}
      </span>
    </div>
  )
}

/**
 * MỐC TRONG CỘT LỀ. Chấm + đường nối dọc; mốc chưa tới thì rỗng ruột.
 * `at` là chuỗi đã format sẵn ở nơi gọi — thành phần này không biết múi giờ.
 */
export function LedgerMark({
  label,
  at,
  tone = 'gray',
  done = true,
  detail,
  actor,
  last,
}: {
  label: string
  at?: string | null
  tone?: DocTone
  done?: boolean
  detail?: string | null
  actor?: string | null
  last?: boolean
}) {
  const color = TONE_COLOR[tone]
  return (
    <li className="relative flex gap-2.5 pb-3 last:pb-0">
      {!last && (
        <span
          className="bg-border absolute top-[13px] bottom-0 left-[4.5px] w-px"
          aria-hidden
        />
      )}
      <span
        className="relative mt-[5px] size-2.5 shrink-0 rounded-full border-2"
        style={{
          borderColor: color,
          background: done ? color : 'var(--card)',
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={`text-[12.5px] ${done ? 'font-medium' : 'text-muted-foreground'}`}
          >
            {label}
          </span>
          {at && <span className="t-data text-muted-foreground text-[11px]">{at}</span>}
        </div>
        {(actor || detail) && (
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
            {actor}
            {actor && detail ? ' · ' : ''}
            {detail}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * KHỐI CỦA TỜ PHIẾU — tiêu đề chữ hoa nhỏ + gạch chân mảnh, không bo góc dày,
 * không đổ bóng: đọc như một mục của văn bản chứ không như một thẻ dashboard.
 */
export function DocBlock({
  title,
  icon: Icon,
  meta,
  action,
  children,
  className = '',
}: {
  title: string
  icon?: LucideIcon
  meta?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`bg-card rounded-lg border ${className}`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b px-4 py-2.5">
        {Icon && (
          <Icon size={15} strokeWidth={1.9} className="text-muted-foreground shrink-0" />
        )}
        <h2 className="text-[11px] font-bold tracking-[0.1em] uppercase">{title}</h2>
        {meta && <span className="text-muted-foreground text-[12px]">{meta}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  )
}
