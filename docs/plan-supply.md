# Kế hoạch phân hệ Kế hoạch & Cung ứng (FR-SUP-01..07, BR-05/06/08)

> **✅ HOÀN THÀNH 07/2026** — P1–P5 đã build (commit `feat(supply)`): NCC + PO từ
> LSX (gợi ý BOM + tồn), duyệt GĐ ở `/exec` và `/planning/pos` (BR-05 có test),
> gửi NCC → hàng về do Kho tự cập nhật, in đơn đặt hàng, workspace planning bật.
> Migration 0020 (notification PO) đã apply. Bảng giá NCC (G-1) vẫn là GĐ2.

Lập 07/2026. Mảnh **cuối cùng của trục xương sống GĐ1**: LSX → đặt vật tư →
GĐ duyệt → gửi NCC → hàng về (Kho đã sẵn). Sau sprint này, chuỗi nghiệm thu
end-to-end của SRS mục 7 chạy trọn trên UI.

## Đã có sẵn (không phải làm lại)

- **DB đủ 100%** (0015): `supply_suppliers`, `supply_purchase_orders` (BR-06 ép
  2 FK NOT NULL), `supply_purchase_order_lines` (spec/qty2/unit2 cho ĐVT kép),
  view `supply_po_line_status` (thiếu = đặt − nhận).
- **`supply.repo.ts`** (sprint Kho): đọc PO mở, dòng thiếu, tự cập nhật
  partial/received khi Kho nhập hàng — Kho đã tiêu thụ.
- **Màn duyệt GĐ** (`/exec`): khung "PO chờ duyệt" chừa sẵn, chỉ cần đổ dữ liệu.
- **Tiến độ SX** (FR-SUP-08): đã xong ở sprint Sales/production.
- Mẫu in đơn đặt hàng NCC (3 mẫu thật: nhôm / dây nhựa / kính) đã phân tích.

## Yêu cầu phủ

FR-SUP-01 (từ LSX + BOM ra nhu cầu; cho đặt thủ công khi chưa BOM — BR-07) ·
02 (nhiều PO/LSX, mỗi PO = 1 NCC + 1 LSX) · 03 (**BR-05: GĐ duyệt mới gửi NCC**
— service + test bắt buộc) · 04 (chuỗi trạng thái đặt → về đủ) · 05 (thiếu từng
dòng) · 06 (quản lý NCC + lịch sử mua) · 07 (hồ sơ mua hàng — file gắn PO, đã có
`files.purchase_order_id`). FR-ADM-03 phần duyệt PO.

## Lộ trình (~4.5–5 ngày)

### P1 — Nhà cung cấp (0.5–1 ngày)
- Module `suppliers` (schema/repo/service) + trang `/planning/suppliers`:
  CRUD (mã, tên, MST, liên hệ), tab lịch sử mua = list PO theo NCC.
- Quyền: phòng "Kế Hoạch Sản Xuất-cung ứng" (+ admin/manager) sửa; khác xem.
- FR-SUP-06 (bảng giá NCC = gap G-1, GĐ2 — lịch sử giá tra từ PO lines).

### P2 — Đơn đặt vật tư + duyệt (1.5–2 ngày)
- Module `purchase-orders`: tạo PO **từ LSX** (bắt buộc chọn LSX + NCC — BR-06),
  mã `PO-YYYY-NNNN`, lines: vật tư + SL + đơn giá + quy cách/qty2/unit2 (OI-10)
  + ghi chú bộ phận SP; VAT (gồm/chưa gồm), hạn giao, điều khoản.
- **Gợi ý nhu cầu (FR-SUP-01)**: chọn LSX → bảng nhu cầu từ `v_lsx_material_status`
  (BOM×SL − đã xuất) **kèm cột tồn kho hiện có** để người mua tự quyết lượng đặt
  (đặc tả 4.4: "đọc tồn để tính mua" — hiển thị, không tự trừ); BOM chưa có →
  thêm dòng thủ công (BR-07).
- **State machine + BR-05**: pending_approval → (GĐ duyệt) approved → ordered
  (gửi NCC) → confirmed → in_transit; partial/received do Kho tự cập nhật; huỷ
  kèm lý do. **Service chặn `ordered` khi chưa `approved` + test** — nghĩa vụ
  ghi trong ma trận truy vết.
- Migration 0020: notification types `po_submitted`/`po_approved`/`po_rejected`
  + events + handler (mẫu quote đã có).
- Đổ dữ liệu thật vào màn duyệt `/exec` (duyệt/từ chối tại chỗ).

### P3 — UI PO + workspace planning (1 ngày)
- Bật `planning.ready = true`; layout + nav: Đơn đặt vật tư · Nhà cung cấp ·
  Theo dõi đơn hàng (link `/sales/tracking`) · Tiến độ SX.
- Trang `/planning/pos`: list (badge 8 trạng thái, lọc NCC/LSX/trạng thái),
  chi tiết (lines + **đặt/đã nhận/còn thiếu** từ view — FR-SUP-05), nút Gửi duyệt /
  Gửi NCC / Huỷ theo trạng thái + quyền; đính hồ sơ mua hàng (files — FR-SUP-07).

### P4 — In đơn đặt hàng NCC (0.5–1 ngày)
- `/print/supply/[poId]`: mẫu ĐƠN ĐẶT HÀNG tiếng Việt (header cty + quốc hiệu,
  "Kính gửi NCC…", **số ĐH + tham chiếu LSX**, bảng vật tư quy cách/SL/qty2/đơn
  giá/thành tiền, dòng VAT gồm/chưa gồm, thời gian giao, khung ký 2 bên) — hợp
  nhất từ 3 mẫu thật.

### P5 — Chốt (0.5 ngày)
- Tests BR-05/06 + guard trạng thái; `npm run check`; cập nhật ma trận truy vết
  (FR-SUP 6/6 GĐ1 ✅); demo E2E trọn chuỗi: BG → duyệt → đơn → LSX → **PO → duyệt
  → gửi NCC → Kho nhập theo PO → về đủ** → xuất LSX → hoàn thành.

## Rủi ro / lưu ý
- Tên phòng guard: dùng đúng `"Kế Hoạch Sản Xuất-cung ứng"` như DB (bug 'Kinh
  Doanh'/'Bán Hàng' vừa vá — không lặp lại).
- OI-10 (ĐVT kép): GĐ1 nhập `spec` text + `qty2/unit2` tự do, đơn giá hiểu theo
  ghi chú — chưa dựng hệ quy đổi.
- Sau sprint này GĐ1 chỉ còn: Phase 4 Kho (chờ OI-08/09) + 2 mục hồ sơ SP đã
  thống nhất (ảnh đại diện, giá gần nhất).
