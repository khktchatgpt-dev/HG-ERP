import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'

export type Action =
  | 'task.create_self'   // tự tạo task cho mình
  | 'task.assign'        // giao cho người khác
  | 'task.update'
  | 'task.delete'
  | 'task.approve'
  | 'task.submit'
  | 'task.view'
  | 'user.manage'
  | 'department.manage'

type Ctx = {
  task?: {
    assigner_id: string
    assignee_id: string
    department_id: string | null
    kind?: 'assigned' | 'self'
  }
  /** Intended assignee for a new task (used before the row exists). */
  intendedAssigneeId?: string
}

export function can(user: User, action: Action, ctx: Ctx = {}): boolean {
  if (user.role === 'admin') return true

  switch (action) {
    case 'task.create_self':
      // Any signed-in active user can create a personal task for themselves.
      return ctx.intendedAssigneeId === user.id

    case 'task.assign':
      return user.role === 'manager'

    case 'task.update':
    case 'task.delete':
      if (!ctx.task) return false
      // Self-created task: creator may freely edit / delete.
      if (ctx.task.kind === 'self' && ctx.task.assigner_id === user.id) return true
      // Assigned task: only the manager who assigned it.
      return user.role === 'manager' && ctx.task.assigner_id === user.id

    case 'task.approve':
      return (
        user.role === 'manager' &&
        ctx.task?.assigner_id === user.id &&
        ctx.task?.kind !== 'self'
      )

    case 'task.submit':
      return (
        ctx.task?.assignee_id === user.id && ctx.task?.kind !== 'self'
      )

    case 'task.view':
      if (!ctx.task) return false
      if (ctx.task.assignee_id === user.id) return true
      if (ctx.task.assigner_id === user.id) return true
      if (
        user.role === 'manager' &&
        user.department_id &&
        ctx.task.department_id === user.department_id
      )
        return true
      return false

    case 'user.manage':
    case 'department.manage':
      return false
  }
}

export function assertCan(user: User, action: Action, ctx: Ctx = {}) {
  if (!can(user, action, ctx)) {
    throw Forbidden(`Not allowed: ${action}`)
  }
}
