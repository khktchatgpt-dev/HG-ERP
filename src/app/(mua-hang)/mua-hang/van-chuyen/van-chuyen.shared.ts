import type { PaidMethod, PoCostKind, TransportMode } from '@/lib/po-cost'
import { PAID_METHOD_LABEL, TRANSPORT_MODE_LABEL } from '@/lib/po-cost'
import type { PoCost } from '@/modules/dept/supply/po-costs.repo'

/**
 * VẬN CHUYỂN — kiểu và luật chung của sổ chuyến, hồ sơ đơn vị, và khối Chi phí
 * trên đơn. File thuần (không JSX) để cả page server lẫn màn client dùng.
 */

/** Phiếu phí như màn cần — bản rút gọn, tuần tự hoá được của `PoCost`. */
export type CostRow = {
  id: string
  transport_mode: TransportMode
  kind: PoCostKind
  cost_date: string
  payee_supplier_id: string | null
  payee_name: string | null
  payee_phone: string | null
  doc_no: string | null
  currency: string
  amount: number
  vat_rate: number | null
  vat_amount: number
  total: number
  note: string | null
  paid_by: string | null
  paid_by_name: string | null
  paid_on: string | null
  paid_method: PaidMethod | null
  reimbursed_at: string | null
  created_by_name: string | null
  voided_at: string | null
  voided_by_name: string | null
  void_reason: string | null
  allocations: {
    po_id: string
    po_code: string | null
    po_supplier_name: string | null
    base: number
    amount: number
  }[]
}

export function toCostRow(c: PoCost): CostRow {
  return {
    id: c.id,
    transport_mode: c.transport_mode,
    kind: c.kind,
    cost_date: c.cost_date,
    payee_supplier_id: c.payee_supplier_id,
    payee_name: c.payee_name,
    payee_phone: c.payee_phone,
    doc_no: c.doc_no,
    currency: c.currency,
    amount: c.amount,
    vat_rate: c.vat_rate,
    vat_amount: c.vat_amount,
    total: c.total,
    note: c.note,
    paid_by: c.paid_by,
    paid_by_name: c.paid_by_name,
    paid_on: c.paid_on,
    paid_method: c.paid_method,
    reimbursed_at: c.reimbursed_at,
    created_by_name: c.created_by_name,
    voided_at: c.voided_at,
    voided_by_name: c.voided_by_name,
    void_reason: c.void_reason,
    allocations: c.allocations,
  }
}

/**
 * TIỀN CỦA PHIẾU ĐANG Ở ĐÂU — một hàm cho sổ chuyến, hồ sơ đơn vị, ô đếm, chip
 * lọc (nguyên tắc 3: mọi con số đếm bằng đúng hàm trang đích dùng).
 *
 *   huy        phiếu đã huỷ — không tính vào tổng nào
 *   chi_ho     người trong công ty đã trả tại chỗ, Kế toán chưa hoàn
 *   da_hoan    Kế toán đã hoàn cho người chi hộ
 *   cho_hd_ncc NCC tự giao, phí lên hoá đơn NCC — chờ Kế toán nhập hoá đơn
 *   cho_tra    chưa trả, Kế toán trả theo chuyến — đến hạn từ ngày chuyến
 */
export type CostMoneyState = 'huy' | 'chi_ho' | 'da_hoan' | 'cho_hd_ncc' | 'cho_tra'

export function costMoneyState(c: CostRow): CostMoneyState {
  if (c.voided_at) return 'huy'
  if (c.paid_by) return c.reimbursed_at ? 'da_hoan' : 'chi_ho'
  if (c.transport_mode === 'ncc') return 'cho_hd_ncc'
  return 'cho_tra'
}

export const dmy = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'

/** Số ngày từ `iso` (YYYY-MM-DD) tới `today` (YYYY-MM-DD), không âm. */
export const daysSince = (iso: string, today: string) =>
  Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / 86_400_000))

/**
 * Nhãn + tone theo trạng thái tiền. Trả THEO CHUYẾN nên "chờ trả" đến hạn ngay
 * ngày chuyến: tới 7 ngày còn là "đang chờ" (warn), quá 7 ngày là trễ (stop).
 */
export function costStateTag(
  c: CostRow,
  today: string,
): { label: string; tone: 'neutral' | 'warn' | 'done' | 'stop' } {
  switch (costMoneyState(c)) {
    case 'huy':
      return { label: 'Đã huỷ', tone: 'neutral' }
    case 'chi_ho':
      return { label: 'Chi hộ chờ hoàn', tone: 'warn' }
    case 'da_hoan':
      return { label: 'Đã hoàn', tone: 'done' }
    case 'cho_hd_ncc':
      return { label: 'Chờ HĐ NCC', tone: 'warn' }
    case 'cho_tra': {
      const d = daysSince(c.cost_date, today)
      return { label: `Chờ trả · ${d} ngày`, tone: d > 7 ? 'stop' : 'warn' }
    }
  }
}

/** "Kế toán" / "Thanh Nga · Tiền mặt" — ai đã / sẽ trả tiền phiếu này. */
export function payerLabel(c: CostRow): { who: string; how: string | null } {
  if (c.paid_by) {
    return {
      who: c.paid_by_name ?? 'người trong công ty',
      how: c.paid_method ? PAID_METHOD_LABEL[c.paid_method] : null,
    }
  }
  if (c.transport_mode === 'ncc') return { who: 'Kế toán', how: 'theo hoá đơn NCC' }
  return { who: 'Kế toán', how: 'theo chuyến' }
}

export const modeLabel = (m: TransportMode) => TRANSPORT_MODE_LABEL[m] ?? m

/** Cộng phiếu còn hiệu lực theo tiền tệ. */
export function sumByCurrency(
  rows: CostRow[],
  pick: (c: CostRow) => number,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of rows) {
    if (c.voided_at) continue
    out[c.currency] = (out[c.currency] ?? 0) + pick(c)
  }
  return out
}
