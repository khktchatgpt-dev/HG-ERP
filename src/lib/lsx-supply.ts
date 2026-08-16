/**
 * VẬT TƯ THEO LỆNH SẢN XUẤT — góc nhìn của phòng Cung ứng. Logic thuần, có test.
 *
 * VÌ SAO CẦN, trong khi đã có `orderGate`: hàm kia trả lời cho Giám đốc câu
 * "ĐƠN HÀNG đang tắc ở khâu nào của cả chuỗi" — chạy suốt từ lúc chưa phát lệnh
 * tới lúc giao khách, và đơn vị của nó là ĐƠN HÀNG. Người mua hỏi câu hẹp hơn
 * nhưng sâu hơn, và trên một đơn vị KHÁC: "LỆNH này vật tư tới đâu, tôi còn
 * phải làm gì". Một lệnh gộp nhiều đơn hàng (0113) nên hai đơn vị không quy đổi
 * cho nhau được — xem `bomPendingByLsx` bên dưới để thấy chỗ dễ sai nhất.
 *
 * Sáu bậc dưới đây xếp theo đúng đường đi của vật tư, và mỗi bậc nói rõ AI đang
 * giữ bóng — người mua mở màn này để biết hôm nay gọi cho ai.
 */

export type LsxSupplyGateKey = 'none' | 'unsent' | 'late' | 'inflight' | 'done'

export type LsxSupplyOwner = 'Cung ứng' | 'Nhà cung cấp' | 'Kho' | '—'

export type LsxSupplyInput = {
  /** Kho xác nhận vật tư của lệnh về đủ — mốc dứt khoát, không phải suy từ PO. */
  materials_received_at: string | null
  /** Đơn mua CÒN SỐNG của lệnh (trừ đơn đã huỷ). */
  posTotal: number
  /** Đơn còn nháp / chờ Giám đốc ký — chưa ra khỏi nhà. */
  posUnsent: number
  /** Đơn đã duyệt, chưa về đủ — vật tư đang trên đường. */
  posOpen: number
  /** Đơn đã gửi mà quá hẹn giao. */
  posLate: number
}

export type LsxSupplyGate = {
  key: LsxSupplyGateKey
  label: string
  /** Một câu nói rõ đang chờ CÁI GÌ — hiện ngay trên dòng lệnh. */
  detail: string
  owner: LsxSupplyOwner
  /**
   * Việc CỦA CUNG ỨNG — quyết định dòng có được đẩy lên đầu danh sách không.
   * Bậc `inflight` thì không: NCC đang lo, người mua vẫn cần thấy nhưng không
   * phải việc hôm nay.
   */
  mine: boolean
  /** Bậc trên đường đi của vật tư (1 = đầu, 5 = xong). */
  step: number
}

const GATES: Record<LsxSupplyGateKey, Omit<LsxSupplyGate, 'detail'>> = {
  none: {
    key: 'none',
    label: 'Chưa lập đơn mua',
    owner: 'Cung ứng',
    mine: true,
    step: 1,
  },
  unsent: {
    key: 'unsent',
    label: 'Đơn chưa gửi NCC',
    owner: 'Cung ứng',
    mine: true,
    step: 2,
  },
  late: {
    key: 'late',
    label: 'Nhà cung cấp trễ',
    owner: 'Nhà cung cấp',
    mine: true,
    step: 3,
  },
  inflight: {
    key: 'inflight',
    label: 'Vật tư đang về',
    owner: 'Nhà cung cấp',
    mine: false,
    step: 4,
  },
  done: { key: 'done', label: 'Vật tư đã về đủ', owner: '—', mine: false, step: 5 },
}

export const LSX_SUPPLY_GATES = (Object.keys(GATES) as LsxSupplyGateKey[]).sort(
  (a, b) => GATES[a].step - GATES[b].step,
)

/**
 * Lệnh này vật tư đang ở bậc nào — SUY TỪ ĐƠN MUA, không từ định mức.
 *
 * Cố ý KHÔNG có bậc "chờ chốt định mức" dù `v_order_tracking` có sẵn cột
 * `lines_bom_pending`: phần định mức/BOM chưa được triển khai thật (chủ dự án
 * xác nhận 15/08/2026), nên cột đó đang đếm gần như MỌI sản phẩm là "chưa
 * xong". Bậc ấy sẽ nuốt hết mọi lệnh vào một nhãn "chờ Kỹ thuật" và che mất
 * tình trạng mua hàng thật — tệ hơn hẳn việc không có nó. Thêm lại khi BOM có
 * dữ liệu thật.
 *
 * `materials_received_at` xét trước mọi phép đếm PO: đó là chữ ký của Kho, dứt
 * khoát hơn suy diễn. Có lệnh mua thêm đơn lặt vặt sau khi Kho đã chốt đủ —
 * đếm PO sẽ kéo lệnh đã xong ngược về bậc "đang về".
 */
export function lsxSupplyGate(r: LsxSupplyInput): LsxSupplyGate {
  const g = (key: LsxSupplyGateKey, detail: string): LsxSupplyGate => ({
    ...GATES[key],
    detail,
  })

  if (r.materials_received_at) return g('done', 'Kho đã xác nhận vật tư về đủ')
  if (r.posTotal === 0) return g('none', 'Chưa có đơn mua nào cho lệnh này')
  if (r.posUnsent > 0) {
    return g('unsent', `${r.posUnsent} đơn còn nháp hoặc chờ ký — chưa ra khỏi nhà`)
  }
  if (r.posLate > 0) {
    return g('late', `${r.posLate} đơn đã quá hẹn giao — cần giục nhà cung cấp`)
  }
  if (r.posOpen > 0)
    return g('inflight', `${r.posOpen} đơn đã gửi, chờ nhà cung cấp giao`)
  /*
   * Còn sống mà không mở, không chưa-gửi ⇒ mọi đơn đã nhận xong, chỉ là Kho
   * chưa bấm xác nhận cho lệnh. Nói đúng thực tế thay vì vẽ ra một bậc giả:
   * chính cái mốc còn thiếu kia mới là việc cần ai đó làm nốt.
   */
  return g('done', 'Đơn mua đã nhận xong — chờ Kho xác nhận đủ cho lệnh')
}

// ── Mức khẩn theo HẠN VẬT TƯ PHẢI VỀ ──────────────────────────────────

export type DueLevel = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export const DUE_LEVEL_LABEL: Record<DueLevel, string> = {
  overdue: 'Quá hạn vật tư',
  today: 'Đến hạn hôm nay',
  soon: 'Sắp đến hạn',
  later: 'Còn thời gian',
  none: 'Chưa đặt hạn',
}

/** Số ngày còn lại tới hạn (âm = đã quá). `null` = lệnh chưa đặt hạn vật tư. */
export function daysUntilDue(dueIso: string | null, todayIso: string): number | null {
  if (!dueIso) return null
  return Math.round((Date.parse(dueIso.slice(0, 10)) - Date.parse(todayIso)) / 86_400_000)
}

/**
 * `soonDays` = bao nhiêu ngày nữa thì coi là sắp tới hạn. Mặc định 7 — khớp
 * `LATE_RISK_HORIZON_DAYS` của cảnh báo trễ, để hai màn không nói lệch nhau.
 */
export function dueLevel(
  dueIso: string | null,
  todayIso: string,
  soonDays = 7,
): DueLevel {
  const d = daysUntilDue(dueIso, todayIso)
  if (d === null) return 'none'
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  return d <= soonDays ? 'soon' : 'later'
}

// ── Xếp thứ tự: việc của tôi trước, khẩn trước ────────────────────────

const DUE_RANK: Record<DueLevel, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  later: 3,
  /*
   * Lệnh CHƯA ĐẶT HẠN xếp sau `soon` chứ không xếp cuối: không có hạn không có
   * nghĩa là không gấp, chỉ nghĩa là chưa ai đặt mốc — và một lệnh đang thiếu
   * vật tư mà không ai đặt hạn thì đúng là thứ cần được nhìn thấy.
   */
  none: 2.5,
}

export type SortableLsx = { gate: LsxSupplyGate; due: DueLevel; code: string }

/**
 * Đầu danh sách phải là thứ người mua làm ĐẦU TIÊN sáng nay.
 *
 * Ba tầng: (1) việc của Cung ứng trước, (2) hạn vật tư gấp trước, (3) mã lệnh
 * giảm dần cho ổn định. Không xếp theo bậc vòng đời — bậc chỉ mô tả, không nói
 * lên mức gấp: một lệnh "đang về" mà quá hạn cần nhìn trước một lệnh "chưa lập
 * đơn" còn ba tuần nữa mới tới hạn.
 */
export function compareForSupply(a: SortableLsx, b: SortableLsx): number {
  if (a.gate.mine !== b.gate.mine) return a.gate.mine ? -1 : 1
  const dr = DUE_RANK[a.due] - DUE_RANK[b.due]
  if (dr !== 0) return dr
  return b.code.localeCompare(a.code, 'vi', { numeric: true })
}

/*
 * GHI CHÚ CHO NGƯỜI SAU — vì sao màn này tự đếm đơn mua thay vì đọc
 * `v_order_tracking`, dù view có sẵn `pos_open` / `pos_unsent` / `pos_total`:
 *
 * View trả MỖI ĐƠN HÀNG một dòng, mà một lệnh gộp nhiều đơn (0113). Ba cột
 * pos_* lại đếm theo LỆNH (`spo.production_order_id = po.id`), nên mọi dòng của
 * cùng một lệnh mang CÙNG một con số — cộng chúng lại là đếm hai ba lần (lệnh
 * gộp 3 đơn có 2 đơn mua sẽ ra 6). Ngoài ra view chỉ nhìn cột
 * `production_order_id` nên bỏ sót ĐƠN MUA CHUNG NHIỀU LỆNH (0125): lệnh phụ
 * trông như chưa đặt gì. Đếm từ danh sách PO đã nạp thì đúng cả hai chuyện.
 */
