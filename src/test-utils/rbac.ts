import { computeDerivedRoleKeys } from '@/modules/core/rbac/rbac.derive'
import type { User } from '@/modules/core/users/users.repo'

/**
 * Bản sao TS của ma trận `role_permissions` seed (0073_rbac.sql) — CHỈ dùng cho
 * unit test để giả lập `hasPermission` mà không cần DB. Phải khớp seed; đổi seed
 * thì cập nhật ở đây (rbac.service.test đối chiếu nguồn thật, còn đây là mock).
 */
export const SEED_ROLE_PERMS: Record<string, readonly string[]> = {
  admin: [], // admin bypass = true ở hasPermission, không cần liệt kê
  director: [
    'production.lsx.approve',
    'production.progress.track',
    'production.components.edit',
    'production.daylock.lock',
    'production.daylock.unlock',
    'production.incident.close',
    'production.team.manage',
    'supply.po.approve',
    'warehouse.edit',
    'warehouse.material.create',
    'technical.edit',
    'hr.leave.decide',
    'exec.tower.view',
    'exec.approvals.view',
  ],
  head: ['team.dashboard.view'],
  sales_staff: ['sales.member', 'production.lsx.issue', 'technical.bom.edit'],
  planner: ['planner.member', 'production.components.edit'],
  supply_staff: ['supply.member', 'warehouse.material.create'],
  production_staff: [
    'production.member',
    'production.progress.track',
    'production.output.record',
    'production.outsource.record',
    'production.daylock.lock',
    'production.incident.report',
    'production.team.manage',
  ],
  warehouse_staff: ['warehouse.member', 'warehouse.edit', 'warehouse.material.create'],
  technical_staff: ['technical.member', 'technical.edit', 'technical.bom.edit'],
  accounting_staff: ['accounting.member'],
  hr_staff: ['hr.member'],
}

export type DeptInfo = {
  name: string
  workspace_id: string | null
  head_user_id?: string | null
}

/**
 * Tạo `hasPermission` giả lập từ ma trận seed + `computeDerivedRoleKeys` THẬT —
 * dùng trong `vi.mock('@/modules/core/rbac/rbac.service', …)`. Trả về đúng như
 * RBAC production sẽ trả (admin bypass; role dẫn-xuất từ phòng/vai).
 *
 * @param deptById tra phòng theo id (thường tái dùng fixture của test).
 */
export function makeFakeHasPermission(
  deptById: (
    id: string,
  ) => DeptInfo | null | undefined | Promise<DeptInfo | null | undefined>,
) {
  return async (user: User, key: string): Promise<boolean> => {
    if (user.role === 'admin') return true
    const dept = user.department_id ? await deptById(user.department_id) : null
    const roles = computeDerivedRoleKeys({
      role: user.role,
      deptName: dept?.name ?? null,
      workspaceId: dept?.workspace_id ?? null,
      isHead: !!dept && dept.head_user_id === user.id,
    })
    return roles.some((r) => SEED_ROLE_PERMS[r]?.includes(key))
  }
}
