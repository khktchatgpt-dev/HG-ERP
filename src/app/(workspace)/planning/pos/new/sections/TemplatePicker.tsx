'use client'

import { useState } from 'react'
import {
  Box,
  Check,
  Droplets,
  FileText,
  FlaskConical,
  Layers,
  Package,
  Ruler,
  Square,
  TreePine,
  Waves,
  Weight,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from '@/lib/po-template'

/** Icon đại diện từng mẫu — neo mắt khi quét các thẻ, chữ không phải đọc hết. */
const TEMPLATE_ICONS: Record<PoTemplate, LucideIcon> = {
  accessory: Package,
  aluminium: Ruler,
  metal_kg: Weight,
  carton: Box,
  rattan: Waves,
  paint: Droplets,
  chemical: FlaskConical,
  foam: Layers,
  glass: Square,
  wood: TreePine,
  mro: Wrench,
  simple: FileText,
}

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
  /**
   * Đơn TRỐNG thì bày sẵn 5 thẻ — chọn mẫu là việc ĐẦU TIÊN của đơn mới, giấu
   * sau nút "Đổi mẫu" là bắt người dùng bấm thêm một nhịp vô cớ. Đã có dòng
   * (mở sửa/nhân bản) thì thu gọn: lúc đó mẫu hiếm khi đổi, trả chỗ cho bảng.
   */
  const [open, setOpen] = useState(lineCount === 0)
  const cur = poTemplateMeta(value)
  const CurIcon = TEMPLATE_ICONS[value]

  if (!open) {
    return (
      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Loại hàng
        </span>
        <b className="inline-flex items-center gap-1.5 text-[13px] text-violet-700 dark:text-violet-300">
          <CurIcon className="size-3.5" aria-hidden />
          {cur.label}
        </b>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
          {cur.hint}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Đổi mẫu
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Loại hàng / mẫu đơn
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground ml-auto text-xs hover:text-zinc-600"
        >
          Thu gọn ▲
        </button>
      </div>
      {/*
       * RÚT GỌN (13/08/2026, yêu cầu user): thẻ chỉ còn icon + tên trên MỘT
       * dòng — mô tả dài ("Vít, nút nhựa… — TTL, MT, TN") từng làm 12 thẻ cao
       * gần nguyên màn đầu. Mô tả chuyển vào tooltip (title) và MỘT dòng dưới
       * lưới cho mẫu đang chọn — vẫn đọc được khi cần, không choán chỗ.
       */}
      <div className="flex flex-wrap gap-1.5">
        {PO_TEMPLATES.map((t) => {
          const m = poTemplateMeta(t)
          const Icon = TEMPLATE_ICONS[t]
          const on = t === value
          return (
            <button
              key={t}
              type="button"
              title={m.hint}
              onClick={() => {
                onChange(t)
                setOpen(false) // chọn xong là gọn lại, trả chỗ cho bảng dòng hàng
              }}
              aria-pressed={on}
              className={
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors ' +
                (on
                  ? 'border-violet-500 bg-violet-50 font-semibold text-violet-700 ring-1 ring-violet-500 dark:border-violet-600 dark:bg-violet-950/40 dark:text-violet-300'
                  : 'border-zinc-200 hover:border-violet-300 dark:border-zinc-800 dark:hover:border-violet-800')
              }
            >
              <Icon className="size-3.5" aria-hidden />
              {m.label}
              {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
            </button>
          )
        })}
      </div>
      {/* Mô tả của mẫu ĐANG CHỌN — một dòng thay cho 12 đoạn hint trên thẻ. */}
      <p className="text-muted-foreground mt-2 text-[11px]">{cur.hint}</p>
      {lineCount > 0 && (
        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-500">
          Đổi mẫu giữ nguyên {lineCount} dòng đang có — cột và cách tính tiền đổi theo mẫu
          mới, kiểm lại số trước khi gửi.
        </p>
      )}
    </section>
  )
}
