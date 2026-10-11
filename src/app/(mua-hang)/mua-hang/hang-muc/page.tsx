import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { projectsService } from '@/modules/dept/supply/projects.service'
import { HangMucScreen } from './HangMucScreen'

export const metadata = { title: 'Mua hàng · Hạng mục' }

/**
 * HẠNG MỤC NGOÀI SẢN XUẤT — danh sách (Khuôn C, B3 bản vẽ Đầu đơn mua, 12/10/2026).
 *
 * Câu hỏi: "Mọi việc ngoài sản xuất đang tiêu bao nhiêu, việc nào cần tôi động
 * vào?" — mỗi hạng mục một dòng: số đơn, đã đặt so dự toán, đã về, còn nợ NCC,
 * và cột "Cần chú ý" đếm bằng đúng hàm của hồ sơ hạng mục (lib/hang-muc).
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [rows, canManage] = await Promise.all([
    projectsService.list(user),
    canAction(user, 'supply.po.manage'),
  ])
  return <HangMucScreen rows={rows} canManage={canManage} />
}
