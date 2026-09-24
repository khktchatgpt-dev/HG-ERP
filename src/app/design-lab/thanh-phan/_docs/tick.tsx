'use client'

import { useState } from 'react'
import { Code, Tick } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

const DON = [
  { ma: 'PO-2609-014', ncc: 'Công ty Sơn Tín Phát' },
  { ma: 'PO-2609-015', ncc: 'Cơ khí Thành Đạt' },
  { ma: 'PO-2609-016', ncc: 'Gỗ Minh Long' },
]

/** Dòng bấm được chứa ô tick — bấm ô KHÔNG mở dòng. */
function ChonDong() {
  const [chon, setChon] = useState<string[]>([])
  const [mo, setMo] = useState<string | null>(null)
  return (
    <div className="grid gap-1">
      {DON.map((d) => (
        <div
          key={d.ma}
          onClick={() => setMo(d.ma)}
          className="text-k-sm flex cursor-pointer items-center gap-3 border-b border-[var(--hair)] py-1 hover:bg-[var(--surface-raised)]"
        >
          <Tick
            label={`Chọn ${d.ma}`}
            checked={chon.includes(d.ma)}
            onChange={(on) =>
              setChon((c) => (on ? [...c, d.ma] : c.filter((x) => x !== d.ma)))
            }
          />
          <Code>{d.ma}</Code>
          <span className="text-[var(--ink)]">{d.ncc}</span>
        </div>
      ))}
      <span className="text-k-sm text-[var(--ink-2)]">
        Đã chọn <b className="num">{chon.length}</b> đơn · dòng vừa mở:{' '}
        <b>{mo ?? '(chưa)'}</b> — bấm ô tick không làm dòng mở.
      </span>
    </div>
  )
}

function DieuKien() {
  const [on, setOn] = useState(true)
  return (
    <div className="text-k-sm flex items-center gap-4">
      <span className="flex items-center gap-2">
        <Tick label="Chỉ hiện đơn quá hạn" checked={on} onChange={setOn} />
        <span aria-hidden className="text-[var(--ink)]">
          Chỉ hiện đơn quá hạn
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Tick label="Gồm đơn đã huỷ" checked={false} onChange={() => {}} disabled />
        <span aria-hidden className="text-[var(--ink-3)]">
          Gồm đơn đã huỷ (khoá)
        </span>
      </span>
    </div>
  )
}

export default function DocTick() {
  return (
    <CompDoc
      family="tick"
      summary={
        <>
          Ô tick — thẻ checkbox bản địa, tô màu hành động. Tên (<code>label</code>) BẮT
          BUỘC và phải nói chọn CÁI GÌ. Tự chặn nổi bọt cú bấm, vì ô tick gần như luôn nằm
          trong một dòng bấm được.
        </>
      }
      useWhen="chọn dòng trong danh sách để làm hàng loạt, hoặc bật/tắt một điều kiện trong form hay thanh lọc."
      avoidWhen={
        <>
          ô chọn dòng trong lưới chứng từ <code>Grid</code> (dùng <code>GridCheck</code>,
          đã là một ô bảng), hay chọn một trong vài lựa chọn loại trừ nhau (dùng{' '}
          <code>Pick</code> — kit chưa có RadioGroup).
        </>
      }
      variants={[
        {
          name: 'Chọn dòng trong danh sách',
          when: 'mỗi ô một tên riêng theo mã dòng. Bấm ô chỉ tick; bấm chỗ khác trên dòng mới mở dòng.',
          demo: <ChonDong />,
        },
        {
          name: 'Điều kiện trong thanh lọc — và khi bị khoá',
          when: 'chữ hiện cạnh ô chỉ để NHÌN (ẩn khỏi trình đọc, vì ô đã có tên). Bấm vào chữ KHÔNG tick — xem mục 5.',
          demo: <DieuKien />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Ô 13×13px do trình duyệt vẽ, dấu tick tô màu hành động. Quanh ô là lớp đệm vô hình: vùng bấm 25×25px, bố cục không đổi (lề âm trả lại đúng chỗ).',
          behaves:
            'Ô kiểm soát: chỉ đổi khi chỗ gọi đổi checked trong onChange. Bấm vào phần đệm quanh ô cũng lật ô, và cũng không nổi bọt lên dòng.',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động (khi đi bằng phím).',
          behaves: 'Space lật trạng thái.',
        },
        {
          state: 'Bị chặn',
          looks: 'Mờ 45%.',
          behaves:
            'disabled thật — rơi khỏi thứ tự Tab, không nói vì sao. Bấm vào phần đệm cũng không lật.',
        },
      ]}
      a11y={{
        role: 'checkbox',
        keys: [
          { key: 'Tab', does: 'Tới ô.' },
          { key: 'Space', does: 'Tick / bỏ tick. Cú bấm không nổi bọt lên dòng chứa ô.' },
        ],
        reader: (
          <>
            Đọc tên (<code>aria-label</code>) + “đã chọn / chưa chọn”. Ô vẽ 13px nhưng
            vùng bấm 25×25px — đạt cỡ đích bấm 24px của WCAG 2.5.8, dễ bấm hơn trên máy
            tính bảng ở xưởng (sửa 24/09/2026, B7½; trước đó vùng bấm chỉ bằng ô 13px).
            Phần đệm chỉ là vùng chuột — bàn phím vẫn đi vào chính ô.{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> (1) chưa có trạng thái “một phần” (
            <code>mixed</code>) cho ô chọn-tất-cả; (2) tên chỉ nằm ở{' '}
            <code>aria-label</code>, không có <code>&lt;label&gt;</code> hiện ra — chữ đặt
            cạnh ô không nối với ô, bấm vào chữ không tick.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>label=&#123;`Chọn $&#123;ma&#125;`&#125;</code> — mỗi ô một tên theo
              dòng.
            </>
          ),
          dont: 'label="Chọn" cho cả cột — trình đọc nghe một cột toàn "Chọn, hộp kiểm".',
          source: 'JSDoc của Tick (kit/Primitives.tsx)',
        },
        {
          do: 'Tick trong dòng bấm được — ô tự chặn nổi bọt.',
          dont: 'Checkbox thô trong dòng: bấm ô tick là dòng mở theo.',
          source: 'JSDoc của Tick; luật lint hg/no-raw-control',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
