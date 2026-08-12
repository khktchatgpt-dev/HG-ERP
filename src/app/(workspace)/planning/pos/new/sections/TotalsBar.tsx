'use client'

import { useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import { PO_CURRENCIES, fmtMoney } from '@/lib/po-line'
import { Segmented } from './Segmented'
import type { Num } from '../po-line'
// appearance reset: giấu nút tăng/giảm của input số — che số, không ai dùng.
const box =
  'border-input bg-card h-[28px] rounded-md border px-2 text-right text-[13px] transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

/** Các mức VAT NCC hay chào — một cú bấm thay vì gõ vào ô số bé. */
const VAT_PRESETS = [0, 8, 10] as const

/**
 * Thanh tổng DÍNH ĐÁY: cộng tiền hàng · chiết khấu · VAT · tổng thanh toán · nút
 * gửi duyệt. Dính đáy vì bảng dòng hàng dài, cuộn tới cuối mới thấy tổng thì
 * người soạn không biết mình đang ở mức tiền nào.
 *
 * VAT là NÚT CHỌN NHANH 0/8/10% + "Khác…", không còn mỗi ô số 62px: phòng Cung
 * ứng phản hồi "tưởng VAT bị khoá theo mẫu" — vì mặc định của mẫu điền sẵn và ô
 * sửa quá kín tiếng, trong khi nhiều NCC chào 10%.
 *
 * Chiết khấu chỉ hiện ở mẫu có — đơn nhôm/inox không chiết khấu, bày ô trống ra
 * chỉ tổ gõ nhầm.
 */
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
  busy,
  submitLabel,
  onVatChange,
  onInclVatChange,
  onDiscountChange,
  onCurrencyChange,
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
  /** Lý do chưa gửi được (thiếu NCC, dòng thiếu số…) — chặn nút. */
  problem: string | null
  busy: boolean
  submitLabel: string
  onVatChange: (v: Num) => void
  onInclVatChange: (v: boolean) => void
  onDiscountChange: (v: Num) => void
  onCurrencyChange: (v: string) => void
  onSubmit: () => void
}) {
  const isPreset = vat !== '' && (VAT_PRESETS as readonly number[]).includes(Number(vat))
  /**
   * Ô "Khác…" chỉ bày ra khi cần: hoặc VAT hiện tại nằm ngoài 0/8/10 (đơn cũ mở
   * lại), hoặc người dùng vừa bấm "Khác…". Không thì thanh gọn đúng 4 nút.
   */
  const [customOpen, setCustomOpen] = useState(!isPreset && vat !== '')
  const customRef = useRef<HTMLInputElement | null>(null)
  const showCustom = customOpen || (!isPreset && vat !== '')

  return (
    <div className="sticky bottom-3 z-20 -mx-1 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 shadow-[0_-6px_24px_rgba(24,24,27,0.1)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span className="text-muted-foreground">
          Tiền hàng{' '}
          <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
            {fmtMoney(subtotal, currency)}
          </b>
        </span>
        {hasDiscount && (
          <label className="text-muted-foreground flex items-center gap-1.5">
            Chiết khấu
            <input
              type="number"
              min="0"
              step="1000"
              onWheel={(e) => e.currentTarget.blur()}
              value={discount}
              onChange={(e) =>
                onDiscountChange(e.target.value === '' ? '' : Number(e.target.value))
              }
              className={`${box} w-[110px]`}
              aria-label="Chiết khấu"
            />
          </label>
        )}

        <span className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            VAT
          </span>
          <Segmented
            label="Thuế suất VAT"
            options={[
              ...VAT_PRESETS.map((p) => ({ value: p, label: `${p}%` })),
              { value: -1, label: 'Khác…' },
            ]}
            value={showCustom ? -1 : vat === '' ? null : Number(vat)}
            onSelect={(v) => {
              if (v === -1) {
                setCustomOpen(true)
                // Bấm "Khác…" là để gõ — đưa con trỏ vào ô luôn.
                requestAnimationFrame(() => customRef.current?.focus())
              } else {
                setCustomOpen(false)
                onVatChange(v)
              }
            }}
          />
          {showCustom && (
            <input
              ref={customRef}
              type="number"
              min="0"
              max="100"
              step="0.5"
              onWheel={(e) => e.currentTarget.blur()}
              value={vat}
              onChange={(e) =>
                onVatChange(e.target.value === '' ? '' : Number(e.target.value))
              }
              className={`${box} w-[62px]`}
              aria-label="VAT % tuỳ chọn"
              placeholder="%"
            />
          )}
          <Segmented
            label="Đơn giá đã gồm VAT chưa"
            options={[
              { value: 'ex', label: 'chưa gồm' },
              { value: 'in', label: 'đã gồm' },
            ]}
            value={inclVat ? 'in' : 'ex'}
            onSelect={(v) => onInclVatChange(v === 'in')}
          />
          <span className="text-muted-foreground">
            ={' '}
            <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
              {fmtMoney(vatAmount, currency)}
            </b>
          </span>
        </span>

        {/* Danh sách tiền tệ dùng chung với hồ sơ NCC (PO_CURRENCIES) — gỗ báo
            giá USD, kính đặt TQ; đơn cũ lỡ mang mã lạ vẫn hiện được. */}
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className={`${box} px-1 text-[12px]`}
          aria-label="Tiền tệ"
        >
          {(PO_CURRENCIES as readonly string[]).includes(currency) ? null : (
            <option value={currency}>{currency}</option>
          )}
          {PO_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/*
          Tổng tiền và nút gửi đi LIỀN MỘT CỤM ở mép phải — để rời nhau thì trên
          màn 1366 nút bị đẩy xuống hàng hai một mình và thanh cao thêm 1/3.
        */}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <span className="flex flex-col items-end leading-tight">
            <span className="text-muted-foreground text-[11px]">
              Tổng thanh toán{vat !== '' && Number(vat) > 0 ? ` · VAT ${vat}%` : ''}
            </span>
            <b className="text-xl font-bold tracking-tight tabular-nums">
              {fmtMoney(grandTotal, currency)}
            </b>
          </span>
          <button
            type="button"
            disabled={busy || !!problem}
            title={problem ? `Chưa gửi được: ${problem}` : undefined}
            onClick={onSubmit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {busy ? 'Đang lưu…' : submitLabel}
          </button>
        </span>
        {/*
          Lý do nút bị khoá phải NHÌN LÀ THẤY — `basis-full` cho hẳn một dòng
          riêng bên dưới, không cắt cụt để nhét vừa hàng trên.
        */}
        {problem && (
          <span className="inline-flex basis-full items-center gap-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-400">
            <TriangleAlert className="size-3.5" aria-hidden />
            Chưa gửi được: {problem}
          </span>
        )}
      </div>
    </div>
  )
}
