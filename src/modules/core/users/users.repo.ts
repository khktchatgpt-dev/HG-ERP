import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'

export type UserRole = 'admin' | 'manager' | 'employee'

export type User = {
  id: string
  email: string
  name: string | null
  role: UserRole
  department_id: string | null
  title: string | null
  avatar_url: string | null
  is_active: boolean
  deleted_at: string | null
  password_changed_at: string | null
  last_login_at: string | null
  created_at: string
}

const SELECT_PUBLIC =
  'id, email, name, role, department_id, title, avatar_url, is_active, deleted_at, password_changed_at, last_login_at, created_at'

export type UserInsert = {
  email: string
  password_hash: string
  name?: string | null
  role?: UserRole
  department_id?: string | null
  title?: string | null
}

export type UserPatch = Partial<{
  name: string | null
  role: UserRole
  department_id: string | null
  title: string | null
  is_active: boolean
}>

export type UserListFilter = {
  department_id?: string
  role?: UserRole
  q?: string
  active_only?: boolean
  include_deleted?: boolean
}

export const usersRepo = {
  async findById(id: string): Promise<User | null> {
    const { data } = await db()
      .from('users')
      .select(SELECT_PUBLIC)
      .eq('id', id)
      .maybeSingle()
    return (data as User | null) ?? null
  },

  async findByEmail(email: string) {
    const { data } = await db()
      .from('users')
      .select(`${SELECT_PUBLIC}, password_hash`)
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle()
    return data as (User & { password_hash: string }) | null
  },

  async existsByEmail(email: string): Promise<boolean> {
    const { data } = await db()
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    return !!data
  },

  async insert(row: UserInsert): Promise<User> {
    const { data, error } = await db()
      .from('users')
      .insert(row)
      .select(SELECT_PUBLIC)
      .single()
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create user')
    }
    return data as User
  },

  async bulkInsert(rows: UserInsert[]): Promise<User[]> {
    if (rows.length === 0) return []
    const { data, error } = await db().from('users').insert(rows).select(SELECT_PUBLIC)
    if (error || !data) {
      throw new Error(error?.message ?? 'Could not bulk-insert users')
    }
    return data as User[]
  },

  async update(id: string, patch: UserPatch): Promise<User> {
    const { data, error } = await db()
      .from('users')
      .update(patch)
      .eq('id', id)
      .select(SELECT_PUBLIC)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Could not update user')
    return data as User
  },

  async setPasswordHash(id: string, password_hash: string): Promise<void> {
    const { error } = await db()
      .from('users')
      .update({ password_hash, password_changed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async softDelete(id: string): Promise<User> {
    const { data, error } = await db()
      .from('users')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .select(SELECT_PUBLIC)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Could not soft-delete user')
    return data as User
  },

  async restore(id: string): Promise<User> {
    const { data, error } = await db()
      .from('users')
      .update({ deleted_at: null, is_active: true })
      .eq('id', id)
      .select(SELECT_PUBLIC)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Could not restore user')
    return data as User
  },

  async list(filter: UserListFilter = {}): Promise<User[]> {
    let q = db().from('users').select(SELECT_PUBLIC).order('name')
    if (!filter.include_deleted) q = q.is('deleted_at', null)
    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.department_id) q = q.eq('department_id', filter.department_id)
    if (filter.role) q = q.eq('role', filter.role)
    if (filter.q) q = q.or(`name.ilike.%${filter.q}%,email.ilike.%${filter.q}%`)
    const { data } = await q
    return (data ?? []) as User[]
  },

  /** Map id → tên hiển thị (name || email) cho 1 nhóm id — nhãn "người lập/duyệt". */
  async displayNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids.filter(Boolean))]
    if (uniq.length === 0) return new Map()
    const { data } = await db().from('users').select('id, name, email').in('id', uniq)
    const m = new Map<string, string>()
    for (const u of (data ?? []) as { id: string; name: string | null; email: string }[])
      m.set(u.id, u.name || u.email)
    return m
  },

  async count(activeOnly = true): Promise<number> {
    let q = db()
      .from('users')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
    if (activeOnly) q = q.eq('is_active', true)
    const { count } = await q
    return count ?? 0
  },

  async touchLastLogin(id: string): Promise<void> {
    await db()
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id)
  },
}

// -- User audit log ---------------------------------------------------------

export type UserAuditAction =
  'create' | 'update' | 'password_reset' | 'soft_delete' | 'restore' | 'bulk_import'

export type UserAuditEntry = {
  id: string
  target_user_id: string
  actor_id: string | null
  action: UserAuditAction
  before: Json | null
  after: Json | null
  reason: string | null
  created_at: string
}

export const userAuditRepo = {
  async insert(row: {
    target_user_id: string
    actor_id: string
    action: UserAuditAction
    before?: unknown
    after?: unknown
    reason?: string
  }): Promise<void> {
    const { error } = await db()
      .from('user_audit_log')
      .insert({
        target_user_id: row.target_user_id,
        actor_id: row.actor_id,
        action: row.action,
        before: (row.before ?? null) as Json | null,
        after: (row.after ?? null) as Json | null,
        reason: row.reason ?? null,
      })
    if (error) console.error('user_audit_log insert failed:', error.message)
  },

  async listForUser(targetUserId: string, limit = 50): Promise<UserAuditEntry[]> {
    const { data } = await db()
      .from('user_audit_log')
      .select('*')
      .eq('target_user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as unknown as UserAuditEntry[]
  },

  async listRecent(limit = 50): Promise<UserAuditEntry[]> {
    const { data } = await db()
      .from('user_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as unknown as UserAuditEntry[]
  },
}
