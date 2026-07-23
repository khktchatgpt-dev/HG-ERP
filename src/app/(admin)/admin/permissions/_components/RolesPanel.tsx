'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { CreateRoleModal, EditRoleModal } from './modals'
import { DOMAIN_LABEL, gkey } from './shared'
import type {
  Permission,
  Role,
  RolePermission,
  UserRoleRow,
} from '@/modules/core/rbac/rbac.repo'

export function RolesPanel({
  roles,
  permissions,
  rolePermissions,
  userRoles,
  initialRoleId,
}: {
  roles: Role[]
  permissions: Permission[]
  rolePermissions: RolePermission[]
  userRoles: UserRoleRow[]
  initialRoleId?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [selId, setSelId] = useState<string | null>(initialRoleId ?? roles[0]?.id ?? null)
  const [openCreate, setOpenCreate] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [grants, setGrants] = useState<Set<string>>(
    () => new Set(rolePermissions.map((rp) => gkey(rp.role_id, rp.permission_key))),
  )

  function select(id: string | null) {
    setSelId(id)
    router.replace(id ? `/admin/permissions/roles?r=${id}` : '/admin/permissions/roles', {
      scroll: false,
    })
  }

  const membersByRole = useMemo(() => {
    const m = new Map<string, UserRoleRow[]>()
    for (const ur of userRoles) {
      const arr = m.get(ur.role_id) ?? []
      arr.push(ur)
      m.set(ur.role_id, arr)
    }
    return m
  }, [userRoles])

  const permGroups = useMemo(() => {
    const m = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = m.get(p.domain) ?? []
      arr.push(p)
      m.set(p.domain, arr)
    }
    return [...m.entries()]
  }, [permissions])

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

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <TopProgressBar active={busy} />
      <div
        className={`flex flex-col rounded-lg border border-zinc-200 dark:border-zinc-800 ${selected ? 'hidden lg:flex' : 'flex'}`}
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
                onClick={() => select(r.id)}
                className={`flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 text-left last:border-0 dark:border-zinc-900 ${on ? 'bg-sky-50 dark:bg-sky-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
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
                onClick={() => select(null)}
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
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm ${on ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-zinc-200 dark:border-zinc-800'} ${edit && !busy ? 'cursor-pointer hover:border-sky-300' : 'cursor-default'}`}
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
