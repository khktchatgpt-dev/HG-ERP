import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { listAccessibleWorkspaces, resolveNavCapabilities } from '@/workspaces/access'
import { resolveNavBadges } from '@/workspaces/nav-badges'
import {
  resolveNavSections,
  withNavBadges,
  type WorkspaceConfig,
} from '@/workspaces/workspaces.config'
import { DesktopSidebar } from './DesktopSidebar'

/**
 * Sidebar desktop (server): lọc nav theo quyền rồi giao cho DesktopSidebar
 * (client) render + xử lý thu gọn. Chỉ hiện >= lg (mobile dùng MobileDrawer).
 */
export async function WorkspaceSidebar({ workspace }: { workspace: WorkspaceConfig }) {
  const user = await authService.currentUser()
  if (!user) return null

  const head = user.department_id ? await departmentsRepo.findHeadedBy(user.id) : null
  const capabilities = await resolveNavCapabilities(user)
  const badges = await resolveNavBadges(user, workspace.id)
  const sections = withNavBadges(
    resolveNavSections(workspace, {
      role: user.role,
      isHead: !!head,
      capabilities,
    }),
    badges,
  )
  // Danh sách workspace user được vào (xem chéo) — cho dropdown chuyển đổi.
  const switchable = (await listAccessibleWorkspaces(user)).map((a) => ({
    id: a.workspace.id,
    readonly: a.readonly,
  }))

  return (
    <DesktopSidebar
      workspaceId={workspace.id}
      route={workspace.route}
      sections={sections}
      switchable={switchable}
      userName={user.name ?? user.email}
      userSub={`${workspace.short} · ${user.title ?? user.role}`}
    />
  )
}
