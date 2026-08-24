# Kế hoạch: Đưa chuỗi ERP vào sản xuất thật (go-live)

> Soạn 23/08/2026, sau khi hoàn tất 6 GĐ module Sản xuất (plan-san-xuat-roadmap.md)
> và user xác nhận Cung ứng đã xây xong. Trạng thái: **GĐ A ĐÃ KHỞI ĐỘNG**
> (thí điểm định hình 03/26-27 - MX xong 23/08).
>
> Nguyên tắc: các phòng Sales – Cung ứng – Kho – SX đã CÓ CODE; thứ chặn
> go-live là DỮ LIỆU + VẬN HÀNH, không phải màn hình mới. Phòng code mới duy
> nhất còn thiếu là Kế toán.

## GĐ A — Go-live Sản xuất (2–4 tuần, chủ yếu vận hành)

Sổ sản xuất đang rỗng — 11 lệnh thật active đều "0/0 công đoạn". Luồng chuẩn
mỗi lệnh: **định hình chi tiết (thống kê) → lên lộ trình + giao tổ (Kế hoạch)
→ giao phôi (sổ bàn giao) → ghi sổ hằng ngày → chốt sổ**.

### Độ phủ BOM của các lệnh đang chạy (đo 23/08/2026)

| Lệnh              | Dòng SP | SP có BOM | Σ dòng định mức | Ghi chú                         |
| ----------------- | ------- | --------- | --------------- | ------------------------------- |
| 03/26-27 - MX     | 2       | 2/2       | 75              | ✅ ĐÃ ĐỊNH HÌNH THÍ ĐIỂM 23/08  |
| 01/26-27 - YOTRIO | 3       | 3/3       | 48              | đủ BOM — làm kế tiếp            |
| 02/26-27 - MX     | 10      | 9/10      | 257             | thiếu 1 SP                      |
| 01/26-27 - MX     | 17      | 12/17     | 306             | thiếu 5 SP                      |
| 06/26-27 - MX     | 26      | 11/26     | 223             | thiếu 15 SP                     |
| 08/26-27 - MX     | 5       | 3/5       | 55              |                                 |
| 04/26-27 - MX     | 2       | 1/2       | 27              |                                 |
| 07/26-27 - MX     | 2       | 0/2       | 0               | chưa có BOM nào                 |
| 01/26-27 - ROSCO  | 37      | 1/20      | 3               | gần như trống                   |
| 01/26-27 - LAURA  | 87      | 0/26      | 0               | trống                           |

### Checklist go-live

1. **Định hình chi tiết** — ✅ CHẠY HÀNG LOẠT 23/08: **8/11 lệnh đã có bản
   nháp từ BOM (994 dòng)**, kg định mức đi kèm (suggest map weight_kg→dm_kg).
   Thống kê chỉ còn SOÁT + sửa từng lệnh. 3 lệnh không có BOM (LAURA, 07-MX,
   LSX-2026-0001): thống kê định hình tay + bật checkbox "Khởi tạo định mức
   SP chưa có BOM" để hồ sơ SP có luôn bản nháp, hoặc Kỹ thuật nạp BOM trước.
2. **Lên lộ trình + giao tổ + hạn** — Kế hoạch mở `/kehoach-sx/[id]` per dòng
   SP. Đây là QUYẾT ĐỊNH nghiệp vụ (tổ nào làm gì) — không tự động hoá.
3. **Giao phôi vào tổ** qua `/thongke/giao-to` ngay khi bắt đầu — không có sổ
   bàn giao thì WIP/nghẽn trên Toàn cảnh là mù.
4. **Ghi sổ song song với Excel 2–4 tuần** — thống kê nhập cả hai, cuối tuần
   đối chiếu bằng `/thongke/bao-cao` vs sổ Excel; khớp liên tiếp 2 tuần thì
   bỏ Excel.
5. ~~Chốt 2 câu hỏi vận hành~~ **User chốt 23/08/2026, ĐÃ CODE:**
   - Xưởng LÀM Chủ nhật → `WORKING_SUNDAYS = true` (chỉ tiêu suy chia đều cả CN).
   - `suggest` từ BOM mang theo `weight_kg → dm_kg` — backflush kg chạy từ bản nháp.
   - **SP chưa có BOM: thống kê được khởi tạo định hình rồi NHẬP NGƯỢC lên hồ
     sơ SP** — checkbox "Khởi tạo định mức SP chưa có BOM" ở màn định hình;
     rào chắn: chỉ khi hồ sơ RỖNG (không bao giờ đè Kỹ thuật), hồ sơ khoá thì
     chặn, `bom_status` lên 'drawing' chứ không 'done' (Kỹ thuật rà mới chốt),
     đi qua đúng pipeline `calcPartDerived`. → gỡ kẹt 3 lệnh trống BOM
     (07-MX / ROSCO / LAURA): định hình tay một lần, hồ sơ SP có luôn bản nháp.
   - ~~Chỉ tiêu ngày thật (GĐ 2.2) để mở~~ → **ĐÃ XÂY 23/08** (user chốt
     hoàn thành SX): bảng 0168 + màn `/kehoach-sx/chi-tieu`; Toàn cảnh ưu
     tiên số Kế hoạch giao, ô trống rơi về số suy.
6. **Bàn giao TỔ→TỔ: phân tích trước, KHÔNG code** (user chốt 23/08) — hiện
   trạng + 6 câu hỏi thực tế + 3 phương án ở `docs/phan-tich-ban-giao-to.md`;
   go-live chạy mô hình hiện tại (đúng sổ Excel cũ), 2 tuần sau họp chọn PA.
7. Xoá lệnh demo khi không cần nữa: `node scripts/dev-cleanup-lsx-test-ui.mjs`.

## GĐ B — Trả nợ định mức (Kỹ thuật, song song GĐ A)

Đo lại 23/08: **294/765 SP** đã `bom_status=done`, 4.207 dòng định mức.
Script `bom-derived-fix.mjs` dò khô ra **"sẽ sửa: 0"** — nợ số dẫn xuất ĐÃ
TỰ TẤT TOÁN qua các đợt nạp lại sau 19/08 (đừng chạy --apply nữa). Nợ còn
lại là việc tay của Kỹ thuật, script không đoán hộ:

1. **357 dòng ống rỗng thiếu δ** (dày vật liệu) → không tính được kg; bổ sung
   δ hoặc gắn mã khuôn.
2. **226 dòng kg người nhập lệch hình học >15%** (danh sách trong dò khô của
   `scripts/bom-derived-fix.mjs`) — rà tay, số người nhập luôn thắng.
3. **22/218 SP thẻ "Tổng hợp vật tư" còn rỗng.**
4. **471 SP chưa chốt BOM** — ưu tiên theo GĐ A: SP nằm trong lệnh đang chạy
   trước (07/26-27, ROSCO, LAURA đang trống hoàn toàn). Công cụ: BOM AI
   import (đã chạy thật trên Gemini).

## GĐ C — Kế toán / Tài chính (phòng code tiếp theo)

Hiện chỉ có skeleton (`src/modules/dept/accounting/` 3 file nhỏ + màn
invoices). Mọi dữ liệu đầu vào đã sẵn trong chuỗi. Thứ tự nghiệp vụ:

1. **Công nợ NCC** — ✅ XONG C.1 23/08 (`plan-ke-toan-cong-no-ncc.md`): màn
   `/finance/cong-no-ncc`, phát sinh từ phiếu nhập có giá (phiếu đảo cấn
   trừ), sổ thanh toán 0167, tách tiền tệ. C.1b treo: hạn thanh toán có cấu
   trúc + cảnh báo, đối chiếu hoá đơn đỏ. LƯU Ý: Kho/Cung ứng chưa go-live
   dữ liệu (0 PO received) nên sổ đang trống — đúng hiện trạng.
2. **Công nợ khách** — đơn hàng + giao từng phần (0120) + `deposit_percent`.
3. **Giá thành theo lệnh** — xuất kho theo LSX (v_lsx_material_status) + kg
   backflush + gia công ngoài; nền số liệu là thứ vừa nghiệm thu.
4. **Lương sản phẩm** — mở khoá FK công nhân (nợ 0090 đã chốt chờ đúng bài
   này); ăn thẳng vào sổ `production_entries.worker_name`.

Mỗi mục lập plan doc riêng khi bắt tay (theo khuôn plan-san-xuat-roadmap.md).

## GĐ D — Hạ tầng dùng thật (xen kẽ, TRƯỚC khi mở rộng người dùng)

Từ Security caveats trong CLAUDE.md — thành vấn đề thật khi cả công ty vào:

1. Đặt lại mật khẩu (hiện chỉ admin cấp lại) + audit log đăng nhập/thao tác nhạy cảm.
2. Rate-limit đăng nhập đang in-memory single-instance — chuyển Upstash/Redis
   nếu deploy multi-instance/serverless.
3. Backup DB định kỳ + quy trình khôi phục thử một lần.
4. Một lượt `check-rls` + rà security advisor sau các migration 0165/0166.

## Trình tự tổng

GĐ A bắt đầu ngay (đã thí điểm) · GĐ B song song theo nhịp lệnh · GĐ C bắt
đầu bằng Công nợ NCC ngay khi GĐ A vào nhịp (không cần chờ xong) · GĐ D xen
kẽ, chốt trước khi mở tài khoản hàng loạt.
