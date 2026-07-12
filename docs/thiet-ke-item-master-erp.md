# THIẾT KẾ ITEM MASTER CHUẨN ERP — Quản lý vật tư đa loại

> **Trạng thái:** Đề xuất (chờ duyệt) · **Ngày:** 12/07/2026 · **Đối tượng đọc:** Đội phát triển
> **Quyết định đã chốt (phiên làm việc):** định giá **FIFO** (cost layers) · **không** theo dõi
> lô/hạn dùng vật lý · làm **tài liệu trước** rồi mới migration.
>
> Mục tiêu: nâng `warehouse_materials` (migration [0009](../supabase/migrations/0009_warehouse_materials.sql))
> từ item master tối giản lên chuẩn ERP, phục vụ **nhiều loại vật tư** của ngành nội thất trên
> **một** bảng master duy nhất. Không phá dữ liệu / service hiện có — thêm dần từng lớp.

---

## 1. Bối cảnh & vấn đề

Xưởng hiện sản xuất **nội thất kim loại** (dòng HALI — ghế/bàn từ ống & thanh sắt, nhôm; xem
[SRS sản xuất](srs-san-xuat-chi-tiet.md)). Vật tư trải rộng: kim loại (ống/thanh/tôn), sơn/hóa
chất hoàn thiện, phụ kiện kim khí, bao bì — và sẽ mở sang gỗ/vải/kính khi thêm dòng sản phẩm.

Master hiện tại chỉ có: `code, name, unit, group_name, min_stock, shelf_location, note, is_active`.
**Ba gap chặn nghiệp vụ:**

| # | Gap | Hệ quả thực tế |
|---|-----|----------------|
| G1 | **Một đơn vị duy nhất**, không quy đổi | Mua *cây/kg*, tiêu hao *mét/chi tiết* phải quy đổi tay ở tầng components (`bars_needed`/`kg_needed`) |
| G2 | **Không có giá vốn** ở master lẫn sổ cái | Không tính được **giá trị tồn kho** và **giá thành sản phẩm** |
| G3 | **Không có điểm đặt hàng / phân loại chuẩn** | Chỉ cảnh báo `min_stock` thô; không phân biệt NVL / bán thành phẩm / vật tư phụ |

---

## 2. Nguyên tắc thiết kế

1. **Một master, phân loại bằng `item_type` + cây `category`** — KHÔNG tách bảng theo loại vật tư.
2. **UoM tách bảng, có hệ số quy đổi về `base_unit`** — giải quyết G1 tổng quát cho mọi loại.
3. **Trường chung = cột; spec riêng theo loại = `attributes jsonb`** — không EAV, không cột thưa vô hạn.
   Chỉ những thuộc tính hay lọc/hiển thị (kích thước, màu) mới lên cột.
4. **FIFO bằng cost layers**: mỗi lần nhập tạo một *lớp giá*; xuất trừ dần theo thứ tự nhập trước.
   Giá vốn xuất = giá của lớp bị tiêu thụ. (Không cần lô/hạn dùng vật lý.)
5. **Idempotent & không phá vỡ**: `add column if not exists`, `create table if not exists`; service
   cũ chạy nguyên vẹn, master mới chỉ *thêm* khả năng.

---

## 3. Phân loại vật tư

### 3.1. `item_type` (enum — bản chất vật tư)

| Giá trị | Nghĩa | Ví dụ |
|---------|-------|-------|
| `raw_material` | Nguyên vật liệu chính | Ống sắt Ø25, thanh nhôm, tôn tấm |
| `semi_finished` | Bán thành phẩm (qua công đoạn) | Khung ghế đã hàn, chi tiết đã sơn |
| `consumable` | Vật tư phụ / tiêu hao | Sơn, keo, que hàn, giấy nhám, đá cắt |
| `packaging` | Bao bì | Thùng carton, màng PE, xốp, góc bảo vệ |
| `finished_good` | Thành phẩm | Ghế HALI hoàn chỉnh |

### 3.2. Cây nhóm `item_categories` (phân cấp, tự tham chiếu)

```
Kim loại            → Ống sắt, Thanh/hộp sắt, Nhôm định hình, Tôn tấm, Inox
Hoàn thiện          → Sơn tĩnh điện, Sơn dầu, Dung môi, Keo, Giấy nhám, Đá cắt/mài
Phụ kiện            → Ốc vít – tán, Chân đế – ke góc, Bánh xe, Tay nắm, Nút bịt
Bao bì              → Carton, Màng PE, Xốp, Dây đai
(Mở rộng sau)       → Gỗ & ván, Vải & nệm, Kính & gương
```
`item_categories(id, parent_id, code, name, sort, is_active)` — seed sẵn nhóm trên, cho phép thêm.
`group_name` cũ giữ lại (deprecated) để tương thích, dữ liệu dời dần sang `category_id`.

---

## 4. Item master mở rộng (`warehouse_materials`)

Cột hiện có giữ nguyên. Bổ sung (tất cả nullable / có default → an toàn với dữ liệu cũ):

| Nhóm | Cột | Kiểu | Ghi chú |
|------|-----|------|---------|
| **Phân loại** | `item_type` | text (enum) | default `'raw_material'` |
| | `category_id` | uuid → item_categories | thay dần `group_name` |
| | `spec` | text | quy cách mô tả (vd "Ống Ø25×1.2mm") |
| **UoM** | `base_unit` | text | ĐV tồn kho chuẩn; backfill = `unit` cũ |
| **Quy cách vật lý** | `length_mm`,`width_mm`,`thickness_mm` | numeric | ống/thanh/tôn/nẹp |
| | `weight_kg` | numeric(14,3) | KL 1 `base_unit` — nền quy đổi kg |
| | `color` | text | |
| | `attributes` | jsonb | spec riêng loại: `{"brand":"...","grade":"SS400","surface":"mạ kẽm"}` |
| **Giá vốn (FIFO)** | `last_purchase_price` | numeric(14,2) | giá nhập gần nhất (tham khảo) |
| | `currency` | text | default `'VND'` |
| **Kế hoạch tồn** | `max_stock`,`reorder_point`,`reorder_qty` | numeric | `min_stock` đã có |
| | `lead_time_days` | int | thời gian đặt hàng |
| **Nguồn hàng** | `default_supplier_id` | uuid → supply_suppliers | ưu tiên mua |
| | `make_or_buy` | text | `'buy'` \| `'make'` (bán thành phẩm) |
| **Thuế** | `vat_rate` | numeric(5,2) | % VAT đầu vào |
| **Media/Audit** | `image_url`,`created_by`,`updated_by` | | |

> **avg_cost KHÔNG lưu ở master** — với FIFO giá vốn nằm ở các lớp giá (mục 6). Master chỉ giữ
> `last_purchase_price` để tham khảo nhanh.

---

## 5. Đơn vị & quy đổi — bảng mới `item_uom` (giải G1)

```sql
item_uom(
  id           uuid pk,
  material_id  uuid → warehouse_materials on delete cascade,
  unit         text,                 -- 'cây','kg','mét','cái','thùng','m2'
  to_base      numeric(18,6),        -- 1 unit = to_base × base_unit
  role         text,                 -- 'stock' | 'purchase' | 'consume' | 'alt'
  unique(material_id, unit)
)
```

**Cơ chế:** mọi số lượng nhập/xuất được quy về `base_unit` khi ghi sổ cái → tồn kho luôn một đơn vị
gốc, còn người dùng thao tác bằng đơn vị tiện nhất.

Ví dụ ống sắt Ø25 (`base_unit = 'cây'`, cây 6m nặng 8.4kg):

| unit | to_base | role | Dùng khi |
|------|---------|------|----------|
| cây | 1 | stock | tồn kho |
| kg | 0.119 (=1/8.4) | purchase | mua theo kg |
| mét | 0.1667 (=1/6) | consume | BOM tiêu hao theo mét |

→ Mua 840kg → +100 cây tồn; BOM cần 30m → xuất 5 cây. Quy đổi tự động, không tính tay.

---

## 6. Định giá FIFO — bảng `stock_cost_layers` (giải G2)

Với FIFO, không thể chỉ giữ một `avg_cost`. Mỗi lần **nhập** mở một *lớp giá*; mỗi lần **xuất** tiêu
thụ các lớp cũ nhất trước.

```sql
-- Lớp giá còn lại (nguồn sự thật của giá vốn tồn)
stock_cost_layers(
  id            uuid pk,
  material_id   uuid → warehouse_materials,
  movement_id   uuid → warehouse_movements,   -- lần nhập tạo lớp
  qty_in        numeric(14,2),                 -- SL nhập (base_unit)
  qty_remaining numeric(14,2),                 -- còn lại chưa xuất
  unit_cost     numeric(14,2),                 -- giá vốn / base_unit
  created_at    timestamptz
)
```

Bổ sung sổ cái `warehouse_movements`: `unit_cost`, `total_cost` (giá vốn thực của lần xuất, do FIFO
tính khi ghi).

**Thuật toán khi ghi phiếu (trong 1 giao dịch):**
- **Nhập:** tạo `stock_cost_layers` (qty_remaining = qty, unit_cost = đơn giá nhập). Cập nhật
  `last_purchase_price`.
- **Xuất:** lặp các lớp `qty_remaining > 0` theo `created_at` tăng dần, trừ dần đến đủ SL xuất; cộng
  dồn `Σ(qty_lấy × unit_cost)` = giá vốn xuất → ghi vào `movement.total_cost`.

**Giá trị tồn kho** = `Σ(qty_remaining × unit_cost)` theo vật tư → view `v_stock_valuation`.

> ⚠️ **Bắt buộc atomic + khóa hàng.** Ghi phiếu nhập/xuất phải bọc **transaction** và **`select …
> for update`** trên các lớp giá để tránh race (đã là rủi ro tồn đọng của service hiện tại). Nên
> chuyển phần ghi sổ cái + cost layer sang **RPC/Postgres function** thay vì nhiều lệnh PostgREST rời.

---

## 7. Ví dụ mapping đa loại vật tư

| Vật tư | item_type | category | base_unit | UoM quy đổi | attributes |
|--------|-----------|----------|-----------|-------------|------------|
| Ống sắt Ø25×1.2 | raw_material | Ống sắt | cây | kg, mét | `{grade:"SS400", surface:"đen"}` |
| Thanh nhôm 40×40 | raw_material | Nhôm định hình | cây | kg, mét | `{alloy:"6063", finish:"anod"}` |
| Tôn tấm 1.2mm | raw_material | Tôn tấm | tấm | kg, m2 | `{dims:"1250×2500"}` |
| Sơn tĩnh điện | consumable | Sơn tĩnh điện | kg | thùng | `{color:"RAL9005", brand:"..."}` |
| Que hàn CO2 | consumable | (Hoàn thiện) | kg | cuộn | `{dia:"0.9"}` |
| Ốc vít M6 | raw_material | Ốc vít – tán | cái | hộp | `{len:"20", plating:"kẽm"}` |
| Bánh xe ghế | raw_material | Bánh xe | cái | bộ(5) | `{load:"...kg"}` |
| Thùng carton | packaging | Carton | cái | kiện | `{dims:"...", ply:"5"}` |

Một master, một cơ chế quy đổi & định giá — phủ toàn bộ.

---

## 8. Kế hoạch migration (thứ tự & tương thích)

| # | File | Nội dung | Phá vỡ? |
|---|------|----------|---------|
| 1 | `00xx_item_categories.sql` | Bảng cây nhóm + seed nhóm nội thất kim loại | Không |
| 2 | `00xx_material_master_erp.sql` | Thêm cột vào `warehouse_materials` (item_type, category_id, spec, dims, weight, attributes, planning, sourcing, vat, audit). Backfill `base_unit = unit` | Không (add-if-not-exists) |
| 3 | `00xx_item_uom.sql` | Bảng `item_uom` + seed dòng `stock` = base cho vật tư hiện có | Không |
| 4 | `00xx_movement_costing_fifo.sql` | `stock_cost_layers` + cột `unit_cost/total_cost` trên sổ cái + view `v_stock_valuation` + RPC ghi phiếu atomic | Không (logic mới) |

RLS: mọi bảng mới `enable row level security` (no policy); mọi view `security_invoker = on` — đúng
posture dự án. Sau mỗi bước **sync types** (`src/lib/database.types.ts`).

**Tác động code:** `warehouse.schema.ts` thêm field; `warehouse.repo.ts`/`stock.repo.ts` mở rộng
COLS; `stock.service.ts` gọi RPC FIFO thay cho `insertMovements` trực tiếp. `smartLsxNeeds` có thể
dùng `item_uom` để quy đổi thay vì tính tay.

---

## 9. Ngoài phạm vi (giai đoạn sau)

- Lô / hạn dùng vật lý (đã chốt **không** làm — có thể thêm `tracking_type` sau).
- Nhiều kho / nhiều bin trong 1 kho (hiện 1 kho MAIN).
- Barcode/QR quét kho.
- Đổi FIFO ↔ bình quân (thiết kế cost layer vẫn cho phép suy ra avg).

---

## 10. Câu hỏi cần chốt trước khi code

1. `base_unit` cho **kim loại**: chọn **cây** (tiện đặt mua/điều độ) hay **kg** (chuẩn cân)? Đề xuất
   **cây** cho ống/thanh, **kg** cho vật tư rời (sơn, que hàn).
2. `default_supplier_id` → `supply_suppliers` (migration [0015](../supabase/migrations/0015_supply.sql)) — xác nhận FK `on delete set null`.
3. VAT: quản ở mức vật tư (`vat_rate`) hay để chứng từ mua tự áp? (đề xuất giữ ở vật tư làm mặc định).
