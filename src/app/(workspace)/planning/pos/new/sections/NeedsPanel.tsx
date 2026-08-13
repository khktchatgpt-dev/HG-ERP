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
  /**
   * Phân bổ theo SP (0125) — "300 Bàn 65 gỗ, đm 4c/sp". Đổ sẵn vào ô Ghi chú
   * của dòng khi thêm từ nhu cầu, đúng lối ghi tay trong sổ Cung ứng.
   */
  breakdown?: { product: string; qty: number; per_unit: number | null }[]
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
  // LSX không có BOM (0/0) thì panel không nói được gì — một dải "0 vật tư cần
  // mua / 0 trong BOM" chỉ chiếm chỗ giữa hai vùng đang làm việc thật.
  if (!loading && needs.length === 0) return null
  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]">
        <Sparkles
          className="size-4 shrink-0 text-violet-600 dark:text-violet-400"
          aria-hidden
        />
        <b>Nhu cầu từ BOM của LSX</b>
        <span className="text-muted-foreground">
          {loading
            ? 'đang tải…'
            : `${pending.length} vật tư cần mua / ${needs.length} trong BOM`}
        </span>
        {/* Bật lại có kiểm soát 12/08/2026: định mức đang hoàn thiện — nói rõ
            số là NHÁP để không ai đặt theo mà chưa đối chiếu. */}
        {!loading && (
          <span
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
            title="Số lấy từ bảng chi tiết LSX (ưu tiên nhập tay, thiếu mới nhân từ BOM×SL) — định mức đang hoàn thiện, đối chiếu với sổ trước khi đặt theo"
          >
            số nháp — đối chiếu trước khi dùng
          </span>
        )}
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
                <div className="text-muted-foreground font-mono text-[10px]">
                  {n.material_code} · cần {num(n.qty_needed)} · KD {num(n.available)}
                </div>
              </div>
              <div className="text-muted-foreground shrink-0 text-right text-[10px]">
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
            <p className="text-muted-foreground col-span-full text-[11px]">
              … và {pending.length - 24} vật tư nữa — dùng “Thêm tất cả” hoặc gõ tìm ở
              dòng cuối bảng.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
