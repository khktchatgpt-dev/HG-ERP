# Kho · Bước 1 — Nhập kho theo đơn mua

Viết 16/09/2026, sau khi gỡ toàn bộ khu Kho (commit `20033fb`). Đây là bước
đầu của kế hoạch 4 bước chính (Nhập → Xuất → Tồn → Danh mục), mỗi bước một
màn, chạy thật xong mới sang bước sau.

**Vết xe đổ phải tránh** (đo trên nhánh `feat/thiet-ke-kho`): 23 commit trong
10 giờ, 8 migration, 31 màn, 12 màn mẫu số giả, không điểm dừng nghiệm thu.
Bước này cố ý làm ngược lại: 0 migration, 2 màn, 1 route, dữ liệu thật từ
commit đầu, và dừng lại chờ chủ dự án bấm thử.

---

## 1. Câu hỏi nghiệp vụ

| Vai | Câu hỏi | Màn |
| --- | --- | --- |
| Thủ kho | Hôm nay xe nào tới, tôi nhận bao nhiêu, hàng có đạt không? | Hàng về → Phiếu nhập |
| Cung ứng | Đơn tôi đặt về chưa, về bao nhiêu? | đã có ở `/mua-hang/don/[id]` (cột về x/y) — không dựng lại |

Chốt nghiệp vụ đã có (15/09/2026), không hỏi lại: thủ kho **vừa nhận vừa
kiểm** → phiếu nhập chỉ có hai tình trạng *Đạt* / *Sai quy cách*, không có
"Chờ kiểm".

## 2. Phạm vi — đúng hai màn, một route

### 2.1 `/warehouse/nhap` — Hàng về · Khuôn B (hộp thư)

Nguồn số **dùng lại nguyên hàm** đang chạy ở Mua hàng, để hai phòng không đếm
khác nhau:

- `poShipmentsRepo.listOpen()` — đợt giao đã hẹn (`planned` / `arrived`).
- `supplyRepo.listOpenPos()` — đơn đã gửi NCC nhưng **chưa khai đợt**.

Bốn làn, mỗi làn đeo số đếm bằng chính hàm trên:

| Làn | Điều kiện | Tone |
| --- | --- | --- |
| Quá hẹn | `expected_date < hôm nay` | `--stop` |
| Hôm nay | `= hôm nay` | `--warn` |
| Sắp tới | `> hôm nay` | `--primary` |
| **Chưa hẹn ngày** | đơn mở không có đợt | muted |

Làn thứ tư là thứ mẫu Odoo/SAP không có mà NCC Việt Nam bắt buộc phải có
("giao khi có xe"). Với dữ liệu hôm nay (5 đợt giao, phần lớn đơn không khai
đợt) đây sẽ là làn đông nhất — giấu nó đi là màn trống.

Mỗi dòng đúng sáu thứ: ngày hẹn · mã đơn · NCC · n dòng / tổng SL · về x/y ·
nút **[Nhận hàng]**. Phụ: link *Xem đơn* sang `/mua-hang/don/[id]`.

Trạng thái rỗng (`Empty` bắt buộc `reason` + `next`): *"Không có đơn nào đang
về. Đơn hiện ở đây sau khi Cung ứng gửi nhà cung cấp."*

**Không làm ở màn này**: nút "Nhận không theo đơn" (N2), trả hàng NCC, báo NCC
trễ. Ba việc đó là bước phụ, sau khi nhập theo đơn chạy thật.

### 2.2 `/warehouse/nhap/[poId]` — Phiếu nhập · Khuôn D + lưới

Query `?dot=<shipment_id>` khi đi từ một đợt giao.

Nguồn số: `posService.detail(poId)` (dòng đơn) + `lineStatus` (đã về, còn mở
`qty_open`). Không viết truy vấn mới.

Đầu phiếu (`DocHead`, gọn): đơn · NCC · lệnh SX · ngày chứng từ (`DateInput`,
mặc định hôm nay, lùi ≤ 7 ngày) · số phiếu giao NCC · người giao.

Lưới (`Grid*`), **ba cột số của SAP GR**: **Đặt · Đã về · Lần này**, cộng:

| Cột | Nguồn / luật |
| --- | --- |
| Lần này | `NumInput`, điền sẵn = `qty_open` của đợt (nếu có đợt) hoặc của dòng |
| Tình trạng | `Đạt` (mặc định) / `Sai quy cách` |
| Ghi chú | **bắt buộc** khi Sai quy cách — lý do đi theo lô |

Ánh xạ xuống API (người dùng không thấy): Đạt → `stock_status:'ok'`; Sai quy
cách → `stock_status:'blocked'` + `note`. `bin_id` bỏ trống → service tự chọn
(TIEP-NHAN / KHOA-01). `reason_code` = N1 do service gắn. Kệ và mã lý do là
khái niệm **chưa ai cần thấy** ở bước này.

Cảnh báo **ngay khi gõ**, không đợi bấm:

- vượt phần còn thiếu nhưng trong dung sai → dòng vàng "trong dung sai x%";
- vượt dung sai → `CommitBar` khoá kèm câu bấm được: *"NH-0021 vượt 12%, dung
  sai 5% — ghi lý do để ghi sổ"* → mở ô `over_reason`, gửi `allow_over`;
- dòng Sai quy cách chưa có ghi chú → CommitBar chỉ đích danh dòng.

Hành động: **[Ghi sổ]** (Ctrl+Enter) · [Huỷ]. Sau ghi sổ: toast mã phiếu +
`router.push('/warehouse/nhap')`, dòng đó rơi khỏi làn (đợt → `received`, đơn
đổi "về x/y"). Tra lại phiếu: link sang sổ chứng từ đang sống `/planning/docs`
— **không dựng màn chi tiết phiếu ở bước này**.

### 2.3 Route

Khôi phục nguyên văn `src/app/api/dept/warehouse/docs/receipt/route.ts` (12
dòng, từ `20033fb^`): `parseJson(receiptDocSchema)` → `stockService.createReceiptDoc`.
Service đã có đủ guard: khớp dòng đơn, dung sai, blocked bắt note, đợt giao,
refresh trạng thái đơn. **Không sửa service.**

## 3. Dữ liệu — đã có gì, thiếu gì

| Cần | Có chưa | Ở đâu |
| --- | --- | --- |
| Phiếu + dòng sổ | ✅ | `warehouse_docs`, `warehouse_movements` (0017, 0010) |
| Nối dòng đơn, đợt giao | ✅ | `po_line_id`, `shipment_id` |
| Dung sai, chốt thiếu | ✅ | `over_tolerance_pct`, `qty_open` |
| Kệ mặc định, hàng khoá | ✅ | 0193/0194, 16 kệ đã nạp |
| Mã lý do | ✅ | 0197, service gắn N1 |
| Số phiếu NCC, ngày chứng từ | ✅ | 0161 |
| **Migration mới** | **không** | |

Số đo 16/09: 13.229 mã, tồn 0 toàn bộ, 46 phiếu nhập cũ, 5 đợt giao (4
planned / 1 arrived), 14 lệnh SX đang chạy.

## 4. Vỏ khu Kho — tối thiểu để vào được

- `workspaces.config.ts`: `ready: true`, `home: '/warehouse/nhap'` (không dựng
  trang chủ), một mục nav duy nhất **Hàng về**. Mỗi bước sau thêm một mục.
- `(workspace)/warehouse/layout.tsx` + `loading.tsx` như các khu khác.
- Quyền: nút ghi sổ theo `warehouse.stock.write` (server enforce lại); xem
  màn: thành viên Kho, Cung ứng, admin.
- Lint: file mới ở mức `error`, không đưa vào `ui-baseline.json`.

## 5. Thứ tự thi công — 5 việc, mỗi việc kiểm được

| # | Việc | Kiểm bằng |
| --- | --- | --- |
| 1 | Vỏ khu + route API khôi phục | đăng nhập vai Kho rơi vào `/warehouse/nhap`; `curl` POST receipt trả 201 |
| 2 | Màn Hàng về | số ở 4 làn = số `listOpen` + `listOpenPos` đếm tay trên DB |
| 3 | Form phiếu nhập, chưa ghi | mở từ một đợt: cột Đặt/Đã về đúng với `/mua-hang/don/[id]` |
| 4 | Ghi sổ + cảnh báo tại chỗ | 3 ca: đủ · vượt trong dung sai · sai quy cách thiếu ghi chú |
| 5 | Chạy thật một đợt giao | mục 6 |

Mỗi việc một commit. `npm run check` sạch trước khi sang việc kế.

## 6. Nghiệm thu — khi nào Bước 1 xong

Chủ dự án (hoặc thủ kho) nhận thật **một đợt giao** trên máy, rồi kiểm 6 dòng:

1. Phiếu `PNK-2026-00xx` xuất hiện ở `/planning/docs`, trạng thái `posted`.
2. Đơn ở `/mua-hang/don/[id]` đổi "về x/y dòng"; đợt giao sang `received`.
3. `warehouse_stock.on_hand` của mã đó tăng đúng số Lần này (mã Sai quy cách
   **không** tăng `qty_ok`).
4. Dòng sổ có `bin_id` = TIEP-NHAN (hoặc KHOA-01), `reason_code` = N1.
5. Không có ô nào trên hai màn cho gõ số tồn.
6. Thủ kho làm xong mà không phải mở khu Mua hàng.

Điều kiện tiên quyết: **có ít nhất một đơn ở trạng thái đã gửi NCC** (ordered
/ confirmed / partial). Nếu toàn bộ đơn đang là nháp thì Cung ứng phải gửi một
đơn thật trước — việc của người, không phải phần mềm.

## 6b. Mẫu in — yêu cầu chủ dự án 16/09/2026

**Mọi phiếu nhập / xuất đều phải in được.** Bản in đã có từ trước và còn
sống sau đợt gỡ: `/print/warehouse/[id]` in 01-VT (nhập) · 02-VT (xuất) ·
05-VT (kiểm kê) theo TT200, tiêu đề / mẫu số / cột ký lấy từ
`/admin/doc-templates` (0164). Phiếu do form mới ghi vào cùng bảng nên in
được ngay, chỉ **thiếu cửa vào**: link in duy nhất đang nằm ở sổ chứng từ cũ.

Việc 7 của Bước 1: sau Ghi sổ, toast có nút **In phiếu** mở
`/print/warehouse/{id}` tab mới; sổ phiếu (`/planning/docs`) giữ link in như
cũ. Bản in xem lại cùng chủ dự án trước khi coi là xong — nếu mẫu cần đổi thì
sửa ở `/admin/doc-templates`, không sửa mã.

## 7. Cố ý chưa làm

Nhập ngoài đơn (N2) · hoàn kho từ LSX (N3) · trả NCC (X3) · cất hàng vào kệ
thật · chi tiết phiếu Khuôn D · in phiếu mới (bản in 01-VT cũ vẫn dùng được)
· bàn làm việc Kho · sổ phiếu lọc theo mã lý do. Tất cả chờ Bước 1 chạy thật.

---

## 8. Thiết kế UI/UX — theo chuẩn ERP

> **Chốt 16/09/2026 (chủ dự án):** sáu khuôn ở `/design-lab` là **mẫu tham
> chiếu, không tuân 100%**. Giao diện dựng theo nhiệm vụ của từng chức năng,
> tham khảo màn tương đương của ERP lớn khi cần, và **bản thiết kế dựng bằng
> skill `design` để xem và sửa trước khi code**. Các bảng ánh xạ kit dưới đây
> là gợi ý đồ nghề; tiêu chí đo được ở 8.7 mới là thứ bắt buộc.
>
> **Bản thiết kế (16/09/2026)**: <https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf>
> — ba artboard: Hàng về · Phiếu nhập theo đơn · Hộp lý do nhận vượt. Dựng
> bằng đúng token kit (`tokens.css`, `erp.css`) và vỏ sidebar 212px của app.
> Số liệu là số mẫu. Sửa trên canvas rồi mới code.

### 8.1 Ba tầng màn của một họ nghiệp vụ

Cả bốn hệ lớn dựng họ "nhận hàng" đúng ba tầng, không hai, không bốn:

| Tầng | Trả lời | Odoo | SAP | Dynamics BC | **Bước 1** |
| --- | --- | --- | --- | --- | --- |
| 1 · Hàng đợi | Còn bao nhiêu xe, cái nào trễ? | thẻ *Receipts 12 · 3 Late* | My Inbox / Warehouse Monitor | Warehouse Receipts list | **Hàng về · Khuôn B** |
| 2 · Chứng từ | Tờ này có gì, vướng gì? | form Receipt | MIGO Goods Receipt | Receipt card | **Phiếu nhập · Khuôn D** |
| 3 · Thao tác dòng | Đếm / xác nhận từng dòng | Barcode app | màn RF | Take–Place lines | **lưới trong tầng 2** — xưởng một kho, người nhận ngồi ngay bàn |

Hàng đợi đếm theo **chứng từ** (mỗi đợt giao ≈ một xe), không theo dòng — thủ
kho nghĩ theo "xe hàng", con số theo dòng nhảy loạn mà không nói thêm gì.

### 8.2 Đối chiếu bốn hệ — màn nhận hàng theo đơn

| Đặc trưng | SAP MIGO (GR for PO) | Odoo Receipts | Dynamics BC Whse Receipt | NetSuite Receive Order | **Chép hay không** |
| --- | --- | --- | --- | --- | --- |
| Vào từ đâu | gõ số PO | thẻ Receipts, lọc Late/Today | list → card | Receive Orders list | **Chép Odoo**: 4 làn theo ngày |
| Ba cột số | Ordered · Delivered · **Qty in UnE** | Demand · Done | Qty Outstanding · **Qty to Receive** | Remaining · Quantity | **Chép SAP/BC**: Đặt · Đã về · Lần này |
| Điền sẵn Lần này | = phần còn mở | = Demand | = Outstanding | = Remaining | Chép — điền sẵn phần còn mở |
| Hàng không đạt | Stock type: Unrestricted / QI / **Blocked** | Quality check riêng | Không | Không | **Chép SAP** rút còn 2: Đạt / Sai quy cách |
| Nhận vượt | Tolerance trên PO, chặn hoặc cảnh báo | Cảnh báo | Chặn | Cho | Chép SAP: trong dung sai cảnh báo, vượt phải ghi lý do |
| Nhận thiếu | Delivery Completed flag | Backorder wizard | Còn mở | Còn mở | Đã có ở Mua hàng (chốt thiếu theo dòng) — **không lặp** |
| Lưu nháp | Hold | Draft | — | — | **Không**: phiếu lập trong 3 phút, nháp là chỗ quên |
| Ghi sổ | Post (Ctrl+S) | Validate | Post Receipt | Save | Ghi sổ, Ctrl+Enter |
| Bước cất hàng | Put-away riêng | Receipt 2 bước | Put-away worksheet | Bin putaway | **Chưa** — service tự cất vào TIEP-NHAN |

**Không chép**: Kanban kéo thả (Odoo), quét mã vạch RF (SAP), sóng nhận nhiều
đơn một lượt (BC), lịch (Odoo). Một xưởng, vài xe một ngày.

### 8.3 Màn chính 1 — Hàng về (`/warehouse/nhap`)

```
ScreenHeader   Hàng về · 9 đang về · 1 quá hẹn                     [Xem sổ phiếu ›]
FilterBar      [Quá hẹn 1] [Hôm nay 2] [Sắp tới 2] [Chưa hẹn ngày 4] [Tất cả 9]
               🔍 mã đơn / NCC / lệnh SX
WorkLanes      QUÁ HẸN
                 12/09  PO-2026-0031  Sơn Tín Phát   8 dòng · 1.240 kg   về 0/8   [Nhận hàng]  Đơn ›
                        trễ 4 ngày · đợt 1/2
               HÔM NAY
                 16/09  PO-2026-0044  Vạn Vi Thành   3 dòng · 96 cây     về 1/3   [Nhận hàng]  Đơn ›
               CHƯA HẸN NGÀY
                  —     PO-2026-0067  Nhôm Tín Đạt   5 dòng · 320 cây    về 0/5   [Nhận hàng]  Đơn ›
                        đã gửi NCC 6 ngày, chưa chốt ngày giao
StatusBar      9 đơn · nguồn: đợt giao đã hẹn + đơn đã gửi NCC chưa khai đợt
```

| Thành phần | Kit | Ghi chú |
| --- | --- | --- |
| Khung | `ScreenFrame` | bảng cuộn trong khung, tiêu đề dính |
| Đầu trang | `ScreenHeader` | dữ kiện: tổng đang về · quá hẹn. Không biểu đồ |
| Lọc | `FilterBar` + `Chip` có số | chip = làn, số đếm trên **toàn tập**, lên URL `?lan=qua-hen` |
| Tìm | `SearchInput` | lọc client trên tập đã nạp (≤ 1.000 đơn, có cảnh báo trần) |
| Danh sách | `WorkLanes` | mỗi làn một tiêu đề + số; dòng có **dòng phụ nói vì sao đáng chú ý** |
| Mã | `Code` | mã đơn, mã lệnh — mono |
| Số | `Num` | n dòng, tổng SL, về x/y — tabular |
| Nút chính | `Btn` primary | **Nhận hàng** — duy nhất một nút màu hành động trên dòng |
| Nút phụ | link chữ | *Đơn ›* sang `/mua-hang/don/[id]` |
| Rỗng | `Empty` | `reason` + `next`, tách "chưa có việc" với "lọc quá tay" (kèm Bỏ lọc) |
| Chân | `StatusBar` | nói tổng gồm gì, không gồm gì |

Giao diện **chính**: bốn làn + nút Nhận hàng. Giao diện **phụ**: ô tìm, link
Đơn, link Xem sổ phiếu. Không có menu ⋯ ở bước này vì chưa có hành động phụ
nào thật (trả NCC, báo trễ là bước sau).

Luật riêng của màn: làn "Chưa hẹn ngày" **không được giấu**; số 0 ở làn Quá
hẹn không tô đỏ; bấm cả dòng = Nhận hàng (vùng bấm lớn), không chỉ cái nút.

### 8.4 Màn chính 2 — Phiếu nhập (`/warehouse/nhap/[poId]?dot=`)

```
ScreenHeader   Kho › Hàng về › Nhận hàng · PO-2026-0044 · Vạn Vi Thành          [Ghi sổ] [Huỷ]
DocHead        Đơn  PO-2026-0044 ›     NCC  Vạn Vi Thành      Lệnh  LSX 07/26-14
(FieldGrid)    Đợt  1/2 · hẹn 16/09    Ngày chứng từ [16/09/2026]
               Số phiếu giao NCC [__________]   Người giao [__________]
Grid           #  Mã        Tên                 ĐVT   Đặt    Đã về   Lần này    Tình trạng      Ghi chú
               1  NH-0021   Nhôm hộp 20×40      cây   500    120     [ 380 ]    [Đạt        ▾]  
               2  NH-0044   Nhôm V 30           cây   200      0     [ 200 ]    [Sai q.cách ▾]  [bị cong, sai hợp kim]
               3  PK-0102   Ốc vít M6           con  5000   5000     [   0 ]    đã đủ           —
GridFoot                                              5700   5120      580
NoticeBar      ⚠ NH-0021: vượt 4% phần còn lại — trong dung sai 5%, không cần giải trình
CommitBar      [Ghi sổ]  3 dòng · 580 đv · 200 vào khoá                              Ctrl+Enter
               ⛔ Dòng 2 "Sai quy cách" chưa có ghi chú — bấm để tới dòng
```

| Thành phần | Kit | Ghi chú |
| --- | --- | --- |
| Khung chứng từ | `DocScreen` + `DocHead` + `DocBody` | Khuôn D, không thẻ nổi, khối ngăn bằng vạch |
| Đầu phiếu | `FieldGrid` / `Field` | 2 hàng, đọc-only trừ 3 ô nhập; **không** `HeadChips` (Khuôn F) vì phiếu ≤ 20 dòng, đầu phiếu không tranh chỗ lưới |
| Ngày | `DateInput` | kiểu VN, mặc định hôm nay, lùi ≤ 7 ngày (schema chặn) |
| Lưới | `Grid`, `GridHead`, `GridRow`, `GridFoot` | tiêu đề dính, chân tổng dính; cột số `t-data` căn phải |
| Lần này | `NumInput` | điền sẵn phần còn mở; Tab đi xuống ô Lần này dòng kế; Enter = Tab |
| Tình trạng | select 2 giá trị | mặc định Đạt; chọn Sai quy cách → ô Ghi chú bật và bắt buộc |
| Ghi chú | `TextInput` | 500 ký tự |
| Dòng đã đủ | `LineStatus` muted | không có ô nhập, không xoá dòng — sổ đơn quyết |
| Cảnh báo dòng | `CellHint` | hiện ngay khi gõ, ngay cạnh ô |
| Cảnh báo phiếu | `NoticeBar` | gom các dòng trong dung sai |
| Chốt | `CommitBar` | tổng + **lý do chưa ghi sổ được, bấm nhảy tới dòng** |
| Vượt dung sai | `Sheet` + `SheetActions` | mở ô `over_reason`, nút xác nhận `disabled` khi trống |
| Hành động | `ActionPane` góc trên phải | **Ghi sổ** primary · Huỷ. Không menu ⋯ |

Ba trạng thái của `CommitBar` (câu nào cũng bấm được):

| Tình huống | Câu | Bấm vào |
| --- | --- | --- |
| Không dòng nào có Lần này > 0 | "Chưa nhận dòng nào — gõ số vào cột Lần này" | ô đầu tiên |
| Sai quy cách thiếu ghi chú | "Dòng 2 Sai quy cách chưa có ghi chú" | ô ghi chú dòng 2 |
| Vượt dung sai | "NH-0021 vượt 12%, dung sai 5% — ghi lý do để ghi sổ" | mở Sheet lý do |

Sau Ghi sổ: toast *"Đã ghi sổ PNK-2026-0055 · 3 dòng"* kèm link *Xem phiếu*
(sang `/planning/docs?view=`), rồi về Hàng về. Không ở lại form — ở lại là mời
ghi sổ hai lần.

Bàn phím: Tab/Enter chạy dọc cột Lần này · Ctrl+Enter ghi sổ · Esc huỷ (hỏi
lại nếu đã gõ).

### 8.5 Từ vựng — một việc một từ

Nhận hàng · Ghi sổ · Đạt · Sai quy cách · Đợt giao · Đơn · Lần này · Đã về.
Không dùng "nhập kho" ở chỗ này và "nhận" ở chỗ kia; không dùng "QC loại".

### 8.6 Chính / phụ — bảng tổng hợp

| Tính năng | Chính/phụ | Ở màn nào, vị trí |
| --- | --- | --- |
| Bốn làn hàng về đếm bằng hàm chung | **Chính** | Hàng về, chip + WorkLanes |
| Nhận theo đợt giao, điền sẵn phần còn mở | **Chính** | Phiếu nhập, cột Lần này |
| Ba cột Đặt · Đã về · Lần này | **Chính** | Phiếu nhập, lưới |
| Tình trạng Đạt / Sai quy cách + ghi chú bắt buộc | **Chính** | Phiếu nhập, cột Tình trạng |
| Dung sai: cảnh báo tại chỗ, vượt thì lý do | **Chính** | CellHint + Sheet |
| Số phiếu giao NCC, ngày chứng từ, người giao | Phụ | đầu phiếu, 3 ô |
| Tìm theo mã/NCC/lệnh | Phụ | Hàng về, SearchInput |
| Link Đơn, link Xem phiếu | Phụ | dòng / toast |
| Cảnh báo trần 1.000 đơn | Phụ | StatusBar |
| Nhận không theo đơn, trả NCC, báo trễ, cất kệ | **Bước sau** | — |

### 8.7 Luật kiểm UI trước khi coi màn xong

Từ 14 luật của `/design-lab`, những dòng màn này dễ trượt nhất:

1. Bảng/lưới cuộn trong `ScreenFrame`; tiêu đề cột **và** chân tổng dính.
2. Mọi số, mã, ngày là `t-data` (mono, tabular); tiền không hiện ở Kho.
3. Một màu hành động: chỉ Nhận hàng / Ghi sổ mang `--act`. `--stop/--warn`
   chỉ trên nhãn làn và cảnh báo dòng, không bao giờ lên nút.
4. Hành động bị chặn nói vướng gì **và cách gỡ** tại chỗ, không bấm rồi mới lỗi.
5. `Empty` có `reason` + `next`.
6. Không màu Tailwind cứng, không thẻ thô — lint `hg/*` mức error cho file mới.
7. Icon lucide 16px đứng trước chữ; nav dùng `arrow-down-to-line`.
8. Rộng tối thiểu 1024px dùng thoải mái; 375px không tràn ngang (gutter 16px).
   Hai màn này ngồi bàn, **không** yêu cầu thao tác một tay trên điện thoại.
9. Số trên chip = số dòng trong làn khi bấm (lời hứa).
10. Không ô nào gõ số tồn.
