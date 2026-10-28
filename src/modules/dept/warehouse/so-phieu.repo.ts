import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'

/**
 * Nguồn thêm cho Sổ phiếu Kho (Kho đợt 2 · Bước 2b, 12/10/2026): rổ "Thiếu số
 * phiếu NCC", cột Đơn · Lệnh, lọc theo người lập. Mọi tập id lớn dần đi qua
 * `theoLo` (bẫy độ dài URL — `server/theo-lo.ts`); mọi truy vấn kiểm `error`.
 */

const ok = <T>(
  r: { data: T | null; error: { message: string } | null },
  viec: string,
): T => {
  if (r.error) throw new Error(`soPhieuRepo.${viec}: ${r.error.message}`)
  return r.data as T
}

/** Số ngày tính "gần đây" cho badge menu — cùng cửa sổ 14 ngày của màn Đã về. */
export const GAN_DAY_NGAY = 14

export const soPhieuRepo = {
  /**
   * Phiếu NHẬP THEO ĐƠN MUA còn hiệu lực mà CHƯA có số phiếu giao NCC — việc của
   * người nhận hàng (tờ giao hàng nằm ở họ); Kế toán đối chiếu công nợ bằng số này.
   * Loại: phiếu đảo, phiếu đã bị đảo, phiếu nhập ngoài đơn / hoàn kho (không có NCC).
   * `ganDay` = phần có ngày chứng từ trong `GAN_DAY_NGAY` ngày — số của badge menu.
   */
  async thieuSoNcc(today: string): Promise<{ ids: string[]; ganDay: number }> {
    const docs = ok<{ id: string; doc_date: string; supplier_doc_no: string | null }[]>(
      await db()
        .from('warehouse_docs')
        .select('id, doc_date, supplier_doc_no')
        .eq('kind', 'receipt')
        .eq('status', 'posted')
        .is('reversal_of_doc_id', null)
        .or('supplier_doc_no.is.null,supplier_doc_no.eq.')
        .limit(5000),
      'thieuSoNcc.docs',
    )
    if (docs.length === 0) return { ids: [], ganDay: 0 }
    const ids = docs.map((d) => d.id)
    const [rev, mv] = await Promise.all([
      theoLo<{ reversal_of_doc_id: string }>(ids, (lo) =>
        db()
          .from('warehouse_docs')
          .select('reversal_of_doc_id')
          .in('reversal_of_doc_id', lo),
      ),
      theoLo<{ doc_id: string }>(ids, (lo) =>
        db()
          .from('warehouse_movements')
          .select('doc_id')
          .in('doc_id', lo)
          .not('po_line_id', 'is', null),
      ),
    ])
    const daDao = new Set(rev.map((r) => r.reversal_of_doc_id))
    const theoDon = new Set(mv.map((m) => m.doc_id))
    const con = docs.filter((d) => theoDon.has(d.id) && !daDao.has(d.id))
    const tu = new Date(
      Date.parse(today + 'T00:00:00Z') - (GAN_DAY_NGAY - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10)
    return {
      ids: con.map((d) => d.id),
      ganDay: con.filter((d) => d.doc_date.slice(0, 10) >= tu).length,
    }
  },

  /** Đơn mua + lệnh SX (chính + gộp) của từng phiếu — cột Đơn · Lệnh của sổ. */
  async donLenhByDocIds(
    docIds: string[],
  ): Promise<Map<string, { po_id: string; po_code: string; lsx: string[] }>> {
    const out = new Map<string, { po_id: string; po_code: string; lsx: string[] }>()
    const mv = await theoLo<{ doc_id: string; po_line_id: string }>(docIds, (lo) =>
      db()
        .from('warehouse_movements')
        .select('doc_id, po_line_id')
        .in('doc_id', lo)
        .not('po_line_id', 'is', null),
    )
    if (mv.length === 0) return out
    const lines = await theoLo<{ id: string; po_id: string }>(
      mv.map((m) => m.po_line_id),
      (lo) => db().from('supply_purchase_order_lines').select('id, po_id').in('id', lo),
    )
    const poOf = new Map(lines.map((l) => [l.id, l.po_id]))
    const poIds = [...new Set(lines.map((l) => l.po_id))]
    const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
    const [pos, extra] = await Promise.all([
      theoLo<{ id: string; code: string; lsx: One<{ code: string }> }>(poIds, (lo) =>
        db()
          .from('supply_purchase_orders')
          // Hai FK sang production_orders — hint đích danh FK lệnh chính.
          .select(
            'id, code, lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)',
          )
          .in('id', lo),
      ),
      theoLo<{ po_id: string; lsx: One<{ code: string }> }>(poIds, (lo) =>
        db()
          .from('supply_po_extra_lsx')
          .select('po_id, lsx:production_orders(code)')
          .in('po_id', lo),
      ),
    ])
    const extraBy = new Map<string, string[]>()
    for (const e of extra) {
      const c = one(e.lsx)?.code
      if (c) extraBy.set(e.po_id, [...(extraBy.get(e.po_id) ?? []), c])
    }
    const poById = new Map(pos.map((p) => [p.id, p]))
    for (const m of mv) {
      if (out.has(m.doc_id)) continue
      const p = poById.get(poOf.get(m.po_line_id) ?? '')
      if (!p) continue
      const chinh = one(p.lsx)?.code
      out.set(m.doc_id, {
        po_id: p.id,
        po_code: p.code,
        lsx: [...(chinh ? [chinh] : []), ...(extraBy.get(p.id) ?? [])],
      })
    }
    return out
  },

  /**
   * Lệnh SX trên DÒNG của từng phiếu (`warehouse_movements.production_order_id`)
   * — phiếu xuất cho lệnh không nối đơn mua nên `donLenhByDocIds` không thấy lệnh
   * (28/10/2026: tab Phiếu xuất có cột Lệnh SX trống cả 18 phiếu).
   */
  async lenhTheoDongByDocIds(docIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>()
    if (docIds.length === 0) return out
    const mv = await theoLo<{ doc_id: string; lsx: One<{ code: string }> }>(
      docIds,
      (lo) =>
        db()
          .from('warehouse_movements')
          .select('doc_id, lsx:production_orders(code)')
          .in('doc_id', lo)
          .not('production_order_id', 'is', null),
    )
    const one = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)
    for (const m of mv) {
      const c = one(m.lsx)?.code
      if (!c) continue
      const ds = out.get(m.doc_id) ?? []
      if (!ds.includes(c)) out.set(m.doc_id, [...ds, c])
    }
    return out
  },

  /** Người đã lập phiếu kho + số phiếu — ô lọc "Người lập" (nhiều trước). */
  async nguoiLap(): Promise<{ id: string; name: string; n: number }[]> {
    const rows = ok<{ created_by: string | null; actor: One<{ name: string | null }> }[]>(
      await db()
        .from('warehouse_docs')
        .select('created_by, actor:users!warehouse_docs_created_by_fkey(name)')
        .not('created_by', 'is', null)
        .limit(20000),
      'nguoiLap',
    )
    const m = new Map<string, { id: string; name: string; n: number }>()
    for (const r of rows) {
      const id = r.created_by!
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      const cur = m.get(id) ?? { id, name: a?.name ?? '—', n: 0 }
      cur.n++
      m.set(id, cur)
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'vi'))
  },
}

type One<T> = T | T[] | null
