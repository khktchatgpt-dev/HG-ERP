# Quy trình logic: LSX → Cung ứng kiểm tồn → Đơn NCC → Hàng về → Nhập kho → Xuất cho SX

> Soạn 16/08/2026 — tài liệu ĐỐI CHIẾU CODE THẬT (không phải đặc tả mơ ước): mỗi mục ghi
> rõ luật đang chạy, file nguồn, và phần cuối là KẾ HOẠCH cho từng phần.
> Bổ trợ: `plan-cung-ung-kho-hoan-thien.md` (GĐ A đã xong), `plan-kho-redesign.md`,
> `plan-po-giao-nhan.md`, `supply-warehouse-backlog.md`.

## 0. Xương sống — 4 nguyên tắc bất biến

1. **Tồn kho = VIEW từ movements** (`warehouse_stock`, 0010). Không ai "gõ số tồn";
   kho chỉ xác nhận biến động (phiếu nhập/xuất/điều chỉnh). Mọi con số dẫn xuất
   (đã về, khả dụng, đã đặt) đều tính lại từ sổ — không lưu cứng, không lệch.
2. **Mỗi việc một chủ quyền**: Kỹ thuật giữ định mức (hồ sơ SP), Sản xuất giữ
   LSX, Cung ứng giữ đơn NCC + quyết phần thiếu, **Kho giữ số thực nhận** (BR-08),
   GĐ giữ cổng duyệt (BR-05). RBAC tách người mua khỏi người nhận:
   `warehouse.stock.write` chỉ Kho (`actions.ts:313`).
3. **Trạng thái suy được thì không lưu cứng**: PO `partial/received` do
   `refreshStatusFromReceipts` tính từ view; đợt giao chỉ là kế hoạch, không đụng tồn.
4. **Mọi ngoại lệ có người + lý do + dấu vết**: nhận vượt (`allow_over`), xuất lấn
   giữ chỗ (`override_reserved`), dời hẹn, huỷ đợt, chốt thiếu (0154) — cùng một khuôn:
   mặc định chặn, xác nhận kèm lý do thì đi tiếp và ghi vết vào note/notification.

Chuỗi tổng (mỗi ô là một mục bên dưới):

```
[1] LSX duyệt ──▶ [2] Nhu cầu vật tư ──▶ [3] Kiểm tồn + đề xuất mua ──▶ [4] Đơn NCC (duyệt → gửi)
                                                                              │
[7] Xuất kho cho SX ◀── [6] Nhập kho PNK ◀── [5] Hàng về (đợt giao, QC, lệch) ◀┘
        │
        └──▶ Sản xuất (chuyển giao tổ, backflush — ngoài phạm vi tài liệu này)
```

---

## 1. LSX phát lệnh — cổng vào của chuỗi

**Luật đang chạy** (`production` module):

- LSX có vòng đời `draft → pending_approval → approved → in_progress → done/cancelled`.
  **Cổng ký GĐ là ranh giới cứng**: trước `approved` không được đặt vật tư
  (`pos.service.create` chặn LSX chưa duyệt), không giữ chỗ tồn, không xuất kho.
- Một đơn NCC gộp được nhiều LSX (0125 — `supply_po_extra_lsx`, "LSX 01+2+3/26-27").
- LSX snapshot BOM lúc phát lệnh (0142 `lsx_bom_snapshot`) — hồ sơ SP đổi sau đó
  không làm lệnh đang chạy đổi định mức ngầm.

## 2. Nhu cầu vật tư của lệnh — `smartLsxNeeds`

**Nguồn** (`stock.service.ts:59`, ưu tiên từ trên xuống):

1. **Bảng chi tiết nhập tay** (`production_order_components`) — người kế hoạch khai
   từng chi tiết: qty ưu tiên **số cây** (có hệ số cắt) → **kg** → số chi tiết.
2. Fallback: **BOM × SL đơn** (view `lsx_needs` từ định mức hồ sơ SP — xem
   `dinh-muc-o-ho-so-sp`: định mức theo SP, không theo LSX).

**Công thức**: `qty_remaining = max(qty_needed − qty_issued, 0)` — đã xuất đọc từ
movements gắn `production_order_id`. Cờ `incomplete` = định mức chưa khai đủ, hiển
thị cảnh báo, **không chặn** (người mua tự quyết — nguyên tắc "suggest là đề xuất").

## 3. Cung ứng kiểm tồn + đề xuất mua — route `/api/dept/supply/needs`

**Công thức lõi** (mỗi vật tư của bộ lệnh):

```
suggest = max( cần_còn_lại − khả_dụng − đã_đặt , 0 )

cần_còn_lại = Σ qty_remaining của CẢ BỘ lệnh (chính + extra 0125), gộp server-side
khả_dụng    = on_hand − reserved_others
              reserved_others = Σ nhu cầu còn lại của LSX KHÁC đã cam kết
              (approved|in_progress; loại CẢ BỘ lệnh đang tính khỏi giữ chỗ —
              không tự giữ chống chính mình)
đã_đặt      = Σ qty_open các PO RECEIVABLE của cả bộ (orderedPendingByLsxSet):
              - qty_open chứ không qty_ordered (phần đã về nằm trong on_hand rồi
                — cộng qty_ordered là trừ HAI lần)
              - qty_open chứ không qty_missing (0154 — dòng NCC bỏ, đã chốt thiếu,
                phải được giục mua lại)
              - dedupe theo PO, nhìn cả bảng nối mua-chung (audit 16/08 vá 2 lỗi)
pending     = Σ qty_ordered PO chờ duyệt — CHỈ cảnh báo, không trừ
```

**Luật mềm**: suggest chỉ prefill, cột on_hand/đã_đặt/pending hiện đủ trên form —
người mua nhìn số tự quyết, hệ **nghiêng về không giục mua trùng** (đơn nhiều lệnh
được đếm trọn phần chưa về — trade-off ghi trong comment `orderedPendingByLsxSet`).

Mua **bù tồn** (ngoài LSX, 0079): cùng công thức nhưng cần = `min_stock`, nguồn
`orderedPendingAll` + reorder.ts.

## 4. Đơn đặt NCC — vòng đời & cổng duyệt

**Trạng thái** (`pos.service.ts`):

```
draft ──submit──▶ pending_approval ──approve──▶ approved ──[BR-05]──▶ ordered
  ▲                    │ withdraw / reject                              │ confirm (0152)
  └────────────────────┘                                                ▼
cancelled ◀──(mọi trạng thái sống, kèm lý do)      confirmed → in_transit → partial → received
                                                            (partial/received DO SỔ KHO — BR-08)
```

- **BR-05**: GĐ duyệt mới gửi NCC. **BR-06**: 1 đơn = 1 NCC (+1 bộ LSX hoặc ngoài LSX).
- **Người phụ trách (0128)**: chỉ owner/trưởng phòng/admin thao tác; sửa đơn pending
  phải withdraw về draft; bàn giao có route riêng.
- Gửi NCC (`ordered`) bắn event `po.ordered` → cập nhật "giá mua gần nhất" danh mục (VND).
- **Dòng tự do** (0134, mẫu gỗ/gia công): `material_id null` — nghiệm thu ngoài sổ
  kho, không có movement; view đối chiếu lọc bỏ; đơn hỗn hợp áp luật
  "**sổ kho quyết phần kho, người quyết phần tự do**" (nút "Đã nhận đủ (nghiệm thu)").

## 5. NCC xác nhận + đợt giao + hàng về — xử lý mọi kiểu lệch

### 5a. NCC xác nhận (0152) — NCC không đăng nhập

"NCC xác nhận" = NV cung ứng **ghi lại cam kết** sau gọi điện/Zalo: ai hứa, kênh nào,
giao mấy đợt, mỗi đợt dòng nào bao nhiêu (`supply_po_shipments` + lines).
Validate: Σ đợt không vượt SL đặt (LỖI chặn); **hụt = CẢNH BÁO không chặn** (NCC xác
nhận thiếu là chuyện thật). `expected_at` của đơn = ngày đợt sống sớm nhất → mọi cảnh
báo trễ/badge/Hàng sắp về chạy nguyên. Đợt: `planned → arrived (xe tới) → received | cancelled`;
dời ngày/huỷ bắt lý do, ghi `[Dời a→b]`/`[Huỷ đợt]` vào note.

### 5b. Kho biết trước hàng sắp về

`/warehouse` dashboard + `/warehouse/nhap`: đợt planned/arrived nhóm **Quá hẹn / Hôm
nay / Sắp tới** + đơn mở chưa khai đợt; mỗi dòng deep-link "Lập phiếu nhập" (prefill
đơn + đợt). Phía Cung ứng: "Chờ tôi xử lý / Hàng sắp về" (`lib/supply-watch.ts` —
1 đơn chỉ nằm 1 chỗ).

### 5c. Nhận hàng — bảng quyết định LỆCH (phần hay sai nhất, học thuộc)

| Tình huống | Hệ xử lý | Ai quyết |
|---|---|---|
| Giao đúng đủ | PNK, đợt → `received`, đơn đủ mọi dòng → `received` | Kho |
| **QC loại một phần** | PNK ghi `qty` (đạt) + `qty_rejected` (loại). **BR-10**: loại KHÔNG vào tồn. **BR-08**: "đã nhận" của ĐƠN = đạt + loại (NCC đã giao số đó) → công nợ/đối chiếu tính đủ, lỗi xử bằng phiếu trả. HAI định nghĩa "đã nhận" khác nhau giữa 2 view là CHỦ ĐÍCH — đừng "sửa" | Kho ghi, chuẩn cố định |
| **Giao thiếu** (đợt/đơn) | Nhận phần thực giao → dòng đợt thiếu tự ghi note `[Thiếu X so đợt N]`, đợt giữ `arrived` chờ giao bù; đơn `partial`. NCC hẹn bù → **thêm đợt mới** (không nhét vào đợt cũ — mỗi đợt đối chiếu trọn "hứa X giao Y") | Kho ghi, Cung ứng đòi |
| **NCC không giao phần thiếu nữa** | **Chốt thiếu (0154)**: owner chốt theo dòng/cả đơn kèm lý do → `qty_open=0`, đơn thoát `partial`→`received`, suggest mua giục lại chỗ khác, đợt planned toàn dòng chốt tự huỷ, notify Kho+GĐ. Mở lại được. Chưa nhận GÌ mà chốt hết = bắt dùng **Huỷ đơn** | **Cung ứng** (không phải Kho) |
| **Giao vượt** | Mặc định chặn 409 `OVER_RECEIPT` (`lib/po-receipt.ts`, so `qty_missing` + EPS); người nhận xác nhận → gửi lại `allow_over` + lý do, ghi `[Nhận vượt]` vào phiếu | Kho xác nhận |
| **Hàng về không có PO** | PNK `ref_type external`, không gắn dòng đơn (gắn chéo bị chặn 2 chiều: theo PO thiếu po_line_id / mua ngoài thừa po_line_id đều 400) | Kho |
| **Hàng lỗi phát hiện SAU nhập** | **Phiếu trả NCC (0080)**: phiếu xuất gắn `po_line_id`, direction out → view TRỪ "đã về" → đơn `received` quay `partial` chờ giao bù. Guard: trả ≤ đã về từng dòng, ≤ tồn hiện có. UI badge đỏ "Trả NCC" | Kho lập, Cung ứng làm việc với NCC |
| Đơn có dòng tự do | Phần kho theo sổ; đủ hết phần kho (qty_open≤0) thì owner bấm "Đã nhận đủ (nghiệm thu)" cho phần tự do | Cung ứng nghiệm thu |

## 6. Nhập kho — phiếu PNK (`createReceiptDoc`)

Trình tự server (1 giao dịch nghiệp vụ, `stock.service.ts:284`):

1. Guard đợt (thuộc đúng PO, còn planned/arrived) → guard vật tư active → guard
   PO ở trạng thái RECEIVABLE → đối chiếu dòng với PO (`assertReceiptLinesMatchPo`:
   dòng lạ/lệch vật tư/vượt thiếu; dòng tự do bị chặn từ cửa).
2. Sinh mã `PNK-YYYY-NNNN` → insert doc + movements (`direction in`, `ref_type po|external`,
   `qty`, `qty_rejected`, `po_line_id`, kệ).
3. `refreshStatusFromReceipts`: mọi dòng kho `qty_open ≤ 0` → `received`, ngược lại
   `partial` (0154: dòng chốt thiếu coi như xong).
4. Chốt đợt theo TỪNG DÒNG: thực nhận (đạt+loại) phủ đủ SL đợt → `received`, thiếu → `arrived`.
5. Notify: admin/manager + **người phụ trách đơn** (0128).

In ấn: mẫu 01-VT. Kiểm kê (0077): biên bản đầy đủ, dòng lệch sinh movement `adjust`
— hiện áp tồn NGAY khi lập (sẽ đổi ở GĐ C bên dưới).

## 7. Xuất kho cho sản xuất (`createIssueDoc`)

1. **BR-09**: xuất `kind lsx` phải gắn LSX, và LSX phải `approved|in_progress`
   (chưa duyệt/hoàn thành/huỷ đều chặn).
2. **Guard 1 — tồn thực**: xuất > on_hand → 400 chặn tuyệt đối.
3. **Guard 2 — tồn khả dụng**: xuất lấn phần `reserved` của LSX KHÁC đã cam kết →
   409 `RESERVED_CONFLICT` (loại chính LSX đang xuất khỏi giữ chỗ); override kèm lý
   do, ghi `[Vượt khả dụng]`.
4. Form xuất theo LSX prefill từ nhu cầu còn lại (`smartLsxNeeds` — cần/đã cấp/còn thiếu);
   màn `/warehouse/xuat` liệt kê LSX đang chạy.
5. Sau xuất: quét tồn < min → notify Cung ứng đề xuất mua (FR-WMS-08).
6. Reserved **chỉ tính LSX sau cổng ký** — pending không giữ chỗ; reserved KHÔNG trừ
   hàng-đang-về của LSX khác (bảo thủ chủ đích: thà giục mua thừa).

## 8. Ai được làm gì (rút gọn)

| Thao tác | Quyền |
|---|---|
| Tạo/sửa/gửi/chốt thiếu đơn NCC | `supply.po.manage` + owner 0128 (trưởng phòng `manage_any`) |
| Duyệt đơn NCC | `supply.po.approve` (GĐ) — BR-05 |
| Lập PNK/PXK/trả NCC/kiểm kê | `warehouse.stock.write` = Kho (member+edit) — Cung ứng KHÔNG lập được |
| Sửa trường mua hàng của danh mục VT | `warehouse.material.update_purchasing` (Cung ứng ∪ Kho) |
| Duyệt LSX | luồng production riêng (cổng ký GĐ) |

---

# KẾ HOẠCH TỪNG PHẦN (rà 16/08/2026 — sau khi GĐ A chốt thiếu đã xong)

Đánh số theo mục logic ở trên. "✅" = đã chạy đúng, không đụng.

## P1–P2. LSX & nhu cầu — ✅ nền ổn, 1 việc treo

- ✅ Ưu tiên bảng chi tiết → fallback BOM; snapshot BOM; cờ `incomplete`.
- **[P2.1] Tách nhu cầu theo CHIỀU DÀI CÂY** (treo từ `dinh-muc-o-ho-so-sp`):
  nhôm/inox cùng mã nhưng cây 3m/6m — hiện gộp một dòng nhu cầu. Chỉ làm khi
  người mua thật sự vấp; kéo theo sửa components + form PO. **Chưa xếp lịch.**

## P3. Kiểm tồn & đề xuất mua — ✅ vừa audit + vá 3 lỗi (16/08)

- ✅ Công thức suggest, khử đếm trùng bộ lệnh, mua chung 0125, qty_open 0154.
- **[P3.1] Cảnh báo mua vượt trần** (`max_stock` — backlog): khi lập PO mà
  on_hand + đã_đặt + SL đặt thêm > max_stock thì cảnh báo vàng trên form.
  Nhỏ (~1 giờ), làm ghép khi có dịp sửa form PO.
- **[P3.2] Quét tồn dưới min ĐỊNH KỲ** (backlog ③): hiện chỉ báo tại thời điểm
  xuất kho/kiểm kê — vật tư âm thầm cạn giữa hai lần xuất thì không ai hay.
  Phương án: pg_cron trên Supabase insert thẳng notifications, hoặc quét khi
  login. Làm CÙNG [P4.2] (chung hạ tầng cron).

## P4. Đơn NCC & theo dõi — ✅ vòng đời đủ, 2 việc đáng làm

- ✅ Draft/duyệt/owner 0128/đợt giao 0152/chốt thiếu 0154/timeline GĐ3 còn treo.
- **[P4.1] GĐ3 plan-po-giao-nhan — timeline đủ mốc trên PoDetailScreen**: gộp
  duyệt + gửi NCC + xác nhận + từng đợt về + chốt vào một dòng thời gian.
  ~nửa buổi, thuần UI (dữ liệu có sẵn: history + shipments + docs).
- **[P4.2] Notification PO quá hẹn tự động** (backlog ③): logic `assessPoLate`
  có sẵn, chỉ hiển thị UI — cần cron đẩy notification cho owner + GĐ khi đơn
  trễ hẹn. Làm cùng [P3.2].

## P5. Hàng về & xử lý lệch — GĐ B dung sai là mảnh cuối

- ✅ Đợt giao, QC loại BR-08/BR-10, nhận vượt, chốt thiếu, trả NCC, đơn hỗn hợp.
- **[P5.1] GĐ B — Dung sai nhận vượt theo vật tư** (kế hoạch đã chốt trong
  `plan-cung-ung-kho-hoan-thien.md`, migration kế tiếp **0156**):
  `over_tolerance_pct` trên `warehouse_materials` (default 0%), dưới ngưỡng cho
  qua + note tự sinh `[Vượt x% trong dung sai]`, trên ngưỡng giữ 409; bulk-set
  theo nhóm trên MaterialsManager. **~nửa buổi — LÀM KẾ TIẾP.**
- **[P5.2] KPI giao hàng NCC tự tính** (backlog ④): % đúng hẹn (đợt received vs
  expected_date), tỉ lệ QC loại, tỉ lệ trả hàng, số lần chốt thiếu — dữ liệu ĐÃ ĐỦ
  từ 0080/0152/0154, thay chấm điểm tay ở tab đánh giá NCC. ~1 buổi, làm sau GĐ C.

## P6. Nhập kho & kiểm kê — GĐ C là việc user đã yêu cầu

- ✅ PNK theo đợt, đối chiếu dòng, notification.
- **[P6.1] GĐ C — Kiểm kê có duyệt** (kế hoạch đã chốt, migration **0157**):
  `warehouse_docs.status pending/posted/rejected` (backfill posted),
  lập biên bản KHÔNG đụng tồn, quản lý Kho (`warehouse.edit`) duyệt mới áp
  (chênh tính theo tồn LÚC DUYỆT, chặn tự duyệt), reject kèm lý do; dashboard
  ô "Biên bản chờ duyệt". **~1 buổi — LÀM SAU GĐ B.**
- **[P6.2] In biên bản kiểm kê 05-VT** (backlog): trang in hiện chỉ có 01-VT/02-VT.
  Làm GHÉP vào GĐ C (cùng đụng màn kiểm kê).

## P7. Xuất kho cho SX — ✅ guard đủ, 1 quyết định treo

- ✅ BR-09, 2 tầng guard, prefill nhu cầu, cảnh báo min.
- **[P7.1] Lô hàng + xuất FIFO theo lô** (GĐ3 kho-redesign): backlog 23/07 đã chốt
  KHÔNG làm lot/serial/QR; kho-redesign 16/08 để "chưa đáng". **Giữ nguyên KHÔNG
  làm** cho tới khi có nhu cầu truy hạn dùng thật (keo/sơn/hoá chất) — nếu tới
  lúc đó thì lô sinh tự nhiên từ PNK theo đợt 0153, không cần QR.
- **[P7.2] FIFO costing / giá vốn** (backlog, GĐ kế toán): bảng 0045 có sẵn nhưng
  service chưa gọi — CHẶN bởi quyết định "giá đv kép (đ/kg vs tồn theo cây)".
  Thuộc giai đoạn kế toán cùng 3-way match, **không nhét vào đợt này**.

## Thứ tự thi công — ✅ TOÀN BỘ 1–6 XONG 16/08/2026

| # | Việc | Kết quả |
|---|---|---|
| 1 | **P5.1 — GĐ B dung sai (0156)** | ✅ `over_tolerance_pct`/vật tư + bulk theo nhóm; trong ngưỡng cho qua + note `[Vượt x% trong dung sai]`; chip vàng trên ReceiptForm |
| 2 | **P6.1 + P6.2 — GĐ C kiểm kê duyệt + in 05-VT (0157/0158)** | ✅ pending→duyệt/từ chối, chênh áp theo tồn LÚC DUYỆT, chặn tự duyệt, notify 2 chiều, ô dashboard, trang in 05-VT; test tích hợp DB thật pass |
| 3 | P4.1 — timeline PO đủ mốc | ✅ "Dòng thời gian": duyệt + gửi NCC + xác nhận + đợt + PNK/trả + chốt thiếu |
| 4 | P3.2 + P4.2 — cảnh báo tự động (0159) | ✅ chọn pg_cron 07:00 VN (`hg-supply-alerts` → `sweep_supply_alerts()`): PO quá hẹn (owner đích danh + gộp GĐ/QL, type `po_late`) + tồn dưới min (gộp Cung ứng+GĐ/QL); chống lặp theo ngày đã verify |
| 5 | P5.2 — KPI NCC tự tính | ✅ `supplierDeliveryKpis`: % đúng hẹn theo ngày nhận thật, dòng QC loại, đơn trả hàng, dòng chốt thiếu — ĐẾM đơn/dòng, không cộng SL chéo ĐVT |
| 6 | P3.1 — cảnh báo max_stock | ✅ form PO: "⚠ vượt trần tồn — thêm được X" (max − tồn − đã đặt), vàng không chặn |
| — | P2.1 / P7.1 / P7.2 | treo có chủ đích, không tự ý làm |

## Đã chốt KHÔNG làm (đừng đề xuất lại — backlog 23/07 + các đợt chốt sau)

Chứng từ PR riêng · RFQ trong app · email PO cho NCC · đa tệ quy đổi · lot/serial/QR
+ in tem · backflushing kho (SX có backflush kg riêng) · theo dõi hạn chứng chỉ NCC ·
GĐ D "chờ kiểm" QC-hold (16/08 — QC kiểm ngay tại cổng là đủ).
