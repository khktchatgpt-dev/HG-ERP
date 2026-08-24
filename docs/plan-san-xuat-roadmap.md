# Roadmap: Hoàn thiện module Sản xuất (đối chiếu tư vấn MES 12 mục)

> Soạn 23/08/2026 từ bản tư vấn MES 12 mục user cung cấp + khảo sát code 4
> workspace (`production` / `kehoach-sx` / `thongke` / `to`). Trạng thái:
> **CHƯA CODE**. Bản trình bày cho user: artifact "Lộ trình module Sản xuất".
>
> File này là bản đồ tổng. Chi tiết thực hiện tách 3 file:
>
> - `plan-sx-gd0-1-dashboard.md` — GĐ 0 (dọn nền) + GĐ 1 (Toàn cảnh xưởng thành dashboard thật)
> - `plan-sx-gd2-3-chi-tieu-theo-doi.md` — GĐ 2 (chỉ tiêu ngày + vạch thời gian) + GĐ 3 (ma trận tiến độ, nghẽn WIP)
> - `plan-sx-gd4-5-bao-cao-va-va.md` — GĐ 4 (tầng báo cáo) + GĐ 5 (vá chất lượng dữ liệu)

## Nguyên tắc đọc bản tư vấn

Bản tư vấn là khung MES tiêu chuẩn — dùng làm **checklist soi thiếu**, không
phải bản vẽ làm theo. Nền dữ liệu sản xuất đã chắc (sổ append-only
`production_entries`, giao tổ `production_transfers`, khoá sổ
`production_day_locks`, snapshot định mức `production_order_boms`); nghiệp vụ
thật khác giả định tài liệu: người nhập duy nhất ở tổ là **thống kê**, QC
không lên hệ thống, sổ thật là ma trận ngày × tổ × công đoạn, một LSX vài chục
dòng SP với BOM 2 cấp (phôi đếm chi tiết, hàn+ đếm cụm).

## Đối chiếu 12 mục → quyết định

| #   | Mục trong tài liệu                       | Quyết định | Ghi chú                                                                                                    |
| --- | ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Tổng quan (dashboard)                    | NÂNG CẤP   | Overview có cảnh báo trễ 2 lớp nhưng **không có số sản lượng nào**, vật tư chỉ badge có/không → GĐ 1        |
| 2   | Kế hoạch SX (tầng duyệt riêng)           | KHÔNG LÀM  | Đơn → LSX trực tiếp; `/kehoach-sx` đã lên lộ trình + giao tổ + hạn từng việc                                |
| 3   | Lệnh sản xuất                            | ĐÃ CÓ      | 7 trạng thái, gộp nhiều đơn, nhóm/dòng theo đợt xuất; chỉ vá panel vật tư cho quản đốc (GĐ 1)               |
| 4   | BOM nhiều cấp                            | ĐÃ CÓ      | Định mức sống ở hồ sơ SP, lệnh snapshot `production_order_boms`; KHÔNG dựng màn BOM riêng                   |
| 5   | Công đoạn (máy, giờ vào-ra)              | KHÔNG LÀM  | Form không ai nhập — tổ chỉ có thống kê ghi số lượng                                                        |
| 6   | Theo dõi SX (Kanban)                     | NÂNG CẤP   | Kanban sai mô hình (1 SP nằm nhiều công đoạn cùng lúc) → ma trận tiến độ trên nền sổ tổng (GĐ 3)            |
| 7   | Thống kê sản lượng                       | ĐÃ CÓ      | Khu mạnh nhất: FastEntryGrid, khoá sổ tổ×ngày, backflush kg, đồng bộ SP=MIN                                 |
| 8   | Sản phẩm lỗi (nguyên nhân 4 nhóm)        | NÂNG CẤP   | Đã thu `defect_qty`+lý do; KHÔNG thêm form phân loại — chỉ thêm báo cáo phế (GĐ 4)                          |
| 9   | Cấp phát nguyên liệu                     | ĐÃ CÓ      | BOM → nhu cầu → tồn → xuất/hoàn kho theo LSX đã go-live (0161/0162, `v_lsx_material_status`)                |
| 10  | Nhập BTP/TP                              | ĐÃ CÓ      | Sổ đạt/phế per công đoạn, `finish_state`, hoàn thành lệnh đồng bộ đơn bán                                   |
| 11  | Tiến độ (Gantt)                          | LÀM MỚI    | Dữ liệu đủ (`production_jobs.planned_start/planned_end`) nhưng chưa màn nào vẽ trục thời gian → GĐ 2        |
| 12  | Báo cáo                                  | LÀM MỚI    | Mới có báo cáo tháng SSR thuần — không API/Excel/kỳ tự do/phế/năng suất/hao hụt → GĐ 4                      |

## 6 giai đoạn — tóm tắt

| GĐ  | Tên                                    | Khối lượng | Phụ thuộc               |
| --- | -------------------------------------- | ---------- | ----------------------- |
| 0   | Dọn nền (0090 remote? + dọn nợ 0114)   | ✅ XONG 23/08 | —                    |
| 1   | Toàn cảnh xưởng thành dashboard thật   | ✅ XONG 23/08 | GĐ 0                 |
| 2   | Chỉ tiêu ngày + màn vạch thời gian     | ✅ XONG 23/08 (trừ 2.2 tuỳ chọn) | GĐ 1 |
| 3   | Ma trận tiến độ + cảnh báo nghẽn WIP   | ✅ XONG 23/08 | song song GĐ 2       |
| 4   | Tầng báo cáo (service + API + Excel)   | ✅ XONG 23/08 | —                    |
| 5   | Vá chất lượng dữ liệu & ràng buộc      | ✅ XONG 23/08 (5.4 chờ bài lương SP) | — |

**Trình tự đề nghị:** GĐ 0 ngay (nửa buổi) → GĐ 1 trước tiên (đổi trải nghiệm
quản đốc rõ nhất, không cần migration) → GĐ 2 bước 1 và GĐ 3 song song → GĐ 4
chỉ bắt đầu khi tầng số liệu phía trên đã được xưởng dùng và tin → GĐ 5 nhét
xen kẽ. Sau mỗi GĐ: `npm run check` sạch + xưởng dùng thử ~1 tuần.

**Nghiệm thu UI 23/08/2026** trên dev server + DB thật bằng lệnh seed
`LSX-TEST-UI` (`scripts/dev-seed-lsx-test-ui.mjs`, dọn bằng
`scripts/dev-cleanup-lsx-test-ui.mjs`): Toàn cảnh (KPI 835 kế hoạch suy khớp
tính tay 235+600 nợ dồn, badge "Thiếu 2 vật tư · trễ hẹn 1 ngày" + tooltip
tên, panel tổ 70/235 · WIP 893 · Nghẽn: Hàn · ✓ chốt sổ 1/2 — và các lệnh
THẬT cũng hiện đúng badge thiếu vật tư); /kehoach-sx/tien-do (3 vạch, Nguội
QUÁ HẠN); sổ tổng (%, tint QUÁ HẠN KH, phế trong ngoặc); báo cáo tháng chạy
trên reports.service + nút Tải Excel; API 4 loại JSON + xlsx hợp lệ; hồ sơ
lệnh shell xưởng thấy panel vật tư KHÔNG tiền/không nút chốt lại. 0 lỗi
console. Lệnh test còn nằm trên DB cho user bấm thử — xoá bằng script trên.

## Đã CHỐT KHÔNG LÀM — đừng đề xuất lại

1. **Kanban lệnh theo công đoạn** — 1 thẻ không đại diện được lệnh nhiều SP
   nằm nhiều công đoạn cùng lúc.
2. **Tầng "Kế hoạch SX" có vòng duyệt riêng** — lệnh đã đủ vòng duyệt 7 trạng
   thái, thêm tầng là thêm việc nhập không thêm thông tin.
3. **Quản lý máy móc, giờ vào–ra công đoạn, phân loại nguyên nhân lỗi** — QC
   không lên hệ thống; mức thu được thật (SL, kg, phế + lý do, finish_state)
   đã thu rồi.
4. **Màn BOM riêng trong khu Sản xuất** — hai nguồn một số là mầm sai lệch.

## Khoảng trống lớn nhất (để hiểu vì sao xếp GĐ như trên)

- Hệ thống **chỉ đo thực tế, không có kế hoạch để so**: không tồn tại bảng chỉ
  tiêu sản lượng ngày; `production_jobs.planned_start/planned_end` là hạn công
  đoạn, không phải chỉ tiêu SL/ngày.
- `jobsService.overview` **không đọc `production_entries`** — Toàn cảnh xưởng
  không có bất kỳ con số sản lượng/phế/kg nào.
- Tín hiệu vật tư ở màn xưởng chỉ là badge `materials_received_at is null`,
  không nối `v_lsx_material_status`, không so `materials_due_at`.
- Báo cáo tháng là SSR thuần (`thongke/bao-cao/page.tsx`) — không API route,
  không xuất Excel, khoá cứng theo tháng.
