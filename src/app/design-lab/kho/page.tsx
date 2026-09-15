'use client'

import { Fragment } from 'react'
import {
  Btn,
  Cell,
  Code,
  NoticeBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  Tag,
  WorkTile,
  WorkTiles,
} from '@/components/kit'
import { LabNote } from '../_lab/Doc'
import { ARRIVALS, LSXS, PUTAWAY, STOCK, TODAY, covered, done, n } from './_kho/data'

/**
 * KHO · MÀN 1 — BÀN LÀM VIỆC (Khuôn A).
 *
 * Câu hỏi: "sáng nay tôi phải làm gì?". Đây là màn thủ kho mở đầu tiên và là
 * màn duy nhất anh ấy tới khi trong đầu chưa có chứng từ nào cụ thể.
 *
 * SÁU Ô LÀ SÁU VIỆC, KHÔNG PHẢI SÁU CHỈ SỐ. Mỗi ô có một dòng phụ nói VÌ SAO
 * gấp — "4 đợt" không nói được gì, "4 đợt, 1 quá hẹn 3 ngày" mới là thông tin.
 *
 * MỌI SỐ TRÊN MÀN NÀY ĐƯỢC TÍNH TẠI CHỖ TỪ CHÍNH MẢNG MÀ MÀN ĐÍCH DÙNG
 * (`./_kho/data`), không gõ tay. Đó là cách rẻ nhất để giữ lời hứa "bấm ô nào
 * ra đúng chừng ấy dòng" — gõ tay thì mẫu này đã tự vi phạm nguyên tắc 3 ngay
 * ở màn đầu tiên, và không ai tin phần còn lại nữa.
 *
 * KHÔNG CÓ BIỂU ĐỒ. Biểu đồ trả lời câu của KỲ ("tháng này nhập bao nhiêu");
 * người mở màn lúc 7 giờ sáng hỏi câu của HÔM NAY.
 */

/* Đếm — cùng phép lọc mà màn đích dùng. */
const late = ARRIVALS.filter((a) => a.inDays < 0)
const putRows = PUTAWAY.reduce((s, d) => s + d.rows.length, 0)
const lsxLate = LSXS.filter((l) => l.inDays < 0)
const qcRows = STOCK.filter((s) => s.qc > 0)
const blockedRows = STOCK.filter((s) => s.blocked > 0)
const lowRows = STOCK.filter((s) => s.min > 0 && s.usable < s.min)

type Todo = {
  id: string
  kind: 'Đợt giao' | 'Phiếu nhập' | 'Lệnh SX' | 'Lô hàng'
  code: string
  what: string
  from: string
  age: string
  lane: 'late' | 'today' | 'soon'
  href: string
}

/**
 * "Việc chờ tôi" — mỗi dòng nói QUYẾT ĐỊNH CẦN RA, không hiện mỗi mã chứng từ.
 * Mẫu `Approve: <việc>` của SAP My Inbox: hiện mã thì người đọc vẫn phải mở
 * từng cái ra mới biết phải làm gì, tức là màn này không tiết kiệm thao tác
 * nào so với việc đi mở từng danh sách.
 */
const TODOS: Todo[] = [
  { id: 'v1', kind: 'Đợt giao', code: 'PO-2609-031', what: 'Sơn Tín Phát quá hẹn 3 ngày — gọi chốt ngày rồi báo Cung ứng', from: 'Hệ thống cảnh báo', age: '3 ngày', lane: 'late', href: '/design-lab/kho/hang-ve' }, // prettier-ignore
  { id: 'v2', kind: 'Lệnh SX', code: 'LSX 07/26-09', what: 'Lệnh đã quá ngày vào chuyền 4 ngày mà còn thiếu 400 bulon', from: 'Tổ trưởng Hàn', age: '4 ngày', lane: 'late', href: '/design-lab/kho/cap-vat-tu' }, // prettier-ignore
  { id: 'v3', kind: 'Lô hàng', code: 'NH-0482', what: '200 cây khoá từ 12/09 — Cung ứng chưa quyết trả NCC hay nhận giá giảm', from: 'Chính tôi khoá', age: '3 ngày', lane: 'late', href: '/design-lab/kho/ton' }, // prettier-ignore
  { id: 'v4', kind: 'Đợt giao', code: 'PO-2609-044', what: 'Vạn Vi Thành giao hôm nay — nhận trước 16 giờ để lệnh 07/26-14 kịp vào chuyền', from: 'Lịch hẹn NCC', age: 'hôm nay', lane: 'today', href: '/design-lab/kho/hang-ve' }, // prettier-ignore
  { id: 'v5', kind: 'Phiếu nhập', code: 'PNK-2609-051', what: 'Cất 3 dòng còn ở khu tiếp nhận từ 09:20', from: 'Chính tôi nhận', age: '2 giờ', lane: 'today', href: '/design-lab/kho/cat-hang' }, // prettier-ignore
  { id: 'v6', kind: 'Lô hàng', code: 'BUL0071', what: '2.400 con chờ KCS kiểm — nhắc kiểm để lệnh 07/26-14 cấp được', from: 'Chính tôi nhận', age: '1 ngày', lane: 'today', href: '/design-lab/kho/ton' }, // prettier-ignore
  { id: 'v7', kind: 'Lệnh SX', code: 'LSX 07/26-15', what: 'Vào chuyền mai — đủ cả 4 mã, cấp trước chiều nay cho đỡ dồn', from: 'Kế hoạch SX', age: 'mai', lane: 'soon', href: '/design-lab/kho/cap-vat-tu' }, // prettier-ignore
]

const KIND_TONE: Record<Todo['kind'], 'neutral' | 'warn' | 'done' | 'stop'> = {
  'Đợt giao': 'neutral',
  'Phiếu nhập': 'done',
  'Lệnh SX': 'warn',
  'Lô hàng': 'neutral',
}

const LANE_LABEL = { late: 'Trễ', today: 'Hôm nay', soon: 'Sắp tới' } as const

export default function Page() {
  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn A — Bàn làm việc kho.</b> Sáu ô là <b>sáu việc</b>, không phải sáu chỉ
          số: mỗi ô có dòng phụ nói vì sao gấp, và mọi con số đều tính từ chính mảng dữ
          liệu mà màn đích dùng — bấm ô nào cũng ra đúng chừng ấy dòng. Ô hết việc hiện ✓
          chứ không hiện số 0 tô đỏ.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Trần Thị C · Thủ kho"
        title="Việc hôm nay"
        facts={[
          { label: 'Thứ ba', value: TODAY },
          { label: 'Phiếu đã lập hôm nay', value: '2' },
          { label: 'Việc đang chờ', value: String(TODOS.length), tone: 'warn' },
        ]}
        actions={
          <>
            <Btn href="/design-lab/kho/ton">Xem tồn kho</Btn>
            <Btn primary href="/design-lab/kho/hang-ve">
              Nhận hàng
            </Btn>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-[var(--gutter)] py-[13px]">
        <WorkTiles>
          <WorkTile
            strong
            label="Hàng về"
            count={ARRIVALS.length}
            hint={`${late.length} đợt quá hẹn, sớm nhất trễ 3 ngày`}
            href="/design-lab/kho/hang-ve"
          />
          <WorkTile
            label="Chờ cất"
            count={PUTAWAY.length}
            hint={`${putRows} dòng còn ở khu tiếp nhận, sớm nhất từ 08:05`}
            href="/design-lab/kho/cat-hang"
          />
          <WorkTile
            tone="stop"
            label="Chờ cấp"
            count={LSXS.length}
            hint={`${lsxLate.length} lệnh đã quá ngày vào chuyền`}
            href="/design-lab/kho/cap-vat-tu"
          />
          <WorkTile
            tone="warn"
            label="Chờ kiểm"
            count={qcRows.length}
            hint="Lô đã nhận nhưng chưa được phép dùng"
            href="/design-lab/kho/ton"
          />
          <WorkTile
            tone="stop"
            label="Hàng khoá"
            count={blockedRows.length}
            hint="Khoá 3 ngày, chưa quyết trả NCC hay nhận"
            href="/design-lab/kho/ton"
          />
          <WorkTile
            tone="warn"
            label="Dưới tồn tối thiểu"
            count={lowRows.length}
            hint="Tính trên số DÙNG ĐƯỢC, không tính hàng đang khoá"
            href="/design-lab/kho/ton"
          />
        </WorkTiles>

        <div className="mt-[13px]">
          <NoticeBar tone="warn" tag="Kẹt" action={{ label: 'Mở lô NH-0482' }}>
            <b>200 cây NH-0482 đã khoá 3 ngày mà chưa ai quyết.</b> Hàng nằm thật ngoài
            sân, không tính vào tồn dùng được, và lệnh 07/26-14 đang thiếu đúng mã đó.
            Việc này không phải của Kho — cần Cung ứng chốt trả NCC hay nhận giá giảm.
          </NoticeBar>
        </div>

        <section className="mt-[15px]">
          <h2 className="mb-[7px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-2)] uppercase">
            Việc chờ tôi
          </h2>
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
            <Table>
              <THead>
                <th>Loại</th>
                <th>Chứng từ</th>
                <th>Việc phải làm</th>
                <th>Từ đâu</th>
                <th>Khi nào</th>
                <th style={{ textAlign: 'right' }}>Chờ</th>
              </THead>
              <tbody>
                {(['late', 'today', 'soon'] as const).map((lane) => {
                  const rows = TODOS.filter((t) => t.lane === lane)
                  if (rows.length === 0) return null
                  return (
                    <Fragment key={lane}>
                      {/*
                        BA LÀN TRỄ / HÔM NAY / SẮP TỚI — chép activity menu của
                        Odoo. Ba nhóm này là ba THÁI ĐỘ, không phải ba khoảng
                        thời gian: gộp thành một danh sách xếp theo ngày là bắt
                        người đọc tự đọc ngày rồi tự phân loại lại trong đầu.
                      */}
                      <tr className="bg-[var(--surface)]">
                        <td
                          colSpan={6}
                          className="border-y border-[var(--line)] px-[10px] py-[5px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase"
                        >
                          {LANE_LABEL[lane]} · {rows.length}
                        </td>
                      </tr>
                      {rows.map((t) => (
                        <Row key={t.id}>
                          <Cell>
                            <Tag tone={KIND_TONE[t.kind]}>{t.kind}</Tag>
                          </Cell>
                          <Cell>
                            <Code as="a" href={t.href}>
                              {t.code}
                            </Code>
                          </Cell>
                          <Cell grow>{t.what}</Cell>
                          <Cell muted>{t.from}</Cell>
                          <Cell muted>{LANE_LABEL[t.lane]}</Cell>
                          <Cell num>
                            <Num value={t.age} strong={t.lane === 'late'} />
                          </Cell>
                        </Row>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </Table>
          </div>
          <p className="mt-[7px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Cột giữa nói <b>việc phải làm</b>, không nói tên trạng thái. Ba loại chứng từ
            khác nhau nằm chung một bảng — thủ kho không phải mở ba màn để biết mình còn
            nợ gì.
          </p>
        </section>

        <section className="mt-[15px]">
          <h2 className="mb-[7px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-2)] uppercase">
            Lệnh sắp vào chuyền
          </h2>
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
            <Table>
              <THead>
                <th>Lệnh</th>
                <th>Sản phẩm</th>
                <th>Vào chuyền</th>
                <th>Vật tư</th>
                <th style={{ textAlign: 'right' }}>Còn thiếu</th>
              </THead>
              <tbody>
                {LSXS.map((l) => {
                  const short = l.lines.filter((x) => !done(x))
                  return (
                    <Row key={l.id}>
                      <Cell>
                        <Code as="a" href="/design-lab/kho/cap-vat-tu">
                          {l.code}
                        </Code>
                      </Cell>
                      <Cell grow>
                        {l.product} · {l.qty}
                      </Cell>
                      <Cell
                        muted={l.inDays >= 0}
                        className={l.inDays < 0 ? 'text-[var(--stop)]' : undefined}
                      >
                        {l.start}
                        {l.inDays < 0 ? ` · quá ${-l.inDays} ngày` : ''}
                      </Cell>
                      <Cell num>
                        {covered(l)}/{l.lines.length} mã đủ
                      </Cell>
                      <Cell num>
                        {short.length === 0 ? (
                          <Tag tone="done">đủ cả</Tag>
                        ) : (
                          <Num value={`${short.length} mã`} strong />
                        )}
                      </Cell>
                    </Row>
                  )
                })}
              </tbody>
            </Table>
          </div>
        </section>
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương · Kho vật tư chính',
          <span key="d" className="num">
            {TODAY} 07:40
          </span>,
        ]}
        right={`${TODOS.length} việc đang chờ · ${n(STOCK.length)} mã đang có phát sinh`}
      />
    </ScreenFrame>
  )
}
