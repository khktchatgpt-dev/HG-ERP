'use client'

import { Btn, Menu } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Menu` (B7, 24/09/2026).
 *
 * Menu ĐÓNG lúc dựng trang — Radix chỉ dựng danh sách khi mở. Mở ra thì Radix
 * đánh `aria-hidden` cho phần còn lại của trang, nên để mở sẵn là che mất cả sổ.
 */
export default function DocMenu() {
  return (
    <CompDoc
      family="menu"
      summary={
        <>
          Menu thả cho tác vụ PHỤ của một màn hay một dòng: nút “⋯” ở góc phải, cạnh nút
          chính. Đứng trên Radix DropdownMenu: đi bằng mũi tên, DỪNG cả ở mục khoá để đọc
          lý do (chọn thì không chạy), mục nguy hiểm tự tách xuống dưới một vạch.
        </>
      }
      useWhen={
        <>
          còn ba–bảy việc hiếm dùng (sao chép, in lại, xuất Excel, huỷ) mà bày thành nút
          thì chen mất chỗ nút chính.
        </>
      }
      avoidWhen={
        <>
          việc chính của chứng từ, hoặc nhiều nhóm việc — dùng <code>ActionPane</code>{' '}
          (dải lệnh theo nhóm, thấy ngay không phải mở); điều hướng giữa trang — dùng
          link; chọn một giá trị cho ô nhập — dùng <code>Pick</code> hoặc{' '}
          <code>Combobox</code>.
        </>
      }
      variants={[
        {
          name: 'Nút ⋯ cạnh nút chính',
          when: 'mặc định. Nút một ký tự tự có tên “Thêm thao tác”. Mục huỷ tự tách xuống dưới vạch.',
          demo: (
            <div className="flex items-center gap-2">
              <Btn primary icon="gui">
                Gửi duyệt
              </Btn>
              <Menu
                items={[
                  { label: 'Sao chép thành đơn mới' },
                  { label: 'In phiếu đặt hàng' },
                  { label: 'Xuất Excel dòng hàng' },
                  { label: 'Huỷ đơn PO-2608-097', danger: true },
                ]}
              />
            </div>
          ),
        },
        {
          name: 'Mục bị khoá theo quyền',
          when: 'blockedBy khoá mục và in lý do ngay dưới nhãn — không để mục khoá câm. Mũi tên vẫn dừng trên mục khoá; Enter / bấm chuột trên đó không chạy gì và menu ở nguyên.',
          demo: (
            <Menu
              items={[
                { label: 'Sao chép đơn' },
                { label: 'Ghi nhận thanh toán', blockedBy: 'Kế toán' },
                { label: 'Mở lại để sửa', disabled: true },
                { label: 'Xoá bản nháp', danger: true },
              ]}
            />
          ),
        },
        {
          name: 'Nhãn có chữ',
          when: 'nút đứng một mình, không có nút chính bên cạnh để nói nó là gì. Chữ trên nút chính là tên.',
          demo: (
            <Menu
              label="Thao tác ▾"
              items={[{ label: 'Đổi người phụ trách' }, { label: 'Gửi lại NCC' }]}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Đóng',
          looks: 'Nút viền mảnh, chữ phụ.',
          behaves: 'aria-expanded="false"; danh sách không có trong DOM.',
        },
        {
          state: 'Mở',
          looks:
            'Viền nút đậm lên; danh sách ≥ 196px canh mép phải nút, nổi trên cả hộp thoại (z-pop).',
          behaves:
            'Tiêu điểm vào mục đầu tiên (kể cả khi mục đó bị khoá); phần còn lại của trang bị aria-hidden.',
        },
        {
          state: 'Mục đang trỏ',
          looks:
            'Nền nhạt màu hành động; mục nguy hiểm thì nền nhạt màu dừng; mục khoá thì nền XÁM — trỏ tới không có nghĩa là bấm được.',
          behaves: 'Enter / Space / bấm chuột chạy onClick, đóng menu, tiêu điểm về nút.',
        },
        {
          state: 'Mục khoá (disabled / blockedBy)',
          looks:
            'Chữ xám đọc được (không mờ bằng opacity); blockedBy thêm dòng “Việc này do … quản lý”.',
          behaves:
            'Khoá MỀM: aria-disabled, mũi tên vẫn dừng trên nó; chọn (Enter / Space / chuột) bị nuốt — không chạy onClick, menu không đóng.',
        },
      ]}
      a11y={{
        role: 'button (aria-haspopup="menu") · menu · menuitem',
        keys: [
          { key: 'Enter / Space / ↓', does: 'Trên nút: mở menu, tiêu điểm vào mục đầu.' },
          { key: '↑ ↓', does: 'Đi giữa các mục — dừng cả ở mục khoá.' },
          { key: 'Home / End', does: 'Về mục đầu / cuối.' },
          { key: 'Gõ chữ cái', does: 'Nhảy tới mục bắt đầu bằng chữ đó.' },
          {
            key: 'Enter / Space',
            does: 'Trên mục: chọn, đóng menu, tiêu điểm về nút. Trên mục khoá: không làm gì, menu ở nguyên.',
          },
          { key: 'Esc', does: 'Đóng, tiêu điểm về nút.' },
        ],
        reader: (
          <>
            Nút “⋯” đọc “Thêm thao tác, nút, bật lên menu”. Nhãn có chữ thì chính chữ là
            tên. Mục khoá đọc “Ghi nhận thanh toán, mờ” rồi mô tả “Việc này do Kế toán
            quản lý”: tên chỉ là nhãn, lý do là mô tả (<code>aria-describedby</code>) nên
            hai câu không trộn thành một. Đã sửa 24/09/2026 (B7½): bản B1 đưa{' '}
            <code>disabled</code> cho Radix, mũi tên nhảy QUA mục khoá, người dùng trình
            đọc màn hình không bao giờ đứng trên nó — lý do chỉ tới được người nhìn. Nay
            khoá mềm như <code>Btn blockedBy</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Nút “⋯” có tên đọc được (kit tự đặt “Thêm thao tác”).',
          dont: 'Để trình đọc màn hình đọc ra “dấu ba chấm ngang”.',
          source: 'bản Menu tự viết trước B1 — docs/he-thiet-ke-erp-ke-hoach.md §9.2',
        },
        {
          do: 'Mục khoá tô mực xám đọc được, kèm lý do.',
          dont: (
            <>
              Làm mờ mục khoá bằng <code>opacity</code> — chữ còn 2,2:1, trượt AA, mờ luôn
              cả câu lý do.
            </>
          ),
          source: 'lỗi đã cấm ở Btn ngày 16/09/2026; chú thích Menu trong kit/Nav.tsx',
        },
        {
          do: 'Để mục nguy hiểm (xoá, huỷ) cuối danh sách — kit tự tách chúng bằng một vạch.',
          dont: 'Xếp “Huỷ đơn” sát “Sao chép đơn”: sớm muộn có người bấm nhầm.',
          source: 'chú thích MENU ⋯ trong kit/Nav.tsx',
        },
        {
          do: 'Nút chính đứng riêng ở góc phải header; Menu chỉ gom tác vụ phụ.',
          dont: 'Giấu việc chính (Gửi duyệt, Ghi sổ) vào trong “⋯”.',
          source: 'AGENTS.md — Action Toolbar góc trên phải',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
