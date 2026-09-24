'use client'

import { useState } from 'react'
import {
  Cell,
  Code,
  FilterBar,
  Row,
  SortHead,
  sortAria,
  Table,
  TableSettings,
  THead,
  useKitTable,
  type KitCol,
  type SortDir,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — máy bảng `useKitTable` + `SortHead` + `TableSettings` (B7, 24/09/2026).
 *
 * Dữ liệu mẫu cố ý có ô trống (NCC chưa có giá) để thấy luật "ô trống luôn
 * nằm cuối", và có tên bắt đầu bằng "Đ" để thấy so chữ theo tiếng Việt. Mẫu
 * 1.000 dòng nằm ở `/design-lab/thanh-phan#may-bang` — ở đây giữ nhỏ cho test.
 */

type Ncc = { id: string; ten: string; hang: string; don: number; chi: number | null }
const NCC: Ncc[] = [
  { id: 'n1', ten: 'Đại Thắng', hang: 'Bao bì', don: 3, chi: 120_000_000 },
  { id: 'n2', ten: 'An Phát', hang: 'Thép hộp', don: 12, chi: null },
  { id: 'n3', ten: 'Bình Minh', hang: 'Gỗ tràm', don: 7, chi: 40_500_000 },
  { id: 'n4', ten: 'Ân Hưng', hang: 'Vít - bu lông', don: 0, chi: null },
  { id: 'n5', ten: 'Minh Đạt', hang: 'Sơn tĩnh điện', don: 5, chi: 18_200_000 },
]
const tien = (n: number | null) => (n == null ? '' : n.toLocaleString('vi-VN'))

// Khai ở MODULE: mảng cột mới mỗi lượt vẽ làm máy tính lại cả mô hình dòng.
const COT: KitCol<Ncc>[] = [
  { id: 'ten', header: 'Nhà cung cấp', pin: true, rowHeader: true, grow: true, sort: (r) => r.ten, cell: (r) => <Code as="a" href="#">{r.ten}</Code> }, // prettier-ignore
  {
    id: 'hang',
    header: 'Mặt hàng',
    muted: true,
    sort: (r) => r.hang,
    cell: (r) => r.hang,
  },
  { id: 'don', header: 'Đã đặt', num: true, sort: (r) => r.don, foot: 27, cell: (r) => r.don || '' }, // prettier-ignore
  { id: 'chi', header: 'Tổng chi', num: true, sort: (r) => r.chi, foot: tien(178_700_000), cell: (r) => tien(r.chi) }, // prettier-ignore
  { id: 'mst', header: 'Mã số thuế', hidden: true, cell: () => '0301234567' },
]

function MayDayDu() {
  const t = useKitTable({
    rows: NCC,
    columns: COT,
    rowKey: (r) => r.id,
    prefsKey: 'design-lab-doc-may-bang',
    foot: { label: 'Cộng 5 NCC', note: 'Chưa gồm đơn đã huỷ.' },
  })
  return (
    <div className="grid gap-0">
      <FilterBar>
        <span className="text-k-sm text-[var(--ink-2)]">
          Bấm tiêu đề để sắp · nút Cột để ẩn cột, đổi mật độ
        </span>
        <span className="ml-auto">
          <TableSettings engine={t} />
        </span>
      </FilterBar>
      <Table engine={t} inline label="Nhà cung cấp" />
    </div>
  )
}

function MayChonDong() {
  const [chon, setChon] = useState('n3')
  const t = useKitTable({
    rows: NCC,
    columns: COT,
    rowKey: (r) => r.id,
    initialSort: { id: 'don', desc: true },
  })
  return (
    <div className="grid gap-2">
      <Table
        engine={t}
        inline
        label="Nhà cung cấp — chọn để soi"
        onRowClick={(r) => setChon(r.id)}
        isSelected={(r) => r.id === chon}
        rowAnchor={(r) => r.id}
      />
      <p className="text-k-sm text-[var(--ink-2)]">
        Đang soi: <b>{NCC.find((r) => r.id === chon)?.ten}</b>
      </p>
    </div>
  )
}

const LENH = [
  { ma: '02/26-27 - MX', sp: 9 },
  { ma: '05/26-27 - MX', sp: 14 },
  { ma: '03/26-27 - MX', sp: 2 },
]
function SortHeadGhepTay() {
  const [dir, setDir] = useState<SortDir>(false)
  const rows =
    dir === false ? LENH : [...LENH].sort((a, b) => (dir === 'asc' ? a.sp - b.sp : b.sp - a.sp)) // prettier-ignore
  return (
    <Table inline label="Lệnh theo số sản phẩm">
      <THead>
        <th>Lệnh</th>
        <th aria-sort={sortAria(dir, true)} style={{ textAlign: 'right' }}>
          <SortHead
            dir={dir}
            align="right"
            onSort={() => setDir(dir === false ? 'asc' : dir === 'asc' ? 'desc' : false)}
          >
            Số SP
          </SortHead>
        </th>
      </THead>
      <tbody>
        {rows.map((r) => (
          <Row key={r.ma}>
            <Cell grow rowHeader>
              <Code as="a" href="#">
                {r.ma}
              </Code>
            </Cell>
            <Cell num>{r.sp}</Cell>
          </Row>
        ))}
      </tbody>
    </Table>
  )
}

export default function DocTableEngine() {
  return (
    <CompDoc
      family="table-engine"
      alsoImport={['useKitTable', 'sortAria', 'type KitCol']}
      summary={
        <>
          Máy bảng: <code>useKitTable</code> (trên <code>@tanstack/react-table</code>) lo
          DỮ LIỆU — sắp xếp, ẩn cột, mật độ, nhớ lựa chọn theo người xem — rồi đưa cho vỏ{' '}
          <code>Table</code> hoặc <code>Grid</code> qua <code>engine=&#123;…&#125;</code>.{' '}
          <code>SortHead</code> là tiêu đề sắp được; <code>TableSettings</code> là nút
          “Cột” mở menu chọn cột và mật độ. Ô vẽ bằng JSX tự do (<code>cell</code>), không
          có lỗ thoát nào phải đục.
        </>
      }
      useWhen="bảng cần sắp xếp theo cột, cho người xem ẩn cột hay chọn mật độ, hoặc có hơn 200 dòng (ảo hoá tự bật)."
      avoidWhen={
        <>
          bảng ngắn chỉ đọc, không cần sắp — kiểu ghép JSX của <code>Table</code> đơn giản
          hơn; bảng chéo hai tầng tiêu đề (dùng <code>MatrixTable</code>, cùng kiểu cột{' '}
          <code>KitCol</code> nhưng không sắp); sắp NHIỀU tầng là việc của báo cáo, máy
          chỉ sắp một cột một lúc.
        </>
      }
      variants={[
        {
          name: 'Máy đầy đủ — sắp, ẩn cột, mật độ, chân tự chia cột',
          when: 'cột “Mã số thuế” mặc định ẩn, bật trong menu Cột. Ẩn cột nào chân bảng cũng tự khớp. Lựa chọn nhớ theo prefsKey trên máy người xem.',
          demo: <MayDayDu />,
        },
        {
          name: 'Sắp sẵn + dòng đang chọn',
          when: 'initialSort mở màn đã xếp (đây: nhiều đơn nhất trước). onRowClick + isSelected để soi một dòng — dòng nhận Tab, Enter / Space bấm như chuột; rowAnchor để link ?mo= cuộn tới.',
          demo: <MayChonDong />,
        },
        {
          name: 'SortHead ghép tay',
          when: 'bảng JSX muốn một cột sắp được mà chưa chuyển máy. aria-sort đặt ở <th> bằng sortAria. Chưa màn nào dùng kiểu này — máy tự dùng SortHead bên trong.',
          demo: <SortHeadGhepTay />,
        },
      ]}
      states={[
        {
          state: 'Cột chưa sắp',
          looks: 'Mũi tên hai đầu, mờ — luôn hiện ở cột sắp được, không đợi rê chuột.',
          behaves: 'aria-sort="none". Bấm → tăng.',
        },
        {
          state: 'Đang sắp tăng / giảm',
          looks: 'Mũi tên một chiều, chữ tiêu đề đậm lên mực chính.',
          behaves:
            'Vòng ba nhịp: tăng → giảm → bỏ. Chữ so theo tiếng Việt (An, Ân, Bình, Đại), số theo số (7 < 12), ô trống LUÔN cuối cả hai chiều.',
        },
        {
          state: 'Cột không sắp được',
          looks: 'Chữ trơn, không mũi tên.',
          behaves: 'Không có nút, không có aria-sort — không phải nút giả.',
        },
        {
          state: 'Rê chuột tiêu đề',
          looks: 'Chữ đậm lên mực chính.',
          behaves: '—',
        },
        {
          state: 'Menu Cột đang mở',
          looks:
            'Ô tick cho từng cột; cột định danh (ghim) xám kèm chữ “định danh”; nhóm Mật độ; “Đặt lại như mặc định”.',
          behaves:
            'Tick cột thì menu VẪN MỞ. Cột ghim khoá — mất nó thì mọi dòng thành vô danh.',
        },
        {
          state: 'Đang ẩn cột',
          looks: 'Nút đổi chữ thành “Cột (ẩn 2)”.',
          behaves: 'Chân bảng tự chia lại dải — không lệch cột.',
        },
        {
          state: 'Mật độ Dày',
          looks: 'Dòng 26px thay 31px (token kit-dense trên vùng cuộn).',
          behaves: 'Nhớ theo prefsKey; không có prefsKey thì mất khi tải lại trang.',
        },
        {
          state: 'Hơn 200 dòng',
          looks: 'Trông như bảng thường; chỉ ~38 dòng thật trong DOM.',
          behaves:
            'Dòng đệm trên/dưới giữ cột thẳng và tiêu đề/chân dính. Ctrl+F của trình duyệt KHÔNG thấy dòng ngoài DOM.',
        },
        {
          state: 'Lưu trữ bị chặn',
          looks: 'Không khác.',
          behaves:
            'Chế độ riêng tư / chặn localStorage: nhớ tạm trong trang, bảng vẫn chạy.',
        },
      ]}
      a11y={{
        role: 'columnheader[aria-sort] > button (SortHead) · rowheader (cột rowHeader) · button → menu: menuitemcheckbox, menuitemradio, menuitem (TableSettings)',
        keys: [
          {
            key: 'Tab',
            does: 'Tới nút tiêu đề của từng cột sắp được, nút Cột, và — khi có onRowClick — từng dòng (kể cả dòng ảo hoá đang trong DOM).',
          },
          {
            key: 'Enter / Space',
            does: 'Trên tiêu đề: đảo chiều sắp. Trên nút Cột: mở menu. Trên dòng có onRowClick: bấm dòng như chuột.',
          },
          { key: '↑ ↓', does: 'Trong menu: đi mục, bỏ qua cột bị khoá.' },
          {
            key: 'Space',
            does: 'Trong menu: tick/bỏ tick cột, chọn mật độ — menu không đóng.',
          },
          { key: 'Esc', does: 'Đóng menu, tiêu điểm về nút Cột.' },
        ],
        reader: (
          <>
            <code>&lt;th&gt;</code> mang <code>aria-sort</code> (ascending / descending /
            none) — có test canh. Tên nút tiêu đề là chữ tiêu đề; mũi tên là icon trang
            trí. Bảng ảo hoá báo tổng thật bằng <code>aria-rowcount</code> và vị trí từng
            dòng bằng <code>aria-rowindex</code>. Menu Cột qua axe. Cột khai{' '}
            <code>rowHeader</code> vẽ ô thành{' '}
            <code>&lt;th scope=&quot;row&quot;&gt;</code> (hình không đổi), nên đi ngang
            một dòng trình đọc nói kèm tên dòng — màn Nhà cung cấp đặt cờ này ở cột tên.
            Cờ khai RIÊNG, không suy từ <code>pin</code>: ghim là bố cục, tiêu đề dòng là
            nghĩa; và chỉ vỏ <code>Table</code> đọc nó, <code>Grid</code> thì không. Dòng
            có <code>onRowClick</code> nhận Tab và Enter/Space, cả khi bảng đang ảo hoá.
            (Cả hai vá 24/09/2026, B7½; test ở table.a11y.test.tsx.){' '}
            <b>Chỗ chưa tốt, ghi thật:</b> sắp xong không có thông báo riêng — người nghe
            chỉ biết nếu trình đọc đọc lại <code>aria-sort</code>; nút Cột có tên “Cột và
            mật độ — đang ẩn 2 cột” trong khi chữ hiện là “Cột (ẩn 2)” — tên vẫn bắt đầu
            bằng “Cột” nên gọi bằng giọng được; và vỏ <code>Table</code> của màn Nhà cung
            cấp chưa truyền <code>label</code>, nên bảng đó vẫn chưa có tên.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Khai <code>columns</code> ở module hoặc trong <code>useMemo</code>.
            </>
          ),
          dont: 'Tạo mảng cột mới mỗi lượt vẽ — máy tính lại cả mô hình dòng.',
          source:
            'chú thích đầu TableEngine.tsx; test “useMemo cột” trong table-engine.test.tsx',
        },
        {
          do: (
            <>
              Mỗi cột khai ô tổng của RIÊNG nó (<code>foot</code>), để{' '}
              <code>footRuns</code> tự gộp dải và đặt câu lưu ý ở dải cuối.
            </>
          ),
          dont: 'Tính colSpan chân bảng bằng tay rồi thêm/bớt một cột mà quên sửa.',
          source:
            'lỗi lệch cột từng dính 7 màn — chú thích footRuns, docs/he-thiet-ke-erp-ke-hoach.md §9.7',
        },
        {
          do: (
            <>
              Đặt <code>rowHeader: true</code> cho ĐÚNG MỘT cột — cột mà người đọc gọi
              dòng bằng nó (tên NCC, mã đơn).
            </>
          ),
          dont: 'Để trình đọc đi ngang một dòng chỉ nghe “12, 40.500.000” — những con số không chủ.',
          source: 'chú thích cột “Nhà cung cấp” trong NccScreen.tsx (B7½, 24/09/2026)',
        },
        {
          do: 'Để cột KHÔNG có sort khi nó không có một con số xếp hạng thật.',
          dont: 'Cho sắp “Tổng chi” khi NCC mua bằng cả VND lẫn USD — NCC mua bằng USD tụt đáy như thể mua ít nhất.',
          source:
            'chú thích cột “Tổng chi” trong NccScreen.tsx (màn Nhà cung cấp chuyển máy 24/09/2026)',
        },
        {
          do: 'Đưa vùng cuộn cho bộ ảo hoá qua state (callback ref) — Table đã làm sẵn.',
          dont: 'Đọc ref.current của thẻ cha lúc khởi động ảo hoá: nó còn null, bảng không bao giờ nghe cuộn, cuộn tới giữa thì thân bảng TRẮNG.',
          source:
            'lỗi 1 ở docs/he-thiet-ke-erp-ke-hoach.md §9.7; test “thân bảng không trắng”',
        },
      ]}
      tested={{ file: 'src/components/kit/table-engine.test.tsx' }}
    />
  )
}
