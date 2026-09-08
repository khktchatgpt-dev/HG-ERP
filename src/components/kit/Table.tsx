'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — BẢNG
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bảng chiếm phần lớn thời gian nhìn của người dùng ERP, nên mấy thứ dưới
 * đây KHÔNG phải tuỳ chọn mà là mặc định không tắt được:
 *
 *  · tiêu đề cột dính khi cuộn — bảng luôn dài hơn màn hình;
 *  · chân bảng dính — kế toán luôn cần tổng, và cuộn xuống đáy để xem tổng
 *    rồi cuộn ngược lên là thao tác thừa lặp lại cả ngày;
 *  · cột số mono + căn phải + tabular — xem `.num` ở tokens.css;
 *  · dòng tiêu đề KHỐI thay cho việc lặp tên nhóm ở mọi dòng.
 *
 * KHÁC `DataTable` của v3 (373 dòng): bản này không nhận `columns[]` cấu
 * hình. Đo thực tế: mọi bảng ERP đều cần một cột đặc biệt nào đó (thanh phủ,
 * hai dòng trong một ô, nút inline) và API cấu hình luôn phải mở thêm lỗ
 * thoát, cuối cùng vừa cứng vừa phức tạp. Ở đây trả lại JSX thẳng — dài hơn
 * vài dòng ở nơi dùng, nhưng không có tầng trung gian phải đọc ngược.
 */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]">{children}</table>
    </div>
  )
}

/**
 * Tiêu đề cột — dính lên đỉnh VÙNG CUỘN CỦA BẢNG.
 *
 * BẪY đã dính 08/09/2026: để thanh lọc và bảng chung một vùng cuộn thì hai
 * lớp sticky tính toạ độ theo cùng một gốc và ĐÈ LÊN NHAU — tiêu đề cột phủ
 * mất dòng tiêu đề khối đầu tiên. Cách chắc chắn: thanh lọc đứng NGOÀI vùng
 * cuộn (nó không cần cuộn), bảng tự cuộn riêng, tiêu đề cột dính top:0.
 * Không dùng offset thủ công — đổi chiều cao thanh lọc là lệch lại.
 */
export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[var(--z-sticky)] [&_th]:border-b [&_th]:border-[var(--line)] [&_th]:bg-[var(--surface-raised)] [&_th]:px-[var(--pad-x)] [&_th]:py-[7px] [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[.04em] [&_th]:whitespace-nowrap [&_th]:text-[var(--ink-2)] [&_th]:uppercase">
      <tr>{children}</tr>
    </thead>
  )
}

/**
 * DÒNG TIÊU ĐỀ KHỐI — thay cho hai cột "Loại" + "Nhóm" lặp ở mọi dòng.
 *
 * Chép "Bu lông - vít - đinh - liên kết" xuống 100 dòng làm tờ giấy đọc như
 * một bức tường chữ (user chê 07/09/2026); sổ tay của phòng dùng dòng tiêu
 * đề khối cho danh sách dài.
 *
 * `step` là số thứ tự CÔNG ĐOẠN sản xuất nội thất — khung → gỗ → ngũ kim →
 * nệm/vải → sơn → bao bì. Đây là trục xưởng đi theo; nhóm kho là trục xếp
 * kệ, quá thô để chia bảng kê (một lệnh 107 mã thì 66 mã dồn vào một nhóm).
 */
export function GroupRow({
  step,
  name,
  meta,
  cols,
}: {
  step?: number | string
  name: string
  meta?: ReactNode
  cols: number
}) {
  return (
    <tr>
      <td
        colSpan={cols}
        className="h-[29px] border-y border-[var(--line)] bg-[var(--surface-raised)] px-[var(--pad-x)] text-[11px] font-bold tracking-[.07em] text-[var(--ink-2)] uppercase"
      >
        {step != null && (
          <span className="mr-[9px] inline-block h-[17px] w-[17px] rounded-[3px] border border-[var(--act-line)] bg-[var(--act-wash)] text-center font-[family-name:var(--font-mono)] text-[10px] leading-[15px] font-bold text-[var(--act)]">
            {step}
          </span>
        )}
        {name}
        {meta && (
          <span className="float-right text-[11.5px] font-medium tracking-[.03em] text-[var(--ink-3)] normal-case">
            {meta}
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * DÒNG DỮ LIỆU.
 *
 * `selected` dùng màu HÀNH ĐỘNG (act), không dùng màu vòng đời — trạng thái
 * điều khiển và trạng thái dữ liệu không được mượn màu của nhau, nếu không
 * thì "đang chọn" trông như "đang lỗi".
 */
export function Row({
  selected = false,
  onClick,
  children,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'group',
        onClick && 'cursor-pointer',
        selected
          ? '[&>td]:bg-[var(--act-wash)] [&>td:first-child]:shadow-[inset_2px_0_0_var(--act)]'
          : 'hover:[&>td]:bg-[var(--surface-hover)]',
      )}
    >
      {children}
    </tr>
  )
}

/** Ô. `grow` cho cột co giãn (tên vật tư) — cần `max-w-0` để ellipsis chạy. */
export function Cell({
  children,
  num = false,
  grow = false,
  muted = false,
  className,
}: {
  children: ReactNode
  num?: boolean
  grow?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <td
      className={cn(
        'h-[var(--row-h)] overflow-hidden border-b border-[var(--hair)] px-[var(--pad-x)] whitespace-nowrap text-ellipsis',
        num && 'num',
        grow && 'w-1/3 max-w-0',
        muted && 'text-[11.5px] text-[var(--ink-3)]',
        className,
      )}
    >
      {children}
    </td>
  )
}

/**
 * CHÂN BẢNG DÍNH — tổng luôn nhìn thấy.
 *
 * `caveat` là chỗ nói phần tổng KHÔNG bao gồm cái gì. Con số tổng che giấu
 * điều kiện là con số nguy hiểm: "5.482.000" mà 14/16 mã chưa có giá thì
 * người ký tưởng đó là toàn bộ tiền phải chi.
 */
export function TFoot({
  label,
  cells,
  caveat,
}: {
  label: ReactNode
  cells: ReactNode
  caveat?: ReactNode
}) {
  return (
    <tfoot className="[&_td]:sticky [&_td]:bottom-0 [&_td]:h-9 [&_td]:border-t [&_td]:border-[var(--line)] [&_td]:bg-[var(--surface-raised)] [&_td]:px-[var(--pad-x)] [&_td]:font-semibold">
      <tr>
        {label}
        {cells}
        {caveat && (
          <td className="text-[11.5px] font-normal text-[var(--ink-3)]" colSpan={2}>
            {caveat}
          </td>
        )}
      </tr>
    </tfoot>
  )
}

/**
 * THANH LỌC — đứng NGOÀI vùng cuộn của bảng, không sticky.
 *
 * Nó không cần cuộn cùng dữ liệu, và để chung vùng cuộn với bảng thì hai lớp
 * sticky đè nhau (xem bẫy ở THead).
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="z-[var(--z-bar)] flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
      {children}
    </div>
  )
}

/** Chip lọc bật/tắt. Số đếm luôn đi kèm — lọc mà không biết còn bao nhiêu là lọc mù. */
export function Chip({
  on = false,
  count,
  onClick,
  children,
}: {
  on?: boolean
  count?: number
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-[26px] items-center gap-[6px] rounded-[13px] border px-[10px] text-[var(--fs-sm)]',
        on
          ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act)]'
          : 'border-[var(--line)] bg-[var(--surface-card)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:text-[var(--ink)]',
      )}
    >
      {children}
      {count != null && <span className="num text-[11px] opacity-80">{count}</span>}
    </button>
  )
}

/**
 * Ô TÌM trên thanh lọc.
 *
 * Có mặt trong kit vì mọi màn danh sách đều cần, và vì thiếu nó thì nơi dùng
 * buộc phải viết <input> thô — đúng thứ cổng ESLint chặn.
 *
 * Nút xoá hiện NGAY TRONG ô khi có chữ: đặt thành chip riêng bên cạnh thì
 * người dùng phải tìm, mà xoá từ khoá là thao tác lặp nhiều nhất sau khi gõ.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm…',
  width = 260,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number
}) {
  return (
    <div
      className="flex h-7 items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-[10px] focus-within:border-[var(--act)]"
      style={{ width }}
    >
      <span className="text-[var(--ink-3)]">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent text-[12.5px] outline-0 placeholder:text-[var(--ink-3)]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Xoá từ khoá"
          className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      )}
    </div>
  )
}
