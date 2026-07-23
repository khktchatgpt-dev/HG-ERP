import Link from 'next/link'
import { EmptyState } from '@/components/erp/EmptyState'
import { ACTIONS, canDo } from '@/modules/core/rbac/actions'
import type { PersonDetail } from '@/modules/core/rbac/rbac.service'
import type { Role } from '@/modules/core/rbac/rbac.repo'
import { DOMAIN_LABEL, GLOBAL_ROLE, initials, ruleText } from './shared'
import { AssignRolesButton } from './AssignRolesButton'

/** Hộ chiếu quyền 1 nhân viên — SERVER component (đọc, tính canDo/ruleText). */
export function PersonPassport({
  detail,
  roles,
}: {
  detail: PersonDetail
  roles: Role[]
}) {
  const { user, roleChips, permGroups } = detail
  const isAdmin = user.role === 'admin'
  const permLabel = (k: string) => detail.permLabels[k] ?? k

  const derived = roleChips.filter((r) => r.source === 'derived')
  const manual = roleChips.filter((r) => r.source === 'manual')

  // Thao tác làm được (chỉ non-admin — admin bypass tất cả).
  const permSet = new Set(detail.permKeys)
  const ctx = { role: user.role, has: (k: string) => permSet.has(k) }
  const actionGroups = isAdmin
    ? []
    : (() => {
        const m = new Map<
          string,
          { key: string; label: string; ok: boolean; rule: string; rowLevel?: string }[]
        >()
        for (const a of ACTIONS) {
          const arr = m.get(a.domain) ?? []
          arr.push({
            key: a.key,
            label: a.label,
            ok: canDo(a, ctx),
            rule: ruleText(a.rule, permLabel),
            rowLevel: a.rowLevel,
          })
          m.set(a.domain, arr)
        }
        return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]))
      })()

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <Link
          href="/admin/permissions/people"
          scroll={false}
          className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
        >
          ←
        </Link>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-lg font-semibold text-white">
          {initials(user.name, user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {user.name ?? user.email}
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${GLOBAL_ROLE[user.role].cls}`}
            >
              {GLOBAL_ROLE[user.role].label}
            </span>
          </div>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
          <p className="text-xs text-zinc-400">{user.department ?? 'Chưa gán phòng'}</p>
        </div>
        <AssignRolesButton
          userId={user.id}
          userLabel={user.name ?? user.email}
          roles={roles}
          current={roleChips.map((r) => ({ role_id: r.role_id, source: r.source }))}
        />
      </div>

      {isAdmin && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
          <b>Toàn quyền hệ thống.</b> Admin bỏ qua mọi kiểm tra quyền (bypass) — không phụ
          thuộc vai được gán.
        </div>
      )}

      {/* Vai trò */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Vai trò ({roleChips.length})
        </h3>
        {roleChips.length === 0 ? (
          <p className="text-sm text-zinc-400">Chưa gán vai nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {derived.length > 0 && (
              <RoleChipRow
                label="Tự đồng bộ theo phòng/chức danh"
                rows={derived}
                tone="derived"
              />
            )}
            {manual.length > 0 && (
              <RoleChipRow label="IT gán tay" rows={manual} tone="manual" />
            )}
          </div>
        )}
      </section>

      {/* Quyền hiệu lực + nguồn */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Quyền hiệu lực ({permGroups.reduce((n, g) => n + g.items.length, 0)})
        </h3>
        {permGroups.length === 0 ? (
          <EmptyState
            icon="○"
            title="Không có quyền nào"
            description="Nhân viên này chưa có vai nào cấp quyền."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {permGroups.map((g) => (
              <div key={g.domain}>
                <div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  {DOMAIN_LABEL[g.domain] ?? g.domain}
                </div>
                <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                  {g.items.map((it, i) => (
                    <div
                      key={it.key}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 ${
                        i > 0 ? 'border-t border-zinc-100 dark:border-zinc-900' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-500">✓</span>
                          <span className="truncate text-sm text-zinc-800 dark:text-zinc-100">
                            {it.label}
                          </span>
                        </div>
                        <span className="ml-5 font-mono text-[11px] text-zinc-400">
                          {it.key}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        {it.sources.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                            title={`Cấp bởi vai: ${s}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Thao tác làm được */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Thao tác làm được
        </h3>
        {isAdmin ? (
          <p className="text-sm text-zinc-500">Làm được mọi thao tác (admin bypass).</p>
        ) : (
          <div className="flex flex-col gap-3">
            {actionGroups.map(([domain, items]) => (
              <div key={domain}>
                <div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                  {DOMAIN_LABEL[domain] ?? domain}
                </div>
                <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                  {items.map((it, i) => (
                    <div
                      key={it.key}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 ${
                        i > 0 ? 'border-t border-zinc-100 dark:border-zinc-900' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className={it.ok ? 'text-emerald-500' : 'text-rose-400'}>
                          {it.ok ? '✓' : '✗'}
                        </span>
                        <span
                          className={
                            it.ok
                              ? 'text-zinc-800 dark:text-zinc-100'
                              : 'text-zinc-400 line-through'
                          }
                        >
                          {it.label}
                        </span>
                        {it.ok && it.rowLevel && (
                          <span
                            className="text-[11px] text-amber-500"
                            title={it.rowLevel}
                          >
                            ⚑
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right text-[11px] text-zinc-400">
                        {it.rule}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RoleChipRow({
  label,
  rows,
  tone,
}: {
  label: string
  rows: { role_id: string; label: string }[]
  tone: 'derived' | 'manual'
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-zinc-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <span
            key={r.role_id}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
              tone === 'derived'
                ? 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300'
            }`}
          >
            {tone === 'derived' && <span title="Khoá — tự đồng bộ">⛓</span>}
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}
