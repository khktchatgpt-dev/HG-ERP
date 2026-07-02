import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import {
  WORKSPACES,
  type WorkspaceConfig,
  type WorkspaceId,
} from './workspaces.config'

/**
 * Resolve default workspace của user.
 *
 * Ưu tiên:
 *   1. Admin không có dept → 'system' (workspace admin)
 *   2. User có dept.workspace_id → workspace tương ứng
 *   3. Fallback → null (caller redirect về /tasks)
 */
export async function resolveDefaultWorkspace(user: User): Promise<WorkspaceConfig | null> {
  if (user.role === 'admin' && !user.department_id) {
    return WORKSPACES.system
  }
  if (!user.department_id) return null

  const { data } = await db()
    .from('departments')
    .select('workspace_id')
    .eq('id', user.department_id)
    .maybeSingle()

  const workspaceId = data?.workspace_id as WorkspaceId | null | undefined
  if (!workspaceId) {
    // Admin fallback: nếu dept lỗi mapping thì đưa vào system.
    return user.role === 'admin' ? WORKSPACES.system : null
  }
  return WORKSPACES[workspaceId]
}

/** URL redirect sau login. */
export async function resolveDefaultRoute(user: User): Promise<string> {
  const ws = await resolveDefaultWorkspace(user)
  if (ws) return `${ws.route}/`
  return '/tasks'
}

/**
 * Workspace nào chứa route hiện tại?
 * Dùng cho highlight sidebar item + xác định theme màu.
 */
export function resolveWorkspaceFromPath(pathname: string): WorkspaceConfig | null {
  for (const ws of Object.values(WORKSPACES)) {
    if (pathname === ws.route || pathname.startsWith(ws.route + '/')) {
      return ws
    }
  }
  return null
}
