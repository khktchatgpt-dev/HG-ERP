/**
 * BẬC TẮC của một đơn hàng — đơn đang đứng ở khâu nào của chuỗi, và AI đang giữ
 * bóng. Logic thuần, có test; dùng cho Sổ đơn hàng của Ban Giám đốc.
 *
 * Vì sao cần, trong khi đã có `orderProgress`: hàm kia gom MỌI đơn sau khi lệnh
 * được ký vào đúng một nhãn "Chuẩn bị sản xuất 15%". Đo thật 15/08/2026: cả
 * 20/20 đơn đang mở đều hiện đúng dòng chữ đó — nhìn thì như nhau, thực tế
 * chúng chờ những phòng khác nhau làm những việc khác nhau. Sổ đơn của Giám đốc
 * cần câu trả lời "đang tắc ở đâu, ai gỡ", không phải một con số phần trăm.
 *
 * `orderProgress` GIỮ NGUYÊN cho thanh tiến độ (Sales + Theo dõi đơn) — hai hàm
 * trả lời hai câu hỏi khác nhau: "chạy được bao xa" ↔ "đang kẹt chỗ nào".
 */

export type GateKey =
  | 'lsx_none'
  | 'lsx_pending'
  | 'lsx_rejected'
  | 'bom'
  | 'po_none'
  | 'po_unsent'
  | 'material'
  | 'plan'
  | 'production'
  | 'to_deliver'
  | 'delivered'
  | 'cancelled'

/** Phòng đang giữ bóng — để Giám đốc biết gọi ai, không phải đi hỏi vòng. */
export type GateOwner =
  | 'Kinh doanh'
  | 'Ban Giám đốc'
  | 'Kỹ thuật'
  | 'Cung ứng'
  | 'Nhà cung cấp'
  | 'Kế hoạch SX'
  | 'Xưởng'
  | 'Kho'
  | '—'

export type GateInput = {
  status: string
  production_order_id: string | null
  lsx_status: string | null
  /** Số dòng SP chưa chốt định mức (BOM). */
  lines_bom_pending: number
  /** Đơn mua đã duyệt, chưa về đủ. */
  pos_open: number
  /** Đơn mua còn nháp / chờ ký. */
  pos_unsent: number
  /** TỔNG đơn mua của lệnh trừ đơn huỷ (0148) — 0 = chưa ai lập đơn nào. */
  pos_total: number
  /** Kho xác nhận vật tư về đủ (0148). */
  materials_received_at: string | null
  jobs_total: number
  jobs_done: number
}

export type Gate = {
  key: GateKey
  /** Nhãn ngắn cho chip/phễu. */
  label: string
  /** Câu nói rõ đang chờ CÁI GÌ — hiện trên dòng đơn. */
  detail: string
  owner: GateOwner
  /** Bậc trong chuỗi (0 = đầu vào, 9 = đã giao) — dùng để xếp phễu. */
  step: number
  /** Đơn đã đi hết chuỗi (không còn là việc đang chạy). */
  done: boolean
}

/**
 * Thứ tự bậc = thứ tự chuỗi thật của nhà máy. Cố ý KHÔNG suy ra từ
 * `sales_orders.status`: cột đó dừng ở 'lsx_issued' suốt từ lúc ký lệnh tới lúc
 * xong sản xuất, tức mù đúng đoạn dài nhất của vòng đời đơn.
 */
export const GATE_ORDER: GateKey[] = [
  'lsx_none',
  'lsx_pending',
  'lsx_rejected',
  'bom',
  'po_none',
  'po_unsent',
  'material',
  'plan',
  'production',
  'to_deliver',
  'delivered',
]

export function orderGate(r: GateInput): Gate {
  const g = (
    key: GateKey,
    label: string,
    detail: string,
    owner: GateOwner,
    step: number,
    done = false,
  ): Gate => ({ key, label, detail, owner, step, done })

  if (r.status === 'cancelled')
    return g('cancelled', 'Đã huỷ', 'Đơn đã huỷ', '—', 99, true)
  if (r.status === 'delivered')
    return g('delivered', 'Đã giao', 'Đã giao cho khách', '—', 10, true)
  if (r.status === 'completed')
    return g('to_deliver', 'Chờ giao', 'Hàng xong, chờ xuất giao khách', 'Kho', 9)

  if (!r.production_order_id)
    return g(
      'lsx_none',
      'Chưa phát lệnh',
      'Đơn chưa được phát lệnh sản xuất',
      'Kinh doanh',
      0,
    )
  if (r.lsx_status === 'rejected')
    return g(
      'lsx_rejected',
      'Lệnh bị trả',
      'Lệnh bị Giám đốc trả lại, chờ sửa',
      'Kinh doanh',
      1,
    )
  if (r.lsx_status === 'pending_approval')
    return g('lsx_pending', 'Chờ ký lệnh', 'Lệnh đang nằm ở Hộp ký', 'Ban Giám đốc', 2)

  // ── Từ đây là lệnh ĐÃ KÝ — đoạn mà mọi đơn trước nay bị gộp làm một ──────
  if (r.lines_bom_pending > 0)
    return g(
      'bom',
      'Chờ chốt định mức',
      `${r.lines_bom_pending} sản phẩm chưa chốt định mức — chưa tính được vật tư`,
      'Kỹ thuật',
      3,
    )

  // Định mức xong. Vật tư tới đâu?
  if (r.materials_received_at)
    return r.jobs_total === 0
      ? g(
          'plan',
          'Chờ lên kế hoạch',
          'Vật tư đã về đủ, chưa lên lộ trình sản xuất',
          'Kế hoạch SX',
          7,
        )
      : g(
          'production',
          'Đang sản xuất',
          `Đã xong ${r.jobs_done}/${r.jobs_total} công đoạn`,
          'Xưởng',
          8,
        )

  if (r.pos_unsent > 0)
    return g(
      'po_unsent',
      'Đơn mua chưa gửi',
      `${r.pos_unsent} đơn mua còn nháp hoặc chờ ký — chưa ra khỏi nhà`,
      'Cung ứng',
      5,
    )
  if (r.pos_open > 0)
    return g(
      'material',
      'Vật tư đang về',
      `${r.pos_open} đơn mua đã gửi, chờ nhà cung cấp giao`,
      'Nhà cung cấp',
      6,
    )
  if (r.pos_total === 0)
    return g(
      'po_none',
      'Chưa mua vật tư',
      'Định mức đã chốt nhưng chưa lập đơn mua nào',
      'Cung ứng',
      4,
    )

  /*
   * pos_total > 0 mà không còn đơn nào mở/chưa gửi ⇒ mọi đơn mua đã nhận xong,
   * chỉ là Kho chưa bấm xác nhận "vật tư về đủ" cho lệnh. Coi như vật tư ổn và
   * đẩy tiếp theo tiến độ sản xuất — nhưng vẫn nói rõ mốc còn thiếu, vì thiếu
   * nó thì `materials_received_at` ở trên không bao giờ đúng.
   */
  if (r.jobs_total === 0)
    return g(
      'plan',
      'Chờ lên kế hoạch',
      'Vật tư đã nhận, chưa lên lộ trình sản xuất',
      'Kế hoạch SX',
      7,
    )
  return g(
    'production',
    'Đang sản xuất',
    `Đã xong ${r.jobs_done}/${r.jobs_total} công đoạn`,
    'Xưởng',
    8,
  )
}
