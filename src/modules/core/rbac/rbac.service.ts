import { cache } from 'react'
import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'
import {
  rbacRepo,
  type Permission,
  type Role,
  type RolePermission,
  type UserRoleRow,
} from './rbac.repo'

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

function assertAdmin(user: User): void {
  if (user.role !== 'admin') throw Forbidden('Chỉ admin xem/quản trị phân quyền')
}

export type RbacMatrix = {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
}

export const rbacService = {
  permissionsOf,
  hasPermission,
  assertPermission,

  /** Toàn bộ dữ liệu cho ma trận /admin/permissions (chỉ đọc, admin-only). */
  async matrix(user: User): Promise<RbacMatrix> {
    assertAdmin(user)
    const [roles, permissions, rolePermissions, userRoles] = await Promise.all([
      rbacRepo.listRoles(true),
      rbacRepo.listPermissions(),
      rbacRepo.listRolePermissions(),
      rbacRepo.listUserRoles(),
    ])
    return { roles, permissions, rolePermissions, userRoles }
  },
}
