'use client'

import { Tag } from '@/components/kit'
import { ISSUE_STATUS, type IssueStatus } from '@/lib/may-moc'
import type { AssetsMeta } from '@/modules/core/assets/assets.service'
import type { IssueView } from '@/modules/core/assets/issues.view'
import { IssueCard } from '../_ui/issue-card'
import type { useIssueFlow } from '../_ui/issue-flow'

const COLS: { s: IssueStatus; label: string }[] = [
  { s: 'moi', label: 'Mới báo' },
  { s: 'cho_duyet', label: 'Chờ giám đốc duyệt' },
  { s: 'dang_sua', label: 'Đang sửa' },
  { s: 'xong', label: 'Đã xong' },
]
/** Cột "Đã xong" chỉ bày mấy phiếu mới nhất — như demo; đủ cả thì xem dạng bảng. */
const DONE_SHOWN = 6

/**
 * BẢNG THẺ 4 CỘT — bảng kanban của demo MOCA: mỗi trạng thái một cột, nút xử lý
 * ngay trên thẻ (Nhận việc, Duyệt / Không duyệt, Sửa xong). Phiếu đã huỷ không có
 * cột (demo cũng vậy) — xem ở dạng bảng, chip "Đã huỷ".
 */
export function IssueBoard({
  issues,
  today,
  meta,
  onOpen,
  flow,
}: {
  issues: IssueView[]
  today: string
  meta: AssetsMeta
  onOpen: (i: IssueView) => void
  flow: ReturnType<typeof useIssueFlow>
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-2 p-2 md:min-w-[960px] md:grid-cols-4">
        {COLS.map(({ s, label }) => {
          const all = issues.filter((i) => i.status === s)
          const shown = s === 'xong' ? all.slice(0, DONE_SHOWN) : all
          return (
            <section
              key={s}
              aria-label={label}
              className="grid min-w-0 content-start gap-2 rounded-[var(--radius)] bg-[var(--surface-raised)] p-2"
            >
              <div className="flex items-center gap-2">
                <Tag tone={ISSUE_STATUS[s].tone}>{label}</Tag>
                <span className="text-k-sm font-mono text-[var(--ink-3)]">
                  {all.length}
                </span>
              </div>
              {shown.length === 0 ? (
                <p className="text-k-sm py-2 text-center text-[var(--ink-3)]">Trống</p>
              ) : (
                shown.map((i) => (
                  <IssueCard
                    key={i.id}
                    i={i}
                    today={today}
                    meta={meta}
                    onOpen={() => onOpen(i)}
                    onAct={(k) => flow.act(i, k)}
                    busy={flow.busy}
                  />
                ))
              )}
              {all.length > shown.length && (
                <p className="text-k-sm text-center text-[var(--ink-3)]">
                  +{all.length - shown.length} phiếu cũ hơn — xem ở dạng bảng
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
