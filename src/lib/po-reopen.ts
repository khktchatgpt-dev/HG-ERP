/**
 * HẠ ĐƠN ĐÃ GỬI VỀ NHÁP ĐỂ SỬA.
 *
 * VÌ SAO PHẢI CÓ. Luật gốc đúng cho đơn phát sinh mới: sau khi Giám đốc duyệt,
 * giá và dòng hàng là cam kết với GĐ và bản NCC đang cầm, nên `posService.update`
 * chỉ mở ở trạng thái nháp. Nhưng luật đó giả định MỌI đơn đều sinh ra trong hệ
 * thống và đi tuần tự từ nháp.
 *
 * Thực tế phòng Cung ứng đang nhập lại dữ liệu: 19 đơn của tháng 6–9/2026 vào hệ
 * thống ở thẳng trạng thái "đã gửi" / "đã nhận", vì ngoài đời chúng đã gửi rồi.
 * Khi đối chiếu phát hiện gõ sai một con số — và đợt rà 15/09/2026 tìm ra 9 dòng
 * lệch — thì KHÔNG có đường nào sửa: `update` khoá, `withdraw` chỉ nhận đơn đang
 * chờ duyệt. Người dùng còn mỗi hai lựa chọn tệ: để số sai, hoặc huỷ đơn rồi tạo
 * lại (mất số PO thật đã gửi NCC, mất luôn vết đối chiếu).
 *
 * BỐN HÀNG RÀO, không cái nào bỏ được:
 *
 *  1. QUYỀN — chỉ admin / trưởng phòng Cung ứng / người duyệt. Đây là thao tác
 *     vô hiệu hoá chữ ký duyệt, không phải việc thường ngày của nhân viên.
 *  2. ĐÃ NHẬN HÀNG THÌ KHÔNG. Phiếu nhập kho trỏ vào `po_line_id`; hạ về nháp
 *     rồi sửa dòng là `update` xoá và ghi lại dòng — phiếu nhập thành mồ côi,
 *     tồn kho và công nợ mất một chân đối chiếu. Đây là hàng rào CỨNG.
 *  3. LÝ DO BẮT BUỘC, và nó được đóng dấu vào ghi chú đơn. Ai mở, khi nào, vì
 *     sao — đọc lại đơn là thấy.
 *  4. ĐƠN ĐÃ HUỶ / ĐANG NHÁP thì vô nghĩa, chặn luôn cho khỏi nhầm.
 *
 * Hàm này THUẦN để test được cả bốn nhánh mà không cần dựng cơ sở dữ liệu.
 */

import { stampNote } from './po-note'

/** Trạng thái hạ về nháp được — đơn đã rời bàn soạn nhưng chưa có hàng về. */
const REOPENABLE = ['pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit'] // prettier-ignore

export type ReopenGuard = { ok: true } | { ok: false; reason: string }

export function canReopenForEdit(i: {
  status: string
  /** Tổng số lượng ĐÃ NHẬN trên mọi dòng của đơn. > 0 là chặn cứng. */
  receivedQty: number
  /** Số phiếu kho đã ghi vào đơn — chặn cả khi phiếu ghi 0 (trả hàng, huỷ dở). */
  warehouseDocs: number
  /** Người bấm có phải admin / trưởng phòng CƯ / người duyệt không. */
  privileged: boolean
}): ReopenGuard {
  if (!i.privileged) {
    return {
      ok: false,
      reason: 'Chỉ Giám đốc hoặc trưởng phòng Cung ứng hạ đơn về nháp được',
    }
  }
  if (i.status === 'draft') return { ok: false, reason: 'Đơn đang là nháp — sửa thẳng được rồi' } // prettier-ignore
  if (i.status === 'cancelled') return { ok: false, reason: 'Đơn đã huỷ — dùng "Tạo lại từ đơn này"' } // prettier-ignore
  if (i.receivedQty > 1e-6 || i.warehouseDocs > 0) {
    return {
      ok: false,
      reason:
        'Đơn đã có phiếu nhập kho — sửa dòng sẽ làm phiếu nhập mồ côi. Điều chỉnh bên Kho, hoặc huỷ đơn rồi tạo lại.',
    }
  }
  if (!REOPENABLE.includes(i.status)) {
    return { ok: false, reason: `Không hạ về nháp được ở trạng thái "${i.status}"` }
  }
  return { ok: true }
}

/**
 * Dấu vết ghi vào `note` của đơn — cùng quy ước xếp lớp với `[Huỷ]`,
 * `[Từ chối]`, `[Dời hẹn giao]`: vết mới lên đầu, ghi chú cũ xuống dưới.
 */
export function reopenNote(
  fromStatus: string,
  reason: string,
  prev: string | null,
): string | null {
  return stampNote(`Hạ về nháp từ "${fromStatus}"`, reason, prev)
}
