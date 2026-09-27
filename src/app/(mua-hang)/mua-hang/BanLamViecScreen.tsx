'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  Empty,
  NoticeBar,
  Num,
  Row,
  ScopeSwitch,
  ScreenHeader,
  THead,
  Table,
  Tag,
  WorkLanes,
  WorkTile,
  WorkTiles,
  type Lane,
} from '@/components/kit'
import { MEETING_LEVEL, type MeetingRiskLevel } from '@/lib/supply-meeting'
import { SUPPLY_TODO, type SupplyTodoKind } from '@/lib/supply-watch'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'

/**
 * Phần nhìn của Bàn làm việc. Ba tầng theo Dynamics workspace: ô số → danh
 * sách theo tab → liên kết. Mọi số đã đếm xong ở server (hai bàn "của tôi" /
 * "cả phòng"); công tắc phạm vi chỉ CHỌN bàn, không tính lại gì.
 */

export type Todo = {
  id: string
  code: string
  kind: SupplyTodoKind
  action: string
  supplier: string
  lsx: string | null
  /** Người phụ trách đơn — cột hiện khi xem cả phòng. */
  owner: string
  expected_at: string | null
  total: number
  currency: string
}
export type Issue = {
  id: string
  code: string
  customer: string
  level: MeetingRiskLevel
  label: string
  reason: string
  owner: string
  due: string | null
  poCount: number
}
export type Agenda = {
  dept: string
  action: string
  codes: string[]
  due: string | null
  rank: number
}
/** Một bàn làm việc đã đếm sẵn — cho một phạm vi. */
export type Desk = {
  counts: Record<SupplyTodoKind, number>
  todos: Todo[]
  incomingSoon: number
  openTotal: number
  riskCounts: Record<MeetingRiskLevel, number>
  issues: Issue[]
  lsxCount: number
  /** Đơn còn mở của lệnh đã hoàn thành (lib/po-lsx-done) — kể cả nháp. */
  lsxDone: number
}
export type PendingRow = {
  id: string
  code: string
  owner: string
  supplier: string
  lsx: string | null
  total: number
  currency: string
  /** Ngày đơn vào hàng chờ (lần cập nhật cuối) — yyyy-mm-dd. */
  since: string
}
export type BuyerRow = {
  id: string
  name: string
  open: number
  todo: number
  pending: number
  unconfirmed: number
  noEta: number
  overdue: number
  incomingSoon: number
  lsx: number
}

const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  stop: 'stop',
  warn: 'warn',
  primary: 'neutral',
  muted: 'neutral',
  done: 'done',
}
const dmy = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''
const money = (n: number, cur: string) =>
  n > 0 ? `${n.toLocaleString('vi-VN')} ${cur}` : ''
const daysSince = (iso: string, today: string) =>
  Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / 86_400_000))

/** Thứ tự đọc trong họp — cố định, không theo chữ cái. */
const DEPT_ORDER = ['Sản xuất', 'Giám đốc', 'Cung ứng', 'Nhà cung cấp', 'Kho']
/** Đơn chờ duyệt quá bấy nhiêu ngày thì tô vàng — cùng mốc "nằm im" của HolderBar. */
const PENDING_WARN_DAYS = 3

export function BanLamViecScreen({
  today,
  meId,
  userName,
  viewAs,
  defaultScope,
  urlScope,
  desks,
  approver,
  agenda,
  truncatedAt,
}: {
  today: string
  meId: string
  userName: string
  /** Người duyệt đang xem bàn của một người mua (`?nguoi=`) — chỉ xem. */
  viewAs: { id: string; name: string } | null
  defaultScope: SupplyScope
  urlScope: SupplyScope | null
  desks: Record<SupplyScope, Desk>
  /** Chỉ có với người có quyền duyệt đơn mua. */
  approver: { pending: PendingRow[]; buyers: BuyerRow[] } | null
  agenda: Agenda[]
  truncatedAt: number | null
}) {
  const [scopePref, setScope] = useScopePref('ban', meId, defaultScope, urlScope)
  // Đang xem bàn người khác thì cố định "của người đó" — công tắc không có nghĩa.
  const scope: SupplyScope = viewAs ? 'toi' : scopePref
  const d = desks[scope]
  const mine = scope === 'toi'
  const who = viewAs ? viewAs.name : 'tôi'
  const todoTotal = Object.values(d.counts).reduce((s, n) => s + n, 0)
  const stopWarn = d.riskCounts.stop + d.riskCounts.warn
  const pendingWarn = (approver?.pending ?? []).filter((p) => daysSince(p.since, today) > PENDING_WARN_DAYS).length // prettier-ignore
  const q = `pham_vi=${scope}`

  // Tab = các câu hỏi khác nhau, cùng một trang. Số trên tab = số dòng trong tab.
  const lanes: Lane<unknown>[] = [
    ...(approver
      ? [
          { id: 'duyet', label: 'Chờ tôi duyệt', rows: approver.pending, tone: pendingWarn > 0 ? ('warn' as const) : undefined }, // prettier-ignore
          {
            id: 'nguoi',
            label: 'Theo người mua',
            rows: approver.buyers,
            tone: undefined,
          },
        ]
      : []),
    { id: 'toi', label: mine ? (viewAs ? `Việc chờ ${who}` : 'Việc chờ tôi') : 'Việc cả phòng', rows: d.todos, tone: undefined }, // prettier-ignore
    { id: 'lenh', label: mine ? `Lệnh của ${who} có nguy cơ` : 'Lệnh có nguy cơ', rows: d.issues, tone: d.riskCounts.stop > 0 ? ('stop' as const) : undefined }, // prettier-ignore
    { id: 'hop', label: 'Cần quyết trong họp', rows: agenda, tone: undefined },
  ]
  const [tab, setTab] = useState(() => lanes.find((l) => l.rows.length > 0)?.id ?? 'toi')

  const agendaSorted = [...agenda].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.dept),
      db = DEPT_ORDER.indexOf(b.dept)
    if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db)
    return a.rank - b.rank
  })
  const TODO_CAP = 20

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        compact
        eyebrow={
          viewAs ? `Mua hàng · đang xem bàn của ${viewAs.name}` : `Mua hàng · ${userName}`
        }
        title="Bàn làm việc"
        facts={[
          { label: 'Hôm nay', value: dmy(today) },
          ...(approver ? [{ label: 'Chờ tôi duyệt', value: String(approver.pending.length), tone: approver.pending.length > 0 ? ('warn' as const) : undefined }] : []), // prettier-ignore
          { label: mine ? `Việc chờ ${who}` : 'Việc cả phòng', value: String(todoTotal), tone: todoTotal > 0 ? 'warn' : undefined }, // prettier-ignore
          // Cùng số với tab 'Lệnh có nguy cơ' và badge sidebar (buildMeeting.issues —
          // gồm cả mức theo dõi). Bản trước đếm dừng+cảnh báo: ba chỗ, hai con số.
          { label: mine ? 'Lệnh của tôi nguy cơ' : 'Lệnh nguy cơ', value: String(d.issues.length), tone: d.riskCounts.stop > 0 ? 'stop' : stopWarn > 0 ? 'warn' : undefined }, // prettier-ignore
          { label: mine ? 'Đơn của tôi' : 'Đơn trong sổ', value: String(d.openTotal) },
        ]}
        actions={
          <>
            {!viewAs && (
              <ScopeSwitch
                label="Phạm vi"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'toi', label: 'Của tôi', count: desks.toi.openTotal, hint: 'Đơn tôi phụ trách, lệnh tôi có đơn' }, // prettier-ignore
                  { value: 'phong', label: 'Cả phòng', count: desks.phong.openTotal, hint: 'Mọi đơn, mọi lệnh của phòng' }, // prettier-ignore
                ]}
              />
            )}
            <Btn icon="don" href={`/mua-hang/don?${q}`}>
              {mine ? 'Đơn của tôi' : 'Đơn mua'}
            </Btn>
            <Btn primary icon="them" href="/mua-hang/don/moi">
              Soạn đơn mua
            </Btn>
          </>
        }
      />

      {viewAs && (
        <div className="border-b border-[var(--line)] px-[var(--gutter)] py-2">
          <NoticeBar
            tone="neutral"
            tag="Chỉ xem"
            action={{
              label: 'Về bàn của tôi',
              onClick: () => window.location.assign('/mua-hang'),
            }}
          >
            Đang xem bàn làm việc của <b>{viewAs.name}</b> đúng như người đó thấy — muốn
            làm gì thì mở từng đơn; quyền sửa vẫn theo người phụ trách.
          </NoticeBar>
        </div>
      )}

      {/* Dynamics workspace: ô việc + danh sách theo tab chiếm phần chính, cột
          LIÊN KẾT dán ở mép phải — không phải một hàng nút rơi xuống đáy trang
          để lại khoảng trống (đo 10/09/2026 ở 1366×768: 40% màn dưới trống). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[1fr_232px]">
        <div className="min-w-0 px-[var(--gutter)] py-2.5">
          {/* Tầng 1 — ô số. Mỗi ô là một lời hứa dẫn tới đúng danh sách, CÙNG phạm vi. */}
          <WorkTiles>
            {approver && (
              <WorkTile
                strong
                label="Chờ tôi duyệt"
                count={approver.pending.length}
                hint={pendingWarn > 0 ? `${pendingWarn} đơn chờ quá ${PENDING_WARN_DAYS} ngày` : 'Đơn mua đang đợi chữ ký'} // prettier-ignore
                href="/mua-hang/cho-ky"
                tone="warn"
              />
            )}
            <WorkTile
              strong={!approver}
              label="Quá hẹn giao"
              count={d.counts.overdue}
              hint={
                mine ? 'Giục nhà cung cấp · đơn của tôi' : 'Giục nhà cung cấp · cả phòng'
              }
              href={`/mua-hang/hop-thu?nhom=overdue&${q}`}
              tone="stop"
            />
            <WorkTile
              label="NCC chưa xác nhận"
              count={d.counts.unconfirmed}
              hint="Gửi quá 2 ngày chưa ai xác nhận"
              href={`/mua-hang/hop-thu?nhom=unconfirmed&${q}`}
              tone="warn"
            />
            <WorkTile
              label="Đã duyệt · chưa gửi NCC"
              count={d.counts.unsent}
              hint="Gửi nhà cung cấp"
              href={`/mua-hang/hop-thu?nhom=unsent&${q}`}
              tone="warn"
            />
            {!approver && (
              <WorkTile
                label="Nháp chưa gửi duyệt"
                count={d.counts.draft}
                hint="Hoàn tất rồi gửi duyệt"
                href={`/mua-hang/hop-thu?nhom=draft&${q}`}
              />
            )}
            <WorkTile
              label="Nguy cơ dừng SX"
              count={d.riskCounts.stop}
              hint={
                mine
                  ? 'Lệnh của tôi thiếu vật tư sát mốc'
                  : 'Lệnh thiếu vật tư sát mốc · cả phòng'
              }
              href={`/mua-hang/yeu-cau?${q}`}
              tone="stop"
            />
            <WorkTile
              label="Hàng về 7 ngày tới"
              count={d.incomingSoon}
              hint={
                mine
                  ? 'Hàng của đơn tôi · không tính quá hẹn'
                  : 'Cả phòng · không tính quá hẹn'
              }
              href={`/mua-hang/nhan-hang?nhom=tuan&${q}`}
            />
            {/*
              LỆNH ĐÃ XONG, ĐƠN CÒN MỞ (28/09/2026) — chỉ hiện khi CÓ: sản xuất
              xong tức hàng đã về, đơn chỉ chưa được cập nhật. Đếm bằng cùng hàm
              với bộ lọc `lenh_xong` của sổ Đơn mua (rổ "Còn mở", gồm nháp).
            */}
            {d.lsxDone > 0 && (
              <WorkTile
                label="Lệnh đã xong, đơn còn mở"
                count={d.lsxDone}
                hint="Cập nhật đã về đủ / huỷ"
                tone="warn"
                href={`/mua-hang/don?lenh_xong=1&trang_thai=open&${q}`}
              />
            )}
          </WorkTiles>

          {truncatedAt != null && (
            <div className="mt-3">
              <NoticeBar
                tone="warn"
                tag="Cắt đuôi"
                action={{ label: 'Mở danh sách đơn' }}
              >
                Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp — các số trên có thể
                thiếu.
              </NoticeBar>
            </div>
          )}

          {/* Tầng 2 — danh sách theo tab. */}
          <section className="mt-3 border-y border-[var(--line)] bg-[var(--surface-card)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface)]">
              <WorkLanes lanes={lanes} activeId={tab} onPick={setTab} />
            </div>

            {tab === 'duyet' &&
              approver &&
              (approver.pending.length === 0 ? (
                <Empty headline="Không đơn nào chờ bạn duyệt" reason="Mọi đơn mua gửi lên đã được duyệt hoặc trả lại." next={<Btn icon="don" href="/mua-hang/don?pham_vi=phong">Xem sổ đơn mua</Btn>} /> // prettier-ignore
              ) : (
                <Table>
                  <THead>
                    <th>Đơn</th>
                    <th>Người mua</th>
                    <th>Nhà cung cấp</th>
                    <th>Lệnh SX</th>
                    <th style={{ textAlign: 'right' }}>Giá trị</th>
                    <th style={{ textAlign: 'right' }}>Đã chờ</th>
                  </THead>
                  <tbody>
                    {approver.pending.map((p) => {
                      const age = daysSince(p.since, today)
                      return (
                        <Row key={p.id}>
                          <Cell>
                            <Code as="a" href={`/mua-hang/don/${p.id}`}>
                              {p.code}
                            </Code>
                          </Cell>
                          <Cell>{p.owner}</Cell>
                          <Cell grow>{p.supplier}</Cell>
                          <Cell muted>{p.lsx ?? 'Ngoài LSX'}</Cell>
                          <Cell num>
                            <Num value={money(p.total, p.currency)} />
                          </Cell>
                          <Cell num>
                            <Tag tone={age > PENDING_WARN_DAYS ? 'warn' : 'neutral'}>
                              {age === 0 ? 'hôm nay' : `${age} ngày`}
                            </Tag>
                          </Cell>
                        </Row>
                      )
                    })}
                  </tbody>
                </Table>
              ))}

            {tab === 'nguoi' &&
              approver &&
              (approver.buyers.length === 0 ? (
                <Empty headline="Chưa ai cầm đơn nào đang chạy" reason="Mọi đơn mua đã về đủ hoặc đã huỷ." next={<Btn icon="them" href="/mua-hang/don/moi">Soạn đơn mua</Btn>} /> // prettier-ignore
              ) : (
                <Table>
                  <THead>
                    <th>Người mua</th>
                    <th style={{ textAlign: 'right' }}>Đơn đang chạy</th>
                    <th style={{ textAlign: 'right' }}>Việc chờ</th>
                    <th style={{ textAlign: 'right' }}>Chờ duyệt</th>
                    <th style={{ textAlign: 'right' }}>Quá hẹn</th>
                    <th style={{ textAlign: 'right' }}>NCC chưa xác nhận</th>
                    <th style={{ textAlign: 'right' }}>Chưa hẹn giao</th>
                    <th style={{ textAlign: 'right' }}>Hàng về 7 ngày</th>
                    <th style={{ textAlign: 'right' }}>Lệnh</th>
                    <th />
                  </THead>
                  <tbody>
                    {approver.buyers.map((b) => (
                      <Row key={b.id}>
                        <Cell grow>
                          <b>{b.name}</b>
                        </Cell>
                        <Cell num>
                          <Num value={String(b.open)} />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.todo)} zero="zero" />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.pending)} zero="zero" />
                        </Cell>
                        <Cell num>
                          <Num
                            value={String(b.overdue)}
                            zero="zero"
                            strong={b.overdue > 0}
                          />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.unconfirmed)} zero="zero" />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.noEta)} zero="zero" />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.incomingSoon)} zero="zero" />
                        </Cell>
                        <Cell num>
                          <Num value={String(b.lsx)} zero="zero" />
                        </Cell>
                        <Cell>
                          <Btn href={`/mua-hang?nguoi=${b.id}`}>Xem bàn làm việc</Btn>
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              ))}

            {tab === 'toi' &&
              (d.todos.length === 0 ? (
                mine ? (
                  <Empty headline={viewAs ? `Không có việc nào chờ ${who}` : 'Không có việc nào chờ bạn'} reason="Không đơn nào trong phạm vi này cần động tay hôm nay." next={viewAs ? <Btn icon="quayLai" href="/mua-hang">Về bàn của tôi</Btn> : <Btn onClick={() => setScope('phong')}>Xem việc cả phòng</Btn>} /> // prettier-ignore
                ) : (
                  <Empty headline="Cả phòng không còn việc nào" reason="Không đơn nào của phòng cần động tay hôm nay." next={<Btn icon="don" href="/mua-hang/don?pham_vi=phong">Xem sổ đơn mua</Btn>} /> // prettier-ignore
                )
              ) : (
                <>
                  <Table>
                    <THead>
                      <th>Đơn</th>
                      <th>Nhà cung cấp</th>
                      <th>Việc phải làm</th>
                      {!mine && <th>Phụ trách</th>}
                      <th>Lệnh SX</th>
                      <th>Hẹn giao</th>
                      <th style={{ textAlign: 'right' }}>Giá trị</th>
                    </THead>
                    <tbody>
                      {d.todos.slice(0, TODO_CAP).map((t) => (
                        <Row key={t.id}>
                          <Cell>
                            <Code as="a" href={`/mua-hang/don/${t.id}`}>
                              {t.code}
                            </Code>
                          </Cell>
                          <Cell grow>{t.supplier}</Cell>
                          <Cell>
                            <Tag tone={TONE[SUPPLY_TODO[t.kind].tone]}>{t.action}</Tag>
                          </Cell>
                          {!mine && <Cell muted>{t.owner}</Cell>}
                          <Cell muted>{t.lsx ?? 'Ngoài LSX'}</Cell>
                          <Cell num>
                            <Num
                              value={dmy(t.expected_at)}
                              strong={t.kind === 'overdue'}
                            />
                          </Cell>
                          <Cell num>
                            <Num value={money(t.total, t.currency)} />
                          </Cell>
                        </Row>
                      ))}
                    </tbody>
                  </Table>
                  {d.todos.length > TODO_CAP && (
                    <p className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-3)]">
                      Đang hiện {TODO_CAP}/{d.todos.length} việc —{' '}
                      <a
                        className="text-[var(--act-text)] hover:underline"
                        href={`/mua-hang/hop-thu?${q}`}
                      >
                        xem đủ ở Hộp thư việc
                      </a>
                      .
                    </p>
                  )}
                </>
              ))}

            {tab === 'lenh' &&
              (d.issues.length === 0 ? (
                <Empty headline={mine ? `Lệnh của ${who} không có nguy cơ` : 'Không lệnh nào có nguy cơ'} reason={mine ? `${d.lsxCount} lệnh có đơn của ${who} đều đủ vật tư hoặc hàng đang về.` : 'Mọi lệnh đang chạy đều đủ vật tư hoặc hàng đang về.'} next={<Btn icon="lenh" href={`/mua-hang/yeu-cau?${q}`}>Xem yêu cầu mua</Btn>} /> // prettier-ignore
              ) : (
                <Table>
                  <THead>
                    <th>Lệnh</th>
                    <th>Khách</th>
                    <th>Mức</th>
                    <th>Vì sao</th>
                    <th>Ai cầm bóng</th>
                    <th>Mốc</th>
                    <th style={{ textAlign: 'right' }}>Đơn</th>
                  </THead>
                  <tbody>
                    {d.issues.slice(0, 12).map((i) => (
                      <Row key={i.id}>
                        <Cell>
                          <Code as="a" href={`/mua-hang/yeu-cau/${i.id}`}>
                            {i.code}
                          </Code>
                        </Cell>
                        <Cell muted>{i.customer}</Cell>
                        <Cell>
                          <Tag tone={TONE[MEETING_LEVEL[i.level].tone]}>{i.label}</Tag>
                        </Cell>
                        {/*
                          "VÌ SAO" LÀ CỘT NỘI DUNG của bảng này — nó là câu trả
                          lời, không phải chú thích, nên sàn rộng hơn mặc định
                          và có tooltip đọc nguyên văn khi câu dài hơn ô.
                        */}
                        <Cell grow className="min-w-[320px]" title={i.reason}>
                          {i.reason}
                        </Cell>
                        <Cell muted>{i.owner}</Cell>
                        <Cell num>
                          <Num value={dmy(i.due)} />
                        </Cell>
                        <Cell num>
                          <Num value={String(i.poCount)} zero="zero" />
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              ))}

            {tab === 'hop' &&
              (agendaSorted.length === 0 ? (
                <Empty headline="Không có việc gì cần quyết" reason="Không lệnh nào ở mức khẩn và không đơn nào chờ ký." next={<Btn icon="don" href="/mua-hang/don?trang_thai=pending&pham_vi=phong">Xem đơn chờ duyệt</Btn>} /> // prettier-ignore
              ) : (
                <Table>
                  <THead>
                    <th>Bộ phận</th>
                    <th>Việc</th>
                    <th>Lệnh liên quan</th>
                    <th>Mốc gần nhất</th>
                  </THead>
                  <tbody>
                    {agendaSorted.map((a) => (
                      <Row key={`${a.dept}|${a.action}`}>
                        <Cell>
                          <b>{a.dept}</b>
                        </Cell>
                        <Cell grow>
                          {a.action}{' '}
                          <span className="num text-[var(--ink-3)]">
                            · {a.codes.length} lệnh
                          </span>
                        </Cell>
                        <Cell muted>
                          {a.codes.slice(0, 4).join(' · ')}
                          {a.codes.length > 4 ? ` +${a.codes.length - 4}` : ''}
                        </Cell>
                        <Cell num>
                          <Num value={dmy(a.due)} />
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              ))}
          </section>
        </div>

        {/* Cột LIÊN KẾT — Dynamics "Links". "Của tôi" đứng đầu: đường tắt tới
            đúng các danh sách đã lọc theo người, cùng một nghĩa (supply-scope). */}
        <aside className="border-t border-[var(--line)] bg-[var(--surface-card)] lg:border-t-0 lg:border-l">
          <LinkGroup title="Của tôi">
            <LinkRow href="/mua-hang/don?pham_vi=toi">Đơn của tôi</LinkRow>
            <LinkRow href="/mua-hang/hop-thu?pham_vi=toi">Việc chờ tôi</LinkRow>
            <LinkRow href="/mua-hang/yeu-cau?pham_vi=toi">Lệnh của tôi</LinkRow>
            <LinkRow href="/mua-hang/nhan-hang?pham_vi=toi">Hàng về của tôi</LinkRow>
            <LinkRow href="/mua-hang/ncc?pham_vi=toi">NCC của tôi</LinkRow>
          </LinkGroup>
          <LinkGroup title="Đơn mua · cả phòng">
            <LinkRow href="/mua-hang/don?trang_thai=pending&pham_vi=phong">
              Chờ duyệt
            </LinkRow>
            <LinkRow href="/mua-hang/don?tre=1&pham_vi=phong">NCC trễ hẹn</LinkRow>
            <LinkRow href="/mua-hang/don?trang_thai=inflight&sap=hen_gan&pham_vi=phong">
              Đang về theo tuần
            </LinkRow>
            <LinkRow href="/mua-hang/don?pham_vi=phong">Tất cả đơn</LinkRow>
          </LinkGroup>
          <LinkGroup title="Nhu cầu & danh mục">
            <LinkRow href="/mua-hang/yeu-cau?pham_vi=phong">
              Yêu cầu mua · vật tư theo lệnh
            </LinkRow>
            <LinkRow href="/mua-hang/ton">Tồn & cân đối</LinkRow>
            <LinkRow href="/mua-hang/vat-tu">Vật tư</LinkRow>
            <LinkRow href="/mua-hang/bang-gia">Bảng giá</LinkRow>
          </LinkGroup>
          <p className="text-k-sm px-[var(--gutter)] py-2 leading-relaxed text-[var(--ink-3)]">
            Số trên ô và trên tab đếm bằng đúng hàm mà danh sách đích dùng, cùng phạm vi
            đang chọn.
          </p>
        </aside>
      </div>
    </div>
  )
}

/* Nhóm liên kết ở cột phải — tiêu đề nhỏ in hoa, mỗi dòng một đích. */
function LinkGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--hair)] py-2">
      <h2 className="text-k-label px-[var(--gutter)] pb-1 font-bold tracking-[.1em] text-[var(--ink-3)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
function LinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-k-sm block px-[var(--gutter)] py-1 text-[var(--act-text)] hover:bg-[var(--surface-hover)] hover:underline"
    >
      {children}
    </a>
  )
}
