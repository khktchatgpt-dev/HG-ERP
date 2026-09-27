'use client'

import { Hint, ToneText } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `Hint` + `ToneText` (28/09/2026).
 *
 * Hai vai chữ mà màn nào cũng cần và trước đây màn nào cũng tự tô: chữ PHỤ (ghi
 * chú nhạt cạnh nội dung chính) và chữ NHẤN theo vòng đời (trễ, cần để ý, đã
 * xong). Đo 28/09/2026: 252 chỗ tự gõ `text-[var(--ink-3)]`, ~200 chỗ tự gõ màu
 * vòng đời — cỡ và độ đậm lệch nhau giữa các màn.
 */
export default function DocHint() {
  return (
    <CompDoc
      family="hint"
      summary={
        <>
          <code>Hint</code> là chữ phụ nhỏ, nhạt: “+5 mã”, “· cộng riêng từng loại tiền”.{' '}
          <code>ToneText</code> là chữ nhấn bằng MỘT trong ba màu vòng đời: “qua 28 ng”,
          “12 ngày”. Dùng hai thành phần này thay vì tự gõ lớp màu — cỡ và độ đậm đồng
          nhất mọi màn.
        </>
      }
      useWhen="chữ phụ đứng cạnh số/mã/tên; một cụm ngắn cần mắt dừng lại vì trễ, vì cần để ý, hoặc vì đã xong."
      avoidWhen={
        <>
          nhãn trạng thái của dòng (dùng <code>Tag</code>); thứ bấm được (dùng{' '}
          <code>Btn</code>/<code>Code as=&quot;a&quot;</code> — màu vòng đời không bao giờ
          lên thứ bấm được); số trong cột số (dùng <code>Num</code>).
        </>
      }
      variants={[
        {
          name: 'Hint — cạnh nội dung chính',
          when: 'ghi chú rút gọn cạnh một mã / một tổng.',
          demo: (
            <span className="text-k-body">
              Gỗ · Bồn hoa lớn, khung nhôm <Hint>+5 mã</Hint>
            </span>
          ),
        },
        {
          name: 'Hint size="sm"',
          when: 'dòng giải thích dưới tiêu đề một khối.',
          demo: <Hint size="sm">Cộng riêng từng loại tiền, KHÔNG quy đổi.</Hint>,
        },
        {
          name: 'ToneText — ba màu vòng đời',
          when: 'trễ (stop) · cần để ý (warn) · đã xong (done).',
          demo: (
            <span className="text-k-body flex gap-4">
              <ToneText tone="stop" title="Hẹn giao 30/08 đã qua 28 ngày">
                30/08 qua 28 ng
              </ToneText>
              <ToneText tone="warn">còn 1 ng</ToneText>
              <ToneText tone="done">về đủ</ToneText>
            </span>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Hint: 11px, mực nhạt. ToneText: đậm, màu theo tone.',
          behaves: 'Không tương tác.',
        },
        {
          state: 'Có title',
          looks: 'Không đổi hình.',
          behaves: 'Rê chuột hiện chữ đầy đủ / lý do nhấn.',
        },
        {
          state: 'strong={false}',
          looks: 'ToneText giữ màu, bỏ đậm — khi đã nằm trong ô chữ đậm.',
          behaves: '—',
        },
      ]}
      a11y={{
        role: 'span thường — không có vai riêng',
        keys: [{ key: '—', does: 'Không nhận focus.' }],
        reader: (
          <>
            Đọc như chữ thường. Màu KHÔNG phải kênh duy nhất: chữ phải tự nói nghĩa (“qua
            28 ng”, không phải một con số đỏ trơ trọi).
          </>
        ),
      }}
      doDont={[
        {
          do: 'Dùng Hint / ToneText cho chữ phụ và chữ nhấn.',
          dont: 'Tự gõ text-[var(--ink-3)] / font-semibold text-[var(--stop)] trong màn — mỗi màn một cỡ.',
          source: 'đo 28/09/2026: 252 + ~200 chỗ tự tô trong src/app',
        },
        {
          do: 'Để số 0 trơn (hoặc Num zero).',
          dont: 'Bọc số 0 trong ToneText stop — số 0 không phải tin xấu.',
          source: 'CLAUDE.md nguyên tắc 3',
        },
        {
          do: 'Chữ nhấn tự nói nghĩa: “qua 28 ng”.',
          dont: 'Chỉ tô đỏ một ngày tháng — người mù màu không thấy khác gì.',
          source: 'dataviz / a11y: màu không là kênh duy nhất',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
