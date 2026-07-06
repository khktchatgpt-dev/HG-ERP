'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

type Customer = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  is_active: boolean
  created_at: string
}

type Member = { id: string; label: string }

export function CustomersManager({
  initial,
  total,
  page,
  q,
  currentUserId,
  role,
  members,
}: {
  initial: Customer[]
  total: number
  page: number
  q: string
  currentUserId: string
  role: 'admin' | 'manager' | 'employee'
  members: Member[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, startTransition] = useTransition()
  const [openCreate, setOpenCreate] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState(q)

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    p.delete('page')
    router.push(`?${p.toString()}`)
  }

  function canEdit(c: Customer) {
    return role === 'admin' || role === 'manager' || c.owner_id === currentUserId
  }

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Có lỗi' }))
      toast.error('Thao tác thất bại', error)
      return false
    }
    startTransition(() => router.refresh())
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', search.trim())
          }}
          className="flex flex-1 gap-2"
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm khách hàng theo tên…"
            className="min-w-48 flex-1"
          />
          <Button>Tìm</Button>
        </form>
        <Button variant="primary" onClick={() => setOpenCreate(true)}>
          + Thêm khách hàng
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon="◍"
          title="Chưa có khách hàng nào"
          description='Bấm "+ Thêm khách hàng" để bắt đầu xây dựng danh sách KH.'
          action={
            <Button variant="primary" onClick={() => setOpenCreate(true)}>
              + Thêm khách hàng
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-2.5">Mã / Tên</th>
                <th className="px-4 py-2.5">Liên hệ</th>
                <th className="px-4 py-2.5">Phụ trách</th>
                <th className="px-4 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {initial.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    {c.code && (
                      <div className="font-mono text-xs text-zinc-400">{c.code}</div>
                    )}
                    <div className="font-medium">{c.name}</div>
                    {c.address && (
                      <div className="text-xs text-zinc-500">{c.address}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-zinc-500">{c.phone}</div>}
                    {!c.email && !c.phone && <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.owner_name ? (
                      <Badge tone={c.owner_id === currentUserId ? 'blue' : 'gray'}>
                        {c.owner_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-zinc-400">— chưa gán —</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      disabled={busy || !canEdit(c)}
                      onClick={() => setEditing(c)}
                    >
                      Sửa
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="ml-1"
                      disabled={busy || !canEdit(c)}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xoá KH "${c.name}"?`,
                          description: 'Hành động này không thể hoàn tác.',
                          tone: 'danger',
                          confirmLabel: 'Xoá',
                        })
                        if (ok) {
                          const ok2 = await send(
                            `/api/dept/sales/customers/${c.id}`,
                            'DELETE',
                          )
                          if (ok2) toast.success('Đã xoá', c.name)
                        }
                      }}
                    >
                      Xoá
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>Tổng: {total}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <button
              onClick={() => setParam('page', String(page - 1))}
              className="underline"
            >
              ← Trước
            </button>
          )}
          {page * 20 < total && (
            <button
              onClick={() => setParam('page', String(page + 1))}
              className="underline"
            >
              Sau →
            </button>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Thêm khách hàng"
      >
        <CustomerForm
          members={members}
          currentUserId={currentUserId}
          submitLabel="Thêm"
          onSubmit={async (body) => {
            const ok = await send('/api/dept/sales/customers', 'POST', body)
            if (ok) setOpenCreate(false)
          }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Sửa — ${editing.name}` : ''}
      >
        {editing && (
          <CustomerForm
            members={members}
            currentUserId={currentUserId}
            initial={editing}
            submitLabel="Lưu"
            onSubmit={async (body) => {
              const ok = await send(
                `/api/dept/sales/customers/${editing.id}`,
                'PATCH',
                body,
              )
              if (ok) setEditing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function CustomerForm({
  members,
  currentUserId,
  initial,
  submitLabel,
  onSubmit,
}: {
  members: Member[]
  currentUserId: string
  initial?: Partial<Customer>
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      name: String(fd.get('name') ?? '').trim(),
      code: String(fd.get('code') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
      address: String(fd.get('address') ?? '').trim() || null,
      notes: String(fd.get('notes') ?? '').trim() || null,
      owner_id: String(fd.get('owner_id') ?? '') || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên khách hàng
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mã KH
        <input
          name="code"
          maxLength={50}
          defaultValue={initial?.code ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phụ trách
        <select
          name="owner_id"
          defaultValue={initial?.owner_id ?? currentUserId}
          className={cls}
        >
          <option value="">— chưa gán —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          defaultValue={initial?.email ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Điện thoại
        <input
          name="phone"
          maxLength={30}
          defaultValue={initial?.phone ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Địa chỉ
        <input
          name="address"
          maxLength={500}
          defaultValue={initial?.address ?? ''}
          className={cls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={initial?.notes ?? ''}
          className={cls}
        />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
