'use client'

import { useState } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Checkbox } from '@/components/shadcn/checkbox'
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
/* Chỉ phần KHÁC mặc định của `Input`: thấp hơn, canh phải, và tắt nút xoay của
 * input number. Viền/nền/focus-ring để kit lo. */
const box =
  'bg-card h-7 px-2 text-right text-[13px] shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

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
    /* mt-auto: khung ngoài cao tối thiểu bằng màn hình (xem PoCreateForm) nên
       thanh phải tự đẩy mình xuống đáy khoảng trống còn lại. */
    <footer className="border-border bg-card sticky bottom-0 z-30 mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5">
      <span className="text-muted-foreground text-[13px]">
        Tiền hàng{' '}
        <b className="t-data text-foreground text-[13px]">
          {fmtMoney(subtotal, currency)}
        </b>
      </span>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="h-auto gap-1.5 px-2.5 py-1 text-[12.5px] font-normal shadow-none"
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
        </Button>
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
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    aria-pressed={Number(vat) === v && vat !== ''}
                    onClick={() => onVatChange(v)}
                    className={
                      'h-auto flex-1 px-2 py-1 text-[12.5px] font-normal shadow-none ' +
                      (Number(vat) === v && vat !== ''
                        ? 'border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
                        : '')
                    }
                  >
                    {v}%
                  </Button>
                ))}
                <Input
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
                <Checkbox
                  checked={inclVat}
                  onCheckedChange={(v) => onInclVatChange(v === true)}
                />
                Đơn giá đã gồm VAT
              </label>
              {/* Chiết khấu chỉ ở mẫu CÓ — bày ô trống ở mẫu khác chỉ tổ gõ nhầm. */}
              {hasDiscount && (
                <label className="mt-2 flex items-center justify-between gap-2 text-[12.5px]">
                  Chiết khấu
                  <Input
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
        <Button
          type="button"
          variant="ghost"
          onClick={onProblemClick}
          disabled={!onProblemClick}
          className="h-auto gap-1.5 px-1.5 py-0.5 text-[12px] text-[var(--warn)] enabled:hover:bg-[var(--warn)]/10 enabled:hover:underline disabled:cursor-default disabled:opacity-100"
          title={onProblemClick ? 'Bấm để tới chỗ cần sửa' : undefined}
        >
          <TriangleAlert className="size-3.5" strokeWidth={1.8} aria-hidden />
          Chưa lưu được: {problem}
        </Button>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className="flex flex-col items-end leading-tight">
          <span className="text-muted-foreground text-[11px]">
            Tổng thanh toán{vat !== '' && Number(vat) > 0 ? ` · VAT ${vat}%` : ''}
          </span>
          <b className="t-data text-[19px] font-bold">{fmtMoney(grandTotal, currency)}</b>
        </span>
        <Button
          type="button"
          disabled={busy || !!problem}
          title={problem ? `Chưa lưu được: ${problem}` : undefined}
          onClick={onSubmit}
          className="text-[13px]"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </Button>
      </span>
    </footer>
  )
}
