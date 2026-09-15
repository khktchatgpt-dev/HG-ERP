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
 * `usePathname` khớp CHÍNH XÁC, cộng một luật riêng cho mục có TRANG CON
 * (`/design-lab/kho` có bảy màn dưới nó): khớp thêm khi đường dẫn bắt đầu
 * bằng `href + '/'`. Dùng `startsWith` trần thì `/design-lab` là tiền tố của
 * mọi mục nên mục đầu luôn sáng — đó là lý do luật gốc khớp chính xác.
 */
const LINKS: [string, string][] = [
  ['/design-lab', 'Nguyên tắc'],
  ['/design-lab/mau-vao-viec', 'A · Vào việc'],
  ['/design-lab/mau-hop-thu', 'B · Hộp thư'],
  ['/design-lab/mau-danh-sach', 'C · Danh sách'],
  ['/design-lab/mau-erp', 'D · Chứng từ'],
  ['/design-lab/mau-ho-so-ncc', 'E · Hồ sơ'],
  ['/design-lab/mau-soan-don', 'F · Nhập liệu'],
  ['/design-lab/kho', 'Phân hệ Kho'],
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
        {LINKS.map(([href, label]) => {
          // Mục "Nguyên tắc" KHÔNG được ăn luật tiền tố — `/design-lab` là
          // tiền tố của mọi mục, nới cho nó là mục đầu luôn sáng.
          const on =
            path === href || (href !== '/design-lab' && path.startsWith(`${href}/`))
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
