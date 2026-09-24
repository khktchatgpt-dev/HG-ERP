'use client'

import { Metric, MetricStrip } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — dải hiệu suất (B7, 24/09/2026).
 *
 * Ví dụ một chép dải của màn mẫu hồ sơ NCC (Khuôn E), kể cả ô "chưa đo được";
 * ví dụ hai chép nhãn và dạng mẫu số của dải trên màn chứng từ lệnh sản xuất
 * (`LsxDocScreen`), số liệu là số giả.
 */
export default function DocMetricStrip() {
  return (
    <CompDoc
      family="metric-strip"
      summary={
        <>
          Dải ô đo ở đầu hồ sơ: nói <b>làm ăn ra sao</b>, không nói &quot;đang ở bước
          nào&quot;. Mỗi <code>Metric</code> <b>bắt buộc</b> có <code>basis</code> — mẫu
          số của chính nó — ở tầng kiểu; và <code>value = null</code> hiện &quot;chưa đo
          được&quot;, không bao giờ hiện 0.
        </>
      }
      useWhen={
        <>
          hồ sơ danh mục (Khuôn E: nhà cung cấp, vật tư, khuôn) cần vài con số hiệu suất;
          hoặc tiến độ đếm được của một lệnh, khi mỗi số có mẫu số rõ.
        </>
      }
      avoidWhen={
        <>
          chứng từ có vòng đời duyệt — dùng <code>StatusTrack</code>; và số không có mẫu
          số tự nhiên (tổng tiền một đơn) — để trong <code>FactKv</code>.
        </>
      }
      variants={[
        {
          name: 'Hồ sơ nhà cung cấp — kèm ô chưa đo được',
          when: 'Khuôn E. Điểm chất lượng là số chấm tay, NCC này chưa ai chấm — hiện 0 là vu cho họ điểm kém.',
          demo: (
            <MetricStrip>
              <Metric
                label="Giao đúng hẹn"
                value="89%"
                basis="8 / 9 đơn có hẹn ngày"
                tone="done"
              />
              <Metric
                label="Trễ trung bình"
                value="1,2 ngày"
                basis="tính trên 9 đơn đã nhận"
              />
              <Metric
                label="Chốt thiếu"
                value="4 dòng"
                basis="trên 138 dòng đã đóng"
                tone="warn"
              />
              <Metric
                label="Điểm chất lượng"
                value={null}
                basis="chưa ai chấm — 1/154 NCC có"
              />
            </MetricStrip>
          ),
        },
        {
          name: 'Tiến độ lệnh sản xuất',
          when: 'mẫu số là tổng của lệnh, viết "/ 120 bộ đặt" ngay dưới số.',
          demo: (
            <MetricStrip>
              <Metric label="Bộ đã xong" value="84" basis="/ 120 bộ đặt" />
              <Metric label="Việc còn" value="7" basis="/ 36 việc" tone="warn" />
              <Metric label="Phế luỹ kế" value="12" basis="trên 18 phiếu" />
            </MetricStrip>
          ),
        },
      ]}
      states={[
        {
          state: 'Có số',
          looks:
            'Nhãn chữ hoa nhỏ; con số mono lớn đậm; mẫu số chữ nhỏ ngay dưới. Ô tối thiểu 148px, tự xếp hàng.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'tone',
          looks: 'Chỉ CON SỐ đổi màu done / warn / stop.',
          behaves: 'Chỉ đổi màu.',
        },
        {
          state: 'Chưa đo được (value = null)',
          looks: 'Chữ "chưa đo được", màu --ink-empty, nét vừa.',
          behaves: 'Bỏ qua tone — ô chưa đo không được mang màu đánh giá.',
        },
        {
          state: 'Hàng thiếu ô',
          looks: 'Vạch ngăn chỉ mọc ở ô có thật; chỗ trống giữ nền thẻ.',
          behaves: 'Vạch vẽ bằng bóng đổ, không bằng nền container.',
        },
      ]}
      a11y={{
        role: '(không có — các div chữ thường)',
        keys: [{ key: '—', does: 'Không nhận tiêu điểm, không nhận phím.' }],
        reader: (
          <>
            Đọc theo thứ tự trong mã: nhãn, số, mẫu số — &quot;Giao đúng hẹn 89% 8 / 9 đơn
            có hẹn ngày&quot;. <b>Hai chỗ chưa tốt, ghi thật:</b> ba phần là ba{' '}
            <code>&lt;div&gt;</code> rời, không có cấu trúc nhãn–giá trị (không phải{' '}
            <code>dl</code>), nên người nghe tự đoán đâu là số; <code>tone</code> chỉ là
            màu — ô &quot;xấu&quot; và ô &quot;tốt&quot; nghe y hệt nhau.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Ghi mẫu số cụ thể: "8 / 9 đơn có hẹn ngày".',
          dont: 'Ghi "89%" trơn — 89% của 9 đơn và của 900 đơn là hai mức tin cậy khác hẳn nhau.',
          source: 'Erp.tsx, docstring Metric; CLAUDE.md nguyên tắc 6 và khuôn E',
        },
        {
          do: (
            <>
              Truyền <code>value={'{null}'}</code> khi chưa đủ dữ liệu để tính.
            </>
          ),
          dont: 'Hiện 0% — đọc thành "làm ăn tệ" trong khi sự thật là "chưa có gì để chấm".',
          source:
            'Erp.tsx, docstring Metric; mau-ho-so-ncc: điểm chất lượng chỉ 1/154 NCC có',
        },
        {
          do: 'Để dải tự xếp hàng; hàng thiếu ô vẫn giữ nền thẻ.',
          dont: 'Vẽ vạch ngăn bằng gap 1px + nền container.',
          source:
            'kit/erp.css mục 12 — đo 23/09/2026 ở màn chi tiết lệnh: 5 ô lộ ~37.000px² nền xám như màn hỏng',
        },
        {
          do: 'Dùng MetricStrip cho hồ sơ danh mục.',
          dont: 'Bịa một vòng đời duyệt cho hồ sơ để dùng StatusTrack — người dùng đi tìm nút "gửi duyệt" trên thứ không ai duyệt.',
          source: 'CLAUDE.md, "Đừng nhầm D với E"; Erp.tsx chú thích mục 13',
        },
      ]}
      tested={{
        missing:
          'chưa có test riêng (kể cả nhánh value = null); lớp axe duy nhất là kit-docs.test.tsx chạy trên chính các ví dụ của trang này.',
      }}
    />
  )
}
