import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { SubNav } from './_components/SubNav'

/**
 * Khu Phân quyền — shell chung (PageHeader + StatsBar đếm chung + SubNav).
 * Mỗi mục là 1 route con (people/roles/actions/matrix/audit) tự tải dữ liệu,
 * deep-link được. Shell giữ nguyên khi đổi tab, chỉ vùng con thay.
 */
export default async function PermissionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = (await authService.currentUser())!
  const c = await rbacService.overviewCounts(user)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Quản trị', href: '/admin' }, { label: 'Phân quyền' }]}
        title="Phân quyền"
        description="Chọn một nhân viên để xem đầy đủ vai trò và quyền họ đang có — kèm nguồn cấp từng quyền."
        actions={<SubNav />}
      />
      <StatsBar
        stats={[
          { label: 'Nhân viên', value: c.users, tone: 'blue' },
          { label: 'Vai trò', value: c.roles, tone: 'purple' },
          { label: 'Quyền', value: c.permissions, tone: 'default' },
          { label: 'Thao tác', value: c.actions, tone: 'amber' },
          { label: 'Gán tay', value: c.manual, tone: 'green' },
        ]}
      />
      {children}
    </div>
  )
}
