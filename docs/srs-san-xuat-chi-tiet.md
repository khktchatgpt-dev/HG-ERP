# TÀI LIỆU YÊU CẦU HỆ THỐNG (SRS) — Sản xuất chi tiết theo công đoạn

> Nhận từ doanh nghiệp **11/07/2026** (user gửi trong phiên làm việc). Nguồn
> phân tích: file Excel `Tổng TĐ SX- TK - KT.xlsx` — hệ thống theo dõi sản
> xuất hiện tại của xưởng. Đây là đặc tả SÂU cho phần sản xuất (chi tiết /
> công đoạn / tổ / gia công ngoài), mở rộng vượt scope GĐ1 đã build.
> Phân tích gap + phân kỳ: xem cuối file và `docs/system-status.md`.

## Hệ thống ERP nội bộ — Bộ phận Kế hoạch, Cung ứng & Sản xuất

**Phiên bản:** 1.0
**Ngày:** 11/07/2026
**Đối tượng đọc:** Đội phát triển phần mềm
**Nguồn phân tích:** File `Tổng TĐ SX- TK - KT.xlsx` (hệ thống theo dõi sản xuất hiện tại)

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Bối cảnh nghiệp vụ

Doanh nghiệp sản xuất đồ nội thất kim loại (ghế/bàn — dòng sản phẩm "HALI"), gia công từ ống/thanh sắt và nhôm. Hiện toàn bộ hoạt động kế hoạch — cung ứng — điều độ — theo dõi tiến độ sản xuất được quản lý trên **một file Excel dùng chung** gồm 16 sheet, vận hành thủ công theo quy trình:

`data` (dữ liệu gốc: định mức, quy cách, tổng cần) → `quan li` (sheet TỔNG, tổng hợp 4 công đoạn) → các sheet công đoạn nhập tay theo ngày (`PHÔI`, `HÀN`, `NGUỘI`, `SƠN` và bản theo tổ) → các sheet gia công ngoài (`GIA CÔNG TTP`, `GIA CÔNG VINH`).

Sản phẩm được phân rã thành **chi tiết** (component). Mỗi chi tiết đi qua chuỗi công đoạn:

**PHÔI (cắt sắt)** → **HÀN** → **NGUỘI (mài — đánh bóng)** → **SƠN**, ngoài ra một phần khối lượng được **gia công ngoài** (outsource) tại các đơn vị TTP, Vinh.

Quy mô dữ liệu hiện tại: ~17 mã sản phẩm, ~209 dòng chi tiết, nhập liệu tiến độ theo từng ngày trong tháng cho từng công đoạn và từng tổ.

### 1.2. Vấn đề của cách làm hiện tại

- File Excel dùng chung dễ vỡ công thức, dễ ghi đè, khó nhiều người nhập đồng thời.
- Xuất hiện lỗi tính toán trong dữ liệu thực tế (ví dụ `#DIV/0!` ở cột "số cây cần").
- Không phân quyền: ai cũng sửa được mọi ô.
- Không có lịch sử thay đổi (audit), khó truy vết ai nhập/sửa số liệu.
- Cột ngày cố định theo tháng, phải tạo lại thủ công mỗi tháng.
- Tổng hợp tiến độ, tính thiếu/đủ, đồng bộ bộ chi tiết đều dựa vào công thức thủ công dễ sai.
- Khó liên kết dữ liệu định mức với cung ứng vật tư (số cây/thanh cần mua).

### 1.3. Mục tiêu hệ thống

Xây dựng ERP nội bộ số hóa toàn bộ quy trình trên, đảm bảo:

1. Quản lý tập trung danh mục sản phẩm, chi tiết, định mức (BOM & định mức vật tư).
2. Lập lệnh sản xuất và kế hoạch nhu cầu vật tư từ định mức.
3. Điều độ & theo dõi tiến độ theo từng công đoạn, từng tổ, từng ngày — thay cho lưới nhập tay.
4. Quản lý gia công ngoài (giao — nhận nhiều đợt).
5. Tự động tổng hợp tiến độ, thiếu/đủ, đồng bộ, % hoàn thành, khối lượng (kg).
6. Phân quyền, lịch sử thay đổi, báo cáo.

### 1.4. Phạm vi tài liệu

Tài liệu này đặc tả **yêu cầu chức năng (FR)** và **yêu cầu phi chức năng (NFR)**. Có kèm phụ lục thuật ngữ & thực thể dữ liệu suy ra từ file gốc để đội phát triển hiểu ngữ cảnh; mô hình dữ liệu chi tiết và lộ trình di trú sẽ đặc tả ở tài liệu riêng.

---

## 2. Thuật ngữ & Ánh xạ dữ liệu (từ file Excel)

| Thuật ngữ | Ý nghĩa | Nguồn trong file |
|---|---|---|
| Lệnh sản xuất | Mã lệnh SX (VD `05/25-26`) | `data`/`quan li` cột B |
| Mã SP | Mã sản phẩm (VD `21610-217`) | cột C |
| Cụm | Cụm/nhóm lắp ráp (VD "CỤM TỰA", "CỤM MÊ") | cột D |
| Chi tiết | Component (VD "TAY+TỰA", "GIẰNG TỰA") | cột E |
| Loại bàn/ghế | Dòng sản phẩm (VD "GHẾ HALI") | cột F |
| Vật tư & quy cách | Loại (TRÒN/ĐẶC…), Dày × Rộng × Dài (mm) | cột G–J |
| ĐM (định mức) | Khối lượng vật tư/1 chi tiết (kg) | `data` cột J, `quan li` cột K/N |
| CT/SP | Số chi tiết trên 1 sản phẩm | cột K/L |
| Tổng cần | Tổng số chi tiết cần sản xuất | cột M/P |
| Số cây cần | Số cây/thanh vật tư cần mua (cung ứng) | `data` cột AG |
| SL đã làm | Số lượng đã hoàn thành ở 1 công đoạn | các cột theo công đoạn |
| Khối lượng đã làm (kg) | Kg vật tư đã tiêu hao/hoàn thành | cột R/Y/AF/AM… |
| Phế phẩm / Lỗi sơn | Số lượng hỏng theo công đoạn | `quan li` cột W/AD/AK/AR |
| Thiếu/(Dư) | Chênh lệch giữa tổng cần và đã làm | công đoạn cột "Thiếu/(Dư)" |
| % HT | Phần trăm hoàn thành | cột "% HT" / AS |
| Đồng bộ chi tiết / SP | Số bộ chi tiết/sản phẩm đã đủ đồng bộ | `data` cột AD/AE |
| SL giao 1/2/3, Tổng giao | Các đợt giao hàng gia công ngoài | `GIA CÔNG TTP/VINH` |

Các công đoạn nội bộ: **PHÔI (cắt sắt)** → **HÀN** → **NGUỘI (mài, đánh bóng)** → **SƠN**. Các tổ ghi nhận trong file: Tổ Lâm, Tổ Sinh, Tổ Hồng; phân theo vật liệu Sắt / Nhôm. Gia công ngoài: TTP, Vinh.

---

## 3. Vai trò người dùng (Actors)

| Mã | Vai trò | Trách nhiệm chính |
|---|---|---|
| U1 | Quản trị hệ thống (Admin) | Cấu hình danh mục, phân quyền, sao lưu |
| U2 | Nhân viên Kế hoạch | Lập lệnh sản xuất, kế hoạch, đặt hạn |
| U3 | Nhân viên Cung ứng / Vật tư | Tính nhu cầu vật tư, quản lý số cây cần, tồn kho vật tư |
| U4 | Điều độ / Quản đốc sản xuất | Phân việc công đoạn, theo dõi tiến độ, duyệt |
| U5 | Tổ trưởng / Công nhân nhập liệu | Nhập SL đã làm hằng ngày theo công đoạn/tổ |
| U6 | Phụ trách gia công ngoài | Quản lý giao/nhận đơn vị TTP, Vinh |
| U7 | Ban lãnh đạo (chỉ xem) | Xem dashboard, báo cáo tổng hợp |

---

## 4. Yêu cầu chức năng (Functional Requirements)

Quy ước: **M** = bắt buộc (Must), **S** = nên có (Should), **C** = có thể (Could).

### 4.1. Module Danh mục nền (Master Data)

- **FR-MD-01 (M):** Quản lý danh mục **Sản phẩm** (Mã SP, dòng sản phẩm/loại bàn-ghế, mô tả). Thêm/sửa/xóa mềm, tìm kiếm.
- **FR-MD-02 (M):** Quản lý danh mục **Chi tiết** thuộc sản phẩm: tên chi tiết, cụm, loại vật tư (TRÒN/ĐẶC…), quy cách (dày × rộng × dài mm), số CT/SP.
- **FR-MD-03 (M):** Quản lý **định mức vật tư (ĐM)** theo chi tiết: kg vật tư/1 chi tiết, độ dày, hệ số quy đổi ra "số cây/thanh cần".
- **FR-MD-04 (M):** Quản lý danh mục **Vật tư** (ống/thanh sắt, nhôm) với quy cách chuẩn, chiều dài cây tiêu chuẩn, đơn giá, đơn vị.
- **FR-MD-05 (M):** Quản lý cấu trúc sản phẩm dạng **BOM** (Sản phẩm → Cụm → Chi tiết → Vật tư & định mức). Hỗ trợ phiên bản BOM.
- **FR-MD-06 (M):** Quản lý danh mục **Công đoạn** (PHÔI, HÀN, NGUỘI, SƠN) và **Tổ/Nhân sự** (Tổ Lâm, Sinh, Hồng…), **Đơn vị gia công ngoài** (TTP, Vinh).
- **FR-MD-07 (S):** Quản lý **Máy/Thiết bị** (máy cắt, loại máy hàn) và loại/màu sơn phục vụ ghi nhận công đoạn.
- **FR-MD-08 (S):** Nhập khẩu danh mục & định mức từ Excel/CSV để chuyển đổi dữ liệu từ file hiện tại.

### 4.2. Module Kế hoạch & Lệnh sản xuất

- **FR-PL-01 (M):** Tạo **Lệnh sản xuất** với mã lệnh, sản phẩm, số lượng sản phẩm cần, ngày yêu cầu.
- **FR-PL-02 (M):** Hệ thống tự **bung nhu cầu chi tiết**: từ số lượng sản phẩm × CT/SP → "Tổng cần" cho từng chi tiết (thay công thức tổng cần thủ công hiện tại).
- **FR-PL-03 (M):** Tự tính **kế hoạch nhu cầu vật tư**: từ tổng cần × ĐM → khối lượng (kg) và **số cây/thanh cần** theo từng loại vật tư; xử lý an toàn chia 0 (không phát sinh `#DIV/0!`).
- **FR-PL-04 (S):** Gộp nhu cầu vật tư của nhiều lệnh SX để đặt mua theo lô (tổng hợp cung ứng).
- **FR-PL-05 (S):** Đặt **hạn (deadline)** cho lệnh và cho từng công đoạn; cảnh báo trễ hạn.
- **FR-PL-06 (C):** Lập lịch/điều phối năng lực theo tổ (capacity planning) ở mức cơ bản.

### 4.3. Module Cung ứng / Vật tư

- **FR-SC-01 (M):** Hiển thị **bảng nhu cầu vật tư** theo lệnh SX/kỳ: số cây cần, kg cần, quy đổi theo chiều dài cây tiêu chuẩn.
- **FR-SC-02 (S):** Quản lý **tồn kho vật tư** cơ bản (nhập — xuất — tồn) và so sánh nhu cầu vs tồn để ra "số cần mua".
- **FR-SC-03 (S):** Tạo **yêu cầu mua / đơn đặt hàng** vật tư từ nhu cầu; theo dõi trạng thái đã nhận.
- **FR-SC-04 (C):** So sánh **định mức vs thực tế tiêu hao** (kg đã làm) để phát hiện hao hụt bất thường.

### 4.4. Module Điều độ & Theo dõi công đoạn (lõi hệ thống)

- **FR-PR-01 (M):** Mỗi chi tiết trong lệnh SX có **tiến độ theo 4 công đoạn** (PHÔI → HÀN → NGUỘI → SƠN), thay cho các sheet công đoạn hiện tại.
- **FR-PR-02 (M):** **Nhập sản lượng hằng ngày** theo công đoạn: chọn ngày → nhập SL đã làm cho chi tiết. Không giới hạn theo cột tháng cố định; ngày do hệ thống quản lý (khắc phục việc phải tạo cột tháng thủ công).
- **FR-PR-03 (M):** Mỗi bản ghi sản lượng lưu: SL đã làm, **khối lượng (kg)**, ngày, **người làm/tổ**, máy/quy cách (hoặc loại máy hàn / thao tác nguội / màu-loại sơn tùy công đoạn), **phế phẩm/lỗi**, ghi chú ("hàng trần", "hàng đang mây"…).
- **FR-PR-04 (M):** Tự tổng hợp theo chi tiết & công đoạn: **Tổng đã làm, Thiếu/(Dư) = Tổng cần − Tổng đã làm, % HT**. Đây là thay thế trực tiếp cho các cột tổng hợp trong file.
- **FR-PR-05 (M):** Tính **trạng thái** chi tiết/lệnh (Chưa làm / Đang làm / Hoàn thành) và **% hoàn thành tổng** trên toàn chuỗi công đoạn (cột TIẾN ĐỘ trong `quan li`).
- **FR-PR-06 (S):** Tính **đồng bộ**: số bộ chi tiết/sản phẩm đã đủ đồng bộ (dựa trên chi tiết chậm nhất trong cụm/sản phẩm) — số hóa cột "đồng bộ chi tiết / đồng bộ sản phẩm".
- **FR-PR-07 (M):** Ràng buộc dữ liệu: chỉ nhập số ở ô sản lượng; không cho nhập vượt hợp lý (cảnh báo khi đã làm > tổng cần), kiểm tra kiểu dữ liệu.
- **FR-PR-08 (S):** Ghi nhận & phân biệt theo **tổ** (Tổ Lâm/Sinh/Hồng) và **vật liệu** (Sắt/Nhôm), tương ứng các sheet tổ hiện tại; cho phép lọc theo tổ.
- **FR-PR-09 (S):** Màn hình nhập nhanh dạng lưới (grid) giống thói quen Excel để giảm rào cản chuyển đổi cho tổ trưởng.
- **FR-PR-10 (C):** Nhập liệu trên thiết bị di động/máy tính bảng tại xưởng.

### 4.5. Module Gia công ngoài (Outsourcing)

- **FR-OS-01 (M):** Tạo **phiếu giao gia công** cho đơn vị ngoài (TTP, Vinh): chi tiết, số lượng giao, ngày giao — hỗ trợ **nhiều đợt giao** (SL giao 1/2/3) và tổng giao.
- **FR-OS-02 (M):** Ghi nhận **số lượng nhận về / đã làm**, khối lượng (kg), Thiếu/(Dư) so với đã giao, % HT, người phụ trách.
- **FR-OS-03 (S):** Đối chiếu công nợ/khối lượng gia công theo đơn vị và theo kỳ.
- **FR-OS-04 (S):** Gộp tiến độ gia công ngoài vào tiến độ tổng của chi tiết/lệnh (nếu công đoạn được outsource).

### 4.6. Module Báo cáo & Dashboard

- **FR-RP-01 (M):** **Dashboard tổng** thay sheet `quan li`: theo lệnh SX hiển thị mọi chi tiết với tiến độ 4 công đoạn, thiếu/đủ, % HT, trạng thái.
- **FR-RP-02 (M):** Báo cáo **tiến độ theo ngày/tuần/tháng** theo công đoạn, theo tổ, theo đơn vị gia công.
- **FR-RP-03 (S):** Báo cáo **khối lượng (kg) sản xuất** và **phế phẩm/lỗi** theo công đoạn/tổ để đánh giá chất lượng & năng suất.
- **FR-RP-04 (S):** Báo cáo **nhu cầu & tiêu hao vật tư** (số cây cần, kg) theo lệnh/kỳ.
- **FR-RP-05 (M):** **Xuất Excel/PDF** cho tất cả báo cáo (giữ khả năng in ấn nội bộ như hiện tại).
- **FR-RP-06 (C):** Cảnh báo tự động (dashboard/thông báo) khi trễ hạn, thiếu đồng bộ, hoặc phế phẩm vượt ngưỡng.

### 4.7. Module Quản trị & Hệ thống

- **FR-SY-01 (M):** **Phân quyền theo vai trò** (RBAC) theo mục 3; giới hạn quyền sửa theo module/công đoạn/tổ.
- **FR-SY-02 (M):** **Nhật ký thay đổi (audit log)**: ai, khi nào, sửa gì (thay cho "Nhật ký cập nhật" thủ công trong file).
- **FR-SY-03 (M):** **Sao lưu & phục hồi** dữ liệu định kỳ (thay quy trình backup file tay 1 lần/tuần).
- **FR-SY-04 (S):** Cấu hình tham số hệ thống (kỳ sản xuất, đơn vị, quy cách cây tiêu chuẩn, ngưỡng cảnh báo).
- **FR-SY-05 (S):** Chốt kỳ theo tháng (đóng kỳ, mở kỳ mới) mà không cần tạo cột/sheet mới.

---

## 5. Yêu cầu phi chức năng (Non-Functional Requirements)

### 5.1. Hiệu năng (Performance)

- **NFR-PF-01:** Màn hình danh sách/dashboard tải ≤ 3 giây với dữ liệu tương đương hiện tại (≥ 20 SP, ≥ 500 dòng chi tiết, dữ liệu tiến độ ≥ 12 tháng).
- **NFR-PF-02:** Lưu một bản ghi nhập sản lượng phản hồi ≤ 1 giây.
- **NFR-PF-03:** Báo cáo tổng hợp theo kỳ xuất kết quả ≤ 5 giây.

### 5.2. Đồng thời & Toàn vẹn dữ liệu

- **NFR-CC-01:** Hỗ trợ ≥ 20 người dùng nhập liệu đồng thời không xung đột (khắc phục hạn chế của file Excel dùng chung).
- **NFR-CC-02:** Cơ chế khóa/giao dịch để hai người sửa cùng bản ghi không ghi đè mất dữ liệu.
- **NFR-CC-03:** Mọi phép tính (tổng cần, thiếu/đủ, %, số cây, đồng bộ) tính ở tầng server, đảm bảo nhất quán; **không bao giờ hiển thị lỗi kiểu `#DIV/0!`** — mọi mẫu số 0 phải xử lý an toàn.

### 5.3. Bảo mật (Security)

- **NFR-SE-01:** Xác thực người dùng (tài khoản/mật khẩu, tùy chọn SSO nội bộ); mật khẩu lưu dạng băm.
- **NFR-SE-02:** Phân quyền RBAC ở cả tầng API và giao diện; người chỉ-xem không thể sửa.
- **NFR-SE-03:** Kênh truyền mã hóa (HTTPS/TLS) nếu triển khai web.
- **NFR-SE-04:** Lưu vết truy cập/thao tác nhạy cảm (đăng nhập, sửa định mức, xóa dữ liệu) tối thiểu 12 tháng.

### 5.4. Độ tin cậy & Sẵn sàng

- **NFR-RL-01:** Sao lưu tự động hằng ngày; RPO ≤ 24 giờ, RTO ≤ 4 giờ.
- **NFR-RL-02:** Độ sẵn sàng trong giờ làm việc ≥ 99%.
- **NFR-RL-03:** Xóa dữ liệu là **xóa mềm** (soft delete), có thể khôi phục.

### 5.5. Khả dụng (Usability)

- **NFR-US-01:** Giao diện **tiếng Việt**, thuật ngữ đúng nghiệp vụ xưởng (PHÔI, HÀN, NGUỘI, SƠN, tổng cần, thiếu/dư…).
- **NFR-US-02:** Màn hình nhập sản lượng theo lối **lưới giống Excel** để tổ trưởng làm quen nhanh; tối thiểu thao tác để nhập 1 dòng.
- **NFR-US-03:** Quy ước màu/tín hiệu trạng thái rõ ràng (chưa làm / đang làm / hoàn thành / trễ hạn) kế thừa quy ước màu hiện có.
- **NFR-US-04:** Có hướng dẫn sử dụng trong ứng dụng (kế thừa nội dung sheet "HƯỚNG DẪN SỬ DỤNG").

### 5.6. Khả năng bảo trì & Mở rộng

- **NFR-MT-01:** Kiến trúc module hóa theo các module ở mục 4 để mở rộng (thêm công đoạn, thêm tổ, thêm đơn vị gia công) qua cấu hình, không sửa mã.
- **NFR-MT-02:** Định mức/BOM có phiên bản; thay đổi định mức không phá dữ liệu lịch sử.
- **NFR-MT-03:** Có API nội bộ (REST) để tích hợp về sau (kế toán, mua hàng).

### 5.7. Tương thích & Chuyển đổi dữ liệu

- **NFR-CP-01:** Nhập khẩu dữ liệu ban đầu từ file Excel hiện tại (danh mục, định mức, tiến độ đang chạy) đảm bảo khớp số liệu.
- **NFR-CP-02:** Xuất Excel/PDF tương thích để in và lưu trữ như thói quen hiện tại.
- **NFR-CP-03:** Chạy trên trình duyệt phổ biến (Chrome/Edge) trên máy tính xưởng; không yêu cầu cấu hình cao.

### 5.8. Quốc tế hóa & Đơn vị

- **NFR-IL-01:** Đơn vị đo chuẩn: kích thước mm, khối lượng kg, vật tư theo "cây/thanh"; định dạng số & ngày theo chuẩn Việt Nam (dd/mm/yyyy).

### 5.9. Kiểm thử & Nghiệm thu

- **NFR-QA-01:** Các công thức nghiệp vụ (tổng cần, số cây cần, thiếu/dư, %, đồng bộ) phải có **unit test** đối chiếu kết quả với file Excel mẫu.
- **NFR-QA-02:** Có bộ dữ liệu mẫu và kịch bản UAT cho từng vai trò trước khi go-live.

---

## 6. Ràng buộc & Giả định

- Hệ thống triển khai nội bộ (LAN hoặc server nội bộ); người dùng chủ yếu tại văn phòng và xưởng.
- Quy trình công đoạn cố định 4 bước nội bộ + gia công ngoài; nếu thay đổi sẽ cấu hình bằng danh mục công đoạn.
- Dữ liệu định mức/quy cách do bộ phận kỹ thuật cung cấp và chịu trách nhiệm tính đúng.
- Tài liệu này tập trung yêu cầu chức năng & phi chức năng; mô hình dữ liệu chi tiết và lộ trình di trú lập ở tài liệu tiếp theo.

---

## 7. Phụ lục A — Thực thể dữ liệu gợi ý (tham khảo cho đội phát triển)

Suy ra từ file Excel để định hướng thiết kế (không phải mô hình cuối cùng):

- **SanPham** (MaSP, DongSP, MoTa)
- **ChiTiet** (id, MaSP, Cum, TenChiTiet, LoaiVatTu, Day, Rong, Dai, CT_tren_SP)
- **VatTu** (id, Ten, QuyCach, ChieuDaiCayChuan, DonGia, DonVi)
- **DinhMuc/BOM** (ChiTiet_id, VatTu_id, DM_kg, DoDay, HeSoQuyDoiCay, PhienBan)
- **LenhSanXuat** (MaLenh, MaSP, SoLuongSP, NgayYeuCau, TrangThai)
- **NhuCauChiTiet** (LenhSX_id, ChiTiet_id, TongCan)  ← bung từ lệnh
- **NhuCauVatTu** (LenhSX_id, VatTu_id, Kg, SoCayCan)
- **CongDoan** (id, Ten: PHOI/HAN/NGUOI/SON, ThuTu)
- **To/NhanSu** (id, Ten, VatLieu: Sat/Nhom)
- **BanGhiSanLuong** (ChiTiet_id, CongDoan_id, To_id, Ngay, SL, Kg, May/Mau, PhePham, GhiChu)
- **DonViGiaCongNgoai** (id, Ten: TTP/Vinh)
- **PhieuGiaCongNgoai** (id, ChiTiet_id, DonVi_id) + **DotGiao** (Phieu_id, SoDot, SLGiao, Ngay) + **NhanVe** (SL, Kg, ThieuDu)
- **NguoiDung** (id, HoTen, VaiTro) + **AuditLog** (NguoiDung_id, HanhDong, BanGhi, ThoiGian)

Các đại lượng tính toán (derived, không lưu cứng): TongCan, SoCayCan, TongDaLam, ThieuDu, %HT, DongBoChiTiet, DongBoSanPham, TrangThai.

---

*Hết tài liệu — Phiên bản 1.0*
