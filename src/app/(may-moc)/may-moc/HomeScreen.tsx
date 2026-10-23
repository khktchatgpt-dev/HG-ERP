'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Empty,
  Row,
  ScreenFrame,
  ScreenHeader,
  Table,
  Tag,
  THead,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import { dmy, ISSUE_STATUS, shortMoney, type IssuePriority } from '@/lib/may-moc'
import type {
  AssetsMeta,
  AssetFormOptions,
  PlanView,
} from '@/modules/core/assets/assets.service'
import type { IssueRow } from '@/modules/core/assets/assets.repo'
import { AssetCode, DueText } from './_ui/shared'
import { PlanDoneSheet } from './_ui/asset-dialogs'
import { AcceptSheet, DoneSheet, ReportIssueSheet } from './_ui/issue-dialogs'

type Counts = {
  machines: number
  down: number
  new_issues: number
  waiting: number
  fixing: number
  overdue: number
  soon: number
  inspections: number
  stale_hours: number
}
type HomeIssue = IssueRow & {
  asset: { code: string; name: string; dept_name: string | null } | null
  tech_name: string | null
}
type Dlg =
  null | 'report' | { accept: HomeIssue } | { done: HomeIssue } | { plan: PlanView }

/**
 * VIỆC HÔM NAY (khuôn A · Vào việc) — "Hôm nay Tổ Cơ điện phải làm gì trước?"
 * Mỗi ô đếm bằng ĐÚNG hàm của màn đích (assetsService.home dùng chung planDue /
 * isDown / isOpenIssue với Máy móc, Lịch bảo trì, Báo hỏng). Ô 0 hiện ✓, không tô đỏ.
 */
export function HomeScreen({
  meta,
  today,
  counts,
  issues,
  plans,
  options,
  approveOver,
  assets,
}: {
  meta: AssetsMeta
  today: string
  counts: Counts
  issues: HomeIssue[]
  plans: PlanView[]
  options: AssetFormOptions
  approveOver: number
  assets: { id: string; code: string; name: string }[]
}) {
  const router = useRouter()
  const [dlg, setDlg] = useState<Dlg>(null)
  const ref = (i: HomeIssue) => ({
    id: i.id,
    no: i.no,
    label: i.asset ? `${i.asset.code} ${i.asset.name}` : i.no,
    description: i.description,
    priority: i.priority as IssuePriority,
    vendor: i.vendor,
    estimate: i.estimate,
  })

  if (counts.machines === 0) {
    return (
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Máy móc & bảo trì"
          title="Việc hôm nay"
          facts={[{ label: 'Hôm nay', value: dmy(today) }]}
        />
        <Empty
          level={2}
          headline="Chưa có máy nào trong hệ thống"
          reason="Việc hôm nay đếm trên danh sách máy: báo hỏng, lịch bảo trì, kiểm định. Danh sách đang trống nên chưa có việc gì."
          next={
            meta.can_edit ? (
              <Btn primary icon="excel" href="/may-moc/may?nhap=1">
                Nhập danh sách máy
              </Btn>
            ) : (
              <Btn href="/may-moc/may">Mở danh sách máy</Btn>
            )
          }
        />
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title="Việc hôm nay"
        facts={[
          { label: 'Hôm nay', value: dmy(today) },
          { label: 'Máy', value: `${counts.machines}` },
        ]}
        actions={
          <>
            <Btn primary icon="canhBao" onClick={() => setDlg('report')}>
              Báo hỏng
            </Btn>
            <Btn icon="lich" href="/may-moc/bao-tri">
              Lịch bảo trì
            </Btn>
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-[var(--line)] px-[var(--gutter)] py-2">
          <div className="text-k-label pb-1 font-semibold tracking-wider text-[var(--ink-label)] uppercase">
            Báo hỏng
          </div>
          <WorkTiles>
            <WorkTile
              label="Mới báo, chưa nhận"
              count={counts.new_issues}
              hint="Báo hỏng › Mới báo"
              href="/may-moc/bao-hong?tab=moi"
              tone="stop"
              strong={meta.can_work}
            />
            <WorkTile
              label="Chờ GĐ duyệt"
              count={counts.waiting}
              hint={`dự toán > ${shortMoney(approveOver)}`}
              href="/may-moc/bao-hong?tab=cho_duyet"
              tone="warn"
              strong={meta.can_approve}
            />
            <WorkTile
              label="Đang sửa"
              count={counts.fixing}
              hint="Báo hỏng › Đang sửa"
              href="/may-moc/bao-hong?tab=dang_sua"
            />
            <WorkTile
              label="Máy đang dừng"
              count={counts.down}
              hint="Máy móc › Đang dừng"
              href="/may-moc/may?loc=down"
              tone="stop"
            />
          </WorkTiles>
          <div className="text-k-label pt-2 pb-1 font-semibold tracking-wider text-[var(--ink-label)] uppercase">
            Bảo trì
          </div>
          <WorkTiles>
            <WorkTile
              label="Quá hạn"
              count={counts.overdue}
              hint="Lịch bảo trì › Cần làm"
              href="/may-moc/bao-tri"
              tone="stop"
              strong={meta.can_work}
            />
            <WorkTile
              label="Tới hạn trong 7 ngày"
              count={counts.soon}
              hint="Lịch bảo trì › Cần làm"
              href="/may-moc/bao-tri"
              tone="warn"
            />
            <WorkTile
              label="Kiểm định ≤ 30 ngày"
              count={counts.inspections}
              hint="Lịch bảo trì › Kiểm định"
              href="/may-moc/bao-tri?tab=kd"
              tone="warn"
            />
            <WorkTile
              label="Giờ chạy chưa cập nhật > 14 ngày"
              count={counts.stale_hours}
              hint="máy có đồng hồ giờ — lịch theo giờ đang đoán"
              href="/may-moc/may"
              tone="warn"
            />
          </WorkTiles>
        </div>

        <div className="grid md:grid-cols-2">
          <section
            className="min-w-0 border-b border-[var(--line)] md:border-r"
            aria-label="Báo hỏng chưa xong"
          >
            <div className="text-k-body flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 font-semibold">
              <span>Báo hỏng chưa xong</span>
              <Btn href="/may-moc/bao-hong">Mở Báo hỏng</Btn>
            </div>
            {issues.length === 0 ? (
              <Empty
                headline="Không có máy nào chờ sửa"
                reason="Mọi phiếu báo hỏng đã xong — số 0 ở đây là tin tốt."
                next={<span />}
              />
            ) : (
              <Table label="Báo hỏng chưa xong" inline minWidth={0}>
                <THead>
                  <th>Máy</th>
                  <th>Hiện tượng</th>
                  <th>Trạng thái</th>
                  <th />
                </THead>
                <tbody>
                  {issues.map((i) => (
                    <Row
                      key={i.id}
                      onClick={() => router.push(`/may-moc/bao-hong?id=${i.id}`)}
                    >
                      <Cell>
                        {i.asset && <AssetCode code={i.asset.code} />}
                        <span className="text-k-label block max-w-[180px] truncate text-[var(--ink-3)]">
                          {i.asset?.name}
                          {i.asset?.dept_name ? ` · ${i.asset.dept_name}` : ''}
                        </span>
                      </Cell>
                      {/* Sàn 200px mặc định của cột co giãn làm bảng nửa màn tràn
                          ngang khi sidebar mở (đo 583/533px) — khuất nút Sửa xong. */}
                      <Cell grow title={i.description} className="min-w-[120px]">
                        {i.priority === 'dung_may' && (
                          <>
                            <Tag tone="stop">Dừng máy</Tag>{' '}
                          </>
                        )}
                        {i.description}
                      </Cell>
                      <Cell>
                        <Tag tone={ISSUE_STATUS[i.status].tone}>
                          {ISSUE_STATUS[i.status].label}
                        </Tag>
                        {i.tech_name && (
                          <span className="text-k-label block text-[var(--ink-3)]">
                            {i.tech_name}
                          </span>
                        )}
                      </Cell>
                      <Cell>
                        {/* Chặn cú bấm nổi lên dòng: dòng chuyển sang trang Báo hỏng,
                            nên bấm nút ở đây từng mở hộp rồi trang nhảy đi mất. */}
                        <span className="contents" onClick={(e) => e.stopPropagation()}>
                          {i.status === 'moi' && meta.can_work && (
                            <Btn primary onClick={() => setDlg({ accept: i })}>
                              Nhận việc
                            </Btn>
                          )}
                          {i.status === 'dang_sua' && meta.can_work && (
                            <Btn onClick={() => setDlg({ done: i })}>Sửa xong</Btn>
                          )}
                        </span>
                      </Cell>
                    </Row>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
          <section
            className="min-w-0 border-b border-[var(--line)]"
            aria-label="Bảo trì quá hạn và tới hạn"
          >
            <div className="text-k-body flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 font-semibold">
              <span>Bảo trì quá hạn, 7 ngày tới, kiểm định sắp hết hạn</span>
              <Btn href="/may-moc/bao-tri">Mở Lịch bảo trì</Btn>
            </div>
            {plans.length === 0 ? (
              <Empty
                headline="Không có việc bảo trì gấp"
                reason="Không hạng mục nào quá hạn hay tới hạn trong 7 ngày, không kiểm định nào hết hạn trong 30 ngày."
                next={<span />}
              />
            ) : (
              <Table label="Bảo trì cần làm" inline minWidth={0}>
                <THead>
                  <th>Máy · hạng mục</th>
                  <th>Hạn</th>
                  <th />
                </THead>
                <tbody>
                  {plans.map((p) => (
                    <Row key={p.id}>
                      <Cell grow title={`${p.asset.name} · ${p.task}`}>
                        <AssetCode code={p.asset.code} />{' '}
                        {p.is_inspection && <Tag tone="warn">Kiểm định</Tag>} {p.task}
                        <span className="text-k-label block truncate text-[var(--ink-3)]">
                          {p.asset.name}
                          {p.asset.dept_name ? ` · ${p.asset.dept_name}` : ''}
                        </span>
                      </Cell>
                      <Cell>
                        <DueText due={p.due} />
                      </Cell>
                      <Cell>
                        {meta.can_work && (
                          <Btn
                            primary={p.state === 'od'}
                            onClick={() => setDlg({ plan: p })}
                          >
                            {p.is_inspection ? 'Đã kiểm định' : 'Đã làm'}
                          </Btn>
                        )}
                      </Cell>
                    </Row>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </div>
      </div>
      {dlg === 'report' && (
        <ReportIssueSheet assets={assets} onClose={() => setDlg(null)} />
      )}
      {dlg && typeof dlg === 'object' && 'accept' in dlg && (
        <AcceptSheet
          issue={ref(dlg.accept)}
          techs={options.techs}
          approveOver={approveOver}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg && typeof dlg === 'object' && 'done' in dlg && (
        <DoneSheet issue={ref(dlg.done)} onClose={() => setDlg(null)} />
      )}
      {dlg && typeof dlg === 'object' && 'plan' in dlg && (
        <PlanDoneSheet
          plan={dlg.plan}
          techs={options.techs}
          onClose={() => setDlg(null)}
        />
      )}
    </ScreenFrame>
  )
}
