import { db } from '@/server/db'
import { CARRIER_TYPE, costPayeeRole, type PoCostKind } from '@/lib/po-cost'
import type { PoLineAmountInput } from '@/lib/po-line'

/**
 * PHIẾU CHI PHÍ MUA HÀNG (0211). Ghi đi qua hàm DB `supply_po_cost_create`
 * (phiếu + phân bổ trong một giao dịch); repo đọc sổ và đóng dấu huỷ.
 */
export type PoCost = {
  id: string
  payee_supplier_id: string
  payee_name: string | null
  kind: PoCostKind
  cost_date: string
  doc_no: string | null
  currency: string
  amount: number
  vat_rate: number | null
  vat_amount: number
  total: number
  note: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  voided_at: string | null
  voided_by: string | null
  voided_by_name: string | null
  void_reason: string | null
  /** Mọi đơn của phiếu — kể cả đơn khác đơn đang xem (một chuyến xe nhiều đơn). */
  allocations: { po_id: string; po_code: string | null; base: number; amount: number }[]
}

/** Lỗi nghiệp vụ hàm DB ném ra (tiền phân bổ lệch, đơn không nhận phí) — service dịch sang 400. */
export class PoCostDbError extends Error {}

const SELECT =
  '*, payee:supply_suppliers!supply_po_costs_payee_supplier_id_fkey(name, short_name), ' +
  'creator:users!supply_po_costs_created_by_fkey(name, email), ' +
  'voider:users!supply_po_costs_voided_by_fkey(name, email), ' +
  'allocations:supply_po_cost_allocations(po_id, base, amount, po:supply_purchase_orders(code))'

type U = { name: string | null; email: string } | null
type Raw = Record<string, unknown> & {
  payee: { name: string; short_name: string | null } | null
  creator: U
  voider: U
  allocations: {
    po_id: string
    base: unknown
    amount: unknown
    po: { code: string } | null
  }[]
}

function toCost({ payee, creator, voider, allocations, ...r }: Raw): PoCost {
  return {
    ...(r as unknown as PoCost),
    payee_name: payee?.short_name || payee?.name || null,
    amount: Number(r.amount ?? 0),
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    vat_amount: Number(r.vat_amount ?? 0),
    total: Number(r.total ?? 0),
    created_by_name: creator?.name ?? creator?.email ?? null,
    voided_by_name: voider?.name ?? voider?.email ?? null,
    allocations: (allocations ?? [])
      .map((a) => ({
        po_id: a.po_id,
        po_code: a.po?.code ?? null,
        base: Number(a.base ?? 0),
        amount: Number(a.amount ?? 0),
      }))
      .sort((a, b) => (a.po_code ?? '').localeCompare(b.po_code ?? '')),
  }
}

/** Một đơn kèm đủ số để tính TIỀN HÀNG (gốc chia phí) và gợi ý cùng chuyến. */
export type PoForCost = {
  id: string
  code: string
  status: string
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  discount_amount: number | null
  supplier_id: string
  supplier_name: string | null
  /** Nơi giao ghi trên đơn — điều khoản in phiếu, lùi về cột cũ. */
  place: string | null
  lines: PoLineAmountInput[]
}

const PO_COLS =
  'id, code, status, currency, vat_rate, price_includes_vat, discount_amount, supplier_id, terms_delivery_place, delivery_place, supplier:supply_suppliers!supply_purchase_orders_supplier_id_fkey(name, short_name)'

type RawPo = {
  id: string
  code: string
  status: string
  currency: string
  vat_rate: unknown
  price_includes_vat: boolean | null
  discount_amount: unknown
  supplier_id: string
  terms_delivery_place: string | null
  delivery_place: string | null
  supplier: { name: string; short_name: string | null } | null
}

async function withLines(rows: RawPo[]): Promise<PoForCost[]> {
  if (rows.length === 0) return []
  const { data, error } = await db()
    .from('supply_purchase_order_lines')
    .select('po_id, qty_ordered, unit_price, price_basis, qty2')
    .in(
      'po_id',
      rows.map((r) => r.id),
    )
  if (error) throw new Error(error.message)
  const by = new Map<string, PoLineAmountInput[]>()
  for (const l of (data ?? []) as {
    po_id: string
    qty_ordered: unknown
    unit_price: unknown
    price_basis: string | null
    qty2: unknown
  }[]) {
    const arr = by.get(l.po_id) ?? []
    arr.push({
      qty_ordered: Number(l.qty_ordered ?? 0),
      unit_price: l.unit_price == null ? null : Number(l.unit_price),
      price_basis: l.price_basis === 'unit2' ? 'unit2' : 'unit',
      qty2: l.qty2 == null ? null : Number(l.qty2),
    })
    by.set(l.po_id, arr)
  }
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    status: r.status,
    currency: r.currency,
    vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
    price_includes_vat: !!r.price_includes_vat,
    discount_amount: r.discount_amount == null ? null : Number(r.discount_amount),
    supplier_id: r.supplier_id,
    supplier_name: r.supplier?.short_name || r.supplier?.name || null,
    place: r.terms_delivery_place?.trim() || r.delivery_place?.trim() || null,
    lines: by.get(r.id) ?? [],
  }))
}

/**
 * Phiếu phí nhìn từ phía KẾ TOÁN (bước 3, 26/09/2026): mỗi phiếu còn hiệu lực
 * kèm vai người nhận tiền (`carrier` vào sổ 331 thẳng / `po_supplier` chờ hoá
 * đơn NCC) và từng phần chia kèm NCC của đơn đó.
 */
export type AccountingCost = {
  id: string
  payee_supplier_id: string
  payee_name: string
  role: 'carrier' | 'po_supplier'
  kind: PoCostKind
  cost_date: string
  doc_no: string | null
  currency: string
  amount: number
  vat_rate: number | null
  vat_amount: number
  total: number
  note: string | null
  /** Chỉ khác `null` khi gọi `forAccounting({ includeVoided: true })`. */
  voided_at: string | null
  void_reason: string | null
  allocations: {
    id: string
    po_id: string
    po_code: string
    po_supplier_id: string
    amount: number
  }[]
}

export const poCostsRepo = {
  /**
   * Phiếu CÒN HIỆU LỰC — nguồn phí cho dải Ngoài sổ, màn công nợ (ảnh chụp hiện
   * tại). `includeVoided`: lấy cả phiếu đã huỷ, CHỈ cho sổ 331 theo kỳ — sổ
   * cần phiếu gốc ở kỳ cũ + dòng đảo ở kỳ huỷ, không được để phiếu biến mất.
   */
  async forAccounting(opts: { includeVoided?: boolean } = {}): Promise<AccountingCost[]> {
    let q = db()
      .from('supply_po_costs')
      .select(
        'id, payee_supplier_id, kind, cost_date, doc_no, currency, amount, vat_rate, vat_amount, total, note, voided_at, void_reason, ' +
          'payee:supply_suppliers!supply_po_costs_payee_supplier_id_fkey(name, short_name), ' +
          'allocations:supply_po_cost_allocations(id, po_id, amount, po:supply_purchase_orders(code, supplier_id))',
      )
      .limit(10000)
    if (!opts.includeVoided) q = q.is('voided_at', null)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    type Raw = {
      id: string
      payee_supplier_id: string
      kind: PoCostKind
      cost_date: string
      doc_no: string | null
      currency: string
      amount: unknown
      vat_rate: unknown
      vat_amount: unknown
      total: unknown
      note: string | null
      voided_at: string | null
      void_reason: string | null
      payee: { name: string; short_name: string | null } | null
      allocations: { id: string; po_id: string; amount: unknown; po: { code: string; supplier_id: string } | null }[] // prettier-ignore
    }
    return ((data ?? []) as unknown as Raw[]).map((r) => {
      const allocations = (r.allocations ?? []).map((a) => ({
        id: a.id,
        po_id: a.po_id,
        po_code: a.po?.code ?? '?',
        po_supplier_id: a.po?.supplier_id ?? '',
        amount: Number(a.amount ?? 0),
      }))
      return {
        id: r.id,
        payee_supplier_id: r.payee_supplier_id,
        payee_name: r.payee?.short_name || r.payee?.name || '—',
        role: costPayeeRole(
          r.payee_supplier_id,
          allocations.map((a) => a.po_supplier_id),
        ),
        kind: r.kind,
        cost_date: r.cost_date,
        doc_no: r.doc_no,
        currency: r.currency,
        amount: Number(r.amount ?? 0),
        vat_rate: r.vat_rate == null ? null : Number(r.vat_rate),
        vat_amount: Number(r.vat_amount ?? 0),
        total: Number(r.total ?? 0),
        note: r.note,
        voided_at: r.voided_at,
        void_reason: r.void_reason,
        allocations,
      }
    })
  },

  /**
   * Phần phí đã nằm trên dòng hoá đơn NCC. `postedOnly`: chỉ tính hoá đơn ĐÃ
   * VÀO SỔ (dải Ngoài sổ); bỏ trống: mọi tờ chưa huỷ (để khỏi mồi lại lần hai).
   */
  async invoicedAllocations(postedOnly: boolean): Promise<Set<string>> {
    const { data, error } = await db()
      .from('accounting_supplier_invoice_lines')
      .select('po_cost_allocation_id, invoice:accounting_supplier_invoices(status)')
      .not('po_cost_allocation_id', 'is', null)
    if (error) throw new Error(error.message)
    type R = { po_cost_allocation_id: string; invoice: { status: string } | null }
    return new Set(
      ((data ?? []) as unknown as R[])
        .filter((r) =>
          postedOnly ? r.invoice?.status === 'posted' : r.invoice?.status !== 'cancelled',
        )
        .map((r) => r.po_cost_allocation_id),
    )
  },

  /** Các đơn theo id, kèm dòng để tính tiền hàng. */
  async posForCost(ids: string[]): Promise<PoForCost[]> {
    if (ids.length === 0) return []
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .select(PO_COLS)
      .in('id', ids)
    if (error) throw new Error(error.message)
    return withLines((data ?? []) as unknown as RawPo[])
  },

  /**
   * Đơn NHẬN PHÍ ĐƯỢC (đã duyệt → về đủ) — nguồn của gợi ý cùng chuyến và ô
   * tìm đơn. `q` lọc theo mã đơn; lọc theo tên NCC làm ở service (tên nằm ở
   * bảng khác). Vài chục đơn, không cần phân trang.
   */
  async eligiblePos(statuses: readonly string[], q?: string): Promise<PoForCost[]> {
    let query = db()
      .from('supply_purchase_orders')
      .select(PO_COLS)
      .in('status', [...statuses])
    if (q) query = query.ilike('code', `%${q.replace(/[%_]/g, '')}%`)
    const { data, error } = await query.order('code', { ascending: false }).limit(200)
    if (error) throw new Error(error.message)
    return withLines((data ?? []) as unknown as RawPo[])
  },

  /** Ngày nhập kho gần nhất của từng đơn (phiếu nhập — hướng 'in'). */
  async lastReceivedOn(poIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (poIds.length === 0) return out
    const { data: lines, error: e1 } = await db()
      .from('supply_purchase_order_lines')
      .select('id, po_id')
      .in('po_id', poIds)
    if (e1) throw new Error(e1.message)
    const poOf = new Map(
      ((lines ?? []) as { id: string; po_id: string }[]).map((l) => [l.id, l.po_id]),
    )
    if (poOf.size === 0) return out
    const { data, error } = await db()
      .from('warehouse_movements')
      .select('po_line_id, created_at')
      .eq('direction', 'in')
      .in('po_line_id', [...poOf.keys()])
    if (error) throw new Error(error.message)
    for (const m of (data ?? []) as { po_line_id: string | null; created_at: string }[]) {
      const po = m.po_line_id ? poOf.get(m.po_line_id) : undefined
      if (!po) continue
      const d = m.created_at.slice(0, 10)
      if (!out.has(po) || out.get(po)! < d) out.set(po, d)
    }
    return out
  },

  /** Nhà xe / đơn vị vận chuyển trong danh mục NCC (loại "Vận chuyển"). */
  async carriers(): Promise<{ id: string; name: string; phone: string | null }[]> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .select('id, name, short_name, phone')
      .eq('type', CARRIER_TYPE)
      .eq('is_active', true)
      .order('name')
    if (error) throw new Error(error.message)
    return (
      (data ?? []) as {
        id: string
        name: string
        short_name: string | null
        phone: string | null
      }[]
    ).map((r) => ({ id: r.id, name: r.short_name || r.name, phone: r.phone }))
  },

  /** Mã NCC đang dùng — để cấp mã cho nhà xe mới theo đúng nếp của danh mục. */
  async supplierCodes(): Promise<string[]> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .select('code')
      .not('code', 'is', null)
    if (error) throw new Error(error.message)
    return ((data ?? []) as { code: string | null }[]).map((r) => r.code!).filter(Boolean)
  },

  async insertCarrier(row: {
    name: string
    phone: string | null
    code: string | null
    userId: string
  }): Promise<{ id: string; name: string; phone: string | null }> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .insert({
        name: row.name,
        phone: row.phone,
        code: row.code,
        type: CARRIER_TYPE,
        status: 'active',
        is_active: true,
        // Nhà xe KHÔNG phải nơi đặt hàng — không hiện ở ô chọn NCC khi soạn đơn.
        can_order: false,
        created_by: row.userId,
        updated_by: row.userId,
      })
      .select('id, name, phone')
      .single()
    if (error) throw new Error(error.message)
    return data as { id: string; name: string; phone: string | null }
  },

  async findById(id: string): Promise<PoCost | null> {
    const { data, error } = await db()
      .from('supply_po_costs')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toCost(data as unknown as Raw) : null
  },

  /** Phiếu có gắn đơn này — mới trước, gồm cả phiếu đã huỷ (để thấy vết). */
  async listByPo(poId: string): Promise<PoCost[]> {
    const { data: ids, error: e1 } = await db()
      .from('supply_po_cost_allocations')
      .select('cost_id')
      .eq('po_id', poId)
    if (e1) throw new Error(e1.message)
    const costIds = [
      ...new Set(((ids ?? []) as { cost_id: string }[]).map((r) => r.cost_id)),
    ]
    if (costIds.length === 0) return []
    const { data, error } = await db()
      .from('supply_po_costs')
      .select(SELECT)
      .in('id', costIds)
      .order('cost_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Raw[]).map(toCost)
  },

  async create(args: {
    actorId: string
    cost: Record<string, unknown>
    allocations: { po_id: string; base: number; amount: number }[]
  }): Promise<string> {
    const { data, error } = await db().rpc('supply_po_cost_create', {
      p_actor: args.actorId,
      p_cost: args.cost,
      p_allocs: args.allocations,
    } as never)
    if (error) {
      const m = error.message ?? ''
      if (m.startsWith('PO_COST:'))
        throw new PoCostDbError(m.slice('PO_COST:'.length).trim())
      throw new Error(m)
    }
    return String(data)
  },

  /** Đóng dấu huỷ — chỉ phiếu chưa huỷ; false nếu không có gì để huỷ. */
  /**
   * Hoá đơn NCC (chưa huỷ) đang mang phí của phiếu này — số hoá đơn. Có thì
   * không huỷ phiếu được: huỷ xong, dòng phí trên hoá đơn trỏ vào một phiếu đã
   * chết và nợ NCC vẫn gồm khoản phí đó.
   */
  async invoicesCarrying(costId: string): Promise<string[]> {
    const { data: al, error: e1 } = await db()
      .from('supply_po_cost_allocations')
      .select('id')
      .eq('cost_id', costId)
    if (e1) throw new Error(e1.message)
    const ids = ((al ?? []) as { id: string }[]).map((a) => a.id)
    if (ids.length === 0) return []
    const { data, error } = await db()
      .from('accounting_supplier_invoice_lines')
      .select('invoice:accounting_supplier_invoices(invoice_no, status)')
      .in('po_cost_allocation_id', ids)
    if (error) throw new Error(error.message)
    type R = { invoice: { invoice_no: string; status: string } | null }
    return [
      ...new Set(
        ((data ?? []) as unknown as R[])
          .filter((r) => r.invoice && r.invoice.status !== 'cancelled')
          .map((r) => r.invoice!.invoice_no),
      ),
    ]
  },

  async void(id: string, userId: string, reason: string): Promise<boolean> {
    const { data, error } = await db()
      .from('supply_po_costs')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: userId,
        void_reason: reason,
      })
      .eq('id', id)
      .is('voided_at', null)
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },
}
