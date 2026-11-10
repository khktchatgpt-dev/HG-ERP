/**
 * NĂM CON SỐ CỦA MỘT (dòng ghi × công đoạn) — docs/san-xuat-cau-hinh-thiet-ke.md §3.4.
 *
 * Thuần, không chạm DB, một hàm cho mọi màn (Ghi sản lượng · Giao nhận · Hồ sơ
 * lệnh · Báo cáo). Hai màn cho hai số khác nhau cho cùng một ô là lỗi, dù hôm
 * nay chúng tình cờ bằng nhau — nên phép tính nằm ở MỘT chỗ.
 *
 *   xong      = Σ đạt (sổ công đoạn này)
 *   đã giao   = Σ phiếu giao đi từ công đoạn này (cả chờ nhận lẫn đã nhận)
 *   đã nhận   = Σ số NHẬN của phiếu đã xác nhận TỚI công đoạn này
 *   tồn       = xong − max(đã giao, đã ghi ở công đoạn KẾ)   (hàng xong còn nằm ở tổ)
 *   khả dụng  = đã nhận − đã ghi ở đây  (đầu vào còn trong tay để làm tiếp)
 *
 * "Đã ghi ở công đoạn kế" (`next_used`, 10/11/2026): hệ KHÔNG bắt lập phiếu
 * giao, nên khi công đoạn sau đã ghi sổ mà không ai lập PGT thì hàng rõ ràng đã
 * đi — đối xứng với `receivedOrFallback` ("đã nhận" xấp xỉ bằng xong công đoạn
 * trước). Lệnh TEST 10/11 đóng xong, xuất đủ mà Hồ sơ lệnh vẫn báo "tồn tại
 * công đoạn 140" (7 × 20) vì tồn chỉ trừ phiếu. Không truyền → như cũ.
 *
 * "Đã ghi ở đây" gồm đạt + phế + sửa lại: phế cũng ăn đầu vào.
 *
 * TRƯỚC B4 (chưa có phiếu giao nhận): màn Ghi sản lượng đưa `received` = số
 * XONG ở công đoạn liền trước trên lộ trình của chính dòng đó, `shipped` = 0.
 * Đó là xấp xỉ "xưởng tự chuyển, không lập phiếu"; khi B4 có phiếu thì nguồn
 * đổi, công thức không đổi. Công đoạn ĐẦU lộ trình không có "đã nhận" (đầu
 * vào là vật tư từ kho) → `received = null` → khả dụng = null, màn bày "—".
 */

export type WipInput = {
  /** Σ đạt chính thức ở công đoạn này. */
  done: number
  /** Σ phiếu giao đi từ công đoạn này. */
  shipped: number
  /** Σ nhận tới công đoạn này; null = đầu chuỗi, không có khái niệm nhận. */
  received: number | null
  /** Đạt + phế + sửa lại đã ghi ở công đoạn này (mọi trạng thái phiếu). */
  used: number
  /**
   * Đạt + phế + sửa lại đã ghi ở công đoạn KẾ TIẾP của chính dòng này — xấp xỉ
   * "đã giao" khi xưởng không lập phiếu. null/thiếu = không có công đoạn kế
   * hoặc không muốn suy (màn lập phiếu giao: phần "có thể giao" vẫn là xong −
   * phiếu, vì phiếu lập sau sổ là chuyện thật).
   */
  next_used?: number | null
}

export type WipNumbers = {
  done: number
  shipped: number
  received: number | null
  on_hand: number
  available: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function wipNumbers(x: WipInput): WipNumbers {
  return {
    done: r2(x.done),
    shipped: r2(x.shipped),
    received: x.received == null ? null : r2(x.received),
    on_hand: r2(x.done - Math.max(x.shipped, x.next_used ?? 0)),
    available: x.received == null ? null : r2(x.received - x.used),
  }
}

/**
 * Câu cảnh báo khi sắp ghi VƯỢT khả dụng. Cảnh báo, không chặn: xưởng có thể
 * chưa lập phiếu giao, và sổ đi trước phiếu là chuyện có thật.
 */
export function overAvailableWarning(
  name: string,
  stageLabel: string,
  available: number | null,
  adding: number,
): string | null {
  if (available == null) return null
  if (adding - available <= 0.001) return null
  return `${name} @ ${stageLabel}: khả dụng ${r2(available)} mà ghi ${r2(adding)} — vượt ${r2(adding - available)} so với số đã nhận từ công đoạn trước`
}

// ── Phiếu giao tổ (0289, B4): cộng dồn "đã giao" / "đã nhận" per (dòng × công đoạn) ──

export type TransferDocLike = {
  id: string
  from_stage: string
  to_stage: string
  status: 'da_giao' | 'da_nhan' | 'da_huy'
  /** Phiếu ĐẢO của phiếu nào — from/to đã hoán đổi so với phiếu gốc. */
  reverses_doc_id: string | null
}

export type TransferLineLike = {
  doc_id: string | null
  component_id: string
  qty: number
  received_qty: number | null
}

export type TransferTotal = {
  /** Σ giao đi từ công đoạn này (phiếu chưa huỷ, trừ phần đã đảo). */
  shipped: number
  /** Σ nhận tới công đoạn này (chỉ phiếu đã nhận, trừ phần đã đảo). */
  received: number
  /** Có phiếu nào TỚI công đoạn này không — để biết "đã nhận = 0" là 0 thật hay chưa ai lập phiếu. */
  has_inbound: boolean
}

export const totalKey = (componentId: string, stage: string) => `${componentId}|${stage}`

/**
 * Gom phiếu giao tổ thành hai số per (dòng × công đoạn). Phiếu ĐẢO là số ÂM
 * của phiếu gốc: hàng đi ngược to → from, nên trừ "đã giao" ở `to_stage`
 * của phiếu đảo (= from của gốc) và trừ "đã nhận" ở `from_stage` của phiếu đảo
 * (= to của gốc). Dòng rời không `doc_id` (sổ 0090 cũ) không vào đây.
 */
export function transferTotals(
  docs: TransferDocLike[],
  lines: TransferLineLike[],
): Map<string, TransferTotal> {
  const byId = new Map(docs.map((d) => [d.id, d]))
  const out = new Map<string, TransferTotal>()
  const get = (k: string) => {
    let t = out.get(k)
    if (!t) {
      t = { shipped: 0, received: 0, has_inbound: false }
      out.set(k, t)
    }
    return t
  }
  for (const l of lines) {
    if (!l.doc_id) continue
    const d = byId.get(l.doc_id)
    if (!d || d.status === 'da_huy') continue
    if (d.reverses_doc_id) {
      get(totalKey(l.component_id, d.to_stage)).shipped -= l.qty
      get(totalKey(l.component_id, d.from_stage)).received -= l.qty
      continue
    }
    get(totalKey(l.component_id, d.from_stage)).shipped += l.qty
    const inb = get(totalKey(l.component_id, d.to_stage))
    inb.has_inbound = true
    if (d.status === 'da_nhan') inb.received += l.received_qty ?? l.qty
  }
  for (const t of out.values()) {
    t.shipped = r2(t.shipped)
    t.received = r2(t.received)
  }
  return out
}

/**
 * "ĐÃ NHẬN" tới một (dòng × công đoạn) — QUY TẮC DÙNG CHUNG cho Ghi sản lượng
 * và Hồ sơ lệnh: có phiếu giao TỚI đây thì lấy số nhận thật của phiếu; chưa
 * ai lập phiếu thì xấp xỉ bằng số XONG ở công đoạn liền trước của chính dòng
 * (xưởng tự chuyển, không lập phiếu); đầu lộ trình (không có công đoạn trước)
 * → null, không có khái niệm nhận.
 */
export function receivedOrFallback(
  total: TransferTotal | undefined,
  prevDone: number | null,
): number | null {
  if (total?.has_inbound) return total.received
  return prevDone
}

export type HeadInput = {
  /** Đã nhận (hoặc xong ở chặng cuối của nó) của MỘT dòng con, đơn vị của con. */
  received: number | null
  /** Tổng cần của dòng con cho cả dòng SP (calcComponent().total_needed). */
  total: number
}

/**
 * "ĐÃ NHẬN" ở ĐẦU lộ trình của một dòng GỘP — cụm (thật / mặc nhiên) ở công
 * đoạn ghép, thành phẩm ở bước đầu chặng thành phẩm (10/11/2026). Dòng gộp
 * không có công đoạn trước trên lộ trình của CHÍNH nó, nên `receivedOrFallback`
 * trả null và màn bày "—" dù tổ hàn vừa nhận đủ 600 chi tiết. Đầu vào của nó
 * là các dòng CON: mỗi con góp floor(nhận_con × SL dòng / tổng cần con) bộ,
 * lấy MIN (con chậm nhất quyết định — cùng công thức đồng bộ SP), kẹp trần SL
 * dòng. Trả số BỘ; cụm thật n/SP thì nhân thêm ở chỗ gọi. Không con nào hợp lệ
 * → null (không bịa).
 */
export function headReceived(inputs: HeadInput[], lineQty: number): number | null {
  let m: number | null = null
  for (const x of inputs) {
    if (x.total <= 0 || x.received == null) continue
    const sets = Math.floor((x.received * lineQty) / x.total)
    m = m == null ? sets : Math.min(m, sets)
  }
  return m == null ? null : Math.min(m, lineQty)
}
