'use client'

import { Checks } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Checks` — bảng kiểm trước khi đi bước tiếp (B7, 24/09/2026).
 *
 * Luật kiểm của sổ thiết kế viết thành thành phần: "Hành động bị chặn phải nói
 * vướng gì VÀ cách gỡ, ngay tại chỗ." B7 ghi khối không có vai trò thông báo;
 * B7½ (24/09/2026) đặt dòng tóm tắt vào vùng status. Mục 5 ghi thật chỗ còn hở:
 * vùng đó sinh ra cùng lúc với khối.
 */
export default function DocChecks() {
  return (
    <CompDoc
      family="checks"
      summary={
        <>
          Bảng kiểm hiện <b>từ lúc mở màn</b>: mỗi dòng nói <b>vướng gì</b> và{' '}
          <b>gỡ bằng cách nào</b>. Có dòng CHẶN thì khối đỏ; chỉ có LƯU Ý thì khối vàng.
          Không còn gì thì khối tự biến mất.
        </>
      }
      useWhen="chứng từ chưa đủ điều kiện để đi bước kế (gửi duyệt, gửi NCC, nhận hàng) — người soạn cần biết còn thiếu gì TRƯỚC khi bấm, để đi xin cho đủ."
      avoidWhen={
        <>
          lỗi hệ thống hay lỗi lưu (dùng <code>NoticeBar</code> hoặc <code>useToast</code>
          ), và lỗi của MỘT ô nhập (báo ngay dưới ô đó). Đừng dùng để báo tin vui — đủ
          điều kiện thì không bày gì.
        </>
      }
      variants={[
        {
          name: 'Có lỗi chặn',
          when: 'ít nhất một dòng level=stop — khối đỏ, hai hàng: tiêu đề, rồi mỗi vướng một dòng với cách gỡ bên phải.',
          demo: (
            <Checks
              title="Chưa gửi duyệt được"
              items={[
                { level: 'stop', what: 'Dòng 2 — NK-0056 chưa có đơn giá', fix: 'Nhập giá hoặc đánh dấu “chờ báo giá”' }, // prettier-ignore
                { level: 'stop', what: 'Chưa chọn kho nhận', fix: 'Chọn kho ở khối Tổng quan' }, // prettier-ignore
                { level: 'warn', what: 'Hạn giao 07/09/2026 đã qua 2 ngày', fix: 'Cập nhật hạn hoặc ghi lý do trễ' }, // prettier-ignore
              ]}
            />
          ),
        },
        {
          name: 'Chỉ lưu ý — gọn một hàng (compact)',
          when: 'không có gì chặn, chỉ cảnh báo. Cảnh báo suông không được ăn 50px, nên tiêu đề và các dòng nối nhau trên một hàng.',
          demo: (
            <Checks
              compact
              title="Lưu ý trước khi gửi NCC"
              items={[
                { level: 'warn', what: 'Giá CN1527 cao hơn lần trước 5%', fix: 'Ghi lý do tăng giá' }, // prettier-ignore
                { level: 'warn', what: 'NCC chưa có email', fix: 'Gửi bằng Zalo rồi đánh dấu đã gửi' }, // prettier-ignore
              ]}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Có lỗi chặn',
          looks:
            'Nền --stop nhạt; huy hiệu tròn đỏ đếm số lỗi CHẶN; phụ đề “2 lỗi chặn · 1 cảnh báo”; nhãn CHẶN nền đỏ đầu dòng.',
          behaves:
            'Không nhận phím. Dòng tóm tắt (huy hiệu, tiêu đề, “2 lỗi chặn · 1 cảnh báo”) là vùng role="status": số lỗi đổi thì trình đọc báo. Khối không tự khoá nút nào — trang phải khoá nút tương ứng ở ActionPane (khoá mềm, cùng lý do).',
        },
        {
          state: 'Chỉ lưu ý',
          looks: 'Nền --warn nhạt; huy hiệu vàng đếm số cảnh báo; nhãn LƯU Ý nền vàng.',
          behaves: 'Không chặn gì — người dùng vẫn đi tiếp được.',
        },
        {
          state: 'Gọn (compact)',
          looks:
            'Tiêu đề và các dòng cùng một hàng, cách gỡ đứng sau dấu →; hết chỗ thì xuống dòng.',
          behaves: 'Chỉ đổi cách bày.',
        },
        {
          state: 'Rỗng (items = [])',
          looks: 'Không hiện gì cả.',
          behaves: 'Trả về null — không có khối “Mọi thứ đã ổn”.',
        },
      ]}
      a11y={{
        role: 'div; dòng tóm tắt là status; danh sách là <ul>/<li>',
        keys: [{ key: '—', does: 'Không nhận phím; không có gì bấm được trong khối.' }],
        reader: (
          <>
            Đọc số trên huy hiệu, tiêu đề, phụ đề, rồi danh sách “n mục”: mỗi mục “CHẶN /
            LƯU Ý — vướng gì — cách gỡ”. Mức độ được nói bằng CHỮ nên không phụ thuộc màu.
            Dòng tóm tắt nằm trong <code>role=&quot;status&quot;</code> (sửa 24/09/2026,
            B7½; test ở <code>erp.a11y.test.tsx</code>): gõ xong một đơn giá mà số lỗi
            chặn đổi thì trình đọc báo “1 lỗi chặn”. Danh sách vướng CỐ Ý nằm ngoài vùng
            đó — đọc lại cả chục dòng mỗi lần gõ là tra tấn.{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> hết vướng thì khối trả <code>null</code>,
            nên vùng status sinh ra CÙNG LÚC với lỗi chặn đầu tiên và biến mất cùng lỗi
            cuối — hai khoảnh khắc đó phần lớn trình đọc không báo; và số trên huy hiệu
            đứng trước tiêu đề mà không có nhãn nên nghe ra một con số trơ.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Bày vướng + cách gỡ ngay khi mở màn.',
          dont: 'Cho bấm “Gửi duyệt” rồi mới báo lỗi.',
          source:
            'CLAUDE.md, luật kiểm trước khi coi màn là xong — “hành động bị chặn phải nói vướng gì và cách gỡ, ngay tại chỗ”',
        },
        {
          do: (
            <>
              <code>what</code> chỉ đích danh dòng / ô: “Dòng 2 — NK-0056 chưa có đơn
              giá”.
            </>
          ),
          dont: '“Thiếu thông tin”, “Dữ liệu chưa hợp lệ”.',
          source: 'JSDoc của Check.what / Check.fix, kit/Erp.tsx',
        },
        {
          do: (
            <>
              Chỉ có cảnh báo thì bật <code>compact</code>.
            </>
          ),
          dont: 'Để cảnh báo suông chiếm hai hàng như lỗi chặn.',
          source:
            'chú thích .k-check-compact trong erp.css; DonChungTuScreen truyền compact khi không có lỗi chặn',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
