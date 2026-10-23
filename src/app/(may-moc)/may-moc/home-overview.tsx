'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Btn, Cell, MiniBars, Row, Table, Tag, THead } from '@/components/kit'
import {
  agoTxt,
  inspectionSoon,
  shortMoney,
  statusOf,
  vnd,
  ymTxt,
  type AssetStatus,
} from '@/lib/may-moc'
import { AssetCode } from './_ui/shared'
import { IssueCard } from './_ui/issue-card'
import { PlanRows, Quiet, SectionHead, type HomeCtx } from './home.shared'

/** Ô chỉ số bấm được — như bốn ô đầu trang Tổng quan của demo MOCA. */
function Kpi({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string
  value: string
  sub: string
  href: string
  tone?: 'stop' | 'warn'
}) {
  return (
    <Link
      href={href}
      className="grid min-w-0 gap-0.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] px-3 py-2 no-underline hover:border-[var(--act)] hover:bg-[var(--act-wash)]"
    >
      <span className="text-k-label font-semibold tracking-wider text-[var(--ink-label)] uppercase">
        {label}
      </span>
      <span
        className="text-k-title font-mono font-semibold"
        style={{ color: tone ? `var(--${tone})` : 'var(--ink)' }}
      >
        {value}
      </span>
      <span className="text-k-sm truncate text-[var(--ink-3)]" title={sub}>
        {sub}
      </span>
    </Link>
  )
}

/**
 * TỔNG QUAN (bản Giám đốc) — "Máy móc xưởng đang ra sao, tôi phải duyệt gì?"
 * Chép bố cục `pHomeGD` của demo: bốn ô chỉ số, phiếu chờ duyệt (duyệt ngay trên
 * thẻ), máy đang dừng, bảo trì quá hạn + kiểm định sắp hết hạn, chi phí 12 tháng,
 * máy hỏng nhiều nhất 6 tháng. Tiền chỉ hiện với người xem được Chi phí — service
 * không gửi số đó cho người khác.
 */
export function HomeOverview({ c }: { c: HomeCtx }) {
  const router = useRouter()
  const { d, flow, openIssue } = c
  const { counts, meta, overview: o } = d
  const waiting = d.issues.filter((i) => i.status === 'cho_duyet')
  // Như demo: quá hạn + kiểm định hết hạn trong 30 ngày, xếp theo hạn. Số trên đầu
  // khối là TỔNG; bảng bày 8 dòng đầu (PlanRows).
  const attention = d.plans.filter(
    (p) => p.state === 'od' || (p.is_inspection && inspectionSoon(p.due.days)),
  )
  const maxMonth = Math.max(1, ...(o.cost?.series.map((s) => s.bd + s.sc) ?? [0]))
  const sum12 = (k: 'bd' | 'sc') => o.cost?.series.reduce((t, s) => t + s[k], 0) ?? 0
  const scShare =
    sum12('bd') + sum12('sc') > 0
      ? Math.round((sum12('sc') / (sum12('bd') + sum12('sc'))) * 100)
      : null
  const openAsset = (code: string) => router.push(`/may-moc/may/${code}`)
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Máy đang dừng"
          value={`${counts.down}`}
          sub={
            o.down.length ? o.down.map((a) => a.name).join(', ') : 'Tất cả máy đang chạy'
          }
          href="/may-moc/may?loc=down"
          tone={counts.down ? 'stop' : undefined}
        />
        <Kpi
          label="Bảo trì quá hạn"
          value={`${counts.overdue}`}
          sub={`${counts.soon} việc đến hạn trong 7 ngày`}
          href="/may-moc/bao-tri"
          tone={counts.overdue ? 'warn' : undefined}
        />
        <Kpi
          label="Báo hỏng chưa xong"
          value={`${d.issues.length}`}
          sub={
            counts.waiting
              ? `${counts.waiting} chờ giám đốc duyệt`
              : 'Không có việc chờ duyệt'
          }
          href="/may-moc/bao-hong"
        />
        {o.cost && (
          <Kpi
            label={`Chi phí bảo trì tháng ${ymTxt(o.cost.month)}`}
            value={shortMoney(o.cost.total)}
            sub={`${vnd(o.cost.total)} đ · tháng trước ${shortMoney(o.cost.prev)}`}
            href="/may-moc/chi-phi"
          />
        )}
      </div>

      {waiting.length > 0 && (
        <section
          className="border-b border-[var(--line)]"
          aria-label="Chờ giám đốc duyệt"
        >
          <SectionHead
            title="Chờ giám đốc duyệt"
            count={waiting.length}
            tone="warn"
            action={
              <span className="text-k-sm font-normal text-[var(--ink-3)]">
                Sửa chữa có dự toán trên {shortMoney(d.approve_over)}
              </span>
            }
          />
          <div className="grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-3">
            {waiting.map((i) => (
              <IssueCard
                key={i.id}
                i={i}
                today={d.today}
                meta={meta}
                onOpen={() => openIssue(i)}
                onAct={(k) => flow.act(i, k)}
                busy={flow.busy}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid md:grid-cols-2">
        <section
          className="min-w-0 border-b border-[var(--line)] md:border-r"
          aria-label="Máy đang dừng"
        >
          <SectionHead
            title="Máy đang dừng"
            count={o.down.length}
            tone="stop"
            action={<Btn href="/may-moc/may?loc=down">Mở Máy móc</Btn>}
          />
          {o.down.length === 0 ? (
            <Quiet>Không có máy nào dừng — mọi máy trên sổ đang chạy.</Quiet>
          ) : (
            <Table label="Máy đang dừng" inline minWidth={0}>
              <THead>
                <th>Máy</th>
                <th>Phiếu đang mở</th>
                <th>Trạng thái</th>
              </THead>
              <tbody>
                {o.down.map((a) => {
                  const s = statusOf('machine', a.status as AssetStatus)
                  return (
                    <Row key={a.id} onClick={() => openAsset(a.code)}>
                      <Cell>
                        <AssetCode code={a.code} />
                        <span className="text-k-label block max-w-[200px] truncate text-[var(--ink-3)]">
                          {a.name}
                          {a.dept_name ? ` · ${a.dept_name}` : ''}
                        </span>
                      </Cell>
                      <Cell
                        grow
                        className="min-w-[120px]"
                        title={
                          a.issue ? `${a.issue.no} · ${a.issue.description}` : undefined
                        }
                      >
                        {a.issue ? (
                          <>
                            <span className="font-mono">{a.issue.no}</span> · báo{' '}
                            <span suppressHydrationWarning>
                              {agoTxt(a.issue.reported_at, new Date())}
                            </span>
                            : {a.issue.description}
                            {a.issue.tech_name && (
                              <span className="text-k-label block truncate text-[var(--ink-3)]">
                                {a.issue.tech_name} đang xử lý
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </Cell>
                      <Cell>
                        <Tag tone={s.tone}>{s.label}</Tag>
                      </Cell>
                    </Row>
                  )
                })}
              </tbody>
            </Table>
          )}
        </section>
        <section
          className="min-w-0 border-b border-[var(--line)]"
          aria-label="Bảo trì quá hạn, kiểm định sắp hết hạn"
        >
          <SectionHead
            title="Bảo trì quá hạn, kiểm định sắp hết hạn"
            count={attention.length}
            tone="warn"
            action={<Btn href="/may-moc/bao-tri">Mở Lịch bảo trì</Btn>}
          />
          {attention.length === 0 ? (
            <Quiet>
              Không có việc quá hạn, không kiểm định nào hết hạn trong 30 ngày.
            </Quiet>
          ) : (
            <PlanRows
              label="Bảo trì quá hạn, kiểm định sắp hết hạn"
              rows={attention}
              limit={8}
            />
          )}
        </section>
      </div>

      <div className="grid md:grid-cols-2">
        {o.cost && (
          <section
            className="min-w-0 border-b border-[var(--line)] md:border-r"
            aria-label="Chi phí bảo trì 12 tháng"
          >
            <SectionHead
              title="Chi phí bảo trì 12 tháng"
              action={
                <span className="flex items-center gap-2">
                  {scShare != null && (
                    <span className="text-k-sm font-normal text-[var(--ink-3)]">
                      Sửa chữa đột xuất chiếm {scShare}%
                    </span>
                  )}
                  <Btn href="/may-moc/chi-phi">Mở Chi phí</Btn>
                </span>
              }
            />
            <div className="px-[var(--gutter)] py-2">
              {o.cost.series.some((s) => s.bd + s.sc > 0) ? (
                <MiniBars
                  label="Chi phí bảo trì 12 tháng"
                  max={maxMonth}
                  series={['Bảo dưỡng, kiểm định', 'Sửa chữa đột xuất']}
                  rows={o.cost.series.map((s) => ({
                    id: s.ym,
                    label: ymTxt(s.ym),
                    value: s.bd,
                    value2: s.sc,
                    text: shortMoney(s.bd + s.sc),
                  }))}
                />
              ) : (
                <span className="text-k-sm text-[var(--ink-3)]">
                  Chưa có chi phí nào trong 12 tháng gần nhất.
                </span>
              )}
            </div>
          </section>
        )}
        <section
          className="min-w-0 border-b border-[var(--line)]"
          aria-label="Máy hỏng nhiều nhất 6 tháng"
        >
          <SectionHead title="Máy hỏng nhiều nhất 6 tháng" count={o.worst.length} />
          {o.worst.length === 0 ? (
            <Quiet>Chưa máy nào phải sửa chữa đột xuất trong 6 tháng qua.</Quiet>
          ) : (
            <Table label="Máy hỏng nhiều nhất 6 tháng" inline minWidth={0}>
              <THead>
                <th>Máy</th>
                <th style={{ textAlign: 'right' }}>Lần hỏng</th>
                <th style={{ textAlign: 'right' }}>Giờ dừng</th>
                {o.cost && <th style={{ textAlign: 'right' }}>Chi phí sửa (đ)</th>}
              </THead>
              <tbody>
                {o.worst.map((w) => (
                  <Row key={w.code} onClick={() => openAsset(w.code)}>
                    <Cell grow title={w.name}>
                      <AssetCode code={w.code} />
                      <span className="text-k-label block truncate text-[var(--ink-3)]">
                        {w.name}
                        {w.dept_name ? ` · ${w.dept_name}` : ''}
                      </span>
                      {/* Như demo: hỏng từ 3 lần / 6 tháng là tín hiệu đại tu hoặc thay. */}
                      {w.n_sc >= 3 && (
                        <span className="text-k-label block text-[var(--stop)]">
                          Nên đại tu hoặc tính thay mới
                        </span>
                      )}
                    </Cell>
                    <Cell num>
                      <span
                        style={
                          w.n_sc >= 3
                            ? { color: 'var(--stop)', fontWeight: 600 }
                            : undefined
                        }
                      >
                        {w.n_sc}
                      </span>
                    </Cell>
                    <Cell num>{w.down.toLocaleString('vi-VN')}</Cell>
                    {o.cost && <Cell num>{w.cost_sc == null ? '' : vnd(w.cost_sc)}</Cell>}
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </div>
  )
}
