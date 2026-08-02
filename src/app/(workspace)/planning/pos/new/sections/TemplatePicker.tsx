'use client'

import { useState } from 'react'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from '@/lib/po-template'

/**
 * Chọn LOẠI HÀNG / MẪU ĐƠN — thứ quyết định cột nhập, công thức tiền, VAT và mẫu
 * phiếu in. Đứng đầu form vì mọi thứ phía dưới đổi theo nó.
 *
 * MẶC ĐỊNH THU GỌN thành một dòng: năm thẻ mô tả chiếm gần nguyên màn đầu, mà
 * người soạn chỉ chạm tới chúng một lần rồi làm việc suốt ở bảng dòng hàng phía
 * dưới. Mở ra khi cần đổi.
 */
export function TemplatePicker({
  value,
  lineCount,
  onChange,
}: {
  value: PoTemplate
  /** Số dòng đang có — đổi mẫu giữ dòng nhưng đổi cách tính tiền, phải cảnh báo. */
  lineCount: number
  onChange: (t: PoTemplate) => void
}) {
  const [open, setOpen] = useState(false)
  const cur = poTemplateMeta(value)

  if (!open) {
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
          Loại hàng
        </span>
        <b className="text-[13px] text-sky-700 dark:text-sky-300">{cur.label}</b>
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">
          {cur.hint}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Đổi mẫu
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
          Loại hàng / mẫu đơn
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-600"
        >
          Thu gọn ▲
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {PO_TEMPLATES.map((t) => {
          const m = poTemplateMeta(t)
          const on = t === value
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t)
                setOpen(false) // chọn xong là gọn lại, trả chỗ cho bảng dòng hàng
              }}
              aria-pressed={on}
              className={
                'rounded-lg border px-3 py-2 text-left transition-colors ' +
                (on
                  ? 'border-sky-500 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
                  : 'border-zinc-200 hover:border-sky-300 dark:border-zinc-800')
              }
            >
              <div
                className={
                  'text-[13px] font-semibold ' +
                  (on ? 'text-sky-700 dark:text-sky-300' : '')
                }
              >
                {m.label}
              </div>
              <div className="mt-0.5 max-w-[230px] text-[11px] text-zinc-400">
                {m.hint}
              </div>
            </button>
          )
        })}
      </div>
      {lineCount > 0 && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-500">
          Đổi mẫu giữ nguyên {lineCount} dòng đang có — cột và cách tính tiền đổi theo mẫu
          mới, kiểm lại số trước khi gửi.
        </p>
      )}
    </section>
  )
}
