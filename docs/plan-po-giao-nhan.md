# Kế hoạch: NCC xác nhận → Đợt giao → Kho tiếp nhận (khép nửa sau vòng đời PO)

> Soạn 15/08/2026, sau buổi rà quy trình với chủ dự án. Trạng thái: **CHỜ DUYỆT KẾ HOẠCH** — chưa code.

## Bối cảnh & hai sự thật chốt từ chủ dự án

1. **NCC không đăng nhập hệ thống.** Mọi mốc "NCC xác nhận", "NCC báo lịch giao"
   đều do **nhân viên cung ứng nhập thay** sau khi gọi điện/nhắn Zalo với NCC.
   Vậy "NCC xác nhận" trong ERP = một **form ghi lại cam kết** (ai bên NCC hứa,
   hứa giao bao nhiêu, ngày nào, qua kênh nào) — không phải portal, không chờ
   ai bên ngoài bấm gì cả.
2. **Nhận hàng là việc của Kho, tách khỏi Cung ứng.** NCC giao tới cổng → Kho
   kiểm đếm, kiểm chất lượng, lập PNK — Cung ứng chỉ theo dõi và xử lý chênh
   lệch với NCC. Ranh giới này ĐÃ đúng trong code (PNK là chứng từ riêng, tồn
   chỉ tăng khi Kho lập phiếu, BR-08 tự chốt partial/received) — kế hoạch này
   KHÔNG đụng vào ranh giới đó, chỉ nối hai bên bằng "đợt giao".

## Khoảng trống đang có (rà code 15/08/2026)

- `advance('confirmed')` chỉ lật cờ — không lưu NCC cam kết gì. Không đối chiếu
  được "NCC hứa gì / giao gì".
- Cả đơn một ô `expected_at` — không có nhiều đợt giao (gỗ 2.000 kg chia 2 đợt
  19/08 + 22/08 là chuyện thường ngày).
- Kho lập PNK prefill theo `qty_missing` cả đơn — không biết hôm nay NCC chở
  tới ĐỢT nào, bao nhiêu.
- Timeline chi tiết đơn chỉ có 5 mốc duyệt, thiếu nửa sau (gửi NCC → xác nhận
  → từng đợt về → chốt).

## Nguyên tắc thiết kế (giữ, không phá)

- **KHÔNG thêm trạng thái enum mới.** 9 trạng thái hiện có đủ; "chờ giao / đang
  giao / giao một phần" đọc từ dữ liệu đợt + sổ kho. Trạng thái suy được thì
  không lưu cứng (tránh lệch khi dời lịch).
- **BR-05 giữ nguyên** (GĐ duyệt mới gửi NCC), **BR-08 giữ nguyên** (partial/
  received do sổ kho quyết qua `refreshStatusFromReceipts`, không tay).
- **Không ép đợt giao.** NCC giao không báo trước (rất thường) → flow PNK cũ
  chạy y nguyên, `shipment_id` để trống. Đợt giao là công cụ, không phải cửa ải.
- Đơn TOÀN DÒNG TỰ DO (gỗ/gia công — 0134, nghiệm thu ngoài sổ kho): form xác
  nhận chỉ ghi `confirmed_note` + ngày, KHÔNG tạo đợt theo dòng (không có dòng
  sổ kho để nối).

---

## GĐ1 — Ghi nhận "NCC xác nhận" + Đợt giao (migration 0152)

**DB** — `0152_po_shipments.sql` (idempotent, RLS enabled no policies, xong thì sync types):

```sql
-- supply_purchase_orders: thêm 2 cột
confirmed_at   timestamptz   -- mốc NV cung ứng ghi nhận cam kết của NCC
confirmed_note text          -- "chị Hoa bên Nam Kim xác nhận qua Zalo 15/08"

create table supply_po_shipments (
  id            uuid pk default gen_random_uuid(),
  po_id         uuid not null references supply_purchase_orders on delete cascade,
  seq           int  not null,                 -- Đợt 1, Đợt 2… unique (po_id, seq)
  expected_date date not null,
  method        text,                          -- 'NCC giao' | 'Mình lấy' | tự do
  place         text,                          -- mặc định "Kho nguyên vật liệu"
  note          text,
  status        text not null default 'planned'
                check (status in ('planned','arrived','received','cancelled')),
  created_by    uuid references users on delete set null,
  created_at/updated_at timestamptz (trigger set_updated_at)
);

create table supply_po_shipment_lines (
  id          uuid pk,
  shipment_id uuid not null references supply_po_shipments on delete cascade,
  po_line_id  uuid not null references supply_purchase_order_lines on delete cascade,
  qty         numeric(14,2) not null check (qty > 0),
  unique (shipment_id, po_line_id)
);
```

**Service** (`pos.service.ts` + repo mới `po-shipments.repo.ts`):

- `confirmPo(user, poId, input)` — chỉ owner (assertPoOwner) + đơn đang `ordered`.
  Input: `confirmed_note` + `shipments: [{expected_date, note?, lines: [{po_line_id, qty}]}]`.
  Validate: mọi `po_line_id` thuộc đơn; Σqty mỗi dòng qua các đợt **≤ qty_ordered**
  (cho phép NHỎ HƠN — NCC xác nhận hụt là chuyện thật; UI cảnh báo vàng, không chặn).
  Ghi: shipments + patch PO `{status:'confirmed', confirmed_at, confirmed_note,
  expected_at = min(expected_date)}` — đồng bộ `expected_at` để TOÀN BỘ cảnh báo
  trễ hiện có (`assessPoLate`, badge, Hàng sắp về) chạy nguyên không sửa dòng nào.
- `addShipment / updateShipment / cancelShipment(poId, …, reason)` — đơn chưa
  received/cancelled; **dời ngày đợt bắt buộc lý do** (tinh thần `poRescheduleSchema`);
  mỗi lần ghi lại tính lại `expected_at = min(đợt còn sống)`.
- `markShipmentArrived(shipmentId)` — CƯ hoặc Kho bấm khi xe tới cổng → status
  'arrived' + emit `po.shipment.arrived` (handler notify Kho). Tuỳ chọn, không bắt buộc.
- `listShipments(poId)`; `listUpcomingShipments()` (join supplier + PO) cho màn theo dõi.

**Routes mỏng**: `POST /api/dept/supply/pos/[id]/confirm` ·
`GET|POST /api/dept/supply/pos/[id]/shipments` · `PATCH /api/dept/supply/shipments/[id]`.

**UI** (`PoDetailScreen`):

- Nút "NCC xác nhận" (thay cho advance `confirmed` trần) mở dialog:
  bảng dòng đơn [VT | SL đặt | SL xác nhận (mặc định = đặt) | Ngày giao],
  thao tác nhanh "tất cả cùng ngày …", nút "＋ tách đợt" trên từng dòng
  (một dòng 2.000 kg → đợt 1.000/19-08 + 1.000/22-08), ô ghi chú cam kết.
- Sau xác nhận: khối **"Kế hoạch giao"** trên trang chi tiết — mỗi đợt một dòng
  (Đợt N · ngày · x dòng · Σ SL · trạng thái), quá hẹn tô `--stop`, nút dời
  ngày (bắt lý do) / huỷ đợt.
- Màn **Hàng sắp về**: nhóm theo NGÀY CỦA ĐỢT (đơn có đợt), fallback
  `expected_at` (đơn cũ chưa có đợt) — `supply-watch.ts` thêm nguồn đợt, test cập nhật.

**Test**: validate qty vượt/dòng lạ/sai trạng thái; min-date sync expected_at;
huỷ đợt tính lại expected_at; đơn toàn dòng tự do không nhận shipments.

## GĐ2 — Kho tiếp nhận theo đợt (migration 0153, một cột)

**DB**: `warehouse_docs.shipment_id uuid null references supply_po_shipments
on delete set null` — PNK ghi rõ nhận cho đợt nào; null = flow cũ.

**UI** (`DocsManager.ReceiptForm`): chọn PO xong, nếu đơn có đợt
planned/arrived → ô "Đợt giao" (mặc định đợt gần ngày nhất). Chọn đợt thì
prefill `qty = SL của đợt` thay vì `qty_missing` cả đơn (vẫn sửa được theo thực
nhận, vẫn `allow_over` như cũ). Bảng dòng thêm cột đối chiếu: **NCC giao (đợt)
/ Thực nhận / Chênh** — chênh âm tự ghi note dòng `[Thiếu 20 kg so đợt 1]`.

**Service** (`createReceiptDoc`): nhận `shipment_id`, validate đợt thuộc đúng
PO; sau khi ghi movements → đợt sang `received` khi Σ thực nhận ≥ Σ đợt, ngược
lại giữ `arrived` (phần thiếu chờ NCC giao bù — CƯ thấy ngay trên Kế hoạch
giao). **Trạng thái PO vẫn 100% do `refreshStatusFromReceipts`** — GĐ2 không
đổi một dòng nào của BR-08. Event `warehouse.receipt.created` thêm payload
chênh lệch để thông báo cho người phụ trách nói được "về thiếu 20 kg".

**Test**: đợt sai PO bị chặn; nhận đủ → đợt received; nhận thiếu → đợt giữ
arrived; PNK không đợt vẫn chạy như cũ (regression).

## GĐ3 — Timeline PO đủ mốc (không migration)

`poTimeline(poId)` trong service: ghép `approval_events` (5 mốc sẵn) +
`ordered_at` + `confirmed_at` + các đợt (hẹn → arrived → PNK nào nhận) +
`received`. Render thay khối "Lịch sử" ở `PoDetailScreen`: mốc xong ✓, mốc
đang chờ ●, mốc tương lai ○ (đợt chưa tới ngày) — đúng mockup đã chốt.
Dữ liệu đơn cũ (không đợt) tự rơi về timeline ngắn, không cần backfill.

## GĐ4 — "Hoàn tất" & đối chiếu chứng từ (CHỐT SAU, ngoài phạm vi)

Cần quyết với kế toán: hoàn tất = đối chiếu hoá đơn NCC (hệ chưa có hoá đơn
mua) hay chỉ = xác nhận đủ hàng? Chưa quyết thì chưa làm — thêm trạng thái là
việc một chiều, khó rút.

## Thứ tự & luật đi

GĐ1 → GĐ2 → GĐ3, mỗi GĐ `npm run check` sạch + tự dùng được ngay mới sang GĐ
sau (GĐ1 xong là đã trả lời được "NCC hứa gì, đợt nào"; GĐ2 xong Kho nhận theo
đợt; GĐ3 chỉ là cách kể). Migration apply bằng MCP `apply_migration`
(CLI lỗi IPv6 — kinh nghiệm 0120), xong gọi skill sync-types.
