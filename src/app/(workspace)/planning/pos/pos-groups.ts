import { assessPoLate } from '@/lib/late-risk'
import { PO_OPEN_STATUSES } from '@/lib/po-status'
import type { Po } from './po-types'

/**
 * GOM ĐƠN ĐẶT HÀNG THEO LỆNH SẢN XUẤT.
 *
 * Danh sách phẳng trả lời được "đơn PO-2026-0007 tới đâu rồi", nhưng câu người
 * làm kế hoạch hỏi mỗi ngày là câu ngược lại: "lệnh này đã đặt những gì, còn
 * thiếu NCC nào chưa đặt". Với danh sách phẳng thì phải lọc theo từng LSX rồi
 * tự cộng nhẩm.
 *
 * Ba khối trả về, đúng thứ tự cần nhìn:
 *   1. `groups`     — mỗi LSX một nhóm, kèm số liệu cộng sẵn của cả nhóm.
 *   2. `standalone` — đơn ngoài LSX (mua bù tồn, vật tư tiêu hao) gom một chỗ.
 *   3. `emptyLsxs`  — LSX đang chạy mà CHƯA có đơn nào. Đây mới là thứ đáng lo,
 *      và danh sách phẳng không thể hiện được vì nó chỉ vẽ cái đã có.
 */

export type LsxRef = {
  id: string
  code: string
  /** Mã các đơn của lệnh (0113 — một lệnh gộp nhiều đơn). */
  order_codes: string[]
  customer_name: string
  /** Hạn VẬT TƯ phải về (0126) — đèn "Kịp SX?" so với mốc này. */
  materials_due_at: string | null
}

export type PoGroup = {
  /** `production_order_id`, hoặc mã LSX khi lệnh không còn trong danh sách đang chạy. */
  key: string
  lsx_code: string
  order_code: string | null
  customer_name: string | null
  /** id LSX thật (đặt hạn được) — null với nhóm ngoài LSX / lệnh đã đóng. */
  lsx_id: string | null
  /** Hạn VẬT TƯ phải về của lệnh (0126). */
  materials_due_at: string | null
  pos: Po[]
  /** Cộng sẵn cho đầu nhóm — người dùng khỏi tự nhẩm. */
  total: number
  currency: string
  /**
   * Tiền của các LOẠI TIỀN KHÁC trong nhóm (28/08). `total` cố ý chỉ cộng đơn
   * cùng loại tiền với đơn đầu nhóm — nhưng nếu không kể ra phần còn lại thì
   * thẻ ghi "2 đơn · 4.500.000 VND" trong khi thật ra còn 12.500 USD nữa:
   * người xem đọc thành tổng của cả nhóm và tin vào một con số thiếu.
   */
  otherTotals: { currency: string; total: number }[]
  pending: number
  open: number
  received: number
  cancelled: number
  late: number
  /**
   * TIẾN ĐỘ VỀ KHO CỦA CẢ LỆNH, đếm theo DÒNG đơn đặt (0126).
   *
   * Đầu thẻ trước đây chỉ đếm số đơn và cộng tiền — trả lời được "lệnh này đã
   * đặt mấy đơn", không trả lời được "lệnh này đã có hàng chưa", mà đó mới là
   * câu người kế hoạch hỏi. Cộng theo dòng chứ không theo số lượng: 500 con vít
   * cộng với 3 kg nhôm ra một con số vô nghĩa.
   *
   * Chỉ cộng đơn CÒN SỐNG — đơn đã huỷ không nợ hàng ai.
   */
  linesDone: number
  linesTotal: number
  /**
   * Id các đơn nằm trong nhóm này với tư cách LỆNH PHỤ (0125) — đơn thuộc về
   * lệnh khác nhưng có mua vật tư cho lệnh này. Giao diện đánh dấu để không ai
   * tưởng đó là đơn riêng của lệnh, và tiền của chúng KHÔNG cộng vào `total` ở
   * đây (đã cộng ở lệnh chính rồi — cộng hai lần thì tổng chi phồng lên).
   */
  borrowed: Set<string>
}

function emptyGroup(key: string, lsx_code: string): PoGroup {
  return {
    key,
    lsx_code,
    order_code: null,
    customer_name: null,
    lsx_id: null,
    materials_due_at: null,
    pos: [],
    total: 0,
    currency: 'VND',
    otherTotals: [],
    pending: 0,
    open: 0,
    received: 0,
    cancelled: 0,
    late: 0,
    linesDone: 0,
    linesTotal: 0,
    borrowed: new Set(),
  }
}

/**
 * Xếp một đơn vào nhóm. `borrowed` = đơn của lệnh KHÁC, có mua hộ cho lệnh này.
 *
 * Đơn mượn vẫn được đếm vào các con số "còn việc" (chờ duyệt / quá hẹn / về
 * kho): với lệnh này thì vật tư đó có về hay không vẫn quyết định chạy được hay
 * không. Chỉ TIỀN là không cộng — tiền đã nằm ở lệnh chính.
 */
function tally(g: PoGroup, p: Po, today: string, borrowed = false): void {
  g.pos.push(p)
  if (borrowed) g.borrowed.add(p.id)
  // Cộng tiền chỉ gộp đơn CÙNG loại tiền với đơn đầu nhóm — cộng thẳng USD vào
  // VND ra một con số vô nghĩa mà nhìn vẫn như thật.
  if (!borrowed && p.status !== 'cancelled') {
    if (p.currency === g.currency) {
      g.total += p.total ?? 0
    } else {
      const cur = g.otherTotals.find((t) => t.currency === p.currency)
      if (cur) cur.total += p.total ?? 0
      else g.otherTotals.push({ currency: p.currency, total: p.total ?? 0 })
    }
  }
  if (p.status === 'pending_approval') g.pending++
  if (PO_OPEN_STATUSES.includes(p.status)) g.open++
  if (p.status === 'received') g.received++
  if (p.status === 'cancelled') g.cancelled++
  if (assessPoLate(p, today) === 'overdue') g.late++
  if (p.status !== 'cancelled') {
    g.linesDone += p.lines_done ?? 0
    g.linesTotal += p.lines_total ?? 0
  }
}

export function groupPosByLsx(
  pos: Po[],
  lsxs: LsxRef[],
  today: string,
): { groups: PoGroup[]; standalone: PoGroup; emptyLsxs: LsxRef[] } {
  const byId = new Map<string, PoGroup>()
  const standalone = emptyGroup('@standalone', 'Ngoài LSX')
  const lsxCodeById = new Map(lsxs.map((l) => [l.id, l.code]))

  const groupFor = (key: string, code: string, p: Po, borrowed = false) => {
    let g = byId.get(key)
    if (!g) {
      g = emptyGroup(key, code)
      // Mã ĐƠN HÀNG chỉ lấy từ đơn thuộc CHÍNH lệnh này. Đơn mượn mang mã đơn
      // hàng của lệnh khác — gán vào đây là dán nhầm tên khách lên thẻ.
      if (!borrowed) g.order_code = p.order_code
      g.currency = p.currency
      byId.set(key, g)
    }
    return g
  }

  for (const p of pos) {
    if (!p.lsx_code) {
      if (standalone.pos.length === 0) standalone.currency = p.currency
      tally(standalone, p, today)
      continue
    }
    // Khoá theo id khi có; đơn cũ chỉ còn mã LSX thì khoá theo mã — không gộp
    // nhầm hai lệnh khác nhau, và cũng không tách một lệnh làm hai nhóm.
    const key = p.production_order_id ?? `code:${p.lsx_code}`
    tally(groupFor(key, p.lsx_code, p), p, today)

    /*
     * ĐƠN GỘP NHIỀU LỆNH (0125) — hiện ở CẢ lệnh phụ.
     *
     * Đơn thật hay ghi "LSX 01+2+3/26-27": một đơn mua vật tư cho ba lệnh. Nếu
     * chỉ xếp vào lệnh chính thì hai lệnh kia trông như chưa đặt gì — và khối
     * cảnh báo cuối trang sẽ giục đặt lại thứ đã đặt rồi.
     */
    for (const ex of p.extra_lsx ?? []) {
      if (ex.id === p.production_order_id) continue
      const code = ex.code || lsxCodeById.get(ex.id) || '?'
      tally(groupFor(ex.id, code, p, true), p, today, true)
    }
  }

  // Tên khách lấy từ danh sách LSX đang chạy — bản thân đơn không mang tên khách.
  const lsxById = new Map(lsxs.map((l) => [l.id, l]))
  for (const g of byId.values()) {
    const l = lsxById.get(g.key)
    if (l) {
      g.customer_name = l.customer_name
      g.order_code = g.order_code ?? (l.order_codes.join(', ') || null)
      // Hạn VT phải về (0126) — đèn "Kịp SX?" của từng đơn trong nhóm so mốc này.
      g.lsx_id = l.id
      g.materials_due_at = l.materials_due_at
    }
  }

  // LSX mới nhất lên trước: mã LSX tăng dần theo thời gian nên xếp giảm dần là
  // đúng thứ tự người dùng đang làm việc.
  const groups = [...byId.values()].sort((a, b) =>
    b.lsx_code.localeCompare(a.lsx_code, 'vi', { numeric: true }),
  )

  const covered = new Set(byId.keys())
  const emptyLsxs = lsxs.filter((l) => !covered.has(l.id))

  return { groups, standalone, emptyLsxs }
}
