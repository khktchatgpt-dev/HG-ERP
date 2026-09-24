'use client'

import { Code, Num, Tag } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

export default function DocTag() {
  return (
    <CompDoc
      family="tag"
      summary={
        <>
          Nhãn một từ về tình trạng của dòng, tô theo <b>vòng đời dữ liệu</b>: đỏ hỏng/quá
          hạn, hổ phách đang chờ, lục xong, xám chưa có gì. Cố ý <b>không có</b> tone màu
          hành động — thứ chỉ để đọc không được trông giống thứ bấm được.
        </>
      }
      useWhen="một ô bảng hay đầu khối cần nói TÌNH TRẠNG bằng một hai từ: Quá hạn, Chờ duyệt, Đã nhập kho."
      avoidWhen={
        <>
          tình trạng phải kèm lý do hay việc làm tiếp (dùng <code>LineStatus</code>), bước
          trong vòng đời chứng từ (dùng <code>StatusTrack</code>), hoặc thứ bấm được để
          lọc (dùng <code>Chip</code>).
        </>
      }
      variants={[
        {
          name: 'Bốn tone',
          when: 'chọn theo vòng đời của dữ liệu, không theo độ “quan trọng” của màn.',
          demo: (
            <div className="flex flex-wrap items-center gap-2">
              <Tag>Nháp</Tag>
              <Tag tone="warn">Chờ duyệt</Tag>
              <Tag tone="stop">Quá hạn 3 ngày</Tag>
              <Tag tone="done">Đã nhập kho</Tag>
            </div>
          ),
        },
        {
          name: 'Trong một dòng bảng',
          when: 'nhãn đứng sau mã, trước số — mắt quét cột nhãn để tìm dòng cần động vào.',
          demo: (
            <div className="grid gap-1">
              {[
                [
                  'PO-2609-014',
                  'Công ty Sơn Tín Phát',
                  'stop',
                  'Quá hạn 3 ngày',
                  '25.132.800',
                ],
                ['PO-2609-015', 'Cơ khí Thành Đạt', 'warn', 'Chờ duyệt', '8.400.000'],
                ['PO-2609-016', 'Gỗ Minh Long', 'done', 'Đã nhập kho', '112.560.000'],
              ].map(([ma, ncc, tone, tag, tien]) => (
                <div
                  key={ma}
                  className="text-k-sm flex items-center gap-3 border-b border-[var(--hair)] py-1"
                >
                  <Code>{ma}</Code>
                  <span className="flex-1 text-[var(--ink)]">{ncc}</span>
                  <Tag tone={tone as 'stop' | 'warn' | 'done'}>{tag}</Tag>
                  <span className="w-[110px] text-right">
                    <Num value={tien} />
                  </span>
                </div>
              ))}
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Khối cao 19px, nền nhạt theo tone, chữ nhãn đậm cùng màu, không ngắt dòng.',
          behaves: 'Tĩnh. Không nhận focus, không bấm được.',
        },
      ]}
      a11y={{
        role: '(không có — span văn bản)',
        keys: [{ key: '—', does: 'Không nhận phím.' }],
        reader: (
          <>
            Đọc đúng chữ trong nhãn. Màu <b>không</b> được đọc ra — nên chữ phải tự đủ
            nghĩa: “Quá hạn 3 ngày”, không phải một dấu “!” tô đỏ. Không có gì báo cho
            trình đọc biết nhãn thuộc tone nào.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Tone theo vòng đời của DỮ LIỆU: quá hạn → stop, chờ → warn, xong → done.',
          dont: 'Xin thêm tone màu hành động cho nhãn "nổi bật" — nhãn đọc sẽ trông như nút.',
          source: 'JSDoc của Tag (kit/Primitives.tsx); CLAUDE.md nguyên tắc 5',
        },
        {
          do: 'Số 0 hay "không có việc" để nhãn xám hoặc bỏ nhãn.',
          dont: 'Tô đỏ "0 đơn trễ" — số 0 không phải lúc nào cũng xấu.',
          source: 'CLAUDE.md nguyên tắc 3 “Con số là một lời hứa”',
        },
        {
          do: (
            <>
              <code>&lt;Tag tone=&quot;stop&quot;&gt;</code>
            </>
          ),
          dont: 'Tự dựng nhãn bằng lớp màu Tailwind dựng sẵn (đỏ, hổ phách…).',
          source: 'luật lint hg/no-hardcoded-color (eslint-rules/hg-ui.mjs)',
        },
      ]}
      tested={{
        missing:
          'chỉ có axe trên ví dụ của trang này (kit-docs.test.tsx); thành phần tĩnh, không có hành vi để test phím.',
      }}
    />
  )
}
