'use client'

import { Code, CoverageBar, coverage, coveragePct } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

const DONG = [
  { ma: 'VT-00123', ten: 'Thép hộp 20x40x1.2', need: 1200, covered: 744 },
  { ma: 'VT-00481', ten: 'Sơn tĩnh điện đen mờ', need: 85, covered: 12 },
  { ma: 'VT-01007', ten: 'Kính cường lực 8 ly', need: 40, covered: 40 },
  { ma: 'VT-00902', ten: 'Ốc lục giác M6x20', need: 0, covered: 0 },
]

export default function DocCoverageBar() {
  return (
    <CompDoc
      family="coverage-bar"
      alsoImport={['coverage', 'coveragePct']}
      summary={
        <>
          Thanh ngắn + nhãn phần trăm, gộp “đã có bao nhiêu phần của cái đang cần” thành
          MỘT câu trả lời — thay cho năm cột số (đã xuất / tồn / đã đặt / nháp / đã về).
          Tính tỉ lệ bằng <code>coverage()</code>, in nhãn bằng <code>coveragePct()</code>
          .
        </>
      }
      useWhen="cột “đã phủ bao nhiêu” trên bảng kê vật tư hay danh sách lệnh — người dùng cần biết còn xa hay gần, chi tiết từng cột để ở khay kiểm tra."
      avoidWhen={
        <>
          con số phải đọc chính xác (dùng <code>Num</code>), hai tỉ lệ khác mẫu số đặt
          cạnh nhau (dùng <code>DualPct</code>), hay tiến độ theo từng ngày (dùng{' '}
          <code>DayStrip</code>).
        </>
      }
      variants={[
        {
          name: 'Đang phủ dở — và đủ',
          when: 'mỗi dòng một thanh; đủ thì thanh chuyển màu xong. need = 0 tính là đủ: không cần gì thì không thiếu gì.',
          demo: (
            <div className="grid max-w-[520px] gap-1">
              {DONG.map((d) => {
                const r = coverage(d)
                return (
                  <div
                    key={d.ma}
                    className="text-k-sm flex items-center gap-3 border-b border-[var(--hair)] py-1"
                  >
                    <Code>{d.ma}</Code>
                    <span className="flex-1 text-[var(--ink)]">{d.ten}</span>
                    <CoverageBar ratio={r} label={coveragePct(r)} />
                  </div>
                )
              })}
            </div>
          ),
        },
        {
          name: 'Nhãn nói đủ ý',
          when: 'thanh đứng một mình, không có tiêu đề cột bên trên — nhãn phải tự nói phủ CÁI GÌ.',
          demo: <CoverageBar ratio={0.62} label="62% đã có đơn" />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Rãnh xám 52×5px; phần đã phủ tô màu “đã làm” (không phải màu hành động). Nhãn đứng bên phải.',
          behaves: 'Tĩnh, không bấm được.',
        },
        {
          state: 'Đủ (ratio ≥ 1)',
          looks: 'Cả thanh chuyển màu xong.',
          behaves: '—',
        },
        {
          state: 'Rỗng (ratio 0)',
          looks: 'Chỉ còn rãnh xám + nhãn “0%”.',
          behaves:
            'Thành phần không tự kẹp số âm — đưa qua coverage() thì đã kẹp về 0–1.',
        },
      ]}
      a11y={{
        role: '(không có — không phải progressbar hay meter)',
        keys: [{ key: '—', does: 'Không nhận phím.' }],
        reader: (
          <>
            Chỉ đọc chữ của <code>label</code>; phần thanh là hình, không có{' '}
            <code>role=&quot;meter&quot;</code> hay <code>aria-valuenow</code>.{' '}
            <b>Ghi thật:</b> nhãn trần “62%” đặt ngoài bảng thì người nghe không biết 62%
            của cái gì — khi đó nhãn phải nói đủ câu.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Một thanh thay năm cột; chi tiết từng cột để ở khay kiểm tra.',
          dont: 'Bày năm cột số rồi bắt người mua tự nhẩm còn xa bao nhiêu.',
          source:
            'JSDoc của coverage() (kit/kit-core.ts) — đo trên LSX 06/26-27, 4/5 cột rỗng',
        },
        {
          do: 'Phần đã phủ dùng màu dữ liệu (token fill).',
          dont: 'Tô bằng màu hành động — thanh này không bấm được.',
          source: 'chú thích trong CoverageBar, đổi 23/09/2026 (kit/Primitives.tsx)',
        },
      ]}
      tested={{
        missing:
          'chỉ có axe trên ví dụ của trang này (kit-docs.test.tsx); phép tính coverage() có test đơn vị ở kit-core.test.ts, còn phần vẽ thì chưa.',
      }}
    />
  )
}
