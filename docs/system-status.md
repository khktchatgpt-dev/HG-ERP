# Hiện trạng hệ thống ERP Hoàng Gia & việc tiếp theo

Cập nhật **07/2026** (sau merge `feat/supply-completion-po-hardening` → main,
commit `c192a31`). Tài liệu này trả lời 2 câu: *hệ thống hoàn thiện tới đâu* và
*làm gì tiếp theo*.

## 1. Tổng quan

ERP nội thất xuất khẩu, phân kỳ theo SRS: **GĐ1 = trục vận hành** (bán hàng →
sản xuất → mua vật tư → kho), kế toán/HR đầy đủ để GĐ2. Stack: Next.js 16 +
React 19 + Supabase Postgres (RLS blocked-anon, secret-key server), auth tự
quản (bcrypt + JWT). 10 workspace theo phòng ban, quyền theo role + phòng ban.

**Trạng thái GĐ1: HOÀN THÀNH trục xương sống.** Chuỗi nghiệm thu SRS §7 chạy
trọn trên UI:

> Báo giá → Đơn hàng → Phát LSX → GĐ duyệt → Cung ứng đặt vật tư (so giá NCC)
> → GĐ duyệt PO → gửi NCC → Kho nhập (QC) → Kho xuất theo LSX → xưởng nhận VT
> → cập nhật tiến độ → hoàn thành → **xác nhận giao hàng**.

Chất lượng: `npm run check` xanh (typecheck + lint 0 error + **272 test**);
41 migration đã apply; dữ liệu mẫu demo đầy đủ chuỗi đã seed trên DB dev —
gồm bộ demo xưởng trên `LSX-2026-0001` (7 chi tiết, 15 dòng sản lượng, 4 lượt
gia công ngoài; xem `docs/test.md`). **Công đoạn theo SP**: mỗi chi tiết chọn
được "công đoạn cuối" (0041) — không sơn thì đủ ở nguội là Hoàn thành.
Luồng vận hành SX ↔ KH-CƯ mô tả đầy đủ: `docs/luong-van-hanh-sx-cung-ung.md`.

## 2. Hoàn thiện tới đâu — theo phân hệ

| Phân hệ | Mức | Đã có | Còn thiếu |
|---|---|---|---|
| **Sales** (`/sales`) | ✅ GĐ1 đủ | Khách hàng, báo giá (hồ sơ riêng), đơn (từ BG hoặc trực tiếp), sửa đơn + lịch sử, phát LSX + spec SX, theo dõi đơn, cảnh báo trễ ⚠, giao hàng, in hợp đồng/LSX | SAL-08 công nợ khách (GĐ2) |
| **Kỹ thuật** (`/technical`) | ✅ GĐ1 đủ | Thư viện SP theo khách, BOM per SP, file kỹ thuật, ảnh đại diện, giá tham chiếu, tính load cont, **thông tin XK & đặc tính nội thất (0037)**: HS code, xuất xứ, chất liệu, tải trọng, lắp ráp KD, bộ gồm, NW/GW/CBM per thùng | Version chain file tường minh (G-4, GĐ2); quan hệ set-item tường minh nếu DN cần BOM tổng tự tính từ bộ |
| **Kế hoạch - Cung ứng** (`/planning`) | ✅ GĐ1 đủ + mở rộng | NCC, **bảng giá NCC + so giá/autofill trong PO**, PO đủ vòng đời (tạo/sửa/duyệt/gửi/về hàng/huỷ/tạo lại), **hồ sơ mua hàng upload vào PO**, gợi ý nhu cầu BOM×SL−đã xuất, **bảng điều phối tiến độ SX** (nguy cơ trễ ⚠ + tình trạng vật tư/BOM từng LSX + đổi giai đoạn/hoàn thành tại chỗ — 07/2026), in đơn đặt, **cảnh báo PO quá hẹn giao ⚠** (badge/lọc/widget), cảnh báo ngừng NCC còn PO mở | SUP-09 chi tiết người thợ (GĐ3). ~~Email đơn đặt cho NCC~~ — DN chốt 07/2026: NV tự gửi email riêng bằng bản in, KHÔNG làm |
| **Kho** (`/warehouse`) | ✅ GĐ1 (trừ Phase 4) | Danh mục VT, phiếu PNK/PXK nhiều dòng gắn PO/LSX (guard trạng thái PO/LSX — chỉ nhập PO đang mở, chỉ xuất LSX đã duyệt/đang SX), QC nhập, tồn realtime + cảnh báo min, scan, in 01-VT/02-VT | Kiểm kê (OI-08) + phiếu điều chuyển (OI-09) — DB sẵn, chờ DN chốt. Phiếu ghi nhầm: chưa có huỷ/điều chỉnh phiếu — xử lý bằng phiếu ngược, chờ OI-08 |
| **BGĐ** (`/exec`) | ✅ | Duyệt tập trung LSX + PO: thấy **tổng tiền**, mở chi tiết + hồ sơ trước khi duyệt | — |
| **Sản xuất/Xưởng** (`/production`) | ✅ GĐ1 đủ | **Workspace riêng cho xưởng (07/2026)**: card LSX đang chạy (máy ít chuột), cập nhật giai đoạn/nhận VT/hoàn thành (tái dùng LsxDetailView); quyền `isProductionStaff` theo `departments.workspace_id`; KH-CƯ vẫn bấm thay được | PROD-04 người thợ (GĐ3); bản compact tablet (P3 — chờ xưởng dùng thử) |
| **HR** (`/hr`) | ⚠ tối thiểu | Nghỉ phép (nộp/duyệt) | Chấm công, hồ sơ NS, lương — GĐ2 |
| **Kế toán** (`/finance`) | ⚠ khung | Hoá đơn cơ bản | Công nợ, phiếu thu, giá thành — GĐ2 (OI-01/03/05) |
| **QC** | ❌ | QC nhập kho nằm trong phiếu PNK | Workspace QC — GĐ sau |
| **Hệ thống** (`/admin`) | ✅ | Users, phòng ban, danh mục dùng chung, audit, health | — |

**Gaps ban đầu (traceability)**: G-1 bảng giá ✅ · G-2 view nhu cầu LSX ✅ ·
G-3 xưởng nhận VT ✅ · G-4 file version (GĐ2, đã chấp nhận).

## 3. Việc tiếp theo — theo thứ tự đề xuất

### 3.1 Ngay lập tức (không cần code)
1. **UAT theo `docs/uat-checklist.md`** trên bộ dữ liệu mẫu đã seed — 5 tài
   khoản test đủ vai (xem `docs/test.md`). Các flow mới cần verify tay: bảng
   giá/so giá, sửa PO, hồ sơ file PO, duyệt ở /exec, giao hàng, cảnh báo trễ.
2. **Gửi doanh nghiệp chốt open issues** (`docs/open-issues-cau-hoi.md`):
   OI-08 kiểm kê, OI-09 điều chuyển, OI-10 ĐVT kép (~1.5 ngày code nếu "Có");
   thêm câu OI-13: *phòng KH-CƯ có người chuyên trách thu mua riêng không* →
   quyết nấc 2 tách quyền vị trí.

### 3.1b SRS mới nhận 11/07/2026 — Sản xuất chi tiết (`docs/srs-san-xuat-chi-tiet.md`)

Đặc tả sâu phần xưởng từ file Excel `Tổng TĐ SX- TK - KT.xlsx`: chi tiết
(component) per SP, sản lượng hằng ngày per công đoạn/tổ, gia công ngoài
TTP/Vinh, dashboard thay sheet `quan li`. Ước tổng ~4–5 tuần, 5 phase (SX-P1…P5).
**Bước 1 ✅ XONG 07/2026** (`docs/plan-lsx-components.md`): bảng chi tiết per
LSX do KẾ HOẠCH NHẬP TAY qua grid giống Excel (BOM chỉ để gợi ý/đối chiếu —
vì có thể chưa có/sai; có nút Chép từ lệnh trước), công thức tổng cần/kg/**số
cây** an toàn chia 0, nhu cầu tạo PO ưu tiên bảng chi tiết (fallback BOM),
cờ "Chưa nhập chi tiết" ở bảng điều phối, xưởng xem read-only — UAT mục 8d.
**Bước 2 (SX-P3 lõi) ✅ XONG 07/2026**: sổ sản lượng hằng ngày
`production_output_entries` (0039, append-only — SL/kg/phế/máy-màu per chi
tiết × công đoạn × tổ × ngày; tổ mặc định = phòng người nhập; xoá-nhập-lại
thay vì sửa đè); tổng hợp **thiếu/dư, %HT per công đoạn + tổng, đồng bộ bộ SP
theo chi tiết chậm nhất** (`src/lib/production-summary.ts` — công thức có
test, chia 0 an toàn); nhập vượt tổng cần → CẢNH BÁO không chặn (FR-PR-07);
lưới nhập theo ngày + bảng tổng hợp ngay trong chi tiết LSX (cả 3 workspace);
guard: bảng chi tiết KHOÁ ghi đè khi đã có sản lượng — UAT mục 8e.
**Bước 3 (SX-P4 + SX-P5) ✅ XONG 07/2026**: gia công ngoài
`production_outsource_entries` (0040 — sổ giao↔nhận append-only per chi tiết ×
đơn vị TTP/Vinh = NCC dịch vụ; đối chiếu giao/nhận/thiếu/%HT + cảnh báo nhận
vượt giao; panel trong LSX); **Bảng tổng `/production/board`** thay sheet
`quan li` (mọi chi tiết × công đoạn các lệnh đang chạy, lọc + **Xuất Excel
CSV** UTF-8 BOM; nav ở cả production lẫn planning — gate /production nới cho
KH-CƯ giám sát).
**Còn lại của SRS**: import Excel (chờ DN gửi file gốc), báo cáo kỳ theo
tổ/tuần/tháng (FR-RP-02/03), chốt kỳ tháng (FR-SY-05), ràng tổ↔công đoạn
(OI-14 nếu DN cần), đối chiếu công nợ GCN (FR-OS-03 — GĐ2 kế toán).

### 3.2 Ngắn hạn (sau khi có câu trả lời, ~1 tuần)
3. ~~Vá vòng đời theo thực tế~~ ✅ **XONG 07/2026**
   (`docs/plan-order-lsx-lifecycle.md`): LSX bị từ chối gửi duyệt lại được,
   sửa đơn sau LSX notify Cung ứng, huỷ đơn khép chuỗi LSX/PO (migration 0036).
   Còn verify tay theo UAT mục 8b.
4. Build các mục OI được chốt (kho Phase 4, ĐVT kép).
5. **Luồng từ chối PO phương án nặng** (trạng thái `rejected` riêng) — chỉ nếu
   DN cần tách báo cáo từ-chối vs huỷ (hiện đã có "Tạo lại từ đơn này").
6. ~~Workspace Sản xuất cho xưởng~~ ✅ **XONG P1+P2 07/2026**
   (`docs/plan-production-workspace.md`): xưởng tự cập nhật tiến độ tại
   `/production`; tài khoản test `totruong.test@hg.com` (docs/test.md); UAT
   mục 8c. Còn P3 (bản compact tablet) — chỉ làm sau khi xưởng dùng thử.

### 3.3 Trung hạn — GĐ2 (theo phân kỳ SRS)
7. **Kế toán**: công nợ theo đơn/đối tác (OI-01), phiếu thu gắn đơn (OI-03),
   giá thành/lời-lỗ theo đơn (OI-05 — dữ liệu giá bán/mua/unit_cost đã sẵn).
8. **Hạ tầng jobs/cron** (gap G5 erp-readiness): nhắc trễ hạn qua notification
   (nâng cấp late-risk + PO quá hẹn giao từ hiển thị → đẩy; phần hiển thị đã
   xong 07/2026 — `assessPoLate` trong `src/lib/late-risk.ts`).
9. **Integrations** (G7): MISA (OI-07). Email đơn đặt NCC đã bỏ — DN chốt
   07/2026 NV tự gửi email riêng.
10. **Bảo mật trước khi dùng thật rộng** (đã ghi trong CLAUDE.md): rate-limit
    /api/login, đổi/reset mật khẩu, khoá tài khoản sau N lần sai, backup DB.

### 3.4 Dài hạn — GĐ3
11. Chi tiết người thợ per giai đoạn (SUP-09/PROD-04 — `production_progress`
    đã chừa đường), KPI xưởng, báo cáo quản trị (G6 reports engine),
    multi-tenant nếu mở xưởng con (G1).

## 4. Tài liệu tham chiếu

- Truy vết yêu cầu ↔ schema: `docs/db-requirements-traceability.md`
- Kế hoạch đã hoàn thành: `plan-supply-completion.md`, `plan-po-completion.md`,
  `plan-supply.md`, `plan-warehouse-completion.md`, `plan-lsx-issuance.md`
- Câu hỏi chờ doanh nghiệp: `docs/open-issues-cau-hoi.md`
- Đánh giá kiến trúc code: `docs/erp-readiness-assessment.md`
