import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import type { DongDonLenh } from '@/lib/kho-hang-lenh'

/**
 * Nguồn của "Lấy hàng của lệnh" (Kho đợt 2 · Bước 4) — dòng đơn mua của lệnh +
 * SL đã nhận của từng dòng + tồn dùng được + tên vật tư. Ở module Kho (câu hỏi
 * của thủ kho), đọc bảng của Cung ứng qua truy vấn chỉ-đọc.
 *
 * Mọi truy vấn kiểm `error`; tập id lớn dần đi qua `theoLo` (bẫy độ dài URL).
 */
const ok = <T>(
  r: { data: unknown; error: { message: string } | null },
  viec: string,
): T => {
  if (r.error) throw new Error(`hangLenhRepo.${viec}: ${r.error.message}`)
  return (r.data ?? []) as T
}

export const hangLenhRepo = {
  /**
   * Dòng đơn (có mã vật tư, đơn chưa huỷ) mà lệnh có phần:
   *  · dòng của đơn có LỆNH CHÍNH là lệnh này — không chia thì cả dòng, có chia
   *    (0185) thì phần chia cho lệnh này;
   *  · dòng của đơn KHÁC mà được chia cho lệnh này (đơn gộp lệnh).
   */
  async dongCuaLenh(lsxId: string): Promise<DongDonLenh[]> {
    const pos = ok<{ id: string }[]>(
      await db()
        .from('supply_purchase_orders')
        .select('id')
        .eq('production_order_id', lsxId)
        .neq('status', 'cancelled')
        .limit(2000),
      'pos',
    )
    const chiaChoLenh = ok<{ line_id: string; qty: unknown }[]>(
      await db()
        .from('supply_po_line_lsx')
        .select('line_id, qty')
        .eq('production_order_id', lsxId)
        .limit(5000),
      'chiaChoLenh',
    )
    type Line = {
      id: string
      po_id: string
      material_id: string | null
      qty_ordered: unknown
    }
    const [dongChinh, dongChia] = await Promise.all([
      theoLo<Line>(
        pos.map((p) => p.id),
        (lo) =>
          db()
            .from('supply_purchase_order_lines')
            .select('id, po_id, material_id, qty_ordered')
            .in('po_id', lo),
      ),
      theoLo<Line>(
        chiaChoLenh.map((c) => c.line_id),
        (lo) =>
          db()
            .from('supply_purchase_order_lines')
            .select('id, po_id, material_id, qty_ordered')
            .in('id', lo),
      ),
    ])
    // Dòng của đơn chính mà CÓ chia (cho bất kỳ lệnh nào) — phần của lệnh này là
    // phần chia (có thể 0), không còn là cả dòng.
    const coChia = new Set(
      (
        await theoLo<{ line_id: string }>(
          dongChinh.map((l) => l.id),
          (lo) => db().from('supply_po_line_lsx').select('line_id').in('line_id', lo),
        )
      ).map((r) => r.line_id),
    )
    const phanChia = new Map(chiaChoLenh.map((c) => [c.line_id, Number(c.qty) || 0]))
    const huy = new Set(
      (
        await theoLo<{ id: string }>([...new Set(dongChia.map((l) => l.po_id))], (lo) =>
          db()
            .from('supply_purchase_orders')
            .select('id')
            .in('id', lo)
            .eq('status', 'cancelled'),
        )
      ).map((p) => p.id),
    )
    const out = new Map<string, DongDonLenh>()
    for (const l of dongChinh) {
      if (!l.material_id) continue
      const qo = Number(l.qty_ordered) || 0
      out.set(l.id, {
        line_id: l.id,
        material_id: l.material_id,
        qty_ordered: qo,
        phan_lenh: coChia.has(l.id) ? (phanChia.get(l.id) ?? 0) : qo,
      })
    }
    for (const l of dongChia) {
      if (!l.material_id || out.has(l.id) || huy.has(l.po_id)) continue
      out.set(l.id, {
        line_id: l.id,
        material_id: l.material_id,
        qty_ordered: Number(l.qty_ordered) || 0,
        phan_lenh: phanChia.get(l.id) ?? 0,
      })
    }
    return [...out.values()]
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
