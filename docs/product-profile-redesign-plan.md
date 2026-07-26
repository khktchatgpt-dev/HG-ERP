# Kế hoạch chuẩn hoá & mở rộng hồ sơ sản phẩm theo dữ liệu BOM

Nguồn: `C:\Users\HP\Downloads\All Bom` — 247 file Excel + thư mục `DATABASE_SP`
(đã có sẵn một đợt trích xuất thành 4 file CSV + 448 ảnh).

Ngày lập: 2026-07-25. Đối chiếu schema thật trên Supabase (xem
[product-master-data.md](product-master-data.md)).

---

## 1. Hiện trạng dữ liệu nguồn

Đợt trích xuất sẵn có trong `DATABASE_SP/CSV/` đã làm được phần nặng nhất:

| File | Dòng | Nội dung |
|---|---|---|
| `san_pham.csv` | 605 dòng → **438 mã duy nhất** | Hồ sơ SP, 51 cột, đã tách sẵn loại/số thứ tự/mã vật liệu |
| `dinh_muc_vat_tu.csv` | **9.705 dòng / 280 SP** | Định mức chi tiết — phần giá trị nhất |
| `dong_goi.csv` | 121 dòng / 50 SP | Đóng gói, **có nhiều phương án OP1/OP2/OP3** |
| `kich_thuoc_cau_kien.csv` | 151 dòng / 75 SP | Kích thước + trọng lượng từng món trong bộ |

Cơ cấu 438 sản phẩm: Bộ (S) 194, Ghế (C) 169, Bàn (T) 108, Băng/sofa bank (B) 70,
Ngoài trời (O) 50, Giường tắm nắng (SU) 5, Phụ kiện (A) 2.
Vật liệu khung: **nhôm 439, sắt 145, inox 6**, chưa rõ 8.

Đối chiếu với hệ thống đang chạy: DB có 112 SP, **chỉ 24 mã trùng** với bộ file.
Nghĩa là 88 SP trong DB là hàng nhập trực tiếp trên app, còn 414 SP trong file
chưa từng lên hệ thống. Hợp nhất lại khoảng **526 sản phẩm**.

---

## 2. Định mức trong file BOM có gì mà hệ thống chưa có

Đây là phần quyết định thiết kế. Mỗi dòng định mức trong file gồm:

**Nhóm hạng mục** — dữ liệu chia sẵn 6 nhóm, hệ thống hiện **không có khái niệm này**:

| Nhóm | Số dòng | Bản chất |
|---|---|---|
| KHUNG | 5.856 | Chi tiết cắt từ profile nhôm/sắt |
| VẬT TƯ | 2.505 | Ốc vít, phụ kiện, vật tư tiêu hao |
| NỆM & VẢI | 558 | Nệm, gối, vải bọc |
| GỖ / POLYWOOD | 468 | Nan gỗ, tay vịn |
| BAO BÌ | 286 | Thùng, xốp, giấy tổ ong, màng PE |
| KHÁC / DÂY ĐAN | 32 | |

**Cách mô tả vật tư khác hẳn hệ thống.** Ví dụ thật:

```
Chân          | Hộp  | 18 × 70 × 650 mm | dày thành 1.4 | SL 4 | 1.675 kg
Nan ngồi      | Tole | 1.2 × 131 × 468  | dày 1.2       | SL 3 | 0.596 kg
Bu long M6x25 |      |                  |               | SL 6 cái
```

Dòng KHUNG **không trỏ tới mã vật tư nào** — nó mô tả bằng *dạng profile + tiết
diện + độ dày thành*, còn chiều dài là kích thước cắt. Trong khi
`technical_bom_lines` hiện tại bắt buộc `material_id` trỏ vào danh mục kho (khoá
ngoại RESTRICT), mà kho **mới có 7 vật tư**.

**Đây là điểm nghẽn số một của cả dự án**: phải dựng danh mục vật tư trước, suy ra
từ chính dữ liệu này. Ước lượng: **818 quy cách khung khác nhau** (dạng + tiết
diện + độ dày) và **781 tên vật tư/phụ kiện khác nhau**. Sau khi gộp biến thể
chính tả, dự kiến còn khoảng 400–600 mã vật tư thật.

**Các trường hệ thống chưa có chỗ chứa:**

| Dữ liệu trong file | Tỷ lệ điền | Hệ thống hiện tại |
|---|---|---|
| Tên chi tiết (Chân, Tay, Nan ngồi) | 100% | Chỉ có `note` |
| Dạng profile (Hộp/Tròn/La/Vuông/Tole/Ovan) | 58% | Không có |
| Tiết diện Dày × Rộng | 67% | Không có |
| Chiều dài cắt | 68% | Không có |
| Độ dày thành | 53% | Không có |
| Trọng lượng kg | 57% | Không có |
| Diện tích sơn m² | 59% | Không có |
| Tổng chiều dài m | 58% | Không có |
| **Phí hao** | **3%** | **Không có** |
| Bộ phận (món nào trong bộ) | — | Không có |
| Đơn giá / thành tiền | 5% | Chỉ có giá tham khảo cấp SP |

---

## 3. Ba vấn đề cấu trúc lớn

### 3.1 Bộ sản phẩm chiếm 32% nhưng không có mô hình

194/605 dòng là **Bộ** (Set): một bộ gồm Table + Bank I + Bank II + Ottoman.
Hiện `technical_products.set_contents` chỉ là một dòng chữ tự do.

Hệ quả: không tính được định mức của bộ từ định mức các món, không đặt mua theo
bộ, không xếp cont theo bộ. Cần bảng liên kết SP-trong-bộ.

### 3.2 Đóng gói có nhiều phương án, hệ thống chỉ chứa được một

Dữ liệu thật của `S0005HG-AL`:

```
Option 1 — 1 carton/set:  Full   1990×720×860,  xếp 54/cont
Option 2 — 3 carton/set:  Table  1090×630×195,  xếp 71/cont
                          Bank I 1440×770×330
                          Bank III 1915×740×340
Option 3 — 4 carton/set:  Table  1230×630×430,  xếp 32/cont
                          Bank I ×2, Bank II
```

28/50 SP có nhiều kiện hàng. Trường `packing` jsonb hiện tại chỉ chứa **một** bộ
kích thước carton và **một** con số loading — không diễn đạt nổi cấu trúc này, mà
đây lại là dữ liệu chào giá và xếp container.

### 3.3 Định mức không có hao hụt

Đã nêu ở lần rà trước; nay xác nhận file nguồn **có** cột `Phí hao` nhưng chỉ điền
3%. Cần chốt quy tắc mặc định theo nhóm (cắt nhôm, cắt gỗ, vải) rồi cho phép ghi
đè từng dòng.

---

## 4. Mã sản phẩm mới — ĐÃ CHỐT

### 4.1 Cấu trúc

```
[Loại SP 2 ký tự][Số thứ tự 6 chữ số]HG-[Vật liệu]

CH000201HG-IN      Ghế, số 201, inox
TB000002HG-AL      Bàn, số 2, nhôm
ST000031HG-AL      Bộ, số 31, nhôm
BN000012HG-AL      Băng ghế, số 12, nhôm
```

Giữ đúng trật tự của mã đang dùng, chỉ mở rộng mã loại từ 1 lên 2 ký tự và số thứ
tự lên 6 chữ số. Người quen mã cũ đọc mã mới không phải học lại.

### 4.2 Bảng mã loại (7 mã, ánh xạ 1-1 từ dữ liệu hiện có)

| Mã | Nghĩa | Từ mã cũ | Số SP |
|---|---|---|---|
| `TB` | Bàn | T | 108 |
| `CH` | Ghế | C | 169 |
| `BN` | Băng ghế / sofa bank | B | 70 |
| `ST` | Bộ sản phẩm | S | 194 |
| `SL` | Giường tắm nắng | SU | 10 |
| `OT` | Ngoài trời khác (lều, tủ, giường) | O | 50 |
| `AC` | Phụ kiện | A | 2 |

Chuyển đổi hoàn toàn tự động, không phải phân loại lại bằng tay.

### 4.3 Bảng mã vật liệu — theo VẬT LIỆU KHUNG

```
AL nhôm · IR sắt · IN inox · WD gỗ · RA mây/nhựa đan · GL kính · MX hỗn hợp
```

Giữ phân biệt nhôm / sắt / inox vì đó là yếu tố quyết định giá thành, và dữ liệu
đã có sẵn cho toàn bộ 438 sản phẩm (nhôm 439, sắt 145, inox 6).

**"Bọc nệm", "mặt kính" KHÔNG vào mã** — chúng là đặc tính, sẽ là cột riêng trên
hồ sơ để lọc và báo cáo. Lý do: một ghế khung nhôm có nệm thì xếp vào nhôm hay bọc
nệm đều hợp lý, nếu nhét vào mã thì quy tắc không xác định, mã sẽ loạn.

### 4.4 Số thứ tự — giữ nguyên số cũ

Đã chạy thử toàn bộ: **438/438 sinh được mã mới, 0 va chạm.**

Bảng đối chiếu đầy đủ đã sinh sẵn tại
[`docs/import-templates/0-doi-ma-san-pham.csv`](import-templates/0-doi-ma-san-pham.csv)
— gồm mã mới, mã cũ, vật liệu, tên SP, nguồn mã và tên file BOM gốc.

Giữ số cũ để tra ngược được 247 file BOM, 448 ảnh và 24 SP đã có trên hệ thống.
Ngoài ra **vẫn giữ mã cũ trong cột `code_legacy`** vì đơn hàng và báo giá cũ đang
gọi theo mã cũ.

Lưu ý: 7 mã (`C00104HG-IR`, `C00105HG-IR`, `SU001…006HG-*`) bị bộ trích xuất bỏ
trống cột phân rã, đã xử lý bằng cách đọc thẳng từ chuỗi mã.

### 4.5 Phạm vi nạp — toàn bộ 438 sản phẩm

280 SP có định mức thì nạp cả định mức; 158 SP còn lại nạp phần hồ sơ trước, bổ
sung định mức sau. Thư viện đầy đủ ngay để báo giá dùng được.

---

## 5. Kế hoạch sửa đổi hồ sơ sản phẩm

Chia 4 giai đoạn, mỗi giai đoạn dùng được ngay không cần chờ giai đoạn sau.

### Giai đoạn 1 — ~~Danh mục vật tư~~ ĐÃ BỎ KHỎI ĐƯỜNG GĂNG (user chốt 25/07/2026)

**Hồ sơ sản phẩm KHÔNG dính tới kho.** Định mức trong hồ sơ tự mô tả vật tư bằng
quy cách (vật liệu + dạng + tiết diện + độ dày), đúng như file BOM gốc — không
khoá ngoại sang `warehouse_materials`. Nhờ đó nạp được ngay, không phải chờ kho
duyệt danh mục.

Công việc đã làm ở giai đoạn này vẫn dùng: 2.039 mã chuẩn hoá
([báo cáo](material-catalog-stage1.md)) trở thành cột `material_code` dạng **text**
trên từng dòng định mức. Sau này muốn nối sang kho thì join theo mã, không phải
bóc lại từ đầu.

Phần cung ứng / đặt mua vật liệu: **để sau**, không thuộc phạm vi đợt này.

### Giai đoạn 2 — Bảng định mức mới, tự mô tả

Migration [`0092_technical_product_profile.sql`](../supabase/migrations/0092_technical_product_profile.sql)
tạo bảng **`technical_product_parts`** thay vì sửa `technical_bom_lines`.

Lý do tách bảng: `technical_bom_lines` đang gắn khoá ngoại sang kho và đang nuôi
view `v_lsx_material_status` → nhu cầu mua. Để nguyên bảng đó thì phần cung ứng
không bị ảnh hưởng gì, đúng tinh thần "kho tính sau".

Mỗi dòng gồm: nhóm hạng mục, món trong bộ, tên chi tiết, **quy cách vật tư**
(mã chuẩn hoá dạng text, vật liệu, dạng profile, mã khuôn, tiết diện, độ dày
thành, chiều dài cắt), số lượng, đơn vị, phí hao, và các đại lượng file đã tính
sẵn (kg, tổng dài, m² sơn, m³).

**Không đặt ràng buộc duy nhất theo vật tư** — một sản phẩm dùng cùng loại ống cho
chân, tay và khung mê với ba chiều dài khác nhau là ba dòng hợp lệ. Chính ràng
buộc `(product_id, material_id)` của bảng cũ làm hỏng việc nhập từ file BOM.

Phí hao: **không áp con số mặc định nào**. Dòng nào trong file BOM có ghi thì lấy
đúng con số đó (hiện 317/9.705 dòng), còn lại để 0.

Đại lượng kg / m² sơn **lưu lại** chứ không tính ở service, vì công thức phụ thuộc
khối lượng riêng từng loại vật liệu mà dữ liệu không có — Excel đã tính sẵn.

### Giai đoạn 3 — Bộ sản phẩm và đóng gói

Bảng `technical_product_set_items`: bộ gồm những SP con nào, số lượng, nhãn món
("Bank I"). Nhờ đó định mức của bộ suy ra được từ các món.

Thay `packing` jsonb bằng hai bảng, giữ jsonb cũ để không vỡ báo giá đang chạy:

- `technical_packing_options` — phương án đóng gói (OP1/OP2/OP3, ghi chú, số
  carton mỗi bộ, số lượng xếp cont 40'HC).
- `technical_packages` — từng kiện trong phương án: nhãn món, kích thước carton,
  trọng lượng tịnh và cả bì.

### Giai đoạn 4 — Nạp dữ liệu

Thứ tự: vật tư → sản phẩm → định mức → bộ sản phẩm → đóng gói → ảnh.
Nạp bằng upsert theo mã để chạy lại nhiều lần không sinh trùng.

---

## 6. Việc chuẩn hoá dữ liệu phải làm trước khi nạp

**Khử trùng lặp 605 → 438.** 174 dòng là bản sao: tên file chứa `Copy`, `CŨ`,
`BẢN PHỤ`, hoặc cùng mã ở nhiều file (`B0012HG-AL` xuất hiện 4 lần). Quy tắc đề
xuất: lấy bản có `Ngày sửa file` mới nhất và không mang nhãn COPY/CŨ; các bản còn
lại giữ làm lịch sử, không nạp.

**Chuẩn hoá dạng profile.** Cùng một thứ đang có 4 cách viết: `Hộp` / `hộp` /
`HỘP`, `Tròn` / `tròn` / `TRòn`. Ngoài ra cột này còn bị lẫn mã vật tư
(`TD-HG04`, `YHG06`, `DT-BD-02`) — phải tách sang cột khác.

**Chuẩn hoá đơn vị tính.** 75% dòng bỏ trống; phần điền thì có `cái`/`Cái`/`CÁI`/
`cai`, và lẫn giá trị rác như `45000`, `100x27x16`, `63862.84` — dấu hiệu **lệch
cột khi trích xuất**, phải soát tay các dòng này.

**Phân nhóm sai.** Nhóm `GO / POLYWOOD` đang chứa cả `Nệm`, `Gối` — cần phân loại
lại theo tên chi tiết chứ không tin nhóm trong file.

**115 mã đang ở trạng thái "ĐỀ XUẤT - cần duyệt"** và 156 SP thuộc diện "CHƯA CÓ
FILE BOM" (lấy từ file tổng hợp). Cần bạn duyệt trước khi nạp.

**7 dòng thiếu loại SP hoặc số thứ tự** — không sinh được mã mới, phải xử lý tay.

---

## 7. Quyết định đã chốt (2026-07-25)

| Vấn đề | Quyết định |
|---|---|
| Dạng mã | `CH000201HG-IN` — giữ trật tự mã cũ, mở rộng loại lên 2 ký tự và số lên 6 chữ số |
| Mã loại SP | 7 mã: TB · CH · BN · ST · SL · OT · AC (ánh xạ 1-1, tự động) |
| Mã vật liệu | Theo vật liệu khung: AL · IR · IN · WO · RA · GL · MX. Giữ phân biệt nhôm/sắt/inox |
| "Bọc nệm / mặt kính" | Không vào mã — thành cột đặc tính riêng |
| Số thứ tự | Giữ nguyên số cũ. Đã kiểm: 438/438, 0 va chạm |
| Phạm vi nạp | Toàn bộ 438 SP; SP chưa có BOM thì nạp hồ sơ trước |
| Phí hao | Lấy đúng từ file BOM nếu có, không có để 0% — không áp mặc định |

## 7b. ĐÃ THỰC HIỆN (2026-07-26)

Migration [`0092_technical_product_profile.sql`](../supabase/migrations/0092_technical_product_profile.sql)
đã apply. Dữ liệu đã nạp:

| Hạng mục | Kết quả |
|---|---|
| Sản phẩm | **526** (112 cũ + 414 mới) — 519 mang mã mới |
| Dòng định mức | **9.443** thuộc 278 SP |
| Món trong bộ | 114 món / 53 SP |
| Phương án đóng gói | 77 phương án / 121 kiện / 50 SP (17 SP nhiều phương án) |

Định mức theo nhóm: khung 5.811 · phụ kiện 2.422 · nệm & vải 535 · gỗ 372 ·
bao bì 277 · khác 26. **100% dòng có `material_code`** chuẩn hoá.

Kiểm chứng: đối chiếu `B0012HG-AL` với file gốc — từng chi tiết, quy cách, số
lượng và khối lượng khớp chính xác. `S0005HG-AL` giữ đúng 3 phương án đóng gói
(xếp 54 / 71 / 32 cont). `npm run check` sạch: typecheck xanh, 0 lỗi lint,
538/538 test qua. Đã sync lại `database.types.ts` từ schema thật.

### Giao diện

Trang chi tiết sản phẩm ([`ProductProfileCards.tsx`](../src/components/technical/ProductProfileCards.tsx))
có thêm 3 thẻ, đọc qua `productsService.getProfile`:

- **Bộ gồm** — các món trong bộ, số lượng, kích thước, trọng lượng tịnh.
- **Định mức chi tiết** — gom theo nhóm hạng mục, mở/đóng từng nhóm, cộng khối
  lượng theo nhóm và toàn sản phẩm. Quy cách hiển thị gọn: `tròn Ø27 dày 0.8`,
  `hộp 15×35 dày 0.7`, `vuông 20 dày 0.8` (tròn/vuông chỉ nêu một chiều vì tiết
  diện đều).
- **Phương án đóng gói** — chuyển tab giữa các phương án, mỗi phương án liệt kê
  các kiện kèm kích thước carton và số xếp cont.

Thẻ "BOM định mức" cũ (gắn kho) chỉ còn hiện khi thật sự có dòng, để không bày ra
hai bảng định mức mà một cái rỗng.

**Đã sửa cờ `bom_status`**: 273 sản phẩm có định mức thật nhưng vẫn mang cờ "chưa
có BOM" — nay chuyển thành "đã vẽ" (`none` 457 → 184, `done` 67 → 340). Còn **60
sản phẩm mang cờ "đã vẽ" mà không có định mức nào** — sai lệch có từ trước, chưa
đụng tới vì có thể chúng chỉ có bản vẽ đính kèm.

### Bổ sung đợt 2 (2026-07-26) — sau khi đọc file tổng hợp gốc

File `DATABASE_HO_SO_SAN_PHAM.xlsx` có 11 sheet; số dòng khớp chính xác với bộ
CSV đã dùng, nên phần định mức/bộ/đóng gói không sót gì. Nạp bổ sung từ các cột
chưa dùng:

| Trường | Trước | Sau |
|---|---|---|
| Khách hàng (lấy thêm từ cột TỔNG HỢP) | 150 | **236** |
| Mã KH đặt | 56 | **74** |
| Số xếp cont 40′HC | 0 | **156** |
| SL / thùng | 0 | 13 |

`Cái/40HC` và `Loading (TỔNG HỢP)` là **cùng một đại lượng** (SP có cả hai đều
bằng nhau) nên gộp. Cột `KT bao bì` **không nạp**: giá trị dạng `"1390 x 76"`
mà 76 chính là số xếp cont — ô bị dính chữ khi trích xuất, không phải kích thước.
Cột `Nhiên liệu` thực chất chứa "Sắt"/"Nhôm", trùng với vật liệu khung.

**Sửa lỗi nạp trùng định mức.** Sản phẩm thì đã khử trùng lặp từ đầu, nhưng dòng
định mức lại nạp cả từ file bản cũ. 35 SP có định mức từ nhiều file; tách được
**15 SP là nhiều bản của chính nó** (tên file mang mã SP đó) → giữ bản mới nhất,
bỏ 1.068 dòng trùng. Tổng còn **8.375 dòng** (trước 9.443).

Kiểm chứng: `C0093HG-AL` sau khi khử trùng cho tổng khung **11,816 kg**, khớp
đúng con số "tổng theo chi tiết = 11.8165" mà sheet CANH_BAO đã tính.

**Còn 20 SP có định mức lẫn từ file mang tên sản phẩm KHÁC** (1.611 dòng, nhiều
nhất là `C0084HG-AL` 237 dòng từ 8 file) — không tự đoán được bản nào đúng, cần
người rà. Sheet CANH_BAO của bạn cũng liệt kê sẵn 156 SP chưa có file BOM, 115 mã
đề xuất cần duyệt, 11 SP thiếu tên, 9 SP không đọc được định mức khung.

**Chưa nạp: 282 sản phẩm có ảnh** (448 file trong `ANH_SP`) — ảnh phải upload qua
Storage nên tách thành việc riêng.

Bảng mã trong sheet HUONG_DAN cho thấy hai chỗ tôi ghi sai: **`D` = Giường** (không
có SP nào dùng nên chưa cần thêm mã loại) và **`WD` = Gỗ** (tôi từng ghi `WO`, đã sửa).

### Nạp lại sạch bằng script (2026-07-26, đợt cuối)

Chạy `scripts/products-reset.mjs --apply` rồi `scripts/products-import.mjs --apply`
sau khi apply 0094 (tách nhóm ngũ kim / sơn-hoá chất / dây đan) và 0095 (giữ
thông tin khối định mức).

| | Kết quả |
|---|---|
| Sản phẩm | 451 (438 nạp từ file + 15 SP bị chứng từ giữ lại) |
| Ảnh | **282 upload, 0 lỗi** |
| Dòng định mức | 6.910 — bỏ 2.665 dòng thuộc bản file cũ, 130 dòng không có số lượng |
| Nhóm | FRAME 4.342 · NGU_KIM 1.180 · CUSHION 401 · HARDWARE 372 · PACKAGING 241 · WOOD 233 · DAY_DAN 80 · SON_HC 40 · OTHER 21 |
| Món trong bộ · đóng gói | 127 món · 190 phương án / 121 kiện |

Bốn trường của 0095 đã có dữ liệu: `section_title` **100% (6.910/6.910)**,
`material_note` 1.041, `unit_basis` 172, `tenon` 71.

**172 dòng thuộc 18 SP có định mức KHÔNG tính trên 1 sản phẩm** (`1 cái` 101 dòng
/ 7 SP · `1 bàn` 71 dòng / 11 SP) — giữ nguyên số lượng, chỉ đánh dấu, cần kỹ
thuật xác nhận hệ số nhân trước khi dùng để đặt mua.

Thông tin FSC nay đã giữ được: `Quy cách ốp tựa: Ván ép - NON FSC` (40 dòng),
`Quy cách mặt bàn: Acacia - NON FSC`, `Quy cách nệm: D23`.

### Quyết định phải đưa ra khi nạp

**Cột "Phí hao" của file KHÔNG phải phần trăm.** Toàn bộ 317 dòng có giá trị
100 / 50 / 200 / 20, đều nằm ở nhóm khung và không kèm đơn giá. Nạp 100 vào ô hao
hụt sẽ thành "hao 100%" và làm gấp đôi mọi số đặt mua sau này. Đã **để hao hụt = 0**
và giữ nguyên giá trị gốc vào ghi chú dạng `Phí hao (file): 100`. **Cần bạn xác
minh với xưởng cột này thực chất là gì** (phí uốn? phí gia công?) rồi mới dùng.

**Cột "Bộ phận" phần lớn không phải món trong bộ** — 2.508 dòng ghi `Sheet1`,
411 dòng ghi `Nhôm`, 410 ghi `Sắt`. Đã lọc bỏ tên sheet và tên vật liệu, chỉ giữ
nhãn có vẻ là món thật (Table, Bank I…).

**262 dòng bị bỏ** vì không có số lượng (259 trống, 3 số ≤ 0) — dòng định mức
không có số lượng thì không dùng được.

**7 sản phẩm trong DB giữ nguyên mã cũ** vì không theo quy tắc nào:
`21605-217`, `26443-228`, `28256-228` (mã khách dùng làm mã nội bộ),
`D0085HG-AL` (loại `D` không có trong bảng mã), `RHONE-BENCH`, `RHONE-CHAIR`,
`RHONE-DT`. Cần bạn quyết loại và số cho từng cái.

**Nhãn khách bị trùng cách viết**: `MERXX` (27 SP) và `MERXX HANDELS GMBH` (10 SP)
là một khách. Đây là mặt trái của việc gõ tự do — nên gộp lại bằng tay.

## 8. Việc còn mở

Những thứ chưa quyết được từ dữ liệu, cần hỏi người phụ trách khi chạy tới:

- **Quy tắc sinh mã vật tư** cho ~400–600 mã suy ra từ định mức (giai đoạn 1).
- **115 mã "ĐỀ XUẤT - cần duyệt"** — cần bạn hoặc kỹ thuật duyệt trước khi nạp.
- **Các dòng định mức lệch cột** (đơn vị tính chứa `45000`, `100x27x16`) — phải
  soát tay, không suy đoán được.
- **Phân nhóm sai trong file** (nhóm "GỖ / POLYWOOD" chứa nệm và gối) — cần quy
  tắc phân loại lại theo tên chi tiết.
- **Phí hao thật theo nhóm** — khi xưởng cho số, điền vào cơ chế mặc định đã dựng.

---

## 9. Nạp lại từ đầu (2026-07-26) — `products-reset` + `products-import`

Đợt nạp trước làm bằng script dùng một lần. Nay đóng thành hai script chạy lại
được, để mỗi lần bộ trích xuất `DATABASE_SP` cập nhật là nạp lại cả thư viện:

```bash
node scripts/products-reset.mjs                                   # dry-run
node scripts/products-reset.mjs --apply                           # xoá thật
node scripts/products-import.mjs --src "C:\Users\HP\Downloads\All Bom\DATABASE_SP"
node scripts/products-import.mjs --src "…\DATABASE_SP" --apply
```

Trước khi chạy phải apply [`0094`](../supabase/migrations/0094_technical_part_groups_hardware_split.sql)
— migration này thêm ba nhóm hạng mục con: **NGU_KIM**, **SON_HC**, **DAY_DAN**.

### Vì sao thêm nhóm ngũ kim

Không file BOM nào dùng chữ "ngũ kim": bu lông, tán rút, lông đền, pát, tăng đơ
nằm lẫn trong mục "VẬT TƯ" cùng sơn, hoá chất, dây đan và vật tư đóng gói. Nhóm
`HARDWARE` vì thế gom 4 bản chất khác nhau. Script phân loại lại theo **tên chi
tiết** (cột nhóm của file không tin được — đã gặp `bulon m6x15` nằm trong nhóm
"NỆM & VẢI"), riêng dòng thuộc mục KHUNG chỉ cho phép chuyển sang ngũ kim/sơn để
"Nan mê" bằng ống nhôm không bị nhận nhầm thành nan gỗ.

Kết quả nạp: khung 3.831 · **ngũ kim 1.691** · nệm & vải 401 · phụ kiện khác 372
· bao bì 241 · gỗ 233 · dây đan 80 · sơn & hoá chất 40 · khác 21 — tổng **6.910
dòng / 438 SP**.

### Khử trùng lặp: hai tầng, không chỉ một

605 dòng CSV → 438 SP. Lần trước mới khử theo **file** (bỏ bản `Copy`/`CŨ`), lần
này khử thêm theo **sheet trong cùng một file**:

- Nhiều sheet là **cấu kiện** của bộ (`Bàn · Bank I · Ottoman`) → giữ hết.
- Nhiều sheet là **phương án** của cùng một sản phẩm → chỉ giữ bản nhiều chi tiết
  nhất. Nhận diện qua tên sheet: `Nhôm/Sắt`, `có foam/không foam`, `OP1/OP2`,
  `THEO HG/THEO REPORT`, `Grey/Brown`, `Table` và `Table (2)`, `Sheet1/Sheet4`.

Bỏ được 23 sheet phương án. Nếu không tách, `B0012HG-AL` bị cộng cả "THEO HG" lẫn
"THEO REPORT" thành 10,2 kg khung trong khi thực tế là 6,1 kg.

Kiểm chứng: `C0093HG-AL` cho **11,816 kg** khung — khớp con số sheet CANH_BAO
tính từ file gốc.

### Sản phẩm bị chứng từ giữ lại

`sales_quote_lines`, `sales_order_lines`, `technical_samples` khoá ngoại RESTRICT
sang `technical_products`. Script reset dò trước, **bỏ qua** những SP đó (in danh
sách) và chỉ xoá phần hồ sơ + định mức của chúng; bước import upsert theo `code`
nên vẫn ghi đè được dữ liệu mới. Không có chứng từ nào bị hỏng.
