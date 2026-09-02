'use client'

import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner } from '@/components/erp/Spinner'

/** Nhu cầu vật tư của LSX từ BOM — payload của `/api/dept/supply/needs`. */
export type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  available: number
  suggest: number
  /** Cảnh báo mua vượt trần (P3.1): tồn + đã đặt + trần — route needs trả kèm. */
  on_hand?: number
  ordered?: number
  max_stock?: number | null
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
  onGoLines,
}: {
  needs: Need[]
  /** Nhu cầu còn thiếu và chưa có trên dòng nào. */
  pending: Need[]
  loading: boolean
  open: boolean
  onToggle: () => void
  onAdd: (list: Need[]) => void
  /** Lệnh chưa có định mức — lối đi duy nhất còn lại là tự chọn vật tư. */
  onGoLines: () => void
}) {
  /*
   * LSX không có BOM. Khi khối này còn là một DẢI nằm chen giữa hai vùng làm
   * việc, trả `null` là đúng — không ai muốn một dải "0/0" chiếm chỗ. Nhưng nó
   * đã thành một TAB riêng (03/09/2026): bấm vào tab mà ra trang trắng thì
   * người dùng tưởng màn hỏng, chứ không hiểu là "lệnh này chưa có định mức".
   * Tab phải tự nói tại sao nó rỗng.
   */
  if (!loading && needs.length === 0) {
    return (
      <section className="bg-card rounded-xl border">
        <EmptyState
          icon={<Sparkles />}
          title="Lệnh này chưa có định mức để gợi ý"
          description="Nhu cầu vật tư lấy từ bảng chi tiết LSX (ưu tiên số nhập tay, thiếu mới nhân từ BOM × SL). Lệnh chưa chốt định mức thì không có gì để gợi ý — cứ chọn vật tư ở tab Dòng hàng như thường."
          action={
            <Button type="button" variant="outline" onClick={onGoLines}>
              Sang tab Dòng hàng
            </Button>
          }
        />
      </section>
    )
  }
  if (loading) {
    return (
      <section className="bg-card text-muted-foreground flex items-center gap-2 rounded-xl border px-3.5 py-6 text-[13px]">
        <Spinner size={14} /> Đang đọc định mức của lệnh…
      </section>
    )
  }
  return (
    /*
     * 02/09: khối này từng mang bảng màu RIÊNG (violet + zinc + sky, kèm mọi
     * biến `dark:` gõ tay) nên đứng cạnh các thẻ khác là lệch tông. Theme v3 chỉ
     * có MỘT màu hành động, nên "gợi ý từ BOM" nay nhận diện bằng tint cobalt
     * `--accent` + icon, không bằng một màu tự chế. Nhãn "số nháp" là CẢNH BÁO
     * thật nên ăn `--warn` — đó mới là chỗ màu vòng đời được phép xuất hiện.
     */
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]">
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]">
        <Sparkles
          className="size-4 shrink-0 text-[var(--primary)]"
          strokeWidth={1.8}
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
            className="rounded-full border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-[var(--warn)]"
            title="Số lấy từ bảng chi tiết LSX (ưu tiên nhập tay, thiếu mới nhân từ BOM×SL) — định mức đang hoàn thiện, đối chiếu với sổ trước khi đặt theo"
          >
            số nháp — đối chiếu trước khi dùng
          </span>
        )}
        {pending.length > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onAdd(pending)}
            className="ml-auto h-auto gap-1 px-2.5 py-1 text-xs"
          >
            <Plus className="size-3" aria-hidden /> Thêm tất cả ({pending.length})
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onToggle}
          className="h-auto px-2.5 py-1 text-xs font-normal"
        >
          {open ? 'Thu gọn' : 'Xem'}
        </Button>
      </div>
      {open && pending.length > 0 && (
        <div className="grid gap-2 border-t border-[color-mix(in_srgb,var(--primary)_15%,transparent)] p-3 sm:grid-cols-2 lg:grid-cols-3">
          {pending.slice(0, 24).map((n) => (
            <div
              key={n.material_id}
              className="border-border bg-card flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
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
                <div className="text-foreground text-xs font-bold">
                  {num(n.suggest)} {n.unit}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onAdd([n])}
                className="hover:border-primary hover:text-primary size-6 shrink-0"
                aria-label={`Thêm ${n.material_name}`}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
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
