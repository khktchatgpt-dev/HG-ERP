import type { PoStatus } from '@/modules/dept/supply/pos.schema'
import { Ban, Check } from 'lucide-react'

/** Chuỗi chặng "happy path" của 1 PO — cancelled xử lý riêng. */
const STEPS: { key: PoStatus; label: string }[] = [
  { key: 'draft', label: 'Nháp' },
  { key: 'pending_approval', label: 'Chờ duyệt' },
  { key: 'approved', label: 'GĐ duyệt' },
  { key: 'ordered', label: 'Gửi NCC' },
  { key: 'confirmed', label: 'NCC xác nhận' },
  { key: 'in_transit', label: 'Đang giao' },
  { key: 'partial', label: 'Về một phần' },
  { key: 'received', label: 'Về đủ' },
]
const INDEX = new Map(STEPS.map((s, i) => [s.key, i]))

function fmt(d?: string | null): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

/**
 * Stepper trạng thái PO — nhìn 1 giây biết đơn đang ở chặng nào trong vòng đời,
 * kèm mốc thời gian ở các chặng đã có dữ liệu. Dùng chung cho các màn PO trong ERP.
 */
export function PoStatusStepper({
  status,
  dates,
}: {
  status: PoStatus
  /** Mốc thời gian theo key chặng (chặng nào chưa có để trống). */
  dates?: Partial<Record<PoStatus, string | null>>
}) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <Ban className="size-4 shrink-0" />
        <div>
          <span className="font-semibold">Đơn đặt hàng đã huỷ</span>
          <span className="text-muted-foreground ml-2 text-xs">
            — Đã dừng giữa chuỗi cung ứng.
          </span>
        </div>
      </div>
    )
  }

  const cur = INDEX.get(status) ?? 0

  return (
    <div className="flex w-full overflow-x-auto py-1">
      <div className="flex min-w-[680px] flex-1 items-center justify-between">
        {STEPS.map((s, i) => {
          const state = i < cur ? 'done' : i === cur ? 'cur' : 'todo'
          const date = fmt(dates?.[s.key])
          return (
            <div
              key={s.key}
              className="relative flex min-w-[76px] flex-1 flex-col items-center text-center"
            >
              {/* Đường nối tới chặng trước */}
              {i > 0 && (
                <span
                  className={`absolute top-[11px] left-[-50%] z-0 h-0.5 w-full transition-colors ${
                    i <= cur ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                  aria-hidden
                />
              )}
              {/* Bead */}
              <span
                className={`z-10 grid size-6 place-items-center rounded-full text-xs font-bold transition-all ${
                  state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : state === 'cur'
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'border-border bg-muted text-muted-foreground border-2'
                }`}
              >
                {state === 'done' ? (
                  <Check className="size-3.5 stroke-[2.5]" />
                ) : state === 'cur' ? (
                  <span className="size-1.5 rounded-full bg-current" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  state === 'cur'
                    ? 'text-primary font-semibold'
                    : state === 'done'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
              <span className="text-muted-foreground font-mono mt-0.5 h-3.5 text-[10px]">
                {date ?? ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
