'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  DocChain,
  InspectPanel,
  InspectSection,
  NextAction,
  Row,
  THead,
  Table,
  WhyBox,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — InspectPanel / InspectSection (B7, 24/09/2026).
 *
 * Khay dùng lớp `hidden xl:flex`: cửa sổ hẹp hơn 1280px thì ví dụ dưới đây
 * cũng mất khay — đó là hành vi thật, không phải lỗi của trang tài liệu.
 *
 * Bản B7 phải giữ đúng MỘT ví dụ vì `<aside>` không tên (axe kêu mốc trùng), và
 * phải tự đặt một `h3` cho danh sách để khỏi đỏ `heading-order` (h2 của mục →
 * h4 cố định của khối), đo 24/09/2026. B7½ vá cả hai ở kit: `<aside>` mang tên
 * "mã — việc", `InspectSection` nhận `level`. Ví dụ dưới truyền `level={3}` vì
 * nằm dưới h2 của mục Biến thể.
 */
type Viec = {
  id: string
  ma: string
  ncc: string
  lsx: string
  viec: string
  hen: string
  tre: number
  giu: string
  ngay: number
}

const VIEC: Viec[] = [
  { id: 'a', ma: 'PO-2608-088', ncc: 'Vải Phú Hưng', lsx: 'LSX 06/26-27', viec: 'Gọi NCC — quá hẹn giao, chưa phản hồi', hen: '02/09/2026', tre: 8, giu: 'Nguyễn Văn A', ngay: 15 }, // prettier-ignore
  { id: 'b', ma: 'PO-2608-097', ncc: 'Gỗ Trường Thịnh', lsx: 'LSX 07/26-14', viec: 'Chốt lại hạn giao với NCC', hen: '05/09/2026', tre: 5, giu: 'Nguyễn Văn A', ngay: 12 }, // prettier-ignore
  { id: 'c', ma: 'PO-2609-003', ncc: 'Cơ khí Thành Đạt', lsx: 'LSX 06/26-27', viec: 'Hỏi NCC ngày giao đợt 2', hen: '08/09/2026', tre: 2, giu: 'Trần Thị C', ngay: 4 }, // prettier-ignore
]

function HopThuCoKhay() {
  const [chon, setChon] = useState('a')
  const v = VIEC.find((x) => x.id === chon) ?? VIEC[0]
  return (
    <div className="flex h-[440px] border border-[var(--line)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-k-sm px-3 py-2 font-semibold">Làn Trễ — 3 đơn</h3>
        <Table inline>
          <THead>
            <th>Mã đơn</th>
            <th>Việc cần làm</th>
            <th>Soi</th>
          </THead>
          <tbody>
            {VIEC.map((x) => (
              <Row key={x.id} selected={x.id === chon} onClick={() => setChon(x.id)}>
                <Cell>
                  <Code>{x.ma}</Code>
                </Cell>
                <Cell grow title={x.viec}>
                  {x.viec}
                </Cell>
                <Cell>
                  <Btn
                    aria-label={`Soi ${x.ma} ở khay bên`}
                    onClick={() => setChon(x.id)}
                  >
                    Soi
                  </Btn>
                </Cell>
              </Row>
            ))}
          </tbody>
        </Table>
      </div>
      <InspectPanel
        code={v.ma}
        title={v.viec}
        subtitle={`${v.ncc} · ${v.lsx}`}
        actions={
          <>
            <Btn primary icon="ghiChu">
              Ghi kết quả cuộc gọi
            </Btn>
            <Btn icon="don">Mở đơn đầy đủ</Btn>
          </>
        }
      >
        <InspectSection title="Đến lượt ai" level={3}>
          <NextAction
            mine={v.giu === 'Nguyễn Văn A'}
            holder={v.giu}
            what={v.viec}
            days={v.ngay}
          />
        </InspectSection>
        <InspectSection title="Vì sao đơn này ở đây" level={3}>
          <WhyBox
            lines={[`hẹn giao ${v.hen}`, 'hôm nay 10/09/2026', 'trạng thái: đã gửi NCC']}
            result={`quá hẹn ${v.tre} ngày`}
          />
        </InspectSection>
        <InspectSection title="Chuỗi chứng từ" level={3}>
          <DocChain
            links={[
              { label: 'Lệnh SX', code: v.lsx, href: '#' },
              { label: 'Đơn mua', code: v.ma, muted: true },
            ]}
          />
        </InspectSection>
      </InspectPanel>
    </div>
  )
}

export default function DocInspectPanel() {
  return (
    <CompDoc
      family="inspect-panel"
      summary={
        <>
          Khay soi bên phải một danh sách, rộng cố định 316px. Bấm một dòng thì khay hiện
          chứng từ đó <b>tại chỗ</b> — danh sách không chạy đi đâu, người đang rà 16 mã
          không mất chỗ đứng.
        </>
      }
      useWhen="việc là “rà qua một danh sách” (hộp thư, danh sách chờ xử lý): cần xem nhanh ai giữ, vì sao, rồi quyết định ngay, không mở trang chi tiết."
      avoidWhen={
        <>
          cần sửa chứng từ hay xem đủ dòng hàng — mở màn chứng từ (khuôn D); hoặc cần hỏi
          một câu có hậu quả trước khi làm — dùng <code>Sheet</code>.
        </>
      }
      variants={[
        {
          name: 'Khay trong hộp thư',
          when: 'bấm dòng hoặc nút Soi: khay đổi theo, dòng đang soi được đánh dấu. Ba khối: ai giữ, vì sao, chuỗi chứng từ; nút ở đáy. Các khối truyền level={3} để khớp dàn tiêu đề của trang này (dưới một h2).',
          demo: <HopThuCoKhay />,
        },
      ]}
      states={[
        {
          state: 'Mặc định (cửa sổ ≥ 1280px)',
          looks:
            'Cột 316px viền trái, nền thẻ. Đầu khay nền trang: mã đơn cách màu hành động, tiêu đề đậm, dòng phụ đơn cách. Khối ngăn nhau bằng vạch tóc.',
          behaves:
            'Bề rộng BẤT BIẾN (khoá cả w, min-w, max-w) — bảng bên cạnh tự cuộn ngang, khay không bị bóp.',
        },
        {
          state: 'Cửa sổ < 1280px',
          looks: 'Khay biến mất (display: none).',
          behaves:
            'Nội dung khay không tới được bằng bất kỳ cách nào — màn phải có lối khác (mở trang chứng từ).',
        },
        {
          state: 'Thân dài',
          looks: 'Khay tự cuộn dọc trong khung.',
          behaves:
            'Nút actions nằm cuối thân, đi theo khi cuộn — không dính đáy khi thân dài hơn khay.',
        },
      ]}
      a11y={{
        role: 'complementary (thẻ <aside>, tên “mã — việc”) · heading cấp level (mặc định 4) cho mỗi khối',
        keys: [
          { key: 'Tab', does: 'Đi qua link và nút trong khay, rồi các nút actions.' },
        ],
        reader: (
          <>
            Mốc khay đọc “bổ trợ, PO-2608-088 — Gọi NCC…”: tên ghép từ <code>code</code>{' '}
            và <code>title</code>, nên hai khay (hay khay cạnh một mốc bổ sung khác) phân
            biệt được. Các khối đọc được bằng phím nhảy tiêu đề; cấp tiêu đề theo{' '}
            <code>level</code> — màn chỉ có <code>h1</code> thì truyền 2 để không nhảy cóc
            xuống h4. (Hai điểm này vá 24/09/2026, B7½.){' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> mã và tiêu đề khay là{' '}
            <code>&lt;div&gt;</code>, không phải tiêu đề; và bấm dòng đổi nội dung khay mà
            KHÔNG báo gì, không dời tiêu điểm — người nghe không biết khay vừa đổi (chỉ
            tên mốc đổi theo, nghe được khi nhảy tới mốc).
          </>
        ),
      }}
      doDont={[
        {
          do: 'Soi tại chỗ khi việc là rà qua một danh sách.',
          dont: 'Bấm dòng là bị đẩy sang trang khác — quay lại phải cuộn tìm đúng dòng vừa xem.',
          source:
            'kit/Shell.tsx — chú thích InspectPanel; design-lab/mau-hop-thu/page.tsx điều 4',
        },
        {
          do: 'Để khay giữ bề rộng cố định của nó; bảng bên cạnh tự cuộn ngang.',
          dont: 'Bọc khay hay đè bề rộng — bảng 8 cột đẩy ngang, khay co lại, chữ cắt còn “5 đơ…”, “Bao l…”.',
          source: 'kit/Shell.tsx — BẪY 08/09/2026 trong InspectPanel',
        },
        {
          do: 'Khối đầu tiên trả lời “ai đang giữ, bao lâu” (NextAction).',
          dont: 'Khay chỉ chép lại các cột của dòng đang chọn — người đọc đã thấy chúng ở bảng.',
          source:
            'docs/tieu-chi-workflow-erp.md §2.3 — trả lời trong 2 giây ai giữ, giữ bao lâu',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
