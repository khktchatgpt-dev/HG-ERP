import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { agingTotals, buildAging, type AgingInvoice, type AgingRow } from '@/lib/ap-aging'
import { rateFor, type FxRate } from '@/lib/fx'

/**
 * BẢNG TUỔI NỢ NCC — báo cáo số một của phân hệ công nợ.
 *
 * Nguồn là **hoá đơn NCC đã vào sổ** (0188), không phải phiếu nhập kho: tuổi nợ
 * cần HẠN THANH TOÁN, mà hạn chỉ có trên tờ hoá đơn. Khoản "đã nhận hàng nhưng
 * chưa có hoá đơn" (GR/IR) nằm ngoài bảng này — nó chưa có hạn nên chưa có tuổi;
 * màn công nợ bày riêng.
 *
 * Tỷ giá: đọc `fx_rate` LƯU CỨNG trên hoá đơn. Hoá đơn cũ chưa có thì tra bảng
 * `fx_rates` theo ngày hoá đơn để *hiển thị* — nhưng không ghi ngược vào chứng
 * từ, vì chứng từ đã ghi sổ là bất biến.
 */

export type ApAgingResult = {
  rows: AgingRow[]
  totals: ReturnType<typeof agingTotals>
  /** Hoá đơn thiếu HẠN — lỗi dữ liệu cần sửa, không phải nợ an toàn. */
  missing_due: number
  /** Hoá đơn ngoại tệ KHÔNG quy đổi được vì thiếu tỷ giá. */
  missing_fx: { currency: string; count: number }[]
  today: string
}

export const apAgingService = {
  async overview(user: User): Promise<ApAgingResult> {
    await assertAction(user, 'accounting.payable.view')
    const today = new Date().toISOString().slice(0, 10)

    const { data: invRaw } = await db()
      .from('accounting_supplier_invoices')
      .select(
        'id, invoice_no, supplier_id, currency, total, due_date, invoice_date, fx_rate',
      ) // prettier-ignore
      .eq('status', 'posted')
      .limit(5000)
    type InvRaw = {
      id: string
      invoice_no: string
      supplier_id: string
      currency: string
      total: unknown
      due_date: string | null
      invoice_date: string
      fx_rate: unknown
    }
    const invs = (invRaw ?? []) as InvRaw[]
    if (invs.length === 0) {
      return { rows: [], totals: [], missing_due: 0, missing_fx: [], today }
    }

    const [names, paidByInvoice, rates] = await Promise.all([
      supplierNames(invs.map((i) => i.supplier_id)),
      paidPerInvoice(),
      fxRates(),
    ])

    const missingFx = new Map<string, number>()
    const items: AgingInvoice[] = invs.map((i) => {
      // Ưu tiên tỷ giá LƯU CỨNG; chưa có thì tra bảng theo ngày hoá đơn (chỉ để
      // hiển thị — không ghi ngược vào chứng từ đã ghi sổ).
      const stored = i.fx_rate == null ? null : Number(i.fx_rate)
      const fx = stored ?? rateFor(rates, i.currency, i.invoice_date)
      if (i.currency !== 'VND' && fx == null) {
        missingFx.set(i.currency, (missingFx.get(i.currency) ?? 0) + 1)
      }
      return {
        invoice_id: i.id,
        invoice_no: i.invoice_no,
        supplier_id: i.supplier_id,
        supplier_name: names.get(i.supplier_id) ?? '—',
        currency: i.currency || 'VND',
        total: Number(i.total ?? 0),
        paid: paidByInvoice.get(i.id) ?? 0,
        due_date: i.due_date,
        invoice_date: i.invoice_date,
        fx_rate: fx,
      }
    })

    const rows = buildAging(items, today)
    return {
      rows,
      totals: agingTotals(rows),
      missing_due: items.filter((i) => !i.due_date && i.total - i.paid > 0.004).length,
      missing_fx: [...missingFx].map(([currency, count]) => ({ currency, count })),
      today,
    }
  },
}

/**
 * Đã trả theo TỪNG hoá đơn.
 *
 * Sổ thanh toán (0167) gắn `po_id`, CHƯA gắn `invoice_id` — nên hiện chưa trừ
 * được theo hoá đơn, và mọi hoá đơn đang hiện nguyên số dư. Đây là việc của Đợt
 * B ("trả một phần trừ theo từng hoá đơn"); trả map rỗng để bảng vẫn đúng về
 * cấu trúc thay vì trừ nhầm theo NCC.
 */
async function paidPerInvoice(): Promise<Map<string, number>> {
  return new Map()
}

async function supplierNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return new Map()
  const { data } = await db()
    .from('supply_suppliers')
    .select('id, name, short_name')
    .in('id', uniq)
  type S = { id: string; name: string; short_name: string | null }
  return new Map(((data ?? []) as S[]).map((s) => [s.id, s.short_name || s.name]))
}

async function fxRates(): Promise<FxRate[]> {
  const { data } = await db()
    .from('fx_rates')
    .select('currency, rate_date, rate')
    .order('rate_date', { ascending: false })
    .limit(2000)
  type R = { currency: string; rate_date: string; rate: unknown }
  return ((data ?? []) as R[]).map((r) => ({
    currency: r.currency,
    rate_date: r.rate_date,
    rate: Number(r.rate),
  }))
}
