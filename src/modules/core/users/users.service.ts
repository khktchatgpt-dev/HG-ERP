import { hashPassword } from '@/modules/core/auth/password'
import {
  usersRepo,
  userAuditRepo,
  type User,
  type UserAuditEntry,
  type UserRole,
} from '@/modules/core/users/users.repo'
import { assertCan } from '@/server/permissions'
import { safeSyncUserRoles } from '@/modules/core/rbac/rbac.sync'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

type CreateInput = {
  email: string
  password: string
  name?: string
  role: UserRole
  department_id?: string | null
  title?: string | null
}

type UpdateInput = Partial<{
  name: string | null
  role: UserRole
  department_id: string | null
  title: string | null
  is_active: boolean
}>

type BulkInputRow = CreateInput

export type BulkImportResult = {
  created: User[]
  skipped: Array<{ email: string; reason: string }>
}

function diffPatch<T extends object>(before: T, patch: Partial<T>): Partial<T> {
  const out: Partial<T> = {}
  for (const k of Object.keys(patch) as (keyof T)[]) {
    if (before[k] !== patch[k]) out[k] = patch[k]
  }
  return out
}

export const usersService = {
  /** Admin-only: provision a new account. */
  async create(actor: User, input: CreateInput): Promise<User> {
    assertCan(actor, 'user.manage')
    if (await usersRepo.existsByEmail(input.email)) {
      throw Conflict('Email already registered', 'EMAIL_TAKEN')
    }
    const password_hash = await hashPassword(input.password)
    const user = await usersRepo.insert({
      email: input.email,
      password_hash,
      name: input.name ?? null,
      role: input.role,
      department_id: input.department_id ?? null,
      title: input.title ?? null,
    })
    await userAuditRepo.insert({
      target_user_id: user.id,
      actor_id: actor.id,
      action: 'create',
      after: {
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        title: user.title,
      },
    })
    await safeSyncUserRoles(user.id)
    return user
  },

  /** Admin-only: change name/role/department/title/active. */
  async update(actor: User, id: string, patch: UpdateInput): Promise<User> {
    assertCan(actor, 'user.manage')
    const before = await usersRepo.findById(id)
    if (!before) throw NotFound('User not found')
    if (before.deleted_at)
      throw BadRequest('Cannot update a deleted user — restore first')
    // Cannot demote/lock self via API — matches UI guard.
    if (actor.id === id && (patch.role !== undefined || patch.is_active !== undefined)) {
      throw Forbidden('Cannot change your own role or active state')
    }
    const changed = diffPatch<User>(before, patch)
    const user = await usersRepo.update(id, patch)
    // Đổi vai/phòng → đồng bộ lại role RBAC dẫn-xuất.
    if (patch.role !== undefined || patch.department_id !== undefined) {
      await safeSyncUserRoles(id)
    }
    if (Object.keys(changed).length > 0) {
      await userAuditRepo.insert({
        target_user_id: id,
        actor_id: actor.id,
        action: 'update',
        before: changed,
        after: Object.fromEntries(
          (Object.keys(changed) as (keyof User)[]).map((k) => [k, user[k]]),
        ),
      })
    }
    return user
  },

  /** Admin-only: force-set a new password for another user (or self). */
  async resetPassword(
    actor: User,
    id: string,
    newPassword: string,
    reason?: string,
  ): Promise<void> {
    assertCan(actor, 'user.manage')
    const target = await usersRepo.findById(id)
    if (!target) throw NotFound('User not found')
    if (target.deleted_at) throw BadRequest('Cannot reset password on a deleted user')
    const password_hash = await hashPassword(newPassword)
    await usersRepo.setPasswordHash(id, password_hash)
    await userAuditRepo.insert({
      target_user_id: id,
      actor_id: actor.id,
      action: 'password_reset',
      reason,
    })
  },

  /** Admin-only: soft-delete. Sets deleted_at + is_active=false. Never hard-delete. */
  async softDelete(actor: User, id: string, reason?: string): Promise<User> {
    assertCan(actor, 'user.manage')
    if (actor.id === id) throw Forbidden('Cannot delete your own account')
    const before = await usersRepo.findById(id)
    if (!before) throw NotFound('User not found')
    if (before.deleted_at) throw BadRequest('User already deleted')
    const user = await usersRepo.softDelete(id)
    await userAuditRepo.insert({
      target_user_id: id,
      actor_id: actor.id,
      action: 'soft_delete',
      before: { deleted_at: null, is_active: before.is_active },
      after: { deleted_at: user.deleted_at, is_active: user.is_active },
      reason,
    })
    return user
  },

  /** Admin-only: restore a soft-deleted user. */
  async restore(actor: User, id: string): Promise<User> {
    assertCan(actor, 'user.manage')
    const before = await usersRepo.findById(id)
    if (!before) throw NotFound('User not found')
    if (!before.deleted_at) throw BadRequest('User is not deleted')
    const user = await usersRepo.restore(id)
    await userAuditRepo.insert({
      target_user_id: id,
      actor_id: actor.id,
      action: 'restore',
      before: { deleted_at: before.deleted_at, is_active: before.is_active },
      after: { deleted_at: null, is_active: true },
    })
    return user
  },

  /** Admin-only: bulk-create from Excel/CSV import. Emails already in DB are skipped, reported. */
  async bulkImport(actor: User, rows: BulkInputRow[]): Promise<BulkImportResult> {
    assertCan(actor, 'user.manage')

    // Dedupe within the batch by email; last row wins.
    const byEmail = new Map<string, BulkInputRow>()
    for (const r of rows) byEmail.set(r.email.toLowerCase(), r)
    const uniq = Array.from(byEmail.values())

    // Skip rows whose email already exists in DB.
    const skipped: BulkImportResult['skipped'] = []
    const toInsert: BulkInputRow[] = []
    for (const r of uniq) {
      if (await usersRepo.existsByEmail(r.email)) {
        skipped.push({ email: r.email, reason: 'EMAIL_TAKEN' })
      } else {
        toInsert.push(r)
      }
    }
    if (toInsert.length === 0) return { created: [], skipped }

    // Hash all passwords in parallel.
    const hashed = await Promise.all(
      toInsert.map(async (r) => ({
        email: r.email,
        password_hash: await hashPassword(r.password),
        name: r.name ?? null,
        role: r.role,
        department_id: r.department_id ?? null,
        title: r.title ?? null,
      })),
    )
    const created = await usersRepo.bulkInsert(hashed)

    // One audit entry per created user (so per-user history stays accurate).
    await Promise.all(
      created.map((u) =>
        userAuditRepo.insert({
          target_user_id: u.id,
          actor_id: actor.id,
          action: 'bulk_import',
          after: { email: u.email, role: u.role, department_id: u.department_id },
        }),
      ),
    )
    await Promise.all(created.map((u) => safeSyncUserRoles(u.id)))
    return { created, skipped }
  },

  /**
   * List users for pickers / management.
   * - employee: forbidden
   * - manager:  scoped to their own department
   * - admin:    any department (optional filter). Sees inactive/deleted if requested.
   */
  async list(
    actor: User,
    filter: {
      department_id?: string
      role?: UserRole
      q?: string
      includeInactive?: boolean
      includeDeleted?: boolean
    } = {},
  ): Promise<User[]> {
    if (actor.role === 'employee') throw Forbidden()

    let departmentId = filter.department_id
    if (actor.role === 'manager') departmentId = actor.department_id ?? undefined

    const includeInactive = filter.includeInactive === true && actor.role === 'admin'
    const includeDeleted = filter.includeDeleted === true && actor.role === 'admin'

    return usersRepo.list({
      department_id: departmentId,
      role: filter.role,
      q: filter.q,
      active_only: !includeInactive,
      include_deleted: includeDeleted,
    })
  },

  /** Admin-only: audit history for a specific user (or all recent). */
  async getAudit(
    actor: User,
    opts: { target_user_id?: string; limit?: number } = {},
  ): Promise<UserAuditEntry[]> {
    assertCan(actor, 'user.manage')
    const limit = opts.limit ?? 50
    if (opts.target_user_id) {
      return userAuditRepo.listForUser(opts.target_user_id, limit)
    }
    return userAuditRepo.listRecent(limit)
  },
}
