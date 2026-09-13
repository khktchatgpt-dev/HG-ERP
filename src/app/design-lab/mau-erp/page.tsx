'use client'

import { useState } from 'react'
import {
  Action,
  ActionGroup,
  ActionPane,
  AuditTable,
  Checks,
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
  GridBtn,
  GridSep,
  GridToolbar,
  HolderBar,
  LineStatus,
  StatusBar,
  StatusTrack,
  type AuditRow,
  type Check,
} from '@/components/kit'

/**
 * MÀN CHỨNG TỪ MẪU — dựng HOÀN TOÀN bằng `@/components/kit`.
 *
 * Trang này có hai việc: (1) là mẫu tham chiếu cho mọi màn chứng từ sau này,
 * (2) là PHÉP THỬ API của kit — nếu dựng một màn ERP đầy đủ mà phải chế thêm
 * lớp CSS tại chỗ thì kit còn thiếu, và chỗ thiếu lộ ra ngay ở đây.
 *
 * Đặt trong `design-lab` có chủ ý: khu này CÔNG KHAI (`PUBLIC_PATHS` ở
 * proxy.ts) nên đưa người ngoài xem không cần cấp tài khoản.
 *
 * Số liệu đo trên CSDL thật 09/09/2026 (68 đơn, 65 nháp, 0 đã duyệt, tồn phần
 * lớn bằng 0). Tên nhà cung cấp là ví dụ.
 */

type LineRow = {
  code: string
  name: string
  spec: string
  /** ĐVT MUA — đơn vị ghi trên đơn (thùng, cây, hộp). */
  unit: string
  qty: number
  /** Quy đổi sang ĐVT KHO — `qty2`/`unit2`, 73 dòng trong CSDL đang có. */
  qty2: number | null
  unit2: string | null
  /** `qty_demand` — nhu cầu tính từ định mức × sản lượng lệnh. */
  demand: number
  /** `qty_on_hand` — tồn tại thời điểm soạn đơn. */
  onHand: number
  price: number | null
  /** `supply_po_line_status` — 138 dòng trong CSDL đang có. */
  st: 'idle' | 'part' | 'done' | 'short'
  lsx: string
}

const LINES: LineRow[] = [
  { code: 'CN1527', name: 'Vít dù 4x12, 7 màu', spec: '4×12', unit: 'Thùng', qty: 68, qty2: 149600, unit2: 'Con', demand: 149600, onHand: 0, price: 369600, st: 'idle', lsx: '06/26-27' }, // prettier-ignore
  { code: 'NK-0056', name: 'Vít 4x12 đầu bằng ren gỗ, 7M', spec: '4×12', unit: 'Thùng', qty: 10, qty2: 19950, unit2: 'Con', demand: 19950, onHand: 0, price: null, st: 'idle', lsx: '06/26-27' }, // prettier-ignore
  { code: 'ST-0083', name: 'Thép hộp 20×40×1,2 mạ kẽm', spec: '20×40×1,2', unit: 'Cây', qty: 420, qty2: 2520, unit2: 'm', demand: 2496, onHand: 0, price: 186000, st: 'part', lsx: '07/26-14' }, // prettier-ignore
  { code: 'BUL0260', name: 'Tán rút 6', spec: 'M6', unit: 'Hộp', qty: 14, qty2: 13160, unit2: 'Con', demand: 13160, onHand: 0, price: 90240, st: 'idle', lsx: '07/26-14' }, // prettier-ignore
  { code: 'NK-0088', name: 'Nút bịt cao su', spec: 'Ø16', unit: 'Cái', qty: 12960, qty2: null, unit2: null, demand: 13200, onHand: 240, price: 310, st: 'short', lsx: '06/26-27' }, // prettier-ignore
]

const ST_TEXT: Record<LineRow['st'], string> = {
  idle: 'Chưa nhận',
  part: 'Một phần',
  done: 'Đủ',
  short: 'Đóng thiếu',
}

const CHECKS: Check[] = [
  { level: 'stop', what: 'Dòng 2 — NK-0056 chưa có đơn giá', fix: 'Nhập giá hoặc đánh dấu “chờ báo giá”' }, // prettier-ignore
  { level: 'stop', what: 'Chưa có duyệt hạn mức cho đơn trên 100 triệu', fix: 'Gửi Giám đốc duyệt' }, // prettier-ignore
  { level: 'warn', what: 'Hạn giao 07/09/2026 đã qua 2 ngày', fix: 'Cập nhật hạn hoặc ghi lý do trễ' }, // prettier-ignore
  { level: 'warn', what: 'Dòng 3 — ST-0083 đặt dư 24 m so với nhu cầu', fix: 'Bình thường nếu cắt theo cây 6 m' }, // prettier-ignore
]

const AUDIT: AuditRow[] = [
  { at: '01/09 09:02', who: 'Nguyễn Văn A', field: 'Chứng từ', from: '—', to: 'Tạo mới' },
  { at: '02/09 14:20', who: 'Nguyễn Văn A', field: 'Đơn giá · CN1527', from: '352.000', to: '369.600' }, // prettier-ignore
  { at: '03/09 08:45', who: 'Nguyễn Văn A', field: 'Số lượng · CN1527', from: '55 Thùng', to: '68 Thùng' }, // prettier-ignore
  {
    at: '05/09 16:10',
    who: 'Lê Văn D',
    field: 'Hạn giao',
    from: '05/09/2026',
    to: '07/09/2026',
  },
  { at: '08/09 10:33', who: 'Trần Thị C', field: 'Dòng 5 · NK-0088', from: 'Chưa nhận', to: 'Đóng thiếu' }, // prettier-ignore
]

const n = (v: number) => v.toLocaleString('vi-VN')

export default function Page() {
  const [sel, setSel] = useState<string[]>(['NK-0056', 'ST-0083'])
  const pick = (c: string) =>
    setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))

  const priced = LINES.filter((l) => l.price != null)
  const total = priced.reduce((s, l) => s + l.qty * (l.price ?? 0), 0)
  const missing = LINES.length - priced.length
  const qtySum = LINES.reduce((s, l) => s + l.qty, 0)

  return (
    <DocScreen>
      <Crumb
        path={['Cung ứng', 'Đơn đặt vật tư', 'PO-2609-014']}
        view="Đơn của tôi · quá hạn"
        position={[14, 68]}
      />

      <ActionPane
        tabs={[
          { label: 'Đơn hàng', active: true },
          { label: 'Nhận hàng' },
          { label: 'Tài chính' },
          { label: 'Hiển thị' },
        ]}
      >
        <ActionGroup label="Duy trì">
          <Action strong>Sửa</Action>
          <Action>Mới</Action>
          <Action>Sao chép</Action>
          <Action>Xoá</Action>
        </ActionGroup>
        <ActionGroup label="Luồng phê duyệt">
          <Action primary disabled title="Còn 2 lỗi chặn — xem bảng kiểm phía trên">
            Gửi duyệt
          </Action>
          <Action>Trả lại người soạn</Action>
          <Action>Uỷ quyền duyệt</Action>
          <Action>Huỷ đơn</Action>
        </ActionGroup>
        <ActionGroup label="Nhận hàng">
          <Action>Đóng thiếu dòng</Action>
          <Action>Ghi nhận nhận hàng</Action>
        </ActionGroup>
        <ActionGroup label="In &amp; xuất">
          <Action>Phiếu đặt hàng</Action>
          <Action>Bảng kê</Action>
          <Action>Xuất Excel</Action>
        </ActionGroup>
        <ActionGroup label="Chứng từ liên quan">
          <Action>Lệnh sản xuất</Action>
          <Action>Phiếu nhập kho</Action>
          <Action>Nhà cung cấp</Action>
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Đơn đặt vật tư"
        code="PO-2609-014"
        sub={
          <>
            Cơ khí Thành Đạt · <span className="num">NCC-0043</span> · soạn 01/09/2026 bởi
            Nguyễn Văn A
          </>
        }
      >
        <StatusTrack
          label="Trạng thái đơn"
          steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi NCC']}
          at={0}
        />
        <StatusTrack label="Nhận hàng" steps={['Chưa nhận', 'Một phần', 'Đủ']} at={0} />
        <StatusTrack label="Thanh toán" steps={['Chưa', 'Một phần', 'Xong']} at={0} />
      </DocHead>

      <HolderBar
        mine
        who="Cung ứng — Nguyễn Văn A"
        what="Soạn xong thì gửi Giám đốc duyệt"
        age="8 ngày"
      />

      <Checks title="Chưa gửi duyệt được" items={CHECKS} />

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <div className="k-strong" style={{ marginBottom: 4 }}>
                Cơ khí Thành Đạt
              </div>
              <FactKv
                rows={[
                  ['Giao đúng hẹn', <span key="a" className="num k-t-done">8 / 9 đơn</span>], // prettier-ignore
                  ['Trễ trung bình', <span key="b" className="num">1,2 ngày</span>], // prettier-ignore
                  ['Mua gần nhất', <span key="c" className="num">12/08/2026</span>], // prettier-ignore
                  ['Giá lần trước', <span key="d" className="num">352.000 ₫</span>], // prettier-ignore
                  ['Đang nợ', <span key="e" className="num">0 ₫</span>], // prettier-ignore
                  ['Hạn mức còn', <span key="f" className="num">500.000.000 ₫</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Chứng từ liên quan">
              <FactKv
                rows={[
                  [<span key="1" className="num">LSX 06/26-27</span>, 'Lệnh SX · 3 dòng'], // prettier-ignore
                  [<span key="2" className="num">LSX 07/26-14</span>, 'Lệnh SX · 2 dòng'], // prettier-ignore
                  [<span key="3" className="num">ĐH-2608-31</span>, 'Đơn khách · MERXX'], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Người theo dõi">
              <FactKv
                rows={[
                  ['Nguyễn Văn A', 'soạn'],
                  ['Lê Văn D', 'duyệt'],
                  ['Trần Thị C', 'kho'],
                ]}
              />
            </FactSection>
            <FactSection title="Tệp đính kèm">
              <FactKv
                rows={[
                  [
                    'Báo giá NCC 08-2026.pdf',
                    <span key="s" className="num">
                      214 KB
                    </span>,
                  ],
                ]}
              />{' '}
              {/* prettier-ignore */}
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Tổng quan"
          defaultOpen
          summary={[
            ['Kho nhận', 'Kho vật tư chính'],
            ['Hạn giao', <span key="h" className="k-t-stop">07/09/2026 · trễ 2 ngày</span>], // prettier-ignore
            ['Điều khoản', '30 ngày'],
          ]}
        >
          <FieldGrid
            note={
              <>
                Ô nền nhạt là <b>giá trị kế thừa từ hồ sơ nhà cung cấp</b> — sửa ở đây chỉ
                đổi cho đơn này.
              </>
            }
          >
            <Field label="Nhà cung cấp">Cơ khí Thành Đạt</Field>
            <Field label="Mã NCC">
              <span className="num">NCC-0043</span>
            </Field>
            <Field label="Mã số thuế">
              <span className="num">0301234567</span>
            </Field>
            <Field label="Người liên hệ">Trần B · 0903 xxx xxx</Field>
            <Field label="Kho nhận">Kho vật tư chính</Field>
            <Field label="Địa điểm giao">Xưởng Bình Dương</Field>
            <Field label="Ngày đặt">
              <span className="num">01/09/2026</span>
            </Field>
            <Field label="Hạn giao" tone="stop">
              <span className="num">07/09/2026</span>
            </Field>
            <Field label="Điều khoản TT">30 ngày kể từ ngày nhận</Field>
            <Field label="Loại tiền">
              <span className="num">VND</span>
            </Field>
            <Field label="Tỷ giá" inherited>
              <span className="num">1,000000</span>
            </Field>
            <Field label="Thuế suất">
              <span className="num">8%</span>
            </Field>
            <Field label="Người phụ trách">Nguyễn Văn A</Field>
            <Field label="Hạn mức NCC" inherited>
              <span className="num">500.000.000 ₫</span>
            </Field>
            <Field label="Nguồn nhu cầu">
              <span className="num">2 lệnh sản xuất</span>
            </Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Dòng đơn hàng"
          defaultOpen
          flush
          summary={[
            ['Số dòng', <span key="a" className="num">{LINES.length}</span>], // prettier-ignore
            ['Chưa có giá', <span key="b" className="num k-t-warn">{missing}</span>], // prettier-ignore
            ['Tạm tính', <span key="c" className="num">{n(total)} ₫</span>], // prettier-ignore
          ]}
        >
          <GridToolbar
            count={sel.length > 0 ? `${sel.length} dòng đã chọn` : `${LINES.length} dòng`}
          >
            <GridBtn>+ Thêm dòng</GridBtn>
            <GridBtn disabled={sel.length === 0} title="Chọn ít nhất một dòng">
              Xoá dòng
            </GridBtn>
            <GridBtn disabled={sel.length === 0} title="Chọn ít nhất một dòng">
              Sao chép
            </GridBtn>
            <GridSep />
            <GridBtn>Lọc</GridBtn>
            <GridBtn>Chọn cột</GridBtn>
            <GridBtn>Đóng thiếu</GridBtn>
          </GridToolbar>

          <div className="k-gridwrap">
            <table className="k-grid" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  <th className="k-c-k" />
                  <th className="k-c-n">#</th>
                  <th>Mã vật tư</th>
                  <th>Tên vật tư</th>
                  <th>Quy cách</th>
                  <th className="k-r">SL đặt</th>
                  <th>ĐVT mua</th>
                  <th className="k-r">Quy đổi kho</th>
                  <th className="k-r">Nhu cầu</th>
                  <th className="k-r">Tồn</th>
                  <th className="k-r">Đơn giá</th>
                  <th className="k-r">Thành tiền</th>
                  <th>Trạng thái</th>
                  <th>Cho lệnh SX</th>
                </tr>
              </thead>
              <tbody>
                {LINES.map((l, i) => (
                  <tr key={l.code} className={sel.includes(l.code) ? 'k-on' : undefined}>
                    <td className="k-c-k">
                      <input
                        type="checkbox"
                        checked={sel.includes(l.code)}
                        onChange={() => pick(l.code)}
                        aria-label={`Chọn dòng ${l.code}`}
                      />
                    </td>
                    <td className="k-c-n num">{i + 1}</td>
                    <td className="num k-strong">{l.code}</td>
                    <td>{l.name}</td>
                    <td className="num">{l.spec}</td>
                    <td className="k-r num">{n(l.qty)}</td>
                    <td>{l.unit}</td>
                    <td className="k-r num">
                      {l.qty2 == null ? '—' : `${n(l.qty2)} ${l.unit2}`}
                    </td>
                    <td className="k-r num">{n(l.demand)}</td>
                    <td className={l.onHand === 0 ? 'k-r num k-zero' : 'k-r num'}>
                      {n(l.onHand)}
                    </td>
                    <td className="k-r num">
                      {l.price == null ? <span className="k-t-warn">—</span> : n(l.price)}
                    </td>
                    <td className="k-r num">
                      {l.price == null ? (
                        <span className="k-flag">chưa có giá</span>
                      ) : (
                        n(l.qty * l.price)
                      )}
                    </td>
                    <td>
                      <LineStatus kind={l.st}>{ST_TEXT[l.st]}</LineStatus>
                    </td>
                    <td className="num">{l.lsx}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="k-c-k" />
                  <td colSpan={7}>Cộng {LINES.length} dòng</td>
                  <td className="k-r num">{n(qtySum)}</td>
                  <td className="k-r num k-zero">240</td>
                  <td />
                  <td className="k-r num">{n(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="k-ft-note">
            Tổng tiền <b>chưa gồm {missing} dòng chưa có giá</b>. Con số trên là tạm tính,
            không dùng để duyệt chi.
          </div>
        </FastTab>

        <FastTab
          title="Điều khoản &amp; thanh toán"
          summary={[
            ['Công nợ', '30 ngày'],
            ['Đã trả', <span key="a" className="num">0 ₫</span>], // prettier-ignore
            ['Còn nợ', <span key="b" className="num">{n(Math.round(total * 1.08))} ₫</span>], // prettier-ignore
          ]}
        >
          <FieldGrid>
            <Field label="Hình thức TT">Chuyển khoản</Field>
            <Field label="Hạn thanh toán">30 ngày kể từ ngày nhận đủ</Field>
            <Field label="Bảo hành">Không áp dụng</Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Đợt giao"
          summary={[
            ['Số đợt', <span key="a" className="num">1</span>], // prettier-ignore
            ['Đã nhận', <span key="b" className="num">0 / 1</span>], // prettier-ignore
            ['Gần nhất', <span key="c" className="k-t-stop">quá hạn 2 ngày</span>], // prettier-ignore
          ]}
        >
          <div style={{ color: 'var(--ink-3)' }}>
            Chưa có đợt giao nào được ghi nhận. Đợt đầu tiên sẽ tạo khi Kho lập phiếu
            nhập.
          </div>
        </FastTab>

        <FastTab
          title="Nhật ký thay đổi"
          flush
          summary={[
            ['Lượt sửa', <span key="a" className="num">{AUDIT.length}</span>], // prettier-ignore
            ['Sửa cuối', <span key="b" className="num">08/09 10:33</span>], // prettier-ignore
            ['Người sửa', <span key="c" className="num">3</span>], // prettier-ignore
          ]}
        >
          <AuditTable rows={AUDIT} />
        </FastTab>
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>Nguyễn Văn A</b> · Cung ứng
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương',
          <span key="d" className="num">
            09/09/2026 08:15
          </span>,
        ]}
        right="PO-2609-014 · bản ghi 14/68"
      />
    </DocScreen>
  )
}
