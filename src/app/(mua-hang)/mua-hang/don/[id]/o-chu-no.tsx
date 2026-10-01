'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ô CHỮ TỰ NỞ trên lưới dòng hàng (01/10/2026).
 *
 * Chủ dự án: "nhập thông tin nhiều trên ô thì không đủ để hiển thị hết". Cột
 * Ghi chú rộng 160px, cột quy cách ~100px — ghi chú thật như "Ghế 3 · Giằng chân
 * sau, Ngang mê trước" bị cắt ngang, đang gõ thì chữ đầu trôi mất khỏi ô.
 *
 * Cách của bảng tính (Excel, lưới SAP/Dynamics): nằm yên thì ô giữ đúng bề rộng
 * cột và cắt bằng "…" (rê chuột xem đủ); VÀO Ô thì ô nổi lên trên lưới, rộng tối
 * thiểu `minWidth`, xuống dòng và cao theo chữ — thấy trọn nội dung đang gõ. Lưới
 * không đổi bề rộng cột, không dòng nào bị đẩy.
 *
 * Nổi bằng `position: fixed` theo toạ độ ô (không `absolute`): khung lưới có
 * `overflow-x: auto` nên ô nổi tuyệt đối sẽ bị cắt ở dòng cuối / mép phải.
 *
 * Cùng hợp đồng với `TextInput` của kit: giữ bản nháp khi gõ, chốt khi rời ô hoặc
 * Enter (chỉ khi chữ khác `value`), Esc bỏ nháp. Chữ in lên phiếu là MỘT dòng nên
 * không nhận xuống dòng cứng — Enter là chốt, dán nhiều dòng thì nối bằng dấu cách.
 */
export function OChuNo({
  value,
  onCommit,
  label,
  placeholder,
  mono = false,
  maxLength,
  minWidth = 320,
}: {
  /** Giá trị đã chốt. */
  value: string
  /** Gọi khi rời ô / Enter và chữ đã khác `value`. */
  onCommit: (v: string) => void
  /** Tên ô (`aria-label`) — ô trong lưới không có nhãn bao ngoài. */
  label: string
  placeholder?: string
  /** Mã, quy cách → mono cho thẳng cột. */
  mono?: boolean
  maxLength?: number
  /** Bề rộng tối thiểu khi nở (px). Ô rộng hơn thì giữ bề rộng ô. */
  minWidth?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(
    null,
  )
  const shown = draft ?? value
  const open = box != null

  const place = () => {
    const r = wrap.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(Math.max(r.width, minWidth), window.innerWidth - 16)
    // Sát mép phải màn hình thì nở sang TRÁI (cột Ghi chú đứng gần cuối lưới).
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    setBox({ left, top: r.top, width })
  }

  // Lưới cuộn / cửa sổ đổi cỡ trong lúc đang gõ thì ô nổi đi theo ô gốc.
  useEffect(() => {
    if (!open) return
    const follow = () => place()
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `place` chỉ đọc ref + prop
  }, [open])

  const commit = () => {
    if (draft != null && draft !== value) onCommit(draft)
    setDraft(null)
  }

  return (
    <div
      ref={wrap}
      title={!open && shown ? shown : undefined}
      className="relative h-[var(--ctl-h)] min-w-0"
    >
      <textarea
        rows={1}
        aria-label={label}
        value={shown}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        onFocus={place}
        onBlur={() => {
          commit()
          setBox(null)
        }}
        onChange={(e) => setDraft(e.target.value.replace(/\s*\r?\n\s*/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Không xuống dòng cứng; lưới (gridKeys) nhận tiếp Enter để sang ô kế.
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') setDraft(null)
        }}
        style={open ? { left: box.left, top: box.top, width: box.width } : undefined}
        className={cn(
          'text-k-sm block resize-none rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[5px] leading-4',
          'placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]',
          mono && 'font-[family-name:var(--font-mono)]',
          open
            ? // Nổi: xuống dòng, cao theo chữ (tối đa 8 dòng rồi cuộn), đổ bóng tách khỏi lưới.
              'fixed z-50 max-h-[calc(8lh+12px)] min-h-[var(--ctl-h)] overflow-y-auto whitespace-pre-wrap shadow-[0_8px_24px_rgb(15_23_42/0.18)] [field-sizing:content]'
            : // Nằm yên: chữ thật trong suốt, lớp trên cắt "…" (textarea không tự có ellipsis).
              'h-full w-full overflow-hidden whitespace-nowrap text-transparent',
        )}
      />
      {!open && (
        <span
          aria-hidden
          className={cn(
            'text-k-sm pointer-events-none absolute inset-0 truncate px-[9px] leading-[var(--ctl-h)]',
            shown ? 'text-[var(--ink)]' : 'text-[var(--ink-3)]',
            mono && 'font-[family-name:var(--font-mono)]',
          )}
        >
          {shown || placeholder}
        </span>
      )}
    </div>
  )
}
