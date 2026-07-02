import { describe, it, expect } from 'vitest'
import { can } from './permissions'
import type { User } from '@/modules/core/users/users.repo'

function u(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'a@b.com',
    name: 'A',
    role: 'employee',
    department_id: null,
    title: null,
    avatar_url: null,
    is_active: true,
    deleted_at: null,
    password_changed_at: null,
    last_login_at: null,
    created_at: '2026-01-01',
    ...overrides,
  }
}

describe('permissions.can', () => {
  it('admin có mọi quyền', () => {
    const admin = u({ role: 'admin' })
    expect(can(admin, 'user.manage')).toBe(true)
    expect(can(admin, 'department.manage')).toBe(true)
    expect(can(admin, 'task.assign')).toBe(true)
  })

  it('employee không được manage user hay dept', () => {
    const emp = u({ role: 'employee' })
    expect(can(emp, 'user.manage')).toBe(false)
    expect(can(emp, 'department.manage')).toBe(false)
    expect(can(emp, 'task.assign')).toBe(false)
  })

  it('employee tự tạo task cho mình được, người khác thì không', () => {
    const emp = u({ id: 'u1', role: 'employee' })
    expect(can(emp, 'task.create_self', { intendedAssigneeId: 'u1' })).toBe(true)
    expect(can(emp, 'task.create_self', { intendedAssigneeId: 'u2' })).toBe(false)
  })

  it('manager giao task được, employee không', () => {
    expect(can(u({ role: 'manager' }), 'task.assign')).toBe(true)
    expect(can(u({ role: 'employee' }), 'task.assign')).toBe(false)
  })

  it('chỉ manager tạo task mới được duyệt task đó (không phải self-task)', () => {
    const mgr = u({ id: 'm1', role: 'manager' })
    const ctx = {
      task: {
        assigner_id: 'm1',
        assignee_id: 'e1',
        department_id: 'd1',
        kind: 'assigned' as const,
      },
    }
    expect(can(mgr, 'task.approve', ctx)).toBe(true)

    // Manager khác không được duyệt task của người khác giao
    const other = u({ id: 'm2', role: 'manager' })
    expect(can(other, 'task.approve', ctx)).toBe(false)

    // Self-task không có "duyệt"
    const selfCtx = { ...ctx, task: { ...ctx.task, kind: 'self' as const } }
    expect(can(mgr, 'task.approve', selfCtx)).toBe(false)
  })

  it('assignee xem task được, người ngoài dept thì không', () => {
    const assignee = u({ id: 'e1', role: 'employee', department_id: 'd1' })
    const ctx = {
      task: {
        assigner_id: 'm1',
        assignee_id: 'e1',
        department_id: 'd1',
      },
    }
    expect(can(assignee, 'task.view', ctx)).toBe(true)

    const outsider = u({ id: 'e2', role: 'employee', department_id: 'd2' })
    expect(can(outsider, 'task.view', ctx)).toBe(false)
  })

  it('manager trong dept xem được task của dept mình', () => {
    const mgr = u({ id: 'm2', role: 'manager', department_id: 'd1' })
    const ctx = {
      task: {
        assigner_id: 'm1',
        assignee_id: 'e1',
        department_id: 'd1',
      },
    }
    expect(can(mgr, 'task.view', ctx)).toBe(true)
  })
})
