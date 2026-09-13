import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import {
  matchSummary,
  threeWayMatch,
  unlinkedInvoiceAmount,
  type MatchInvoiceLine,
  type MatchMovement,
  type MatchPoLine,
  type MatchRow,
} from '@/lib/three-way-match'
import {
  dueDateFrom,
  suggestInvoiceLines,
  type DraftLine,
} from '@/lib/invoice-draft'
import {
  supplierInvoicesRepo,
  type LineInput,
  type SupplierInvoiceRow,
} from './supplier-invoices.repo'
import type { SupplierInvoiceStatus } from './supplier-invoices.schema'

/**
 * HOÁ ĐƠN NCC + ĐỐI CHIẾU BA CHIỀU (0188).
 *
 * Hai việc:
 *   1. Nhận tờ hoá đơn NCC vào sổ, nối từng dòng về dòng đơn mua.
 *   2. Trả lời "đặt bao nhiêu / về bao nhiêu / NCC đòi bao nhiêu — LỆCH Ở ĐÂU".
 *
 * Phép đối chiếu nằm ở `lib/three-way-match.ts` (thuần, có test). Ở đây chỉ có
 * authz, đọc ba nguồn, và luật vòng đời của tờ hoá đơn.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

/** Thành tiền dòng hoá đơn — ghi theo ĐÚNG tờ giấy, không suy từ đơn mua. */
const lineAmount = (l: LineInput) => r2(l.qty * l.unit_price)

export type SupplierInvoiceDetail = {
  invoice: SupplierInvoiceRow
  lines: Awaited<ReturnType<typeof supplierInvoicesRepo.linesOf>>
  supplier_name: string | null
  /**
   * Tổng dòng so với tổng ghi trên tờ. Lệch thì BÀY RA, không tự sửa: NCC làm
   * tròn kiểu của họ, và số phải trả là số trên giấy.
   */
  lines_total: number
  header_vs_lines_gap: number
}

export const supplierInvoicesService = {
  async list(
    user: User,
    f: {
      q?: string
      supplier_id?: string
      status?: SupplierInvoiceStatus
      overdue?: boolean
      page: number
      page_size: number
    },
  ) {
    await assertAction(user, 'accounting.supplier_invoice.view')
    const { rows, total } = await supplierInvoicesRepo.list(f)
    const names = await supplierNames(rows.map((r) => r.supplier_id))
    const today = new Date().toISOString().slice(0, 10)
    const withMeta = rows.map((r) => ({
      ...r,
      supplier_name: names.get(r.supplier_id) ?? null,
      // "Quá hạn" là PHÉP SO NGÀY, không phải trạng thái ai đó bấm — lối mòn #4
      // của tieu-chi-workflow-erp. Tính lúc đọc, không lưu cột.
      is_overdue: r.status === 'posted' && !!r.due_date && r.due_date < today,
    }))
    return {
      rows: f.overdue ? withMeta.filter((r) => r.is_overdue) : withMeta,
      total,
    }
  },

  async detail(user: User, id: string): Promise<SupplierInvoiceDetail> {
    await assertAction(user, 'accounting.supplier_invoice.view')
    const invoice = await supplierInvoicesRepo.findById(id)
    if (!invoice) throw NotFound('Hoá đơn không tồn tại')
    const lines = await supplierInvoicesRepo.linesOf(id)
    const names = await supplierNames([invoice.supplier_id])
    const lines_total = r2(lines.reduce((s, l) => s + l.amount, 0))
    return {
      invoice,
      lines,
      supplier_name: names.get(invoice.supplier_id) ?? null,
      lines_total,
      header_vs_lines_gap: r2(invoice.subtotal - lines_total),
    }
  },

  async create(
    user: User,
    input: {
      supplier_id: string
      invoice_no: string
      invoice_date: string
      due_date?: string | null
      currency: string
      subtotal: number
      vat_amount: number
      total: number
      note?: string | null
      lines: LineInput[]
    },
  ): Promise<SupplierInvoiceRow> {
    await assertAction(user, 'accounting.supplier_invoice.manage')
    await assertLinesBelongToSupplier(input.supplier_id, input.lines)
    return supplierInvoicesRepo.insert(
      {
        supplier_id: input.supplier_id,
        invoice_no: input.invoice_no,
        invoice_date: input.invoice_date,
        due_date: input.due_date ?? null,
        currency: input.currency,
        subtotal: input.subtotal,
        vat_amount: input.vat_amount,
        total: input.total,
        note: input.note ?? null,
        created_by: user.id,
        status: 'draft',
      },
      input.lines.map((l) => ({ ...l, amount: lineAmount(l) })),
    )
  },

  async update(
    user: User,
    id: string,
    input: Partial<{
      supplier_id: string
      invoice_no: string
      invoice_date: string
      due_date: string | null
      currency: string
      subtotal: number
      vat_amount: number
      total: number
      note: string | null
      lines: LineInput[]
    }>,
  ): Promise<SupplierInvoiceRow> {
    await assertAction(user, 'accounting.supplier_invoice.manage')
    const before = await supplierInvoicesRepo.findById(id)
    if (!before) throw NotFound('Hoá đơn không tồn tại')
    // Hoá đơn ĐÃ VÀO SỔ là số đang nằm trong công nợ. Sửa sau lưng thì con số
    // kế toán đã đối chiếu đổi mà không ai biết — phải mở lại có chủ ý trước.
    if (before.status === 'posted') {
      throw BadRequest('Hoá đơn đã vào sổ — bấm "Mở lại" rồi mới sửa được')
    }
    if (before.status === 'cancelled') throw BadRequest('Hoá đơn đã huỷ')
    if (input.lines) {
      await assertLinesBelongToSupplier(input.supplier_id ?? before.supplier_id, input.lines) // prettier-ignore
      await supplierInvoicesRepo.replaceLines(
        id,
        input.lines.map((l) => ({ ...l, amount: lineAmount(l) })),
      )
    }
    const { lines: _drop, ...header } = input
    return supplierInvoicesRepo.patch(id, header)
  },

  /**
   * VÀO SỔ / MỞ LẠI. Chỉ hoá đơn `posted` mới tính vào công nợ và mới lọt vào
   * đối chiếu — hoá đơn nháp là thứ ai đó đang gõ dở.
   */
  async setPosted(
    user: User,
    id: string,
    action: 'post' | 'unpost',
  ): Promise<SupplierInvoiceRow> {
    await assertAction(user, 'accounting.supplier_invoice.manage')
    const before = await supplierInvoicesRepo.findById(id)
    if (!before) throw NotFound('Hoá đơn không tồn tại')
    if (before.status === 'cancelled') throw BadRequest('Hoá đơn đã huỷ')
    if (action === 'post') {
      if (before.status === 'posted') throw BadRequest('Hoá đơn đã vào sổ rồi')
      const lines = await supplierInvoicesRepo.linesOf(id)
      if (lines.length === 0) throw BadRequest('Hoá đơn chưa có dòng nào')
      if (before.total <= 0) throw BadRequest('Tổng thanh toán phải > 0')
      return supplierInvoicesRepo.patch(id, { status: 'posted' })
    }
    if (before.status !== 'posted') throw BadRequest('Hoá đơn chưa vào sổ')
    return supplierInvoicesRepo.patch(id, { status: 'draft' })
  },

  async cancel(user: User, id: string): Promise<SupplierInvoiceRow> {
    await assertAction(user, 'accounting.supplier_invoice.manage')
    const before = await supplierInvoicesRepo.findById(id)
    if (!before) throw NotFound('Hoá đơn không tồn tại')
    if (before.status === 'cancelled') throw BadRequest('Hoá đơn đã huỷ')
    return supplierInvoicesRepo.patch(id, { status: 'cancelled' })
  },

  /**
   * ĐỐI CHIẾU BA CHIỀU CỦA MỘT ĐƠN MUA — đặt / về / NCC đòi, theo từng dòng.
   *
   * Ba nguồn, một khoá nối (`po_line_id`): dòng đơn mua · movement kho ·
   * dòng hoá đơn đã vào sổ.
   */
  async matchForPo(
    user: User,
    poId: string,
  ): Promise<{
    rows: MatchRow[]
    summary: ReturnType<typeof matchSummary>
    unlinked_amount: number
    currency: string
  }> {
    await assertAction(user, 'accounting.supplier_invoice.view')
    const po = await posRepo.findById(poId)
    if (!po) throw NotFound('Đơn mua không tồn tại')
    // Cờ "đã chốt thiếu" nằm ở view trạng thái dòng (0154), không ở bảng dòng.
    const [lines, status] = await Promise.all([
      posRepo.listLines(poId),
      supplyRepo.lineStatus(poId),
    ])
    const closedAt = new Map(status.map((s) => [s.id, s.closed_short_at]))

    const poLines: MatchPoLine[] = lines.map((l) => ({
      id: l.id,
      material_code: l.material_code || null,
      material_name: l.material_name || l.line_name || '—',
      unit: l.material_unit || l.line_unit || null,
      qty_ordered: Number(l.qty_ordered ?? 0),
      unit_price: l.unit_price == null ? null : Number(l.unit_price),
      price_basis: l.price_basis,
      qty2: l.qty2 == null ? null : Number(l.qty2),
      closed_short_at: closedAt.get(l.id) ?? null,
    }))
    const ids = poLines.map((l) => l.id)
    const [movements, invLines] = await Promise.all([
      movementsByPoLines(ids),
      supplierInvoicesRepo.invoiceLinesByPo(ids),
    ])
    const matchInvLines: MatchInvoiceLine[] = invLines.map((l) => ({
      po_line_id: l.po_line_id,
      invoice_id: l.invoice_id,
      invoice_no: l.invoice_no,
      qty: l.qty,
      unit_price: l.unit_price,
      amount: l.amount,
    }))
    const rows = threeWayMatch(poLines, movements, matchInvLines)
    return {
      rows,
      summary: matchSummary(rows),
      unlinked_amount: unlinkedInvoiceAmount(matchInvLines),
      currency: po.currency,
    }
  },

  /**
   * MỒI HOÁ ĐƠN TỪ ĐƠN MUA — "PO flip".
   *
   * Dựng trên chính `matchForPo` chứ không truy vấn lại: màn mồi và màn đối
   * chiếu phải nói CÙNG một con số, mà cách chắc chắn nhất là dùng chung một
   * phép tính. Hai đường đọc riêng thì sớm muộn lệch, và lệch ở tiền.
   *
   * Trả về GỢI Ý, không ghi gì. Luật mồi nằm ở `lib/invoice-draft.ts` (có test).
   */
  async draftForPo(
    user: User,
    poId: string,
  ): Promise<{
    po: { id: string; code: string; currency: string; supplier_id: string; supplier_name: string } // prettier-ignore
    lines: DraftLine[]
    /** Hạn thanh toán suy từ điều khoản NCC. null = NCC chưa khai `net_days`. */
    suggested_due_date: string | null
    net_days: number | null
    today: string
  }> {
    await assertAction(user, 'accounting.supplier_invoice.manage')
    const { rows, currency } = await this.matchForPo(user, poId)
    const po = await posRepo.findById(poId)
    if (!po) throw NotFound('Đơn mua không tồn tại')

    const { data: sup } = await db()
      .from('supply_suppliers')
      .select('name, short_name, payment_net_days')
      .eq('id', po.supplier_id)
      .maybeSingle()
    type S = { name: string; short_name: string | null; payment_net_days: number | null }
    const s = (sup ?? null) as S | null
    const netDays = s?.payment_net_days ?? null

    const today = new Date().toISOString().slice(0, 10)
    return {
      po: {
        id: po.id,
        code: po.code,
        currency,
        supplier_id: po.supplier_id,
        supplier_name: s?.short_name || s?.name || '—',
      },
      lines: suggestInvoiceLines(
        rows.map((r) => ({
          po_line_id: r.po_line_id,
          material_code: r.material_code,
          material_name: r.material_name,
          unit: r.unit,
          qty_ordered: r.qty_ordered,
          amount_ordered: r.amount_ordered,
          qty_received: r.qty_received,
          qty_invoiced: r.qty_invoiced,
          closed_short: r.closed_short,
        })),
      ),
      suggested_due_date: dueDateFrom(today, netDays),
      net_days: netDays,
      today,
    }
  },
}

/**
 * ĐÃ NHẬN HÀNG MÀ CHƯA CÓ HOÁ ĐƠN — khoản GR/IR.
 *
 * Kế toán sản xuất gọi đây là GR/IR (Goods Receipt / Invoice Receipt): hàng về
 * trước hoá đơn là chuyện thường ngày, và khoản đó là **nợ có thật** dù chưa có
 * tờ giấy nào. Màn công nợ hiện tính theo phiếu nhập nên đã gồm nó rồi — con số
 * này không cộng thêm vào đâu cả, nó chỉ **nói ra phần nào của công nợ đang
 * thiếu chứng từ**, để kế toán biết phải đi đòi NCC xuất hoá đơn.
 *
 * Tách theo tiền tệ, không gộp (bài học 0134 — USD/VND không cộng lẫn).
 */
export async function awaitingInvoiceSummary(): Promise<{
  by_currency: { currency: string; amount: number; line_count: number }[]
  supplier_count: number
}> {
  const { data: mvRaw } = await db()
    .from('warehouse_movements')
    .select('po_line_id, direction, qty, unit_cost')
    .not('po_line_id', 'is', null)
  type Mv = { po_line_id: string; direction: 'in' | 'out'; qty: unknown; unit_cost: unknown } // prettier-ignore
  const mvs = (mvRaw ?? []) as Mv[]
  if (mvs.length === 0) return { by_currency: [], supplier_count: 0 }

  const lineIds = [...new Set(mvs.map((m) => m.po_line_id))]
  const { data: lineRaw } = await db()
    .from('supply_purchase_order_lines')
    .select('id, po:supply_purchase_orders(supplier_id, currency)')
    .in('id', lineIds)
  type LineRaw = { id: string; po: { supplier_id: string; currency: string } | { supplier_id: string; currency: string }[] | null } // prettier-ignore
  const ctx = new Map<string, { supplier_id: string; currency: string }>()
  for (const l of (lineRaw ?? []) as unknown as LineRaw[]) {
    const po = Array.isArray(l.po) ? l.po[0] : l.po
    if (po) ctx.set(l.id, { supplier_id: po.supplier_id, currency: po.currency || 'VND' })
  }

  const invoiced = new Map<string, number>()
  for (const l of await supplierInvoicesRepo.invoiceLinesByPo(lineIds)) {
    if (!l.po_line_id) continue
    invoiced.set(l.po_line_id, (invoiced.get(l.po_line_id) ?? 0) + l.amount)
  }

  const received = new Map<string, number>()
  for (const m of mvs) {
    const sign = m.direction === 'in' ? 1 : -1
    const v = sign * Number(m.qty ?? 0) * Number(m.unit_cost ?? 0)
    received.set(m.po_line_id, r2((received.get(m.po_line_id) ?? 0) + v))
  }

  const byCcy = new Map<string, { amount: number; line_count: number }>()
  const suppliers = new Set<string>()
  for (const [lineId, recv] of received) {
    const c = ctx.get(lineId)
    if (!c) continue
    // Chỉ phần DƯƠNG: dòng đã có hoá đơn đủ (hoặc thừa) không phải khoản chờ.
    const gap = r2(recv - (invoiced.get(lineId) ?? 0))
    if (gap <= 0) continue
    const cur = byCcy.get(c.currency) ?? { amount: 0, line_count: 0 }
    cur.amount = r2(cur.amount + gap)
    cur.line_count += 1
    byCcy.set(c.currency, cur)
    suppliers.add(c.supplier_id)
  }
  return {
    by_currency: [...byCcy].map(([currency, v]) => ({ currency, ...v })),
    supplier_count: suppliers.size,
  }
}

/**
 * Dòng hoá đơn chỉ được trỏ vào đơn mua CỦA CHÍNH NCC ĐÓ.
 *
 * Không có chốt này thì một cú chọn nhầm trong ô tìm là hoá đơn của NCC A nằm
 * đè lên đơn của NCC B, và bảng đối chiếu của cả hai bên cùng sai — kiểu sai
 * rất khó phát hiện vì mỗi bên nhìn riêng đều thấy có vẻ hợp lý.
 */
async function assertLinesBelongToSupplier(
  supplierId: string,
  lines: LineInput[],
): Promise<void> {
  const ids = [...new Set(lines.map((l) => l.po_line_id).filter((x): x is string => !!x))] // prettier-ignore
  if (ids.length === 0) return
  const { data } = await db()
    .from('supply_purchase_order_lines')
    .select('id, po:supply_purchase_orders!inner(supplier_id)')
    .in('id', ids)
  type Raw = {
    id: string
    po: { supplier_id: string } | { supplier_id: string }[] | null
  }
  const rows = (data ?? []) as unknown as Raw[]
  if (rows.length !== ids.length) throw BadRequest('Có dòng đơn mua không tồn tại')
  for (const r of rows) {
    const po = Array.isArray(r.po) ? r.po[0] : r.po
    if (po?.supplier_id !== supplierId) {
      throw BadRequest('Có dòng trỏ sang đơn mua của nhà cung cấp khác')
    }
  }
}

/** Movement gắn dòng đơn — vế "VỀ". Phiếu đảo (`out`) để nguyên chiều, lõi trừ. */
async function movementsByPoLines(lineIds: string[]): Promise<MatchMovement[]> {
  if (lineIds.length === 0) return []
  const { data } = await db()
    .from('warehouse_movements')
    .select('po_line_id, direction, qty, unit_cost')
    .in('po_line_id', lineIds)
  return (data ?? []).map((m) => {
    const r = m as { po_line_id: string; direction: 'in' | 'out'; qty: unknown; unit_cost: unknown } // prettier-ignore
    return {
      po_line_id: r.po_line_id,
      direction: r.direction,
      qty: Number(r.qty ?? 0),
      unit_cost: r.unit_cost == null ? null : Number(r.unit_cost),
    }
  })
}

async function supplierNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return new Map()
  const { data } = await db().from('supply_suppliers').select('id, name').in('id', uniq)
  return new Map(((data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name])) // prettier-ignore
}
