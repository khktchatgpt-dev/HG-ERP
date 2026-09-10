# Vấn đề UI/UX — chẩn đoán và cách chữa

Viết 11/09/2026. Nghiệp vụ đã dựng theo đúng tính chất công ty; tài liệu này chỉ
nói về **thiết kế giao diện**, không đụng nghiệp vụ.

Kế hoạch nghiệp vụ ở [`ke-hoach-thuc-hien.md`](ke-hoach-thuc-hien.md) vẫn còn giá
trị, chỉ là không phải việc đang cần.

---

## 1. Tám lần chê trong một phiên làm việc — một nguyên nhân

| Chủ dự án nói                          | Tôi đã làm gì                     | Hệ nào đang thiếu       |
| -------------------------------------- | --------------------------------- | ----------------------- |
| "giao diện rất xấu không cân đối"      | sửa bố cục màn đó                 | thang khoảng cách       |
| "vẫn chưa đạt tiêu chí ERP"            | viết tiêu chí đo được rồi nén màn | —                       |
| "vẫn có khoảng trống giữa các thành phần" | sửa chỗ gãy dòng               | thang khoảng cách       |
| "vẫn có khoảng rộng xung quanh"        | bỏ thẻ nổi, cho lưới sát mép      | thang khoảng cách       |
| "khá nhạt"                             | trả lại điểm nhấn                 | hậu quả của việc nén    |
| "cần tối ưu giao diện cung ứng"        | đo bốn trang, sửa ba chỗ          | thang khoảng cách       |
| "tối ưu UI/UX hoàn chỉnh tỉ mỉ"        | rà 26 bước, sửa 9 chỗ             | trạng thái thành phần   |
| "không thấy phần để ghi điều khoản"    | gom thành nhóm có tên             | luật kiến trúc thông tin |

**Sáu trên tám lần là cùng một nguyên nhân.** Mỗi lần tôi sửa đúng chỗ được chỉ,
và lần sau lại lệch ở chỗ khác. Số lần chê không giảm, vì chỗ vừa sửa không có gì
để khớp với chỗ chưa sửa.

---

## 2. Bốn hệ mà mọi design system ERP đều có — kit đang thiếu ba

| Hệ                        | Kit HG-ERP                          | Tình trạng     |
| ------------------------- | ----------------------------------- | -------------- |
| **Màu theo vai trò**      | `--act` + `--stop/--warn/--done`    | ✓ đủ và đúng   |
| **Thang chữ**             | 7 bậc, có thang số riêng            | ✓ đủ và đúng   |
| **Mật độ**                | `--row-h`, `--ctl-h`, `.kit-dense`  | ✓ đủ và đúng   |
| **Thang khoảng cách**     | **không có**                        | ✗ **gốc rễ**   |
| **Trạng thái thành phần** | thiếu focus bàn phím, tải, lỗi      | ✗ thiếu        |
| **Điểm gãy responsive**   | một số ma thuật `1100px`            | ✗ chưa định nghĩa |

Đây là chỗ hay hiểu nhầm: **kit không xấu.** Màu, chữ, mật độ đều đã chuẩn hoá tốt
và đo được. Chính vì ba hệ đó tốt nên chỗ thiếu càng lộ — mắt thấy chữ và màu
nhất quán, rồi thấy khoảng cách nhảy lung tung, và kết luận "không cân đối".

---

## 3. Bằng chứng đo được (11/09/2026)

**Khoảng cách — không có thang:**

| Đo                                          | Con số                                          |
| ------------------------------------------- | ----------------------------------------------- |
| Token `--space-*` trong `tokens.css`        | **0**                                           |
| Giá trị px cứng khác nhau trong file `.tsx` | **17** — 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 18, 22 |
| Số lần dùng px cứng trong `.tsx`            | **75**                                          |
| Giá trị px cứng khác nhau trong `erp.css`   | **17** — thêm 8 và 20                           |

Chín trong số đó là **số lẻ** (1, 3, 5, 7, 9, 11, 13, 15). Một khoảng cách 7px
cạnh một khoảng cách 9px thì mắt thấy lệch mà không chỉ ra được lệch ở đâu — đúng
cảm giác "xấu, không cân đối".

**Trạng thái thành phần:**

| Đo                                 | Con số                                      |
| ---------------------------------- | ------------------------------------------- |
| `:focus-visible` trong thành phần  | **0** (chỉ có 2 dòng ở `tokens.css`)        |
| Dùng `focus:` thay vì focus-visible | **8** — sáng cả khi bấm chuột, sai đối tượng |
| Thành phần "đang tải"              | 1 (`Loading`), không có `Skeleton`           |
| Thành phần "lỗi"                   | **0**                                       |

ERP là môi trường **gõ phím**, không phải môi trường rê chuột. Không có vòng focus
rõ thì người quen phím không đi được một màn nhập liệu.

**Responsive:** một `@media (min-width: 1100px)` viết tay trong CSS, cộng với
`sm:` `lg:` `xl:` của Tailwind trong `.tsx`. Hai hệ điểm gãy chạy song song, không
hệ nào được khai ở đâu.

---

## 4. Vì sao chữa từng chỗ không bao giờ xong — và một lỗi của tôi

Hai cơ chế, cả hai đều đã xảy ra thật trong phiên vừa rồi.

**Cơ chế thứ nhất — không có thang thì không có "đúng".** Sửa một khoảng cách từ
9px xuống 7px là đổi từ một con số tuỳ tiện sang một con số tuỳ tiện khác. Nó hợp
mắt ở màn đang mở, và lệch với màn kế bên. Vòng lặp không có điểm dừng.

**Cơ chế thứ hai — tôi tối ưu theo số đo thay vì theo mục tiêu.** Tôi tự đặt tiêu
chí "dải nhận diện ≤ 110px" rồi nén mọi điểm nhấn để đạt nó: bỏ nhãn trục trạng
thái, ép dải "đang chờ ai" thành một viên nhỏ, gộp bảng kiểm thành một hàng. Đạt
110px thật. Kết quả chủ dự án chấm: **"khá nhạt"**.

Số đo là **chỉ dấu**, không phải mục tiêu. Mục tiêu là người dùng nhìn một cái
biết ngay tờ này đang chờ ai. Bài học ghi lại để không lặp: **một tiêu chí đo được
mà làm hỏng thứ nó định bảo vệ thì tiêu chí sai, không phải màn sai.**

---

## 5. Các hệ ERP lớn thật sự làm thế nào

Điểm chung, và là thứ đáng chép duy nhất ở đây: **mọi hệ đều ĐẶT TÊN cho từng bậc
khoảng cách, và không hệ nào cho phép gõ một con số tuỳ ý.**

| Hệ                        | Thang khoảng cách                                     |
| ------------------------- | ----------------------------------------------------- |
| **Microsoft Fluent 2** (Dynamics 365) | Bậc có tên: XXS 2 · XS 4 · SNudge 6 · S 8 · MNudge 10 · M 12 · L 16 · XL 20 · XXL 24 |
| **SAP Fiori**             | Bậc 0.25rem, ba chế độ mật độ (Cozy / Compact / Condensed) |
| **Oracle Redwood**        | Lưới nền 8px                                          |
| **Odoo**                  | Ít hệ thống nhất — dựa thang của Bootstrap            |

Fluent 2 đáng chép nhất cho HG-ERP vì nó có **bậc "nudge"** (6 và 10) — thừa nhận
rằng màn dày đôi khi cần nửa bậc, nhưng vẫn là **bậc có tên**, không phải số tuỳ ý.

Hai thứ khác cũng đáng chép, đều rẻ:

- **Fiori tách "mật độ" khỏi "khoảng cách".** Đổi mật độ đổi chiều cao hàng và ô
  nhập, KHÔNG đổi khoảng cách giữa các khối. Kit đang trộn hai thứ này.
- **Fluent và Fiori đều bắt buộc vòng focus 2px, chỉ hiện khi đi bằng phím.**

---

## 6. Kế hoạch chữa — bốn bước, xếp theo rủi ro tăng dần

### Bước 1 · Dựng thang khoảng cách · rủi ro gần bằng không

Thêm bậc có tên vào `tokens.css`, theo Fluent 2 rút gọn:

```
--sp-1: 2px    --sp-2: 4px    --sp-3: 6px    --sp-4: 8px
--sp-5: 12px   --sp-6: 16px   --sp-7: 24px   --sp-8: 32px
```

Chỉ thêm token, chưa sửa chỗ nào dùng. Không có gì đổi trên màn.

### Bước 2 · Quy 17 giá trị về 8 bậc · rủi ro thấp, phần lớn máy làm được

Bảng quy đổi cố định: 1→2 · 3→4 · 5→4 · 7→8 · 9→8 · 10→12 · 11→12 · 13→12 ·
14→16 · 15→16 · 18→16 · 22→24.

Việc này **đổi hình màn thật**, nên làm theo trình tự: kit trước, rồi từng trang
của module Mua hàng, mỗi bước chụp lại đối chiếu. Chỗ nào quy đổi làm hỏng bố cục
thì đó là chỗ bố cục đang dựa vào một con số tuỳ tiện — sửa bố cục, không nới thang.

### Bước 3 · Bổ sung ba trạng thái còn thiếu · rủi ro thấp

- **Vòng focus bàn phím**: một luật `:focus-visible` dùng chung, đổi 8 chỗ đang
  dùng `focus:`.
- **`Skeleton`**: khung xám giữ đúng chỗ trong lúc tải, thay vì màn nhảy.
- **`ErrorState`**: hiện có `Empty` bắt buộc `reason` + `next`; lỗi cũng cần đúng
  hai thứ đó.

### Bước 4 · Chốt điểm gãy responsive · cần một quyết định

Khai ba điểm gãy, bỏ số ma thuật `1100px`. Cần biết **màn hình thật ở xưởng rộng
bao nhiêu** — tôi đang đoán 1366 và 1440.

### Hàng rào — thứ khiến việc này không tái diễn

Thêm luật ESLint **`hg/no-arbitrary-spacing`**, đúng khuôn hai luật đã có
(`hg/no-hardcoded-color`, `hg/no-raw-control`): cấm `p-[9px]`, `gap-[13px]`… và
báo lỗi kèm gợi ý bậc gần nhất.

Không có hàng rào thì sáu tháng nữa lại có 17 giá trị mới. Đây đúng là lý do luật
màu ra đời, và nó đã chặn được vấn đề màu.

---

## 7. Điều KHÔNG nên làm

- **Đừng đụng vào màu và thang chữ.** Hai hệ đó đang đúng. Sửa chúng vì "cho mới"
  là phá thứ đang chạy tốt.
- **Đừng thêm hiệu ứng chuyển động.** ERP là nơi làm việc tám tiếng; chuyển động
  làm chậm thao tác lặp lại.
- **Đừng làm lại 168 màn cũ.** Thang khoảng cách áp cho kit và màn mới. Màn cũ
  đổi khi có việc nghiệp vụ chạm vào.
- **Đừng đặt thêm tiêu chí đo được cho tới khi thang khoảng cách xong.** Xem mục
  4, cơ chế thứ hai.
