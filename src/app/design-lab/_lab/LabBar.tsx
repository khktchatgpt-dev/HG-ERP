'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Thanh điều hướng của SỔ THIẾT KẾ.
 *
 * Nằm trên MỌI trang trong `/design-lab`, kể cả các màn mẫu chiếm trọn màn
 * hình — chủ ý: người xem mẫu phải quay về sổ được bằng một cú bấm, và phải
 * luôn thấy mình đang đứng trong tài liệu chứ không phải trong app thật.
 *
 * `usePathname` khớp CHÍNH XÁC chứ không `startsWith`: `/design-lab` là tiền
 * tố của mọi mục khác nên `startsWith` làm mục đầu luôn sáng.
 */
const LINKS: [string, string][] = [
  ['/design-lab', 'Nguyên tắc'],
  ['/design-lab/mau-vao-viec', 'A · Vào việc'],
  ['/design-lab/mau-hop-thu', 'B · Hộp thư'],
  ['/design-lab/mau-danh-sach', 'C · Danh sách'],
  ['/design-lab/mau-erp', 'D · Chứng từ'],
  ['/design-lab/mau-ho-so-ncc', 'E · Hồ sơ'],
  ['/design-lab/mau-soan-don', 'F · Nhập liệu'],
  ['/design-lab/thanh-phan', 'Thành phần'],
]

export function LabBar() {
  const path = usePathname()
  return (
    <nav className="lab-bar">
      <Link href="/design-lab" className="lab-brand">
        HG-ERP <span>Sổ thiết kế</span>
      </Link>
      <div className="lab-nav">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
