'use client'

import { useState } from 'react'
import { HeadChip, HeadChips, HeadField, NumInput, TextInput } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — đầu đơn co thành dải chip (B7, 24/09/2026).
 *
 * Ví dụ một chép dải của màn mẫu soạn đơn (Khuôn F); ví dụ hai chép dải của màn
 * nhập hoá đơn NCC (`NhapHoaDonScreen`) — nơi `HeadField` ra đời vì nhét ô nhập
 * vào `HeadChip` là nút lồng nút.
 *
 * B7½ (24/09/2026) sửa hai lỗi trang này từng ghi: chip không `onClick` nay là
 * phần tử tĩnh chứ không phải nút câm, và `need` của `HeadField` tới được trình
 * đọc bằng chữ ẩn "(bắt buộc)" trong nhãn.
 */
function SoanDon() {
  const [ncc, setNcc] = useState<string | null>(null)
  return (
    <HeadChips>
      <HeadChip label="Mẫu" value="Ngũ kim theo kg" />
      <HeadChip label="LSX" value="06/26-27 · MERXX" />
      <HeadChip
        id="vd-chip-ncc"
        label="NCC"
        value={ncc}
        need
        onClick={() => setNcc((v) => (v ? null : 'Cơ khí Thành Đạt'))}
      />
      <HeadChip label="Hẹn giao" value="18/09/2026" />
      <HeadChip label="Tiền tệ" value="VND" muted />
      <HeadChip label="Theo HĐ số" value={null} />
    </HeadChips>
  )
}

function NhapHoaDon() {
  const [so, setSo] = useState('')
  const [vat, setVat] = useState('8')
  return (
    <HeadChips>
      <HeadChip label="Nhà cung cấp" value="Cơ khí Thành Đạt" />
      <HeadChip label="Đơn mua" value="PO-2609-014" />
      <HeadField label="Số hoá đơn" need empty={!so.trim()} width={150}>
        <TextInput
          value={so}
          onCommit={setSo}
          mono
          label="Số hoá đơn NCC"
          placeholder="số trên tờ giấy"
        />
      </HeadField>
      <HeadField label="VAT %" width={58}>
        <NumInput value={vat} onCommit={setVat} align="left" aria-label="Thuế suất VAT" />
      </HeadField>
    </HeadChips>
  )
}

export default function DocHeadChips() {
  return (
    <CompDoc
      family="head-chips"
      summary={
        <>
          Đầu đơn của màn nhập liệu co lại thành một dải chip: vẫn thấy giá trị, bấm mới
          mở ra sửa. <code>HeadChip</code> là nút BÀY một giá trị; <code>HeadField</code>{' '}
          cùng hình dạng nhưng chứa ô nhập thật để gõ tại chỗ.
        </>
      }
      useWhen={
        <>
          Khuôn F — người dùng GÕ nhiều dòng, và mỗi hàng đầu trang là một hàng lưới bị
          lấy mất: soạn đơn mua, nhập hoá đơn NCC, phiếu kho.
        </>
      }
      avoidWhen={
        <>
          màn ĐỌC một tờ (Khuôn D) — đầu chứng từ được phép là lưới nhãn–giá trị đầy đủ,
          dùng <code>FieldGrid</code>.
        </>
      }
      variants={[
        {
          name: 'HeadChip — giá trị có sẵn, ô bắt buộc báo ngay',
          when: 'chip NCC bắt buộc và còn trống thì đỏ ngay lúc này. Bấm chip NCC để khai/bỏ khai. Chỉ chip NCC có onClick nên chỉ nó là nút; các chip còn lại chỉ bày giá trị, Tab đi thẳng qua.',
          demo: <SoanDon />,
        },
        {
          name: 'HeadField — gõ thẳng trên dải',
          when: 'giá trị kế thừa từ chứng từ cha là HeadChip; thứ gõ tại chỗ (số hoá đơn, thuế suất) là HeadField.',
          demo: <NhapHoaDon />,
        },
      ]}
      states={[
        {
          state: 'Có giá trị',
          looks:
            'Chip viền mảnh cao một ô điều khiển; nhãn hoa nhỏ chữ phụ, giá trị đậm.',
          behaves:
            'HeadChip có onClick là nút, bấm gọi onClick; HeadField bấm vào nhãn thì con trỏ nhảy vào ô.',
        },
        {
          state: 'HeadChip không có onClick',
          looks: 'Y như chip có onClick.',
          behaves:
            'Là <span> tĩnh: không nhận Tab, không phải nút — chỉ bày giá trị. Sửa 24/09/2026 (B7½); trước đó vẫn là nút nhận Tab mà bấm không làm gì.',
        },
        {
          state: 'Trống, không bắt buộc',
          looks: 'HeadChip hiện "—".',
          behaves: 'Như thường.',
        },
        {
          state: 'Trống + need',
          looks:
            'Viền đỏ (--stop), nền đỏ nhạt; HeadChip hiện "chưa chọn" chữ đỏ đậm và có title "Chưa khai … — bắt buộc".',
          behaves:
            'Báo NGAY, không đợi bấm Lưu. Với HeadField, "trống" do người gọi tính qua empty.',
        },
        {
          state: 'muted',
          looks: 'Giá trị chữ phụ, nét thường.',
          behaves: 'Chỉ khi đã có giá trị; chip trống thì muted bị bỏ qua.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền đậm lên (--ink-3).',
          behaves:
            'HeadChip có onClick và HeadField (cùng lớp k-headchip) đậm viền khi rê. Chip TĨNH (k-headchip-ro, không onClick) KHÔNG đổi viền — đổi viền là hứa bấm được (sửa 24/09/2026, B7½).',
        },
      ]}
      a11y={{
        role: 'button (HeadChip có onClick) · span tĩnh (HeadChip không onClick) · label bọc ô nhập (HeadField) · dải là div',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua chip có onClick và từng ô nhập, theo thứ tự trên dải; chip tĩnh bị bỏ qua.',
          },
          { key: 'Enter / Space', does: 'Bấm HeadChip có onClick.' },
        ],
        reader: (
          <>
            HeadChip có onClick đọc &quot;NCC chưa chọn, nút&quot; — chữ &quot;chưa
            chọn&quot; nhìn thấy và nghe thấy được, không chỉ dựa vào viền đỏ; chip tĩnh
            đọc như chữ thường khi đọc tuần tự. HeadField có <code>need</code> thì nhãn
            mang thêm chữ ẩn &quot;(bắt buộc)&quot; (sửa 24/09/2026, B7½; test ở{' '}
            <code>erp.a11y.test.tsx</code>) — không dùng <code>aria-required</code> vì vỏ
            là <code>&lt;label&gt;</code>, còn ô bên trong do người gọi truyền vào.{' '}
            <b>Ba chỗ chưa tốt, ghi thật:</b> ô có tên riêng (<code>label</code>/
            <code>aria-label</code> của ô, như ô Số hoá đơn ở ví dụ hai) thì tên đó THẮNG
            nhãn bọc ngoài, nên &quot;(bắt buộc)&quot; chỉ nghe được khi đọc tuần tự,
            không nghe khi Tab vào ô; ô vẫn không mang <code>aria-invalid</code> khi còn
            trống; và chip trống không bắt buộc đọc ra &quot;—&quot;.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Gõ tại chỗ thì dùng HeadField.',
          dont: 'Nhét ô nhập (DateInput có nút mở lịch) vào trong HeadChip — nút lồng nút, HTML sai và hỏng hydration.',
          source:
            'Erp.tsx, docstring HeadField — vấp thật 11/09/2026 khi dựng màn nhập hoá đơn NCC, cả trang đổ',
        },
        {
          do: (
            <>
              Đánh <code>need</code> cho ô bắt buộc — nó đỏ ngay khi còn trống.
            </>
          ),
          dont: 'Cho gõ xong 40 dòng rồi bấm Lưu mới báo thiếu nhà cung cấp.',
          source: 'Erp.tsx, docstring HeadChip — "cho làm rồi mới kiểm"',
        },
        {
          do: (
            <>
              Chip chỉ để bày (kế thừa từ chứng từ cha, không có chỗ sửa) thì bỏ trống{' '}
              <code>onClick</code> — nó tự thành chữ tĩnh.
            </>
          ),
          dont: 'Truyền onClick rỗng cho có — thành điểm dừng Tab câm đứng trước ô người ta phải gõ.',
          source:
            'Erp.tsx, chú thích HeadChip (B7½, 24/09/2026) — màn nhập hoá đơn NCC có ba chip kế thừa như vậy',
        },
        {
          do: 'Co đầu đơn thành dải chip trên màn nhập liệu.',
          dont: 'Dựng đầu đơn thành lưới nhãn–giá trị trên màn gõ 40 dòng — mỗi hàng đầu trang là một hàng lưới mất đi.',
          source:
            'CLAUDE.md, khuôn F; Erp.tsx chú thích mục 14 (đo trên /planning/pos/new)',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
