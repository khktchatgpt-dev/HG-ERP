'use client'

import { useState } from 'react'
import {
  Cell,
  Code,
  GroupRow,
  Num,
  Row,
  Table,
  Tag,
  TFoot,
  THead,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — họ `Table` (B7, 24/09/2026).
 *
 * Ba ví dụ sống cho ba cách dùng thật: kiểu ghép JSX có dòng khối + chân bảng
 * (khuôn C, như `/design-lab/mau-danh-sach`), bảng phụ có dòng đang chọn, và
 * kiểu máy (`engine`) — trang `table-engine` nói kỹ phần máy.
 *
 * Bốn chỗ yếu mà bản đầu của trang này ghi thật — bảng không tên, ô đầu dòng
 * không phải tiêu đề dòng, dòng khối không gắn với dòng dưới nó, bấm dòng chỉ
 * ăn chuột — đã vá ở B7½ (24/09/2026). Ví dụ dưới dùng đúng cách mới: `label`,
 * `Cell rowHeader`, mỗi khối một `<tbody>`.
 */

type Don = {
  ma: string
  ncc: string
  han: string
  dong: number
  tien: number | null
  tt: [string, 'neutral' | 'warn' | 'stop' | 'done']
}
const NHOM: { id: string; step: number; ten: string; rows: Don[] }[] = [
  {
    id: 'ncc',
    step: 1,
    ten: 'Chờ nhà cung cấp xác nhận',
    rows: [
      { ma: 'PO-2609-014', ncc: 'CƠ KHÍ THÀNH ĐẠT', han: '30/09/2026', dong: 6, tien: 48_600_000, tt: ['Đã gửi NCC', 'warn'] }, // prettier-ignore
      { ma: 'PO-2609-017', ncc: 'CÔNG TY TNHH SX TM MINH ĐẠT', han: '22/09/2026', dong: 3, tien: 12_150_000, tt: ['Trễ hẹn', 'stop'] }, // prettier-ignore
    ],
  },
  {
    id: 'duyet',
    step: 2,
    ten: 'Chờ giám đốc duyệt',
    rows: [
      { ma: 'PO-2609-021', ncc: 'CÔNG TY NHỰA SƠN TÍN PHÁT', han: '05/10/2026', dong: 4, tien: null, tt: ['Chờ duyệt', 'neutral'] }, // prettier-ignore
    ],
  },
]
const tien = (n: number) => n.toLocaleString('vi-VN')

function BangDonMua() {
  const tatCa = NHOM.flatMap((g) => g.rows)
  const tong = tatCa.reduce((s, r) => s + (r.tien ?? 0), 0)
  const chuaGia = tatCa.filter((r) => r.tien == null).length
  return (
    <Table label="Đơn mua đang chờ, theo bước">
      <THead pinFirst>
        <th>Mã đơn</th>
        <th>Nhà cung cấp</th>
        <th>Hạn giao</th>
        <th style={{ textAlign: 'right' }}>Số dòng</th>
        <th style={{ textAlign: 'right' }}>Giá trị</th>
        <th>Trạng thái</th>
      </THead>
      {/* Mỗi khối một <tbody>: tiêu đề khối (rowgroup) chỉ nhận đúng dòng của nó. */}
      {NHOM.map((g) => (
        <tbody key={g.id}>
          <GroupRow step={g.step} name={g.ten} cols={6} meta={`${g.rows.length} đơn`} />
          {g.rows.map((r) => (
            <Row key={r.ma}>
              <Cell pin rowHeader>
                <Code as="a" href="#">
                  {r.ma}
                </Code>
              </Cell>
              <Cell grow title={r.ncc}>
                {r.ncc}
              </Cell>
              <Cell num className={r.tt[1] === 'stop' ? 'text-[var(--stop)]' : undefined}>
                {r.han}
              </Cell>
              <Cell num>
                <Num value={String(r.dong)} />
              </Cell>
              <Cell num>
                <Num value={r.tien == null ? '' : tien(r.tien)} strong />
              </Cell>
              <Cell>
                <Tag tone={r.tt[1]}>{r.tt[0]}</Tag>
              </Cell>
            </Row>
          ))}
        </tbody>
      ))}
      <TFoot
        label={<td colSpan={3}>Cộng {tatCa.length} đơn đang hiện</td>}
        cells={
          <>
            <td className="num">{tatCa.reduce((s, r) => s + r.dong, 0)}</td>
            <td className="num">{tien(tong)} ₫</td>
          </>
        }
        caveat={`Chưa gồm ${chuaGia} đơn chưa có giá.`}
        caveatSpan={1}
      />
    </Table>
  )
}

const VT = [
  { ma: 'VT-00123', ten: 'Ống thép 25×25×1.2', ton: 480, dvt: 'cây' },
  { ma: 'VT-00124', ten: 'Ống thép 30×30×1.4', ton: 0, dvt: 'cây' },
  { ma: 'VT-00310', ten: 'Vít 7 màu 4×20', ton: 12_500, dvt: 'con' },
  { ma: 'VT-00512', ten: 'Sơn tĩnh điện đen mờ', ton: 64, dvt: 'kg' },
]

function BangChonDong() {
  const [chon, setChon] = useState('VT-00310')
  return (
    <div className="grid gap-2">
      <Table inline label="Vật tư để soi">
        <THead>
          <th>Mã vật tư</th>
          <th>Tên</th>
          <th style={{ textAlign: 'right' }}>Tồn</th>
          <th>ĐVT</th>
        </THead>
        <tbody>
          {VT.map((r) => (
            <Row key={r.ma} selected={chon === r.ma} onClick={() => setChon(r.ma)}>
              <Cell rowHeader>
                {/* Dòng nhận Tab + Enter/Space; mã vẫn là NÚT vì đó là thứ trình
                    đọc gọi được tên — dòng chỉ là lối tắt. */}
                <Code as="button" onClick={() => setChon(r.ma)}>
                  {r.ma}
                </Code>
              </Cell>
              <Cell grow>{r.ten}</Cell>
              <Cell num>
                <Num value={r.ton ? r.ton.toLocaleString('vi-VN') : ''} />
              </Cell>
              <Cell muted>{r.dvt}</Cell>
            </Row>
          ))}
        </tbody>
      </Table>
      <p className="text-k-sm text-[var(--ink-2)]">
        Đang soi: <b className="num">{chon}</b>
      </p>
    </div>
  )
}

type Ton = { ma: string; ten: string; ton: number }
const TON: Ton[] = [
  { ma: 'VT-00124', ten: 'Ống thép 30×30×1.4', ton: 0 },
  { ma: 'VT-00123', ten: 'Ống thép 25×25×1.2', ton: 480 },
  { ma: 'VT-00512', ten: 'Sơn tĩnh điện đen mờ', ton: 64 },
]
const COT_TON: KitCol<Ton>[] = [
  { id: 'ma', header: 'Mã', pin: true, rowHeader: true, sort: (r) => r.ma, cell: (r) => <Code as="a" href="#">{r.ma}</Code> }, // prettier-ignore
  { id: 'ten', header: 'Tên vật tư', grow: true, sort: (r) => r.ten, cell: (r) => r.ten },
  { id: 'ton', header: 'Tồn', num: true, sort: (r) => r.ton, foot: 544, cell: (r) => r.ton.toLocaleString('vi-VN') }, // prettier-ignore
]

function BangMay() {
  const t = useKitTable({
    rows: TON,
    columns: COT_TON,
    rowKey: (r) => r.ma,
    foot: { label: 'Cộng 3 mã' },
  })
  return <Table engine={t} inline label="Tồn vật tư" />
}

export default function DocTable() {
  return (
    <CompDoc
      family="table"
      summary={
        <>
          Bảng danh sách của màn khuôn C. Tiêu đề cột dính trên, chân tổng dính dưới, cột
          số chữ đơn cách căn phải, dòng khối thay cho cột “Nhóm” lặp ở mọi dòng — những
          thứ này <b>không tắt được</b>. Hai kiểu dùng: ghép JSX (<code>THead</code> +{' '}
          <code>Row</code>/<code>Cell</code> + <code>TFoot</code>) hoặc kiểu máy (
          <code>engine</code>, tự sắp xếp và ảo hoá từ 200 dòng).
        </>
      }
      useWhen="bảng chính của một màn danh sách, hoặc bảng phụ chỉ đọc trong một khối (inline) — người dùng đến để đọc, lọc và mở từng dòng."
      avoidWhen={
        <>
          lưới dòng của một chứng từ có thanh công cụ và ô sửa được (dùng{' '}
          <code>Grid</code>
          ); bảng chéo tiêu đề hai tầng, ghim nhiều cột (dùng <code>MatrixTable</code>);
          nhập 40 dòng như Excel (khuôn F, <code>Grid</code> trong bảng nhập).
        </>
      }
      variants={[
        {
          name: 'Ghép JSX — dòng khối + chân bảng có lưu ý',
          when: 'bảng chính khuôn C. Nhãn chân (3 cột) + 2 ô tổng + lưu ý (1 cột) = 6 cột, đúng bằng THead.',
          demo: <BangDonMua />,
        },
        {
          name: 'Bảng phụ inline — dòng đang chọn',
          when: 'bảng nằm trong một khối, cao theo nội dung, trần 240px rồi tự cuộn. Bấm dòng hoặc bấm mã để soi — hoặc Tab tới dòng rồi Enter / Space.',
          demo: <BangChonDong />,
        },
        {
          name: 'Kiểu máy — engine',
          when: 'cần sắp xếp, ẩn cột, hay có hơn 200 dòng. Bấm tiêu đề để sắp. Mẫu 1.000 dòng ở /design-lab/thanh-phan#may-bang; máy xem trang useKitTable.',
          demo: <BangMay />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Tiêu đề chữ hoa nền nâng; ô ngăn bằng vạch tóc; dòng chẵn sọc nhạt (pha từ mặt bảng, nền ĐẶC).',
          behaves:
            'Bảng chính lấy hết chỗ còn lại của ScreenFrame; bảng inline cao theo nội dung, trần --table-inline-max (240px).',
        },
        {
          state: 'Rê chuột',
          looks: 'Cả dòng đổi nền nhạt màu hành động (luật chung ở erp.css).',
          behaves: 'Có onClick thì con trỏ thành bàn tay.',
        },
        {
          state: 'Đang chọn dòng',
          looks:
            'Nền nhạt màu hành động + vạch trái 2px màu hành động — không dùng màu vòng đời.',
          behaves:
            'Do màn quyết (selected / isSelected). Vẫn đúng ở dòng chẵn — luật khai sau luật sọc.',
        },
        {
          state: 'Cuộn dọc',
          looks: 'Tiêu đề dính trên, chân dính dưới; chân nằm trên cả cột ghim.',
          behaves:
            'Vùng cuộn tự đo chiều cao tiêu đề/chân (ResizeObserver) để Tab tới ô nào trình duyệt cũng chừa đúng chỗ.',
        },
        {
          state: 'Cuộn ngang',
          looks:
            'Cột ghim (Cell pin + THead pinFirst) đứng yên, nền đặc; tên dòng khối bám mép trái, phần tóm tắt trôi theo.',
          behaves:
            'Bảng cuộn ngang khi hẹp hơn --table-min (mặc định 680px) — không bóp cột tên.',
        },
        {
          state: 'Focus',
          looks:
            'Vòng 2px màu hành động quanh link/nút trong ô; dòng có onClick thì vòng quanh cả dòng.',
          behaves:
            'Dòng có onClick (hay onRowClick ở kiểu máy, kể cả dòng ảo hoá) nhận Tab; dòng không bấm được và ô thì không — chỉ thứ bấm được bên trong ô.',
        },
        {
          state: 'Rỗng',
          looks: 'Table không tự vẽ trạng thái rỗng.',
          behaves:
            'Màn bày Empty THAY cho bảng (xem NccScreen) — đừng để bảng trơ hàng tiêu đề.',
        },
        {
          state: 'Lệch cột chân bảng (chỉ ở dev)',
          looks: 'Không đổi gì trên màn — ô chân bị bóp, chữ xếp dọc.',
          behaves:
            'useColSpanGuard đo DOM và console.error “LỆCH CỘT CHÂN BẢNG: thead=…, tfoot=…”. Không chạy ở bản build.',
        },
        {
          state: 'Kiểu máy: mật độ Dày / hơn 200 dòng',
          looks: 'Dòng 26px thay 31px; quá 200 dòng thì chỉ vài chục dòng nằm trong DOM.',
          behaves: 'Xem trang useKitTable.',
        },
      ]}
      a11y={{
        role: 'table (thẻ <table> thật, tên từ label) · columnheader · rowheader (Cell rowHeader) · rowgroup header (GroupRow) · row · cell',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua dòng bấm được và link/nút trong ô. Trình duyệt cuộn vào vùng nhìn, chừa tiêu đề, chân và cột ghim (T6: màn NCC 59/344 lần bị che → 0/344).',
          },
          {
            key: 'Enter',
            does: 'Mở link / bấm nút trong ô. Trên chính dòng có onClick: bấm dòng như chuột (Enter trên link trong dòng không bấm dòng thêm lần nữa).',
          },
          {
            key: 'Space',
            does: 'Trên chính dòng có onClick: bấm dòng; vùng cuộn không nhảy trang.',
          },
          {
            key: '← ↑ → ↓',
            does: 'Không dùng — đây là bảng đọc, không phải lưới ARIA đi từng ô.',
          },
        ],
        reader: (
          <>
            Tiêu đề là <code>&lt;th&gt;</code> trong <code>&lt;thead&gt;</code>, nên đi
            từng ô trình đọc nói kèm tên cột. Kiểu máy có <code>aria-sort</code> ở tiêu
            đề, và khi ảo hoá thì <code>aria-rowcount</code>/<code>aria-rowindex</code>{' '}
            báo tổng thật (“1.001 hàng”, không phải “40 hàng”). Bảng có tên từ{' '}
            <code>label</code> (<code>aria-label</code>) — màn có hai bảng thì người đi
            bằng phím phân biệt được. <code>Cell rowHeader</code> (kiểu máy:{' '}
            <code>KitCol.rowHeader</code>) là{' '}
            <code>&lt;th scope=&quot;row&quot;&gt;</code> mang hình ô thường, nên đi dọc
            một cột số trình đọc nói kèm tên dòng. Dòng khối là{' '}
            <code>&lt;th scope=&quot;rowgroup&quot;&gt;</code> — ĐÚNG NGHĨA khi mỗi khối
            nằm trong một <code>&lt;tbody&gt;</code> riêng như ví dụ trên; dồn mọi khối
            vào một <code>&lt;tbody&gt;</code> thì tiêu đề nhận cả dòng của khối sau. Cả
            bốn thứ này (tên, tiêu đề dòng, dòng khối, dòng bấm bằng phím) vá 24/09/2026,
            B7½. <b>Ghi thật:</b> <code>label</code> và <code>rowHeader</code> là TUỲ CHỌN
            — màn cũ chưa truyền thì vẫn là bảng không tên, ô đầu dòng vẫn là{' '}
            <code>&lt;td&gt;</code>. Dòng bấm được vẫn nên có ô định danh là link/nút:
            dòng chỉ là lối tắt, tên đọc được nằm ở link/nút. Máy bảng (sắp, ẩn cột, ảo
            hoá) có test riêng ở table-engine.test.tsx.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Cộng colSpan của nhãn + số ô tổng + caveatSpan cho bằng số cột THead.',
          dont: 'Thêm caveat mà quên nó chiếm 2 cột mặc định — ô chân bị bóp, chữ xếp dọc, và nó sticky nên ĐÈ lên thân bảng.',
          source:
            'chú thích useColSpanGuard (Table.tsx): 4 màn dính cùng lúc, rà 23/09/2026 — Lệnh SX, Vật tư theo lệnh, Hồ sơ NCC ×2, Trung tâm duyệt; và màn ghi sản lượng (caveatSpan)',
        },
        {
          do: (
            <>
              Đặt <code>cols</code> của GroupRow đúng số cột của bảng.
            </>
          ),
          dont: 'Tin rằng chuông lệch cột sẽ bắt — nó chỉ so tiêu đề với chân, không so dòng khối.',
          source:
            'docs/he-thiet-ke-erp-ke-hoach.md §9.8, lỗi 3: màn ghi có dòng khối hụt một ô (cols 7/10, bảng 8/11 cột)',
        },
        {
          do: (
            <>
              <code>Cell grow</code> cho cột TÊN — nó xin phần dư, có sàn 200px.
            </>
          ),
          dont: 'Chia bề rộng bằng w-1/3: cột tên co về 110px (“BAO BÌ ĐẠI THẮN”) trong khi cột ngày chiếm 205px.',
          source:
            'chú thích Cell, commit f318a02 (17/09/2026, màn Nhà cung cấp ở khung 693px)',
        },
        {
          do: (
            <>
              Mỗi khối một <code>&lt;tbody&gt;</code>, <code>GroupRow</code> đứng đầu; ô
              định danh đặt <code>rowHeader</code>; bảng có <code>label</code>.
            </>
          ),
          dont: 'Dồn mọi khối vào một <tbody> — tiêu đề khối (rowgroup) nhận luôn dòng của khối sau, trình đọc nói sai dòng thuộc khối nào.',
          source: 'chú thích GroupRow (kit/Table.tsx), B7½ 24/09/2026',
        },
        {
          do: 'Dòng khối (GroupRow) cho danh sách dài có nhóm.',
          dont: 'Chép “Bu lông - vít - đinh - liên kết” xuống 100 dòng — tờ đọc như bức tường chữ.',
          source: 'chú thích GroupRow — chủ dự án chê 07/09/2026',
        },
        {
          do: 'Bảng có hơn 200 dòng, hoặc cần sắp xếp/chọn cột, thì chuyển sang kiểu máy khi có việc chạm tới màn đó.',
          dont: 'Chuyển hàng loạt ~40 màn ghép JSX cho đều.',
          source: 'docs/he-thiet-ke-erp-ke-hoach.md §9.7 “Chưa làm” và CLAUDE.md',
        },
      ]}
      tested={{ file: 'src/components/kit/table.a11y.test.tsx' }}
    />
  )
}
