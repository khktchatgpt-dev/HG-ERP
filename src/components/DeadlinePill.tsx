import { deadlineStatus, deadlineLabel } from '@/lib/deadline'
import { Badge } from '@/components/Badge'

export function DeadlinePill({
  dueDate,
  status,
  completedAt,
}: {
  dueDate: string | null
  status: string
  completedAt: string | null
}) {
  const s = deadlineStatus(dueDate, status, completedAt)
  if (s.kind === 'none') return null
  const { text, tone } = deadlineLabel(s)
  return <Badge tone={tone}>{text}</Badge>
}
