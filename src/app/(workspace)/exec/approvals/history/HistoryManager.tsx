'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { EmptyState } from '@/components/erp/EmptyState'
import { Badge } from '@/components/Badge'

type EvAction =
  'approved' | 'rejected' | 'submitted' | 'withdrawn' | 'reassigned' | 'reopened'

type Ev = {
  id: string
  entity_type: 'po' | 'lsx' | 'quote'
  entity_id: string
  entity_code: string
  action: EvAction
  actor_id: string | null
  actor_name: string | null
  reason: string | null
  created_at: string
}

// 0128 — ngoài duyệt/từ chối còn các mốc vòng đời PO: gửi duyệt / rút về nháp /
// bàn giao người phụ trách. 16/09/2026 thêm "mở lại": đơn ĐÃ DUYỆT được đưa
// về nháp để sửa, tức chữ ký duyệt trước đó không còn giá trị — mốc này phải
// đọc được ở sổ duyệt, không thì dòng thời gian nhảy cóc từ "đã duyệt" sang
// "gửi duyệt" lần hai mà không giải thích gì.
const ACTION_META: Record<
  EvAction,
  { label: string; tone: 'green' | 'red' | 'blue' | 'amber' | 'gray' }
> = {
  approved: { label: 'Đã duyệt', tone: 'green' },
  /*
    "TRẢ LẠI ĐỂ SỬA", không phải "Từ chối" — gọi đúng việc đã xảy ra.

    `decide('reject')` đưa đơn về NHÁP, giữ nguyên số phiếu và cả lịch sử, để
    người soạn sửa theo lý do rồi gửi lại (`pos.service.ts:603`). Đó là
    *Request change* của Dynamics, không phải từ chối: từ chối là đóng cửa,
    còn cái này mở đường đi tiếp.

    Ba chỗ từng gọi ba tên cho cùng một việc — nút ghi "Trả lại", sổ này ghi
    "Từ chối", trạng thái đơn thành "Nháp" — nên không ai chắc mình vừa làm gì
    với tờ phiếu. Đây là lối mòn #1 của `docs/tieu-chi-workflow-erp.md`: một bộ
    từ vựng cho cả hệ thống.

    MÃ TRONG DB GIỮ NGUYÊN `rejected`. Đổi nhãn là việc của tầng nhìn; đổi giá
    trị đã ghi vào sổ là viết lại lịch sử, và không đáng để chữa một cái tên.

    Tone chuyển đỏ → hổ phách cho khớp `withdrawn`: cả hai đều là "quay về
    nháp", và đỏ ở đây đọc thành hỏng việc trong khi phiếu vẫn đang sống.
  */
  rejected: { label: 'Trả lại để sửa', tone: 'amber' },
  submitted: { label: 'Gửi duyệt', tone: 'blue' },
  withdrawn: { label: 'Rút về nháp', tone: 'amber' },
  reassigned: { label: 'Bàn giao', tone: 'gray' },
  reopened: { label: 'Mở lại để sửa', tone: 'amber' },
}

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const TYPE_LABEL = { lsx: 'Lệnh SX', po: 'Đơn vật tư', quote: 'Báo giá' } as const
const TYPE_TONE = {
  lsx: 'amber',
  po: 'blue',
  quote: 'green',
} as const satisfies Record<Ev['entity_type'], string>

export function HistoryManager({ events }: { events: Ev[] }) {
  const [type, setType] = useState<'all' | 'lsx' | 'po' | 'quote'>('all')
  const [action, setAction] = useState<'all' | EvAction>('all')

  const rows = useMemo(
    () =>
      events.filter(
        (e) =>
          (type === 'all' || e.entity_type === type) &&
          (action === 'all' || e.action === action),
      ),
    [events, type, action],
  )

  const approved = events.filter((e) => e.action === 'approved').length
  const rejected = events.filter((e) => e.action === 'rejected').length

  const columns: Column<Ev>[] = [
    {
      key: 'created_at',
      header: 'Thời điểm',
      width: '150px',
      sortValue: (e) => e.created_at,
      cell: (e) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtDateTime(e.created_at)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      width: '110px',
      sortValue: (e) => e.entity_type,
      cell: (e) => (
        <Badge tone={TYPE_TONE[e.entity_type]}>{TYPE_LABEL[e.entity_type]}</Badge>
      ),
    },
    {
      key: 'code',
      header: 'Mã phiếu',
      width: '150px',
      sortValue: (e) => e.entity_code,
      cell: (e) =>
        e.entity_type === 'lsx' ? (
          <Link
            href={`/exec/lsx/${e.entity_id}`}
            className="font-mono text-xs text-[var(--primary)] hover:underline"
          >
            {e.entity_code}
          </Link>
        ) : (
          <span className="font-mono text-xs">{e.entity_code}</span>
        ),
    },
    {
      key: 'action',
      header: 'Quyết định',
      width: '120px',
      sortValue: (e) => e.action,
      cell: (e) => (
        <Badge tone={ACTION_META[e.action].tone}>{ACTION_META[e.action].label}</Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Người quyết',
      width: '170px',
      sortValue: (e) => e.actor_name ?? '',
      cell: (e) => <span className="truncate">{e.actor_name ?? '—'}</span>,
    },
    {
      key: 'reason',
      header: 'Lý do (nếu từ chối)',
      cell: (e) => (
        <span className="text-muted-foreground">{e.reason?.trim() || '—'}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          // 15/08/2026 (exec v3): /exec là TỔNG QUAN, hộp ký dời sang
          // /exec/approvals. Bản cũ ghi "Hộp ký" cho /exec và nút quay lại cũng
          // trỏ về đó — bấm xong lạc sang Tổng quan chứ không về chỗ phiếu chờ.
          { label: 'Ban Giám đốc', href: '/exec' },
          { label: 'Chờ tôi phê duyệt', href: '/exec/approvals' },
          { label: 'Lịch sử ký' },
        ]}
        title="Lịch sử ký"
        description="Nhật ký mọi quyết định duyệt / từ chối Lệnh sản xuất và đơn đặt vật tư — ai quyết, khi nào, lý do gì."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/exec/approvals">
              <ChevronLeft />
              Về phiếu chờ duyệt
            </Link>
          </Button>
        }
      />

      <StatsBar
        stats={[
          { label: 'Tổng quyết định', value: events.length, tone: 'default' },
          { label: 'Đã duyệt', value: approved, tone: 'green' },
          { label: 'Trả lại để sửa', value: rejected, tone: rejected ? 'amber' : 'gray' }, // prettier-ignore
        ]}
      />

      <div>
        <Toolbar
          left={
            <>
              <ToolbarSelect
                value={type}
                onChange={(v) => setType(v as typeof type)}
                options={[
                  { value: 'all', label: 'Mọi loại' },
                  { value: 'lsx', label: 'Lệnh SX' },
                  { value: 'po', label: 'Đơn vật tư' },
                  { value: 'quote', label: 'Báo giá' },
                ]}
              />
              <ToolbarSelect
                value={action}
                onChange={(v) => setAction(v as typeof action)}
                options={[
                  { value: 'all', label: 'Mọi quyết định' },
                  ...Object.entries(ACTION_META).map(([value, m]) => ({
                    value,
                    label: m.label,
                  })),
                ]}
              />
            </>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon="🗒"
            title={
              events.length === 0 ? 'Chưa có lịch sử phê duyệt' : 'Không khớp bộ lọc'
            }
            description={
              events.length === 0
                ? 'Mỗi lần duyệt/từ chối một phiếu, hệ thống sẽ ghi lại vào đây.'
                : 'Thử đổi bộ lọc loại / quyết định.'
            }
          />
        ) : (
          <DataTable<Ev> rows={rows} columns={columns} storageKey="approval-history" />
        )}
      </div>
    </div>
  )
}
