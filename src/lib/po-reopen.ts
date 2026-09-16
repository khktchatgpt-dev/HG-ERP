/**
 * MỞ LẠI ĐƠN ĐÃ DUYỆT ĐỂ SỬA.
 *
 * `posService.update` chỉ nhận đơn NHÁP: sau khi Giám đốc duyệt, dòng hàng và
 * giá là cam kết với GĐ và là bản NCC đang cầm — sửa thẳng ở đó là âm thầm vô
 * hiệu hoá chữ ký duyệt. Trước 16/09/2026 hệ quả là người mua phát hiện sai một
 * dòng sau khi duyệt thì chỉ còn hai lối, cả hai đều tệ:
 *
 *   - Huỷ đơn rồi nhân bản → mất số PO đã gửi NCC, đơn huỷ nằm lại trong sổ;
 *   - Nhờ Giám đốc "từ chối" một đơn đã duyệt → không có đường đó, `decide`
 *     chỉ nhận đơn đang chờ duyệt.
 *
 * Nên mở một lối THỨ BA, đúng một chiều: đơn quay về NHÁP kèm lý do, dấu duyệt
 * bị xoá, và muốn đi tiếp thì phải qua lại cửa duyệt. Người mua sửa được, còn
 * bất biến "số Giám đốc gật = số trên phiếu" vẫn nguyên — vì bản vừa sửa chưa
 * có chữ ký nào cho tới khi GĐ gật lần nữa.
 *
 * Luật để ở lib (thuần, có test) vì CẢ HAI phía đều cần nó: service chặn thật,
 * còn `actions.ts` của màn chứng từ cần đúng câu lý do để hiện lên nút bị khoá.
 */

/** Đã qua cửa duyệt, chưa nhận gì — tập DUY NHẤT mở lại được. */
const REOPENABLE = ['approved', 'ordered', 'confirmed', 'in_transit']

export type ReopenGuard = { ok: true } | { ok: false; reason: string }

/**
 * Mở lại được không, xét theo TRẠNG THÁI.
 *
 * Trạng thái là điều kiện CẦN, không đủ: đơn đã có phiếu nhập dù chỉ một dòng
 * thì service chặn tiếp (xem `posService.reopen`) — sổ kho đã ghi theo dòng
 * hàng của bản cũ, sửa ngược bản ấy là đẻ ra hai nguồn số cho cùng một lô hàng.
 */
export function canReopen(status: string): ReopenGuard {
  if (status === 'draft') {
    return { ok: false, reason: 'Đơn đang là nháp — bấm "Sửa đơn"' }
  }
  if (status === 'pending_approval') {
    return { ok: false, reason: 'Đơn đang chờ duyệt — bấm "Rút về nháp" rồi sửa' }
  }
  if (status === 'partial' || status === 'received') {
    return {
      ok: false,
      reason: 'Đơn đã có hàng về — không mở lại được, hãy nhân bản thành đơn mới',
    }
  }
  if (status === 'cancelled') {
    return { ok: false, reason: 'Đơn đã huỷ — hãy nhân bản thành đơn mới' }
  }
  if (!REOPENABLE.includes(status)) {
    return { ok: false, reason: `Không mở lại được ở trạng thái "${status}"` }
  }
  return { ok: true }
}

/**
 * Câu chặn khi đơn CHƯA nhận đủ điều kiện về phiếu nhập.
 *
 * Tách khỏi `canReopen` vì nó cần số liệu từ DB — nhưng vẫn để cạnh nhau, để
 * người đọc thấy đủ hai tầng chặn ở một chỗ.
 */
export function receivedBlockReason(receivedLines: number): string | null {
  if (receivedLines <= 0) return null
  return `Đơn đã có ${receivedLines} dòng ghi nhận nhập kho — không mở lại được. Muốn dừng phần còn lại thì "Chốt phần thiếu", muốn mua tiếp thì nhân bản thành đơn mới.`
}
