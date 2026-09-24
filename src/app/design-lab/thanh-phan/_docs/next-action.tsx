'use client'

import { Btn, NextAction } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — NextAction (B7, 24/09/2026).
 *
 * Số ngày trong các ví dụ là số CỐ ĐỊNH — đúng cách màn thật phải làm: tính
 * bằng `daysHeld()` ở tầng gọi rồi truyền `days`, không để kit đọc đồng hồ.
 */
export default function DocNextAction() {
  return (
    <CompDoc
      family="next-action"
      summary={
        <>
          Khung “ai đang giữ bóng, việc tiếp theo là gì, nằm đây bao lâu” — đặt ở đầu
          chứng từ, <b>trước</b> mọi bảng số. Hai trạng thái tách bạch: đến lượt tôi (màu
          hành động, có nút) và đang ở người khác (nói tên người đó, không nút).
        </>
      }
      useWhen="đầu một chứng từ đi qua nhiều tay (đơn mua: Cung ứng → Giám đốc → NCC → Kho), hoặc trong khay kiểm tra của hộp thư."
      avoidWhen={
        <>
          chứng từ đã xong hoặc đã huỷ — không còn ai giữ bóng; khi đó để{' '}
          <code>Timeline</code> kể chuyện. Màn chứng từ khuôn D dựng bằng{' '}
          <code>DocScreen</code> thì dùng <code>HolderBar</code> cho cùng việc này.
        </>
      }
      variants={[
        {
          name: 'Đến lượt bạn',
          when: 'mine = true: khung màu hành động, không hiện người giữ, nút đi kèm.',
          demo: (
            <NextAction
              mine
              holder="Cung ứng"
              what="Nhập đơn giá dòng NK-0056 rồi gửi Giám đốc duyệt"
              days={0}
              hint="Đơn trên 100 triệu — Giám đốc duyệt hạn mức trước khi gửi NCC."
              actions={
                <Btn primary icon="duyet">
                  Gửi duyệt
                </Btn>
              }
            />
          ),
        },
        {
          name: 'Đang ở người khác — chưa lâu',
          when: 'dưới 3 ngày: khung trung tính, nhãn tên người giữ.',
          demo: (
            <NextAction
              mine={false}
              holder="Cơ khí Thành Đạt"
              what="Chờ NCC xác nhận đơn và hẹn ngày giao"
              days={1}
            />
          ),
        },
        {
          name: 'Nằm im từ 3 ngày',
          when: 'từ ngày thứ ba khung chuyển màu cảnh báo, số ngày in đậm.',
          demo: (
            <NextAction
              mine={false}
              holder="Giám đốc"
              what="Duyệt hoặc từ chối đơn 131.400.000 ₫"
              days={5}
              hint="Nằm ở bước này 5 ngày. Người giữ có thể không biết là mình đang giữ."
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Đến lượt bạn (mine)',
          looks: 'Viền + nền nhạt màu hành động, nhãn “ĐẾN LƯỢT BẠN”.',
          behaves:
            'Không vẽ holder. Nếu days ≥ 3 thì chữ số ngày đổi màu cảnh báo, nhưng khung vẫn giữ màu hành động.',
        },
        {
          state: 'Đang chờ, dưới 3 ngày',
          looks:
            'Viền mảnh, nền nhạt trung tính; nhãn “ĐANG CHỜ” + Tag trung tính tên người giữ.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'Đang chờ, từ 3 ngày',
          looks:
            'Viền + nền màu cảnh báo, Tag cảnh báo, “đã N ngày” in đậm màu cảnh báo.',
          behaves: 'Ngưỡng 3 ngày cứng trong kit, trùng isStale() của flow-core.',
        },
        {
          state: 'Số ngày',
          looks:
            'days = 0 → “từ hôm nay”; days = N → “đã N ngày”; không truyền / null → không hiện gì.',
          behaves:
            'Kit không tự tính — không có prop nào nhận ngày bắt đầu; nơi gọi truyền days đã tính sẵn.',
        },
      ]}
      a11y={{
        role: '(không có — khối văn bản thường)',
        keys: [{ key: 'Tab', does: 'Chỉ tới các nút trong actions.' }],
        reader: (
          <>
            Đọc theo thứ tự: “Đến lượt bạn” hoặc “Đang chờ” + tên người giữ + số ngày, rồi
            việc, rồi lưu ý, rồi nút. <b>Chỗ chưa tốt, ghi thật:</b> nhãn đầu khung là{' '}
            <code>&lt;span&gt;</code> chứ không phải tiêu đề, nên không nhảy tới được; và
            mức “nằm lâu” chỉ nói bằng màu — người nghe chỉ nhận được con số ngày, không
            nhận được lời cảnh báo.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Nói TÊN người/bộ phận đang giữ và giữ bao lâu.',
          dont: '“Đang chờ duyệt” — chờ AI, từ bao giờ, tôi làm gì được thì không nói.',
          source:
            'docs/tieu-chi-workflow-erp.md §2.3 — trả lời trong 2 giây “ai đang giữ, giữ bao lâu”',
        },
        {
          do: (
            <>
              Tính <code>days</code> ở tầng gọi bằng <code>daysHeld(since, now)</code>.
            </>
          ),
          dont: (
            <>
              Đọc đồng hồ trong lúc render, hay mong kit tự đếm từ một ngày bắt đầu. Prop{' '}
              <code>since</code> từng được khai mà kit không đọc — khung không hiện số
              ngày nào; đã gỡ hẳn 24/09/2026 (B7½), truyền vào là lỗi kiểu.
            </>
          ),
          source:
            'đọc mã 24/09/2026: kit/Flow.tsx, NextAction không lấy since ra khỏi props — gỡ ở B7½',
        },
        {
          do: 'Chỉ báo khi nằm im từ ngày thứ ba.',
          dont: 'Tô cảnh báo ngay khi vừa gửi — qua cuối tuần là bình thường, báo sớm thì hết là tín hiệu.',
          source:
            'kit/flow-core.ts isStale(); docs/thiet-ke-huong-erp.md lỗ hổng 4 — 66/68 đơn nằm im 5–7 ngày mà không ai biết',
        },
      ]}
      tested={{
        missing:
          'flow-core.test.ts kiểm hàm thuần poHolder / daysHeld / isStale (ai giữ, đếm ngày, ngưỡng 3), không dựng thành phần; shell-flow.a11y.test.tsx chỉ canh bảng thuộc tính không còn since. Phần vẽ chỉ được axe chạm tới qua kit-docs.test.tsx trên trang này.',
      }}
    />
  )
}
