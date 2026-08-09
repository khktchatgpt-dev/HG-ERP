import { db } from '@/server/db'
import { poLineAmount, type PoLineAmountInput } from '@/lib/po-line'
import type { PoTemplate } from '@/lib/po-template'
import type { PoStatus } from './pos.schema'

export type Po = {
  id: string
  code: string
  /** LSX của đơn; null = PO ngoài LSX (tiêu hao/dùng chung — 0076). */
  production_order_id: string | null
  supplier_id: string
  status: PoStatus
  /** Mẫu đơn theo loại hàng (0106) — cột nhập, công thức tiền, mẫu phiếu in. */
  template: PoTemplate
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  discount_amount: number | null
  contract_no: string | null
  expected_at: string | null
  terms: string | null
  terms_quality: string | null
  terms_delivery_place: string | null
  terms_payment: string | null
  terms_invoice: string | null
  terms_lead_time: string | null
  signer_role: string | null
  approved_by: string | null
  approved_at: string | null
  ordered_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PoWithRefs = Po & {
  supplier_name: string
  /** null = PO ngoài LSX. */
  lsx_code: string | null
  order_code: string | null
}

/** Ô nhập riêng của từng mẫu đơn (0106) — mẫu nào dùng ô nấy, còn lại null. */
export type PoLineTemplateFields = {
  material_grade: string | null
  dm_per_sp: number | null
  qty_demand: number | null
  qty_on_hand: number | null
  die_code: string | null
  weight_per_m: number | null
  bar_length_m: number | null
  dimension_text: string | null
  finish: string | null
  weight_per_unit: number | null
  open_style: string | null
  pcs_per_ctn: number | null
  inner_l_mm: number | null
  inner_w_mm: number | null
  inner_h_mm: number | null
  area_m2: number | null
  price_per_m2: number | null
  carton_basis: 'ctn' | 'm2' | null
}

export type PoLine = PoLineTemplateFields & {
  id: string
  po_id: string
  material_id: string
  qty_ordered: number
  unit_price: number | null
  price_basis: 'unit' | 'unit2'
  spec: string | null
  qty2: number | null
  unit2: string | null
  note: string | null
  sort_order: number
  material_code: string
  material_name: string
  material_unit: string
}

export type PoLineInput = Partial<PoLineTemplateFields> & {
  material_id: string
  qty_ordered: number
  unit_price?: number | null
  /** Service tự dẫn xuất từ mẫu đơn (`deriveLine`) — client không gửi. */
  price_basis?: 'unit' | 'unit2'
  spec?: string | null
  qty2?: number | null
  unit2?: string | null
  note?: string | null
}

const TEMPLATE_LINE_COLS = [
  'material_grade',
  'dm_per_sp',
  'qty_demand',
  'qty_on_hand',
  'die_code',
  'weight_per_m',
  'bar_length_m',
  'dimension_text',
  'finish',
  'weight_per_unit',
  'open_style',
  'pcs_per_ctn',
  'inner_l_mm',
  'inner_w_mm',
  'inner_h_mm',
  'area_m2',
  'price_per_m2',
  'carton_basis',
] as const

const COLS =
  'id, code, production_order_id, supplier_id, status, template, currency, vat_rate, price_includes_vat, discount_amount, contract_no, expected_at, terms, terms_quality, terms_delivery_place, terms_payment, terms_invoice, terms_lead_time, signer_role, approved_by, approved_at, ordered_at, note, created_by, created_at, updated_at'

/** Cột `numeric` của dòng — PostgREST trả về CHUỖI ("0.2480"), ép lại về number. */
const NUMERIC_LINE_COLS = [
  'dm_per_sp',
  'qty_demand',
  'qty_on_hand',
  'weight_per_m',
  'bar_length_m',
  'weight_per_unit',
  'pcs_per_ctn',
  'inner_l_mm',
  'inner_w_mm',
  'inner_h_mm',
  'area_m2',
  'price_per_m2',
] as const

function numericLineFields(row: Record<string, unknown>): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const k of NUMERIC_LINE_COLS) {
    const v = row[k]
    out[k] = v == null ? null : Number(v)
  }
  return out
}

type Raw = Po & {
  supplier: { name: string } | { name: string }[] | null
  lsx:
    | { code: string; order: { code: string } | { code: string }[] | null }
    | { code: string; order: { code: string } | { code: string }[] | null }[]
    | null
}

function unwrap(rows: Raw[] | null): PoWithRefs[] {
  return (rows ?? []).map((r) => {
    const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
    const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
    const ord = lx ? (Array.isArray(lx.order) ? lx.order[0] : lx.order) : null
    return {
      ...r,
      supplier_name: sp?.name ?? '?',
      // production_order_id null (PO ngoài LSX) → join rỗng → lsx_code null.
      lsx_code: lx?.code ?? null,
      order_code: ord?.code ?? null,
    }
  })
}

/*
 * Embed LSX phải CHỈ ĐÍCH DANH FK: từ 0125 có bảng nối supply_po_extra_lsx nên
 * giữa đơn đặt và production_orders tồn tại HAI đường quan hệ (FK trực tiếp +
 * many-to-many qua bảng nối) — để PostgREST tự đoán là nó báo mơ hồ và TRẢ RỖNG,
 * cả danh sách đơn biến mất (bug thật 09/08/2026, "tạo đơn xong không thấy đâu").
 */
const SELECT = `${COLS}, supplier:supply_suppliers(name), lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code, order:sales_orders(code))`

/** Vật tư đã mua từ 1 NCC (gộp) — cho tab phân tích mua ở chi tiết NCC. */
export type PurchasedMaterial = {
  material_id: string
  material_code: string
  material_name: string
  material_unit: string
  total_qty: number
  order_lines: number
  last_price: number | null
  /** Đơn vị của last_price: null = theo ĐVT mua; 'kg'/'m²' = giá theo đv2 (0053). */
  last_price_unit: string | null
  last_currency: string
  last_at: string
}

export const posRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'PO' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async list(filter: {
    q?: string
    status?: PoStatus
    supplier_id?: string
    production_order_id?: string
    scope?: 'lsx' | 'standalone'
    page: number
    page_size: number
  }): Promise<{ rows: PoWithRefs[]; total: number }> {
    let q = db()
      .from('supply_purchase_orders')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.supplier_id) q = q.eq('supplier_id', filter.supplier_id)
    if (filter.production_order_id) {
      /*
       * Lọc theo LSX phải thấy CẢ đơn gộp (0125): đơn "LSX 2+3" có LSX chính là
       * 2, nhưng người xem LSX 3 vẫn phải thấy nó — tra bảng LSX phụ trước rồi
       * OR với cột chính.
       */
      const { data: ex } = await db()
        .from('supply_po_extra_lsx')
        .select('po_id')
        .eq('production_order_id', filter.production_order_id)
      const extraPoIds = ((ex ?? []) as { po_id: string }[]).map((r) => r.po_id)
      q = extraPoIds.length
        ? q.or(
            `production_order_id.eq.${filter.production_order_id},id.in.(${extraPoIds.join(',')})`,
          )
        : q.eq('production_order_id', filter.production_order_id)
    }
    if (filter.scope === 'lsx') q = q.not('production_order_id', 'is', null)
    if (filter.scope === 'standalone') q = q.is('production_order_id', null)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrap(data as Raw[] | null), total: count ?? 0 }
  },

  /**
   * Tổng tiền theo từng PO cho danh sách — 1 truy vấn gộp cho cả trang thay vì
   * N+1. Trả map po_id → tổng. Tiền dòng theo poLineAmount (giá đv kép 0053).
   */
  async totalsByPoIds(ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {}
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select('po_id, qty_ordered, unit_price, price_basis, qty2')
      .in('po_id', ids)
    const totals: Record<string, number> = {}
    for (const r of (data ?? []) as ({ po_id: string } & PoLineAmountInput)[]) {
      totals[r.po_id] = (totals[r.po_id] ?? 0) + poLineAmount(r)
    }
    return totals
  },

  /**
   * Vật tư đã mua từ 1 NCC — gộp theo vật tư: tổng SL đã đặt + GIÁ MUA GẦN NHẤT.
   * Loại đơn đã huỷ. Dùng cho tab "Vật tư đã mua" ở chi tiết NCC (phân tích mua).
   */
  async materialsPurchasedBySupplier(supplierId: string): Promise<PurchasedMaterial[]> {
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'material_id, qty_ordered, unit_price, price_basis, unit2, po:supply_purchase_orders!inner(supplier_id, currency, created_at, status), material:warehouse_materials(code, name, unit)',
      )
      .eq('po.supplier_id', supplierId)
      .order('created_at', { referencedTable: 'po', ascending: false })
      .limit(2000)
    type P = { supplier_id: string; currency: string; created_at: string; status: string }
    type M = { code: string; name: string; unit: string }
    type Raw = {
      material_id: string
      qty_ordered: number
      unit_price: number | null
      price_basis: 'unit' | 'unit2' | null
      unit2: string | null
      po: P | P[] | null
      material: M | M[] | null
    }
    const agg = new Map<string, PurchasedMaterial>()
    for (const r of (data ?? []) as Raw[]) {
      const po = Array.isArray(r.po) ? r.po[0] : r.po
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      if (!po || po.status === 'cancelled') continue
      const cur = agg.get(r.material_id)
      if (!cur) {
        // Lần đầu gặp = dòng của PO mới nhất (đã order desc theo po.created_at).
        agg.set(r.material_id, {
          material_id: r.material_id,
          material_code: m?.code ?? '?',
          material_name: m?.name ?? '?',
          material_unit: m?.unit ?? '',
          total_qty: Number(r.qty_ordered) || 0,
          order_lines: 1,
          last_price: r.unit_price,
          // Giá theo đv2 (đ/kg) và giá theo ĐVT mua không so trực tiếp được —
          // lưu kèm đơn vị để UI hiển thị "18.500/kg" thay vì con số trần.
          last_price_unit: r.price_basis === 'unit2' ? r.unit2 : null,
          last_currency: po.currency,
          last_at: po.created_at,
        })
      } else {
        cur.total_qty += Number(r.qty_ordered) || 0
        cur.order_lines += 1
      }
    }
    return [...agg.values()]
  },

  async findById(id: string): Promise<PoWithRefs | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as Raw])[0]
  },

  /** LSX PHỤ gộp vào đơn (0125) — kèm mã để hiện lên chi tiết + phiếu in. */
  async listExtraLsx(poId: string): Promise<{ id: string; code: string }[]> {
    const { data } = await db()
      .from('supply_po_extra_lsx')
      .select('production_order_id, lsx:production_orders(code)')
      .eq('po_id', poId)
    type Row = {
      production_order_id: string
      lsx: { code: string } | { code: string }[] | null
    }
    return ((data ?? []) as Row[]).map((r) => {
      const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
      return { id: r.production_order_id, code: lx?.code ?? '?' }
    })
  },

  /** Ghi lại bộ LSX phụ của đơn — xoá sạch rồi chèn, như replaceLines. */
  async replaceExtraLsx(poId: string, lsxIds: string[]): Promise<void> {
    const { error } = await db().from('supply_po_extra_lsx').delete().eq('po_id', poId)
    if (error) throw new Error(error.message)
    if (lsxIds.length === 0) return
    const { error: e2 } = await db()
      .from('supply_po_extra_lsx')
      .insert(lsxIds.map((id) => ({ po_id: poId, production_order_id: id })))
    if (e2) throw new Error(e2.message)
  },

  async listLines(poId: string): Promise<PoLine[]> {
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        // Chuỗi PHẢI là literal — supabase-js suy type cột từ chính chuỗi này,
        // ghép bằng template literal thì nó trả ParserError. Giữ đồng bộ với
        // TEMPLATE_LINE_COLS ở trên (dùng cho INSERT).
        'id, po_id, material_id, qty_ordered, unit_price, price_basis, spec, qty2, unit2, note, sort_order, material_grade, dm_per_sp, qty_demand, qty_on_hand, die_code, weight_per_m, bar_length_m, dimension_text, finish, weight_per_unit, open_style, pcs_per_ctn, inner_l_mm, inner_w_mm, inner_h_mm, area_m2, price_per_m2, carton_basis, material:warehouse_materials(code, name, unit)',
      )
      .eq('po_id', poId)
      .order('sort_order')
    type P = { code: string; name: string; unit: string }
    type RawLine = Omit<PoLine, 'material_code' | 'material_name' | 'material_unit'> & {
      material: P | P[] | null
    }
    return ((data ?? []) as RawLine[]).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      return {
        ...r,
        ...numericLineFields(r as unknown as Record<string, unknown>),
        material: undefined,
        material_code: m?.code ?? '?',
        material_name: m?.name ?? '?',
        material_unit: m?.unit ?? '',
      } as PoLine
    })
  },

  async insert(
    row: {
      code: string
      production_order_id: string | null
      supplier_id: string
      /** Bỏ trống = default DB ('pending_approval'); luồng 0116 tạo 'draft'. */
      status?: PoStatus
      template: PoTemplate
      currency: string
      vat_rate?: number | null
      price_includes_vat: boolean
      discount_amount?: number | null
      contract_no?: string | null
      expected_at?: string | null
      terms?: string | null
      terms_quality?: string | null
      terms_delivery_place?: string | null
      terms_payment?: string | null
      terms_invoice?: string | null
      terms_lead_time?: string | null
      signer_role?: string | null
      note?: string | null
      created_by: string
    },
    lines: PoLineInput[],
  ): Promise<Po> {
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert PO failed')
    const po = data as Po
    await this.replaceLines(po.id, lines)
    return po
  },

  async replaceLines(poId: string, lines: PoLineInput[]): Promise<void> {
    const { error: delErr } = await db()
      .from('supply_purchase_order_lines')
      .delete()
      .eq('po_id', poId)
    if (delErr) throw new Error(delErr.message)
    if (lines.length === 0) return
    const { error } = await db()
      .from('supply_purchase_order_lines')
      .insert(
        lines.map((l, i) => {
          // Ô của mẫu khác để trống — trải cả bộ rồi ghi null cho ô không dùng,
          // để sửa đơn từ mẫu này sang mẫu khác không sót số cũ của mẫu trước.
          const tpl: Record<string, unknown> = {}
          for (const k of TEMPLATE_LINE_COLS) tpl[k] = l[k] ?? null
          return {
            po_id: poId,
            material_id: l.material_id,
            qty_ordered: l.qty_ordered,
            unit_price: l.unit_price ?? null,
            price_basis: l.price_basis ?? 'unit',
            spec: l.spec ?? null,
            qty2: l.qty2 ?? null,
            unit2: l.unit2 ?? null,
            note: l.note ?? null,
            sort_order: i,
            ...tpl,
          }
        }),
      )
    if (error) throw new Error(error.message)
  },

  async patch(id: string, patch: Partial<Po>): Promise<Po> {
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update PO failed')
    return data as Po
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('supply_purchase_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
