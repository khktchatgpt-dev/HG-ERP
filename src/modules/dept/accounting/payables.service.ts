import { payablesRepo, type ReceiptValueRow, type SupplierPayment } from './payables.repo'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * CÔNG NỢ NCC (GĐ C.1): còn nợ = phát sinh (movements nhận có giá, phiếu đảo
 * cấn trừ) − đã trả (0167). Tiền TÁCH THEO TIỀN TỆ — USD/VND không cộng lẫn.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type CurrencyTotal = {
  currency: string
  incurred: number
  paid: number
  balance: number
}

export type PayableSupplierRow = {
  supplier_id: string
  supplier_name: string
  payment_terms: string | null
  totals: CurrencyTotal[]
  /** Ngày phiếu nhập gần nhất — biết NCC còn giao dịch không. */
  last_receipt_at: string | null
  /** Phiếu nhận gắn PO nhưng CHƯA CÓ GIÁ — phát sinh đang đếm hụt. */
  missing_price_count: number
}

export type PayablePoRow = {
  po_id: string
  po_code: string
  currency: string
  incurred: number
  /** Đã trả GẮN ĐÍCH DANH PO này (trả gộp không gắn PO nằm ngoài cột này). */
  paid_linked: number
  receipts: {
    doc_code: string | null
    doc_date: string | null
    supplier_doc_no: string | null
    value: number
  }[]
}

/** Gộp thuần — có test: cấn trừ in/out, tách tiền tệ, trừ đã trả, cờ thiếu giá. */
export function summarizePayables(
  receipts: ReceiptValueRow[],
  payments: Pick<SupplierPayment, 'supplier_id' | 'amount' | 'currency'>[],
  missingPrice: { supplier_id: string; supplier_name: string; count: number }[] = [],
): PayableSupplierRow[] {
  type Acc = PayableSupplierRow & { byCurrency: Map<string, CurrencyTotal> }
  const bySupplier = new Map<string, Acc>()
  const ensure = (id: string, name: string, terms: string | null): Acc => {
    const cur = bySupplier.get(id)
    if (cur) return cur
    const row: Acc = {
      supplier_id: id,
      supplier_name: name,
      payment_terms: terms,
      totals: [],
      last_receipt_at: null,
      missing_price_count: 0,
      byCurrency: new Map(),
    }
    bySupplier.set(id, row)
    return row
  }
  const bucket = (acc: Acc, currency: string): CurrencyTotal => {
    const b = acc.byCurrency.get(currency) ?? {
      currency,
      incurred: 0,
      paid: 0,
      balance: 0,
    }
    acc.byCurrency.set(currency, b)
    return b
  }

  for (const m of receipts) {
    const acc = ensure(m.supplier_id, m.supplier_name, m.payment_terms)
    const sign = m.direction === 'out' ? -1 : 1
    bucket(acc, m.currency).incurred += sign * m.qty * m.unit_cost
    const at = m.doc_date ?? m.created_at.slice(0, 10)
    if (!acc.last_receipt_at || at > acc.last_receipt_at) acc.last_receipt_at = at
  }
  for (const p of payments) {
    const acc = bySupplier.get(p.supplier_id)
    // Thanh toán cho NCC chưa có phiếu nhận nào (trả trước) vẫn phải hiện —
    // balance âm là "NCC đang giữ tiền mình", không được nuốt.
    const row = acc ?? ensure(p.supplier_id, '?', null)
    bucket(row, p.currency).paid += p.amount
  }
  for (const m of missingPrice) {
    const acc = ensure(m.supplier_id, m.supplier_name, null)
    acc.missing_price_count = m.count
  }

  return [...bySupplier.values()]
    .map(({ byCurrency, ...row }) => ({
      ...row,
      totals: [...byCurrency.values()]
        .map((t) => ({
          currency: t.currency,
          incurred: r2(t.incurred),
          paid: r2(t.paid),
          balance: r2(t.incurred - t.paid),
        }))
        // Ẩn dòng tiền tệ đã về 0 tròn trịa để bảng gọn; giữ khi có phát sinh.
        .filter((t) => t.incurred !== 0 || t.paid !== 0),
      // NCC chỉ dính cờ thiếu giá (chưa có số nào) vẫn phải hiện để đi đòi giá.
    }))
    .filter((r) => r.totals.length > 0 || r.missing_price_count > 0)
    .sort((a, b) => {
      const bal = (x: PayableSupplierRow) =>
        Math.max(0, ...x.totals.map((t) => Math.abs(t.balance)))
      return bal(b) - bal(a)
    })
}

export const payablesService = {
  /** Sổ công nợ per NCC. */
  async list(user: User): Promise<{
    rows: PayableSupplierRow[]
    grand: CurrencyTotal[]
  }> {
    await assertAction(user, 'accounting.payable.view')
    const [receipts, payments, missing] = await Promise.all([
      payablesRepo.receiptValues(),
      payablesRepo.listPayments(),
      payablesRepo.receiptsMissingPrice(),
    ])
    const rows = summarizePayables(receipts, payments, missing)
    const grand = new Map<string, CurrencyTotal>()
    for (const r of rows) {
      for (const t of r.totals) {
        const g = grand.get(t.currency) ?? {
          currency: t.currency,
          incurred: 0,
          paid: 0,
          balance: 0,
        }
        g.incurred = r2(g.incurred + t.incurred)
        g.paid = r2(g.paid + t.paid)
        g.balance = r2(g.balance + t.balance)
        grand.set(t.currency, g)
      }
    }
    return { rows, grand: [...grand.values()] }
  },

  /** Chi tiết 1 NCC: phát sinh per PO (kèm phiếu nhập) + lịch sử thanh toán. */
  async supplierDetail(
    user: User,
    supplierId: string,
  ): Promise<{ pos: PayablePoRow[]; payments: SupplierPayment[] }> {
    await assertAction(user, 'accounting.payable.view')
    const [receipts, payments] = await Promise.all([
      payablesRepo.receiptValues(),
      payablesRepo.listPayments(supplierId),
    ])
    const mine = receipts.filter((m) => m.supplier_id === supplierId)
    const byPo = new Map<string, PayablePoRow>()
    for (const m of mine) {
      const row = byPo.get(m.po_id) ?? {
        po_id: m.po_id,
        po_code: m.po_code,
        currency: m.currency,
        incurred: 0,
        paid_linked: 0,
        receipts: [],
      }
      const sign = m.direction === 'out' ? -1 : 1
      const value = r2(sign * m.qty * m.unit_cost)
      row.incurred = r2(row.incurred + value)
      // Gộp per PHIẾU cho đọc được — mỗi phiếu nhiều dòng vật tư.
      const doc = row.receipts.find((d) => d.doc_code === m.doc_code)
      if (doc) doc.value = r2(doc.value + value)
      else {
        row.receipts.push({
          doc_code: m.doc_code,
          doc_date: m.doc_date,
          supplier_doc_no: m.supplier_doc_no,
          value,
        })
      }
      byPo.set(m.po_id, row)
    }
    for (const p of payments) {
      if (!p.po_id) continue
      const row = byPo.get(p.po_id)
      if (row) row.paid_linked = r2(row.paid_linked + p.amount)
    }
    return {
      pos: [...byPo.values()].sort((a, b) => b.incurred - a.incurred),
      payments,
    }
  },

  async recordPayment(
    user: User,
    input: {
      supplier_id: string
      po_id?: string | null
      amount: number
      currency: string
      paid_on: string
      method?: string | null
      ref_no?: string | null
      note?: string | null
    },
  ): Promise<void> {
    await assertAction(user, 'accounting.payable.manage')
    if (input.po_id) {
      const owner = await payablesRepo.poSupplier(input.po_id)
      if (!owner) throw NotFound('Đơn đặt hàng không tồn tại')
      if (owner !== input.supplier_id) {
        throw BadRequest('Đơn đặt hàng không thuộc nhà cung cấp này')
      }
    }
    await payablesRepo.insertPayment({
      supplier_id: input.supplier_id,
      po_id: input.po_id ?? null,
      amount: input.amount,
      currency: input.currency,
      paid_on: input.paid_on,
      method: input.method ?? null,
      ref_no: input.ref_no ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  /** Xoá bút toán ghi nhầm — người ghi hoặc Ban quản lý (pattern sổ SX). */
  async deletePayment(user: User, id: string): Promise<void> {
    await assertAction(user, 'accounting.payable.manage')
    const pay = await payablesRepo.findPayment(id)
    if (!pay) throw NotFound('Bút toán không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || pay.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người ghi hoặc Ban quản lý xoá được bút toán')
    await payablesRepo.deletePayment(id)
  },
}
