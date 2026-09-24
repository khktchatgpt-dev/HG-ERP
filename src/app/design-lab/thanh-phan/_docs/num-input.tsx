'use client'

import { useState } from 'react'
import { NumInput } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/*
  Ghi chú: blurb của họ này trong kit-families.ts nói ô "hiểu 1.390 kiểu Việt" —
  mã KHÔNG làm vậy: onCommit nhận chuỗi thô, chỗ gọi tự hiểu. Trang này ghi đúng
  theo mã.
*/

function TrongLuoi() {
  const [sl, setSl] = useState('1200')
  const [gia, setGia] = useState('18500.5')
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <div className="w-[110px]">
          <NumInput value={sl} onCommit={setSl} aria-label="Số lượng đặt — VT-00123" />
        </div>
        <div className="w-[130px]">
          <NumInput value={gia} onCommit={setGia} aria-label="Đơn giá — VT-00123" />
        </div>
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        Đã chốt: SL <b className="num">{sl}</b> · đơn giá <b className="num">{gia}</b> —
        chỉ đổi khi rời ô, không đổi mỗi phím.
      </span>
    </div>
  )
}

function CanTrai() {
  const [v, setV] = useState('')
  return (
    <div className="flex items-center gap-3">
      <div className="w-[160px]">
        <NumInput
          value={v}
          onCommit={setV}
          align="left"
          placeholder="VD: 0.035"
          aria-label="Khối gỗ mỗi sản phẩm (m³)"
        />
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        m³/SP — đã chốt: <b className="num">{v || '(trống)'}</b>
      </span>
    </div>
  )
}

export default function DocNumInput() {
  return (
    <CompDoc
      family="num-input"
      summary={
        <>
          Ô gõ số. Giữ <b>chuỗi</b> trong lúc gõ và chỉ chốt khi rời ô — nên gõ “1.” rồi
          “5” vẫn ra 1.5. Bật bàn phím số trên máy tính bảng. Ô <b>không</b> tự hiểu
          “1.390” kiểu Việt: <code>onCommit</code> nhận chuỗi thô, chỗ gọi tự đổi và kiểm.
        </>
      }
      useWhen="ô số lượng, đơn giá, khối lượng — trong lưới hay form — nơi người dùng cần gõ số thập phân."
      avoidWhen={
        <>
          ô ngày (dùng <code>DateInput</code>), ô mã / quy cách như “20x40x1.2” (dùng{' '}
          <code>TextInput mono</code>), hoặc chỉ HIỂN THỊ số (dùng <code>Num</code>).
        </>
      }
      variants={[
        {
          name: 'Trong lưới — căn phải',
          when: 'mặc định. Số căn phải cho thẳng hàng đơn vị với cột Num bên dưới.',
          demo: <TrongLuoi />,
        },
        {
          name: 'Trong form — align="left"',
          when: 'ô số đứng riêng cạnh nhãn thì căn trái. Căn bằng style inline — luật .kit .num (ngoài layer) thắng mọi lớp text-left, nên trước 24/09/2026 (B7½) ô này vẫn căn phải.',
          demo: <CanTrai />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Viền mảnh, chữ mono thẳng cột, cao bằng các điều khiển khác.',
          behaves: 'Hiện value đã chốt.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền đậm lên.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Viền màu hành động + vòng 2px (khi đi bằng phím).',
          behaves:
            'Gõ là sửa bản NHÁP; onCommit chưa được gọi. Lăn chuột trên ô thì ô nhả focus (và chốt nháp) để trang cuộn — không đổi số.',
        },
        {
          state: 'Bị chặn',
          looks:
            'Không có kiểu riêng — disabled truyền thẳng xuống thẻ input nên chỉ trình duyệt vẽ.',
          behaves: 'Không gõ được, rơi khỏi thứ tự Tab.',
        },
      ]}
      a11y={{
        role: 'textbox (input thường, inputMode="decimal")',
        keys: [
          {
            key: 'Tab / bấm ra ngoài',
            does: 'Rời ô = chốt: gọi onCommit với chuỗi đang gõ.',
          },
          { key: 'Enter', does: 'KHÔNG chốt — ô không bắt Enter (khác TextInput).' },
          { key: 'Esc', does: 'KHÔNG bỏ nháp — ô không bắt Esc.' },
        ],
        reader: (
          <>
            Đọc tên ô rồi giá trị. <b>Ghi thật:</b> ô <b>không có prop tên</b> — phải
            truyền <code>aria-label</code> (hoặc bọc trong <code>&lt;label&gt;</code>),
            không thì ô câm. Không có trạng thái lỗi hay gợi ý nối bằng{' '}
            <code>aria-describedby</code>. Prop của chỗ gọi được GHÉP, không ĐÈ (sửa
            24/09/2026, B7½ — trước đó truyền <code>onBlur</code> là mất việc chốt,{' '}
            <code>onCommit</code> không bao giờ được gọi): <code>onBlur</code> và{' '}
            <code>onWheel</code> chạy SAU việc chốt / nhả focus; <code>onKeyDown</code> đi
            thẳng xuống ô vì ô không tự bắt phím nào; <code>className</code> cộng vào kiểu
            của ô.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Giữ chuỗi trong lúc gõ, chỉ ép kiểu khi rời ô.',
          dont: 'type="number" + ép về Number mỗi phím — gõ "1." là mất dấu chấm, không nhập nổi 1.5.',
          source: 'commit f6545e9 và 2c7e4e8 (03/09/2026) — lỗi dính hai lần ở v3',
        },
        {
          do: 'Lăn chuột: nhả focus, để trang cuộn như thường.',
          dont: 'Để lăn chuột đổi số trong ô đang focus — hoặc chặn luôn cuộn trang, người dùng tưởng trang treo.',
          source: 'chú thích onWheel trong NumInput (kit/Primitives.tsx)',
        },
        {
          do: (
            <>
              Truyền <code>aria-label</code> nói ô của dòng nào: “Số lượng đặt —
              VT-00123”.
            </>
          ),
          dont: 'Trông chờ ô tự có tên — kit chưa có prop nhãn/lỗi/gợi ý cho ô này.',
          source:
            'docs/he-thiet-ke-erp-ke-hoach.md §5.2 — “chuẩn hoá nhãn, lỗi, gợi ý” còn treo',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
