/**
 * Tiến độ + nhãn trạng thái ĐƠN HÀNG — logic thuần, dùng chung cho màn Theo dõi
 * đơn (Sales) và Quản lý đơn hàng (Ban Giám đốc). Tách khỏi TrackingManager để
 * hai màn hiển thị tiến độ NHẤT QUÁN và có test.
 *
 * Caller truyền `todayIso` (yyyy-mm-dd) để hàm pure/testable (không đọc Date).
 */
import { assessLateRisk, type LateRiskInput } from './late-risk'

export type OrderStatus =
  | 'confirmed'
  | 'lsx_pending'
  | 'lsx_issued'
  | 'in_production'
  | 'completed'
  | 'delivered'
  | 'cancelled'

export const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  lsx_pending: 'Chờ duyệt LSX',
  lsx_issued: 'Đã phát LSX',
  in_production: 'Đang sản xuất',
  completed: 'Hoàn thành',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
}

/** Thứ tự các bước vòng đời (bỏ 'cancelled' — nhánh phụ) để vẽ timeline. */
export const LIFECYCLE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'confirmed', label: 'Xác nhận' },
  { status: 'lsx_pending', label: 'Chờ duyệt LSX' },
  { status: 'lsx_issued', label: 'Đã phát LSX' },
  { status: 'in_production', label: 'Sản xuất' },
  { status: 'completed', label: 'Hoàn thành' },
  { status: 'delivered', label: 'Đã giao' },
]

export type Stage = { code: string; label: string }

/** Đầu vào tối thiểu để suy tiến độ (subset của v_order_tracking). */
export type OrderProgressInput = LateRiskInput & {
  current_stage: string | null
}

export type OrderProgress = {
  label: string
  /** 0–100, ước theo vị trí bước / công đoạn. */
  pct: number
  /** Tailwind bg-* theo rủi ro (đỏ trễ / hổ phách nguy cơ / xanh ổn). */
  tone: string
}

/**
 * Tiến độ GIẢN LƯỢC (P5) — không cần từng công đoạn CNC:
 * Chờ duyệt → Chuẩn bị SX → Đang SX / QC / đóng gói → Đã xuất xưởng → Đã giao,
 * kèm % ước theo vị trí giai đoạn và màu theo rủi ro trễ.
 */
export function orderProgress(
  r: OrderProgressInput,
  stages: Stage[],
  todayIso: string,
): OrderProgress {
  const risk = assessLateRisk(r, todayIso)
  const tone =
    risk?.level === 'overdue' ? 'bg-red-500' : risk ? 'bg-amber-500' : 'bg-green-500'

  if (r.status === 'cancelled') return { label: 'Đã huỷ', pct: 0, tone: 'bg-zinc-300' }
  if (r.status === 'delivered')
    return { label: 'Đã giao', pct: 100, tone: 'bg-green-500' }
  if (r.status === 'completed') return { label: 'Đã xuất xưởng', pct: 95, tone }
  if (!r.production_order_id) return { label: 'Chưa phát LSX', pct: 5, tone }
  if (r.lsx_status === 'rejected')
    return { label: 'LSX bị từ chối', pct: 8, tone: 'bg-red-500' }
  if (r.lsx_status === 'pending_approval')
    return { label: 'Chờ GĐ duyệt LSX', pct: 10, tone }
  if (r.lsx_status === 'approved' && !r.current_stage)
    return { label: 'Chuẩn bị sản xuất', pct: 15, tone }

  // Đang chạy công đoạn: nhãn thân thiện + % theo vị trí trong danh mục.
  const idx = stages.findIndex((s) => s.code === r.current_stage)
  const pct =
    stages.length > 0 && idx >= 0 ? Math.round(15 + (75 * (idx + 1)) / stages.length) : 40
  const lbl = (stages.find((s) => s.code === r.current_stage)?.label ?? '').toLowerCase()
  const label =
    lbl.includes('qc') || lbl.includes('kiểm')
      ? 'Đang QC'
      : lbl.includes('gói') || lbl.includes('pack')
        ? 'Đang đóng gói'
        : lbl.includes('xuất')
          ? 'Chuẩn bị xuất kho'
          : 'Đang sản xuất'
  return { label, pct, tone }
}
