'use client'

import { useState } from 'react'
import { Btn, Popover, TextInput, Tick } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Popover` (B7, 24/09/2026).
 *
 * Khung ĐÓNG lúc dựng trang. Ví dụ điều khiển từ ngoài giữ `open` trong state
 * để đóng khung sau khi áp bộ lọc — đúng cách màn thật cần.
 */
function LocNangCao() {
  const [open, setOpen] = useState(false)
  const [ma, setMa] = useState('')
  const [treHan, setTreHan] = useState(true)
  return (
    <Popover
      label="Lọc nâng cao"
      open={open}
      onOpenChange={setOpen}
      trigger={<Btn>Lọc nâng cao</Btn>}
    >
      <div className="grid gap-3">
        <TextInput label="Mã lệnh chứa" value={ma} onCommit={setMa} />
        <Tick label="Chỉ đơn trễ hẹn giao" checked={treHan} onChange={setTreHan} />
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setOpen(false)}>Thôi</Btn>
          <Btn primary onClick={() => setOpen(false)}>
            Áp bộ lọc
          </Btn>
        </div>
      </div>
    </Popover>
  )
}

const COT = ['Nhà cung cấp', 'Hẹn giao', 'Người phụ trách', 'Giá trị đơn']

function ChonCot() {
  const [hien, setHien] = useState<string[]>(COT.slice(0, 2))
  return (
    <div className="flex justify-end">
      <Popover
        label="Chọn cột hiện"
        align="end"
        width={320}
        trigger={<Btn icon="cot">Cột · {hien.length}</Btn>}
      >
        <div className="grid gap-2">
          {COT.map((c) => (
            <Tick
              key={c}
              label={c}
              checked={hien.includes(c)}
              onChange={(on) =>
                setHien((xs) => (on ? [...xs, c] : xs.filter((x) => x !== c)))
              }
            />
          ))}
        </div>
      </Popover>
    </div>
  )
}

export default function DocPopover() {
  return (
    <CompDoc
      family="popover"
      summary={
        <>
          Khung nổi gắn vào một nút — lọc nâng cao, chọn cột, xem nhanh một chứng từ.
          KHÔNG modal: trang phía sau vẫn dùng được, bấm ra ngoài là đóng. Đứng trên Radix
          Popover, ra portal nên không bị bảng cuộn hay hộp thoại cắt.
        </>
      }
      useWhen={
        <>
          bày thêm lựa chọn hay dữ kiện cho MỘT nút, có ô nhập hoặc nút bấm bên trong, và
          người dùng bỏ ngang cũng không mất gì.
        </>
      }
      avoidWhen={
        <>
          câu hỏi phải trả lời xong mới đi tiếp (xác nhận, khai lý do) — dùng{' '}
          <code>Sheet</code>; chỉ một dòng chữ khi rê chuột — dùng <code>Tip</code>; chọn
          một giá trị trong danh sách dài — dùng <code>Combobox</code> (đã đứng sẵn trên
          Popover của Radix).
        </>
      }
      variants={[
        {
          name: 'Tự quản đóng/mở',
          when: 'mặc định — bỏ trống open, khung tự đóng khi Esc hay bấm ra ngoài.',
          demo: (
            <Popover
              label="Xem nhanh PO-2608-097"
              trigger={<Btn icon="don">PO-2608-097</Btn>}
            >
              <div className="text-k-sm grid gap-1">
                <div className="font-semibold">CÔNG TY NHỰA SƠN TÍN PHÁT</div>
                <div className="text-[var(--ink-2)]">
                  12 dòng · <span className="num">112.400.000 ₫</span>
                </div>
                <div className="text-[var(--ink-2)]">Hẹn giao 30/09/2026</div>
              </div>
            </Popover>
          ),
        },
        {
          name: 'Điều khiển từ ngoài',
          when: 'có nút “Áp bộ lọc” bên trong — cần open + onOpenChange để đóng khung sau khi áp.',
          demo: <LocNangCao />,
        },
        {
          name: 'Canh mép cuối, rộng hơn',
          when: 'nút đứng ở góc phải thanh công cụ — align="end" để khung không tràn ra ngoài.',
          demo: <ChonCot />,
        },
      ]}
      states={[
        {
          state: 'Đóng',
          looks: 'Chỉ có nút kích hoạt.',
          behaves: 'Nút mang aria-expanded="false" và aria-haspopup="dialog".',
        },
        {
          state: 'Mở',
          looks:
            'Khung nền thẻ, viền mảnh, bóng đổ, cách nút 4px; nổi trên cả hộp thoại (z-pop).',
          behaves:
            'Tiêu điểm vào ô bấm/gõ được đầu tiên trong khung. Trang phía sau KHÔNG bị khoá.',
        },
        {
          state: 'Đóng lại',
          looks: 'Khung biến mất.',
          behaves:
            'Esc, bấm lại nút, bấm ra ngoài, hoặc Tab ra khỏi khung. Esc / bấm nút thì tiêu điểm về nút.',
        },
      ]}
      a11y={{
        role: 'dialog (không modal, có aria-label)',
        keys: [
          { key: 'Enter / Space', does: 'Trên nút: mở / đóng khung.' },
          {
            key: 'Tab',
            does: 'Đi trong khung; Tab qua phần tử cuối là RA khỏi khung và khung đóng.',
          },
          { key: 'Esc', does: 'Đóng, tiêu điểm về nút.' },
        ],
        reader: (
          <>
            Đọc “{'<label>'}, hộp thoại” rồi phần tử đầu tiên trong khung.{' '}
            <code>label</code> bắt buộc ở tầng kiểu — thiếu nó thì chỉ nghe “hộp thoại”.
            Không có <code>aria-modal</code>: đúng, vì trang phía sau vẫn thao tác được.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Dùng <code>Popover</code> (portal) cho mọi khung nổi mới.
            </>
          ),
          dont: (
            <>
              Tự dựng khung <code>absolute</code> trong DOM nơi gọi — bị CẮT khi đặt trong
              bảng cuộn hay hộp thoại.
            </>
          ),
          source: 'PickFind, Lookup, DateInput trước B1 — chú thích đầu kit/Popover.tsx',
        },
        {
          do: 'Đặt label nói khung là gì: “Lọc nâng cao”, “Chọn cột hiện”.',
          dont: 'Để khung vai dialog không tên — trình đọc chỉ nói “hộp thoại”.',
          source: 'JSDoc prop label, kit/Popover.tsx',
        },
        {
          do: (
            <>
              Hỏi câu phải trả lời xong mới đi tiếp thì dùng <code>Sheet</code>.
            </>
          ),
          dont: (
            <>
              Dùng Popover cho xác nhận huỷ đơn — bấm trượt ra ngoài là khung đóng, câu
              hỏi mất mà không ai trả lời.
            </>
          ),
          source: 'mục “Khác Sheet ở chỗ nào”, chú thích đầu kit/Popover.tsx',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
