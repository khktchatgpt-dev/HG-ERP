import type { Rule } from '@/modules/core/rbac/actions'

/** Hằng + helper trình bày dùng chung cho mọi trang con /admin/permissions/*.
 *  KHÔNG 'use client' — server component cũng import được (thuần dữ liệu/hàm). */

export const DOMAIN_LABEL: Record<string, string> = {
  production: 'Sản xuất',
  sales: 'Bán hàng',
  supply: 'Cung ứng',
  warehouse: 'Kho',
  technical: 'Kỹ thuật',
  hr: 'Nhân sự',
  accounting: 'Kế toán',
  exec: 'Điều hành',
  team: 'Đội nhóm',
  system: 'Hệ thống',
  task: 'Công việc',
}

export const GLOBAL_ROLE: Record<string, { label: string; cls: string }> = {
  admin: {
    label: 'Admin',
    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  manager: {
    label: 'Quản lý',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  employee: {
    label: 'Nhân viên',
    cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  },
}

const GLOBAL_ROLE_SHORT: Record<string, string> = {
  admin: 'Admin',
  manager: 'Quản lý',
  employee: 'Nhân viên',
}

export const gkey = (roleId: string, permKey: string) => `${roleId} ${permKey}`

export const initials = (name: string | null, email: string) =>
  (name ?? email).trim().slice(0, 1).toUpperCase()

/** Luật thao tác → chuỗi tiếng Việt đọc được (permLabel tra nhãn permission). */
export function ruleText(
  rule: Rule,
  permLabel: (k: string) => string,
  top = true,
): string {
  switch (rule.kind) {
    case 'public':
      return 'Mọi nhân viên'
    case 'perm':
      return permLabel(rule.key)
    case 'role':
      return rule.of.map((r) => GLOBAL_ROLE_SHORT[r] ?? r).join(' hoặc ')
    case 'allOf': {
      const s = rule.of.map((r) => ruleText(r, permLabel, false)).join(' VÀ ')
      return top ? s : `(${s})`
    }
    case 'anyOf': {
      const s = rule.of.map((r) => ruleText(r, permLabel, false)).join(' HOẶC ')
      return top ? s : `(${s})`
    }
  }
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'role.created': 'Tạo vai',
  'role.updated': 'Sửa vai',
  'role.permissions_changed': 'Đổi quyền của vai',
  'role.assigned': 'Gán vai',
  'role.revoked': 'Thu vai',
}

export function auditDetail(e: {
  action: string
  before: unknown
  after: unknown
}): string {
  const a = (e.after ?? {}) as Record<string, unknown>
  const b = (e.before ?? {}) as Record<string, unknown>
  if (e.action === 'role.permissions_changed') {
    const added = (a.added as string[]) ?? []
    const removed = (b.removed as string[]) ?? []
    const parts: string[] = []
    if (added.length) parts.push(`＋${added.join(', ')}`)
    if (removed.length) parts.push(`－${removed.join(', ')}`)
    return parts.join('  ') || '—'
  }
  if (e.action === 'role.assigned') return `＋ ${String(a.role_label ?? '')}`
  if (e.action === 'role.revoked') return `－ ${String(b.role_label ?? '')}`
  if (e.action === 'role.created') return String(a.key ?? '')
  return '—'
}
