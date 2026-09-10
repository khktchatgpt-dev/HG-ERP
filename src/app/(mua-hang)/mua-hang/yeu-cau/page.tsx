import { Btn, Empty, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Mua hàng · Yêu cầu mua' }

/**
 * TRANG TẠM trong cây module Mua hàng. Bước 3: Vật tư theo lệnh + Bảng kê trở thành chứng từ Yêu cầu mua.
 *
 * Tồn tại để thanh điều hướng không prefetch vào 404 (đo 10/09/2026: 200 lượt
 * gọi một trang chưa có trong một phiên) và để người bấm vào có đường đi tiếp.
 * Dựng xong trang thật thì XOÁ file này.
 */
export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader eyebrow="Mua hàng" title="Yêu cầu mua" />
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Chưa dựng theo sổ thiết kế mới"
          reason="Câu hỏi trang này sẽ trả lời: “Lệnh nào còn thiếu đồ, cần đặt gì?” Trong lúc chờ, bản cũ vẫn đầy đủ tính năng."
          next={
            <>
              <Btn primary href="/planning/lsx">Mở bản cũ</Btn>
              <Btn href="/design-lab">Xem sổ thiết kế</Btn>
            </>
          }
        />
      </div>
    </div>
  )
}
