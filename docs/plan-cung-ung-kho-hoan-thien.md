# Kế hoạch: Hoàn thiện nghiệp vụ Cung ứng ↔ Kho (chốt thiếu · dung sai · kiểm kê duyệt · chờ kiểm)

> Soạn 16/08/2026, sau buổi tư vấn nghiệp vụ nhận hàng NCC. Trạng thái: **ĐÃ CHỐT 16/08/2026** — chưa code.
> Tiếp nối `plan-po-giao-nhan.md` (0152/0153 — GĐ1+GĐ2 đã xong) và `plan-kho-redesign.md` (GĐ1 đã xong).
>
> **User đã chốt 4 câu hỏi cuối:** ① chốt thiếu = người phụ trách đơn + admin,
> KHÔNG cần GĐ duyệt; ② dung sai khởi tạo 0% toàn bộ, đặt dần trên UI; ③ kiểm
> kê do quản lý Kho (`warehouse.edit`) duyệt; ④ **GĐ D bỏ đợt này** — QC kiểm
> ngay tại cổng (qty_rejected) là đủ. Phạm vi code: GĐ A + E → B → C.

## Bối cảnh — 4 khoảng trống còn lại sau 0152/0153

Rà chuỗi PO → giao nhận → tồn kho (16/08/2026), phần lõi đã đúng và KHÔNG đụng:
tồn = view từ movements; hai định nghĩa "đã nhận" khác nhau giữa `warehouse_stock`
(BR-10, không cộng QC loại) và `supply_po_line_status` (BR-08, cộng QC loại) là
CHỦ ĐÍCH; đợt giao không đụng tồn; chặn nhận vượt có đường thoát `allow_over`;
RBAC đã tách người mua khỏi người nhận (`warehouse.stock.write` chỉ Kho).

Còn 4 lỗ theo mức đau thực tế:

1. **Không có đường "chốt phần thiếu".** NCC giao 98/100 rồi báo "hết hàng,
   không giao nữa" → đơn kẹt `partial` vĩnh viễn: `refreshStatusFromReceipts`
   đòi mọi dòng `qty_missing ≤ 0`, nút "Đã về đủ" (`advance('received')`) cũng
   chặn khi còn dòng kho thiếu (pos.service.ts:447). Hệ quả dây chuyền: đơn
   rác ở "Hàng sắp về" + `/warehouse/nhap`, suggest mua thấy "đã đặt" ảo nên
   KHÔNG giục mua phần NCC đã bỏ → thiếu vật tư thật.
2. **Dung sai = 0.** Gỗ/kính/tôn lệch ±3–5% là chuyện thường, nhưng nhận vượt
   0,1% cũng bắt `allow_over` + lý do → người dùng học cách gõ lý do bừa, cờ
   mất giá trị cảnh báo.
3. **Kiểm kê không có duyệt** (GĐ2 plan-kho-redesign, user đã yêu cầu):
   `createStocktakeDoc` ghi movements điều chỉnh NGAY khi nhân viên lập biên
   bản — không ai gác chênh lệch.
4. **Hàng chưa kiểm đứng chung tồn khả dụng.** PNK ghi `qty` đạt là vào tồn
   ngay; nhóm hàng giá trị cao (kính, nhôm sơn) cần trạng thái "chờ kiểm"
   trước khi cấp cho sản xuất.

## Nguyên tắc thiết kế (giữ, không phá)

- **BR-08 giữ nguyên chủ quyền**: sổ kho quyết phần đã về; "chốt thiếu" chỉ là
  Cung ứng tuyên bố *phần còn lại không về nữa* — không sửa số đã nhận.
- **Không thêm trạng thái PO mới.** `partial → received` vẫn do
  `refreshStatusFromReceipts` quyết; chốt thiếu chỉ đổi cách TÍNH "đủ".
- **Không lot/serial/QR** (backlog đã chốt không làm). "Chờ kiểm" thiết kế
  không cần lô — treo theo dòng phiếu nhập.
- **Mọi ngoại lệ phải có người + lý do + dấu vết** (cùng lối `allow_over`,
  `override_reserved`, reschedule đợt giao).
- View sửa bằng `create or replace` + `security_invoker = on`; bảng mới RLS
  enabled no policies; migration idempotent.

---

## GĐ A — Chốt phần thiếu (migration 0154) — ✅ XONG 16/08/2026 (kèm 0155 vá notification type; đã apply remote + test tích hợp DB thật; GĐ E cũng xong trừ dọn PO-TEST-SHIP chờ user bấm thử xong)

**Nghiệp vụ.** Quyết định "phần thiếu này thôi, không chờ nữa" là của **Cung
ứng** (người phụ trách đơn — cùng luật khoá 0128), không phải Kho. Chốt xong:
đơn được phép sang `received`, số "đã đặt" ảo biến mất khỏi suggest mua (nếu
vẫn cần thì hệ tự giục mua lại — hành vi ĐÚNG), đơn rời "Hàng sắp về" và
`/warehouse/nhap`.

**DB — `0154_po_line_close_short.sql`:**

```sql
-- supply_purchase_order_lines: thêm 3 cột (mặc định null = dòng còn mở)
closed_short_at     timestamptz,  -- mốc Cung ứng chốt "phần thiếu không giao nữa"
closed_short_by     uuid references users on delete set null,
closed_short_reason text          -- bắt buộc khi chốt ("NCC hết hàng, mua chỗ khác")
```

View `supply_po_line_status` (create or replace, giữ nguyên các cột cũ):

```sql
-- thêm 2 cột, KHÔNG đổi nghĩa qty_missing (số thiếu THẬT vẫn cần cho đối chiếu)
closed_short_at,
greatest(case when closed_short_at is not null then 0 else qty_missing end, 0) as qty_open
-- qty_open = phần còn CHỜ VỀ. Mọi chỗ đang hỏi "còn chờ bao nhiêu" chuyển sang qty_open;
-- chỗ hỏi "thiếu so đặt bao nhiêu" (đối chiếu, in ấn) giữ qty_missing.
```

**Service (`pos.service.ts`):**

- `closeLineShort(user, poId, lineId, reason)` + `reopenLine(user, poId, lineId)`:
  `assertAction('supply.po.manage')` + `assertPoOwner`; chỉ khi PO
  `partial|confirmed|in_transit|ordered` và dòng có `qty_open > 0`; reason bắt
  buộc khi chốt. Reopen chỉ khi PO chưa `received` (đã received mà muốn mở lại
  → đơn tự quay `partial` qua refresh, chấp nhận). Sau mỗi lần gọi →
  `refreshStatusFromReceipts(poId)` để trạng thái đơn tự hội tụ.
- `closePoShort(user, poId, reason)` — tiện tay: chốt MỌI dòng kho còn
  `qty_open > 0` một phát (loop gọi cùng logic, một reason chung).
- **Đổi cách tính "đủ" ở 3 chỗ** (cùng luật "closed = coi như xong"):
  - `refreshStatusFromReceipts`: dòng đủ khi `qty_open ≤ EPS` (thay vì
    `qty_missing ≤ 0`). Đơn có nhận ≥1 movement + mọi dòng kho `qty_open ≤ EPS`
    → `received`.
  - `advance('received')` guard (pos.service.ts:449): lọc `qty_open` thay
    `qty_missing` — đơn hỗn hợp đã chốt thiếu phần kho thì nghiệm thu phần tự
    do được.
  - `orderedPendingByLsxSet` / route needs (audit 16/08): "đã đặt" đọc
    `qty_open` — dòng chốt thiếu KHÔNG còn đè lên đề xuất mua.
- **Đồng bộ đợt giao**: khi chốt thiếu, các đợt `planned` chỉ còn chứa dòng đã
  chốt → tự `cancelled` với note `[Chốt thiếu]`; đợt lẫn dòng khác giữ nguyên
  (cảnh báo ở UI). `syncExpectedAt` chạy lại.
- **Notification**: emit event `po.closed_short` → notify Kho (nhóm
  warehouse) + GĐ nếu đơn từng quá hẹn — Kho biết đường ngừng chờ.

**UI (`PoDetailScreen` + bảng dòng):**

- Mỗi dòng kho còn thiếu (PO từ `ordered` trở đi): action ⋯ → "Chốt phần thiếu
  (X đv không giao nữa)" → dialog bắt lý do. Dòng đã chốt: badge tím nhạt
  "Đã chốt thiếu 2" + tooltip lý do/người/mốc + action "Mở lại".
- Header đơn `partial`: nút phụ "Chốt đơn — phần thiếu không giao nữa"
  (closePoShort) cạnh nút "Đã nhận đủ (nghiệm thu)" hiện có.
- `/warehouse/nhap` + PoShipmentsCard: dòng/đợt đã chốt tự biến mất (đọc
  `qty_open`) — không cần sửa gì thêm ngoài đổi cột nguồn.
- ReceiptForm prefill: `min(SL đợt, qty_open)` — đã chốt thì không gợi nhận.

**Test (bắt buộc — tiền/tồn):** pos.service — chốt 1 dòng → refresh ra
`received`; chốt rồi NCC vẫn giao (PNK ghi được, qty_open âm kẹp 0, đơn giữ
`received`); reopen → quay `partial`; suggest mua hết đè sau chốt
(orderedPendingByLsxSet); đơn hỗn hợp chốt phần kho + nghiệm thu tự do.

**Khối lượng:** ~1 buổi. Migration nhỏ + sửa 1 view + 5 điểm service + UI dialog.

---

## GĐ B — Dung sai nhận hàng theo vật tư — ✅ XONG 16/08/2026 (migration thực tế 0156, đã apply remote)

**Nghiệp vụ.** Dưới ngưỡng dung sai → nhận vượt KHÔNG cần `allow_over` + lý do;
vượt ngưỡng → giữ nguyên cổng 409 hiện có. Ngưỡng đặt **trên từng vật tư**
(default 0%) — hợp triết lý "nhóm là text tự do, đừng FK" (memory
free-text-over-fk): gán theo nhóm chỉ là thao tác bulk trên UI, không phải
ràng buộc DB.

**DB — `0155_material_qty_tolerance.sql`:**

```sql
-- warehouse_materials: dung sai nhận vượt, % trên SL đặt của DÒNG PO. 0 = chặt như cũ.
alter table warehouse_materials add column if not exists
  over_tolerance_pct numeric(5,2) not null default 0
  check (over_tolerance_pct >= 0 and over_tolerance_pct <= 20);
```

**Logic (`lib/po-receipt.ts` — thuần, test được):**

- `checkReceiptAgainstPo` nhận thêm `tolerancePctByMaterial`; ngưỡng dòng =
  `qty_ordered × (1 + pct/100) + EPS`. Kết quả phân 2 bậc:
  `within_tolerance` (cho qua, tự ghi note dòng `[Vượt 1,8% trong dung sai]`)
  và `over` (409 như cũ).
- Nhận THIẾU không đổi — thiếu là chuyện của GĐ A, không phải dung sai.

**UI:**

- MaterialsManager: cột/ô "Dung sai nhận (%)" — quyền sửa cùng nhóm trường
  purchasing (`warehouse.material.update_purchasing` — Cung ứng và Kho đều
  đặt được). Toolbar: chọn nhiều dòng theo nhóm → "Đặt dung sai chung".
- ReceiptForm: dòng vượt-trong-dung-sai hiện chip vàng nhạt "vượt 1,8%"
  thay vì chặn.

**Test:** po-receipt — biên đúng ngưỡng, vượt 1 đv trên ngưỡng, pct=0 giữ
hành vi cũ nguyên vẹn (regression).

**Khối lượng:** ~nửa buổi.

---

## GĐ C — Kiểm kê có duyệt — ✅ XONG 16/08/2026 (migration thực tế 0157 + 0158 notify types, đã apply remote + test tích hợp DB thật; kèm in 05-VT)

**Nghiệp vụ.** Nhân viên đếm và lập biên bản → tồn CHƯA đổi. Quản lý Kho xem
bảng chênh lệch → duyệt thì tồn mới điều chỉnh; từ chối thì biên bản đóng,
không đụng gì.

**DB — `0156_stocktake_approval.sql`:**

```sql
-- warehouse_docs: vòng duyệt cho kind='stocktake'. Phiếu cũ backfill 'posted'
-- (đã điều chỉnh rồi — sự thật lịch sử, không đụng).
alter table warehouse_docs add column if not exists status text not null default 'posted'
  check (status in ('pending','posted','rejected'));
alter table warehouse_docs add column if not exists approved_by uuid references users on delete set null;
alter table warehouse_docs add column if not exists approved_at timestamptz;
alter table warehouse_docs add column if not exists reject_reason text;
```

(receipt/issue/transfer giữ default `posted` — KHÔNG kéo duyệt vào phiếu
nhập/xuất, chỉ kiểm kê.)

**Service (`stock.service.ts`):**

- `createStocktakeDoc`: tách làm hai — lập doc `status='pending'` + lines ghi
  **số đếm thực tế + tồn hệ thống TẠI LÚC ĐẾM** (snapshot vào line, vì tồn
  trôi trong lúc chờ duyệt), KHÔNG insert movements.
- `approveStocktake(user, docId)`: `assertAction('warehouse.stocktake.approve')`
  (action mới — rule `memberEdit('warehouse.member','warehouse.edit')`, tức
  quản lý/người có quyền edit Kho; nhân viên chỉ lập). Chênh áp = `số đếm −
  tồn HIỆN TẠI lúc duyệt` (không phải snapshot — áp số đếm như sự thật tuyệt
  đối, chuẩn kiểm kê; snapshot chỉ để đối chiếu trên UI "lúc đếm lệch bao
  nhiêu, giờ lệch bao nhiêu"). Insert movements điều chỉnh → `posted`.
  Người lập ≠ người duyệt (chặn tự duyệt, trừ admin).
- `rejectStocktake(user, docId, reason)` → `rejected`, bắt lý do.
- Notification: lập → notify người có quyền duyệt; duyệt/từ chối → notify
  người lập.

**UI:** DocsManager tab Kiểm kê: badge `Chờ duyệt/Đã áp/Từ chối`; màn chi tiết
biên bản pending hiện bảng 3 cột (tồn lúc đếm / số đếm / tồn hiện tại) + nút
Duyệt-áp / Từ chối. `/warehouse` dashboard: ô "Biên bản chờ duyệt".

**Test:** lập không đổi tồn; duyệt áp đúng delta theo tồn-lúc-duyệt (có
movement chen giữa); tự duyệt bị chặn; reject không đụng tồn; phiếu cũ
backfill posted không double-apply.

**Khối lượng:** ~1 buổi.

---

## GĐ D — "Chờ kiểm" cho nhóm hàng chỉ định (migration 0157) — **BỎ ĐỢT NÀY** (user chốt 16/08: QC kiểm ngay tại cổng là đủ; giữ thiết kế phòng sau)

**Nghiệp vụ.** Vật tư gắn cờ `qc_required` (kính, nhôm sơn…): PNK nhập xong
hàng VÀO TỒN nhưng bị TREO — không tính vào khả dụng, không xuất được — đến
khi QC xác nhận. Thiết kế **không cần lot**: treo theo dòng phiếu nhập.

```sql
-- warehouse_materials
alter table warehouse_materials add column if not exists qc_required boolean not null default false;
-- warehouse_doc_lines (dòng PNK): null = không cần kiểm / đã kiểm xong
alter table warehouse_doc_lines add column if not exists qc_hold_qty numeric,      -- SL đang treo
alter table warehouse_doc_lines add column if not exists qc_released_by uuid references users on delete set null,
alter table warehouse_doc_lines add column if not exists qc_released_at timestamptz;
```

- `createReceiptDoc`: material `qc_required` → set `qc_hold_qty = qty`.
- **Khả dụng** = tồn − đặt trước (LSX) − **Σ qc_hold_qty còn treo** (cộng vào
  `computeReservedByMaterial` hoặc một hàm hold riêng — cùng chỗ guard xuất
  `RESERVED_CONFLICT` hiện có, nên phiếu xuất tự chặn không cần code thêm).
- `releaseQcHold(user, docLineId, {pass_qty, fail_qty, note})`: pass → hết
  treo; fail → gợi ý mở form **phiếu trả NCC** có sẵn (0080) với SL fail —
  KHÔNG tự động trả, người quyết.
- UI: `/warehouse/nhap` thêm khối "Chờ QC xác nhận"; MaterialsManager cột cờ
  `qc_required` (quyền như dung sai).

**Đánh dấu rõ:** chỉ đáng làm nếu user chốt được DANH SÁCH nhóm cần kiểm. Nếu
thực tế QC kiểm ngay lúc nhận (đã phản ánh bằng `qty_rejected` trên PNK) thì
GĐ này **bỏ** — đừng làm vì "cho đủ".

**Khối lượng:** ~1 buổi.

---

## GĐ E — Việc lẻ trả nợ (không migration, gộp làm cùng GĐ A)

- [ ] Nhãn movement trả NCC: `direction=out && ref_type=po` hiện "Trả NCC"
      thay vì "Theo đơn đặt · ↓ Xuất" (StockManager `MovementHistory` +
      DocsManager `DocDetail`) — nợ từ backlog 23/07.
- [ ] Unit test `createReturnDoc` (nợ cùng đợt).
- [ ] Dọn 4 đơn test `PO-TEST-SHIP1..4` + PNK test sau khi user bấm thử xong
      (lệnh dọn trong memory po-giao-nhan-0152).

## Thứ tự làm & cổng nghiệm thu

| Bước | Việc | Điều kiện xong |
|---|---|---|
| 1 | GĐ A + GĐ E | `npm run check` sạch; test tích hợp DB thật kiểu `scratch-*.integration.test.ts` (0152 đã dùng): đơn partial → chốt thiếu → received → suggest mua giục lại đúng |
| 2 | GĐ B | regression pct=0 nguyên hành vi cũ |
| 3 | GĐ C | biên bản pending không đổi tồn; duyệt mới áp |
| ~~4~~ | ~~GĐ D~~ | BỎ đợt này (user chốt 16/08) |

Mỗi bước một migration riêng (0154 → 0156), apply xong chạy skill sync-types.

## Quyết định đã chốt (user trả lời 16/08/2026)

1. **Ai được chốt thiếu?** Người phụ trách đơn (luật 0128) + admin, chốt
   thẳng — KHÔNG qua cổng duyệt GĐ theo giá trị.
2. **Dung sai mặc định**: 0% toàn bộ, Cung ứng/Kho tự đặt dần theo nhóm trên
   UI (bulk-set). Không backfill trong migration.
3. **Kiểm kê — ai duyệt?** Người có `warehouse.edit` (quản lý Kho); chặn tự
   duyệt biên bản mình lập (trừ admin). Không kéo lên Approval Center.
4. **GĐ D**: bỏ đợt này — QC kiểm ngay tại cổng (`qty_rejected` trên PNK) là
   đủ với thực tế hiện nay. Thiết kế giữ trong doc phòng khi cần.
