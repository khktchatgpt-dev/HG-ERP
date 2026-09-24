'use client'

import { useState } from 'react'
import { DocHead, StatusTrack } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `DocHead` + `StatusTrack` — đầu chứng từ và các trục trạng thái
 * (B7, 24/09/2026).
 *
 * Họ này mang ba bài học thật của dự án, cả ba đều có commit: dải bước từng là
 * nút giả (14/09), từng tô cùng màu với nút chính (16/09), và từng tick những
 * bước chưa ai làm (17/09). Mục 6 kể lại cả ba.
 */

const PO_STEPS = [
  'Nháp',
  'Chờ duyệt',
  'Đã duyệt',
  'Đã gửi NCC',
  'NCC xác nhận',
  'Hàng về',
]

function ChonBuoc() {
  const [at, setAt] = useState(1)
  return (
    <DocHead
      kind="Lệnh sản xuất"
      code="06/26-27 - MX"
      sub="Khách MERXX · 240 bộ · hạn 30/10/2026"
    >
      <StatusTrack
        label="Chặng"
        steps={['Định hình', 'Phôi', 'Hàn', 'Sơn', 'Đóng gói']}
        at={at}
        onPick={setAt}
      />
    </DocHead>
  )
}

export default function DocDocHead() {
  return (
    <CompDoc
      family="doc-head"
      summary={
        <>
          Đầu chứng từ: loại, <b>số hiệu</b> (bậc chữ lớn duy nhất của màn), dòng phụ, và
          một hay nhiều <code>StatusTrack</code> — mỗi trục một vòng đời độc lập, như
          Dynamics tách trạng thái đơn / nhận hàng / duyệt thành ba trường.
        </>
      }
      useWhen="chứng từ có vòng đời (đơn mua, lệnh sản xuất, phiếu nhập) — trả lời “tờ này đang ở bước nào” ngay dưới thanh hành động."
      avoidWhen={
        <>
          hồ sơ danh mục (nhà cung cấp, vật tư, sản phẩm) — không ai duyệt nó, nên dùng{' '}
          <code>MetricStrip</code> nói “làm ăn ra sao”; bịa vòng đời cho nó là bắt người
          dùng đi tìm nút gửi duyệt không tồn tại.
        </>
      }
      variants={[
        {
          name: 'Hai trục, có mốc thời gian thật',
          when: 'màn chứng từ thật (compact). Trục đơn có marks: bước “Đã gửi NCC” không có mốc nên KHÔNG tick, vạch đứt kèm dấu ?, và một dòng nói ra dưới dải.',
          demo: (
            <DocHead
              compact
              kind="Đơn đặt vật tư"
              code="PO-2609-014"
              sub="Cơ khí Thành Đạt · soạn 01/09/2026"
            >
              <StatusTrack
                label="Trạng thái đơn"
                steps={PO_STEPS}
                at={4}
                tone="wait"
                marks={['01/09/2026', undefined, '03/09/2026', null, null, undefined]}
              />
              <StatusTrack
                label="Nhận hàng"
                steps={['Chưa', 'Một phần', 'Đủ']}
                at={1}
                tone="wait"
              />
            </DocHead>
          ),
        },
        {
          name: 'Năm nghĩa của bước đang đứng (tone)',
          when: 'màu theo NGHĨA, không mặc định xanh: idle chưa đi · wait chờ ai đó · run đang chạy đúng đường · done xong · stop dừng.',
          demo: (
            <div className="grid gap-2">
              <StatusTrack label="idle — nháp" steps={PO_STEPS} at={0} tone="idle" />
              <StatusTrack label="wait — chờ duyệt" steps={PO_STEPS} at={1} tone="wait" />
              <StatusTrack label="run — đã gửi NCC" steps={PO_STEPS} at={3} tone="run" />
              <StatusTrack
                label="done — hàng về đủ"
                steps={PO_STEPS}
                at={5}
                tone="done"
              />
            </div>
          ),
        },
        {
          name: 'Bậc kết thúc ngoài trục — đơn huỷ',
          when: 'chứng từ dừng hẳn ở chỗ không nằm trong dãy bước. at = -1 để cả trục lùi về nhạt, thay vì tick những bước đơn chưa đi qua.',
          demo: (
            <DocHead
              kind="Đơn đặt vật tư"
              code="PO-2609-009"
              sub="Kim khí An Phát · huỷ 05/09/2026"
            >
              <StatusTrack
                label="Trạng thái đơn"
                steps={PO_STEPS}
                at={-1}
                tone="stop"
                terminal="Đã huỷ"
              />
            </DocHead>
          ),
        },
        {
          name: 'Bấm được — onPick',
          when: 'CHỈ khi bấm bước thật sự đổi được trạng thái (kiểu Odoo). Bấm một chặng để thấy nó thành bước đang đứng.',
          demo: <ChonBuoc />,
        },
      ]}
      states={[
        {
          state: 'Bước đã qua',
          looks: 'Ô viền mảnh nền thẻ, chữ đậm màu hơn bước chưa tới, dấu ✓ trước chữ.',
          behaves: 'Có mốc thì rê chuột hiện “bước — ngày”.',
        },
        {
          state: 'Bước đã qua mà KHÔNG có mốc (marks[i] = null)',
          looks: 'Viền đứt, chữ mờ, dấu ? thay cho ✓.',
          behaves:
            'Rê chuột nói rõ không có mốc; dưới dải có một dòng “N bước không có mốc thời gian — đơn không đi qua bước đó trên hệ thống.”',
        },
        {
          state: 'Bước đang đứng',
          looks:
            'Chữ đậm, nền NHẠT + chấm tròn đầu bước, màu theo tone. Không bao giờ nền đặc — nền đặc là của nút.',
          behaves: 'aria-current="step".',
        },
        {
          state: 'Bước chưa tới',
          looks: 'Ô viền mảnh nền thẻ, chữ nhạt nhất, không dấu.',
          behaves: '—',
        },
        {
          state: 'Đã qua hết trục (at ≥ số bước)',
          looks: 'Mọi bước là “đã qua”, không bước nào đang đứng.',
          behaves:
            'Dùng khi trục đã xong vai trò (đơn đã về thì trục phát hành xong rồi).',
        },
        {
          state: 'Kết thúc ngoài trục (terminal)',
          looks: 'Thêm một bước màu --stop cuối dải; at = -1 thì mọi bước khác nhạt.',
          behaves: 'Bước kết thúc mang aria-current="step".',
        },
        {
          state: 'Bấm được (onPick) — rê chuột / focus',
          looks: 'Con trỏ tay trên từng bước; vòng focus 2px màu hành động.',
          behaves:
            'Mỗi bước là <button>, bấm gọi onPick(i). Không có onPick thì là <span>, không nhận focus.',
        },
        {
          state: 'Gọn (DocHead compact)',
          looks:
            'Số hiệu 18px cùng một dòng với loại và phụ đề; trục trạng thái cùng hàng bên phải, nhãn trục đứng cùng hàng với các bước.',
          behaves: 'Để lưới dòng hiện trong 1/3 màn đầu.',
        },
      ]}
      a11y={{
        role: 'heading cấp 1 (số hiệu) · list / listitem (dải chỉ-đọc) · button (dải bấm được)',
        keys: [
          { key: 'Tab', does: 'Chỉ khi có onPick: đi qua từng bước.' },
          { key: 'Enter / Space', does: 'Chọn bước (gọi onPick).' },
        ],
        reader: (
          <>
            Số hiệu là <code>&lt;h1&gt;</code> nên nhảy tới được bằng phím tiêu đề; bước
            đang đứng mang <code>aria-current=&quot;step&quot;</code>; dòng “N bước không
            có mốc” là chữ thường nên được đọc. Dải bấm được (<code>onPick</code>) kèm{' '}
            <code>terminal</code> nay không còn listitem mồ côi: bước kết thúc chỉ mang
            vai <code>listitem</code> khi dải là list (chỉ-đọc) — sửa 24/09/2026 (B7½),
            test ở <code>erp.a11y.test.tsx</code>. <b>Hai chỗ chưa tốt, ghi thật:</b> dấu
            ✓ và ? đều <code>aria-hidden</code> và mốc ngày chỉ nằm trong{' '}
            <code>title</code>, nên trình đọc KHÔNG phân biệt được bước đã qua, chưa tới
            hay thiếu mốc — chỉ biết bước hiện tại (ba trạng thái của <code>marks</code>{' '}
            cũng chưa có test); và nhãn trục (<code>label</code>) là div rời, không gắn
            vào danh sách bằng <code>aria-labelledby</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Không có <code>onPick</code> thì dải là chữ chỉ-đọc; nút chuyển bước thật
              nằm ở <code>ActionPane</code>.
            </>
          ),
          dont: 'Dựng 9 nút xám câm trông như điều khiển đổi trạng thái.',
          source:
            'chú thích StatusTrack trong kit/Erp.tsx (14/09/2026) — chủ dự án báo “chi tiết đơn không cập nhật được tình trạng”',
        },
        {
          do: 'Bước đang đứng: nền nhạt + chấm tròn, màu theo nghĩa (tone).',
          dont: 'Tô nền đặc --act — cùng rgb(31,75,184), cùng bo góc với nút chính.',
          source:
            'commit 619e3e4 và CLAUDE.md nguyên tắc 5 — chủ dự án chấm “chỉ có mỗi màu xanh trắng, rất khó phân biệt” (16/09/2026)',
        },
        {
          do: (
            <>
              Truyền <code>marks</code> từ cột mốc thật; <code>null</code> khi có chỗ ghi
              mà trống.
            </>
          ),
          dont: 'Suy dải từ trạng thái cuối rồi tick hết — khẳng định “đã duyệt · đã gửi” cho việc chưa ai làm.',
          source:
            'commit 88000cd (17/09/2026) — 43 đơn nạp thẳng ở trạng thái cuối, 0/63 đơn có mốc duyệt / gửi / xác nhận',
        },
        {
          do: 'Mỗi vòng đời một trục (Trạng thái đơn, Nhận hàng).',
          dont: 'Dồn “về một phần mà vẫn chờ sửa giá” vào MỘT thanh tuyến tính.',
          source:
            'chú thích mục 3 trong kit/Erp.tsx (Dynamics tách ba trường trạng thái)',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
