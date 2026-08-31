'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SelectOption = { value: string; label: string; hint?: string }

/**
 * Ô chọn CÓ GÕ TÌM — thay `<select>` cho những danh sách dài.
 *
 * Vì sao cần: thư viện có 36 nhãn khách và danh mục còn mở rộng tiếp. Một
 * `<select>` 36 mục là danh sách thả xuống dài hơn màn hình, phải cuộn để đọc và
 * không gõ để nhảy tới được (trình duyệt chỉ nhảy theo ký tự ĐẦU). Ở đây gõ vài
 * chữ bất kỳ trong tên là lọc ngay.
 *
 * Danh sách vẽ bằng `absolute` NGAY TẠI CHỖ, KHÔNG portal: ô này sống bên trong
 * bảng "Bộ lọc" vốn đã là một popover Radix. Thử bằng `AnchoredPopover` (portal
 * ra body) thì danh sách không bao giờ hiện — Radix khoá tiêu điểm và cuộn nội
 * dung khi có tương tác, mà popover đó tự đóng khi nghe thấy scroll. Bảng lọc
 * không có `overflow:hidden` nên tràn ra ngoài mép vẫn nhìn thấy đủ.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  label,
  placeholder = 'Gõ để tìm…',
  allLabel,
}: {
  value: string
  /** KHÔNG chứa mục "tất cả" — truyền qua `allLabel` để nó luôn đứng đầu. */
  options: SelectOption[]
  onChange: (v: string) => void
  label: string
  placeholder?: string
  /** Nhãn của lựa chọn "không lọc". Chọn nó = trả về 'all'. */
  allLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const current = options.find((o) => o.value === value)
  const shown = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(t) || (o.hint ?? '').toLowerCase().includes(t),
    )
  }, [options, term])

  // Bấm ra ngoài / Esc thì đóng. Không dùng lớp phủ toàn màn: lớp phủ nằm trong
  // popover Radix sẽ nuốt luôn cú bấm vào các ô lọc khác.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation() // Esc đóng danh sách này trước, chưa đóng cả bảng lọc.
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setTerm('')
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setTerm('')
          setOpen((o) => !o)
        }}
        className="bg-background focus-visible:ring-ring/50 flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-sm focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <span
          className={`min-w-0 flex-1 truncate ${current ? '' : 'text-muted-foreground'}`}
        >
          {current?.label ?? allLabel}
        </span>
        {current && (
          // `span` chứ không `button`: nút lồng trong nút là HTML không hợp lệ,
          // React cảnh báo và trình duyệt tự tách cây DOM ra để chữa.
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Bỏ lọc ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              pick('all')
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
          >
            <X className="size-3.5" />
          </span>
        )}
        <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-lg">
          <div className="relative border-b">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-9 w-full bg-transparent pr-2 pl-8 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <Row
              label={allLabel}
              selected={value === 'all'}
              onClick={() => pick('all')}
            />
            {shown.map((o) => (
              <Row
                key={o.value}
                label={o.label}
                hint={o.hint}
                selected={o.value === value}
                onClick={() => pick(o.value)}
              />
            ))}
            {shown.length === 0 && (
              <p className="text-muted-foreground px-3 py-4 text-center text-xs">
                Không có mục nào khớp “{term}”
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string
  hint?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
        selected ? 'text-[var(--primary)]' : ''
      }`}
    >
      <Check className={`size-3.5 shrink-0 ${selected ? '' : 'invisible'}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-muted-foreground shrink-0 text-xs">{hint}</span>}
    </button>
  )
}
