# Phòng Bán hàng — hoàn thiện từng chức năng + bổ sung phần còn thiếu

Viết 07/10/2026. Số đo lấy từ CSDL thật cùng ngày (script chỉ đọc), mã nguồn
lấy ở `origin/main` (e436eea — đã gồm Trang chủ, Kế hoạch xuất, Phân tích,
màn chia đợt 0222 làm ngày 06/10).

> **Lưu ý trước khi code**: thư mục chính `D:\HG-ERP` đang đứng ở nhánh
> `gop/thu-muc-chinh-1007` (ad54cca), THIẾU toàn bộ phần Sale 06/10. Nhánh này
> là tổ tiên của `origin/main` nên fast-forward sạch: `git merge --ff-only origin/main`.

## 1. Hiện trạng đo được (07/10/2026)

**Người dùng.** Phòng Bán hàng có 2 người thật: Phương (32 đơn) và Hằng
(21 đơn), đều vai `employee`. Không có trưởng phòng trong hệ thống. Sổ "TỔNG HỢP
ĐƠN HÀNG CÒN LẠI" do Diên giữ — Diên không thuộc phòng Bán hàng trên hệ thống.

**Khách hàng.** Master `sales_customers` có **8** khách (MERXX, LAURA, ROSCO,
YOTRIO, GIGA, BLACKIN, JAWOLL, BUNNINGS). Nhãn khách trên hồ sơ SP có **38**
giá trị khác nhau (CASUAL 17, BUNNING 12, LANDCAMPING 9, ALPHAMARTS 9…). Hồ sơ
khách mỏng: quốc gia 3/8, người liên hệ 2/8, điều khoản mặc định 2/8, cảng dỡ 2/8.

**Báo giá.** 6 báo giá (4 nháp, 2 đã gửi), cái mới nhất 09/08/2026 — **hai tháng
không ai dùng**. 0/53 đơn hàng sinh ra từ báo giá. Dòng báo giá không có SL
(3/8 null). Báo giá thật của Sale làm trên Drive: 135 sổ Quotation, mỗi SP một
sheet định mức → cộng chi phí chung + lợi nhuận = giá FOB (xem
[[drive-bao-gia-sale-quet-1003]]).

**Đơn hàng.** 53 đơn, 100% USD, trị giá 3,40 triệu USD, 275 dòng.

| Chỉ số                                         | Số đo       | Nghĩa                                              |
| ---------------------------------------------- | ----------- | -------------------------------------------------- |
| Dòng có đơn giá > 0                            | 270/275     | đợt "Điền đơn giá" đã làm xong việc (48 lần ghi)   |
| Đơn có số PO khách                             | 34/53       | 19 đơn không có số PO để in lên LSX/hợp đồng       |
| Đơn có hạn giao (`due_date`)                   | 44/53       |                                                    |
| Dòng có ngày xuất (`ship_date`)                | 198/275     | 77 dòng không biết xuất tháng nào                  |
| Đơn có điều khoản hợp đồng (TT, cọc, cảng, incoterm) | **0/53** | bản in Sales Contract trống Article 3–5            |
| Đơn có tỷ giá                                  | 53/53       | 0219 chạy đúng                                     |
| Trạng thái                                     | 48 `lsx_issued` · 5 `completed` | `in_production` = 0: trạng thái không phản ánh xưởng |
| Lần ghi XUẤT thật (`sales_order_shipments`)    | **0**       | 5 đơn MX lệnh đã xong 25/09 (hạn xuất 07–13/09) vẫn chưa ghi xuất, chưa `delivered` |
| Đợt xuất do Sale chia (0222)                   | 0 đợt       | màn chia đợt chưa ai dùng thật                     |

**Lệnh sản xuất.** 19 lệnh (14 đang chạy, 5 xong), 60 nhóm/đợt, 57 có ngày
riêng, 52 có số PO khách. Lệnh gộp nhiều đơn: LAURA 01 có 16 đợt, ROSCO 01 có 13.

**Giá.** Giá thành kế hoạch: 252/807 SP (124 đủ 4 số); SP đang nằm trong đơn
138/143 có giá. Lãi kế hoạch so được trên phần lớn trị giá đơn — khác hẳn 06/10.

**Hoàn toàn chưa có** (không bảng, không màn): hoá đơn bán, công nợ khách,
tiền cọc đã nhận (chỉ có cột `%`), packing list, commercial invoice, booking /
container (chỉ text `container_summary`, 0/53 có), khiếu nại khách, bảng giá
hiệu lực theo khách, yêu cầu mẫu phía Sale.

## 2. Vòng đời đơn bán thật so với hệ thống

Luồng thật của Sale (theo sổ Excel và cách làm hiện nay):

```
Khách hỏi giá → tính giá FOB từ định mức (Excel) → chào giá / revise nhiều đợt
→ khách gửi PO → lập đơn → xin lệnh SX → theo dõi xưởng
→ chia đợt theo PO khách, chốt ngày xuất → đặt booking / cont
→ xuất hàng (packing list, commercial invoice) → thu cọc / thu phần còn lại
→ sau bán (claim, bù hàng)
```

Hệ thống hôm nay phủ **từ "lập đơn" tới "lệnh xong"**. Hai đầu bị hở:

- **Đầu vào** (hỏi giá → chào giá): màn Báo giá có nhưng không ai dùng vì không
  làm được việc thật (không tính giá từ định mức, không có đợt revise).
- **Đầu ra** (xuất hàng → thu tiền): có bảng ghi xuất (0120) nhưng 0 bản ghi;
  không có chứng từ xuất khẩu, không có tiền.

Hệ quả thấy được: sổ "order HG" (ĐÃ XUẤT / LEFT) và sổ của Diên vẫn phải giữ
trên Excel; Phân tích doanh số chỉ nói "đã nhận đơn bao nhiêu", không nói "đã
xuất bao nhiêu, còn nợ xuất bao nhiêu, đã thu bao nhiêu".

## 3. Bản đồ chức năng — có gì, chạy thật chưa, vướng gì

| Chức năng               | Màn / mã                                        | Chạy thật?          | Vướng / thiếu                                                                                                      |
| ----------------------- | ----------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Trang chủ "vào việc"    | `/sales` ERP-block                              | mới (06/10)         | Việc CẢ PHÒNG, chưa lọc theo người phụ trách; chưa có ô "đợt tới hạn xuất chưa ghi xuất"                          |
| Khách hàng              | `/sales/customers`, `[id]` (erp-v2, 650 dòng)   | 8 khách             | 30 nhãn khách trên SP không có trong master; không có tầng "chương trình/brand" (IBIZA thuộc ROSCO); mặc định điều khoản trống |
| Báo giá                 | `/sales/quotes` (shadcn, form 697 dòng) + nhập Excel + in | KHÔNG (dừng 09/08) | Không tính giá từ định mức; không SL; không revise; không nối sang đơn (0/53)                                     |
| Đơn hàng tạo / sửa      | `OrderForm.tsx` **1.510 dòng** shadcn           | có (53)             | Điều khoản hợp đồng không ai điền (0/53); không thừa kế từ khách; 19 đơn thiếu PO khách; 77 dòng thiếu ngày xuất |
| Đơn hàng chi tiết       | `OrderDetailView.tsx` **1.454 dòng** shadcn     | có                  | Ghi xuất nằm ở đây nhưng 0 lần dùng; trạng thái nhảy `lsx_issued → completed`, bỏ `in_production`                |
| Điền đơn giá            | `/sales/orders/gia`                             | xong việc (270/275) | Nav ghi "tạm" — tới lúc rút khỏi menu, giữ đường vào từ ô việc "đơn giá 0"                                        |
| Giá thành kế hoạch      | `/sales/gia-thanh` (kit)                        | có (252 SP)         | Chỉ dán từ sheet; chưa nối sang báo giá                                                                           |
| Phát lệnh SX            | `/sales/lsx` (shadcn, 638 + 338)                | có (19 lệnh)        | Gộp nhiều đơn OK; chưa có chỗ xem lệnh theo khách                                                                 |
| Kế hoạch xuất           | `/sales/ke-hoach-xuat` ERP-block                | mới                 | Chưa Excel; "cần để ý" chưa so với ngày xuất của đợt đã qua                                                       |
| Chia đợt theo PO khách  | `/sales/ke-hoach-xuat` → chia-dot (0222)        | 0 đợt               | Chưa ai chia thật; đợt chia xong chưa dẫn tới "ghi xuất"                                                          |
| Phân tích doanh số      | `/sales/phan-tich` ERP-block                    | mới                 | Chỉ theo đơn nhận; chưa có đã xuất / còn lại / đã thu                                                             |
| In hợp đồng / báo giá   | `/print/orders/[id]`, `/print/quotes/[id]`      | có mẫu              | Hợp đồng in ra trống điều khoản vì dữ liệu 0/53                                                                   |
| Theo dõi                | `/sales/tracking` → redirect `/sales/lsx`       | ngõ cụt             | Xoá hoặc trỏ đúng                                                                                                 |
| Đội nhóm / Báo cáo      | `/team`, `/reports/weekly` dùng chung           | không               | Chưa có bản Sale                                                                                                  |

Bốn hệ giao diện đang sống trong một phòng: ERP-block (3 màn mới), kit (Giá
thành), erp-v2 (Khách, Điền giá, Nhập báo giá), shadcn (Báo giá, Đơn, Lệnh).
Không viết lại cho đều — màn nào có việc nghiệp vụ chạm tới thì chuyển sang
ERP-block (`sales/_erp/ui.tsx`) lúc đó.

## 4. Kế hoạch — bảy đợt, làm từng đợt một

Ba luật xếp thứ tự (chép từ `ke-hoach-thuc-hien.md`): việc không cần chủ dự án
quyết làm trước · việc đang chặn người dùng bỏ Excel ưu tiên cao · không xây
màn cho luồng chưa chạy thật lần nào.

### Đợt 1 — Khép vòng đời đơn: GHI XUẤT thật, "đã xuất / còn lại" như sổ order HG

**Vì sao trước**: có dữ liệu thật để thử ngay (5 đơn MX hàng đã đi), bảng đã
có (0120), không cần migration lớn, và đây là lý do Sale còn giữ Excel.

| Việc                                                                                                   | Ghi chú                                                          |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Nút **Ghi xuất** đi từ ĐỢT (đợt Sale 0222 hoặc nhóm lệnh) — chọn đợt → điền SL thực xuất từng dòng, ngày, số cont/booking → ghi `sales_order_shipments` | Hiện ghi xuất chỉ ở chi tiết đơn, từng dòng — không ai làm vì sổ thật chạy theo đợt |
| Cột **Đã xuất / Còn lại** trên Đơn hàng, Kế hoạch xuất, Phân tích                                     | đọc Σ shipments theo dòng, đúng hàm cho cả ba màn                 |
| Trạng thái đơn: thêm `shipped` (đã xuất hết) + nhãn "xuất một phần"; `completed → delivered` giữ nhưng tự chuyển khi xuất đủ | migration nhỏ: mở rộng check constraint                           |
| Ô việc Trang chủ: **"Đợt đã tới ngày xuất mà chưa ghi xuất"**                                          | thay cho cảnh báo chung "cần để ý"                                |
| Lùi được: xoá bản ghi xuất (đã có `removeShipment`)                                                    |                                                                  |

**Nghiệm thu**: 5 đơn MX (17976, 17984, 17996, 18005, 18014) ghi xuất xong, cột
Còn lại = 0, trạng thái `shipped`; đơn 18014 có 2 dòng ngày xuất đã qua hiện
đúng ở ô việc trước khi ghi, biến mất sau khi ghi.

**Cần chốt**: Q1 — ai bấm "Ghi xuất": Sale (theo sổ order HG) hay Kho / KHSX
(người đóng cont)? Đề xuất: Sale ghi, vì Sale là người biết đợt nào thuộc PO nào.

### Đợt 2 — Đơn hàng đủ dữ liệu thương mại, in hợp đồng chạy thật

| Việc                                                                                              | Ghi chú                                       |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Điều khoản trên đơn **thừa kế** từ khách (incoterm, TT, cảng dỡ, cọc %) — giống mẫu ĐƠN → NCC → MẶC ĐỊNH của Mua hàng | không bắt khai 53 lần                          |
| Form đơn: tách `OrderForm.tsx` 1.510 dòng theo khuôn `useXxx` + khối; đầu đơn gọn, lưới dòng là nhân vật chính | chuyển sang ERP-block luôn vì chạm tới         |
| Bắt PO khách khi phát lệnh (19 đơn đang thiếu → cảnh báo tại chỗ, không chặn đơn cũ)             |                                               |
| 77 dòng thiếu ngày xuất → ô việc "đơn chưa có lịch xuất" đã có, thêm sửa tại chỗ trên lưới        |                                               |
| In Sales Contract: kiểm 1 đơn thật ra đủ Article 1–5                                              |                                               |

**Nghiệm thu**: 53/53 đơn có incoterm + TT (nạp từ mặc định khách sau khi Sale
khai 8 khách), 1 hợp đồng in thật được Sale duyệt chữ.

### Đợt 3 — Khách hàng: master đủ, có tầng chương trình

| Việc                                                                                     | Ghi chú                                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Đối chiếu 38 nhãn khách trên SP với 8 khách master → nạp thêm khách đang giao dịch, gộp nhãn trùng (BUNNING/BUNNINGS) | nhãn trên SP vẫn là TEXT (xem [[free-text-over-fk-catalog]]); master chỉ để có hồ sơ |
| Tầng **chương trình / brand** dưới khách (ROSCO → IBIZA, ARUBA; LAURA → HALI, ARIA…)      | sổ Quotation trên Drive xếp đúng theo tầng này; Q4 hỏi user có cần không     |
| Hồ sơ khách 360 đọc thêm: đơn đang mở, đã xuất, còn lại, lệnh đang chạy, giá thành phủ    | chuyển `CustomerDetail` 650 dòng sang ERP-block                              |
| Người phụ trách bắt buộc; Trang chủ lọc "việc của tôi / cả phòng"                         |                                                                             |

### Đợt 4 — Báo giá theo cách Sale thật sự làm

Hai hướng, cần **Q3** chủ dự án chốt trước khi vẽ:

- **(a) Giữ màn Báo giá, nối với giá thành**: dòng báo giá lấy `plan_price`
  (đủ 4 số thì bày được Trực tiếp + Chung + Lợi nhuận = FOB), có SL, có bản
  revise (bản 1, 2, 3… cùng khách cùng range), gửi → thành đơn kéo đúng giá.
- **(b) Bỏ màn Báo giá, giữ "Bảng giá hiệu lực theo khách"**: mỗi khách × SP
  một giá đang hiệu lực + ngày; đơn mới kéo giá từ đây; Drive vẫn là nơi tính.

Đo để chọn: 2 tháng 0 báo giá mới trên hệ thống, nhưng 135 sổ trên Drive. Hướng
(b) nhẹ hơn và khớp cách làm hiện nay; (a) đúng ERP hơn nhưng Sale phải bỏ sheet
tính giá — chưa chắc chịu.

### Đợt 5 — Chứng từ xuất khẩu từ đợt xuất

| Việc                                                                 | Cần gì                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Packing list** sinh từ đợt đã ghi xuất                             | SL thùng, kích thước thùng, NW/GW, CBM — hồ sơ SP có `packing.*` nhưng CBM mới 39/291 dòng đơn |
| **Commercial / Proforma invoice**                                    | giá dòng + điều khoản (Đợt 2) + seller block (`settings` đã có bank/swift) |
| Booking / container thành dữ liệu (số cont, seal, ETD, hãng tàu)     | migration mới `sales_shipments` cấp đợt thay cho text                     |

**Cần chốt**: Q5 — ai lập chứng từ XK (Sale hay Kế toán/XNK)? Nếu Kế toán thì
đặt màn ở Tài chính, Sale chỉ xem.

### Đợt 6 — Tiền: cọc, hoá đơn bán, công nợ khách

Thuộc GĐ C.② của kế hoạch go-live ([[plan-go-live-erp]]): công nợ khách = Σ đợt
xuất (Đợt 1) × giá − tiền đã thu; cọc nhận theo đơn; tỷ giá đã có. Làm sau Đợt 1
và chỉ khi Kế toán vào nhịp. **Q6**: làm ở Sale hay Tài chính.

### Đợt 7 — Dọn và đồng bộ

- Xoá `/sales/tracking` (redirect ngõ cụt); rút "Điền đơn giá" khỏi menu khi
  dòng giá 0 về 0 (còn 5), giữ đường vào từ ô việc Trang chủ.
- Kế hoạch xuất: xuất Excel (sổ Sale vẫn cần gửi khách/KHSX).
- "Cần để ý" của Kế hoạch xuất hợp nhất một hàm mốc với cảnh báo đơn mua
  (xem [[lich-giao-canh-bao-ngay-xuat-1006]]).
- Đội nhóm / Báo cáo: bản Sale = Phân tích + việc của tôi, không dựng trang mới.

## 5. Sáu câu cần chủ dự án chốt

| #  | Câu hỏi                                                                                   | Chặn đợt | Đề xuất                                   |
| -- | ----------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| Q1 | Ai ghi "đã xuất": Sale hay Kho/KHSX?                                                      | 1        | Sale ghi theo đợt; Kho ghi phiếu xuất kho riêng |
| Q2 | Trạng thái `in_production` bỏ hẳn, hay nối từ ghi sản lượng của Thống kê?                 | 1        | Bỏ khỏi máy trạng thái, bày tiến độ xưởng bằng cột riêng |
| Q3 | Báo giá: giữ màn + nối giá thành (a) hay thay bằng bảng giá hiệu lực (b)?                 | 4        | (b)                                       |
| Q4 | Khách master: nạp đủ 30 nhãn còn lại hay chỉ khách đang có đơn? Có tầng chương trình không? | 3      | Khách đang có đơn + có tầng chương trình   |
| Q5 | Chứng từ XK ai lập?                                                                        | 5        | Sale lập, Kế toán xem                      |
| Q6 | Công nợ khách đặt ở Sale hay Tài chính, khi nào?                                           | 6        | Tài chính, sau Đợt 1                       |

**Đề xuất bắt đầu**: Đợt 1, vì chỉ vướng Q1 (có thể làm theo đề xuất rồi đổi
người bấm sau), có 5 đơn thật để nghiệm thu, không đụng màn 1.500 dòng nào.

---

## 6. Hoàn thiện tại chỗ ba chức năng: Báo giá · Đơn hàng · Lệnh SX (rà 07/10)

Chủ dự án chốt 07/10: làm ba chức năng này TRƯỚC, các đợt ở mục 4 lùi sau. Rà
mã nguồn từng màn (97 điểm), các lỗi dưới đây đã kiểm lại bằng mã. Xếp thành
**ba tầng**: tầng 1 là lỗi sửa ngay không cần ai quyết; tầng 2 là luồng còn hở;
tầng 3 là màn hình. Mỗi tầng một lượt làm, nghiệm thu riêng.

### 6.1 Báo giá (`/sales/quotes`)

Vì sao chết từ 09/08: form không có giá thành kế hoạch, không có SL, không sửa
được bản đã gửi, và không có nút nào đi sang đơn. Sale định giá thẳng trên đơn
qua "Điền đơn giá" rồi bỏ qua báo giá.

| Tầng | Việc | File | Cỡ |
| --- | --- | --- | --- |
| 1 | Báo giá bị từ chối không sửa được: trang edit redirect mọi trạng thái khác `draft` dù menu có nút Sửa | `quotes/[id]/edit/page.tsx:38` | S |
| 1 | Chiết khấu dòng MẤT khi tạo đơn từ báo giá (đơn ghi giá gộp, bản in gửi khách là giá net) | `OrderForm.tsx:299-308` | S |
| 1 | Báo giá đã gửi không có nút "Tạo đơn hàng"; `/sales/orders/new` không nhận `?quote=` | `QuoteDetailView.tsx`, `orders/new/page.tsx` | S |
| 1 | Hết hiệu lực vẫn gửi / vẫn tạo đơn được; gửi được khi giá 0 | `quotes.service.ts:117-131, 204-211` | S |
| 1 | Giá "lần trước" lấy cả bản nháp, không xét tiền tệ | `quotes.repo.ts:343-374` | S |
| 2 | **Bản sửa đổi** (revise): sao chép thành nháp mới, `revision_no` + `revision_of`, bản cũ `superseded`; kèm **Nhân bản** cho khách khác | service + migration | L |
| 2 | Kết cục báo giá: `won` (tự đặt khi ra đơn) · `lost` (lý do) · `cancelled` | schema + migration | M |
| 2 | Dòng báo giá có **giá thành KH + % lãi**, cảnh báo bán dưới giá thành; chụp `plan_price_snapshot` lúc chào; thêm SL/MOQ tuỳ chọn | `QuoteForm.tsx`, 0220 | M |
| 2 | Nút thông minh trên hồ sơ BG: Đơn hàng n · Bản sửa đổi n · Tài liệu n; mốc trình/duyệt + nút Duyệt cho người có quyền | `QuoteDetailView.tsx` | S |
| 3 | Form dòng SP đang là chuỗi thẻ ~200px/dòng → lưới gọn (Mã · Tên · Giá KH · Đơn giá · CK · Net · Lãi%) + chọn nhiều SP một lần (dùng lại hộp của OrderForm) | `QuoteForm.tsx:430-601` | L |
| 3 | Sổ BG: cột Đơn / Rev / trị giá tham chiếu, lọc "của tôi"; tiêu đề cột dính; bản in có watermark khi chưa gửi + "Rev n" + ngày gửi | `QuotesManager.tsx`, `print/quotes` | M |
| 3 | Nhập Excel: file gốc gắn vào BG, kiểm trùng trước khi tạo SP tạm, ô chọn SP cho dòng mơ hồ | `quote-import.service.ts` | M |

### 6.2 Đơn hàng (`/sales/orders`)

Bốn con số đo được có nguyên nhân rõ trong mã: 0 đợt xuất vì chỉ NGƯỜI TẠO đơn
mới ghi được xuất (đơn nạp script `created_by` null thì không ai ghi được);
0/53 điều khoản vì khối điều khoản ghi "(tuỳ chọn)", gập sẵn, không lấy mặc
định từ khách; 77 dòng thiếu ngày vì dòng từ báo giá/SP mới để `shipDate` rỗng;
`in_production` = 0 vì chỉ bật khi xưởng ghi sổ sản lượng.

| Tầng | Việc | File | Cỡ |
| --- | --- | --- | --- |
| 1 | Ghi xuất gác bằng `assertOwner` → tách quyền `sales.order.ship`, người phụ trách khách cũng là chủ đơn | `orders.service.ts:650-654` | M |
| 1 | Nút "Xác nhận đã giao" gác bằng `canEdit` thay vì quyền `sales.order.confirm_delivery` → GĐ không thấy nút | `OrderDetailView.tsx:681` | S |
| 1 | Xoá dòng / đổi SP trên form sửa XOÁ LUÔN đợt xuất của dòng (FK cascade); giảm SL dưới số đã xuất không bị chặn | `orders.repo.ts:402-411`, `update()` | M |
| 1 | `shippedByOrderIds` viết sẵn nhưng không ai gọi → danh sách không có cột Đã xuất / Còn lại | `orders/page.tsx`, `orders.repo.ts:613` | S |
| 1 | Lịch sử: mốc `lsx_submitted/approved/production_completed` rơi vào nhánh else, hiện thành "Sửa đơn (khách thay đổi)" | `OrderDetailView.tsx:420-437` | S |
| 1 | "Hôm nay" lấy UTC → trước 7h sáng lệch một ngày | `OrdersManager.tsx:242`, `OrderDetailView.tsx:338` | S |
| 1 | Quyền trang tính theo tên phòng "Bán Hàng", service theo RBAC → hiện nút rồi 403 | 4 trang orders | S |
| 2 | Điều khoản **thừa kế từ khách** khi chọn khách + server lấy mặc định khi trống; bỏ chữ "tuỳ chọn", luôn hiện kể cả đơn từ báo giá | `OrderForm.tsx`, `orders.service.ts:227-234` | S |
| 2 | Dòng mới lấy `due_date` làm ngày xuất mặc định; nút "áp tuần giao cho dòng trống"; cảnh báo ngày dòng > hạn đơn | `OrderForm.tsx:306,411` | S |
| 2 | PO khách: bắt buộc (hoặc tick "khách không có PO") + cảnh báo trùng; giá 0 phải tick "chưa có giá" | `OrderForm.tsx:730` | S |
| 2 | Trạng thái `partially_shipped` / `shipped` tính từ Σ đã xuất (có dung sai); xác nhận giao đối chiếu số đã xuất; bỏ hẳn `in_production` hoặc nối từ lệnh `in_progress` | `orders.service.ts:614-633` | M |
| 2 | Sửa đơn sau khi có lệnh: bắt buộc lý do + bước "cập nhật dòng lệnh" (xem 6.3) | `orders.service.ts:277-365` | M |
| 2 | **Một SP nhiều dòng** trong một đơn (ART giao hai tuần) — bỏ ràng buộc trùng SP, khớp dòng theo `line id` | `orders.schema.ts:43,94`, `orders.repo.ts:362` | L |
| 3 | Hộp ghi xuất "một container": lưới nhiều dòng (mặc định = còn lại), cont / booking / invoice có cấu trúc | `OrderDetailView.tsx:1329-1410` | M |
| 3 | Danh sách: tab "Chờ giao" tách khỏi "Đã giao", tab "Xuất dở", chip "Thiếu dữ liệu" (PO / ngày / điều khoản / giá), tìm theo mã SP + mã khách, chân tổng dính | `OrdersManager.tsx` | M |
| 3 | Form: "Dán từ Excel" (ART.No · SL · giá · tuần) dùng lại `price-paste`; lưới dòng đi phím Tab/Enter, gán ngày hàng loạt; combobox khách; 1.510 dòng tách theo khuôn `useXxx` | `OrderForm.tsx` | L |
| 3 | Chi tiết: khối Trao đổi (`doc_notes` kiểu `sales_order`), cảnh báo "Hợp đồng thiếu: …" + nút bổ sung, link hồ sơ khách, ‹ n/N › | `OrderDetailView.tsx` | M |
| 3 | In hợp đồng: PO khách + container, ngày ký riêng, watermark khi thiếu điều khoản/giá, ĐVT theo dòng, tên + chức danh người ký | `print/orders/[id]` | S |

### 6.3 Lệnh sản xuất (`/sales/lsx`)

Năm lỗi làm sai hoặc mất dữ liệu, ba ở màn soạn dòng:

| Tầng | Việc | File | Cỡ |
| --- | --- | --- | --- |
| 1 | **Nạp dòng từ đơn rồi Lưu = XOÁ dòng vừa nạp**: state `groups` chỉ khởi tạo từ props, `router.refresh()` không cập nhật, Lưu gửi payload thiếu, `replaceAll` xoá phần không có | `LsxSheetEditor.tsx:155,358-369` | S |
| 1 | Route nạp dòng (POST lines) không kiểm quyền, không kiểm trạng thái — lệnh đã xong vẫn nạp được | `api/.../lsx/[id]/lines/route.ts:29-34` | S |
| 1 | Lưu lại không đổi gì → `changed_in_rev` của mọi dòng về null, mất dấu ▲ trên phiếu in | `lsx-lines.repo.ts:218` | S |
| 1 | Huỷ MỘT đơn trong lệnh gộp: chỉ gỡ đơn, nhóm + dòng lệnh của đơn còn nguyên; `replaceForLine` nhận id dòng ĐƠN thay vì dòng LỆNH nên không xoá job → xưởng vẫn làm hàng của đơn đã huỷ | `orders.service.ts:553-557` | M |
| 1 | In được lệnh nháp / chờ duyệt / bị từ chối như bản chính (watermark chỉ có ở trang xem trước); Excel cũng vậy | `print/lsx/[id]/page.tsx` | S |
| 1 | Nút "Duyệt lệnh" hiện cho mọi `manager` (RBAC chỉ `director`); `canManage={isMgr}` lộ nút "Nhận vật tư" của Sản xuất ở màn Sale → 403 | `sales/lsx/[id]/page.tsx:124-125` | S |
| 2 | Xoá lệnh nháp / bị từ chối (trả đơn về chờ phát lệnh) + Huỷ lệnh đã duyệt có lý do | `lsx.service.ts` | M |
| 2 | Đổi hạn xuất / số lệnh sau duyệt: ghi vết + phát sự kiện cho xưởng, Cung ứng | `lsx.service.ts:382-417` | S |
| 2 | Lô xuất (0222) kiểm lại khi lệnh có bản sửa (`kiemKeHoach` lúc đọc, cờ "lô lệch lệnh") | `ship-plan.service.ts` | M |
| 2 | "Đồng bộ lại từ đơn" theo nhóm: diff dòng đơn ↔ dòng lệnh, xem rồi áp; lệnh đã phát hành thì sinh revision — gỡ ngõ cụt "muốn thêm bớt thì sửa ĐƠN" | `lsx-lines.service.ts:316` | L |
| 2 | Revision: bắt buộc lý do khi lệnh đã phát hành, ô lý do chỉ hiện khi approved/in_progress, cảnh báo rời trang, kiểm `updated_at`; `replaceAll` thành RPC transaction; bảng `production_order_revisions` | `lsx-lines.*` | M |
| 2 | Lệnh gộp: hoàn thành / giao theo TỪNG ĐƠN hoặc theo lô, không chờ cả khối (LAURA 16 đợt) | `lsx.service.ts:520-566` | L |
| 3 | Workbench: cột Tiến trình có % thật + chấm vật tư + "lô kế tiếp: ngày · PO"; lọc Của tôi / khách / tháng xuất; tìm theo PO | `LsxWorkbench.tsx` | M |
| 3 | Chi tiết: badge "Bản N" + lý do + tô dòng đổi; khối "Kế hoạch xuất (n lô)" link sang chia đợt; tab "Tiến độ & xuất hàng" thay hai tab số liệu xưởng; Trao đổi + Tài liệu; banner "chờ Sale xác nhận giao" có nút | `LsxDetailView.tsx` | M |
| 3 | Phiếu in: lý do sửa, người + ngày duyệt vào ô ký, ngày đầu phiếu = ngày duyệt, hạn xuất | `LsxPrintSheet` | S |

### 6.4 Bốn quyết định cần chủ dự án trước tầng 2

| # | Câu hỏi | Chặn | Đề xuất |
| --- | --- | --- | --- |
| D1 | **Ngày xuất / đợt nằm ở đâu là chuẩn?** Hiện 5 nơi: đầu lệnh · nhóm lệnh · dòng lệnh · lô 0222 · hạn đơn. Mỗi màn đọc một nơi | 6.2 trạng thái xuất, 6.3 lô | Lô của Sale (0222) là chuẩn; đầu lệnh = MIN lô (tự tính); nhóm lệnh chỉ còn là cấu trúc in; bỏ ô ngày ở dòng |
| D2 | Một SP được nhiều dòng trong một đơn (giao hai tuần)? | 6.2 dán Excel, lưới | Có — khớp theo id dòng |
| D3 | Báo giá: giữ màn + bản sửa đổi + giá thành (hướng a) — chủ dự án nói "quản lý báo giá" nên hiểu là giữ | 6.1 tầng 2 | (a) |
| D4 | `in_production`: bỏ hẳn, hay bật khi lệnh sang `in_progress`? | 6.2 trạng thái | Bỏ; tiến độ xưởng bày bằng cột riêng |

### 6.5 Thứ tự làm

1. **Lượt 1 — tầng 1 của cả ba** · ✅ XONG 07/10/2026 (nhánh `feat/sale-luot1-1007`).
   18 việc tầng 1 ở ba bảng trên đều đã sửa, cộng một ngõ cụt lộ ra khi bấm thử:
   admin ôm khách BUNNINGS (0 đơn) mở sổ Đơn hàng ở "của tôi" → sổ trống, không
   có nút chuyển sang "tất cả" (nút chỉ hiện khi có đơn của mình). Nghiệm thu:
   - Test mới: nạp dòng có cửa (3), huỷ đơn trong lệnh gộp xoá đúng nhóm / chặn
     khi đã vào SX (3), bảo vệ dòng đã xuất khi sửa đơn (3), ghi xuất là việc của
     phòng (3), gửi báo giá chặn giá 0 + hết hiệu lực (2), giá net (3). Cả bộ:
     3.625 test xanh, `npm run check` sạch.
   - Bấm thật (phiên admin, 1280×800): sổ Đơn hàng 53 đơn có cột ĐÃ XUẤT; chi
     tiết 18014 có "Xác nhận đã giao" + "Ghi xuất hàng"; BG-2026-0002 có nút
     "Tạo đơn hàng" → `/sales/orders/new?quote=…`; phiếu in lệnh 05/26-27 MX
     (hoàn thành) không watermark. Watermark nháp chỉ kiểm bằng hàm thuần —
     CSDL chưa có lệnh nháp nào.
   - Bốn file vượt trần phải tách helper: `order-form.shared.tsx`,
     `order-detail.shared.tsx`, `orders-manager.shared.tsx`, `lsx-editor/Fixed.tsx`;
     trần baseline hạ 1510→1427, 1454→1419, 861→818, 957→934.
   - Quyền mới `sales.order.ship` tạm = Sale + quản lý; Kho ghi xuất hay không
     chờ Q1.
2. **Lượt 2 — Đơn hàng tầng 2 + màn kiểu ERP** · ✅ XONG 07/10/2026 (D1 D2 D4 chốt theo
   đề xuất; commit 43807d7 logic + commit màn).
   - **Máy trạng thái (0223, CHƯA ÁP — áp qua SQL editor trước khi ghi xuất thật)**:
     bỏ `in_production`; `partially_shipped` / `shipped` SUY từ Σ đợt xuất so Σ SL
     có dung sai (`lib/order-ship-status`, 17 test); suy lại sau mỗi ghi/gỡ đợt;
     lệnh hoàn thành không kéo đơn đã xuất về `completed`; xưởng ghi sổ không
     đổi trạng thái đơn. Xác nhận giao từ completed / xuất dở / xuất đủ, giao
     thiếu bắt lý do.
   - **Ghi xuất một đợt nhiều dòng** (một container) — route nhận cả bản cũ.
   - **D2**: một SP nhiều dòng; repo khớp theo id dòng, form gửi id.
   - **Tạo đơn**: PO khách bắt buộc trừ tick "khách không có PO"; điều khoản
     trống lấy mặc định hồ sơ khách (đơn > báo giá > khách); dòng thiếu tuần giao
     lấy hạn đơn. Sửa đơn đã có lệnh: lý do bắt buộc (form khoá nút + câu "còn
     thiếu"). Khối điều khoản luôn hiện. Nút "Áp hạn giao cho n dòng trống";
     cảnh báo "sau hạn đơn" trên dòng.
   - **Màn kiểu ERP** (khối `sales/_erp/ui.tsx`): sổ đơn `/sales/orders` dựng
     lại phẳng (`SoDonHangScreen` + `useSoDonHang`): 9 ô đếm (vòng đời + Quá hạn
     + Thiếu dữ liệu), lọc phạm vi/khách/tìm cả mã SP·mã khách/sắp, cột Đã xuất
     · còn, cột Thiếu, chân tổng theo tiền tệ. Chi tiết `/sales/orders/[id]`
     dựng lại (`DonHangScreen` + `useDonHang` + 4 khối): công cụ góc phải, 7 ô
     đếm là nút cuộn, hành động mở TẠI CHỖ (ghi xuất nhiều dòng · đã giao · huỷ
     · phát lệnh), lưới dòng 12 cột là nhân vật chính, Tổng quan 3 nhóm có tên,
     cảnh báo "Hợp đồng in sẽ thiếu: …". Xoá `OrdersManager.tsx` (815) và
     `OrderDetailView.tsx` (1419).
   - **Tầng 3 form đơn · ✅ XONG 07/10/2026 (lượt 5)**: form tạo/sửa dựng lại theo
     khuôn F ở `sales/orders/_form/` (`DonHangForm` + `useDonHangForm` +
     `khoi-dau-don` / `khoi-luoi-dong` / `khoi-dieu-khoan` + `don-form.shared`):
     dải đầu đơn một hàng (mã · nguồn · khách gõ-lọc · tiền tệ · PO/tick · hạn
     giao · container); lưới là nhân vật chính — Enter/↑/↓ đi cùng cột, tick nhiều
     dòng, áp tuần giao hàng loạt, "Dán từ Excel" (`lib/order-paste.ts`, 10 test:
     tiêu đề ART.No/QUANTITY/SHIPMENT hoặc đoán cột, `w37.26` ↔ ngày cuối tuần
     ISO, SL kiểu VN "1.390") → tra mã HG **hoặc mã khách** một lượt
     (`GET products?codes=`), mã không khớp thành dòng đỏ chọn SP tại chỗ; SP mới
     khai trong ngăn, tạo vào thư viện lúc lưu; điều khoản gấp được, mồi từ khách
     khi chọn khách; thanh chốt đáy liệt kê "còn thiếu" — mỗi mục BẤM là nhảy tới
     ô. Sửa đơn: dòng đã xuất khoá SP/không bỏ/không giảm dưới số đã xuất
     (`shippedByLine`), đơn đã có lệnh bắt lý do. Xoá `OrderForm.tsx` (1.388)
     + `order-form.shared.tsx`.
   - Đo 07/10 sau khi dựng: 53/53 đơn "thiếu dữ liệu" (điều khoản 53, tuần giao
     ~20, PO 19, giá 5) — ô đếm này là việc dọn của Sale tuần tới.
3. **Lượt 3 — Lệnh SX tầng 2 + màn kiểu ERP** · ✅ XONG 07/10/2026 (commit af88550
   logic + commit màn). Migration **0224 `lenh_sx_vet_thay_doi` CHƯA ÁP** (bảng
   `production_order_changes` + 2 loại thông báo `lsx_cancelled`,
   `lsx_header_changed`); repo chịu được khi bảng chưa có (ghi vết là phụ, lịch
   sử tạm rỗng) — áp xong thì "sync types".
   - **Xoá lệnh nháp / bị từ chối** (đơn về Xác nhận, phát lại được) và **Huỷ lệnh**
     đã phát hành có lý do (đã có công đoạn chạy thì chỉ quản lý; đơn về Xác nhận;
     báo xưởng + Cung ứng; đơn mua KHÔNG tự huỷ).
   - **Đổi đầu lệnh sau duyệt** ghi vết + báo; **D1**: lệnh đã chia lô thì hạn xuất =
     lô sớm nhất (tự tính khi lưu lô, không gõ tay được), đợt xuất của dòng trên
     phiếu in / Excel / màn chi tiết / màn soạn đọc theo LÔ (`lib/lsx-lots`, 10 test);
     ô ngày ở nhóm và dòng BỎ khỏi màn soạn (chỉ đọc + link Chia đợt).
   - **Đồng bộ từ đơn**: so nhóm ↔ dòng đơn (`lib/lsx-sync`, 5 test) → xem trước,
     áp phần tự áp được (thêm / bỏ / đổi SL), SP tách đợt báo chỉnh tay; lệnh đã
     duyệt thì sinh bản phát lại có lý do.
   - **Bản phát lại có kiểm soát**: lý do BẮT BUỘC khi lệnh đã duyệt và payload đổi
     dòng (kiểm trước khi ghi), ô lý do chỉ hiện khi đã duyệt, khoá phiên bản
     `expected_updated_at` (409), cảnh báo rời trang khi chưa lưu, vết `revised`.
   - **Lô lệch lệnh** kiểm lúc đọc bằng chính `kiemKeHoach` → cờ đỏ trên màn chi tiết.
   - **Màn kiểu ERP**: sổ lệnh `/sales/lsx` (`SoLenhScreen`): 8 ô đếm + "Đơn chờ
     lệnh", lưới phẳng với công đoạn thật, vật tư, hạn xuất, lô kế tiếp, đã xếp lô,
     bản N; chi tiết `/sales/lsx/[id]` (`LenhScreen` + 3 khối): công cụ góc phải
     (duyệt / từ chối / gửi duyệt / trình lại / soạn dòng / sửa đầu lệnh / in / Excel
     / ⋯ so với đơn · huỷ · xoá), 7 ô đếm, hành động TẠI CHỖ, lưới dòng theo nhóm,
     Tổng quan 3 nhóm, Đơn trong lệnh (gộp / gỡ), Đợt xuất, Vật tư (đơn mua, ẩn
     tiền), Lịch sử, Tài liệu. Xoá `LsxWorkbench` + `IssueLsxDialog` (phát lệnh làm
     ở trang đơn). Khu Sản xuất vẫn dùng `LsxDetailView`.
   - **Hoàn thành theo từng đơn (mục 6.3 cuối)**: không cần nữa — từ lượt 2 đơn
     xuất / giao độc lập với lệnh hoàn thành (D4).
   - Chưa làm: `replaceAll` thành RPC transaction (cần migration hàm SQL); bảng
     `production_order_revisions` riêng (vết `revised` trong 0224 đã đủ tra).
4. **Lượt 4 — Báo giá tầng 2 + màn kiểu ERP** · ✅ XONG 07/10/2026 (D3 = giữ màn,
   nối giá thành). Migration **0225 `bao_gia_ban_sua_doi_ket_cuc` CHƯA ÁP**
   (`revision_no` · `revision_of` · `lost_reason` · status thêm superseded / won /
   lost / cancelled · `plan_price_snapshot` dòng). Repo dò cột một lần, chưa áp
   thì chạy chế độ cột cũ (bản = 1, không chuỗi, không chụp giá thành) — áp xong
   khởi động lại server + "sync types". Token quản trị trong `.env.local` đã hết
   hạn (401) nên không áp được từ phiên này.
   - **Bản sửa đổi**: sao chép thành nháp bản N+1 trỏ bản trước; gửi bản mới thì
     bản trước sang `superseded`. **Nhân bản** sang khách khác (điều khoản lấy mặc
     định khách mới). **Kết cục**: `won` tự đặt khi tạo đơn từ báo giá (won vẫn
     tạo thêm đơn được), `lost` có lý do, `cancelled`.
   - **Giá thành KH trên dòng** (chỉ người có `technical.plan_cost.view`): giá
     thành hiện tại + chụp lúc chào (`plan_price_snapshot`), net sau CK, lãi KH %,
     cảnh báo dưới giá thành; route `quotes/plan-prices` trả rỗng khi thiếu quyền
     (form vẫn dùng được). SL/MOQ tuỳ chọn trên dòng → trị giá tham chiếu = Σ net ×
     SL. Hiệu lực mặc định hôm nay + 30 ngày. Giá "lần trước" gồm cả `won`.
   - **Màn kiểu ERP**: sổ `/sales/quotes` (`SoBaoGiaScreen`): 9 ô đếm (Đang chào ·
     Nháp · Chờ GĐ · Đã gửi · Thắng · Thua · Hết hiệu lực · Nằm im ≥ 14 ngày · Đã
     đóng), cột Bản / Trạng thái / Hiệu lực / Trị giá tham chiếu / Đơn. Chi tiết
     `/sales/quotes/[id]` (`BaoGiaScreen`): công cụ theo bước (Duyệt-Từ chối ·
     Tạo đơn · Chốt & gửi · Trình GĐ · Bản sửa đổi · Sửa · In · ⋯ Nhân bản / Thua /
     Huỷ / Xoá nháp), 7 ô đếm, hành động tại chỗ, lưới dòng có giá thành · net ·
     lãi, Tổng quan 3 nhóm, Đơn từ báo giá, Các bản, Tài liệu. Form lập/sửa:
     khối dòng chuyển từ chuỗi thẻ sang LƯỚI (SL/MOQ · Giá KH · Đơn giá · CK · Net
     · Lãi), chọn nhiều SP một lượt, hàng chi tiết mở khi cần; helper dời sang
     `quote-form.shared.tsx`. Xoá `QuotesManager` + `QuoteDetailView`.
   - Test: 9 ca mới (revise / supersede / copy / lost / won / snapshot theo quyền /
     hiệu lực mặc định / quoteLineMargin).
   - **In báo giá · ✅ XONG 07/10/2026 (lượt 6)**: `lib/quote-print.ts` (8 test) —
     dải đỏ đầu tờ theo trạng thái (DRAFT / PENDING / SUPERSEDED / CANCELLED /
     EXPIRED theo valid_to; lost/won in sạch), "Quotation No: BG-… · Rev n" +
     dòng "Supersedes: bản trước (ngày)", cột Q'ty (MOQ) + Amount + Total CHỈ khi
     có dòng khai SL (chân bảng nói "n of m items with quantity" khi lẫn), tên
     PDF "BG-… Rev n - Khách". Dòng in nạp thêm `qty`.
     Khối ký bỏ cột "KHÁCH HÀNG / CUSTOMER" (chủ dự án 07/10: khách không ký
     báo giá) — mặc định trong mã + migration 0226 sửa hàng BG của
     `doc_templates` (đã áp thẳng vào DB 07/10, chạy lại vô hại).
   - **Nhập Excel · ✅ XONG 07/10/2026 (lượt 7)**: parser nhận thêm cột **SL / MOQ**
     và **CK %** (tiêu đề VN/EN, không nhầm "SL / thùng"; SL ≤ 0 hay CK ngoài 0–100
     → chặn); dòng mơ hồ (khớp nhiều SP) bày **ứng viên** để chọn tại chỗ + hộp tìm
     SP (`ProductSearchDialog`) cho mọi dòng — dòng "SP mới" đổi được sang SP có
     sẵn; **kiểm trùng trước khi tạo SP tạm**: không mã HG nhưng mã khách khớp đúng
     một hồ sơ của chính khách đó → dùng lại; SP tạm tạo ra gắn `customer_id`
     của báo giá; **file Excel gốc gắn vào báo giá** (`doc_type: quote`, ngăn Tài
     liệu) qua `filesService.attachOrphanToDocument`; màn `/sales/quotes/import`
     dựng lại kiểu ERP (`useImportQuote` + `ImportQuoteScreen`: ô đếm là bộ lọc,
     thanh chốt đáy "còn thiếu" bấm được, chặn trước hai dòng cùng chọn một SP).
     Mẫu Excel `docs/mau/MAU_BAO_GIA_SP_MOI.xlsx` sinh lại 22 cột.
5. **Lượt 5 — tầng 3 form đơn (khuôn F)** · ✅ XONG 07/10/2026 — xem mục Lượt 2 ở trên.
6. **Lượt 6 — in báo giá** · ✅ XONG 07/10/2026 — xem mục Lượt 4 ở trên.
7a. **Rà UI/UX cả phần báo giá** · ✅ 07/10/2026 (user: "cải thiện UI/UX tất cả phần
   báo giá"): sổ — 9 ô đếm không gãy chữ, bảng `table-fixed` 9 cột (Bản gộp vào Số
   BG, Ngày lập gộp vào Người lập, bỏ Incoterm) hết tràn ngang ở 1280; chi tiết — bỏ
   ô "Việc kế tiếp" khỏi dải đếm thành một dòng riêng dưới dải, Tổng quan 2 cột (3 ở
   2xl), nhãn 92px, bảng dòng thu bề rộng cột; form — `sales/quotes/_form/BaoGiaForm`
   + `useBaoGiaForm` theo khuôn F (dải đầu đơn · lưới Enter xuống dòng · thanh chốt
   đáy bấm được), xoá `components/sales/QuoteForm.tsx` (theme v3, thẻ nổi); nhập
   Excel — lưới dày 2 dòng/hàng, cột Tình trạng thay "SP sẽ dùng", ảnh thư viện / ảnh
   nhúng. Soi thật ở 1280×800 cả 4 màn.
7b. **Rà UI/UX cả phần đơn hàng** · ✅ 07/10/2026 (user: "cải thiện UI/UX tất cả phần
   đơn hàng"): sổ — 10 ô đếm rút nhãn + dòng phụ, bảng `table-fixed` 10 cột (PO khách
   gộp dưới Số đơn, "Thiếu" gộp dưới Trạng thái) vừa 1280; chi tiết — "Việc kế tiếp"
   ra khỏi dải đếm thành dòng riêng, Tổng quan md:2 / 2xl:3 cột, nhãn 96px, cột phụ
   320px, bảng dòng `table-fixed` (đo 1003/1003); form — lưới `table-fixed` có
   colgroup, nhãn tuần giao xuống dưới ô ngày, nhãn "Hạn giao" ngắn + hint. Đo tràn
   ngang bằng JS (scrollWidth vs clientWidth) thay vì nhìn ảnh khi pane hẹp.
7c. **Trang nền Sale — Khách hàng** · ✅ 07/10/2026 (user: "làm lại các trang và tính
   năng cơ bản của sale, xuất hàng / tài chính tạm bỏ qua"): `customers/SoKhachScreen`
   (khuôn C: ô đếm Đang giao dịch · Ngừng · Chưa gán · Của tôi · Tổng; lọc phụ trách /
   trạng thái / tìm qua URL, phân trang server; ngăn Thêm khách tại chỗ → chuyển sang
   hồ sơ), `customers/[id]/HoSoKhachScreen` + `useHoSoKhach` (khuôn E: dải hiệu suất
   Doanh số năm · Đơn mở/tổng · Trễ/mở · Báo giá gửi/tổng · SP gắn khách · Đơn gần
   nhất; dải cảnh báo thiếu điều khoản mặc định / hồ sơ in hợp đồng; ngăn Sửa tại chỗ;
   Đơn hàng · Báo giá · Hoạt động), `KhachForm` dùng chung (ô `O`/`INPUT` của
   orders/_form). Form đơn nhận `?customer=` (Trực tiếp + điều khoản mặc định). Xoá
   CustomersManager / CustomerDetail / components/sales/CustomerForm. Khách hàng bổ sung
   (07/10): phụ trách chỉ người Sale, sắp cột, gán hàng loạt, Excel, trùng tên/mã, khối
   SP của khách + Giá đã chào, form lưới 12 cột. **Điền đơn giá** dựng lại khuôn F
   (08/10, `orders/gia/DienGiaScreen` + `useDienGia`, xoá PricingBoardScreen).
7d. **Trang nền Sale — Giá thành kế hoạch** · ✅ 08/10/2026 (user "oke" sau khi đo tình
   hình giá SP: 807 SP, 252 có FOB KH, 124 đủ bảng tính; SP đang chạy 143 → 5 chưa có,
   106 chỉ FOB, 32 đủ; chưa SP đang chạy nào có giá chào vì Sale vẫn chào bằng Excel).
   Trang nền kiểu cũ CUỐI của Sale đổi sang khuôn F kiểu ERP: `gia-thanh/GiaThanhScreen`
   + `useGiaThanh` + `khoi-dan` (ngăn dán tại chỗ, thay hộp Sheet `dan-sheet.tsx` đã
   xoá). Dải đếm Chưa có · Chỉ FOB · Đủ 4 số · Khách thiếu nhiều nhất · Đang sửa; hàng
   "Lần lưu này" (tiền tệ · dấu thập phân · tỷ giá · nguồn); lưới `table-fixed` 12 cột
   có thêm **Đã chào** và **Giá đơn** gần nhất (service `board` thêm `last_quote` /
   `last_order`, `stats.fob_only`) để người nạp thấy số đang bán ngay tại chỗ — KHÔNG
   đưa giá vào hồ sơ SP dùng chung (bí mật Bán hàng, chốt 02/10). Lõi ghép ô gõ với số
   đang có tách ra `lib/plan-cost-draft.ts` (9 test): ô trống = giữ số đang có nếu
   cùng tiền tệ, chỉ FOB, suy trực tiếp, dở dang 1–2 số thì chặn. Hàng chi tiết mở ra
   bày khối chi phí đã dán. Soi 1280 (1053/1053), Enter xuống cùng cột, dán bảng / dán
   khối thử thật, không bấm Lưu. Hết trang nền kiểu cũ của Sale.
7. **Lượt 7 — nhập Excel báo giá** · ✅ XONG 07/10/2026 — xem mục Lượt 4 ở trên. Tầng 3 của ba màn đã hết việc đã liệt kê; còn lại là 7 đợt nghiệp vụ ở mục 4 (bắt đầu Đợt 1 ghi xuất thật) và Q1–Q6.
