import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { supplierInvoicesRepo } from './supplier-invoices.repo'
import { threeWayMatch, type MatchInvoiceLine, type MatchMovement, type MatchPoLine } from '@/lib/three-way-match' // prettier-ignore
import { rollupByLsx, rollupCross, totalOf, type LsxFinanceRow } from '@/lib/lsx-finance'

/**
 * TIỀN THEO LỆNH SẢN XUẤT (0188 — tầng trên của đối chiếu ba chiều).
 *
 * Đọc MỘT LƯỢT cho mọi lệnh rồi gộp trong bộ nhớ, không lặp truy vấn theo từng
 * lệnh: 15 lệnh × 3 nguồn = 45 vòng đi-về, và con số trên màn thì vẫn thế.
 */

/**
 * Một ô của bảng chéo LỆNH × NCC × TIỀN TỆ, đã gắn nhãn đọc được.
 *
 * Nợ thuộc về NCC, chi phí thuộc về LỆNH — hai trục trên cùng một giao dịch.
 * Bảng này là chỗ duy nhất đọc được CẢ HAI chiều.
 */
export type CrossScreenRow = {
  lsx_id: string
  lsx_code: string
  customer_name: string | null
  supplier_id: string
  supplier_name: string
  currency: string
  committed: number
  confirmed: number
  draft: number
  received: number
  invoiced: number
  not_received: number
  awaiting_invoice: number
  line_count: number
  issue_count: number
}

export type LsxFinanceScreenRow = LsxFinanceRow & {
  code: string
  status: string
  customer_name: string | null
  currency: string
  po_count: number
}

export const lsxFinanceService = {
  async overview(
    user: User,
    opts: { activeOnly?: boolean; currency?: string } = {},
  ): Promise<{
    rows: LsxFinanceScreenRow[]
    total: ReturnType<typeof totalOf>
    /** Tiền của đơn mua KHÔNG gắn lệnh — nằm ngoài bảng, phải nói ra. */
    unassigned: number
    currency: string
    /** Các tiền tệ ĐANG CÓ đơn mua, kèm số lệnh — để màn bày chip chọn. */
    currencies: { code: string; lsx_count: number }[]
    /**
     * Bảng chéo lệnh × NCC — GỒM MỌI TIỀN TỆ (mỗi ô mang tiền tệ riêng), không
     * lọc theo chip: người xem bảng chéo đang hỏi "lệnh này nợ những ai", câu
     * đó không đổi theo tiền tệ đang chọn ở bảng trên.
     */
    cross: CrossScreenRow[]
  }> {
    await assertAction(user, 'accounting.supplier_invoice.view')

    const { data: lsxRaw } = await db()
      .from('production_orders')
      .select('id, code, status, customer:sales_customers(name)')
      .order('code')
    type LsxRaw = { id: string; code: string; status: string; customer: { name: string } | { name: string }[] | null } // prettier-ignore
    const lsxs = ((lsxRaw ?? []) as unknown as LsxRaw[]).filter(
      (l) => !opts.activeOnly || ['approved', 'in_progress'].includes(l.status),
    )
    if (lsxs.length === 0) {
      return { rows: [], total: totalOf([]), unassigned: 0, currency: 'VND', currencies: [], cross: [] }
    }

    // Đơn ĐÃ HUỶ không còn là cam kết — tính vào là thổi phồng con số của lệnh.
    const { data: poRaw } = await db()
      .from('supply_purchase_orders')
      .select('id, production_order_id, currency, status, supplier_id')
      .not('production_order_id', 'is', null)
      .neq('status', 'cancelled')
    type PoRaw = { id: string; production_order_id: string; currency: string; status: string; supplier_id: string }
    const pos = (poRaw ?? []) as PoRaw[]
    const lsxOfPo = new Map(pos.map((p) => [p.id, p.production_order_id]))
    const ccyOfPo = new Map(pos.map((p) => [p.id, p.currency || 'VND']))
    const supOfPo = new Map(pos.map((p) => [p.id, p.supplier_id]))
    /*
     * "NCC đã xác nhận" = từ 'confirmed' trở đi. KHÔNG tính 'approved' hay
     * 'ordered': duyệt là việc bên mình, gửi đi là việc bên mình — chỉ khi NCC
     * gật đầu mới là cam kết hai chiều.
     */
    const CONFIRMED_ON = ['confirmed', 'in_transit', 'partial', 'received']
    const confirmedPos = new Set(
      pos.filter((p) => CONFIRMED_ON.includes(p.status)).map((p) => p.id),
    )
    // Đơn NHÁP vẫn TÍNH vào cam kết — chỉ tách ra để bày, không để loại trừ.
    const draftPos = new Set(
      pos.filter((p) => ['draft', 'pending_approval'].includes(p.status)).map((p) => p.id),
    )
    const poCountByLsx = new Map<string, number>()
    for (const p of pos) {
      poCountByLsx.set(p.production_order_id, (poCountByLsx.get(p.production_order_id) ?? 0) + 1) // prettier-ignore
    }

    const { data: lineRaw } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'id, po_id, qty_ordered, unit_price, price_basis, qty2, material:warehouse_materials(code, name, unit)',
      ) // prettier-ignore
      .in(
        'po_id',
        pos.map((p) => p.id),
      )
    type LineRaw = {
      id: string
      po_id: string
      qty_ordered: unknown
      unit_price: unknown
      price_basis: 'unit' | 'unit2'
      qty2: unknown
      material: { code: string; name: string; unit: string } | { code: string; name: string; unit: string }[] | null // prettier-ignore
    }
    const lines = (lineRaw ?? []) as unknown as LineRaw[]
    const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v) // prettier-ignore

    const poLines: MatchPoLine[] = lines.map((l) => {
      const m = one(l.material)
      return {
        id: l.id,
        material_code: m?.code ?? null,
        material_name: m?.name ?? '—',
        unit: m?.unit ?? null,
        qty_ordered: Number(l.qty_ordered ?? 0),
        unit_price: l.unit_price == null ? null : Number(l.unit_price),
        price_basis: l.price_basis,
        qty2: l.qty2 == null ? null : Number(l.qty2),
      }
    })
    const lineIds = poLines.map((l) => l.id)
    // Dòng đơn mua → lệnh, đi qua đơn. Dòng của đơn ngoài lệnh trả null và
    // `rollupByLsx` bỏ qua.
    const lsxOfLine = new Map(
      lines.map((l) => [l.id, lsxOfPo.get(l.po_id) ?? null] as const),
    )
    // Tiền tệ đi theo ĐƠN, không theo dòng — một đơn chỉ có một tiền tệ.
    const ccyOfLine = new Map(
      lines.map((l) => [l.id, ccyOfPo.get(l.po_id) ?? 'VND'] as const),
    )
    const confirmedLines = new Set(
      lines.filter((l) => confirmedPos.has(l.po_id)).map((l) => l.id),
    )
    const draftLines = new Set(lines.filter((l) => draftPos.has(l.po_id)).map((l) => l.id))
    const supOfLine = new Map(
      lines.map((l) => [l.id, supOfPo.get(l.po_id) ?? ''] as const),
    )

    const [movements, invLines] = await Promise.all([
      movementsOf(lineIds),
      supplierInvoicesRepo.invoiceLinesByPo(lineIds),
    ])
    const matchInv: MatchInvoiceLine[] = invLines.map((l) => ({
      po_line_id: l.po_line_id,
      invoice_id: l.invoice_id,
      invoice_no: l.invoice_no,
      qty: l.qty,
      unit_price: l.unit_price,
      amount: l.amount,
    }))

    const matchRows = threeWayMatch(poLines, movements, matchInv)
    const byLsx = rollupByLsx(matchRows, lsxOfLine, ccyOfLine, confirmedLines, draftLines)

    const supNames = await supplierNames([...new Set([...supOfPo.values()])])
    const lsxMeta = new Map(lsxs.map((l) => [l.id, l]))
    const crossRaw = rollupCross(
      matchRows,
      lsxOfLine,
      supOfLine,
      ccyOfLine,
      confirmedLines,
      draftLines,
    )
    const cross: CrossScreenRow[] = crossRaw.flatMap((c) => {
      const l = lsxMeta.get(c.lsx_id)
      if (!l) return []
      const cust = one(l.customer)
      return [{
        ...c,
        lsx_code: l.code,
        customer_name: cust?.name ?? null,
        supplier_name: supNames.get(c.supplier_id) ?? '—',
      }]
    })

    // Tiền tệ nào đang có đơn — màn bày chip theo đây, không hằng số hoá.
    const ccyCount = new Map<string, Set<string>>()
    for (const [lsxId, per] of byLsx) {
      for (const [ccy] of per) {
        const set = ccyCount.get(ccy) ?? new Set<string>()
        set.add(lsxId)
        ccyCount.set(ccy, set)
      }
    }
    const currencies = [...ccyCount]
      .map(([code, set]) => ({ code, lsx_count: set.size }))
      .sort((a, b) => b.lsx_count - a.lsx_count)
    // Mặc định là tiền tệ nhiều lệnh nhất — đừng ghim 'VND': đơn USD cũng là
    // đơn thật, và ghim cứng thì một ngày nào đó cả màn trống mà không ai hiểu.
    const ccy = opts.currency ?? currencies[0]?.code ?? 'VND'

    const rows: LsxFinanceScreenRow[] = lsxs.map((l) => {
      const m = byLsx.get(l.id)?.get(ccy)
      const cust = one(l.customer)
      return {
        lsx_id: l.id,
        code: l.code,
        status: l.status,
        customer_name: cust?.name ?? null,
        currency: ccy,
        po_count: poCountByLsx.get(l.id) ?? 0,
        committed: m?.committed ?? 0,
        confirmed: m?.confirmed ?? 0,
        draft: m?.draft ?? 0,
        received: m?.received ?? 0,
        invoiced: m?.invoiced ?? 0,
        not_received: m?.not_received ?? 0,
        awaiting_invoice: m?.awaiting_invoice ?? 0,
        line_count: m?.line_count ?? 0,
        issue_count: m?.issue_count ?? 0,
        // Chưa có nguồn giá bán cho đơn đang chạy — xem docstring của LsxFinanceRow.
        revenue: null,
      }
    })

    // Đơn mua KHÔNG gắn lệnh: không vào bảng, nhưng phải nói ra ở chân trang —
    // giấu đi thì tổng bảng không bao giờ khớp tổng tiền mua của công ty.
    const assigned = new Set(lineIds.filter((id) => lsxOfLine.get(id)))
    const unassigned = matchRows
      .filter((r) => !assigned.has(r.po_line_id) && ccyOfLine.get(r.po_line_id) === ccy)
      .reduce((s, r) => s + r.amount_ordered, 0)

    return {
      // Lệnh KHÔNG có đơn nào ở tiền tệ đang xem thì không bày — hàng toàn
      // dấu "—" chỉ làm bảng dài ra mà không nói thêm điều gì.
      rows: rows.filter((r) => r.line_count > 0).sort((a, b) => b.committed - a.committed),
      total: totalOf(rows.filter((r) => r.line_count > 0)),
      unassigned: Math.round(unassigned * 100) / 100,
      currency: ccy,
      currencies,
      cross,
    }
  },
}

async function movementsOf(lineIds: string[]): Promise<MatchMovement[]> {
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
  const uniq = ids.filter(Boolean)
  if (uniq.length === 0) return new Map()
  const { data } = await db()
    .from('supply_suppliers')
    .select('id, name, short_name')
    .in('id', uniq)
  type S = { id: string; name: string; short_name: string | null }
  return new Map(((data ?? []) as S[]).map((s) => [s.id, s.short_name || s.name]))
}
