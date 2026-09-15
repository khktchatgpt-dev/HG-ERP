'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  DocChain,
  Empty,
  InspectPanel,
  InspectSection,
  NextAction,
  Num,
  PrimaryStep,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  Tag,
  WhyBox,
  WorkLanes,
  toLanes,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { ARRIVALS, TODAY, m, n, type Arrival } from '../_kho/data'

/**
 * KHO · MÀN 2 — HÀNG VỀ (Khuôn B).
 *
 * Câu hỏi: "xe nào đang tới, cái nào trễ?". Chép Odoo *Receipts* (chia Late /
 * Today / Future) và SAP *My Inbox* (dòng tự nói ra việc phải làm).
 *
 * BỐN LÀN, KHÔNG PHẢI BA. Ba làn thời gian của Odoo cộng thêm làn **CHƯA HẸN
 * NGÀY** — đây là chỗ mẫu nước ngoài không có mà xưởng Việt Nam bắt buộc phải
 * có: nhiều NCC không nhận hẹn ngày, "giao khi có xe". Giấu tập đó đi thì thủ
 * kho phải nhớ bằng đầu, và đó đúng là triệu chứng "lập sổ Excel riêng để nhớ
 * hộ hệ thống".
 *
 * CỘT "VÌ SAO ĐÁNG CHÚ Ý" là cột đắt nhất của màn. Bỏ nó đi thì bảng này chỉ
 * còn là danh sách đơn xếp theo ngày — thứ đã có ở khu Cung ứng, và màn này
 * không còn lý do tồn tại.
 */

/**
 * Dòng hàng của một đợt giao — bày trong khay để thủ kho biết xe chở gì TRƯỚC
 * khi ra bãi, không phải mở đơn ở khu khác.
 */
const CARGO: Record<
  string,
  { code: string; ordered: number; arrived: number; now: number }[]
> = {
  // prettier-ignore
  a1: [
    { code: 'NH-0485', ordered: 520, arrived: 0, now: 520 },
    { code: 'HAN0032', ordered: 24, arrived: 0, now: 24 },
  ],
  a2: [
    { code: 'NH-0480', ordered: 500, arrived: 120, now: 380 },
    { code: 'NH-0482', ordered: 200, arrived: 0, now: 200 },
    { code: 'BUL0071', ordered: 5000, arrived: 2600, now: 2400 },
  ],
  a3: [
    { code: 'MAY0448', ordered: 400, arrived: 280, now: 120 },
    { code: 'MAY0449', ordered: 420, arrived: 160, now: 260 },
  ],
  a4: [{ code: 'LON0014', ordered: 2400, arrived: 0, now: 2400 }],
  a5: [{ code: 'GON0022', ordered: 600, arrived: 0, now: 600 }],
  a6: [{ code: 'PKN0294', ordered: 12000, arrived: 0, now: 12000 }],
}

/**
 * Bốn làn = bốn thái độ. `tone: 'stop'` CHỈ đặt cho làn Trễ — làn nào cũng có
 * màu thì màu hết là tín hiệu.
 */
const LANES = toLanes(ARRIVALS, [
  { id: 'late', label: 'Quá hẹn', tone: 'stop', test: (a: Arrival) => a.inDays < 0 },
  { id: 'today', label: 'Hôm nay', tone: 'warn', test: (a: Arrival) => a.inDays === 0 },
  { id: 'soon', label: 'Sắp tới', test: (a: Arrival) => a.inDays > 0 && !a.noDate }, // prettier-ignore
  { id: 'nodate', label: 'Chưa hẹn ngày', test: (a: Arrival) => !!a.noDate },
])

export default function Page() {
  const [lane, setLane] = useState('late')
  const [pick, setPick] = useState<string | null>('a1')

  const rows = LANES.find((l) => l.id === lane)?.rows ?? []
  const sel = ARRIVALS.find((a) => a.id === pick) ?? null
  const visible = rows.some((r) => r.id === pick) ? sel : null
  const cargo = visible ? (CARGO[visible.id] ?? []) : []

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn B — Hàng về.</b> Bốn làn: ba làn thời gian của Odoo cộng làn{' '}
          <b>“Chưa hẹn ngày”</b> — thứ mẫu nước ngoài không có mà NCC Việt Nam bắt buộc
          phải có. Cột <b>“Vì sao đáng chú ý”</b> là cột đắt nhất: bỏ nó thì đây chỉ còn
          là danh sách đơn xếp theo ngày, và màn này hết lý do tồn tại.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Nhận hàng"
        title="Hàng về"
        facts={[
          { label: 'Đợt đang chờ', value: String(ARRIVALS.length) },
          { label: 'Quá hẹn', value: String(LANES[0].rows.length), tone: 'stop' },
          { label: 'Chưa hẹn ngày', value: String(LANES[3].rows.length) },
        ]}
        actions={
          <>
            <Btn href="/design-lab/kho">Về bàn làm việc</Btn>
            <Btn href="/design-lab/kho/phieu-nhap">+ Nhận không theo đơn</Btn>
          </>
        }
      >
        <WorkLanes lanes={LANES} activeId={lane} onPick={setLane} />
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Làn này đang trống"
              reason="Không có đợt giao nào rơi vào khoảng thời gian của làn đang chọn."
              next={<Btn onClick={() => setLane('late')}>Xem làn Quá hẹn</Btn>}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <th>Hẹn</th>
              <th>Đơn mua</th>
              <th>Nhà cung cấp</th>
              <th>Vì sao đáng chú ý</th>
              <th>Khối lượng</th>
              <th style={{ textAlign: 'right' }}>Trễ</th>
            </THead>
            <tbody>
              {rows.map((a) => (
                <Row key={a.id} selected={a.id === pick} onClick={() => setPick(a.id)}>
                  <Cell num className={a.inDays < 0 ? 'text-[var(--stop)]' : undefined}>
                    {a.due}
                  </Cell>
                  <Cell>
                    <Code>{a.po}</Code>
                  </Cell>
                  <Cell>{a.supplier}</Cell>
                  <Cell grow muted={a.why === 'Đúng hẹn'}>
                    {a.why}
                  </Cell>
                  <Cell num muted>
                    {a.lines} dòng · {a.volume}
                  </Cell>
                  <Cell num>
                    {a.inDays < 0 ? (
                      <Num value={`${-a.inDays} ngày`} strong />
                    ) : a.noDate ? (
                      <Tag tone="neutral">chưa hẹn</Tag>
                    ) : (
                      <span className="text-[var(--ink-3)]">—</span>
                    )}
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}

        {visible && (
          <InspectPanel
            code={visible.po}
            title={`${visible.supplier} · hẹn ${visible.due}`}
            subtitle={`${visible.lines} dòng · ${visible.volume}`}
            actions={
              <>
                <PrimaryStep label="Lập phiếu nhập" href="/design-lab/kho/phieu-nhap" />
                <Btn>Báo NCC trễ hẹn</Btn>
                <Btn>Xem đơn mua</Btn>
              </>
            }
          >
            {/*
              XE CHỞ GÌ — bày NGAY TRONG KHAY, không bắt mở đơn ở khu Cung ứng.
              Ba cột Đặt / Đã về / Đợt này là mẫu Goods Receipt của SAP: người
              nhận không phải nhớ đã về bao nhiêu, và đó là nguồn sai lớn nhất
              khi một đơn giao làm nhiều đợt.
            */}
            <InspectSection title="Xe này chở gì">
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
                <Table>
                  <THead>
                    <th>Mã</th>
                    <th style={{ textAlign: 'right' }}>Đặt</th>
                    <th style={{ textAlign: 'right' }}>Đã về</th>
                    <th style={{ textAlign: 'right' }}>Đợt này</th>
                  </THead>
                  <tbody>
                    {cargo.map((c) => (
                      <Row key={c.code}>
                        <Cell grow>
                          <Code>{c.code}</Code>{' '}
                          <span className="text-[var(--ink-3)]">{m(c.code).name}</span>
                        </Cell>
                        <Cell num muted>
                          {n(c.ordered)}
                        </Cell>
                        <Cell num muted>
                          {c.arrived === 0 ? '—' : n(c.arrived)}
                        </Cell>
                        <Cell num>
                          <Num value={n(c.now)} strong />
                        </Cell>
                      </Row>
                    ))}
                  </tbody>
                </Table>
              </div>
            </InspectSection>

            <InspectSection title="Đến lượt ai">
              <NextAction
                mine
                holder="Kho — Trần Thị C"
                what={
                  visible.inDays < 0
                    ? 'Gọi NCC chốt ngày, rồi báo Cung ứng'
                    : 'Nhận hàng và lập phiếu nhập'
                }
                days={visible.inDays < 0 ? -visible.inDays : 0}
                hint={
                  visible.inDays < 0
                    ? 'Quá hẹn mà không ai ghi lý do thì tuần sau cả phòng lại hỏi lại từ đầu.'
                    : undefined
                }
              />
            </InspectSection>

            {visible.inDays < 0 && (
              <InspectSection title="Vì sao tính là trễ">
                <WhyBox
                  lines={[
                    `NCC hẹn ${visible.due}/2026`,
                    `hôm nay ${TODAY}`,
                    `quá hẹn ${-visible.inDays} ngày`,
                  ]}
                  result={`trễ ${-visible.inDays} ngày`}
                />
                <p className="mt-[9px] text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                  “Trễ” là trạng thái <b>TÍNH</b>, không lưu: nó là phép so giữa ngày hẹn
                  và đồng hồ. Lưu nó thì phải nuôi một cron đi sửa, và giữa hai lần chạy
                  thì số trên màn sai.
                </p>
              </InspectSection>
            )}

            <InspectSection title="Chuỗi chứng từ">
              <DocChain
                links={[
                  { label: 'Lệnh SX', code: 'LSX 07/26-14', href: '/design-lab/kho/cap-vat-tu' }, // prettier-ignore
                  { label: 'Đơn mua', code: visible.po },
                  { label: 'Phiếu nhập', code: 'chưa lập', muted: true },
                ]}
              />
            </InspectSection>
          </InspectPanel>
        )}
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính',
        ]}
        right={`${rows.length} đợt trong làn · ${ARRIVALS.length} tổng`}
      />
    </ScreenFrame>
  )
}
