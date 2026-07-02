/** Cảnh báo hạn dùng chung cho mọi UI. */
export type DeadlineStatus =
  | { kind: 'none' }
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'soon'; days: number }
  | { kind: 'ok'; days: number }
  | { kind: 'late_done'; days: number }
  | { kind: 'done' }

export function deadlineStatus(
  dueDate: string | null,
  status: string,
  completedAt: string | null,
  soonThresholdDays = 2,
): DeadlineStatus {
  if (status === 'cancelled') return { kind: 'none' }
  if (!dueDate) {
    return status === 'done' ? { kind: 'done' } : { kind: 'none' }
  }
  const due = new Date(dueDate)
  const ref = status === 'done' && completedAt ? new Date(completedAt) : new Date()
  const dayMs = 86400_000
  const diffDays = Math.floor(
    (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) -
      Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate())) /
      dayMs,
  )

  if (status === 'done') {
    if (diffDays < 0) return { kind: 'late_done', days: -diffDays }
    return { kind: 'done' }
  }
  if (diffDays < 0) return { kind: 'overdue', days: -diffDays }
  if (diffDays === 0) return { kind: 'today' }
  if (diffDays <= soonThresholdDays) return { kind: 'soon', days: diffDays }
  return { kind: 'ok', days: diffDays }
}

export function deadlineLabel(s: DeadlineStatus): {
  text: string
  tone: 'gray' | 'red' | 'amber' | 'green' | 'blue'
} {
  switch (s.kind) {
    case 'overdue':
      return { text: `Quá hạn ${s.days} ngày`, tone: 'red' }
    case 'today':
      return { text: 'Đến hạn hôm nay', tone: 'amber' }
    case 'soon':
      return { text: `Sắp đến hạn (${s.days} ngày)`, tone: 'amber' }
    case 'ok':
      return { text: `Còn ${s.days} ngày`, tone: 'gray' }
    case 'late_done':
      return { text: `HT trễ ${s.days} ngày`, tone: 'amber' }
    case 'done':
      return { text: 'Hoàn thành', tone: 'green' }
    case 'none':
      return { text: '', tone: 'gray' }
  }
}
