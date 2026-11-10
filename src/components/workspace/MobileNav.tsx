import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { listAccessibleWorkspaces, resolveNavCapabilities } from '@/workspaces/access'
import { resolveNavBadges } from '@/workspaces/nav-badges'
import {
  ACCENT_CLASSES,
  resolveNavSections,
  withNavBadges,
  type WorkspaceConfig,
} from '@/workspaces/workspaces.config'
import { MobileDrawer } from './MobileDrawer'

/** Bọc server: lọc nav theo quyền rồi giao cho drawer client. Chỉ hiện < lg. */
export async function MobileNav({ workspace }: { workspace: WorkspaceConfig }) {
  const user = await authService.currentUser()
  if (!user) return null
  const head = user.department_id ? await departmentsRepo.findHeadedBy(user.id) : null
  const capabilities = await resolveNavCapabilities(user)
  const badges = await resolveNavBadges(user, workspace.id)
  const switchable = (await listAccessibleWorkspaces(user)).map((w) => ({
    id: w.workspace.id,
    readonly: w.readonly,
  }))
  const sections = withNavBadges(
    resolveNavSections(workspace, {
      role: user.role,
      isHead: !!head,
      capabilities,
    }),
    badges,
  )
  const accent = ACCENT_CLASSES[workspace.accent]

  return (
    <MobileDrawer
      workspace={{
        route: workspace.route,
        // Cửa vào (home) — Cung ứng đã rời `/planning` sang `/mua-hang`.
        home: workspace.home ?? workspace.route,
        short: workspace.short,
        logoText: workspace.logoText,
      }}
      sections={sections}
      switchable={switchable}
      accentBg={accent.bg}
      accentShadow={accent.bg.replace('bg-', 'shadow-')}
      accentSoftBg={accent.bgSoft}
      accentText={accent.text}
    />
  )
}
