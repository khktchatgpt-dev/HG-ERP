'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Btn, Cell, Row, Table, Tag, THead } from '@/components/kit'
import { everyTxt } from '@/lib/may-moc'
import { AssetCode, DueText } from './_ui/shared'
import type { assetsService, PlanView } from '@/modules/core/assets/assets.service'
import type { IssueView } from '@/modules/core/assets/issues.view'
import type { useIssueFlow } from './_ui/issue-flow'

export type HomeData = Awaited<ReturnType<(typeof assetsService)['home']>>
/** Hai bản trang đầu của demo MOCA: Cơ điện "Việc hôm nay", Giám đốc "Tổng quan". */
export type HomeView = 'hom-nay' | 'tong-quan'
export type HomeDlg = null | 'report' | { scan: 'any' | 'hours' } | { plan: PlanView }

export type HomeCtx = {
  d: HomeData
  setDlg: (x: HomeDlg) => void
  flow: ReturnType<typeof useIssueFlow>
  /** Mở khung chi tiết phiếu ở trang Báo hỏng. */
  openIssue: (i: IssueView) => void
}

/** Đầu một khối trên trang đầu: tên khối (+ số) bên trái, lối sang màn đích bên phải. */
export function SectionHead({
  title,
  count,
  tone,
  action,
}: {
  title: string
  count?: number
  tone?: 'stop' | 'warn'
  action?: ReactNode
}) {
  return (
    <div className="text-k-body flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 font-semibold">
      <span>
        {title}
        {count != null && (
          <span
            className="text-k-sm ml-1.5 font-mono"
            style={{ color: count && tone ? `var(--${tone})` : 'var(--ink-3)' }}
          >
            {count}
          </span>
        )}
      </span>
      {action}
    </div>
  )
}

/** Câu thay cho khối trống — nói rõ trống nghĩa là gì. */
export const Quiet = ({ children }: { children: ReactNode }) => (
  <p className="text-k-sm px-[var(--gutter)] py-3 text-[var(--ink-3)]">{children}</p>
)

/**
 * Dòng hạng mục bảo trì trên trang đầu — như `planRow` của demo: mã máy, hạng
 * mục, "tên máy · mỗi <chu kỳ> · tổ", hạn. Bấm dòng mở hồ sơ máy. Bày tối đa
 * `limit` dòng; số trên đầu khối vẫn là tổng thật, phần còn lại ở Lịch bảo trì.
 */
export function PlanRows({
  label,
  rows,
  limit = 12,
  done,
}: {
  label: string
  rows: PlanView[]
  limit?: number
  /** Nút "Đã làm" — chỉ người làm bảo trì. */
  done?: (p: PlanView) => void
}) {
  const router = useRouter()
  const shown = rows.slice(0, limit)
  return (
    <Table label={label} inline minWidth={0}>
      <THead>
        <th>Máy · hạng mục</th>
        <th>Hạn</th>
        {done && <th />}
      </THead>
      <tbody>
        {shown.map((p) => (
          <Row key={p.id} onClick={() => router.push(`/may-moc/may/${p.asset.code}`)}>
            <Cell grow title={`${p.asset.name} · ${p.task}`}>
              <AssetCode code={p.asset.code} />{' '}
              {p.is_inspection && <Tag tone="warn">Kiểm định</Tag>} {p.task}
              <span className="text-k-label block truncate text-[var(--ink-3)]">
                {p.asset.name} · mỗi {everyTxt(p.every_n, p.unit)}
                {p.asset.dept_name ? ` · ${p.asset.dept_name}` : ''}
              </span>
            </Cell>
            <Cell>
              <DueText due={p.due} />
            </Cell>
            {done && (
              <Cell>
                {/* Nút trong dòng bấm được: chặn để không mở luôn hồ sơ máy. */}
                <span className="contents" onClick={(e) => e.stopPropagation()}>
                  <Btn primary={p.state === 'od'} onClick={() => done(p)}>
                    {p.is_inspection ? 'Đã kiểm định' : 'Đã làm'}
                  </Btn>
                </span>
              </Cell>
            )}
          </Row>
        ))}
      </tbody>
      {rows.length > limit && (
        <tfoot>
          <tr>
            <td colSpan={done ? 3 : 2} className="text-k-sm text-[var(--ink-3)]">
              Còn {rows.length - limit} hạng mục nữa —{' '}
              <Link href="/may-moc/bao-tri" className="text-[var(--act-text)] underline">
                xem ở Lịch bảo trì
              </Link>
            </td>
          </tr>
        </tfoot>
      )}
    </Table>
  )
}
