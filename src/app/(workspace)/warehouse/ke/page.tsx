import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { binsService } from '@/modules/dept/warehouse/stock.service'
import { BinsScreen } from './BinsScreen'

/**
 * SƠ ĐỒ KỆ (Đợt 2 — `docs/thiet-ke-kho.md` §5.1). Họ NỀN của phân hệ Kho.
 *
 * Câu hỏi: "kho có những khu nào, khu nào đang giữ hàng, khu nào lâu chưa ai
 * đếm?". Thủ kho gần như không vào đây — nó là danh mục, mở một lần mỗi tháng.
 *
 * MƯỜI HAI KHU THÔ, KHÔNG ĐÁNH TỚI TỪNG Ô — quyết định ở §7.2 của bản thiết
 * kế UI. Đánh mã tới từng ô nghe "chuẩn ngay từ đầu" nhưng có nghĩa là phải
 * dán tem cả nhà kho TRƯỚC KHI dùng được ngày nào; khu thì sơn một tấm biển là
 * xong trong buổi sáng, và đã đủ trả lời câu "hàng để đâu".
 *
 * Migration 0193 chỉ nạp sẵn BA KHU ẢO. Khu thật khai ở màn này vì tên khu
 * phải khớp biển hiệu ngoài xưởng — nạp hộ chín cái tên đoán mò là đẻ dữ liệu
 * người dùng phải đi dọn.
 */
export default async function BinsPage() {
  const user = await authService.requirePageUser()
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))
  const bins = await binsService.list(user)
  return <BinsScreen bins={bins} canEdit={canEdit} />
}
