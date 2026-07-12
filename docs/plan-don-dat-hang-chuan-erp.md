# Kế hoạch: Nâng Đơn đặt hàng (PO) lên chuẩn ERP — Cung ứng ↔ Kho ↔ Giá vốn

> **Trạng thái:** Đề xuất (chờ duyệt) · Lập 12/07/2026 · Đối tượng: Đội phát triển
> Nối tiếp [thiết kế item master ERP](thiet-ke-item-master-erp.md) (migration 0042–0045 đã
> tạo, **chưa apply**). Ước lượng: ~4–5 ngày, 5 phase. Mỗi phase khép kín, xanh test rồi mới sang phase sau.

## Mục tiêu

Đưa đơn đặt hàng từ "sổ mua thủ công" lên chuẩn ERP với 3 tính chất còn thiếu:

1. **Đối chiếu tồn kho khi lập đơn** — người mua thấy *tồn hiện có / cần cho LSX / đã đặt* để không
   đặt thừa/thiếu (gap chính user nêu 12/07).
2. **Đơn vị & quy đổi chuẩn** — thay "chữa cháy" `qty2/unit2` bằng `item_uom` (mua kg, tồn cây tự quy đổi).
3. **Giá vốn liên thông** — `unit_price` trên dòng PO chảy vào tồn kho theo FIFO khi nhập → tính được
   **giá trị tồn** và **giá thành LSX**.

## Nguyên tắc (giữ nguyên nghiệp vụ đã chốt)

- **BR-06 bất biến:** 1 PO = **1 NCC + 1 LSX**, nhiều dòng vật tư. Không đổi.
- **Tồn kho chỉ đổi khi Kho nhập/xuất** — tạo PO KHÔNG giữ chỗ (reserve) tồn. Đối chiếu tồn ở màn tạo
  đơn là **thông tin trợ giúp**, không phải bút toán.
- **Không phá dữ liệu/luồng cũ:** cột mới nullable, view mới, service mở rộng — PO cũ chạy nguyên.
- **FIFO** (đã chốt), **không** lô/hạn dùng vật lý.

## Đã có sẵn (nối vào, không xây lại)

| Thành phần | Dùng cho |
|------------|----------|
| `warehouse_stock` (view tồn realtime) | "Tồn hiện có" |
| `smartLsxNeeds()` (BOM/components × SL − đã xuất) | "Cần cho LSX" |
| PO mở của 1 LSX (`supply_purchase_orders` where status ∈ RECEIVABLE) | "Đã đặt" |
| `supply_po_line_status` (đặt/đã nhận/còn thiếu) | Theo dõi sau đặt |
| `item_uom`, `stock_cost_layers`, `fifo_receipt/issue` (0044–0045) | Quy đổi + giá vốn |
| `warehouse_materials.default_supplier_id`, `reorder_point` (0043) | Gợi ý NCC + điểm đặt |

---

## P0 — Nền item master (chặn các phase sau) · ~1 ngày

**Điều kiện tiên quyết:** apply + sync types cho migration item master.

1. `npx supabase db push` (0042→0045 theo thứ tự) hoặc SQL editor.
2. **Sync types** → regen `src/lib/database.types.ts`.
3. Wire code master vật tư (giờ types đã có cột mới):
   - `warehouse.schema.ts`: thêm field ERP (item_type, category_id, spec, dims, weight, attributes,
     costing, reorder, supplier, vat).
   - `warehouse.repo.ts`: mở rộng `COLS`; lọc theo `category_id`/`item_type`.
   - `item_uom` repo/service tối thiểu (CRUD dòng quy đổi cho 1 vật tư).
   - UI ProductsManager vật tư: form thêm các nhóm trường mới (gộp nhóm, ẩn/hiện theo item_type).
4. Test: zod schema mới, quy đổi UoM thuần (`toBase(qty, unit)`).

**Ra khỏi phase:** danh mục vật tư đã chuẩn ERP, có UoM; chưa đụng PO.

---

## P1 — PO đối chiếu tồn kho · ~1.5 ngày ⭐ (yêu cầu chính)

> **🔄 PIVOT THIẾT KẾ 13/07/2026 (user chốt).** Bản đề xuất tự động (kéo "cần" từ
> bảng chi tiết/BOM của phòng Kế hoạch) bị đánh giá **quá phức tạp & rối** — số
> "cần" đến từ dữ liệu phòng khác như hộp đen. **Thực tế:** Cung ứng tự đọc file
> BOM, tự tìm vật tư cần mua; hệ thống chỉ cần **hiện tồn kho** và cho **gõ số
> lượng**. Vẫn giữ BR-06 (1 đơn = 1 NCC + 1 LSX).
>
> **Thiết kế mới (đang chạy):**
> - **Trang tạo riêng** `/planning/pos/new` (không dùng modal chật).
> - **Tìm vật tư** (search theo mã/tên) → chọn → tự điền **tồn kho + ĐVT**; người
>   mua chỉ gõ **số lượng đặt** + đơn giá. Cột: Vật tư | Tồn kho | ĐVT | SL đặt | Đơn giá.
> - **Bỏ** panel đề xuất tự động khỏi luồng tạo; modal Sửa/Nhân bản giữ nguyên tạm.
> - Files: `new/PoCreateForm.tsx` + `new/page.tsx` (nạp vật tư kèm on_hand từ
>   `stockRepo.list`); nút "+ Tạo đơn đặt" ở `PosManager` → link sang trang mới.
> - typecheck/lint sạch, 286 test xanh.
>
> **Giữ lại từ bản trước (không dùng ở luồng tạo, có thể tái dùng sau):**
> `suggestForMaterial`/`suggestPurchase` (`src/lib/po-suggestion.ts`, 8 test),
> `uom.ts`, `reservedByOtherLsx`, `supplyRepo.orderedPendingByLsx`, enrich endpoint
> `needs`. Không xoá vội — có thể thành tính năng gợi ý *tuỳ chọn* về sau.

Mục tiêu: khi thêm dòng vật tư trong màn tạo/sửa PO, hiển thị bảng đối chiếu và **đề xuất SL mua**.

**Quyết định chốt (user 12/07/2026): Cách 2 — tồn khả dụng trừ phần LSX khác đã giữ chỗ.**
Nguyên tắc "đã cam kết" = **sau cổng duyệt Giám đốc** (cả LSX lẫn PO đều do GĐ duyệt):
- LSX khác chỉ giữ chỗ tồn khi ở `approved` | `in_progress` (đã qua duyệt). `pending_approval` → không.
- PO chỉ tính "đã đặt" khi ở `approved | ordered | confirmed | in_transit | partial`. `pending_approval`
  (chờ GĐ) → **không trừ**, chỉ hiện cột "Chờ duyệt" để cảnh báo tránh đặt trùng.
- Bảo thủ: **không** trừ hàng đang về của LSX khác → thà đặt dư nhẹ còn hơn xưởng đói vật tư.
  (Trùng đúng tập trạng thái được phép xuất kho ở `stock.service` — nhất quán, không đẻ khái niệm mới.)

**Công thức đề xuất (thuần, có test):**
```
tồn_khả_dụng = max( tồn_thực − Σ(nhu cầu còn lại LSX khác [approved|in_progress]) , 0 )
đã_đặt       = Σ(qty_ordered − qty_received) PO [approved|ordered|confirmed|in_transit|partial] của LSX này
đề_xuất_mua  = max( cần_LSX_này − tồn_khả_dụng − đã_đặt , 0 )
chờ_duyệt    = Σ qty_ordered PO [pending_approval] của LSX này   → chỉ cảnh báo, KHÔNG trừ
```
- `cần_LSX_này`  ← `smartLsxNeeds(production_order_id)` theo vật tư.
- `tồn_thực`     ← `warehouse_stock.on_hand`.
- `nhu cầu LSX khác` ← `smartLsxNeeds` của mọi LSX `approved|in_progress` khác (gộp theo vật tư).
- `đã_đặt`/`chờ_duyệt` ← `supply_po_line_status` × trạng thái PO, loại chính PO đang sửa.

**Việc làm:**
1. `src/lib/po-suggestion.ts` — hàm thuần gộp các nguồn → `{ material_id, needed, on_hand, reserved_others, available, ordered, pending, suggest }`. **Test** kỹ (đủ/thiếu/thừa/không nhu cầu/nhiều LSX tranh tồn/PO chờ duyệt).
2. Repo `posRepo.materialContext(production_order_id, exclude_po_id?)` — trả tồn + cần + nhu cầu LSX khác + đã đặt + chờ duyệt cho mọi vật tư của LSX (truy vấn gộp, không N+1).
3. Route `GET /api/dept/supply/pos/context?lsx=…` (guard `isSupplyStaff`).
4. UI form PO (`PosManager`): cột **Tồn khả dụng | Cần | Đã đặt | Chờ duyệt | Đề xuất**; nút "Điền theo đề xuất" đổ `qty_ordered = suggest`; cảnh báo dòng đặt vượt hoặc đã có PO chờ duyệt cùng vật tư.
5. Không chặn cứng — người mua vẫn quyết (đặt gộp, mua dự phòng). Chỉ **cảnh báo màu**.

**Ra khỏi phase:** lập PO thấy tồn khả dụng thật (đã trừ phần LSX khác giữ chỗ), một cú click điền đề xuất, cảnh báo PO trùng chờ duyệt; hết cảnh đặt thiếu khi nhiều LSX chia nhau kho.

---

## P2 — Đơn vị & quy đổi vào PO (thay qty2/unit2) · ~1 ngày

Hiện dòng PO nhập tay 2 đơn vị (`qty2/unit2` — cây↔kg). Thay bằng `item_uom`.

1. Form PO: chọn **đơn vị đặt** từ `item_uom` của vật tư (role purchase/alt); nhập SL theo đơn vị đó.
   Service quy về `base_unit`: `qty_base = qty_input × to_base`.
2. Lưu `qty_ordered` theo **base_unit** (nhất quán với tồn) + giữ `order_unit`/`order_qty` để in đúng
   cách NCC bán (thêm 2 cột nullable — migration nhỏ `0046_po_line_order_uom.sql`).
3. `qty2/unit2` giữ lại (deprecated, backward-compat), ngừng bắt nhập tay.
4. Nhập kho (P3) cũng dùng cùng cơ chế → đối chiếu đặt/nhận cùng base_unit, hết lệch đơn vị.
5. Test: quy đổi + đối chiếu qty_missing khi mua kg / nhận cây.

**Ra khỏi phase:** mua theo đơn vị NCC, hệ thống tự quy về đơn vị tồn — không nhập tay 2 số.

---

## P3 — Giá vốn FIFO liên thông (unit_price → tồn) · ~1 ngày

Nối `unit_price` PO vào giá vốn tồn kho khi Kho nhập.

1. `stock.service.createReceiptDoc`: mỗi dòng nhập theo PO → lấy `unit_price` từ `supply_purchase_order_lines`
   → gọi **`fifo_receipt(material_id, movement_id, qty, unit_price)`** tạo lớp giá.
   - Nhập mua ngoài (không PO): nhập `unit_cost` tay trên form.
2. `stock.service.createIssueDoc`: mỗi dòng xuất → **`fifo_issue(...)`** trừ lớp giá cũ nhất, ghi
   `total_cost` vào movement (giá vốn xuất).
3. Màn giá trị tồn: route + UI đọc `v_stock_valuation` (SL tồn, giá trị, giá vốn bình quân).
4. Giá thành LSX: tổng `total_cost` các movement `out` của `production_order_id` = chi phí vật tư LSX.
5. Test: FIFO nhiều lớp (nhập 2 giá → xuất bắc cầu 2 lớp → giá vốn đúng); tồn thiếu lớp → giá 0.

**Ra khỏi phase:** biết **giá trị tồn kho** và **chi phí vật tư từng LSX** — điều ERP bắt buộc.

---

## P4 — Ghi phiếu atomic (RPC transaction) · ~0.5 ngày

Vá rủi ro tồn đọng: hiện PO (`insert` header → `replaceLines`) và phiếu kho (`insert doc` →
`insertMovements` → cost layer) là **nhiều lệnh rời**, không atomic; guard tồn có **race**.

1. Chuyển ghi PO sang RPC `create_po(header jsonb, lines jsonb)` — 1 transaction.
2. Chuyển ghi phiếu nhập/xuất sang RPC `record_stock_doc(...)` bọc: insert doc + movements +
   fifo_receipt/issue, khóa `for update` lớp giá & tồn.
3. Giữ chữ ký service không đổi (chỉ đổi bên trong repo) → UI/route không sửa.
4. Test: xuất song song không vượt tồn; lỗi giữa chừng → rollback sạch (không phiếu rỗng).

**Ra khỏi phase:** không còn phiếu/đơn mồ côi; xuất kho an toàn dưới tải đồng thời.

---

## Migration phát sinh (ngoài 0042–0045 đã tạo)

| File | Nội dung | Phase |
|------|----------|-------|
| `0046_po_line_order_uom.sql` | `supply_purchase_order_lines` thêm `order_unit`,`order_qty` (đơn vị NCC) | P2 |
| `0047_stock_write_rpc.sql` | RPC `create_po`, `record_stock_doc` (atomic) | P4 |

RLS: cột thêm không đổi posture; RPC là function (server secret key gọi). Sau mỗi migration **sync types**.

## Ngoài phạm vi (giai đoạn sau)

- Giữ chỗ tồn (reservation/allocation) khi tạo LSX/PO.
- Nhiều kho / điều chuyển liên kho trong đề xuất mua.
- Duyệt mua nhiều mức theo hạn mức tiền.
- Lô/hạn dùng (đã chốt không làm).

## Câu hỏi chốt trước khi bắt đầu

1. ✅ **Đã chốt (12/07):** đề xuất mua theo **Cách 2** — tồn khả dụng trừ nhu cầu còn lại của LSX khác;
   "đã cam kết" = sau cổng duyệt GĐ (LSX `approved|in_progress`, PO `approved`→`partial`). Xem P1.
2. ✅ **Đã chốt (12/07):** không trừ hàng đang về của LSX khác (bảo thủ, tránh đặt thiếu); PO
   `pending_approval` chỉ cảnh báo, không trừ.
3. ⏳ Nhập mua ngoài (không PO): nhập `unit_cost` tay bắt buộc hay cho để trống (giá 0)? (đề xuất:
   khuyến khích nhập, không bắt buộc).
