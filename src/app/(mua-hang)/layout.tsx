import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { countMyTodos } from '@/lib/supply-watch'
import { SupplyShell } from './_shell/SupplyShell'

/**
 * MODULE MUA HÀNG — BẢN MỚI, dựng theo sổ thiết kế `/design-lab`.
 *
 * Xếp theo dòng chảy Procure-to-Pay, không theo phòng (xem `_shell/nav.ts`).
 * Bản cũ ở `/planning` VẪN CHẠY NGUYÊN VẸN. Hai bên không đụng route nhau và
 * không đụng file nhau; khu này chỉ có tầng GIAO DIỆN.
 *
 * ĐIỀU KIỆN SỐNG SÓT CỦA VIỆC NUÔI HAI BẢN. Ngày 09/09/2026 dự án đã cố ý gỡ
 * cơ chế chạy song song `?v4=1` với lý do đúng: nuôi hai bản nghĩa là mọi sửa
 * lỗi phải làm hai lần, và bản cũ không bao giờ chết. Lần này chấp nhận lại
 * cái giá đó, nhưng chỉ ở đúng một tầng:
 *
 *   · TẦNG GIAO DIỆN nhân đôi — chỉ ở đây, có chủ ý;
 *   · SERVICE / API / REPO / QUYỀN DÙNG CHUNG, tuyệt đối không sao chép.
 *     Sửa nghiệp vụ vẫn là sửa một chỗ, và cả hai bản cùng nhận.
 *
 * Nên: KHÔNG viết service mới trong khu này. Cần gì thì gọi đúng route
 * `/api/dept/supply/*` mà bản cũ đang gọi. Thiếu API thì bổ sung vào module
 * `src/modules/dept/supply/`, không dựng đường vòng riêng.
 *
 * Quyền vào: dùng lại `canEnterWorkspace(user, 'planning')` — cùng một luật
 * với bản cũ. Khai một tập quyền thứ hai cho cùng một phòng là cách chắc chắn
 * để hai bên lệch nhau về ai được vào.
 */
export default async function CungUngLayout({ children }: { children: React.ReactNode }) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (!(await canEnterWorkspace(user, 'planning'))) redirect('/')

  /**
   * Số trên nút hộp thư — cùng hàm với trang hộp thư và với badge của bản cũ
   * (`workspaces/nav-badges.ts`). Nạp cột nhẹ, nuốt lỗi: vỏ không được chết vì
   * một phép đếm.
   */
  let inboxCount = 0
  try {
    const rows = await posRepo.listWatchFields()
    inboxCount = countMyTodos(rows, user.id, new Date().toISOString().slice(0, 10))
  } catch {
    inboxCount = 0
  }

  return (
    <SupplyShell user={{ name: user.name ?? user.email, role: 'Mua hàng' }} inboxCount={inboxCount}>
      {children}
    </SupplyShell>
  )
}
