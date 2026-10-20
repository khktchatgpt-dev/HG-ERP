import {
  KIND_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  TOPIC_LABEL,
  TYPE_LABEL,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackTopic,
  type FeedbackType,
} from '@/lib/feedback-labels'
import type { FeedbackCommentRow, FeedbackRow } from './feedback.repo'

/**
 * XUẤT MARKDOWN CHO AI — toàn bộ góp ý N ngày gần đây kèm luồng trao đổi, để
 * đưa trợ lý đọc và tổng hợp ("hệ thống đang bị kêu ở đâu nhiều nhất"). Thuần,
 * có test. Mỗi góp ý một mục `##`, phân loại ở dòng đầu, trao đổi theo thứ tự
 * thời gian với người viết + ngày.
 */
export function buildFeedbackMarkdown(args: {
  items: FeedbackRow[]
  comments: Map<string, FeedbackCommentRow[]>
  names: Map<string, string>
  departments: Map<string, string>
  votes: Map<string, string[]>
  days: number
  now: Date
}): string {
  const { items, comments, names, departments, votes, days, now } = args
  const who = (id: string | null) => (id ? (names.get(id) ?? 'Ẩn danh') : 'Hệ thống')
  const day = (iso: string) => iso.slice(0, 10)
  const lines: string[] = []
  lines.push(`# Góp ý hệ thống — ${days} ngày gần đây`)
  lines.push('')
  lines.push(`Xuất lúc ${now.toISOString().slice(0, 16).replace('T', ' ')} · ${items.length} góp ý`)
  lines.push('')

  const byStatus = new Map<string, number>()
  for (const it of items) byStatus.set(it.status, (byStatus.get(it.status) ?? 0) + 1)
  lines.push('## Tổng theo trạng thái')
  lines.push('')
  for (const [st, n] of byStatus) {
    lines.push(`- ${STATUS_LABEL[st as FeedbackStatus] ?? st}: ${n}`)
  }
  lines.push('')

  for (const it of items) {
    const meta = [
      KIND_LABEL[it.kind as FeedbackKind]?.label ?? it.kind,
      TYPE_LABEL[it.type as FeedbackType] ?? it.type,
      SEVERITY_LABEL[it.severity as FeedbackSeverity]?.label ?? it.severity,
      STATUS_LABEL[it.status] ?? it.status,
      it.topic ? `chủ đề: ${TOPIC_LABEL[it.topic as FeedbackTopic] ?? it.topic}` : null,
      it.is_private ? 'riêng tư' : null,
      it.reopen_count > 0 ? `mở lại ${it.reopen_count} lần` : null,
      (votes.get(it.id)?.length ?? 0) > 0 ? `${votes.get(it.id)!.length} người cũng gặp` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    lines.push(`## ${it.title}`)
    lines.push('')
    lines.push(`_${meta}_`)
    const dept = it.department_id ? departments.get(it.department_id) : null
    lines.push(
      `Người viết: ${who(it.created_by)}${dept ? ` (${dept})` : ''} · ${day(it.created_at)}${
        it.page_title || it.page_url ? ` · trang: ${it.page_title ?? ''} ${it.page_url ?? ''}`.trimEnd() : ''
      }`,
    )
    lines.push('')
    lines.push(it.content.trim())
    lines.push('')
    if (it.admin_reply) {
      lines.push(`**Trả lời (${who(it.admin_reply_by)}${it.admin_replied_at ? `, ${day(it.admin_replied_at)}` : ''}):** ${it.admin_reply.trim()}`)
      lines.push('')
    }
    if (it.returned_reason && it.status === 'returned') {
      lines.push(`**Trả lại người viết:** ${it.returned_reason}`)
      lines.push('')
    }
    const thread = (comments.get(it.id) ?? []).filter((c) => c.kind !== 'status' || c.to_status)
    if (thread.length > 0) {
      lines.push('Trao đổi:')
      for (const c of thread) {
        if (c.kind === 'status') {
          lines.push(
            `- ${day(c.created_at)} · ${who(c.author_id)} đổi trạng thái → ${STATUS_LABEL[c.to_status as FeedbackStatus] ?? c.to_status}`,
          )
          continue
        }
        const tag =
          c.kind === 'reply'
            ? ' [admin trả lời]'
            : c.kind === 'needs_more'
              ? ' [vẫn cần chỉnh thêm]'
              : c.kind === 'confirmed'
                ? ' [đã ổn]'
                : c.is_admin
                  ? ' [admin]'
                  : ''
        lines.push(`- ${day(c.created_at)} · ${who(c.author_id)}${tag}: ${(c.content ?? '').trim().replace(/\s*\n\s*/g, ' ')}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}
