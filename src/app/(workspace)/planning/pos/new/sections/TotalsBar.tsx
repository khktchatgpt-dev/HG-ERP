'use client'

import { useState } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import { fmtMoney } from '@/lib/po-line'
import type { Num } from '../po-line'

/**
 * THANH TỔNG — MỘT DÒNG THẬT.
 *
 * Bản cũ bày cả chiết khấu, 4 nút VAT, ô "khác", nút "đã gồm/chưa gồm", ô tiền
 * tệ và tổng cùng lúc: trên 1366px thanh tràn xuống hàng hai, cao gần gấp rưỡi.
 * Mà VAT / chiết khấu mỗi đơn chỉ chạm một lần — chúng vào popover, ngoài thanh
 * chỉ còn hai thứ người soạn nhìn liên tục: TỔNG và nút LƯU.
 *
 * Tiền tệ chuyển hẳn lên chip "Khác" của thanh đầu đơn (nó là thuộc tính đầu
 * đơn, không phải một phép cộng).
 */
const box =
  'border-input bg-card h-7 rounded-md border px-2 text-right text-[13px] outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const VAT_PRESETS = [0, 8, 10] as const

export function TotalsBar({
  subtotal,
  vat,
  vatAmount,
  inclVat,
  discount,
  hasDiscount,
  grandTotal,
  currency,
  problem,
  onProblemClick,
  busy,
  submitLabel,
  onVatChange,
  onInclVatChange,
  onDiscountChange,
  onSubmit,
}: {
  subtotal: number
  vat: Num
  vatAmount: number
  inclVat: boolean
  discount: Num
  hasDiscount: boolean
  grandTotal: number
  currency: string
  problem: string | null
  /** Bấm vào câu "chưa lưu được" → nhảy tới đúng chỗ phải sửa. */
  onProblemClick?: () => void
  busy: boolean
  submitLabel: string
  onVatChange: (v: Num) => void
  onInclVatChange: (v: boolean) => void
  onDiscountChange: (v: Num) => void
  onSubmit: () => void
}) {
  const [open, setOpen] = useState(false)
  const isPreset = vat !== '' && (VAT_PRESETS as readonly number[]).includes(Number(vat))

  return (
    <footer className="border-border bg-card sticky bottom-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5">
      <span className="text-muted-foreground text-[13px]">
        Tiền hàng{' '}
        <b className="t-data text-foreground text-[13px]">
          {fmtMoney(subtotal, currency)}
        </b>
      </span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="border-input hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px]"
        >
          VAT <b className="t-data text-[12.5px]">{vat === '' ? '—' : `${vat}%`}</b>
          <span className="text-muted-foreground">
            {inclVat ? '(đã gồm)' : ''} = {fmtMoney(vatAmount, currency)}
          </span>
          {hasDiscount && discount !== '' && Number(discount) > 0 && (
            <span className="text-muted-foreground">
              · CK {fmtMoney(Number(discount), currency)}
            </span>
          )}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="border-border bg-popover absolute bottom-full left-0 z-50 mb-1.5 w-[300px] rounded-lg border p-2.5 shadow-lg">
              <div className="t-label text-muted-foreground mb-1.5">Thuế suất</div>
              <div className="flex gap-1.5">
                {VAT_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onVatChange(v)}
                    className={
                      'flex-1 rounded-md border px-2 py-1 text-[12.5px] transition-colors ' +
                      (Number(vat) === v && vat !== ''
                        ? 'border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
                        : 'border-input hover:bg-accent')
                    }
                  >
                    {v}%
                  </button>
                ))}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={isPreset ? '' : vat}
                  onChange={(e) =>
                    onVatChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="khác"
                  aria-label="VAT % tuỳ chọn"
                  className={`${box} w-[64px]`}
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={inclVat}
                  onChange={(e) => onInclVatChange(e.target.checked)}
                  className="accent-[var(--primary)]"
                />
                Đơn giá đã gồm VAT
              </label>
              {/* Chiết khấu chỉ ở mẫu CÓ — bày ô trống ở mẫu khác chỉ tổ gõ nhầm. */}
              {hasDiscount && (
                <label className="mt-2 flex items-center justify-between gap-2 text-[12.5px]">
                  Chiết khấu
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={discount}
                    onChange={(e) =>
                      onDiscountChange(
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    className={`${box} w-[120px]`}
                    aria-label="Chiết khấu"
                  />
                </label>
              )}
            </div>
          </>
        )}
      </div>

      {/* Câu chặn nút Lưu là thứ ĐƯA NGƯỜI DÙNG ĐI, không phải một dòng chữ để
          đọc: "dòng 27 thiếu SL đặt" mà vẫn phải tự cuộn đi tìm dòng 27 thì đơn
          40 dòng vẫn mất công như cũ. */}
      {problem && (
        <button
          type="button"
          onClick={onProblemClick}
          disabled={!onProblemClick}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-[var(--warn)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/50 enabled:hover:bg-[var(--warn)]/10 enabled:hover:underline disabled:cursor-default"
          title={onProblemClick ? 'Bấm để tới chỗ cần sửa' : undefined}
        >
          <TriangleAlert className="size-3.5" strokeWidth={1.8} aria-hidden />
          Chưa lưu được: {problem}
        </button>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className="flex flex-col items-end leading-tight">
          <span className="text-muted-foreground text-[11px]">
            Tổng thanh toán{vat !== '' && Number(vat) > 0 ? ` · VAT ${vat}%` : ''}
          </span>
          <b className="t-data text-[19px] font-bold">{fmtMoney(grandTotal, currency)}</b>
        </span>
        <button
          type="button"
          disabled={busy || !!problem}
          title={problem ? `Chưa lưu được: ${problem}` : undefined}
          onClick={onSubmit}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </span>
    </footer>
  )
}
