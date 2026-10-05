import { db } from '@/server/db'
import type { DongCungNhom, VtLine } from '@/lib/vat-tu-ho-so'

/**
 * Dữ liệu cho HỒ SƠ VẬT TƯ (`/mua-hang/vat-tu/[id]`) — đọc thẳng từ dòng đơn
 * mua, không có bảng riêng. Xem `lib/vat-tu-ho-so.ts` cho lý do và số đo.
 */

type One<T> = T | T[] | null
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

const LSX = 'lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)'

export const materialProfileRepo = {
  /** Mọi dòng đơn (trừ đơn huỷ) của một mã, kèm đã về / còn chờ về. */
  async lines(materialId: string): Promise<VtLine[]> {
    const { data, error } = await db()
      .from('supply_purchase_order_lines')
      .select(
        `id, qty_ordered, qty2, unit2, unit_price, price_basis, note, po:supply_purchase_orders!inner(id, code, status, currency, ordered_at, created_at, supplier_id, supplier:supply_suppliers(name), ${LSX})`,
      )
      .eq('material_id', materialId)
      .neq('po.status', 'cancelled')
      .limit(1000)
    if (error) throw error
    type Po = {
      id: string
      code: string
      status: string
      currency: string | null
      ordered_at: string | null
      created_at: string
      supplier_id: string
      supplier: One<{ name: string }>
      lsx: One<{ code: string }>
    }
    type Raw = {
      id: string
      qty_ordered: number
      qty2: number | null
      unit2: string | null
      unit_price: number | null
      price_basis: string | null
      note: string | null
      po: One<Po>
    }
    const rows = ((data ?? []) as unknown as Raw[]).flatMap((r) => {
      const po = one(r.po)
      return po ? [{ r, po }] : []
    })
    const st = await this.lineStatus(rows.map((x) => x.r.id))
    return rows
      .map(({ r, po }) => ({
        line_id: r.id,
        po_id: po.id,
        po_code: po.code,
        status: po.status,
        at: (po.ordered_at ?? po.created_at).slice(0, 10),
        supplier_id: po.supplier_id,
        supplier_name: one(po.supplier)?.name ?? '—',
        lsx_code: one(po.lsx)?.code ?? null,
        qty: Number(r.qty_ordered),
        qty2: r.qty2 == null ? null : Number(r.qty2),
        unit2: r.unit2,
        unit_price: r.unit_price == null ? null : Number(r.unit_price),
        currency: po.currency ?? 'VND',
        price_basis: r.price_basis,
        note: r.note,
        qty_received: st.get(r.id)?.qty_received ?? 0,
        qty_open: st.get(r.id)?.qty_open ?? 0,
      }))
      .sort((a, b) =>
        a.at < b.at ? 1 : a.at > b.at ? -1 : a.po_code < b.po_code ? 1 : -1,
      )
  },

  async lineStatus(ids: string[]) {
    const m = new Map<string, { qty_received: number; qty_open: number }>()
    if (ids.length === 0) return m
    const { data, error } = await db()
      .from('supply_po_line_status')
      .select('id, qty_received, qty_open')
      .in('id', ids)
    if (error) throw error
    for (const x of data ?? [])
      if (x.id) m.set(x.id, { qty_received: Number(x.qty_received ?? 0), qty_open: Number(x.qty_open ?? 0) }) // prettier-ignore
    return m
  },

  /**
   * Dòng đơn của các mã CÙNG NHÓM CON (khác mã đang xem) — nguồn của "NCC gợi
   * ý". Lọc ở DB qua join `!inner`; trần 1000 dòng PostgREST — nhóm con đông
   * nhất hiện có vài chục dòng đơn, chạm trần thì gợi ý chỉ thiếu NCC cũ nhất.
   */
  async sameSubGroup(
    materialId: string,
    group: string,
    sub: string,
  ): Promise<DongCungNhom[]> {
    const { data, error } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'material_id, mat:warehouse_materials!inner(code, name, group_name, sub_group), po:supply_purchase_orders!inner(status, ordered_at, created_at, supplier_id, supplier:supply_suppliers(name))',
      )
      .eq('mat.group_name', group)
      .eq('mat.sub_group', sub)
      .neq('material_id', materialId)
      .neq('po.status', 'cancelled')
      .limit(1000)
    if (error) throw error
    type Raw = {
      mat: One<{ code: string; name: string }>
      po: One<{
        ordered_at: string | null
        created_at: string
        supplier_id: string
        supplier: One<{ name: string }>
      }>
    }
    return ((data ?? []) as unknown as Raw[]).flatMap((r) => {
      const mat = one(r.mat)
      const po = one(r.po)
      if (!mat || !po) return []
      return [
        {
          supplier_id: po.supplier_id,
          supplier_name: one(po.supplier)?.name ?? '—',
          code: mat.code,
          name: mat.name,
          at: (po.ordered_at ?? po.created_at).slice(0, 10),
        },
      ]
    })
  },

  async onHand(materialId: string): Promise<number> {
    const { data, error } = await db()
      .from('warehouse_stock')
      .select('on_hand')
      .eq('material_id', materialId)
      .maybeSingle()
    if (error) throw error
    return Number(data?.on_hand ?? 0)
  },
}
