'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { RowMenu } from '@/components/erp/RowMenu'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'

type Role = 'admin' | 'manager' | 'employee'

type U = {
  id: string
  name: string | null
  email: string
  role: Role
  department_id: string | null
  title: string | null
}

type Dept = {
  id: string
  name: string
  description: string | null
  head_user_id: string | null
  member_count: number
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

export function DepartmentsManager({
  departments,
  users,
}: {
  departments: Dept[]
  users: U[]
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [openCreate, setOpenCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  // Derive from props: auto-sync khi departments đổi sau router.refresh()
  const editing = editingId ? departments.find((d) => d.id === editingId) ?? null : null
  const detail = detailId ? departments.find((d) => d.id === detailId) ?? null : null

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const membersByDept = useMemo(() => {
    const map = new Map<string, U[]>()
    for (const u of users) {
      if (!u.department_id) continue
      const list = map.get(u.department_id) ?? []
      list.push(u)
      map.set(u.department_id, list)
    }
    // Sort members: manager → employee, rồi theo tên
    for (const list of map.values()) {
      list.sort((a, b) => {
        const rank = (r: Role) => (r === 'admin' ? 0 : r === 'manager' ? 1 : 2)
        const rr = rank(a.role) - rank(b.role)
        if (rr) return rr
        return (a.name ?? a.email).localeCompare(b.name ?? b.email, 'vi')
      })
    }
    return map
  }, [users])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return departments
    return departments.filter((d) => {
      if (d.name.toLowerCase().includes(ql)) return true
      if ((d.description ?? '').toLowerCase().includes(ql)) return true
      const head = d.head_user_id ? userById.get(d.head_user_id) : null
      if (head && (head.name ?? head.email).toLowerCase().includes(ql)) return true
      return false
    })
  }, [departments, q, userById])

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteDept(d: Dept) {
    const ok = await confirm({
      title: `Xoá phòng ban "${d.name}"?`,
      description:
        d.member_count > 0
          ? `Phòng ban có ${d.member_count} thành viên. Họ sẽ mất gán phòng ban.`
          : 'Hành động không thể hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const ok2 = await send(`/api/departments/${d.id}`, 'DELETE')
    if (ok2) {
      toast.success('Đã xoá phòng ban', d.name)
      if (detailId === d.id) setDetailId(null)
    }
  }

  const totalMembers = departments.reduce((s, d) => s + d.member_count, 0)
  const emptyDepts = departments.filter((d) => d.member_count === 0).length
  const withoutHead = departments.filter((d) => !d.head_user_id).length

  const columns: Column<Dept>[] = [
    {
      key: 'name',
      header: 'Phòng ban',
      sortValue: (d) => d.name,
      cell: (d) => (
        <button
          onClick={() => setDetailId(d.id)}
          className="flex min-w-0 flex-col text-left hover:text-blue-600 dark:hover:text-blue-400"
        >
          <span className="truncate font-medium">{d.name}</span>
          {d.description && (
            <span className="truncate text-xs text-zinc-500">{d.description}</span>
          )}
        </button>
      ),
    },
    {
      key: 'head',
      header: 'Trưởng phòng',
      sortValue: (d) => {
        const h = d.head_user_id ? userById.get(d.head_user_id) : null
        return h?.name ?? h?.email ?? 'zzz'
      },
      width: '260px',
      cell: (d) => {
        const head = d.head_user_id ? userById.get(d.head_user_id) : null
        if (!head)
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Chưa gán
            </span>
          )
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={head.name} email={head.email} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{head.name ?? head.email}</div>
              <div className="truncate text-xs text-zinc-500">
                {head.title ?? ROLE_LABEL[head.role]}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'members',
      header: 'Thành viên',
      sortValue: (d) => d.member_count,
      width: '140px',
      align: 'right',
      cell: (d) => (
        <button
          onClick={() => setDetailId(d.id)}
          className="tabular-nums hover:underline"
        >
          {d.member_count === 0 ? (
            <span className="text-zinc-400">0</span>
          ) : (
            <>
              <b>{d.member_count}</b>{' '}
              <span className="text-xs text-zinc-500">người</span>
            </>
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (d) => (
        <RowMenu
          items={[
            { label: 'Xem chi tiết & thành viên', onClick: () => setDetailId(d.id) },
            { label: 'Sửa tên / mô tả', onClick: () => setEditingId(d.id) },
            { label: 'Xoá phòng ban', onClick: () => deleteDept(d), danger: true },
          ]}
        />
      ),
    },
  ]

  const btnPrimary =
    'rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Quản trị', href: '/admin' },
          { label: 'Phòng ban' },
        ]}
        title="Phòng ban"
        description={`${filtered.length} / ${departments.length} hiển thị. ${totalMembers} thành viên hoạt động.`}
        actions={
          <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
            + Thêm phòng ban
          </button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Phòng ban', value: departments.length, tone: 'default' },
          { label: 'Thành viên', value: totalMembers, tone: 'blue' },
          {
            label: 'Chưa có trưởng phòng',
            value: withoutHead,
            tone: withoutHead ? 'amber' : 'gray',
          },
          {
            label: 'Phòng trống',
            value: emptyDepts,
            tone: emptyDepts ? 'amber' : 'gray',
          },
        ]}
      />

      <div>
        <Toolbar
          left={
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm theo tên phòng ban, mô tả, trưởng phòng…"
              icon="⌕"
              className="w-72"
            />
          }
        />
        <DataTable<Dept>
          rows={filtered}
          columns={columns}
          storageKey="admin-departments"
          emptyState={
            <EmptyState
              icon="◑"
              title={departments.length === 0 ? 'Chưa có phòng ban nào' : 'Không khớp tìm kiếm'}
              description={
                departments.length === 0
                  ? 'Tạo phòng ban đầu tiên để bắt đầu.'
                  : 'Thử từ khoá khác.'
              }
              action={
                departments.length === 0 ? (
                  <button onClick={() => setOpenCreate(true)} className={btnPrimary}>
                    + Tạo phòng ban đầu tiên
                  </button>
                ) : undefined
              }
            />
          }
        />
      </div>

      {/* Create */}
      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Tạo phòng ban">
        <DeptForm
          submitLabel="Tạo phòng ban"
          onSubmit={async (body) => {
            const ok = await send('/api/departments', 'POST', body)
            if (ok) {
              setOpenCreate(false)
              toast.success('Đã tạo phòng ban', body.name)
            }
          }}
        />
      </Modal>

      {/* Edit info */}
      <Modal
        open={!!editing}
        onClose={() => setEditingId(null)}
        title={`Sửa phòng ban${editing ? ` — ${editing.name}` : ''}`}
      >
        {editing && (
          <DeptForm
            initial={{ name: editing.name, description: editing.description ?? '' }}
            submitLabel="Lưu thay đổi"
            onSubmit={async (body) => {
              const ok = await send(`/api/departments/${editing.id}`, 'PATCH', body)
              if (ok) {
                setEditingId(null)
                toast.success('Đã cập nhật', body.name)
              }
            }}
          />
        )}
      </Modal>

      {/* Detail with members */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? 'Chi tiết phòng ban'}
      >
        {detail && (
          <DeptDetailPanel
            dept={detail}
            members={membersByDept.get(detail.id) ?? []}
            busy={busy}
            onChangeHead={async (headId) => {
              const ok = await send(`/api/departments/${detail.id}`, 'PATCH', {
                head_user_id: headId,
              })
              if (ok) toast.success('Đã cập nhật trưởng phòng')
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────

function DeptDetailPanel({
  dept,
  members,
  busy,
  onChangeHead,
}: {
  dept: Dept
  members: U[]
  busy: boolean
  onChangeHead: (headId: string | null) => Promise<void>
}) {
  const head = dept.head_user_id ? members.find((m) => m.id === dept.head_user_id) : null

  return (
    <div className="flex flex-col gap-4">
      {/* Description */}
      {dept.description && (
        <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {dept.description}
        </div>
      )}

      {/* Head assignment */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Trưởng phòng
          </h3>
        </div>
        <div className="p-3">
          {members.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Chưa có thành viên trong phòng. Cần gán nhân viên vào phòng trước khi chọn trưởng phòng.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <select
                  value={dept.head_user_id ?? ''}
                  onChange={(e) => onChangeHead(e.target.value || null)}
                  disabled={busy}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">— Chưa gán —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                      {m.title ? ` (${m.title})` : ''}
                    </option>
                  ))}
                </select>
                {busy && (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500">
                    <Spinner size={14} />
                  </span>
                )}
              </div>
              {head && (
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <Avatar name={head.name} email={head.email} />
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {head.name ?? head.email}
                    </div>
                    <div>{head.title ?? ROLE_LABEL[head.role]} · {head.email}</div>
                  </div>
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Trưởng phòng phải thuộc phòng ban này. Đổi vai trò của người dùng tại{' '}
                <Link href="/admin/users" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                  Người dùng
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Members list */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Thành viên
          </h3>
          <span className="text-xs text-zinc-500">
            {members.length} người · {members.filter((m) => m.role === 'manager').length} quản lý
          </span>
        </div>
        {members.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            Chưa có nhân viên nào thuộc phòng ban này.
            <div className="mt-2">
              <Link
                href="/admin/users"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Đi tới Người dùng để gán phòng ban →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                <Avatar name={m.name} email={m.email} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate text-sm">
                    <span className="truncate font-medium">{m.name ?? m.email}</span>
                    {m.id === dept.head_user_id && (
                      <Badge tone="amber">Trưởng phòng</Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {m.email}
                    {m.title && <> · {m.title}</>}
                  </div>
                </div>
                <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Create/Edit form ───────────────────────────────────────────────────────

function DeptForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: { name: string; description: string }
  submitLabel: string
  onSubmit: (body: { name: string; description: string | null }) => Promise<void> | void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [busy, setBusy] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        await onSubmit({ name: name.trim(), description: description.trim() || null })
        setBusy(false)
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm">
        Tên phòng ban
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mô tả
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
