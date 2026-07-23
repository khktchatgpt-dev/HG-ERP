import { cache } from 'react'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { emit } from '@/events/bus'
import {
  rbacRepo,
  rbacAuditRepo,
  type Permission,
  type Role,
  type RolePermission,
  type UserRoleRow,
  type RbacAuditEntry,
} from './rbac.repo'
import { ACTIONS, evalRule } from './actions'
import type { z } from 'zod'
import type { roleCreateSchema, roleUpdateSchema } from './rbac.schema'

const ACTION_BY_KEY = new Map(ACTIONS.map((a) => [a.key, a]))

/**
 * Nạp tập permission của user MỘT LẦN mỗi request (React `cache()` dedup theo
 * userId). Không có cache này thì mỗi guard + mỗi lần render sidebar sẽ query
 * lặp — xem plan "điểm hiệu năng bắt buộc".
 */
const loadPermissionKeys = cache(
  async (userId: string): Promise<ReadonlySet<string>> =>
    new Set(await rbacRepo.permissionKeysForUser(userId)),
)

/**
 * Nguồn quyền TRUNG TÂM (RBAC data-hoá, 0073). Guard nghiệp vụ sẽ dần gọi
 * `hasPermission`/`assertPermission` thay cho `is*Staff`/`user.role===`.
 *
 * admin (cột users.role) LUÔN true — bypass, giữ đúng hành vi cũ ngay cả khi
 * tài khoản admin mới chưa được seed user_roles.
 */
export async function permissionsOf(user: User): Promise<ReadonlySet<string>> {
  return loadPermissionKeys(user.id)
}

export async function hasPermission(user: User, key: string): Promise<boolean> {
  if (user.role === 'admin') return true
  return (await loadPermissionKeys(user.id)).has(key)
}

export async function assertPermission(user: User, key: string): Promise<void> {
  if (!(await hasPermission(user, key))) {
    throw Forbidden(`Không có quyền: ${key}`)
  }
}

/**
 * Guard theo THAO TÁC (registry `actions.ts`) — nguồn sự thật cho phân quyền:
 * đánh giá luật boolean của thao tác trên tập quyền + vai toàn cục của user.
 * admin bypass. Điều kiện ROW-LEVEL (chủ sở hữu/tổ) service tự kiểm thêm.
 */
export async function canAction(user: User, actionKey: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const action = ACTION_BY_KEY.get(actionKey)
  if (!action) throw new Error(`Unknown action: ${actionKey}`)
  const keys = await loadPermissionKeys(user.id)
  return evalRule(action.rule, { role: user.role, has: (k) => keys.has(k) })
}

export async function assertAction(user: User, actionKey: string): Promise<void> {
  if (!(await canAction(user, actionKey))) {
    const label = ACTION_BY_KEY.get(actionKey)?.label ?? actionKey
    throw Forbidden(`Không có quyền: ${label}`)
  }
}

function assertAdmin(user: User): void {
  if (user.role !== 'admin') throw Forbidden('Chỉ admin xem/quản trị phân quyền')
}

export type RbacMatrixUser = {
  id: string
  name: string | null
  email: string
  /** Vai toàn cục (cột users.role) — 'admin' = bypass toàn quyền. */
  role: 'admin' | 'manager' | 'employee'
  department: string | null
}

export type RbacMatrix = {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
  /** Toàn bộ user đang hoạt động — cho picker gán vai (Phase 3). */
  users: RbacMatrixUser[]
}

export const rbacService = {
  permissionsOf,
  hasPermission,
  assertPermission,

  /** Toàn bộ dữ liệu cho ma trận /admin/permissions (admin-only). */
  async matrix(user: User): Promise<RbacMatrix> {
    assertAdmin(user)
    const [roles, permissions, rolePermissions, userRoles, allUsers, depts] =
      await Promise.all([
        rbacRepo.listRoles(true),
        rbacRepo.listPermissions(),
        rbacRepo.listRolePermissions(),
        rbacRepo.listUserRoles(),
        usersRepo.list({ active_only: true }),
        departmentsRepo.list(),
      ])
    const deptName = new Map(depts.map((d) => [d.id, d.name]))
    const users = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department_id ? (deptName.get(u.department_id) ?? null) : null,
    }))
    return { roles, permissions, rolePermissions, userRoles, users }
  },

  /** Nhật ký audit thao tác phân quyền (admin-only). */
  async audit(user: User): Promise<RbacAuditEntry[]> {
    assertAdmin(user)
    return rbacAuditRepo.listRecent(100)
  },

  // ── Ghi (Phase 3): admin-only, có audit + chặn tự-khoá ────────────────────

  async createRole(user: User, input: z.infer<typeof roleCreateSchema>): Promise<Role> {
    assertAdmin(user)
    if (await rbacRepo.findRoleByKey(input.key)) {
      throw Conflict(`Vai "${input.key}" đã tồn tại`, 'ROLE_KEY_TAKEN')
    }
    const role = await rbacRepo.insertRole({
      key: input.key,
      label: input.label,
      description: input.description ?? null,
      sort_order: 100, // vai IT tự tạo xếp sau vai hệ thống (1–20)
    })
    await emit({
      name: 'rbac.role.created',
      role_id: role.id,
      role_key: role.key,
      role_label: role.label,
      actor_id: user.id,
    })
    return role
  },

  async updateRole(
    user: User,
    id: string,
    patch: z.infer<typeof roleUpdateSchema>,
  ): Promise<Role> {
    assertAdmin(user)
    const before = await rbacRepo.findRoleById(id)
    if (!before) throw NotFound('Vai không tồn tại')
    // Chặn tự-khoá: KHÔNG vô hiệu hoá vai HỆ THỐNG (admin/director/… — cầu đồng
    // bộ dẫn-xuất + bypass phụ thuộc). Nhãn/mô tả/thứ tự vẫn sửa được.
    if (before.is_system && patch.is_active === false) {
      throw Forbidden('Không thể vô hiệu hoá vai hệ thống')
    }
    const role = await rbacRepo.updateRole(id, patch)
    await emit({
      name: 'rbac.role.updated',
      role_id: role.id,
      role_label: role.label,
      before: pick(before, patch),
      after: pick(role, patch),
      actor_id: user.id,
    })
    return role
  },

  /** Đặt lại toàn bộ quyền của 1 vai. Validate key ⊆ permissions thật. */
  async setRolePermissions(user: User, roleId: string, keys: string[]): Promise<void> {
    assertAdmin(user)
    const role = await rbacRepo.findRoleById(roleId)
    if (!role) throw NotFound('Vai không tồn tại')
    const uniq = [...new Set(keys)]
    const known = new Set((await rbacRepo.listPermissions()).map((p) => p.key))
    const unknown = uniq.filter((k) => !known.has(k))
    if (unknown.length) throw BadRequest(`Quyền không tồn tại: ${unknown.join(', ')}`)

    const beforeKeys = await rbacRepo.permissionKeysForRole(roleId)
    const beforeSet = new Set(beforeKeys)
    const afterSet = new Set(uniq)
    const added = uniq.filter((k) => !beforeSet.has(k))
    const removed = beforeKeys.filter((k) => !afterSet.has(k))
    if (added.length === 0 && removed.length === 0) return

    await rbacRepo.setRolePermissions(roleId, uniq)
    await emit({
      name: 'rbac.role.permissions_changed',
      role_id: roleId,
      role_label: role.label,
      added,
      removed,
      actor_id: user.id,
    })
  },

  /**
   * Đặt lại các vai GÁN-TAY (source='manual') của 1 user — vai DẪN-XUẤT do cầu
   * đồng bộ quản lý, KHÔNG đụng. Emit 1 sự kiện assigned/revoked mỗi delta.
   */
  async setUserManualRoles(
    user: User,
    targetUserId: string,
    roleIds: string[],
  ): Promise<void> {
    assertAdmin(user)
    const target = await usersRepo.findById(targetUserId)
    if (!target) throw NotFound('Người dùng không tồn tại')
    const uniq = [...new Set(roleIds)]
    const roles = await rbacRepo.listRoles(true)
    const roleById = new Map(roles.map((r) => [r.id, r]))
    const unknown = uniq.filter((id) => !roleById.has(id))
    if (unknown.length) throw BadRequest('Có vai không tồn tại trong danh sách')

    const current = new Set(await rbacRepo.listManualRoleIds(targetUserId))
    const next = new Set(uniq)
    const toAdd = uniq.filter((id) => !current.has(id))
    const toRemove = [...current].filter((id) => !next.has(id))
    if (toAdd.length === 0 && toRemove.length === 0) return

    await rbacRepo.addManualRoles(targetUserId, toAdd, user.id)
    await rbacRepo.removeManualRoles(targetUserId, toRemove)

    const label = target.name ?? target.email
    for (const id of toAdd) {
      const r = roleById.get(id)!
      await emit({
        name: 'rbac.role.assigned',
        user_id: targetUserId,
        user_label: label,
        role_id: id,
        role_key: r.key,
        role_label: r.label,
        actor_id: user.id,
      })
    }
    for (const id of toRemove) {
      const r = roleById.get(id)!
      await emit({
        name: 'rbac.role.revoked',
        user_id: targetUserId,
        user_label: label,
        role_id: id,
        role_key: r.key,
        role_label: r.label,
        actor_id: user.id,
      })
    }
  },
}

/** Lấy các field trong `patch` từ `obj` (để ghi before/after audit gọn). */
function pick(obj: Role, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(patch))
    out[k] = (obj as unknown as Record<string, unknown>)[k]
  return out
}
