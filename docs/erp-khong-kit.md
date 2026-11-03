# Giao diện lối ERP — KHÔNG dùng bộ kit

> Chốt 03/11/2026. Chủ dự án đã nói cùng một ý **bốn lần**: Đơn mua (30/09), cả khu
> Kho (14/10: "thiết kế lại UI/UX không dùng bộ kit nữa, thiên hướng ERP không phải
> web"), Sổ công nợ (31/10: "không dùng bộ kit cũng như hiển thị nội dung thừa"),
> Phân công việc (03/11: "sao thiết kế UI/UX vẫn như bộ kit nhỉ").
>
> Từ nay: **mọi màn MỚI và mọi lần DỰNG LẠI một màn viết theo tài liệu này**, không
> import `@/components/kit`, `@/components/erp/*`, `@/components/shadcn/*`.

## 1. "Không kit" nghĩa là gì — bài học 03/11

Không import kit **chưa đủ**. Màn Phân công việc (30/10) không import kit nhưng viết bằng
lớp Tailwind + token `.theme-v3` với nút bo góc, chip lọc tròn, ô nhập bo góc, chữ nhãn
in hoa trên mỗi ô — nhìn y như kit, và chủ dự án nhận ra ngay. "Không kit" là **không cả
cái dáng web của kit**:

| Dáng web (bỏ)                                    | Dáng ERP (dùng)                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| Nút bo góc, bóng, nổi                            | Nút phẳng trong **Action Pane** góc trên phải; nút chính nền đặc      |
| Chip lọc tròn (`rounded-full`)                   | **Tab ngang có số** hoặc ô chọn vuông trong **thanh lọc**             |
| Thẻ (card) bo góc, đổ bóng, khoảng trắng rộng    | Khối ngăn bằng **một vạch mảnh**, sát mép, không bóng                 |
| Trang cuộn cả trang                              | **Khung chốt chiều cao**, chỉ lưới cuộn; đầu/chân lưới dính           |
| Dòng hai–ba hàng chữ (tên + mô tả + ghi chú)     | **Mỗi dòng một hàng**; dài thì cắt "…" + `title`; chi tiết mở ở bên   |
| Câu giải thích, dải cảnh báo chồng nhau          | Con số tự nói; chỉ giữ chữ là **việc phải làm**                       |
| Trạng thái rỗng to giữa trang kèm đoạn văn       | Một dòng: vì sao rỗng + việc làm tiếp                                 |
| Toast góc màn                                    | Báo **tại chỗ** (dưới nút, trên dòng, trên ô)                         |

## 2. Khung sáu tầng

Mọi màn danh sách / bàn làm việc dựng từ cùng sáu tầng, trên xuống:

1. **Đầu trang + Action Pane** — tên màn (16px, đậm), ngữ cảnh nhỏ bên cạnh; nhóm nút
   phẳng ở góc phải, nút chính nền `--act` đặc. Nút bị chặn vẫn bấm được và **nói lý do
   tại chỗ** (dòng chữ dưới thanh), không giấu trong tooltip.
2. **Tab ngang có số** — mỗi tab một rổ việc, số đếm bằng ĐÚNG hàm lọc của lưới. Tab đang
   chọn: nền trắng + gạch dưới `--act`. Số đỏ chỉ khi là việc trễ.
3. **Thanh lọc** — ô tìm, ô chọn vuông, "Bỏ lọc". Không chip tròn.
4. **Ô đếm vuông** — chỉ khi màn có nhiều rổ chéo nhau; không thì bỏ.
5. **Lưới** — MỘT vùng cuộn; đầu cột nền sẫm dính trên, chân tổng dính dưới; mỗi dòng
   một hàng, ngựa vằn nhạt, dòng chọn nền `--act-wash` + vạch trái 3px.
6. **Thanh trạng thái** — chữ nhỏ ở đáy: số dòng, phân trang, giờ cập nhật.

Chi tiết một đối tượng mở ở **ngăn phải** (sát lưới, cùng chiều cao, vạch trái mảnh) —
giống FactBox của Dynamics — hoặc **dưới dòng** nếu chỉ vài trường. Không mở trang mới
cho thứ xem nhanh.

## 3. Màu và chữ

- Chữ nền **13px**; số / mã / ngày dùng mono (`JetBrains Mono`, `tabular-nums`).
- **Một màu hành động** `--act` (nút chính, link, tab chọn, focus). **Ba màu vòng đời**
  `--warn` `--stop` `--done` chỉ cho chữ trạng thái và số, **không bao giờ lên nút**.
- **Nền đặc = bấm được.** Nhãn trạng thái là CHỮ màu (có thể kèm viền mảnh), không hộp
  nền đặc giống nút.
- Nút khoá: nền xám đặc, chữ đọc được (không `opacity`).
- Độ tương phản trước khoảng trắng: chữ phụ `--ink3` vẫn đạt AA trên nền trắng.

## 4. Cách viết mã

- Mỗi khu có **CSS riêng** của nó, mọi luật mở đầu bằng lớp gốc lặp đôi (`.kh.kh`,
  `.pc.pc`, …) để thắng Tailwind và CSS kit còn sót. Biến màu khai trong lớp gốc.
- **Không dùng chung CSS giữa hai phòng** (Kho ↔ Mua hàng 0 import chéo). Khu mới thì
  CHÉP khung từ khu gần nhất rồi sửa, không import.
- Khung chốt chiều cao bằng `calc(100dvh - đỉnh màn)` đo trong `useLayoutEffect`
  (xem `KhoKhung`); bỏ đệm của `<main>`.
- Tailwind vẫn dùng được cho bố cục vụn (`flex`, `gap`), nhưng **màu, viền, chữ, nút,
  lưới** đi qua lớp CSS của khu — đó là thứ làm nên dáng ERP.
- Logic thuần đặt ở `src/lib/`, có test; màn chỉ hiển thị.
- Kiểm ở **1280×800 và ~1000px**: không cuộn ngang, mọi dòng một hàng, đầu/chân lưới dính.

## 5. Mẫu đang chạy để chép

| Khu                     | File                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Kho (đủ sáu tầng nhất)  | `src/app/(workspace)/warehouse/_erp/kho.css` + `khung.tsx`           |
| Hộp ký giám đốc         | `src/app/(workspace)/exec/approvals/hop-ky.css`                      |
| Sản xuất (B1–B6, 03/11) | `src/app/(workspace)/production/_erp/` (trên nhánh, chưa lên main)   |

## 6. Màn cũ còn kit

Không đập lại hàng loạt. Màn nào có việc nghiệp vụ chạm vào thì dựng lại theo tài liệu
này, đi qua bản vẽ được duyệt như mọi màn mới (skill `erp-ui`). Trong lúc đó sửa nhỏ
tại chỗ bằng đúng hệ màn đang dùng — một file một hệ.

## 7. Bản vẽ duyệt

Bản vẽ (Artifact HTML) vẽ **ngay từ đầu** theo tài liệu này: phẳng, sáu tầng, ít chữ.
Bản vẽ phẳng mà mã dựng theo dáng cũ là lỗi đã dính (Phân công việc 03/11) — dựng theo
bản vẽ, không theo màn cũ đang có.
