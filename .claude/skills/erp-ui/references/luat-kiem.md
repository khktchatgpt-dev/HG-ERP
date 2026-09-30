# Luật kiểm trước khi coi màn là xong

Nguồn gốc: mục 05 của sổ `/design-lab` (`src/app/design-lab/page.tsx`, `id="luat-kiem"`), cộng bốn dòng truy cập của kế hoạch hệ thiết kế (`docs/he-thiet-ke-erp-ke-hoach.md` §6). Sổ đổi thì sửa file này theo.

Mỗi dòng bắt một lỗi **đã thật sự xảy ra** trong dự án. Báo cáo cuối bước phải nói rõ từng dòng: đạt, không đạt, hoặc không áp dụng (kèm lý do).

## Bố cục và số

1. **Màn trả lời đúng một câu hỏi nghiệp vụ**, và câu đó viết ra được thành một câu. Khuôn là điểm xuất phát, không phải đích.
2. **Mọi con số hiển thị đếm bằng đúng hàm mà trang đích dùng.** Bấm thử một ô có số và đếm tay số dòng nhận được.
3. **Bảng dài có tiêu đề cột dính VÀ chân tổng dính.** Cha đặt `min-h-screen` thì cả hai đều vô hiệu, nên dùng `ScreenFrame`.
4. **Cột số dùng lớp `num`**: mono, căn phải, tabular.
5. **Con số tổng nói phần nó KHÔNG bao gồm.**
6. **Số suy ra bày được phép tính nguyên văn** (`WhyBox`).

## Trạng thái

7. **Hành động bị chặn nói vướng gì và cách gỡ, ngay tại chỗ.** Không cho bấm rồi mới báo lỗi.
   - Lý do nghiệp vụ: `PrimaryStep why`, `Checks`.
   - Bảng nhập: `CommitBar blocked` + `onGoBlocked`, câu chặn bấm được.
   - Thiếu quyền: `Btn blockedBy` / `PermHint`. Chỉ dành cho quyền, không dành cho lý do nghiệp vụ.
8. **Trạng thái rỗng nói lý do và việc phải làm tiếp** (`Empty`). Tách lý do theo nguyên nhân: "đã xong hết" và "chưa định hình" là hai câu khác nhau.
9. **Đang chạy thì có dấu hiệu** (`Btn busy`: vòng quay + `aria-busy`, cú bấm thứ hai bị nuốt mà KHÔNG đánh rơi tiêu điểm như `disabled`). Chờ tải dùng `Loading`.

## Màu và hình

10. **Không có màu vòng đời nào nằm trên nút hoặc dòng đang chọn.** Nền đặc = bấm được.
11. **Không có thẻ nổi quanh lưới hay khung dữ kiện.** Thấy viền bốn phía + bo góc + lề quanh một lưới là đang chép web.
12. **Ưu tiên token cho màu, thang `text-k-*` cho cỡ chữ.** (Lint canh việc này đã gỡ 30/09/2026 — kiểm bằng mắt, không có máy.)
13. **Ưu tiên kit cho bảng và ô nhập**: lưới trong khối thì `Grid`; bảng toàn trang thì `Table`. Kit không có thì viết thẳng.
14. **Icon theo khái niệm** (`<Ico name>`, bản đồ ở `kit/Icon.tsx`).

## Truy cập

15. **Đi hết màn bằng phím Tab**, và vòng focus luôn nhìn thấy, không bị đầu/chân dính che.
16. **Ô tick chọn dòng có `aria-label` nói rõ chọn dòng nào.**
17. **Nút chỉ có icon có tên** (`aria-label`); icon trang trí không chen vào tên nút.
18. **Lớp phủ** (Sheet/Menu/Popover) giữ focus bên trong và trả focus về nút đã mở. Kit đã làm sẵn trên Radix; đừng tự dựng lớp phủ.

## Cổng cuối

19. **`npm run check` sạch.** Typecheck + lint + test; đỏ thì chưa xong, không có ngoại lệ.
20. **Đã kiểm trên trình duyệt ở 1280×800**, có ảnh chụp trong báo cáo.
