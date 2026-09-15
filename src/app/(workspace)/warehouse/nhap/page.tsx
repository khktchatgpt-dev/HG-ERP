import { authService } from '@/modules/core/auth/auth.service'
import { Btn, Empty, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Kho · Hàng về' }
export const dynamic = 'force-dynamic'

/**
 * HÀNG VỀ — cửa vào của khu Kho (Bước 1, `docs/kho-buoc-1-nhap-kho.md`).
 *
 * Việc số 1 của bước này chỉ dựng VỎ: khu Kho mở lại, route có thật, người
 * vai Kho đăng nhập rơi đúng vào đây thay vì 404. Danh sách bốn làn (Quá hẹn /
 * Hôm nay / Sắp tới / Chưa hẹn ngày) là việc số 2 — dựng riêng, đọc đúng hai
 * hàm Mua hàng đang dùng (`poShipmentsRepo.listOpen` + `supplyRepo.listOpenPos`)
 * để hai phòng không đếm khác nhau.
 *
 * Trong lúc đó trạng thái rỗng phải nói THẬT vì sao rỗng và đi đâu tiếp — không
 * phải một trang trắng: Mua hàng đã có màn theo dõi hàng về cùng nguồn số.
 */
export default async function WarehouseInboundPage() {
  await authService.requirePageUser()
  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenHeader compact eyebrow="Kho" title="Hàng về" />
      <Empty
        headline="Danh sách hàng về đang dựng"
        reason="Khu Kho được dựng lại từng màn một. Màn này sẽ chia đợt giao nhà cung cấp thành bốn làn Quá hẹn / Hôm nay / Sắp tới / Chưa hẹn ngày, mỗi dòng có nút Nhận hàng."
        next={
          <Btn primary href="/mua-hang/nhan-hang">
            Xem hàng về ở Mua hàng
          </Btn>
        }
      />
    </div>
  )
}
