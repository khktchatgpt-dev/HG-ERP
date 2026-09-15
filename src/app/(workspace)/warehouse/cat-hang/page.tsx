import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { putawayService } from '@/modules/dept/warehouse/stock.service'
import { PutawayScreen } from './PutawayScreen'

/**
 * CHỜ CẤT (Đợt 2 — `docs/thiet-ke-kho-ui.md` màn 1.3).
 *
 * Câu hỏi: "còn gì đang nằm ở khu tiếp nhận?".
 *
 * VÌ SAO TÁCH KHỎI PHIẾU NHẬP — và đây là quyết định đáng cãi nhất của đợt:
 * nhận hàng và cất hàng là HAI LẦN ĐI LẠI, hai thời điểm, có khi hai người.
 * Gộp vào một form là bắt thủ kho đứng ở bàn quyết chỗ để cho thứ chưa nhìn
 * thấy, rồi lúc ra bãi mới biết kệ đã đầy. Odoo gọi là receipt hai bước,
 * Dynamics gọi là Put-away.
 *
 * KHÔNG CÓ BẢNG TRẠNG THÁI "CHỜ CẤT" nào. Đây là một CÂU TRUY VẤN trên sổ —
 * còn gì đang nằm ở khu `receiving`. Cất xong là dòng rời khu đó và tự biến
 * khỏi hàng đợi; không có cờ nào phải nhớ bật/tắt, nên cũng không có cờ nào
 * lệch được với sự thật.
 */
export default async function PutawayPage() {
  const user = await authService.requirePageUser()
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))
  const data = await putawayService.list(user)
  return (
    <PutawayScreen
      rows={data.rows}
      bins={data.bins}
      fromBinId={data.fromBinId}
      canEdit={canEdit}
    />
  )
}
