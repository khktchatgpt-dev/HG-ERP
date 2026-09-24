'use client'

import { useState } from 'react'
import { Code, Combobox } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/*
  Bảng thuộc tính (mục 3) chỉ bày phần CHUNG của hai kiểu gọi — trình trích API
  gộp kiểu hợp (union) về phần giao. Prop riêng của từng kiểu ghi ở mục 2, và
  JSDoc đầy đủ nằm ở ComboChonProps / ComboTraProps trong kit/Combobox.tsx.
*/

const NCC = [
  { value: 'n1', label: 'CÔNG TY TNHH SX TM MINH ĐẠT', hint: 'NCC-0012' },
  { value: 'n2', label: 'CÔNG TY NHỰA SƠN TÍN PHÁT', hint: 'NCC-0043' },
  { value: 'n3', label: 'CƠ KHÍ THÀNH ĐẠT', hint: 'NCC-0101' },
  { value: 'n4', label: 'GỖ MINH LONG', hint: 'NCC-0117' },
]

type Vt = { ma: string; ten: string; qc: string; dvt: string }
const VT: Vt[] = [
  { ma: 'VT-00123', ten: 'Thép hộp mạ kẽm', qc: '20x40x1.2', dvt: 'cây' },
  { ma: 'VT-00124', ten: 'Thép hộp mạ kẽm', qc: '20x40x1.4', dvt: 'cây' },
  { ma: 'VT-00481', ten: 'Sơn tĩnh điện đen mờ', qc: 'thùng 20kg', dvt: 'kg' },
  { ma: 'VT-00902', ten: 'Ốc lục giác', qc: 'M6x20', dvt: 'con' },
]

function KieuChon() {
  const [v, setV] = useState('n1')
  return (
    <div className="grid gap-1">
      <Combobox
        label="Nhà cung cấp"
        width={300}
        options={NCC}
        value={v}
        onChange={setV}
      />
      <span className="text-k-sm text-[var(--ink-2)]">
        value = <code>{v || "''"}</code> — thử gõ “son tin” rồi Enter.
      </span>
    </div>
  )
}

function KieuTra() {
  const [dong, setDong] = useState<Vt[]>([])
  return (
    <div className="grid gap-2">
      <Combobox<Vt>
        label="Thêm vật tư vào đơn"
        width={300}
        // Ví dụ lọc tại chỗ cho khỏi gọi mạng; màn thật gọi api() ở đây.
        search={async (q) => {
          const t = q.toLowerCase()
          return VT.filter((x) => `${x.ma} ${x.ten} ${x.qc}`.toLowerCase().includes(t))
        }}
        keyOf={(x) => x.ma}
        render={(x) => (
          <>
            <b className="num">{x.ma}</b> · {x.ten} · <span className="num">{x.qc}</span>{' '}
            · {x.dvt}
          </>
        )}
        onPick={(x) => setDong((d) => [...d, x])}
      />
      <div className="text-k-sm grid gap-0.5">
        {dong.length === 0 ? (
          <span className="text-[var(--ink-3)]">
            Chưa lấy dòng nào — gõ “thép” rồi ↓ Enter.
          </span>
        ) : (
          dong.map((x, i) => (
            <span key={i} className="flex gap-2">
              <Code>{x.ma}</Code> {x.ten} {x.qc}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export default function DocCombobox() {
  return (
    <CompDoc
      family="combobox"
      summary={
        <>
          Ô tìm-rồi-chọn. MỘT vỏ (cmdk lo bàn phím + listbox, Radix Popover lo portal) và{' '}
          <b>hai nguồn</b>: kiểu CHỌN lọc tại chỗ và giữ giá trị; kiểu TRA hỏi server rồi
          lấy một dòng. Lọc tại chỗ bỏ dấu và AND từng từ: gõ “son tin” ra “SƠN TÍN PHÁT”.
          Bảng thuộc tính ở mục 3 chỉ bày phần chung — prop riêng của từng kiểu ghi ở mục
          2.
        </>
      }
      useWhen="chọn trong danh sách dài (168 NCC đã nằm sẵn trong trang) hoặc tra trong danh mục lớn ở server (13k vật tư) để thêm dòng."
      avoidWhen={
        <>
          danh sách ngắn, cố định (dùng <code>Pick</code>), ô tìm lọc bảng trên thanh lọc
          (dùng <code>SearchInput</code>), hay chọn nhiều giá trị cùng lúc (chưa hỗ trợ).
        </>
      }
      variants={[
        {
          name: 'Kiểu CHỌN — options + value + onChange (+ emptyLabel)',
          when: 'mọi lựa chọn đã có trong trang. Ô hiện tên đang chọn; dòng đầu danh sách là dòng BỎ chọn (onChange nhận "").',
          demo: <KieuChon />,
        },
        {
          name: 'Kiểu TRA — search + onPick + render + keyOf',
          when: 'danh mục lớn ở server. Hỏi sau 180ms ngừng gõ; lấy xong ô trống lại, con trỏ ở lại để lấy dòng tiếp mà không chạm chuột.',
          demo: <KieuTra />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Ô chữ viền mảnh; kiểu CHỌN có mũi tên ▾ ở mép phải.',
          behaves: 'Kiểu CHỌN hiện tên đang chọn; kiểu TRA trống.',
        },
        {
          state: 'Rê chuột',
          looks:
            'Viền ô đậm lên; dòng trong danh sách sáng nền màu hành động nhạt khi là dòng đang sáng.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Viền màu hành động + vòng 2px.',
          behaves:
            'Kiểu CHỌN: bôi đen chữ và MỞ danh sách ngay, dòng đang chọn sáng sẵn. Kiểu TRA: không mở gì; ↓ mở lại danh sách nếu còn kết quả cũ.',
        },
        {
          state: 'Đang chạy',
          looks: 'Kiểu TRA: dấu “…” thay chỗ mũi tên trong lúc chờ server.',
          behaves: 'Kết quả về muộn của từ khoá cũ bị bỏ, danh sách không nhảy ngược.',
        },
        {
          state: 'Rỗng',
          looks:
            'Dòng chữ nhạt: “Không có dòng nào khớp “…”.” (CHỌN) / “Không thấy mã nào khớp.” (TRA).',
          behaves:
            'Kiểu CHỌN vẫn còn dòng bỏ chọn ở đầu. Kiểu TRA: vùng thông báo đọc “Không thấy mã nào khớp.”',
        },
        {
          state: 'Lỗi',
          looks:
            'Kiểu TRA: danh sách mở ra với một dòng chữ nhạt “Không tra được: …” (lời nhắn của lỗi) — ngay chỗ mắt đang nhìn.',
          behaves:
            'search bị từ chối thì ô tự bắt, dấu chờ tắt; gõ tiếp là tra lại, có kết quả thì dòng lỗi biến mất. (Sửa 24/09/2026, B7½ — trước đó không báo gì, lỗi rơi thành unhandled rejection.) Kiểu CHỌN lọc tại chỗ nên không có nhánh lỗi.',
        },
        {
          state: 'Bị chặn',
          looks: 'Mờ 45%.',
          behaves: 'disabled thật — rơi khỏi thứ tự Tab, không mở danh sách.',
        },
      ]}
      a11y={{
        role: 'combobox + listbox / option (mẫu combobox WAI-ARIA)',
        keys: [
          {
            key: '↓',
            does: 'Danh sách đóng: mở. Đang mở: xuống dòng (vòng từ cuối về đầu).',
          },
          { key: '↑', does: 'Lên dòng.' },
          { key: 'Home / End', does: 'Về dòng đầu / cuối (cmdk).' },
          {
            key: 'Enter',
            does: 'Chọn dòng đang sáng. Đang gõ thì dòng sáng là dòng KHỚP đầu tiên, không phải dòng bỏ chọn.',
          },
          { key: 'Esc', does: 'Đóng, GIỮ lựa chọn cũ.' },
          { key: 'Tab', does: 'Rời ô = bỏ dở: kiểu CHỌN trả về tên đang giữ.' },
        ],
        reader: (
          <>
            Ô là <code>role=&quot;combobox&quot;</code> có tên (<code>label</code> bắt
            buộc), <code>aria-expanded</code> nói thật đóng/mở, <code>aria-controls</code>{' '}
            trỏ đúng listbox, <code>aria-activedescendant</code> theo dòng sáng — tiêu
            điểm ở lại ô. Có test canh cả bốn. Kiểu TRA có ĐÚNG MỘT vùng{' '}
            <code>role=&quot;status&quot;</code> lịch sự (
            <code>aria-live=&quot;polite&quot;</code>
            ), đặt sẵn ngoài lớp nổi, chỉ đổi câu SAU khi kết quả về — không đổi mỗi phím:
            “N kết quả”, “Không thấy mã nào khớp.”, hoặc “Lỗi tra cứu — …” khi search bị
            từ chối (câu ngắn khác chữ dòng lỗi, để khỏi nghe hai lần). Sửa 24/09/2026,
            B7½; trước đó người nghe chỉ biết có kết quả khi tự bấm ↓.{' '}
            <b>Chỗ chưa tốt, ghi thật:</b> trạng thái “đang tìm” không được thông báo (dấu
            “…” bị ẩn khỏi trình đọc); kiểu CHỌN không có vùng thông báo — danh sách hiện
            ngay dưới tay nên số dòng khớp không được đọc.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Danh sách ra portal — đặt trong bảng cuộn hay hộp thoại vẫn không bị cắt.',
          dont: 'Danh sách absolute trong DOM nơi gọi — đúng lỗi của cả PickFind lẫn Lookup cũ.',
          source: 'JSDoc của Combobox (B4, 24/09/2026); test “danh sách ra PORTAL”',
        },
        {
          do: 'Đang gõ thì sáng dòng KHỚP đầu tiên.',
          dont: 'Để cmdk tự đặt dòng sáng về đầu — gõ “son tin” rồi Enter là XOÁ lựa chọn thay vì chọn Sơn Tín Phát.',
          source: 'chú thích “Vì sao không dùng Command.Input” (kit/Combobox.tsx)',
        },
        {
          do: 'Danh mục 13k vật tư dùng kiểu TRA; 168 NCC có sẵn trong trang dùng kiểu CHỌN.',
          dont: 'Tải cả danh mục vật tư về trình duyệt, hay mở API cho một danh sách đã nằm trong trang.',
          source: 'JSDoc của Combobox — “nguồn dữ liệu thì KHÔNG gộp”',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
