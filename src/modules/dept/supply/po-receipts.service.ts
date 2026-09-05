import { db } from '@/server/db'

/**
 * ĐỢT VỀ CỦA ĐƠN — một đợt = một phiếu nhập kho (B3, 05/09/2026). Dùng chung
 * cho tab Đợt giao của chi tiết đơn và file Excel theo lệnh, để hai chỗ không
 * gom đợt theo hai cách rồi lệch nhau.
 *
 * Movement không gắn phiếu (dữ liệu cũ) gom theo NGÀY tạo — vẫn là một đợt,
 * chỉ không có số phiếu. Số nhận = đạt + loại QC (BR-08: "đã về" tính cả phần
 * loại, vì NCC đã giao); cột loại tách riêng để người mua thấy phần trả lại.
 */
export type ReceiptBatch = {
  /** yyyy-mm-dd */
  date: string
  doc_id: string | null
  doc_code: string | null
  supplier_doc_no: string | null
  /** line id → SL nhận (đạt + loại) và SL loại. */
  by_line: Record<string, { qty: number; rejected: number }>
}

export async function loadReceiptBatches(
  poIds: string[],
): Promise<Record<string, ReceiptBatch[]>> {
  const out: Record<string, ReceiptBatch[]> = {}
  for (const id of poIds) out[id] = []
  if (poIds.length === 0) return out

  const { data: lineRows } = await db()
    .from('supply_purchase_order_lines')
    .select('id, po_id')
    .in('po_id', poIds)
  const poByLine = new Map(
    ((lineRows ?? []) as { id: string; po_id: string }[]).map((l) => [l.id, l.po_id]),
  )
  const lineIds = [...poByLine.keys()]
  if (lineIds.length === 0) return out

  const { data: mvRows } = await db()
    .from('warehouse_movements')
    .select('po_line_id, doc_id, qty, qty_rejected, created_at')
    .eq('direction', 'in')
    .in('po_line_id', lineIds)
    .limit(10000)
  type Mv = {
    po_line_id: string
    doc_id: string | null
    qty: unknown
    qty_rejected: unknown
    created_at: string
  }
  const mvs = (mvRows ?? []) as Mv[]
  if (mvs.length === 0) return out

  const docIds = [...new Set(mvs.map((m) => m.doc_id).filter((v): v is string => !!v))]
  const docById = new Map<
    string,
    { code: string; doc_date: string; supplier_doc_no: string | null }
  >()
  if (docIds.length > 0) {
    const { data: docs } = await db()
      .from('warehouse_docs')
      .select('id, code, doc_date, supplier_doc_no')
      .in('id', docIds)
    for (const d of (docs ?? []) as {
      id: string
      code: string
      doc_date: string
      supplier_doc_no: string | null
    }[]) {
      docById.set(d.id, d)
    }
  }

  const num = (v: unknown) => Number(v) || 0
  // key đợt: theo phiếu nếu có, không thì theo ngày.
  const batchMap = new Map<string, Map<string, ReceiptBatch>>()
  for (const m of mvs) {
    const poId = poByLine.get(m.po_line_id)
    if (!poId) continue
    const doc = m.doc_id ? docById.get(m.doc_id) : undefined
    const date = (doc?.doc_date ?? m.created_at).slice(0, 10)
    const key = doc ? `doc:${m.doc_id}` : `day:${date}`
    const perPo = batchMap.get(poId) ?? new Map<string, ReceiptBatch>()
    const b = perPo.get(key) ?? {
      date,
      doc_id: doc ? m.doc_id : null,
      doc_code: doc?.code ?? null,
      supplier_doc_no: doc?.supplier_doc_no ?? null,
      by_line: {},
    }
    const cur = b.by_line[m.po_line_id] ?? { qty: 0, rejected: 0 }
    const rej = num(m.qty_rejected)
    b.by_line[m.po_line_id] = { qty: cur.qty + num(m.qty) + rej, rejected: cur.rejected + rej }
    perPo.set(key, b)
    batchMap.set(poId, perPo)
  }
  for (const [poId, perPo] of batchMap) {
    out[poId] = [...perPo.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
  return out
}
