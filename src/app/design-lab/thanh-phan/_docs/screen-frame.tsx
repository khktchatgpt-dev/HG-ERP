'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  DocChain,
  Row,
  ScreenFrame,
  ScreenHeader,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — ScreenFrame / ScreenHeader (B7, 24/09/2026).
 *
 * `ScreenFrame` là khung CẢ MÀN: nó tự đo và chiếm hết phần cao còn lại của
 * cửa sổ. Trong sổ này nó bị ÉP cao 360px bằng lớp `h-full!` trên thẻ bọc,
 * chỉ để nằm gọn trong trang — trên màn thật đừng làm vậy.
 */
type Don = {
  ma: string
  ncc: string
  dong: number
  gt: number | null
  hen: string
  tt: string
}

const NCC = ['Cơ khí Thành Đạt', 'Gỗ Trường Thịnh', 'Vải Phú Hưng', 'Sơn Đại Việt', 'Bao bì Đại Thắng'] // prettier-ignore
const TT = ['Nháp', 'Chờ duyệt', 'Đã gửi NCC', 'Về một phần']
// Sinh cố định (không ngẫu nhiên) để trang dựng ra giống nhau mọi lần.
const DON: Don[] = Array.from({ length: 24 }, (_, i) => ({
  ma: `PO-2609-${String(i + 1).padStart(3, '0')}`,
  ncc: NCC[i % 5],
  dong: 2 + ((i * 7) % 11),
  gt: i % 6 === 4 ? null : 4_500_000 + ((i * 1_370_000) % 38_000_000),
  hen: `${String(3 + (i % 25)).padStart(2, '0')}/10/2026`,
  tt: TT[i % 4],
}))
const vnd = (n: number) => n.toLocaleString('vi-VN')

function DanhSachTrongKhung() {
  const coGia = DON.filter((d) => d.gt != null)
  const thieu = DON.length - coGia.length
  return (
    <div className="h-[360px] overflow-hidden border border-[var(--line)] [&>div]:h-full!">
      <ScreenFrame tableMin={720}>
        <ScreenHeader
          compact
          eyebrow="Mua hàng"
          title="Đơn mua"
          facts={[
            { label: 'Tổng', value: String(DON.length) },
            { label: 'Chưa có giá', value: String(thieu), tone: 'warn' },
          ]}
          actions={<Btn icon="excel">Xuất Excel</Btn>}
        />
        <Table>
          <THead pinFirst>
            <th>Mã đơn</th>
            <th>Nhà cung cấp</th>
            <th style={{ textAlign: 'right' }}>Số dòng</th>
            <th style={{ textAlign: 'right' }}>Giá trị (₫)</th>
            <th>Hạn giao</th>
            <th>Trạng thái</th>
          </THead>
          <tbody>
            {DON.map((d) => (
              <Row key={d.ma}>
                <Cell pin>
                  <Code as="a" href="#">
                    {d.ma}
                  </Code>
                </Cell>
                <Cell grow title={d.ncc}>
                  {d.ncc}
                </Cell>
                <Cell num>{d.dong}</Cell>
                <Cell num>{d.gt == null ? '' : vnd(d.gt)}</Cell>
                <Cell muted>{d.hen}</Cell>
                <Cell>
                  <Tag tone={d.tt === 'Chờ duyệt' ? 'warn' : 'neutral'}>{d.tt}</Tag>
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={2}>Cộng {DON.length} đơn</td>}
            cells={
              <>
                <td className="num">{DON.reduce((s, d) => s + d.dong, 0)}</td>
                <td className="num">{vnd(coGia.reduce((s, d) => s + (d.gt ?? 0), 0))}</td>
              </>
            }
            caveat={`Chưa gồm ${thieu} đơn chưa có giá — không dùng để duyệt chi.`}
          />
        </Table>
      </ScreenFrame>
    </div>
  )
}

function DuKienLoc() {
  const [loc, setLoc] = useState<'nhap' | 'tre' | null>(null)
  const bat = (k: 'nhap' | 'tre') => () => setLoc((c) => (c === k ? null : k))
  return (
    <div className="grid gap-2 border border-[var(--line)]">
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Đơn mua"
        facts={[
          { label: 'Tổng đơn', value: '68' },
          { label: 'Còn ở nháp', value: '65', tone: 'warn', onClick: bat('nhap'), on: loc === 'nhap' }, // prettier-ignore
          { label: 'Nằm im ≥ 5 ngày', value: '66', tone: 'stop', onClick: bat('tre'), on: loc === 'tre' }, // prettier-ignore
        ]}
        actions={
          <Btn primary icon="them">
            Đơn mới
          </Btn>
        }
      />
      <p className="text-k-sm px-3 pb-2 text-[var(--ink-2)]">
        Bộ lọc đang bật:{' '}
        <b>
          {loc === 'nhap' ? 'còn ở nháp' : loc === 'tre' ? 'nằm im ≥ 5 ngày' : 'không'}
        </b>
      </p>
    </div>
  )
}

export default function DocScreenFrame() {
  return (
    <CompDoc
      family="screen-frame"
      summary={
        <>
          <code>ScreenFrame</code> chốt chiều cao màn đúng bằng phần cửa sổ còn lại, để
          bảng dài cuộn <b>trong khung</b> — tiêu đề cột và chân tổng dính mới có tác
          dụng. <code>ScreenHeader</code> là đầu màn: danh tính, dữ kiện, và hành động ở
          góc phải.
        </>
      }
      useWhen="mọi màn có một bảng chính dài (danh sách khuôn C, hộp thư khuôn B, bảng nhập khuôn F): ScreenFrame bọc cả màn, ScreenHeader đứng đầu."
      avoidWhen={
        <>
          màn chứng từ khuôn D — dùng <code>DocScreen</code> + <code>DocHead</code>; hoặc
          một khối nhỏ trong trang (khung đo cả cửa sổ, đặt giữa trang là sai chiều cao).
        </>
      }
      variants={[
        {
          name: 'Danh sách dài trong khung',
          when: 'cuộn bảng: tiêu đề cột và chân tổng đứng yên, cột mã ghim trái. Ở ĐÂY khung bị ép cao 360px; trên màn thật nó tự đo cửa sổ.',
          demo: <DanhSachTrongKhung />,
        },
        {
          name: 'Đầu trang đầy đủ — ba tầng',
          when: 'nhãn, tiêu đề + trạng thái, chuỗi chứng từ, dữ kiện; hành động ở góc phải.',
          demo: (
            <div className="border border-[var(--line)]">
              <ScreenHeader
                eyebrow="Đơn mua"
                title="PO-2609-014"
                status={<Tag tone="warn">Chờ duyệt</Tag>}
                chain={
                  <DocChain
                    links={[
                      { label: 'Đơn khách', code: 'ĐH-2608-31', href: '#' },
                      { label: 'Lệnh SX', code: 'LSX 06/26-27', href: '#' },
                    ]}
                  />
                }
                facts={[
                  { label: 'Nhà cung cấp', value: 'Cơ khí Thành Đạt' },
                  { label: 'Giá trị', value: '131.400.000 ₫' },
                  { label: 'Nằm ở bước này', value: '5 ngày', tone: 'warn' },
                ]}
                actions={
                  <>
                    <Btn icon="in">In phiếu</Btn>
                    <Btn primary icon="duyet">
                      Phê duyệt
                    </Btn>
                  </>
                }
              />
            </div>
          ),
        },
        {
          name: 'Dữ kiện bấm được = bộ lọc',
          when: 'dữ kiện có onClick lọc danh sách xuống đúng chừng ấy dòng — bỏ được hàng chip lặp lại cùng con số.',
          demo: <DuKienLoc />,
        },
      ]}
      states={[
        {
          state: 'ScreenFrame — trước khi đo',
          looks: 'Cao calc(100dvh − 60px), chưa bù lề.',
          behaves: 'Chỉ trong lượt vẽ đầu (và khi dựng ở server).',
        },
        {
          state: 'ScreenFrame — đã đo',
          looks:
            'Cao đúng bằng cửa sổ trừ vị trí đỉnh khung; lề âm huỷ đúng padding của thẻ cha.',
          behaves:
            'Đo lúc gắn và mỗi khi cửa sổ đổi cỡ. KHÔNG đo lại khi thứ phía trên khung đổi cao sau đó.',
        },
        {
          state: 'ScreenFrame — dense',
          looks: 'Hàng bảng 25px, ô điều khiển 24px, đệm dọc ô 2px.',
          behaves: 'Gắn “kit kit-dense” lên chính khung — cả màn một mật độ.',
        },
        {
          state: 'ScreenHeader — đầy đủ',
          looks:
            'Ba tầng: nhãn in hoa, tiêu đề cỡ lớn + trạng thái, chuỗi, dữ kiện; hành động góc phải.',
          behaves:
            'children vẽ dưới cùng, vẫn trong <header>. Có đệm trên mà KHÔNG có đệm đáy (chừa chỗ cho hàng tab): không có children thì hàng dữ kiện nằm sát vạch đáy. Grep 24/09/2026: hầu hết màn thật dùng compact.',
        },
        {
          state: 'ScreenHeader — compact',
          looks:
            'Một hàng cao ~38px: nhãn, tiêu đề, chuỗi, dữ kiện chữ đơn cách, hành động dồn phải.',
          behaves: 'Hết chỗ thì xuống dòng; hành động không co lại.',
        },
        {
          state: 'Dữ kiện bấm được',
          looks:
            'Vẫn là chữ; rê chuột có nền nhạt; đang bật (on) thì nền nhạt màu hành động, chữ đậm.',
          behaves: 'Là <button> với aria-pressed = on.',
        },
      ]}
      a11y={{
        role: 'ScreenFrame: không có · ScreenHeader: <header> + heading cấp 1 · button + aria-pressed cho dữ kiện bấm được',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua link trong chuỗi, dữ kiện bấm được, rồi hành động.',
          },
          { key: 'Enter / Space', does: 'Bật/tắt dữ kiện lọc.' },
        ],
        reader: (
          <>
            Tiêu đề đọc liền với trạng thái (“PO-2609-014 Chờ duyệt”) vì cả hai nằm trong{' '}
            <code>&lt;h1&gt;</code>; nhãn nhỏ phía trên nằm NGOÀI tiêu đề.{' '}
            <b>Chỗ chưa tốt, ghi thật:</b> dữ kiện chỉ đọc là chữ trơn, không có cấu trúc
            nhãn–giá trị; màu <code>warn</code>/<code>stop</code> của dữ kiện không có lời
            đi kèm; và <code>&lt;header&gt;</code> đặt ngoài <code>&lt;main&gt;</code> /{' '}
            <code>&lt;section&gt;</code> thì bị hiểu là đầu trang của cả trang (banner) —
            trong <code>WorkspaceShell</code> màn nằm trong <code>&lt;main&gt;</code> nên
            không dính, màn đứng riêng thì dính.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Bọc màn bằng <code>ScreenFrame</code>, bảng chính là con trực tiếp.
            </>
          ),
          dont: (
            <>
              Đặt <code>min-h-screen</code> ở màn con — bảng giãn hết chiều dài (5.842px
              thay vì 1.000px), cuộn cả trang, tiêu đề cột và chân tổng dính đều vô hiệu.
            </>
          ),
          source:
            'CLAUDE.md — luật kiểm “bảng dài phải có tiêu đề cột dính và chân tổng dính”; kit/Shell.tsx BẪY 08/09/2026, màn NCC 164 dòng (commit de4cb46)',
        },
        {
          do: 'Để khung tự huỷ padding của thẻ cha.',
          dont: 'Cho màn con tự kéo lề âm nữa — hai bên cùng kéo thì khối tràn 24px, cột “Mã” chỉ còn đuôi.',
          source: 'kit/Shell.tsx — chú thích ScreenFrame, đo 08/09/2026',
        },
        {
          do: (
            <>
              Khai <code>tableMin</code> theo số cột của màn.
            </>
          ),
          dont: 'Bọc thêm thẻ quanh Table để đặt bề rộng — đứt chuỗi flex, bảng mất phần cao; hoặc để bảng 8 cột ở 680px mặc định bị bóp cụt chữ.',
          source: 'kit/Shell.tsx — JSDoc tableMin, 23/09/2026',
        },
        {
          do: (
            <>
              Trang danh sách và bàn làm việc dùng <code>compact</code>.
            </>
          ),
          dont: 'Đầu trang ba tầng + hai hàng lọc — bảng bị đẩy xuống 253px, một phần ba màn trước khi thấy dòng đầu.',
          source: 'kit/Shell.tsx — JSDoc compact, đo 10/09/2026 ở 1366×768',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng. Chỉ được dựng gián tiếp khi kit-docs.test.tsx chạy axe trên trang này — happy-dom không dựng bố cục, nên phép đo chiều cao và việc tiêu đề/chân dính không kiểm được ở đó; phải đo bằng trình duyệt thật.',
      }}
    />
  )
}
