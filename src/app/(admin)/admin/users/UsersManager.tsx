'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { UserForm } from './UserForm'
import { ResetPasswordForm } from './ResetPasswordForm'
import { BulkImportWizard } from './BulkImportWizard'
import { AuditHistoryPanel } from './AuditHistoryPanel'

type Dept = { id: string; name: string }
type Role = 'admin' | 'manager' | 'employee'
type U = {
  id: string
  email: string
  name: string | null
  role: Role
  department_id: string | null
  title: string | null
  is_active: boolean
  deleted_at?: string | null
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị',
  manager: 'Quản lý',
  employee: 'Nhân viên',
}
const ROLE_TONE: Record<Role, 'purple' | 'blue' | 'green'> = {
  admin: 'purple',
  manager: 'blue',
  employee: 'green',
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'deleted'
type RoleFilter = 'all' | Role
type DeptFilter = string // 'all' hoặc '' hoặc dept id

export function UsersManager({
  users,
  departments,
  currentUserId,
}: {
  users: U[]
  departments: Dept[]
  currentUserId: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<U | null>(null)
  const [resetting, setResetting] = useState<U | null>(null)
  const [auditing, setAuditing] = useState<U | null>(null)
  const [openImport, setOpenImport] = useState(false)
  const [selected, setSelected] = useState<U[]>([])

  // Auto-open modal khi URL có query (từ Command palette hoặc link ngoài) —
  // adjust-during-render theo sp thay vì setState trong effect.
  const [prevSp, setPrevSp] = useState<typeof sp | null>(null)
  if (sp !== prevSp) {
    setPrevSp(sp)
    if (sp.get('new') === '1') setOpenCreate(true)
    if (sp.get('import') === '1') setOpenImport(true)
  }

  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [deptFilter, setDeptFilter] = useState<DeptFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const deptName = (id: string | null) =>
    departments.find((d) => d.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (deptFilter !== 'all' && (u.department_id ?? '') !== deptFilter) return false
      if (statusFilter === 'active' && (!u.is_active || u.deleted_at)) return false
      if (statusFilter === 'inactive' && (u.is_active || u.deleted_at)) return false
      if (statusFilter === 'deleted' && !u.deleted_at) return false
      if (ql) {
        const hay = `${u.name ?? ''} ${u.email} ${u.title ?? ''}`.toLowerCase()
        if (!hay.includes(ql)) return false
      }
      return true
    })
  }, [users, q, roleFilter, deptFilter, statusFilter])

  const stats = useMemo(() => {
    let active = 0
    let inactive = 0
    let deleted = 0
    const byRole = { admin: 0, manager: 0, employee: 0 }
    for (const u of users) {
      if (u.deleted_at) deleted++
      else if (!u.is_active) inactive++
      else {
        active++
        byRole[u.role]++
      }
    }
    return { active, inactive, deleted, byRole }
  }, [users])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true)
    try {
      await api(`/api/users/${id}`, { method: 'PATCH', body })
      router.refresh()
    } catch (e) {
      toast.error('Cập nhật thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function softDelete(u: U) {
    const ok = await confirm({
      title: 'Xoá tài khoản?',
      description: `${u.name ?? u.email} sẽ bị vô hiệu. Có thể khôi phục.`,
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/users/${u.id}`, { method: 'DELETE' })
      toast.success('Đã xoá', u.email)
      router.refresh()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function restore(u: U) {
    setBusy(true)
    try {
      await api(`/api/users/${u.id}/restore`, { method: 'POST' })
      toast.success('Đã khôi phục', u.email)
      router.refresh()
    } catch (e) {
      toast.error('Khôi phục thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  async function bulkLock() {
    const targets = selected.filter(
      (u) => u.id !== currentUserId && u.is_active && !u.deleted_at,
    )
    if (targets.length === 0) return toast.error('Không có tài khoản nào để khoá')
    const ok = await confirm({
      title: `Khoá ${targets.length} tài khoản?`,
      description: 'Người dùng bị khoá sẽ không đăng nhập được. Bạn có thể mở lại.',
      confirmLabel: 'Khoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await Promise.all(
        targets.map((u) =>
          api(`/api/users/${u.id}`, { method: 'PATCH', body: { is_active: false } }),
        ),
      )
      toast.success(`Đã khoá ${targets.length} tài khoản`)
      setSelected([])
      router.refresh()
    } catch (e) {
      toast.error('Khoá hàng loạt thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function bulkUnlock() {
    const targets = selected.filter((u) => !u.is_active && !u.deleted_at)
    if (targets.length === 0) return toast.error('Không có tài khoản nào cần mở khoá')
    setBusy(true)
    try {
      await Promise.all(
        targets.map((u) =>
          api(`/api/users/${u.id}`, { method: 'PATCH', body: { is_active: true } }),
        ),
      )
      toast.success(`Đã mở khoá ${targets.length} tài khoản`)
      setSelected([])
      router.refresh()
    } catch (e) {
      toast.error(
        'Mở khoá hàng loạt thất bại',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    } finally {
      setBusy(false)
    }
  }

  async function bulkDelete() {
    const targets = selected.filter((u) => u.id !== currentUserId && !u.deleted_at)
    if (targets.length === 0) return toast.error('Không có tài khoản nào để xoá')
    const ok = await confirm({
      title: `Xoá ${targets.length} tài khoản?`,
      description: 'Bản ghi giữ (soft-delete). Có thể khôi phục sau.',
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await Promise.all(
        targets.map((u) => api(`/api/users/${u.id}`, { method: 'DELETE' })),
      )
      toast.success(`Đã xoá ${targets.length} tài khoản`)
      setSelected([])
      router.refresh()
    } catch (e) {
      toast.error('Xoá hàng loạt thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { key: 'email', header: 'Email' },
      { key: 'name', header: 'Họ tên' },
      { key: 'role', header: 'Vai trò', get: (u) => ROLE_LABEL[u.role] },
      {
        key: 'department_id',
        header: 'Phòng ban',
        get: (u) => deptName(u.department_id),
      },
      { key: 'title', header: 'Chức danh' },
      {
        key: 'is_active',
        header: 'Trạng thái',
        get: (u) => (u.deleted_at ? 'Đã xoá' : u.is_active ? 'Hoạt động' : 'Đã khoá'),
      },
    ])
    toast.success(`Đã xuất ${filtered.length} dòng CSV`)
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const columns: Column<U>[] = [
    {
      key: 'user',
      header: 'Người dùng',
      sortValue: (u) => u.name ?? u.email,
      cell: (u) => {
        const self = u.id === currentUserId
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={u.name} email={u.email} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 truncate font-medium">
                <span className="truncate">{u.name ?? '—'}</span>
                {self && <span className="shrink-0 text-xs text-zinc-400">(bạn)</span>}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {u.email}
                {u.title && <> • {u.title}</>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Vai trò',
      sortValue: (u) => u.role,
      width: '150px',
      cell: (u) => {
        const self = u.id === currentUserId
        const deleted = !!u.deleted_at
        return (
          <select
            value={u.role}
            disabled={busy || self || deleted}
            onChange={(e) => patch(u.id, { role: e.target.value })}
            className={`w-full truncate rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700 ${
              u.role === 'admin'
                ? 'text-purple-600 dark:text-purple-400'
                : u.role === 'manager'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-700 dark:text-zinc-300'
            }`}
          >
            {(['employee', 'manager', 'admin'] as const).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'department',
      header: 'Phòng ban',
      sortValue: (u) => deptName(u.department_id),
      width: '180px',
      cell: (u) => {
        const deleted = !!u.deleted_at
        return (
          <select
            value={u.department_id ?? ''}
            disabled={busy || deleted}
            onChange={(e) => patch(u.id, { department_id: e.target.value || null })}
            className="w-full truncate rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            <option value="">— Chưa gán —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      sortValue: (u) => (u.deleted_at ? 2 : u.is_active ? 0 : 1),
      width: '110px',
      cell: (u) =>
        u.deleted_at ? (
          <Badge tone="gray">Đã xoá</Badge>
        ) : u.is_active ? (
          <Badge tone="green">Hoạt động</Badge>
        ) : (
          <Badge tone="gray">Đã khoá</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (u) => {
        const self = u.id === currentUserId
        const deleted = !!u.deleted_at
        if (deleted) {
          return (
            <RowMenu
              items={[
                { label: 'Khôi phục', onClick: () => restore(u) },
                { label: 'Lịch sử thao tác', onClick: () => setAuditing(u) },
              ]}
            />
          )
        }
        return (
          <RowMenu
            items={[
              { label: 'Sửa thông tin', onClick: () => setEditing(u) },
              { label: 'Đặt lại mật khẩu', onClick: () => setResetting(u) },
              {
                label: u.is_active ? 'Khoá tài khoản' : 'Mở khoá',
                onClick: () => patch(u.id, { is_active: !u.is_active }),
                disabled: self,
                disabledReason: 'Không thể khoá tài khoản của chính bạn',
              },
              { label: 'Lịch sử thao tác', onClick: () => setAuditing(u) },
              {
                label: 'Xoá tài khoản',
                onClick: () => softDelete(u),
                danger: true,
                disabled: self,
                disabledReason: 'Không thể xoá tài khoản của chính bạn',
              },
            ]}
          />
        )
      },
    },
  ]

  const roleOptions = [
    { value: 'all' as const, label: 'Mọi vai trò' },
    { value: 'admin' as const, label: 'Quản trị' },
    { value: 'manager' as const, label: 'Quản lý' },
    { value: 'employee' as const, label: 'Nhân viên' },
  ]

  const deptOptions = [
    { value: 'all', label: 'Mọi phòng ban' },
    { value: '', label: '— Chưa gán —' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ]

  const statusOptions = [
    { value: 'all' as const, label: 'Mọi trạng thái' },
    { value: 'active' as const, label: 'Hoạt động' },
    { value: 'inactive' as const, label: 'Đã khoá' },
    { value: 'deleted' as const, label: 'Đã xoá' },
  ]

  const btnSecondary =
    'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900'
  const btnPrimary =
    'rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'
  const btnDanger =
    'rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-950 dark:hover:bg-red-950/40'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Quản trị', href: '/admin' }, { label: 'Người dùng' }]}
        title="Người dùng"
        description={`Quản lý tài khoản, vai trò và phòng ban. ${filtered.length} / ${users.length} hiển thị.`}
        actions={
          <>
            <button onClick={exportCsv} className={btnSecondary}>
              Export CSV
            </button>
            <button onClick={() => setOpenImport(true)} className={btnSecondary}>
              Import Excel
            </button>
            <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
              + Thêm tài khoản
            </button>
          </>
        }
      />

      <StatsBar
        stats={[
          { label: 'Hoạt động', value: stats.active, tone: 'green' },
          { label: 'Quản trị', value: stats.byRole.admin, tone: 'purple' },
          { label: 'Quản lý', value: stats.byRole.manager, tone: 'blue' },
          { label: 'Nhân viên', value: stats.byRole.employee, tone: 'gray' },
          {
            label: 'Đã khoá',
            value: stats.inactive,
            tone: stats.inactive ? 'amber' : 'gray',
          },
          { label: 'Đã xoá', value: stats.deleted, tone: stats.deleted ? 'red' : 'gray' },
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarInput
                value={q}
                onChange={setQ}
                placeholder="Tìm theo tên, email, chức danh…"
                icon="⌕"
                className="w-64"
              />
              <ToolbarSelect
                value={roleFilter}
                onChange={(v) => setRoleFilter(v)}
                options={roleOptions}
              />
              <ToolbarSelect
                value={deptFilter}
                onChange={(v) => setDeptFilter(v)}
                options={deptOptions}
              />
              <ToolbarSelect
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={statusOptions}
              />
              {(q ||
                roleFilter !== 'all' ||
                deptFilter !== 'all' ||
                statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setQ('')
                    setRoleFilter('all')
                    setDeptFilter('all')
                    setStatusFilter('all')
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Xoá lọc
                </button>
              )}
            </>
          }
          right={
            selected.length > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  {busy && <Spinner size={12} />}
                  Đã chọn <b>{selected.length}</b>
                </span>
                <button onClick={bulkUnlock} className={btnSecondary} disabled={busy}>
                  Mở khoá
                </button>
                <button onClick={bulkLock} className={btnSecondary} disabled={busy}>
                  Khoá
                </button>
                <button onClick={bulkDelete} className={btnDanger} disabled={busy}>
                  Xoá
                </button>
                <button
                  onClick={() => setSelected([])}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Bỏ chọn
                </button>
              </>
            )
          }
        />

        <DataTable<U>
          rows={filtered}
          columns={columns}
          selection={{ selected, onChange: setSelected }}
          rowClassName={(u) =>
            u.deleted_at ? 'opacity-50' : !u.is_active ? 'opacity-70' : ''
          }
          storageKey="admin-users"
          emptyState={
            <EmptyState
              icon="◌"
              title="Không có tài khoản khớp bộ lọc"
              description="Thử điều chỉnh bộ lọc, hoặc thêm tài khoản mới."
              action={
                <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                  + Thêm tài khoản
                </button>
              }
            />
          }
        />
      </div>

      {/* Modals */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Tạo tài khoản mới"
      >
        <UserForm
          mode="create"
          departments={departments}
          onSuccess={() => {
            setOpenCreate(false)
            toast.success('Đã tạo tài khoản')
            router.refresh()
          }}
          onError={(msg) => toast.error('Tạo thất bại', msg)}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Sửa ${editing?.email ?? ''}`}
      >
        {editing && (
          <UserForm
            mode="edit"
            initial={{
              id: editing.id,
              email: editing.email,
              name: editing.name ?? '',
              role: editing.role,
              department_id: editing.department_id,
              title: editing.title,
            }}
            departments={departments}
            onSuccess={() => {
              setEditing(null)
              toast.success('Đã cập nhật')
              router.refresh()
            }}
            onError={(msg) => toast.error('Cập nhật thất bại', msg)}
          />
        )}
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title="Đặt lại mật khẩu"
      >
        {resetting && (
          <ResetPasswordForm
            userId={resetting.id}
            userLabel={resetting.name ?? resetting.email}
            onSuccess={(newPassword) => {
              setResetting(null)
              toast.success('Đã đặt lại mật khẩu', `Mật khẩu mới: ${newPassword}`)
            }}
            onError={(msg) => toast.error('Không đặt lại được', msg)}
          />
        )}
      </Modal>

      <Modal
        open={openImport}
        onClose={() => setOpenImport(false)}
        title="Import từ Excel/CSV"
      >
        <BulkImportWizard
          departments={departments}
          onClose={() => setOpenImport(false)}
          onDone={(created, skipped) => {
            setOpenImport(false)
            toast.success(
              'Import hoàn tất',
              `Tạo mới ${created}${skipped ? `, bỏ qua ${skipped}` : ''}`,
            )
            router.refresh()
          }}
          onError={(msg) => toast.error('Import thất bại', msg)}
        />
      </Modal>

      <Modal open={!!auditing} onClose={() => setAuditing(null)} title="Lịch sử thao tác">
        {auditing && (
          <AuditHistoryPanel
            targetUserId={auditing.id}
            userLabel={auditing.name ?? auditing.email}
          />
        )}
      </Modal>
    </div>
  )
}
