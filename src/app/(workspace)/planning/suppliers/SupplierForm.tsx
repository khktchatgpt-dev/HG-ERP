'use client'

import { useState } from 'react'
import { Spinner } from '@/components/erp/Spinner'

/** Trường hồ sơ NCC dùng để đổ vào form khi sửa. */
export type SupplierFormInitial = {
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_no: string | null
  note: string | null
}

export function SupplierForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: SupplierFormInitial
  submitLabel: string
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: String(fd.get('code') ?? '').trim() || null,
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      phone: String(fd.get('phone') ?? '').trim() || null,
      address: String(fd.get('address') ?? '').trim() || null,
      tax_no: String(fd.get('tax_no') ?? '').trim() || null,
      note: String(fd.get('note') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Mã NCC
        <input
          name="code"
          maxLength={50}
          defaultValue={initial?.code ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        MST
        <input
          name="tax_no"
          maxLength={30}
          defaultValue={initial?.tax_no ?? ''}
          className={`${cls} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Tên NCC <span className="text-red-500">*</span>
        <input
          name="name"
          required
          maxLength={200}
          defaultValue={initial?.name ?? ''}
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
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          name="email"
          type="email"
          defaultValue={initial?.email ?? ''}
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
          name="note"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.note ?? ''}
          className={cls}
        />
      </label>
      <div className="flex justify-end sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
