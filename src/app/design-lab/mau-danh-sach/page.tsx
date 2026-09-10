'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  GroupRow,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { LabNote } from '../_lab/Doc'

/**
 * KHUÔN C — TRANG DANH SÁCH.
 *
 * Trả lời: "trong tập chứng từ này, cái nào cần tôi động vào?".
 * Chép khuôn List Report của SAP Fiori và List page của Dynamics 365 F&O.
 *
 * BỐN THỨ LÀM NÊN KHUÔN NÀY, thiếu cái nào là màn tụt về "bảng dữ liệu":
 *
 *  1. CHIP LỌC MANG SỐ. Lọc mà không biết còn bao nhiêu là lọc mù — người
 *     dùng bấm thử từng chip để dò. Số trên chip là LỜI HỨA, đếm bằng đúng
 *     tập mà chip đó sẽ hiện ra.
 *  2. TIÊU ĐỀ CỘT DÍNH + CHÂN TỔNG DÍNH. Danh sách ERP luôn dài hơn màn
 *     hình; cuộn xuống đáy xem tổng rồi cuộn ngược lên là thao tác thừa lặp
 *     cả ngày.
 *  3. CỘT ĐỊNH DANH GHIM TRÁI. Bảng rộng phải cuộn ngang, và một dòng số
 *     không biết của mã nào thì vô dụng — cùng hạng lỗi với mất tiêu đề cột.
 *  4. DÒNG TIÊU ĐỀ KHỐI THEO "AI ĐANG GIỮ". Đây là chỗ khuôn này khác một
 *     cái bảng thường: nó không xếp theo ngày hay theo mã, nó xếp theo NGƯỜI
 *     CÒN NỢ VIỆC. Đo 09/09/2026: 66/68 đơn nằm im 5–7 ngày vì không màn nào
 *     nói ra điều đó.
 *
 * Số liệu lấy theo hình dạng CSDL thật 09/09/2026 (68 đơn, 65 nháp, 0 đã
 * duyệt). Tên nhà cung cấp là ví dụ.
 */

type Po = {
  code: string
  ncc: string
  owner: string
  placed: string
  due: string
  lines: number
  value: number | null
  /** Ai đang nợ việc — trục xếp khối của màn này. */
  holder: 'me' | 'boss' | 'ncc' | 'kho'
  state: 'Nháp' | 'Chờ duyệt' | 'Đã gửi NCC' | 'Về một phần'
  /** Số ngày chứng từ không đổi. ≥3 là dấu hiệu kẹt. */
  idle: number
}

const HOLDERS: { id: Po['holder']; step: number; name: string; owe: string }[] = [
  { id: 'me', step: 1, name: 'Chờ tôi soạn xong', owe: 'Cung ứng — Nguyễn Văn A' },
  { id: 'boss', step: 2, name: 'Chờ Giám đốc duyệt', owe: 'Lê Văn D' },
  { id: 'ncc', step: 3, name: 'Chờ nhà cung cấp giao', owe: 'ngoài hệ thống' },
  { id: 'kho', step: 4, name: 'Chờ Kho ghi nhận nhập', owe: 'Trần Thị C' },
]

const ROWS: Po[] = [
  { code: 'PO-2609-014', ncc: 'Cơ khí Thành Đạt', owner: 'Nguyễn Văn A', placed: '01/09/2026', due: '07/09/2026', lines: 5, value: null, holder: 'me', state: 'Nháp', idle: 8 }, // prettier-ignore
  { code: 'PO-2609-018', ncc: 'Thép Nam Phát', owner: 'Nguyễn Văn A', placed: '02/09/2026', due: '12/09/2026', lines: 12, value: 84_600_000, holder: 'me', state: 'Nháp', idle: 7 }, // prettier-ignore
  { code: 'PO-2609-021', ncc: 'Sơn Đại Việt', owner: 'Phan Thị Lệ Hằng', placed: '03/09/2026', due: '15/09/2026', lines: 4, value: 22_180_000, holder: 'me', state: 'Nháp', idle: 6 }, // prettier-ignore
  { code: 'PO-2609-022', ncc: 'Nhựa Tân Tiến', owner: 'Nguyễn Văn A', placed: '03/09/2026', due: '18/09/2026', lines: 3, value: null, holder: 'me', state: 'Nháp', idle: 6 }, // prettier-ignore
  { code: 'PO-2609-009', ncc: 'Kính Hoà An', owner: 'Phan Thị Lệ Hằng', placed: '28/08/2026', due: '09/09/2026', lines: 7, value: 131_400_000, holder: 'boss', state: 'Chờ duyệt', idle: 5 }, // prettier-ignore
  { code: 'PO-2609-011', ncc: 'Ngũ kim Bình Minh', owner: 'Nguyễn Văn A', placed: '29/08/2026', due: '10/09/2026', lines: 21, value: 46_920_000, holder: 'boss', state: 'Chờ duyệt', idle: 4 }, // prettier-ignore
  { code: 'PO-2608-097', ncc: 'Gỗ Trường Thịnh', owner: 'Phan Thị Lệ Hằng', placed: '22/08/2026', due: '05/09/2026', lines: 9, value: 268_500_000, holder: 'ncc', state: 'Đã gửi NCC', idle: 12 }, // prettier-ignore
  { code: 'PO-2608-102', ncc: 'Thép Nam Phát', owner: 'Nguyễn Văn A', placed: '24/08/2026', due: '08/09/2026', lines: 6, value: 57_300_000, holder: 'ncc', state: 'Đã gửi NCC', idle: 9 }, // prettier-ignore
  { code: 'PO-2608-088', ncc: 'Vải Phú Hưng', owner: 'Nguyễn Văn A', placed: '19/08/2026', due: '02/09/2026', lines: 3, value: 18_750_000, holder: 'ncc', state: 'Đã gửi NCC', idle: 15 }, // prettier-ignore
  { code: 'PO-2608-074', ncc: 'Cơ khí Thành Đạt', owner: 'Phan Thị Lệ Hằng', placed: '14/08/2026', due: '28/08/2026', lines: 11, value: 92_040_000, holder: 'kho', state: 'Về một phần', idle: 2 }, // prettier-ignore
  { code: 'PO-2608-069', ncc: 'Ngũ kim Bình Minh', owner: 'Nguyễn Văn A', placed: '12/08/2026', due: '26/08/2026', lines: 16, value: 33_610_000, holder: 'kho', state: 'Về một phần', idle: 1 }, // prettier-ignore
]

const STATE_TONE: Record<Po['state'], 'neutral' | 'warn' | 'done' | 'stop'> = {
  Nháp: 'neutral',
  'Chờ duyệt': 'warn',
  'Đã gửi NCC': 'neutral',
  'Về một phần': 'done',
}

const money = (v: number) => v.toLocaleString('vi-VN')

/** Chip lọc — mỗi chip là một CÂU HỎI, không phải một giá trị enum. */
const CHIPS: { id: string; label: string; test: (r: Po) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'mine', label: 'Chờ tôi', test: (r) => r.holder === 'me' },
  { id: 'noprice', label: 'Thiếu giá', test: (r) => r.value == null },
  { id: 'idle', label: 'Nằm im ≥ 5 ngày', test: (r) => r.idle >= 5 },
  { id: 'late', label: 'Quá hạn giao', test: (r) => r.holder === 'ncc' },
]

export default function Page() {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    const needle = q.trim().toLowerCase()
    return ROWS.filter(
      (r) =>
        test(r) &&
        (!needle ||
          r.code.toLowerCase().includes(needle) ||
          r.ncc.toLowerCase().includes(needle)),
    )
  }, [q, chip])

  const priced = kept.filter((r) => r.value != null)
  const total = priced.reduce((s, r) => s + (r.value ?? 0), 0)
  const missing = kept.length - priced.length
  const groups = HOLDERS.map((h) => ({
    h,
    rows: kept.filter((r) => r.holder === h.id),
  })).filter((g) => g.rows.length > 0)

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn C — Trang danh sách.</b> Bảng này xếp theo <b>ai đang nợ việc</b>,
          không xếp theo ngày hay theo mã: đó là điều tách khuôn danh sách khỏi một cái
          bảng thường. Thử gõ vào ô tìm và bấm các chip — số trên chip luôn bằng đúng số
          dòng hiện ra.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Cung ứng"
        title="Đơn đặt vật tư"
        facts={[
          { label: 'Tổng đơn', value: '68' },
          { label: 'Còn ở nháp', value: '65', tone: 'warn' },
          { label: 'Nằm im ≥ 5 ngày', value: '66', tone: 'stop' },
          { label: 'Khung nhìn', value: 'Đơn của tôi · quá hạn' },
        ]}
        actions={
          <>
            <Btn>Xuất Excel</Btn>
            <Btn primary href="/design-lab/mau-erp">
              + Đơn mới
            </Btn>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã đơn hoặc nhà cung cấp…"
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={ROWS.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline="Không có đơn nào khớp"
          reason={`Bộ lọc “${CHIPS.find((c) => c.id === chip)?.label}” cộng với từ khoá “${q}” không còn dòng nào.`}
          next={
            <Btn
              onClick={() => {
                setQ('')
                setChip('all')
              }}
            >
              Bỏ lọc, xem cả 68 đơn
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Mã đơn</th>
            <th>Nhà cung cấp</th>
            <th>Người phụ trách</th>
            <th>Ngày đặt</th>
            <th>Hạn giao</th>
            <th style={{ textAlign: 'right' }}>Số dòng</th>
            <th style={{ textAlign: 'right' }}>Giá trị</th>
            <th>Trạng thái</th>
            <th style={{ textAlign: 'right' }}>Nằm im</th>
          </THead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.h.id}>
                <GroupRow
                  step={g.h.step}
                  name={g.h.name}
                  cols={9}
                  meta={`${g.rows.length} đơn · ${g.h.owe}`}
                />
                {g.rows.map((r) => (
                  <Row key={r.code}>
                    <Cell pin>
                      <Code as="a" href="/design-lab/mau-erp">
                        {r.code}
                      </Code>
                    </Cell>
                    <Cell grow>{r.ncc}</Cell>
                    <Cell muted>{r.owner}</Cell>
                    <Cell num>{r.placed}</Cell>
                    <Cell
                      num
                      className={r.holder === 'ncc' ? 'text-[var(--stop)]' : undefined}
                    >
                      {r.due}
                    </Cell>
                    <Cell num>
                      <Num value={String(r.lines)} />
                    </Cell>
                    <Cell num>
                      <Num value={r.value == null ? '' : money(r.value)} strong />
                    </Cell>
                    <Cell>
                      <Tag tone={STATE_TONE[r.state]}>{r.state}</Tag>
                    </Cell>
                    <Cell num>
                      <Num value={`${r.idle}`} muted={r.idle < 3} strong={r.idle >= 5} />
                    </Cell>
                  </Row>
                ))}
              </Fragment>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={5}>Cộng {kept.length} đơn đang hiện</td>}
            cells={
              <>
                <td className="num">{kept.reduce((s, r) => s + r.lines, 0)}</td>
                <td className="num">{money(total)} ₫</td>
              </>
            }
            caveat={
              missing > 0
                ? `Chưa gồm ${missing} đơn chưa có giá — con số trên là tạm tính, không dùng để duyệt chi.`
                : 'Mọi đơn đang hiện đều đã có giá.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          <>
            <b>Nguyễn Văn A</b> · Cung ứng
          </>,
          'Công ty Hoàng Gia · Xưởng Bình Dương',
        ]}
        right={`${kept.length} / 68 đơn`}
      />
    </ScreenFrame>
  )
}
