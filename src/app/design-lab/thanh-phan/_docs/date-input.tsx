'use client'

import { useState } from 'react'
import { DateInput } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

function NgayChungTu() {
  const [v, setV] = useState('2026-09-10')
  return (
    <div className="grid gap-1">
      <div className="w-[150px]">
        <DateInput label="Ngày chứng từ" value={v} onChange={setV} />
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        Giá trị lưu: <code>{v || "''"}</code> — gõ “03082026” ra 03/08/2026 = 3 tháng 8.
      </span>
    </div>
  )
}

function CoMax() {
  const [v, setV] = useState('2026-09-22')
  return (
    <div className="grid gap-1">
      <div className="w-[150px]">
        <DateInput label="Ngày nhận hàng" value={v} max="2026-09-24" onChange={setV} />
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        max = 24/09/2026: trên lịch các ngày sau đó bị khoá. Ô chữ vẫn gõ được 30/09 —
        phải tự kiểm.
      </span>
    </div>
  )
}

function Trong() {
  const [v, setV] = useState('')
  return (
    <div className="grid gap-1">
      <div className="w-[150px]">
        <DateInput label="Hạn giao khách" value={v} onChange={setV} />
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        Chưa hẹn: value = <code>{v || "''"}</code>. Lịch mở ở tháng hiện tại.
      </span>
    </div>
  )
}

export default function DocDateInput() {
  return (
    <CompDoc
      family="date-input"
      summary={
        <>
          Ô ngày <b>luôn</b> <code>dd/mm/yyyy</code>, bất kể ngôn ngữ trình duyệt. Gõ số
          liền tự chèn gạch; lịch thả là <code>react-day-picker</code> tiếng Việt, tuần
          bắt đầu Thứ Hai. Giá trị vào/ra là ISO <code>yyyy-mm-dd</code>. Ô chữ là đường
          chính — lịch để tra “thứ Sáu tuần sau là ngày mấy”.
        </>
      }
      useWhen="mọi ô ngày ở màn kit: ngày chứng từ, hạn giao, ngày nhận hàng, ngày ghi sổ."
      avoidWhen={
        <>
          thẻ <code>&lt;input type=&quot;date&quot;&gt;</code> (vẽ theo ngôn ngữ trình
          duyệt, ra mm/dd/yyyy), và màn theme v3 cũ (dùng <code>erp/DateField</code> —
          cùng cách hiểu ngày, khác vỏ).
        </>
      }
      variants={[
        {
          name: 'Ngày chứng từ',
          when: 'mặc định. Gõ thẳng, hoặc Alt+↓ / bấm icon lịch để chọn.',
          demo: <NgayChungTu />,
        },
        {
          name: 'Có max — chặn ngày tương lai trên lịch',
          when: 'ngày không được quá hôm nay (ngày nhận hàng). max CHỈ chặn đường bấm lịch.',
          demo: <CoMax />,
        },
        {
          name: 'Để trống',
          when: 'ngày chưa có (chưa hẹn giao). Xoá trắng ô thì onChange nhận "".',
          demo: <Trong />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Ô chữ mono, placeholder “dd/mm/yyyy”, icon lịch ở mép phải.',
          behaves: 'Hiện value đổi sang dd/mm/yyyy.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền ô đậm lên; icon lịch đậm lên khi rê trúng.',
          behaves: 'Bấm icon mở lịch.',
        },
        {
          state: 'Focus',
          looks: 'Viền màu hành động + vòng 2px.',
          behaves:
            'Gõ số tự chèn gạch; onChange CHỈ gọi khi đủ một ngày có thật (bắt 31/02, 31/04), hoặc khi ô trống.',
        },
        {
          state: 'Lỗi',
          looks: 'KHÔNG có trạng thái lỗi hiện ra.',
          behaves:
            'Gõ dở hoặc ngày không có thật rồi rời ô → ô lặng lẽ trả về giá trị đang giữ. Không có câu nào nói vừa gõ sai.',
        },
        {
          state: 'Rỗng',
          looks: 'Chỉ còn placeholder.',
          behaves: 'value "". Lịch mở ở tháng hiện tại (hoặc tháng của max).',
        },
        {
          state: 'Bị chặn',
          looks: 'Ô chữ và icon lịch mờ 45%.',
          behaves: 'disabled thật — rơi khỏi thứ tự Tab, lịch không mở.',
        },
      ]}
      a11y={{
        role: 'textbox + dialog (khung lịch) chứa lưới ngày',
        keys: [
          {
            key: 'Alt + ↓',
            does: 'Mở lịch từ ô chữ (khai bằng aria-keyshortcuts). Tiêu điểm vào ngày đang chọn.',
          },
          { key: '← → ↑ ↓', does: 'Trong lịch: đi ngày / tuần.' },
          { key: 'PageUp / PageDown', does: 'Tháng trước / sau; kèm Shift là năm.' },
          { key: 'Home / End', does: 'Đầu / cuối tuần (Thứ Hai / Chủ nhật).' },
          { key: 'Enter / Space', does: 'Chọn ngày — lịch đóng, con trỏ về ô chữ.' },
          { key: 'Esc', does: 'Đóng lịch, con trỏ về ô chữ.' },
        ],
        reader: (
          <>
            Ô chữ đọc theo <code>label</code>; khung lịch là dialog tên “Lịch — …”; mỗi ô
            ngày đọc đúng dạng ô chữ đang hiện: “Thứ 6, 25/09/2026, hôm nay, đang chọn” —
            người nghe khớp với thứ họ vừa gõ. Có test canh.{' '}
            <b>Ba chỗ chưa tốt, ghi thật:</b> (1) <code>label</code> không bắt buộc ở tầng
            kiểu — thiếu thì ô chữ không có tên; (2) nút lịch cố ý nằm ngoài thứ tự Tab,
            nên người đi bằng bàn phím phải biết Alt+↓ (chỉ trình đọc nào đọc{' '}
            <code>aria-keyshortcuts</code> mới báo); (3) ngày gõ sai bị trả về im lặng,
            không có thông báo lỗi.
          </>
        ),
      }}
      doDont={[
        {
          do: 'DateInput cho mọi ô ngày ở màn kit.',
          dont: (
            <>
              <code>&lt;input type=&quot;date&quot;&gt;</code> — Chrome tiếng Anh ở xưởng
              hiện mm/dd/yyyy; 03/08 và 08/03 là hai ngày khác nhau mà không nhìn ra ô
              đang nói kiểu nào.
            </>
          ),
          source:
            'JSDoc của DateInput (kit/DateInput.tsx); commit d547eff “ô ngày dd/mm/yyyy — DateField thay input type=date”',
        },
        {
          do: 'Đổi ISO ↔ Date theo giờ địa phương (tách năm/tháng/ngày).',
          dont: (
            <>
              <code>new Date(&apos;2026-09-24&apos;)</code> — chuỗi chỉ có ngày bị hiểu là
              nửa đêm UTC, lệch một ngày ở múi giờ âm.
            </>
          ),
          source: 'chú thích isoToDate / dateToIso (kit/DateInput.tsx)',
        },
        {
          do: 'Có luật về ngày thì kiểm ở chỗ gọi và ở server, kể cả khi đã đặt max.',
          dont: 'Tin max chặn luôn ô chữ — nó chỉ chặn đường bấm lịch.',
          source: 'JSDoc của prop max (kit/DateInput.tsx)',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
