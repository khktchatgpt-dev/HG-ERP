'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import type {
  Permission,
  Role,
  RolePermission,
  UserRoleRow,
} from '@/modules/core/rbac/rbac.repo'
import type { RbacMatrixUser } from '@/modules/core/rbac/rbac.service'
import { ACTIONS, canDo, type Action, type Rule } from '@/modules/core/rbac/actions'

type View = 'people' | 'roles' | 'actions' | 'matrix' | 'audit'

const DOMAIN_LABEL: Record<string, string> = {
  production: 'Sản xuất',
  sales: 'Bán hàng',
  supply: 'Cung ứng',
  warehouse: 'Kho',
  technical: 'Kỹ thuật',
  hr: 'Nhân sự',
  accounting: 'Kế toán',
  exec: 'Điều hành',
  team: 'Đội nhóm',
  system: 'Hệ thống',
  task: 'Công việc',
}
const GLOBAL_ROLE: Record<string, { label: string; cls: string }> = {
  admin: {
    label: 'Admin',
    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  manager: {
    label: 'Quản lý',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  employee: {
    label: 'Nhân viên',
    cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  },
}

const gkey = (roleId: string, permKey: string) => `${roleId} ${permKey}`
const initials = (name: string | null, email: string) =>
  (name ?? email).trim().slice(0, 1).toUpperCase()

export function PermissionsManager(props: {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
  users: RbacMatrixUser[]
}) {
  const { roles, permissions, users } = props
  const [view, setView] = useState<View>('people')

  const tabs: { id: View; label: string }[] = [
    { id: 'people', label: 'Nhân viên' },
    { id: 'roles', label: 'Vai trò' },
    { id: 'actions', label: 'Thao tác' },
    { id: 'matrix', label: 'Ma trận' },
    { id: 'audit', label: 'Nhật ký' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Quản trị', href: '/admin' }, { label: 'Phân quyền' }]}
        title="Phân quyền"
        description="Chọn một nhân viên để xem đầy đủ vai trò và quyền họ đang có — kèm nguồn cấp từng quyền."
        actions={
          <div className="flex gap-0.5 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === t.id
                    ? 'bg-sky-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      <StatsBar
        stats={[
          { label: 'Nhân viên', value: users.length, tone: 'blue' },
          {
            label: 'Vai trò',
            value: roles.filter((r) => r.is_active).length,
            tone: 'purple',
          },
          { label: 'Quyền', value: permissions.length, tone: 'default' },
          {
            label: 'Gán tay',
            value: props.userRoles.filter((u) => u.source === 'manual').length,
            tone: 'green',
          },
        ]}
      />

      {view === 'people' && <PeopleView {...props} />}
      {view === 'roles' && <RolesView {...props} />}
      {view === 'actions' && <ActionsView permissions={permissions} />}
      {view === 'matrix' && <MatrixView {...props} />}
      {view === 'audit' && <AuditView />}
    </div>
  )
}

/* ─────────────────────────── NHÂN VIÊN (employee-first) ─────────────────── */

function PeopleView({
  roles,
  permissions,
  rolePermissions,
  userRoles,
  users,
}: {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
  users: RbacMatrixUser[]
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<string | null>(users[0]?.id ?? null)
  const [assigning, setAssigning] = useState<RbacMatrixUser | null>(null)

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])
  const permByKey = useMemo(
    () => new Map(permissions.map((p) => [p.key, p])),
    [permissions],
  )
  const permKeysByRole = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const rp of rolePermissions) {
      const arr = m.get(rp.role_id) ?? []
      arr.push(rp.permission_key)
      m.set(rp.role_id, arr)
    }
    return m
  }, [rolePermissions])
  const rolesByUser = useMemo(() => {
    const m = new Map<string, UserRoleRow[]>()
    for (const ur of userRoles) {
      const arr = m.get(ur.user_id) ?? []
      arr.push(ur)
      m.set(ur.user_id, arr)
    }
    return m
  }, [userRoles])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return users
    return users.filter((u) =>
      `${u.name ?? ''} ${u.email} ${u.department ?? ''}`.toLowerCase().includes(ql),
    )
  }, [users, q])

  const selected = users.find((u) => u.id === selId) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Master: danh sách người */}
      <div
        className={`flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 ${
          selected ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên, email, phòng…"
            className="w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-700"
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">Không tìm thấy.</p>
          )}
          {filtered.map((u) => {
            const rs = rolesByUser.get(u.id) ?? []
            const on = u.id === selId
            return (
              <button
                key={u.id}
                onClick={() => setSelId(u.id)}
                className={`flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-900 ${
                  on
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    on
                      ? 'bg-sky-600 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  {initials(u.name, u.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {u.name ?? u.email}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">
                    {u.department ?? 'Chưa gán phòng'}
                  </span>
                </span>
                {u.role === 'admin' ? (
                  <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    ADMIN
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-400">{rs.length} vai</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail: hộ chiếu quyền của người được chọn */}
      {selected ? (
        <UserDetail
          user={selected}
          roleRows={rolesByUser.get(selected.id) ?? []}
          roleById={roleById}
          permKeysByRole={permKeysByRole}
          permByKey={permByKey}
          onBack={() => setSelId(null)}
          onAssign={() => setAssigning(selected)}
        />
      ) : (
        <div className="hidden lg:block">
          <EmptyState
            icon="◐"
            title="Chọn một nhân viên"
            description="Danh sách bên trái."
          />
        </div>
      )}

      {assigning && (
        <AssignRolesModal
          key={assigning.id}
          user={assigning}
          roles={roles}
          current={rolesByUser.get(assigning.id) ?? []}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function UserDetail({
  user,
  roleRows,
  roleById,
  permKeysByRole,
  permByKey,
  onBack,
  onAssign,
}: {
  user: RbacMatrixUser
  roleRows: UserRoleRow[]
  roleById: Map<string, Role>
  permKeysByRole: Map<string, string[]>
  permByKey: Map<string, Permission>
  onBack: () => void
  onAssign: () => void
}) {
  const isAdmin = user.role === 'admin'

  // Quyền hiệu lực + NGUỒN (vai nào cấp) — điểm cốt lõi của thiết kế này.
  const { groups, total } = useMemo(() => {
    const byPerm = new Map<string, string[]>() // permKey → [role label]
    if (isAdmin) {
      for (const p of permByKey.values()) byPerm.set(p.key, ['admin (bypass)'])
    } else {
      for (const rr of roleRows) {
        const role = roleById.get(rr.role_id)
        if (!role) continue
        for (const pk of permKeysByRole.get(rr.role_id) ?? []) {
          const arr = byPerm.get(pk) ?? []
          if (!arr.includes(role.label)) arr.push(role.label)
          byPerm.set(pk, arr)
        }
      }
    }
    const gmap = new Map<string, { key: string; label: string; sources: string[] }[]>()
    for (const [pk, sources] of byPerm) {
      const p = permByKey.get(pk)
      if (!p) continue
      const arr = gmap.get(p.domain) ?? []
      arr.push({ key: pk, label: p.label, sources })
      gmap.set(p.domain, arr)
    }
    const groups = [...gmap.entries()]
      .map(([domain, items]) => ({
        domain,
        items: items.sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain))
    return { groups, total: byPerm.size }
  }, [isAdmin, roleRows, roleById, permKeysByRole, permByKey])

  const derived = roleRows.filter((r) => r.source === 'derived')
  const manual = roleRows.filter((r) => r.source === 'manual')

  // Thao tác LÀM ĐƯỢC — chạy luật registry với tập quyền của user (Phase C).
  const permLabel = (k: string) => permByKey.get(k)?.label ?? k
  const actionGroups = useMemo(() => {
    const permSet = new Set<string>()
    for (const rr of roleRows)
      for (const pk of permKeysByRole.get(rr.role_id) ?? []) permSet.add(pk)
    const ctx = { role: user.role, has: (k: string) => permSet.has(k) }
    const gmap = new Map<string, { action: Action; ok: boolean }[]>()
    for (const a of ACTIONS) {
      const arr = gmap.get(a.domain) ?? []
      arr.push({ action: a, ok: canDo(a, ctx) })
      gmap.set(a.domain, arr)
    }
    return [...gmap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [roleRows, permKeysByRole, user.role])

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
        >
          ←
        </button>
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
        <button
          onClick={onAssign}
          className="shrink-0 rounded-md border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
        >
          Sửa vai
        </button>
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
          Vai trò ({roleRows.length})
        </h3>
        {roleRows.length === 0 ? (
          <p className="text-sm text-zinc-400">Chưa gán vai nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {derived.length > 0 && (
              <RoleChipRow
                label="Tự đồng bộ theo phòng/chức danh"
                rows={derived}
                roleById={roleById}
                tone="derived"
              />
            )}
            {manual.length > 0 && (
              <RoleChipRow
                label="IT gán tay"
                rows={manual}
                roleById={roleById}
                tone="manual"
              />
            )}
          </div>
        )}
      </section>

      {/* Quyền hiệu lực + nguồn */}
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Quyền hiệu lực ({total})
        </h3>
        {total === 0 ? (
          <EmptyState
            icon="○"
            title="Không có quyền nào"
            description="Nhân viên này chưa có vai nào cấp quyền."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
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

      {/* Thao tác làm được — luật thật, kể cả đọc-mở + tổ hợp (Phase C) */}
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
                  {items.map(({ action, ok }, i) => (
                    <div
                      key={action.key}
                      className={`flex items-center justify-between gap-3 px-3 py-1.5 ${
                        i > 0 ? 'border-t border-zinc-100 dark:border-zinc-900' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className={ok ? 'text-emerald-500' : 'text-rose-400'}>
                          {ok ? '✓' : '✗'}
                        </span>
                        <span
                          className={
                            ok
                              ? 'text-zinc-800 dark:text-zinc-100'
                              : 'text-zinc-400 line-through'
                          }
                        >
                          {action.label}
                        </span>
                        {ok && action.rowLevel && (
                          <span
                            className="text-[11px] text-amber-500"
                            title={action.rowLevel}
                          >
                            ⚑
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right text-[11px] text-zinc-400">
                        {ruleText(action.rule, permLabel)}
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
  roleById,
  tone,
}: {
  label: string
  rows: UserRoleRow[]
  roleById: Map<string, Role>
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
            {roleById.get(r.role_id)?.label ?? r.role_id}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── VAI TRÒ (role-centric edit) ────────────────── */

function RolesView({
  roles,
  permissions,
  rolePermissions,
  userRoles,
}: {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [selId, setSelId] = useState<string | null>(roles[0]?.id ?? null)
  const [openCreate, setOpenCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)

  const [grants, setGrants] = useState<Set<string>>(
    () => new Set(rolePermissions.map((rp) => gkey(rp.role_id, rp.permission_key))),
  )

  const membersByRole = useMemo(() => {
    const m = new Map<string, UserRoleRow[]>()
    for (const ur of userRoles) {
      const arr = m.get(ur.role_id) ?? []
      arr.push(ur)
      m.set(ur.role_id, arr)
    }
    return m
  }, [userRoles])

  const selected = roles.find((r) => r.id === selId) ?? null

  async function toggle(role: Role, permKey: string) {
    if (busy || role.key === 'admin') {
      if (role.key === 'admin')
        toast.info('Vai admin', 'Admin bypass — không gán từng quyền.')
      return
    }
    const k = gkey(role.id, permKey)
    const on = !grants.has(k)
    const next = new Set(grants)
    if (on) next.add(k)
    else next.delete(k)
    setGrants(next)
    const keys = permissions.map((p) => p.key).filter((pk) => next.has(gkey(role.id, pk)))
    setBusy(true)
    try {
      await api(`/api/admin/rbac/roles/${role.id}/permissions`, {
        method: 'PUT',
        body: { permission_keys: keys },
      })
      toast.success('Đã lưu', `${role.label}: ${on ? 'thêm' : 'gỡ'} ${permKey}`)
    } catch (e) {
      setGrants(grants)
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const permGroups = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = m.get(p.domain) ?? []
      arr.push(p)
      m.set(p.domain, arr)
    }
    return [...m.entries()]
  }, [permissions])

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <TopProgressBar active={busy} />
      <div
        className={`flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 ${
          selected ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 p-2 dark:border-zinc-800">
          <span className="text-sm font-medium text-zinc-500">{roles.length} vai</span>
          <button
            onClick={() => setOpenCreate(true)}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-sky-700"
          >
            ＋ Tạo vai
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {roles.map((r) => {
            const on = r.id === selId
            const n = membersByRole.get(r.id)?.length ?? 0
            return (
              <button
                key={r.id}
                onClick={() => setSelId(r.id)}
                className={`flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-900 ${
                  on
                    ? 'bg-sky-50 dark:bg-sky-950/40'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {r.label}
                    {!r.is_active && <span className="ml-1 text-amber-500">✕</span>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-zinc-400">
                    {r.key}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400">{n}</span>
              </button>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => setSelId(null)}
                className="mb-1 text-sm text-zinc-500 lg:hidden"
              >
                ← Danh sách
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{selected.label}</h2>
                {selected.is_system && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                    hệ thống
                  </span>
                )}
                {!selected.is_active && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    đã tắt
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-zinc-400">{selected.key}</p>
              {selected.description && (
                <p className="mt-1 text-sm text-zinc-500">{selected.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditingRole(selected)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Sửa
              </button>
              {selected.key !== 'admin' && (
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={edit}
                    onChange={(e) => setEdit(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Sửa quyền
                </label>
              )}
            </div>
          </div>

          {selected.key === 'admin' ? (
            <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
              Vai admin bỏ qua mọi kiểm tra quyền — không cần gán từng quyền.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {permGroups.map(([domain, items]) => (
                <div key={domain}>
                  <div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                    {DOMAIN_LABEL[domain] ?? domain}
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {items.map((p) => {
                      const on = grants.has(gkey(selected.id, p.key))
                      return (
                        <button
                          key={p.key}
                          disabled={!edit || busy}
                          onClick={() => toggle(selected, p.key)}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm ${
                            on
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                              : 'border-zinc-200 dark:border-zinc-800'
                          } ${edit && !busy ? 'cursor-pointer hover:border-sky-300' : 'cursor-default'}`}
                        >
                          <span
                            className={
                              on ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-700'
                            }
                          >
                            {on ? '✓' : '○'}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-zinc-800 dark:text-zinc-100">
                              {p.label}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-zinc-400">
                              {p.key}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Thành viên ({membersByRole.get(selected.id)?.length ?? 0})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(membersByRole.get(selected.id) ?? []).map((u) => (
                <span
                  key={u.user_id}
                  className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  title={`${u.user_email} · ${u.source === 'derived' ? 'tự đồng bộ' : 'gán tay'}`}
                >
                  {u.user_name ?? u.user_email}
                  {u.source === 'derived' && ' ⛓'}
                </span>
              ))}
              {(membersByRole.get(selected.id)?.length ?? 0) === 0 && (
                <span className="text-sm text-zinc-400">Chưa ai.</span>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="hidden lg:block">
          <EmptyState icon="◑" title="Chọn một vai" description="Danh sách bên trái." />
        </div>
      )}

      {openCreate && (
        <CreateRoleModal
          existingKeys={roles.map((r) => r.key)}
          onClose={() => setOpenCreate(false)}
          onDone={() => {
            setOpenCreate(false)
            router.refresh()
          }}
        />
      )}
      {editingRole && (
        <EditRoleModal
          key={editingRole.id}
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onDone={() => {
            setEditingRole(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────── THAO TÁC (sổ tay luật) ─────────────────────── */

const GLOBAL_ROLE_SHORT: Record<string, string> = {
  admin: 'Admin',
  manager: 'Quản lý',
  employee: 'Nhân viên',
}

/** Luật → chuỗi tiếng Việt đọc được (permLabel tra nhãn permission). */
function ruleText(rule: Rule, permLabel: (k: string) => string, top = true): string {
  switch (rule.kind) {
    case 'public':
      return 'Mọi nhân viên'
    case 'perm':
      return permLabel(rule.key)
    case 'role':
      return rule.of.map((r) => GLOBAL_ROLE_SHORT[r] ?? r).join(' hoặc ')
    case 'allOf': {
      const s = rule.of.map((r) => ruleText(r, permLabel, false)).join(' VÀ ')
      return top ? s : `(${s})`
    }
    case 'anyOf': {
      const s = rule.of.map((r) => ruleText(r, permLabel, false)).join(' HOẶC ')
      return top ? s : `(${s})`
    }
  }
}

function ActionsView({ permissions }: { permissions: Permission[] }) {
  const [q, setQ] = useState('')
  const permLabel = useMemo(() => {
    const m = new Map(permissions.map((p) => [p.key, p.label]))
    return (k: string) => m.get(k) ?? k
  }, [permissions])

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const items = ql
      ? ACTIONS.filter((a) =>
          `${a.label} ${a.key} ${DOMAIN_LABEL[a.domain] ?? a.domain}`
            .toLowerCase()
            .includes(ql),
        )
      : ACTIONS
    const m = new Map<string, Action[]>()
    for (const a of items) {
      const arr = m.get(a.domain) ?? []
      arr.push(a)
      m.set(a.domain, arr)
    }
    return [...m.entries()]
  }, [q])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm thao tác…"
          className="w-72 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-sky-400 dark:border-zinc-700"
        />
        <p className="text-xs text-zinc-400">
          {
            '«VÀ» = cần đủ mọi quyền · «HOẶC» = chỉ cần một · «Mọi nhân viên» = xem mở. Admin bỏ qua tất cả.'
          }
        </p>
      </div>
      {groups.map(([domain, items]) => (
        <div key={domain}>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            {DOMAIN_LABEL[domain] ?? domain}
          </div>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {items.map((a, i) => (
              <div
                key={a.key}
                className={`px-3 py-2 ${i > 0 ? 'border-t border-zinc-100 dark:border-zinc-900' : ''}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {a.label}
                  </span>
                  <span className="text-sm text-zinc-500">
                    Cần:{' '}
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {ruleText(a.rule, permLabel)}
                    </span>
                  </span>
                </div>
                {a.rowLevel && (
                  <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    ⚑ {a.rowLevel}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────── MA TRẬN (overview) ─────────────────────────── */

function MatrixView({
  roles,
  permissions,
  rolePermissions,
}: {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
}) {
  const grants = useMemo(
    () => new Set(rolePermissions.map((rp) => gkey(rp.role_id, rp.permission_key))),
    [rolePermissions],
  )
  const groups = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = m.get(p.domain) ?? []
      arr.push(p)
      m.set(p.domain, arr)
    }
    return [...m.entries()]
  }, [permissions])
  const active = roles.filter((r) => r.is_active)

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-900/50">
              Quyền
            </th>
            {active.map((r) => (
              <th
                key={r.id}
                className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-300"
                title={r.key}
              >
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([domain, items]) => (
            <Fragment key={domain}>
              <tr className="bg-zinc-100/60 dark:bg-zinc-800/40">
                <td
                  colSpan={active.length + 1}
                  className="sticky left-0 px-3 py-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase"
                >
                  {DOMAIN_LABEL[domain] ?? domain}
                </td>
              </tr>
              {items.map((p) => (
                <tr
                  key={p.key}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5 dark:bg-zinc-950">
                    <div className="font-medium text-zinc-800 dark:text-zinc-100">
                      {p.label}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-400">{p.key}</div>
                  </td>
                  {active.map((r) => (
                    <td key={r.id} className="px-2 py-1.5 text-center">
                      {grants.has(gkey(r.id, p.key)) || r.key === 'admin' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─────────────────────────── MODALS ─────────────────────────────────────── */

function CreateRoleModal({
  onClose,
  existingKeys,
  onDone,
}: {
  onClose: () => void
  existingKeys: string[]
  onDone: () => void
}) {
  const toast = useToast()
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const keyErr =
    key && !/^[a-z][a-z0-9_]*$/.test(key)
      ? 'Chỉ chữ thường, số, gạch dưới'
      : existingKeys.includes(key)
        ? 'Key đã tồn tại'
        : ''

  async function submit() {
    if (busy || keyErr || !key || !label) return
    setBusy(true)
    try {
      await api('/api/admin/rbac/roles', {
        method: 'POST',
        body: { key, label, description: description || null },
      })
      toast.success('Đã tạo vai', label)
      onDone()
    } catch (e) {
      toast.error('Tạo vai thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Tạo vai mới">
      <div className="flex flex-col gap-3">
        <Field label="Key (định danh)">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="vd: qc_lead"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {keyErr && <span className="text-xs text-rose-500">{keyErr}</span>}
        </Field>
        <Field label="Tên hiển thị">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="vd: Tổ trưởng QC"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Mô tả (tuỳ chọn)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <ModalActions
          busy={busy}
          disabled={!!keyErr || !key || !label}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Tạo vai"
        />
      </div>
    </Modal>
  )
}

function EditRoleModal({
  role,
  onClose,
  onDone,
}: {
  role: Role
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState(role.label)
  const [description, setDescription] = useState(role.description ?? '')
  const [isActive, setIsActive] = useState(role.is_active)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !label) return
    setBusy(true)
    try {
      await api(`/api/admin/rbac/roles/${role.id}`, {
        method: 'PATCH',
        body: { label, description: description || null, is_active: isActive },
      })
      toast.success('Đã lưu vai', label)
      onDone()
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Sửa vai · ${role.key}`}>
      <div className="flex flex-col gap-3">
        <Field label="Tên hiển thị">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <Field label="Mô tả">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            disabled={role.is_system}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Kích hoạt
          {role.is_system && (
            <span className="text-xs text-zinc-400">(vai hệ thống — không tắt được)</span>
          )}
        </label>
        <ModalActions
          busy={busy}
          disabled={!label}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Lưu"
        />
      </div>
    </Modal>
  )
}

function AssignRolesModal({
  user,
  roles,
  current,
  onClose,
  onDone,
}: {
  user: RbacMatrixUser
  roles: Role[]
  current: UserRoleRow[]
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [manual, setManual] = useState<Set<string>>(
    () => new Set(current.filter((r) => r.source === 'manual').map((r) => r.role_id)),
  )
  const [busy, setBusy] = useState(false)

  const derivedIds = useMemo(
    () => new Set(current.filter((r) => r.source === 'derived').map((r) => r.role_id)),
    [current],
  )
  const assignable = roles.filter((r) => r.is_active && !derivedIds.has(r.id))

  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/admin/rbac/users/${user.id}/roles`, {
        method: 'PUT',
        body: { role_ids: [...manual] },
      })
      toast.success('Đã lưu vai', user.name ?? user.email)
      onDone()
    } catch (e) {
      toast.error('Lưu thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Gán vai · ${user.name ?? user.email}`}
      maxWidth="sm:max-w-md"
    >
      <div className="flex flex-col gap-3">
        {derivedIds.size > 0 && (
          <div className="rounded-md bg-zinc-50 p-2 text-xs text-zinc-500 dark:bg-zinc-900">
            ⛓ Vai tự đồng bộ (theo phòng/chức danh) không sửa ở đây:{' '}
            {roles
              .filter((r) => derivedIds.has(r.id))
              .map((r) => r.label)
              .join(', ')}
          </div>
        )}
        <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          {assignable.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
            >
              <input
                type="checkbox"
                checked={manual.has(r.id)}
                onChange={(e) => {
                  const next = new Set(manual)
                  if (e.target.checked) next.add(r.id)
                  else next.delete(r.id)
                  setManual(next)
                }}
                className="h-4 w-4"
              />
              <span className="font-medium">{r.label}</span>
              <span className="font-mono text-[11px] text-zinc-400">{r.key}</span>
            </label>
          ))}
          {assignable.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-zinc-400">
              Không còn vai để gán.
            </p>
          )}
        </div>
        <ModalActions
          busy={busy}
          onCancel={onClose}
          onSubmit={submit}
          submitLabel="Lưu vai gán tay"
        />
      </div>
    </Modal>
  )
}

/* ─────────────────────────── NHẬT KÝ ────────────────────────────────────── */

type AuditEntry = {
  id: string
  action: string
  target_type: string
  target_label: string | null
  before: unknown
  after: unknown
  created_at: string
  actor_name: string | null
}

const ACTION_LABEL: Record<string, string> = {
  'role.created': 'Tạo vai',
  'role.updated': 'Sửa vai',
  'role.permissions_changed': 'Đổi quyền của vai',
  'role.assigned': 'Gán vai',
  'role.revoked': 'Thu vai',
}

function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    api<{ entries: AuditEntry[] }>('/api/admin/rbac/audit')
      .then((r) => alive && setEntries(r.entries))
      .catch((e) => alive && setErr(apiErrorText(e)))
    return () => {
      alive = false
    }
  }, [])

  if (err) return <EmptyState icon="⚠" title="Không tải được nhật ký" description={err} />
  if (!entries)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  if (entries.length === 0)
    return (
      <EmptyState
        icon="🗒"
        title="Chưa có thao tác nào"
        description="Nhật ký sẽ hiện ở đây."
      />
    )

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
            <th className="px-3 py-2">Thời gian</th>
            <th className="px-3 py-2">Thao tác</th>
            <th className="px-3 py-2">Đối tượng</th>
            <th className="px-3 py-2">Chi tiết</th>
            <th className="px-3 py-2">Người làm</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
            >
              <td className="px-3 py-2 whitespace-nowrap text-zinc-500">
                {new Date(e.created_at).toLocaleString('vi-VN')}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.action === 'role.revoked'
                      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
              </td>
              <td className="px-3 py-2 font-medium">{e.target_label ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{auditDetail(e)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{e.actor_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function auditDetail(e: AuditEntry): string {
  const a = (e.after ?? {}) as Record<string, unknown>
  const b = (e.before ?? {}) as Record<string, unknown>
  if (e.action === 'role.permissions_changed') {
    const added = (a.added as string[]) ?? []
    const removed = (b.removed as string[]) ?? []
    const parts: string[] = []
    if (added.length) parts.push(`＋${added.join(', ')}`)
    if (removed.length) parts.push(`－${removed.join(', ')}`)
    return parts.join('  ') || '—'
  }
  if (e.action === 'role.assigned') return `＋ ${String(a.role_label ?? '')}`
  if (e.action === 'role.revoked') return `－ ${String(b.role_label ?? '')}`
  if (e.action === 'role.created') return String(a.key ?? '')
  return '—'
}

/* ─────────────────────────── shared bits ────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  )
}

function ModalActions({
  busy,
  disabled,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  busy: boolean
  disabled?: boolean
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        onClick={onCancel}
        className="rounded-md px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300"
      >
        Huỷ
      </button>
      <button
        onClick={onSubmit}
        disabled={busy || disabled}
        className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {busy && <Spinner />}
        {submitLabel}
      </button>
    </div>
  )
}
