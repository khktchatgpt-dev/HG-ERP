import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import type { DongLenh, LenhTon } from '@/lib/kho-ton-lenh'

/**
 * Nguồn của "hàng của lệnh" — hộp Lấy hàng của lệnh ở phiếu xuất (Kho đợt 2 ·
 * B4) và Tồn kho theo lệnh (B5): lệnh + dòng đơn mua của lệnh + SL đã nhận theo
 * dòng + đã xuất cho lệnh + tồn dùng được + tên vật tư. Ở module Kho (câu hỏi của
 * thủ kho), đọc bảng của Cung ứng qua truy vấn chỉ-đọc.
 *
 * Tải MỘT LƯỢT cho mọi lệnh (B5): chia tồn giữa các lệnh cần thấy cùng lúc mọi
 * lệnh có phần trên một mã — 19 lệnh, vài nghìn dòng đơn (đo 12/10/2026).
 * Mọi truy vấn kiểm `error`; tập id lớn dần đi qua `theoLo` (bẫy độ dài URL).
 */
const ok = <T>(
  r: { data: unknown; error: { message: string } | null },
  viec: string,
): T => {
  if (r.error) throw new Error(`hangLenhRepo.${viec}: ${r.error.message}`)
  return (r.data ?? []) as T
}

type Line = {
  id: string
  po_id: string
  material_id: string | null
  qty_ordered: unknown
}
const LINE_COLS = 'id, po_id, material_id, qty_ordered'

export const hangLenhRepo = {
  /** Lệnh chưa huỷ, kèm tên khách. `xuat_cuoi` điền sau từ `xuatTheoLenh`. */
  async lenh(): Promise<LenhTon[]> {
    const rows = ok<
      {
        id: string
        code: string
        status: string
        ship_date: string | null
        customer: { name: string } | { name: string }[] | null
      }[]
    >(
      await db()
        .from('production_orders')
        .select('id, code, status, ship_date, customer:sales_customers(name)')
        .neq('status', 'cancelled')
        .limit(1000),
      'lenh',
    )
    return rows.map((r) => {
      const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
      return {
        id: r.id,
        code: r.code,
        status: r.status,
        ship_date: r.ship_date,
        khach: c?.name ?? null,
        xuat_cuoi: null,
      }
    })
  },

  /**
   * Dòng đơn (có mã vật tư, đơn chưa huỷ) mà mỗi lệnh có phần:
   *  · dòng KHÔNG chia (0185) → cả dòng thuộc lệnh chính của đơn;
   *  · dòng CÓ chia → mỗi bản ghi chia là một phần cho đúng lệnh đó (kể cả đơn
   *    gộp lệnh mà lệnh chính là lệnh khác).
   */
  async dongCacLenh(lsxIds: string[]): Promise<DongLenh[]> {
    if (lsxIds.length === 0) return []
    const lenhSet = new Set(lsxIds)
    const [pos, chia] = await Promise.all([
      theoLo<{ id: string; production_order_id: string }>(lsxIds, (lo) =>
        db()
          .from('supply_purchase_orders')
          .select('id, production_order_id')
          .in('production_order_id', lo)
          .neq('status', 'cancelled'),
      ),
      theoLo<{ line_id: string; production_order_id: string; qty: unknown }>(
        lsxIds,
        (lo) =>
          db()
            .from('supply_po_line_lsx')
            .select('line_id, production_order_id, qty')
            .in('production_order_id', lo),
      ),
    ])
    const lenhCuaDon = new Map(pos.map((p) => [p.id, p.production_order_id]))
    const dongChinh = await theoLo<Line>([...lenhCuaDon.keys()], (lo) =>
      db().from('supply_purchase_order_lines').select(LINE_COLS).in('po_id', lo),
    )
    const daCo = new Set(dongChinh.map((l) => l.id))
    const [{ dongNgoai, huy }, chiaDongChinh] = await Promise.all([
      // Dòng được chia cho lệnh mà đơn của nó không thuộc tập trên (đơn gộp lệnh).
      (async () => {
        const dongNgoai = await theoLo<Line>(
          [...new Set(chia.map((c) => c.line_id))].filter((id) => !daCo.has(id)),
          (lo) => db().from('supply_purchase_order_lines').select(LINE_COLS).in('id', lo),
        )
        const huy = new Set(
          (
            await theoLo<{ id: string }>(
              [...new Set(dongNgoai.map((l) => l.po_id))],
              (lo) =>
                db()
                  .from('supply_purchase_orders')
                  .select('id')
                  .in('id', lo)
                  .eq('status', 'cancelled'),
            )
          ).map((p) => p.id),
        )
        return { dongNgoai, huy }
      })(),
      // Mọi bản ghi chia của các dòng đơn chính (chia cho cả lệnh ngoài tập cũng
      // làm dòng "có chia" — phần còn lại không về lệnh chính nữa).
      theoLo<{ line_id: string }>(
        dongChinh.map((l) => l.id),
        (lo) => db().from('supply_po_line_lsx').select('line_id').in('line_id', lo),
      ),
    ])
    const coChia = new Set(chiaDongChinh.map((c) => c.line_id))
    const theoDong = new Map<string, Line>()
    for (const l of dongChinh) theoDong.set(l.id, l)
    for (const l of dongNgoai) if (!huy.has(l.po_id)) theoDong.set(l.id, l)

    const out: DongLenh[] = []
    for (const l of dongChinh) {
      if (!l.material_id || coChia.has(l.id)) continue
      const lsx = lenhCuaDon.get(l.po_id)
      if (!lsx || !lenhSet.has(lsx)) continue
      const qo = Number(l.qty_ordered) || 0
      out.push({ lsx_id: lsx, line_id: l.id, material_id: l.material_id, qty_ordered: qo, phan_lenh: qo }) // prettier-ignore
    }
    for (const c of chia) {
      const l = theoDong.get(c.line_id)
      if (!l?.material_id) continue
      out.push({
        lsx_id: c.production_order_id,
        line_id: l.id,
        material_id: l.material_id,
        qty_ordered: Number(l.qty_ordered) || 0,
        phan_lenh: Number(c.qty) || 0,
      })
    }
    return out
  },

  /** SL đã nhận RÒNG theo dòng đơn: mọi dòng sổ gắn dòng đơn (vào +, ra −). */
  async nhanTheoDong(lineIds: string[]): Promise<Map<string, number>> {
    const rows = await theoLo<{ po_line_id: string; direction: string; qty: unknown }>(
      lineIds,
      (lo) =>
        db()
          .from('warehouse_movements')
          .select('po_line_id, direction, qty')
          .in('po_line_id', lo),
    )
    const m = new Map<string, number>()
    for (const r of rows) {
      const q = (Number(r.qty) || 0) * (r.direction === 'in' ? 1 : -1)
      m.set(r.po_line_id, (m.get(r.po_line_id) ?? 0) + q)
    }
    return m
  },

  /**
   * Đã xuất RÒNG cho từng lệnh theo vật tư (xuất − hoàn kho − phiếu đảo), cùng luật
   * `issuedByLsx`, + ngày ghi xuất gần nhất của lệnh. Đọc theo lô + trang: bản
   * `issuedByLsxIds` dùng `.limit(10000)` mà PostgREST cắt ở 1000 dòng.
   */
  async xuatTheoLenh(lsxIds: string[]): Promise<{
    xuat: Map<string, Map<string, number>>
    cuoi: Map<string, string>
  }> {
    const rows = await theoLo<{
      production_order_id: string
      material_id: string
      direction: string
      qty: unknown
      created_at: string
    }>(lsxIds, (lo) =>
      db()
        .from('warehouse_movements')
        .select('production_order_id, material_id, direction, qty, created_at')
        .in('production_order_id', lo),
    )
    const xuat = new Map<string, Map<string, number>>()
    const cuoi = new Map<string, string>()
    for (const r of rows) {
      const ra = r.direction === 'out'
      const m = xuat.get(r.production_order_id) ?? new Map<string, number>()
      m.set(r.material_id, (m.get(r.material_id) ?? 0) + (Number(r.qty) || 0) * (ra ? 1 : -1)) // prettier-ignore
      xuat.set(r.production_order_id, m)
      if (ra && (cuoi.get(r.production_order_id) ?? '') < r.created_at)
        cuoi.set(r.production_order_id, r.created_at)
    }
    return { xuat, cuoi }
  },

  /** Tồn dùng được (`qty_ok`) + tên/ĐVT của các mã. */
  async tonVaTen(materialIds: string[]): Promise<{
    ton: Map<string, number>
    vatTu: Map<string, { code: string; name: string; unit: string }>
  }> {
    const [st, vt] = await Promise.all([
      theoLo<{ material_id: string; qty_ok: unknown }>(materialIds, (lo) =>
        db().from('warehouse_stock').select('material_id, qty_ok').in('material_id', lo),
      ),
      theoLo<{ id: string; code: string; name: string; unit: string }>(
        materialIds,
        (lo) =>
          db().from('warehouse_materials').select('id, code, name, unit').in('id', lo),
      ),
    ])
    return {
      ton: new Map(st.map((s) => [s.material_id, Number(s.qty_ok) || 0])),
      vatTu: new Map(vt.map((v) => [v.id, { code: v.code, name: v.name, unit: v.unit }])),
    }
  },
}
