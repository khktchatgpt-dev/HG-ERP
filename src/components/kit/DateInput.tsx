'use client'

import { useRef, useState } from 'react'
import { Popover as P } from 'radix-ui'
import { DayPicker } from 'react-day-picker'
import { vi } from 'react-day-picker/locale'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { cn } from '@/lib/utils'
import { Ico } from './Icon'

/*
  ISO `yyyy-mm-dd` ↔ Date theo GIỜ ĐỊA PHƯƠNG. Đừng `new Date('2026-09-24')`:
  chuỗi ISO chỉ có ngày bị hiểu là nửa đêm UTC, tức 07:00 giờ VN — lệch một
  ngày ở mọi múi giờ âm, và `toISOString()` chiều ngược lại cũng lệch y vậy.
*/
function isoToDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}
function dateToIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/*
  CHỮ TRÊN LỊCH theo cách giấy tờ VN ghi, không theo `date-fns/locale/vi`: bản
  locale viết "tháng chín 2026" và "th 2" — đúng ngữ pháp nhưng không ai ghi
  ngày trên chứng từ như vậy. Ở đây: "Tháng 9/2026", "T2 … CN".
*/
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const FORMATTERS = {
  formatCaption: (m: Date) => `Tháng ${m.getMonth() + 1}/${m.getFullYear()}`,
  formatWeekdayName: (d: Date) => THU[d.getDay()],
}
/*
  Nhãn trình đọc màn hình của từng ô ngày: đọc đúng NGÀY ĐẦY ĐỦ theo kiểu ô chữ
  đang hiện (dd/mm/yyyy) + thứ, để người không nhìn màn hình nghe khớp với thứ
  họ vừa gõ.
*/
const LABELS = {
  labelDayButton: (d: Date, m: { today?: boolean; selected?: boolean }) =>
    `${THU[d.getDay()] === 'CN' ? 'Chủ nhật' : 'Thứ ' + (d.getDay() + 1)}, ${isoToVn(dateToIso(d))}` +
    (m.today ? ', hôm nay' : '') +
    (m.selected ? ', đang chọn' : ''),
}

/**
 * Ô NGÀY KIỂU VIỆT NAM — gõ `dd/mm/yyyy`, hoặc chọn trên lịch thả.
 *
 * `<input type="date">` vẽ theo NGÔN NGỮ TRÌNH DUYỆT chứ không theo app: máy
 * cài Chrome tiếng Anh (đa số máy ở xưởng) hiện `mm/dd/yyyy`, trong khi mọi
 * chứng từ giấy đọc `dd/mm/yyyy` — `03/08` với `08/03` là hai ngày khác nhau mà
 * không nhìn ra ô đang nói kiểu nào.
 *
 * Tới B4 (24/09/2026) ô chữ đã là kiểu Việt, nhưng nút lịch vẫn mở LỊCH CỦA
 * TRÌNH DUYỆT (một `<input type="date">` tàng hình + `showPicker()`) — tức lịch
 * vẫn ra tiếng Anh, tuần bắt đầu Chủ nhật, và `showPicker` không chạy trên mọi
 * trình duyệt. Nay lịch là `react-day-picker` với locale `vi`: tên tháng, tên
 * thứ tiếng Việt, tuần bắt đầu THỨ HAI như lịch treo tường.
 *
 * Ô CHỮ VẪN LÀ ĐƯỜNG CHÍNH. Người nhập liệu gõ "240926" nhanh hơn mọi cú bấm
 * lịch; lịch là để tra "thứ Sáu tuần sau là ngày mấy". Bàn phím: Alt+↓ mở lịch
 * (mẫu date picker của WAI-ARIA), mũi tên đi trong lịch, Enter chọn, Esc đóng
 * và trả con trỏ về ô chữ.
 *
 * Logic hiểu ngày DÙNG CHUNG `@/lib/date-vn` với `erp/DateField` của theme v3 —
 * hai bản khác lớp vỏ, giống nhau cách hiểu ngày.
 */
export function DateInput({
  value,
  onChange,
  disabled,
  label,
  max,
}: {
  /** ISO `yyyy-mm-dd`, hoặc '' khi để trống. */
  value: string
  /**
   * Nhận ISO khi ô chữ thành một ngày CÓ THẬT, hoặc khi chọn trên lịch; '' khi xoá
   * trắng ô. Gõ dở thì không gọi — rời ô lúc đó là ô trả về giá trị cũ, im lặng.
   */
  onChange: (iso: string) => void
  /** Khoá cả ô chữ lẫn nút lịch — mờ 45%. */
  disabled?: boolean
  /**
   * Tên ô (`aria-label`), cũng ghép vào tên nút lịch và tên khung lịch ("Lịch — …").
   * Không bắt buộc ở tầng kiểu, nhưng thiếu thì ô chữ không có tên.
   */
  label?: string
  /**
   * ISO ngày lớn nhất chọn được TRÊN LỊCH. Chỉ chặn đường bấm lịch — ô chữ vẫn
   * gõ được ngày bất kỳ, nên chỗ nào có luật về ngày thì vẫn phải tự kiểm.
   */
  max?: string
}) {
  const [text, setText] = useState(() => isoToVn(value))
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Giá trị đổi từ bên ngoài thì vẽ lại chữ — nhưng đừng giẫm lên tay người
  // đang gõ. Chỉnh state ngay trong lượt render, không `useEffect`.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (vnToIso(text) !== (value || null)) setText(isoToVn(value))
  }

  const selected = isoToDate(value)
  const maxDate = max ? isoToDate(max) : undefined

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Anchor asChild>
        <span className="relative block">
          <input
            ref={input}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="dd/mm/yyyy"
            aria-label={label}
            aria-keyshortcuts="Alt+ArrowDown"
            disabled={disabled}
            value={text}
            onChange={(e) => {
              const next = maskVnDate(e.target.value)
              setText(next)
              const iso = vnToIso(next)
              if (iso) onChange(iso)
              else if (next === '') onChange('')
            }}
            onKeyDown={(e) => {
              if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
              }
            }}
            onBlur={() => {
              // Gõ dở hoặc ngày không có thật thì trả ô về giá trị đang giữ, không
              // để người dùng tưởng đã nhập được.
              const iso = vnToIso(text)
              setText(text.trim() === '' ? '' : isoToVn(iso ?? value))
            }}
            className={cn(
              'h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] font-[family-name:var(--font-mono)] tabular-nums',
              'text-k-sm bg-[var(--surface-card)] px-2 pr-8 text-left',
              'hover:border-[var(--ink-3)] focus:border-[var(--act)] disabled:opacity-45',
            )}
          />
          <P.Trigger asChild>
            <button
              type="button"
              // Ngoài thứ tự Tab: nhập liệu đi ô→ô, không dừng ở nút lịch mỗi
              // lần. Bàn phím mở lịch bằng Alt+↓ ngay trong ô chữ.
              tabIndex={-1}
              disabled={disabled}
              aria-label={label ? `Mở lịch — ${label}` : 'Mở lịch'}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] disabled:opacity-45"
            >
              <Ico name="lich" size={15} />
            </button>
          </P.Trigger>
        </span>
      </P.Anchor>
      <P.Portal>
        <div className="kit contents">
          <P.Content
            side="bottom"
            align="start"
            sideOffset={3}
            collisionPadding={8}
            aria-label={label ? `Lịch — ${label}` : 'Lịch'}
            // Đóng lịch thì con trỏ về Ô CHỮ, không về nút lịch (nút nằm ngoài
            // thứ tự Tab — trả về đó là con trỏ lạc).
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              input.current?.focus()
            }}
            className={cn(
              'z-[var(--z-pop)] rounded-[var(--radius)] border border-[var(--line)]',
              'bg-[var(--surface-card)] p-2 shadow-[var(--shadow-drop)]',
            )}
          >
            <DayPicker
              mode="single"
              locale={vi}
              weekStartsOn={1}
              formatters={FORMATTERS}
              labels={LABELS}
              // Tiêu điểm vào ngày đang chọn (hoặc hôm nay) ngay khi mở — để mũi
              // tên đi được luôn, không phải Tab vào lưới.
              autoFocus
              selected={selected}
              defaultMonth={selected ?? maxDate}
              disabled={maxDate ? { after: maxDate } : undefined}
              onSelect={(d) => {
                if (!d) return
                const iso = dateToIso(d)
                onChange(iso)
                setText(isoToVn(iso))
                setOpen(false)
              }}
            />
          </P.Content>
        </div>
      </P.Portal>
    </P.Root>
  )
}
