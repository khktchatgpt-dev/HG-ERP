'use client'

import { Timeline, type Mark } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — Timeline (B7, 24/09/2026).
 *
 * Ngày giờ cố định (ISO có múi +07:00) để trang dựng ra giống nhau mọi lần.
 */

const DANG_CHO_DUYET: Mark[] = [
  { key: 'tao', at: '2026-09-01T09:02:00+07:00', label: 'Soạn đơn', actor: 'Nguyễn Văn A' }, // prettier-ignore
  { key: 'gia', at: '2026-09-02T14:20:00+07:00', label: 'Sửa đơn giá CN1527', actor: 'Nguyễn Văn A', detail: '352.000 → 369.600' }, // prettier-ignore
  { key: 'gui', at: '2026-09-05T16:10:00+07:00', label: 'Gửi Giám đốc duyệt', actor: 'Nguyễn Văn A', tone: 'warn' }, // prettier-ignore
  { key: 'duyet', at: null, label: 'Giám đốc duyệt' },
  { key: 'ncc', at: null, label: 'Gửi nhà cung cấp' },
  { key: 'xn', at: null, label: 'NCC xác nhận đơn' },
]

const DA_HUY: Mark[] = [
  { key: 'tao', at: '2026-08-20T08:30:00+07:00', label: 'Soạn đơn', actor: 'Trần Thị C' }, // prettier-ignore
  { key: 'duyet', at: '2026-08-21T10:05:00+07:00', label: 'Giám đốc duyệt', actor: 'Giám đốc', tone: 'done' }, // prettier-ignore
  { key: 'ncc', at: '2026-08-21T15:40:00+07:00', label: 'Gửi nhà cung cấp', actor: 'Trần Thị C' }, // prettier-ignore
  { key: 'huy', at: '2026-08-26T09:12:00+07:00', label: 'Huỷ đơn', actor: 'Trần Thị C', detail: 'NCC ngừng sản xuất mã vải VB-0412 — đặt lại ở Vải Phú Hưng', tone: 'stop' }, // prettier-ignore
]

export default function DocTimeline() {
  return (
    <CompDoc
      family="timeline"
      summary={
        <>
          Đời một chứng từ theo mốc, <b>cả mốc chưa tới</b>: mốc đã xảy ra có chấm màu,
          giờ, người làm; mốc chưa tới bày mờ với chữ “chưa tới”. Người đọc thấy còn mấy
          bước nữa mà không cần thuộc quy trình.
        </>
      }
      useWhen="trên màn chứng từ (khuôn D), trả lời câu “đã có chuyện gì với tờ này, và còn mấy bước”."
      avoidWhen={
        <>
          cần ghi LÝ DO bằng lời người (dùng <code>NoteStream</code> — nó trộn được cả mốc
          máy ghi), hoặc cần vết từng trường đổi từ gì sang gì (dùng{' '}
          <code>AuditTable</code>).
        </>
      }
      variants={[
        {
          name: 'Đang chờ duyệt — ba mốc chưa tới',
          when: 'mốc đang đứng tô warn; các mốc sau để at: null, kit bày mờ.',
          demo: <Timeline marks={DANG_CHO_DUYET} />,
        },
        {
          name: 'Đã huỷ — mốc cuối nói vì sao',
          when: 'mốc huỷ tone stop, detail ghi lý do một dòng. Không còn mốc chưa tới.',
          demo: <Timeline marks={DA_HUY} />,
        },
      ]}
      states={[
        {
          state: 'Mốc đã xảy ra',
          looks:
            'Chấm 9px màu theo tone (bỏ trống = màu hành động), nhãn đậm, giờ “dd/mm hh:mm” chữ đơn cách, “· người làm”, dòng detail bên dưới.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'Mốc chưa tới (at: null)',
          looks: 'Chấm xám, nhãn chữ thường màu nhạt, chữ “chưa tới” thay cho giờ.',
          behaves: 'actor và detail bị ẩn dù có truyền.',
        },
      ]}
      a11y={{
        role: 'list (thẻ <ol>) · listitem',
        keys: [],
        reader: (
          <>
            Đọc “danh sách, N mục”, rồi từng mốc: nhãn, giờ hoặc “chưa tới”, người làm.{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> màu của chấm (xong, cảnh báo, huỷ) là{' '}
            <code>&lt;span&gt;</code> rỗng nên người nghe không nhận được — nhãn phải tự
            nói đủ (“Huỷ đơn”, không phải “Cập nhật”); và giờ không có năm, không nằm
            trong thẻ <code>&lt;time&gt;</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Truyền at là ISO THẬT; mốc tương lai để null.',
          dont: 'Nhét một ngày giả (“2000-01-01”) chỉ để kit hiểu mốc đã xảy ra — kit in nó ra thật thành “01/01 07:00”.',
          source: 'exec/ApprovalDetailScreen.tsx — chú thích ở Timeline “Luồng duyệt”',
        },
        {
          do: 'Luôn có mốc tạo chứng từ (created_at).',
          dont: 'Để dòng thời gian ra 0 mốc rồi báo “chưa phát sinh sự kiện nào” cho một đơn nháp đủ dữ liệu.',
          source: 'kit/flow-core.ts — chú thích buildPoMarks: bản v3 bỏ sót created_at',
        },
        {
          do: 'Bày cả mốc chưa tới.',
          dont: 'Chỉ liệt kê việc đã làm — người đọc phải thuộc quy trình mới biết còn bao xa.',
          source: 'kit/Flow.tsx — chú thích Timeline “luật quan trọng nhất”',
        },
      ]}
      tested={{
        missing:
          'flow-core.test.ts chỉ kiểm hàm thuần buildPoMarks (dựng dữ liệu mốc: không bao giờ 0 mốc, mốc chưa tới có at null), không dựng thành phần. Phần vẽ chỉ được axe chạm tới qua kit-docs.test.tsx trên trang này.',
      }}
    />
  )
}
