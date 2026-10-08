import './thu-vien.css'

/**
 * Khu Thư viện SP mới — màn ở đây KHÔNG dùng kit: CSS riêng (`thu-vien.css`,
 * phạm vi `.tv`). Chữ dùng font HỆ THỐNG (chủ dự án 08/10/2026: "chuyển hết về
 * kiểu chữ hệ thống"), như app CodeIgniter cũ. Chỉ các hộp thoại dùng chung
 * (nhân bản, xem ảnh, đọc BOM) là của app.
 */
export default function ThuVienLayout({ children }: { children: React.ReactNode }) {
  return <div className="tv">{children}</div>
}
