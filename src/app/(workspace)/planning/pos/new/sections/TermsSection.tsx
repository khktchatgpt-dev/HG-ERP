'use client'

import type { PoTerms } from '@/lib/po-template'

const field =
  'h-[32px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/**
 * Năm điều khoản in thành năm dòng riêng trên phiếu + khối chữ ký giữa phiếu.
 *
 * Điền sẵn theo mẫu đơn (mỗi loại hàng một bộ điều khoản khác nhau — xem
 * `poTemplateMeta`), người dùng sửa khi thoả thuận riêng. Gập lại mặc định vì
 * phần lớn đơn dùng nguyên bản mặc định.
 */
export function TermsSection({
  templateLabel,
  open,
  onToggle,
  terms,
  onTermsChange,
  signerRole,
  onSignerChange,
  note,
  onNoteChange,
}: {
  templateLabel: string
  open: boolean
  onToggle: () => void
  terms: PoTerms
  onTermsChange: (t: PoTerms) => void
  signerRole: string
  onSignerChange: (v: string) => void
  note: string
  onNoteChange: (v: string) => void
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px]"
      >
        <b>Điều khoản &amp; ghi chú</b>
        <span className="text-[11px] text-zinc-400">
          đã điền sẵn theo mẫu {templateLabel.toLowerCase()}
        </span>
        <span className="ml-auto text-xs text-zinc-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-zinc-100 p-3.5 sm:grid-cols-2 dark:border-zinc-800">
          {(
            [
              ['quality', 'Tiêu chuẩn chất lượng'],
              ['delivery_place', 'Địa điểm giao hàng'],
              ['payment', 'Hình thức thanh toán'],
              ['invoice', 'Chứng từ thanh toán'],
              ['lead_time', 'Thời gian giao hàng'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-zinc-500">
              {label}
              <input
                maxLength={1000}
                value={terms[k]}
                onChange={(e) => onTermsChange({ ...terms, [k]: e.target.value })}
                className={field}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Chữ ký giữa phiếu
            <input
              maxLength={100}
              value={signerRole}
              onChange={(e) => onSignerChange(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 sm:col-span-2">
            Ghi chú đơn
            <input
              maxLength={2000}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className={field}
            />
          </label>
        </div>
      )}
    </section>
  )
}
