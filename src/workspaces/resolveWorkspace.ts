import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { hasRoleTag } from '@/modules/core/rbac/rbac.service'
import { WORKSPACES, type WorkspaceConfig, type WorkspaceId } from './workspaces.config'

/**
 * Resolve default workspace của user.
 *
 * Ưu tiên:
 *   1. Admin không có dept → 'system' (workspace admin)
 *   2. Phòng thuộc workspace 'production' → tách theo VAI (07/2026):
 *      nhãn thống kê → 'stat'; manager (quản đốc) → 'production' điều hành;
 *      còn lại (tổ trưởng/tổ viên) → 'team'.
 *   3. Phòng 'Kế Hoạch Sản Xuất' (planner thuần) → 'prodplan';
 *      phòng gộp/Cung ứng giữ 'planning'.
 *   4. User có dept.workspace_id → workspace tương ứng
 *   5. Fallback → null (caller redirect về /tasks)
 */
export async function resolveDefaultWorkspace(
  user: User,
): Promise<WorkspaceConfig | null> {
  if (user.role === 'admin' && !user.department_id) {
    return WORKSPACES.system
  }
  if (!user.department_id) return null

  const { data } = await db()
    .from('departments')
    .select('workspace_id, name')
    .eq('id', user.department_id)
    .maybeSingle()

  const workspaceId = data?.workspace_id as WorkspaceId | null | undefined
  if (!workspaceId) {
    // Admin fallback: nếu dept lỗi mapping thì đưa vào system.
    return user.role === 'admin' ? WORKSPACES.system : null
  }

  // Gia đình SX: mỗi vai một workspace (nhãn 0087 + role).
  if (workspaceId === 'production') {
    if (user.role === 'manager' || user.role === 'admin') return WORKSPACES.production
    if (await hasRoleTag(user, 'production_stat')) return WORKSPACES.stat
    return WORKSPACES.team
  }
  // Planner thuần (phòng Kế Hoạch Sản Xuất tách) → workspace Kế hoạch SX.
  if (workspaceId === 'planning' && data?.name === 'Kế Hoạch Sản Xuất') {
    return WORKSPACES.prodplan
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
