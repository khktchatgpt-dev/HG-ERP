'use client'

import { DocChain } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/** TRANG TÀI LIỆU — DocChain (B7, 24/09/2026). */
export default function DocDocChain() {
  return (
    <CompDoc
      family="doc-chain"
      summary={
        <>
          Chuỗi chứng từ cha → con, đi ngược về thứ đã sinh ra tờ đang xem: “mua cái này
          để làm gì, ai đòi?”. Mỗi mắt có link là thẻ <code>&lt;a&gt;</code> thật — người
          dùng ERP Ctrl+click mở hai chứng từ cạnh nhau để đối chiếu.
        </>
      }
      useWhen="một chứng từ sinh ra từ chứng từ khác (đơn khách → lệnh SX → đơn mua) và người đọc cần đi ngược về gốc."
      avoidWhen={
        <>
          cần liệt kê MỌI chứng từ liên quan kèm số đếm (dùng <code>SmartLinks</code>),
          hoặc chỉ để in một mã rời (dùng <code>Code</code>).
        </>
      }
      variants={[
        {
          name: 'Ba mắt, mắt cuối là tờ đang xem',
          when: 'mắt đang đứng để muted — không ai cần link tới chính trang mình đang ở.',
          demo: (
            <DocChain
              links={[
                { label: 'Đơn khách', code: 'ĐH-2608-31', href: '#' },
                { label: 'Lệnh SX', code: 'LSX 06/26-27', href: '#' },
                { label: 'Đơn mua', code: 'PO-2609-014', href: '#', muted: true },
              ]}
            />
          ),
        },
        {
          name: 'Chỉ đọc — người xem không mở được tờ cha',
          when: 'không truyền href: mắt thành khung nét đứt. Màn duyệt của Giám đốc bày mã đơn khách và lệnh mà không dẫn đi.',
          demo: (
            <DocChain
              links={[
                { label: 'Đơn hàng (gộp)', code: 'ĐH-2608-31, ĐH-2608-33' },
                { label: 'LSX', code: 'LSX 06/26-27' },
                { label: 'Đơn vật tư', code: 'PO-2609-014' },
              ]}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Mắt có link',
          looks:
            'Khung viền liền, nền thẻ; nhãn loại in hoa nhỏ, mã chữ đơn cách màu hành động.',
          behaves:
            'Thẻ <a href> thật: bấm, chuột giữa, Ctrl+click đều chạy. Rê chuột thì viền đổi màu hành động.',
        },
        {
          state: 'Mắt không link / muted',
          looks: 'Khung nét đứt, mã màu nhạt.',
          behaves: 'Không bấm được, không nhận tiêu điểm. muted thắng href.',
        },
      ]}
      a11y={{
        role: '(không có) · link cho mắt có href',
        keys: [
          { key: 'Tab', does: 'Đi qua các mắt có link, trái → phải.' },
          { key: 'Enter', does: 'Mở chứng từ của mắt đang có tiêu điểm.' },
        ],
        reader: (
          <>
            Tên mỗi link là nhãn + mã, ví dụ “Lệnh SX LSX 06/26-27”.{' '}
            <b>Ba chỗ chưa tốt, ghi thật:</b> chuỗi không có cấu trúc danh sách hay mốc{' '}
            <code>nav</code>, nên người nghe không biết đây là một chuỗi mấy mắt; dấu “›”
            giữa các mắt không được ẩn và bị đọc ra thành ký tự; mắt đang đứng không mang{' '}
            <code>aria-current</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Mỗi mắt là link thật tới ĐÚNG chứng từ đó, trong khu người dùng đang ở.',
          dont: 'Trỏ link về danh sách của khu cũ — vừa đá người dùng về vỏ cũ, vừa bắt họ tìm lại đúng lệnh.',
          source:
            'mua-hang/hop-thu/ViecScreen.tsx — chú thích “Ở LẠI TRONG KHU MỚI”: link từng trỏ /planning/lsx',
        },
        {
          do: 'Dùng href để Ctrl+click mở tab mới được.',
          dont: 'Gọi router.push trong onClick — mất chuột giữa, mất URL ở thanh trạng thái.',
          source: 'kit/Flow.tsx — chú thích DocChain',
        },
        {
          do: (
            <>
              Đặt chuỗi vào <code>chain</code> của <code>ScreenHeader</code>.
            </>
          ),
          dont: 'Tách thành một khối riêng chiếm thêm một hàng — chuỗi là DANH TÍNH của trang, không phải nội dung.',
          source: 'kit/Shell.tsx — chú thích ScreenHeader',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng. Chỉ được dựng gián tiếp khi kit-docs.test.tsx chạy axe trên trang này — chưa ca nào kiểm tên link hay việc muted thắng href.',
      }}
    />
  )
}
