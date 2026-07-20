/**
 * Toán thuần cho khu Phê duyệt (Ban Giám đốc) — tách khỏi component để test
 * đơn vị được (cùng triết lý exec-ops.ts, late-risk.ts). Caller truyền nowIso
 * để pure/testable. Aging + sort + lọc + điều kiện "duyệt nhanh" đều ở đây.
 */
import { isBigApproval } from '@/lib/exec-ops'

export type PendingKind = 'lsx' | 'po'
export type ApprovalFilter = 'all' | 'lsx' | 'po' | 'big'

/** Số NGÀY đã chờ (làm tròn xuống) từ created_at đến nowIso; âm → 0. */
export function waitingDays(createdAtIso: string, nowIso: string): number {
  const created = new Date(createdAtIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(now)) return 0
  const days = Math.floor((now - created) / 86_400_000)
  return days > 0 ? days : 0
}

/** Tone badge aging: <2 ngày gray · 2–3 amber · ≥4 red (SLA phê duyệt). */
export function waitingTone(days: number): 'gray' | 'amber' | 'red' {
  if (days >= 4) return 'red'
  if (days >= 2) return 'amber'
  return 'gray'
}

/**
 * PO "giá trị lớn" (≥ BIG_APPROVAL_VND) — KHÔNG cho duyệt nhanh hàng loạt, GĐ
 * phải mở chi tiết duyệt riêng. LSX không có tiền ⇒ luôn duyệt nhanh được.
 */
export function isBulkApprovable(
  item: { kind: 'lsx' } | { kind: 'po'; total: number },
): boolean {
  if (item.kind === 'lsx') return true
  return !isBigApproval(item.total)
}

export type SortablePending = { big: boolean; created_at: string }

/**
 * Thứ tự mặc định: PO giá trị lớn LÊN TRƯỚC (cần mắt GĐ), rồi CHỜ LÂU NHẤT
 * trước (created_at cũ hơn = ISO nhỏ hơn = tăng dần). created_at là ISO nên
 * so sánh chuỗi = so sánh thời gian.
 */
export function comparePending(a: SortablePending, b: SortablePending): number {
  if (a.big !== b.big) return a.big ? -1 : 1
  return a.created_at.localeCompare(b.created_at)
}

/** Khớp bộ lọc phân đoạn. `big` chỉ đúng với PO giá trị lớn. */
export function matchesFilter(
  item: { kind: PendingKind; big: boolean },
  filter: ApprovalFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'lsx':
      return item.kind === 'lsx'
    case 'po':
      return item.kind === 'po'
    case 'big':
      return item.big
  }
}

/** Tổng kết lựa chọn duyệt nhanh: đếm LSX/PO + tổng VND (chỉ PO có tiền). */
export function summarizeBulk(
  items: ({ kind: 'lsx' } | { kind: 'po'; total: number })[],
): { lsx: number; po: number; total: number } {
  let lsx = 0
  let po = 0
  let total = 0
  for (const it of items) {
    if (it.kind === 'lsx') lsx += 1
    else {
      po += 1
      total += it.total
    }
  }
  return { lsx, po, total }
}
