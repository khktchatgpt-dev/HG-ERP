'use client'

import { Btn, Empty } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU MẪU — trang đầu tiên dựng bằng khuôn `CompDoc` (B0, 24/09/2026).
 *
 * Chọn `Empty` làm mẫu vì hai lẽ: nó ổn định (không bị đổi ruột ở B1–B5), và
 * triết lý của nó — `reason` + `next` bắt buộc ở tầng kiểu — chính là triết lý
 * của khuôn tài liệu này. Trang nào dựng sau thì chép cấu trúc trang này.
 *
 * Mục 5 và 6 ghi THẬT, kể cả chỗ chưa tốt. Bản B0 ghi hai chỗ yếu — tiêu đề là
 * `<div>`, khối không có vai trò `status` — và B7½ (24/09/2026) vá cả hai: chữ
 * nằm trong `role="status"`, `level` cho dòng đầu thành thẻ tiêu đề. Tài liệu
 * giấu chỗ yếu của thành phần là tài liệu người ta thôi tin.
 */
export default function DocEmpty() {
  return (
    <CompDoc
      family="empty"
      summary={
        <>
          Trạng thái rỗng. Ba thuộc tính đều <b>bắt buộc</b> ở tầng kiểu: một dòng nói
          chuyện gì, một câu nói vì sao, và việc làm tiếp. Không viết được một trạng thái
          rỗng kiểu “Không có dữ liệu”.
        </>
      }
      useWhen="một vùng dữ liệu (bảng, danh sách, khối) không có gì để bày — vì chưa phát sinh, vì lọc hẹp, hoặc vì điều kiện trước chưa đủ."
      avoidWhen={
        <>
          dữ liệu đang tải (dùng <code>Loading</code>), hoặc có lỗi hệ thống (dùng{' '}
          <code>NoticeBar</code> tone stop) — rỗng và hỏng là hai chuyện khác nhau.
        </>
      }
      variants={[
        {
          name: 'Chưa phát sinh',
          when: 'điều kiện trước chưa có — nói rõ điều kiện đó, và nút đi làm nó.',
          demo: (
            <Empty
              headline="Lệnh 05/26-27 - MX chưa có việc nào để ghi nhận"
              reason="Lệnh chưa định hình chi tiết — không có bảng chi tiết thì không biết phải ghi sản lượng cho cái gì."
              next={
                <Btn icon="dinhHinh" primary>
                  Định hình từ BOM
                </Btn>
              }
            />
          ),
        },
        {
          name: 'Lọc hẹp — và trống là TIN TỐT',
          when: 'bộ lọc làm bảng trống. Nói thẳng là trống ĐÚNG, rồi cho đường gỡ lọc.',
          demo: (
            <Empty
              headline="Không còn việc nào chưa xong"
              reason="Mọi công đoạn của lệnh đã đủ số. Bảng trống đúng, không phải hỏng."
              next={<Btn icon="boLoc">Xem cả việc đã xong</Btn>}
            />
          ),
        },
        {
          name: 'Đứng thay cả một vùng — level',
          when: 'khối rỗng thay chỗ cả một vùng nội dung (một tab, một khối lớn): truyền level để dòng đầu thành thẻ tiêu đề, trình đọc nhảy tới được. Chọn cấp theo dàn tiêu đề của màn — ở đây h3 vì nằm dưới một h2.',
          demo: (
            <Empty
              level={3}
              headline="Đơn chưa có đợt giao nào"
              reason="Nhà cung cấp chưa xác nhận ngày giao — đợt giao chỉ lập được sau khi có ngày."
              next={<Btn icon="them">Ghi ngày NCC xác nhận</Btn>}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Khối căn giữa, rộng tối đa 560px; tiêu đề đậm, lý do chữ phụ, nút ở dưới.',
          behaves:
            'Dòng đầu + lý do nằm trong vùng role="status": khối hiện ra (vd. lọc hết dòng) thì trình đọc được báo. Nút không nằm trong vùng đó.',
        },
        {
          state: 'Có level (2 | 3 | 4)',
          looks: 'Y hệt mặc định — cỡ chữ không đổi theo cấp.',
          behaves:
            'Dòng đầu là thẻ h2/h3/h4 thay cho div. Bỏ trống thì vẫn là div — không chen tiêu đề vào dàn tiêu đề của màn đang dùng.',
        },
      ]}
      a11y={{
        role: 'status (bọc dòng đầu + lý do) · heading khi có level',
        keys: [{ key: 'Tab', does: 'Đi tới các nút của thuộc tính next, theo thứ tự.' }],
        reader: (
          <>
            Đọc tiêu đề, lý do, rồi tên nút — theo thứ tự trong trang. Khối hiện ra sau
            khi trang đã dựng (bộ lọc làm bảng trống) thì trình đọc thông báo dòng đầu +
            lý do, không đọc lẫn nhãn nút. Có <code>level</code> thì nhảy tới được bằng
            phím tắt tiêu đề. Đã sửa 24/09/2026 (B7½): trước đó dòng đầu luôn là{' '}
            <code>&lt;div&gt;</code> và khối hiện ra trong im lặng — người không nhìn màn
            hình không biết bảng vừa trống.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Tách lý do theo NGUYÊN NHÂN: "đã xong hết" và "chưa định hình" là hai câu khác nhau.',
          dont: 'Một câu chung cho mọi kiểu trống.',
          source: 'màn chứng từ lệnh, đợt soi 23/09/2026',
        },
        {
          do: 'Khi trống là tin tốt thì nói ra: "Bảng trống đúng, không phải hỏng."',
          dont: 'Bày tin mừng bằng giọng một màn lỗi.',
          source: 'màn danh sách lệnh — chip lọc về 0',
        },
        {
          do: 'Kiểm xem trang đã chặn tình huống đó ở tầng server chưa, rồi mới thêm nhánh.',
          dont: 'Viết nhánh rỗng cho một tình huống không bao giờ tới được — mã chết mang chú thích tự tin.',
          source: 'nhánh rows.length === 0 bị gỡ 23/09 vì trang đã chặn từ tầng server',
        },
        {
          do: (
            <>
              Dùng <code>Empty</code> thay cho vùng dữ liệu rỗng.
            </>
          ),
          dont: 'Để bảng chỉ còn trơ hàng tiêu đề.',
          source: 'màn chứng từ lệnh (LsxDocScreen) trước 23/09/2026',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
