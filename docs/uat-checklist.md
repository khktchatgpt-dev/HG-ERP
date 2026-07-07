# Checklist nghiệm thu chức năng theo phòng ban (UAT — GĐ1)

Cách dùng: mỗi dòng là 1 thao tác → kết quả phải thấy. Tick ☑ khi đạt.
Tài khoản test: 1 admin · 1 NV mỗi phòng (Bán Hàng / Kỹ Thuật / Kế Hoạch Sản
Xuất-cung ứng / Kho) · 1 manager (đóng vai GĐ). Mã FR/BR để đối chiếu SRS.

## 1. Kỹ thuật — `/technical/products`

- [ ] Tạo SP mới gắn khách hàng + mã KH đặt → SP hiện đúng dưới bộ lọc khách đó (FR-ENG-01)
- [ ] Tạo SP không gắn khách → hiện badge "Mẫu chung"
- [ ] Nhập đủ form Đóng gói XK (D×R×C, carton, SP/thùng, loading 40'HC) → hiện trong chi tiết SP
- [ ] Mở "BOM định mức" → thêm 2 dòng vật tư (chọn từ danh mục Kho) → lưu → cờ tự chuyển "Đang vẽ" (FR-ENG-04)
- [ ] Thêm 2 dòng cùng 1 vật tư → nút Lưu bị khoá + báo trùng
- [ ] Sửa SP → đổi cờ BOM thành "Đã vẽ" → badge xanh ở list (FR-ENG-05, BR-03)
- [ ] "Nhân bản mẫu" sang khách khác → SP mới có đủ thuộc tính + BOM copy theo (FR-ENG-02)
- [ ] Chi tiết SP → upload 1 file PDF + 1 ảnh → tải lại được qua link; xoá được (FR-ENG-03)
- [ ] Tìm theo mã KH đặt (vd P334) → ra đúng SP (FR-ENG-06)
- [ ] Đăng nhập NV Kỹ Thuật (employee) → chỉ XEM, không có nút thêm/sửa (phân quyền)
- [ ] NV Bán Hàng (manager) mở BOM → SỬA được (FR-ENG-04: Sales cùng bóc tách)

## 2. Kinh doanh — `/sales/*`

**Khách hàng**
- [ ] CRUD khách hàng, gán sales phụ trách (FR-SAL-01)

**Báo giá** (`/sales/quotes`)
- [ ] Lập BG: chọn khách → dropdown SP ưu tiên nhóm "SP của khách này" (FR-SAL-02)
- [ ] Mã tự sinh dạng `BG-2026-NNNN`
- [ ] BG 0 dòng → "Gửi duyệt" bị chặn kèm thông báo
- [ ] Gửi duyệt → trạng thái "Chờ duyệt"; manager nhận notification (FR-SAL-03)
- [ ] BG đã gửi → không còn nút Sửa/Xoá (bất biến)
- [ ] NV Kỹ Thuật thử tạo BG (gọi thẳng cũng được) → 403 (chỉ Bán Hàng)

**Đơn hàng** (`/sales/orders`)
- [ ] "Tạo đơn từ báo giá" chỉ liệt kê BG **đã duyệt**; tạo xong dòng SP + điều khoản copy nguyên từ BG (FR-SAL-04, BR-04)
- [ ] Nhập PO# khách + % cọc + container khi tạo
- [ ] "Khách thay đổi — sửa đơn": đổi SL 1 dòng + lý do → timeline "Lịch sử thay đổi" ghi from→to (FR-SAL-05)
- [ ] Sửa mà không đổi gì → KHÔNG sinh dòng lịch sử rác
- [ ] Huỷ đơn bắt buộc lý do; đơn đã huỷ không sửa được nữa

**Phát LSX + theo dõi**
- [ ] Đơn có SP thiếu BOM → chi tiết hiện cảnh báo vàng nhưng "Phát LSX" VẪN bấm được (BR-07)
- [ ] Phát LSX (manager) → đơn sang "Đã phát LSX", mã `LSX-2026-NNNN` (FR-SAL-06)
- [ ] Phát LSX lần 2 cùng đơn → báo lỗi "Đơn này đã có LSX" (BR-01 — DB chặn)
- [ ] `/sales/tracking`: đơn hiện đủ cột BOM / PO mở / giai đoạn / hạn giao; đơn quá hạn có ⚠ đỏ (FR-SAL-07/09)

## 3. Kế hoạch - Cung ứng — `/planning/*`

**Nhà cung cấp**
- [ ] Thêm/sửa NCC; NCC có PO thì cột "Lịch sử mua" đếm đúng (FR-SUP-06)
- [ ] Ngừng giao dịch NCC → NCC biến mất khỏi dropdown tạo PO

**Đơn đặt vật tư** (`/planning/pos`)
- [ ] Tạo PO: bắt buộc chọn LSX + NCC (BR-06); chọn LSX → hiện các nút gợi ý "cần X (tồn Y)" đúng bằng BOM×SL − đã xuất (FR-SUP-01)
- [ ] Bấm nút gợi ý → dòng tự thêm với SL mặc định = cần − tồn
- [ ] LSX chưa có BOM → vẫn thêm dòng thủ công được (BR-07)
- [ ] Nhập quy cách + SL quy đổi (kg/m²) + VAT gồm/chưa gồm → hiện đủ ở chi tiết (OI-10)
- [ ] Tạo xong → trạng thái "Chờ duyệt", manager nhận notification (FR-SUP-03)
- [ ] **PO chưa duyệt → menu KHÔNG có "Gửi NCC"; đơn approved mới có (BR-05 ⭐)**
- [ ] GĐ duyệt → "Gửi NCC" → "NCC xác nhận" → "Đang giao" đi đúng thứ tự; đi tắt bị chặn (FR-SUP-04)
- [ ] Chi tiết PO sau khi Kho nhập: cột Đã về / Còn thiếu đúng số (FR-SUP-05, BR-08)
- [ ] NV Kho thử tạo PO → 403 (chỉ phòng Kế Hoạch SX-cung ứng)

## 4. Kho — `/warehouse/*`

**Danh mục & tồn**
- [ ] CRUD vật tư: mã, ĐVT, nhóm, tồn min, vị trí kệ (FR-WMS-01)
- [ ] `/warehouse/stock`: tồn realtime; vật tư dưới min có cảnh báo (FR-WMS-07)

**Phiếu nhập** (`/warehouse/docs`)
- [ ] "+ Phiếu nhập" → chọn PO đang mở → dòng còn thiếu TỰ ĐỔ với SL mặc định = còn thiếu (FR-WMS-02)
- [ ] Nhập thiếu (60/100) → lưu → toast "Về một phần"; PO sang `partial`; nhập nốt 40 → PO sang "Về đủ" (BR-08)
- [ ] Điền "QC loại" 5 + trạng thái QC → tồn chỉ cộng số ĐẠT, 5 loại không vào tồn (FR-WMS-03, BR-10)
- [ ] Nguồn "Mua ngoài" → quét/gõ mã vật tư + Enter → dòng tự thêm (FR-WMS-04, FR-WMS-09)
- [ ] Số phiếu dạng `PNK-2026-NNNN`; nút In ra đúng mẫu **01-VT** (2 cột chứng từ/thực nhập, khung 4 chữ ký)

**Phiếu xuất**
- [ ] "− Phiếu xuất" → Theo LSX → chọn LSX → dòng gợi ý = BOM×SL − đã xuất (FR-WMS-05)
- [ ] Xuất quá tồn (kể cả 2 dòng cùng vật tư cộng dồn) → bị chặn kèm số tồn hiện có
- [ ] Xuất theo LSX không chọn LSX → bị chặn (BR-09)
- [ ] Xuất thường ngày → không cần LSX, chỉ trừ tồn (FR-WMS-06)
- [ ] Xuất làm tồn rơi dưới min → manager nhận notification "tồn dưới mức tối thiểu" (FR-WMS-08)
- [ ] In phiếu xuất ra mẫu **02-VT** (có lý do xuất)
- [ ] NV phòng khác vào `/warehouse/docs` → bị chặn/redirect (chỉ phòng Kho)

## 5. Sản xuất (GĐ1 thao tác qua `/sales/tracking`)

- [ ] Đổi giai đoạn LSX (dropdown Phôi→Hàn→Sơn→Mài→Hoàn thiện) → đơn tự sang "Đang sản xuất" (FR-PROD-01)
- [ ] Bấm "✓ Hoàn thành" → LSX completed + đơn "Hoàn thành" (FR-PROD-03)
- [ ] LSX đã hoàn thành → không đổi giai đoạn được nữa

## 6. Ban Giám đốc — `/exec`

- [ ] NV thường vào `/exec` → bị đẩy về trang chủ; manager/admin vào được (FR-ADM-02 một phần)
- [ ] 2 bảng: Báo giá chờ duyệt + Đơn đặt vật tư chờ duyệt — số khớp thực tế (FR-ADM-03)
- [ ] "Xem bản in" mở đúng bản in trước khi quyết
- [ ] Duyệt BG tại chỗ → biến khỏi danh sách; người lập nhận notification "đã duyệt báo giá"
- [ ] Từ chối (BG hoặc PO) → BẮT BUỘC nhập lý do; người lập nhận notification kèm lý do
- [ ] Duyệt PO → Cung ứng thấy nút "Gửi NCC" xuất hiện (BR-05 khép vòng)

## 7. Quản trị — `/admin`

- [ ] Tạo user gán phòng "Bán Hàng" → đăng nhập được đưa vào workspace Sales (FR-ADM-01)
- [ ] Đổi role employee↔manager → các nút duyệt/phát LSX xuất hiện/biến mất tương ứng

## 8. In ấn (chạy chéo các phòng)

- [ ] Báo giá: bảng dims/carton cm+inch/Q'ty-ctn/loading 40HC/giá FOB USD — khổ ngang
- [ ] Hợp đồng: Customer Item, deposit %, **số tiền bằng chữ tiếng Anh** khớp tổng
- [ ] Đơn đặt hàng NCC: quốc hiệu + số ĐH + **tham chiếu LSX** + dòng VAT + khung ký 2 bên
- [ ] Phiếu kho 01-VT / 02-VT
- [ ] Mọi trang in: nút In/Đóng biến mất trên bản in (print CSS)

## 9. Truy vết end-to-end (BR-11 — tiêu chí nghiệm thu SRS §7)

- [ ] Từ 1 đơn hàng lần ra được: báo giá gốc → LSX → PO của LSX → phiếu nhập của PO → phiếu xuất theo LSX → tiến độ — không đứt mắt xích nào
- [ ] `npm run check` sạch (typecheck + lint scoped + 163 test)

> Ngoài phạm vi GĐ1 (đừng tick): kế toán/công nợ, điều chuyển/kiểm kê kho
> (chờ OI-08/09), bảng giá NCC, ảnh đại diện SP trên bản in, tiến độ từng thợ.
