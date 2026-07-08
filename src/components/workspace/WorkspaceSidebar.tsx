import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import {
  ACCENT_CLASSES,
  resolveNavSections,
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
  const accent = ACCENT_CLASSES[workspace.accent]
  const sections = resolveNavSections(workspace, { role: user.role, isHead: !!head })

  return (
    <DesktopSidebar
      workspaceId={workspace.id}
      route={workspace.route}
      short={workspace.short}
      logoText={workspace.logoText}
      accentBg={accent.bg}
      accentShadow={accent.bg.replace('bg-', 'shadow-')}
      sections={sections}
      userRole={user.role}
    />
  )
}
