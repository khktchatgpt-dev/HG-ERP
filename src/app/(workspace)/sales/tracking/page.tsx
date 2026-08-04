import { redirect } from 'next/navigation'

/**
 * Đường cũ "Theo dõi đơn" của Sales → trang LỆNH SẢN XUẤT (04/08/2026).
 *
 * Từ 0113 một lệnh gộp nhiều đơn nên nhìn theo ĐƠN là nhìn ngược: cùng một lệnh
 * nằm rải nhiều dòng. Bảng theo dõi đơn vẫn giữ nguyên cho Kế hoạch
 * (/planning/tracking) và Ban GĐ (/exec/tracking) — hai bộ phận đó theo đơn thật.
 */
export default function SalesTrackingRedirect() {
  redirect('/sales/lsx')
}
