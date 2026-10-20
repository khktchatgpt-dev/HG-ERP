'use client'

import { Lock, MessageSquare, RotateCcw, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { FeedbackImages } from '@/components/feedback/FeedbackImages'
import {
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TOPIC_LABEL,
  TYPE_LABEL,
  type FeedbackSeverity,
  type FeedbackTopic,
  type FeedbackType,
} from '@/lib/feedback-labels'
import type { FeedbackItem } from '@/lib/feedback-types'
import { cn } from '@/lib/utils'
import { timeAgo } from './feedback-ui'

/**
 * THẺ GÓP Ý trên bảng kanban / danh sách: tiêu đề, người viết, phòng, mức độ,
 * chủ đề, ảnh thu nhỏ, số "tôi cũng gặp", số trao đổi, "(đã sửa)", vòng.
 */
export function FeedbackCard({
  item,
  me,
  onOpen,
  onVote,
  draggable,
  showStatus,
}: {
  item: FeedbackItem
  /** id người xem — không tự vote góp ý của mình. */
  me: string
  onOpen: () => void
  onVote: () => void
  draggable?: boolean
  showStatus?: boolean
}) {
  const mine = item.created_by === me
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/feedback-id', item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'bg-card hover:border-[var(--primary)]/50 flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left shadow-xs transition-colors',
        draggable && 'cursor-grab active:cursor-grabbing',
        item.severity === 'blocking' && 'border-l-4 border-l-[var(--stop)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm leading-snug font-medium">
          {item.is_private && (
            <Lock className="text-muted-foreground mr-1 inline size-3.5 align-text-bottom" aria-label="Riêng tư" />
          )}
          {item.title}
          {item.edited_at && <span className="text-muted-foreground ml-1 text-xs font-normal">(đã sửa)</span>}
        </div>
        {item.reopen_count > 0 && (
          <span
            className="text-muted-foreground inline-flex shrink-0 items-center gap-0.5 text-[11px]"
            title={`Mở lại ${item.reopen_count} lần`}
          >
            <RotateCcw className="size-3" aria-hidden /> v{item.reopen_count + 1}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {showStatus && <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>}
        <Badge tone={SEVERITY_TONE[item.severity as FeedbackSeverity] ?? 'gray'}>
          {SEVERITY_LABEL[item.severity as FeedbackSeverity]?.label ?? item.severity}
        </Badge>
        <Badge tone="gray">{TYPE_LABEL[item.type as FeedbackType] ?? item.type}</Badge>
        {item.topic && <Badge tone="blue">{TOPIC_LABEL[item.topic as FeedbackTopic] ?? item.topic}</Badge>}
      </div>

      {item.file_ids.length > 0 && <FeedbackImages ids={item.file_ids.slice(0, 3)} />}

      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        <span className="truncate">
          {item.author_name}
          {item.department_name ? ` · ${item.department_name}` : ''} · {timeAgo(item.last_activity_at)}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-0.5" title="Số trao đổi">
            <MessageSquare className="size-3.5" aria-hidden /> {item.comment_count}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={mine}
            onClick={(e) => {
              e.stopPropagation()
              onVote()
            }}
            aria-pressed={item.voted}
            title={mine ? 'Góp ý của bạn' : item.voted ? 'Bỏ "tôi cũng gặp"' : 'Tôi cũng gặp'}
            className={cn('h-6 gap-1 px-1.5 text-xs', item.voted && 'text-[var(--primary)]')}
          >
            <ThumbsUp className="size-3.5" aria-hidden /> {item.vote_count}
          </Button>
        </span>
      </div>
    </div>
  )
}
