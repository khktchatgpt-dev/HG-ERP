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
      <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm">
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
  const next = STEPS[cur + 1]
  const curDate = fmt(dates?.[STEPS[cur].key])

  return (
    <>
      {/*
        MÀN HẸP — MỘT DÒNG, KHÔNG CUỘN NGANG (04/09/2026).

        Bản đầy đủ có `min-w-[680px]` nên dưới ngưỡng đó nó thành một băng cuộn
        ngang. Cuộn ngang lồng trong một trang đang cuộn dọc là cử chỉ hiếm ai
        đoán ra: đo trên 375px thì người dùng thấy 4/8 chặng và không có gì gợi
        ý còn 4 chặng nữa. Nên ở đây đổi CÁCH KỂ chứ không thu nhỏ chữ — vạch
        tiến độ + "chặng mấy trên mấy" nói đủ, còn tên tám chặng thì không ai
        cần đọc trên điện thoại.
      */}
      <div className="sm:hidden">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px]">
            Chặng <b className="text-[var(--primary)]">{cur + 1}</b>/{STEPS.length} ·{' '}
            <b>{STEPS[cur].label}</b>
          </span>
          {curDate && (
            <span className="text-muted-foreground t-data ml-auto text-[11px]">
              {curDate}
            </span>
          )}
        </div>
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width]"
            style={{ width: `${((cur + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        {next && (
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            Kế tiếp: {next.label}
          </p>
        )}
      </div>

      <div className="hidden w-full overflow-x-auto py-1 sm:flex">
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
                      i <= cur ? 'bg-[var(--done)]' : 'bg-muted'
                    }`}
                    aria-hidden
                  />
                )}
                {/* Bead */}
                <span
                  className={`z-10 grid size-6 place-items-center rounded-full text-xs font-bold transition-all ${
                    state === 'done'
                      ? 'bg-[var(--done)] text-white'
                      : state === 'cur'
                        ? 'bg-primary text-primary-foreground ring-primary/20 ring-4'
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
                <span className="text-muted-foreground mt-0.5 h-3.5 font-mono text-[10px]">
                  {date ?? ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
