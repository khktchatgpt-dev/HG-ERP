/**
 * TÓM TẮT MỘT LỆNH trên màn "Đơn đặt NCC" của Kho — logic thuần, có test.
 *
 * Kho mở màn này để hỏi đúng hai câu: hàng của lệnh này VỀ TỚI ĐÂU, và lô GẦN
 * NHẤT ngày nào. Đầu nhóm trước đây chỉ ghi "3 đơn", không trả lời câu nào —
 * phải bung từng đơn ra cộng nhẩm (chủ dự án 15/09/2026).
 *
 * Tách khỏi JSX vì ba lý do đều đã cắn ở chỗ khác trong dự án:
 *   · đếm sai thì cả màn nói dối mà không ai biết — cần test;
 *   · "ngày gần nhất" có luật ưu tiên (đợt giao trước, hạn đơn sau) chứ không
 *     phải min đơn thuần, và luật đó phải đọc được ở một chỗ;
 *   · logic viết trong biểu thức JSX thì không ai gọi lại được từ nơi khác.
 */

export type LenhRow = {
  /** Dòng của đơn đã về đủ — dòng chốt thiếu đếm là xong (qty_open, 0154). */
  lines_done: number
  lines_total: number
  /** Hạn giao của cả đơn, ISO hoặc null. */
  expected_at: string | null
  /** Đợt giao kế tiếp còn sống, nếu đơn đã chia đợt. */
  next_shipment: { date: string } | null
}

export type TomTatLenh = {
  /** Số ĐƠN thuộc lệnh. */
  don: number
  /** Số DÒNG còn chờ về, cộng qua mọi đơn của lệnh. */
  conLai: number
  /** Ngày hàng về gần nhất (ISO), null khi chưa đơn nào có ngày. */
  ganNhat: string | null
  /** Số mốc đã quá hẹn tính tới `today`. */
  quaHen: number
}

export function tomTatLenh(rows: LenhRow[], today: string): TomTatLenh {
  /*
    ĐẾM THEO DÒNG, KHÔNG CỘNG SỐ LƯỢNG. Cộng mét vải với con bu lông ra một con
    số không nói được gì — cùng lý do đã áp cho thanh độ phủ ở màn đơn.

    `max(0, …)` phòng ca nhận DƯ: `lines_done` có thể vượt `lines_total` khi
    Kho nhận vượt kèm lý do, và "còn -1 dòng" thì vô nghĩa.
  */
  const conLai = rows.reduce((a, r) => a + Math.max(0, r.lines_total - r.lines_done), 0)

  /*
    NGÀY: ĐỢT GIAO TRƯỚC, HẠN ĐƠN SAU.

    Đợt giao là cam kết cụ thể của NCC cho một lô; hạn của đơn chỉ là mốc chung.
    Đơn đã chia đợt mà vẫn đọc hạn đơn thì Kho chuẩn bị mặt bằng sai ngày.

    Đơn CHƯA chia đợt vẫn phải có mặt — NCC giao lúc nào chưa biết nhưng hàng
    vẫn nhận được, bỏ nó khỏi danh sách ngày là nó biến mất khỏi tầm mắt.
  */
  const ngay = rows
    .map((r) => r.next_shipment?.date ?? r.expected_at?.slice(0, 10) ?? null)
    .filter((d): d is string => !!d)
    .sort()

  return {
    don: rows.length,
    conLai,
    ganNhat: ngay[0] ?? null,
    // So chuỗi ISO là so ngày — cùng cách mọi chỗ khác trong dự án làm.
    quaHen: ngay.filter((d) => d < today).length,
  }
}
