import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  dueDate,
  formatTermSetting,
  overdueDays,
  parseTermSetting,
  resolveTerm,
  type Term,
  type TermSource,
} from '@/lib/payment-terms'
import { payablesRepo } from './payables.repo'

/**
 * HẠN THANH TOÁN CỦA TỪNG KHOẢN NỢ.
 *
 * ⭐ BẢN ĐẦU SAI HƯỚNG, đã bỏ. Nó bắt khai số ngày cho **164 hồ sơ NCC** rồi mới
 * có hạn — user chê ngay: *"nhiều nhà cung cấp thì làm vậy rất khó dùng"*. Đúng.
 * ERP thật không bắt khai từng NCC: điều khoản đàm phán theo **từng đơn**, hồ sơ
 * NCC chỉ là mặc định, và công ty có **một** mặc định cuối cùng.
 *
 *     ĐƠN MUA  →  HỒ SƠ NCC  →  MẶC ĐỊNH CÔNG TY
 *
 * Đo 11/09/2026 trên 44 đơn đã nhận hàng:
 *   · không khai gì            → 15/44 có hạn (34%), đọc từ điều khoản SẴN CÓ trên đơn
 *   · khai MỘT mặc định công ty → **44/44 (100%)**
 *
 * Một dòng cấu hình thay cho 164 dòng nhập liệu. Màn vì thế xoay quanh KHOẢN NỢ
 * (đơn nào, hạn nào, quá bao lâu), không phải quanh danh sách nhà cung cấp.
 */

const SETTING_KEY = 'ap_default_payment_term'

export type DueRow = {
  po_id: string
  po_code: string
  supplier_id: string
  supplier_name: string
  currency: string
  /** Giá trị hàng đã nhận của đơn này (phiếu đảo đã cấn trừ). */
  amount: number
  /** Ngày nhận hàng GẦN NHẤT của đơn — gốc tính hạn. */
  received_on: string | null
  /** Câu điều khoản ghi trên đơn, để người đọc tay khi máy chịu. */
  po_terms: string | null
  term: Term | null
  source: TermSource
  /** Vì sao ra hạn đó — bày cạnh con số, không để nó đứng trơ. */
  why: string
  due_on: string | null
  /** Dương = quá hạn. `null` = chưa có hạn (KHÁC "chưa tới hạn"). */
  overdue_days: number | null
}

export type DueBoard = {
  rows: DueRow[]
  /** Mặc định công ty đang đặt. `null` = chưa khai — đây là ô cần bấm trước. */
  company_default: Term | null
  today: string
  stats: {
    total: number
    /** Khoản CHƯA có hạn — mẫu số của cả màn. */
    no_term: number
    overdue: number
    due_7d: number
    by_source: Record<TermSource, number>
  }
  /** Tổng tiền theo tiền tệ × tình trạng hạn. KHÔNG cộng chéo tiền tệ. */
  totals: { currency: string; overdue: number; due_7d: number; later: number; no_term: number }[] // prettier-ignore
}

const r2 = (n: number) => Math.round(n * 100) / 100

export const paymentTermsService = {
  async dueBoard(user: User): Promise<DueBoard> {
    await assertAction(user, 'accounting.payable.view')
    const today = new Date().toISOString().slice(0, 10)

    const [receipts, setting, poRaw, supRaw] = await Promise.all([
      payablesRepo.receiptValues(),
      db().from('settings').select('value').eq('key', SETTING_KEY).maybeSingle(),
      db()
        .from('supply_purchase_orders')
        .select('id, code, currency, supplier_id, terms_payment, status')
        .limit(1000),
      db().from('supply_suppliers').select('id, name, short_name, payment_net_days').limit(1000), // prettier-ignore
    ])
    const companyDefault = parseTermSetting(
      (setting.data as { value: unknown } | null)?.value,
    )

    type P = { id: string; code: string; currency: string; supplier_id: string; terms_payment: string | null; status: string } // prettier-ignore
    type S = { id: string; name: string; short_name: string | null; payment_net_days: number | null } // prettier-ignore
    const pos = new Map(((poRaw.data ?? []) as P[]).map((p) => [p.id, p]))
    const sups = new Map(((supRaw.data ?? []) as S[]).map((s) => [s.id, s]))

    /*
     * Gộp giá trị đã nhận theo ĐƠN, và lấy ngày nhận GẦN NHẤT làm gốc tính hạn.
     * Lấy ngày nhận ĐẦU tiên thì đơn giao nhiều đợt bị tính quá hạn oan cho phần
     * vừa về; lấy gần nhất là cách NCC thực sự tính (mỗi đợt một hạn, mà ở đây
     * mình gộp đơn nên lấy mốc muộn nhất cho an toàn).
     */
    const agg = new Map<string, { amount: number; last: string | null }>()
    for (const m of receipts) {
      const cur = agg.get(m.po_id) ?? { amount: 0, last: null }
      cur.amount += (m.direction === 'out' ? -1 : 1) * m.qty * m.unit_cost
      const at = m.doc_date ?? m.created_at.slice(0, 10)
      if (!cur.last || at > cur.last) cur.last = at
      agg.set(m.po_id, cur)
    }

    const rows: DueRow[] = []
    for (const [poId, a] of agg) {
      const po = pos.get(poId)
      if (!po || r2(a.amount) === 0) continue
      const sup = sups.get(po.supplier_id)
      const r = resolveTerm({
        poTerms: po.terms_payment,
        supplierDays: sup?.payment_net_days ?? null,
        companyDefault,
      })
      const due = a.last ? dueDate(a.last, r.term) : null
      rows.push({
        po_id: poId,
        po_code: po.code,
        supplier_id: po.supplier_id,
        supplier_name: sup?.short_name || sup?.name || '—',
        currency: po.currency || 'VND',
        amount: r2(a.amount),
        received_on: a.last,
        po_terms: po.terms_payment,
        term: r.term,
        source: r.source,
        why: r.why,
        due_on: due,
        overdue_days: overdueDays(due, today),
      })
    }

    // Quá hạn lâu nhất lên đầu; khoản chưa có hạn xếp ngay sau (phải xử, không
    // được chìm xuống đáy) rồi mới tới các khoản còn xa.
    rows.sort((a, b) => {
      const rank = (x: DueRow) => (x.overdue_days == null ? -1 : 0)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return (b.overdue_days ?? 0) - (a.overdue_days ?? 0)
    })

    const by_source: Record<TermSource, number> = { don: 0, ncc: 0, mac_dinh: 0, khong_co: 0 } // prettier-ignore
    const totals = new Map<string, { overdue: number; due_7d: number; later: number; no_term: number }>() // prettier-ignore
    for (const r of rows) {
      by_source[r.source] += 1
      const t = totals.get(r.currency) ?? { overdue: 0, due_7d: 0, later: 0, no_term: 0 }
      if (r.overdue_days == null) t.no_term += r.amount
      else if (r.overdue_days >= 0) t.overdue += r.amount
      else if (r.overdue_days >= -7) t.due_7d += r.amount
      else t.later += r.amount
      totals.set(r.currency, t)
    }

    return {
      rows,
      company_default: companyDefault,
      today,
      stats: {
        total: rows.length,
        no_term: rows.filter((r) => r.overdue_days == null).length,
        overdue: rows.filter((r) => (r.overdue_days ?? -1) >= 0).length,
        due_7d: rows.filter((r) => (r.overdue_days ?? -99) >= -7 && (r.overdue_days ?? 1) < 0).length, // prettier-ignore
        by_source,
      },
      totals: [...totals].map(([currency, v]) => ({
        currency,
        overdue: r2(v.overdue),
        due_7d: r2(v.due_7d),
        later: r2(v.later),
        no_term: r2(v.no_term),
      })),
    }
  },

  /**
   * Đặt MẶC ĐỊNH CÔNG TY — một dòng, phủ mọi khoản nợ chưa có điều khoản riêng.
   * `null` = bỏ mặc định (quay lại chỉ đọc điều khoản trên đơn).
   */
  async setCompanyDefault(user: User, term: Term | null): Promise<{ term: Term | null }> {
    await assertAction(user, 'accounting.payable.manage')
    const { error } = await db()
      .from('settings')
      .upsert({ key: SETTING_KEY, value: term ? formatTermSetting(term) : null })
    if (error) throw new Error(error.message)
    return { term }
  },

  /** Ghi ĐÈ điều khoản cho một NCC cụ thể — dùng khi đơn không nói và NCC khác mặc định. */
  async setSupplierDays(
    user: User,
    supplierId: string,
    days: number | null,
  ): Promise<void> {
    await assertAction(user, 'accounting.payable.manage')
    const { error } = await db()
      .from('supply_suppliers')
      .update({ payment_net_days: days })
      .eq('id', supplierId)
    if (error) throw new Error(error.message)
  },
}
