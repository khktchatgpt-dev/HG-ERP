'use client'

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

/**
 * KHUÔN A — TRANG VÀO VIỆC.
 *
 * Trả lời: "hôm nay tôi phải làm gì?". Chép SAP Fiori launchpad và Dynamics
 * 365 workspace. Đây là màn người dùng mở ĐẦU TIÊN mỗi sáng, và là màn duy
 * nhất họ tới khi trong đầu chưa có chứng từ nào cụ thể.
 *
 * BA LUẬT CỦA Ô VIỆC — chép nguyên văn từ tài liệu SAP, không phải ý tôi:
 *
 *  1. Ô là CỬA VÀO VIỆC, không phải chỉ số. Mỗi ô dẫn tới một danh sách đã
 *     lọc sẵn đúng điều kiện nó vừa đếm. "Xem báo cáo" không phải việc.
 *  2. SỐ 0 KHÔNG PHẢI LÚC NÀO CŨNG XẤU. "Đơn quá hạn: 0" là tin mừng — kit
 *     hiện dấu ✓ thay vì số 0, và bỏ hết màu cảnh báo.
 *  3. Ô nói VIỆC PHẢI LÀM, không nói tên trạng thái: "Chờ Giám đốc ký" chứ
 *     không phải "pending_approval".
 *
 * VÌ SAO KHÔNG CÓ BIỂU ĐỒ Ở ĐÂY: biểu đồ trả lời câu hỏi của KỲ ("tháng này
 * mua hết bao nhiêu"), còn người mở màn lúc 8 giờ sáng hỏi câu của HÔM NAY.
 * Đặt biểu đồ lên đây là lấy mất chỗ của thứ họ thật sự cần, và đó là lý do
 * dashboard nội bộ ở đâu cũng bị bỏ sau tuần đầu.
 *
 * Số liệu theo hình dạng CSDL thật 09/09/2026.
 */

type Hot = {
  code: string
  what: string
  who: string
  age: number
  tone: 'stop' | 'warn' | 'neutral'
  tag: string
}

/**
 * "Cần quyết hôm nay" — KHÔNG phải bảng danh sách thu nhỏ.
 *
 * Mỗi dòng nói ra QUYẾT ĐỊNH cần ra, theo mẫu `Approve: <việc>` của SAP My
 * Inbox: hiện mỗi mã chứng từ thì người đọc vẫn phải mở từng cái ra mới biết
 * mình phải làm gì, tức là màn này không tiết kiệm được thao tác nào.
 */
const HOT: Hot[] = [
  { code: 'PO-2608-088', what: 'Gọi NCC Vải Phú Hưng — quá hạn giao 8 ngày, chưa có phản hồi', who: 'Nguyễn Văn A', age: 15, tone: 'stop', tag: 'Đã gửi NCC' }, // prettier-ignore
  { code: 'PO-2608-097', what: 'Chốt lại hạn giao với Gỗ Trường Thịnh trước khi LSX 06/26-27 vào chuyền', who: 'Nguyễn Văn A', age: 12, tone: 'stop', tag: 'Đã gửi NCC' }, // prettier-ignore
  { code: 'PO-2609-014', what: 'Nhập đơn giá dòng NK-0056 rồi gửi Giám đốc duyệt', who: 'Nguyễn Văn A', age: 8, tone: 'warn', tag: 'Nháp' }, // prettier-ignore
  { code: 'LSX 07/26-14', what: 'Xác nhận đủ vật tư để mở lệnh — còn 3 mã chưa có đơn mua', who: 'Nguyễn Văn A', age: 4, tone: 'warn', tag: 'Chờ vật tư' }, // prettier-ignore
  { code: 'PN-2609-031', what: 'Kho báo lệch 24 m thép hộp so với đơn — xác nhận nhận thiếu hay đặt bù', who: 'Trần Thị C', age: 2, tone: 'neutral', tag: 'Chờ tôi xác nhận' }, // prettier-ignore
]

export default function Page() {
  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn A — Trang vào việc.</b> Sáu ô đầu trang là <b>cửa vào việc</b>, không
          phải chỉ số: bấm ô nào cũng ra đúng chừng ấy dòng cần xử lý. Ô “Hàng về hôm nay”
          đang hết việc nên hiện dấu ✓ chứ không hiện số 0 — số 0 tô đỏ làm người ta hoảng
          vô cớ.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Cung ứng · Nguyễn Văn A"
        title="Việc hôm nay"
        facts={[
          { label: 'Thứ tư', value: '10/09/2026' },
          { label: 'Đơn đang mở', value: '68' },
          { label: 'Đơn nằm im ≥ 3 ngày', value: '66', tone: 'stop' },
        ]}
        actions={
          <>
            <Btn href="/design-lab/mau-danh-sach">Mở danh sách đơn</Btn>
            <Btn primary href="/design-lab/mau-erp">
              + Đơn mới
            </Btn>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-[var(--gutter)] py-[13px]">
        <WorkTiles>
          <WorkTile
            strong
            label="Chờ tôi soạn xong"
            count={4}
            hint="Đơn nháp tôi phụ trách, chưa gửi duyệt"
            href="/design-lab/mau-danh-sach"
          />
          <WorkTile
            tone="stop"
            label="NCC trễ hẹn"
            count={3}
            hint="Đã gửi NCC, quá hạn giao, chưa nhận đủ"
            href="/design-lab/mau-danh-sach"
          />
          <WorkTile
            tone="warn"
            label="Chờ Giám đốc ký"
            count={2}
            hint="Tôi gửi, đang nằm ở bàn duyệt"
            href="/design-lab/mau-hop-thu"
          />
          <WorkTile
            label="Lệnh thiếu vật tư"
            count={7}
            hint="LSX đang mở mà còn mã chưa có đơn mua"
            href="/design-lab/mau-danh-sach"
          />
          <WorkTile
            tone="warn"
            label="Kho chờ tôi xác nhận"
            count={1}
            hint="Phiếu nhập lệch so với đơn"
            href="/design-lab/mau-hop-thu"
          />
          <WorkTile
            label="Hàng về hôm nay"
            count={0}
            hint="Đợt giao hẹn đúng ngày 10/09"
            href="/design-lab/mau-danh-sach"
          />
        </WorkTiles>

        <div className="mt-[13px]">
          <NoticeBar tone="stop" tag="Tồn đọng" action={{ label: 'Xem 66 đơn' }}>
            <b>66 trên 68 đơn không thay đổi gì trong 5–7 ngày.</b> Không phải đơn nào
            cũng hỏng, nhưng không màn nào đang nói ra điều đó nên không ai biết mà hỏi.
            Đây là số đo thật ngày 09/09/2026, không phải ví dụ.
          </NoticeBar>
        </div>

        <section className="mt-[15px]">
          <h2 className="mb-[7px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-2)] uppercase">
            Cần tôi quyết hôm nay
          </h2>
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
            <Table>
              <THead>
                <th>Chứng từ</th>
                <th>Quyết định cần ra</th>
                <th>Trạng thái</th>
                <th>Người giữ</th>
                <th style={{ textAlign: 'right' }}>Nằm im</th>
              </THead>
              <tbody>
                {HOT.map((h) => (
                  <Row key={h.code}>
                    <Cell>
                      <Code as="a" href="/design-lab/mau-erp">
                        {h.code}
                      </Code>
                    </Cell>
                    <Cell grow>{h.what}</Cell>
                    <Cell>
                      <Tag tone={h.tone === 'neutral' ? 'neutral' : h.tone}>{h.tag}</Tag>
                    </Cell>
                    <Cell muted>{h.who}</Cell>
                    <Cell num>
                      <Num value={`${h.age} ngày`} strong={h.age >= 8} />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="mt-[7px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Cột giữa nói <b>quyết định cần ra</b>, không nói tên trạng thái. Hiện mỗi mã
            chứng từ thì người đọc vẫn phải mở từng cái mới biết phải làm gì — lúc đó màn
            này không tiết kiệm được thao tác nào.
          </p>
        </section>
      </div>

      <StatusBar
        left={[
          <>
            <b>Nguyễn Văn A</b> · Cung ứng
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương',
          <span key="d" className="num">
            10/09/2026 08:15
          </span>,
        ]}
        right="17 việc đang chờ"
      />
    </ScreenFrame>
  )
}
