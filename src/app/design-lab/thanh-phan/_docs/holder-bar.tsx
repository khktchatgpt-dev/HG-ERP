'use client'

import { HolderBar } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `HolderBar` — dải "ai đang giữ" (B7, 24/09/2026).
 *
 * Nhỏ nhất trong khung chứng từ mà trả lời câu hỏi bị bỏ sót nhiều nhất: tờ
 * này đang chờ MÌNH hay chờ người khác. B7 ghi số ngày LUÔN đỏ, kể cả "1 ngày",
 * và dải không phải vùng status. B7½ (24/09/2026) thêm ngưỡng `HOLD_AGE_DAYS`
 * (dưới 3 · 3–6 · từ 7) và `role="status"`, kèm luật màu `.k-hold-age-warn` /
 * `-stop` trong erp.css — dưới ngưỡng thì số mang mực chữ, không tô.
 */
export default function DocHolderBar() {
  return (
    <CompDoc
      family="holder-bar"
      summary={
        <>
          Một dải nói chứng từ <b>đang chờ ai</b>, <b>làm gì</b>, và <b>bao lâu rồi</b> ở
          bước hiện tại. Khi người đang xem chính là người giữ, dải đổi giọng: “Đang chờ
          bạn”.
        </>
      }
      useWhen="chứng từ đang nằm trong tay một người cụ thể (soạn, duyệt, xác nhận) — đặt ngay dưới DocHead, trên bảng kiểm."
      avoidWhen={
        <>
          chứng từ đã khép (đã về đủ, đã huỷ) — không ai giữ thì đừng bịa người giữ; và
          danh sách việc chờ của nhiều tờ là việc của Hộp thư (Khuôn B), không phải nhiều
          dải <code>HolderBar</code> xếp chồng.
        </>
      }
      variants={[
        {
          name: 'Chờ người khác',
          when: 'người xem không phải người giữ — nền vàng nhạt, “Đang chờ”. 3 ngày = đúng ngưỡng “nằm im” (warn).',
          demo: (
            <HolderBar
              who="Giám đốc — Lê Văn D"
              what="Duyệt đơn trước khi gửi nhà cung cấp"
              age="3 ngày"
            />
          ),
        },
        {
          name: 'Chờ chính bạn (mine)',
          when: 'người đang xem là người giữ — đổi sang ngôi thứ hai, nền nhạt màu hành động. 8 ngày = quá ngưỡng “kẹt” (stop).',
          demo: (
            <HolderBar
              mine
              who="Cung ứng — Nguyễn Văn A"
              what="Soạn xong thì gửi Giám đốc duyệt"
              age="8 ngày"
            />
          ),
        },
        {
          name: 'Viên gọn (inline), vừa chuyển bước',
          when: 'đặt cuối hàng nút thông minh (SmartLinks trailing) để tiết kiệm một hàng. Bỏ age khi vừa chuyển bước.',
          demo: (
            <div className="flex">
              <HolderBar
                inline
                who="Kho — Trần Thị B"
                what="Nhận hàng đợt 2 · 40 cây ống 25×40"
              />
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định (chờ người khác)',
          looks:
            'Dải trọn bề ngang nền --warn nhạt; chữ “ĐANG CHỜ” in hoa màu --warn; tên đậm; việc chữ phụ.',
          behaves:
            'Không nhận focus. Là vùng role="status": đổi người giữ ngay trên màn thì trình đọc báo.',
        },
        {
          state: 'Của tôi (mine)',
          looks: 'Nền nhạt màu hành động; nhãn đổi thành “ĐANG CHỜ BẠN”.',
          behaves: 'Chỉ đổi chữ và màu — không thêm nút; việc cần làm nằm ở ActionPane.',
        },
        {
          state: 'Có số ngày (age)',
          looks:
            'Số đậm, dạt về mép phải (dạng viên: đứng sát sau việc). Dưới 3 ngày: mực chữ phụ (--ink-2), không tô; 3–6 ngày: --warn; từ 7 ngày: --stop. Trước 24/09/2026 mọi tuổi đều đỏ, kể cả “1 ngày”.',
          behaves:
            'Kit đọc số đứng trước chữ “ngày” và gắn lớp theo HOLD_AGE_DAYS (B7½, 24/09/2026): dưới 3 ngày không lớp nào, 3–6 ngày k-hold-age-warn, từ 7 ngày k-hold-age-stop; chữ không có “N ngày” (“từ hôm nay”) không lớp nào. Lớp đúng có test (erp.a11y.test.tsx); màu theo lớp nằm ở erp.css — happy-dom không dựng CSS nên phần màu kiểm bằng trình duyệt.',
        },
        {
          state: 'Viên gọn (inline)',
          looks:
            'Viên viền --warn (của tôi: viền --act), co giãn lấp phần còn lại của hàng.',
          behaves: 'Rớt xuống hàng riêng thì thành một dải trọn hàng.',
        },
      ]}
      a11y={{
        role: 'status (div role="status")',
        keys: [{ key: '—', does: 'Không nhận phím.' }],
        reader: (
          <>
            Đọc liền một câu theo thứ tự: “Đang chờ bạn, Cung ứng — Nguyễn Văn A, Soạn
            xong thì gửi Giám đốc duyệt, 8 ngày”. Dải là{' '}
            <code>role=&quot;status&quot;</code> (sửa 24/09/2026, B7½; test ở{' '}
            <code>erp.a11y.test.tsx</code>): khi chứng từ chuyển bước ngay trên màn (bấm
            Gửi duyệt), trình đọc báo người giữ mới mà người nghe không phải dò lại; dải
            chỉ một câu ngắn nên đọc trọn cả dải không thành tràng dài.{' '}
            <b>Chưa tốt, ghi thật:</b> mức tuổi (warn / stop) chỉ là lớp màu, không tới
            được trình đọc — chữ <code>age</code> phải tự nói đủ (“đã 5 ngày · nằm im”);
            và vì mỗi <code>HolderBar</code> là một vùng status, trang có nhiều dải (như
            trang này) sẽ có nhiều vùng cùng lúc.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>age</code> là số ngày ở BƯỚC HIỆN TẠI.
            </>
          ),
          dont: 'Dùng tuổi của chứng từ — “chờ duyệt 1 tiếng” và “chờ duyệt 9 ngày” là hai chuyện khác hẳn.',
          source: 'chú thích mục 4 trong kit/Erp.tsx',
        },
        {
          do: 'Luôn bày người giữ trên chứng từ còn mở.',
          dont: 'Để người dùng tự đoán tờ này đang chờ mình hay chờ ai.',
          source:
            'chú thích mục 4 trong kit/Erp.tsx — nguyên nhân đo được của 65 đơn nằm nháp trung bình 6,5 ngày; CLAUDE.md nguyên tắc 2',
        },
        {
          do: (
            <>
              <code>who</code> là tên người thật kèm phòng.
            </>
          ),
          dont: 'Ghi vai trò chung (“Cung ứng”) — không ai thấy mình là người phải làm.',
          source:
            'JSDoc prop who, kit/Erp.tsx; docs/thiet-ke-huong-erp.md (không ai biết đơn đang kẹt)',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
