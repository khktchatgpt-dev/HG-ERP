'use client'

import { Field, FieldGrid, FieldGroup } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — lưới nhãn–giá trị (B7, 24/09/2026).
 *
 * Mọi ví dụ bọc trong `k-cq`: `FieldGrid` chia cột theo CONTAINER QUERY, và
 * khung demo của `CompDoc` không phải container. Không bọc thì ví dụ rơi về một
 * cột — đúng cái lỗi mục 6 nhắc người dùng tránh.
 *
 * B7 ghi tên nhóm của `FieldGroup` là `<h4>` cố định cấp, nên ví dụ phải chèn
 * một `<h3>` giả phía trên. B7½ (24/09/2026) thêm prop `level` (mặc định 4);
 * ví dụ nay truyền `level={3}` thay cho thẻ chèn.
 */
export default function DocFieldGrid() {
  return (
    <CompDoc
      family="field-grid"
      summary={
        <>
          Lưới nhãn–giá trị của đầu chứng từ và hồ sơ: nhãn rộng cố định, giá trị luôn bắt
          đầu ở cùng một cột, nên mắt quét dọc được thay vì đọc từng dòng. Dựng trên{' '}
          <code>&lt;dl&gt;</code>; <code>FieldGroup</code> là cùng lưới đó có đặt tên
          nhóm.
        </>
      }
      useWhen={
        <>
          người dùng ĐỌC (hoặc sửa từng ô) một tờ: đầu đơn mua, hồ sơ nhà cung cấp, chi
          tiết một dòng — Khuôn D và E.
        </>
      }
      avoidWhen={
        <>
          người dùng đang GÕ nhiều dòng (Khuôn F) — đầu đơn co thành{' '}
          <code>HeadChips</code>; và dữ kiện phụ ở cột phải — dùng <code>FactKv</code>.
        </>
      }
      variants={[
        {
          name: 'FieldGrid trong khung có container',
          when: 'đầu chứng từ trong FastTab. Ô nền nhạt là giá trị kế thừa từ hồ sơ NCC; note nói điều đó ra.',
          demo: (
            <div className="k-cq">
              <FieldGrid
                note={
                  <>
                    Ô nền nhạt là <b>giá trị kế thừa từ hồ sơ nhà cung cấp</b> — sửa ở đây
                    chỉ đổi cho đơn này.
                  </>
                }
              >
                <Field label="Nhà cung cấp">Cơ khí Thành Đạt</Field>
                <Field label="Mã NCC">
                  <span className="num">NCC-0043</span>
                </Field>
                <Field label="Hạn giao" tone="stop">
                  <span className="num">12/09/2026</span> · quá hạn 2 ngày
                </Field>
                <Field label="Điều khoản TT" inherited>
                  30 ngày kể từ ngày nhận đủ
                </Field>
                <Field label="Tiền tệ" inherited>
                  <span className="num">VND</span>
                </Field>
                <Field label="Lệnh sản xuất">
                  <span className="num">06/26-27 - MX</span>
                </Field>
              </FieldGrid>
            </div>
          ),
        },
        {
          name: 'FieldGroup — nhóm có tên',
          when: 'đầu đơn nhiều trường, mỗi nhóm ≤ 8 trường. Ví dụ nằm ngay dưới tiêu đề h2 của mục nên truyền level={3} — tên nhóm thành h3, cây tiêu đề không nhảy bậc.',
          demo: (
            <div className="k-cq">
              <FieldGroup title="Giao hàng" level={3}>
                <Field label="Hạn giao">
                  <span className="num">18/09/2026</span>
                </Field>
                <Field label="Địa điểm">Xưởng Bình Dương</Field>
                <Field label="Cách giao">NCC giao tới xưởng</Field>
              </FieldGroup>
              <FieldGroup title="Giá &amp; thuế" level={3}>
                <Field label="Tiền tệ">
                  <span className="num">VND</span>
                </Field>
                <Field label="Thuế suất">
                  <span className="num">8%</span>
                </Field>
                <Field label="Tổng thanh toán">
                  <span className="num">48.600.000 ₫</span>
                </Field>
              </FieldGroup>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Nhãn chữ phụ cỡ nhỏ, giá trị đậm vừa. Nhãn chiếm 30% ô (tối thiểu 72px) và được xuống hai dòng.',
          behaves: 'Tĩnh. Chuỗi dài tự xuống dòng trong ô, không đẩy vỡ cột.',
        },
        {
          state: 'Theo bề rộng khung',
          looks:
            'Một cột dưới 580px, hai cột từ 580px, ba cột từ 840px — đo bề rộng CHA.',
          behaves:
            'FieldGrid cần cha là container (FastTab, FactBox, lớp k-cq); FieldGroup tự là container.',
        },
        {
          state: 'tone',
          looks: 'Chữ giá trị đổi màu stop / warn / done.',
          behaves: 'Chỉ đổi màu, không thêm chữ hay biểu tượng.',
        },
        {
          state: 'inherited',
          looks: 'Giá trị có nền nhạt và gạch chân chấm.',
          behaves: 'Chỉ là dấu hiệu nhìn — không khoá, không đổi hành vi sửa.',
        },
      ]}
      a11y={{
        role: 'dl / dt / dd (danh sách mô tả) · FieldGroup thêm thẻ tiêu đề cấp level (mặc định h4)',
        keys: [
          { key: '—', does: 'Lưới không nhận phím; ô nhập đặt bên trong mới nhận.' },
        ],
        reader: (
          <>
            Đọc thành danh sách mô tả: nhãn rồi giá trị, theo thứ tự trong mã. Tên nhóm
            của <code>FieldGroup</code> là thẻ tiêu đề nên nhảy tới được bằng phím tiêu
            đề; cấp thẻ theo prop <code>level</code> (mặc định 4, thêm 24/09/2026 ở B7½ —
            trước đó luôn là <code>&lt;h4&gt;</code>, đặt ngay dưới một{' '}
            <code>&lt;h2&gt;</code> là nhảy cấp, axe bắt bằng luật{' '}
            <code>heading-order</code>). <code>level</code> chỉ đổi thẻ, không đổi cỡ chữ.{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> <code>tone</code> và <code>inherited</code>{' '}
            chỉ là màu/nền nên trình đọc không biết ô nào quá hạn hay ô nào kế thừa — chữ
            giá trị phải tự nói (&quot;quá hạn 2 ngày&quot;), và <code>note</code> của
            lưới phải nói nghĩa của nền nhạt; và kit không tự biết tiêu đề gần nhất phía
            trên là cấp mấy — chỗ gọi phải tự truyền <code>level</code> cho đúng.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Đặt <code>FieldGrid</code> trong FastTab/FactBox, hoặc bọc một thẻ có lớp{' '}
              <code>k-cq</code> khi màn tự dựng khung.
            </>
          ),
          dont: 'Đặt thẳng vào màn — lưới rơi về một cột, nhãn dính mép trái, giá trị dạt mép phải.',
          source:
            'kit/erp.css, chú thích lớp k-cq — lộ ra 11/09/2026 khi dựng /design-lab/mau-odoo-chung-tu',
        },
        {
          do: 'Đặt tên nhóm bằng đúng chữ người dùng đi tìm: "Điều khoản — in lên phiếu gửi NCC".',
          dont: 'Để nhóm tên chung chung ("Giao hàng", "Thanh toán") khi người dùng đang tìm chữ "điều khoản".',
          source:
            'DonChungTuScreen.tsx, chú thích nhóm Điều khoản — chủ dự án báo 10/09/2026 không tìm ra chỗ ghi',
        },
        {
          do: 'Một ô chỉ sửa được ở MỘT chỗ; nhóm lúc sửa bỏ những ô đã nằm trên dải quyết định.',
          dont: 'Lặp cùng một ô ở hai nhóm — người dùng phải tự hỏi chỗ nào mới thật.',
          source: 'DonChungTuScreen.tsx, chú thích FieldGroup "Chung" khi đang sửa',
        },
        {
          do: (
            <>
              Truyền <code>level</code> theo tiêu đề gần nhất phía trên: dưới một{' '}
              <code>&lt;h2&gt;</code> thì <code>level={'{3}'}</code>.
            </>
          ),
          dont: 'Chèn một thẻ tiêu đề giả chỉ để lấp bậc, hay để mặc định h4 ngay dưới h2.',
          source:
            'chú thích FieldGroup trong kit/Erp.tsx (B7½, 24/09/2026) — axe heading-order bắt trên chính trang này',
        },
        {
          do: 'Chia thành nhóm có tên, ≤ 8 trường mỗi nhóm.',
          dont: 'Một khối 12 trường không tên — bức tường nhãn.',
          source: 'kit/erp.css mục 15, theo Dynamics FastTab General / Delivery / Price',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
