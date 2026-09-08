/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT v4 — LÕI THUẦN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Quy tắc bày dữ liệu, KHÔNG phụ thuộc React/DOM. Ở đây để:
 *  · test được không cần dựng component;
 *  · file Excel và màn hình dùng CHUNG một luật — bài học 07/09/2026: hai
 *    bên tự tính thì sớm muộn nói hai chuyện về cùng một dòng.
 */

/** Trạng thái vòng đời dữ liệu. Ba cái, không hơn. */
export type Tone = 'neutral' | 'stop' | 'warn' | 'done'

/**
 * SỐ 0 HIỆN THÀNH Ô TRỐNG, nhưng giá trị vẫn là số.
 *
 * Trong ERP, "0" và "chưa có số" là hai chuyện khác nhau: 0 tấm kính đã về
 * ≠ chưa ai nhập số kính về. Bảng đầy số 0 thì mắt phải lọc thủ công để tìm
 * dòng có số thật.
 *
 * Trả về chuỗi rỗng cho 0 và null — CHỈ ở tầng hiển thị. Đừng nhét chuỗi
 * rỗng vào dữ liệu (bẫy đã dính một lần ở file Excel: cột thành nửa số nửa
 * chữ, lọc "lớn hơn 0" và SUM đều lệch).
 */
export function showNum(v: number | null | undefined): string {
  if (v == null || v === 0) return ''
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
}

/** Tiền: luôn có nhóm nghìn, không có phần lẻ trừ khi thật sự lẻ. */
export function showMoney(v: number | null | undefined): string {
  if (v == null || v === 0) return ''
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

/**
 * ĐỘ PHỦ — gộp "đã có bao nhiêu phần của cái đang cần" thành MỘT con số.
 *
 * Vì sao: bảng kê v3 bày 5 cột số (đã xuất / tồn / đã đặt / nháp / đã về) và
 * người mua phải nhẩm cả 5 mới biết còn xa bao nhiêu. Đo trên LSX 06/26-27:
 * 4/5 cột đó rỗng ở phần lớn dòng — năm cột để trả lời một câu hỏi.
 *
 * Chi tiết từng cột KHÔNG mất: nó nằm ở khay kiểm tra, mở ra khi cần.
 *
 * `need = 0` trả về 1 (đủ) chứ không phải 0/0: không cần gì thì không thiếu gì.
 */
export function coverage(input: { need: number; covered: number }): number {
  if (input.need <= 0) return 1
  const r = input.covered / input.need
  return r < 0 ? 0 : r > 1 ? 1 : r
}

/** Phần trăm để in ra: làm tròn, không có phần lẻ — không ai cần 47,3%. */
export function coveragePct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/**
 * CÂU NÓI VIỆC cho một dòng vật tư — thay cho nhãn trạng thái trần trụi.
 *
 * "Chưa đặt" nói TÌNH HÌNH. "Chưa mua lần nào — phải đi hỏi giá" nói VIỆC
 * PHẢI LÀM. Người cung ứng mở màn này để hành động, không để đọc báo cáo.
 */
export function rowAction(r: {
  suggest: number
  hasPrice: boolean
  hasSupplier: boolean
  blockedByBom: boolean
}): { label: string; tone: Tone } {
  if (r.blockedByBom)
    return { label: 'Kỹ thuật chưa xác nhận BOM', tone: 'warn' }
  if (r.suggest <= 0) return { label: 'Đủ', tone: 'done' }
  if (!r.hasSupplier) return { label: 'Chưa biết mua ở đâu', tone: 'stop' }
  if (!r.hasPrice) return { label: 'Chưa có giá — hỏi giá', tone: 'warn' }
  return { label: 'Sẵn sàng cắt đơn', tone: 'neutral' }
}

/**
 * CHIA HÀNG ĐỢI VIỆC.
 *
 * Tab của v4 KHÔNG phải bộ lọc dữ liệu mà là ba việc của ba người khác nhau.
 * Số đếm trên tab là một lời hứa: bấm vào thấy ĐÚNG ngần đó dòng phải làm.
 *
 * Cùng ranh giới với `splitBangKe` bên file Excel — cố ý, để tờ giấy in ra
 * và màn hình không bao giờ đếm khác nhau.
 */
export type Lane<T> = { id: string; label: string; rows: T[]; tone?: Tone }

export function toLanes<T>(
  rows: T[],
  spec: { id: string; label: string; tone?: Tone; test: (r: T) => boolean }[],
): Lane<T>[] {
  return spec.map((s) => ({
    id: s.id,
    label: s.label,
    tone: s.tone,
    rows: rows.filter(s.test),
  }))
}
