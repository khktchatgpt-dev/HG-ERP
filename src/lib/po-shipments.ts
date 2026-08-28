/**
 * ĐỢT GIAO của đơn đặt vật tư — logic thuần, có test (plan-po-giao-nhan GĐ1).
 *
 * NCC không đăng nhập: "NCC xác nhận" là nhân viên cung ứng ghi lại cam kết sau
 * cuộc gọi/Zalo. Phần thuần ở đây gác hai việc: (1) input đợt giao có hợp lệ
 * với đơn không, (2) đơn nên mang `expected_at` nào sau khi kế hoạch giao đổi.
 */

export type ShipmentLineInput = { po_line_id: string; qty: number }
export type ShipmentInput = {
  expected_date: string
  note?: string | null
  lines: ShipmentLineInput[]
}

export type PoLineForShipment = { id: string; qty_ordered: number; name: string }

export type ShipmentValidation = {
  /** Lỗi CHẶN — không ghi được. */
  errors: string[]
  /**
   * Cảnh báo KHÔNG chặn: NCC xác nhận ÍT hơn đặt là chuyện thật ngoài đời
   * (hết hàng, giao bù sau) — hiện vàng cho người mua biết mà đòi phần thiếu,
   * nhưng không bắt họ sửa số cho khớp một cam kết không có thật.
   */
  warnings: string[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/**
 * Kiểm tra bộ đợt giao so với dòng đơn. `existing` = SL đã nằm trong các đợt
 * CÒN SỐNG khác (khi thêm đợt mới vào đơn đã xác nhận) — cộng dồn để tổng mọi
 * đợt không vượt SL đặt của dòng.
 */
export function validateShipments(
  shipments: ShipmentInput[],
  poLines: PoLineForShipment[],
  existing: Map<string, number> = new Map(),
): ShipmentValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const byId = new Map(poLines.map((l) => [l.id, l]))

  if (shipments.length === 0) errors.push('Chưa có đợt giao nào')

  const total = new Map<string, number>(existing)
  for (const [i, s] of shipments.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.expected_date)) {
      errors.push(`Đợt ${i + 1}: chưa chọn ngày giao`)
    }
    if (s.lines.length === 0) errors.push(`Đợt ${i + 1}: chưa có dòng hàng nào`)
    const seen = new Set<string>()
    for (const line of s.lines) {
      const po = byId.get(line.po_line_id)
      if (!po) {
        errors.push(`Đợt ${i + 1}: có dòng không thuộc đơn này`)
        continue
      }
      if (seen.has(line.po_line_id)) {
        errors.push(`Đợt ${i + 1}: "${po.name}" bị lặp hai lần trong một đợt`)
      }
      seen.add(line.po_line_id)
      if (!(line.qty > 0)) {
        errors.push(`Đợt ${i + 1}: "${po.name}" phải có số lượng > 0`)
        continue
      }
      total.set(line.po_line_id, (total.get(line.po_line_id) ?? 0) + line.qty)
    }
  }

  for (const [lineId, sum] of total) {
    const po = byId.get(lineId)
    if (!po) continue
    // So sánh có dung sai 1/10.000 — số thập phân cộng dồn không được phép
    // bật lỗi "vượt đặt" chỉ vì 0.30000000000000004.
    if (sum > po.qty_ordered + 1e-4) {
      errors.push(
        `"${po.name}": các đợt cộng lại ${fmt(sum)} vượt SL đặt ${fmt(po.qty_ordered)}`,
      )
    } else if (sum < po.qty_ordered - 1e-4) {
      warnings.push(
        `"${po.name}": NCC mới xác nhận ${fmt(sum)}/${fmt(po.qty_ordered)} — phần thiếu cần đòi giao bổ sung`,
      )
    }
  }
  // Dòng không xuất hiện trong đợt nào = NCC chưa hứa gì cho nó — cũng phải nói.
  for (const po of poLines) {
    if (!total.has(po.id)) {
      warnings.push(`"${po.name}": chưa nằm trong đợt giao nào`)
    }
  }

  return { errors, warnings }
}

/**
 * `expected_at` của ĐƠN sau khi kế hoạch giao đổi = ngày sớm nhất trong các đợt
 * còn sống. Đồng bộ về cột cũ để TOÀN BỘ cảnh báo hiện có (assessPoLate, badge,
 * Hàng sắp về) chạy nguyên không sửa dòng nào. `null` = không còn đợt sống nào
 * (caller giữ nguyên expected_at cũ — đừng xoá mốc của đơn).
 */
export function earliestExpectedDate(
  shipments: { expected_date: string; status: string }[],
): string | null {
  const alive = shipments
    .filter((s) => s.status === 'planned' || s.status === 'arrived')
    .map((s) => s.expected_date)
    .sort()
  return alive[0] ?? null
}

/** Đợt kế tiếp cần khai `seq` nào — nối tiếp lớn nhất, kể cả đợt đã huỷ. */
export function nextSeq(shipments: { seq: number }[]): number {
  return shipments.reduce((m, s) => Math.max(m, s.seq), 0) + 1
}

/**
 * TIỀN CỦA MỘT ĐỢT (28/08/2026 — feedback: đơn số lượng lớn thường 1 vật tư,
 * hàng chia đợt, cần thấy "đợt này khoảng bao nhiêu tiền" mà không tách PO con).
 *
 * Giá KHÔNG đổi theo đợt (user chốt) nên tiền đợt = thành tiền dòng × tỷ lệ SL
 * đợt trên SL đặt — chia TỶ LỆ chứ không nhân `qty × unit_price` trực tiếp, vì
 * dòng tính giá theo đơn vị 2 (đ/kg trong khi SL đặt theo cây, 0053) thì đơn
 * giá không đi với đơn vị của SL đợt; tỷ lệ thì đúng với cả hai kiểu giá.
 *
 * Đây là SỐ KẾ HOẠCH để đối chiếu với NCC — tiền phải trả thật vẫn theo phiếu
 * nhập kho (công nợ NCC tính từng PNK). Dòng giá kg (`unit2`) mang cờ `approx`:
 * kg thật cân ở bàn cân lúc nhận, kế hoạch chỉ là ước.
 */
export type ShipmentLineMoney = {
  /** Thành tiền của CẢ DÒNG (poLineAmount) — null khi dòng chưa có giá. */
  amount: number | null
  qty_ordered: number
  /** true = giá theo đơn vị 2 (kg/m²) — tiền đợt là ước tính theo tỷ lệ. */
  approx: boolean
}

export function shipmentAmount(
  lines: ShipmentLineInput[],
  moneyByLine: Map<string, ShipmentLineMoney>,
): { amount: number; approx: boolean; priced: boolean } {
  let amount = 0
  let approx = false
  let priced = false
  for (const l of lines) {
    const m = moneyByLine.get(l.po_line_id)
    if (!m || m.amount == null || !(m.qty_ordered > 0)) continue
    priced = true
    amount += m.amount * (l.qty / m.qty_ordered)
    if (m.approx) approx = true
  }
  return { amount, approx, priced }
}

/**
 * ĐÃ VỀ BAO NHIÊU CỦA TỪNG ĐỢT — theo THỰC TẾ vận hành (chỉnh 28/08/2026).
 *
 * Luồng thật: màn nhập kho dựng quanh đợt giao — PNK thường NỐI `shipment_id`
 * (0153), tức "đợt này về mấy" phần lớn nằm TRONG CHỨNG TỪ. Nên:
 *
 *   1. SỐ CHỨNG TỪ TRƯỚC (`linked`): PNK nối đợt nào thì cộng thẳng vào đợt
 *      ấy, không cắt trần theo kế hoạch — Kho nhận vượt trong dung sai là
 *      chuyện thật, số phiếu thắng số hẹn.
 *   2. PHẦN KHÔNG NỐI ĐỢT còn lại (giao đột xuất, đơn trước 0152) mới suy
 *      diễn — và rót theo ĐỘ CHẮC thực tế chứ không mù theo số thứ tự:
 *      đợt 'received' (Kho đã nhận xong) → 'arrived' (xe đã tới cổng) →
 *      'planned'; cùng hạng thì ngày hẹn sớm trước. Nhờ vậy NCC giao chéo
 *      (đợt 2 về trước) mà Cung ứng có bấm "Xe tới" là số rơi đúng đợt.
 *
 * Kết quả từng dòng mang cờ `exact`: false = có phần suy diễn → UI hiện ≈.
 * Sổ thật vẫn là cột "Đã về" của dòng đơn (BR-08); đây là số đối chiếu.
 */
export type ShipmentReceipt = { qty: number; exact: boolean }

const STATUS_RANK: Record<string, number> = { received: 0, arrived: 1, planned: 2 }

export function allocateReceiptsToShipments(
  shipments: {
    id: string
    seq: number
    status: string
    expected_date: string
    lines: ShipmentLineInput[]
  }[],
  receivedByLine: Map<string, number>,
  /** Số đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id) — đợt × dòng đơn. */
  linked: Map<string, Map<string, number>> = new Map(),
): Map<string, Map<string, ShipmentReceipt>> {
  const pool = new Map(receivedByLine)
  const out = new Map<string, Map<string, ShipmentReceipt>>()
  const alive = shipments.filter((s) => s.status !== 'cancelled')

  // 1. Chứng từ trước — trừ khỏi bể chưa-phân-bổ.
  for (const s of alive) {
    const per = new Map<string, ShipmentReceipt>()
    for (const l of s.lines) {
      const got = linked.get(s.id)?.get(l.po_line_id) ?? 0
      if (got <= 0) continue
      per.set(l.po_line_id, { qty: got, exact: true })
      pool.set(l.po_line_id, Math.max((pool.get(l.po_line_id) ?? 0) - got, 0))
    }
    out.set(s.id, per)
  }

  // 2. Phần không nối đợt: rót theo độ chắc (received → arrived → planned),
  //    cùng hạng thì ngày hẹn sớm trước; trần = SL hẹn trừ phần chứng từ.
  const order = [...alive].sort(
    (a, b) =>
      (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
      a.expected_date.localeCompare(b.expected_date) ||
      a.seq - b.seq,
  )
  for (const s of order) {
    const per = out.get(s.id) ?? new Map<string, ShipmentReceipt>()
    for (const l of s.lines) {
      const have = pool.get(l.po_line_id) ?? 0
      if (have <= 0) continue
      const already = per.get(l.po_line_id)
      const cap = Math.max(l.qty - (already?.qty ?? 0), 0)
      if (cap <= 0) continue
      const take = Math.min(have, cap)
      per.set(l.po_line_id, { qty: (already?.qty ?? 0) + take, exact: false })
      pool.set(l.po_line_id, have - take)
    }
    out.set(s.id, per)
  }
  return out
}

/**
 * ĐỢT GIAO KHAI NGAY TRONG FORM SOẠN ĐƠN (28/08/2026).
 *
 * Lúc soạn, dòng hàng CHƯA có id trong DB — nên form gửi đợt theo `line_index`
 * (thứ tự dòng trên lưới), server ánh xạ sang `po_line_id` sau khi ghi dòng.
 * Ánh xạ chạy được vì `replaceLines` ghi `sort_order` đúng bằng chỉ số mảng và
 * `listLines` đọc lại theo `sort_order` — hai đầu cùng một thứ tự.
 *
 * Index trỏ ra ngoài mảng thì BỎ dòng đó thay vì ném: người dùng xoá bớt dòng
 * hàng sau khi đã chia đợt là chuyện thường; mất một mảnh kế hoạch còn hơn
 * chặn cả lượt lưu đơn. Đợt rỗng sau khi lọc cũng bỏ luôn.
 */
export function mapDraftShipments(
  drafts: { expected_date: string; note?: string | null; lines: { line_index: number; qty: number }[] }[],
  lineIds: string[],
): ShipmentInput[] {
  const out: ShipmentInput[] = []
  for (const d of drafts) {
    const lines: ShipmentLineInput[] = []
    for (const l of d.lines) {
      const id = lineIds[l.line_index]
      if (!id || !(l.qty > 0)) continue
      const cur = lines.find((x) => x.po_line_id === id)
      // Cùng một dòng khai hai lần trong CÙNG đợt thì cộng lại — validate sau
      // đó bắt "lặp hai lần" và chặn oan một thứ người dùng thấy là hợp lý.
      if (cur) cur.qty += l.qty
      else lines.push({ po_line_id: id, qty: l.qty })
    }
    if (lines.length > 0) out.push({ expected_date: d.expected_date, note: d.note ?? null, lines })
  }
  return out
}
