'use client'

import { Btn, ToastProvider, useToast } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `ToastProvider` + `useToast` (B7, 24/09/2026).
 *
 * MỘT provider bọc cả trang, không mỗi ví dụ một cái: mỗi provider dựng một
 * khay (vùng `region` tên "Thông báo") — ba khay cùng tên trên một trang là
 * ba mốc trùng nhau cho trình đọc màn hình. Trong app thật khay đã gắn sẵn ở
 * `Providers.tsx`; trang sổ bọc thêm một cái chỉ để dựng được khi đứng riêng
 * (và trong test), nên toast của trang này bay ra khay riêng của nó.
 */

function BonSacThai() {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <Btn onClick={() => toast.success('Đã ghi phiếu PBS-0042', '12 dòng · Tổ Phôi')}>
        Thành công
      </Btn>
      <Btn
        onClick={() =>
          toast.error('Không lưu được phiếu', 'Sổ ngày 22/09 đã chốt — mở khoá ở Sổ ngày')
        }
      >
        Lỗi
      </Btn>
      <Btn onClick={() => toast.warning('Ghi dư 20 so với phần còn thiếu')}>Cảnh báo</Btn>
      <Btn onClick={() => toast.info('Đã chuyển sang lệnh 03/26-27 - MX')}>Thường</Btn>
    </div>
  )
}

function SauKhiLuu() {
  const toast = useToast()
  return (
    <Btn
      primary
      icon="luuNhap"
      onClick={() =>
        toast.success('Đã lưu nháp PO-2609-104', 'CƠ KHÍ THÀNH ĐẠT · 6 dòng')
      }
    >
      Lưu nháp
    </Btn>
  )
}

function DungLau() {
  const toast = useToast()
  return (
    <Btn
      onClick={() =>
        toast.show({
          tone: 'warning',
          title: 'Đơn PO-2608-097 đang được Trần Minh sửa',
          description: 'Lưu bây giờ sẽ ghi đè thay đổi của người đó. Tải lại trước khi sửa tiếp.', // prettier-ignore
          ttl: 10000,
        })
      }
    >
      Báo xung đột (10 giây)
    </Btn>
  )
}

export default function DocToast() {
  return (
    <ToastProvider>
      <CompDoc
        family="toast"
        alsoImport={['useToast']}
        summary={
          <>
            Thông báo bay ở góc dưới phải, báo KẾT QUẢ của việc vừa bấm rồi tự tắt. Đứng
            trên Radix Toast. App gắn <code>ToastProvider</code> một lần ở gốc; màn nghiệp
            vụ chỉ gọi <code>useToast()</code> — cùng API với <code>ui/Toast</code> cũ:{' '}
            <code>success / error / warning / info / show</code>.
          </>
        }
        useWhen={
          <>
            báo một thao tác vừa xong hay vừa hỏng (lưu, ghi sổ, gửi) — người dùng đã thấy
            màn đổi, toast chỉ xác nhận.
          </>
        }
        avoidWhen={
          <>
            tin cả màn phải biết và còn đúng chừng nào chưa gỡ (sổ đã chốt, 66 đơn đứng
            yên) — dùng <code>NoticeBar</code>; lỗi của một ô nhập — nói tại ô; câu phải
            trả lời — dùng <code>Sheet</code>. Toast tự biến mất, nên đừng giao cho nó thứ
            người dùng cần đọc lại.
          </>
        }
        variants={[
          {
            name: 'Bốn sắc thái',
            when: 'vạch màu bên trái theo token vòng đời; tin thường dùng mực xám, không dùng màu hành động.',
            demo: <BonSacThai />,
          },
          {
            name: 'Sau một mutation',
            when: 'try → router.refresh() → toast. Tiêu đề nêu MÃ chứng từ, mô tả nêu thứ vừa đổi.',
            demo: <SauKhiLuu />,
          },
          {
            name: 'show() với thời gian riêng',
            when: 'câu dài cần đọc hết — ttl tính bằng mili-giây. Mặc định: lỗi 6 giây, còn lại 4 giây.',
            demo: <DungLau />,
          },
        ]}
        states={[
          {
            state: 'Khay rỗng',
            looks: 'Không thấy gì — khay là một danh sách trống, vẫn có trong DOM.',
            behaves: 'Vùng region “Thông báo (F8)” chờ sẵn cho phím F8.',
          },
          {
            state: 'Đang hiện',
            looks:
              'Thẻ nền trắng, vạch màu 3px bên trái, icon theo sắc thái, nút ✕. Xếp chồng từ dưới lên; nổi trên cả hộp thoại (z-toast).',
            behaves:
              'Tự tắt sau ttl. Thành công / thường đọc lịch sự (polite); lỗi / cảnh báo ngắt lời (assertive).',
          },
          {
            state: 'Tạm dừng',
            looks: 'Không đổi hình.',
            behaves:
              'Đồng hồ dừng khi rê chuột, khi tiêu điểm ở trong khay, và khi cửa sổ mất tiêu điểm.',
          },
          {
            state: 'Đóng',
            looks: 'Thẻ trượt đi.',
            behaves: 'Bấm ✕, Esc khi đang ở trong toast, vuốt sang phải, hoặc hết ttl.',
          },
        ]}
        a11y={{
          role: 'region (khay) · status (từng toast)',
          keys: [
            { key: 'F8', does: 'Nhảy thẳng vào khay thông báo từ bất cứ đâu.' },
            { key: 'Tab', does: 'Đi giữa các toast và nút ✕ “Đóng thông báo”.' },
            { key: 'Esc', does: 'Đóng toast đang có tiêu điểm.' },
          ],
          reader: (
            <>
              Radix đọc toast qua một vùng <code>aria-live</code> riêng: thành công và tin
              thường là <code>polite</code> (đợi người dùng nói xong), lỗi và cảnh báo là{' '}
              <code>assertive</code>. Khay tên “Thông báo (F8)”. <b>Chỗ yếu, ghi thật:</b>{' '}
              toast chưa có nút hành động (vd. “Hoàn tác”) — API chỉ nhận chữ; và tin tự
              tắt nên người đọc chậm vẫn có thể lỡ nếu không rê chuột / F8 vào kịp.
            </>
          ),
        }}
        doDont={[
          {
            do: 'Chỉ lỗi và cảnh báo được ngắt lời trình đọc màn hình.',
            dont: (
              <>
                Mọi toast đều <code>role=&quot;alert&quot;</code> — ngắt lời người dùng kể
                cả khi chỉ báo “đã lưu” (WCAG 4.1.3).
              </>
            ),
            source:
              'ui/Toast cũ — chú thích đầu kit/Toast.tsx; docs/he-thiet-ke-erp-ke-hoach.md §9.3',
          },
          {
            do: 'Đặt tên khay bằng tiếng Việt.',
            dont: 'Để mặc định của Radix — người dùng trình đọc nghe “Notifications F8”.',
            source:
              'test bắt lần chạy đầu 24/09/2026 — docs/he-thiet-ke-erp-ke-hoach.md §9.3',
          },
          {
            do: (
              <>
                Màn dựng bằng kit gọi <code>useToast</code> từ{' '}
                <code>@/components/kit</code>.
              </>
            ),
            dont: (
              <>
                Mượn <code>@/components/ui/Toast</code> của hệ cũ — trộn hai hệ trong một
                file, hai bộ token đánh nhau.
              </>
            ),
            source: '16 màn kit mượn ui/Toast trước B2 — CLAUDE.md “chỉ dùng một hệ”',
          },
          {
            do: 'Tin thường dùng mực xám.',
            dont: (
              <>
                Tô tin thường bằng <code>--act</code> — màu đó chỉ còn nghĩa “bấm được”.
              </>
            ),
            source: 'bảng lỗi bản cũ — docs/he-thiet-ke-erp-ke-hoach.md §9.3',
          },
        ]}
        tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
      />
    </ToastProvider>
  )
}
