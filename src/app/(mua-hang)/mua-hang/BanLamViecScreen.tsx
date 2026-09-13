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

/**
 * Phần nhìn của Bàn làm việc. Ba tầng theo Dynamics workspace: ô số → danh
 * sách theo tab → liên kết. Mọi số đã đếm xong ở server; ở đây không tính lại.
 */

export type Todo = {
  id: string
  code: string
  kind: SupplyTodoKind
  action: string
  supplier: string
  lsx: string | null
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

const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  stop: 'stop',
  warn: 'warn',
  primary: 'neutral',
  muted: 'neutral',
  done: 'done',
}
const dmy = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/** Thứ tự đọc trong họp — cố định, không theo chữ cái. */
const DEPT_ORDER = ['Sản xuất', 'Giám đốc', 'Cung ứng', 'Nhà cung cấp', 'Kho']

export function BanLamViecScreen({
  today,
  userName,
  counts,
  incomingSoon,
  openTotal,
  riskCounts,
  todos,
  issues,
  agenda,
  truncatedAt,
}: {
  today: string
  userName: string
  counts: Record<SupplyTodoKind, number>
  incomingSoon: number
  openTotal: number
  riskCounts: Record<MeetingRiskLevel, number>
  todos: Todo[]
  issues: Issue[]
  agenda: Agenda[]
  truncatedAt: number | null
}) {
  const mineTotal = Object.values(counts).reduce((s, n) => s + n, 0)
  const stopWarn = riskCounts.stop + riskCounts.warn

  // Tab = ba câu hỏi khác nhau, cùng một trang. Số trên tab = số dòng trong tab.
  // Ba tab ba kiểu dòng khác nhau — WorkLanes chỉ cần `rows.length`, nên khai
  // `Lane<unknown>` thay vì ép cả ba về một kiểu.
  const lanes: Lane<unknown>[] = [
    { id: 'toi', label: 'Việc chờ tôi', rows: todos, tone: undefined },
    { id: 'lenh', label: 'Lệnh có nguy cơ', rows: issues, tone: riskCounts.stop > 0 ? ('stop' as const) : undefined }, // prettier-ignore
    { id: 'hop', label: 'Cần quyết trong họp', rows: agenda, tone: undefined },
  ]
  const [tab, setTab] = useState(() => lanes.find((l) => l.rows.length > 0)?.id ?? 'toi')

  const agendaSorted = [...agenda].sort((a, b) => {
    const da = DEPT_ORDER.indexOf(a.dept),
      db = DEPT_ORDER.indexOf(b.dept)
    if (da !== db) return (da < 0 ? 99 : da) - (db < 0 ? 99 : db)
    return a.rank - b.rank
  })

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader
        compact
        eyebrow={`Mua hàng · ${userName}`}
        title="Bàn làm việc"
        facts={[
          { label: 'Hôm nay', value: dmy(today) },
          { label: 'Việc chờ tôi', value: String(mineTotal), tone: mineTotal > 0 ? 'warn' : undefined }, // prettier-ignore
          { label: 'Lệnh nguy cơ', value: String(stopWarn), tone: riskCounts.stop > 0 ? 'stop' : stopWarn > 0 ? 'warn' : undefined }, // prettier-ignore
          { label: 'Đơn trong sổ', value: String(openTotal) },
        ]}
        actions={
          <>
            <Btn href="/mua-hang/don">Đơn mua</Btn>
            <Btn primary href="/mua-hang/don/moi">
              + Soạn đơn mua
            </Btn>
          </>
        }
      />

      {/* Dynamics workspace: ô việc + danh sách theo tab chiếm phần chính, cột
          LIÊN KẾT dán ở mép phải — không phải một hàng nút rơi xuống đáy trang
          để lại khoảng trống (đo 10/09/2026 ở 1366×768: 40% màn dưới trống). */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[1fr_232px]">
        <div className="min-w-0 px-[var(--gutter)] py-[10px]">
          {/* Tầng 1 — ô số. Sáu ô, mỗi ô là một lời hứa dẫn tới đúng danh sách. */}
          <WorkTiles>
            <WorkTile
              strong
              label="Quá hẹn giao"
              count={counts.overdue}
              hint="Giục nhà cung cấp · đơn tôi phụ trách"
              href="/mua-hang/hop-thu?nhom=overdue"
              tone="stop"
            />
            <WorkTile
              label="Đã duyệt · chưa gửi NCC"
              count={counts.unsent}
              hint="Gửi nhà cung cấp · đơn tôi phụ trách"
              href="/mua-hang/hop-thu?nhom=unsent"
              tone="warn"
            />
            <WorkTile
              label="Nháp chưa gửi duyệt"
              count={counts.draft}
              hint="Hoàn tất rồi gửi Giám đốc"
              href="/mua-hang/hop-thu?nhom=draft"
            />
            <WorkTile
              label="Nguy cơ dừng SX"
              count={riskCounts.stop}
              hint="Lệnh thiếu vật tư sát mốc · cả phòng"
              href="/mua-hang/yeu-cau"
              tone="stop"
            />
            <WorkTile
              label="Thiếu / chưa mua"
              count={riskCounts.warn}
              hint="Lệnh còn mã chưa có đơn · cả phòng"
              href="/mua-hang/yeu-cau"
              tone="warn"
            />
            <WorkTile
              label="Hàng về 7 ngày tới"
              count={incomingSoon}
              hint="Cả phòng · không tính đơn quá hẹn"
              href="/mua-hang/don?nhin=dang-ve"
            />
          </WorkTiles>

          {truncatedAt != null && (
            <div className="mt-[13px]">
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

          {/* Tầng 2 — danh sách theo tab. Ba câu hỏi, một trang. */}
          <section className="mt-[12px] border-y border-[var(--line)] bg-[var(--surface-card)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface)]">
              <WorkLanes lanes={lanes} activeId={tab} onPick={setTab} />
            </div>

            {tab === 'toi' &&
              (todos.length === 0 ? (
                <Empty headline="Không có việc nào chờ bạn" reason="Không đơn nào bạn phụ trách cần động tay hôm nay." next={<Btn href="/mua-hang/hop-thu?pham_vi=phong">Xem việc cả phòng</Btn>} /> // prettier-ignore
              ) : (
                <Table>
                  <THead>
                    <th>Đơn</th>
                    <th>Nhà cung cấp</th>
                    <th>Việc phải làm</th>
                    <th>Lệnh SX</th>
                    <th>Hẹn giao</th>
                    <th style={{ textAlign: 'right' }}>Giá trị</th>
                  </THead>
                  <tbody>
                    {todos.slice(0, 12).map((t) => (
                      <Row key={t.id}>
                        <Cell>
                          <Code as="a" href={`/mua-hang/don?mo=${t.id}`}>
                            {t.code}
                          </Code>
                        </Cell>
                        <Cell grow>{t.supplier}</Cell>
                        <Cell>
                          <Tag tone={TONE[SUPPLY_TODO[t.kind].tone]}>{t.action}</Tag>
                        </Cell>
                        <Cell muted>{t.lsx ?? 'Ngoài LSX'}</Cell>
                        <Cell num>
                          <Num value={dmy(t.expected_at)} strong={t.kind === 'overdue'} />
                        </Cell>
                        <Cell num>
                          <Num
                            value={
                              t.total > 0
                                ? `${t.total.toLocaleString('vi-VN')} ${t.currency}`
                                : ''
                            }
                          />
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              ))}

            {tab === 'lenh' &&
              (issues.length === 0 ? (
                <Empty headline="Không lệnh nào có nguy cơ" reason="Mọi lệnh đang chạy đều đủ vật tư hoặc hàng đang về." next={<Btn href="/mua-hang/yeu-cau">Xem yêu cầu mua</Btn>} /> // prettier-ignore
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
                    {issues.slice(0, 12).map((i) => (
                      <Row key={i.id}>
                        <Cell>
                          <Code as="a" href={`/planning/lsx/${i.id}`}>
                            {i.code}
                          </Code>
                        </Cell>
                        <Cell muted>{i.customer}</Cell>
                        <Cell>
                          <Tag tone={TONE[MEETING_LEVEL[i.level].tone]}>{i.label}</Tag>
                        </Cell>
                        <Cell grow>{i.reason}</Cell>
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
                <Empty headline="Không có việc gì cần quyết" reason="Không lệnh nào ở mức khẩn và không đơn nào chờ ký." next={<Btn href="/mua-hang/don?nhin=cho-duyet">Xem đơn chờ duyệt</Btn>} /> // prettier-ignore
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

        {/* Cột LIÊN KẾT — Dynamics "Links": nhóm đường tắt tới danh sách của module. */}
        <aside className="border-t border-[var(--line)] bg-[var(--surface-card)] lg:border-t-0 lg:border-l">
          <LinkGroup title="Đơn mua">
            <LinkRow href="/mua-hang/don?nhin=toi">Đơn của tôi</LinkRow>
            <LinkRow href="/mua-hang/don?nhin=cho-duyet">Chờ duyệt</LinkRow>
            <LinkRow href="/mua-hang/don?nhin=tre">NCC trễ hẹn</LinkRow>
            <LinkRow href="/mua-hang/don?nhin=dang-ve">Đang về theo tuần</LinkRow>
            <LinkRow href="/mua-hang/don">Tất cả đơn</LinkRow>
          </LinkGroup>
          <LinkGroup title="Nhu cầu & nhận hàng">
            <LinkRow href="/mua-hang/yeu-cau">Yêu cầu mua · vật tư theo lệnh</LinkRow>
            <LinkRow href="/mua-hang/nhan-hang">Nhận hàng</LinkRow>
            <LinkRow href="/mua-hang/ton">Tồn & cân đối</LinkRow>
          </LinkGroup>
          <LinkGroup title="Danh mục">
            <LinkRow href="/mua-hang/ncc">Nhà cung cấp</LinkRow>
            <LinkRow href="/mua-hang/vat-tu">Vật tư</LinkRow>
            <LinkRow href="/mua-hang/bang-gia">Bảng giá</LinkRow>
          </LinkGroup>
          <p className="px-[var(--gutter)] py-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
            Số trên ô và trên tab đếm bằng đúng hàm mà danh sách đích dùng.
          </p>
        </aside>
      </div>
    </div>
  )
}

/* Nhóm liên kết ở cột phải — tiêu đề nhỏ in hoa, mỗi dòng một đích. */
function LinkGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--hair)] py-[7px]">
      <h2 className="px-[var(--gutter)] pb-[3px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
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
      className="block px-[var(--gutter)] py-[3px] text-[var(--act-text)] text-[var(--fs-sm)] hover:bg-[var(--surface-hover)] hover:underline"
    >
      {children}
    </a>
  )
}
