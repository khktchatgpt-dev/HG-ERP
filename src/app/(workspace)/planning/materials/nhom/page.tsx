import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { materialGroupsService } from '@/modules/dept/warehouse/material-groups.service'
import { GroupsScreen } from './GroupsScreen'

export const dynamic = 'force-dynamic'

/**
 * NHÓM VẬT TƯ — trang quản lý cho Cung ứng (03/09/2026, user: "không để admin
 * quản lí phần này"). Thêm / đổi tên / ngừng / xoá nhóm chính; đổi tên / gộp /
 * xoá nhóm phụ. Quyền `warehouse.material.group_manage` (Cung ứng + Kho).
 */
export default async function MaterialGroupsPage() {
  const user = await authService.requirePageUser()
  const [data, canEdit] = await Promise.all([
    materialGroupsService.overview(user),
    canAction(user, 'warehouse.material.group_manage'),
  ])
  return <GroupsScreen data={data} canEdit={user.role === 'admin' || canEdit} />
}
