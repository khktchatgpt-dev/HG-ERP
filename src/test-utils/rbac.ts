import { computeDerivedRoleKeys } from '@/modules/core/rbac/rbac.derive'
import { ACTIONS, evalRule } from '@/modules/core/rbac/actions'
import { Forbidden } from '@/server/http'
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
type DeptResolver = (
  id: string,
) => DeptInfo | null | undefined | Promise<DeptInfo | null | undefined>

/** Tập permission key dẫn-xuất của user (ma trận seed) — nền cho các fake dưới. */
async function permSetOf(user: User, deptById: DeptResolver): Promise<Set<string>> {
  const dept = user.department_id ? await deptById(user.department_id) : null
  const roles = computeDerivedRoleKeys({
    role: user.role,
    deptName: dept?.name ?? null,
    workspaceId: dept?.workspace_id ?? null,
    isHead: !!dept && dept.head_user_id === user.id,
  })
  const keys = new Set<string>()
  for (const r of roles) for (const k of SEED_ROLE_PERMS[r] ?? []) keys.add(k)
  return keys
}

export function makeFakeHasPermission(deptById: DeptResolver) {
  return async (user: User, key: string): Promise<boolean> => {
    if (user.role === 'admin') return true
    return (await permSetOf(user, deptById)).has(key)
  }
}

/**
 * Giả lập `canAction`/`assertAction` (Phase B) — dùng REGISTRY thật (`ACTIONS` +
 * `evalRule`) trên tập quyền giả lập. Cho test service đã chuyển sang assertAction.
 */
export function makeFakeCanAction(deptById: DeptResolver) {
  return async (user: User, actionKey: string): Promise<boolean> => {
    if (user.role === 'admin') return true
    const action = ACTIONS.find((a) => a.key === actionKey)
    if (!action) throw new Error(`Unknown action: ${actionKey}`)
    const keys = await permSetOf(user, deptById)
    return evalRule(action.rule, { role: user.role, has: (k) => keys.has(k) })
  }
}

export function makeFakeAssertAction(deptById: DeptResolver) {
  const can = makeFakeCanAction(deptById)
  return async (user: User, actionKey: string): Promise<void> => {
    if (!(await can(user, actionKey))) {
      throw Forbidden(`Không có quyền: ${actionKey}`)
    }
  }
}
