'use client'

import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import { Spinner } from '@/components/erp/Spinner'
import { EmptyState } from '@/components/erp/EmptyState'
import type { FeedbackWeek } from '@/lib/feedback-types'
import { weekRangeLabel } from './feedback-ui'

/**
 * CẬP NHẬT HẰNG TUẦN — mỗi tuần (thứ Hai → Chủ nhật): số góp ý mới, việc đã
 * xong, và bản tóm tắt admin viết (mỗi dòng một thay đổi; dòng `# ` là tên
 * nhóm). Khép vòng "góp ý → thay đổi → báo lại cả công ty".
 */
export function WeeklyTab({ canManage }: { canManage: boolean }) {
  const toast = useToast()
  const [weeks, setWeeks] = useState<FeedbackWeek[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  async function load() {
    try {
      const r = await api<{ weeks: FeedbackWeek[] }>('/api/feedback/weekly?weeks=12')
      setWeeks(r.weeks)
    } catch (e) {
      toast.error('Không tải được', apiErrorText(e))
      setWeeks([])
    }
  }
  useEffect(() => {
    // load() là async — setState trong callback đã resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!weeks) {
    return (
      <div className="grid place-items-center py-10">
        <Spinner />
      </div>
    )
  }
  const anyActivity = weeks.some((w) => w.created || w.done || w.update)
  if (!anyActivity) {
    return (
      <EmptyState
        title="Chưa có tuần nào có hoạt động"
        description="Khi có góp ý mới hoặc việc được đẩy online, từng tuần sẽ hiện ở đây kèm bản tóm tắt."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {weeks.map((w) => (
        <Card key={w.week_start}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="t-title">
              Tuần {weekRangeLabel(w.week_start)}
              <span className="text-muted-foreground ml-3 text-sm font-normal">
                <b className="t-data">{w.created}</b> góp ý mới · <b className="t-data">{w.done}</b> đã đẩy online
              </span>
            </CardTitle>
            {canManage && editing !== w.week_start && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(w.week_start)}>
                <Pencil aria-hidden /> {w.update ? 'Sửa tóm tắt' : 'Viết tóm tắt'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing === w.week_start ? (
              <WeeklyForm
                week={w}
                onDone={() => {
                  setEditing(null)
                  void load()
                }}
                onCancel={() => setEditing(null)}
              />
            ) : w.update ? (
              <Summary title={w.update.title} content={w.update.content} />
            ) : (
              <p className="text-muted-foreground text-sm">Chưa có tóm tắt cho tuần này.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Summary({ title, content }: { title: string | null; content: string }) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  return (
    <div className="text-sm">
      {title && <p className="mb-2 font-medium">{title}</p>}
      <ul className="space-y-1">
        {lines.map((l, i) =>
          l.startsWith('# ') ? (
            <li key={i} className="t-label mt-3 first:mt-0">
              {l.slice(2)}
            </li>
          ) : (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{l.replace(/^[-*]\s*/, '')}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

function WeeklyForm({
  week,
  onDone,
  onCancel,
}: {
  week: FeedbackWeek
  onDone: () => void
  onCancel: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(week.update?.title ?? '')
  const [content, setContent] = useState(week.update?.content ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!content.trim()) {
      toast.error('Chưa có nội dung')
      return
    }
    setBusy(true)
    try {
      await api('/api/feedback/weekly', {
        method: 'POST',
        body: { week_start: week.week_start, title: title.trim(), content: content.trim() },
      })
      toast.success('Đã lưu tóm tắt tuần')
      onDone()
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề (tuỳ chọn)" />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={8}
        placeholder={'Mỗi dòng một thay đổi. Dòng bắt đầu bằng "# " là tên nhóm, VD:\n# Bán hàng\nĐơn hàng lưu nhanh hơn\n# Kho\nPhiếu nhập in được mã vạch'}
        className="bg-card font-mono text-xs"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} disabled={busy}>
          {busy && <Spinner size={14} />} Lưu
        </Button>
      </div>
    </div>
  )
}
