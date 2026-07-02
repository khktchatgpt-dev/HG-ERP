import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import {
  ACCENT_CLASSES,
  PERSONAL_SECTION,
  type NavItem,
  type NavSection,
  type WorkspaceConfig,
} from '@/workspaces/workspaces.config'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { NavLink } from './NavLink'

function itemVisible(
  item: NavItem,
  ctx: { role: string; isHead: boolean },
): boolean {
  if (item.roles && !item.roles.includes(ctx.role as 'admin' | 'manager' | 'employee')) return false
  if (item.requireHead && !ctx.isHead) return false
  return true
}

export async function WorkspaceSidebar({
  workspace,
}: {
  workspace: WorkspaceConfig
}) {
  const user = await authService.currentUser()
  if (!user) return null

  const head = user.department_id ? await departmentsRepo.findHeadedBy(user.id) : null
  const ctx = { role: user.role, isHead: !!head }
  const accent = ACCENT_CLASSES[workspace.accent]
  const accentShadow = accent.bg.replace('bg-', 'shadow-')

  const sections: NavSection[] = [
    ...(workspace.hidePersonalSection ? [] : [PERSONAL_SECTION]),
    ...workspace.sections.map((s) => ({
      heading: s.heading,
      items: s.items.filter((i) => itemVisible(i, ctx)),
    })),
  ]

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-900 px-3 py-5 text-slate-200 lg:flex">
      <Link href={`${workspace.route}/`} className="mb-4 flex items-center gap-2 px-2">
        <span className={`grid h-9 w-9 place-items-center rounded-md font-bold text-white ${accent.bg}`}>
          {workspace.logoText}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight text-white">
            Hoàng Gia
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            {workspace.short}
          </span>
        </div>
      </Link>

      <WorkspaceSwitcher current={workspace.id} userRole={user.role} />

      <div className="mt-3 flex flex-col gap-1">
        {sections.map((sec) =>
          sec.items.length === 0 ? null : (
            <div key={sec.heading} className="mb-2">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {sec.heading}
              </div>
              {sec.items.map((i) => (
                <NavLink
                  key={i.href}
                  href={i.href}
                  label={i.label}
                  icon={i.icon}
                  accentShadow={accentShadow}
                />
              ))}
            </div>
          ),
        )}
      </div>
    </aside>
  )
}
