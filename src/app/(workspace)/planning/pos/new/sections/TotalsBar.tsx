'use client'

import { Spinner } from '@/components/erp/Spinner'
import type { Num } from '../po-line'

const num = (n: number) => n.toLocaleString('vi-VN')
const box =
  'h-[28px] rounded-md border border-zinc-300 px-2 text-right text-[13px] dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Thanh tổng DÍNH ĐÁY: cộng tiền hàng · chiết khấu · VAT · tổng thanh toán · nút
 * gửi duyệt. Dính đáy vì bảng dòng hàng dài, cuộn tới cuối mới thấy tổng thì
 * người soạn không biết mình đang ở mức tiền nào.
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
  return (
    <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-zinc-200 bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="text-zinc-400">
          Cộng tiền hàng{' '}
          <b className="text-zinc-700 tabular-nums dark:text-zinc-200">{num(subtotal)}</b>
        </span>
        {hasDiscount && (
          <label className="flex items-center gap-1.5 text-zinc-400">
            Chiết khấu
            <input
              type="number"
              min="0"
              step="1000"
              value={discount}
              onChange={(e) =>
                onDiscountChange(e.target.value === '' ? '' : Number(e.target.value))
              }
              className={`${box} w-[110px]`}
              aria-label="Chiết khấu"
            />
          </label>
        )}
        <label className="flex items-center gap-1.5 text-zinc-400">
          VAT %
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={vat}
            onChange={(e) =>
              onVatChange(e.target.value === '' ? '' : Number(e.target.value))
            }
            className={`${box} w-[62px]`}
            aria-label="VAT %"
          />
          <select
            value={inclVat ? 'in' : 'ex'}
            onChange={(e) => onInclVatChange(e.target.value === 'in')}
            className={`${box} px-1 text-[12px]`}
            aria-label="Đơn giá đã gồm VAT chưa"
          >
            <option value="in">đã gồm</option>
            <option value="ex">chưa gồm</option>
          </select>
          <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
            {num(vatAmount)}
          </b>
        </label>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className={`${box} px-1 text-[12px]`}
          aria-label="Tiền tệ"
        >
          <option value="VND">VND</option>
          <option value="USD">USD</option>
        </select>

        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-zinc-400">Tổng thanh toán</span>
          <b className="text-lg tabular-nums">{num(grandTotal)}</b>
        </span>
        {/*
          Lý do nút bị khoá phải NHÌN LÀ THẤY. Trước đây là chữ nhỏ màu hổ phách
          lẫn trong thanh tổng tiền đầy số — người dùng thấy nút xám và đoán.
          Nay: viền + nền cảnh báo, kèm `title` trên chính nút để rê chuột cũng ra.
        */}
        {problem && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[12px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            <span aria-hidden>⚠</span>
            Chưa gửi được: {problem}
          </span>
        )}
        <button
          type="button"
          disabled={busy || !!problem}
          title={problem ? `Chưa gửi được: ${problem}` : undefined}
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
