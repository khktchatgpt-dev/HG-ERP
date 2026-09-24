'use client'

import { AuditTable, type AuditRow } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — nhật ký thay đổi trường (B7, 24/09/2026).
 *
 * Tới ngày viết, `AuditTable` của kit mới chỉ dựng ở màn mẫu `/design-lab/mau-erp`
 * và tủ trưng bày; màn thật chưa dùng (bảng vết ở `/admin/permissions/audit` là
 * một thành phần KHÁC, cùng tên). Dữ liệu ví dụ chép dạng của màn mẫu.
 *
 * B7 ghi hai lỗi: khoá hàng `at + field` đụng nhau khi sửa cùng trường hai lần
 * trong một phút, và bảng rỗng trơ hàng tiêu đề. Cả hai đã sửa ở B7½
 * (24/09/2026); mục 4 và 6 tả hành vi sau khi sửa, ví dụ ba bày nhánh rỗng.
 */
const DON: AuditRow[] = [
  { at: '01/09 09:02', who: 'Nguyễn Văn A', field: 'Chứng từ', from: '—', to: 'Tạo mới' },
  { at: '02/09 14:20', who: 'Nguyễn Văn A', field: 'Đơn giá · CN1527', from: '352.000', to: '369.600' }, // prettier-ignore
  { at: '05/09 16:10', who: 'Lê Văn D', field: 'Hạn giao', from: '05/09/2026', to: '07/09/2026' }, // prettier-ignore
  { at: '08/09 10:33', who: 'Trần Thị C', field: 'Dòng 5 · NK-0088', from: 'Chưa nhận', to: 'Đóng thiếu' }, // prettier-ignore
]

const HO_SO: AuditRow[] = [
  { at: '11/09 08:15', who: 'Phan Thị Lệ Hằng', field: 'Điều khoản TT', from: '15 ngày', to: '30 ngày' }, // prettier-ignore
  { at: '11/09 08:16', who: 'Phan Thị Lệ Hằng', field: 'Đặt tối thiểu', from: '5.000.000', to: '10.000.000' }, // prettier-ignore
]

export default function DocAuditTable() {
  return (
    <CompDoc
      family="audit-table"
      summary={
        <>
          Vết thay đổi do <b>máy</b> ghi — chép SAP change documents: lúc nào, ai, trường
          nào, từ giá trị gì thành gì. Tách hẳn khỏi trao đổi, là lời <b>người</b> viết.
        </>
      }
      useWhen="người dùng cần biết ai đổi giá từ 352.000 lên 369.600, lúc nào — trên chứng từ hoặc hồ sơ danh mục, thường trong một FastTab gấp sẵn."
      avoidWhen={
        <>
          lời bàn, ghi chú, mốc vòng đời có người đứng tên — dùng khối trao đổi /{' '}
          <code>Timeline</code>; gộp hai thứ vào một dòng là mất cả hai.
        </>
      }
      variants={[
        {
          name: 'Trên chứng từ đơn mua',
          when: 'trường của một DÒNG thì ghi kèm mã dòng ("Đơn giá · CN1527") — không thì không biết dòng nào.',
          demo: <AuditTable rows={DON} />,
        },
        {
          name: 'Trên hồ sơ danh mục',
          when: 'Khuôn E: sửa hồ sơ đổi cho mọi đơn lập về sau, nên vết càng cần.',
          demo: <AuditTable rows={HO_SO} />,
        },
        {
          name: 'Chưa có thay đổi',
          when: 'chứng từ vừa tạo, chưa ai sửa gì — trạng thái BÌNH THƯỜNG, không phải lỗi. Bảng tự nói một dòng, chỗ gọi không phải làm gì.',
          demo: <AuditTable rows={[]} />,
        },
      ]}
      states={[
        {
          state: 'Có dòng',
          looks:
            'Bảng năm cột; thời điểm chữ mono, giá trị cũ gạch ngang chữ phụ, giá trị mới đậm. Dưới bảng luôn có câu "Máy ghi, không sửa được…".',
          behaves:
            'Chỉ đọc. Bảng cuộn ngang khi hẹp. Thứ tự hàng đúng như truyền vào. Hai lần sửa cùng trường trong cùng một phút không đụng khoá React — khoá hàng là at + field + chỉ số (sửa 24/09/2026, B7½).',
        },
        {
          state: 'Rỗng (rows = [])',
          looks:
            'Hàng tiêu đề cột, một dòng trải năm cột “Chưa có thay đổi nào được ghi.”, rồi câu chú thích.',
          behaves:
            'Kit tự nói ra (sửa 24/09/2026, B7½ — trước đó chỉ trơ hàng tiêu đề). Cố ý KHÔNG phải Empty: chưa sửa gì là trạng thái bình thường, không có việc gì phải làm tiếp.',
        },
      ]}
      a11y={{
        role: 'table (thead / th, không scope, không caption)',
        keys: [
          {
            key: '—',
            does: 'Không có phần tử nào nhận tiêu điểm. Khung cuộn ngang không có tabIndex — cuộn bằng phím chỉ được khi trình duyệt tự cho khung cuộn nhận tiêu điểm.',
          },
        ],
        reader: (
          <>
            Đọc thành bảng năm cột, có tiêu đề cột. <b>Hai chỗ chưa tốt, ghi thật:</b> giá
            trị cũ chỉ được đánh dấu bằng gạch ngang và màu, nên người nghe chỉ phân biệt
            cũ/mới nhờ tên cột; bảng không có <code>&lt;caption&gt;</code> nên tên khối
            phải nằm ở FastTab bọc ngoài.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Để máy ghi vết ở AuditTable, lời người viết ở khối trao đổi.',
          dont: 'Trộn vết máy với lời bàn trong một dòng thời gian — vết trôi giữa lời bàn, lời bàn chìm giữa tiếng máy.',
          source:
            'Erp.tsx, chú thích mục 10 (Nhật ký thay đổi trường — SAP change documents)',
        },
        {
          do: (
            <>
              Truyền vết theo đúng thứ tự máy ghi, chỉ NỐI THÊM ở cuối; kèm mã dòng vào{' '}
              <code>field</code> khi trường thuộc một dòng.
            </>
          ),
          dont: 'Chèn hay xếp lại hàng giữa hai lần vẽ — khoá hàng dùng chỉ số làm vế phân xử, chỉ ổn định khi nhật ký chỉ nối thêm.',
          source:
            'Erp.tsx, chú thích AuditTable (B7½, 24/09/2026): khoá cũ at + field đụng nhau khi sửa cùng trường hai lần trong một phút',
        },
        {
          do: (
            <>
              Truyền <code>rows={'{[]}'}</code> khi chưa có vết — bảng tự nói “Chưa có
              thay đổi nào được ghi.”
            </>
          ),
          dont: 'Tự thay bảng bằng Empty kèm “việc làm tiếp” — chưa sửa gì không phải việc cần gỡ.',
          source:
            'Erp.tsx, chú thích dòng rỗng của AuditTable (B7½); CLAUDE.md luật kiểm — trạng thái rỗng phải nói lý do',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
