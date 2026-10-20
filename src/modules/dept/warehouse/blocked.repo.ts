import { db } from '@/server/db'

/**
 * HÀNG MẮC (Đợt 3 §2.3) — lượng đang ở trạng thái KHOÁ.
 *
 * Màn này chỉ tồn tại được vì hàng không đạt NAY VÀO SỔ (0194). Trước đó nó
 * bị loại ngoài sổ: 200 cây nhôm sai hợp kim nằm thật ngoài sân mà không bảng
 * nào đếm được, không ai nhắc, và không ai chấm được chất lượng NCC.
 *
 * HAI NGUỒN, HAI VIỆC — cố ý:
 *   · LƯỢNG lấy từ view `v_warehouse_stock_by_bin` (số đúng, đã trừ mọi lần
 *     mở khoá / trả / huỷ).
 *   · CÂU CHUYỆN (lý do khoá, tuổi, phiếu gốc, NCC) lấy từ DÒNG NHẬP khoá
 *     gần nhất của mã đó.
 *
 * Không gộp làm một vì chúng trả lời hai câu khác nhau, và ghép nhầm thì ra
 * một con số cũ đi kèm một lý do mới.
 */

export type BlockedLot = {
  material_id: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  bin_id: string | null
  bin_code: string | null
  /** Lượng CÒN đang khoá — từ view, không phải từ dòng nhập. */
  qty: number
  /** Lý do khoá nguyên văn, lấy từ ghi chú dòng nhập. Null = không ai ghi. */
  reason: string | null
  /** Lúc bị khoá — nền của cột TUỔI, lý do màn này tồn tại. */
  blocked_at: string | null
  doc_id: string | null
  doc_code: string | null
  po_line_id: string | null
  po_id: string | null
  po_code: string | null
  supplier_id: string | null
  supplier_name: string | null
}

function num(v: unknown): number {
  return Number(v ?? 0)
}

function one(v: unknown): Record<string, unknown> | null {
  const x = Array.isArray(v) ? v[0] : v
  return (x as Record<string, unknown> | null) ?? null
}

export async function blockedLots(): Promise<BlockedLot[]> {
  // ① Lượng còn khoá, theo (mã × khu).
  const { data: stock } = await db()
    .from('v_warehouse_stock_by_bin')
    .select('material_id, bin_id, bin_code, qty')
    .eq('stock_status', 'blocked')
    .gt('qty', 0)
    .limit(5000)
  const rows = (stock as Record<string, unknown>[] | null) ?? []
  if (rows.length === 0) return []

  const matIds = [...new Set(rows.map((r) => r.material_id as string))]

  // ② Câu chuyện: dòng NHẬP khoá của các mã đó, mới nhất trước.
  const { data: mv } = await db()
    .from('warehouse_movements')
    .select(
      `material_id, note, created_at, doc_id, po_line_id,
       doc:warehouse_docs(code),
       po_line:supply_purchase_order_lines(po_id, po:supply_purchase_orders(code, supplier_id, supplier:supply_suppliers(name)))`,
    )
    .in('material_id', matIds)
    .eq('direction', 'in')
    .eq('stock_status', 'blocked')
    .order('created_at', { ascending: false })
    .limit(2000)

  /** material_id → dòng khoá GẦN NHẤT (đã order desc nên lần đầu gặp là mới nhất). */
  const story = new Map<string, Record<string, unknown>>()
  for (const r of (mv as Record<string, unknown>[] | null) ?? []) {
    const id = r.material_id as string
    if (!story.has(id)) story.set(id, r)
  }

  // ③ Tên vật tư.
  const { data: mats } = await db()
    .from('warehouse_materials')
    .select('id, code, name, unit')
    .in('id', matIds)
  const matById = new Map(
    (
      (mats as { id: string; code: string; name: string; unit: string }[] | null) ?? []
    ).map((m) => [m.id, m]),
  )

  return rows.map((r) => {
    const id = r.material_id as string
    const m = matById.get(id)
    const s = story.get(id)
    const doc = s ? one(s.doc) : null
    const poLine = s ? one(s.po_line) : null
    const po = poLine ? one(poLine.po) : null
    const sup = po ? one(po.supplier) : null
    return {
      material_id: id,
      material_code: m?.code ?? null,
      material_name: m?.name ?? null,
      material_unit: m?.unit ?? null,
      bin_id: (r.bin_id as string | null) ?? null,
      bin_code: (r.bin_code as string | null) ?? null,
      qty: num(r.qty),
      reason: (s?.note as string | null) ?? null,
      blocked_at: (s?.created_at as string | null) ?? null,
      doc_id: (s?.doc_id as string | null) ?? null,
      doc_code: (doc?.code as string | null) ?? null,
      po_line_id: (s?.po_line_id as string | null) ?? null,
      po_id: (poLine?.po_id as string | null) ?? null,
      po_code: (po?.code as string | null) ?? null,
      supplier_id: (po?.supplier_id as string | null) ?? null,
      supplier_name: (sup?.name as string | null) ?? null,
    } satisfies BlockedLot
  })
}
