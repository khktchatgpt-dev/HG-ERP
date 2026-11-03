import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { lsxDossierService } from '@/modules/dept/production/lsx-dossier.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { HttpError } from '@/server/http'
import { Rong, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import { HoSoLenhScreen } from './HoSoLenhScreen'

export const dynamic = 'force-dynamic'

/**
 * HỒ SƠ LỆNH SẢN XUẤT — trang chứng từ của cả khu, mọi vai đều mở tới đây.
 *
 * 03/11/2026 (B5): dựng lại KHÔNG kit theo bản vẽ S3 — bảng đồng bộ ba tầng ×
 * công đoạn + năm con số mỗi ô + kế hoạch tổ/hạn tại chỗ. Mọi số tính ở
 * `lsxDossierService` bằng cùng hàm với Ghi sản lượng và Giao nhận.
 */
export default async function LsxDocPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  let data
  try {
    data = await lsxDossierService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      return (
        <SxKhung bare label="Lệnh sản xuất">
          <Rong
            tieuDe="Không tìm thấy lệnh sản xuất này"
            lyDo="Lệnh có thể đã bị xoá, hoặc đường dẫn mang một mã không còn tồn tại."
            tiep={
              <Link href="/thongke/lenh" className="sx-btn p">
                Về danh sách lệnh
              </Link>
            }
          />
        </SxKhung>
      )
    }
    throw e
  }
  const [staff, canPlan, canComplete] = await Promise.all([
    isProductionStaff(user),
    canAction(user, 'production.plan.manage'),
    // Đóng lệnh = production.progress.track (quản đốc, GĐ, admin). Ép đóng chỉ
    // admin/manager — hỏi TRƯỚC để nút nói đúng thứ bấm được.
    canAction(user, 'production.progress.track'),
  ])
  const mgmt = user.role === 'admin' || user.role === 'manager'
  return (
    <HoSoLenhScreen
      data={data}
      canRecord={user.role === 'admin' || staff}
      canComplete={canComplete}
      canForceComplete={mgmt}
      canPlan={canPlan}
      meId={user.id}
      meName={user.name ?? user.email}
    />
  )
}
