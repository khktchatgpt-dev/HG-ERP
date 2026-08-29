/**
 * GIÁ MUA GẦN NHẤT — ĐÃ CHUYỂN SANG HỘP XÁC NHẬN (29/08/2026).
 *
 * Trước đây file này bắt `po.ordered` (approved → gửi NCC) rồi tự ghi đè
 * `last_purchase_price` bằng giá dòng, KHÔNG hỏi ai. Có ghi vết (0177) nên tra
 * lại được, nhưng vẫn là một con số đi thẳng vào giá thành bị thay đổi sau lưng
 * người dùng.
 *
 * User chốt 29/08/2026: giá phải được XÁC NHẬN như quy cách/vật liệu — hỏi
 * ngay lúc LƯU ĐƠN, cùng một hộp "Cập nhật kho vật tư?"
 * (`posService.catalogSuggestions` → `/api/dept/warehouse/materials/enrich`).
 *
 * VÌ SAO XOÁ HẲN CHỨ KHÔNG GIỮ CẢ HAI: để lại đường tự ghi thì người soạn bấm
 * "Bỏ qua" ở hộp xác nhận xong, giá vẫn bị đè lúc đơn gửi NCC — nút "Bỏ qua"
 * thành nút giả. Một con số chỉ được có MỘT đường vào.
 *
 * ĐÁNH ĐỔI đã biết: giá nay vào danh mục từ đơn CHƯA qua duyệt Giám đốc. GĐ từ
 * chối đơn thì giá đó vẫn nằm lại — sửa tay ở danh mục Kho, và sổ vết 0177
 * (`source: po_enrich` + mã đơn) chỉ ra ngay đơn nào đã ghi.
 *
 * File giữ lại (thay vì xoá) để `register.ts` không phải đổi, và để chỗ này còn
 * chỗ bám nếu sau này cần side-effect khác của `po.ordered` lên danh mục.
 */
export function registerPoCatalogHandlers(): void {
  // Không còn side-effect nào lên danh mục ở bước gửi NCC — xem chú thích trên.
}
