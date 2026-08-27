import { redirect } from 'next/navigation'

/**
 * Khu Thống kê không còn màn nhập riêng: "Sổ sản lượng" đã XOÁ 27/08/2026 theo
 * yêu cầu. Trang gốc chuyển thẳng sang Tiến độ theo lệnh để `/thongke` (route
 * của workspace, cũng là đích redirect sau đăng nhập) không rơi vào 404.
 *
 * Redirect đặt ở page chứ không ở `MOVED_PREFIXES` của proxy.ts vì đích đến nằm
 * TRONG chính layout này — không phải chuyển khu, nên không dính bẫy "stub nằm
 * trong layout cũ vẫn bị gác quyền khu cũ".
 */
export default function ThongKeHomePage() {
  redirect('/thongke/lenh')
}
