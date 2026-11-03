# Sản xuất & thống kê theo cấu hình — thiết kế (03/11/2026)

Nguồn: bản tổng hợp "Thiết kế phân hệ quản lý sản xuất và thống kê ERP" chủ dự án
dán 03/11/2026 (10 vấn đề · 6 lớp · 10 menu · 9 nguyên tắc · 6 giai đoạn). Tài liệu
này đối chiếu bản đó với **mã + DB thật** rồi chốt: cái gì đã có, cái gì thiếu, dữ
liệu phải thêm gì, màn nào dựng lại, theo thứ tự nào. Bản vẽ màn: Artifact HTML
(không dùng kit — chủ dự án chốt 03/11, cùng ý 30/09 · 14/10 · 31/10).

Quyết định cũ vẫn giữ (không đề xuất lại): tổ trưởng chỉ xem (18/09); phiếu ghi sổ
là chính thức khi gửi, không qua tổ trưởng duyệt (27/08); không kho thành phẩm
(18/09); BOM hai cấp SP → cụm → chi tiết, không cụm lồng cụm (07/2026); khuôn và
kit là đồ nghề, không phải đích (16/09).

---

## 0. Số đo hôm nay — 03/11/2026, DB thật

| Thứ                                   | Số                                                                 |
| ------------------------------------- | ------------------------------------------------------------------ |
| Lệnh SX                               | 22 — **17 đã duyệt** · 5 hoàn thành · **0 đang SX**                |
| Dòng SP trên 17 lệnh mở               | 268 dòng; 51 dòng có định mức `done` (19%)                         |
| Đã định hình (`production_components`) | 876 chi tiết trên **8 lệnh / 39 dòng**; 1 dòng cụm; 7 có công đoạn cuối |
| Sổ sản lượng · phiếu PBS · chốt sổ    | **0 · 0 · 0**                                                      |
| Phiếu giao tổ · gia công ngoài        | **0 · 0**                                                          |
| Kế hoạch công đoạn (`production_jobs`) | 4 việc, 1 lệnh, chưa có hạn                                       |
| Danh mục công đoạn                    | 12 mã (phôi…hoàn thiện), `meta` rỗng                               |
| Ô nhập riêng theo công đoạn (0207)    | 9 ô / 6 công đoạn                                                  |
| Mã lỗi (`production_defect_codes`)    | 27 mã, 23 gắn công đoạn                                            |
| Tổ có mã công đoạn                    | 6/9 (phôi · hàn · nguội · sơn ×2 · may); đan, lắp ráp, bao bì, đóng gói, hoàn thiện **chưa tổ nào nhận** |
| Cụm ở hồ sơ SP                        | 30 cụm / 11 SP; **0** có SL cụm/SP, **0** có lộ trình              |
| Định mức ở hồ sơ SP                   | 1.567 dòng / 64 SP; 128 dòng gắn cụm                               |

Đọc thế nào: **máy đã dựng gần đủ, nhưng không ai ghi gì** — 13 màn của khu đều là
dẫn xuất của sổ sản lượng, mà sổ trống. Bản tư vấn vì thế không phải bản vẽ nhà mới;
nó là danh sách kiểm xem cái đã dựng thiếu chỗ nào để người ta **chịu ghi**.

---

## 1. Mười vấn đề của bản tư vấn — hiện trạng và việc còn lại

| # | Vấn đề                                   | Hiện trạng (bảng / mã)                                                                                                   | Còn thiếu                                                                                                          |
| - | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1 | Mỗi SP một BOM                           | ✅ `technical_product_parts` + `technical_product_clusters` (0097); màn `/products/[id]/dinh-muc`                        | Độ phủ: 23/147 SP `done` — việc của người, không của phần mềm                                                      |
| 2 | Mỗi SP một quy trình (Routing)           | ⚠️ Lộ trình **suy** theo nhóm vật tư (`lib/stage-route.ts`); cụm có `first_stage..final_stage` (khoảng, 0/30 khai)       | **Khai được danh sách công đoạn theo cụm** (cờ x), không phải khoảng đầu–cuối — khoảng không bỏ được bước giữa      |
| 3 | Nhiều cụm, bán thành phẩm                | ✅ 2 cấp SP → cụm → chi tiết; cụm mặc nhiên khi BOM phẳng (`lib/default-assembly.ts`); dòng Thành phẩm (`lib/finish-stages.ts`) | Không mở cấp thứ ba — đo được 0 cụm lồng; cụm cần TÊN thật (hiện 30 cụm có 13 tên rác kiểu "tấm · chắn · trên")  |
| 4 | Mỗi công đoạn một cách thống kê          | ✅ `production_stage_fields` (0207) + 3 ô đạt/phế/sửa (0206) + mã lỗi theo công đoạn (0067)                             | **Chưa có màn cấu hình** (chỉ seed bằng SQL); chưa khai được ô LÕI nào hiện/bắt buộc theo công đoạn (kg, người làm, sửa lại) |
| 5 | Mỗi công đoạn một đơn vị thống kê        | ⚠️ Có ba bậc chi tiết / cụm / bộ nhưng **ghi cứng** trong mã: `JOIN_STAGE='han'`, `FINISH_STAGES=[lắp ráp…]`              | Đưa bậc đếm vào **cấu hình công đoạn** (`catalog_items.meta.count_level`), mã đọc cấu hình                           |
| 6 | Một công đoạn nhiều SP                   | ✅ danh mục `production_stage` dùng chung; tổ gắn `departments.stage_code`                                                | Gán tổ cho 5 công đoạn chưa ai nhận (dữ liệu)                                                                      |
| 7 | Đạt · lỗi · sửa riêng                    | ✅ `qty` · `defect_qty` · `rework_qty` + `defect_code`/`defect_reason`                                                    | Chưa có chỗ xem "hàng sửa lại còn treo" — một tab báo cáo                                                          |
| 8 | Công đoạn xong không đồng thời           | ✅ sổ per công đoạn; `production_jobs` todo/doing/done tự nhích khi đủ số                                                 | —                                                                                                                  |
| 9 | Bán giao – tiếp nhận – tồn công đoạn     | ⚠️ `production_transfers` (giao VÀO tổ, trả lại) — **0 dòng, 0 màn**; không có nhịp "tiếp nhận"                           | **Phiếu giao tổ** có số hiệu, hai nhịp giao → nhận, và 5 con số dẫn xuất (xong · đã giao · đã nhận · tồn · khả dụng) |
| 10| Phiên bản BOM / Routing                  | ⚠️ `technical_products.bom_rev` + bản chụp `production_order_boms.product_rev` (0142); nhật ký kế hoạch (0169)            | Lộ trình đi chung `bom_rev`; lúc định hình lệnh ghi rev đã dùng; màn hồ sơ SP bày "lệnh nào đang chạy rev cũ"       |

Kết luận: **3 việc nền** (cấu hình công đoạn · lộ trình theo cụm · phiếu giao tổ) mở
khoá được 8/10 mục. Hai mục còn lại (#1 độ phủ định mức, #6 gán tổ) là dữ liệu.

---

## 2. Sáu lớp của bản tư vấn ↔ bảng đang có

| Lớp                      | Bảng / mã                                                                                                        | Trạng thái        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1 Danh mục SP            | `technical_products` · `technical_product_clusters` (bán thành phẩm = cụm) · `warehouse_materials`               | có                |
| 2 Cấu trúc kỹ thuật      | `technical_product_parts` (BOM) · cụm.lộ trình (sửa thành danh sách) · `bom_rev`                                 | có một nửa        |
| 3 Kế hoạch               | `production_orders` · `production_order_lines` · `production_jobs` (lệnh × dòng × công đoạn: tổ, hạn, seq) · `production_daily_targets` | có                |
| 4A Thực hiện             | `production_jobs.status` · `departments.stage_code` · `production_day_locks`                                     | có                |
| 4B Thống kê              | `production_entry_docs` (PBS) · `production_entries` (đạt/phế/sửa/kg/người/ô riêng) · `production_stage_fields` · `production_defect_codes` · `production_outsource_entries` | có, 0 dòng        |
| 5 Luân chuyển            | `production_transfers` → **thêm header phiếu + nhịp nhận**                                                       | thiếu màn + nhịp  |
| 6 Báo cáo                | `reports.service` (sản lượng · phế · năng suất · định mức, Excel) · `so-tong.service` · `week.service`           | API có, **0 màn** |

Không có lớp nào phải dựng từ đầu. Cái thiếu là **cấu hình bày ra cho người quản
trị** và **hai màn** (giao nhận, báo cáo).

---

## 3. Dữ liệu phải thêm / sửa — bốn việc, đều nhỏ

### 3.1 Cấu hình công đoạn — một nơi, bốn thứ

Danh mục `production_stage` (`catalog_items.type='production_stage'`) đã có cột
`meta jsonb` rỗng. Khai vào đó, **không thêm bảng**:

```
meta = {
  count_level: 'part' | 'cluster' | 'unit',   // chi tiết · cụm · bộ (cái)
  core: { defect: true, rework: true, kg: false, worker: true },  // ô lõi hiện
  required: ['qty'],                                               // ô lõi bắt buộc
  input_from: 'han'                             // công đoạn cấp đầu vào (null = đầu chuỗi)
}
```

Ba thứ còn lại đã có bảng riêng và chỉ cần bày chung một màn: **tổ phụ trách**
(`departments.stage_code`), **ô riêng** (`production_stage_fields`), **mã lỗi**
(`production_defect_codes.stage_code`).

Mã đổi: `lib/default-assembly.ts` đọc `count_level` thay `JOIN_STAGE`;
`lib/finish-stages.ts` đọc các công đoạn `count_level='unit'` thay hằng
`FINISH_STAGES`. Hai nơi, có test sẵn. Seed meta theo đúng hành vi hôm nay (phôi =
chi tiết; hàn·nguội·mài·sơn = cụm; mộc·đan·may = chi tiết; lắp ráp → hoàn thiện =
bộ) nên **sổ không đổi nghĩa** sau khi áp.

Bản tư vấn có "Người xác nhận: Tổ trưởng / NV QC" — **không làm** (quyết định 27/08
và 18/09: tổ trưởng chỉ xem, QC ghi giấy). Khi họ lên hệ thống thì bật lại máy luật
`lib/entry-doc-flow` đang giữ nguyên, thêm một khoá `confirm_role` vào `meta`.

### 3.2 Lộ trình khai theo cụm — danh sách, không phải khoảng

`technical_product_clusters.first_stage/final_stage` là một KHOẢNG trên danh mục
có thứ tự cố định — ghế nhôm "phôi → nguội → sơn" (bỏ hàn) không khai được. Bản tư
vấn khai bằng cờ x từng công đoạn, sổ Excel v2 của xưởng cũng thế (`DM_CUM` G..L).

Thêm cột `stages text[]` (thứ tự chạy) vào `technical_product_clusters`; giữ hai
cột cũ để đọc ngược (null `stages` = suy từ khoảng, rồi từ nhóm vật tư). Chi tiết
RỜI (không thuộc cụm) vẫn đi theo nhóm vật tư như nay, có ô ghi đè ở dòng định mức
khi cần (`technical_product_parts.stages text[]`). Lệnh: `production_components`
thêm `stages text[]` chụp lúc định hình (người thắng máy, như `first/final` hiện
nay). `production_jobs` (seq) vẫn là tập việc thật của lệnh — kế hoạch fan-out từ
`stages` của cụm thay vì từ `ROUTE_BY_GROUP`.

Thứ tự ưu tiên khi hỏi "dòng này đi qua công đoạn nào" (đã có trong
`resolveComponentRoute`, chỉ chèn thêm một bậc): kế hoạch lệnh → `stages` chụp
trên lệnh → `stages` của cụm / dòng định mức → nhóm vật tư → rỗng (không đoán).

### 3.3 Phiên bản — dùng `bom_rev` cho cả hai

`technical_products.bom_rev` tăng mỗi lần lưu định mức **hoặc** lộ trình (một số,
vì xưởng không tách "sửa BOM" với "sửa quy trình"). Lúc định hình lệnh ghi
`production_components.product_rev`. Hồ sơ SP bày: "rev 3 · lệnh 06-MX, 09-MX đang
chạy rev 2" — lệnh **không tự đổi** theo rev mới; muốn áp thì "Định hình lại" có
nhật ký (đã có `production_plan_changes` + `lsx_revised`).

### 3.4 Phiếu giao tổ — hai nhịp

Bảng `production_transfers` hiện là dòng rời "giao vào tổ / trả lại". Thêm header:

```
production_transfer_docs
  id · doc_no (PGT-2026-0001, qua next_doc_code) · production_order_id
  from_stage · from_team_id · to_stage · to_team_id · entry_date
  status: 'da_giao' | 'da_nhan'
  created_by/at · received_by/at · note
production_transfers (dòng)  +doc_id · +received_qty · +diff_reason
```

Máy trạng thái (A4, không mũi tên cụt):

```
[lập phiếu] ──gửi──▶ ĐÃ GIAO ──tổ nhận xác nhận──▶ ĐÃ NHẬN
                        │                              │
                        └── huỷ (chưa nhận, ghi lý do) │
                                                       └── đảo (phiếu ngược, lý do) — không xoá
```

| Chuyển tiếp | Ai                                   | Điều kiện                        | Hệ quả                                 | Đường lùi          |
| ----------- | ------------------------------------ | -------------------------------- | -------------------------------------- | ------------------ |
| Gửi         | thống kê tổ giao (`production.output.record`) | SL giao ≤ xong − đã giao (cảnh báo, không chặn) | tồn tại công đoạn giảm; tổ nhận thấy "chờ nhận" | huỷ khi chưa nhận  |
| Xác nhận    | thống kê tổ nhận                     | gõ SL nhận; chênh → bắt lý do    | khả dụng của công đoạn sau tăng        | đảo bằng phiếu ngược |
| Nhận đủ     | thống kê tổ nhận, một bấm            | —                                | received_qty = qty mọi dòng            | như trên           |

Năm con số của bản tư vấn (§5), mỗi số một phép tính, cùng một hàm cho mọi màn:

- **Xong tại công đoạn** = Σ `qty` (đạt) sổ công đoạn đó
- **Đã giao** = Σ `qty` phiếu từ công đoạn đó (cả `da_giao` + `da_nhan`)
- **Đã nhận** (ở công đoạn sau) = Σ `received_qty` phiếu `da_nhan` tới công đoạn sau
- **Tồn tại công đoạn** = Xong − Đã giao
- **Khả dụng cho công đoạn sau** = Đã nhận − (đạt + phế + sửa đã ghi ở công đoạn sau)

Xưởng chưa chịu lập phiếu? **Không bắt**: ghi sổ công đoạn sau vẫn được, chỉ cảnh
báo "vượt số đã nhận" (đã có `teamWipShortageWarning`). Phiếu là thứ làm con số tồn
công đoạn có nghĩa, không phải cổng chặn.

---

## 4. Những gì bản tư vấn nói mà KHÔNG làm — và vì sao

| Bản tư vấn                              | Quyết định                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| BOM "nhiều cấp"                         | Giữ **2 cấp**. Đo: 0 cụm lồng trong 30 cụm; cấp 3 làm phép tổng khối lượng cộng đôi (lý do ghi ở 0097)              |
| Kế hoạch công đoạn có tầng duyệt riêng  | Không — đã từ chối ba lần (23–24/08). Kế hoạch là thuộc tính của lệnh (`production_jobs`), nhật ký đổi là đủ        |
| Máy móc · thời gian · giờ vào ra        | Không — số giờ ghi tay không tin được; giữ `worker_name` + ô riêng theo công đoạn                                    |
| Người xác nhận theo công đoạn           | Không (xem 3.1)                                                                                                     |
| Kho bán thành phẩm (lớp 5)              | Không dựng kho — "tồn tại công đoạn" là số dẫn xuất từ sổ + phiếu, không phải chứng từ kho                           |
| Menu "Định mức vật tư" trong Sản xuất   | Ở hồ sơ SP (Kỹ thuật), Sản xuất chỉ **định hình** từ đó (quyết định `dinh-muc-o-ho-so-sp`)                           |

---

## 5. Màn — mười menu của bản tư vấn về bảy màn + hai màn cấu hình

Mọi màn mới và màn dựng lại: **không kit**, CSS riêng của khu
(`src/app/(san-xuat)/_erp/sx.css`, lớp `.sx.sx`, cùng lối `warehouse/_erp/kho.css`):
đầu trang + Action Pane góc phải · tab ngang có số · một lưới dính đầu/chân · thanh
trạng thái · chữ 13px · bo góc 0 · không bóng.

| Menu bản tư vấn            | Màn                                         | Vai · câu hỏi                                                     | Hôm nay                     |
| -------------------------- | ------------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| Danh mục công đoạn · Cấu hình thống kê | **C1 Công đoạn** `/production/cau-hinh/cong-doan` | Quản đốc/admin · công đoạn này đếm bằng gì, tổ nào, ghi ô gì, lỗi gì? | ❌ chỉ có SQL seed + catalog chung |
| Quy trình sản xuất         | **C2 Lộ trình** tab ở `/products/[id]`       | Kỹ thuật · SP này mỗi cụm đi qua công đoạn nào, rev mấy?           | ⚠️ ô "Khai cụm" khoảng đầu–cuối |
| Định mức vật tư            | (có) `/products/[id]/dinh-muc`               | Kỹ thuật                                                          | ✅                          |
| Lệnh sản xuất              | (có) `/thongke/lenh`                         | Quản đốc · lệnh nào cần tôi động vào?                              | ✅ kit — dựng lại sau cùng  |
| Kế hoạch công đoạn · Theo dõi | **S3 Hồ sơ lệnh** `/thongke/lsx/[id]`     | Quản đốc · lệnh này mỗi cụm xong bao nhiêu, giao – nhận – tồn ở đâu, ai giữ? | ⚠️ kit, chỉ % theo SP      |
| Báo cáo sản lượng (nhập)   | **S4 Ghi sản lượng** `/thongke/ghi`          | Thống kê · hôm nay tổ tôi làm được bao nhiêu? (cột đổi theo cấu hình công đoạn) | ⚠️ kit, ô riêng có, ô lõi cứng |
| Bàn giao bán thành phẩm    | **S5 Giao nhận** `/thongke/giao-nhan`        | Thống kê · tổ tôi giao gì, nhận gì, còn chờ nhận gì?               | ❌ 0 màn                    |
| Báo cáo tổng hợp           | **S6 Báo cáo** `/thongke/bao-cao`            | Quản đốc/GĐ · tuần này năng suất, lỗi, tồn công đoạn ra sao?       | ❌ API có, 0 màn            |
| Theo dõi sản xuất          | (có) `/production` Tình hình xưởng           | Quản đốc · hôm nay kẹt ở đâu?                                      | ✅ kit — dựng lại sau cùng  |

Sổ ngày & chốt sổ (`/thongke/ngay`) giữ. Nav sau khi xong: Tình hình xưởng · Lệnh
SX · Ghi sản lượng · Giao nhận · Sổ ngày · Báo cáo · (Cấu hình: Công đoạn) — 7 mục.

Bản vẽ sáu màn C1 · C2 · S3 · S4 · S5 · S6: Artifact HTML (link ở cuối phiên).

---

## 6. Thứ tự — sáu bước, mỗi bước nghiệm thu được, mỗi lượt một bước

| B  | Việc                                                                                                         | Nghiệm thu bằng số                                                                   |
| -- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| B1 | ✅ **XONG 03/11** (chưa commit): `0287_production_stage_meta.sql` (seed meta, **chưa áp** — dán SQL editor); `lib/stage-config.ts` (parse meta, `countingOf` → mốc ghép + chặng thành phẩm, 14 test); `default-assembly` / `finish-stages` nhận `counting`/`finish` (mặc định cũ giữ nguyên); `entries` · `worklist` · `jobs` · `components` service lấy mốc từ `productionRepo.listStages()` (nay trả `meta`); module `stage-config.{schema,repo,service}` + route GET/POST/PATCH `api/dept/production/cau-hinh/cong-doan`; action `production.stage.configure`; màn `/production/cau-hinh/cong-doan` không kit (`production/_erp/sx.css` + `khung.tsx`); nav "Cấu hình › Công đoạn" (capability `production.configure`) | Đã thử trên DB thật qua cổng 3100: đổi Đan → cụm, Lưu (PATCH 200, lưới đổi, "Đã lưu 10:26"), hoàn trả → chi tiết (10:27); /thongke/ghi và /thongke/lenh vẫn chạy; 202 test module SX + 14 test lib xanh; tsc sạch ngoài `.next/` |
| B2 | ✅ **XONG 03/11, 0288 ĐÃ ÁP** (chưa commit): `0288_product_route_stages.sql` (cột `stages text[]` ở cụm / dòng ĐM / components); `lib/stage-route`: `resolveComponentRoute(planned, group, ownStages)` + `componentRoute()` dùng chung 3 service; `lib/stage-config.splitClusterRoute` tách lộ trình cụm theo bậc đếm (B1); định hình chụp `stages` sang lệnh; `productsService.saveRoutes` + route PATCH `products/[id]/lo-trinh`; tab **Lộ trình** ở hồ sơ SP (`(shared)/products/[id]/lo-trinh`, không kit) | Thử thật BN0228HG-AL: bỏ tick Hàn ở Cụm khung → Lưu (PATCH 200, DB `{phoi,nguoi,son}`) → API gợi ý định hình lệnh 01/26-27 - JAWOLL trả Cụm khung [nguội, sơn] (first = nguội, KHÔNG hàn), chi tiết trong cụm [phôi], cụm chưa khai vẫn như cũ → hoàn trả về mặc định (null). Định mức + Ghi sản lượng đọc bình thường. Test đơn vị ở components.service.test, stage-route.test, stage-config.test |
| B3 | ✅ **XONG 03/11** (chưa commit): `/thongke/ghi` dựng lại KHÔNG kit (`(san-xuat)/thongke/ghi/{GhiScreen,useGhi,luoi-ghi,ghi.shared}`, khung `production/_erp` + CSS mục 7 cho dải chip · chú giải · ô gõ · thanh chốt; `EntrySheetForm.tsx` kit cũ xoá). Cột gõ dựng từ `stage_cfg.core` (`buildEditCols`): Phế / Sửa lại / Người làm / Kg hiện · ẩn · bắt buộc theo C1, ô riêng (0207) thành CỘT từng dòng, SL đạt luôn bắt buộc; tab có số dòng (`stages[].n`, cùng luật dựng dòng); cột **Khả dụng** từ `lib/wip-numbers.ts` (5 số, có test) — trước B4 "đã nhận" = xong ở công đoạn liền trước của chính dòng, đầu lộ trình / dòng ảo = "—"; server `record()` bắt ô lõi `required` và chặn số vào ô đã `off` | Thử thật 06/26-27 - MX cổng 3100: tab Hàn ra đúng 12 cột của bản vẽ (Cụm · SP · Cần · Khả dụng · Đã hàn · Còn · SL đạt* · Phế · Sửa lại · Lý do lỗi · Loại máy hàn · Người làm); gõ 5 đạt + 2 phế → ô Lý do đỏ + thanh chốt "có phế/sửa lại mà chưa ghi vì sao" + nút "Tới ô Lý do lỗi" nhảy đúng ô, gõ lý do → mở khoá; Enter xuống dòng, Tab sang ô; Lưu nháp ở Phôi → **PBS-2026-0021** (1 dòng, Tổ Phôi) rồi XOÁ lại + trả lệnh về `approved` (record() tự đẩy sang in_progress) — DB sạch; tsc sạch ngoài `.next/`, lint 0 lỗi, 4.376 test xanh (3 đỏ sẵn của nhánh đơn mua). Chưa thấy Khả dụng ra SỐ trên màn vì `production_entries` của lệnh đang chạy = 0 dòng |
| B4 | ✅ **XONG 03/11, 0289 ĐÃ ÁP** (chưa commit): `0289_production_transfer_docs.sql` (header `production_transfer_docs` da_giao/da_nhan/da_huy + `reverses_doc_id`; `production_transfers` thêm doc_id · received_qty · diff_reason; mẫu PGT); `lib/wip-numbers.transferTotals` (phiếu đảo = số âm của phiếu gốc, 3 test); module `transfer-docs.{schema,repo,service}` — `inbox` · `source` (xong · đã giao · tồn + gợi công đoạn kế) · `create` (giao vượt tồn: cảnh báo) · `act` nhận (chênh bắt lý do, "Nhận đủ" = received = qty) / huỷ (chỉ khi chưa nhận) / đảo (chỉ khi đã nhận, phiếu ngược from↔to sinh ra đã-nhận, dòng 'return' trên (công đoạn, tổ) gốc); route `api/dept/production/giao-nhan` (+`/nguon`, +`/[id]` action); màn `/thongke/giao-nhan` không kit (GiaoNhanScreen · useGiaoNhan · bang-phieu · lap-phieu · shared) 5 tab đếm cùng hàm `docInTab`; nav "Giao nhận"; Ghi sản lượng: `available` dùng "đã nhận" THẬT khi có phiếu tới công đoạn đó, chưa có phiếu thì xấp xỉ như trước | Thử thật 06/26-27 - MX cổng 3100 (admin, phòng = Tổ Hàn): ghi chính thức 100 Phôi "Chân trước + tựa" (PBS-2026-0022) → nguồn: xong 100 · đã giao 0 · tồn 100 → đóng vai Tổ Phôi lập PGT-2026-0001 Phôi→Hàn 100 (tab "Tôi đã giao" 1, nguồn: đã giao 100 · tồn 0) → Tổ Hàn tab "Chờ tôi nhận": gõ 98 → ô Chênh −2 đỏ, ô Lý do đỏ, nút Xác nhận khoá kèm lý do; gõ "móp 2" → Xác nhận 200, DB received_qty 98 / diff_reason "móp 2"; tab "Đã nhận" → Đảo, lý do → PGT-2026-0002 Hàn→Phôi 98 đã-nhận, phiếu gốc còn nguyên, tab "Đã đảo/huỷ" 1; nguồn sau đảo: xong 100 · đã giao 2 · tồn 98 = tính tay. Ghi sản lượng vẫn chạy sau 0289 (Đã phôi 100 · Còn 50). Dọn: xoá 2 PGT + bộ đếm PGT bằng SQL, xoá PBS-0022 qua API, lệnh về `approved`. tsc sạch ngoài `.next/`, lint 0 lỗi, test SX + lib xanh (2 đỏ sẵn đơn mua). Chưa thử nút Huỷ trên màn (service: chỉ khi da_giao) |
| B5 | ✅ **XONG 03/11** (chưa commit): `/thongke/lsx/[id]` dựng lại KHÔNG kit (`HoSoLenhScreen · useHoSoLenh · bang-dong-bo · tab-ke-hoach · tab-phieu · ho-so-lenh.shared`; ba file kit cũ xoá). Service mới `lsx-dossier.service.ts`: dòng SP → thành phẩm / cụm (thật + mặc nhiên) / chi tiết, mỗi ô = `wipNumbers` (xong từ `entriesService.summary`, đã giao / đã nhận từ `transferTotals`, "đã nhận" khi chưa có phiếu = `receivedOrFallback` — cùng hàm Ghi sản lượng dùng); cột = công đoạn có mặt trong lệnh kèm bậc đếm từ C1. Màn: đầu trang + Action Pane (Ghi sản lượng · Lập phiếu giao · Định hình · Excel · Đóng lệnh kèm vì sao, ép đóng có lý do); 4 tab Đồng bộ · Kế hoạch tổ & hạn (sửa tổ/hạn từng job, việc đã chạy bắt lý do) · Phiếu (PBS + PGT) · Trao đổi; 5 ô số có mẫu số; bảng ba tầng, chi tiết trong cụm gấp mặc định; bấm ô → dải NĂM CON SỐ kèm số phiếu PGT; thanh trạng thái = người giữ (lib/lsx-holder) | Thử thật 06-MX: ghi 100 Phôi (PBS-0023) + PGT-0001 Phôi→Hàn 100 nhận 98 → hồ sơ: ô Phôi "Chân trước + tựa" = 100, dải năm số "Xong 100 · Đã giao 100 (PGT-2026-0001 100) · Tồn 0 · 1 phiếu PBS", nhóm SP phôi 6% (100/1.600 mảnh); Ghi sản lượng Phôi: Đã phôi 100; Giao nhận nguồn: xong 100 · đã giao 100 · tồn 0 — BA MÀN MỘT SỐ. Tab Phiếu bày PBS-0023 + PGT-0001 "nhận 98 · chênh: móp 2"; tab Kế hoạch rỗng nói lý do + link. Dữ liệu thử đã dọn, lệnh về approved. tsc sạch ngoài `.next/`, lint 0 lỗi, 4.379 test xanh (3 đỏ sẵn đơn mua). Chưa thử: sửa job ở tab Kế hoạch (06-MX chưa có job), Đóng lệnh |
| B6 | ✅ **XONG 03/11** (chưa commit): `bao-cao.service.ts` một payload sáu bảng — sản lượng tổ × công đoạn × ngày (đạt (phế), Σ, chỉ tiêu = Σ `production_daily_targets`, tô < 80%, chốt sổ n/N ngày) · lỗi Pareto theo mã (phế + sửa lại, tích luỹ, lệnh gặp nhiều; lý do gõ tay đứng riêng) · **sửa lại còn treo** (mới: Σ sửa − đạt ghi SAU theo thứ tự `created_at`, lệnh đang chạy) · **tồn công đoạn** (mới: xong chính thức − đã giao, chờ nhận = phiếu da_giao; `wipNumbers` + `transferTotals` — cùng hàm Hồ sơ lệnh / Giao nhận) · năng suất tổ + người (`reportsService.nangSuat`) · định mức vs thực dùng (tải theo lệnh qua API có sẵn). Màn `/thongke/bao-cao` không kit, kỳ + tổ + tab trên URL, Excel cho 4 bảng cũ; nav "Xem › Báo cáo". **Tình hình xưởng** `/production` dựng lại không kit (`SxKhung` thường trong vỏ có đệm): 6 ô việc là LINK sang Lệnh SX đã lọc, nhịp hôm nay, Tổ hôm nay, 5 lệnh cần chú ý | Thử thật 06-MX: ghi 100 Phôi phế 2 sửa 3 mã `phoi_cat_sai` người "Nguyễn Văn Thử" + PGT Phôi→Hàn 60 chưa nhận → Sản lượng tổ: Tổ Phôi · Phôi 100 (2), chưa chỉ tiêu, chốt sổ 0/7; Lỗi: phoi_cat_sai 2 + 3 = 5, 100%, 06-MX; Treo: 3 (bù 0); Tồn: xong 100 · giao 60 · tồn 40 · chờ nhận 60; Năng suất tổ 100/2/3, 1 ngày, 100/ngày, 1 người. Tình hình xưởng: 17 lệnh, nhịp ngày 100 · phế 2 · sửa 3. `/thongke/bao-cao` (kỳ 01/10–03/11, 17 lệnh) 1,15–1,6 s trên dev lần đầu. Dữ liệu thử đã dọn. tsc sạch ngoài `.next/`, lint 0 lỗi, test SX + lib xanh (2 đỏ sẵn đơn mua). Chưa có Excel cho 2 bảng mới; Lệnh SX (`/thongke/lenh`) vẫn kit |

**Bổ sung 03/11 chiều (sau B6, chưa commit)** — ba việc lòi ra khi chủ dự án xem màn thật:

- **Tab Lộ trình hồ sơ SP lệch bản vẽ C2** ("UI rất kỳ"): nhãn dài + cột 58px cắt chữ, ô
  trống "·" thay gạch chéo, hai thanh cuộn lồng nhau, Huỷ/Lưu lặp "Chưa đổi gì". Sửa:
  `shortStageLabel` (bỏ ngoặc, "Bao bì", "H.thiện"), cột 250/52/44 + 12×56, ô ngoài lộ trình
  = gạch chéo bấm được, chi tiết trong cụm = x mờ, Huỷ chỉ khi dirty. Cùng lúc phát hiện hook
  format lột khoảng trắng trong template-string `className` → dòng chọn ở C1 và đầu bảng Kho
  không tô: thay bằng `cx()` ở LoTrinhScreen · CongDoanScreen · warehouse BaoCaoScreen.
- **Kế hoạch cập nhật theo LỆNH, không theo SP** (câu hỏi của chủ dự án → "okee"): thêm
  tầng hai của lộ trình ở màn Định hình, ghi `production_components.stages` của riêng lệnh.
  Bug tìm thấy: màn Định hình cũ không gửi `stages` khi Lưu → mỗi lần lưu xoá sạch bản chụp
  B2. Toggle cụm chỉ sửa chính nó (kéo theo chi tiết = ghi `[]` = xoá khỏi sổ).
- **Màn Định hình dựng lại KHÔNG kit** (chủ dự án: "trông rất gớm"; bản vẽ
  https://claude.ai/artifact/DUtMtTWekhhBUUzh54XM9L duyệt "Duyệt, dựng"):
  `(san-xuat)/thongke/lsx/[id]/dinh-hinh/{page, DinhHinhScreen, useDinhHinh, luoi-chi-tiet,
  lo-trinh-lenh, dinh-hinh.shared}` — khuôn F: tab **Chi tiết** = lưới nhập liệu 26px đầu/chân
  dính, cột Lộ trình chỉ đọc (kết quả `componentRoute`), Ctrl+V dán vùng Excel, Enter xuống
  dòng, ⌫ cột cuối xoá dòng, cột quy cách gập (nhớ localStorage); tab **Lộ trình theo cụm** =
  ma trận x riêng lệnh; thanh chốt đáy nói đúng dòng hỏng + "Tới dòng"; ô "Khởi tạo hồ sơ SP"
  chỉ khi có SP chưa định mức; khoá khi đã có PBS (nói cách gỡ) / lệnh kết thúc. Nghiệm thu
  thật JAWOLL (cổng 3100, 1280×800): Nạp từ BOM → 32 dòng, bảng 1.213px không cuộn ngang,
  tab "Chi tiết 32 · Lộ trình theo cụm · 3 cụm", chân Σ 108 · 5,8 kg/bộ; xoá tên dòng 1 →
  ô đỏ + "Chưa lưu được: dòng 1 chưa có tên" + Tới dòng nhảy đúng ô, Lưu khoá; gõ lại + Enter
  → dòng dưới, hết lỗi; tab Lộ trình bật Mài ở Cụm khung → "1 đã sửa", payload PUT chặn bằng
  fetch: cụm stages [han,nguoi,mai,son], chi tiết stages null (không ghi DB); lệnh kết thúc
  04/26-27 - MX: 0 ô gõ, không thanh chốt, pill "lệnh đã kết thúc".

Việc của NGƯỜI, song song, không chặn mã: gán tổ cho 5 công đoạn trống; đặt tên
thật cho 13 cụm rác; nạp định mức cho 217/268 dòng lệnh còn thiếu (đường AI BOM đã
có). **Màn nào cũng chỉ có nghĩa khi có số** — B3 cố ý đứng trước B5/B6.

---

## 7. Câu cần chốt trước khi viết mã (mỗi câu một đề xuất)

- **Q1 Bậc đếm theo công đoạn** đặt ở cấu hình công đoạn (chi tiết / cụm / bộ), seed
  đúng hành vi hôm nay. *Đề xuất: có.* Mộc · đan · may đếm CHI TIẾT hay CỤM? (hôm nay
  là chi tiết).
- **Q2 Lộ trình khai theo cụm** bằng danh sách công đoạn (cờ x), chi tiết rời theo
  nhóm vật tư + ô ghi đè; lệnh chụp lúc định hình. *Đề xuất: có.*
- **Q3 Giao nhận hai nhịp** (giao → tổ nhận xác nhận, có "Nhận đủ" một bấm, chênh bắt
  lý do) hay một nhịp (giao = nhận)? *Đề xuất: hai nhịp* — vì "tồn tại công đoạn" và
  "khả dụng" là hai số khác nhau chỉ khi có nhịp nhận; không bắt buộc lập phiếu.
- **Q4 Phiên bản**: một số `bom_rev` cho cả BOM lẫn lộ trình, lệnh ghi rev lúc định
  hình, không tự áp rev mới. *Đề xuất: có.*
- **Q5 Phạm vi không kit**: dựng lại CẢ khu Sản xuất (B1→B6, màn kit cũ đổi sau cùng)
  hay chỉ màn mới + Ghi sản lượng? *Đề xuất: cả khu, theo thứ tự trên.*
- **Q6 Người xác nhận theo công đoạn** (tổ trưởng / QC): không làm bây giờ; thêm
  `confirm_role` vào `meta` khi họ lên hệ thống. *Đề xuất: không.*
