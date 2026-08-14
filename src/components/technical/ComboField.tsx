'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { apiErrorText } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'

export type ComboOption = { value: string; label: string }

/**
 * Ô CHỌN CÓ TÌM + TẠO MỚI — dùng cho "Khách hàng / nhóm" và "Danh mục" ở form
 * nhận diện SP (user 13/08/2026: "ở phần này không thể tuỳ chỉnh loại khách
 * hàng hay tạo khách hàng mới, danh mục cũng vậy").
 *
 * Vì sao không dùng thẳng `<select>`: danh sách khách/danh mục dài dần theo
 * thời gian, mà select thuần thì không tìm được và tuyệt đối không thêm được
 * giá trị mới — người dùng kẹt, phải bỏ form đi chỗ khác tạo rồi quay lại.
 *
 * Giá trị gửi lên form nằm ở `<input type="hidden" name>` — nút bấm bên ngoài
 * chỉ là giao diện, nên form cha vẫn đọc bằng `FormData` như mọi ô khác.
 */
export function ComboField({
  name,
  value,
  options,
  placeholder,
  emptyLabel,
  createLabel,
  onCreate,
}: {
  name: string
  value: string
  options: ComboOption[]
  placeholder?: string
  /** Nhãn dòng "bỏ trống"; null = bắt buộc chọn, không có dòng này. */
  emptyLabel?: string | null
  /** Có nhãn = hiện lối tạo mới. Bỏ trống = chỉ chọn trong danh sách. */
  createLabel?: string
  /** Trả về mục vừa tạo để chọn luôn. Ném lỗi thì ô giữ nguyên. */
  onCreate?: (label: string) => Promise<ComboOption>
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState(value)
  const [extra, setExtra] = useState<ComboOption[]>([])

  const all = [...options, ...extra]
  const current = all.find((o) => o.value === picked)
  const needle = q.trim().toLowerCase()
  const shown = needle ? all.filter((o) => o.label.toLowerCase().includes(needle)) : all
  /** Gõ một tên chưa có trong danh sách → mở lối tạo đúng tên đó. */
  const canCreate =
    !!onCreate && !!needle && !all.some((o) => o.label.toLowerCase() === needle)

  function choose(v: string) {
    setPicked(v)
    setOpen(false)
    setQ('')
  }

  async function create() {
    if (!onCreate || busy) return
    setBusy(true)
    try {
      const item = await onCreate(q.trim())
      setExtra((x) => [...x, item])
      choose(item.value)
      toast.success('Đã thêm', item.label)
    } catch (e) {
      toast.error('Không thêm được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={picked} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="border-input bg-card hover:bg-muted/40 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm"
      >
        <span className={cn('min-w-0 flex-1 truncate', !current && 'text-foreground/50')}>
          {current?.label ?? placeholder ?? emptyLabel ?? '— chưa chọn —'}
        </span>
        {picked && emptyLabel !== null && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Bỏ chọn"
            onClick={(e) => {
              e.stopPropagation()
              choose('')
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
      </button>

      {open && (
        <>
          {/* Nền bắt cú bấm ra ngoài — khỏi cần listener toàn trang. */}
          <button
            type="button"
            aria-label="Đóng"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="bg-card absolute z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-lg">
            <div className="flex items-center gap-2 border-b px-2.5 py-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm hoặc gõ tên mới…"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto py-1">
              {emptyLabel !== null && !needle && (
                <Row
                  label={emptyLabel ?? '— chưa chọn —'}
                  muted
                  onClick={() => choose('')}
                />
              )}
              {shown.map((o) => (
                <Row
                  key={o.value}
                  label={o.label}
                  active={o.value === picked}
                  onClick={() => choose(o.value)}
                />
              ))}
              {!shown.length && !canCreate && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  Không có mục nào
                </p>
              )}
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={() => void create()}
                disabled={busy}
                className="text-primary hover:bg-muted/50 flex w-full items-center gap-2 border-t px-3 py-2 text-start text-sm font-medium disabled:opacity-50"
              >
                {busy ? <Spinner size={14} /> : <Plus className="size-4" aria-hidden />}
                {createLabel ?? 'Thêm'} &ldquo;{q.trim()}&rdquo;
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Row({
  label,
  active,
  muted,
  onClick,
}: {
  label: string
  active?: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm',
        muted && 'text-muted-foreground',
      )}
    >
      <span className="w-4 shrink-0">
        {active && <Check className="text-primary size-4" aria-hidden />}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}
