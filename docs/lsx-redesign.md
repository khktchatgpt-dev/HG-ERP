# Thiết kế lại LỆNH SẢN XUẤT theo file thật của Sales (08/2026)

> **Trạng thái:** đã làm xong (migration `0114` + `0115`, code + phiếu in + màn
> soạn dòng). Chốt của chủ dự án 04/08/2026: 3 cấp lệnh→nhóm→dòng · **MỘT FORM
> CHUẨN dùng chung cho mọi khách** (bỏ ý định mỗi khách một mẫu — xem §3.2) ·
> làm trọn gồm cả revision. Phần CÒN NỢ nằm ở cuối §5.

Nguồn: 8 file LSX thật của 2 nhân viên Sales, 4 khách — LAURA (`.xls`, 101 dòng,
có bản REVISED), ROSCO (`.xlsx`, 92 dòng), YOTRIO/HAGEBAU (`.xlsx`), MERXX
(`01/02/03/04.26.27 HG-MX`). Mỗi khách một layout; phần dưới tách cái CHUNG
(khung phiếu) khỏi cái RIÊNG (bộ cột theo khách).

## 1. Bốn layout thật — cột nào của ai

Khung phiếu giống nhau ở mọi file: tiêu đề `LỆNH SẢN XUẤT` (kèm `(THAY ĐỔI
NGÀY …)` khi là bản sửa) → `Tên khách hàng` + `SỐ 01/26 - <khách>` +
`Ngày phát hành` → câu "Phòng kế hoạch yêu cầu các tổ trưởng…" → bảng dòng →
`Tổng` → `Nơi nhận: Quản lý sản xuất, các tổ trưởng, kho vật tư…` → `Giám Đốc`
+ "Phù Cát, ngày … tháng … năm …".

Bảng dòng thì khác nhau:

| Cột | LAURA | ROSCO | YOTRIO | MERXX |
|---|---|---|---|---|
| STT | ✓ | ✓ (= 1 PO) | ✓ | ✓ |
| Hình ảnh SP | ✓ | ✓ | ✓ | ✓ |
| Mã SP | ✓ | Customer's SKU | ✓ | ✓ |
| Tên nước ngoài | Tên tiếng Anh | MÔ TẢ | Tên SP/diễn giải | Tên tiếng Đức *(nội dung shipping mark)* |
| Tên tiếng Việt | ✓ | — | — | ✓ |
| Tên khai hải quan (kế toán) | ✓ | — | — | — |
| Số barcode | — | — | — | ✓ |
| ĐVT · Số lượng | ✓ | ✓ | ✓ | ✓ |
| Spec vật liệu | Mây · Nệm · Sơn · Kính · Gỗ | FINISH (1 ô gộp) · Mây/Vải | 8 ô tick: CAD · BOM · dây đan · wood · polywood · nhôm · gỗ bạch đàn · Fabric | Mây · Nệm · Sơn · Kính · Gỗ |
| Đóng gói | ✓ | ✓ | Packing + carton size | ✓ |
| CBM · TOTAL CBM · Total Cube/PO | — | ✓ | — | — |
| Khách con / SỐ PO | — | ✓ (PAPAYA 138 · PT-138-155-HG) | Số đơn hàng per dòng | — |
| Thời gian xuất | ✓ | THỜI GIAN GIAO HÀNG | Ngày yêu cầu giao hàng | ✓ |
| Ghi chú | Note + **Lưu ý quan trọng** | GHI CHÚ (spec dài) | Ghi Chú | Note + Ghi chú |
| Sẵn sàng SX | — | — | (8 ô tick ở trên) | Mẫu tại showroom · BOM · BẢNG VẼ · MẪU |

## 2. Chín điểm lệch giữa file thật và app hiện tại

1. **`machine` KHÔNG phải "Máy" mà là "MÂY"** (đan mây / dây dù). Dữ liệu thật:
   "Dây dù màu kem / HK-PP6 kem", "H5286B", "Stormstone (H5286B) _ VIPORA".
   App đang in nhãn "Máy" — xưởng đọc sai nghĩa. Đây là bug nhãn, sửa ngay được.

2. **Dòng LSX ≠ dòng đơn hàng.** BR-02 hiện tại lấy thẳng `sales_order_lines`
   làm dòng lệnh. File LAURA: mã `1700575.11` xuất hiện **5 lần**, mỗi lần một
   SL và một đợt xuất khác nhau (120/120/120/…). Dòng lệnh = **(SP × đợt xuất)**,
   không phải dòng đơn. Không tách ra thì không in nổi phiếu LAURA.

3. **Thiếu một cấp NHÓM giữa lệnh và dòng.** Mỗi khách nhóm theo một trục:
   ROSCO nhóm theo **SỐ PO** (mỗi nhóm có khách con + ngày giao + Total Cube),
   LAURA nhóm theo **bộ sưu tập** (`HALI - HALSTON - AMELIA`, `SIGRID`,
   `ARIA (GIA CÔNG AN KHÁNH)` — nhóm còn mang cả nơi gia công ngoài), YOTRIO ghi
   số đơn per dòng, MERXX không nhóm. STT đánh lại từ 1 trong mỗi nhóm.

4. **Bộ cột spec thay đổi theo khách** — 5 cột cứng
   (`machine/cushion/paint/glass/wood`) không đủ: ROSCO cần `FINISH` + `Mây/Vải`,
   YOTRIO cần 8 ô swatches, LAURA cần thêm "Tên khai hải quan", MERXX cần barcode.

5. **Thời gian xuất là dữ liệu bẩn**: serial `46381`, `w37.26` (tuần 37/2026),
   `25/12.2026` (gõ nhầm dấu), `11/01/27`, `2026-11-20`, và cả đoạn văn
   "DỰ KIẾN kiểm hàng 5/10/2026, Xuất hàng 10/10/2026, Xuất 1 cont full…".
   Ép `date` sẽ mất thông tin; phải giữ cả nhãn người dùng gõ.

6. **Mã SP có thể chưa tồn tại**: `Thông báo sau`, `26300-309 ( có 1 mẫu màu bạc )`.
   Không ép khoá ngoại cứng sang `technical_products` lúc phát lệnh.

7. **Checklist sẵn sàng sản xuất là text, không phải boolean**: `Có ( thiếu phụ
   kiện đóng gói)`, `Có ( thiếu mẫu Anh Dương đã làm bổ sung)`, `xác nhận sau`,
   `Thông báo sau`. App đang có `showroom_sample: boolean` — quá hẹp.

8. **CBM**: ROSCO tính `CBM/SP`, `TOTAL CBM = CBM × SL`, `Total Cube` cộng theo
   PO — để kiểm tra đóng đầy container trước khi lên PI. App chưa có gì.

9. **Khối "lưu ý chung" cuối phiếu** (ROSCO 9 điều: bảo hành khung/mây 3 năm,
   mây Vipora, nệm chuẩn UKFR + tem chống cháy, logo khách 138, carton layout,
   spare part…). Đây là điều khoản lặp theo KHÁCH, không nên gõ lại mỗi lệnh.

**Bản chỉnh sửa:** Sales sửa đè lên file cũ rồi phát lại toàn bộ, chỉ đổi tiêu đề
thành "CHỈNH SỬA NGÀY 01/08". Diff LAURA gốc ↔ REVISED: **69 dòng đổi** — sửa SL
(20→17, 36→17), sửa spec ("Dây dù màu xanh" → "màu hồng" — vốn là lỗi copy), chèn
cả một bộ SP mới (IMANI) làm nhóm đổi tên `SIGRID` → `SIGRID + IMANI`. Xưởng cầm
bản mới **không biết dòng nào đã đổi**.

## 3. Cấu trúc đề xuất

### 3.1 Ba cấp: lệnh → nhóm → dòng

```
production_orders                  (giữ) header lệnh: số, khách, ngày phát hành,
  │                                 trạng thái, người phát/duyệt, revision
  ├── production_order_groups ★     nhóm dòng in: tên nhóm, đơn hàng nguồn,
  │     │                           khách con, ngày giao, ghi chú nhóm, sort
  │     └── production_order_lines ★ dòng in: SP (FK mềm + mã/tên text snapshot),
  │                                 ĐVT, SL, đóng gói, CBM, đợt xuất (date +
  │                                 nhãn), specs jsonb, checklist jsonb, note,
  │                                 lưu ý quan trọng, sort, cờ đổi ở bản sửa
  └── (production_jobs/components/entries — trục sản xuất, đổi sang trỏ
       production_order_lines thay vì sales_order_lines)
```

- **Nhóm** thay được cả 4 kiểu: nhóm = 1 PO (ROSCO), = bộ sưu tập (LAURA),
  = 1 đơn (YOTRIO), hoặc lệnh 1 nhóm duy nhất không tiêu đề (MERXX).
  `sales_order_id` trên nhóm là **tuỳ chọn** → nhóm bộ sưu tập vẫn hợp lệ.
- **Dòng** mang SL và đợt xuất riêng → mã SP lặp nhiều dòng là chuyện bình thường.
- Quan hệ với đơn (0113) giữ nguyên: `sales_orders.production_order_id`.
  Dòng lệnh trỏ về `sales_order_line_id` (nullable) để đối chiếu SL đã lên lệnh
  vs SL đơn — cảnh báo lệch, **không chặn**.

### 3.2 MỘT FORM CHUẨN (chốt 04/08/2026 — thay cho "mẫu theo khách")

Bốn file Excel khác nhau vì hai nhân viên Sales mỗi người tự dựng một bảng — đó
là hiện trạng cần chuẩn hoá, không phải quy tắc phải giữ. Phiếu in nay dùng
**một bộ cột duy nhất** (`LSX_FORM` trong `lsx-template.ts`), hợp của những gì 4
khách đang dùng; cột nào khách không dùng thì để trống chứ không đổi bảng.

Cái giữ lại từ Excel là CÁCH TRÌNH BÀY: đơn hàng/số PO nằm ở cột riêng **gộp ô**
suốt nhóm, STT đánh lại từ 1 mỗi nhóm, khép nhóm bằng dòng cộng khối, khép phiếu
bằng dòng Tổng. Thứ còn riêng theo khách chỉ là **nội dung**: khối "một số lưu ý
chung" cuối phiếu, khai ở `sales_customers.lsx_template.notes_footer`.

Phiếu in cả **mã HG** lẫn **mã khách** (0115 thêm
`production_order_lines.customer_item_code`) — xưởng gọi SP theo mã nhà máy,
khách gọi theo mã của họ.

### 3.2b Spec + checklist: jsonb theo khoá cột của form

Dòng lưu `specs jsonb` (mây/nệm/sơn/kính/gỗ) + `checks jsonb`
(bom/ban_ve/mau/showroom) theo đúng khoá khai trong `LSX_FORM.columns`. Giá trị
checklist là **text** chứ không phải boolean — file thật ghi
"Có ( thiếu phụ kiện đóng gói)". Thêm cột về sau = sửa `LSX_FORM`, không migration.

`sales_customers.lsx_template` nay chỉ còn giữ `notes_footer`; mọi khai báo cột
kiểu cũ bị `resolveLsxTemplate` bỏ qua để phiếu không lệch nhau nữa.

### 3.3 Đợt xuất

`ship_date date` (chuẩn hoá, để sắp lịch/cảnh báo trễ) + `ship_label text`
(đúng chữ Sales gõ: `w37.26`, `DỰ KIẾN kiểm hàng 5/10…`). In ra dùng `ship_label`
nếu có, còn `ship_date` cho mọi tính toán.

### 3.4 Phiên bản (revision)

`production_orders.revision int` + `revised_at/by` + `revision_note`;
`production_order_lines.changed_in_rev int`. Phát bản sửa → tăng revision,
so với bản trước, đánh dấu dòng đổi. Phiếu in bản sửa: tiêu đề
"LỆNH SẢN XUẤT — CHỈNH SỬA NGÀY dd/mm" + **cột đánh dấu ▲ ở dòng đã đổi** +
danh sách tóm tắt thay đổi ở cuối. Đây là thứ file Excel không làm được.

## 4. Mẫu in đề xuất

Khổ A4 ngang, in được nhiều trang, lặp header bảng mỗi trang.

```
┌───────────────────────────────────────────────────────────────────────┐
│ [logo] CÔNG TY … HOÀNG GIA          LỆNH SẢN XUẤT      SỐ 01/26-ROSCO │
│                                     — CHỈNH SỬA NGÀY 01/08 (rev 2)    │
│ Khách hàng: Rosco          Ngày phát hành: 03/08/2026    Trang 1/3    │
├───────────────────────────────────────────────────────────────────────┤
│ Phòng kế hoạch yêu cầu các tổ trưởng và các bộ phận liên quan …        │
├───────────────────────────────────────────────────────────────────────┤
│ ▸ NHÓM 1 · PO PT-138-155-HG · PAPAYA 138 · giao 20/11/2026 · 68,04 CBM│
│  ┌───┬─────┬──────────┬────────────┬─────┬────┬──────┬────────┬─────┐ │
│  │STT│ Ảnh │ Mã SP    │ Mô tả      │ ĐVT │ SL │ Spec │ Đóng gói│ Ghi │ │
│  │ 1 │ [▣] │H23-S201… │New Chelsea…│ cái │ 42 │ …    │1 mặt/th │ …   │ │
│  └───┴─────┴──────────┴────────────┴─────┴────┴──────┴────────┴─────┘ │
│                                        Tổng nhóm: 252 SP · 68,04 CBM  │
│ ▸ NHÓM 2 · PO PT-138-156-HG · …                                       │
├───────────────────────────────────────────────────────────────────────┤
│ TỔNG LỆNH: 1.234 SP · 402,5 CBM · 9 nhóm                              │
│ LƯU Ý CHUNG: 1/ Nhà máy kiểm tra CBM… 2/ Bảo hành khung và mây 3 năm…  │
│ Nơi nhận: Quản lý sản xuất · Các tổ trưởng · Kho vật tư, nguyên liệu   │
│                                          Phù Cát, ngày … tháng … năm  │
│  Người lập            Trưởng phòng KH            Giám Đốc             │
└───────────────────────────────────────────────────────────────────────┘
```

Nguyên tắc:

- **Cột hiện theo mẫu của khách** — MERXX thấy Barcode + BOM/BẢNG VẼ/MẪU, ROSCO
  thấy CBM + Total Cube, YOTRIO thấy 8 ô swatches. Cột rỗng toàn bộ thì ẩn.
- **Tiêu đề nhóm là một băng ngang** (như `B12=HALI - HALSTON - AMELIA` và
  `A27:A33` merged của ROSCO), kèm tổng SL/CBM của nhóm.
- **Ảnh SP** giữ nguyên cột đầu — 22 ảnh nhúng trong 1 file MERXX cho thấy đây là
  thứ xưởng dùng để nhận dạng, không bỏ được.
- Ô spec **xuống dòng** giữ nguyên định dạng 2 dòng của Sales
  (`Sơn xám cát ⏎ PT-7476`).
- Dòng đổi ở bản revision: nền vàng nhạt + dấu ▲, chú thích cuối phiếu.
- Bản chưa duyệt in ra có watermark như hiện tại.

## 5. Ảnh hưởng tới phần đã có

- `production_jobs.order_line_id`, `production_components.order_line_id`,
  `production_order_line_specs` → chuyển sang `production_order_line_id`.
  Dữ liệu thật hiện 0 job / 0 component / 0 entry nên chuyển được sạch.
- `listLsxPrintLines` (đọc `sales_order_lines`) → đọc `production_order_lines`.
- Màn phát lệnh của Sales: từ "tick đơn rồi in" thành **soạn dòng lệnh**
  (chọn đơn → nạp sẵn dòng SP từ đơn → sửa SL/tách đợt xuất/thêm dòng).
- BR-02 ("LSX dùng chung dòng SP của đơn, không nhân bản") bị bãi bỏ, thay bằng
  "dòng lệnh là bản sao có kiểm soát, đối chiếu ngược về dòng đơn".

## 6. Đã làm gì (0114)

| Thứ | Ở đâu |
|---|---|
| Bảng `production_order_groups` + `production_order_lines`, `sales_customers.lsx_template`, `production_orders.revision/revised_*` | `supabase/migrations/0114_lsx_groups_lines.sql` |
| 5 mẫu cột (chuẩn · MERXX · LAURA · ROSCO · YOTRIO) + `resolveLsxTemplate` | `src/modules/dept/sales/lsx-template.ts` |
| Repo nhóm/dòng (`replaceAll` giữ id nên jobs không đứt) | `src/modules/dept/production/lsx-lines.repo.ts` |
| Nạp dòng từ đơn · lưu bản soạn · sinh revision + đánh dấu dòng đổi | `src/modules/dept/production/lsx-lines.service.ts` |
| API `GET/PUT/POST /api/dept/production/lsx/[id]/lines` | `src/app/api/dept/production/lsx/[id]/lines/route.ts` |
| Màn soạn dòng của Sales (nhóm, tách đợt xuất, spec theo mẫu khách) | `src/app/(workspace)/sales/lsx/[id]/dong` + `src/components/production/LsxSheetEditor.tsx` |
| Phiếu in mới (cột theo khách, băng nhóm, cộng nhóm/CBM, dòng đổi tô vàng) | `src/app/print/lsx/LsxPrintSheet.tsx` |
| Event + thông báo `lsx.revised` ("in lại phiếu") | `src/events/*`, `src/app/(app)/notifications/page.tsx` |

Trục sản xuất (`production_jobs`, `production_components`) đã trỏ sang
`production_order_line_id`. Bảng `production_order_line_specs` hết vai trò —
spec nằm trên dòng lệnh.

**CÒN NỢ** (một migration dọn dẹp riêng, cần chủ dự án bấm vì nó XOÁ cột/bảng):

```sql
alter table production_jobs       drop column order_line_id;
alter table production_components drop column order_line_id;
drop table production_order_line_specs;
```

Chưa làm: nhập ảnh SP từ file Excel cũ (22 ảnh nhúng/file), gợi ý CBM từ hồ sơ
đóng gói SP, và cột `extras` chưa có ô nhập trên màn soạn (mới dùng khi in).
