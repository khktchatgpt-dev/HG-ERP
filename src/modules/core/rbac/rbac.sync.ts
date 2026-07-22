import { usersRepo } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { rbacRepo } from './rbac.repo'
import { computeDerivedRoleKeys } from './rbac.derive'

/**
 * Đồng bộ role DẪN-XUẤT của user với (vai + phòng + trưởng phòng) hiện tại —
 * gọi sau khi tạo user / đổi vai / đổi phòng. Reconcile: thêm role thiếu, gỡ
 * role thừa, KHÔNG đụng role IT gán tay (source='manual'). Nhờ đó user tạo mới
 * hay đổi phòng luôn có đúng quyền RBAC → mở khoá Phase 2 flip mà không gãy.
 *
 * Là bản sao CODE của backfill 0073 qua computeDerivedRoleKeys (khớp tuyệt đối).
 */
export async function syncUserRoles(userId: string): Promise<void> {
  const user = await usersRepo.findById(userId)
  if (!user) return

  const dept = user.department_id
    ? await departmentsRepo.findById(user.department_id)
    : null
  const headed = await departmentsRepo.findHeadedBy(userId)

  const desiredKeys = computeDerivedRoleKeys({
    role: user.role,
    deptName: dept?.name ?? null,
    workspaceId: dept?.workspace_id ?? null,
    isHead: !!headed,
  })

  const keyToId = await rbacRepo.roleIdsByKeys(desiredKeys)
  const desiredIds = new Set(keyToId.values())
  const currentIds = new Set(await rbacRepo.listDerivedRoleIds(userId))

  const toAdd = [...desiredIds].filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !desiredIds.has(id))

  await rbacRepo.addDerivedRoles(userId, toAdd)
  await rbacRepo.removeDerivedRoles(userId, toRemove)
}

/**
 * Best-effort: lỗi RBAC KHÔNG làm hỏng thao tác gọi (guard vẫn shadow-trả-legacy
 * ở Phase 1). Dùng ở users.service / departments.service.
 */
export async function safeSyncUserRoles(userId: string): Promise<void> {
  try {
    await syncUserRoles(userId)
  } catch (e) {
    console.error('[rbac] syncUserRoles failed for', userId, e)
  }
}
