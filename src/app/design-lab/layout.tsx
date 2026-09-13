import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { LabBar } from './_lab/LabBar'
import './_lab/lab.css'

export const metadata: Metadata = {
  title: 'HG-ERP · Sổ thiết kế',
  description:
    'Sổ thiết kế của HG-ERP: nguyên tắc, bốn khuôn màn và thư viện thành phần của bộ kit.',
}

/**
 * Khu `design-lab` CÔNG KHAI (`PUBLIC_PATHS` ở proxy.ts) — đưa người ngoài xem
 * không cần cấp tài khoản.
 *
 * Layout chỉ đeo lớp token `.kit` và thanh điều hướng của sổ, KHÔNG dựng cột
 * tài liệu: các màn mẫu phải được chiếm trọn bề ngang như màn thật, còn trang
 * chữ thì tự bọc `<Doc>`. Nhốt cả hai vào một cột thì màn mẫu bị bóp và mất
 * đúng thứ nó sinh ra để chứng minh — bảng dài dùng được ở bề ngang thật.
 */
export default function DesignLabLayout({ children }: { children: ReactNode }) {
  return (
    <div className="kit min-h-dvh">
      <LabBar />
      {children}
    </div>
  )
}
