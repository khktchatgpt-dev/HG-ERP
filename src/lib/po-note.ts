/**
 * VẾT LÝ DO TRÊN GHI CHÚ ĐƠN MUA — một quy ước duy nhất.
 *
 * Mỗi thao tác bắt lý do (từ chối · huỷ · dời hẹn · chốt thiếu) đều phải để lại
 * vết trên `note` của đơn. Trước 11/09/2026 mỗi chỗ tự viết một lối, và ba lối
 * đó KHÁC NHAU:
 *
 * | Chỗ                | Viết ra                              | Ghi chú cũ         |
 * | ------------------ | ------------------------------------ | ------------------ |
 * | `rescheduleNote`   | `[Dời hẹn giao] … ` + `\n` + cũ      | giữ                |
 * | `posService.cancel`| `[Huỷ] …` + ` · ` + cũ               | giữ, khác dấu      |
 * | `posService.decide`| `[Từ chối] …`                        | **MẤT**            |
 *
 * Dòng thứ ba là lối mòn #2 của `docs/tieu-chi-workflow-erp.md`: người soạn viết
 * ghi chú cho đơn ("giao cổng B", "gọi trước 30 phút"), Giám đốc từ chối, ghi
 * chú đó biến mất — mất dữ liệu thật, không phải chuyện thẩm mỹ.
 *
 * Nên gom về một hàm. Hai điều nó bảo đảm:
 *
 * 1. **Không bao giờ ghi đè.** Vết mới lên đầu, phần cũ xuống dưới nguyên văn.
 * 2. **Một dấu ngăn duy nhất** — xuống dòng. Đọc từ trên xuống là ra lịch sử;
 *    dùng ` · ` thì vết thứ ba trở đi thành một dòng dài không ai đọc nổi.
 */

/*
 * ĐỔI CHỖ GHI (27/09/2026): vết lý do KHÔNG còn đóng lên `note` nữa. Ô `note` in
 * NGUYÊN VĂN lên phiếu gửi NCC (print/supply/PoPrintSheet), nên "[Trả lại để
 * sửa] Giá cao hơn NCC khác" đi thẳng tới tay chính NCC đó. Vết giờ là một ghi
 * chú Trao đổi NỘI BỘ (doc_notes, audience 'internal') do `posService` ghi —
 * `reasonLine` dựng câu, cùng một lối `[nhãn] nội dung` cho cả bốn thao tác.
 * Hai bảo đảm cũ vẫn giữ: không ghi đè gì (ô note người soạn không bị đụng tới
 * nữa), và lý do không mất (huỷ đơn thì Trao đổi là nơi DUY NHẤT giữ lý do).
 */

/** Một dòng vết `[nhãn] nội dung`; lý do rỗng thì `null` (không ghi gì). */
export function reasonLine(tag: string, text: string | null | undefined): string | null {
  const body = text?.trim()
  return body ? `[${tag}] ${body}` : null
}

/**
 * Đóng một vết `[nhãn] nội dung` lên đầu ghi chú, giữ nguyên phần cũ ở dưới.
 *
 * `text` rỗng thì KHÔNG đóng vết và trả lại ghi chú cũ y nguyên — đừng để một
 * lý do trống đẩy vào đơn cái nhãn rỗng nghĩa (`decide` cho phép duyệt không
 * kèm lý do, và `reject` không lý do thì zod đã chặn từ biên).
 */
export function stampNote(
  tag: string,
  text: string | null | undefined,
  prevNote: string | null | undefined,
): string | null {
  const prev = prevNote?.trim() || null
  const line = reasonLine(tag, text)
  if (!line) return prev
  return prev ? `${line}\n${prev}` : line
}
