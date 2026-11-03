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
 *   tồn       = xong − đã giao          (hàng xong còn nằm ở tổ)
 *   khả dụng  = đã nhận − đã ghi ở đây  (đầu vào còn trong tay để làm tiếp)
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
    on_hand: r2(x.done - x.shipped),
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
