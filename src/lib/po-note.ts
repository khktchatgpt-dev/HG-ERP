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
  const body = text?.trim()
  if (!body) return prev
  const line = `[${tag}] ${body}`
  return prev ? `${line}\n${prev}` : line
}
