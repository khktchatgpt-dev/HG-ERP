import type { ReactNode } from 'react'
import { KhoBar } from './_kho/KhoBar'

/**
 * Bảy màn mẫu của phân hệ Kho, dựng HOÀN TOÀN bằng `@/components/kit`.
 *
 * Vừa là mẫu vừa là PHÉP THỬ API của kit: dựng trọn một phân hệ mà phải chế
 * thêm CSS tại chỗ thì kit còn thiếu, và chỗ thiếu lộ ra ngay tại đó. Mọi chỗ
 * phải tự viết style đều có chú thích nói rõ vì sao và kit thiếu cái gì.
 *
 * Thiết kế giấy trắng: xem `docs/thiet-ke-kho-ui.md`.
 */
export default function KhoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KhoBar />
      {children}
    </>
  )
}
