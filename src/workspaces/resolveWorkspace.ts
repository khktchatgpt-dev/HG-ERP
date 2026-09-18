import { db } from '@/server/db'
import { hasRoleTag } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { WORKSPACES, type WorkspaceConfig, type WorkspaceId } from './workspaces.config'

/**
 * Resolve default workspace của user.
 *
 * Ưu tiên:
 *   1. Admin không có dept → 'system' (workspace admin)
 *   2. Phòng thuộc workspace 'production' → tách theo BỀ MẶT (18/09/2026):
 *      quản đốc + thống kê → 'production' (văn phòng);
 *      tổ trưởng/tổ viên → 'team' (mặt xưởng).
 *   3. Phòng 'Kế Hoạch Sản Xuất' (planner thuần) → 'production';
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

  // HAI BỀ MẶT (18/09/2026): quản đốc và thống kê ngồi máy tính → bề mặt VĂN
  // PHÒNG `production`; tổ trưởng/tổ viên đứng máy → bề mặt XƯỞNG `team`.
  if (workspaceId === 'production') {
    if (user.role === 'manager' || user.role === 'admin') return WORKSPACES.production
    if (await hasRoleTag(user, 'production_stat')) return WORKSPACES.production
    return WORKSPACES.team
  }
  // Planner thuần (phòng Kế Hoạch Sản Xuất tách) cũng ngồi bề mặt văn phòng.
  if (workspaceId === 'planning' && data?.name === 'Kế Hoạch Sản Xuất') {
    return WORKSPACES.production
  }
  return WORKSPACES[workspaceId]
}

/** URL redirect sau login. */
export async function resolveDefaultRoute(user: User): Promise<string> {
  const ws = await resolveDefaultWorkspace(user)
  // `home` chứ không `route`: xem chú thích `home` ở workspaces.config.ts.
  if (ws) return `${ws.home ?? ws.route}/`
  return '/tasks'
}

/**
 * Workspace nào chứa route hiện tại?
 * Dùng cho highlight sidebar item + xác định theme màu.
 */
export function resolveWorkspaceFromPath(pathname: string): WorkspaceConfig | null {
  for (const ws of Object.values(WORKSPACES)) {
    // `altRoutes` cho một workspace sở hữu nhiều gốc đường dẫn — khu Sản xuất
    // gộp ba khu cũ nên còn giữ `/thongke` và `/kehoach-sx` (18/09/2026).
    for (const base of [ws.route, ...(ws.altRoutes ?? [])]) {
      if (pathname === base || pathname.startsWith(base + '/')) return ws
    }
  }
  return null
}
