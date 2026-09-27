'use client'

import { useState } from 'react'
import { ScopeSwitch } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `ScopeSwitch` — phạm vi "Của tôi | Cả phòng" (27/09/2026).
 *
 * Cá nhân hoá phòng Cung ứng: 11 màn của phòng chỉ có Hộp thư lọc theo người
 * xem, mỗi màn tự chế một kiểu nút "của tôi". Một thành phần cho mọi màn.
 */
function Demo({
  start = 'toi' as 'toi' | 'phong',
  toi = 'Của tôi',
  phong = 'Cả phòng',
  a = 18,
  b = 44,
}) {
  const [v, setV] = useState<'toi' | 'phong'>(start)
  return (
    <ScopeSwitch
      label="Phạm vi"
      value={v}
      onChange={setV}
      options={[
        { value: 'toi', label: toi, count: a, hint: 'Đơn tôi phụ trách' },
        { value: 'phong', label: phong, count: b, hint: 'Mọi đơn của phòng' },
      ]}
    />
  )
}

export default function DocScopeSwitch() {
  return (
    <CompDoc
      family="scope-switch"
      summary={
        <>
          Chọn <b>đúng một</b> phạm vi cho cả màn — việc của tôi, hay của cả phòng. Số
          trên mỗi lựa chọn là số dòng màn sẽ bày. Màn giữ giá trị (thường qua{' '}
          <code>useScopePref</code>: nhớ theo tài khoản, mặc định theo vai, địa chỉ{' '}
          <code>?pham_vi=</code> thắng).
        </>
      }
      useWhen="màn danh sách mà cùng một câu hỏi có hai cỡ: của tôi và của cả phòng (đơn mua, hộp thư, lệnh, hàng về, nhà cung cấp, bảng giá)."
      avoidWhen={
        <>
          bộ lọc bật/tắt ĐỘC LẬP (quá hẹn, chưa hẹn giao) — đó là <code>Chip</code>; và
          chia nội dung một chứng từ thành mục — đó là <code>DocMenu</code>. Đừng dùng cho
          hơn 3 lựa chọn: phạm vi mà nhiều hơn thế là bộ lọc, không còn là phạm vi.
        </>
      }
      variants={[
        {
          name: 'Người mua — mặc định Của tôi',
          when: 'người có quyền mua, không có quyền duyệt (chốt 27/09/2026).',
          demo: <Demo />,
        },
        {
          name: 'Người duyệt — mặc định Cả phòng',
          when: 'người có quyền duyệt đơn mua: việc của họ là thấy ai đang kẹt.',
          demo: <Demo start="phong" />,
        },
        {
          name: 'Nhãn theo đối tượng',
          when: 'nhãn nói đúng thứ đang đếm — "NCC của tôi | Cả công ty", "Lệnh của tôi | Cả phòng".',
          demo: <Demo toi="NCC của tôi" phong="Cả công ty" a={25} b={174} />,
        },
      ]}
      states={[
        {
          state: 'Lựa chọn đang bật',
          looks: 'Nền nhạt màu hành động, chữ đậm màu hành động.',
          behaves: 'aria-checked="true"; bấm lại không bỏ chọn, không gọi onChange.',
        },
        {
          state: 'Lựa chọn khác',
          looks: 'Chữ xám đậm, rê chuột thì đậm hơn.',
          behaves: 'Bấm → onChange(giá trị); màn đổi danh sách và ghi ?pham_vi=.',
        },
        {
          state: 'Tiêu điểm bàn phím',
          looks: 'Viền trong 2px màu hành động.',
          behaves: 'Mũi tên đi giữa các lựa chọn (Radix roving focus).',
        },
      ]}
      a11y={{
        role: 'radiogroup có tên (label) / radio — Radix ToggleGroup single',
        keys: [
          { key: '← →', does: 'Đi giữa các lựa chọn.' },
          { key: 'Space / Enter', does: 'Chọn lựa chọn đang trỏ.' },
          { key: 'Tab', does: 'Vào / ra khỏi nhóm (một điểm dừng).' },
        ],
        reader: (
          <>
            Đọc “Phạm vi, nhóm nút chọn — Của tôi 18, đã chọn, 1 trên 2”. Câu gợi ý (
            <code>hint</code>) là <code>title</code> của lựa chọn.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Số trên lựa chọn đếm bằng ĐÚNG hàm lọc của màn.',
          dont: 'Đếm "của tôi" bằng một điều kiện riêng — công tắc nói 18 mà danh sách hiện 16.',
          source: 'CLAUDE.md nguyên tắc 3 — con số là một lời hứa',
        },
        {
          do: 'Một nghĩa "của tôi" cho mọi màn (lib/supply-scope).',
          dont: 'Mỗi màn tự hiểu — chip "Chờ tôi xử lý" ở Yêu cầu mua từng lọc "phòng Cung ứng đang giữ".',
          source: 'đo 27/09/2026, canvas "Cá nhân hoá phòng Cung ứng"',
        },
        {
          do: 'Link mở thẳng một chứng từ hay mang bộ lọc từ màn khác → cả phòng.',
          dont: 'Lọc "của tôi" lên link đồng nghiệp gửi — giấu đúng đơn họ chỉ tới.',
          source: 'màn Đơn mua 27/09/2026 (?mo=, ?ncc=)',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
