# Sản xuất — thiết kế theo vai: nghiệp vụ · tính năng · giao diện

Bổ trợ cho [production-v2.md](production-v2.md). Trạng thái 24/07/2026: ✅ đã có ·
🔶 nên thêm (đề xuất, chưa làm). Nhãn vị trí (0087) quyết định UI; quyền không tách.

---

## 1. Tổ trưởng (nhãn `production_leader`) — WORKSPACE `/to`, điện thoại

**Quy trình một ngày:**
1. Sáng mở app (rơi thẳng Việc của tổ) → thấy các thẻ SP × công đoạn của tổ, xếp theo ưu tiên lệnh + hạn.
2. Điều quân theo thẻ; trong ngày báo số miệng/giấy cho thống kê (KHÔNG tự nhập — user chốt).
3. Đối chiếu "Số thống kê đã ghi / cần" trên thẻ — sai thì báo thống kê sửa sổ.
4. Đủ số → bấm **Xong công đoạn** → hệ bàn giao (notify tổ kế tiếp + quản đốc). Thiếu số → hệ CHẶN, hiện đúng chi tiết thiếu bao nhiêu.
5. Vướng mắc ghi vào **Ghi chú** thẻ; sự cố lớn báo trực tiếp ngoài hệ (user chốt).

**Đã có:** ✅ thẻ việc + đối chiếu số + danh sách thiếu · ✅ gate chặn xong khi thiếu · ✅ ghi chú · ✅ cảnh báo trễ hạn xuất/hạn KH · ✅ mobile-first, nút to.

**Nên thêm:**
- 🔶 Dòng "hôm nay tổ đã làm +N" trên đầu màn (đọc entries hôm nay của tổ) — khỏi hỏi thống kê.
- 🔶 Thẻ sắp ĐẾN LƯỢT (công đoạn trước của lệnh gần xong) — tổ chuẩn bị nguyên liệu sớm.
- 🔶 Khi đã gán đủ nhãn leader cho các tổ trưởng thật: ẩn nút "Xong công đoạn" với tổ viên (hiện tổ viên chưa nhãn vẫn thấy).

**Giao diện:** giữ 1 màn duy nhất, không thêm menu. Mọi thứ mới đều nằm trên thẻ.

---

## 2. Thống kê xưởng (nhãn `production_stat`) — WORKSPACE `/thongke`, máy tính

**Quy trình:**
1. Khi lệnh được duyệt → vào **Định hình**: kéo BOM Kỹ thuật / import file Excel / dán từ Excel / chép lệnh trước → rà định mức → **Lưu** (chốt snapshot). Xong có thể **Lưu làm BOM kỹ thuật** để lệnh sau 1 nút.
2. Hằng ngày gom số các tổ → **Sổ số liệu**: lưới bàn phím (chọn lệnh + công đoạn, gõ SL/phế/lý do/kg/máy), Ctrl+Enter ghi sổ.
3. Ghi nhầm → xoá dòng nhập lại (append-only). Cuối ngày **Chốt sổ** từng tổ.
4. Gia công ngoài: ghi giao/nhận per chi tiết × NCC (tab trong hồ sơ lệnh).

**Đã có:** ✅ 5 nguồn định hình + khớp vật tư tự động · ✅ lưới nhập nhanh + buffer + cảnh báo vượt tổng cần · ✅ chốt/mở sổ ngày · ✅ sổ khoá bảo vệ khi ghi đè bảng chi tiết · ✅ landing thẳng vào Sổ.

**Nên thêm:**
- 🔶 Tab **Gia công ngoài** ngay trong Sổ số liệu (đỡ mở từng hồ sơ lệnh).
- 🔶 Cảnh báo **WIP âm** trên lưới: nhập công đoạn sau vượt số công đoạn trước (vàng ô, không chặn).
- 🔶 Sau khi ghi sổ, toast gợi ý "KHUNG CHÂN đã đủ ở Hàn — nhắc tổ trưởng xác nhận".
- 🔶 Import file nhiều SP một lần (mapping thêm cột SP).
- 🔶 Báo cáo ngày in được (tổng SL/phế theo tổ) — thay sổ giấy nộp quản đốc.

**Giao diện:** 2 màn là đủ (Định hình = việc theo lệnh; Sổ = việc theo ngày). Không gộp — nhịp làm việc khác nhau.

---

## 3. Trưởng phòng Kế hoạch (permission `production.plan.manage`) — WORKSPACE `/kehoach-sx`, máy tính

**Quy trình:**
1. Lệnh GĐ duyệt xong rơi vào hàng đợi (chưa lộ trình nổi lên đầu).
2. Per dòng SP: tick công đoạn theo thứ tự (hoặc lấy lộ trình mặc định SP) → tổ tự gán theo tổ↔công đoạn → đặt hạn bắt đầu/kết thúc từng công đoạn → Lưu (có thể lưu làm mặc định SP).
3. Đặt **ưu tiên** lệnh (số lớn xưởng làm trước).
4. Theo dõi thực tế vs kế hoạch: cột "x/y công đoạn + n quá hạn" ngay trên bảng; sửa kế hoạch khi lệch (hệ giữ việc đã chạy, chặn bỏ công đoạn dở).

**Đã có:** ✅ hàng đợi + editor lộ trình/tổ/hạn per SP · ✅ ưu tiên inline · ✅ lộ trình mặc định SP hai chiều · ✅ sync an toàn khi sửa.

**Nên thêm (vai còn mỏng nhất):**
- 🔶 **View TUẦN (Gantt-lite)**: hàng = tổ hoặc lệnh, cột = tuần — đúng hình dạng file Excel kế hoạch cũ; dữ liệu planned_start/end đã có đủ.
- 🔶 **Gợi ý tải tổ** khi đặt hạn: "Tổ Hàn tuần đó đang ôm 5 việc" (đếm jobs trùng khoảng ngày).
- 🔶 Sửa hạn/tổ **inline từng dòng** (API `patchJob` có sẵn, UI chưa dùng).
- 🔶 Chép kế hoạch từ lệnh trước cùng SP (như bảng chi tiết đã có).
- 🔶 Kéo-thả sắp hàng đợi ưu tiên thay ô số.

**Giao diện:** thêm toggle "Bảng | Tuần" trong màn Kế hoạch; không thêm route mới.

---

## 4. Quản đốc (users.role `manager`, phòng Xưởng) — WORKSPACE `/production` Toàn cảnh, máy tính

**Quy trình:**
1. Sáng nhìn Toàn cảnh: lệnh nào cháy (trễ hạn xuất/KH), tổ nào nghẽn (tải việc), lệnh nào chưa nhận vật tư.
2. Trong ngày: xử lý bàn giao (nhận notify công đoạn xong), ép xác nhận/mở khoá sổ khi có ngoại lệ (kèm lý do — có vết).
3. Lệnh đủ 100% → **Hoàn thành lệnh** → đơn sang Chờ giao (Sales tiếp).
4. Được sửa kế hoạch (cùng quyền plan.manage qua role manager) khi TP Kế hoạch vắng.

**Đã có:** ✅ toàn cảnh chip công đoạn + KPI + tải tổ + chờ giao · ✅ hoàn thành + override · ✅ nhận vật tư · ✅ mở khoá sổ · ✅ vào được mọi màn xưởng.

**Nên thêm:**
- 🔶 Bấm "Trễ hạn kế hoạch" ra **danh sách việc cụ thể** (việc gì, tổ nào, trễ mấy ngày) — để đi đòi.
- 🔶 Lệnh đủ 100% **nổi bật xanh + lên đầu** ("sẵn sàng hoàn thành").
- 🔶 Ô tải tổ thêm **sản lượng hôm nay** (số đang nằm bên Tháp điều hành /exec — kéo về).
- 🔶 Nút "Xem theo tổ" nhảy thẳng Kanban tổ đang nghẽn (đã có picker, thêm link từ ô tải).

**Giao diện:** giữ 1 màn tổng; drill-down bằng panel/expand tại chỗ, không sinh màn mới.

---

## 5. Ban Giám Đốc (vai `director` — phòng BGĐ) — `/exec`, máy + điện thoại

**Quy trình:**
1. **Phê duyệt** (`/exec/approvals`): duyệt/từ chối LSX (xem phân tích BOM, giá trị đơn, spec) và PO (cam kết chi tiền) — mobile 1 chạm.
2. **Báo cáo CEO** (`/exec`): cảnh báo đỏ (đơn trễ, PO trễ, tồn thấp), đơn trọng điểm %HT, sản lượng 8 tuần.
3. **Tháp điều hành** (`/exec/ops`): sơ đồ xưởng xanh/vàng/đỏ, WIP nghẽn, chất lượng 7 ngày → tổ → lý do phế.
4. Toàn quyền xem chéo mọi workspace; duyệt tập trung (0086 — trưởng phòng khác không duyệt thay).

**Đã có:** ✅ đủ 3 màn trên + hồ sơ LSX thẩm định + duyệt tại chỗ · ✅ gate 2 lớp chỉ phòng BGĐ.

**Nên thêm:**
- 🔶 Ô nào ở Tháp điều hành cũng **link chéo** sang màn tương ứng bên Sản xuất.
- 🔶 Báo cáo CEO thêm khối "Chờ giao hàng" (đơn xưởng xong chưa giao — tiền chưa về).
- 🔶 Push/badge số phiếu chờ duyệt (đã có notification khi phát LSX; thêm đếm trên menu).

---

## 6. Tổ viên (member, chưa nhãn) — `/production/team`

Hiện dùng chung màn tổ trưởng (đầy đủ menu vì chưa gán nhãn). Nghiệp vụ thật: xem việc, không thao tác.
- 🔶 Khi gán nhãn leader xong: tổ viên chỉ còn xem thẻ + ghi chú, ẩn nút Xong.
- 🔶 Về lâu dài có thể không cần tài khoản tổ viên (tổ trưởng đại diện) — quyết sau theo thực tế.

---

## Vai liên quan (ngoài xưởng, đã có quyền xem SX)

- **NV Kế hoạch SX** (planner): định hình + lên KH như TP (không duyệt). Màn dùng chung.
- **Cung ứng** (supply): xem Toàn cảnh + hồ sơ lệnh (panel PO/vật tư) để đặt hàng theo thiếu hụt — đã có `workspace.view.production`.
- **Sales**: không vào workspace SX; theo dõi qua `/sales/tracking` (tiến độ x/y công đoạn) + timeline đơn; nhận "Chờ giao" để xác nhận giao.

## Thứ tự làm đề xuất (khi anh chốt)

1. Danh sách việc trễ hạn KH + lệnh sẵn sàng hoàn thành nổi bật (Quản đốc) — nhỏ, ăn ngay.
2. Tab Gia công ngoài trong Sổ + cảnh báo WIP âm (Thống kê).
3. Sửa hạn inline + gợi ý tải tổ (Kế hoạch).
4. "Hôm nay tổ đã làm +N" + thẻ sắp đến lượt (Tổ trưởng).
5. View tuần Gantt-lite (Kế hoạch) — to nhất, làm sau cùng.
