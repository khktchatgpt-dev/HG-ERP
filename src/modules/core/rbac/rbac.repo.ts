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
  /** 'derived' = do sync quản lý (khoá UI); 'manual' = IT gán tay (sửa được). */
  source: 'derived' | 'manual'
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
        'user_id, role_id, source, users!user_roles_user_id_fkey!inner(name, email, deleted_at)',
      )
    type Raw = {
      user_id: string
      role_id: string
      source: 'derived' | 'manual'
      users: { name: string | null; email: string; deleted_at: string | null }
    }
    return ((data ?? []) as unknown as Raw[])
      .filter((r) => r.users && r.users.deleted_at === null)
      .map((r) => ({
        user_id: r.user_id,
        role_id: r.role_id,
        user_name: r.users.name,
        user_email: r.users.email,
        source: r.source,
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

  /** Tập ROLE KEY của user (kể cả role nhãn không quyền — 0087 tách UI vị trí). */
  async roleKeysForUser(userId: string): Promise<string[]> {
    const { data } = await db()
      .from('user_roles')
      .select('roles!inner(key, is_active)')
      .eq('user_id', userId)
    type Raw = { roles: { key: string; is_active: boolean } | null }
    return ((data ?? []) as unknown as Raw[])
      .filter((r) => r.roles?.is_active)
      .map((r) => r.roles!.key)
  },

  // ── Sync (Phase 1.5): reconcile role DẪN-XUẤT theo vai + phòng ────────────

  /** Map key→id cho một danh sách role key (bỏ key không tồn tại). */
  async roleIdsByKeys(keys: string[]): Promise<Map<string, string>> {
    if (keys.length === 0) return new Map()
    const { data } = await db().from('roles').select('id, key').in('key', keys)
    return new Map(
      ((data ?? []) as { id: string; key: string }[]).map((r) => [r.key, r.id]),
    )
  },

  /** role_id các vai DẪN-XUẤT (source='derived') hiện gán cho user. */
  async listDerivedRoleIds(userId: string): Promise<string[]> {
    const { data } = await db()
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('source', 'derived')
    return ((data ?? []) as { role_id: string }[]).map((r) => r.role_id)
  },

  async addDerivedRoles(userId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return
    const rows = roleIds.map((role_id) => ({
      user_id: userId,
      role_id,
      source: 'derived',
    }))
    const { error } = await db().from('user_roles').upsert(rows, {
      onConflict: 'user_id,role_id',
      ignoreDuplicates: true,
    })
    if (error) throw new Error(error.message)
  },

  /** Chỉ gỡ role DẪN-XUẤT — không đụng role IT gán tay (source='manual'). */
  async removeDerivedRoles(userId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return
    const { error } = await db()
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'derived')
      .in('role_id', roleIds)
    if (error) throw new Error(error.message)
  },

  // ── Ghi (Phase 3): IT tự phục vụ ở /admin/permissions ─────────────────────

  async findRoleById(id: string): Promise<Role | null> {
    const { data } = await db().from('roles').select(ROLE_COLS).eq('id', id).maybeSingle()
    return (data as Role | null) ?? null
  },

  async findRoleByKey(key: string): Promise<Role | null> {
    const { data } = await db()
      .from('roles')
      .select(ROLE_COLS)
      .eq('key', key)
      .maybeSingle()
    return (data as Role | null) ?? null
  },

  async insertRole(input: {
    key: string
    label: string
    description: string | null
    sort_order: number
  }): Promise<Role> {
    const { data, error } = await db()
      .from('roles')
      .insert({ ...input, is_system: false, is_active: true })
      .select(ROLE_COLS)
      .single()
    if (error) throw new Error(error.message)
    return data as Role
  },

  async updateRole(
    id: string,
    patch: Partial<Pick<Role, 'label' | 'description' | 'is_active' | 'sort_order'>>,
  ): Promise<Role> {
    const { data, error } = await db()
      .from('roles')
      .update(patch)
      .eq('id', id)
      .select(ROLE_COLS)
      .single()
    if (error) throw new Error(error.message)
    return data as Role
  },

  /** Permission KEY hiện gán cho 1 role (để tính delta audit). */
  async permissionKeysForRole(roleId: string): Promise<string[]> {
    const { data } = await db()
      .from('role_permissions')
      .select('permission_key')
      .eq('role_id', roleId)
    return ((data ?? []) as { permission_key: string }[]).map((r) => r.permission_key)
  },

  /** Đặt LẠI toàn bộ quyền của 1 role = danh sách keys (xoá hết rồi chèn). */
  async setRolePermissions(roleId: string, keys: string[]): Promise<void> {
    const del = await db().from('role_permissions').delete().eq('role_id', roleId)
    if (del.error) throw new Error(del.error.message)
    if (keys.length === 0) return
    const rows = keys.map((permission_key) => ({ role_id: roleId, permission_key }))
    const { error } = await db().from('role_permissions').insert(rows)
    if (error) throw new Error(error.message)
  },

  /** role_id các vai GÁN-TAY (source='manual') hiện có của user. */
  async listManualRoleIds(userId: string): Promise<string[]> {
    const { data } = await db()
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('source', 'manual')
    return ((data ?? []) as { role_id: string }[]).map((r) => r.role_id)
  },

  async addManualRoles(
    userId: string,
    roleIds: string[],
    actorId: string,
  ): Promise<void> {
    if (roleIds.length === 0) return
    const rows = roleIds.map((role_id) => ({
      user_id: userId,
      role_id,
      source: 'manual',
      assigned_by: actorId,
    }))
    const { error } = await db()
      .from('user_roles')
      .upsert(rows, { onConflict: 'user_id,role_id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },

  /** Chỉ gỡ role GÁN-TAY — không đụng role dẫn-xuất (source='derived'). */
  async removeManualRoles(userId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return
    const { error } = await db()
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'manual')
      .in('role_id', roleIds)
    if (error) throw new Error(error.message)
  },
}

// ── Audit (0075) — nhật ký thao tác phân quyền ──────────────────────────────

export type RbacAuditAction =
  | 'role.created'
  | 'role.updated'
  | 'role.permissions_changed'
  | 'role.assigned'
  | 'role.revoked'

export type RbacAuditEntry = {
  id: string
  actor_id: string | null
  action: RbacAuditAction
  target_type: 'role' | 'user'
  target_id: string
  target_label: string | null
  before: unknown
  after: unknown
  reason: string | null
  created_at: string
  actor_name: string | null
}

export const rbacAuditRepo = {
  async insert(row: {
    actor_id: string
    action: RbacAuditAction
    target_type: 'role' | 'user'
    target_id: string
    target_label?: string | null
    before?: unknown
    after?: unknown
    reason?: string | null
  }): Promise<void> {
    const { error } = await db()
      .from('rbac_audit_log')
      .insert({
        actor_id: row.actor_id,
        action: row.action,
        target_type: row.target_type,
        target_id: row.target_id,
        target_label: row.target_label ?? null,
        before: (row.before ?? null) as never,
        after: (row.after ?? null) as never,
        reason: row.reason ?? null,
      })
    if (error) console.error('rbac_audit_log insert failed:', error.message)
  },

  async listRecent(limit = 100): Promise<RbacAuditEntry[]> {
    const { data } = await db()
      .from('rbac_audit_log')
      .select('*, actor:users!rbac_audit_log_actor_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    type Raw = Omit<RbacAuditEntry, 'actor_name'> & {
      actor: { name: string | null } | null
    }
    return ((data ?? []) as unknown as Raw[]).map((r) => ({
      ...r,
      actor_name: r.actor?.name ?? null,
    }))
  },
}
