'use client'

import { useState } from 'react'
import { Spinner } from '@/components/erp/Spinner'

const TYPES = ['Nguyên vật liệu', 'Bao bì', 'Máy móc', 'Dịch vụ', 'Logistics', 'Khác']
const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Thêm nhanh NCC — chỉ trường thiết yếu (đủ để tạo & chọn khi mua). Hồ sơ đầy đủ
 * (pháp lý, thanh toán, mua hàng, đánh giá…) bổ sung ở trang chi tiết sau khi tạo,
 * nơi có đủ chỗ — tránh form dài che kín màn hình.
 */
export function SupplierQuickForm({
  onSubmit,
}: {
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const s = (k: string) => String(fd.get(k) ?? '').trim() || null
    setBusy(true)
    await onSubmit({
      name: String(fd.get('name') ?? '').trim(),
      code: s('code'),
      type: s('type'),
      tax_no: s('tax_no'),
      phone: s('phone'),
      email: String(fd.get('email') ?? '').trim(),
    })
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Tên NCC <span className="text-red-500">*</span>
        <input name="name" required maxLength={200} className={cls} autoFocus />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Mã NCC
          <input name="code" maxLength={50} className={`${cls} font-mono`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Loại NCC
          <select name="type" defaultValue="" className={cls}>
            <option value="">— chọn —</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          MST
          <input name="tax_no" maxLength={30} className={`${cls} font-mono`} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Điện thoại
          <input name="phone" maxLength={30} className={cls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" className={cls} />
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        Thêm nhanh — bổ sung pháp lý, thanh toán, nhóm hàng, đánh giá… ở trang hồ sơ ngay
        sau khi tạo.
      </p>

      <div className="flex justify-end">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang tạo…' : 'Thêm NCC → mở hồ sơ'}
        </button>
      </div>
    </form>
  )
}
