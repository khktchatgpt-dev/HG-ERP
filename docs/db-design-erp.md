# Thiết kế Database — ERP Sản xuất Nội thất

> **Đã hiện thực** thành migration `0011`–`0016` (07/2026). Các cột/bảng bổ sung
> từ mẫu in thật lấy theo `docs/db-design-inputs-analysis.md` — file đó là phần
> đối chiếu chi tiết của bản thiết kế này.

Nguồn: `ERP_NoiThat_Requirement.docx` (SRS v1.0) + `ERP_NoiThat_DacTa_v2.docx`
+ bộ mẫu in thật (`Hoàng Gia - Tổng hợp mẫu in.docx`, `Mẫu in.pdf`).
Phạm vi: **GĐ1 (trục vận hành)** — Kế toán/công nợ để GĐ sau (đã chốt).
Quy ước chung của dự án: bảng prefix theo phòng (`sales_`, `technical_`, `supply_`,
`warehouse_`, `production_`), RLS **enable no-policy**, view `security_invoker = on`,
`uuid` PK, `timestamptz` + trigger `set_updated_at()`, FK luôn khai `on delete`.

## 1. Sơ đồ tổng thể (xương sống — Mục 2 đặc tả)

```
sales_customers ──1:n─ sales_quotes ──duyệt(BR-04)──▶ sales_orders ══1:1══ production_orders (LSX)
                          │ 1:n                          │ 1:n (BR-01: unique FK)   │
                          quote_lines                    order_lines ◀── LSX dùng chung dòng SP (BR-02)
                                                             │ product_id           │ 1:n
technical_products (theo khách, cờ BOM — BR-03) ◀────────────┘        supply_purchase_orders (BR-05,06)
   │ 1:n                                                                │ 1 NCC + 1 LSX   │ 1:n
   technical_bom_lines ──▶ warehouse_materials ◀────────────────────────┴── po_lines (đặt−nhận=thiếu, BR-08)
                              │ 1:n                                              ▲
                              warehouse_movements (nhập/QC/xuất — BR-09,10) ─────┘ po_line_id
                              production_progress (giai đoạn SX theo LSX)
```

**BR-11 (truy vết):** từ `sales_orders.id` đi được tới: quote (FK), LSX (unique FK),
PO (qua LSX), phiếu nhập (movements.po_line_id), phiếu xuất (movements.production_order_id),
tiến độ (production_progress), file (files.parent). Không nhánh nào đứt.

## 2. Bảng hiện có — giữ nguyên / mở rộng

| Bảng | Trạng thái | Việc cần làm |
|---|---|---|
| `users`, `departments`, `tasks*`, `notifications`, `activity_log`, `files`, `settings` | giữ | mở rộng `files.parent` kinds (product/quote/order/po) |
| `sales_customers` | giữ | — |
| `technical_products` | **mở rộng** | + `customer_id`, + `bom_status` (mục 4) |
| `warehouse_materials`, `warehouse_movements`, view `warehouse_stock` | **mở rộng** | + `warehouse_id`, + FK `po_line_id` / `production_order_id` (mục 7) |
| `hr_leave_requests`, `accounting_invoices` | giữ | GĐ sau, không đụng |

## 3. Danh mục dùng chung (FR-ADM-04) — migration 0011

```sql
catalog_items (
  id uuid PK,
  type text check in ('unit','material_group','product_category',
                      'production_stage','contract_type'),
  code text, label text, sort_order int default 0, is_active bool,
  unique (type, code)
)
```
Seed: ĐVT (cái/bộ/tấm/hộp/m/m²/kg/lít), giai đoạn SX (phôi→hàn→sơn→mài→hoàn thiện),
nhóm vật tư hiện dùng. `warehouse_materials.unit/group_name` và
`production_orders.current_stage` tham chiếu **bằng code (text)** — không FK cứng để
danh mục sửa được mà không khoá dữ liệu cũ (trade-off chấp nhận).

```sql
warehouses ( id uuid PK, code text unique, name text, is_active bool )  -- FR-WMS-10
-- seed 1 dòng 'MAIN' — Kho chính. movements.warehouse_id default MAIN.
```
Thêm ngay từ bây giờ vì thêm cột sau khi movements đã nhiều dữ liệu sẽ đau; UI GĐ1 ẩn.

**Sinh mã chứng từ** (BG-2026-0001, DH-, LSX-, PO-, và phiếu kho PNK/PXK/DCK/KK): 
```sql
doc_counters ( kind text, year int, last_no int, PK (kind, year) )
next_doc_code(kind text) → text   -- function, update…returning để an toàn concurrent
```

## 4. Kỹ thuật — sản phẩm & BOM (FR-ENG, BR-03) — migration 0012

```sql
alter technical_products
  + customer_id uuid FK sales_customers on delete set null,  -- thư viện THEO KHÁCH (null = mẫu chung)
  + bom_status text check in ('none','drawing','done') default 'none',  -- FR-ENG-05: chưa có/đang vẽ/đã vẽ
  + customer_item_code text,   -- mã SP do KHÁCH đặt (sale contract in "Customer Item")
  + description_en text,       -- mô tả tiếng Anh in báo giá
  + packing jsonb default '{}',-- dims L/W/H, carton cm/inch, qty_per_carton, loading_40hc
  + unit text default 'cai';   -- ĐVT bán (PCS/SET/cái…) — code catalog

technical_bom_lines (
  id uuid PK,
  product_id uuid FK technical_products on delete cascade,
  material_id uuid FK warehouse_materials on delete restrict,  -- mã VT BOM = mã kho (đặc tả 4.2)
  qty_per_unit numeric(14,4) check > 0,   -- định mức / 1 sản phẩm
  note text, sort_order int,
  unique (product_id, material_id)
)
```
**Quyết định:** GĐ1 mỗi SP giữ **1 BOM hiện hành** (lines trên); *phiên bản* BOM quản
qua file Excel đính kèm (module `files`, NFR-03) — đúng ý "BOM cập nhật theo thời
gian, không ràng buộc LSX". Bảng `technical_boms` versioned đầy đủ để GĐ2 nếu cần.

## 5. Kinh doanh — báo giá & đơn hàng (FR-SAL, BR-04) — migration 0013

```sql
sales_quotes (
  id uuid PK, code text unique,                -- BG-2026-0001
  customer_id uuid FK sales_customers on delete restrict,
  status text check in ('draft','pending','approved','rejected') default 'draft',
  currency char(3) default 'USD',              -- bán = USD thực tế (mẫu in); chưa cần tỷ giá
  valid_from date, valid_to date,              -- "Valid date: From … to …" trên mẫu báo giá
  price_term text, payment_terms text,         -- FOB Quy Nhon / L/C at sight
  note text, created_by uuid FK users,
  approved_by uuid FK users, approved_at timestamptz, rejected_reason text,
  created_at, updated_at
)
sales_quote_lines (
  id uuid PK, quote_id FK cascade,
  product_id uuid FK technical_products on delete restrict,
  qty numeric(14,2) check > 0, unit_price numeric(18,2) check >= 0,
  note text, sort_order int
)

sales_orders (
  id uuid PK, code text unique,                -- DH-2026-0001
  quote_id uuid FK sales_quotes on delete restrict NOT NULL,  -- BR-04: chỉ từ báo giá đã duyệt (service kiểm status)
  customer_id uuid FK on delete restrict,      -- denorm từ quote cho query nhanh
  customer_po_no text,                         -- số PO của khách — in trên header LSX
  status text check in ('confirmed','lsx_issued','in_production',
                        'completed','delivered','cancelled') default 'confirmed',
  currency char(3) default 'USD',
  due_date date,                               -- phục vụ cảnh báo trễ (FR-SAL-09)
  deposit_percent numeric(5,2),                -- sale contract: "Deposit 20%"
  price_term text, payment_terms text, container_summary text,  -- "1 x 40'HC"
  note text, created_by, created_at, updated_at
)
sales_order_lines ( như quote_lines, order_id FK cascade )

sales_order_changes (                          -- FR-SAL-05: lịch sử thay đổi đơn
  id uuid PK, order_id FK cascade, changed_by uuid FK users,
  change jsonb NOT NULL,                       -- {field, from, to} hoặc snapshot lines
  note text, created_at
)
```
Chuỗi trạng thái đơn trong đặc tả (Nháp→Chờ duyệt BG→Đã duyệt→Đã phát LSX→…) tách làm 2:
**quote.status** (draft/pending/approved) + **order.status** (confirmed→…→delivered).
Trang "trạng thái tổng hợp" (FR-SAL-07) ghép cả hai + BOM + vật tư qua view (mục 9).

## 6. LSX & tiến độ sản xuất (BR-01/02, FR-PROD) — migration 0014

```sql
production_orders (
  id uuid PK, code text unique,                -- LSX-2026-0001
  sales_order_id uuid NOT NULL UNIQUE FK sales_orders on delete restrict,  -- ⭐ BR-01: 1-1 ép ở DB
  status text check in ('issued','in_progress','completed') default 'issued',
  current_stage text,                          -- code catalog production_stage (FR-PROD-01)
  ship_date date, container_summary text,      -- thời gian xuất + "3 x 40'HC" in trên LSX
  issued_by uuid FK users, issued_at timestamptz,  -- GĐ xác nhận phát LSX (FR-SAL-06)
  note text, created_at, updated_at
)

production_order_line_specs (                  -- spec SX per dòng để in LSX (mẫu LAURA)
  id uuid PK, production_order_id FK cascade, order_line_id FK sales_order_lines cascade,
  specs jsonb default '{}',                    -- {may, nem, son, dong_goi, …} — đổi theo loại SP
  note text, important_note text,
  unique (production_order_id, order_line_id)
)
-- BR-02: dòng sản phẩm của LSX = sales_order_lines (dùng chung, không nhân bản).
--   Trade-off: sửa đơn sau khi phát LSX thì LSX thấy ngay (đúng vận hành linh hoạt
--   của DN); mọi thay đổi đã có sales_order_changes ghi vết.

production_progress (                          -- FR-SUP-08: log chuyển giai đoạn
  id uuid PK, production_order_id FK cascade,
  stage text NOT NULL, action text check in ('start','done') default 'done',
  note text, updated_by uuid FK users, created_at
)
-- GĐ3: + worker_id, qty, hours (FR-SUP-09/PROD-04) — chỉ thêm cột, không đổi cấu trúc.
```

## 7. Cung ứng — NCC & đơn đặt vật tư (FR-SUP, BR-05/06/08) — migration 0015

```sql
supply_suppliers (
  id uuid PK, code text unique, name text NOT NULL,
  email text, phone text, address text, tax_no text,
  note text, is_active bool, created_at, updated_at
)

supply_purchase_orders (
  id uuid PK, code text unique,                -- PO-2026-0001
  production_order_id uuid NOT NULL FK on delete restrict,  -- ⭐ BR-06: đúng 1 LSX
  supplier_id uuid NOT NULL FK supply_suppliers on delete restrict,  -- ⭐ BR-06: đúng 1 NCC
  status text check in ('pending_approval','approved','ordered','confirmed',
                        'in_transit','partial','received','cancelled')
         default 'pending_approval',           -- chuỗi trạng thái đặc tả 4.3
  currency char(3) default 'VND',              -- mua trong nước = VND (mẫu in)
  vat_rate numeric(5,2), price_includes_vat bool default true,  -- "đã/chưa gồm VAT 10%"
  expected_at date, terms text,                -- thời gian giao hàng, bảo hành
  approved_by uuid FK users, approved_at timestamptz,  -- BR-05: GĐ duyệt mới gửi NCC (service chặn)
  ordered_at timestamptz, note text, created_by, created_at, updated_at
)
supply_purchase_order_lines (
  id uuid PK, po_id FK cascade,
  material_id uuid FK warehouse_materials on delete restrict,
  qty_ordered numeric(14,2) check > 0, unit_price numeric(18,2),
  spec text, qty2 numeric(14,4), unit2 text,   -- quy cách + ĐVT kép (cây↔kg, tấm↔m² — OI-10)
  note text, sort_order int
)

-- Nâng cấp kho để nối chuỗi (thay ref_no text bằng FK thật):
alter warehouse_movements
  + warehouse_id uuid FK warehouses (backfill MAIN),
  + po_line_id uuid FK supply_purchase_order_lines on delete set null,      -- nhập theo đơn (FR-WMS-02)
  + production_order_id uuid FK production_orders on delete set null,       -- xuất theo LSX (BR-09)
  + transfer_group uuid,                                                    -- cặp out/in điều chuyển
  + unit_cost numeric(18,2);                                                -- giá trị nhập/xuất — GĐ sau, UI ẩn
-- ref_type mở rộng: + 'transfer' (điều chuyển), + 'adjust' (kiểm kê — OI-08).
-- ref_type/ref_no giữ lại cho nhập mua ngoài / xuất thường ngày + backward compat.

-- BR-08: thiếu = đặt − nhận. KHÔNG denorm qty_received — tính từ sổ cái:
create view supply_po_line_status with (security_invoker=on) as
select l.*, coalesce(sum(mv.qty + mv.qty_rejected),0) as qty_received,     -- nhận = cả đạt lẫn loại QC
       coalesce(sum(mv.qty_rejected),0)               as qty_rejected,     -- BR-10: loại không vào tồn
       l.qty_ordered - coalesce(sum(mv.qty + mv.qty_rejected),0) as qty_missing
from supply_purchase_order_lines l
left join warehouse_movements mv on mv.po_line_id = l.id and mv.direction='in'
group by l.id;
```
Trạng thái PO `partial/received` suy từ view (mọi dòng missing ≤ 0 → received) — service
cập nhật status khi nhập kho, view là nguồn đối chiếu.

## 8. Phê duyệt tập trung (FR-ADM-03) — không thêm bảng

Chỉ 2 khâu duyệt bắt buộc (đặc tả mục 6): **báo giá** và **mua vật tư** → dùng ngay
`status + approved_by/approved_at` trên `sales_quotes` và `supply_purchase_orders`.
Màn hình GĐ (workspace `exec`) = query 2 bảng lọc `pending*`. Ghi vết duyệt qua event
bus → `activity_log` (NFR-02). *Không* dựng bảng approvals tổng quát ở GĐ1 (YAGNI).

## 9. View phục vụ màn hình (đọc nhiều, ghép nhiều bảng)

| View | Phục vụ | Ghép |
|---|---|---|
| `v_order_tracking` | FR-SAL-07 bảng trạng thái đơn + FR-SAL-09 cảnh báo | orders + quote + LSX + tiến độ + đếm SP thiếu BOM + PO thiếu vật tư |
| `supply_po_line_status` | BR-08 còn thiếu từng dòng | (mục 7) |
| `warehouse_stock` | tồn realtime (đã có) | + lọc theo `warehouse_id` khi GĐ3 |

## 10. Ràng buộc nghiệp vụ → nơi thực thi

| BR | Thực thi tại |
|---|---|
| BR-01 đơn↔LSX 1-1 | **DB**: `production_orders.sales_order_id UNIQUE NOT NULL` |
| BR-02 LSX cụm SP | dùng chung `sales_order_lines` |
| BR-03 BOM per-SP | **DB**: `bom_status` trên `technical_products` |
| BR-04 duyệt BG trước đơn | service (`sales_orders.create` kiểm `quote.status='approved'`) |
| BR-05 duyệt PO trước gửi NCC | service (chuyển `ordered` chỉ khi `approved`) |
| BR-06 PO = 1 LSX + 1 NCC | **DB**: 2 cột NOT NULL FK |
| BR-07 phát LSX không cần đủ BOM | service (không chặn, chỉ hiển thị cờ) |
| BR-08 thiếu = đặt − nhận | **View** `supply_po_line_status` (không denorm) |
| BR-09 xuất theo LSX phải gắn LSX | **DB check**: `ref_type='lsx' ⇒ production_order_id NOT NULL` |
| BR-10 QC loại không vào tồn | đã có (`qty` vs `qty_rejected` + view stock) |
| BR-11 truy vết | chuỗi FK ở mục 1 + `files.parent` |

## 11. Thứ tự migration & lộ trình build

| # | Migration | Mở khoá |
|---|---|---|
| 0011 | `catalogs` (catalog_items + seed, warehouses, doc_counters + next_doc_code) | mọi thứ sau |
| 0012 | `technical_products_bom` (create-if-missing + alter products, bom_lines) | Kỹ thuật BOM UI |
| 0013 | `sales_quotes_orders` (quotes/lines, orders/lines/changes) | Sales UI + duyệt BG |
| 0014 | `production_orders` (+progress, +line_specs) | phát LSX, xưởng, in LSX |
| 0015 | `supply` (suppliers, PO/lines, alter movements FK+transfer/adjust, view po_line_status, v_order_tracking) | Cung ứng UI + duyệt PO + nối kho |
| 0016 | `files_erp_parents` (files + quote_id/sales_order_id/purchase_order_id) | đính file chứng từ (BR-11) |

Mỗi migration: idempotent, header RLS, bảng nào cũng `enable row level security` no-policy.
Sau mỗi migration: sync types + test schema (vitest) + smoke DB.

## 12. Quyết định đã chốt & còn ngỏ

**Chốt trong bản này** (đổi được nhưng phải sửa sớm):
1. `currency char(3)`: mặc định **USD** phía bán (quote/order — mẫu in FOB Quy Nhon
   bằng USD), **VND** phía mua (PO). Không quy đổi tỷ giá GĐ1 (OI-12 xác nhận sau).
2. BOM 1 phiên bản hiện hành + file Excel versioned (không bảng version GĐ1).
3. LSX dùng chung dòng SP với đơn hàng (không nhân bản lines).
4. `warehouses` tạo ngay, UI ẩn tới GĐ3.
5. Duyệt = status trên entity, không bảng approvals riêng.

**Còn ngỏ, không chặn GĐ1** (OI của tài liệu): đa tiền tệ đầy đủ + tỷ giá (OI-02),
công nợ theo đơn/đối tác (OI-01), giá thành theo đơn (OI-05), đồng bộ MISA (OI-07).
