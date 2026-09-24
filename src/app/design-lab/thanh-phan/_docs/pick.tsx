'use client'

import { useState } from 'react'
import { Pick } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

function ThanhLoc() {
  const [ro, setRo] = useState('all')
  const [gom, setGom] = useState('ncc')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pick
        label="Rổ trạng thái"
        value={ro}
        onChange={setRo}
        options={[
          { value: 'all', label: 'Mọi trạng thái (68)' },
          { value: 'nhap', label: 'Nháp (12)' },
          { value: 'cho', label: 'Chờ duyệt (5)' },
          { value: 'dat', label: 'Đã đặt (41)' },
          { value: 'xong', label: 'Đã nhận đủ (10)' },
        ]}
      />
      <Pick
        label="Gom theo"
        value={gom}
        onChange={setGom}
        options={[
          { value: 'ncc', label: 'Gom: Nhà cung cấp' },
          { value: 'lsx', label: 'Gom: Lệnh sản xuất' },
          { value: 'none', label: 'Gom: Không gom' },
        ]}
      />
    </div>
  )
}

function MauDon() {
  const [v, setV] = useState('thep')
  return (
    <Pick
      label="Mẫu đơn"
      width={220}
      value={v}
      onChange={setV}
      options={[
        { value: 'thep', label: 'Thép — tính theo kg/m' },
        { value: 'go', label: 'Gỗ — tính theo m³' },
        { value: 'son', label: 'Sơn — lít / thùng' },
        { value: 'kinh', label: 'Kính (chưa cấu hình)', disabled: true },
      ]}
    />
  )
}

export default function DocPick() {
  return (
    <CompDoc
      family="pick"
      summary={
        <>
          Ô chọn là thẻ <code>&lt;select&gt;</code> <b>bản địa</b>: không portal, đi bằng
          bàn phím, không tốn một dòng JS. Cái giá là không tự vẽ được menu — chấp nhận,
          vì đây là ô lọc chứ không phải ô tìm.
        </>
      }
      useWhen="chọn một trong một danh sách NGẮN, cố định: rổ trạng thái, gom theo, mẫu đơn, loại đơn."
      avoidWhen={
        <>
          danh sách dài hoặc phải gõ để tìm (dùng <code>Combobox</code>), hay vài lựa chọn
          lọc cần thấy cùng lúc kèm số đếm (dùng <code>Chip</code> trong{' '}
          <code>FilterBar</code>).
        </>
      }
      variants={[
        {
          name: 'Trên thanh lọc',
          when: 'bốn năm ô chọn nằm cạnh nhau; số đếm ghi thẳng trong nhãn lựa chọn.',
          demo: <ThanhLoc />,
        },
        {
          name: 'Bề ngang cố định + dòng bị khoá',
          when: 'ô trong lưới nhãn–giá trị cần thẳng mép; lựa chọn chưa dùng được vẫn hiện để người dùng biết nó có.',
          demo: <MauDon />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Viền mảnh, nền thẻ, mũi tên do trình duyệt vẽ; rộng theo lựa chọn dài nhất nếu không đặt width.',
          behaves:
            'Menu thả do trình duyệt / hệ điều hành vẽ — không theo token của kit.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền đậm lên.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Viền màu hành động + vòng 2px (khi đi bằng phím).',
          behaves: 'Xem bảng phím ở mục 5.',
        },
        {
          state: 'Bị chặn',
          looks: 'Mờ 45%.',
          behaves: 'disabled thật — rơi khỏi thứ tự Tab, không nói vì sao.',
        },
      ]}
      a11y={{
        role: 'combobox (select bản địa, một lựa chọn) + option',
        keys: [
          { key: 'Tab', does: 'Tới ô.' },
          {
            key: '↑ / ↓',
            does: 'Đổi lựa chọn. Trên Chrome/Windows ô ĐÓNG cũng đổi ngay — mỗi phím là một lần onChange.',
          },
          { key: 'Alt + ↓ / Space', does: 'Mở danh sách (tuỳ trình duyệt).' },
          { key: 'Gõ chữ cái', does: 'Nhảy tới lựa chọn bắt đầu bằng chữ đó.' },
        ],
        reader: (
          <>
            Đọc tên ô (<code>label</code> → <code>aria-label</code>) rồi lựa chọn đang
            chọn; dòng <code>disabled</code> được đọc là không dùng được. Vì mọi ↑ ↓ trên
            ô đóng đều gọi <code>onChange</code>, ô lọc nào mà mỗi lần đổi lại tải dữ liệu
            thì người đi bằng bàn phím sẽ kích hoạt nhiều lượt tải liên tiếp.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>label</code> nói tên ô: “Rổ trạng thái”, “Gom theo”.
            </>
          ),
          dont: 'Ô chọn không nhãn — nhìn bằng mắt đoán được, đi bằng bàn phím thì không.',
          source: 'JSDoc của Pick (kit/Primitives.tsx)',
        },
        {
          do: 'select bản địa cho ô lọc ngắn.',
          dont: 'Tự vẽ menu portal cho một ô lọc năm lựa chọn.',
          source:
            'JSDoc của Pick; docs/he-thiet-ke-erp-ke-hoach.md §5.2 — “giữ, quyết định đúng”',
        },
        {
          do: 'Dùng Pick của kit.',
          dont: 'Thẻ select thô.',
          source: 'luật lint hg/no-raw-control (eslint-rules/hg-ui.mjs)',
        },
      ]}
      tested={{
        missing:
          'chỉ có axe trên ví dụ của trang này (kit-docs.test.tsx); hành vi phím là của trình duyệt, chưa test.',
      }}
    />
  )
}
