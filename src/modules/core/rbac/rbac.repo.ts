import { db } from '@/server/db'

export type Permission = {
  key: string
  label: string
  domain: string
  sort_order: number
}

export type Role = {
  id: string
  key: string
  label: string
  description: string | null
  is_system: boolean
  is_active: boolean
  sort_order: number
}

/** Cặp role ↔ permission (cho ma trận). */
export type RolePermission = { role_id: string; permission_key: string }

/** Vai của một user, kèm nhãn (cho ma trận Role × User). */
export type UserRoleRow = {
  user_id: string
  role_id: string
  user_name: string | null
  user_email: string
}

const PERM_COLS = 'key, label, domain, sort_order'
const ROLE_COLS = 'id, key, label, description, is_system, is_active, sort_order'

/**
 * Truy cập dữ liệu RBAC (0073). Không chứa authz — service quyết định ai đọc/ghi.
 */
export const rbacRepo = {
  async listPermissions(): Promise<Permission[]> {
    const { data } = await db().from('permissions').select(PERM_COLS).order('sort_order')
    return (data ?? []) as Permission[]
  },

  async listRoles(includeInactive = false): Promise<Role[]> {
    let q = db().from('roles').select(ROLE_COLS).order('sort_order')
    if (!includeInactive) q = q.eq('is_active', true)
    const { data } = await q
    return (data ?? []) as Role[]
  },

  async listRolePermissions(): Promise<RolePermission[]> {
    const { data } = await db().from('role_permissions').select('role_id, permission_key')
    return (data ?? []) as RolePermission[]
  },

  /** Mọi gán user↔role kèm tên/email user (cho ma trận). Bỏ user đã xoá. */
  async listUserRoles(): Promise<UserRoleRow[]> {
    const { data } = await db()
      .from('user_roles')
      .select(
        'user_id, role_id, users!user_roles_user_id_fkey!inner(name, email, deleted_at)',
      )
    type Raw = {
      user_id: string
      role_id: string
      users: { name: string | null; email: string; deleted_at: string | null }
    }
    return ((data ?? []) as unknown as Raw[])
      .filter((r) => r.users && r.users.deleted_at === null)
      .map((r) => ({
        user_id: r.user_id,
        role_id: r.role_id,
        user_name: r.users.name,
        user_email: r.users.email,
      }))
  },

  /** Tập permission KEY hiệu lực của user (join user_roles → role_permissions). */
  async permissionKeysForUser(userId: string): Promise<string[]> {
    const { data } = await db()
      .from('user_roles')
      .select('roles!inner(is_active, role_permissions(permission_key))')
      .eq('user_id', userId)
    type Raw = {
      roles: { is_active: boolean; role_permissions: { permission_key: string }[] } | null
    }
    const keys = new Set<string>()
    for (const row of (data ?? []) as unknown as Raw[]) {
      if (!row.roles || !row.roles.is_active) continue
      for (const rp of row.roles.role_permissions) keys.add(rp.permission_key)
    }
    return [...keys]
  },
}
