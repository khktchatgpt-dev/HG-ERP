'use client'

import { Loading } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

export default function DocLoading() {
  return (
    <CompDoc
      family="loading"
      summary={
        <>
          Khung xương đang tải: các dòng xám nhấp nháy, mỗi dòng cao đúng một dòng bảng.
          Giữ CHỖ cho nội dung sắp hiện, để trang không nhảy khi dữ liệu về.
        </>
      }
      useWhen="một bảng hay danh sách đang chờ dữ liệu về lần đầu — đặt đúng vào vùng bảng thật sẽ chiếm."
      avoidWhen={
        <>
          vùng đã tải xong mà không có gì (dùng <code>Empty</code>), một thao tác đang
          chạy trên nút (dùng <code>Btn busy</code>), hay kết quả tra trong ô tìm (
          <code>Combobox</code> đã có dấu chờ riêng).
        </>
      }
      variants={[
        {
          name: 'Bảng ngắn — rows bằng số dòng thật',
          when: 'biết trước bảng có khoảng 3 dòng (các đợt giao của một đơn).',
          demo: <Loading rows={3} />,
        },
        {
          name: 'Mặc định — 6 dòng',
          when: 'chưa biết số dòng. Với danh sách phân trang thì đặt bằng cỡ trang.',
          demo: <Loading />,
        },
      ]}
      states={[
        {
          state: 'Đang chạy',
          looks:
            'Mỗi dòng ba vạch xám (ngắn · dãn · ngắn) ngăn nhau bằng vạch tóc, cả khối nhấp nháy nhẹ. Bật “giảm chuyển động” thì khung đứng yên.',
          behaves:
            'Tĩnh, không nhận focus. Nhấp nháy chỉ chạy dưới motion-safe: — lớp pulse của Tailwind mang thời lượng riêng, token thời lượng của kit không phủ tới, nên phải chặn ngay ở lớp (sửa 24/09/2026, B7½; trước đó vẫn nháy khi đã bật giảm chuyển động).',
        },
      ]}
      a11y={{
        role: 'status',
        keys: [{ key: '—', does: 'Không nhận phím.' }],
        reader: (
          <>
            Vỏ là <code>role=&quot;status&quot;</code> mang câu ẩn “Đang tải…”; khung
            xương là hình cho mắt nên <code>aria-hidden</code> (sửa 24/09/2026, B7½ —
            trước đó khối không chữ, không vai trò, người không nhìn màn hình chỉ gặp bảng
            khi nó đã về). <b>Ghi thật:</b> vùng status XUẤT HIỆN cùng lúc với câu của nó
            thì không phải trình đọc nào cũng đọc (NVDA thường đọc, VoiceOver có khi
            không) — muốn chắc thì vùng chứa đặt thêm <code>aria-busy</code> trong lúc
            chờ. Và không có câu báo “đã tải xong”.
          </>
        ),
      }}
      doDont={[
        {
          do: 'rows bằng số dòng bảng thật sắp hiện.',
          dont: 'Ba dòng xương cho một bảng 20 dòng — trang nhảy giật khi dữ liệu về, người đang định bấm sẽ bấm nhầm.',
          source: 'JSDoc của Loading (kit/Primitives.tsx)',
        },
        {
          do: 'Khung chờ bắt chước ĐÚNG hình dạng màn: đầu trang, thanh lọc, rồi lưới.',
          dont: 'Để màn cũ đứng im rồi nội dung mới đột ngột thay chỗ — không có gì nói “đang đi”.',
          source: 'src/app/(mua-hang)/loading.tsx, đợt 14/09/2026',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
