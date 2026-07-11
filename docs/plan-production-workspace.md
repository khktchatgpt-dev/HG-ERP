# Kế hoạch Workspace Sản xuất (xưởng) — tổ trưởng tự cập nhật tiến độ

> **✅ P1 + P2 HOÀN THÀNH 07/2026** — `isProductionStaff` check
> `departments.workspace_id === 'production'`; `canTrackProgress` nới cho
> xưởng; notify LSX duyệt gồm cả xưởng (`lsxApprovedNotifyIds`); workspace
> `production.ready = true` + layout gate; trang chủ card lớn `/production`;
> chi tiết `/production/lsx/[id]` tái dùng LsxDetailView (thêm prop
> breadcrumbs). Phòng "Xưởng Sản Xuất"/"Cắt Vải" đã có sẵn workspace_id từ
> 0008 — không cần tạo. User test `totruong.test@hg.com` đã seed
> (docs/test.md). 221 test xanh. **Còn P3** (compact tablet) — chờ xưởng dùng
> thử. UAT mục 8c.

Lập 07/2026. Hiện PROD-01/02/03 chạy **gián tiếp**: phòng KH-CƯ / GĐ bấm thay
xưởng trên chi tiết LSX (đúng vai tạm FR-SUP-08). Mục tiêu: xưởng tự thao tác,
KH-CƯ chuyển từ "người nhập liệu tiến độ" sang "người giám sát". Ràng buộc
thực tế: máy ở xưởng màn nhỏ / tablet / ít dùng chuột → nút to, ít thao tác.
Tổng ước lượng **~1.5–2 ngày**.

## Đã có sẵn (không phải làm lại)

- Workspace `production` đã khai trong `workspaces.config.ts` (accent red,
  route `/production`) — chỉ đang `ready: false`.
- `departments.workspace_id` có sẵn trong DB: gán phòng → workspace qua
  `/admin/departments`, login tự điều hướng (`resolveDefaultWorkspace`) —
  **không cần sửa code resolve, không cần migration**.
- Toàn bộ API tiến độ đã chạy + đã gia cố 07/2026: `stage`, `complete`,
  `materials-received` (guard trạng thái: chỉ LSX đã duyệt/đang SX; chặn
  cancelled). `LsxDetailView` tái dùng được nguyên khối.
- Notification khi GĐ duyệt LSX đã bắn theo danh sách id — chỉ cần thêm phòng
  Sản Xuất vào danh sách nhận.

## P1 — Quyền + bật workspace (~0.5 ngày)

1. **Repo**: thêm `workspace_id` vào type `Department` + select của
   `departmentsRepo.findById/list` (cột đã có trong DB, repo chưa đọc).
2. **Guard** `isProductionStaff(user)` trong module production: admin luôn
   true; còn lại phòng của user có `workspace_id === 'production'`.
   ⚠ Check bằng **cột workspace_id, KHÔNG so tên chuỗi phòng** — bug so tên
   ("Kinh Doanh" vs "Bán Hàng") đã vá 2 lần, không lặp lại.
3. **Nới `canTrackProgress`** (production.service) = GĐ/QL ‖ supply staff ‖
   **production staff**. Duyệt LSX (`canApprove`) giữ nguyên GĐ/QL.
4. **Notify**: `supplyTechIds()` (báo khi LSX được duyệt) thêm nhân sự phòng
   production → đổi tên hàm cho đúng nghĩa (vd `lsxApprovedNotifyIds`).
5. **Bật workspace**: `production.ready = true`; nav 2 mục: Trang chủ
   (`/production`) + Theo dõi đơn (`/sales/tracking`, read-only sẵn có).
6. **Shell**: `(workspace)/production/layout.tsx` (WorkspaceShell) +
   `loading.tsx` (ContentSkeleton) theo skill `add-erp-page`. Gate layout:
   admin/manager ‖ production staff — phòng khác redirect `/`.
7. **Data khi triển khai** (không phải code): tạo phòng "Sản Xuất" + gán
   workspace `production` trong `/admin/departments`; tạo user tổ trưởng test
   → ghi vào `docs/test.md`.

## P2 — Màn hình xưởng (~1 ngày)

1. **Trang chủ `/production`**: danh sách LSX đang chạy (`approved` +
   `in_progress`) dạng **card lớn** (không dùng DataTable dày): mã LSX, khách,
   giai đoạn hiện tại, hạn xuất, badge ⚠ khi sát/quá hạn (`assessLateRisk`
   sẵn có). Cả card là 1 nút bấm → mở chi tiết (thân thiện touch).
2. **Chi tiết `/production/lsx/[id]`**: tái dùng `LsxDetailView` với
   `canApprove=false`, `canEditSpec=false`, `canManage=true` — page wrapper
   mỏng, 0 component mới. 3 thao tác chính có sẵn: Cập nhật giai đoạn /
   Đã nhận vật tư / Hoàn thành.
3. **Planning giữ nguyên**: KH-CƯ vẫn thấy + bấm thay được (xưởng nghỉ,
   máy hỏng) — quyền không thu hẹp, chỉ mở rộng.

## P3 — Bản compact cho tablet (~0.5 ngày, CHỈ làm sau khi xưởng dùng thử P2)

- Nếu `LsxDetailView` quá rậm với máy xưởng: component `LsxShopfloorView`
  tối giản — 3 nút ≥ 48px, select giai đoạn cỡ lớn, timeline rút gọn, không
  spec/file. Đừng làm trước khi có phản hồi thật — tránh đoán mò UI.

## Test + nghiệm thu

- **Unit (bắt buộc — permissions)**: `isProductionStaff`; production staff
  cập nhật giai đoạn / nhận VT / hoàn thành được; **KHÔNG** duyệt LSX, không
  tạo PO, không lập phiếu kho (test negative từng cái).
- **UAT thêm mục 8c**: tổ trưởng login → tự vào `/production`, thấy đúng LSX
  đang chạy, cập nhật giai đoạn được, không thấy nút duyệt; NV phòng khác vào
  `/production` bị đẩy về; KH-CƯ vẫn thao tác được như cũ.
- `npm run check` sạch; cập nhật `docs/system-status.md` (Sản xuất/Xưởng
  ⚠ gián tiếp → ✅) + traceability PROD-01/02/03 ghi "xưởng tự thao tác".

## Ngoài phạm vi (đừng làm lẫn)

- Chi tiết người thợ per giai đoạn (PROD-04/SUP-09) — GĐ3, `production_progress`
  đã chừa đường.
- Tách quyền Thu mua vs Kế hoạch SX trong phòng KH-CƯ — chờ DN trả lời OI-13.
- Workspace QC — giai đoạn sau.

## Rủi ro / lưu ý

- Phòng "Sản Xuất" chưa tồn tại trong DB dev — P1.7 phải làm trước khi UAT,
  nếu quên thì login tổ trưởng sẽ fallback `/tasks`.
- `canTrackProgress` nới thêm 1 nhánh — chạy lại toàn bộ test production
  hiện có (đã cover supply/GĐ) để chắc không hỏng hành vi cũ.
