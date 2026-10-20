# Quản lý sản xuất — Phân tích chi tiết vs ERP & Kế hoạch hoàn thiện

**Ngày:** 18/09/2026  
**Phạm vi:** So sánh thiết kế HG-ERP với SAP, Odoo, Dynamics, NetSuite + đề xuất hoàn thiện toàn khu sản xuất

---

## 1. Hiện trạng: Năm màn dựng xong, không có dữ liệu thật

### Giao diện đã sẵn sàng (M1–M5)

| # | Màn | Khuôn | Trạng thái | Chức năng |
|---|-----|-------|-----------|----------|
| M1 | Tình hình xưởng | A | ✅ Xong | 6 ô việc bấm được → danh sách lọc, nhịp hôm nay, dải 12 công đoạn |
| M2 | Lệnh sản xuất | C | ✅ Xong | Chip lọc (chạy/trễ/chưa định hình), gom theo khách/hạn/trạng thái |
| M3 | Chi tiết lệnh | D | ✅ Xong | DocHead + StatusTrack + HolderBar (ai đang giữ) + 6 tab + chatter |
| M4 | Ghi sản lượng | F | ✅ Xong | Lưới Excel (đóng băng + dán Excel), HeadChips, CommitBar |
| M5 | Việc của tổ | A | ✅ Xong | Ô việc + danh sách (chỉ-đọc, tổ trưởng không ghi) |

**Kết quả:** 5 màn đều có layout đầy đủ, validate, animation, bộ lọc, bàn phím...

### Vấn đề cốt lõi: 0 dòng sổ thật

| Bảng | Số dòng | Hệ quả |
|------|---------|--------|
| `production_entries` | 0 | Sổ ghi sản lượng ngày-tổ-công đoạn **rỗng** |
| `production_entry_docs` | 0 | Phiếu PBS/PHO/PXL không có |
| `production_transfers` | 0 | Chuyển giao giữa tổ không ghi được |
| `production_day_locks` | 0 | Chốt sổ ngày không có |
| `production_daily_targets` | 0 | Chỉ tiêu ngày không ghi |

**Hệ quả hình thức:** Năm màn vừa dựng **trống hết**, mọi ô/chip/tab/dải = 0

### Năm lỗ hổng máy trạng thái (không phải UI)

| # | Lỗ hổng | Biểu hiện | Gốc | Cách gỡ |
|---|---------|-----------|------|---------|
| **A** | "Đang SX" tự đổi | MÁY đổi khi có PBS đầu → không ai bấm kiểm soát | `entriesService.record` kích hoạt `markDoing` | ❓ Chấp nhận hay quản? |
| **B** | Không ai đóng lệnh | 5 lệnh quá hạn xuất vẫn mở (07/09, 13/09) | Không có nút "Đóng" hay gate tự động | Cần nút "Đóng lệnh" trên M3 |
| **C** | Mở khoá sổ (ghi nhầm) chỉ GĐ | Thống kê chốt nhầm phải gọi Giám đốc | `production.daylock.unlock` chỉ director+admin | Thêm quyền cho `production_stat` |
| **D** | "Đã duyệt" không có chủ | Trạng thái chết → 13/19 lệnh nằm im ≥3 ngày | Không có người giữ bóng sau duyệt | Cần `HolderBar` phân biệt "chờ Cung ứng" vs "chờ Xưởng" |
| **E** | Xoá phiếu (cứng) | Trái nguyên lý "không xoá chỉ đảo" | API `DELETE entries/[id]` | Đổi thành "Đảo trạng thái" (đã sửa ở M4) |

---

## 2. So sánh chi tiết với bốn ERP lớn

### Cách chia màn (căn bản trong thiết kế)

| Khía cạnh | HG-ERP | SAP S/4HANA PP | Odoo MRP | Dynamics 365 SCM | NetSuite |
|-----------|--------|----------------|----------|-----------------|----------|
| **Danh sách lệnh** | M2 + chip lọc | Manage Production Orders + variant | Manufacturing Orders + kanban | All production orders + fastTab | Work Orders list |
| **Chi tiết lệnh** | M3 + 6 tab | Object Page (many tabs) | MO form (lightweight) | Details master + Related info | WO record + subtabs |
| **Công đoạn xuyên lệnh** | M1 dải 12 ô | Monitor Production Operations | Work Orders menu | Job list per work center | Operation list |
| **Ghi sản lượng** | M4 lưới Excel | Collective Confirmation (CO12) | QC check + register | Journal lines | Mass build |
| **Quản đốc** | M1 ô ngoại lệ | Production Supervisor Overview | Overview kanban | Workspace KPI | Dashboard portlet |
| **Bàn xưởng** | M5 (chỉ-đọc) | Confirm Production Operation (CO11N) | **Shop Floor** (tablet/terminal) | Production floor execution | Manufacturing Mobile |

### Bảy điểm học được từ lớn

**1. HAI BỀ MẶT, không phải nhiều khu**
- HG đang chia thành 4 khu (`/production` + `/kehoach-sx` + `/thongke` + `/to`)
- **ERP chỉ chia theo tư thế làm việc:** văn phòng (danh sách + tab + bộ lọc) vs mặt xưởng (một việc mỗi lần + nút to)
- **Đề xuất:** Gộp 3 khu văn phòng thành `/san-xuat` (quản đốc + kế hoạch + thống kê cùng một sidebar), giữ `/to` làm bề mặt xưởng

**2. Chứng từ = một trang, nhiều tab**
- HG đã có M3 theo đúng mô hình (khuôn D): DocHead + Tab [Tiến độ] [Chi tiết] [Kế hoạch] [Vật tư] [Phiếu] [Trao đổi]
- ✅ **Đúng thiết kế**

**3. Nhìn theo CÔNG ĐOẠN xuyên lệnh**
- HG có M2 gom theo lệnh (chưa có màn theo công đoạn)
- SAP: "Monitor Production Operations" (công đoạn → lệnh nào)
- Odoo: "Work Orders" menu riêng
- ❓ Chưa làm: tổ Phôi không quan tâm lệnh nào, họ hỏi "hôm nay tổ tôi phải phôi những gì"

**4. Ghi nhận = sản lượng + phế + lý do, tại chỗ**
- HG M4 đúng: 3 ô [SL] [Phế] [Lý do] cạnh nhau trên cùng lưới
- ✅ **Đúng thiết kế**

**5. Trang quản đốc = ô NGOẠI LỆ BẤM ĐƯỢC**
- HG M1 đúng: 6 ô "Lệnh trễ hạn" "Lệnh chưa định hình" "Thiếu VT" v.v → bấm ra danh sách đã lọc
- ✅ **Đúng thiết kế**

**6. Chatter trên chứng từ**
- HG M3 đã có `DocNotesPanel` (trao đổi + người theo dõi)
- ✅ **Đúng thiết kế**

**7. Kiểm đủ vật tư TRƯỚC khi thả**
- HG có dữ liệu (`v_lsx_material_status`) nhưng chưa đặt cảnh báo vào luồng
- ❓ Cần thêm: M3 tab Vật tư phải BẤM ĐƯỢC để xem phiếu PO đang về

---

## 3. Khoảng trống cần bổ sung để sản xuất thật

### 3.1 Chặng sau sơn — ĐÃ GIẢI QUYẾT 18/09, KHÔNG phải việc còn nợ

**Cảnh báo cho người đọc sau:** bản đầu của tài liệu này liệt kê "chặng sau sơn
chưa tồn tại" là lỗ hổng lớn nhất. **Sai.** Nó đã được dựng xong ngày 18/09,
trước khi tài liệu này được viết. Ghi lại ở đây vì cái bẫy dễ tái phạm: đọc
`lib/stage-route.ts` thấy lộ trình dừng ở `son` rồi kết luận thiếu — nhưng chặng
thành phẩm **cố ý không đi qua đường đó**.

**Nó chạy thế nào (đúng thiết kế):**

- Bốn công đoạn `lap_rap` · `bao_bi` · `dong_goi` · `hoan_thien` đã có trong
  danh mục `catalog_items` (type `production_stage`, sort 9→12) từ migration
  0011/0072/0082/0083. **Không cần thêm migration nào.**
- `src/lib/finish-stages.ts` gắn chặng này vào **DÒNG SP**, không vào nhóm vật
  tư: mỗi dòng SP có thêm một dòng ảo "Bộ thành phẩm" (`finish:<line_id>`), đơn
  vị BỘ, cần = SL đặt. Vật chất hoá ở lượt ghi đầu, y như cụm mặc nhiên.
- `entries.service` đã nối đủ: vật chất hoá dòng ảo, ép lộ trình qua
  `finishRouteOverride`, loại dòng thành phẩm khỏi `synced_sets`.

**ĐỪNG thêm `lap_rap`/`hoan_thien` vào `ROUTE_BY_GROUP.PACKAGING`.** Nhóm
PACKAGING trong hồ sơ SP là carton / màng PE / lót góc / tem — **vật tư tiêu
hao**, không phải thứ tổ nào gia công. Đưa chúng vào lộ trình lắp ráp là bắt
thống kê ghi "hôm nay lắp ráp được 200 cái carton". Lý do này đã ghi sẵn trong
đầu file `finish-stages.ts`; tôi vẫn sửa nhầm một lần ngày 18/09 và phải revert.

**Việc còn lại thật sự của chặng này:** chưa tổ nào mang `stage_code` =
`lap_rap`/`bao_bi`/`dong_goi`/`hoan_thien`, nên màn ghi sổ mở bốn tab đó ra thì
không gợi được tổ. Chỉ gán được sau khi xưởng cho biết bốn bước này do một tổ
"hoàn thiện" làm hay bốn tổ riêng — **câu nghiệp vụ, không phải việc code.**

### 3.2 Ba năng lực backend chưa có màn

| Năng lực | API | Service | Màn | Hậu quả |
|----------|-----|---------|-----|---------|
| **Gia công ngoài** | ✅ | ✅ | ❌ | Hàng gửi NCC làm không nhập được → sản lượng công đoạn **hụt** so với thực |
| **Báo cáo kỳ** | ✅ + Excel | ✅ | ❌ | Không có trang tóm tắt kỳ (cần xuất Excel thủ công) |
| **Giao tổ / WIP** | ✅ | ✅ | ❌ | Chuyển giao giữa tổ có tính dồn vào "công đoạn sau" không? |

**Ưu tiên làm:**
1. **Gia công ngoài (CẤP NHẤT)** — người dùng gửi hàng cho NCC làm ngoài, cần ghi lại sản lượng → sổ SX âm (đã bù bằng lệnh gia công thành phẩm nhưng cần giao diện rõ ràng)
2. **Báo cáo kỳ** — sau khi có vài tuần số
3. **Giao tổ / WIP** — sau khi M4 chạy thật, xác nhận luồng

### 3.3 Định mức: nút thắt KHÔNG ở phần mềm

**Đo 18/09 trên 14 lệnh:**
- Dòng SP: 206 (125 mã)
- **Dòng KHÔNG có định mức ở hồ sơ SP: 158 (77%)**
- Mã SP thiếu định mức: 79
- **Số bộ bị kẹt: 22.484 / 52.282 (43%)**

**Chuỗi phụ thuộc là một chiều, không có đường vòng:**
```
Hồ sơ SP có định mức  →  Định hình chi tiết  →  Ghi sổ sản lượng  →  Mọi màn có số
```

**Không có mắt xích đầu thì bốn màn vừa dựng vĩnh viễn trống.**

**Việc phải làm (xếp độ rẻ):**
1. **9 dòng đã có định mức mà chưa định hình** — bấm "Định hình từ BOM" = xong (rẻ nhất)
2. **5 mã SP đã có file BOM đính kèm** — chạy AI đọc file = nháp định mức, Kỹ thuật soi
3. **74 mã SP chưa có file BOM** — file nằm trên Drive (đã rà 415 file 08/09), cần một đợt nạp file + AI

---

## 4. Đề xuất chiến lược hoàn thiện (từng bước)

### Thứ tự không liên hoàn

Sau khi chịu đựng các bước "làm màn rồi mới chạy thử" vẫn trống, **quyết định phải giao ngược: làm dữ liệu TRƯỚC, rồi mới dựng màn.**

**Nguyên tắc:** Một màn chỉ dựng khi có SỐ để test, không dựng màn rỗng.

### Đợt 1: Dọn nền (nước ngoài)

**Scope:** Vá 5 lỗ hổng máy trạng thái + cấp quyền + thêm công đoạn

| # | Việc | Trạng thái | Ghi chú |
|---|------|-----------|---------|
| 1.1 | 4 công đoạn sau sơn trong danh mục | ✅ **đã có sẵn** | 0011/0072/0082/0083 — không cần migration mới |
| 1.2 | Dòng "Bộ thành phẩm" + nối vào `entries.service` | ✅ **xong 18/09** | `lib/finish-stages.ts` + test |
| 1.3 | Mở khoá sổ ngày cho `production_stat` | ✅ **xong 18/09** | migration 0205, đã apply remote |
| 1.4 | Vai `production_manager` (quản đốc) + 6 quyền | ✅ **xong 18/09** | migration 0205, gán 3 người Xưởng SX |
| 1.5 | `stage_code` cho tổ Lắp ráp/Bao bì/Đóng gói/Hoàn thiện | ❓ **chờ user** | Bốn bước = một tổ hay bốn tổ? Câu nghiệp vụ |
| 1.6 | Nút "Đóng lệnh" trên M3 (lỗ hổng B) | ✅ **xong 18/09** | Service đã có sẵn; chỉ thiếu đường bấm. Nghiệm thu trên lệnh thật |
| 1.7 | Đảo phiếu thay xoá cứng (lỗ hổng E) | ❓ **cần kiểm** | Chưa xác minh trên mã hiện tại |

**Vòng 1 gần như đã xong từ 18/09.** Việc code còn lại duy nhất là **1.6 nút
Đóng lệnh**; 1.5 chờ một câu trả lời của xưởng, không phải chờ dev.

### Đợt 2: Nạp định mức từ 74 mã SP chưa có file

**Scope:** Bóc file BOM từ Drive + chạy AI + lưu hồ sơ SP

| # | Việc | Ưu tiên | Thời gian | Kết quả |
|---|------|--------|----------|--------|
| 2.1 | Khớp 74 mã SP với 415 file BOM trên Drive | 🔴 | 1-2 ngày | 74 file (có thể trùng/thiếu) |
| 2.2 | Chạy AI đọc file (Gemini + schema) | 🔴 | 1-2 ngày (nếu file đầy đủ) | 74 bản nháp định mức |
| 2.3 | Kỹ thuật duyệt + lưu (bấm "Xác nhận" ở /products) | 🟠 | 3-5 ngày (chế độ thủ công) | 74 mã có định mức |

**Kết quả:** 79 mã còn lại có định mức → định hình được 158 dòng → ghi sổ M4 có số

### Đợt 3: Chạy thử một lệnh một tuần (cần user thí điểm)

**Scope:** Chạy thật lệnh (chuỗi định hình → ghi sổ → chốt sổ)

| # | Việc | Ưu tiên | Khi nào | Kết quả |
|---|------|--------|---------|--------|
| 3.1 | Chọn lệnh test + định hình nếu chưa | 🔴 | Tuần 1 | 1 lệnh sạch, 1+ công đoạn/tổ |
| 3.2 | Thống kê ghi sổ ngày (M4) + chốt sổ (P1) | 🔴 | Tuần 1-2 | ~5-10 phiếu PBS, 1-2 day_lock |
| 3.3 | User kiểm tra: M1/M2/M3 có số chưa? Sai chỗ nào? | 🔴 | Tuần 2-3 | Bug report + điều chỉnh |
| 3.4 | Nạp 9 dòng còn lại (chưa định hình nhưng có BOM) | 🟡 | Nếu lệnh test chạy trơn | Chuẩn bị vòng 2 |

**Kết quả:** Luồng thật "định hình → ghi → kiểm tra số" chạy một lần → phát hiện lỗi gốc

### Đợt 4: Bổ sung ba màn còn lại (dựa vào dữ liệu thật)

**Scope:** Gia công ngoài + Báo cáo kỳ + Giao tổ (chỉ làm nếu có dữ liệu)

| # | Việc | Khi nào | Điều kiện |
|---|------|---------|----------|
| 4.1 | Màn **Gia công ngoài** | Sau đợt 3 | Xác nhận xưởng đã gửi hàng cho NCC |
| 4.2 | Màn **Báo cáo kỳ** | Sau 2-3 tuần số | Có 50+ phiếu để tổng hợp |
| 4.3 | Màn **Giao tổ / WIP** | Sau xác nhận luồng | Xác nhận có chuyển giao giữa tổ không |

### Đợt 5: Tối ưu UI (chỉ sau khi tất cả chạy thật)

- Bỏ trần 1000 dòng / tối ưu query
- Thêm bàn phím tắt / drag-drop (nếu cần)
- In phiếu (cộng 10 lệnh test nếu số đã chắc)

---

## 5. Ma trận ưu tiên & dự kiến thời gian

### Vòng 1: Gốc rễ (tuần 1-2 sau quyết định)

| # | Việc | Độ khó | Thời gian | Vai | Chặn gì |
|---|------|--------|----------|-----|---------|
| 1.6 | Nút "Đóng lệnh" (lỗ hổng B) | 🟢 | 1 ngày | Dev | Không |
| 1.7 | Kiểm + vá đảo phiếu (lỗ hổng E) | 🟢 | 0.5 ngày | Dev | Không |
| 1.5 | `stage_code` bốn tổ chặng thành phẩm | 🟢 | 0.5 ngày | Dev | **Câu hỏi cho xưởng** |
| 2.1-2.3 | Nạp 74 mã từ Drive | 🟠 | 2-3 ngày | Kỹ thuật (user) | File Drive |
| Tổng | **Tuần 1-2** | | | | |

### Vòng 2: Thử lên lệnh (tuần 2-3)

| # | Việc | Ai | Thời gian | Phụ thuộc |
|---|------|-----|----------|----------|
| 3.1 | Định hình 1 lệnh (chuẩn bị) | Kỹ thuật | 0.5 ngày | 2.3 xong |
| 3.2 | Ghi sổ từ 1 tổ trong 7 ngày | Thống kê | 5-7 ngày | 3.1 xong |
| 3.3 | Kiểm tra số trên M1/M2/M3 | Kỹ thuật + User | 2-3 ngày | 3.2 xong |
| 3.4 | Nạp 9 dòng còn lại nếu cần | Kỹ thuật | 0.5 ngày | 3.3 OK |
| Tổng | **Tuần 2-3** | | | |

### Vòng 3: Mở rộng (tuần 4+)

| # | Việc | Khi nào | Thời gian |
|---|------|---------|----------|
| 4.1 | Gia công ngoài | Sau tuần 3 | 1-2 ngày |
| 4.2 | Báo cáo kỳ | Sau tuần 5 | 1 ngày |
| 4.3 | Giao tổ / WIP | Sau xác nhận | 1-2 ngày |

---

## 6. Câu phải chốt (chưa trả lời)

1. **Gộp ba khu thành `/san-xuat` hay giữ bốn khu?** (mâu thuẫn quyết định 07/2026)
2. **Q1** — Ai ghi sổ? (7 thống kê mỗi tổ hay 2 người ôm nhiều tổ)
3. **Q2** — Tổ trưởng có đăng nhập không? (quyết định M5 có tồn tại)
4. **Q3** — Giao hàng giữa tổ có đếm không? (quyết định cấu trúc transfer)
5. **Q6** — Mài và mộc do tổ nào làm? (đã chốt bỏ, nhưng cần xác nhận)
6. **Chatter trên lệnh** — Làm hay không? (kit sẵn sàng, nhưng Odoo mới có)

---

## 7. Mục tiêu cuối cùng

**Khi nào xong?**
- Sau vòng 1 (tuần 2): Chặng sau sơn tồn tại, quyền sửa, 74 mã có định mức
- Sau vòng 2 (tuần 3): Một lệnh chạy thật → phát hiện lỗi logic
- Sau vòng 3 (tuần 5+): Toàn khu sản xuất chạy được 80% trường hợp thật

**Kỳ vọng:** Không phải tất cả giao diện hoàn hảo, mà là một quy trình sản xuất **chạy được thật**, từ định hình → ghi sổ → đóng lệnh, có dữ liệu để kiểm tra.

