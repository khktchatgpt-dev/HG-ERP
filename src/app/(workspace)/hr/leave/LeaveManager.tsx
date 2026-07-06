'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { useConfirm, usePrompt } from '@/components/ui/ConfirmDialog'

type Row = {
  id: string
  user_id: string
  user_name: string | null
  user_email: string
  leave_type: string
  from_date: string
  to_date: string
  days_count: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approver_name: string | null
  approver_note: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  annual: 'Nghỉ phép', sick: 'Ốm', unpaid: 'Không lương',
  marriage: 'Cưới', funeral: 'Tang', maternity: 'Thai sản', other: 'Khác',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', approved: 'Đã duyệt',
  rejected: 'Từ chối', cancelled: 'Đã huỷ',
}

const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'gray',
}

const SCOPES = [
  { id: 'mine', label: 'Của tôi' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'all', label: 'Tất cả' },
] as const

export function LeaveManager({
  rows,
  scope,
  canApprove,
  currentUserId,
}: {
  rows: Row[]
  scope: string
  canApprove: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const prompt = usePrompt()
  const [busy, startTransition] = useTransition()
  const [openCreate, setOpenCreate] = useState(false)

  async function send(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: 'POST',
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
      <div className="flex items-end justify-between gap-2">
        <div className="flex gap-1 border-b border-zinc-200 text-sm dark:border-zinc-800">
          {SCOPES.filter((s) => s.id === 'mine' || canApprove).map((s) => (
            <Link
              key={s.id}
              href={`?scope=${s.id}`}
              className={`-mb-px border-b-2 px-3 py-2 ${
                scope === s.id ? 'border-black dark:border-white' : 'border-transparent text-zinc-500'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpenCreate(true)}>
          + Tạo đơn
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="☰"
          title="Không có đơn nào"
          description={scope === 'pending' ? 'Không có đơn nào chờ duyệt.' : 'Bấm "+ Tạo đơn" để gửi đơn nghỉ phép đầu tiên.'}
        />
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {rows.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.user_name ?? r.user_email}</span>
                    <Badge>{TYPE_LABEL[r.leave_type] ?? r.leave_type}</Badge>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div className="mt-1 text-sm">
                    {new Date(r.from_date).toLocaleDateString('vi-VN')} →{' '}
                    {new Date(r.to_date).toLocaleDateString('vi-VN')}{' '}
                    <span className="text-zinc-500">({r.days_count} ngày)</span>
                  </div>
                  {r.reason && (
                    <div className="mt-1 text-xs text-zinc-500">Lý do: {r.reason}</div>
                  )}
                  {r.approver_name && (
                    <div className="mt-1 text-xs text-zinc-500">
                      {r.status === 'approved' ? '✓' : '✗'} {r.approver_name}
                      {r.approver_note && ` — ${r.approver_note}`}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  {r.status === 'pending' && canApprove && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        loading={busy}
                        onClick={() => send(`/api/dept/hr/leave/${r.id}`, { action: 'approve' })}
                      >
                        Duyệt
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={busy}
                        onClick={async () => {
                          const note = await prompt({
                            title: 'Từ chối đơn nghỉ',
                            inputLabel: 'Lý do',
                            placeholder: 'VD: trùng thời gian dự án quan trọng…',
                            confirmLabel: 'Từ chối',
                            tone: 'danger',
                          })
                          if (note !== null) {
                            send(`/api/dept/hr/leave/${r.id}`, { action: 'reject', approver_note: note || undefined })
                          }
                        }}
                      >
                        Từ chối
                      </Button>
                    </>
                  )}
                  {r.status === 'pending' && r.user_id === currentUserId && (
                    <Button
                      size="sm"
                      loading={busy}
                      onClick={async () => {
                        const ok = await confirm({ title: 'Huỷ đơn này?', tone: 'danger', confirmLabel: 'Huỷ đơn' })
                        if (ok) send(`/api/dept/hr/leave/${r.id}`, { action: 'cancel' })
                      }}
                    >
                      Huỷ
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Tạo đơn nghỉ phép">
        <CreateLeaveForm
          onSubmit={async (body) => {
            const ok = await send('/api/dept/hr/leave', body)
            if (ok) setOpenCreate(false)
          }}
        />
      </Modal>
    </div>
  )
}

function CreateLeaveForm({ onSubmit }: { onSubmit: (body: Record<string, unknown>) => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  function days() {
    if (!from || !to) return 0
    const a = new Date(from), b = new Date(to)
    const d = Math.floor((b.getTime() - a.getTime()) / 86400_000) + 1
    return d > 0 ? d : 0
  }

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      leave_type: fd.get('leave_type'),
      from_date: from,
      to_date: to,
      days_count: Number(fd.get('days_count')) || days(),
      reason: String(fd.get('reason') ?? '').trim() || undefined,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <Field label="Loại nghỉ" className="sm:col-span-2">
        <Select name="leave_type" defaultValue="annual">
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </Field>
      <Field label="Từ ngày" required>
        <Input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Field label="Đến ngày" required>
        <Input type="date" required value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <Field label="Số ngày" required>
        <Input
          name="days_count"
          type="number"
          step="0.5"
          min="0.5"
          max="90"
          required
          defaultValue={days() || ''}
          key={`${from}-${to}`}
        />
      </Field>
      <Field label="Lý do" className="sm:col-span-2">
        <Textarea name="reason" rows={3} maxLength={2000} />
      </Field>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <Button variant="primary" loading={busy}>
          {busy ? 'Đang gửi…' : 'Gửi đơn'}
        </Button>
      </div>
    </form>
  )
}
