# Rà soát tỉ mỉ & kế hoạch hoàn thiện xử lý Đơn đặt vật tư (PO)

> **✅ A + B + C + D-nhẹ HOÀN THÀNH 07/2026** — hồ sơ mua hàng upload/xem được
> trên chi tiết PO (files parent `purchase_order`, quyền KH-CƯ + GĐ/QL); form
> Sửa PO chờ duyệt (LSX khoá, PATCH); màn duyệt `/exec` có cột Giá trị + mở chi
> tiết PO read-only (kèm hồ sơ) trước khi duyệt; nút "Đang giao" bổ sung vào
> modal; PO đã huỷ có "Tạo lại từ đơn này" (nhân bản → chờ duyệt mới).
> Traceability SUP-07 → ✅. Còn lại: mục E (GĐ2) và phương án nặng của D nếu
> doanh nghiệp yêu cầu tách trạng thái `rejected`.

Audit 07/2026 — trả lời câu hỏi "PO đã chạy được chưa, duyệt có upload file được
chưa, còn thiếu gì". Kết luận ngắn: **luồng lõi chạy được end-to-end** (tạo →
duyệt → gửi NCC → hàng về → in), nhưng có **1 gap chức năng thật (hồ sơ file
FR-SUP-07)** và 4 điểm lệch/thiếu UI cần chỉnh.

## 1. Hiện trạng theo từng khâu

| # | Khâu | Hiện trạng | Đánh giá |
|---|---|---|---|
| 1 | **Tạo PO** | Từ LSX đã duyệt (chặn LSX chưa duyệt), gợi ý nhu cầu BOM×SL−đã xuất kèm tồn, so giá NCC + autofill đơn giá (07/2026), ĐVT kép, VAT gồm/chưa gồm, mã `PO-YYYY-NNNN` tự sinh, vào thẳng `pending_approval` + notify GĐ | ✅ Đủ |
| 2 | **Sửa PO chờ duyệt** | Service `posService.update` + API `PATCH /pos/[id]` có sẵn (chỉ cho sửa khi `pending_approval`) — nhưng **KHÔNG có nút/form Sửa nào trên UI** (cả list lẫn modal chi tiết) | ⚠ Backend có, UI thiếu — muốn sửa phải huỷ tạo lại |
| 3 | **Duyệt / Từ chối** | Duyệt được ở 2 nơi: `/planning/pos` (RowMenu + modal) và `/exec` (bảng tập trung); có confirm, từ chối bắt buộc lý do; notify người tạo (`po.notifications`) | ✅ chạy được, nhưng xem mục 3b/3c |
| 3b | — GĐ xem gì trước khi duyệt | Bảng `/exec` chỉ có mã/NCC/LSX/hẹn giao + link "Xem bản in". **Không thấy tổng tiền, số dòng, chi tiết dòng trong app** | ⚠ GĐ duyệt "mù" giá trị cam kết |
| 3c | — Từ chối rồi thì sao | Reject → status `cancelled` luôn (note `[Từ chối] …`). **Không có đường sửa-gửi-lại** — Cung ứng phải nhập lại PO từ đầu | ⚠ UX, cần quyết phương án |
| 4 | **Gửi NCC → chuỗi trạng thái** | BR-05 chặn đúng ở service (+test): chỉ `approved → ordered`; tiếp `confirmed`, `in_transit`; `partial/received` Kho tự cập nhật (BR-08, view sổ cái) | ✅; lệch nhỏ: nút "Đang giao" có ở RowMenu list nhưng **thiếu trong modal chi tiết**; "Gửi NCC" chỉ đổi trạng thái — chưa gửi email thật (GĐ2) |
| 5 | **Hồ sơ mua hàng — upload file (FR-SUP-07)** | DB **đã sẵn 100%** từ 0016 (`files.purchase_order_id` + index + arc-check) nhưng **toàn bộ tầng app chưa nối**: `files.schema` (parent union) không có `purchase_order`, `files.service` không map cột, `files.repo` không nhận cột, `GET /api/files` không lọc theo `purchase_order_id`, `DocumentFiles` không có kind này, modal PO không render khối file | ❌ **GAP CHÍNH** — không đính được báo giá NCC / hợp đồng / chứng từ vào PO, kể cả lúc duyệt |
| 6 | **In đơn đặt hàng** | `/print/supply/[id]` (mẫu tiếng Việt hợp nhất từ 3 mẫu thật) | ✅ |
| 7 | **Nhận hàng theo PO** | Kho lập PNK theo PO (đổ dòng còn thiếu), QC đạt/loại (BR-10), PO tự `partial/received`, notify Cung ứng khi hàng về | ✅ |
| 8 | **Thông báo** | `po_submitted` → GĐ/QL; `po_approved/rejected` → người tạo; hàng về → Cung ứng (0020 + handlers) | ✅ |
| 9 | **Quyền** | Tạo/sửa/gửi/huỷ: phòng KH-CƯ (`isSupplyStaff`); duyệt: admin/manager; đọc: mọi NV. Có test BR-05/06 | ✅ |

Ghi chú liên quan: file đính LSX (`kind='production_order'`) hiện chỉ Sales/GĐ
upload được (`canEditSpec || canApprove`) — phòng KH-CƯ xem được nhưng không
đính được; cân nhắc nới cùng đợt.

## 2. Kế hoạch điều chỉnh — theo thứ tự ưu tiên

### A — Hồ sơ mua hàng gắn PO (FR-SUP-07) — gap chính, ~0.5–1 ngày

1. `files.schema.ts`: thêm `{ kind: 'purchase_order', id: uuid }` vào
   discriminated union (+ test parse).
2. `files.service.ts`: case `purchase_order` → `{ purchase_order_id: id }`;
   authz upload = phòng KH-CƯ + admin/manager (đọc: mọi NV — Kế toán tra chứng từ).
3. `files.repo.ts`: thêm `purchase_order_id` vào type + cột select/insert.
4. `GET /api/files`: nhận query `purchase_order_id`.
5. `DocumentFiles.tsx`: thêm kind `purchase_order` vào `QUERY_PARAM`.
6. `PosManager` → `PoDetail`: khối "Hồ sơ mua hàng" (`DocumentFiles
   kind="purchase_order"`, canEdit = supply staff) — báo giá NCC, hợp đồng,
   chứng từ giao nhận. GĐ duyệt ở `/planning/pos` thấy file ngay trong modal.
7. Storage bucket dùng chung như các kind khác (0031) — không cần migration mới.

### B — Nút + form "Sửa PO" khi chờ duyệt — ~0.5 ngày

- Tái dùng `PoForm` với chế độ edit (initial từ detail; LSX khoá không đổi —
  BR-06), submit `PATCH /api/dept/supply/pos/[id]` (route đã có).
- Nút "Sửa" ở RowMenu + modal chi tiết, chỉ khi `pending_approval` && supply staff.

### C — Nâng màn duyệt của GĐ — ~0.5 ngày

- Bảng PO ở `/exec`: thêm cột **Tổng tiền** (+ số dòng) — server tính từ lines,
  GĐ thấy giá trị cam kết trước khi bấm duyệt.
- Nút "Xem chi tiết" mở modal `PoDetail` read-only ngay tại `/exec` (kèm hồ sơ
  file sau khi làm A).
- Modal chi tiết ở `/planning/pos`: bổ sung nút "Đang giao" (`in_transit`) cho
  khớp RowMenu.
- (Tuỳ chọn cùng đợt) nới quyền đính file LSX cho phòng KH-CƯ (`canManage`).

### D — Luồng "từ chối → sửa → gửi lại" — cần chốt phương án trước khi làm

- **Phương án nhẹ (khuyên dùng, ~0.5 ngày, không đổi DB)**: giữ reject =
  `cancelled`, thêm action **"Tạo lại từ đơn này"** — nhân bản PO (kèm lines)
  thành bản `pending_approval` mới, người mua sửa rồi gửi lại. Vết cũ giữ nguyên.
- **Phương án nặng (~1 ngày, đổi state machine)**: thêm status `rejected` riêng
  (đổi check constraint + service + UI + màn duyệt), PO bị từ chối sửa được và
  resubmit. Chỉ đáng làm nếu doanh nghiệp cần tách bạch "bị từ chối" vs "huỷ"
  trên báo cáo.

### E — Ghi nhận GĐ2 (chưa làm đợt này)

- Gửi email đơn đặt cho NCC kèm PDF bản in (cần integrations layer — gap G7
  trong erp-readiness-assessment).
- Cảnh báo PO quá hẹn giao (`expected_at` < hôm nay mà chưa về đủ) — ghép vào
  `late-risk` khi có hạ tầng cron.
- Import bảng giá NCC từ Excel (flow "BÁO GIÁ NCC" cũ).

## 3. Tổng ước lượng

A + B + C ≈ **1.5–2 ngày** (làm được ngay, không cần migration). D thêm 0.5–1
ngày tuỳ phương án — cần doanh nghiệp/GĐ chốt. Sau mỗi phần: `npm run check`
sạch; xong A thì cập nhật traceability (SUP-07 → ✅ DB + app).
