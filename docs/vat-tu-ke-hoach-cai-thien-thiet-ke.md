# Vật tư — kế hoạch cải thiện thiết kế (13/08/2026)

> User (12/08/2026): *"có gì bất cập trong thiết kế về vật tư không, vì sẽ có rất
> nhiều loại vật tư, mỗi loại mỗi thông tin khác nhau cũng như yêu cầu khác nhau."*
>
> Bản này là KẾ HOẠCH sau khi rà — chưa sửa code. Phân tích 5 bất cập đầy đủ ở
> phần 1; các đợt làm ở phần 2.

---

## 1. Năm bất cập đã rà (tóm tắt)

| # | Bất cập | Bằng chứng |
|---|---|---|
| 1 | **Mượn cột đa nghĩa** — một cột DB mang nghĩa khác nhau theo mẫu đơn | `material_grade` 6 nghĩa (Vật liệu / Định mức g/5m / Mã màu NCC / Loại kính / Loại gỗ / Model); `finish` = Bảo hành ở MRO; `weight_per_unit` = kg/đơn vị (inox) NHƯNG = m³/SP (gỗ) — đổi mẫu là đổi cả đơn vị số |
| 2 | **Thông số sống trong chuỗi `spec` tự do**, hệ bóc bằng heuristic | mút cuộn "8mm x 1.05m x 150m" từng bị đọc nhầm; bulong 6x20x13 bị bóc vào ô lọt lòng carton (ghi nhận 12/08, chưa sửa) |
| 3 | **Đổi nhóm âm thầm xoá dữ liệu** — `corePayload` ghi null trường ngoài nhóm mới | MaterialCoreFields.tsx: "đổi nhóm là số cũ về null", không cảnh báo, không hoàn tác |
| 4 | **Thêm loại vật tư = sửa ~7 chỗ, không có sổ đăng ký duy nhất** | material-group-fields.ts · PO_FIELDS · PO_PRINT_ORDER · PO_PRINT_QTY_LABEL · poPriceSuffix · **2 check DB** (bài học 0135: 8 mẫu bị DB chặn không ai biết) · guessTemplate · 2 kiểu `PoMaterial` (client + server) |
| 5 | **`needs_review` cấp bản ghi** — Kho không biết TRƯỜNG nào là đoán | 0136 chỉ có cờ boolean |

Những cái CỐ Ý giữ, không coi là bất cập: mẫu đơn thuộc về ĐƠN (không dính vật
tư); `material_code` ở định mức là text không FK; một bảng `warehouse_materials`
chung thay vì bảng riêng từng loại.

## 2. Kế hoạch — 3 đợt làm + 1 định hướng hoãn

### Đợt 1 — Nền móng: một nguồn khai báo, một kiểu dữ liệu (cỡ M)

Trả nợ bất cập #4. Không đổi hành vi người dùng, thuần cấu trúc.

| # | Việc | File |
|---|---|---|
| 1.1 | **Gộp 2 kiểu `PoMaterial` về một** — tách type ra `src/lib/po-material.types.ts` (thuần type, không import db), server repo và client MaterialPicker cùng import. Hết bẫy "thêm trường phải sửa 2 nơi". `PoLastLine` đi cùng. | `po-materials.repo.ts`, `MaterialPicker.tsx`, file mới |
| 1.2 | **Test đối chiếu mẫu ↔ check DB**: test đọc `supabase/migrations/*`, tìm constraint MỚI NHẤT của `supply_purchase_orders.template` và `warehouse_materials.po_template`, so bộ giá trị với `PO_TEMPLATES`. Thêm mẫu mà quên nới check → test đỏ ngay trên máy, không đợi smoke DB thật. | `src/lib/po-template-db.test.ts` (mới) |
| 1.3 | ~~Registry nhóm mở rộng — dồn "nhóm → po_template gợi ý" về material-group-fields~~ **HUỶ khi làm (13/08)**: `guessTemplate` cố ý đoán theo TÊN, không theo nhóm — bài học 02/08 ghi ngay đầu file (cụm "Nhôm - thanh & tấm" 548 dòng chỉ 180 nhôm thật; gán theo nhóm là 2/3 mang nhầm bộ cột kg/m). Registry nhóm cho form khai đã tồn tại (`material-group-fields.ts`); ép guess theo nhóm là lặp lại lỗi cũ. | không đổi code |
| 1.4 | **Bảng tra "mẫu → nghĩa cột"** cho các cột mượn: một object `PO_FIELD_MEANING` cạnh `PO_FIELDS` + đoạn doc — ai đọc code biết `material_grade` ở mẫu sơn nghĩa là gì mà không phải dò 12 mẫu. | `po-fields.ts`, doc này |

Tiêu chí xong: `npm run check` sạch; xoá thử một mẫu khỏi check DB trong bản
nháp migration → test 1.2 đỏ; grep `type PoMaterial` chỉ còn 1 định nghĩa.

### Đợt 2 — Chặn mất dữ liệu + rà đúng chỗ (cỡ S–M)

Trả nợ bất cập #3 và #5. Có 1 migration nhỏ.

| # | Việc | Ghi chú |
|---|---|---|
| 2.1 | **Xác nhận khi đổi nhóm**: trước khi lưu, so payload cũ/mới — trường nào sắp bị null đè mà đang có giá trị thì liệt kê ("đổi sang Bao bì sẽ xoá: kg/m 0.248, dài cây 6m — tiếp tục?"). Hai nhịp như cảnh báo trùng tên 0136. | `MaterialCoreFields.tsx`, logic diff thuần → test được |
| 2.2 | **`needs_review_fields text[]`** trên `warehouse_materials` (migration 013x, idempotent, RLS giữ nguyên posture): form khai nhanh ghi danh sách trường bỏ trống/đoán (`unit`, `group_name`, `spec`…); màn Kho hiện chip từng trường thay vì một cờ chung; "Đã rà xong" xoá cả cờ lẫn mảng. | Kho PATCH được, Cung ứng vẫn 403 như 0136 |

Tiêu chí xong: sửa vật tư đổi nhóm có modal liệt kê đúng trường sắp mất; khai
vội thiếu ĐVT → chip "ĐVT?" trên màn Kho.

### Đợt 3 — Trả nợ 2 ca mượn cột tệ nhất (cỡ M, có migration)

Chỉ 2 ca số-đổi-nghĩa; các ca text (`material_grade`, `dimension_text`) chấp
nhận mượn tiếp, đã có bảng tra 1.4.

| # | Việc | Ghi chú |
|---|---|---|
| 3.1 | Migration: thêm `m3_per_unit numeric` + `warranty_text text` vào `supply_po_lines`; mẫu gỗ ghi m³/SP vào cột mới (thôi mượn `weight_per_unit`), MRO ghi bảo hành vào cột mới (thôi mượn `finish`). Backfill: DB hiện **chưa có đơn nào** → chỉ cần `update` phòng hờ theo `template`, gần như no-op. | Sửa cả: PO_FIELDS (field mapping), PoPrintLine, po-excel, PoLineTable payload, `last_line` recall, 2 test |
| 3.2 | Sau 3.1: `weight_per_unit` chỉ còn nghĩa kg/đơn vị, `finish` chỉ còn nghĩa màu/bề mặt — cập nhật bảng tra 1.4. | |

Tiêu chí xong: check sạch; smoke chèn đơn gỗ + MRO vào DB thật (như đợt 0134)
rồi xoá; đổi mẫu một dòng gỗ → số m³ KHÔNG rơi vào ô kg.

### Đợt 4 — ĐỊNH HƯỚNG, CHƯA LÀM: JSONB `attrs` cho thông số mô tả

Tách "thông số mô tả" (cách mở, bề mặt, model, khổ vải — chỉ để đọc/in) vào cột
JSONB + zod schema theo nhóm; "số tính tiền" (kg/m, m², m³, pcs/thùng, dài cây)
GIỮ cột như nay. Thêm loại vật tư khi đó = 1 entry registry + 1 schema, không
migration.

**Điều kiện kích hoạt** (chưa đủ thì đừng làm): sắp thêm nhóm vật tư thứ 15+,
hoặc một nhóm cần >2 thông số mới không tham gia tính tiền. Làm SAU khi đợt 1
đứng vững — registry là chỗ JSONB schema sẽ cắm vào.

Riêng bất cập #2 (bóc `spec` bằng heuristic): giảm dần tự nhiên — nhóm nào đã có
bộ ô số riêng (0137 + đợt 4) thì thôi bóc chuỗi; KHÔNG viết thêm luật đoán mới
cho nhóm mới.

## 3. Thứ tự & ràng buộc

- Làm đúng thứ tự 1 → 2 → 3; đợt 4 hoãn có điều kiện.
- Mỗi đợt một commit riêng (stage đích danh — working tree đang còn mạch định
  mức dở, xem memory `ban-giao-a-nhan-mau-don-thieu`).
- Migration đợt 2/3 theo chuẩn `add-migration` (idempotent, header RLS), apply
  qua MCP như 0134-0137, xong gọi `sync-types`.
- Không đụng: triết lý text-không-FK của định mức; mẫu-thuộc-về-đơn; khung phiếu
  in vừa chốt 12/08 (khung chuẩn NGƯỜI LẬP).

## 4. Rủi ro

- **1.2 parse migration bằng regex** — constraint viết nhiều dòng; parser phải
  bám dạng chuẩn `check (template in (...))`, và test phải ĐỎ khi không parse
  được (đừng lặng lẽ pass).
- **3.1 đổi field mapping** đụng đường `last_line` recall và po-draft
  localStorage — nháp cũ đang cầm `weight_per_unit` cho gỗ; đọc nháp phải chấp
  nhận cả khoá cũ (một nhánh migrate nhỏ trong `po-draft.ts`).
- **2.1 diff payload** phải diff SAU chuẩn hoá (trim/Number) — không thì cảnh
  báo giả "0.2480 → 0.248".
