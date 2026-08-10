# Thu hẹp hệ thống về SALE + CUNG ỨNG — kế hoạch thiết kế lại

Trạng thái: **BẢN THẢO chờ chốt** (09/08/2026). Yêu cầu gốc của chủ dự án: *"phần
sản xuất chưa xây nên xoá đi, tập trung vào quản lý phòng Sale và Cung ứng"*.

Tài liệu này làm 3 việc: (1) đính chính tiền đề "chưa xây" bằng số đo thật,
(2) chỉ ra ranh giới xoá được / không xoá được, (3) kế hoạch thiết kế lại cho hai
phòng Sale + Cung ứng.

> ⚠️ **Chưa xoá bất cứ thứ gì.** Mục §1–§2 cần chủ dự án đọc và chốt trước.

---

## 1. Đính chính: phần sản xuất ĐÃ XÂY, chỉ là CHƯA DÙNG

Hai chuyện khác hẳn nhau, và số đo cho thấy vế thứ hai:

| Đo trên repo (09/08/2026) | Con số |
|---|---|
| File thuộc mảng sản xuất (module + 4 workspace + component) | **67 file** |
| Dòng code | **13.144** |
| File test | 9 (nằm trong 954 test đang xanh) |
| Migration liên quan sản xuất / LSX | **36** |
| Khoá ngoại trỏ tới bảng `production_orders` | **14** |

| Đo trên DB thật | Con số |
|---|---|
| Lệnh sản xuất đã phát | 8 |
| Dòng BOM trong lệnh | 0 |
| Việc giao xuống tổ / phiếu giao tổ | 0 / 0 |
| Sản lượng ghi sổ | 0 |

⇒ Đúng là **xưởng chưa dùng hệ thống ngày nào**. Nhưng phần mềm cho nó thì đã
viết xong và đang được test bảo vệ. "Xoá" ở đây không phải dọn code chết — là vứt
13k dòng đã chạy được.

## 2. Ranh giới: cái gì xoá được, cái gì KHÔNG

Mảng sản xuất trong hệ này gồm **hai lớp rất khác nhau**, và yêu cầu "xoá phần
sản xuất" chỉ đúng với lớp thứ hai:

### Lớp A — LỆNH SẢN XUẤT (LSX): **KHÔNG xoá được**

LSX không phải màn của xưởng. Nó là **xương sống nối Sale ↔ Cung ứng**:

* Sale là người **phát** lệnh — cả khu `sales/lsx/` (workbench, phát lệnh, dòng lệnh).
* Cung ứng **đặt vật tư theo lệnh**: `pos.repo` tham chiếu 17 chỗ, `pos.service`
  11 chỗ. Kiểu xem **mặc định** của màn đơn đặt hàng là "Theo lệnh SX"; các tính
  năng vừa làm tháng này đều bám lệnh — gộp nhiều LSX vào một đơn (0125), hạn vật
  tư phải về (0126), cột "về kho x/y dòng".
* DB: `supply_purchase_orders.production_order_id` là **khoá ngoại** trỏ tới
  `production_orders`; tổng cộng 14 FK trỏ về bảng này.
* 20/20 đơn hàng đang mở đều ở trạng thái "Đã phát LSX".

Xoá bảng LSX = vỡ đơn mua vật tư, vỡ đơn hàng, mất trục gom việc của cả hai phòng
cần giữ. **Không làm.**

### Lớp B — THỰC THI TRONG XƯỞNG: tắt được, và nên tắt

Đây mới là thứ "chưa xây" theo nghĩa chưa ai dùng:

| Khu | Route | Nội dung |
|---|---|---|
| Toàn cảnh xưởng | `/production` | bảng điều hành quản đốc |
| Tổ sản xuất | `/to` | việc của tổ, lệnh đang chạy, quá trình tổ |
| Thống kê xưởng | `/thongke` | sổ số liệu, giao tổ, định hình, gia công ngoài, sổ tổng, báo cáo tháng |
| Kế hoạch sản xuất | `/kehoach-sx` | xếp lịch sản xuất |
| 2 màn của GĐ | `/exec/ops`, `/exec/production` | tháp điều hành, tiến độ công đoạn — **đang rỗng 100%** |

### Cách "xoá" đề xuất: TẮT khỏi điều hướng, giữ code + DB

Đổi `ready: true → false` trong `src/workspaces/workspaces.config.ts` cho 4
workspace lớp B, và gỡ 2 mục menu của GĐ. Hệ quả:

* Người dùng **không còn thấy** khu xưởng ở đâu cả — đúng mục tiêu "tập trung vào
  Sale + Cung ứng", đạt ngay trong một lần sửa file.
* Không đụng DB ⇒ 14 khoá ngoại còn nguyên, Sale + Cung ứng chạy y như cũ.
* Bật lại sau này = đổi một chữ, không phải viết lại 13k dòng.

Nếu chủ dự án **vẫn muốn xoá hẳn code**, việc đó cần một lệnh riêng và rõ ràng;
tôi sẽ làm theo, nhưng phải nói trước: không có đường lùi ngoài lịch sử git, và
LSX (lớp A) vẫn phải ở lại.

---

## 3. Hệ thống sau khi thu hẹp — chuỗi giá trị còn lại

```
KHÁCH HÀNG → BÁO GIÁ → ĐƠN HÀNG → LỆNH (gom đơn thành lô)
                                      ↓
                            NHU CẦU VẬT TƯ (định mức × SL)
                                      ↓
                       ĐƠN MUA NCC → NHẬN HÀNG (Kho) → CÔNG NỢ
```

Sale giữ nửa trái, Cung ứng giữ nửa phải, LSX là bản lề. Kho và Kỹ thuật ở lại vì
hai phòng này phục vụ trực tiếp chuỗi trên (nhập hàng về, hồ sơ SP + định mức).

### Hai lỗ hổng chặn chuỗi — đã đo, phải vá trước

| # | Lỗ hổng | Số đo | Hệ quả hiện tại |
|---|---|---|---|
| **H1** | **Đơn hàng không có giá** | 71/71 dòng đơn `unit_price` trống | Sale không có doanh số; sổ đơn của GĐ hiện **0 USD** cho cả 20 đơn; không xếp được đơn theo giá trị; không có gì đối chiếu công nợ |
| **H2** | **Định mức trống** | 4/593 SP có định mức, 0 dòng gắn mã vật tư | Không tự tính được cần mua gì cho lệnh nào ⇒ Cung ứng gõ tay từng đơn; toàn bộ 20 lệnh kẹt ở "chờ vật tư/BOM" |

Mọi thứ đẹp đẽ phía sau (báo cáo, cảnh báo, KPI) đều vô nghĩa nếu hai chỗ này còn
trống. **Kế hoạch dưới đây xếp theo đúng thứ tự gỡ nút.**

---

## 4. Kế hoạch thiết kế lại

### Giai đoạn 0 — Thu hẹp phạm vi (nửa buổi)

* Tắt 4 workspace lớp B + 2 mục menu GĐ (§2).
* Trang chủ mỗi phòng chỉ còn việc của phòng đó.
* Rà sidebar/route để không còn link chết trỏ vào khu đã tắt.

### Giai đoạn 1 — Vá H1: tiền trên đơn hàng (1–2 buổi)

* Ô đơn giá + thành tiền trên dòng đơn hàng; tổng đơn; tiền tệ theo khách.
* Kéo giá từ **báo giá** đã duyệt sang đơn (hiện báo giá có giá, đơn thì không —
  đứt đúng chỗ nối).
* Nhập giá hàng loạt cho 20 đơn đang mở (dán từ Excel, như form PO đang làm).
* Sổ đơn của Sale + của GĐ hiện đúng doanh số thay vì 0 USD.

### Giai đoạn 2 — Vá H2: đường nạp định mức (2–3 buổi)

* Nút **"Nhập định mức từ file BOM"** trong hồ sơ SP (bước 7 của
  [dinh-muc-redesign-plan.md](./dinh-muc-redesign-plan.md) — hiện mới có script).
* Xem trước từng dòng + cảnh báo ô Excel tính sai trước khi lưu.
* Khớp mã vật tư với danh mục 13.168 vật tư đang có (dò trùng đã làm ở 0127).

### Giai đoạn 3 — Nhu cầu vật tư: nối Sale sang Cung ứng (2 buổi)

* Trang **"Nhu cầu vật tư theo lệnh"**: định mức × số lượng đơn − tồn kho =
  cần mua. Cung ứng mở đơn mua thẳng từ dòng thiếu.
* Đây là thứ biến LSX từ "tờ giấy gom đơn" thành công cụ thật của hai phòng.

### Giai đoạn 4 — Quản trị hai phòng (2 buổi)

* **Cung ứng**: đã xong phần khoá theo người phụ trách + trưởng phòng (0128).
  Còn: bảng điều hành của Trưởng phòng — đơn của từng nhân viên, đơn quá hẹn,
  đơn chờ duyệt lâu.
* **Sale**: áp cùng khuôn — đơn hàng/báo giá có **người phụ trách**, trưởng phòng
  thao tác mọi hồ sơ + bàn giao khi nhân viên nghỉ. Hiện mới có chủ sở hữu ở
  khách hàng, chưa có ở đơn/báo giá.
* Ngưỡng duyệt theo giá trị cho cả hai phòng (câu 6.4 đang hoãn).

### Giai đoạn 5 — Cảnh báo & báo cáo (1–2 buổi)

* PO quá hẹn giao, tồn dưới mức tối thiểu → đẩy thông báo (logic đã có, thiếu cron).
* Báo cáo tháng cho hai phòng: doanh số theo khách/nhân viên, chi mua theo NCC/nhóm
  vật tư, tỉ lệ giao đúng hẹn của NCC.

---

## 5. Cần chủ dự án chốt

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| **5.1** | Khu xưởng: **tắt khỏi điều hướng** (giữ code, bật lại được) hay **xoá hẳn code**? | **Tắt** — đạt đúng mục tiêu, không mất gì, không rủi ro |
| **5.2** | Xác nhận **giữ LSX** làm bản lề Sale ↔ Cung ứng (đổi nhãn thành "Lệnh/Lô hàng" nếu thấy chữ "sản xuất" gây nhầm)? | Giữ — không có đường nào khác mà không phá đơn mua |
| **5.3** | Kho và Kỹ thuật có nằm trong phạm vi giữ lại không? | **Giữ** — nhập hàng về và định mức là đầu vào bắt buộc của Cung ứng |
| **5.4** | Giá đơn hàng (H1) lấy từ báo giá đã duyệt, hay nhập tay từ file đơn của khách? | Kéo từ báo giá, cho phép sửa tay |
