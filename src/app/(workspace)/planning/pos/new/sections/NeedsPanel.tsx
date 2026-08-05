'use client'

import { Plus, Sparkles } from 'lucide-react'

/** Nhu cầu vật tư của LSX từ BOM — payload của `/api/dept/supply/needs`. */
export type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  available: number
  suggest: number
}

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * Nhu cầu từ BOM của LSX — ĐƯỜNG TẮT, không phải cửa bắt buộc.
 *
 * Form cũ bắt đi vòng: sang vùng nhu cầu, gõ lọc, bấm `+`, quay lại bảng nhập số.
 * Nay vật tư tìm thẳng ở dòng cuối bảng; panel này còn lại để thêm nhanh những
 * thứ BOM nói là còn thiếu.
 */
export function NeedsPanel({
  needs,
  pending,
  loading,
  open,
  onToggle,
  onAdd,
}: {
  needs: Need[]
  /** Nhu cầu còn thiếu và chưa có trên dòng nào. */
  pending: Need[]
  loading: boolean
  open: boolean
  onToggle: () => void
  onAdd: (list: Need[]) => void
}) {
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]">
        <Sparkles
          className="size-4 shrink-0 text-violet-600 dark:text-violet-400"
          aria-hidden
        />
        <b>Nhu cầu từ BOM của LSX</b>
        <span className="text-zinc-500 dark:text-zinc-400">
          {loading
            ? 'đang tải…'
            : `${pending.length} vật tư cần mua / ${needs.length} trong BOM`}
        </span>
        {pending.length > 0 && (
          <button
            type="button"
            onClick={() => onAdd(pending)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs font-medium text-violet-700 shadow-xs hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-950 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            <Plus className="size-3" aria-hidden /> Thêm tất cả ({pending.length})
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs shadow-xs dark:border-zinc-700 dark:bg-zinc-950"
        >
          {open ? 'Thu gọn' : 'Xem'}
        </button>
      </div>
      {open && pending.length > 0 && (
        <div className="grid gap-2 border-t border-violet-100 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-violet-950">
          {pending.slice(0, 24).map((n) => (
            <div
              key={n.material_id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold" title={n.material_name}>
                  {n.material_name}
                </div>
                <div className="font-mono text-[10px] text-zinc-400">
                  {n.material_code} · cần {num(n.qty_needed)} · KD {num(n.available)}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px] text-zinc-400">
                đề xuất
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                  {num(n.suggest)} {n.unit}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAdd([n])}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-zinc-300 text-sm font-bold text-sky-600 hover:border-sky-400 hover:bg-sky-50 dark:border-zinc-700"
                aria-label={`Thêm ${n.material_name}`}
              >
                +
              </button>
            </div>
          ))}
          {pending.length > 24 && (
            <p className="col-span-full text-[11px] text-zinc-400">
              … và {pending.length - 24} vật tư nữa — dùng “Thêm tất cả” hoặc gõ tìm ở
              dòng cuối bảng.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
