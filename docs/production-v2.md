# Sản xuất v2 — thiết kế lại theo VAI (07/2026, migration 0084/0085)

Đập toàn bộ khu Sản xuất cũ, xây mới từ quy trình thật (user chốt 07/2026).
Các khối giáp ranh giữ nguyên: phát LSX từ đơn (Sales), GĐ duyệt (exec),
kho xuất vật tư theo LSX, PO cung ứng, giao hàng (`ordersService.deliver`).

## Quy trình

Phát LSX → GĐ duyệt → **Kế hoạch** lên lộ trình + giao tổ + hạn + ưu tiên →
**Thống kê** định hình bảng chi tiết (từ BOM Kỹ thuật + sửa, chốt snapshot) →
Thống kê nhập sổ số liệu tập trung hằng ngày → **Tổ trưởng** đối chiếu + xác
nhận xong công đoạn (server CHẶN khi số chưa đủ) → quản đốc hoàn thành LSX
(gate: mọi việc xong) → đơn `completed` → Sales xác nhận giao → `delivered`.

## Vai → WORKSPACE (mỗi vai một workspace — user chốt 24/07/2026)

| Workspace | Route | Vai | Trang |
|---|---|---|---|
| Tổ sản xuất | `/to` | tổ trưởng + tổ viên | Việc của tổ · Lệnh đang chạy · Quá trình tổ |
| Thống kê xưởng | `/thongke` | thống kê (nhãn 0087) | Sổ số liệu · Định hình (+`/[id]`) · Gia công ngoài · Lệnh đang chạy |
| Kế hoạch sản xuất | `/kehoach-sx` | planner | Kế hoạch (+`/[id]`) · Lệnh đang chạy |
| Sản xuất (điều hành) | `/production` | quản đốc/GĐ | Toàn cảnh xưởng |

Mỗi workspace có `lsx/[id]` hồ sơ lệnh riêng (shell tương ứng). Đường cũ
`/production/team|logbook|shaping|plan` redirect sang route mới. Gate: nhà
xưởng (dept workspace 'production') mở cửa CẢ gia đình; người ngoài cần
`workspace.view.production`; landing sau login theo nhãn/vai
(resolveDefaultWorkspace). Switcher chỉ bày workspace đúng vai.

## Mô hình dữ liệu (0084)

- `production_orders` — header LSX (giữ; + `priority`, `materials_received_at/by`;
  − `current_stage`).
- `production_jobs` ★ — 1 dòng = LSX × dòng SP × công đoạn: seq lộ trình, tổ,
  hạn kế hoạch, status todo/doing/done + xác nhận. **Nguồn TRẠNG THÁI duy nhất.**
- `production_components` — bảng định hình (snapshot từ `technical_bom_lines`).
- `production_entries` — sổ số liệu append-only. **Nguồn SỐ duy nhất.**
  Phế = số + lý do text tự do (bỏ danh mục mã lỗi).
- `production_outsource_entries`, `production_day_locks` — gia công + chốt sổ.
- `v_order_tracking` — thay `current_stage` bằng `jobs_total`/`jobs_done`.

Đã bỏ hẳn: `production_progress`, `production_order_routes`,
`production_incidents` + `production_defect_codes` (sự cố báo ngoài hệ —
user chốt), các bảng `production_order_components`/`production_output_entries` cũ.

## Quy tắc một nguồn sự thật

- Sổ có số đầu tiên ở (dòng SP × công đoạn) → job tự nhích `todo → doing`;
  lần ghi đầu của lệnh `approved` → lệnh `in_progress`, đơn `in_production`.
- Job `done` = tổ trưởng xác nhận — `jobsService.confirmDone` CHẶN khi còn chi
  tiết `done < total_needed` tại công đoạn; admin/manager override kèm lý do.
- Job done → event `production.stage.done` → notify tổ công đoạn kế (seq+1)
  + quản đốc.
- `lsxService.complete` CHẶN khi còn job chưa done / chưa có kế hoạch;
  override tương tự.
- Sửa kế hoạch không reset việc đã chạy; bỏ công đoạn doing/done bị chặn.

## Module (`src/modules/dept/production/`)

`lsx.service` (vòng đời) · `plan.service` (kế hoạch) · `components.service`
(định hình) · `entries.service` (sổ + chốt ngày) · `jobs.service` (việc tổ +
toàn cảnh + gate) · `outsource.service` · `ops.service` (báo cáo GĐ).
Lib thuần tái dùng: `component-needs`, `production-summary`, `late-risk`,
`stage-for-dept`, `order-progress` (đổi sang jobs_done/jobs_total).

RBAC: permission mới `production.plan.manage` (0085); định hình dùng
`production.components.edit` (grant thêm production_staff).

## Truy cập theo vai (0086)

- `director` = manager THUỘC PHÒNG Ban Giám Đốc (workspace `exec`) — duyệt
  LSX/PO + vào `/exec` tập trung đúng GĐ; trưởng phòng khối khác không còn.
- Xem chéo workspace phải có quyền tường minh `workspace.view.<id>`
  (exec dùng `exec.tower.view`); bỏ hẳn `openView`. Seed: director xem mọi
  nơi; planner/supply xem Sản xuất + Kho. Cấp thêm ở /admin/permissions.
- `/production` là cửa theo vai: NV xưởng → Việc của tổ; màn Toàn cảnh +
  Kế hoạch chỉ quản đốc(manager)/GĐ/planner/supply (member thường bị đẩy về).
- Quản đốc (manager) giữ điều phối qua rule role: plan.manage + daylock.unlock
  + override xác nhận/hoàn thành.
- **Nhãn vị trí xưởng (0087, KHÔNG cấp quyền)**: role nhãn `production_stat`
  (Thống kê — rơi vào Sổ số liệu, menu Sổ + Định hình + Tổ) và
  `production_leader` (Tổ trưởng — rơi vào Việc của tổ, menu tối giản 1 mục).
  Member chưa gán nhãn giữ UI đầy đủ như cũ. Gán nhãn ở /admin/permissions
  (source manual). Đã gán sẵn: thongke.%@hoanggia.de → stat; totruong.test → leader.

## Chưa làm (để dành)

- Kế hoạch tuần dạng lịch/Gantt (jobs đã có planned_start/planned_end).
- QC/nghiệm thu, kho thành phẩm, packing list (user chốt: chưa cần).
- Sửa spec in LSX từ màn Sales (API `/specs` giữ nguyên, UI gỡ tạm).
