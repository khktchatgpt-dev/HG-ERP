'use client'

import {
  Action,
  ActionGroup,
  ActionPane,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  MasterWarn,
  Metric,
  MetricStrip,
  StatusBar,
  Td,
  Th,
} from '@/components/kit'
import { LabNote } from '../_lab/Doc'

/**
 * KHUÔN E — HỒ SƠ DANH MỤC (master data record).
 *
 * Trả lời: "đối tượng này là ai, làm ăn ra sao, đang được dùng ở đâu?".
 * Chép SAP Business Partner / Material Master, Dynamics Vendor master và
 * form đối tác của Odoo.
 *
 * BỐN CHỖ KHÁC HẲN KHUÔN D (chứng từ) — đây là lý do nó phải là khuôn riêng
 * chứ không phải một biến thể:
 *
 *  1. KHÔNG CÓ VÒNG ĐỜI DUYỆT. Không ai "gửi duyệt" một nhà cung cấp. Nhét
 *     hồ sơ vào khuôn chứng từ là phải bịa ra một vòng đời cho nó, rồi người
 *     dùng đi tìm nút gửi duyệt trên thứ không ai duyệt bao giờ. Chỗ của ba
 *     trục trạng thái ở đây là DẢI HIỆU SUẤT.
 *  2. CÓ HIỆU SUẤT THEO THỜI GIAN. Chứng từ là một lát cắt; hồ sơ tích luỹ.
 *     Câu người duyệt chi thật sự hỏi là "thằng này giao đúng hẹn mấy lần".
 *  3. CÓ "DÙNG Ở ĐÂU". Trước khi sửa hay khoá một hồ sơ phải biết nó đang
 *     đỡ bao nhiêu thứ. Chứng từ không có câu hỏi này.
 *  4. SỬA LÀ SỬA BẢN GHI GỐC. Đổi một dòng trên đơn chỉ đổi tờ đó; đổi điều
 *     khoản ở đây đổi cho mọi đơn lập từ nay về sau.
 *
 * ĐO TRÊN MÀN THẬT `/planning/suppliers/[id]` NGÀY 10/09/2026 — và đây là
 * phát hiện đáng giá nhất của lượt này:
 *
 *   `supplyRepo.supplierDeliveryKpis()` TÍNH SẴN đủ 8 chỉ số (po_on_time,
 *   po_with_expected, lines_rejected, lines_closed_short, po_returned…), type
 *   `SupplierKpis` vẫn export — nhưng màn KHÔNG gọi nữa (bỏ 28/08 để tiết
 *   kiệm một truy vấn) và không prop nào nhận nó. Thứ duy nhất còn lại để
 *   đánh giá là chữ hạng A–D CHẤM TAY, mà chỉ 1 trên 154 NCC có.
 *
 *   Tức là màn hồ sơ nhà cung cấp hiện KHÔNG trả lời được câu hỏi trung tâm
 *   của chính nó, trong khi số liệu đã nằm sẵn trong repo. Dải hiệu suất
 *   dưới đây bày đúng 8 chỉ số đó.
 */

const BOUGHT: {
  code: string
  name: string
  times: number
  qty: string
  price: string
  last: string
  trend: 'up' | 'flat'
}[] = [
  { code: 'CN1527', name: 'Vít dù 4×12, 7 màu', times: 9, qty: '412 Thùng', price: '369.600 ₫ / Thùng', last: '12/08/2026', trend: 'up' }, // prettier-ignore
  { code: 'ST-0083', name: 'Thép hộp 20×40×1,2 mạ kẽm', times: 6, qty: '1.840 Cây', price: '186.000 ₫ / Cây', last: '24/08/2026', trend: 'flat' }, // prettier-ignore
  { code: 'BUL0260', name: 'Tán rút 6', times: 4, qty: '52 Hộp', price: '90.240 ₫ / Hộp', last: '14/08/2026', trend: 'flat' }, // prettier-ignore
  { code: 'NK-0088', name: 'Nút bịt cao su Ø16', times: 3, qty: '38.400 Cái', price: '310 ₫ / Cái', last: '02/08/2026', trend: 'up' }, // prettier-ignore
]

const PRICE_LOG: { at: string; code: string; from: string; to: string; delta: string }[] =
  [
    { at: '12/08/2026', code: 'CN1527', from: '352.000', to: '369.600', delta: '+5,0%' },
    { at: '24/07/2026', code: 'ST-0083', from: '186.000', to: '186.000', delta: '—' },
    { at: '02/07/2026', code: 'CN1527', from: '340.000', to: '352.000', delta: '+3,5%' },
    { at: '18/06/2026', code: 'NK-0088', from: '298', to: '310', delta: '+4,0%' },
  ]

export default function Page() {
  return (
    <DocScreen>
      <LabNote>
        <div>
          <b>Khuôn E — Hồ sơ danh mục.</b> Chỗ của ba trục trạng thái ở Khuôn D, tại đây
          là <b>dải hiệu suất</b>: hồ sơ không có vòng đời duyệt, nhưng có chuyện làm ăn
          tích luỹ. Mỗi ô đo bắt buộc kèm <b>mẫu số</b> — 89% trên 9 đơn và 89% trên 900
          đơn là hai mức tin cậy khác hẳn nhau.
        </div>
      </LabNote>

      <Crumb
        path={['Cung ứng', 'Nhà cung cấp', 'NCC-0043']}
        view="NCC đang hoạt động"
        position={[43, 154]}
      />

      <ActionPane
        tabs={[
          { label: 'Hồ sơ', active: true },
          { label: 'Mua hàng' },
          { label: 'Chứng chỉ' },
        ]}
      >
        <ActionGroup label="Duy trì">
          <Action strong>Sửa</Action>
          <Action>Nhân bản</Action>
        </ActionGroup>
        {/* KHÔNG có nhóm "Luồng phê duyệt" — hồ sơ danh mục không ai duyệt. */}
        <ActionGroup label="Mua hàng">
          <Action primary>+ Soạn đơn cho NCC này</Action>
          <Action>Bảng giá chào</Action>
        </ActionGroup>
        <ActionGroup label="Trạng thái">
          <Action>Ngừng giao dịch</Action>
          <Action>Khoá đặt hàng</Action>
        </ActionGroup>
        <ActionGroup label="In &amp; xuất">
          <Action>Hồ sơ năng lực</Action>
          <Action>Xuất Excel</Action>
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Nhà cung cấp"
        code="NCC-0043"
        sub={
          <>
            Cơ khí Thành Đạt · MST <span className="num">0301234567</span> · Nguyên vật
            liệu · hợp tác từ 03/2024
          </>
        }
      >
        {/* Đây là chỗ của `StatusTrack` ở Khuôn D. Hồ sơ thay bằng hiệu suất. */}
      </DocHead>

      <MetricStrip>
        <Metric
          label="Giao đúng hẹn"
          value="89%"
          basis="8 / 9 đơn có hẹn ngày"
          tone="done"
        />
        <Metric label="Trễ trung bình" value="1,2 ngày" basis="tính trên 9 đơn đã nhận" />
        <Metric label="QC loại" value="0,4%" basis="3 / 712 dòng đã nhận" tone="done" />
        <Metric
          label="Chốt thiếu"
          value="4 dòng"
          basis="trên 138 dòng đã đóng"
          tone="warn"
        />
        <Metric label="Trả hàng" value="0 đơn" basis="trên 22 đơn đã nhận" tone="done" />
        <Metric
          label="Tổng chi 12 tháng"
          value="1,48 tỷ ₫"
          basis="22 đơn, không tính huỷ"
        />
        {/*
          Ô KHÔNG ĐO ĐƯỢC — khác hẳn ô bằng 0. Điểm chất lượng là số CHẤM TAY
          và chỉ 1/154 NCC có; hiện 0 điểm ở đây là vu cho họ điểm kém.
        */}
        <Metric
          label="Điểm chất lượng"
          value={null}
          basis="chưa ai chấm — 1/154 NCC có"
        />
      </MetricStrip>

      <MasterWarn
        used={
          <>
            <b>2 đơn đang mở</b>, 14 mã vật tư, 3 lệnh sản xuất
          </>
        }
      />

      <DocBody
        aside={
          <FactBox>
            {/*
              "DÙNG Ở ĐÂU" là khối riêng của Khuôn E. Chứng từ không có câu
              hỏi này; hồ sơ thì không được khoá hay sửa khi chưa biết mình
              đang đỡ bao nhiêu thứ.
            */}
            <FactSection title="Dùng ở đâu">
              <FactKv
                rows={[
                  ['Đơn đang mở', <span key="a" className="num k-t-warn">2</span>], // prettier-ignore
                  ['Vật tư đang gán', <span key="b" className="num">14 mã</span>], // prettier-ignore
                  ['Lệnh SX phụ thuộc', <span key="c" className="num">3</span>], // prettier-ignore
                  ['Nhóm vật tư', 'Ngũ kim · Thép'],
                ]}
              />
            </FactSection>
            <FactSection title="Điều khoản đang áp">
              <FactKv
                rows={[
                  ['Thanh toán', '30 ngày'],
                  ['Thời gian giao', <span key="b" className="num">7 ngày</span>], // prettier-ignore
                  ['Đặt tối thiểu', <span key="c" className="num">10.000.000 ₫</span>], // prettier-ignore
                  ['Tiền tệ', <span key="d" className="num">VND</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Liên hệ mua hàng">
              <div className="k-strong" style={{ marginBottom: 4 }}>
                Trần B
              </div>
              <FactKv
                rows={[
                  ['Điện thoại', <span key="a" className="num">0903 xxx xxx</span>], // prettier-ignore
                  ['Người phụ trách', 'Nguyễn Văn A'],
                ]}
              />
            </FactSection>
            <FactSection title="Chứng chỉ">
              <FactKv
                rows={[
                  ['ISO 9001', <span key="a" className="num k-t-done">còn hạn 04/2027</span>], // prettier-ignore
                  ['Giấy phép KD', <span key="b" className="num">còn hạn</span>], // prettier-ignore
                ]}
              />
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Nhận diện &amp; pháp lý"
          defaultOpen
          summary={[
            ['Loại', 'Nguyên vật liệu'],
            ['Trạng thái', <span key="b" className="k-t-done">Hoạt động</span>], // prettier-ignore
            ['Cho đặt hàng', 'Có'],
          ]}
        >
          <FieldGrid>
            <Field label="Tên giao dịch">Cơ khí Thành Đạt</Field>
            <Field label="Tên pháp nhân">Công ty TNHH Cơ khí Thành Đạt</Field>
            <Field label="Mã NCC">
              <span className="num">NCC-0043</span>
            </Field>
            <Field label="Mã số thuế">
              <span className="num">0301234567</span>
            </Field>
            <Field label="Người đại diện">Trần Văn Thành</Field>
            <Field label="Thành lập">
              <span className="num">14/03/2011</span>
            </Field>
            <Field label="Quốc gia">Việt Nam</Field>
            <Field label="Vùng">Đông Nam Bộ</Field>
            <Field label="Địa chỉ ĐKKD">Số 12 Nguyễn Văn Quá, Q.12, TP.HCM</Field>
            <Field label="Kho giao hàng">KCN Sóng Thần, Dĩ An, Bình Dương</Field>
            <Field label="Xuất nhập khẩu">Trong nước</Field>
            <Field label="Mức ưu tiên">Chính</Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Điều khoản mua hàng &amp; ngân hàng"
          summary={[
            ['Thanh toán', '30 ngày'],
            ['Giao trong', <span key="b" className="num">7 ngày</span>], // prettier-ignore
            ['Incoterms', 'DDP'],
          ]}
        >
          <FieldGrid note="Mọi giá trị ở khối này được ĐƠN MỚI kế thừa. Sửa trên một đơn cụ thể chỉ đổi cho đơn đó.">
            <Field label="Điều khoản TT">30 ngày kể từ ngày nhận đủ</Field>
            <Field label="Hình thức">Chuyển khoản</Field>
            <Field label="Tiền tệ">
              <span className="num">VND</span>
            </Field>
            <Field label="Đặt tối thiểu">
              <span className="num">10.000.000 ₫</span>
            </Field>
            <Field label="Thời gian giao">
              <span className="num">7 ngày</span>
            </Field>
            <Field label="Incoterms">DDP</Field>
            <Field label="Cách giao">NCC giao tới xưởng</Field>
            <Field label="Chính sách trả hàng">Đổi trong 7 ngày nếu sai quy cách</Field>
            <Field label="Ngân hàng">Vietcombank — CN Bình Dương</Field>
            <Field label="Số tài khoản">
              <span className="num">0071000xxxxxx</span>
            </Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Vật tư đã mua"
          flush
          summary={[
            ['Số mã', <span key="a" className="num">4</span>], // prettier-ignore
            ['Lượt mua', <span key="b" className="num">22</span>], // prettier-ignore
            ['Mua gần nhất', <span key="c" className="num">24/08/2026</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={780}>
            <GridHead>
              <Th>Mã vật tư</Th>
              <Th>Tên vật tư</Th>
              <Th num>Số lần mua</Th>
              <Th num>Tổng đã đặt</Th>
              <Th num>Giá gần nhất</Th>
              <Th num>Mua gần nhất</Th>
            </GridHead>
            <GridBody>
              {BOUGHT.map((b) => (
                <GridRow key={b.code}>
                  <Td>{b.code}</Td>
                  <Td>{b.name}</Td>
                  <Td num>{b.times}</Td>
                  <Td num>{b.qty}</Td>
                  <Td num tone={b.trend === 'up' ? 'warn' : undefined}>
                    {b.price}
                  </Td>
                  <Td num>{b.last}</Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={2}>Cộng 4 mã</Td>
              <Td num>22</Td>
              <Td colSpan={3} />
            </GridFoot>
          </Grid>
          <div className="k-ft-note">
            Cột giá tô hổ phách khi giá <b>lần này cao hơn lần trước</b>. Người mua cần
            thấy xu hướng ngay trên hồ sơ, không phải mở từng đơn cũ ra so.
          </div>
        </FastTab>

        <FastTab
          title="Lịch sử giá"
          flush
          summary={[
            ['Lượt đổi giá', <span key="a" className="num">4</span>], // prettier-ignore
            ['Tăng 12 tháng', <span key="b" className="num k-t-warn">+12,8%</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={620}>
            <GridHead>
              <Th num>Ngày</Th>
              <Th>Mã vật tư</Th>
              <Th num>Giá cũ</Th>
              <Th num>Giá mới</Th>
              <Th num>Đổi</Th>
            </GridHead>
            <GridBody>
              {PRICE_LOG.map((p) => (
                <GridRow key={p.at + p.code}>
                  <Td num>{p.at}</Td>
                  <Td>{p.code}</Td>
                  <Td num>{p.from}</Td>
                  <Td num>{p.to}</Td>
                  <Td num tone={p.delta === '—' ? undefined : 'warn'}>
                    {p.delta}
                  </Td>
                </GridRow>
              ))}
            </GridBody>
          </Grid>
          <div className="k-ft-note">
            Lịch sử giá đọc từ <b>dòng đơn đã lập</b>, không phải một bảng chấm tay — số
            chấm tay thì không ai cập nhật, và sau ba tháng nó nói dối.
          </div>
        </FastTab>

        <FastTab
          title="Đơn đã đặt"
          summary={[
            ['Tổng đơn', <span key="a" className="num">22</span>], // prettier-ignore
            ['Đang mở', <span key="b" className="num k-t-warn">2</span>], // prettier-ignore
            ['Giá trị', <span key="c" className="num">1,48 tỷ ₫</span>], // prettier-ignore
          ]}
        >
          <div style={{ color: 'var(--ink-3)' }}>
            Danh sách đơn của riêng NCC này — cùng bảng với Khuôn C, lọc sẵn theo hồ sơ
            đang mở.
          </div>
        </FastTab>
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>Nguyễn Văn A</b> · Cung ứng
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương',
        ]}
        right="NCC-0043 · bản ghi 43/154"
      />
    </DocScreen>
  )
}
