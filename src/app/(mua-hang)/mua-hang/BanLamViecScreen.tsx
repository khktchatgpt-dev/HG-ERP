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
  type Lane,
} from '@/components/kit'
import { MEETING_LEVEL, type MeetingRiskLevel } from '@/lib/supply-meeting'
import { SUPPLY_TODO, SUPPLY_TODO_KINDS, type SupplyTodoKind } from '@/lib/supply-watch'
import type { SupplyScope } from '@/lib/supply-scope'
import { useScopePref } from '@/lib/use-scope-pref'
import { ViecChoBang } from './viec-cho'

/**
 * Phần nhìn của Bàn làm việc. Mọi số đã đếm xong ở server (hai bàn "của tôi" /
 * "cả phòng"); công tắc phạm vi chỉ CHỌN bàn, không tính lại gì.
 *
 * GỌN LẠI 05/10/2026 (bản vẽ M1 canvas "Cung ứng · Hàng về" › Bản 10, chủ dự
 * án duyệt): cùng một con số từng hiện ở BA chỗ — dòng đầu trang, sáu ô số, ba
 * tab — và lệch nhau ("Nguy cơ dừng SX 1" vs "Lệnh có nguy cơ 4"); ô số bấm
 * thì sang trang khác còn tab bấm thì lọc tại chỗ. Nay MỘT dải tab: mỗi loại
 * việc một tab (kit tự đếm `rows.length`, số không lệch được), bấm là lọc
 * ngay bảng dưới. Bảng việc nhóm theo loại (`viec-cho.tsx`). Cột liên kết bên
 * phải bỏ — trùng menu trái.
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
const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
/** "Thứ Hai, 05/10/2026" — tính theo lịch, không theo múi giờ máy. */
const homNay = (iso: string) =>
  `${THU[new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay()]}, ${dmy(iso)}`
/** Làn một loại việc: `k:overdue`, `k:unconfirmed`… */
const LAN_VIEC = 'k:'
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
    // Mỗi loại việc một làn — chỉ loại đang có việc, theo thứ tự khẩn.
    ...SUPPLY_TODO_KINDS.filter((k) => d.counts[k] > 0).map((k) => ({
      id: `${LAN_VIEC}${k}`,
      label: SUPPLY_TODO[k].label,
      rows: d.todos.filter((t) => t.kind === k),
      tone: SUPPLY_TODO[k].tone === 'stop' ? ('stop' as const) : undefined,
    })),
    // Một khái niệm, một số: làn đếm MỌI mức (cùng badge sidebar), số "dừng SX" nói kèm trong nhãn.
    { id: 'lenh', label: `Lệnh có nguy cơ${d.riskCounts.stop > 0 ? ` · ${d.riskCounts.stop} dừng SX` : ''}`, rows: d.issues, tone: d.riskCounts.stop > 0 ? ('stop' as const) : undefined }, // prettier-ignore
    { id: 'hop', label: 'Cần quyết trong họp', rows: agenda, tone: undefined },
  ]
  const [tab, setTab] = useState(() => lanes.find((l) => l.rows.length > 0)?.id ?? 'toi')

  const agendaSorted = [...agenda].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.dept),
      db = DEPT_ORDER.indexOf(b.dept)
    if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db)
    return a.rank - b.rank
  })
  const lanViec = tab.startsWith(LAN_VIEC)
    ? (tab.slice(LAN_VIEC.length) as SupplyTodoKind)
    : null
  const todosLan = lanViec ? d.todos.filter((t) => t.kind === lanViec) : d.todos

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader
        compact
        eyebrow={
          viewAs ? `Mua hàng · đang xem bàn của ${viewAs.name}` : `Mua hàng · ${userName}`
        }
        title="Bàn làm việc"
        // Số đếm việc chỉ còn ở dải tab bên dưới — không nhắc lại ở đây (05/10/2026).
        facts={[{ label: 'Hôm nay', value: homNay(today) }]}
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

      {truncatedAt != null && (
        <div className="border-b border-[var(--line)] px-[var(--gutter)] py-2">
          <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Mở danh sách đơn' }}>
            Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp — các số dưới có thể thiếu.
          </NoticeBar>
        </div>
      )}

      {/* MỘT dải tab = mọi số đếm của trang; bảng dưới chiếm phần còn lại và tự cuộn. */}
      <section className="flex min-h-0 flex-1 flex-col bg-[var(--surface-card)]">
        <div className="flex items-end border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="min-w-0 flex-1">
            <WorkLanes lanes={lanes} activeId={tab} onPick={setTab} />
          </div>
          {/* Hai số này mở TRANG KHÁC (không phải lọc bảng dưới) — nên là liên kết có ↗, khác hình tab. */}
          <span className="text-k-sm flex shrink-0 items-center gap-4 px-[var(--gutter)] pb-2">
            <a
              className="text-[var(--act-text)] hover:underline"
              href={`/mua-hang/theo-doi?nhom=tuan&${q}`}
            >
              Hàng về 7 ngày tới <b className="num">{d.incomingSoon}</b> ↗
            </a>
            {d.lsxDone > 0 && (
              <a
                className="text-[var(--warn)] hover:underline"
                href={`/mua-hang/don?lenh_xong=1&trang_thai=open&${q}`}
                title="Sản xuất xong mà đơn còn mở — cập nhật đã về đủ / huỷ"
              >
                Lệnh đã xong, đơn còn mở <b className="num">{d.lsxDone}</b> ↗
              </a>
            )}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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

          {(tab === 'toi' || lanViec) &&
            (todosLan.length === 0 ? (
              mine ? (
                <Empty headline={viewAs ? `Không có việc nào chờ ${who}` : 'Không có việc nào chờ bạn'} reason="Không đơn nào trong phạm vi này cần động tay hôm nay." next={viewAs ? <Btn icon="quayLai" href="/mua-hang">Về bàn của tôi</Btn> : <Btn onClick={() => setScope('phong')}>Xem việc cả phòng</Btn>} /> // prettier-ignore
              ) : (
                <Empty headline="Cả phòng không còn việc nào" reason="Không đơn nào của phòng cần động tay hôm nay." next={<Btn icon="don" href="/mua-hang/don?pham_vi=phong">Xem sổ đơn mua</Btn>} /> // prettier-ignore
              )
            ) : (
              <ViecChoBang todos={todosLan} mine={mine} today={today} />
            ))}

          {tab === 'lenh' &&
            (d.issues.length === 0 ? (
              <Empty headline={mine ? `Lệnh của ${who} không có nguy cơ` : 'Không lệnh nào có nguy cơ'} reason={mine ? `${d.lsxCount} lệnh có đơn của ${who} đều đã về hết đơn hoặc hàng đang về.` : 'Mọi lệnh đang chạy đều đã về hết đơn hoặc hàng đang về.'} next={<Btn icon="lenh" href={`/mua-hang/yeu-cau?${q}`}>Xem yêu cầu mua</Btn>} /> // prettier-ignore
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
        </div>
      </section>
    </div>
  )
}
