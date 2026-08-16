/**
 * ĐỐI CHIẾU PHIẾU NHẬP VỚI DÒNG ĐƠN ĐẶT — logic thuần, gọi từ
 * `stockService.createReceiptDoc` (server) và test được độc lập.
 *
 * Trước đây đường nhập chỉ ép "mỗi dòng phải có po_line_id", không kiểm dòng ấy
 * thuộc PO nào, không kiểm vật tư, cũng không kiểm số. Ba lỗ đó cho phép:
 *   1. gắn dòng của PO KHÁC → view ghi có cho PO đó, mà không ai tính lại trạng
 *      thái của nó → đơn kia âm thầm nhảy partial/received;
 *   2. nhập vật tư khác vào dòng PO → sổ đối chiếu sai từ gốc;
 *   3. gõ nhầm 1000 thay vì 100 → tồn kho phồng lên, qty_missing âm, PO đóng.
 * Phiếu TRẢ hàng (0080) vốn đã kiểm đủ cả ba — đường nhập nay theo cho đồng bộ.
 *
 * "Đã nhận" tính ĐÚNG công thức của view supply_po_line_status (0080):
 * đạt + QC loại. NCC giao đủ nhưng hàng lỗi thì vẫn là đã giao — phần lỗi xử lý
 * bằng phiếu trả hàng, không phải bằng cách coi như chưa giao.
 *
 * DUNG SAI NHẬN VƯỢT (0156 — GĐ B): gỗ/kính/tôn lệch vài % là chuyện thường.
 * Mỗi vật tư có `over_tolerance_pct` (default 0 = chặt như cũ); vượt trong
 * ngưỡng → `within` (cho qua, caller tự ghi note "[Vượt x% trong dung sai]"),
 * vượt quá ngưỡng → `over` (409 như cũ). Ngưỡng tính trên SL ĐẶT CỘNG DỒN:
 * prior + phiếu này ≤ qty_ordered × (1 + pct/100) — không phải mỗi phiếu một
 * lần dung sai.
 */

/** Dòng PO kèm số còn thiếu — subset của `supply_po_line_status`. */
export type ReceiptPoLine = {
  id: string
  material_id: string
  qty_missing: number
  /** SL đặt của dòng — mẫu số của dung sai (0156). Thiếu → coi dung sai 0. */
  qty_ordered?: number
  /** Dung sai nhận vượt % của vật tư (0156). Thiếu/0 = chặn mọi mức vượt. */
  over_tolerance_pct?: number
  material_name: string
  material_unit: string
}

/** Dòng đang nhập trên phiếu. */
export type ReceiptDraftLine = {
  material_id: string
  qty: number
  qty_rejected?: number
  po_line_id?: string | null
}

/** Một dòng nhận vượt phần còn thiếu. */
export type OverReceipt = {
  po_line_id: string
  material_name: string
  material_unit: string
  /** Tổng nhận trên phiếu (đạt + QC loại) của dòng PO này. */
  qty_received: number
  qty_missing: number
}

/** Dòng vượt NHƯNG trong dung sai (0156) — cho qua, ghi vết vào note. */
export type WithinTolerance = {
  po_line_id: string
  material_name: string
  /** % vượt so với SL đặt (cộng dồn mọi lần nhận) — nuôi note "[Vượt x%...]". */
  over_pct: number
}

export type ReceiptCheck =
  /** Có dòng không thuộc PO đang nhập. */
  | { ok: false; reason: 'unknown_line' }
  /** Vật tư của dòng phiếu khác vật tư của dòng PO. */
  | { ok: false; reason: 'material_mismatch'; po_line: ReceiptPoLine }
  /** Hợp lệ — `over` rỗng là nhận trong định mức (`within` = vượt trong dung sai). */
  | { ok: true; over: OverReceipt[]; within: WithinTolerance[] }

/** Sai số cho phép khi so số thực (numeric của Postgres về JS là float). */
const EPS = 1e-6

export function checkReceiptAgainstPo(
  lines: ReceiptDraftLine[],
  poLines: ReceiptPoLine[],
): ReceiptCheck {
  const byId = new Map(poLines.map((l) => [l.id, l]))
  // Gộp theo DÒNG PO: một phiếu có thể tách cùng một dòng thành nhiều lần nhập
  // (khác kệ, khác kết quả QC) — chỉ tổng mới nói được là có vượt hay không.
  const received = new Map<string, number>()
  for (const l of lines) {
    const po = l.po_line_id ? byId.get(l.po_line_id) : undefined
    if (!po) return { ok: false, reason: 'unknown_line' }
    if (po.material_id !== l.material_id) {
      return { ok: false, reason: 'material_mismatch', po_line: po }
    }
    received.set(po.id, (received.get(po.id) ?? 0) + l.qty + (l.qty_rejected ?? 0))
  }

  const over: OverReceipt[] = []
  const within: WithinTolerance[] = []
  for (const [poLineId, qty] of received) {
    const po = byId.get(poLineId)!
    if (qty - po.qty_missing <= EPS) continue // trong định mức
    // Dung sai trên SL đặt CỘNG DỒN: qty ≤ missing + ordered×pct ⇔
    // (đã nhận trước + phiếu này) ≤ ordered×(1+pct).
    const allowance = ((po.qty_ordered ?? 0) * (po.over_tolerance_pct ?? 0)) / 100
    if (qty - po.qty_missing <= allowance + EPS) {
      const ordered = po.qty_ordered ?? 0
      const cumulative = ordered - po.qty_missing + qty
      within.push({
        po_line_id: po.id,
        material_name: po.material_name,
        over_pct: ordered > 0 ? ((cumulative - ordered) / ordered) * 100 : 0,
      })
      continue
    }
    over.push({
      po_line_id: po.id,
      material_name: po.material_name,
      material_unit: po.material_unit,
      qty_received: qty,
      qty_missing: po.qty_missing,
    })
  }
  return { ok: true, over, within }
}

/** Câu mô tả phần vượt để ghép vào thông báo lỗi 409. */
export function describeOverReceipt(over: OverReceipt[]): string {
  return over
    .map(
      (o) =>
        `"${o.material_name}": nhận ${o.qty_received.toLocaleString('vi-VN')} ${o.material_unit}, còn thiếu ${o.qty_missing.toLocaleString('vi-VN')}`,
    )
    .join('; ')
}

/** Note ghi vết vượt-trong-dung-sai — dán vào note dòng phiếu (0156). */
export function withinToleranceNote(w: WithinTolerance): string {
  const pct = w.over_pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  return `[Vượt ${pct}% trong dung sai]`
}
