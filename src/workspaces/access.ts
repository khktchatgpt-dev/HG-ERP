import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import {
  canEditComponents,
  canManagePlan,
  isPlannerStaff,
  isProductionLeader,
  isProductionStaff,
  isProductionStat,
} from '@/modules/dept/production/perms'
import {
  WORKSPACE_IDS,
  WORKSPACES,
  type WorkspaceConfig,
  type WorkspaceId,
} from './workspaces.config'

/**
 * Quyền VÀO workspace (tầng đọc) — một nơi quyết định duy nhất, thay cho logic
 * rải rác ở từng layout.tsx. TỪ 0086: XEM CHÉO PHẢI CÓ QUYỀN TƯỜNG MINH (user
 * chốt "mỗi vai một UI, có quyền mới được chuyển sang xem") — bỏ hẳn openView
 * và bỏ đặc quyền "manager xem mọi nơi".
 *
 * Luật, theo thứ tự:
 *   1. admin        → vào mọi workspace.
 *   2. workspace nhà (dept.workspace_id của user) → vào.
 *   3. system       → chỉ admin; hr / finance → chỉ nhà + admin (nhạy cảm).
 *   4. exec         → permission 'exec.tower.view' (vai director — manager
 *                     thuộc phòng Ban Giám Đốc, 0086).
 *   5. còn lại      → permission 'workspace.view.<id>' (director/planner/
 *                     supply được seed; ai khác admin gán ở /admin/permissions).
 */
const SENSITIVE: ReadonlySet<WorkspaceId> = new Set(['hr', 'finance', 'system'])

/**
 * GIA ĐÌNH Sản xuất (mỗi vai một workspace — user chốt 07/2026): tổ /to,
 * thống kê /thongke, kế hoạch /kehoach-sx, điều hành /production. Nhà của
 * NV xưởng (dept.workspace_id='production') mở cửa CẢ family — nội bộ xưởng
 * xem lẫn nhau (đã chốt); người ngoài cần 'workspace.view.production'.
 */
const PRODUCTION_FAMILY: ReadonlySet<WorkspaceId> = new Set([
  'production',
  'team',
  'stat',
  'prodplan',
])

/** Phần quyết định ĐƯỢC bằng dữ liệu sync (admin / nhà / khu nhạy cảm). */
export function canEnterWorkspaceSync(
  user: Pick<User, 'role'>,
  id: WorkspaceId,
  homeId: WorkspaceId | null,
): boolean | 'need-permission' {
  const ws = WORKSPACES[id]
  if (user.role === 'admin') return true
  if (!ws.ready) return false
  if (id === homeId) return true
  // Nhà xưởng mở cửa cả gia đình SX (nội bộ xưởng xem lẫn nhau).
  if (PRODUCTION_FAMILY.has(id) && homeId === 'production') return true
  if (SENSITIVE.has(id)) return false
  return 'need-permission'
}

/** Key permission gác cửa xem chéo của từng workspace. */
export function workspaceViewPermission(id: WorkspaceId): string {
  if (id === 'exec') return 'exec.tower.view'
  // Cả gia đình SX dùng chung một quyền xem (không đẻ thêm vocabulary).
  if (PRODUCTION_FAMILY.has(id)) return 'workspace.view.production'
  return `workspace.view.${id}`
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
  const sync = canEnterWorkspaceSync(user, id, await userHomeWorkspaceId(user))
  if (sync !== 'need-permission') return sync
  // Kế hoạch SX: planner vào bằng chính quyền nghiệp vụ của vai.
  if (id === 'prodplan') {
    if (await isPlannerStaff(user)) return true
    if (await canManagePlan(user)) return true
  }
  return hasPermission(user, workspaceViewPermission(id))
}

/**
 * Năng lực nghiệp vụ cho lọc menu (NavItem.capability) — tính một lần ở
 * sidebar/drawer server rồi truyền vào resolveNavSections. Nguồn sự thật là
 * chính guard của service (không lặp lại logic ở đây).
 */
export async function resolveNavCapabilities(user: User): Promise<Set<string>> {
  const caps = new Set<string>()
  // TÁCH UI THEO VAI — CHỈ giao diện, KHÔNG tách quyền (user chốt): menu và
  // lối vào lọc theo vai, quyền server giữ nguyên như 0084/0085.
  const [shaping, plan, member, stat, leader] = await Promise.all([
    canEditComponents(user), // thống kê/planner/QL — định hình
    canManagePlan(user), // Trưởng phòng Kế hoạch
    isProductionStaff(user), // thành viên xưởng (tổ + thống kê)
    isProductionStat(user), // nhãn vị trí Thống kê (0087)
    isProductionLeader(user), // nhãn vị trí Tổ trưởng (0087)
  ])
  // Nhãn vị trí xưởng (0087): tổ trưởng menu tối giản (chỉ Việc của tổ);
  // thống kê thấy Sổ + Định hình; member CHƯA gán nhãn giữ đầy đủ như cũ
  // (an toàn — admin gán nhãn dần).
  const hideDataScreens = member && leader && !stat && user.role === 'employee'
  if (shaping && !hideDataScreens) caps.add('production.shaping')
  if (plan) caps.add('production.plan')
  // Nhập sổ số liệu / gia công / chốt sổ — bộ phận sản xuất.
  if ((member && !hideDataScreens) || user.role === 'admin') {
    caps.add('production.record')
  }
  // "Việc của tổ": thành viên xưởng + admin/manager (board có picker soi tổ).
  if (member || user.role === 'admin' || user.role === 'manager') {
    caps.add('production.team')
  }
  // Toàn cảnh xưởng — màn ĐIỀU PHỐI: quản đốc/GĐ, Kế hoạch, Cung ứng, người
  // ngoài xưởng xem chéo. Thành viên xưởng KHÔNG thấy mục này trong menu
  // (vào bằng URL vẫn xem được — chỉ tách giao diện, không chặn quyền).
  if (
    user.role === 'admin' ||
    user.role === 'manager' ||
    plan ||
    (await isSupplyStaff(user)) ||
    !member
  ) {
    caps.add('production.overview')
  }
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
  if (id === 'prodplan') return isPlannerStaff(user)
  if (id === 'warehouse') return isSupplyStaff(user)
  return false
}

/**
 * Workspace gia đình SX nào HIỂN THỊ trên switcher cho user này — vào được
 * (gate) là một chuyện, switcher chỉ bày đúng "nhà" của vai để đỡ loạn:
 *   NV xưởng nhãn thống kê  → Thống kê + Tổ
 *   NV xưởng khác (tổ)      → Tổ
 *   planner                 → Kế hoạch SX (+ Điều hành để xem toàn cảnh)
 *   quản đốc/GĐ (manager)   → cả 4
 *   người ngoài có quyền xem→ Điều hành (đại diện khu SX)
 */
async function visibleProductionFamily(
  user: User,
  homeId: WorkspaceId | null,
): Promise<ReadonlySet<WorkspaceId>> {
  if (user.role === 'admin' || user.role === 'manager') {
    return new Set(['production', 'team', 'stat', 'prodplan'])
  }
  if (homeId === 'production') {
    return (await isProductionStat(user))
      ? new Set(['stat', 'team'])
      : new Set(['team'])
  }
  if ((await isPlannerStaff(user)) || (await canManagePlan(user))) {
    return new Set(['prodplan', 'production'])
  }
  return new Set(['production'])
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
  const familyVisible = await visibleProductionFamily(user, homeId)
  const entries = await Promise.all(
    WORKSPACE_IDS.map(async (id) => {
      // Gia đình SX: chỉ bày workspace đúng vai (gate vẫn cho vào bằng URL).
      if (PRODUCTION_FAMILY.has(id) && !familyVisible.has(id)) return null
      const sync = canEnterWorkspaceSync(user, id, homeId)
      let ok: boolean
      if (sync !== 'need-permission') ok = sync
      else if (
        id === 'prodplan' &&
        ((await isPlannerStaff(user)) || (await canManagePlan(user)))
      )
        ok = true
      else ok = await hasPermission(user, workspaceViewPermission(id))
      if (!ok) return null
      // Nhà: workspace của phòng, và với NV xưởng là CẢ gia đình SX (0087).
      const isHome =
        id === homeId || (homeId === 'production' && PRODUCTION_FAMILY.has(id))
      return {
        workspace: WORKSPACES[id],
        // Badge "Chỉ xem": không phải nhà + không có vai tác nghiệp chéo.
        // (permission per-request đã cache — không tốn thêm query.)
        readonly:
          user.role === 'employee' && !isHome && !(await hasCrossRole(user, id)),
      }
    }),
  )
  return entries.filter((e): e is AccessibleWorkspace => e !== null)
}
