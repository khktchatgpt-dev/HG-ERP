'use client'

import { useState } from 'react'
import { Code } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/** Mã mở khay tại chỗ — `as="button"`, bấm là hiện dòng quy cách. */
function MoKhay() {
  const [mo, setMo] = useState(false)
  return (
    <div className="text-k-sm grid gap-1">
      <div className="flex items-center gap-3">
        <Code as="button" aria-expanded={mo} onClick={() => setMo((x) => !x)}>
          VT-00123
        </Code>
        <span className="text-[var(--ink)]">Thép hộp mạ kẽm</span>
      </div>
      {mo && (
        <div className="text-[var(--ink-2)]">
          Quy cách 20x40x1.2 · cây 6 m · ĐVT cây · nhóm Thép hộp
        </div>
      )}
    </div>
  )
}

export default function DocCode() {
  return (
    <CompDoc
      family="code"
      summary={
        <>
          Mã chứng từ / mã vật tư: chữ đơn cách, đậm, <b>màu hành động</b> — vì trên màn
          danh sách mã gần như luôn là đường vào chứng từ. Không khung viền: chữ mono +
          màu đã đủ nói “đây là mã”.
        </>
      }
      useWhen="in mã PO, LSX, VT, NCC trong bảng, đầu khối, câu thông báo — nhất là khi bấm vào mã là mở chứng từ đó."
      avoidWhen={
        <>
          con số hay tiền (dùng <code>Num</code>), chuỗi chứng từ cha → con (dùng{' '}
          <code>DocChain</code>), và mã KHÔNG dẫn đi đâu — <code>Code</code> luôn tô màu
          hành động, mà từ 16/09 màu đó chỉ còn nghĩa “bấm được”.
        </>
      }
      variants={[
        {
          name: 'Liên kết — as="a"',
          when: 'mã mở chứng từ. href nội bộ (bắt đầu bằng /) tự đi bằng next/link.',
          demo: (
            <p className="text-k-sm text-[var(--ink-2)]">
              Đơn{' '}
              <Code as="a" href="/design-lab/mau-erp">
                PO-2609-014
              </Code>{' '}
              thuộc lệnh{' '}
              <Code as="a" href="/design-lab/mau-danh-sach">
                05/26-27 - MX
              </Code>
              , còn 2 dòng chưa về.
            </p>
          ),
        },
        {
          name: 'Nút mở khay — as="button"',
          when: 'bấm mã để xem nhanh tại chỗ, không rời màn.',
          demo: <MoKhay />,
        },
        {
          name: 'Chỉ đọc — span (mặc định)',
          when: 'mã nằm trong một dòng mà CẢ DÒNG đã bấm được. Đứng một mình thì nên là liên kết.',
          demo: <Code>LSX-2026-0042</Code>,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Chữ mono cỡ nhỏ, đậm, màu hành động, số thẳng cột (tabular-nums).',
          behaves:
            'as="a" với href nội bộ đi bằng next/link — không tải lại trang, giữ bộ lọc. as="button" mặc định type="button" — không nộp form.',
        },
        {
          state: 'Rê chuột',
          looks: 'Không đổi dáng — không gạch chân, không đổi màu.',
          behaves: 'Con trỏ tay chỉ khi là a / button.',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động (luật chung .kit) khi là a / button.',
          behaves: 'span không nhận focus.',
        },
      ]}
      a11y={{
        role: 'link (as="a") · button (as="button") · không có (span)',
        keys: [
          { key: 'Tab', does: 'Tới mã khi là a / button.' },
          { key: 'Enter', does: 'Mở liên kết / kích hoạt nút.' },
          { key: 'Space', does: 'Kích hoạt khi là button.' },
        ],
        reader: (
          <>
            Đọc mã như chữ; tên liên kết chính là mã, nên câu quanh nó phải nói mã của cái
            gì. <code>as=&quot;button&quot;</code> mặc định{' '}
            <code>type=&quot;button&quot;</code>, nên đặt trong <code>&lt;form&gt;</code>{' '}
            bấm mã KHÔNG nộp form; chỗ gọi vẫn đổi được <code>type</code> nếu thật sự muốn
            (đã sửa 24/09/2026, B7½ — trước đó nút mã là <code>submit</code> ngầm; test
            canh điều này, còn nhánh <code>next/link</code> thì chưa có test).{' '}
            <b>Một chỗ chưa tốt, ghi thật:</b> rê chuột không có phản hồi nào, nên người
            dùng chuột chỉ biết mã bấm được nhờ màu.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>as=&quot;a&quot;</code> với href nội bộ — đi bằng{' '}
              <code>next/link</code>.
            </>
          ),
          dont: (
            <>
              <code>&lt;a&gt;</code> trần — tải lại cả tài liệu, trắng màn một nhịp và mất
              bộ lọc đang đặt.
            </>
          ),
          source:
            'chú thích trong Code (kit/Primitives.tsx); commit f668713 “điều hướng bằng next/link”',
        },
        {
          do: 'Mã trơn: chữ mono + màu.',
          dont: 'Bọc mỗi mã một khung viền như DocChip của v3.',
          source: 'JSDoc của Code — đo trên bảng 68 dòng, bảng đọc thành lưới ô vuông',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
