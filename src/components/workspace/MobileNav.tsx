import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import {
  ACCENT_CLASSES,
  resolveNavSections,
  type WorkspaceConfig,
} from '@/workspaces/workspaces.config'
import { MobileDrawer } from './MobileDrawer'

/** Bọc server: lọc nav theo quyền rồi giao cho drawer client. Chỉ hiện < lg. */
export async function MobileNav({ workspace }: { workspace: WorkspaceConfig }) {
  const user = await authService.currentUser()
  if (!user) return null
  const head = user.department_id ? await departmentsRepo.findHeadedBy(user.id) : null
  const sections = resolveNavSections(workspace, { role: user.role, isHead: !!head })
  const accent = ACCENT_CLASSES[workspace.accent]

  return (
    <MobileDrawer
      workspace={{
        route: workspace.route,
        short: workspace.short,
        logoText: workspace.logoText,
      }}
      sections={sections}
      accentBg={accent.bg}
      accentShadow={accent.bg.replace('bg-', 'shadow-')}
    />
  )
}
