'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Crumb,
  Empty,
  FactBox,
  FactKv,
  FactSection,
  FilterBar,
  Menu,
  Metric,
  MetricStrip,
  NoticeBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  Table,
  Tag,
  THead,
  Timeline,
} from '@/components/kit'
import {
  dmy,
  everyTxt,
  inBooks,
  ISSUE_STATUS,
  shortMoney,
  statusOf,
  vnd,
  type IssuePriority,
} from '@/lib/may-moc'
import type {
  AssetView,
  AssetsMeta,
  AssetFormOptions,
  HistoryMark,
  PlanView,
  RepairStats,
} from '@/modules/core/assets/assets.service'
import type { IssueRow } from '@/modules/core/assets/assets.repo'
import { DueText, StatusTag, useMutate } from '../../_ui/shared'
import {
  AssetFormSheet,
  HoursSheet,
  PlanDoneSheet,
  PlanFormSheet,
} from '../../_ui/asset-dialogs'
import { DisposeSheet } from '../../_ui/import-dialogs'
import { GiveSheet, RecallSheet } from '../../_ui/tool-dialogs'
import {
  AcceptSheet,
  DoneSheet,
  ReasonSheet,
  ReportIssueSheet,
  type IssueRef,
} from '../../_ui/issue-dialogs'

type Muc = 'bao-tri' | 'lich-su' | 'thong-tin' | 'tem'
type Dlg =
  | null
  | 'report'
  | 'accept'
  | 'done'
  | 'reject'
  | 'hours'
  | 'plan'
  | 'edit'
  | 'dispose'
  | 'give'
  | 'recall'
  | { done: PlanView }

/**
 * HỒ SƠ MÁY (khuôn E · Hồ sơ danh mục) — "Máy này là gì, đang ra sao, đã tốn
 * bao nhiêu?" Không có vòng đời duyệt: chỗ của trạng thái là DẢI HIỆU SUẤT,
 * mỗi ô kèm mẫu số. Phiếu báo hỏng đang mở hiện thành dải cảnh báo kèm việc làm
 * tiếp. Tem QR dán trên máy dẫn thẳng tới trang này.
 */
export function HoSoMayScreen({
  meta,
  asset: a,
  plans,
  stats,
  group,
  issues,
  history,
  options,
  qrSvg,
  approveOver,
  me,
  initialMuc,
  openHours = false,
}: {
  meta: AssetsMeta
  asset: AssetView
  plans: (PlanView & { counts: boolean })[]
  stats: RepairStats
  group: { count: number; sc_12m: number }
  issues: (IssueRow & { tech_name: string | null })[]
  history: HistoryMark[]
  options: AssetFormOptions
  qrSvg: string
  approveOver: number
  me: string
  initialMuc: Muc
  /** `?gio=1` — tới từ "Cập nhật giờ chạy" (quét tem): mở sẵn hộp nhập giờ. */
  openHours?: boolean
}) {
  const router = useRouter()
  const isTool = a.kind === 'tool'
  const [muc, setMuc] = useState<Muc>(
    initialMuc === 'bao-tri' && isTool ? 'thong-tin' : initialMuc,
  )
  const canHours = !isTool && meta.can_work && inBooks(a.status) && a.hours_per_day > 0
  const [dlg, setDlg] = useState<Dlg>(openHours && canHours ? 'hours' : null)
  const [inlineErr, setInlineErr] = useState<string | null>(null)
  const m = useMutate()
  const open = issues.find((i) => i.id === a.open_issue?.id) ?? null
  const label = `${a.code} ${a.name}`
  const ref: IssueRef | null = open
    ? {
        id: open.id,
        no: open.no,
        label,
        description: open.description,
        priority: open.priority as IssuePriority,
        vendor: open.vendor,
        estimate: open.estimate,
      }
    : null
  const live = inBooks(a.status)
  const activePlans = plans.filter((p) => p.counts)

  async function approve() {
    if (!open) return
    const r = await m.run(
      () => m.api(`/api/may-moc/issues/${open.id}/approve`, { method: 'POST' }),
      `Đã duyệt ${open.no} — Cơ điện tiến hành sửa`,
    )
    setInlineErr(r.ok ? null : r.error)
  }

  const primary = (() => {
    if (open?.status === 'moi' && meta.can_work)
      return (
        <Btn primary icon="nhanHang" onClick={() => setDlg('accept')}>
          Nhận việc sửa
        </Btn>
      )
    if (open?.status === 'cho_duyet' && meta.can_approve)
      return (
        <Btn primary icon="duyet" busy={m.busy} onClick={() => void approve()}>
          Duyệt {shortMoney(open.estimate ?? 0)}
        </Btn>
      )
    if (open?.status === 'dang_sua' && meta.can_work)
      return (
        <Btn primary icon="xong" onClick={() => setDlg('done')}>
          Sửa xong
        </Btn>
      )
    if (!open && live)
      return (
        <Btn primary={!meta.can_work} icon="canhBao" onClick={() => setDlg('report')}>
          Báo hỏng
        </Btn>
      )
    return null
  })()

  const menu = [
    ...(meta.can_edit && live
      ? [{ label: 'Sửa thông tin máy', onClick: () => setDlg('edit') }]
      : []),
    ...(open?.status === 'cho_duyet' && meta.can_approve
      ? [{ label: 'Không duyệt dự toán', onClick: () => setDlg('reject') }]
      : []),
    ...(open?.status === 'moi' && (open.reporter_user_id === me || meta.can_work)
      ? [{ label: 'Huỷ phiếu báo hỏng', onClick: () => setDlg('reject') }]
      : []),
    ...(meta.can_edit && live && !open
      ? [{ label: 'Báo mất / thanh lý', danger: true, onClick: () => setDlg('dispose') }]
      : []),
  ]

  return (
    <ScreenFrame>
      <Crumb
        path={[
          'Máy móc & bảo trì',
          { label: isTool ? 'Dụng cụ' : 'Máy móc', href: '/may-moc/may' },
          a.code,
        ]}
      />
      <ScreenHeader
        compact
        eyebrow={a.group_name}
        title={
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="num">{a.code}</span>
            <span>{a.name}</span>
          </span>
        }
        status={<StatusTag kind={a.kind} status={a.status} />}
        facts={[
          {
            label: 'Đặt tại',
            value: a.dept_name ?? 'chưa gán',
            tone: a.dept_name ? undefined : 'warn',
          },
          isTool
            ? {
                label: 'Người giữ',
                value: a.holder
                  ? `${a.holder.name}${a.holder.left_on != null ? ' (đã nghỉ)' : ''}`
                  : 'trong kho',
                tone: a.holder?.left_on != null ? 'stop' : undefined,
              }
            : { label: 'Phụ trách', value: a.resp_name ?? 'chưa giao' },
          ...(a.hours_per_day ? [{ label: 'Giờ chạy', value: `${vnd(a.hours)} h` }] : []),
        ]}
        actions={
          <>
            {primary}
            {isTool && meta.can_tools && live && a.holder && (
              <Btn icon="nhapKho" onClick={() => setDlg('recall')}>
                Thu hồi
              </Btn>
            )}
            {isTool &&
              meta.can_tools &&
              live &&
              !a.holder &&
              a.status === 'chua_dung' && (
                <Btn primary icon="xuatKho" onClick={() => setDlg('give')}>
                  Giao cho nhân viên
                </Btn>
              )}
            {canHours && (
              <Btn icon="gioChay" onClick={() => setDlg('hours')}>
                Cập nhật giờ chạy
              </Btn>
            )}
            {!isTool && meta.can_work && live && (
              <Btn icon="them" onClick={() => setDlg('plan')}>
                Thêm hạng mục
              </Btn>
            )}
            {menu.length > 0 && <Menu items={menu} />}
          </>
        }
      />
      {open && (
        <NoticeBar
          tone={
            open.status === 'moi'
              ? 'stop'
              : open.status === 'cho_duyet'
                ? 'warn'
                : 'neutral'
          }
          tag={`${open.no} · ${ISSUE_STATUS[open.status].label}`}
          action={{
            label: 'Mở phiếu',
            onClick: () => router.push(`/may-moc/bao-hong?id=${open.id}`),
          }}
        >
          {open.description}
          {open.tech_name
            ? ` · ${open.tech_name} đang xử lý`
            : open.vendor
              ? ` · thuê ${open.vendor}`
              : ''}
          {open.estimate ? ` · dự toán ${vnd(open.estimate)} đ` : ''}
        </NoticeBar>
      )}
      {inlineErr && (
        <NoticeBar tone="stop" tag="Chưa duyệt được">
          {inlineErr}
        </NoticeBar>
      )}

      {!isTool && (
        <MetricStrip>
          <Metric
            label="Bảo dưỡng 12 tháng"
            value={`${stats.nBD + stats.nKD}`}
            basis={`${stats.nBD} bảo dưỡng · ${stats.nKD} kiểm định`}
          />
          <Metric
            label="Lần hỏng 12 tháng"
            value={`${stats.nSC}`}
            tone={stats.nSC >= 3 ? 'stop' : stats.nSC > 0 ? 'warn' : undefined}
            basis={
              group.count > 1
                ? `nhóm ${group.count} máy: ${group.sc_12m} lần, TB ${(group.sc_12m / group.count).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}`
                : 'máy duy nhất trong nhóm'
            }
          />
          <Metric
            label="Giờ dừng máy"
            value={`${stats.down.toLocaleString('vi-VN')} h`}
            basis="cộng từ phiếu sửa + bảo dưỡng 12 tháng"
          />
          <Metric
            label="Chi phí 12 tháng"
            value={shortMoney(stats.cost)}
            basis={`sửa ${shortMoney(stats.costSC)} + bảo dưỡng ${shortMoney(stats.cost - stats.costSC)}${a.cost ? ` · giá mua ${shortMoney(a.cost)}` : ''}`}
          />
        </MetricStrip>
      )}

      <FilterBar dense label="Mục hồ sơ">
        {!isTool && (
          <Chip
            icon="lich"
            on={muc === 'bao-tri'}
            count={activePlans.length}
            onClick={() => setMuc('bao-tri')}
          >
            Bảo trì
          </Chip>
        )}
        <Chip
          icon="lichSu"
          on={muc === 'lich-su'}
          count={history.length}
          onClick={() => setMuc('lich-su')}
        >
          Lịch sử
        </Chip>
        <Chip
          icon="thongTin"
          on={muc === 'thong-tin'}
          onClick={() => setMuc('thong-tin')}
        >
          Thông tin
        </Chip>
        <Chip icon="in" on={muc === 'tem'} onClick={() => setMuc('tem')}>
          Tem QR
        </Chip>
      </FilterBar>

      <div className="min-h-0 flex-1 overflow-auto">
        {muc === 'bao-tri' &&
          (plans.length === 0 ? (
            <Empty
              level={2}
              headline="Máy chưa có lịch bảo trì"
              reason={
                a.status === 'chua_dung'
                  ? 'Máy chưa sử dụng nên chưa tính lịch.'
                  : 'Nhóm máy này không có lịch mẫu, hoặc lịch mẫu đã bỏ lúc thêm máy.'
              }
              next={
                meta.can_work && live ? (
                  <Btn icon="them" primary onClick={() => setDlg('plan')}>
                    Thêm hạng mục
                  </Btn>
                ) : (
                  <span className="text-k-sm text-[var(--ink-3)]">
                    Tổ Cơ điện thêm hạng mục.
                  </span>
                )
              }
            />
          ) : (
            <Table label="Lịch bảo trì của máy" inline>
              <THead>
                <th>Hạng mục</th>
                <th>Chu kỳ</th>
                <th>Lần trước</th>
                <th>Hạn</th>
                <th style={{ textAlign: 'right' }}>Chi phí dự kiến</th>
                <th />
              </THead>
              <tbody>
                {plans.map((p) => (
                  <Row key={p.id}>
                    <Cell grow>
                      {p.is_inspection && (
                        <>
                          <Tag tone="warn">Kiểm định</Tag>{' '}
                        </>
                      )}
                      {p.task}
                    </Cell>
                    <Cell muted>{everyTxt(p.every_n, p.unit)}</Cell>
                    <Cell num>
                      {dmy(p.last_date)}
                      {p.unit === 'h' && p.last_hours != null
                        ? ` · ${vnd(p.last_hours)} h`
                        : ''}
                    </Cell>
                    <Cell>
                      {p.counts ? (
                        <DueText due={p.due} />
                      ) : (
                        <span className="text-[var(--ink-empty)]">
                          {p.active
                            ? `máy ${statusOf(a.kind, a.status).label.toLowerCase()}`
                            : 'tạm dừng'}
                        </span>
                      )}
                    </Cell>
                    <Cell num>{p.cost ? vnd(p.cost) : ''}</Cell>
                    <Cell>
                      {p.counts && meta.can_work && (
                        <Btn
                          primary={p.state !== 'ok'}
                          icon="tick"
                          onClick={() => setDlg({ done: p })}
                        >
                          {p.is_inspection ? 'Đã kiểm định' : 'Đã làm'}
                        </Btn>
                      )}
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          ))}

        {muc === 'lich-su' &&
          (history.length === 0 ? (
            <Empty
              level={2}
              headline="Chưa có lịch sử"
              reason="Máy mới thêm, chưa có lần bảo trì, báo hỏng hay giao nhận nào."
              next={<span />}
            />
          ) : (
            <div className="px-[var(--gutter)] py-3">
              <Timeline marks={history} />
            </div>
          ))}

        {muc === 'thong-tin' && (
          <div className="max-w-[720px] px-[var(--gutter)] py-3">
            <FactBox label="Thông tin máy">
              <FactSection title="Nhận diện">
                <FactKv
                  rows={[
                    ['Mã tem', a.code],
                    ['Nhóm', a.group_name],
                    ['Model / hãng', a.model || '—'],
                    ['Số serial', a.serial || '—'],
                    ['Nhà cung cấp', a.supplier || '—'],
                  ]}
                />
              </FactSection>
              <FactSection title="Sử dụng">
                <FactKv
                  rows={[
                    ['Đặt tại', a.dept_name ?? 'chưa gán'],
                    [
                      isTool ? 'Người giữ' : 'Người phụ trách',
                      isTool
                        ? a.holder
                          ? `${a.holder.name}${a.holder.left_on != null ? ` — đã nghỉ việc${a.holder.left_on ? ` từ ${dmy(a.holder.left_on)}` : ''}, cần thu hồi` : ''}`
                          : 'trong kho'
                        : (a.resp_name ?? 'chưa giao'),
                    ],
                    ['Ngày đưa vào dùng', dmy(a.use_date)],
                    ['Giá mua', a.cost ? `${vnd(a.cost)} đ` : '—'],
                    ...(a.hours_per_day
                      ? ([
                          [
                            'Giờ chạy',
                            `${vnd(a.hours)} giờ · khoảng ${a.hours_per_day} giờ/ngày · cập nhật ${dmy(a.hours_updated_on)}`,
                          ],
                        ] as [string, string][])
                      : []),
                  ]}
                />
              </FactSection>
              {a.note && (
                <FactSection title="Ghi chú">
                  <FactKv prose rows={[['', a.note]]} />
                </FactSection>
              )}
            </FactBox>
          </div>
        )}

        {muc === 'tem' && (
          <div className="flex flex-wrap items-start gap-6 px-[var(--gutter)] py-4">
            <div
              className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3"
              style={{ width: 360 }}
            >
              <div
                className="h-[112px] w-[112px]"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="min-w-0">
                <div className="text-k-label tracking-wider text-[var(--ink-3)] uppercase">
                  Hoàng Gia · Cơ điện
                </div>
                <div className="text-k-lg font-mono font-semibold">{a.code}</div>
                <div className="text-k-sm">{a.name}</div>
                <div className="text-k-label text-[var(--ink-3)]">
                  {a.dept_name ?? ''}
                </div>
              </div>
            </div>
            <div className="text-k-sm grid max-w-[420px] gap-2 text-[var(--ink-2)]">
              <p>
                QR chứa đường dẫn tới hồ sơ máy này. Quét bằng camera điện thoại là mở
                được (cần đăng nhập), rồi báo hỏng hoặc ghi bảo trì ngay tại máy.
              </p>
              <p>
                Khổ tem 50 × 30 mm cho máy in tem nhiệt. In nhiều tem một lượt ở trang In
                tem QR.
              </p>
              <div>
                <Btn
                  icon="in"
                  primary
                  href={`/may-moc/tem?ma=${encodeURIComponent(a.code)}`}
                >
                  Mở trang in tem
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {dlg === 'report' && (
        <ReportIssueSheet
          assets={[{ id: a.id, code: a.code, name: a.name }]}
          assetId={a.id}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg === 'accept' && ref && (
        <AcceptSheet
          issue={ref}
          techs={options.techs}
          approveOver={approveOver}
          me={meta.employee_id}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg === 'done' && ref && <DoneSheet issue={ref} onClose={() => setDlg(null)} />}
      {dlg === 'reject' &&
        ref &&
        open &&
        (open.status === 'cho_duyet' ? (
          <ReasonSheet
            title={`Không duyệt ${open.no}`}
            subtitle={`${label} · dự toán ${vnd(open.estimate ?? 0)} đ`}
            consequence="Phiếu trả về Tổ Cơ điện ở trạng thái Mới báo, dự toán bị xoá. Cơ điện đọc lý do để làm phương án khác."
            confirmLabel="Gửi lại Cơ điện"
            url={`/api/may-moc/issues/${open.id}/reject`}
            okText={`${open.no} đã trả lại Cơ điện`}
            placeholder="VD: chỉ thay cảm biến trước, theo dõi thêm 1 tháng"
            onClose={() => setDlg(null)}
          />
        ) : (
          <ReasonSheet
            title={`Huỷ ${open.no}`}
            subtitle={label}
            consequence="Phiếu chuyển sang Đã huỷ (không xoá). Máy về trạng thái trước khi báo."
            confirmLabel="Huỷ phiếu"
            url={`/api/may-moc/issues/${open.id}/cancel`}
            okText={`Đã huỷ ${open.no}`}
            placeholder="VD: báo nhầm máy, máy đã chạy lại bình thường"
            onClose={() => setDlg(null)}
          />
        ))}
      {dlg === 'hours' && (
        <HoursSheet
          asset={a}
          onClose={() => {
            setDlg(null)
            // Bỏ `?gio=1` để tải lại trang không bật hộp lần nữa.
            if (openHours) router.replace(`/may-moc/may/${encodeURIComponent(a.code)}`)
          }}
        />
      )}
      {dlg === 'give' && (
        <GiveSheet
          store={[{ id: a.id, code: a.code, name: a.name }]}
          employees={options.employees}
          preselect={[a.id]}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg === 'recall' && a.holder && (
        <RecallSheet
          held={[
            {
              id: a.id,
              code: a.code,
              name: a.name,
              holder_id: a.holder.id,
              holder_name: a.holder.name,
              holder_left_on: a.holder.left_on,
            },
          ]}
          holderId={a.holder.id}
          preselect={[a.id]}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg === 'plan' && <PlanFormSheet asset={a} onClose={() => setDlg(null)} />}
      {dlg === 'edit' && (
        <AssetFormSheet options={options} asset={a} onClose={() => setDlg(null)} />
      )}
      {dlg === 'dispose' && <DisposeSheet asset={a} onClose={() => setDlg(null)} />}
      {dlg && typeof dlg === 'object' && (
        <PlanDoneSheet
          plan={{ ...dlg.done, asset: { ...dlg.done.asset } }}
          techs={options.techs}
          me={meta.employee_id}
          onClose={() => setDlg(null)}
        />
      )}
    </ScreenFrame>
  )
}
