import { on } from '../bus'
import { rbacAuditRepo } from '@/modules/core/rbac/rbac.repo'

/**
 * Ghi NHẬT KÝ AUDIT phân quyền (0075) khi IT thao tác ở /admin/permissions.
 * 1 nguồn ghi duy nhất — service emit, handler ghi bảng; lỗi ghi audit được
 * bus nuốt + log, KHÔNG rollback thao tác gốc. Đăng ký 1 lần ở boot (register.ts).
 */
export function registerRbacAuditHandlers(): void {
  on('rbac.role.created', async (e) => {
    await rbacAuditRepo.insert({
      actor_id: e.actor_id,
      action: 'role.created',
      target_type: 'role',
      target_id: e.role_id,
      target_label: e.role_label,
      after: { key: e.role_key, label: e.role_label },
    })
  })

  on('rbac.role.updated', async (e) => {
    await rbacAuditRepo.insert({
      actor_id: e.actor_id,
      action: 'role.updated',
      target_type: 'role',
      target_id: e.role_id,
      target_label: e.role_label,
      before: e.before,
      after: e.after,
    })
  })

  on('rbac.role.permissions_changed', async (e) => {
    await rbacAuditRepo.insert({
      actor_id: e.actor_id,
      action: 'role.permissions_changed',
      target_type: 'role',
      target_id: e.role_id,
      target_label: e.role_label,
      before: { removed: e.removed },
      after: { added: e.added },
    })
  })

  on('rbac.role.assigned', async (e) => {
    await rbacAuditRepo.insert({
      actor_id: e.actor_id,
      action: 'role.assigned',
      target_type: 'user',
      target_id: e.user_id,
      target_label: e.user_label,
      after: { role_key: e.role_key, role_label: e.role_label },
    })
  })

  on('rbac.role.revoked', async (e) => {
    await rbacAuditRepo.insert({
      actor_id: e.actor_id,
      action: 'role.revoked',
      target_type: 'user',
      target_id: e.user_id,
      target_label: e.user_label,
      before: { role_key: e.role_key, role_label: e.role_label },
    })
  })
}
