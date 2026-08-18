'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Inbox } from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { Button } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'
import { SUPPLY_TODO, groupTodos, type SupplyTodoKind } from '@/lib/supply-watch'
import { EtaNote, PoWatchRow } from '../_components/PoWatchRow'
import type { WatchPo } from '../_data/watch'

const TONE_COLOR: Record<(typeof SUPPLY_TODO)[SupplyTodoKind]['tone'], string> = {
  stop: 'var(--stop)',
  warn: 'var(--warn)',
  primary: 'var(--primary)',
  muted: 'var(--muted-foreground)',
}

/**
 * CHỜ TÔI XỬ LÝ — hộp việc của người mua.
 *
 * Màn danh sách đơn trả lời "đơn nào đang ở đâu"; màn này trả lời câu khác:
 * "hôm nay tôi phải động tay vào cái gì". Mỗi nhóm nói rõ VIỆC PHẢI LÀM ở thể
 * mệnh lệnh, không phải tên trạng thái — người mở màn này đang cần biết làm gì
 * tiếp, không cần học lại từ vựng vòng đời.
 *
 * Mặc định lọc ĐƠN CỦA TÔI (khớp với số trên sidebar); trưởng phòng gạt sang
 * "cả phòng" để thấy việc còn tồn của cả tổ.
 */
export function TodoScreen({
  pos,
  meId,
  today,
  canEdit,
}: {
  pos: WatchPo[]
  meId: string | null
  today: string
  canEdit: boolean
}) {
  const [scope, setScope] = useState<'mine' | 'all'>(meId ? 'mine' : 'all')

  const rows = useMemo(
    () => (scope === 'mine' && meId ? pos.filter((p) => p.assigned_to === meId) : pos),
    [pos, scope, meId],
  )
  const groups = useMemo(() => groupTodos(rows, today), [rows, today])
  const totalTodos = groups.reduce((n, g) => n + g.rows.length, 0)
  const mineCount = useMemo(
    () =>
      meId
        ? groupTodos(
            pos.filter((p) => p.assigned_to === meId),
            today,
          )
        : [],
    [pos, meId, today],
  ).reduce((n, g) => n + g.rows.length, 0)
  const allCount = useMemo(
    () => groupTodos(pos, today).reduce((n, g) => n + g.rows.length, 0),
    [pos, today],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Chờ tôi xử lý' },
        ]}
        title="Chờ tôi xử lý"
        description="Những đơn đang đợi Cung ứng động tay — xếp theo mức khẩn, mỗi đơn chỉ nằm ở một nhóm."
        actions={
          canEdit && (
            <Button size="sm" asChild>
              <Link href="/planning/pos/new">Tạo phiếu mua</Link>
            </Button>
          )
        }
      />

      {/* Phạm vi: của tôi ⇄ cả phòng */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="border-border inline-flex rounded-lg border p-0.5 text-[12px]">
          {(
            [
              ['mine', 'Của tôi', mineCount],
              ['all', 'Cả phòng', allCount],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              type="button"
              disabled={v === 'mine' && !meId}
              onClick={() => setScope(v)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors disabled:opacity-40',
                scope === v
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 font-mono text-[11px] tabular-nums">
                {n}
              </span>
            </button>
          ))}
        </div>
        <span className="text-muted-foreground text-[12px]">
          {totalTodos === 0
            ? 'Không còn việc nào đang chờ.'
            : `${totalTodos} việc đang chờ xử lý.`}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-xl border py-14 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--done)_12%,transparent)]">
            <CircleCheck className="size-6 text-[var(--done)]" strokeWidth={1.8} />
          </span>
          <p className="t-title mt-4">Sạch việc</p>
          <p className="t-body text-muted-foreground mt-1 max-w-sm">
            {scope === 'mine'
              ? 'Không đơn nào của bạn đang chờ gửi, chờ hẹn ngày hay quá hạn.'
              : 'Cả phòng không còn đơn nào tồn đọng.'}
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/planning/pos">
              <Inbox /> Xem toàn bộ phiếu mua
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ kind, rows: list }) => {
            const meta = SUPPLY_TODO[kind]
            const color = TONE_COLOR[meta.tone]
            return (
              <section key={kind} className="bg-card overflow-hidden rounded-xl border">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <h2 className="t-title">{meta.label}</h2>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums"
                    style={{
                      color,
                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    }}
                  >
                    {list.length}
                  </span>
                  <span className="t-label text-muted-foreground ml-auto">
                    → {meta.action}
                  </span>
                  <p className="text-muted-foreground basis-full text-[12px]">
                    {meta.why}
                  </p>
                </header>
                <div>
                  {list.map((po) => (
                    <PoWatchRow
                      key={po.id}
                      po={po}
                      note={
                        kind === 'overdue' || kind === 'no_eta' ? (
                          <EtaNote po={po} today={today} />
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
