import { redirect } from 'next/navigation'

/**
 * `/exec/approvals` → Hộp ký.
 *
 * Trang này từng là DANH SÁCH phê duyệt + buồng lái master-detail (14/08/2026 đã
 * xoá): nó nạp đủ chi tiết MỌI phiếu chờ ngay từ server — mỗi PO một truy vấn
 * dòng, mỗi LSX bốn, cộng ký URL ảnh từng sản phẩm — rồi dựng lại đúng danh sách
 * mà Hộp ký (`/exec`) giờ đã làm, nhẹ hơn nhiều.
 *
 * Giữ route để link cũ trong thông báo/email không gãy. Chi tiết từng phiếu vẫn
 * sống ở `/exec/approvals/{lsx,po}/[id]`.
 */
export default function ApprovalsRedirect() {
  redirect('/exec')
}
