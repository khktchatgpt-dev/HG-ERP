import { db } from '@/server/db'
import { hetTrang, lo, type NplDonRaw } from '@/modules/dept/supply/npl-theo-lenh.repo'
import type { KdPhieu } from '@/lib/kho-don-theo-lenh'

/**
 * KHO · ĐƠN MUA THEO LỆNH — data access riêng của Kho. Phần đơn / dòng / chia /
 * gộp dùng lại `nplTheoLenhRepo` (cùng truy vấn với màn NPL theo lệnh của Cung
 * ứng); ở đây chỉ thêm hai thứ màn Kho cần mà màn kia không có: đơn HUỶ (để bắt
 * đơn huỷ mà đã có phiếu nhập, Q6) và PHIẾU NHẬP của từng đơn.
 */

const COT_DON =
  'id, code, status, expected_at, production_order_id, supplier_id, assigned_to, created_by'

export const donTheoLenhRepo = {
  /** Đơn huỷ có lệnh chính thuộc `lsxIds`, hoặc có id trong `poIds` (đơn gộp). */
  async donHuy(lsxIds: string[], poIds: string[]): Promise<NplDonRaw[]> {
    const out = new Map<string, NplDonRaw>()
    const chay = async (cot: 'production_order_id' | 'id', ids: string[]) => {
      for (const part of lo(ids)) {
        const { data, error } = await db()
          .from('supply_purchase_orders')
          .select(COT_DON)
          .eq('status', 'cancelled')
          .in(cot, part)
        if (error) throw new Error(error.message)
        for (const r of (data ?? []) as NplDonRaw[]) out.set(r.id, r)
      }
    }
    await Promise.all([chay('production_order_id', lsxIds), chay('id', poIds)])
    return [...out.values()]
  },

  /**
   * Phiếu nhập đã ghi cho các dòng đơn → theo đơn. Bỏ phiếu đã bị ĐẢO (có phiếu
   * khác trỏ `reversal_of_doc_id` về nó) — hàng của phiếu đó coi như chưa nhận.
   * Mỗi đơn: phiếu không trùng, cũ trước mới sau.
   */
  async phieuNhap(dongPo: Map<string, string>): Promise<Map<string, KdPhieu[]>> {
    type Mv = {
      po_line_id: string
      doc: { id: string; code: string; doc_date: string } | null
    }
    const lineIds = [...dongPo.keys()]
    const lots = await Promise.all(
      lo(lineIds).map((part) =>
        hetTrang((from, to) =>
          db()
            .from('warehouse_movements')
            .select(
              'po_line_id, doc:warehouse_docs!warehouse_movements_doc_id_fkey(id, code, doc_date)',
            )
            .eq('direction', 'in')
            .in('po_line_id', part)
            .order('id')
            .range(from, to),
        ),
      ),
    )
    const mvs = lots.flat() as unknown as Mv[]
    const docIds = [...new Set(mvs.map((m) => m.doc?.id).filter((x): x is string => !!x))]
    const daDao = new Set<string>()
    for (const part of lo(docIds)) {
      const { data, error } = await db()
        .from('warehouse_docs')
        .select('reversal_of_doc_id')
        .in('reversal_of_doc_id', part)
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as { reversal_of_doc_id: string }[]) {
        daDao.add(r.reversal_of_doc_id)
      }
    }

    const by = new Map<string, Map<string, KdPhieu>>()
    for (const m of mvs) {
      const po = dongPo.get(m.po_line_id)
      if (!po || !m.doc || daDao.has(m.doc.id)) continue
      const cua = by.get(po) ?? new Map<string, KdPhieu>()
      cua.set(m.doc.id, {
        doc_id: m.doc.id,
        code: m.doc.code,
        date: String(m.doc.doc_date).slice(0, 10),
      })
      by.set(po, cua)
    }
    const out = new Map<string, KdPhieu[]>()
    for (const [po, m] of by) {
      out.set(
        po,
        [...m.values()].sort(
          (a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code),
        ),
      )
    }
    return out
  },
}
