'use client'

import { useState } from 'react'
import { Button } from '@/components/shadcn/button'
import { Spinner } from '@/components/erp/Spinner'
import { ACCENT_SOLID, type CustomerNameOption, type Product } from './types'

/** Nhân bản mẫu (FR-ENG-02) — copy thuộc tính + BOM sang một mã SP mới. */
export function CloneForm({
  source,
  suggestedCode,
  customerNames,
  onSubmit,
}: {
  source: Product
  /** Mã kế tiếp cùng loại + vật liệu, xin sẵn ở `openClone`. '' = phải nhập tay. */
  suggestedCode: string
  customerNames: CustomerNameOption[]
  onSubmit: (body: Record<string, unknown>) => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  const cls =
    'w-full rounded-md border px-3 py-2 text-sm bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

  const [code, setCode] = useState(suggestedCode)

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {
      code: code.trim(),
      name: String(fd.get('name') ?? '').trim() || undefined,
      customer_name: String(fd.get('customer_name') ?? '').trim() || null,
      customer_item_code: String(fd.get('customer_item_code') ?? '').trim() || null,
    }
    setBusy(true)
    await onSubmit(body)
    setBusy(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Copy toàn bộ thuộc tính + BOM của <span className="font-mono">{source.code}</span>{' '}
        sang sản phẩm mới — dùng khi khách đặt lại mẫu cũ.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Mã SP mới <span className="text-destructive">*</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          maxLength={100}
          placeholder="Nhập mã"
          className={`${cls} font-mono`}
        />
        <span className="text-muted-foreground text-xs">
          {suggestedCode
            ? 'Mã kế tiếp cùng loại và vật liệu, cấp sẵn — sửa được.'
            : 'Mẫu gốc mang mã cũ, không suy ra được mã mới — nhập tay.'}
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Tên (bỏ trống = giữ tên gốc)
        <input name="name" maxLength={200} placeholder={source.name} className={cls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Khách hàng / nhóm
        <input
          name="customer_name"
          list="clone-customer-names"
          maxLength={200}
          defaultValue={source.customer_name ?? ''}
          className={cls}
          placeholder="Gõ tên bất kỳ — để trống là mẫu chung"
        />
        <datalist id="clone-customer-names">
          {customerNames.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mã KH đặt (Customer Item)
        <input name="customer_item_code" maxLength={100} className={`${cls} font-mono`} />
      </label>
      <div className="mt-1 flex justify-end">
        <Button disabled={busy} className={ACCENT_SOLID}>
          {busy && <Spinner size={14} />}
          {busy ? 'Đang nhân bản…' : 'Nhân bản'}
        </Button>
      </div>
    </form>
  )
}
