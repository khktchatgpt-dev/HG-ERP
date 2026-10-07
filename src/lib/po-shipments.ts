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
  drafts: {
    expected_date: string
    note?: string | null
    lines: { line_index: number; qty: number }[]
  }[],
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
    if (lines.length > 0)
      out.push({ expected_date: d.expected_date, note: d.note ?? null, lines })
  }
  return out
}

/**
 * ĐỢT NÀY CÒN CHỜ KHO NHẬN KHÔNG — luật DÙNG CHUNG cho danh sách và cho form.
 *
 * Lỗi tìm ra 15/09/2026: màn "Nhập kho — chờ nhận" lọc đợt bằng cách LOẠI ĐƠN
 * ĐÃ HUỶ, còn form lập phiếu lại chỉ nạp đơn CHƯA VỀ ĐỦ. Hai luật khác nhau cho
 * cùng một câu hỏi, nên đơn `02/26HG/BT` đã VỀ ĐỦ mà 4 đợt `planned` bỏ quên
 * của nó vẫn nằm chình ình trong danh sách, ba lô còn bị tô "quá hẹn".
 *
 * Người dùng bấm "Lập phiếu nhập" từ đó thì rơi vào NGÕ CỤT im lặng: đơn không
 * có trong ô "Nguồn nhập" nên trình duyệt đá ô đó về rỗng, form trông vẫn bình
 * thường — điền xong bấm Lưu mới ăn lỗi "Đợt giao không thuộc đơn đặt đang
 * chọn", nói về một ô họ không hề động vào.
 *
 * Nên gom về MỘT hàm: đợt còn sống VÀ đơn còn nhận được. Hai chỗ gọi cùng một
 * luật thì không lệch lại được nữa.
 */
export function shipmentWaitingReceipt(
  poStatus: string,
  shipmentStatus: string,
): boolean {
  // Giống `RECEIVABLE` ở supply.repo — đã đặt trở đi, chưa về đủ, chưa huỷ.
  const NHAN_DUOC = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']
  const DOT_SONG = ['planned', 'arrived']
  return NHAN_DUOC.includes(poStatus) && DOT_SONG.includes(shipmentStatus)
}

/**
 * NCC XÁC NHẬN THAY LỊCH ĐỀ NGHỊ — nhưng KHÔNG xoá lịch cũ (P1, 27/09/2026).
 *
 * Trước đây `confirm` xoá sạch mọi đợt rồi chèn cam kết mới: mất lịch ĐỀ NGHỊ
 * lúc soạn (tức ngày mình cần hàng) — đúng thứ tình huống "cam kết ban đầu →
 * thay đổi → thực tế" cần giữ; và phiếu nhập đã gắn một đợt (Kho nhận được từ
 * lúc đơn đã gửi) bị cắt liên kết (`on delete set null`), mã GH-… cũng mất.
 *
 * Nay: đợt đề nghị CHƯA có hàng (`planned`) chuyển thành "đã thay" (cancelled,
 * có ghi chú) — vẫn nằm trong sổ để đối chiếu; đợt đã có hàng (`arrived` /
 * `received`) giữ nguyên và tính vào SL đã hẹn; cam kết mới đánh số NỐI TIẾP.
 */
export function confirmReplacePlan(
  current: {
    id: string
    seq: number
    status: string
    lines: { po_line_id: string; qty: number }[]
  }[],
): { cancelIds: string[]; keptQty: Map<string, number>; startSeq: number } {
  const cancelIds: string[] = []
  const keptQty = new Map<string, number>()
  for (const s of current) {
    if (s.status === 'planned') cancelIds.push(s.id)
    else if (s.status === 'arrived' || s.status === 'received') {
      for (const l of s.lines)
        keptQty.set(l.po_line_id, (keptQty.get(l.po_line_id) ?? 0) + l.qty)
    }
  }
  return { cancelIds, keptQty, startSeq: nextSeq(current) }
}

/**
 * TRẠNG THÁI ĐỢT THEO SỐ ĐÃ NHẬN CỘNG DỒN (27/09/2026).
 *
 * Bản cũ chốt đợt lúc ghi MỘT phiếu: phiếu đó phủ đủ mọi dòng của đợt thì
 * 'received', không thì 'arrived'. Hai lỗi đo được trên mã:
 *   · đợt nhận bằng HAI phiếu (sáng một nửa, chiều một nửa) không bao giờ
 *     'received' — mỗi phiếu riêng lẻ đều thiếu, đợt kẹt 'arrived' mãi;
 *   · nhận DƯ ở đợt 1 (hàng gấp, NCC chở luôn) không trừ đợt 2 — đợt 2 vẫn
 *     'planned' chờ đủ số cũ, lịch Hàng về + cảnh báo trễ kêu oan.
 *
 * Nay tính lại TỪ SỔ mỗi lần có phiếu nhập / trả / đảo: `receivedByLine` là số
 * thực nhận NET của dòng (cột qty_received, gồm cả QC loại — cùng cách đếm
 * BR-08). Rót vào đợt:
 *   1. phần CÓ CHỨNG TỪ nối đợt (`linked`) — trần = SL đợt, phần dư trả về bể;
 *   2. bể còn lại rót theo độ chắc (received → arrived → planned), cùng hạng
 *      thì hẹn sớm trước — nên dư đợt 1 tự lấp đợt 2.
 * Đợt phủ đủ mọi dòng → 'received'; có hàng mà chưa đủ → 'arrived'; không có
 * gì → giữ 'arrived' nếu đang là (xe đã tới / bị đảo phiếu) còn lại 'planned'.
 * Chỉ trả những đợt ĐỔI trạng thái; đợt huỷ không đụng.
 */
export function shipmentStatusesFromReceipts(
  shipments: {
    id: string
    seq: number
    status: string
    expected_date: string
    lines: ShipmentLineInput[]
  }[],
  receivedByLine: Map<string, number>,
  linked: Map<string, Map<string, number>> = new Map(),
): Map<string, 'planned' | 'arrived' | 'received'> {
  const EPS = 1e-4
  const alive = shipments.filter((s) => s.status !== 'cancelled')
  const pool = new Map(receivedByLine)
  const got = new Map<string, Map<string, number>>()
  const take = (sid: string, lineId: string, want: number) => {
    const have = pool.get(lineId) ?? 0
    const q = Math.max(Math.min(have, want), 0)
    if (q <= 0) return
    pool.set(lineId, have - q)
    const per = got.get(sid) ?? new Map<string, number>()
    per.set(lineId, (per.get(lineId) ?? 0) + q)
    got.set(sid, per)
  }
  for (const s of alive)
    for (const l of s.lines) take(s.id, l.po_line_id, Math.min(linked.get(s.id)?.get(l.po_line_id) ?? 0, l.qty)) // prettier-ignore
  const order = [...alive].sort(
    (a, b) =>
      (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
      a.expected_date.localeCompare(b.expected_date) ||
      a.seq - b.seq,
  )
  for (const s of order)
    for (const l of s.lines) take(s.id, l.po_line_id, l.qty - (got.get(s.id)?.get(l.po_line_id) ?? 0)) // prettier-ignore

  const out = new Map<string, 'planned' | 'arrived' | 'received'>()
  for (const s of alive) {
    const per = got.get(s.id)
    const full = s.lines.length > 0 && s.lines.every((l) => (per?.get(l.po_line_id) ?? 0) >= l.qty - EPS) // prettier-ignore
    const some = s.lines.some((l) => (per?.get(l.po_line_id) ?? 0) > EPS)
    const next = full ? 'received' : some ? 'arrived' : s.status === 'arrived' || s.status === 'received' ? 'arrived' : 'planned' // prettier-ignore
    if (next !== s.status) out.set(s.id, next)
  }
  return out
}

/**
 * "LẤY TRƯỚC" — TÁCH MỘT ĐỢT THÀNH PHẦN GẤP + PHẦN CÒN LẠI (27/09/2026).
 *
 * Thực tế xưởng: hàng cần gấp, NV cung ứng gọi NCC lấy trước một phần của đợt
 * đã hẹn (hoặc tự đi lấy). Trước đây chỉ có đường huỷ đợt rồi khai lại hai đợt
 * — mất mã GH, mất vết "đợt này từng hẹn ngày nào". Nay tách tại chỗ: đợt gốc
 * giữ mã + ngày, bớt đúng phần kéo lên; phần kéo lên thành đợt MỚI ngày sớm hơn.
 *
 * Lấy hết mọi dòng của đợt = thực chất là dời ngày → báo lỗi chỉ sang "Dời".
 */
export function splitShipmentLines(
  current: ShipmentLineInput[],
  pull: ShipmentLineInput[],
  names: Map<string, string> = new Map(),
): { remain: ShipmentLineInput[]; pulled: ShipmentLineInput[]; errors: string[] } {
  const errors: string[] = []
  const have = new Map(current.map((l) => [l.po_line_id, l.qty]))
  const pulled: ShipmentLineInput[] = []
  for (const p of pull) {
    if (!(p.qty > 0)) continue
    const name = names.get(p.po_line_id) ?? 'Dòng'
    const cur = have.get(p.po_line_id)
    if (cur == null) {
      errors.push(`"${name}" không nằm trong đợt này`)
      continue
    }
    if (p.qty > cur + 1e-4) errors.push(`"${name}": lấy trước ${fmt(p.qty)} vượt số của đợt ${fmt(cur)}`) // prettier-ignore
    pulled.push({ po_line_id: p.po_line_id, qty: Math.min(p.qty, cur) })
    have.set(p.po_line_id, cur - Math.min(p.qty, cur))
  }
  if (pulled.length === 0) errors.push('Chưa nhập số lượng lấy trước cho dòng nào')
  const remain = current
    .map((l) => ({
      po_line_id: l.po_line_id,
      qty: Math.round((have.get(l.po_line_id) ?? 0) * 10000) / 10000,
    })) // prettier-ignore
    .filter((l) => l.qty > 1e-4)
  if (errors.length === 0 && remain.length === 0)
    errors.push('Lấy trước toàn bộ đợt = dời ngày cả đợt — dùng "Dời đợt"')
  return { remain, pulled, errors }
}

/**
 * TÁCH ĐỢT THEO PHIẾU NHẬP (07/10/2026 — PO-2026-0084).
 *
 * Ca thật: lúc NCC xác nhận chỉ khai MỘT đợt ôm 100% số đặt; NCC giao lẻ nhiều
 * chuyến; Kho nhập hai phiếu không nối đợt. Đợt đó đã "xe tới" nên Sửa / Lấy
 * trước bị chặn, Thêm đợt thì "vượt SL đặt" — không còn đường nào ghi đúng.
 *
 * Luật (chủ dự án chốt 07/10): MỖI PHIẾU NHẬP MỘT ĐỢT "Đã nhận". Phiếu SỚM
 * NHẤT ở lại đợt gốc (giữ mã GH + ngày hẹn cũ — đo NCC trễ so với cam kết
 * đầu); các phiếu sau thành đợt mới, ngày = ngày phiếu. Phần còn chờ = số của
 * đợt gốc trừ số đã về, chia thành một hay nhiều đợt hẹn mới.
 *
 * Số "đã về" của phiếu tính cả phần loại QC (BR-08 — NCC đã giao), cùng nghĩa
 * với `loadReceiptBatches` / `receiptsByShipment`.
 */
export type ReceiptForSplit = {
  doc_id: string
  doc_code: string
  /** yyyy-mm-dd — ngày chứng từ (ngày hàng về thật). */
  date: string
  lines: ShipmentLineInput[]
}

export type SplitPlan = {
  /** Phiếu theo thứ tự ngày — phiếu [0] ở lại đợt gốc. */
  receipts: ReceiptForSplit[]
  /** Phần còn chờ theo dòng (> 0) — mặc định gom một đợt hẹn mới. */
  rest: ShipmentLineInput[]
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

export function planSplitByReceipts(
  shipment: { lines: ShipmentLineInput[] },
  receipts: ReceiptForSplit[],
): SplitPlan | null {
  const used = receipts.filter((r) => r.lines.some((l) => l.qty > 1e-4))
  if (used.length === 0) return null
  const sorted = [...used].sort(
    (a, b) => a.date.localeCompare(b.date) || a.doc_code.localeCompare(b.doc_code),
  )
  const came = new Map<string, number>()
  for (const r of sorted)
    for (const l of r.lines) came.set(l.po_line_id, (came.get(l.po_line_id) ?? 0) + l.qty)
  const rest = shipment.lines
    .map((l) => ({
      po_line_id: l.po_line_id,
      qty: r4(Math.max(0, l.qty - (came.get(l.po_line_id) ?? 0))),
    })) // prettier-ignore
    .filter((l) => l.qty > 1e-4)
  return { receipts: sorted, rest }
}

/**
 * Kiểm phần còn chờ người dùng chia: mỗi dòng cộng các đợt hẹn mới phải ĐÚNG
 * bằng phần còn chờ (bớt đi là việc của "Chốt thiếu", thêm vào là vượt cam
 * kết), mỗi đợt có ngày, không ngày nào trước hôm nay.
 */
export function validateSplitRest(
  plan: SplitPlan,
  restShipments: ShipmentInput[],
  today: string,
  names: Map<string, string> = new Map(),
): string[] {
  const errors: string[] = []
  if (plan.rest.length > 0 && restShipments.length === 0) {
    errors.push('Phần còn chờ chưa xếp vào đợt nào')
  }
  const sum = new Map<string, number>()
  for (const [i, s] of restShipments.entries()) {
    const label = `Đợt hẹn ${i + 1}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.expected_date))
      errors.push(`${label}: chưa chọn ngày`)
    else if (s.expected_date < today) errors.push(`${label}: ngày hẹn đã qua`)
    const lines = s.lines.filter((l) => l.qty > 1e-4)
    if (lines.length === 0) errors.push(`${label}: chưa có số lượng dòng nào`)
    for (const l of lines) sum.set(l.po_line_id, (sum.get(l.po_line_id) ?? 0) + l.qty)
  }
  const want = new Map(plan.rest.map((l) => [l.po_line_id, l.qty]))
  for (const id of new Set([...want.keys(), ...sum.keys()])) {
    const w = want.get(id) ?? 0
    const g = sum.get(id) ?? 0
    if (Math.abs(w - g) > 1e-4) {
      errors.push(`"${names.get(id) ?? 'Dòng'}": các đợt hẹn cộng ${fmt(g)}, phần còn chờ là ${fmt(w)}`) // prettier-ignore
    }
  }
  return errors
}
