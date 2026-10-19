import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import { todayVn } from '@/lib/date-vn'
import type { DongSo } from '@/lib/kho-nxt'

/**
 * Đọc sổ kho cho Báo cáo Nhập–Xuất–Tồn (B6). Chỉ đọc.
 *
 * Đọc MỌI dòng sổ (cần lịch sử để ra tồn đầu + giá trị tồn đầu), chia trang
 * 1000 vì PostgREST cắt im lặng ở mốc đó. Đo 19/10/2026: 893 dòng — đọc hết
 * trong một lượt là đủ rẻ; khi sổ lớn lên thì đây là chỗ thêm số dư đầu kỳ đã
 * chốt (khoá kỳ, bước sau) thay vì cộng lại từ đầu.
 */

type Raw = {
  id: string
  material_id: string
  direction: 'in' | 'out'
  qty: unknown
  unit_cost: unknown
  reason_code: string | null
  ref_type: string | null
  po_line_id: string | null
  production_order_id: string | null
  doc_id: string | null
  created_at: string
  note: string | null
  doc: {
    code: string
    kind: string
    doc_date: string | null
    reversal_of_doc_id: string | null
    counterparty: string | null
    reason: string | null
  } | null
  line: { po: { code: string; currency: string | null; fx_rate: unknown } | null } | null
  lsx: { code: string } | null
}

const SELECT =
  'id, material_id, direction, qty, unit_cost, reason_code, ref_type, po_line_id, production_order_id, doc_id, created_at, note, doc:warehouse_docs(code, kind, doc_date, reversal_of_doc_id, counterparty, reason), line:supply_purchase_order_lines(po:supply_purchase_orders(code, currency, fx_rate)), lsx:production_orders(code)'

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function dienGiai(r: Raw, doc: Raw['doc'], po: { code: string } | null): string | null {
  const phan: string[] = []
  if (doc?.reversal_of_doc_id) phan.push('Đảo phiếu')
  if (po) phan.push(po.code)
  if (r.lsx?.code) phan.push(`lệnh ${r.lsx.code}`)
  const ben = doc?.counterparty?.trim() || doc?.reason?.trim()
  if (ben) phan.push(ben)
  return phan.length ? phan.join(' · ') : r.note?.trim() || null
}

export const nxtRepo = {
  /** Mọi dòng sổ có ngày chứng từ ≤ `den`. */
  async dongSoDen(den: string): Promise<DongSo[]> {
    const out: DongSo[] = []
    for (let tu = 0; ; tu += 1000) {
      const { data, error } = await db()
        .from('warehouse_movements')
        .select(SELECT)
        .order('id')
        .range(tu, tu + 999)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as unknown as Raw[]
      for (const r of rows) {
        const doc = one(r.doc)
        const line = one(r.line)
        const po = line ? one(line.po) : null
        // Q2: ngày CHỨNG TỪ; dòng không phiếu (5 dòng mồi 07/2026) lấy ngày ghi theo giờ VN.
        const ngay = doc?.doc_date ?? todayVn(new Date(r.created_at))
        if (ngay > den) continue
        out.push({
          id: r.id,
          material_id: r.material_id,
          direction: r.direction,
          qty: Number(r.qty ?? 0),
          unit_cost: r.unit_cost == null ? null : Number(r.unit_cost),
          currency: po?.currency ?? null,
          fx_rate: po?.fx_rate == null ? null : Number(po.fx_rate),
          reason_code: r.reason_code,
          ref_type: r.ref_type,
          po_line_id: r.po_line_id,
          production_order_id: r.production_order_id,
          ngay,
          doc_id: r.doc_id,
          doc_code: doc?.code ?? null,
          doc_kind: doc?.kind ?? null,
          la_dao: !!doc?.reversal_of_doc_id,
          dien_giai: dienGiai(r, doc, po),
        })
      }
      if (rows.length < 1000) break
    }
    return out
  },

  async vatTu(
    ids: string[],
  ): Promise<
    Map<string, { code: string; name: string; unit: string; group_name: string | null }>
  > {
    const rows =
      await theoLo<{ id: string; code: string; name: string; unit: string; group_name: string | null }> // prettier-ignore
      (
        ids,
        (lo) => db().from('warehouse_materials').select('id, code, name, unit, group_name').in('id', lo).order('id'), // prettier-ignore
      )
    return new Map(rows.map((r) => [r.id, r]))
  },
}
