'use client'

import type { ReactNode } from 'react'
import { Num } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

function Cot({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <div className="grid justify-items-end gap-0.5">
      <span className="text-k-label text-[var(--ink-3)]">{nhan}</span>
      {children}
    </div>
  )
}

export default function DocNum() {
  return (
    <CompDoc
      family="num"
      summary={
        <>
          Con số trong bảng: chữ đơn cách, <b>số thẳng cột</b> (tabular-nums). Nhận chuỗi{' '}
          <b>đã định dạng sẵn</b> — thành phần không tự định dạng. Khi rỗng thì có ba cách
          hiện, vì “chưa có số”, “bằng 0” và “hết việc” là ba câu trả lời khác nhau.
        </>
      }
      useWhen="số lượng, tiền, tỉ lệ trong ô bảng hay FactBox — nhất là cột phải so theo chiều dọc."
      avoidWhen={
        <>
          số chênh lệch so với kỳ trước (dùng <code>DeltaNum</code>), tỉ lệ phủ cần thấy
          bằng mắt (dùng <code>CoverageBar</code>), ô cho người dùng gõ số (dùng{' '}
          <code>NumInput</code>).
        </>
      }
      variants={[
        {
          name: 'Thường · strong · muted',
          when: 'trên một dòng nhiều số, đúng MỘT số đậm: số người dùng mang đi làm việc.',
          demo: (
            <div className="flex flex-wrap gap-6">
              <Cot nhan="Cần theo định mức">
                <Num value="1.200" />
              </Cot>
              <Cot nhan="Đã về">
                <Num value="800" muted />
              </Cot>
              <Cot nhan="Còn phải đặt">
                <Num value="400" strong />
              </Cot>
              <Cot nhan="Thành tiền">
                <Num value="25.132.800" strong />
              </Cot>
            </div>
          ),
        },
        {
          name: 'Ba kiểu rỗng — zero',
          when: 'value rỗng. Chọn theo NGHĨA của ô, không theo hình thích nhìn.',
          demo: (
            <div className="flex flex-wrap gap-6">
              <Cot nhan="Đơn giá — chưa ai nhập (dash)">
                <Num value="" />
              </Cot>
              <Cot nhan="Tồn kho — bằng 0 thật (zero)">
                <Num value="" zero="zero" />
              </Cot>
              <Cot nhan="Còn phải đặt — đã đủ (done)">
                <Num value="" zero="done" />
              </Cot>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Chữ nhỏ, màu chữ phụ. strong: cỡ thân, đậm, màu chữ chính. muted: nhạt hơn.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'Rỗng',
          looks: 'dash: gạch ngang “—” rất nhạt. zero: “0” nhạt. done: dấu ✓ màu xong.',
          behaves:
            'Nghĩa của dash/done nói hai lần: title (“Chưa có số”, “Không còn phải làm”) hiện khi rê chuột, và cùng câu đó bằng chữ ẩn cho trình đọc.',
        },
      ]}
      a11y={{
        role: '(không có — span văn bản)',
        keys: [{ key: '—', does: 'Không nhận phím.' }],
        reader: (
          <>
            Đọc đúng chuỗi truyền vào. Ô rỗng kiểu <code>dash</code> đọc “Chưa có số”,
            kiểu <code>done</code> đọc “Không còn phải làm” — bằng chữ ẩn (
            <code>sr-only</code>), còn ký hiệu “—” / “✓” thì <code>aria-hidden</code> để
            khỏi đọc đôi. Kiểu <code>zero</code> đọc “0”. (Sửa 24/09/2026, B7½: trước đó
            nghĩa chỉ nằm ở <code>title</code>, mà <code>title</code> trên một{' '}
            <code>span</code> thường KHÔNG được đọc ra — người nghe chỉ nhận “gạch ngang”
            hay “dấu tích”, có trình đọc im luôn.)
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>zero=&quot;done&quot;</code> cho cột “còn phải làm” khi đã xong.
            </>
          ),
          dont: 'Để gạch ngang — đọc thành "thiếu dữ liệu" trong khi ý là "hết việc rồi".',
          source:
            'JSDoc của Num — lỗi phát hiện 08/09/2026 trên trang trưng bày, cột Cần mua',
        },
        {
          do: 'Một số strong mỗi dòng.',
          dont: 'Đậm cả sáu số — mắt phải đọc cả sáu để tìm cái cần.',
          source: 'JSDoc của Num (kit/Primitives.tsx)',
        },
        {
          do: 'Số trong bảng luôn qua Num (hoặc lớp num).',
          dont: 'Số bằng chữ thường — các chữ số rộng khác nhau, cột căn phải vẫn nhấp nhô.',
          source: 'chú thích khối SỐ trong kit/tokens.css — tabular-nums là bắt buộc',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
