'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  BORROWER_KIND_LABEL,
  BORROWER_KINDS,
  type BorrowerKind,
} from '@/modules/dept/technical/samples.schema'
import { BTN_GHOST, BTN_PRIMARY, Field, INPUT } from './SampleCreateModal'
import type { SampleRow } from './SamplesManager'

/** Hạn trả mặc định: +14 ngày. Có ngày hẹn thì mới đòi mẫu về được. */
function defaultDue(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

export function LoanModal({
  sample,
  onClose,
}: {
  sample: SampleRow
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<BorrowerKind>('customer')
  const [userId, setUserId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [purpose, setPurpose] = useState('')
  const [dueAt, setDueAt] = useState(defaultDue())
  const [users, setUsers] = useState<
    { id: string; name: string | null; email: string }[]
  >([])
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const [u, c] = await Promise.all([
          api<{ users: { id: string; name: string | null; email: string }[] }>(
            '/api/users?page_size=500',
          ),
          api<{ customers: { id: string; name: string }[] }>(
            '/api/dept/sales/customers?page_size=500',
          ),
        ])
        setUsers(u.users ?? [])
        setCustomers(c.customers ?? [])
      } catch {
        /* danh sách rỗng vẫn ghi được kiểu "đối tác ngoài" */
      }
    })()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api(`/api/dept/technical/samples/${sample.id}/loan`, {
        method: 'POST',
        body: {
          borrower_kind: kind,
          borrower_user_id: kind === 'user' ? userId || null : null,
          borrower_customer_id: kind === 'customer' ? customerId || null : null,
          borrower_name: kind === 'other' ? name || null : null,
          borrower_contact: contact || null,
          purpose: purpose || null,
          due_at: dueAt || null,
        },
      })
      toast.success('Đã ghi phiếu mượn', sample.code)
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Ghi mượn thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const ready =
    (kind === 'user' && userId) ||
    (kind === 'customer' && customerId) ||
    (kind === 'other' && name)

  return (
    <Modal open onClose={onClose} title={`Ghi mượn — ${sample.code}`}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500 dark:bg-zinc-900">
          {sample.product_code} — {sample.product_name}
        </p>

        <Field label="Người mượn là *">
          <div className="flex gap-1">
            {BORROWER_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                  kind === k
                    ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900'
                }`}
              >
                {BORROWER_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        {kind === 'user' && (
          <Field label="Nhân viên *">
            <select
              value={userId}
              onChange={(e) => setUserId(e.currentTarget.value)}
              className={INPUT}
            >
              <option value="">— Chọn nhân viên —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'customer' && (
          <Field label="Khách hàng *">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.currentTarget.value)}
              className={INPUT}
            >
              <option value="">— Chọn khách hàng —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === 'other' && (
          <Field label="Tên người / đơn vị mượn *">
            <input
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Cty TNHH ABC"
              className={INPUT}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Liên hệ">
            <input
              value={contact}
              onChange={(e) => setContact(e.currentTarget.value)}
              placeholder="SĐT / email"
              className={INPUT}
            />
          </Field>
          <Field label="Hẹn trả">
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.currentTarget.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label="Mục đích mượn">
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.currentTarget.value)}
            placeholder="Chào khách, chụp ảnh, hội chợ…"
            className={INPUT}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Huỷ
          </button>
          <button type="submit" disabled={busy || !ready} className={BTN_PRIMARY}>
            {busy && <Spinner size={12} />}
            {busy ? 'Đang ghi…' : 'Ghi phiếu mượn'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
