'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Empty,
  FilterBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  Sheet,
  StatusTrack,
  TFoot,
  THead,
  Table,
  Tag,
  Timeline,
  type TrackTone,
} from '@/components/kit'
import { FeedbackImages } from '@/components/feedback/FeedbackImages'
import { TZ_VN, todayVn } from '@/lib/date-vn'
import {
  canIssue,
  dmy,
  ISSUE_STATUS,
  isOpenIssue,
  PRIORITY_LABEL,
  shortMoney,
  vnd,
  type IssuePriority,
  type IssueStatus,
} from '@/lib/may-moc'
import type { AssetsMeta } from '@/modules/core/assets/assets.service'
import type { IssueRow } from '@/modules/core/assets/assets.repo'
import { AssetCode, useMutate } from '../_ui/shared'
import {
  AcceptSheet,
  DoneSheet,
  ReasonSheet,
  ReportIssueSheet,
  type IssueRef,
} from '../_ui/issue-dialogs'

export type IssueItem = IssueRow & {
  asset: {
    id: string
    code: string
    name: string
    department_id: string | null
    status: string
  } | null
  reporter_name: string | null
  tech_name: string | null
}
type Tab = 'open' | IssueStatus
type Dlg = null | 'report' | 'accept' | 'done' | 'reject' | 'cancel'

const STEPS = ['Mới báo', 'Chờ GĐ duyệt', 'Đang sửa', 'Đã xong']
const stepAt = (s: IssueStatus) =>
  s === 'moi' ? 0 : s === 'cho_duyet' ? 1 : s === 'dang_sua' ? 2 : s === 'xong' ? 4 : -1
const stepTone = (s: IssueStatus): TrackTone =>
  s === 'moi'
    ? 'stop'
    : s === 'cho_duyet'
      ? 'wait'
      : s === 'dang_sua'
        ? 'run'
        : s === 'xong'
          ? 'done'
          : 'idle'
/** Giờ báo theo GIỜ VIỆT NAM — `reported_at` là ISO UTC, cắt chuỗi là lệch 7 tiếng. */
const ago = (iso: string, today: string) => {
  const t = new Date(iso)
  const d = todayVn(t)
  const hm = t.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ_VN,
  })
  return d === today ? `${hm} hôm nay` : `${hm} ${dmy(d)}`
}

/**
 * BÁO HỎNG (khuôn C) — "Máy nào đang chờ sửa, ai đang giữ phiếu?" Lưới theo
 * trạng thái thay bảng kanban 4 cột của bản demo: lưới bày được số tiền và thời
 * gian chờ cạnh nhau. Bấm dòng mở chi tiết phiếu (đời phiếu + việc làm tiếp).
 * Mở từ chuông thông báo: `?id=` mở sẵn phiếu đó. Ô ở Việc hôm nay mở đúng thẻ
 * qua `?tab=` — con số trên ô phải bằng số trên chip người ta thấy khi tới nơi.
 */
export function BaoHongScreen({
  meta,
  me,
  today,
  approveOver,
  issues,
  assets,
  techs,
  initialId,
  initialTab = 'open',
}: {
  meta: AssetsMeta
  me: string
  today: string
  approveOver: number
  issues: IssueItem[]
  assets: { id: string; code: string; name: string }[]
  techs: { id: string; name: string }[]
  initialId: string | null
  initialTab?: Tab
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [openId, setOpenId] = useState<string | null>(initialId)
  const [dlg, setDlg] = useState<Dlg>(null)
  const m = useMutate()
  const count = (t: Tab) =>
    issues.filter((i) => (t === 'open' ? isOpenIssue(i.status) : i.status === t)).length
  const rows = issues.filter((i) =>
    tab === 'open' ? isOpenIssue(i.status) : i.status === tab,
  )
  const cur = issues.find((i) => i.id === openId) ?? null
  const label = (i: IssueItem) =>
    i.asset ? `${i.asset.code} ${i.asset.name}` : '(máy đã xoá)'
  const ref = (i: IssueItem): IssueRef => ({
    id: i.id,
    no: i.no,
    label: label(i),
    description: i.description,
    priority: i.priority as IssuePriority,
    vendor: i.vendor,
    estimate: i.estimate,
  })
  const pick = (id: string | null) => {
    setOpenId(id)
    router.replace(id ? `/may-moc/bao-hong?id=${id}` : '/may-moc/bao-hong', {
      scroll: false,
    })
  }
  const act = (d: Dlg) => setDlg(d)
  return (
    <ScreenFrame tableMin={1080}>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title="Báo hỏng"
        facts={[
          {
            label: 'Chưa xong',
            value: `${count('open')}`,
            tone: count('moi') ? 'stop' : undefined,
          },
          {
            label: 'Chờ GĐ duyệt',
            value: `${count('cho_duyet')}`,
            tone: count('cho_duyet') ? 'warn' : undefined,
          },
          { label: 'Hạn mức GĐ duyệt', value: `${vnd(approveOver)} đ` },
        ]}
        actions={
          <Btn
            primary
            icon="canhBao"
            onClick={() => setDlg('report')}
            disabled={assets.length === 0}
          >
            Báo hỏng
          </Btn>
        }
      />
      <FilterBar dense label="Lọc phiếu">
        <Chip on={tab === 'open'} count={count('open')} onClick={() => setTab('open')}>
          Chưa xong
        </Chip>
        {(['moi', 'cho_duyet', 'dang_sua', 'xong', 'huy'] as const).map((s) => (
          <Chip key={s} on={tab === s} count={count(s)} onClick={() => setTab(s)}>
            {ISSUE_STATUS[s].label}
          </Chip>
        ))}
        <span className="text-k-label ml-auto text-[var(--ink-3)]">
          Ai thấy máy hỏng cũng báo được · phiếu đã xong / huỷ giữ 60 ngày ở đây, cũ hơn
          xem ở hồ sơ máy
        </span>
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          headline={
            issues.length === 0
              ? 'Chưa có phiếu báo hỏng nào'
              : tab === 'open'
                ? 'Không có máy nào đang chờ sửa'
                : 'Không có phiếu nào ở thẻ này'
          }
          reason={
            tab === 'open'
              ? 'Mọi phiếu đã xong hoặc chưa ai báo hỏng — số 0 ở đây là tin tốt.'
              : 'Thẻ này đang trống trong 60 ngày gần đây.'
          }
          next={
            <Btn
              icon="canhBao"
              onClick={() => setDlg('report')}
              disabled={assets.length === 0}
            >
              Báo hỏng
            </Btn>
          }
        />
      ) : (
        <Table label="Phiếu báo hỏng">
          <THead pinFirst>
            <th>Số</th>
            <th>Máy</th>
            <th>Hiện tượng</th>
            <th>Mức</th>
            <th>Báo lúc · người báo</th>
            <th>Đang giữ</th>
            <th style={{ textAlign: 'right' }}>Dự toán</th>
            <th>Trạng thái</th>
          </THead>
          <tbody>
            {rows.map((i) => (
              <Row key={i.id} selected={i.id === openId} onClick={() => pick(i.id)}>
                <Cell pin rowHeader>
                  <span className="font-mono">{i.no}</span>
                </Cell>
                <Cell>
                  {i.asset ? <AssetCode code={i.asset.code} /> : '—'}
                  <span className="text-k-label block max-w-[220px] truncate text-[var(--ink-3)]">
                    {i.asset?.name}
                  </span>
                </Cell>
                <Cell grow title={i.description}>
                  {i.description}
                </Cell>
                <Cell>
                  {i.priority === 'dung_may' ? (
                    <Tag tone="stop">Dừng máy</Tag>
                  ) : (
                    <Tag tone="warn">Vẫn chạy</Tag>
                  )}
                </Cell>
                <Cell>
                  <span className="text-k-sm font-mono">{ago(i.reported_at, today)}</span>
                  <span className="text-k-label block text-[var(--ink-3)]">
                    {i.reporter_name ?? ''}
                  </span>
                </Cell>
                <Cell muted>
                  {i.status === 'moi'
                    ? 'Tổ Cơ điện'
                    : i.status === 'cho_duyet'
                      ? 'Ban Giám đốc'
                      : i.status === 'dang_sua'
                        ? (i.tech_name ?? i.vendor ?? '')
                        : ''}
                </Cell>
                <Cell num>{i.estimate ? vnd(i.estimate) : ''}</Cell>
                <Cell>
                  <Tag tone={ISSUE_STATUS[i.status].tone}>
                    {ISSUE_STATUS[i.status].label}
                  </Tag>
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={6}>Cộng {rows.length} phiếu</td>}
            cells={
              <td className="num">
                {vnd(rows.reduce((s, i) => s + (i.estimate ?? 0), 0))}
              </td>
            }
            caveatSpan={1}
            caveat="dự toán, chưa phải chi phí"
          />
        </Table>
      )}

      {cur && !dlg && (
        <Sheet
          open
          onClose={() => pick(null)}
          width={640}
          title={`${cur.no} · ${label(cur)}`}
          subtitle={`${PRIORITY_LABEL[cur.priority as IssuePriority]} · báo ${ago(cur.reported_at, today)}${cur.reporter_name ? ` bởi ${cur.reporter_name}` : ''}`}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              {canIssue('cancel', cur.status) &&
                (cur.reporter_user_id === me || meta.can_work) && (
                  <Btn onClick={() => act('cancel')}>Huỷ phiếu</Btn>
                )}
              {canIssue('reject', cur.status) && meta.can_approve && (
                <Btn onClick={() => act('reject')}>Không duyệt</Btn>
              )}
              {canIssue('approve', cur.status) && meta.can_approve && (
                <Btn
                  primary
                  icon="duyet"
                  busy={m.busy}
                  onClick={() =>
                    void m.run(
                      () =>
                        m.api(`/api/may-moc/issues/${cur.id}/approve`, {
                          method: 'POST',
                        }),
                      `Đã duyệt ${cur.no} — Cơ điện tiến hành sửa`,
                    )
                  }
                >
                  Duyệt {shortMoney(cur.estimate ?? 0)}
                </Btn>
              )}
              {canIssue('accept', cur.status) &&
                (meta.can_work ? (
                  <Btn primary icon="nhanHang" onClick={() => act('accept')}>
                    Nhận việc
                  </Btn>
                ) : (
                  <Btn blockedBy="Tổ Cơ điện">Nhận việc</Btn>
                ))}
              {canIssue('done', cur.status) &&
                (meta.can_work ? (
                  <Btn primary icon="xong" onClick={() => act('done')}>
                    Sửa xong
                  </Btn>
                ) : (
                  <Btn blockedBy="Tổ Cơ điện">Sửa xong</Btn>
                ))}
              {cur.status === 'cho_duyet' && !meta.can_approve && (
                <Btn blockedBy="Ban Giám đốc">Duyệt</Btn>
              )}
              {cur.asset && (
                <Btn href={`/may-moc/may/${encodeURIComponent(cur.asset.code)}`}>
                  Mở hồ sơ máy
                </Btn>
              )}
            </div>
          }
        >
          <div className="grid gap-3">
            <StatusTrack
              label="Trạng thái phiếu"
              steps={STEPS}
              at={stepAt(cur.status as IssueStatus)}
              tone={stepTone(cur.status as IssueStatus)}
              terminal={cur.status === 'huy' ? 'Đã huỷ' : undefined}
            />
            <p className="text-k-body">{cur.description}</p>
            {cur.file_ids.length > 0 && <FeedbackImages ids={cur.file_ids} />}
            <dl className="text-k-sm grid grid-cols-[140px_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt className="text-[var(--ink-3)]">Người sửa</dt>
              <dd>{cur.tech_name ?? (cur.vendor ? `Thuê ngoài: ${cur.vendor}` : '—')}</dd>
              <dt className="text-[var(--ink-3)]">Dự toán</dt>
              <dd className="font-mono">
                {cur.estimate ? `${vnd(cur.estimate)} đ` : '—'}
              </dd>
              {cur.cancel_reason && (
                <>
                  <dt className="text-[var(--ink-3)]">Lý do huỷ</dt>
                  <dd>{cur.cancel_reason}</dd>
                </>
              )}
            </dl>
            <Timeline
              marks={[
                {
                  key: 'r',
                  at: cur.reported_at,
                  label: 'Báo hỏng',
                  actor: cur.reporter_name,
                  detail: cur.description,
                  tone: 'stop' as const,
                },
                ...cur.log.map((l, k) => ({
                  key: `l${k}`,
                  at: l.at,
                  label: l.text,
                  actor: l.name,
                  tone: 'act' as const,
                })),
              ]}
            />
          </div>
        </Sheet>
      )}

      {dlg === 'report' && (
        <ReportIssueSheet assets={assets} onClose={() => setDlg(null)} />
      )}
      {cur && dlg === 'accept' && (
        <AcceptSheet
          issue={ref(cur)}
          techs={techs}
          approveOver={approveOver}
          onClose={() => setDlg(null)}
        />
      )}
      {cur && dlg === 'done' && (
        <DoneSheet issue={ref(cur)} onClose={() => setDlg(null)} />
      )}
      {cur && dlg === 'reject' && (
        <ReasonSheet
          title={`Không duyệt ${cur.no}`}
          subtitle={`${label(cur)} · dự toán ${vnd(cur.estimate ?? 0)} đ`}
          consequence="Phiếu trả về Tổ Cơ điện ở trạng thái Mới báo, dự toán bị xoá. Cơ điện đọc lý do để làm phương án khác."
          confirmLabel="Gửi lại Cơ điện"
          url={`/api/may-moc/issues/${cur.id}/reject`}
          okText={`${cur.no} đã trả lại Cơ điện`}
          placeholder="VD: chỉ thay cảm biến trước, theo dõi thêm 1 tháng"
          onClose={() => setDlg(null)}
        />
      )}
      {cur && dlg === 'cancel' && (
        <ReasonSheet
          title={`Huỷ ${cur.no}`}
          subtitle={label(cur)}
          consequence="Phiếu chuyển sang Đã huỷ (không xoá). Máy về trạng thái trước khi báo."
          confirmLabel="Huỷ phiếu"
          url={`/api/may-moc/issues/${cur.id}/cancel`}
          okText={`Đã huỷ ${cur.no}`}
          placeholder="VD: báo nhầm máy, máy đã chạy lại bình thường"
          onClose={() => setDlg(null)}
        />
      )}
    </ScreenFrame>
  )
}
