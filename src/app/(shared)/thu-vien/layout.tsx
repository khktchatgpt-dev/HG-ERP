import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import './thu-vien.css'

/**
 * Khu Thư viện SP mới — màn ở đây KHÔNG dùng kit: CSS riêng (`thu-vien.css`,
 * phạm vi `.tv`). Chữ dùng font HỆ THỐNG (chủ dự án 08/10/2026: "chuyển hết về
 * kiểu chữ hệ thống"), như app CodeIgniter cũ. Chỉ các hộp thoại dùng chung
 * (nhân bản, xem ảnh, đọc BOM) là của app.
 *
 * RIÊNG CỦA KỸ THUẬT (13/10/2026, chủ dự án chốt): thư mục vẫn nằm dưới
 * `(shared)` để giữ URL `/thu-vien` và vỏ theo phòng nhà, nhưng cửa vào là
 * cửa workspace Kỹ thuật — admin, người nhà Kỹ thuật, hoặc ai được cấp
 * `workspace.view.technical` (cùng luật `canEnterWorkspace`). Người phòng
 * khác bị đưa về thư viện dùng chung `/products`.
 */
export default async function ThuVienLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'technical'))) redirect('/products')
  return <div className="tv">{children}</div>
}
