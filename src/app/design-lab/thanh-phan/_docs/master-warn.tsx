'use client'

import { MasterWarn } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — dải cảnh báo "bản ghi gốc" (B7, 24/09/2026).
 *
 * Ví dụ hai chép đúng ca của màn khuôn nhôm (`KhuonDetailScreen`) khi chưa hồ
 * sơ nào trỏ vào: câu cố định của kit vẫn nói "Đang dùng ở:" — bày ra để người
 * dựng màn thấy câu ghép đọc ra sao trước khi chọn chữ cho `used`.
 */
export default function DocMasterWarn() {
  return (
    <CompDoc
      family="master-warn"
      summary={
        <>
          Dải cảnh báo đầu hồ sơ danh mục: &quot;đây là <b>bản ghi gốc</b>&quot;. Sửa một
          dòng trên chứng từ chỉ đổi tờ đó; sửa hồ sơ đổi cho mọi chứng từ lập về sau.
          Prop duy nhất <code>used</code> nói bản ghi đang được dùng ở đâu, để người sửa
          ước được sức công phá <b>trước</b> khi gõ.
        </>
      }
      useWhen="màn hồ sơ danh mục (Khuôn E) — nhà cung cấp, vật tư, khuôn — mở ở chế độ sửa được, đặt ngay dưới đầu trang."
      avoidWhen={
        <>
          chứng từ (Khuôn D) — sửa chỉ đổi tờ đó; và cảnh báo lỗi hay chặn lưu — dùng{' '}
          <code>NoticeBar</code> hoặc <code>CommitBar</code>.
        </>
      }
      variants={[
        {
          name: 'Hồ sơ nhà cung cấp',
          when: 'đếm cụ thể, phần nặng nhất in đậm: đơn đang mở là thứ bị ảnh hưởng ngay.',
          demo: (
            <MasterWarn
              used={
                <>
                  <b>2 đơn đang mở</b> · 14 mã vật tư đã mua · đơn gần nhất 02/09/2026
                </>
              }
            />
          ),
        },
        {
          name: 'Chưa ai dùng',
          when: 'hồ sơ khuôn chưa có sản phẩm nào trỏ vào. Câu cố định vẫn đứng trước — viết used sao cho câu ghép còn đọc được.',
          demo: <MasterWarn used="chưa hồ sơ sản phẩm nào trỏ vào mã khuôn này" />,
        },
      ]}
      states={[
        {
          state: 'Mặc định (duy nhất)',
          looks:
            'Dải nền cam nhạt (--warn-wash), vạch dưới cam; chữ "BẢN GHI GỐC" hoa nhỏ màu --warn, rồi câu cố định + used.',
          behaves: 'Tĩnh. Không đóng được, không có nút.',
        },
      ]}
      a11y={{
        role: '(không có — div chữ thường)',
        keys: [{ key: '—', does: 'Không nhận tiêu điểm, không nhận phím.' }],
        reader: (
          <>
            Đọc liền: &quot;Bản ghi gốc. Sửa ở đây đổi cho mọi chứng từ lập từ nay về sau,
            không đổi chứng từ đã lập. Đang dùng ở: …&quot;. Dải có mặt ngay khi vào màn
            nên không cần thông báo. <b>Chỗ chưa tốt, ghi thật:</b> không có vai trò{' '}
            <code>note</code> hay nhãn vùng, nên người nghe không nhảy tới được — chỉ gặp
            khi đọc tuần tự từ đầu trang.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Đếm cụ thể nơi đang dùng: "2 đơn đang mở · 14 mã vật tư".',
          dont: 'Viết chung chung "đang được sử dụng" — không ước được sức công phá.',
          source: 'Erp.tsx, docstring MasterWarn — used nói NƠI đang dùng',
        },
        {
          do: 'Đặt dải trên hồ sơ danh mục; chỗ của ba trục trạng thái ở đó là MetricStrip.',
          dont: 'Dùng khuôn chứng từ cho hồ sơ rồi bịa ra vòng đời duyệt.',
          source: 'CLAUDE.md, "Đừng nhầm D với E"',
        },
        {
          do: 'Báo ngay khi mở hồ sơ, lúc người dùng chưa gõ gì.',
          dont: 'Đợi bấm Lưu mới hỏi "việc này sẽ đổi 14 mã vật tư, chắc chưa?".',
          source:
            'Erp.tsx, docstring MasterWarn — "trước khi gõ, chứ không phải sau khi bấm Lưu"',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng; lớp axe duy nhất là kit-docs.test.tsx chạy trên chính các ví dụ của trang này.',
      }}
    />
  )
}
