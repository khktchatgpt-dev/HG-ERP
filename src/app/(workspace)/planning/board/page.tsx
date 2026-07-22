import { redirect } from 'next/navigation'

/**
 * Bảng tổng tiến độ đã DỜI HẲN sang workspace Sản xuất (/production/board) —
 * nơi duy nhất (user chốt: tiến độ nằm bên Sản xuất). Giữ route này để link cũ
 * không vỡ, chuyển hướng sang bản Sản xuất. Kế hoạch/Cung ứng có quyền xem ở đó.
 */
export default async function PlanningBoardPage() {
  redirect('/production/board')
}
