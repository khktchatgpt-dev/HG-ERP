import { Btn, Empty, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Mua hàng · Nhận hàng' }

/**
 * TRANG TẠM trong cây module Mua hàng. Bước 4: đọc phiếu nhập từ Kho, đối chiếu với đơn.
 *
 * Tồn tại để thanh điều hướng không prefetch vào 404 (đo 10/09/2026: 200 lượt
 * gọi một trang chưa có trong một phiên) và để người bấm vào có đường đi tiếp.
 * Dựng xong trang thật thì XOÁ file này.
 */
export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader eyebrow="Mua hàng" title="Nhận hàng" />
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Chưa dựng theo sổ thiết kế mới"
          reason="Câu hỏi trang này sẽ trả lời: “Hàng về tới đâu, phiếu nhập nào của đơn nào?” Trong lúc chờ, bản cũ vẫn đầy đủ tính năng."
          next={
            <>
              <Btn primary href="/warehouse/docs">Mở bản cũ</Btn>
              <Btn href="/design-lab">Xem sổ thiết kế</Btn>
            </>
          }
        />
      </div>
    </div>
  )
}
