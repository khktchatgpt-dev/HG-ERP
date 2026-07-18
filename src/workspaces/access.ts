import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { canEditComponents, isPlannerStaff } from '@/modules/dept/production/perms'
import { isProductionStaff } from '@/modules/dept/production/production.service'
import {
  WORKSPACE_IDS,
  WORKSPACES,
  type WorkspaceConfig,
  type WorkspaceId,
} from './workspaces.config'

/**
 * Quyền VÀO workspace (tầng đọc) — một nơi quyết định duy nhất, thay cho logic
 * rải rác ở từng layout.tsx. Quyền GHI không nằm ở đây: mọi mutation đã bị
 * service chặn theo phòng chủ quản (is*Staff), nên mở cửa xem không mở quyền sửa.
 *
 * Luật, theo thứ tự:
 *   1. admin        → vào mọi workspace.
 *   2. workspace nhà (dept.workspace_id của user) → vào.
 *   3. hr / finance / system → ngoài (1)(2) không ai vào — dữ liệu nhạy cảm.
 *   4. exec         → thêm manager (FR-ADM-03).
 *   5. manager      → xem chéo mọi workspace còn lại (FR-ADM-02).
 *   6. openView     → mọi NV đã đăng nhập (xem chéo phòng ban, chỉ đọc).
 */
export function canEnterWorkspaceSync(
  user: Pick<User, 'role'>,
  id: WorkspaceId,
  homeId: WorkspaceId | null,
): boolean {
  const ws = WORKSPACES[id]
  if (user.role === 'admin') return true
  if (!ws.ready) return false
  if (id === homeId) return true
  if (id === 'hr' || id === 'finance' || id === 'system') return false
  if (id === 'exec') return user.role === 'manager'
  if (user.role === 'manager') return true
  return ws.openView === true
}

/** workspace_id của phòng user — cùng nguồn với resolveDefaultWorkspace. */
export async function userHomeWorkspaceId(user: User): Promise<WorkspaceId | null> {
  if (!user.department_id) return null
  const { data } = await db()
    .from('departments')
    .select('workspace_id')
    .eq('id', user.department_id)
    .maybeSingle()
  return (data?.workspace_id as WorkspaceId | null) ?? null
}

export async function canEnterWorkspace(user: User, id: WorkspaceId): Promise<boolean> {
  return canEnterWorkspaceSync(user, id, await userHomeWorkspaceId(user))
}

/**
 * Năng lực nghiệp vụ cho lọc menu (NavItem.capability) — tính một lần ở
 * sidebar/drawer server rồi truyền vào resolveNavSections. Nguồn sự thật là
 * chính guard của service (không lặp lại logic ở đây).
 */
export async function resolveNavCapabilities(user: User): Promise<Set<string>> {
  const caps = new Set<string>()
  if (await canEditComponents(user)) caps.add('production.shape')
  // Nhập sổ sản lượng/gia công — khớp canRecordOutput (chỉ bộ phận sản xuất).
  if (user.role === 'admin' || (await isProductionStaff(user)))
    caps.add('production.record')
  return caps
}

/**
 * User có vai trò TÁC NGHIỆP thật trong workspace KHÔNG phải phòng nhà —
 * để badge "Chỉ xem" không hiện sai cho người thực ra được thao tác ở đó.
 * Ngoại lệ có chủ đích (tách vai 07/2026): vai Kế hoạch định hình trong Sản
 * xuất; vai Cung ứng tạo nhanh vật tư trong Kho.
 */
export async function hasCrossRole(user: User, id: WorkspaceId): Promise<boolean> {
  if (id === 'production') return isPlannerStaff(user)
  if (id === 'warehouse') return isSupplyStaff(user)
  return false
}

export type AccessibleWorkspace = {
  workspace: WorkspaceConfig
  /**
   * true = user KHÔNG thuộc phòng chủ quản → mọi nút sửa sẽ bị service từ chối.
   * Chỉ để hiển thị nhãn "chỉ xem"; nguồn sự thật quyền ghi vẫn là service.
   */
  readonly: boolean
}

/** Danh sách workspace user vào được — cho WorkspaceSwitcher. */
export async function listAccessibleWorkspaces(
  user: User,
): Promise<AccessibleWorkspace[]> {
  const homeId = await userHomeWorkspaceId(user)
  const ids = WORKSPACE_IDS.filter((id) => canEnterWorkspaceSync(user, id, homeId))
  return Promise.all(
    ids.map(async (id) => ({
      workspace: WORKSPACES[id],
      // Cùng logic với badge "Chỉ xem" ở Topbar: NV thường, khác phòng nhà,
      // và không có vai trò tác nghiệp chéo (admin/manager thao tác rộng).
      readonly:
        user.role === 'employee' && id !== homeId && !(await hasCrossRole(user, id)),
    })),
  )
}
