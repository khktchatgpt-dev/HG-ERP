'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, LayoutGrid, List, MessageSquarePlus, ShieldCheck, UserCog } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { FilterChip } from '@/components/erp/FilterChip'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Badge } from '@/components/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { QuickFeedbackDialog } from '@/components/feedback/QuickFeedbackButton'
import {
  COLUMN_LABEL,
  FEEDBACK_TOPICS,
  FEEDBACK_TYPES,
  KANBAN_COLUMNS,
  MANAGER_STATUSES,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TYPE_LABEL,
  columnOf,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackType,
  type KanbanColumn,
} from '@/lib/feedback-labels'
import type { FeedbackItem, FeedbackMeta } from '@/lib/feedback-types'
import { cn } from '@/lib/utils'
import { FeedbackCard } from './FeedbackCard'
import { FeedbackDetail } from './FeedbackDetail'
import { ReviewersDialog } from './ReviewersDialog'
import { WeeklyTab } from './WeeklyTab'
import { timeAgo } from './feedback-ui'

/**
 * TRANG GÓP Ý HỆ THỐNG: 4 thẻ số · dải cửa xác nhận · tab Góp ý (bảng kanban
 * theo trạng thái — mặc định, admin kéo thả đổi trạng thái; hoặc danh sách;
 * lọc chủ đề / loại / Của tôi / Tôi theo dõi; trong cột xếp hoạt động gần nhất
 * lên đầu) · tab Cập nhật hằng tuần · Xuất cho AI (admin).
 */
export function FeedbackScreen({
  initialItems,
  initialMeta,
  initialId,
}: {
  initialItems: FeedbackItem[]
  initialMeta: FeedbackMeta
  initialId: string | null
}) {
  const toast = useToast()
  const [items, setItems] = useState(initialItems)
  const [meta, setMeta] = useState(initialMeta)
  /*
    Máy chủ gửi danh sách MỚI (router.refresh — nút "Góp ý" trên thanh đầu
    trang gọi sau khi gửi) thì nhận lấy. Thiếu khối này, useState giữ bản đầu
    mãi: gửi góp ý từ thanh đầu trang khi đang đứng ở /gop-y mà bảng không hiện
    (dính 21/10/2026). Mẫu "điều chỉnh state theo prop" của React, không dùng effect.
  */
  const [seen, setSeen] = useState(initialItems)
  if (seen !== initialItems) {
    setSeen(initialItems)
    setItems(initialItems)
    setMeta(initialMeta)
  }
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [topic, setTopic] = useState('')
  const [type, setType] = useState('')
  const [mine, setMine] = useState(false)
  const [following, setFollowing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(initialId)
  const [writing, setWriting] = useState(false)
  const [reviewersOpen, setReviewersOpen] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const r = await api<{ items: FeedbackItem[]; meta: FeedbackMeta }>('/api/feedback?scope=all')
      setItems(r.items)
      setMeta(r.meta)
    } catch (e) {
      toast.error('Không tải lại được danh sách', apiErrorText(e))
    }
  }, [toast])

  // Callback ổn định cho hộp chi tiết: nó nạp lại dữ liệu khi callback đổi,
  // truyền arrow mới mỗi render là mỗi lần cha render hộp gọi API thêm một lần.
  const closeDetail = useCallback(() => setOpenId(null), [])
  const detailChanged = useCallback(() => void reload(), [reload])

  // ?id= theo hộp đang mở để copy link / Back hoạt động như mong đợi.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (openId) url.searchParams.set('id', openId)
    else url.searchParams.delete('id')
    window.history.replaceState(null, '', url.toString())
  }, [openId])

  const filtered = useMemo(
    () =>
      items.filter(
        (it) =>
          (!topic || it.topic === topic) &&
          (!type || it.type === type) &&
          (!mine || it.created_by === meta.me) &&
          (!following || it.participated || it.created_by === meta.me),
      ),
    [items, topic, type, mine, following, meta.me],
  )

  const byColumn = useMemo(() => {
    const m = new Map<KanbanColumn, FeedbackItem[]>()
    for (const c of KANBAN_COLUMNS) m.set(c, [])
    for (const it of filtered) m.get(columnOf(it))!.push(it)
    for (const arr of m.values()) arr.sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
    return m
  }, [filtered])

  const counts = meta.counts
  const open = (counts.new ?? 0) + (counts.reopened ?? 0)
  const working = (counts.reviewing ?? 0) + (counts.planned ?? 0)

  async function vote(it: FeedbackItem) {
    try {
      const r = await api<{ voted: boolean; count: number }>(`/api/feedback/${it.id}/vote`, { method: 'POST' })
      setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, voted: r.voted, vote_count: r.count } : x)))
    } catch (e) {
      toast.error('Chưa ghi được', apiErrorText(e))
    }
  }

  async function dropTo(column: KanbanColumn, id: string) {
    setDragOver(null)
    if (!meta.can_manage) return
    if (!(MANAGER_STATUSES as readonly string[]).includes(column)) {
      toast.info('Cột này không kéo vào được', 'Chờ xác nhận / Trả lại do người xác nhận; "Đã xong — người dùng xác nhận" do người viết bấm Đã ổn.')
      return
    }
    const it = items.find((x) => x.id === id)
    if (!it || it.status === column) return
    setBusy(true)
    try {
      await api(`/api/feedback/${id}/process`, { method: 'POST', body: { status: column } })
      toast.success(`${it.title}`, `→ ${STATUS_LABEL[column as FeedbackStatus]}`)
      await reload()
    } catch (e) {
      toast.error('Chưa đổi được trạng thái', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function exportForAi() {
    setBusy(true)
    try {
      const res = await fetch('/api/feedback/export?days=90')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const m = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = m?.[1] ?? 'gop-y.md'
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Đã xuất Markdown 90 ngày', 'Đưa file này cho trợ lý AI đọc.')
    } catch (e) {
      toast.error('Chưa xuất được', e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const visibleColumns = KANBAN_COLUMNS.filter((c) => {
    if (c === 'pending_review' || c === 'returned') return meta.gate_enabled || (byColumn.get(c)?.length ?? 0) > 0
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Góp ý hệ thống' }]}
        title="Góp ý hệ thống"
        description="Lỗi, chỗ khó dùng, ý tưởng về phần mềm và vận hành — ghi từ mọi trang, trao đổi trong từng góp ý, người viết bấm Đã ổn mới là xong."
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              <b className="t-data">{items.length}</b> góp ý
            </span>
            {meta.can_manage && <Badge tone="blue">Bạn xử lý góp ý</Badge>}
            {meta.is_reviewer && <Badge tone="amber">Bạn là người xác nhận</Badge>}
          </div>
        }
        actions={
          <>
            {meta.can_manage && (
              <Button type="button" variant="outline" onClick={() => void exportForAi()} disabled={busy}>
                <Download aria-hidden /> Xuất cho AI
              </Button>
            )}
            <Button type="button" onClick={() => setWriting(true)}>
              <MessageSquarePlus aria-hidden /> Ghi góp ý
            </Button>
          </>
        }
      />

      <StatTiles>
        <StatTile label="Mới + cần chỉnh thêm" value={open} hint="đội phát triển chưa nhận" tone={open > 0 ? 'primary' : 'default'} />
        <StatTile label="Đang xem / sẽ làm" value={working} hint="đã nhận, đang xử lý" />
        <StatTile label="Xong tuần này" value={meta.done_this_week} hint="đã đẩy online từ thứ Hai" tone={meta.done_this_week > 0 ? 'done' : 'default'} />
        {meta.gate_enabled ? (
          <StatTile label="Chờ xác nhận" value={counts.pending_review ?? 0} hint="đang ở cửa xác nhận" tone={(counts.pending_review ?? 0) > 0 ? 'warn' : 'default'} />
        ) : (
          <StatTile label="Góp ý tuần này" value={meta.this_week} hint="ghi từ thứ Hai đến giờ" />
        )}
      </StatTiles>

      <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-4" aria-hidden />
          {meta.gate_enabled ? (
            <span>
              Góp ý của nhân viên do <b>{meta.reviewers.map((r) => r.name).join(', ')}</b> xác nhận trước khi tới đội phát triển.
            </span>
          ) : (
            <span className="text-muted-foreground">Cửa xác nhận đang tắt — góp ý tới thẳng đội phát triển.</span>
          )}
        </span>
        {meta.can_manage_reviewers && (
          <Button type="button" variant="outline" size="sm" onClick={() => setReviewersOpen(true)}>
            <UserCog aria-hidden /> Đổi người xác nhận
          </Button>
        )}
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Góp ý</TabsTrigger>
          <TabsTrigger value="weekly">Cập nhật hằng tuần</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-3 flex flex-col gap-3">
          <Toolbar
            left={
              <>
                <ToolbarSelect
                  value={topic}
                  onChange={setTopic}
                  aria-label="Lọc chủ đề"
                  options={[{ value: '', label: 'Mọi chủ đề' }, ...FEEDBACK_TOPICS.map((t) => ({ value: t.id, label: t.label }))]}
                />
                <ToolbarSelect
                  value={type}
                  onChange={setType}
                  aria-label="Lọc loại"
                  options={[{ value: '', label: 'Mọi loại' }, ...FEEDBACK_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]}
                />
                <FilterChip label="Của tôi" active={mine} onClick={() => setMine((v) => !v)} count={items.filter((i) => i.created_by === meta.me).length} />
                <FilterChip
                  label="Tôi theo dõi"
                  active={following}
                  onClick={() => setFollowing((v) => !v)}
                  count={items.filter((i) => i.participated || i.created_by === meta.me).length}
                  title="Góp ý bạn đã viết hoặc đã trao đổi"
                />
              </>
            }
            right={
              <>
                <Button type="button" variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('kanban')} aria-pressed={view === 'kanban'}>
                  <LayoutGrid aria-hidden /> Bảng
                </Button>
                <Button type="button" variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')} aria-pressed={view === 'list'}>
                  <List aria-hidden /> Danh sách
                </Button>
              </>
            }
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="Chưa có góp ý nào"
              description="Bấm Ghi góp ý (hoặc nút Góp ý trên thanh đầu trang ở bất kỳ màn nào) — dán ảnh chụp màn hình bằng Ctrl+V."
              action={
                <Button type="button" onClick={() => setWriting(true)}>
                  <MessageSquarePlus aria-hidden /> Ghi góp ý
                </Button>
              }
            />
          ) : view === 'kanban' ? (
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              <div className="flex min-w-max gap-3">
                {visibleColumns.map((col) => {
                  const list = byColumn.get(col) ?? []
                  const droppable = meta.can_manage && (MANAGER_STATUSES as readonly string[]).includes(col)
                  return (
                    <section
                      key={col}
                      className={cn(
                        'bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border',
                        dragOver === col && droppable && 'border-[var(--primary)] bg-[var(--accent)]',
                      )}
                      onDragOver={(e) => {
                        if (!droppable) return
                        e.preventDefault()
                        if (dragOver !== col) setDragOver(col)
                      }}
                      onDragLeave={() => dragOver === col && setDragOver(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        void dropTo(col, e.dataTransfer.getData('text/feedback-id'))
                      }}
                    >
                      <header className="flex items-center justify-between px-3 py-2">
                        <span className="t-label">{COLUMN_LABEL[col]}</span>
                        <span className="t-data text-muted-foreground text-xs">{list.length}</span>
                      </header>
                      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                        {list.map((it) => (
                          <FeedbackCard
                            key={it.id}
                            item={it}
                            me={meta.me}
                            onOpen={() => setOpenId(it.id)}
                            onVote={() => void vote(it)}
                            draggable={meta.can_manage}
                          />
                        ))}
                        {list.length === 0 && (
                          <p className="text-muted-foreground px-1 py-4 text-center text-xs">Trống</p>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-card overflow-x-auto rounded-lg border">
              <Table className="text-[13px]">
                <TableHeader className="bg-card sticky top-0">
                  <TableRow>
                    <TableHead>Góp ý</TableHead>
                    <TableHead className="w-36">Người viết</TableHead>
                    <TableHead className="w-28">Loại</TableHead>
                    <TableHead className="w-28">Mức độ</TableHead>
                    <TableHead className="w-40">Trạng thái</TableHead>
                    <TableHead className="w-20 text-right">Trao đổi</TableHead>
                    <TableHead className="w-20 text-right">Cũng gặp</TableHead>
                    <TableHead className="w-32">Hoạt động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...filtered]
                    .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
                    .map((it) => (
                      <TableRow key={it.id} className="cursor-pointer" onClick={() => setOpenId(it.id)}>
                        <TableCell className="font-medium whitespace-normal">
                          {it.title}
                          {it.is_private && <Badge tone="gray" className="ml-2">Riêng tư</Badge>}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {it.author_name}
                          {it.department_name && <div className="text-muted-foreground text-xs">{it.department_name}</div>}
                        </TableCell>
                        <TableCell>{TYPE_LABEL[it.type as FeedbackType] ?? it.type}</TableCell>
                        <TableCell>
                          <Badge tone={SEVERITY_TONE[it.severity as FeedbackSeverity] ?? 'gray'}>
                            {SEVERITY_LABEL[it.severity as FeedbackSeverity]?.label ?? it.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge tone={STATUS_TONE[it.status]}>{COLUMN_LABEL[columnOf(it)]}</Badge>
                        </TableCell>
                        <TableCell className="t-data text-right">{it.comment_count}</TableCell>
                        <TableCell className="t-data text-right">{it.vote_count}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{timeAgo(it.last_activity_at)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="mt-3">
          <WeeklyTab canManage={meta.can_manage} />
        </TabsContent>
      </Tabs>

      {openId && (
        <FeedbackDetail id={openId} meta={meta} onClose={closeDetail} onChanged={detailChanged} />
      )}
      {writing && (
        <QuickFeedbackDialog
          open={writing}
          onClose={() => setWriting(false)}
          onCreated={(id) => {
            void reload()
            setOpenId(id)
          }}
        />
      )}
      {reviewersOpen && (
        <ReviewersDialog open={reviewersOpen} onClose={() => setReviewersOpen(false)} onSaved={() => void reload()} />
      )}
    </div>
  )
}
