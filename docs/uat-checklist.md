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

## 8b. Vòng đời theo thực tế (plan-order-lsx-lifecycle — 07/2026)

- [ ] GĐ từ chối LSX (kèm lý do) → Sales mở chi tiết LSX thấy khối đỏ có form sửa
      (ngày xuất/ngày nhận/container/ghi chú) + nút **"Gửi duyệt lại"** → LSX quay
      về Chờ duyệt, GĐ nhận notification "gửi duyệt lại"; duyệt lần 2 chạy tiếp bình thường
- [ ] Đơn đang sản xuất: Sales sửa số lượng dòng SP (hoặc hạn giao) → NV Cung ứng
      + GĐ nhận notification "sửa đơn hàng sau khi phát LSX"; sửa ghi chú → KHÔNG có notification
- [ ] Huỷ đơn đang sản xuất: dialog xác nhận liệt kê đúng hệ quả (LSX dừng, PO chưa
      gửi NCC tự huỷ kèm mã, PO đã gửi NCC báo xử lý tay) → sau huỷ: LSX badge
      "Đã huỷ theo đơn", timeline có dòng "Đơn hàng huỷ: <lý do>", PO chưa gửi thành
      Đã huỷ, PO đã gửi giữ nguyên, Cung ứng nhận notification
- [ ] LSX đã huỷ: không cập nhật được giai đoạn / hoàn thành / nhận vật tư (400)
- [ ] PO gửi NCC có hẹn giao đã qua mà chưa về đủ → badge "⚠ Trễ" đỏ ở cột Hẹn
      giao, stat "Quá hẹn giao" đỏ, lọc "⚠ Quá hẹn giao" ra đúng danh sách;
      widget "PO quá hẹn giao" trang chủ /planning khớp số; PO về đủ/huỷ → hết ⚠
- [ ] Ngừng giao dịch NCC còn PO đang mở → dialog đỏ nêu rõ số PO dở dang;
      NCC không còn PO mở → confirm thường
- [ ] Phiếu xuất kho: dropdown LSX chỉ liệt kê LSX đã duyệt / đang SX (không thấy
      LSX chờ duyệt / bị từ chối / đã huỷ); gọi API xuất cho LSX đã huỷ → 400
- [ ] Phiếu nhập theo PO đã huỷ (vd huỷ theo đơn hàng) → API chặn 400; PO không
      còn trong dropdown "Nhập theo đơn"

## 8c. Workspace Sản xuất — xưởng tự cập nhật tiến độ (plan-production-workspace)

- [ ] `totruong.test@hg.com` (NV Xưởng Sản Xuất) login → tự vào `/production`,
      thấy card các LSX đã duyệt/đang SX kèm giai đoạn + hạn xuất + badge ⚠ trễ
- [ ] Bấm card → chi tiết LSX: cập nhật giai đoạn / Đã nhận vật tư / Hoàn thành
      đều chạy; KHÔNG thấy nút Duyệt/Từ chối, không sửa được spec
- [ ] Tổ trưởng gọi thẳng API duyệt LSX / tạo PO / lập phiếu kho → 403
- [ ] NV phòng khác (vd kinhdoanh.test) vào `/production` → bị đẩy về trang chủ
- [ ] GĐ duyệt LSX mới → tổ trưởng nhận notification; LSX hiện thêm ở card
- [ ] Cung ứng (`cungung.test`) vẫn cập nhật tiến độ được như cũ (bấm thay khi
      xưởng nghỉ — quyền không thu hẹp)
- [ ] Bảng điều phối `/planning/production`: cột "Vật tư / BOM" đúng thực tế
      (n dòng chưa BOM đỏ / n PO chưa về vàng / Sẵn sàng xanh); badge ⚠ cạnh
      ngày xuất khớp lọc "⚠ Nguy cơ trễ" + stat; đổi giai đoạn bằng select ngay
      trên bảng + nút "✓ Hoàn thành" chạy; LSX hoàn thành/huỷ không hiện select
- [ ] Thư viện SP (`kythuat.test`): form có khối "Xuất khẩu & đặc tính" — nhập
      HS code, xuất xứ, chất liệu, tải trọng, lắp ráp KD, bộ gồm + NW/GW per
      thùng; lưu xong chi tiết SP hiện đủ, CBM/thùng tự tính từ carton;
      "Nhân bản mẫu" copy các trường này (trừ barcode)

## 8d. Bảng chi tiết & định mức theo LSX (plan-lsx-components)

- [ ] Chi tiết LSX (`cungung.test`): khối "Bảng chi tiết & định mức" — thêm dòng
      thủ công (cụm/chi tiết/vật tư/quy cách/CT-SP/ĐM kg/CT-cây), cột Tổng
      cần/Kg/Cây tự tính khi gõ; thiếu ĐM/hệ số → "—" kèm tooltip, KHÔNG lỗi
      chia 0; Lưu → tải lại còn nguyên
- [ ] "Gợi ý từ BOM" đổ khung từ BOM kỹ thuật (SP chưa BOM → báo không có dữ
      liệu); "Chép từ lệnh trước" đổ đúng bảng của LSX gần nhất cùng SP —
      cả hai chỉ điền sẵn, sửa được từng dòng trước khi Lưu
- [ ] Dòng chưa gắn vật tư → cảnh báo vàng, KHÔNG xuất hiện trong nhu cầu mua
- [ ] Form tạo PO của LSX đã nhập bảng chi tiết: khối nhu cầu ghi "theo bảng
      chi tiết của LSX" + mỗi vật tư hiện "≈ X kg · Y cây"; LSX chưa nhập →
      vẫn ra nhu cầu theo BOM như cũ
- [ ] Bảng điều phối: LSX đã duyệt chưa nhập bảng → badge vàng "Chưa nhập chi
      tiết"; nhập xong badge biến mất
- [ ] Xưởng (`totruong.test`) mở LSX → thấy bảng chi tiết read-only, không có
      nút Lưu/gợi ý; Sales (`kinhdoanh.test`) cũng chỉ xem
- [ ] LSX hoàn thành/huỷ → bảng chi tiết khoá (chỉ tra cứu)

## 8e. Sản lượng theo công đoạn/tổ (SX-P3 — thay sheet PHÔI/HÀN/NGUỘI/SƠN)

- [ ] Tổ trưởng (`totruong.test`) mở LSX đang SX: chọn công đoạn + ngày, điền SL
      (+phế/kg/máy-màu) cho vài chi tiết → Ghi → bảng tổng hợp cập nhật đúng
      (đã làm, thiếu/dư, %HT per công đoạn); tổ tự ghi theo phòng người nhập
- [ ] Nhập vượt tổng cần → VẪN ghi được nhưng hiện cảnh báo "VƯỢT n" (FR-PR-07)
- [ ] %HT tổng chỉ tăng khi công đoạn CUỐI có sản lượng; đủ ở công đoạn cuối →
      badge chi tiết "Hoàn thành"
- [ ] Badge "đồng bộ X/Y bộ" đúng chi tiết chậm nhất (ví dụ 2 TAY sơn 96 +
      4 CHÂN sơn 100 → 25 bộ)
- [ ] Ghi nhầm → xoá bản ghi trong "Sổ ghi sản lượng" (chỉ người nhập/QL) rồi
      nhập lại; LSX hoàn thành → sổ khoá
- [ ] Đã có sản lượng → Lưu bảng chi tiết bị chặn 400 (không cho ghi đè mất sổ)
- [ ] Sales xem LSX thấy tổng hợp sản lượng nhưng không có lưới nhập

## 8f. Gia công ngoài + Bảng tổng (SX-P4/P5)

- [ ] Ghi 2 đợt Giao đi cho 1 chi tiết → đơn vị TTP, rồi Nhận về một phần →
      bảng đối chiếu đúng giao/nhận/thiếu/%HT; nhận vượt giao → cảnh báo vẫn ghi
- [ ] Nhận về có hàng hỏng → cột Hỏng đỏ; đơn vị GC ngừng giao dịch → 400
- [ ] `/production/board`: đủ mọi chi tiết × công đoạn của các lệnh đang chạy,
      khớp số với từng LSX; lọc theo lệnh/trạng thái; badge đồng bộ đúng
- [ ] "Xuất Excel (CSV)" mở bằng Excel: tiếng Việt không vỡ, đủ cột đã làm +
      thiếu/(dư) per công đoạn
- [ ] KH-CƯ (`cungung.test`) vào được `/production/board` (giám sát); Sales bị
      đẩy về trang chủ khi vào /production

## 9. Truy vết end-to-end (BR-11 — tiêu chí nghiệm thu SRS §7)

- [ ] Từ 1 đơn hàng lần ra được: báo giá gốc → LSX → PO của LSX → phiếu nhập của PO → phiếu xuất theo LSX → tiến độ — không đứt mắt xích nào
- [ ] `npm run check` sạch (typecheck + lint scoped + 163 test)

> Ngoài phạm vi GĐ1 (đừng tick): kế toán/công nợ, điều chuyển/kiểm kê kho
> (chờ OI-08/09), bảng giá NCC, ảnh đại diện SP trên bản in, tiến độ từng thợ.
