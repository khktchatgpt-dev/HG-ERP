import { assessPoLate } from '@/lib/late-risk'
import type { Po } from './PosManager'

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
  pending: number
  open: number
  received: number
  cancelled: number
  late: number
}

const OPEN_STATUSES = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']

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
    pending: 0,
    open: 0,
    received: 0,
    cancelled: 0,
    late: 0,
  }
}

function tally(g: PoGroup, p: Po, today: string): void {
  g.pos.push(p)
  // Cộng tiền chỉ gộp đơn CÙNG loại tiền với đơn đầu nhóm — cộng thẳng USD vào
  // VND ra một con số vô nghĩa mà nhìn vẫn như thật.
  if (p.currency === g.currency && p.status !== 'cancelled') g.total += p.total ?? 0
  if (p.status === 'pending_approval') g.pending++
  if (OPEN_STATUSES.includes(p.status)) g.open++
  if (p.status === 'received') g.received++
  if (p.status === 'cancelled') g.cancelled++
  if (assessPoLate(p, today) === 'overdue') g.late++
}

export function groupPosByLsx(
  pos: Po[],
  lsxs: LsxRef[],
  today: string,
): { groups: PoGroup[]; standalone: PoGroup; emptyLsxs: LsxRef[] } {
  const byId = new Map<string, PoGroup>()
  const standalone = emptyGroup('@standalone', 'Ngoài LSX')

  for (const p of pos) {
    if (!p.lsx_code) {
      if (standalone.pos.length === 0) standalone.currency = p.currency
      tally(standalone, p, today)
      continue
    }
    // Khoá theo id khi có; đơn cũ chỉ còn mã LSX thì khoá theo mã — không gộp
    // nhầm hai lệnh khác nhau, và cũng không tách một lệnh làm hai nhóm.
    const key = p.production_order_id ?? `code:${p.lsx_code}`
    let g = byId.get(key)
    if (!g) {
      g = emptyGroup(key, p.lsx_code)
      g.order_code = p.order_code
      g.currency = p.currency
      byId.set(key, g)
    }
    tally(g, p, today)
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
