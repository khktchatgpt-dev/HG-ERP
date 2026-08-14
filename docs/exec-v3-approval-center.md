# Khu Ban Giám đốc v3 — Trung tâm phê duyệt + theo dõi tổng thể

Trạng thái: **ĐÃ LÀM** (15/08/2026). Thay thế
[exec-v2-ky-duyet-plan.md](exec-v2-ky-duyet-plan.md) (14/08/2026).

## Vì sao lại đổi chỉ sau một ngày

Bản v2 thu khu Giám đốc về đúng một việc: **ký phiếu** — trang chủ là Hộp ký,
sidebar chỉ còn Hộp ký / Lịch sử / Luật ký, hai màn theo dõi (Sổ đơn hàng, Mua
hàng & NCC) chờ trả về phòng. Ngày 15/08 chủ dự án đảo lại thiết kế: phê duyệt
vẫn là trung tâm, nhưng khu GĐ phải được tổ chức theo **"công việc cần xử lý"**
chứ không phải theo phòng ban, và GĐ cần thêm **lớp theo dõi tổng thể** ngay
trong khu của mình — không phải đi mượn workspace của từng phòng.

Cụ thể ba nguyên tắc chốt:

1. **"Chờ tôi phê duyệt" là trung tâm và phải rất nổi bật** — mọi loại phiếu
   gom một chỗ, KHÔNG chia theo phòng ban ở cấp đầu tiên; chip lọc mới phân loại.
2. Màn đầu tiên trả lời 3 câu: *hôm nay tôi phải duyệt gì? có vấn đề gì cần xử
   lý? công ty đang chạy thế nào?*
3. Quyền GĐ chia **3 tầng**: Action (phê duyệt) → Monitoring (đơn hàng / sản
   xuất / mua hàng) → Analysis (lịch sử ký, luật ký, báo cáo).

## Điều hướng mới (workspaces.config.ts)

| Nhóm | Mục | Route | Ghi chú |
|---|---|---|---|
| Điều hành | Tổng quan | `/exec` | màn mở đầu — 3 khối theo thứ tự: chờ duyệt / tình hình / cần chú ý |
| Điều hành | Chờ tôi phê duyệt | `/exec/approvals` | Trung tâm phê duyệt — bảng gộp LSX + đơn mua, ký tại chỗ |
| Theo dõi | Đơn hàng | `/exec/orders` | sổ đơn hàng (0148) — giữ nguyên |
| Theo dõi | Sản xuất | `/exec/production` | MỚI: sổ lệnh SX theo trạng thái, chỉ đọc |
| Theo dõi | Mua hàng & NCC | `/exec/purchasing` | giữ nguyên |
| Ký & báo cáo | Lịch sử ký | `/exec/approvals/history` | giữ nguyên |
| Ký & báo cáo | Luật ký | `/exec/luat-ky` | giữ nguyên |
| Ký & báo cáo | Báo cáo tuần | `/reports/weekly` | trang dùng chung, chỉ role manager/admin |

Route sống nhưng không nằm trên menu: `/exec/tracking` (theo dõi đơn trong shell
GĐ), `/exec/lsx/[id]` (chi tiết LSX duyệt được tại chỗ — đích của sổ Sản xuất),
`/exec/approvals/{lsx,po}/[id]` (màn "Xem kỹ" của từng phiếu).

## Các màn

### `/exec` — Tổng quan (`ExecHomeScreen`, server component)

Nguồn: `execService.dashboard()` (mở rộng thêm `production.running` +
`production.by_status` đợt này). Bốn khối theo đúng thứ tự ưu tiên:

1. **Chờ tôi phê duyệt** — 2 thẻ to (Lệnh SX / Đơn mua), viền hổ phách khi có
   phiếu, hiện *chờ lâu nhất* + *tổng tiền theo tiền tệ*; bấm là vào Trung tâm
   phê duyệt đã lọc sẵn (`?loai=lsx|po`). Nút "Duyệt ngay (N)" ngay trên header.
2. **Tình hình hoạt động** — 4 ô: đơn hàng đang thực hiện, lệnh SX đang chạy
   (approved|in_progress), đơn mua đang xử lý, vật tư dưới tồn tối thiểu.
3. **Cần chú ý** — quản trị theo ngoại lệ: đơn trễ hạn giao, PO quá hẹn NCC,
   PO duyệt rồi đọng chưa gửi, vật tư thiếu. Mỗi dòng dẫn về màn xử lý.
4. **Sắp tới hạn giao ≤ 7 ngày** + dải cảnh báo *dòng đơn chưa có giá* (nói
   thẳng vì sao số tiền đang thiếu, dẫn về `/sales/orders/gia`).

### `/exec/approvals` — Trung tâm phê duyệt (`ApprovalCenterScreen`)

Kế thừa toàn bộ ruột Hộp ký v2 (`execService.signBox` — nạp nhẹ 5 truy vấn,
xếp *chờ lâu nhất* → *giá trị lớn nhất*), đổi vỏ theo mock của chủ dự án:

- **Máy tính**: bảng `Loại | Mã | Nội dung | Giá trị | Chờ | thao tác` (DataTable,
  sort được); **điện thoại**: thẻ dọc, nút Ký to trong tầm ngón cái.
- Chip lọc Tất cả / Lệnh SX / Đơn mua, đếm số trên chip; `?loai=` lọc sẵn.
- Ký / Trả lại (bắt lý do) ngay tại dòng; **ký hàng loạt** qua checkbox — phiếu
  **giá trị lớn** không chọn được, phải mở ra đọc (luật cũ giữ nguyên, kể cả
  chuyện tiền tệ lạ luôn coi là lớn).
- Màn rỗng nói thật: *đã ký hết* ↔ *chưa ai từng lập phiếu* là hai câu khác nhau.
- "Đã duyệt / Từ chối" xem ở Lịch sử ký (nút "Đã xử lý →" trên header).

### `/exec/production` — Sản xuất (`ProductionScreen`, MỚI)

Sổ LỆNH sản xuất: chip đếm theo trạng thái + bảng (mã lệnh → `/exec/lsx/[id]`,
khách + các đơn gộp, trạng thái, hạn xuất, ngày lập), tìm theo mã/khách/đơn.
Cố ý KHÔNG đi vào tiến độ công đoạn — số đó thuộc khu xưởng (`/production`,
`/thongke`) và `production_entries` còn trống; màn này chỉ cần
`production_orders` là có dữ liệu ngay.

## Đã xoá / thay

| Tệp | Số phận |
|---|---|
| `ExecDashboard.tsx` (bảng tin 09/08, mồ côi từ 14/08) | **xoá** — Tổng quan mới thay |
| `SignBoxScreen.tsx` (Hộp ký 14/08) | **xoá** — ruột chuyển vào `ApprovalCenterScreen` |
| `approvals/page.tsx` (redirect về `/exec`) | thành trang Trung tâm phê duyệt |
| `page.tsx` (Hộp ký) | thành trang Tổng quan |

Giữ nguyên không đụng: `ApprovalDetailScreen` + `approvals/{lsx,po}/[id]` +
`approvals/data.ts`, `useApprovalDecision`, `approval-parts`, lịch sử ký,
luật ký, `/exec/orders` (0148), `/exec/purchasing`, `/exec/tracking`,
`/exec/lsx/[id]`.

## Còn treo (kế thừa v2, chưa làm đợt này)

- **Đếm phiếu chờ ngay trên sidebar** ("Chờ tôi phê duyệt 🔴 16") — nav hiện là
  config tĩnh serialize qua server→client; muốn badge sống phải cho
  WorkspaceShell nạp số. Tổng quan đã làm việc này ở trong trang.
- Duyệt **báo giá** (v2 §5E), **uỷ quyền khi GĐ vắng** (§5G), **nhắc ký** ngoài
  app (§5H), lịch sử ký xuất Excel + giá trị tại thời điểm ký (§5I).
- Gán vai `director` cho tài khoản GĐ thật (v2 §5A) — vẫn **chờ người có quyền
  bấm** trên `/admin/permissions`.
- Approval Flow hiển thị *ai tạo → ai đã duyệt → đang chờ ai* trên màn Xem kỹ —
  hiện mới có người lập + lịch sử sự kiện; chưa vẽ thành stepper.
