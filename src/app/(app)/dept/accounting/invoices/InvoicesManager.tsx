'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

type Invoice = {
  id: string
  invoice_no: string
  party_name: string
  direction: 'incoming' | 'outgoing'
  amount: number
  currency: string
  issued_date: string
  due_date: string | null
  status: 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  notes: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ', sent: 'Đã gửi', paid: 'Đã thanh toán',
  overdue: 'Quá hạn', cancelled: 'Đã huỷ',
}
const STATUS_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  pending: 'gray', sent: 'amber', paid: 'green', overdue: 'red', cancelled: 'gray',
}
const DIR_LABEL: Record<string, string> = { incoming: 'NCC gửi', outgoing: 'Mình xuất' }

export function InvoicesManager({
  initial, total, page, currentUserId,
}: {
  initial: Invoice[]
  total: number
  page: number
  currentUserId: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const toast = useToast()
  const [busy, startTransition] = useTransition()
  const [openCreate, setOpenCreate] = useState(false)
  void currentUserId

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    p.delete('page')
    router.push(`?${p.toString()}`)
  }

  async function send(url: string, method: 'POST' | 'PATCH', body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Lỗi' }))
      toast.error('Thao tác thất bại', error)
      return false
    }
    startTransition(() => router.refresh())
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex gap-2 text-sm">
          <select
            defaultValue={sp.get('direction') ?? ''}
            onChange={(e) => setParam('direction', e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Mọi chiều</option>
            <option value="incoming">NCC gửi</option>
            <option value="outgoing">Mình xuất</option>
          </select>
          <select
            defaultValue={sp.get('status') ?? ''}
            onChange={(e) => setParam('status', e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" onClick={() => setOpenCreate(true)}>
          + Thêm hoá đơn
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon="₫"
          title="Chưa có hoá đơn nào"
          description='Bấm "+ Thêm hoá đơn" để tạo hoá đơn đầu tiên.'
          action={<Button variant="primary" onClick={() => setOpenCreate(true)}>+ Thêm hoá đơn</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-2.5">Số / Bên</th>
                <th className="px-4 py-2.5">Chiều</th>
                <th className="px-4 py-2.5 text-right">Số tiền</th>
                <th className="px-4 py-2.5">Ngày</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {initial.map((inv) => {
                const overdue = inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled'
                return (
                  <tr key={inv.id}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-zinc-400">{inv.invoice_no}</div>
                      <div className="font-medium">{inv.party_name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{DIR_LABEL[inv.direction]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(inv.amount).toLocaleString('vi-VN')} {inv.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      <div>Phát hành: {new Date(inv.issued_date).toLocaleDateString('vi-VN')}</div>
                      {inv.due_date && (
                        <div className={overdue ? 'text-red-600' : ''}>
                          Hạn: {new Date(inv.due_date).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <Button
                          variant="success"
                          size="sm"
                          loading={busy}
                          onClick={async () => {
                            const ok = await send(`/api/dept/accounting/invoices/${inv.id}`, 'PATCH', { status: 'paid' })
                            if (ok) toast.success('Đã ghi nhận thanh toán', inv.invoice_no)
                          }}
                        >
                          Đánh dấu đã TT
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>Tổng: {total}</span>
        <div className="flex gap-2">
          {page > 1 && <button onClick={() => setParam('page', String(page - 1))} className="underline">← Trước</button>}
          {page * 20 < total && <button onClick={() => setParam('page', String(page + 1))} className="underline">Sau →</button>}
        </div>
      </div>

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Thêm hoá đơn">
        <InvoiceForm
          onSubmit={async (body) => {
            const ok = await send('/api/dept/accounting/invoices', 'POST', body)
            if (ok) setOpenCreate(false)
          }}
        />
      </Modal>
    </div>
  )
}

function InvoiceForm({ onSubmit }: { onSubmit: (body: Record<string, unknown>) => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const cls = 'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      invoice_no: String(fd.get('invoice_no') ?? '').trim(),
      party_name: String(fd.get('party_name') ?? '').trim(),
      direction: fd.get('direction'),
      amount: Number(fd.get('amount')),
      currency: String(fd.get('currency') ?? 'VND').toUpperCase(),
      issued_date: fd.get('issued_date'),
      due_date: String(fd.get('due_date') ?? '') || null,
      notes: String(fd.get('notes') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Số HĐ
        <input name="invoice_no" required maxLength={100} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Chiều
        <select name="direction" required defaultValue="incoming" className={cls}>
          <option value="incoming">NCC gửi (incoming)</option>
          <option value="outgoing">Mình xuất (outgoing)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Đối tác (KH / NCC)
        <input name="party_name" required maxLength={200} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Số tiền
        <input name="amount" type="number" step="0.01" min="0" required className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tiền tệ
        <select name="currency" defaultValue="VND" className={cls}>
          <option>VND</option>
          <option>USD</option>
          <option>EUR</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ngày phát hành
        <input name="issued_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Hạn thanh toán
        <input name="due_date" type="date" className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Ghi chú
        <textarea name="notes" rows={2} maxLength={2000} className={cls} />
      </label>
      <div className="mt-2 flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Đang lưu…' : 'Thêm'}
        </button>
      </div>
    </form>
  )
}
