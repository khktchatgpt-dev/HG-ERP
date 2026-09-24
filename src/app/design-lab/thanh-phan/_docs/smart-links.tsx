'use client'

import { useState } from 'react'
import { HolderBar, SmartLinks } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — dải nút thông minh (B7, 24/09/2026).
 *
 * Nhãn và số đếm chép dải thật của màn chứng từ đơn mua (`DonChungTuScreen`):
 * đợt giao, phiếu kho, lệnh SX đếm được; trao đổi, tài liệu là lối đi (null).
 *
 * B7 ghi nút khoá là `disabled` thật + `opacity`; B7½ (24/09/2026) đổi sang khoá
 * MỀM nền xám đặc — mục 4–5 tả hành vi sau khi sửa.
 */
function DemBam() {
  const [toi, setToi] = useState<string | null>(null)
  const go = (k: string) => () => setToi(k)
  return (
    <div>
      <SmartLinks
        items={[
          { label: 'đợt giao', count: 2, onClick: go('đợt giao'), title: 'Kế hoạch giao NCC hẹn' }, // prettier-ignore
          { label: 'phiếu kho', count: 1, onClick: go('phiếu kho'), title: 'Phiếu nhập / trả đã ghi vào đơn' }, // prettier-ignore
          { label: 'lệnh SX', count: 1, onClick: go('lệnh SX') },
          { label: 'trao đổi', count: null, onClick: go('trao đổi') },
          { label: 'tài liệu', count: null, onClick: go('tài liệu') },
        ]}
      />
      <p className="text-k-sm m-0 px-3 py-1.5 text-[var(--ink-3)]" aria-live="polite">
        {toi ? `Màn thật sẽ cuộn tới khối “${toi}”.` : 'Bấm một nút để thử.'}
      </p>
    </div>
  )
}

export default function DocSmartLinks() {
  return (
    <CompDoc
      family="smart-links"
      summary={
        <>
          Dải nút thông minh ngay dưới số hiệu chứng từ — chép Odoo: chứng từ liên quan
          hiện thành <b>số đếm bấm được</b>. Người duyệt nhìn &quot;0 phiếu kho&quot; là
          biết hàng chưa về mà không phải mở tab nào.
        </>
      }
      useWhen="chứng từ có chứng từ con/cháu (đợt giao, phiếu kho, lệnh SX) hoặc khối xa bên dưới (trao đổi, tài liệu) mà người dùng cần đếm hoặc nhảy tới."
      avoidWhen={
        <>
          chuỗi cha → con của chính chứng từ (dùng <code>DocChain</code>), hoặc hành động
          làm đổi dữ liệu (dùng <code>ActionPane</code>) — nút ở đây chỉ để đi xem.
        </>
      }
      variants={[
        {
          name: 'Số đếm và lối đi',
          when: 'count là số thì bấm ra đúng chừng ấy; count null khi chỉ là lối đi, không có gì để đếm.',
          demo: <DemBam />,
        },
        {
          name: 'Có nút khoá + người giữ ở đuôi hàng',
          when: 'đơn không gắn lệnh thì khoá nút "lệnh SX" — kèm title nói vì sao; dải "đang chờ ai" đặt ở trailing thay vì chiếm một hàng riêng. Tab tới nút khoá: nó vẫn nhận tiêu điểm, bấm không đi đâu.',
          demo: (
            <SmartLinks
              items={[
                { label: 'đợt giao', count: 0, onClick: () => {} },
                { label: 'phiếu kho', count: 0, onClick: () => {} },
                {
                  label: 'lệnh SX',
                  count: 0,
                  onClick: () => {},
                  disabled: true,
                  title: 'Đơn mua lẻ, không gắn lệnh sản xuất nào',
                },
              ]}
              trailing={
                <HolderBar
                  inline
                  who="Phan Thị Lệ Hằng"
                  what="duyệt đơn trước khi gửi NCC"
                  age="2 ngày"
                />
              }
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Nút cao 26px, viền mảnh; số đếm chữ mono đậm đứng trước nhãn.',
          behaves: 'Bấm gọi onClick của nút đó.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền và chữ đổi sang màu hành động (--act).',
          behaves: 'Chỉ khi nút không bị khoá.',
        },
        {
          state: 'Khoá (disabled) — khoá MỀM',
          looks:
            'Nền xám đặc, viền nhạt, chữ và số đếm --ink-3, con trỏ dấu hỏi — không làm mờ. Rê chuột không đổi sang màu hành động.',
          behaves:
            'aria-disabled, vẫn nhận Tab; bấm bị nuốt (onClick không chạy). Có title thì title thành mô tả qua aria-describedby. Sửa 24/09/2026 (B7½) — trước đó là disabled thật + opacity 0,55, rơi khỏi thứ tự Tab.',
        },
        {
          state: 'count = null',
          looks: 'Chỉ có nhãn, không có số.',
          behaves: 'Vẫn là nút bấm — một lối đi.',
        },
      ]}
      a11y={{
        role: 'button (mỗi nút) trong một div không vai trò',
        keys: [
          { key: 'Tab', does: 'Đi qua từng nút, kể cả nút bị khoá, theo thứ tự.' },
          {
            key: 'Enter / Space',
            does: 'Bấm nút; trên nút khoá thì không có gì xảy ra.',
          },
        ],
        reader: (
          <>
            Tên nút là số đếm cộng nhãn, ví dụ &quot;2 đợt giao, nút&quot;. Nút khoá đọc
            &quot;0 lệnh SX, nút, mờ&quot; nhờ <code>aria-disabled</code>, rồi đọc lý do
            (chữ của <code>title</code>) qua <code>aria-describedby</code> — sửa
            24/09/2026 (B7½), test ở <code>erp.a11y.test.tsx</code>.{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> dải không có vai trò nhóm hay nhãn chung,
            nên người nghe không biết đây là &quot;chứng từ liên quan&quot;; và với người
            NHÌN, lý do khoá vẫn chỉ hiện trong tooltip khi rê chuột — bấm nút khoá không
            bày lý do tại chỗ như <code>ActionPane</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Đếm bằng đúng hàm/tập mà khối đích dùng — bấm "2 đợt giao" ra đúng 2 đợt.',
          dont: 'Đếm một kiểu ở nút, lọc một kiểu ở khối đích.',
          source:
            'CLAUDE.md nguyên tắc 3 "Con số là một lời hứa"; DonChungTuScreen.tsx: "Số đếm là lời hứa: bấm ra đúng chừng ấy"',
        },
        {
          do: 'Đặt dải "ai đang giữ" gọn vào trailing, cùng hàng với nút.',
          dont: 'Để dải người giữ chiếm một hàng riêng chỉ chứa một câu.',
          source:
            'kit/erp.css, chú thích k-smart-trail — đo 10/09/2026: hàng riêng ăn 30px trên lưới dòng',
        },
        {
          do: (
            <>
              Khoá nút thì LUÔN truyền <code>title</code> nói lý do — kit đưa nó tới trình
              đọc qua <code>aria-describedby</code>; lý do quan trọng thì bày thêm bằng
              chữ nhìn thấy được ngay tại chỗ.
            </>
          ),
          dont: 'Khoá nút mà không có title — người dùng Tab tới một nút “mờ” không biết vì sao.',
          source:
            'CLAUDE.md luật kiểm — "Hành động bị chặn phải nói vướng gì và cách gỡ, ngay tại chỗ"; chú thích SmartLinks trong kit/Erp.tsx (khoá mềm, B7½)',
        },
        {
          do: 'Nút khoá tô NỀN xám đặc.',
          dont: 'Làm mờ bằng opacity — chữ trượt AA, nút gần như biến mất.',
          source:
            'CLAUDE.md nguyên tắc 5 (bỏ opacity, 16/09/2026); chú thích .k-smart-b trong erp.css — SmartLinks về cùng luật ở B7½',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
