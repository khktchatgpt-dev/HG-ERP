import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import './thu-vien.css'

/**
 * Khu Thư viện SP mới — màn ở đây KHÔNG dùng kit: CSS riêng (`thu-vien.css`,
 * phạm vi `.tv`). Chữ dùng font HỆ THỐNG (chủ dự án 08/10/2026: "chuyển hết về
 * kiểu chữ hệ thống"), như app CodeIgniter cũ. Chỉ các hộp thoại dùng chung
 * (nhân bản, xem ảnh, đọc BOM) là của app.
 *
 * MỞ CHO MỌI PHÒNG (20/11/2026, chủ dự án: "cho toàn bộ dùng thư viện sản
 * phẩm mới, xoá bỏ thư viện cũ") — thay cửa Kỹ thuật đặt 13/10. Quyền SỬA vẫn
 * do service quyết (`canEditProducts`, giá theo `technical.plan_cost.view`);
 * riêng `/thu-vien/lenh` là màn của Kỹ thuật nên tự gác ở page.
 */
export default async function ThuVienLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  return <div className="tv">{children}</div>
}
