'use client'

import { useState } from 'react'
import {
  Action,
  ActionGroup,
  ActionPane,
  Affected,
  AuditTable,
  Btn,
  Checks,
  Code,
  CommitBar,
  Consequence,
  Count,
  CoverageBar,
  Crumb,
  DocChain,
  DocHead,
  Empty,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Followers,
  Grid,
  GridBody,
  GridBtn,
  GridCheck,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  HeadChip,
  HeadChips,
  HolderBar,
  LineStatus,
  Loading,
  MasterWarn,
  Metric,
  MetricStrip,
  NextAction,
  NoteComposer,
  NoteStream,
  NoticeBar,
  Num,
  NumInput,
  PermHint,
  PrimaryStep,
  Sheet,
  SheetActions,
  StageBar,
  StatusBar,
  StatusTrack,
  Td,
  Th,
  Timeline,
  Tip,
  type Mark,
  type StreamRow,
} from '@/components/kit'
import { Doc, Hero, Sec } from '../_lab/Doc'

/**
 * THƯ VIỆN THÀNH PHẦN.
 *
 * Trang này là chỗ TRA CỨU, không phải chỗ học. Người mới nên đọc
 * `/design-lab` trước để chọn khuôn màn, rồi mới xuống đây tìm mảnh.
 *
 * XẾP THEO VIỆC, KHÔNG XẾP THEO FILE. Kit chia file theo kỹ thuật
 * (Erp/Table/Flow/Notes/Sheet/Primitives), nhưng người dựng màn không nghĩ
 * theo file — họ nghĩ "tôi cần bày một con số cho người ta kiểm được" hoặc
 * "tôi cần chặn một nút và nói vì sao". Nên các mục dưới đây gom theo câu hỏi
 * đó, và tên file chỉ ghi kèm.
 *
 * ĐO 10/09/2026, trước và sau:
 *
 *   · sổ cũ dựng THẬT 22 / 82 export của kit. 60 thứ không có chỗ tra, gồm gần
 *     như toàn bộ mảng danh sách, hộp thư, trao đổi và hộp xác nhận — tức là
 *     mọi thứ ngoài màn chứng từ.
 *   · sổ này cộng sáu màn mẫu dựng thật 77 / 82.
 *
 * Năm cái còn lại (`NavRail`, `TopBar`, `CommandBar`, `Menu`, `UserCard`) CỐ Ý
 * chỉ ghi bằng chữ ở mục 10: chúng thuộc VỎ ứng dụng, do layout workspace dựng
 * một lần. Demo một thanh điều hướng giả bên trong sổ thì người đọc tưởng màn
 * nghiệp vụ được phép tự vẽ lại thanh điều hướng của mình.
 */

const NOW = new Date('2026-09-10T08:15:00+07:00')

const MARKS: Mark[] = [
  {
    key: 'tao',
    at: '2026-09-01T09:02:00+07:00',
    label: 'Tạo đơn',
    actor: 'Nguyễn Văn A',
  },
  { key: 'gia', at: '2026-09-02T14:20:00+07:00', label: 'Sửa đơn giá CN1527', actor: 'Nguyễn Văn A', detail: '352.000 → 369.600' }, // prettier-ignore
  { key: 'han', at: '2026-09-05T16:10:00+07:00', label: 'Dời hạn giao', actor: 'Lê Văn D', detail: '05/09 → 07/09', tone: 'warn' }, // prettier-ignore
  { key: 'duyet', at: null, label: 'Giám đốc duyệt', tone: 'act' },
  { key: 'gui', at: null, label: 'Gửi nhà cung cấp' },
]

const STREAM: StreamRow[] = [
  {
    kind: 'note',
    at: '2026-09-09T16:40:00+07:00',
    note: {
      id: 'n1',
      body: 'Bên Thành Đạt báo hết vít 7 màu, hẹn tuần sau mới có. Có nên tách dòng đó ra đơn khác để phần còn lại đi trước không?',
      author_name: 'Nguyễn Văn A',
      audience: 'internal',
      created_at: '2026-09-09T16:40:00+07:00',
      mine: true,
    },
  },
  {
    kind: 'mark',
    at: '2026-09-05T16:10:00+07:00',
    key: 'han',
    label: 'Dời hạn giao 05/09 → 07/09',
    actor: 'Lê Văn D',
  },
  {
    kind: 'note',
    at: '2026-09-03T09:15:00+07:00',
    note: {
      id: 'n2',
      body: 'Xác nhận đã nhận đơn, giao đợt đầu ngày 07/09.',
      author_name: 'Trần B · Cơ khí Thành Đạt',
      audience: 'partner',
      created_at: '2026-09-03T09:15:00+07:00',
    },
  },
]

export default function Page() {
  const [sheet, setSheet] = useState(false)
  const [qty, setQty] = useState('68')
  const [muted, setMuted] = useState(false)
  const [ticked, setTicked] = useState(true)

  return (
    <Doc>
      <Hero eyebrow="Sổ thiết kế · Tra cứu" title="Thư viện thành phần">
        <p className="lab-deck">
          Xếp <b>theo việc cần làm</b>, không theo file. Người dựng màn không nghĩ “tôi
          cần thứ trong Primitives.tsx”, họ nghĩ “tôi cần bày một con số cho người ta kiểm
          được”.
        </p>
        <p className="lab-deck">
          Mọi thứ ở đây import từ <code>@/components/kit</code> — cửa vào duy nhất. Đừng
          import thẳng file con: đổi cấu trúc bên trong thì nơi dùng không phải sửa.
        </p>
      </Hero>

      <Sec
        n={1}
        id="chung-tu"
        title="Khung chứng từ"
        why="Mười mảnh dựng nên Khuôn D. Xem chúng ráp lại thành một màn hoàn chỉnh ở /design-lab/mau-erp. Từ 10/09/2026 khung mặc định PHẲNG: FastTab là khối ngăn bằng một vạch mảnh, FactBox là panel một vạch dọc, DocBody không đệm — không còn thẻ nổi bo góc, vì thẻ nổi là thứ làm màn Đơn mua thật 'vẫn có khoảng rộng xung quanh'."
      >
        <div className="lab-demo">
          <Crumb
            path={['Cung ứng', 'Đơn đặt vật tư', 'PO-2609-014']}
            view="Đơn của tôi · quá hạn"
            position={[14, 68]}
          />
          <ActionPane
            tabs={[{ label: 'Đơn hàng', active: true }, { label: 'Nhận hàng' }]}
          >
            <ActionGroup label="Duy trì">
              <Action strong>Sửa</Action>
              <Action>Sao chép</Action>
            </ActionGroup>
            <ActionGroup label="Luồng phê duyệt">
              <Action primary disabled title="Còn 2 lỗi chặn">
                Gửi duyệt
              </Action>
              <Action>Trả lại người soạn</Action>
            </ActionGroup>
          </ActionPane>
          <DocHead
            kind="Đơn đặt vật tư"
            code="PO-2609-014"
            sub="Cơ khí Thành Đạt · soạn 01/09/2026 bởi Nguyễn Văn A"
          >
            <StatusTrack
              label="Trạng thái đơn"
              steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi NCC']}
              at={0}
            />
            <StatusTrack
              label="Nhận hàng"
              steps={['Chưa nhận', 'Một phần', 'Đủ']}
              at={0}
            />
          </DocHead>
          <HolderBar
            mine
            who="Cung ứng — Nguyễn Văn A"
            what="Soạn xong thì gửi Giám đốc duyệt"
            age="8 ngày"
          />
          <Checks
            title="Chưa gửi duyệt được"
            items={[
              { level: 'stop', what: 'Dòng 2 — NK-0056 chưa có đơn giá', fix: 'Nhập giá hoặc đánh dấu “chờ báo giá”' }, // prettier-ignore
              { level: 'warn', what: 'Hạn giao 07/09/2026 đã qua 2 ngày', fix: 'Cập nhật hạn hoặc ghi lý do trễ' }, // prettier-ignore
            ]}
          />
          <div className="lab-pad">
            <FastTab
              title="Tổng quan"
              defaultOpen
              summary={[
                ['Kho nhận', 'Kho vật tư chính'],
                ['Hạn giao', <span key="h" className="k-t-stop">07/09/2026 · trễ 2 ngày</span>], // prettier-ignore
              ]}
            >
              <FieldGrid note="Ô nền nhạt là giá trị kế thừa từ hồ sơ nhà cung cấp.">
                <Field label="Nhà cung cấp">Cơ khí Thành Đạt</Field>
                <Field label="Hạn giao" tone="stop">
                  <span className="num">07/09/2026</span>
                </Field>
                <Field label="Tỷ giá" inherited>
                  <span className="num">1,000000</span>
                </Field>
              </FieldGrid>
            </FastTab>
            <FastTab
              title="Đợt giao (đang gấp — vẫn đọc được số)"
              summary={[
                ['Số đợt', <span key="a" className="num">1</span>], // prettier-ignore
                ['Đã nhận', <span key="b" className="num">0 / 1</span>], // prettier-ignore
              ]}
            >
              <div style={{ color: 'var(--ink-3)' }}>Nội dung khối.</div>
            </FastTab>
          </div>
          <div className="lab-card">
            <GridToolbar count="2 dòng đã chọn">
              <GridBtn>+ Thêm dòng</GridBtn>
              <GridBtn disabled title="Chọn ít nhất một dòng">
                Sao chép
              </GridBtn>
              <GridSep />
              <GridBtn>Lọc</GridBtn>
              <GridBtn>Chọn cột</GridBtn>
            </GridToolbar>
            <div className="lab-chips">
              <LineStatus kind="idle">Chưa nhận</LineStatus>
              <LineStatus kind="part">Một phần</LineStatus>
              <LineStatus kind="done">Đủ</LineStatus>
              <LineStatus kind="short">Đóng thiếu</LineStatus>
            </div>
          </div>
          <div className="lab-pad" style={{ maxWidth: 300 }}>
            <FactBox>
              <FactSection title="Nhà cung cấp">
                <div className="k-strong" style={{ marginBottom: 4 }}>
                  Cơ khí Thành Đạt
                </div>
                <FactKv
                  rows={[
                    ['Giao đúng hẹn', <span key="a" className="num k-t-done">8 / 9 đơn</span>], // prettier-ignore
                    ['Giá lần trước', <span key="b" className="num">352.000 ₫</span>], // prettier-ignore
                  ]}
                />
              </FactSection>
            </FactBox>
          </div>
          <div className="lab-card">
            <AuditTable
              rows={[
                { at: '02/09 14:20', who: 'Nguyễn Văn A', field: 'Đơn giá · CN1527', from: '352.000', to: '369.600' }, // prettier-ignore
                { at: '05/09 16:10', who: 'Lê Văn D', field: 'Hạn giao', from: '05/09/2026', to: '07/09/2026' }, // prettier-ignore
              ]}
            />
          </div>
          <StatusBar
            left={[
              <>
                <b>Nguyễn Văn A</b> · Cung ứng
              </>,
              'Công ty Hoàng Gia · Xưởng Bình Dương',
            ]}
            right="PO-2609-014 · bản ghi 14/68"
          />
        </div>
      </Sec>

      <Sec
        n={2}
        id="luoi"
        title="Lưới nằm trong khối"
        why="Khác bảng toàn trang: bộ này dựng cho lưới nằm TRONG một khối (trong FastTab, trong hộp thoại) nên chỉ cuộn ngang và cao theo nội dung. Bảng toàn trang tự cuộn dọc thì xem Khuôn C."
      >
        <div className="lab-demo">
          <div className="lab-card">
            <Grid minWidth={760}>
              <GridHead>
                <Th width={34} />
                <Th width={40}>#</Th>
                <Th>Mã vật tư</Th>
                <Th>Tên vật tư</Th>
                <Th num>SL đặt</Th>
                <Th num>Đơn giá</Th>
                <Th num>Thành tiền</Th>
              </GridHead>
              <GridBody>
                <GridRow selected={ticked}>
                  <GridCheck
                    checked={ticked}
                    onChange={() => setTicked((v) => !v)}
                    label="Chọn dòng CN1527"
                  />
                  <Td num>1</Td>
                  <Td>CN1527</Td>
                  <Td>Vít dù 4×12, 7 màu</Td>
                  <Td num>68</Td>
                  <Td num>369.600</Td>
                  <Td num>25.132.800</Td>
                </GridRow>
                <GridRow>
                  <GridCheck
                    checked={false}
                    onChange={() => {}}
                    label="Chọn dòng NK-0056"
                  />
                  <Td num>2</Td>
                  <Td>NK-0056</Td>
                  <Td>Vít 4×12 đầu bằng ren gỗ</Td>
                  <Td num>10</Td>
                  <Td num tone="warn">
                    chưa có giá
                  </Td>
                  <Td num tone="warn">
                    —
                  </Td>
                </GridRow>
              </GridBody>
              <GridFoot>
                <Td colSpan={4}>Cộng 2 dòng</Td>
                <Td num>78</Td>
                <Td />
                <Td num>25.132.800</Td>
              </GridFoot>
            </Grid>
          </div>
          <div
            className="lab-pad"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            Ô tick BẮT BUỘC có <code>label</code> nói rõ chọn dòng nào — một cột toàn ô
            tick không nhãn là cột câm với trình đọc màn hình, và người dùng ERP đi bằng
            bàn phím rất nhiều.
          </div>
        </div>
      </Sec>

      <Sec
        n={3}
        id="so"
        title="Số, mã và nhãn"
        why="Ba trạng thái rỗng của một ô số nói ba điều khác nhau. Gộp lại là lỗi đã thật sự xảy ra: dòng “đã đủ” hiện dấu — ở cột Cần mua, người đọc hiểu thành “thiếu dữ liệu”."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Cách gọi</th>
                <th>Hiện ra</th>
                <th>Dùng khi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>zero=&quot;dash&quot;</code> (mặc định)
                </td>
                <td>
                  <Num value="" />
                </td>
                <td>Ô thật sự trống: chưa ai nhập giá, chưa có ngày</td>
              </tr>
              <tr>
                <td>
                  <code>zero=&quot;zero&quot;</code>
                </td>
                <td>
                  <Num value="" zero="zero" />
                </td>
                <td>Số 0 là một câu trả lời: tồn kho 0, đã về 0</td>
              </tr>
              <tr>
                <td>
                  <code>zero=&quot;done&quot;</code>
                </td>
                <td>
                  <Num value="" zero="done" />
                </td>
                <td>Hết việc rồi: cột “còn phải mua” khi đã đủ</td>
              </tr>
              <tr>
                <td>
                  <code>strong</code>
                </td>
                <td>
                  <Num value="25.132.800" strong />
                </td>
                <td>
                  Con số người dùng mang đi làm việc. Trên một dòng có 6 số, phải có đúng
                  MỘT số đậm
                </td>
              </tr>
              <tr>
                <td>
                  <code>Code</code>
                </td>
                <td>
                  <Code>PO-2609-014</Code>
                </td>
                <td>Mã chứng từ, mã vật tư. Mono + xanh vì luôn bấm được</td>
              </tr>
              <tr>
                <td>
                  <code>CoverageBar</code>
                </td>
                <td style={{ minWidth: 160 }}>
                  <CoverageBar ratio={0.62} label="62% đã có đơn" />
                </td>
                <td>Gộp 5 cột số thành một câu trả lời; chi tiết nằm ở khay kiểm tra</td>
              </tr>
              <tr>
                <td>
                  <code>Count</code>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <Count n={4} />
                    <Count n={3} tone="stop" />
                    <Count n={140} />
                  </span>
                </td>
                <td>
                  Badge trên menu. Số 0 KHÔNG hiện gì; trên 99 thì “99+”; đỏ chỉ dành cho
                  việc quá hạn
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec
        n={4}
        id="chan"
        title="Nút, và việc bị chặn"
        why="Web hay làm ngược: cho bấm rồi mới báo lỗi. Ở ERP, người dùng bấm bằng trí nhớ vị trí — nút phải nói trước rằng nó đang khoá, và khoá vì cái gì."
      >
        <div className="lab-demo">
          <div className="lab-pad" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn primary>Gửi duyệt</Btn>
            <Btn>Lưu nháp</Btn>
            <Btn danger>Huỷ đơn</Btn>
            <Btn blockedBy="Kế toán">Ghi nhận thanh toán</Btn>
            <Tip label="Tooltip tự dựng, hiện sau 120ms">
              <Btn>Rê chuột vào đây</Btn>
            </Tip>
          </div>
          <div className="lab-pad lab-card">
            <PermHint owner="Kế toán">
              Nút thanh toán ở trên bị khoá vì phòng Kế toán giữ quyền ghi nhận chi. Lời
              giải thích tách khỏi nút vì một khối 3 nút chỉ cần một dòng nói lý do.
            </PermHint>
          </div>
          <div className="lab-pad lab-card" style={{ maxWidth: 420 }}>
            <PrimaryStep
              label="Gửi Giám đốc duyệt"
              blockedBy="còn 2 lỗi chặn"
              why="Dòng NK-0056 chưa có đơn giá, và đơn trên 100 triệu cần duyệt hạn mức."
            />
          </div>
          <NoticeBar tone="warn" tag="Lưu ý" action={{ label: 'Xem 66 đơn' }}>
            <b>66 trên 68 đơn không thay đổi gì trong 5–7 ngày.</b> Dải này dành cho tin
            cả màn phải biết, không dành cho lỗi của một trường.
          </NoticeBar>
        </div>
      </Sec>

      <Sec
        n={5}
        id="vong-doi"
        title="Vòng đời và chuỗi chứng từ"
        why="Bốn cách kể một chứng từ đang ở đâu. Chọn nhầm loại là màn nói thừa: dải bậc trả lời “đang ở bước nào”, dòng thời gian trả lời “đã có chuyện gì”, hai câu khác nhau."
      >
        <div className="lab-demo">
          <div className="lab-pad">
            <StageBar
              stages={[
                'Nháp',
                'Chờ duyệt',
                'Đã duyệt',
                'Đã gửi NCC',
                'Về một phần',
                'Đủ',
              ]}
              current={1}
            />
            <p
              style={{
                marginTop: 8,
                fontSize: 'var(--fs-sm)',
                color: 'var(--ink-2)',
                maxWidth: '72ch',
              }}
            >
              Chỉ bậc HIỆN TẠI có màu. Tô đậm hết các bậc đã qua thì cả dải sáng rực và
              mắt không tìm ra đang đứng ở đâu — đúng lỗi của bản v3 trên đơn 8 bậc.
            </p>
          </div>
          <div className="lab-pad lab-card">
            <DocChain
              links={[
                { label: 'Đơn khách', code: 'ĐH-2608-31', href: '#' },
                { label: 'Lệnh SX', code: 'LSX 06/26-27', href: '#' },
                { label: 'Đơn mua', code: 'PO-2609-014', muted: true },
              ]}
            />
          </div>
          <div className="lab-pad lab-card">
            <NextAction
              mine={false}
              holder="Giám đốc"
              what="Duyệt hoặc từ chối đơn 131.400.000 ₫"
              days={5}
              hint="Nằm ở bước này 5 ngày. Người giữ có thể không biết là mình đang giữ."
            />
          </div>
          <div className="lab-pad lab-card">
            <Timeline marks={MARKS} />
          </div>
        </div>
      </Sec>

      <Sec
        n={6}
        id="trao-doi"
        title="Trao đổi trên chứng từ"
        why="Lỗ hổng lớn nhất so với Odoo, đo 09/09/2026: hệ thống có dòng thời gian (MÁY ghi) nhưng không có nơi NGƯỜI viết. Nên mọi câu “sao đơn này chưa duyệt” diễn ra trên Zalo, và khi cần tra lại thì không ai tìm ra."
      >
        <div className="lab-demo">
          <div className="lab-pad">
            <NoteComposer onSubmit={() => {}} partnerLabel="Nhà cung cấp" />
          </div>
          <div className="lab-pad lab-card">
            <NoteStream rows={STREAM} now={NOW} />
          </div>
          <div className="lab-pad lab-card">
            <Followers
              names={['Nguyễn Văn A', 'Lê Văn D', 'Trần Thị C']}
              muted={muted}
              onToggle={() => setMuted((v) => !v)}
            />
          </div>
          <div
            className="lab-pad lab-card"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            Người đọc được chọn TRƯỚC khi gõ, không phải sau: ghi chú nội bộ và câu gửi
            nhà cung cấp là hai thứ khác hẳn nhau, và chọn sau khi viết xong là lúc dễ bấm
            nhầm nhất.
          </div>
        </div>
      </Sec>

      <Sec
        n={7}
        id="xac-nhan"
        title="Hộp xác nhận theo mức hệ quả"
        why="Ba mức: làm lại được / có người khác thấy / mất dữ liệu hoặc ràng buộc tiền. Dùng chung một khung cho cả ba là dạy người dùng bấm Xác nhận theo phản xạ, và lúc cần họ dừng lại thì họ không dừng."
      >
        <div className="lab-demo">
          <div className="lab-pad" style={{ display: 'flex', gap: 8 }}>
            <Btn danger onClick={() => setSheet(true)}>
              Mở hộp xác nhận mức nặng
            </Btn>
          </div>
          <Sheet
            open={sheet}
            onClose={() => setSheet(false)}
            title="Huỷ đơn PO-2608-097"
            subtitle="Đã gửi nhà cung cấp ngày 22/08/2026"
            stakes="nang"
            footer={
              <SheetActions
                stakes="nang"
                onCancel={() => setSheet(false)}
                onConfirm={() => setSheet(false)}
                confirmLabel="Huỷ đơn"
              />
            }
          >
            <Consequence>
              Nhà cung cấp đã nhận đơn và có thể đã vào sản xuất. Huỷ ở đây không tự gửi
              thông báo cho họ — phải gọi báo riêng.
            </Consequence>
            <Affected
              items={[
                { code: 'LSX 06/26-27', label: 'Lệnh sản xuất', note: 'mất nguồn 9 mã vật tư' }, // prettier-ignore
                { code: 'ĐH-2608-31', label: 'Đơn khách MERXX', note: 'hạn giao 30/09 có thể trượt' }, // prettier-ignore
                {
                  code: 'PN-2609-012',
                  label: 'Phiếu nhập đã ghi',
                  amount: '112.400.000 ₫',
                },
              ]}
            />
          </Sheet>
          <div
            className="lab-pad lab-card"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            Hộp mức nặng bắt buộc bày <b>những gì bị kéo theo</b>. Một câu “Bạn có chắc
            không?” không cho người ký thêm thông tin nào để quyết khác đi.
          </div>
        </div>
      </Sec>

      <Sec
        n={8}
        id="nhap-lieu"
        title="Nhập số trong lưới"
        why="Bẫy đã dính hai lần: dùng input type=number rồi ép về Number ngay khi gõ thì người dùng gõ “1.” là mất luôn dấu chấm, không nhập nổi 1.5. Giữ chuỗi trong lúc gõ, chỉ ép kiểu khi rời ô."
      >
        <div className="lab-demo">
          <div
            className="lab-pad"
            style={{ display: 'flex', gap: 12, alignItems: 'center' }}
          >
            <div style={{ width: 130 }}>
              <NumInput value={qty} onCommit={setQty} aria-label="Số lượng đặt" />
            </div>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
              Giá trị đã chốt: <b className="num">{qty}</b> — chỉ đổi khi rời ô, không đổi
              mỗi lần gõ.
            </span>
          </div>
        </div>
      </Sec>

      <Sec
        n={9}
        id="trang-thai"
        title="Trạng thái rỗng và đang tải"
        why="`reason` và `next` của Empty không phải optional, có chủ ý: “Không có dữ liệu” là ngõ cụt đẩy người dùng đi hỏi vòng quanh. Kiểu bắt buộc là cách rẻ nhất để không ai viết được một cái như vậy."
      >
        <div className="lab-demo">
          <div className="lab-card">
            <Empty
              headline="Chưa có đơn nào cho lệnh này"
              reason="LSX 07/26-14 có 15 mã vật tư nhưng chưa mã nào được đưa vào đơn mua."
              next={<Btn primary>Soạn đơn từ định mức lệnh</Btn>}
            />
          </div>
          <div className="lab-pad lab-card">
            <Loading rows={4} />
          </div>
          <div
            className="lab-pad lab-card"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            Số dòng khung xương phải bằng số dòng bảng thật sắp hiện. Ít hơn thì trang
            nhảy giật khi dữ liệu về, và người đang định bấm sẽ bấm nhầm.
          </div>
        </div>
      </Sec>

      <Sec
        n={'9b'}
        id="ho-so-nhap-lieu"
        title="Hồ sơ danh mục &amp; bảng nhập liệu"
        why="Bốn thành phần này sinh ra ngày 10/09/2026 khi dựng Khuôn E và F. Đúng là việc mà màn mẫu được giao: dựng một màn ERP đầy đủ mà phải chế thêm CSS tại chỗ thì kit còn thiếu, và chỗ thiếu lộ ra ngay ở đó."
      >
        <div className="lab-demo">
          <MetricStrip>
            <Metric
              label="Giao đúng hẹn"
              value="89%"
              basis="8 / 9 đơn có hẹn ngày"
              tone="done"
            />
            <Metric
              label="Chốt thiếu"
              value="4 dòng"
              basis="trên 138 dòng đã đóng"
              tone="warn"
            />
            <Metric
              label="Điểm chất lượng"
              value={null}
              basis="chưa ai chấm — 1/154 NCC có"
            />
          </MetricStrip>
          <div
            className="lab-pad lab-card"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            <p style={{ margin: 0 }}>
              <b>
                <code>Metric</code> bắt buộc có <code>basis</code>
              </b>{' '}
              — cùng thủ pháp với <code>reason</code>/<code>next</code> của{' '}
              <code>Empty</code>. Một tỉ lệ không kèm mẫu số là con số không kiểm được:
              89% trên 9 đơn và 89% trên 900 đơn là hai mức tin cậy khác hẳn nhau, mà hai
              cái ô thì trông y hệt.
            </p>
            <p style={{ margin: '7px 0 0' }}>
              <b>
                <code>value={'{null}'}</code> nghĩa là CHƯA ĐO ĐƯỢC, khác hẳn 0.
              </b>{' '}
              Hiện 0% ở ô điểm chất lượng là vu cho nhà cung cấp điểm kém, trong khi sự
              thật là chưa ai chấm.
            </p>
          </div>
          <MasterWarn
            used={
              <>
                <b>2 đơn đang mở</b>, 14 mã vật tư, 3 lệnh sản xuất
              </>
            }
          />
          <HeadChips>
            <HeadChip label="Mẫu" value="Ngũ kim theo kg" />
            <HeadChip label="LSX" value="06/26-27 · MERXX" />
            <HeadChip label="NCC" value={null} need />
            <HeadChip label="Theo HĐ số" value={null} />
          </HeadChips>
          <CommitBar
            totals={[
              { label: 'Tiền hàng', value: '118.252.800 ₫' },
              { label: 'VAT 8%', value: '9.460.224 ₫' },
            ]}
            grand={{ label: 'Tổng thanh toán', value: '127.713.024 ₫' }}
            blocked="chưa chọn nhà cung cấp"
            actions={
              <Btn primary disabled title="chưa chọn nhà cung cấp">
                Lưu nháp
              </Btn>
            }
          />
          <div
            className="lab-pad lab-card"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}
          >
            Chip bắt buộc còn trống đeo viền đỏ <b>ngay lúc đó</b>, và câu chặn ở thanh
            chốt <b>bấm được</b> để nhảy tới đúng ô hỏng. Bảng nhập liệu cuộn ngang nên
            chỗ hỏng có khi đang nằm ngoài màn — một câu chặn không dẫn đi đâu thì người
            dùng phải tự dò 40 dòng.
          </div>
        </div>
      </Sec>

      <Sec
        n={10}
        id="shell"
        title="Vỏ ứng dụng"
        why="Bốn thứ này thuộc SHELL, không thuộc màn. Chúng do layout của workspace dựng một lần; màn nghiệp vụ không được tự vẽ lại thanh điều hướng của mình."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Thành phần</th>
                <th>Việc</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>NavRail</code>
                </td>
                <td>Thanh điều hướng 52px thay sidebar 240px</td>
                <td>
                  Trả lại ~12% bề ngang cho bảng. Nhãn không mất: hover ra tooltip sau
                  120ms
                </td>
              </tr>
              <tr>
                <td>
                  <code>TopBar</code>
                </td>
                <td>Thanh trên: đường dẫn, tìm kiếm, người dùng</td>
                <td>
                  Bỏ sidebar thì bắt buộc phải có ⌘K thật tốt, không thì khoá người dùng
                  ra ngoài
                </td>
              </tr>
              <tr>
                <td>
                  <code>CommandBar</code>
                </td>
                <td>Bản gộp: thương hiệu + đường dẫn + tìm + người dùng</td>
                <td>Dùng khi màn đứng ngoài shell workspace</td>
              </tr>
              <tr>
                <td>
                  <code>Menu</code>, <code>UserCard</code>
                </td>
                <td>Menu thả xuống và thẻ người dùng</td>
                <td>Chỉ dùng trong shell</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Sec>
    </Doc>
  )
}
