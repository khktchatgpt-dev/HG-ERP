import { Btn, Empty, ScreenHeader } from '@/components/kit'

export const metadata = { title: 'Mua hàng · Kho & tồn' }

/**
 * TRANG TẠM — chưa dựng theo sổ thiết kế. Khuôn dự kiến: C.
 *
 * Tồn tại vì hai lý do, và cả hai đều thật:
 *  1. Thanh điều hướng prefetch mọi mục; mục nào 404 thì Next thử lại liên tục
 *     (đo 10/09/2026: 200 lượt gọi `/mua-hang/van-de` trong một phiên).
 *  2. Người dùng bấm vào phải có đường đi tiếp, không phải trang lỗi. Bản cũ ở
 *     `/planning/stock` vẫn chạy đầy đủ — trang này dẫn sang đó, nói rõ vì sao.
 *
 * Dựng xong trang thật thì XOÁ file này, đừng đắp lên.
 */
export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader eyebrow="Mua hàng" title="Kho & tồn" />
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Trang này chưa dựng theo sổ thiết kế mới"
          reason="Câu hỏi nó sẽ trả lời: “Còn bao nhiêu, có phải mua không?” Trong lúc chờ, bản cũ vẫn đầy đủ tính năng."
          next={
            <>
              <Btn primary href="/planning/stock">Mở bản cũ</Btn>
              <Btn href="/design-lab">Xem sổ thiết kế</Btn>
            </>
          }
        />
      </div>
    </div>
  )
}
