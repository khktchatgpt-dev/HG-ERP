import type { DieEventType, DieStatus } from '@/modules/dept/technical/dies.repo'

/**
 * GHI MỘT VIỆC VÀO NHẬT KÝ KHUÔN THÌ HỒ SƠ ĐỔI GÌ (user chốt 29/09/2026, Q1).
 *
 * Thuần, không chạm DB: `dies.service.addEvent` dùng để GHI, hộp "Ghi nhật ký"
 * dùng để BÀY TRƯỚC ("Tình trạng: Đang dùng → Khuôn hư") — một hàm cho cả hai,
 * nên thứ người dùng thấy trước khi bấm đúng là thứ máy chủ sẽ ghi.
 *
 * Chỉ trả những thứ THẬT SỰ đổi: khuôn đang hư mà ghi thêm "Báo hư" thì tình
 * trạng không đổi, và hộp không được bày "Khuôn hư → Khuôn hư".
 */

export type DieEventEffectInput = {
  event_type: DieEventType
  to_holder?: string | null
  weight_after?: number | null
}

export type DieBefore = {
  status: DieStatus
  holder_name: string | null
  weight_per_m: number | null
}

export type DieChange =
  | { field: 'status'; from: DieStatus; to: DieStatus }
  | { field: 'holder_name'; from: string | null; to: string }
  | { field: 'weight_per_m'; from: number | null; to: number }

/** Việc nào kéo theo tình trạng nào. Sửa / chuyển / ghi chú không đổi tình trạng. */
const STATUS_AFTER: Partial<Record<DieEventType, DieStatus>> = {
  broken: 'broken',
  replaced: 'replaced',
  retired: 'retired',
  opened: 'active',
  reopened: 'active',
}

export function dieEventChanges(before: DieBefore, ev: DieEventEffectInput): DieChange[] {
  const out: DieChange[] = []

  const status = STATUS_AFTER[ev.event_type]
  if (status && status !== before.status) {
    out.push({ field: 'status', from: before.status, to: status })
  }

  // Mở khuôn ghi nơi mở; chuyển khuôn ghi nơi nhận — cả hai là nơi giữ MỚI.
  const holder = ev.to_holder?.trim()
  if (
    (ev.event_type === 'transferred' || ev.event_type === 'opened') &&
    holder &&
    holder !== (before.holder_name ?? '')
  ) {
    out.push({ field: 'holder_name', from: before.holder_name, to: holder })
  }

  if (
    ev.event_type === 'modified' &&
    ev.weight_after != null &&
    ev.weight_after !== before.weight_per_m
  ) {
    out.push({ field: 'weight_per_m', from: before.weight_per_m, to: ev.weight_after })
  }

  return out
}

/** Danh sách thay đổi → bản vá cho `technical_dies`. */
export function dieChangesPatch(changes: DieChange[]): {
  status?: DieStatus
  holder_name?: string
  weight_per_m?: number
} {
  const patch: { status?: DieStatus; holder_name?: string; weight_per_m?: number } = {}
  for (const c of changes) {
    if (c.field === 'status') patch.status = c.to
    else if (c.field === 'holder_name') patch.holder_name = c.to
    else patch.weight_per_m = c.to
  }
  return patch
}
