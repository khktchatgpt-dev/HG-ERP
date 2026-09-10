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

      <div className="min-h-0 flex-1 overflow-auto px-[var(--gutter)] py-[13px]">
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
          <WorkTile label="Đã duyệt · chưa gửi NCC" count={counts.unsent} hint="Gửi nhà cung cấp · đơn tôi phụ trách" href="/mua-hang/hop-thu?nhom=unsent" tone="warn" />
          <WorkTile label="Nháp chưa gửi duyệt" count={counts.draft} hint="Hoàn tất rồi gửi Giám đốc" href="/mua-hang/hop-thu?nhom=draft" />
          <WorkTile label="Nguy cơ dừng SX" count={riskCounts.stop} hint="Lệnh thiếu vật tư sát mốc · cả phòng" href="/mua-hang/yeu-cau" tone="stop" />
          <WorkTile label="Thiếu / chưa mua" count={riskCounts.warn} hint="Lệnh còn mã chưa có đơn · cả phòng" href="/mua-hang/yeu-cau" tone="warn" />
          <WorkTile label="Hàng về 7 ngày tới" count={incomingSoon} hint="Cả phòng · không tính đơn quá hẹn" href="/mua-hang/don?nhin=dang-ve" />
        </WorkTiles>

        {truncatedAt != null && (
          <div className="mt-[13px]">
            <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Mở danh sách đơn' }}>
              Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp — các số trên có thể
              thiếu.
            </NoticeBar>
          </div>
        )}

        {/* Tầng 2 — danh sách theo tab. Ba câu hỏi, một trang. */}
        <section className="mt-[15px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
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

        {/* Tầng 3 — liên kết. Đường tắt tới danh sách của module, có số đi kèm. */}
        <section className="mt-[15px]">
          <h2 className="mb-[7px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-2)] uppercase">
            Danh sách của module
          </h2>
          <div className="flex flex-wrap gap-2">
            <Btn href="/mua-hang/don?nhin=toi">Đơn của tôi</Btn>
            <Btn href="/mua-hang/don?nhin=cho-duyet">Chờ duyệt</Btn>
            <Btn href="/mua-hang/don?nhin=tre">NCC trễ hẹn</Btn>
            <Btn href="/mua-hang/don?nhin=dang-ve">Đang về theo tuần</Btn>
            <Btn href="/mua-hang/yeu-cau">Yêu cầu mua</Btn>
            <Btn href="/mua-hang/ncc">Nhà cung cấp</Btn>
            <Btn href="/mua-hang/ton">Tồn & cân đối</Btn>
          </div>
          <p className="mt-[7px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Ba tab ở trên là ba câu hỏi của cùng một vai; mỗi tab dẫn tới danh sách đầy đủ
            của nó. Số trên ô và trên tab đếm bằng đúng hàm mà danh sách đích dùng.
          </p>
        </section>
      </div>
    </div>
  )
}
