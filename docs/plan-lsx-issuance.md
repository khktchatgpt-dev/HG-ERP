# Kế hoạch: Logic phát Lệnh sản xuất (LSX) — Sales phát, GĐ duyệt, Cung ứng đặt vật tư

> Lập 07/2026. Đã chốt hướng (08/07): **Sales phát LSX → GĐ duyệt → Cung ứng lên
> đơn mua vật tư**. Kế hoạch-sản-xuất chi tiết để giai đoạn sau. Nhiều phần đã
> build; plan này thêm **bước duyệt LSX**, **notify**, **form spec (Sales nhập khi
> phát)** — gộp vào màn hiện có, chưa tách workspace `/production`.

## 0. Quy tắc nền (BR — không đổi)

- **BR-01**: 1 đơn = **1 LSX** (DB `production_orders.sales_order_id UNIQUE`).
- **BR-02**: LSX **dùng chung** `sales_order_lines` (không nhân bản).
- **BR-07**: phát LSX **không cần đủ BOM** — chỉ cảnh báo.
- **BR-11**: truy vết order → LSX → PO → xuất kho.

## 1. Quyết định đã chốt (08/07)

| Câu hỏi | Chốt |
|---|---|
| **Ai phát LSX?** | **Sales** (từ trang chi tiết đơn) — Kế hoạch chi tiết để GĐ sau |
| **Có duyệt LSX?** | **CÓ** — GĐ duyệt LSX ở `/exec`; duyệt xong Cung ứng mới đặt vật tư |
| **Spec LSX (OI-11)** | Mặc định từ `product.tech_spec`; **Sales tinh chỉnh/override khi phát LSX** |
| **Màn LSX** | **Gộp**: phát ở chi tiết đơn · duyệt ở `/exec` · theo dõi ở `/sales/tracking`. Chưa bật `/production` |

## 2. Luồng logic (mới — có duyệt)

```
Đơn [confirmed]
   │  Sales bấm "Phát LSX" (nhập số LSX, ngày, container, tinh chỉnh spec/dòng)
   ▼
LSX [pending_approval]           ← đơn.status = 'lsx_pending'
   • BR-01 unique chặn LSX thứ 2
   • cảnh báo dòng thiếu BOM (BR-07) — không chặn
   • emit 'lsx.submitted' → notify GĐ (chờ duyệt)
   │
   ├─ GĐ [/exec] TỪ CHỐI (kèm lý do) → LSX [rejected], đơn về [confirmed]
   │
   └─ GĐ [/exec] DUYỆT
        ▼
     LSX [approved]              ← đơn.status = 'lsx_issued'
        • approved_by / approved_at
        • emit 'lsx.approved' → notify Cung ứng (đặt vật tư) + Kỹ thuật (BOM)
        ▼
     Cung ứng tạo PO vật tư từ LSX đã duyệt (BR-06) → GĐ duyệt PO (BR-05) → gửi NCC
        ▼
     Cập nhật giai đoạn → LSX [in_progress], đơn [in_production]
        ▼
     Báo hoàn thành → LSX [completed], đơn [completed] → giao hàng
```

**Trạng thái LSX (mới)**: `pending_approval → approved → in_progress → completed`
(+ `rejected`). *(Hiện DB chỉ có `issued/in_progress/completed` → cần migration
nới check + thêm `approved_by/approved_at/rejected_reason`.)*

**Trạng thái đơn liên quan**: `confirmed → lsx_pending → lsx_issued → in_production
→ completed`. *(Thêm `lsx_pending` vào `sales_orders.status`.)*

## 3. Hiện trạng (đã có — tái dùng)

- **DB**: `production_orders` (BR-01 unique, code, ngày, `issued_by/at`, `received_date`, `completed_at`, `note`), `production_progress` (giai đoạn), `production_order_line_specs` (spec per dòng — **có bảng, chưa dùng**).
- **Service**: `productionService.issue/updateStage/complete` — **cần sửa `issue`** để tạo ở trạng thái `pending_approval` (thay vì `issued` ngay) + thêm `approve/reject`.
- **UI**: panel "Phát LSX" ở chi tiết đơn; theo dõi/giai đoạn/hoàn thành ở `/sales/tracking`; in LSX `/print/lsx/[id]` (đã merge tech_spec + override).
- **Downstream**: PO từ LSX (BR-06), xuất kho theo LSX (BR-09), tiến độ (FR-PROD-01) — đã build. **Chỉ cần chốt: PO chỉ tạo được từ LSX `approved`.**

## 4. Việc cần làm

### L1 — Bước duyệt LSX + trạng thái (1–1.5 ngày)
- **Migration**: `production_orders.status` nới check thêm `pending_approval/approved/rejected`; thêm `approved_by/approved_at/rejected_reason`. `sales_orders.status` thêm `lsx_pending`. Partial index `status='pending_approval'` cho màn duyệt GĐ.
- **Service**: `issue` → tạo LSX `pending_approval` + đơn `lsx_pending` (không set `lsx_issued` nữa). Thêm `approveLsx` (GĐ: → `approved` + đơn `lsx_issued`) và `rejectLsx` (→ `rejected` + đơn về `confirmed`, kèm lý do). Quyền: phát = Sales; duyệt = admin/manager (GĐ).
- **Gate Cung ứng**: PO chỉ tạo được khi LSX `approved` (thêm check ở supply service — như BR-05 của PO).
- **Test**: BR-01 trùng, BR-07 không chặn, chỉ GĐ duyệt được, PO chặn khi LSX chưa duyệt.

### L2 — Notify (0.5 ngày)
- Event `lsx.submitted` → notify GĐ (có LSX chờ duyệt); `lsx.approved` → notify Cung ứng + Kỹ thuật; `lsx.rejected` → notify người phát (Sales).
- Handler `lsx.notifications.ts` (mẫu `po.notifications.ts`) + migration notification types.

### L3 — Form spec LSX cho Sales (0.5–1 ngày, OI-11 đã chốt)
- Khi phát LSX, mở bảng dòng SP cho Sales **tinh chỉnh spec** (máy/nệm/sơn/kính/gỗ, đóng gói, shipping mark) — mặc định đổ từ `product.tech_spec`; lưu override vào `production_order_line_specs`. Bản in LSX đã sẵn merge.

### L4 — Màn duyệt GĐ + theo dõi (0.5–1 ngày)
- `/exec`: thêm khối **"LSX chờ duyệt"** (cạnh BG/PO) — duyệt/từ chối tại chỗ, xem dòng SP + cảnh báo BOM trước khi duyệt.
- `/sales/tracking`: hiện thêm trạng thái LSX (chờ duyệt / đã duyệt / đang SX) — cột LSX đã có, chỉ thêm nhãn `pending`.

### L5 — Chốt (0.5 ngày)
- `npm run check`; cập nhật ma trận truy vết (SAL-06 nay có bước duyệt); demo E2E: đơn → Sales phát LSX (spec) → GĐ duyệt → Cung ứng PO → duyệt PO → kho → tiến độ → hoàn thành.

## 5. Thứ tự & tối thiểu

Thứ tự: **L1 → L2 → L4 → L3 → L5**. L1+L4 là lõi (có bước duyệt vận hành được);
L2 (notify) và L3 (spec) nâng cao. Tổng ~3–4 ngày.

## 6. Lưu ý

- Đổi trạng thái là **thay đổi hành vi hiện tại** (đang phát thẳng `issued`). Cần
  migration nới check (non-destructive) + sửa service; đơn cũ `lsx_issued` giữ nguyên.
- Quyền: **Sales phát** (dept Bán Hàng), **GĐ duyệt** (admin/manager). Khác với bản
  hiện tại (đang cho manager phát thẳng) — cập nhật `canIssue`.
- Spec do Sales nhập lúc phát → Sales cần thấy gợi ý `tech_spec` mặc định của SP để đỡ phải nhớ.
