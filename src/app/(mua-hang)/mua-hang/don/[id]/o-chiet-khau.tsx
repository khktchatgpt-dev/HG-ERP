'use client'

import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import { money, numStr, toNum } from './don-chung-tu.shared'

/**
 * Ô CHIẾT KHẤU đầu đơn (0292, bản vẽ https://claude.ai/artifact/F59xofEqsgJhLTAyvPUxsC
 * duyệt 04/11/2026): số · [% | đ] · trừ [trước VAT | sau VAT] · "= số tiền" · lý do.
 *
 * Một ô cho ba chỗ — soạn đơn, sửa nháp, điều chỉnh đơn đã duyệt — để ba chỗ không
 * hiểu chiết khấu ba kiểu. Số tiền "=" lấy từ `poTotals` (cùng hàm in phiếu, hộp ký),
 * không tự nhân ở đây. Gõ % thì tiền tự tính lại khi sửa dòng; gõ đ thì giữ số tiền.
 * PO-2026-0242: 3% · sau VAT → "= 1.374.000 đ", phải trả 44.426.000 như phiếu NCC.
 */
type Patch = Partial<
  Pick<PoHeader, 'discount' | 'discountUnit' | 'discountAfterVat' | 'discountNote'>
>

export function OChietKhau({
  header,
  amount,
  onChange,
}: {
  header: Pick<
    PoHeader,
    'discount' | 'discountUnit' | 'discountAfterVat' | 'discountNote' | 'currency'
  >
  /** Số tiền thật sự bị trừ — `poTotals(...).discountAmount`. */
  amount: number
  onChange: (p: Patch) => void
}) {
  const unitLabel = header.discountUnit === 'pct' ? '%' : header.currency === 'VND' ? 'đ' : header.currency // prettier-ignore
  const seg = (on: boolean) =>
    [
      'h-[22px] border-r border-[var(--line)] px-2 text-[12px] last:border-r-0',
      on ? 'bg-[var(--act-wash)] font-semibold text-[var(--act-text)]' : 'text-[var(--ink-2)] hover:bg-[var(--surface-raised)]', // prettier-ignore
    ].join(' ')
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <input
        // Mount lại khi số đổi từ ngoài (nạp đơn, đổi đơn vị) — ô chốt lúc rời ô.
        key={`${header.discountUnit}-${header.discount}`}
        aria-label="Chiết khấu"
        inputMode="decimal"
        placeholder="0"
        className="w-[84px] border-b border-[var(--line)] bg-transparent text-right font-mono text-[13px] outline-none focus:border-[var(--act)]"
        defaultValue={numStr(header.discount)}
        onBlur={(e) => onChange({ discount: toNum(e.target.value) })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span
        role="group"
        aria-label="Đơn vị chiết khấu"
        className="inline-flex border border-[var(--line)]"
      >
        <button
          type="button"
          aria-pressed={header.discountUnit === 'pct'}
          className={seg(header.discountUnit === 'pct')}
          onClick={() => onChange({ discountUnit: 'pct' })}
        >
          %
        </button>
        <button
          type="button"
          aria-pressed={header.discountUnit === 'vnd'}
          className={seg(header.discountUnit === 'vnd')}
          onClick={() => onChange({ discountUnit: 'vnd' })}
        >
          {header.currency === 'VND' ? 'đ' : header.currency}
        </button>
      </span>
      <span className="text-[12px] text-[var(--ink-3)]">trừ</span>
      <span
        role="group"
        aria-label="Trừ chiết khấu"
        className="inline-flex border border-[var(--line)]"
      >
        <button
          type="button"
          aria-pressed={!header.discountAfterVat}
          className={seg(!header.discountAfterVat)}
          onClick={() => onChange({ discountAfterVat: false })}
        >
          trước VAT
        </button>
        <button
          type="button"
          aria-pressed={header.discountAfterVat}
          className={seg(header.discountAfterVat)}
          title="Chiết khấu tính trên tổng thanh toán (đã gồm VAT); tiền VAT không giảm"
          onClick={() => onChange({ discountAfterVat: true })}
        >
          sau VAT
        </button>
      </span>
      {amount > 0 && header.discountUnit === 'pct' && (
        <span className="font-mono text-[13px] font-semibold" aria-live="polite">
          = {money(amount, header.currency)}
        </span>
      )}
      {header.discount !== '' && Number(header.discount) > 0 && (
        <input
          key={`note-${header.discountNote}`}
          aria-label="Lý do chiết khấu"
          placeholder="Lý do (in lên phiếu)"
          maxLength={200}
          className="w-[220px] border-b border-[var(--line)] bg-transparent text-[13px] outline-none focus:border-[var(--act)]"
          defaultValue={header.discountNote}
          onBlur={(e) => onChange({ discountNote: e.target.value })}
        />
      )}
      <span className="sr-only">Đơn vị: {unitLabel}</span>
    </span>
  )
}

/** Câu ĐỌC của chiết khấu (màn chi tiết, khối tổng tiền): "3% sau VAT · tiền vỏ lon". */
export function chietKhauNhan(h: {
  discount_percent?: number | null
  discount_after_vat?: boolean | null
  discount_note?: string | null
}): string {
  const parts = [
    h.discount_percent != null ? `${Number(h.discount_percent)}%` : null,
    h.discount_after_vat ? 'sau VAT' : 'trước VAT',
    h.discount_note?.trim() || null,
  ].filter(Boolean)
  return parts.join(' · ')
}

type CkCols = {
  discount_amount: number | null
  discount_percent?: number | null
  discount_after_vat?: boolean | null
}

/** Đầu đơn cho `planAdjustment` — đủ ba trường chiết khấu (0292). */
export function adjHeader(vatRate: number | null, c: CkCols) {
  return {
    vatRate,
    discount: c.discount_amount,
    discountPercent: c.discount_percent,
    discountAfterVat: c.discount_after_vat,
  }
}

/**
 * Chèn dòng Chiết khấu vào khối tổng tiền (0292): trừ trước VAT đứng TRƯỚC dòng VAT,
 * trừ sau VAT đứng SAU — đúng thứ tự trên phiếu NCC. Trước 04/11/2026 khối này không
 * có dòng chiết khấu nào. `rows` phải có một dòng nhãn 'VAT'.
 */
export function chenChietKhau(
  h: Pick<
    PoHeader,
    'discount' | 'discountUnit' | 'discountAfterVat' | 'discountNote' | 'currency'
  >,
  amount: number,
  rows: [string, React.ReactNode][],
): [string, React.ReactNode][] {
  if (!(amount > 0)) return rows
  const pct = h.discountUnit === 'pct' && h.discount !== '' ? ` ${h.discount}%` : ''
  const note = h.discountNote.trim() ? ` · ${h.discountNote.trim()}` : ''
  const row: [string, React.ReactNode] = [
    `Chiết khấu${pct} ${h.discountAfterVat ? 'sau VAT' : 'trước VAT'}${note}`,
    <span key="ck" className="num text-[var(--stop)]">
      − {money(amount, h.currency)}
    </span>,
  ]
  const i = rows.findIndex(([k]) => k === 'VAT')
  const at = i < 0 ? 1 : h.discountAfterVat ? i + 1 : i
  return [...rows.slice(0, at), row, ...rows.slice(at)]
}
