import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { fileImageSrc } from '@/server/file-image'
import { hoSoThieu, type HoSoCheck, type HoSoO } from '@/lib/ho-so-sp'
import { loadFlags } from './library.service'

/**
 * LỆNH SX · HỒ SƠ SP — trang theo dõi của Kỹ thuật (09/10/2026, chủ dự án:
 * "cho kỹ thuật 1 trang theo dõi lệnh để cập nhật BOM sản phẩm hay chưa cũng như
 * thông tin lệnh").
 *
 * Câu hỏi của màn: "Lệnh nào sắp xuất mà SP trên đó còn thiếu định mức / hồ sơ?"
 * Mỗi lệnh một khối, mỗi dòng SP một hàng với checklist 6 ô — ĐÚNG hàm
 * `hoSoCheck` thư viện dùng (`loadFlags`), nên số ở đây khớp số ở /thu-vien.
 * Thiếu SỐ trong định mức đếm từ dòng BOM (SL trống, thanh không có dài cắt).
 */

export type LsxHoSoLine = {
  product_id: string
  code: string
  name: string
  qty: number
  ship_date: string | null
  check: HoSoCheck | null
  thieu: HoSoO[]
  parts: number
  /** Dòng định mức thiếu số (SL / dài cắt). */
  thieu_so: number
  image_url: string | null
  locked: boolean
}
export type LsxHoSo = {
  id: string
  code: string
  status: string
  ship_date: string | null
  customer: string | null
  revision: number
  note: string | null
  lines: LsxHoSoLine[]
  counts: {
    sp: number
    bom: number
    thieu_bom: number
    thieu_so: number
    thieu_bv: number
    thieu_anh: number
    thieu_dg: number
    du: number
  }
}

type OrderRow = {
  id: string
  code: string
  status: string
  ship_date: string | null
  customer_id: string | null
  revision: number
  note: string | null
}
type LineRow = {
  production_order_id: string
  product_id: string | null
  product_code: string | null
  name_vi: string | null
  qty: number | null
  ship_date: string | null
  sort_order: number | null
}
type PartRow = {
  product_id: string
  qty: number | null
  cut_length_mm: number | null
  profile_shape: string | null
  kg_per_m: number | null
  dim_a_mm: number | null
}

const OPEN = ['approved', 'in_progress', 'pending_approval', 'draft']

export const lsxHoSoService = {
  async list(_user: User, opts: { all?: boolean } = {}): Promise<LsxHoSo[]> {
    let q = db()
      .from('production_orders')
      .select('id, code, status, ship_date, customer_id, revision, note')
      .order('ship_date', { ascending: true, nullsFirst: false })
    if (!opts.all) q = q.in('status', OPEN)
    const orders = await q
    if (orders.error) throw new Error(orders.error.message)
    const ods = (orders.data ?? []) as OrderRow[]
    if (ods.length === 0) return []

    const [lines, flags, customers] = await Promise.all([
      db()
        .from('production_order_lines')
        .select(
          'production_order_id, product_id, product_code, name_vi, qty, ship_date, sort_order',
        )
        .in(
          'production_order_id',
          ods.map((o) => o.id),
        )
        .order('sort_order'),
      loadFlags(),
      db()
        .from('sales_customers')
        .select('id, name')
        .in('id', [
          ...new Set(ods.map((o) => o.customer_id).filter((v): v is string => !!v)),
        ]),
    ])
    if (lines.error) throw new Error(lines.error.message)
    const lns = (lines.data ?? []) as LineRow[]
    const custName = new Map(
      ((customers.data ?? []) as { id: string; name: string }[]).map((c) => [
        c.id,
        c.name,
      ]),
    )

    // Dòng định mức thiếu số — chỉ cho SP đang trên lệnh (≤ vài trăm SP).
    const pids = [
      ...new Set(lns.map((l) => l.product_id).filter((v): v is string => !!v)),
    ]
    const thieuSo = new Map<string, number>()
    for (let i = 0; i < pids.length; i += 300) {
      const r = await db()
        .from('technical_product_parts')
        .select('product_id, qty, cut_length_mm, profile_shape, kg_per_m, dim_a_mm')
        .in('product_id', pids.slice(i, i + 300))
      if (r.error) throw new Error(r.error.message)
      for (const p of (r.data ?? []) as PartRow[]) {
        const laThanh = !!(p.profile_shape || p.kg_per_m || p.dim_a_mm)
        if (p.qty == null || (laThanh && p.cut_length_mm == null))
          thieuSo.set(p.product_id, (thieuSo.get(p.product_id) ?? 0) + 1)
      }
    }

    return ods.map((o) => {
      const mine = lns.filter((l) => l.production_order_id === o.id)
      const rows: LsxHoSoLine[] = mine.map((l) => {
        const f = l.product_id ? flags.get(l.product_id) : undefined
        const thieu = f ? hoSoThieu(f.check) : []
        return {
          product_id: l.product_id ?? '',
          code: f?.code ?? l.product_code ?? '—',
          name: l.name_vi ?? '',
          qty: l.qty ?? 0,
          ship_date: l.ship_date,
          check: f?.check ?? null,
          thieu,
          parts: f?.parts ?? 0,
          thieu_so: l.product_id ? (thieuSo.get(l.product_id) ?? 0) : 0,
          image_url: f?.image_file_id ? fileImageSrc(f.image_file_id) : null,
          locked: !!(f as { locked_at?: string | null } | undefined)?.locked_at,
        }
      })
      const counts = {
        sp: rows.length,
        bom: rows.filter((r) => r.parts > 0).length,
        thieu_bom: rows.filter((r) => r.thieu.includes('bom')).length,
        thieu_so: rows.filter((r) => r.thieu_so > 0).length,
        thieu_bv: rows.filter((r) => r.thieu.includes('bv')).length,
        thieu_anh: rows.filter((r) => r.thieu.includes('anh')).length,
        thieu_dg: rows.filter((r) => r.thieu.includes('dg') || r.thieu.includes('xc'))
          .length,
        du: rows.filter((r) => r.thieu.length === 0 && r.thieu_so === 0).length,
      }
      return {
        id: o.id,
        code: o.code,
        status: o.status,
        ship_date: o.ship_date,
        customer: o.customer_id ? (custName.get(o.customer_id) ?? null) : null,
        revision: o.revision,
        note: o.note,
        lines: rows,
        counts,
      }
    })
  },
}
