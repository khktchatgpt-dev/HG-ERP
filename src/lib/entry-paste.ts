/**
 * DÁN VÙNG BẢNG TỪ EXCEL vào lưới ghi sổ.
 *
 * Luật 4 của Khuôn F (`/design-lab/mau-soan-don`): nạp hàng loạt là ĐƯỜNG
 * CHÍNH, không phải tính năng phụ. Thống kê xưởng đã có sẵn cột số trong sổ
 * Excel của mình — bắt họ gõ lại từng ô là mời lỗi vào nhà, và đó chính là
 * điểm đau họ khai 24/08/2026 ("gõ nhiều SP một lượt / dán Excel").
 *
 * KHÁC `po-paste.ts`: bản kia đọc một BẢNG CÓ TIÊU ĐỀ và tự đoán cột (mã, tên,
 * SL, giá) vì người mua dán nguyên sheet báo giá của nhà cung cấp. Ở đây người
 * dùng bôi đen đúng một VÙNG Ô rồi dán vào ô đang đứng — không có tiêu đề, và
 * cột nào ăn vào cột nào do vị trí con trỏ quyết định, y như Excel. Đoán tiêu
 * đề ở đây là đoán sai.
 *
 * Tệp này CỐ Ý không biết gì về cột nào là SL, cột nào là phế: nó chỉ tách
 * chuỗi thành lưới. Việc ghép vào đúng trường là của màn.
 */

/** Trần số dòng nhận một lượt — dán nhầm cả sheet 5.000 dòng thì treo tab. */
export const PASTE_MAX_ROWS = 500

/**
 * Tách văn bản dán thành LƯỚI ô.
 *
 * Excel (và Google Sheets) đặt lên clipboard dạng TSV: ô ngăn bằng Tab, dòng
 * ngăn bằng xuống dòng. Ô chứa xuống dòng sẽ được bọc trong dấu nháy kép —
 * trường hợp đó KHÔNG xử lý ở đây: cột của lưới ghi sổ là số và lý do ngắn,
 * không ai dán đoạn văn nhiều dòng vào. Gặp nháy kép bọc ngoài thì bóc ra.
 *
 * Dòng trắng ở CUỐI bị bỏ (Excel luôn kèm một dòng thừa), nhưng dòng trắng ở
 * GIỮA thì giữ: nó là một hàng thật mà người dùng để trống, bỏ đi là mọi dòng
 * sau bị dịch lên một ô — sai số mà không ai thấy.
 */
export function parsePasteGrid(text: string, maxRows = PASTE_MAX_ROWS): string[][] {
  if (!text) return []
  const rows = text.replace(/\r\n?/g, '\n').split('\n')
  while (rows.length > 0 && rows[rows.length - 1].trim() === '') rows.pop()
  return rows.slice(0, maxRows).map((line) =>
    line.split('\t').map((cell) => {
      const t = cell.trim()
      return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
    }),
  )
}

/** Vùng dán có phải MỘT Ô duy nhất không — dán một ô thì cư xử như gõ tay. */
export function isSingleCell(grid: string[][]): boolean {
  return grid.length === 1 && grid[0].length === 1
}

/**
 * Bao nhiêu ô sẽ bị GHI ĐÈ nếu dán vùng này vào (row, col) của một lưới
 * `rows × cols`.
 *
 * Dùng để hỏi lại trước khi dán đè — dán nhầm vào giữa bảng đã gõ dở là mất
 * công của cả buổi, và sổ này append-only nên ghi rồi phải xoá phiếu mới sửa
 * được. Trả cả phần TRÀN ra ngoài lưới để màn nói thật là sẽ bỏ bao nhiêu ô.
 */
export function pasteFootprint(
  grid: string[][],
  at: { row: number; col: number },
  size: { rows: number; cols: number },
): { fills: number; dropped: number } {
  let fills = 0
  let dropped = 0
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const tr = at.row + r
      const tc = at.col + c
      if (tr < size.rows && tc < size.cols) fills++
      else dropped++
    }
  }
  return { fills, dropped }
}
