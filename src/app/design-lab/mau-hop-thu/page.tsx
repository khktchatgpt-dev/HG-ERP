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
import { LabNote } from '../_lab/Doc'

/**
 * KHUÔN B — HỘP THƯ VIỆC.
 *
 * Trả lời: "việc nào đang chờ chính tôi, ở MỌI loại chứng từ?".
 * Chép SAP My Inbox, Dynamics centralized work list và activity menu của Odoo.
 *
 * ĐÂY LÀ KHUÔN LẤP LỖ HỔNG SỐ 1 ĐO ĐƯỢC NGÀY 09/09/2026: hộp thư việc của
 * HG-ERP đang bị nhốt trong một phòng — `countMyTodos` chỉ đếm đơn đặt vật tư
 * có `assigned_to = tôi`. Người vừa lo mua hàng vừa lo kho phải mở hai khu và
 * tự nhớ mình còn nợ gì bên kia. Cả ba hệ lớn đều làm hộp thư XUYÊN mọi loại
 * chứng từ, và đó chính là điểm khác biệt của khuôn này so với Khuôn C: danh
 * sách hỏi "cái nào trong tập này", hộp thư hỏi "cái nào của tôi, ở khắp nơi".
 *
 * BỐN THỨ LÀM NÊN KHUÔN NÀY:
 *
 *  1. XUYÊN LOẠI CHỨNG TỪ. Cột đầu phải nói rõ đây là đơn mua hay lệnh sản
 *     xuất hay phiếu kho, vì người đọc không còn ngữ cảnh của một danh sách.
 *  2. BA LÀN TRỄ / HÔM NAY / SẮP TỚI. Ba nhóm này là ba THÁI ĐỘ khác nhau;
 *     gộp thành một danh sách xếp theo ngày là mất thông tin — người dùng
 *     phải tự đọc ngày rồi tự phân loại lại trong đầu.
 *  3. DÒNG NÓI QUYẾT ĐỊNH CẦN RA, không hiện mỗi mã. Mẫu `Approve: <việc>`
 *     của SAP: hiện mã thì vẫn phải mở từng cái ra mới biết phải làm gì.
 *  4. KHAY KIỂM TRA GIỮ CHỖ ĐỨNG. Bấm một dòng mà bị đẩy sang trang khác là
 *     mất vị trí — quay lại phải cuộn tìm đúng dòng vừa xem. Với việc "rà
 *     qua một danh sách", giữ nguyên vị trí quan trọng hơn màn chi tiết rộng.
 *
 * Khay ẩn dưới 1280px (`xl:flex` trong kit): dưới ngưỡng đó nó bóp bảng quá
 * nhiều, lúc ấy mới đáng đánh đổi sang trang riêng.
 */

type Kind = 'Đơn mua' | 'Lệnh SX' | 'Phiếu nhập' | 'Đơn khách' | 'Hồ sơ SP'

type Task = {
  id: string
  kind: Kind
  code: string
  /** Quyết định cần ra, viết bằng lời nghiệp vụ. */
  what: string
  from: string
  due: string
  /** Âm = quá hạn bấy nhiêu ngày, 0 = hôm nay, dương = còn bấy nhiêu ngày. */
  inDays: number
  /** Số ngày nằm ở bước này không đổi. */
  held: number
}

const TASKS: Task[] = [
  { id: 't1', kind: 'Đơn mua', code: 'PO-2608-088', what: 'Gọi Vải Phú Hưng — quá hạn giao 8 ngày, chưa có phản hồi', from: 'Hệ thống cảnh báo', due: '02/09/2026', inDays: -8, held: 15 }, // prettier-ignore
  { id: 't2', kind: 'Đơn mua', code: 'PO-2608-097', what: 'Chốt lại hạn giao với Gỗ Trường Thịnh', from: 'Hệ thống cảnh báo', due: '05/09/2026', inDays: -5, held: 12 }, // prettier-ignore
  { id: 't3', kind: 'Lệnh SX', code: 'LSX 06/26-27', what: 'Xác nhận đủ vật tư để cho lệnh vào chuyền', from: 'Trần Văn K · Sản xuất', due: '08/09/2026', inDays: -2, held: 6 }, // prettier-ignore
  { id: 't4', kind: 'Đơn mua', code: 'PO-2609-014', what: 'Nhập đơn giá dòng NK-0056 rồi gửi Giám đốc duyệt', from: 'Chính tôi soạn', due: '10/09/2026', inDays: 0, held: 8 }, // prettier-ignore
  { id: 't5', kind: 'Phiếu nhập', code: 'PN-2609-031', what: 'Kho báo lệch 24 m thép hộp — xác nhận nhận thiếu hay đặt bù', from: 'Trần Thị C · Kho', due: '10/09/2026', inDays: 0, held: 2 }, // prettier-ignore
  { id: 't6', kind: 'Đơn khách', code: 'ĐH-2608-31', what: 'Xác nhận ngày giao đợt 2 cho MERXX', from: 'Nguyễn Thị Nga · Bán hàng', due: '10/09/2026', inDays: 0, held: 1 }, // prettier-ignore
  { id: 't7', kind: 'Đơn mua', code: 'PO-2609-021', what: 'Bổ sung báo giá Sơn Đại Việt trước khi gửi duyệt', from: 'Chính tôi soạn', due: '12/09/2026', inDays: 2, held: 6 }, // prettier-ignore
  { id: 't8', kind: 'Hồ sơ SP', code: 'HG-2410-AB', what: 'Kỹ thuật hỏi lại quy cách thép hộp — trả lời để họ khoá hồ sơ', from: 'Lê Tú Thức · Kỹ thuật', due: '14/09/2026', inDays: 4, held: 1 }, // prettier-ignore
  { id: 't9', kind: 'Đơn mua', code: 'PO-2609-018', what: 'Đối chiếu 12 dòng với định mức LSX 07/26-14 rồi gửi duyệt', from: 'Chính tôi soạn', due: '15/09/2026', inDays: 5, held: 7 }, // prettier-ignore
]

const KIND_TONE: Record<Kind, 'neutral' | 'warn' | 'done' | 'stop'> = {
  'Đơn mua': 'neutral',
  'Lệnh SX': 'warn',
  'Phiếu nhập': 'done',
  'Đơn khách': 'neutral',
  'Hồ sơ SP': 'neutral',
}

/**
 * Ba làn = ba thái độ, không phải ba khoảng thời gian.
 *
 * `tone: 'stop'` chỉ đặt cho làn Trễ: nếu làn nào cũng có màu thì màu hết là
 * tín hiệu, đúng lỗi badge đỏ mà v3 từng mắc.
 */
const LANES = toLanes(TASKS, [
  { id: 'late', label: 'Trễ', tone: 'stop', test: (t: Task) => t.inDays < 0 },
  { id: 'today', label: 'Hôm nay', test: (t: Task) => t.inDays === 0 },
  { id: 'soon', label: 'Sắp tới', test: (t: Task) => t.inDays > 0 },
])

export default function Page() {
  const [lane, setLane] = useState('late')
  const [pick, setPick] = useState<string | null>('t1')

  const rows = LANES.find((l) => l.id === lane)?.rows ?? []
  const sel = TASKS.find((t) => t.id === pick) ?? null
  const visible = rows.some((r) => r.id === pick) ? sel : null

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn B — Hộp thư việc.</b> Chín dòng dưới đây thuộc{' '}
          <b>năm loại chứng từ khác nhau</b> — đó là điểm khác biệt với trang danh sách.
          Bấm một dòng thì khay bên phải mở ra tại chỗ, danh sách không chạy đi đâu. Khay
          tự ẩn dưới 1280px.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Hộp thư việc · Nguyễn Văn A"
        title="Chờ tôi xử lý"
        facts={[
          { label: 'Tổng việc', value: String(TASKS.length) },
          { label: 'Đã trễ', value: String(LANES[0].rows.length), tone: 'stop' },
          { label: 'Loại chứng từ', value: '5' },
        ]}
        actions={<Btn href="/design-lab/mau-vao-viec">Về trang vào việc</Btn>}
      >
        <WorkLanes lanes={LANES} activeId={lane} onPick={setLane} />
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Làn này đang trống"
              reason="Không có việc nào rơi vào khoảng thời gian của làn đang chọn."
              next={<Btn onClick={() => setLane('late')}>Xem làn Trễ</Btn>}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <th>Loại</th>
              <th>Chứng từ</th>
              <th>Quyết định cần ra</th>
              <th>Ai đẩy sang</th>
              <th>Hạn</th>
              <th style={{ textAlign: 'right' }}>Nằm im</th>
            </THead>
            <tbody>
              {rows.map((t) => (
                <Row key={t.id} selected={t.id === pick} onClick={() => setPick(t.id)}>
                  <Cell>
                    <Tag tone={KIND_TONE[t.kind]}>{t.kind}</Tag>
                  </Cell>
                  <Cell>
                    <Code>{t.code}</Code>
                  </Cell>
                  <Cell grow>{t.what}</Cell>
                  <Cell muted>{t.from}</Cell>
                  <Cell num className={t.inDays < 0 ? 'text-[var(--stop)]' : undefined}>
                    {t.due}
                  </Cell>
                  <Cell num>
                    <Num value={`${t.held} ngày`} strong={t.held >= 8} />
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}

        {visible && (
          <InspectPanel
            code={visible.code}
            title={visible.what}
            subtitle={`${visible.kind} · hạn ${visible.due}`}
            actions={
              <>
                <PrimaryStep
                  label={
                    visible.id === 't4' ? 'Gửi Giám đốc duyệt' : 'Mở chứng từ để xử lý'
                  }
                  href={visible.id === 't4' ? undefined : '/design-lab/mau-erp'}
                  blockedBy={
                    visible.id === 't4' ? 'còn 2 lỗi chặn trên chứng từ' : undefined
                  }
                  why={
                    visible.id === 't4'
                      ? 'Dòng NK-0056 chưa có đơn giá, và đơn trên 100 triệu cần duyệt hạn mức.'
                      : undefined
                  }
                />
                <Btn>Chuyển việc cho người khác</Btn>
              </>
            }
          >
            <InspectSection title="Đến lượt ai">
              <NextAction
                mine
                holder="Cung ứng — Nguyễn Văn A"
                what={visible.what}
                days={visible.held}
                hint={
                  visible.held >= 8
                    ? 'Nằm ở bước này quá lâu. Nếu đang chờ bên ngoài thì ghi lý do vào chứng từ để người khác khỏi hỏi lại.'
                    : undefined
                }
              />
            </InspectSection>

            <InspectSection title="Vì sao việc này gấp">
              <WhyBox
                lines={
                  visible.inDays < 0
                    ? [
                        `hạn ${visible.due}`,
                        `hôm nay 10/09/2026`,
                        `quá hạn ${-visible.inDays} ngày`,
                        `nằm im ${visible.held} ngày`,
                      ]
                    : [
                        `hạn ${visible.due}`,
                        `hôm nay 10/09/2026`,
                        `còn ${visible.inDays} ngày`,
                      ]
                }
                result={
                  visible.inDays < 0
                    ? `trễ ${-visible.inDays} ngày`
                    : visible.inDays === 0
                      ? 'đến hạn hôm nay'
                      : `còn ${visible.inDays} ngày`
                }
              />
              <p className="mt-[9px] text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                Phép tính bày nguyên văn để người dùng kiểm được. Số không kiểm được thì
                không ai tin, và họ mở Excel tính tay.
              </p>
            </InspectSection>

            <InspectSection title="Chuỗi chứng từ">
              <DocChain
                links={[
                  { label: 'Đơn khách', code: 'ĐH-2608-31', href: '/design-lab/mau-erp' },
                  { label: 'Lệnh SX', code: 'LSX 06/26-27', href: '/design-lab/mau-erp' },
                  { label: visible.kind, code: visible.code, muted: true },
                ]}
              />
            </InspectSection>
          </InspectPanel>
        )}
      </div>

      <StatusBar
        left={[
          <>
            <b>Nguyễn Văn A</b> · Cung ứng
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương',
        ]}
        right={`${rows.length} việc trong làn · ${TASKS.length} tổng`}
      />
    </ScreenFrame>
  )
}
