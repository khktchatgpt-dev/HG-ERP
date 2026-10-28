import { db } from '@/server/db'
import type { TgDong } from '@/lib/tra-gia'

/**
 * Dòng đơn mua cho màn TRA GIÁ VẬT TƯ — đọc thẳng `supply_purchase_order_lines`,
 * không có bảng riêng (xem `lib/tra-gia.ts`).
 *
 * Nạp CẢ tập (trừ đơn huỷ, dòng không mã) rồi lọc kỳ ở service: đo 28/10 mới 743
 * dòng / 187 đơn, và việc gom theo quy cách phải nhìn mọi dòng cùng lúc. Đi theo
 * trang 1000 vì PostgREST cắt ở 1000 dòng mà không báo — đúng cái bẫy từng làm
 * màn tồn kho thiếu hàng.
 */

type One<T> = T | T[] | null
const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

const COLS =
  'id, qty_ordered, qty2, unit2, unit_price, price_basis, finish, material_id, po:supply_purchase_orders!inner(id, code, status, template, currency, ordered_at, created_at, supplier_id, supplier:supply_suppliers(name)), mat:warehouse_materials!inner(code, name, unit, group_name, sub_group)'

const TRANG = 1000

export const traGiaRepo = {
  async lines(): Promise<TgDong[]> {
    type Raw = {
      id: string
      qty_ordered: number | string
      qty2: number | string | null
      unit2: string | null
      unit_price: number | string | null
      price_basis: string | null
      finish: string | null
      material_id: string
      po: One<{
        id: string
        code: string
        status: string
        template: string | null
        currency: string | null
        ordered_at: string | null
        created_at: string
        supplier_id: string
        supplier: One<{ name: string }>
      }>
      mat: One<{
        code: string
        name: string
        unit: string | null
        group_name: string | null
        sub_group: string | null
      }>
    }
    const out: TgDong[] = []
    for (let from = 0; ; from += TRANG) {
      const { data, error } = await db()
        .from('supply_purchase_order_lines')
        .select(COLS)
        .not('material_id', 'is', null)
        .neq('po.status', 'cancelled')
        .order('id')
        .range(from, from + TRANG - 1)
      if (error) throw error
      const rows = (data ?? []) as unknown as Raw[]
      for (const r of rows) {
        const po = one(r.po)
        const mat = one(r.mat)
        if (!po || !mat) continue
        out.push({
          line_id: r.id,
          po_id: po.id,
          po_code: po.code,
          status: po.status,
          at: (po.ordered_at ?? po.created_at).slice(0, 10),
          supplier_id: po.supplier_id,
          supplier_name: one(po.supplier)?.name ?? '—',
          material_id: r.material_id,
          code: mat.code,
          name: mat.name,
          unit: mat.unit ?? '',
          group_name: mat.group_name,
          sub_group: mat.sub_group,
          template: po.template,
          finish: r.finish,
          qty: Number(r.qty_ordered),
          qty2: r.qty2 == null ? null : Number(r.qty2),
          unit2: r.unit2,
          unit_price: r.unit_price == null ? null : Number(r.unit_price),
          price_basis: r.price_basis,
          currency: po.currency ?? 'VND',
        })
      }
      if (rows.length < TRANG) break
    }
    return out
  },
}
