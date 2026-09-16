# Thiết kế lại KHO — đo hiện trạng, đối chiếu ERP, bản vẽ mới

Viết 15/09/2026. Đo trên mã nguồn + **DB thật** (project `pcbfvrapknzykhtntuwg`).

> **Việc CÒN LẠI của phân hệ Kho ghi ở [`kho-backlog.md`](kho-backlog.md)** —
> gồm cả ba câu nghiệp vụ còn treo, nợ kỹ thuật đã biết, và một va chạm cần chốt
> trước khi làm Đợt 3 (phiên khác đã thêm `warehouse_docs.reason_code`).

Tài liệu này đứng sau hai tài liệu nền và không lặp lại chúng:

- [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md) — luồng chạy thế nào (4 nguyên
  lý nền, 7 tiêu chí, 6 bước thiết kế một luồng mới).
- [`/design-lab`](../src/app/design-lab/page.tsx) — màn trông thế nào (6 khuôn, 6 nguyên
  tắc, 14 luật kiểm).

Ở đây làm đúng **sáu bước của mục 5** tài liệu luồng, cho riêng phân hệ Kho.

---

## 0. Tóm tắt một trang

**Chẩn đoán**: Kho đang được dựng quanh **DANH MỤC**, không quanh **LƯỢNG TỒN**. Tỉ lệ
đo được là 64,6 : 1 — hệ thống ghi chép việc "vật tư là gì" nhiều gấp 64 lần việc "vật
tư đang ở đâu, còn bao nhiêu". Mọi triệu chứng khó dùng đều mọc ra từ đó.

**Bốn khái niệm phải nhập khẩu** (cả năm ERP lớn đều có, HG-ERP không có cái nào):

1. **Nơi chốn là thuộc tính của LƯỢNG, không phải của vật tư.**
2. **Trạng thái của lượng** — chờ kiểm / dùng được / giữ cho lệnh / khoá.
3. **Lý do biến động là một thứ có kiểu** (movement type), không phải ô ghi chú.
4. **Tồn dự kiến theo thời gian**, không chỉ tồn hôm nay.

**Thời điểm**: phiếu `KK-2026-0004` ngày **15/09/2026** ghi *"Kiểm kê đầu kỳ — đưa tồn
về 0 để nhập lại dữ liệu"*, xoá 116 mã về 0. **Tồn hiện tại của cả 13.229 mã đều bằng
0.** Đập xây lại bây giờ gần như không tốn gì; sau khi nạp tồn thật thì mỗi thay đổi mô
hình đều phải kèm một cuộc di trú số dư.

---

## 1. Đo hiện trạng

### 1.1 Số liệu DB

| Phép đo | Số | Nói lên điều gì |
| --- | ---: | --- |
| Vật tư trong danh mục | 13.229 | |
| Vật tư **từng có phát sinh nhập/xuất** | **117** | 0,9 % |
| Vật tư từng nằm trên một dòng đơn mua | 118 | tập làm việc thật ≈ 120 mã |
| Dòng sổ **sửa danh mục** (`warehouse_material_changes`) | 17.124 | |
| Dòng sổ **nhập/xuất** (`warehouse_movements`) | 265 | **tỉ lệ 64,6 : 1** |
| Mã có khai `min_stock` | **5** | "Sắp hết" luôn hiển thị 0 |
| Mã có khai `shelf_location` | **5** | không ai biết hàng để đâu |
| Mã đang chờ Kho rà (`needs_review`) | 52 | |
| Kho vật lý (`warehouses`) | 1 | |
| **Mã có tồn ≠ 0** | **0 / 13.229** | kho chưa từng giữ tồn thật |

### 1.2 Sổ nhập/xuất bóc theo loại

| `ref_type` | Số dòng | Nghĩa |
| --- | ---: | --- |
| `po` | 143 | nhận hàng theo đơn mua |
| `adjust` | 117 | **một** phiếu kiểm kê ngày 15/09 xoá sạch về 0 |
| `external` | 3 | mua lẻ ngoài đơn |
| `daily` | 1 | |
| **`lsx`** | **1** | **cấp vật tư cho sản xuất — dùng đúng 1 lần trong 2 tháng** |

Đây là con số quan trọng nhất trong cả tài liệu. Kho đang được dùng như **sổ nhận hàng
của phòng Mua**, không phải như kho. Việc cấp vật tư cho xưởng — mục đích chính của
phân hệ — diễn ra ở ngoài hệ thống.

| Loại phiếu | Số phiếu | Số dòng |
| --- | ---: | ---: |
| Phiếu nhập | 46 | 139 |
| Phiếu xuất | 2 (1 là phiếu đảo) | 2 |
| Biên bản kiểm kê | 1 | 116 |

### 1.3 Đo trên mã nguồn

| Màn | Dòng mã | Nạp bao nhiêu dòng dữ liệu |
| --- | ---: | --- |
| `MaterialsManager.tsx` (danh mục) | **1.265** | phân trang ở server ✅ |
| `DocsManager.tsx` (sổ + 3 form + chi tiết + đảo) | **2.225** | phân trang ✅ |
| `StockManager.tsx` (tồn kho) | 696 | **toàn bộ 13.229 dòng** ❌ |
| `StocktakeScreen.tsx` (kiểm kê) | 401 | **toàn bộ 13.229 dòng, kèm state đếm từng dòng** ❌ |
| `IssueScreen.tsx` (cấp vật tư SX) | **240** | |

Bảng này tự nó là bản đồ của lối mòn: màn quản **danh mục** được đầu tư 1.265 dòng, màn
làm **việc chính của kho** được 240 dòng.

### 1.4 Sáu lối mòn

**① Kho dựng quanh danh mục, không quanh lượng tồn.**
Bằng chứng ở 1.1 và 1.3. `shelf_location` nằm trên bảng **vật tư**
([`warehouse.schema.ts:28`](../src/modules/dept/warehouse/warehouse.schema.ts)) — nghĩa
là một mã chỉ ở được đúng một chỗ, và chỗ đó là tính chất của *mã*, không phải của *số
hàng đang nằm đâu đó*. 5/13.229 mã có điền.
*Vi phạm*: nguyên lý 1.2 (danh mục ≠ chứng từ) — thuộc tính chứng từ bị nhét vào danh mục.

**② Màn hình = một cái bảng, không phải một câu hỏi.**
[`stock/page.tsx:28`](<../src/app/(workspace)/warehouse/stock/page.tsx>) gọi
`listStock` không phân trang;
[`stock.repo.ts:66`](../src/modules/dept/warehouse/stock.repo.ts) chạy vòng lặp quét 14
lượt × 1.000 dòng rồi đẩy cả 13.229 dòng xuống trình duyệt để `useMemo` lọc. Kiểm kê
cũng vậy, và còn giữ thêm state số đếm cho từng dòng.
*Vi phạm*: nguyên tắc 1 của sổ design-lab.

**③ Một màn ôm bốn nghiệp vụ.**
`DocsManager.tsx` 2.225 dòng = sổ tra cứu + form nhập + form xuất + form trả hàng + xem
chi tiết + đảo phiếu + duyệt kiểm kê. Nút "Lập phiếu nhập" ở màn `/warehouse/nhap` thực
chất là deep-link `?new=receipt` **ném người dùng về sổ chứng từ**. Đang đứng ở luồng
việc thì bị đẩy về sổ tra cứu — đó là lý do luồng nhập cảm giác lòng vòng.

**④ Không có khái niệm NƠI CHỐN.**
Không có khu / kệ / ô. Thủ kho cầm phiếu xuất 12 dòng không có gì chỉ đường đi lấy. Sau
khi nhận hàng cũng không có bước **cất hàng** — hàng vừa nhận và hàng đã xếp kệ là một,
nên không ai biết xe hàng sáng nay đã cất xong chưa.

**⑤ Hàng về mà chưa dùng được thì không có chỗ đứng.**
`qty_rejected` được ghi nhưng **không vào tồn** ([`0010`](../supabase/migrations/0010_warehouse_stock.sql) ghi rõ
BR-10). Hàng loại đang nằm thật ngoài sân mà hệ thống coi như không tồn tại — không ai
theo dõi được nó chờ trả NCC hay chờ huỷ. `qc_status` có ba giá trị nhưng không có kho
"chờ kiểm": nhận là vào thẳng tồn dùng được.

**⑥ Kiểm kê không phải một chứng từ có phạm vi.**
Không có "đợt kiểm kê" (khu nào, ai đếm, chốt sổ lúc nào). Có một form 13.229 dòng và
một nút. Hệ quả đo được: phiếu duy nhất từng lập là phiếu xoá sạch toàn kho về 0.
*Vi phạm*: nguyên lý 1.1 (chứng từ là nguyên tử) — kiểm kê là chứng từ nặng nhất trong
kho mà đang không có vòng đời.

### 1.5 Năm thứ đang làm ĐÚNG — đừng đụng vào

- **Không có ô gõ số tồn trực tiếp.** Tồn là view tổng hợp từ sổ nhập/xuất. Đúng nguyên
  lý 1.1, và nhiều app quản lý không làm được.
- **Phiếu đảo** `reversal_of_doc_id` + bắt buộc lý do. Đúng nguyên lý 1.4.
- **Kiểm kê có bước duyệt** (`0157`) — tồn chưa đổi tới khi quản lý Kho duyệt.
- **Dung sai nhận vượt** `over_tolerance_pct` và **chốt thiếu** `closed_short_at` — đây
  là đường ngoại lệ làm đúng tiêu chí 2.4.
- **Màn `/warehouse/nhap` chia Quá hẹn / Hôm nay / Sắp tới** — đúng mẫu Odoo activity.
  Đây là màn duy nhất trong khu Kho đang trả lời một câu hỏi thay vì trưng một bảng.

---

## 2. Đối chiếu năm ERP — kho được tổ chức quanh cái gì

### 2.1 Bảng khái niệm

| Khái niệm | SAP MM/WM | Odoo | Dynamics 365 / BC | NetSuite | **HG-ERP** |
| --- | --- | --- | --- | --- | --- |
| Đơn vị biến động | Movement type (101/201/311…) | `stock.move` giữa 2 địa điểm | Item ledger entry + reason code | Inventory transaction | `direction` + `ref_type` (6 giá trị) |
| Nơi chốn | Storage location → Bin | Location (cây, có địa điểm ảo) | Zone → Bin | Location → Bin | **không có** |
| Trạng thái của lượng | Unrestricted / QI / Blocked | theo location | Blocked, Item status | Inventory Status | **không có** |
| Giữ chỗ | Reservation (đối tượng riêng) | Reserved khi "Check availability" | Reservation entry | Committed qty | `reserved` tính từ LSX ✅ |
| Cất hàng | Put-away strategy | Receipt 2 bước (Input → Stock) | Put-away worksheet | Bin putaway | **không có** |
| Lấy hàng | Transfer order / Pick | Delivery 2 bước (Pick → Out) | Pick worksheet | Pick task | **không có** |
| Kiểm kê | Physical inventory doc, đóng băng sổ, cycle count ABC | Inventory adjustment theo location | Physical inventory journal + counting period | Inventory Count (có phạm vi) | 1 form 13k dòng |
| Tồn dự kiến | MD04 stock/requirements list | Forecasted qty | **Item availability by Event** | Available/Expected | **không có** |
| Đối chiếu tiền | Three-way match | Landed cost + bill | Invoice matching | Three-way | GĐ2 |

### 2.2 Bốn khái niệm PHẢI nhập khẩu

#### ① Nơi chốn là thuộc tính của LƯỢNG (chép Odoo)

Ý tưởng gọn nhất trong cả năm hệ là của Odoo: **mọi thứ đều là một lần di chuyển giữa
hai địa điểm.** Nhận hàng = chuyển từ địa điểm ảo *"Nhà cung cấp"* vào *Kho*. Cấp cho
sản xuất = *Kho* → *"Sản xuất"*. Huỷ = *Kho* → *"Phế liệu"*. Kiểm kê lệch = *Kho* →
*"Điều chỉnh tồn"*.

Cái hay không nằm ở chỗ gọn, mà ở chỗ: **tổng trên mọi địa điểm luôn bằng 0**, nên mọi
chênh lệch đều có một đầu đối ứng có tên. Không có lượng nào "biến mất". Hiện HG-ERP
mỗi dòng sổ chỉ có **một** đầu — hàng loại QC là ví dụ: nó đi đâu thì sổ không nói.

Hệ quả thực tế cho một xưởng một kho: `shelf_location` phải rời khỏi bảng vật tư và trở
thành **`bin_code` trên dòng sổ nhập/xuất**. Tồn khi đó là tổng theo cặp (vật tư, vị
trí) — một mã nhôm nằm ở ba giá kệ là chuyện bình thường và hệ thống nói được.

#### ② Trạng thái của lượng (chép SAP stock type / NetSuite inventory status)

SAP chia tồn làm ba loại ngay từ lúc nhận: **Unrestricted** (dùng được) / **Quality
Inspection** (chờ kiểm) / **Blocked** (khoá). Cùng một mã, cùng một kệ, ba con số khác
nhau, và chuyển giữa chúng là một bút toán có người ký.

Đây là chỗ vá lối mòn ⑤. Hàng NCC giao sai quy cách hiện nay hoặc bị từ chối (không vào
sổ, biến mất khỏi hệ thống) hoặc bị nhận bừa vào tồn dùng được. Với ba trạng thái thì
nó **nhận vào trạng thái KHOÁ** — có mặt trong sổ, đếm được, chờ quyết định trả NCC hay
huỷ, và **không** lọt vào số khả dụng khi tính đủ/thiếu cho lệnh sản xuất.

#### ③ Lý do biến động là một thứ CÓ KIỂU (chép SAP movement type)

SAP có ~200 movement type; ta không cần 200, ta cần **12**. Điều đáng chép không phải số
lượng mà là: **mã lý do quyết định luôn ba thứ** — trường đối ứng nào bắt buộc, có phải
duyệt không, có đụng giá vốn không.

Hiện HG-ERP tán ý niệm "vì sao" ra ba chỗ rời nhau: `docs.kind` (4 giá trị),
`movements.ref_type` (6 giá trị), và ô `reason` văn bản tự do. Không chỗ nào ràng buộc
được "xuất huỷ thì bắt buộc có lý do" hay "nhập ngoài đơn thì bắt buộc có NCC".

#### ④ Tồn dự kiến theo thời gian (chép Dynamics *Item availability by Event*)

Câu người cung ứng và người lập kế hoạch thật sự hỏi không phải "hôm nay còn bao nhiêu"
mà **"đến ngày xưởng cần thì còn bao nhiêu"**. Dynamics bày một dòng thời gian: mỗi
chứng từ vào/ra là một mốc, cột cuối là tồn dự kiến sau mốc đó.

HG-ERP đã có đủ ba mảnh dữ liệu để dựng — tồn hiện tại, đợt giao NCC đã hẹn
(`supply_po_shipments`), nhu cầu LSX đã duyệt (`reservedByCommittedLsx`) — nhưng chưa
ghép lại thành một hình. Đây là thứ **rẻ nhất mà giá trị cao nhất** trong cả tài liệu.

### 2.3 Sáu thứ KHÔNG chép

Theo đúng luật "đừng thêm khái niệm cho tới khi đau":

| Không làm | Vì sao |
| --- | --- |
| **Lô / serial** (batch, serial number) | Nhôm–gỗ–vải nội thất không truy xuất theo lô. Thêm vào là mỗi dòng phiếu đẻ một bảng con. |
| **Nhiều kho + hàng đang đi đường** (in-transit) | Một xưởng, `warehouses` đúng 1 dòng. |
| **Sóng lấy hàng / chiến lược cất hàng tự động** | 2 phiếu xuất / 2 tháng. WMS thật bắt đầu từ vài trăm phiếu/ngày. |
| **Giá vốn FIFO / bình quân** ngay đợt này | Kế toán GĐ2. Cột `unit_cost` cứ ghi tiếp, đừng dựng lớp tính giá. |
| **Kỳ kế toán, khoá sổ** | Chưa ai chốt sổ theo tháng. Làm sớm là mỗi lần sửa phải xin mở kỳ. |
| **In tem mã vạch / backflush theo QR** | Đã chốt KHÔNG làm. Quét mã vạch **có sẵn của NCC** thì giữ (`ScanInput` đang chạy). |

---

## 3. Luồng mới — sáu bước

### Bước 1 · Câu hỏi nghiệp vụ của từng vai

| Vai | Câu hỏi | Màn trả lời |
| --- | --- | --- |
| Thủ kho | Hôm nay tôi phải **nhận gì, cất gì, cấp gì**? | A · Bàn làm việc kho |
| Tổ trưởng SX | Lệnh này **còn thiếu gì, lấy ở đâu**? | D · Phiếu cấp vật tư |
| Quản lý kho | Mã nào **sắp hết / đang khoá / lệch sổ**? Phiếu nào **chờ tôi duyệt**? | C · Tồn kho + hộp thư chung |
| Cung ứng | Đặt rồi **về chưa**, còn thiếu bao nhiêu? | có rồi — `/warehouse/don-ncc` |
| Kế toán | Ai **điều chỉnh** gì, vì sao? | C · Sổ phiếu, lọc theo mã lý do |

Mỗi vai một câu. Vai nào không viết nổi một câu thì vai đó chưa cần màn riêng.

### Bước 2 · Máy trạng thái

Điểm mấu chốt: ở phân hệ Kho, **cái có vòng đời là LƯỢNG, không phải tờ phiếu.** Phiếu
kho gần như không có vòng đời (nháp → ghi sổ → xong, hoặc bị đảo). Lượng mới là thứ đi
qua nhiều tay.

#### 2a · Vòng đời của LƯỢNG

```
                        ┌──────────── trả NCC (X3) ──────► [ra khỏi kho]
                        │
   [NCC]──nhận(N1/N2)──►│  CHỜ KIỂM  │──mở khoá(C2)──►│  DÙNG ĐƯỢC  │
                        │  (qc)      │                │  (ok)       │
                        └─khoá(C3)──►│   KHOÁ         │◄──────┐
                                     │   (blocked)    │       │
                                     └──huỷ(X4)──►[phế]       │
                                                              │
   ┌──────────────────────────────────────────────────────────┤
   │                                                          │
   │  DÙNG ĐƯỢC ──giữ cho lệnh (tự động, không phải bút toán)──► GIỮ CHỖ
   │       │                                                       │
   │       └────── cấp cho lệnh (X1) ──────────────────────────────┘
   │                        │
   │                        ▼
   │                  [xưởng] ──trả lại vật tư thừa (N3)──► DÙNG ĐƯỢC
   │
   └── chuyển vị trí (C1) ──► DÙNG ĐƯỢC ở kệ khác
```

Phép thử của bước 2 là *"không mũi tên nào cụt"*. Ở đây: `CHỜ KIỂM` ra được bằng C2 hoặc
C3; `KHOÁ` ra được bằng X3 hoặc X4; `GIỮ CHỖ` là **trạng thái tính** (tiêu chí 2.5 —
không ai bấm nút để nó xảy ra, nó là phép so giữa tồn và nhu cầu LSX đã duyệt) nên không
lưu, chỉ hiển thị.

#### 2b · Vòng đời của PHIẾU

```
NHÁP ──gửi──► CHỜ DUYỆT ──duyệt──► ĐÃ GHI SỔ ──đảo──► ĐÃ ĐẢO
  │              │                                        ▲
  └──xoá         └──từ chối──► NHÁP                       │
   (được, vì                                    (phiếu đảo mới, trỏ về
    chưa vào sổ)                                 tờ gốc — không xoá)
```

**CHỜ DUYỆT chỉ áp cho ba mã lý do**: kiểm kê lệch (X5/N4), xuất huỷ (X4), khoá hàng
(C3). Phiếu nhập theo đơn và phiếu cấp cho lệnh **ghi sổ thẳng** — bắt duyệt ở đó là làm
chậm việc hằng ngày để phòng một rủi ro không tồn tại (số đã bị đơn mua và định mức chặn
sẵn hai đầu).

#### 2c · Mười hai mã lý do

Đây là bảng thay cho `ref_type` + `docs.kind` + ô `reason` tự do.

| Mã | Tên | Hướng | Đối ứng **bắt buộc** | Trạng thái vào | Duyệt |
| --- | --- | --- | --- | --- | --- |
| **N1** | Nhập mua theo đơn | vào | dòng đơn mua | chờ kiểm hoặc dùng được¹ | — |
| **N2** | Nhập mua ngoài đơn | vào | NCC + lý do | dùng được | — |
| **N3** | Nhập lại vật tư thừa từ SX | vào | lệnh SX | dùng được | — |
| **N4** | Nhập thừa sau kiểm kê | vào | đợt kiểm kê | dùng được | ✓ |
| **X1** | Cấp cho lệnh SX | ra | lệnh SX | — | — |
| **X2** | Xuất dùng chung / sửa chữa | ra | bộ phận nhận | — | — |
| **X3** | Trả hàng NCC | ra | dòng đơn mua + lý do | — | — |
| **X4** | Xuất huỷ / phế liệu | ra | lý do | — | ✓ |
| **X5** | Xuất thiếu sau kiểm kê | ra | đợt kiểm kê | — | ✓ |
| **C1** | Chuyển vị trí | chuyển | kệ đi → kệ đến | giữ nguyên | — |
| **C2** | Mở khoá sau kiểm hàng | chuyển | — | chờ kiểm → dùng được | — |
| **C3** | Khoá hàng hỏng / sai quy cách | chuyển | lý do | dùng được → khoá | ✓ |

¹ Theo cờ **"nhóm vật tư này có phải kiểm hàng không"** trên danh mục nhóm — không phải
mọi thứ đều cần kiểm; ốc vít thì không, nhôm định hình và vải thì có.

**C1 là thứ làm cho bước "cất hàng" tồn tại mà không đẻ bảng mới**: nhận hàng vào kệ ảo
`TIẾP-NHẬN`, cất hàng = một phiếu C1 từ `TIẾP-NHẬN` sang kệ thật. "Chờ cất" khi đó
không phải một trạng thái phải nuôi — nó là **câu truy vấn**: còn gì đang nằm ở
`TIẾP-NHẬN`. Đúng tiêu chí 2.5.

### Bước 3 · Ngoại lệ liệt kê TRƯỚC

Tiêu chí 2.4 nói màn chứng từ ERP thật dành 60–70 % hành động cho ngoại lệ.

| # | Ngoại lệ | Nay | Sau |
| --- | --- | --- | --- |
| 1 | NCC giao thừa trong dung sai | ✅ `over_tolerance_pct` | giữ |
| 2 | NCC giao thiếu, chốt dòng | ✅ `closed_short_at` | giữ |
| 3 | Hàng về sai quy cách / hỏng | ❌ từ chối là mất dấu | **N1 vào trạng thái khoá → X3 hoặc X4** |
| 4 | Mua lẻ không qua đơn | ✅ `external` | **N2** |
| 5 | Xưởng trả lại vật tư thừa | ❌ | **N3** |
| 6 | Vật tư hỏng trong lúc lưu kho | ❌ | **C3 → X4** |
| 7 | Cấp nhầm mã / nhầm lệnh | ✅ phiếu đảo | giữ |
| 8 | Lệnh A mượn vật tư đang giữ cho lệnh B | ❌ | **X1 kèm cờ "cắt chỗ", bắt lý do, báo cho người giữ lệnh B** |
| 9 | Kiểm kê lệch | ✅ có duyệt | **N4 / X5 trong một đợt có phạm vi** |
| 10 | Dời hàng sang kệ khác | ❌ | **C1** |
| 11 | Phiếu đã ghi sổ mà sai | ✅ đảo | giữ |
| 12 | Vật tư gửi NCC gia công | ❌ | **chưa làm** — chờ nghiệp vụ gia công ngoài ổn định |

Nay: 5/12 có đường. Sau: 11/12.

### Bước 4 · Ai giữ bóng

| Trạng thái | Người giữ | Đếm tuổi từ |
| --- | --- | --- |
| Đợt giao đã hẹn, chưa nhận | Thủ kho | ngày hẹn |
| Đã nhận, còn ở kệ `TIẾP-NHẬN` | Thủ kho | giờ ghi phiếu nhập |
| Chờ kiểm | Người kiểm hàng (KCS / tổ trưởng) | giờ nhập |
| Khoá | Cung ứng (quyết trả hay huỷ) | giờ khoá |
| Lệnh đã duyệt, chưa cấp đủ | Thủ kho | ngày duyệt lệnh |
| Phiếu chờ duyệt | Quản lý kho | giờ gửi |
| Đợt kiểm kê đang đếm | Người được phân công đếm | giờ mở đợt |

Trạng thái nào không có tên người trong cột giữa là trạng thái chết. Hiện **"chờ kiểm"
và "khoá" chưa tồn tại** nên hàng loại đang không ai giữ — đúng như lối mòn ⑤ mô tả.

### Bước 5 · Vết

| Chuyển tiếp | Máy ghi | Bắt người ghi lý do |
| --- | --- | --- |
| N1 trong dung sai | có | không |
| N1 vượt dung sai | có | **có** (đang làm đúng rồi) |
| N1 vào trạng thái khoá | có | **có** |
| X1 cấp bình thường | có | không |
| X1 cắt chỗ của lệnh khác | có | **có** + báo người giữ lệnh kia |
| X4 huỷ / phế | có | **có** |
| C3 khoá hàng | có | **có** |
| N4 / X5 kiểm kê lệch | có | **có, từng dòng** |
| Đảo phiếu | có | **có** (đang làm đúng rồi) |

Và: chứng từ kho phải có **`NoteStream` + `Followers`** như đơn mua. Hôm nay khu Kho
chưa có chỗ trao đổi — trong khi đây chính là nơi tranh luận nhiều nhất ("hàng này ai
cho nhập", "sao thiếu 3 cây").

### Bước 6 · Bây giờ mới chọn khuôn màn

---

## 4. Bản đồ màn mới

Tất cả dựng bằng `@/components/kit`. Đường dẫn giữ `/warehouse/*` để không phải khai
`MOVED_PREFIXES`; màn nào đổi chỗ thì khai.

| Màn | Khuôn | Câu hỏi | Thành phần kit chính |
| --- | --- | --- | --- |
| `/warehouse` **Bàn làm việc kho** | **A · Vào việc** | Hôm nay tôi phải nhận gì, cất gì, cấp gì? | `WorkTiles`, `WorkLanes` |
| `/warehouse/nhap` **Nhận hàng** | **B · Hộp thư** | Xe nào đang tới, đợt nào quá hẹn? | `WorkLanes` (Quá hẹn/Hôm nay/Sắp tới) |
| `/warehouse/cat` **Cất hàng** | **C · Danh sách** | Còn gì nằm ở `TIẾP-NHẬN`? | `Table`, `GridToolbar` |
| `/warehouse/cap` **Cấp vật tư** | **B · Hộp thư** | Lệnh nào chờ cấp, thiếu gì? | `WorkLanes`, `CoverageBar` |
| `/warehouse/ton` **Tồn kho** | **C · Danh sách** | Mã nào cần tôi động vào? | `Table` (server-side), `Chip` có số đếm |
| `/warehouse/vat-tu/[id]` **Hồ sơ vật tư** | **E · Hồ sơ danh mục** | Mã này đang ở đâu, dùng vào đâu, mua của ai? | `MetricStrip`, `FactBox`, `Timeline` |
| `/warehouse/phieu` **Sổ phiếu** | **C · Danh sách** | Tra một tờ đã lập | `Table`, `FilterBar` |
| `/warehouse/phieu/[id]` **Phiếu kho** | **D · Chứng từ** | Tờ này ở đâu, ai giữ, vướng gì? | `StatusTrack`, `HolderBar`, `DocChain`, `ActionPane`, `NoteStream`, `Timeline` |
| `/warehouse/phieu/moi` **Soạn phiếu** | **F · Bảng nhập liệu** | Khai 40 dòng nhanh như Excel | `HeadChips`, `Grid*`, `CommitBar` |
| `/warehouse/kiem-ke` + `/[id]` **Đợt kiểm kê** | **D · Chứng từ** | Đợt này đếm tới đâu, lệch gì? | `StatusTrack`, `CoverageBar`, `Grid*` |

### Bốn điều chỉnh khuôn quan trọng

**① Danh mục vật tư chuyển từ khuôn F sang C + E.**
`MaterialsManager.tsx` (1.265 dòng) đang là một bảng sửa-tại-chỗ cho 13.229 dòng danh
mục — tức là dùng **khuôn nhập liệu cho một danh mục**. Danh mục không có vòng đời
duyệt (nguyên lý 1.2); chỗ của nó là **danh sách (C) để tìm + hồ sơ (E) để xem một mã**.
Hồ sơ vật tư mở ra phải trả lời: đang ở kệ nào bao nhiêu · chờ kiểm/khoá bao nhiêu ·
đang giữ cho lệnh nào · mua của ai, giá gần nhất · nằm trong định mức sản phẩm nào ·
biểu đồ tồn dự kiến 8 tuần. Dải hiệu suất `MetricStrip`, **mỗi ô kèm mẫu số**.

**② Tồn kho lọc và phân trang Ở SERVER, mặc định chỉ mã CÓ PHÁT SINH.**
13.229 mã nhưng tập làm việc thật là ~120. Mặc định của màn tồn phải là "mã có tồn ≠ 0
hoặc có phát sinh 90 ngày" — 13.109 mã còn lại là danh mục, tra ở màn danh mục. Kèm dải
`Chip` có số đếm: *Đang giữ · Chờ kiểm · Khoá · Dưới tồn min · Lệch sổ*. Mỗi chip đếm
bằng **đúng hàm trang đích dùng** (nguyên tắc 3).

**③ Kiểm kê thành ĐỢT có phạm vi.**
Mở đợt = chọn **phạm vi** (khu / nhóm vật tư / danh sách mã) + ngày chốt → hệ thống
**đóng băng tồn sổ** của đúng phạm vi đó → phân người đếm → nhập số (lưới F, lưu dở
được) → đối chiếu → duyệt → sinh N4/X5. `CoverageBar` cho biết đếm được bao nhiêu phần
trăm phạm vi. Không bao giờ có nút nào đếm cả 13.229 mã một lượt.

**④ Soạn phiếu tách khỏi sổ phiếu.**
`DocsManager.tsx` 2.225 dòng tách làm ba: sổ (C) · chi tiết (D) · soạn (F). Nút "Lập
phiếu nhập" ở màn nhận hàng đi thẳng tới `/warehouse/phieu/moi?ly_do=N1&dot=...` chứ
không ném về sổ.

---

## 5. Mô hình dữ liệu

Bốn migration, tất cả cộng thêm — **không migration nào sửa số dư**, vì tồn đang là 0.

### 5.1 `NNNN_warehouse_bins.sql` — nơi chốn

```sql
create table if not exists public.warehouse_bins (
  id          uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  code        text not null,                    -- 'A-01-3', 'TIEP-NHAN', 'KHOA'
  name        text,
  kind        text not null default 'store'
              check (kind in ('store','receiving','blocked','scrap','production')),
  is_active   boolean not null default true,
  unique (warehouse_id, code)
);
alter table public.warehouse_movements
  add column if not exists bin_id uuid references public.warehouse_bins(id);
```

`kind` phân biệt kệ thật với **kệ ảo** (`receiving` = chờ cất, `blocked` = hàng khoá,
`scrap` = phế, `production` = đã xuống xưởng). Đây là cách chép ý "địa điểm ảo" của Odoo
mà không phải dựng cây địa điểm.

`warehouse_materials.shelf_location` **giữ nguyên, đổi nghĩa** thành *"kệ gợi ý mặc
định"* — điền sẵn khi cất hàng. Không xoá cột (5 dòng đang dùng, và nó hữu ích thật).

### 5.2 `NNNN_warehouse_stock_status.sql` — trạng thái của lượng

```sql
alter table public.warehouse_movements
  add column if not exists stock_status text not null default 'ok'
    check (stock_status in ('ok','qc','blocked'));
alter table public.warehouse_material_groups   -- hoặc taxonomy hiện hành
  add column if not exists needs_inspection boolean not null default false;
```

View `warehouse_stock` dựng lại: gộp theo **(material_id, bin_id, stock_status)**, và
thêm view cuộn `v_warehouse_stock_by_material` với bốn cột `qty_ok / qty_qc /
qty_blocked / on_hand`. Mọi chỗ đang tính đủ–thiếu phải đọc `qty_ok`, không đọc
`on_hand`.

### 5.3 `NNNN_warehouse_reason_codes.sql` — mã lý do

```sql
create table if not exists public.warehouse_reason_codes (
  code            text primary key,             -- 'N1'…'C3'
  name            text not null,
  direction       text not null check (direction in ('in','out','move')),
  requires        text[] not null default '{}', -- 'po_line','lsx','supplier','bin_from','reason'
  needs_approval  boolean not null default false,
  affects_cost    boolean not null default false,
  sort_order      int not null default 0
);
alter table public.warehouse_movements
  add column if not exists reason_code text references public.warehouse_reason_codes(code);
```

`ref_type` **giữ nguyên** cho 265 dòng cũ; dòng mới bắt buộc có `reason_code`. Ánh xạ
cũ→mới làm trong service, không viết lại lịch sử. Sau 3 tháng không còn ai đọc `ref_type`
thì mới bỏ.

### 5.4 `NNNN_warehouse_stocktakes.sql` — đợt kiểm kê

```sql
create table if not exists public.warehouse_stocktakes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,              -- DKK-2026-0001
  scope_kind   text not null check (scope_kind in ('bin','group','list')),
  scope_ref    jsonb not null,                    -- {bin_ids:[]} | {groups:[]} | {material_ids:[]}
  freeze_at    timestamptz,                       -- chốt sổ: tồn sổ đóng băng tại đây
  status       text not null default 'open'
               check (status in ('open','counting','review','approved','cancelled')),
  assigned_to  uuid references public.users(id) on delete set null,
  ...
);
alter table public.warehouse_stocktake_lines
  add column if not exists stocktake_id uuid references public.warehouse_stocktakes(id) on delete cascade,
  add column if not exists book_qty_frozen numeric(14,2);
```

`book_qty_frozen` là thứ hôm nay đang thiếu: không đóng băng thì người đếm xong 2 tiếng,
trong lúc đó có phiếu nhập, và chênh lệch tính ra sai mà không ai biết.

### 5.5 `v_warehouse_projection` — tồn dự kiến

View/RPC gộp ba nguồn đã có sẵn, không cần bảng mới:

| Nguồn | Dấu | Mốc thời gian |
| --- | --- | --- |
| `v_warehouse_stock_by_material.qty_ok` | + | hôm nay |
| `supply_po_shipments` chưa nhận | + | `expected_date` |
| Nhu cầu LSX đã duyệt chưa cấp | − | ngày bắt đầu lệnh |

Trả về dòng thời gian theo tuần cho một mã. Đây là mảnh dựng nên đồ thị trên hồ sơ vật
tư và cột "đủ tới ngày nào" trên màn cấp vật tư.

---

## 6. Lộ trình — bốn đợt

Xếp theo **lợi ích / công sức**, mỗi đợt đứng một mình được (dừng giữa chừng vẫn dùng
được).

### Đợt 1 — Chữa cái đau ngay, không đụng mô hình — **XONG 15/09/2026**

Không cần quyết gì. Đây là sửa lỗi, không phải thiết kế lại.

**1. `/warehouse/stock` — lọc, đếm và phân trang Ở SERVER.** ✅

Đo trước khi sửa: mỗi lần mở màn là **3,35 MB · 13.229 dòng · 6,9 giây**. Sau: một
trang 50 dòng, ~160 KB.

- Năm rổ, mỗi rổ đeo số đếm: *Đang có tồn · Dưới mức tối thiểu · Hết hàng · Thiếu
  cho LSX · Cả danh mục*. Mặc định là **Đang có tồn**, không phải cả danh mục; rổ
  "Cả danh mục" vẫn còn và **ghi rõ 13.229** nên không ai tưởng bị giấu hàng.
- Rổ `short` đi đường riêng: `available` cần `reserved`, không nằm trong view SQL.
  Nó KHÔNG quét cả danh mục — tập có giữ chỗ bị chặn bởi số dòng định mức của các
  lệnh đang cam kết.
- Bộ lọc **sống trên URL**, không trong `useState`: F5 không mất lọc, gửi link ra
  đúng danh sách đó, nút Lùi chạy đúng. Deep-link cũ `?low=1` / `?short=1` giữ
  nguyên.
- Xuất CSV vẫn xuất **cả tập khớp lọc** chứ không mỗi trang đang xem — xuất 50 dòng
  rồi đặt tên tệp "ton-kho" là một tệp nói dối.
- Tắt phân trang trong `DataTable` (mặc định 25 dòng/trang ở client): để cả hai thì
  có hai thanh phân trang lồng nhau và không ai biết mình đang ở đâu.

**2. `/warehouse/stocktake` — bắt chọn phạm vi trước.** ✅

Vào thẳng giờ **0,06 MB · 0 dòng** thay vì 3,35 MB · 13.229 dòng, và hiện màn chọn
phạm vi (14 nhóm, hoặc gõ mã/tên). Nút *Ghi phiếu kiểm kê* chỉ hiện khi đã đếm được
dòng nào.

Đây không phải trạng thái rỗng cho đẹp: nó thay cho một biểu mẫu 13.229 dòng giữ
state đếm từng dòng, và biên bản DUY NHẤT từng lập bằng màn đó là `KK-2026-0004`
ngày 15/09/2026 — xoá sạch 116 mã về 0.

**3. Tách `DocsManager.tsx` — KHÔNG LÀM, có lý do.** ⏸

Đo lại thì `/warehouse/docs` chỉ **0,28 MB**: 2.225 dòng là vấn đề *bảo trì*, không
phải vấn đề dữ liệu — khác hẳn hai màn trên. Và Đợt 2–3 **thay hẳn màn này**: phiếu
nhập thành Khuôn D có kệ + trạng thái lượng, soạn phiếu thành Khuôn F chạy theo mã
lý do. Tách bây giờ rồi viết lại ở Đợt 2 là làm hai lần một việc.

Việc này gộp vào Đợt 3, lúc mã lý do quyết định bộ cột của lưới — khi đó tách file
là hệ quả tự nhiên của việc dựng lại, không phải một lượt refactor riêng.

### Đợt 2 — Nơi chốn + trạng thái của lượng  *(~3 ngày)* ⭐ đợt quan trọng nhất

Migration 5.1 + 5.2. Thêm màn **Cất hàng**. Phiếu nhập chọn kệ. Hàng loại vào trạng
thái khoá thay vì biến mất. Màn tồn tách bốn cột.

**Phải làm trước khi nạp tồn thật.** Sau khi có tồn, việc này biến từ "thêm cột" thành
"chia lại số dư từng mã theo kệ và theo trạng thái" — làm bằng tay, và sai thì không ai
phát hiện ra.

### Đợt 3 — Mã lý do + đợt kiểm kê  *(~3 ngày)*

Migration 5.3 + 5.4. Mở đường cho 6 ngoại lệ đang không có lối. Kiểm kê thành chứng từ
có vòng đời + đóng băng sổ.

### Đợt 4 — Tồn dự kiến + hồ sơ vật tư (khuôn E)  *(~2 ngày)*

View 5.5. Hồ sơ vật tư thay bảng sửa-tại-chỗ. Đồ thị 8 tuần. `NoteStream` + `Followers`
trên phiếu kho.

---

## 7. Luật kiểm — khi nào coi là xong

Ngoài 14 luật của `/design-lab`, phân hệ Kho thêm bảy:

1. **Không màn nào nạp quá 200 dòng** trong một lượt.
2. **Không có ô nào gõ được số tồn.** Tồn chỉ đổi qua phiếu. (Đang đúng — giữ.)
3. **Mọi lượng đều có nơi chốn.** Không có dòng sổ nào `bin_id` rỗng sau đợt 2.
4. **Mọi lượng đều có trạng thái**, và số dùng để tính đủ–thiếu là `qty_ok`, không bao
   giờ là `on_hand`.
5. **Mọi biến động có mã lý do**, và mã lý do quyết định trường bắt buộc — không có ô
   "lý do" tự do đứng thay.
6. **Hành động bị chặn nói vướng gì và cách gỡ, ngay tại chỗ.** Ví dụ: cấp vật tư mà
   thiếu → nói *"còn 12/40 cây, 28 cây đang chờ kiểm từ phiếu PNK-2026-0031"* kèm liên
   kết tới phiếu đó, không phải *"không đủ tồn"*.
7. **Số trên bàn làm việc là lời hứa.** Ô "Chờ cất 7" bấm vào phải ra đúng 7 dòng — đếm
   bằng chính hàm màn đích dùng.

---

## 8. Ba điều cần chủ dự án quyết trước khi làm

Ba câu này là **nghiệp vụ**, không phải giao diện. Làm sai thì không sửa được bằng CSS.

1. **Kho có kệ đánh mã không?** Nếu xưởng chưa đánh mã kệ ngoài thực địa thì đợt 2 phải
   bắt đầu bằng việc đánh mã (dù chỉ 8–12 khu thô: NHÔM-A, VẢI, PHỤ-KIỆN, SƠN…). Không
   có mã kệ thật thì `bin_id` chỉ là một ô rỗng nữa.

2. **Có ai kiểm hàng trước khi nhập không, và là ai?** Nếu thủ kho vừa nhận vừa kiểm thì
   trạng thái `qc` không cần — chỉ cần `ok` và `blocked`, đơn giản hơn hẳn. Nếu có KCS
   riêng thì giữ đủ ba.

3. **Cấp vật tư cho xưởng đang thật sự diễn ra thế nào?** Sổ ghi 1 dòng trong 2 tháng,
   nghĩa là việc thật đang chạy ngoài hệ thống. Cần biết **ai** ra kho lấy, lấy theo
   **giấy gì**, và ký ở đâu — rồi mới thiết kế màn cấp. Đây là câu quan trọng nhất trong
   ba câu: mọi thứ khác trong tài liệu này đều đúng dù trả lời thế nào, riêng màn cấp
   vật tư thì không.
