'use client'

import { useState } from 'react'
import { DocMenu, DocMenuPanel, Empty } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `DocMenu` — menu ngang của chứng từ (27/09/2026).
 *
 * Màn chi tiết đơn mua bày mọi thứ cùng lúc (khối gập + cột phải) — chủ dự án
 * chê "rối" và chốt menu NGANG: bấm mục nào, thân trang chỉ hiện mục đó.
 */
function Demo({ start = 'tong' }: { start?: string }) {
  const [muc, setMuc] = useState(start)
  return (
    <DocMenu
      label="Nội dung đơn"
      value={muc}
      onValueChange={setMuc}
      items={[
        { id: 'tong', label: 'Tổng quan' },
        { id: 'dong', label: 'Dòng hàng', signal: { text: '3' } },
        { id: 'giao', label: 'Giao & nhận', signal: { text: 'đủ', tone: 'done' } },
        { id: 'tien', label: 'Tài chính', signal: { text: 'chờ HĐ', tone: 'warn' } },
        { id: 'trao', label: 'Trao đổi' },
      ]}
    >
      <DocMenuPanel value="tong">
        <p className="text-k-body p-4">Vướng gì · đầu đơn · nhà cung cấp.</p>
      </DocMenuPanel>
      <DocMenuPanel value="dong">
        <p className="text-k-body p-4">Lưới 3 dòng hàng.</p>
      </DocMenuPanel>
      <DocMenuPanel value="giao">
        <p className="text-k-body p-4">Đặt / đã về / còn lại theo dòng.</p>
      </DocMenuPanel>
      <DocMenuPanel value="tien">
        <p className="text-k-body p-4">Đặt · nhận · hoá đơn · đã trả — chỉ tiền.</p>
      </DocMenuPanel>
      <DocMenuPanel value="trao">
        <div className="p-4">
          <Empty
            headline="Chưa ai ghi gì về đơn này"
            reason="Chưa có trao đổi nào trên đơn."
            next="Ghi lại chuyện xảy ra ngoài hệ thống (NCC hẹn gì, ai gọi ai)."
          />
        </div>
      </DocMenuPanel>
    </DocMenu>
  )
}

export default function DocDocMenu() {
  return (
    <CompDoc
      family="doc-menu"
      summary={
        <>
          Menu ngang dưới đầu chứng từ. <b>Bấm mục nào, thân trang chỉ hiện mục đó</b> —
          dòng hàng, giao nhận, tài chính, trao đổi không bày chung một lúc. Nhãn nhỏ cạnh
          tên mục báo có chuyện mà không phải mở.
        </>
      }
      useWhen="màn chi tiết phục vụ nhiều vai (Cung ứng, Kho, Kế toán…) mà mỗi vai hỏi một câu khác nhau — mỗi câu một mục."
      avoidWhen={
        <>
          màn chỉ có một câu hỏi (danh sách, hộp thư) — đừng chia cho có; và màn SOẠN
          nhiều dòng — lưới là nhân vật chính, chia mục thì người soạn phải nhảy qua lại.
          Nút hành động cũng KHÔNG chia vào mục: nút vẫn ở thanh trên (bản chia cả nút vào
          tab bị bỏ 26/09/2026).
        </>
      }
      variants={[
        {
          name: 'Mở sẵn Tổng quan',
          when: 'mặc định khi vào chứng từ (chủ dự án chốt 27/09/2026).',
          demo: <Demo />,
        },
        {
          name: 'Mở thẳng một mục từ đường dẫn',
          when: 'link từ màn Kế toán (…?muc=tai-chinh) — màn đọc tham số rồi truyền value.',
          demo: <Demo start="tien" />,
        },
      ]}
      states={[
        {
          state: 'Mục đang mở',
          looks: 'Chữ đậm màu hành động, gạch chân 2px màu hành động.',
          behaves: 'aria-selected="true"; chỉ panel của mục này được dựng.',
        },
        {
          state: 'Có tín hiệu',
          looks:
            'Tag nhỏ sau tên mục, màu theo vòng đời (warn chờ, done đủ, neutral đếm).',
          behaves: 'Là một phần TÊN tab — trình đọc nghe “Tài chính chờ HĐ”.',
        },
        {
          state: 'Tiêu điểm bàn phím',
          looks: 'Viền trong 2px màu hành động.',
          behaves:
            'Mũi tên chỉ di tiêu điểm; Enter/Space mới mở mục (activationMode manual — mở mục có thể phải tải dữ liệu).',
        },
        {
          state: 'Nhiều mục, màn hẹp',
          looks: 'Hàng mục cuộn ngang, không xuống dòng.',
          behaves: 'overflow-x-auto trên tablist.',
        },
      ]}
      a11y={{
        role: 'tablist có tên (label) / tab / tabpanel — Radix Tabs',
        keys: [
          { key: '← →', does: 'Đi giữa các mục.' },
          { key: 'Home / End', does: 'Về mục đầu / cuối.' },
          { key: 'Enter / Space', does: 'Mở mục đang trỏ.' },
          { key: 'Tab', does: 'Từ mục đang mở xuống thân của nó.' },
        ],
        reader: (
          <>
            Đọc “Nội dung đơn, danh sách tab — Tài chính chờ HĐ, tab, 4 trên 5”. Thân mục
            là <code>tabpanel</code> gắn với tab qua <code>aria-controls</code> do Radix
            lo.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Mỗi mục trả lời MỘT câu hỏi và chỉ chứa thông tin của câu đó.',
          dont: 'Lặp lại tiền ở Tổng quan, ở cột phải và ở mục Tài chính.',
          source:
            'chủ dự án 27/09/2026 — "tách ra như menu… chỉ hiện thị thông tin về tài chính ngay chính trang"',
        },
        {
          do: 'Ghi mục đang mở vào đường dẫn (?muc=…).',
          dont: 'Giữ trong state — gửi link cho Kế toán là họ rơi về Tổng quan.',
          source: 'canvas "Đơn mua", ghi chú Cách hoạt động (27/09/2026)',
        },
        {
          do: 'Tín hiệu đếm bằng đúng hàm mà mục đó dùng.',
          dont: 'In "0" ở mọi mục cho đủ bộ, hoặc đếm bằng một nguồn riêng.',
          source: 'CLAUDE.md nguyên tắc 3 — con số là một lời hứa',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
