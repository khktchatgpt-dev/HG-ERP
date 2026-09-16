# Phân hệ KHO — chia module và thiết kế màn, dựng từ đầu

Viết 15/09/2026. **Không đối chiếu với màn đang có** — đây là bản vẽ trên giấy trắng, đi
từ cách năm hệ ERP lớn chia phân hệ kho, rồi cắt xuống cho một xưởng nội thất nhôm.

Tài liệu anh em: [`thiet-ke-kho.md`](thiet-ke-kho.md) trả lời *dữ liệu và luồng chạy thế
nào*. Ở đây chỉ trả lời **màn nào, ai mở, thấy gì, làm được gì**.

Khuôn màn và thành phần lấy từ [`/design-lab`](../src/app/design-lab/page.tsx).

> **Mười hai màn dưới đây đã dựng thành MẪU CHẠY ĐƯỢC** tại
> [`/design-lab/kho`](../src/app/design-lab/kho/page.tsx) — dựng hoàn toàn bằng
> `@/components/kit`, số liệu mẫu dùng mã vật tư thật. Ba màn bấm thử được thay vì chỉ
> xem: **Phiếu nhập** (gõ quá dung sai → nút Ghi sổ khoá kèm câu chỉ đường), **Kiểm kê**
> (công tắc đếm mù), **Soạn phiếu** (đổi mã lý do → lưới đổi cột). Đọc tài liệu này để
> biết *vì sao*, mở mẫu để biết *trông ra sao*.

---

## 1. Năm hệ ERP chia phân hệ kho ra sao

### 1.1 Menu thật của từng hệ

| | **Odoo 17 Inventory** | **SAP S/4HANA (Fiori)** | **Dynamics 365 BC** | **NetSuite WMS** |
| --- | --- | --- | --- | --- |
| Cửa vào | **Overview** — lưới thẻ theo loại tác vụ, mỗi thẻ kèm số + số trễ | Launchpad theo vai *Warehouse Clerk* | **Role Center** *Warehouse Worker* | Mobile task menu |
| Việc vào | Receipts | Goods Receipt for PO / Production Order / Without Reference | Warehouse Receipts, Put-aways | Receive, Putaway |
| Việc ra | Delivery Orders, Manufacturing | Goods Issue, Transfer Posting | Picks, Shipments | Wave, Pick, Pack, Ship |
| Việc trong | Internal Transfers, Scrap, Physical Inventory | Transfer Stock, Scrapping, Physical Inventory | Movements, Item Journals, Phys. Inventory Journal | Move, Adjust, Count, Status Change |
| Nhìn | Reporting: Stock · Locations · Moves History · Valuation | Stock — Single/Multiple Material, Material Documents, **MD04 Stock/Requirements List** | **Item Availability by Event / Location / Period / BOM** | Saved searches |
| Nền | Configuration: Warehouses · Locations · Operation Types · Putaway Rules · Reordering Rules | Master data | Items, Bins, Zones | Item records |

### 1.2 Ba bất biến — cả năm hệ đều thế, và đây là thứ đáng chép

#### Bất biến ① — Bốn họ, xếp theo ĐƯỜNG ĐI VẬT LÝ của hàng

Không hệ nào chia theo "loại chứng từ" hay theo "bảng dữ liệu". Tất cả chia theo đường
hàng đi: **VÀO → TRONG → RA**, cộng một họ **NHÌN**, và một họ **NỀN** bị đẩy xuống đáy.

Đây là lý do menu của họ dễ nhớ: nó trùng với cái thủ kho nhìn thấy bằng mắt mỗi ngày.

#### Bất biến ② — Mỗi họ nghiệp vụ có đúng BA tầng màn

Không hệ nào hai tầng, không hệ nào bốn.

| Tầng | Trả lời | Odoo | SAP | BC | **Khuôn của ta** |
| --- | --- | --- | --- | --- | --- |
| 1 · **Hàng đợi** | Còn bao nhiêu việc, cái nào gấp? | thẻ *Receipts 12 · 3 Late* | Warehouse Monitor | danh sách Warehouse Receipts | **B · Hộp thư** |
| 2 · **Chứng từ** | Tờ này là gì, vướng gì? | form Transfer | Object Page | Receipt card | **D · Chứng từ** |
| 3 · **Thao tác dòng** | Đếm / quét / xác nhận từng dòng | Barcode app | màn RF | Take–Place lines | **F · Bảng nhập liệu** |

Sai lầm hay gặp là **gộp tầng 1 vào tầng 2** (mở phiếu ra mới biết còn bao nhiêu việc)
hoặc **bỏ tầng 3** (bắt thao tác dòng ngay trong form chứng từ, nên không dùng nổi trên
điện thoại khi đang đứng ở kệ).

#### Bất biến ③ — Danh mục bị tách khỏi menu nghiệp vụ, đẩy xuống đáy

Odoo để *Configuration* cuối cùng. BC không để Items trong *Warehouse Activities*. SAP
tách hẳn master data ra role khác.

Lý do: **thủ kho không bao giờ vào đó.** Trộn danh mục vào menu nghiệp vụ là bắt người
làm việc 30 lần/ngày phải đi qua thứ họ dùng 1 lần/tháng.

### 1.3 Điều KHÔNG chép

| Không làm | Vì sao |
| --- | --- |
| **Wave / Pack / Ship** (NetSuite, BC nâng cao) | Sinh ra cho kho phân phối hàng trăm đơn/ngày. Xưởng cấp vật tư nội bộ, không có "đơn giao" |
| **Kanban kéo thả** (Odoo) | Trạng thái kho đổi qua hành động có kiểm quyền và có lý do. Kéo thả là mời bấm nhầm một bút toán |
| **Bản đồ kho 2D / 3D** | Đẹp trong demo. Xưởng một kho, 8–12 khu — một ô chữ `A-01` đọc nhanh hơn |
| **Lịch** (Odoo calendar view) | "Ngày nào có hàng" đã trả lời ở màn Hàng về, chia Trễ/Hôm nay/Sắp tới |
| **Biểu đồ ở cửa vào** | Biểu đồ trả lời "tháng này thế nào"; thủ kho hỏi "sáng nay làm gì" |
| **Lô / serial, gia công ngoài, giá vốn FIFO** | Chưa đau. Xem `thiet-ke-kho.md` §2.3 |

---

## 2. Ba thứ chốt TRƯỚC khi vẽ màn

### 2.1 Vai — và số màn mỗi vai được phép cần

| Vai | Câu hỏi duy nhất | Số màn | Mở/ngày |
| --- | --- | ---: | ---: |
| **Thủ kho** | Hôm nay nhận gì, cất đâu, cấp gì? | **4** | 20–50 |
| **Quản lý kho** | Gì chờ tôi duyệt, gì đang kẹt, tồn có đúng không? | 7 | 5–10 |
| **Tổ trưởng SX** | Lệnh của tôi thiếu gì, bao giờ có? | 2 | 2–5 |
| **Cung ứng** | Hàng về chưa? Lô khoá kia trả hay huỷ? | 3 | 5–10 |
| **Kế toán** | Ai điều chỉnh gì, vì sao? | 2 | 1–2 |
| **Giám đốc** | Kho có ứ hay thiếu gì không? | 1 | 1 |

Nguyên tắc rút ra, và là thước đo của cả thiết kế: **người dùng nặng nhất phải cần ít
màn nhất.** Thủ kho mở hệ thống 30 lần/ngày — nếu anh ấy phải nhớ 8 mục menu thì thiết
kế sai, bất kể từng màn đẹp thế nào.

### 2.2 Bộ từ vựng — 15 từ cho cả phân hệ

Chốt trước vì màn nào cũng dùng lại. **Một việc = một từ, ở mọi màn, mọi thông báo.**

**Danh từ**: Phiếu · Dòng · Vật tư · Kệ · Lượng · Đợt · Lý do

**Trạng thái lượng**: Dùng được · Chờ kiểm · Khoá · Giữ cho lệnh

**Động từ**: Nhận · Cất · Cấp · Chuyển · Đếm · Đảo

Không có màn nào gọi "xuất kho", màn khác gọi "cấp vật tư" cho cùng một việc. Không có
chỗ nào gọi "tồn khả dụng", chỗ khác gọi "còn dùng được".

### 2.3 Hàng đợi đếm theo cái gì — quyết định UI quan trọng nhất

| Đếm theo | Ví dụ | Hệ nào | Đúng khi |
| --- | --- | --- | --- |
| **Chứng từ** | "4 phiếu chờ nhận" | Odoo, BC | mỗi phiếu ≈ một lần đi lại |
| Dòng | "48 dòng chờ cất" | SAP EWM | mỗi dòng ≈ một chuyến xe nâng |
| Nhiệm vụ | "7 việc cất hàng" | NetSuite WMS | có người điều phối phân việc |

**Chọn: đếm theo CHỨNG TỪ ở tầng 1, theo DÒNG ở tầng 3.** Thủ kho nghĩ theo "xe hàng",
không theo "dòng hàng". Đếm theo dòng thì con số nhảy loạn giữa 3 và 90 mà không nói
thêm được gì về khối lượng công việc.

---

## 3. Bản đồ module — bốn họ, mười hai màn

Đường dẫn dưới đây là đường dẫn **MẪU** ở `/design-lab/kho`. Màn thật sẽ nằm ở
`/warehouse/*` để không phải khai `MOVED_PREFIXES`.

```
┌ VÀO VIỆC ────────────────────────────────────────────────┐
│  /kho                    Bàn làm việc kho          A     │
└──────────────────────────────────────────────────────────┘
┌ HỌ 1 · VÀO ──────────────────────────────────────────────┐
│  /kho/hang-ve            Hàng về                   B     │
│  /kho/phieu-nhap         Phiếu nhập                D     │
│  /kho/cat-hang           Chờ cất                   F     │
└──────────────────────────────────────────────────────────┘
┌ HỌ 2 · RA ───────────────────────────────────────────────┐
│  /kho/cap-vat-tu         Cấp vật tư cho SX         B     │
└──────────────────────────────────────────────────────────┘
┌ HỌ 3 · TRONG KHO ────────────────────────────────────────┐
│  /kho/hang-khoa          Hàng mắc — khoá & chờ kiểm C    │
│  /kho/kiem-ke            Đợt kiểm kê: đếm + đối chiếu D+F│
│  /kho/phieu-moi          Soạn phiếu tay            F     │
└──────────────────────────────────────────────────────────┘
┌ HỌ 4 · NHÌN ─────────────────────────────────────────────┐
│  /kho/ton                Tồn kho                   C     │
│  /kho/vat-tu             Hồ sơ vật tư              E     │
│  /kho/so-phieu           Sổ phiếu                  C     │
└──────────────────────────────────────────────────────────┘
┌ NỀN · đáy menu, sau gạch ngăn ───────────────────────────┐
│  /kho/ke                 Sơ đồ kệ                  C     │
└──────────────────────────────────────────────────────────┘
```

**Hai màn trong bản vẽ đầu đã GỘP đi, và đó là kết quả của việc dựng thật:**

- **Trả hàng NCC** gộp vào *Hàng mắc*. Trả hàng là **một chuyến xe cho một NCC**, nên
  việc thật là "gom mọi lô của NCC đó vào một phiếu" — thao tác đó phải nằm ngay cạnh
  danh sách lô, không ở màn khác. Tách ra thì người dùng nhớ hai nơi cho một việc.
- **Danh sách đợt kiểm kê** gộp vào chính màn đợt. Xưởng chạy 1–2 đợt một lúc; một danh
  sách hai dòng không đáng một mục menu.

Ngược lại, **Phiếu nhập được nâng lên hàng đầu của họ VÀO** thay vì nằm chung ở "Chứng
từ": nó là màn nặng nhất của cả phân hệ và là nơi ba ý chép của ERP lớn cùng gặp nhau.

**Menu của thủ kho chỉ hiện 5 dòng đầu.** Phần "Nhìn" và "Nền" nằm sau một gạch ngăn,
và vai thủ kho không thấy nhóm "Nền". Đây là chép cách SAP lọc launchpad theo vai —
không phải phân quyền, mà là **giấu bớt cho đỡ nhiễu**.

---

## 4. Đặc tả từng màn

Mỗi màn ghi đúng ba thứ: **BIẾT** (thấy gì), **LÀM** (bấm được gì), **Bố cục**.

---

### A · Bàn làm việc kho — `/kho`

**Vai**: Thủ kho (trang chủ). **Khuôn A · Vào việc.**
**Câu hỏi**: *Sáng nay tôi phải làm gì?*

**BIẾT** — bốn ô việc, mỗi ô là một **việc**, không phải một chỉ số:

| Ô | Số | Dòng phụ bắt buộc — nói VÌ SAO gấp |
| --- | --- | --- |
| ⬇ Hàng về | 4 | *1 đơn quá hẹn 3 ngày* |
| ⬆ Chờ cất | 2 | *sớm nhất từ 09:20* |
| ⬈ Chờ cấp | 7 | *2 lệnh bắt đầu hôm nay* |
| ⚑ Hàng khoá | 1 | *chưa quyết 3 ngày* |

**LÀM**: bấm ô → sang màn hàng đợi tương ứng, **lọc sẵn** đúng tập vừa được nói tới.

```
Kho · Thứ Hai 15/09                              [Nhận hàng ▾]  [⋯]
────────────────────────────────────────────────────────────────────
 ⬇ Hàng về        ⬆ Chờ cất       ⬈ Chờ cấp       ⚑ Hàng khoá
     4                 2               7               1
 1 quá hẹn 3 ngày  sớm nhất 09:20  2 lệnh hôm nay  chưa quyết 3 ngày
────────────────────────────────────────────────────────────────────
 VIỆC CHỜ TÔI
 Trễ (1)
  ⬇ PO-2026-0031 · Sơn Tín Phát · hẹn 12/09 · 8 dòng      [Nhận →]
 Hôm nay (4)
  ⬇ PO-2026-0044 · Vạn Vi Thành · 3 dòng                  [Nhận →]
  ⬈ LSX-2026-0088 · Ghế Merxx · bắt đầu hôm nay           [Cấp  →]
 Sắp tới (2)                                             [xem tiếp]
────────────────────────────────────────────────────────────────────
 CẦN ĐỂ Ý
 ⚑ 1 lô NH-0044 khoá 3 ngày, chưa quyết trả hay huỷ       [Xử lý →]
 ▼ 5 mã dưới tồn tối thiểu                                [Xem   →]
 ✎ Đợt kiểm kê DKK-0003 đã đếm 34/47 mã                   [Tiếp  →]
```

**Luật**:
- **Không biểu đồ.** Biểu đồ trả lời câu của tháng.
- Số 0 **không tô đỏ** — hết việc là tin tốt.
- Mỗi số là một **lời hứa**: bấm vào ra đúng chừng ấy dòng, đếm bằng chính hàm màn đích
  dùng.
- Dải "Việc chờ tôi" chia **Trễ / Hôm nay / Sắp tới** (chép Odoo Activities) — ba nhóm
  này là ba thái độ khác nhau, gộp lại là mất thông tin.

---

### 1.1 Hàng về — `/kho/hang-ve`

**Vai**: Thủ kho, Cung ứng. **Khuôn B · Hộp thư.**
**Câu hỏi**: *Xe nào đang tới, cái nào trễ?*

**BIẾT** — mỗi dòng phải mang đủ sáu thứ, không hơn:
ngày hẹn · mã đơn · NCC · khối lượng (n dòng · tổng SL) · **vì sao đáng chú ý** · nút chính.

**LÀM**: `[Nhận hàng]` → mở phiếu nhập nháp với đơn + đợt **chọn sẵn**. Phụ: `[Xem đơn]`,
`[Báo NCC trễ]`, `[+ Nhận hàng không theo đơn]`.

```
Kho › Hàng về                        [+ Nhận không theo đơn]  [⋯]
────────────────────────────────────────────────────────────────────
[Quá hẹn 1] [Hôm nay 2] [Tuần này 3] [Chưa hẹn ngày 6] [Tất cả 12]
🔍 mã đơn / NCC / mã vật tư
────────────────────────────────────────────────────────────────────
 QUÁ HẸN
  12/09  PO-2026-0031  Sơn Tín Phát       8 dòng · 1.240 kg
         trễ 3 ngày · Cung ứng đã gọi 13/09      [Nhận hàng] [Đơn ›]
 HÔM NAY
  15/09  PO-2026-0044  Vạn Vi Thành       3 dòng · 96 cây
                                          [Nhận hàng] [Đơn ›]
────────────────────────────────────────────────────────────────────
 Trống: "Không có hàng nào đang chờ nhận.
         Khi Cung ứng gửi đơn và NCC hẹn lịch, đợt giao hiện ở đây.
         Hàng về mà không có đơn thì bấm + Nhận không theo đơn."
```

**Chép của**: Odoo *Receipts* (Late/Today/Future) và SAP *My Inbox* — dòng tự nói ra
quyết định cần ra, không chỉ hiện mã chứng từ.

**Luật**: rổ "Chưa hẹn ngày" phải có mặt. NCC Việt Nam giao không báo trước là chuyện
thường; giấu tập này đi là thủ kho phải nhớ bằng đầu.

---

### 1.2 Phiếu nhập — `/kho/phieu/[id]` (lý do N1/N2)

**Vai**: Thủ kho. **Khuôn D · Chứng từ.** Đây là **màn nặng nhất của cả phân hệ**.
**Câu hỏi**: *Xe này có gì, nhận bao nhiêu, hàng có đạt không, cất đâu?*

**BIẾT**:
- Trục trạng thái `Nháp → Đã ghi sổ → Đã cất`, kèm người giữ + tuổi ở bước hiện tại.
- Đầu phiếu gọn: lý do · đơn · NCC · ngày · số phiếu NCC · người giao.
- Lưới dòng với **ba cột số của SAP GR**: **Đặt / Đã về / Lần này**. Người nhận không
  phải nhớ đã về bao nhiêu — đó là nguồn sai lớn nhất khi nhận hàng làm nhiều đợt.
- Mỗi dòng có ô **Tình trạng**: Đạt / Chờ kiểm / Sai quy cách → quyết trạng thái lượng
  **ngay tại dòng**, không phải một màn riêng sau đó.
- `CommitBar` đáy nói vì sao chưa ghi sổ được, bằng câu **bấm được**.

**LÀM**: Ghi sổ · Lưu nháp · Thêm dòng ngoài đơn · Chốt thiếu (kèm lý do) · Đảo phiếu
(sau khi đã ghi sổ) · In phiếu · Ghi chú + người theo dõi.

```
Kho › Phiếu › PNK-2026-0051              [Ghi sổ] [Lưu nháp] [⋯]
────────────────────────────────────────────────────────────────────
  ● Nháp ───── ○ Đã ghi sổ ───── ○ Đã cất      Thủ kho A · 12 phút
────────────────────────────────────────────────────────────────────
 Lý do  N1 · Nhập mua theo đơn      Đơn   PO-2026-0044 ›
 NCC    Vạn Vi Thành                Ngày  15/09/2026
 Số phiếu NCC ____________          Người giao ____________
────────────────────────────────────────────────────────────────────
 Mã       Tên               Đặt   Đã về  Lần này   Kệ      Tình trạng
 NH-0021  Nhôm hộp 20×40    500    120   [  380 ]  [A-01▾] [Đạt     ▾]
 NH-0044  Nhôm V 30         200      0   [  200 ]  [A-02▾] [Sai q.c.▾]
 PK-0102  Ốc vít M6        5000   5000   [    0 ]    —     đã đủ
                                                      [+ dòng ngoài đơn]
────────────────────────────────────────────────────────────────────
 ⚠ NH-0021 nhận vượt 4% phần còn lại — trong dung sai 5%, không cần giải trình
 ⛔ NH-0044 "Sai quy cách" → 200 cây vào KHOÁ, không tính vào tồn dùng được.
    Bắt buộc ghi lý do:  [ bị cong, NCC giao sai mã hợp kim        ]
────────────────────────────────────────────────────────────────────
 [Ghi sổ]  3 dòng · 580 đv · 200 vào khoá        Ctrl+Enter
```

**Luật**:
- Hàng không đạt **vẫn vào sổ**, ở trạng thái khoá. Không có nút "từ chối nhận" làm hàng
  biến mất khỏi hệ thống trong khi nó nằm thật ngoài sân.
- Cảnh báo hiện **ngay khi gõ**, không đợi bấm Ghi sổ.
- Nút bị chặn nói **vướng gì và cách gỡ**, không chỉ "không hợp lệ".

---

### 1.3 Chờ cất — `/kho/cat-hang`

**Vai**: Thủ kho. **Khuôn B.** **Màn này phải dùng được trên điện thoại** (xem §6).
**Câu hỏi**: *Còn gì đang nằm ở khu tiếp nhận?*

**BIẾT**: từng phiếu vừa nhận, các dòng chưa gán kệ, kệ **gợi ý sẵn** theo lần cất gần
nhất của chính mã đó.

**LÀM**: chọn kệ từng dòng · `[Cất hết vào …]` cho cả phiếu · quét mã vạch NCC để nhảy
tới dòng · `[Xác nhận đã cất]`.

```
Kho › Chờ cất                                   2 phiếu · 11 dòng
────────────────────────────────────────────────────────────────────
 PNK-2026-0051 · nhận 09:20 · 3 dòng            [Cất hết vào A-01 ▾]
   NH-0021  Nhôm hộp 20×40   380 cây   TIẾP-NHẬN → [A-01 ▾]  ✓
   NH-0044  Nhôm V 30        200 cây   ⚑ KHOÁ    → [KHOA-01]  (cố định)
   PK-0102  Ốc vít M6       5000 con   TIẾP-NHẬN → [     ▾]
                                              [Xác nhận đã cất]
────────────────────────────────────────────────────────────────────
 Trống: "Không còn gì ở khu tiếp nhận — hàng đã cất hết.
         Việc cất xuất hiện ở đây ngay sau khi ghi sổ một phiếu nhập."
```

**Vì sao tách khỏi phiếu nhập**: nhận hàng và cất hàng là **hai lần đi lại, hai thời
điểm, có khi hai người**. Gộp vào một form là bắt thủ kho đứng ở bàn quyết chỗ để cho
thứ chưa nhìn thấy. Odoo gọi đây là *receipt hai bước*, BC gọi là *Put-away*.

---

### 2.1 Cấp vật tư cho SX — `/kho/cap-vat-tu`

**Vai**: Thủ kho, Tổ trưởng SX. **Khuôn B.**
**Câu hỏi**: *Lệnh nào chờ cấp, thiếu gì, thiếu thì gỡ bằng cách nào?*

**BIẾT**: mỗi lệnh một khối, có `CoverageBar` phủ bao nhiêu phần, bung ra là bảng
**cần / đã cấp / còn / tồn dùng được**, và mỗi dòng thiếu **nói đường gỡ**.

**LÀM**: `[Cấp phần đủ]` (tạo phiếu với các dòng đủ, bỏ dòng thiếu) · `[Cấp từng dòng]` ·
`[Cắt chỗ của lệnh khác]` (bắt lý do + báo người giữ lệnh kia) · `[Xin mua gấp]` → tạo
đề nghị sang Cung ứng.

```
Kho › Cấp vật tư cho sản xuất
────────────────────────────────────────────────────────────────────
[Trễ 2] [Bắt đầu hôm nay 3] [Tuần này 5] [Đang SX 4]
────────────────────────────────────────────────────────────────────
 LSX-2026-0088 · Ghế Merxx 300 cái · bắt đầu 16/09
 ████████████░░░░░░  đủ 8/12 mã          [Cấp phần đủ] [Chi tiết ▾]
   ✓ NH-0021  cần 900   đã cấp 900   xong
   ⚠ NH-0044  cần 400   đã cấp 200   còn 200 · dùng được 150
              → thiếu 50. 200 cây đang KHOÁ chờ quyết.     [Xem lô ›]
   ⛔ VL-0007  cần 120   đã cấp   0   dùng được 0
              → PO-2026-0049 hẹn về 18/09 (sau ngày bắt đầu)  [Đơn ›]
   ⏸ PK-0102  cần 2000  đã cấp   0   2000 đang CHỜ KIỂM
              → nhờ KCS kiểm để mở khoá                  [Báo KCS]
────────────────────────────────────────────────────────────────────
 Trống: "Không có lệnh nào chờ cấp.
         Lệnh hiện ở đây sau khi Giám đốc duyệt."
```

**Luật quan trọng nhất của màn này**: **không bao giờ chỉ nói "không đủ tồn".** Mỗi dòng
thiếu phải nói *thiếu bao nhiêu* và *gỡ thế nào* — hàng đang trên đường (kèm ngày), đang
khoá (kèm liên kết), hay thật sự chưa có (kèm nút xin mua). Đây là luật kiểm số 2 của
sổ design-lab, và đây là màn dễ vi phạm nhất.

---

### 2.2 Trả hàng NCC — `/kho/tra-ncc`

**Vai**: Thủ kho, Cung ứng. **Khuôn B**, phiếu dùng chung khuôn D (lý do X3).

**BIẾT**: các lô đang KHOÁ đã có quyết định "trả", nhóm theo NCC — vì trả hàng là một
chuyến xe cho một NCC, không phải từng lô một.

**LÀM**: gom nhiều lô cùng NCC vào một phiếu trả · in biên bản · ghi số phiếu NCC nhận lại.

---

### 3.1 Hàng khoá chờ xử lý — `/kho/hang-khoa`

**Vai**: Cung ứng (người quyết), Quản lý kho. **Khuôn C · Danh sách.**
**Câu hỏi**: *Lô nào đang nằm chết, ai phải quyết, bao lâu rồi?*

**BIẾT**: mã · lượng · kệ khoá · **lý do khoá (nguyên văn)** · phiếu gốc · **tuổi tính từ
lúc khoá** · người phải quyết.

**LÀM**: `[Trả NCC]` · `[Huỷ/phế]` · `[Mở khoá]` (đã kiểm lại thấy dùng được, bắt lý do).

**Luật**: cột tuổi là lý do màn này tồn tại. Hàng khoá không ai nhắc thì nằm đó hết
tháng. Lô quá 3 ngày nổi `--warn`, quá 7 ngày nổi `--stop` — và dòng đó **đẩy lên cửa
vào** của người phải quyết.

---

### 3.2 Kiểm kê — `/kho/kiem-ke` + `/kho/kiem-ke/[id]`

**Vai**: Quản lý kho mở đợt, Thủ kho đếm. **Khuôn C** (danh sách đợt) + **D+F** (một đợt).
**Câu hỏi**: *Đợt này đếm tới đâu, lệch chỗ nào?*

Đợt kiểm kê là **chứng từ nặng nhất trong kho**, và thiết kế của nó quyết định hệ thống
có được tin hay không.

**Mở đợt — BIẾT/LÀM**: chọn **phạm vi** (khu kệ / nhóm vật tư / danh sách mã) → hệ thống
báo *"phạm vi này gồm 47 mã"* → chọn ngày chốt → phân người đếm. **Không có đường nào
chọn cả danh mục.**

**Đếm** — khuôn F, lưới, lưu dở được, dùng trên điện thoại được:

```
Kho › Kiểm kê › DKK-2026-0003
────────────────────────────────────────────────────────────────────
 ● Mở ── ● Đang đếm ── ○ Đối chiếu ── ○ Đã duyệt   Thủ kho B · 2 giờ
 Phạm vi: Khu A (A-01…A-12) · 47 mã · chốt sổ 15/09 08:00
 ██████████████░░░░░  đã đếm 34/47
────────────────────────────────────────────────────────────────────
 Mã       Tên              Kệ     Sổ(chốt)   Đếm      Lệch   Ghi chú
 NH-0021  Nhôm hộp 20×40   A-01      380    [ 380 ]      0
 NH-0044  Nhôm V 30        A-02      150    [ 142 ]     −8   [cong 8 cây]
 NH-0055  Nhôm U 25        A-03      200    [     ]   chưa đếm
────────────────────────────────────────────────────────────────────
 [Gửi đối chiếu]  34/47 đã đếm · 3 dòng lệch · còn 13 mã chưa đếm
```

**Ba luật**:
1. Cột **Sổ(chốt)** là tồn **đã đóng băng lúc mở đợt**, không phải tồn hiện tại. Không
   đóng băng thì đếm xong 2 tiếng, trong lúc đó có phiếu nhập, và chênh lệch tính ra sai
   mà không ai biết.
2. **Đếm mù hay đếm mở?** SAP và BC mặc định **giấu cột Sổ** lúc đếm (*blind count*) để
   người đếm không bị số sổ dẫn dắt, chỉ hiện ở bước Đối chiếu. Đây là một công tắc trên
   đợt — cần chủ dự án chọn mặc định (§7).
3. Dòng lệch **bắt ghi chú**, không cho duyệt suông. Lệch không có lý do là số nói dối
   một cách trơn tru.

---

### 4.1 Tồn kho — `/kho/ton`

**Vai**: mọi vai. **Khuôn C · Danh sách.**
**Câu hỏi**: *Trong tập này, mã nào cần tôi động vào?*

**BIẾT** — bốn cột lượng + một cột suy ra, đây là cái ruột của màn:

| Cột | Nghĩa |
| --- | --- |
| **Dùng được** | cấp đi được ngay |
| **Chờ kiểm** | đã nhận, chưa được dùng |
| **Khoá** | hỏng / sai quy cách, chờ quyết |
| **Giữ cho lệnh** | đã hứa cho LSX đã duyệt |
| **Còn dùng** = Dùng được − Giữ | âm nghĩa là **đã hứa nhiều hơn số có** |

**LÀM**: xem hồ sơ mã · chuyển kệ · khoá lô · xin mua bù · xuất Excel.

```
Kho › Tồn kho
────────────────────────────────────────────────────────────────────
[Đang dùng 118] [Dưới mức 5] [Chờ kiểm 3] [Khoá 1] [Thiếu cho LSX 2]
                                              [Cả danh mục 13.229]
🔍 mã/tên   Nhóm ▾   Kệ ▾                           [Xuất Excel]
────────────────────────────────────────────────────────────────────
 Mã       Tên             ĐVT  Dùng được ChờKiểm Khoá  Giữ  Còn dùng  Kệ
 NH-0021  Nhôm hộp 20×40  cây       380       0     0  180      200  A-01
 NH-0044  Nhôm V 30       cây       150       0   200  400     −250  A-02
 PK-0102  Ốc vít M6       con         0    5000     0    0        0  TIẾP-NHẬN
────────────────────────────────────────────────────────────────────
 Chân bảng: "Tổng KHÔNG gồm 13.111 mã chưa từng phát sinh."
```

**Ba luật**:
1. **Mặc định KHÔNG phải cả danh mục.** Rổ đầu là "Đang dùng" (có tồn hoặc có phát sinh
   90 ngày). Rổ "Cả danh mục 13.229" đứng cuối và **ghi rõ con số** để không ai tưởng bị
   giấu mất hàng.
2. **Lọc và phân trang ở server.** Màn này là màn hay bị mở nhất sau cửa vào.
3. Chân bảng nói **tổng không gồm gì** — luật kiểm "số nào không kiểm được thì không ai
   tin".

---

### 4.2 Hồ sơ vật tư — `/kho/vat-tu/[id]`

**Vai**: mọi vai. **Khuôn E · Hồ sơ danh mục.**
**Câu hỏi**: *Mã này đang ở đâu, dùng vào đâu, mua của ai, sắp tới đủ không?*

**Đây là danh mục — KHÔNG có vòng đời duyệt.** Chỗ của ba trục trạng thái ở đây là **dải
hiệu suất**, mỗi ô **bắt buộc kèm mẫu số**.

```
Kho › Vật tư › NH-0021 · Nhôm hộp 20×40×1.2            [Sửa] [⋯]
────────────────────────────────────────────────────────────────────
 Dùng được      Giữ cho lệnh    Khoá        Vòng quay
   380 cây       180/380 cây     0 cây      2,3 lần/tháng
                                            (12 tháng gần nhất)
────────────────────────────────────────────────────────────────────
[Tồn theo kệ] [Tồn dự kiến] [Dùng ở đâu] [Mua của ai] [Lịch sử]

 TỒN DỰ KIẾN 8 TUẦN
 400 ┤      ╭───╮
 200 ┤ ─────╯   ╰────╮ · · · · · · · · ·  mức tối thiểu 150
   0 ┼───────────────╰──────────────────
     T38  T39  T40  T41  T42  T43  T44  T45
     ▲ 18/09 PO-0049 về 200      ▼ 16/09 LSX-0088 cấp 400
     ⚠ 04/10 xuống dưới mức tối thiểu — đặt trước 25/09 (lead time 9 ngày)
```

**Chép của**: Dynamics *Item Availability by Event* và SAP *MD04*. Đây là thứ **rẻ nhất
mà giá trị cao nhất** trong cả phân hệ: ba mảnh dữ liệu (tồn · đợt giao NCC đã hẹn · nhu
cầu LSX đã duyệt) đã có sẵn, chỉ chưa ghép thành một hình.

Câu người lập kế hoạch thật sự hỏi không phải *"hôm nay còn bao nhiêu"* mà **"đến ngày
xưởng cần thì còn bao nhiêu"**.

---

### 4.3 Sổ phiếu — `/kho/so-phieu`

**Vai**: Quản lý kho, Kế toán. **Khuôn C.**
**Câu hỏi**: *Tra lại một tờ đã lập; ai điều chỉnh gì trong tháng.*

**BIẾT**: số phiếu · ngày · **mã lý do** · đối ứng (đơn/lệnh/NCC) · số dòng · người lập ·
trạng thái · cờ "đã bị đảo".

**LÀM**: lọc theo mã lý do (đây là bộ lọc chính, không phải bộ lọc phụ) · mở phiếu · in ·
xuất Excel cho kế toán.

**Luật**: phiếu đảo và phiếu gốc **luôn hiện cạnh nhau**, gạch ngang phiếu gốc. Sổ phải
cộng lại đúng bằng những gì đã xảy ra, kể cả cái sai.

---

### 4.4 Soạn phiếu tay — `/kho/phieu/moi`

**Vai**: Thủ kho. **Khuôn F · Bảng nhập liệu.**
Dành cho việc không xuất phát từ hàng đợi: nhập mua lẻ, xuất dùng chung, xuất huỷ, chuyển
kệ hàng loạt.

**Bố cục khuôn F**: đầu phiếu co thành **dải chip** (`HeadChips`) — mỗi hàng đầu trang là
một hàng lưới bị lấy mất; lưới là nhân vật chính; `CommitBar` đáy nói vì sao chưa lưu
được bằng câu bấm được.

**Chọn mã lý do TRƯỚC** — vì mã lý do quyết định lưới có cột nào và đầu phiếu bắt buộc
điền gì. Chọn "X4 Xuất huỷ" thì hiện ô lý do bắt buộc; chọn "C1 Chuyển kệ" thì hiện hai
cột kệ đi–đến và ẩn cột giá.

---

### NỀN · Danh mục vật tư — `/kho/danh-muc`

**Khuôn C** (tìm) **→ E** (xem một mã). **Không phải một bảng sửa-tại-chỗ 13.229 dòng.**

Danh mục là master data: **sửa tại chỗ, có vết, không có vòng đời duyệt**. Việc cần làm ở
đây là **tìm một mã** và **sửa vài trường** — không phải duyệt qua cả danh sách.

Rổ đầu tiên: **"Chờ Kho rà"** — vật tư do Cung ứng khai vội lúc soạn đơn. Đây là hàng đợi
việc thật của quản lý kho, đừng chôn nó trong một bộ lọc.

### NỀN · Sơ đồ kệ — `/kho/ke`

**Khuôn C.** Danh sách khu/kệ: mã · tên · loại (kệ thật / tiếp nhận / khoá / phế) · số mã
đang nằm · **ngày kiểm kê gần nhất**. Cột cuối là để lên lịch kiểm kê xoay vòng theo khu
thay vì kiểm cả kho một lần.

---

## 5. Hai mẫu tương tác dùng lại ở mọi màn

### 5.1 Hành động bị chặn — nói vướng gì và cách gỡ, ngay tại chỗ

Luật kiểm hay trượt nhất. Không bao giờ cho bấm rồi mới báo lỗi.

| Tình huống | ❌ Sai | ✅ Đúng |
| --- | --- | --- |
| Cấp thiếu | *"Không đủ tồn"* | *"Dùng được 150/400. 200 đang KHOÁ (chờ Cung ứng quyết) · 50 chưa có — PO-0049 hẹn 18/09."* + hai liên kết |
| Ghi sổ nhận vượt | nút xám | *"Vượt 12% dung sai 5% — ghi lý do để ghi sổ:"* + ô lý do |
| Duyệt kiểm kê | *"Có lỗi"* | *"3 dòng lệch chưa ghi lý do: NH-0044, NH-0055, PK-0102"* + bấm vào nhảy tới dòng |

### 5.2 Trạng thái rỗng — nói lý do và việc làm tiếp

`Empty` bắt buộc `reason` + `next`. Rỗng vì **chưa có việc** khác hẳn rỗng vì **lọc quá
tay** — hai câu khác nhau, và cái thứ hai phải kèm nút xoá lọc.

---

## 6. Điện thoại — hai màn bắt buộc, còn lại không

Odoo tách hẳn một app *Barcode*; SAP có màn RF riêng. Lý do đơn giản: **người làm hai
việc này đang đứng ở kệ, không ngồi ở bàn.**

| Màn | Điện thoại | Vì sao |
| --- | --- | --- |
| **Chờ cất** | **bắt buộc** | đang đẩy xe hàng tới kệ |
| **Kiểm kê — đếm** | **bắt buộc** | đang đứng trước kệ đếm |
| Cấp vật tư | nên có | có khi đứng ở cửa kho |
| Còn lại | không | ngồi bàn, cần bề ngang |

**Không dựng app riêng.** Hai màn đó thiết kế responsive với ba điều kiện: ô số **≥44px**
bấm được bằng ngón cái · ô nhập số bật **bàn phím số** · **quét mã vạch NCC** nhảy thẳng
tới dòng (mã vạch NCC đã có sẵn trên danh mục — không in tem mới).

---

## 7. Bốn câu đã chốt — và đường lùi của từng câu

Bốn câu này đổi **hình dạng màn**, không sửa được bằng CSS về sau. Chủ dự án giao lại
cho người thiết kế quyết (15/09/2026), nên chốt theo đúng một luật: **chọn phương án
lùi được rẻ nhất**. Cả bốn đều đã dựng thành màn chạy được ở `/design-lab/kho` — xem
rồi đổi thì rẻ hơn nhiều so với đọc rồi đoán.

### 7.1 Kiểm hàng trước khi nhập — GIỮ ĐỦ BA TRẠNG THÁI, nhưng bật theo NHÓM

*Dùng được · Chờ kiểm · Khoá* giữ nguyên trong mô hình, nhưng **cờ `needs_inspection`
đặt trên NHÓM vật tư**, mặc định TẮT. Thực tế chạy ra: ốc vít, bao bì nhận thẳng vào
*Dùng được*; chỉ nhóm nào bật cờ — nhôm định hình, vải — mới rơi vào *Chờ kiểm*.

**Vì sao không bỏ hẳn trạng thái *Chờ kiểm* như phương án "gọn hơn":** bỏ đi thì lúc
cần lại phải chia lại số dư từng mã theo trạng thái, làm tay, và sai thì không ai phát
hiện. Giữ lại mà không bật nhóm nào thì trạng thái đó **không bao giờ xuất hiện trên
màn** — chi phí đúng bằng không. Đây là bất đối xứng quyết định cả bốn câu dưới đây.

**Đường lùi**: không bật nhóm nào → hệ thống hành xử y hệt phương án hai trạng thái.

### 7.2 Mã kệ — MƯỜI HAI KHU THÔ, không đánh tới từng ô

Xem `/design-lab/kho/ke`. Chín khu thật + ba khu **ảo** (`TIEP-NHAN`, `KHOA-01`,
`PHE-Z`).

**Vì sao khu chứ không phải ô:** đánh mã tới từng ô nghe "chuẩn ngay từ đầu", nhưng nó
có nghĩa là phải dán tem cả nhà kho **trước khi dùng được ngày nào** — và trong lúc đó
`bin_id` chỉ là một ô rỗng nữa trên phiếu. Khu thì sơn một tấm biển là xong trong buổi
sáng, và đã đủ trả lời câu "hàng để đâu".

**Ba khu ảo là chỗ trả công nhiều nhất**, và không tốn gì: nhờ chúng mà "chờ cất" là
một **câu truy vấn** (còn gì ở `TIEP-NHAN`) chứ không phải một cờ trạng thái phải nuôi,
và mọi lượng luôn ở một chỗ có tên — không lượng nào "biến mất".

**Đường lùi**: chia nhỏ về sau chỉ là thêm dòng vào bảng kệ; hàng đang ở khu A vẫn hợp lệ.

### 7.3 Cấp vật tư — KHO ĐẨY THEO LỆNH, cộng một đường xin thêm

Xem `/design-lab/kho/cap-vat-tu`. Hàng đợi là **lệnh sản xuất đã duyệt**, vì đó là dữ
liệu đã có (LSX + định mức) và là câu hỏi thật của xưởng: *"lệnh này còn thiếu gì"*.

Đường **xin thêm ngoài định mức** (hỏng, làm lại) đi bằng mã lý do `X2` trên màn soạn
phiếu, không đẻ thêm một loại chứng từ *đề nghị lĩnh vật tư*.

**Vì sao không làm phiếu đề nghị:** thêm một chứng từ là thêm một vòng đời, một hộp
thư, một chỗ kẹt. Xưởng một kho, người xin và người cấp cách nhau 20 mét. Làm khi
**thật sự đau** — triệu chứng sẽ là: có tranh cãi "ai bảo cấp", lặp lại.

**Đây là câu rủi ro nhất trong bốn câu** và tôi vẫn cần xác nhận: sổ ghi `ref_type='lsx'`
đúng **1 dòng trong 2 tháng**, nghĩa là việc cấp thật đang chạy hoàn toàn ngoài hệ
thống. Nếu ngoài thực địa xưởng **xin trước bằng giấy** thì hàng đợi phải đảo thành
"theo yêu cầu", và đó là thay đổi cấu trúc chứ không phải thay đổi màn.

### 7.4 Kiểm kê — ĐẾM MÙ mặc định, có công tắc

Xem `/design-lab/kho/kiem-ke`, công tắc *"Hiện số sổ khi đếm"* ngay đầu lưới. Mặc định
**giấu cột Sổ** — chép SAP và Dynamics.

**Vì sao mù:** thấy số sổ thì người đếm bị dẫn dắt, đếm ra "khớp" mà không thật sự đếm,
và cả đợt kiểm kê thành một thủ tục giấy tờ. Công tắc để mở cho đợt nhỏ hoặc lúc đếm
lại một mã đang tranh cãi.

**Công tắc đặt Ở ĐẦU LƯỚI, không giấu trong Cấu hình**: người đếm phải biết mình đang
đếm theo cách nào, vì đó là điều kiện để con số của họ có giá trị.

---

## 8. Luật kiểm — khi nào coi phân hệ là xong

Ngoài 14 luật của `/design-lab`:

1. **Thủ kho hoàn thành một ca chỉ bằng 5 mục menu**, không phải 12.
2. **Không màn nào nạp quá 200 dòng** một lượt.
3. **Không ô nào gõ được số tồn.** Tồn chỉ đổi qua phiếu.
4. **Mọi lượng có nơi chốn và có trạng thái.** Số dùng để tính đủ–thiếu luôn là *Dùng
   được*, không bao giờ là tổng tồn.
5. **Mọi hành động bị chặn nói được cách gỡ**, tại chỗ, có liên kết đi tiếp.
6. **Mọi số trên cửa vào là lời hứa** — bấm ra đúng chừng ấy dòng, đếm bằng chính hàm màn
   đích dùng.
7. **Chờ cất và Đếm kiểm kê dùng được bằng một tay trên điện thoại.**
8. **Một việc một từ** — soát toàn bộ chuỗi giao diện theo bộ từ vựng §2.2 trước khi
   đóng.
