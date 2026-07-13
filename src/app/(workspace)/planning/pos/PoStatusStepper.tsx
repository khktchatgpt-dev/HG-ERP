import type { PoStatus } from '@/modules/dept/supply/pos.schema'

/** Chuỗi chặng "happy path" của 1 PO — cancelled xử lý riêng. */
const STEPS: { key: PoStatus; label: string }[] = [
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
 * kèm mốc thời gian ở các chặng đã có dữ liệu. Thay cho việc đọc 1 chữ trạng thái.
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
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs font-bold text-white">
          ✕
        </span>
        Đơn đã huỷ — dừng ở giữa chuỗi cung ứng.
      </div>
    )
  }

  const cur = INDEX.get(status) ?? 0

  return (
    <div className="flex overflow-x-auto py-1">
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
                className={`absolute top-[11px] left-[-50%] z-0 h-0.5 w-full ${
                  i <= cur ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            )}
            {/* Bead */}
            <span
              className={
                'z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[11px] font-bold ' +
                (state === 'done'
                  ? 'border-green-500 bg-green-500 text-white'
                  : state === 'cur'
                    ? 'border-violet-500 bg-violet-500 text-white ring-4 ring-violet-500/15'
                    : 'border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900')
              }
            >
              {state === 'done' ? '✓' : state === 'cur' ? '•' : ''}
            </span>
            <span
              className={
                'mt-1.5 text-[11px] leading-tight font-semibold ' +
                (state === 'cur'
                  ? 'text-violet-600 dark:text-violet-400'
                  : state === 'done'
                    ? 'text-zinc-600 dark:text-zinc-300'
                    : 'text-zinc-400 dark:text-zinc-500')
              }
            >
              {s.label}
            </span>
            <span className="mt-0.5 h-3 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              {date ?? ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
