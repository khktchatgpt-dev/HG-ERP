'use client'

import { Btn, Ico, Tip } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Tip` (B7, 24/09/2026).
 *
 * Mọi ví dụ ĐÓNG lúc dựng trang: tooltip chỉ vào DOM khi rê chuột / Tab tới,
 * nên axe của trang chỉ thấy các nút kích hoạt.
 */
export default function DocTip() {
  return (
    <CompDoc
      family="tip"
      summary={
        <>
          Chú giải một dòng hiện khi rê chuột hoặc Tab tới một nút, sau 120ms. Đứng trên
          Radix Tooltip: nút kích hoạt TRỎ tới nó bằng <code>aria-describedby</code>, Esc
          tắt được, và khung ra portal nên không bị bảng cuộn hay hộp thoại cắt.
        </>
      }
      useWhen={
        <>
          nói TÊN của một thứ chỉ có icon (nút ‹ ›, rail thu gọn), hoặc thêm một chi tiết
          phụ mà thiếu nó vẫn làm được việc.
        </>
      }
      avoidWhen={
        <>
          nội dung có nút bấm, ô nhập hay dài hơn một dòng — dùng <code>Popover</code>;
          câu phải trả lời xong mới đi tiếp — dùng <code>Sheet</code>; lý do một nút bị
          khoá — dùng <code>blockedBy</code> của <code>Btn</code> (hiện tại chỗ, không
          giấu sau cú rê chuột).
        </>
      }
      variants={[
        {
          name: 'Tên cho nút chỉ có icon',
          when: 'nút đã có aria-label; Tip nhắc lại cho người nhìn. Rê chuột hoặc Tab vào nút.',
          demo: (
            <div className="flex items-center gap-1">
              <Tip label="Phiếu trước — PBS-0041" side="top">
                <Btn aria-label="Phiếu trước">
                  <Ico name="truoc" />
                </Btn>
              </Tip>
              <span className="num text-k-sm px-1.5 text-[var(--ink-2)]">3 / 12</span>
              <Tip label="Phiếu sau — PBS-0043" side="top">
                <Btn aria-label="Phiếu sau">
                  <Ico name="sau" />
                </Btn>
              </Tip>
            </div>
          ),
        },
        {
          name: 'Chi tiết phụ cho một nút có chữ',
          when: 'nút đã tự nói đủ; tooltip chỉ thêm một dữ kiện người dùng có thể cần.',
          demo: (
            <Tip label="Lần xuất trước: 22/09/2026 · 214 dòng" side="bottom">
              <Btn icon="excel">Xuất Excel</Btn>
            </Tip>
          ),
        },
      ]}
      states={[
        {
          state: 'Đóng',
          looks: 'Không có gì trong DOM ngoài phần tử con.',
          behaves: 'Phần tử con không mang aria-describedby.',
        },
        {
          state: 'Mở (rê chuột / Tab tới)',
          looks:
            'Khung mực đậm chữ trắng, một dòng, bóng nổi; nằm ở side, tự lật khi chạm mép.',
          behaves:
            'Hiện sau 120ms; rê sang tooltip kế bên trong vòng 300ms thì hiện ngay. Phần tử con được gắn aria-describedby trỏ tới chữ chú giải.',
        },
        {
          state: 'Tắt bằng Esc',
          looks: 'Khung biến mất, tiêu điểm vẫn ở nút.',
          behaves: 'aria-describedby được gỡ khỏi nút (WCAG 1.4.13).',
        },
      ]}
      a11y={{
        role: 'tooltip',
        keys: [
          { key: 'Tab', does: 'Tới phần tử con thì tooltip mở; rời đi thì đóng.' },
          { key: 'Esc', does: 'Tắt tooltip mà không phải dời tiêu điểm hay chuột.' },
        ],
        reader: (
          <>
            Đọc tên phần tử con, rồi chữ chú giải như phần MÔ TẢ. Tooltip không bao giờ là
            tên — nút chỉ có icon vẫn phải có <code>aria-label</code> riêng.{' '}
            <b>Chỗ yếu, ghi thật:</b> phần tử con không nhận tiêu điểm (chữ trần, ô tròn
            đại diện của <code>UserCard</code> thu gọn) thì kit bọc một{' '}
            <code>&lt;span&gt;</code> — bàn phím không tới được, tooltip chỉ còn cho
            chuột. Trên màn cảm ứng Radix không mở tooltip khi chạm.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Dùng <code>Tip</code> cho tên của nút chỉ có icon.
            </>
          ),
          dont: (
            <>
              Dùng <code>title=&quot;&quot;</code> của trình duyệt — trễ 1–2 giây, không
              định dạng được, và trên rail thu gọn đó là thứ DUY NHẤT nói icon nghĩa gì.
            </>
          ),
          source: 'đo vỏ v3 ngày 08/09/2026 — chú thích đầu kit/Nav.tsx',
        },
        {
          do: 'Gắn thẳng vào phần tử nhận tiêu điểm (Btn, link), để aria-describedby nằm trên chính nó.',
          dont: (
            <>
              Bọc phần tử trong một <code>&lt;span&gt;</code> rồi gắn tooltip vào span —
              trình đọc màn hình chỉ đọc thuộc tính của phần tử đang focus, nên tooltip
              câm.
            </>
          ),
          source: 'bản Tip tự viết trước B1 — docs/he-thiet-ke-erp-ke-hoach.md §9.2',
        },
        {
          do: 'Để tooltip ra portal, tự lật khi chạm mép.',
          dont: (
            <>
              Dựng tooltip <code>absolute</code> trong DOM nơi gọi — bị mọi vùng{' '}
              <code>overflow</code> (rail cuộn, bảng, hộp thoại) cắt mất.
            </>
          ),
          source: 'bản Tip tự viết trước B1 — chú thích kit/Nav.tsx',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
