'use client'

import type { ReactNode } from 'react'
import { DualPct } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `DualPct` (B7, 24/09/2026). Số trong ví dụ lấy theo lệnh mẫu của
 * sổ (`/design-lab/thanh-phan#bay-so`): 400 bộ, 250 bộ đã qua Sơn.
 */

function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-k-sm w-[220px] text-[var(--ink-2)]">{nhan}</span>
      {children}
    </div>
  )
}

export default function DocDualPct() {
  return (
    <CompDoc
      family="dual-pct"
      alsoImport={['pctTienDo']}
      summary={
        <>
          Hai mẫu số tiến độ đặt cạnh nhau: <code>98% mảnh · 62% bộ</code>. Mảnh trả lời
          “xưởng có làm việc không” (đếm từng cái), bộ trả lời “giao được bao nhiêu bộ”
          (bộ đủ MỌI chi tiết). Cả hai đều đúng — bày một số một mình là nói dối một nửa.
        </>
      }
      useWhen="mọi chỗ bày % tiến độ sản xuất của một SP, một công đoạn hay một lệnh — nơi số cái đã làm và số bộ đã đủ có thể lệch xa nhau."
      avoidWhen={
        <>
          tỉ lệ chỉ có một mẫu số (tỉ lệ nhập kho, tỉ lệ đơn đúng hạn — dùng{' '}
          <code>CoverageBar</code> hoặc <code>Metric</code>); so nhiều công đoạn với nhau
          bằng mắt (dùng <code>MiniBars</code>).
        </>
      }
      variants={[
        {
          name: 'Ngang — trong dòng chữ, ô rộng',
          when: 'mặc định. Số theo bộ đậm hơn — đó là số giao hàng.',
          demo: (
            <div className="grid gap-1.5">
              <Dong nhan="Chân trước · đang làm">
                <DualPct pieces={0.98} sets={0.62} />
              </Dong>
              <Dong nhan="Đủ bộ">
                <DualPct pieces={1} sets={1} />
              </Dong>
              <Dong nhan="99,6% — vẫn in 99%">
                <DualPct pieces={0.996} sets={0.996} />
              </Dong>
              <Dong nhan="Chưa định hình chi tiết">
                <DualPct pieces={null} sets={0} />
              </Dong>
            </div>
          ),
        },
        {
          name: 'Xếp hai dòng — stack',
          when: 'ô hẹp của bảng chéo, dưới con số chính. Căn phải theo cột số.',
          demo: (
            <span className="grid w-[120px] justify-items-end leading-tight">
              <b className="num">250</b>
              <DualPct pieces={0.7} sets={0.625} stack />
            </span>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Số chữ đơn cách; số theo bộ đậm, mực chính; chữ “mảnh”, “bộ” nhạt.',
          behaves: 'Tĩnh. Làm tròn XUỐNG: 99,6% in 99%, chỉ in 100% khi đủ thật.',
        },
        {
          state: 'Đủ bộ',
          looks: 'Số theo bộ đổi màu --done khi đạt 100%. Số theo mảnh không đổi màu.',
          behaves: 'Màu chỉ đi kèm — chữ “100%” đã nói đủ.',
        },
        {
          state: 'Không áp dụng',
          looks: '“—” thay cho con số (truyền null).',
          behaves:
            'Khác 0%: không có mẫu số, không phải chưa làm. Trình đọc nghe “chưa có số”.',
        },
        {
          state: 'Rê chuột',
          looks: 'Chú giải của trình duyệt (title) giải nghĩa hai mẫu số.',
          behaves:
            'title chỉ tới được bằng chuột; cùng câu đó có sẵn bằng chữ ẩn cho trình đọc — xem mục Truy cập.',
        },
      ]}
      a11y={{
        role: '(không có — đoạn chữ thường)',
        keys: [{ key: '—', does: 'Không nhận phím, không nhận focus.' }],
        reader: (
          <>
            Đọc thẳng chữ: “98% mảnh · 62% bộ”, rồi câu giải nghĩa hai mẫu số bằng chữ ẩn
            (<code>sr-only</code>) — “Mảnh: tổng số cái đã làm trên tổng số cái cần…” —
            viết bằng lời thay cho dấu chia. Ô “không áp dụng” ẩn dấu gạch dài khỏi trình
            đọc và đọc “chưa có số”, nên người nghe không còn chỉ nghe “bộ”. Cả hai sửa
            24/09/2026 (B7½), có test canh — trước đó câu giải nghĩa chỉ nằm trong{' '}
            <code>title</code> của một thẻ không nhận focus, và gạch dài trần bị nhiều
            trình đọc bỏ qua. <b>Ghi thật:</b> người dùng bàn phím NHÌN màn hình vẫn không
            thấy câu giải nghĩa — nó chỉ hiện khi rê chuột.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Bày cả hai mẫu số ở mọi chỗ có % tiến độ.',
          dont: 'Chỉ bày % theo bộ: ghi 150 cái chân xong mà màn vẫn báo “Chưa bắt đầu · 0%”.',
          source:
            'lỗi L3 — docs/thong-ke-thiet-ke-tu-excel.md §3b, docs/san-xuat-test-case-thong-ke.md',
        },
        {
          do: (
            <>
              Truyền <code>null</code> khi không có mẫu số (chưa định hình, không có chi
              tiết).
            </>
          ),
          dont: 'Truyền 0 — “0%” nói “chưa làm”, trong khi thật ra không có gì để đếm.',
          source:
            'chú thích DualPct (Viz.tsx); test “không có mẫu số thì —, không phải 0%”',
        },
        {
          do: (
            <>
              Dùng <code>pctTienDo</code> khi tự in % tiến độ ở chỗ khác.
            </>
          ),
          dont: 'Math.round — 99,6% in “100%”, người đọc thôi đi tìm cái còn thiếu.',
          source: 'chú thích pctTienDo (Viz.tsx); test “99,6% vẫn là 99%”',
        },
      ]}
      tested={{ file: 'src/components/kit/viz.test.tsx' }}
    />
  )
}
