# Tính load cont — hướng dẫn tự test

Trang: **Kỹ thuật → Tính load cont** (`/technical/load-cont`).
Thuật toán chạy thuần ở trình duyệt (`src/lib/loadcont/*`), không gọi API/DB.

## 1. Đăng nhập

Cần một tài khoản (app dùng auth tự viết, không tự đăng ký). Dùng tài khoản
admin sẵn có của bạn; hoặc tạo nhanh 1 tài khoản test:

```bash
node scripts/create-user.mjs --email test@hg.com --password "Test!Pass123" --role admin --name "Test"
```

> Quyền vào trang: admin xem mọi workspace; ngoài ra phải là nhân sự phòng **Kỹ Thuật**.

## 2. Test nhanh bằng bộ mẫu (1 chạm)

Ở mục **2 · Danh sách kiện hàng**, bấm nút **“Nạp bộ mẫu Hali (test 1 cont)”**.
Nút này tự nạp **đúng kịch bản trong ảnh khách gửi**:

| Kiện        | D×R×C (cm)      | Kg  | SL  |
| ----------- | --------------- | --- | --- |
| Ghế Hali    | 58 × 58 × 46    | 15  | 200 |
| Mặt bàn 235 | 81 × 80 × 10    | 20  | 185 |
| Chân bàn    | 122.5 × 95 × 11 | 22  | 185 |

Và tự đặt: cont tự khai **1190 × 234 × 268 cm / 30 tấn**, xếp cao tối đa **6**,
bật **Cho phép gác tấm** + **Chế độ test (nhồi tối đa)**.

Rồi bấm **“Tính phương án xếp”**.

## 3. Kết quả kỳ vọng (bộ mẫu Hali)

- **2 cont**, xếp đủ **570/570 kiện**.
- **Cont 1 ≈ 84%** (530 kiện) — 3 khối theo loại, lấp kín tới cửa.
- **Cont 2 ≈ 5%** (40 tấm bàn dôi ra).

> Vì sao chưa vừa 1 cont: thể tích hàng = 89.3% lòng cont (sát ngưỡng vật lý);
> heuristic nhanh chạm trần ~84%, phần dôi (~40 tấm) là các túi trống hẹp cần
> xếp tay. Xem phân tích trong lịch sử chat.

## 4. Ý nghĩa các lựa chọn

**Cont (mục 1):** chọn cont chuẩn (20DC/40DC/40HC) hoặc “Tự khai kích thước”.
**Xếp cao tối đa (cao ÷ đáy):** giới hạn độ mảnh cột. Cao hơn = xếp cao sát trần
hơn, cột mảnh hơn.

**Cho phép gác tấm:** cho tấm phẳng cứng (mặt/chân bàn) gác ngang qua nóc nhiều
cột đế (cột ghế). Tải tấm phân bổ xuống các cột; chỉ gác khi từng cột đế còn
chịu nổi.

**Chế độ test (nhồi tối đa):** ⚠ bỏ MỌI ràng buộc an toàn (nặng-trên-nhẹ, sức
chịu nén, độ mảnh) VÀ an toàn vùng cửa (lấp kín tới cửa). Chỉ để **ước lượng số
cont tối thiểu** — KHÔNG phải phương án xếp an toàn thật.

### Cột trong bảng kiện (toàn hàng nội thất — đã bỏ Loại thùng / Chịu nén / Dễ vỡ)

| Cột       | Ý nghĩa                                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| **Xoay**  | Cho xoay ngang 90° (đổi dài↔rộng).                                                         |
| **Lật**   | Xoay đa chiều — lật kiện sang mọi mặt (dựng nghiêng) để lấp khe. Chỉ dùng nếu xếp tốt hơn. |
| **Chồng** | Cho kiện khác chồng lên. Mặt bàn/tủ mỏng úp không cho đè thì bỏ chọn.                      |

## 5. Xem kết quả 3D

- Chọn tab **Cont 1 / Cont 2** để xem từng cont.
- **Kéo** để xoay, **lăn chuột** để zoom, **nhấn đúp** để đặt lại góc nhìn.
- Thanh trượt **Thứ tự xếp** để xem xếp lần lượt từng kiện.
- Bấm chú thích màu (legend) để làm nổi 1 loại kiện.
- Bảng **Thứ tự xếp** bên phải: vị trí (từ vách / từ trái) + tầng của từng kiện.

## 6. Badge kiểm tra an toàn

- **Xanh** = phương án an toàn: không gác lệch, nặng-dưới-nhẹ-trên, không đè lên
  kiện không cho chồng, vùng cửa chỉ cột thấp-vững.
- **Vàng** = đang ở Chế độ test (đã bỏ an toàn) — chỉ để ước lượng số cont.
- **Đỏ** = phát hiện vi phạm (báo lại đội phát triển).

## 7. Kiểm thử tự động

```bash
npx vitest run src/lib/loadcont
```

Thuật toán + audit + kịch bản Hali đều có test (`src/lib/loadcont/*.test.ts`).
