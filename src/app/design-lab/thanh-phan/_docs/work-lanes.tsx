'use client'

import { useState } from 'react'
import {
  Cell,
  Code,
  Row,
  ScreenHeader,
  Table,
  THead,
  Tag,
  WorkLanes,
  toLanes,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — WorkLanes (B7, 24/09/2026).
 *
 * Việc giả nhưng thật về hình dạng: năm loại chứng từ khác nhau trong một hộp
 * thư — đúng điểm mà khuôn B phải làm được.
 */
type Viec = { id: string; loai: string; ma: string; viec: string; con: number }

const VIEC: Viec[] = [
  { id: 'v1', loai: 'Đơn mua', ma: 'PO-2608-088', viec: 'Gọi Vải Phú Hưng — quá hẹn giao 8 ngày', con: -8 }, // prettier-ignore
  { id: 'v2', loai: 'Lệnh SX', ma: 'LSX 06/26-27', viec: 'Xác nhận đủ vật tư để cho lệnh vào chuyền', con: -2 }, // prettier-ignore
  { id: 'v3', loai: 'Đơn mua', ma: 'PO-2609-014', viec: 'Nhập đơn giá dòng NK-0056 rồi gửi duyệt', con: 0 }, // prettier-ignore
  { id: 'v4', loai: 'Phiếu nhập', ma: 'PN-2609-031', viec: 'Kho báo lệch 24 m thép hộp — nhận thiếu hay đặt bù', con: 0 }, // prettier-ignore
  { id: 'v5', loai: 'Hồ sơ SP', ma: 'HG-2410-AB', viec: 'Trả lời Kỹ thuật về quy cách thép hộp', con: 4 }, // prettier-ignore
]

const LANES = toLanes(VIEC, [
  { id: 'tre', label: 'Trễ', tone: 'stop', test: (v: Viec) => v.con < 0 },
  { id: 'nay', label: 'Hôm nay', test: (v: Viec) => v.con === 0 },
  { id: 'toi', label: 'Sắp tới', test: (v: Viec) => v.con > 0 },
]).map((l, i) => ({ ...l, icon: (['quaHen', 'hen', 'lich'] as const)[i] }))

function HopThu() {
  const [lan, setLan] = useState('tre')
  const rows = LANES.find((l) => l.id === lan)?.rows ?? []
  return (
    <div className="border border-[var(--line)]">
      <ScreenHeader compact eyebrow="Mua hàng" title="Việc chờ tôi">
        <WorkLanes lanes={LANES} activeId={lan} onPick={setLan} panelId="hop-thu-lan" />
      </ScreenHeader>
      {/* Vùng nội dung do MÀN dựng: id khớp `panelId`, tên theo tab đang chọn
          (id tab = `${panelId}-tab-${lane.id}`). */}
      <div role="tabpanel" id="hop-thu-lan" aria-labelledby={`hop-thu-lan-tab-${lan}`}>
        <Table inline>
          <THead>
            <th>Loại</th>
            <th>Mã</th>
            <th>Việc cần làm</th>
          </THead>
          <tbody>
            {rows.map((v) => (
              <Row key={v.id}>
                <Cell>
                  <Tag>{v.loai}</Tag>
                </Cell>
                <Cell>
                  <Code as="a" href="#">
                    {v.ma}
                  </Code>
                </Cell>
                <Cell grow title={v.viec}>
                  {v.viec}
                </Cell>
              </Row>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

export default function DocWorkLanes() {
  return (
    <CompDoc
      family="work-lanes"
      summary={
        <>
          Hàng tab của hộp thư việc. Mỗi làn là một <b>thái độ</b> (Trễ / Hôm nay / Sắp
          tới) hoặc việc của một người khác nhau — không phải cách phân loại dữ liệu. Số
          trên tab do kit tự đếm từ chính các dòng của làn, nên không lệch được với bảng.
        </>
      }
      useWhen="một hộp thư (khuôn B) hay bàn làm việc chia việc thành vài làn mà người dùng xử lý lần lượt, mỗi làn một bảng."
      avoidWhen={
        <>
          lọc theo thuộc tính dữ liệu trong một danh sách (nhà cung cấp, trạng thái) —
          dùng <code>Chip</code> trong <code>FilterBar</code>; hoặc chia nội dung một
          chứng từ thành các phần — dùng <code>FastTab</code>.
        </>
      }
      variants={[
        {
          name: 'Ba làn trong đầu trang',
          when: 'đặt làm children của ScreenHeader — tab đang chọn nối liền với bảng bên dưới. Bấm từng làn (hoặc Tab tới rồi ← →): số trên tab luôn bằng số dòng. Truyền panelId và bọc bảng trong role="tabpanel" cùng id để tab trỏ tới vùng nội dung.',
          demo: <HopThu />,
        },
        {
          name: 'Làn rỗng vẫn giữ chỗ',
          when: 'hết việc thì tab vẫn đó với số 0 — “hết việc rồi” là thông tin.',
          demo: (
            <WorkLanes
              lanes={[
                { id: 'cu', label: 'Cung ứng', rows: [1, 2, 3, 4], icon: 'don' },
                { id: 'kt', label: 'Kỹ thuật', rows: [], icon: 'vattu' },
                { id: 'xong', label: 'Đã xong', rows: [1, 2], icon: 'xong' },
              ]}
              activeId="kt"
              onPick={() => {}}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Tab đang chọn',
          looks:
            'Nền trang, viền ba phía, chữ đậm; nối liền với vùng dưới (che vạch đáy). Số trên nền đặc màu hành động — hoặc màu dừng nếu làn tone stop.',
          behaves:
            'aria-selected = true; tabindex 0 — điểm dừng Tab DUY NHẤT của hàng tab.',
        },
        {
          state: 'Tab khác',
          looks:
            'Không viền, chữ phụ; số trên nền xám nhạt — làn tone stop thì nền nhạt màu dừng, chữ màu dừng.',
          behaves:
            'tabindex -1 (tới bằng mũi tên, không bằng Tab). Bấm gọi onPick(id). Rê chuột: nền trang, chữ mực.',
        },
        {
          state: 'Làn rỗng',
          looks: 'Như tab thường, số 0.',
          behaves: 'Vẫn bấm được — không bị giấu hay khoá.',
        },
        {
          state: 'Tràn ngang',
          looks: 'Hàng tab cuộn ngang, tab không co lại.',
          behaves: 'Không có nút cuộn — kéo, hoặc ← → tới tab khuất.',
        },
      ]}
      a11y={{
        role: 'tablist · tab (aria-selected, aria-controls khi có panelId)',
        keys: [
          {
            key: 'Tab',
            does: 'Vào hàng tab tại tab ĐANG CHỌN, Tab tiếp là rời hàng tab (tabindex lăn).',
          },
          { key: '← →', does: 'Sang làn trước / sau (vòng quanh) và CHỌN luôn.' },
          { key: 'Home / End', does: 'Về làn đầu / cuối và chọn luôn.' },
          { key: 'Enter / Space', does: 'Chọn làn (tab đang đứng vốn đã chọn).' },
        ],
        reader: (
          <>
            Tên mỗi tab là nhãn + số (“Trễ 2”), kèm vai trò tab và trạng thái đã chọn. Có{' '}
            <code>panelId</code> thì mọi tab mang <code>aria-controls</code> trỏ tới vùng
            nội dung, và tab có id <code>{'${panelId}-tab-${lane.id}'}</code> để vùng đặt{' '}
            <code>aria-labelledby</code> — vùng <code>tabpanel</code> do MÀN dựng, kit
            không dựng hộ. Đã sửa 24/09/2026 (B7½): trước đó mỗi tab một điểm dừng Tab,
            mũi tên không chạy, không có <code>aria-controls</code>, nút thiếu{' '}
            <code>type=&quot;button&quot;</code>. <b>Chỗ chưa tốt, ghi thật:</b> hàng tab
            (<code>tablist</code>) không có tên; bỏ <code>panelId</code> thì tab không trỏ
            đi đâu.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Để kit đếm từ rows của làn — cùng tập với bảng bên dưới.',
          dont: 'Đếm số trên tab bằng một hàm khác hàm lọc bảng.',
          source:
            'CLAUDE.md — nguyên tắc 3 “Con số là một lời hứa”; kit/Shell.tsx chú thích WorkLanes',
        },
        {
          do: 'Chỉ làn Trễ mang tone stop.',
          dont: 'Tô màu mọi làn — màu hết là tín hiệu, đúng lỗi badge đỏ của v3.',
          source: 'design-lab/mau-hop-thu/page.tsx — chú thích LANES',
        },
        {
          do: 'Làn gom việc XUYÊN mọi loại chứng từ: đơn mua, lệnh, phiếu kho.',
          dont: 'Nhốt hộp thư trong một phòng — người kiêm hai việc phải mở hai khu và tự nhớ.',
          source:
            'docs/thiet-ke-huong-erp.md — lỗ hổng 1 “hộp thư việc bị nhốt trong một phòng”',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
