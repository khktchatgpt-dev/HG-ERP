import { authService } from '@/modules/core/auth/auth.service'
import { Btn, Empty, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Kho · Xuất kho' }
export const dynamic = 'force-dynamic'

/**
 * XUẤT KHO — Bước 2 Kho, việc 1: VỎ (`docs/kho-buoc-2-xuat-kho.md`).
 *
 * Bước 2 là xuất theo THỰC TẾ LẤY (chủ dự án chốt 16/09/2026): thủ kho ghi
 * mã, số lượng, lệnh hoặc tổ nhận — không so định mức. Màn thật là một form
 * Khuôn F (dải chip + lưới + ô tìm vật tư), dựng ở việc 2–4. Ở việc 1 chỉ
 * mở route, mục nav và route API để người vai Kho có chỗ vào, không 404.
 */
export default async function WarehouseIssuePage() {
  await authService.requirePageUser()
  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenHeader compact eyebrow="Kho" title="Xuất kho" />
      <Empty
        headline="Phiếu xuất đang dựng"
        reason="Bước 2 của khu Kho: ghi sổ vật tư tổ vừa lấy — chọn lệnh sản xuất hoặc lý do xuất lẻ, tìm mã, gõ số lượng, ghi sổ. Không so định mức ở bước này."
        next={
          <Btn primary href="/warehouse/nhap">
            Về Hàng về
          </Btn>
        }
      />
    </div>
  )
}
