# Bộ cột thật của từng khối BOM — quét 246 file (19/08/2026)

> Nguồn: `C:\Users\HP\Downloads\All Bom` · script `scripts/bom-scan-columns.mjs`
> (đọc 246/246 file, bóc **4.618 khối**).
>
> Khác đợt quét 187 file (`dinh-muc-nhom-theo-bom-187-file.md`): bản đó trả lời
> *"có bao nhiêu NHÓM"*. Bản này trả lời câu tiếp theo — **mỗi khối thật sự có
> những CỘT nào, viết bằng chữ gì, đơn vị gì** — vì đó mới là thứ phải bày lên
> UI cho người nhập điền.
>
> Cách bóc: dò HÀNG TIÊU ĐỀ CỘT (≥3 ô khớp từ vựng tiêu đề, không có ô số), gộp
> tầng tiêu đề thứ hai ("Quy Cách Tinh (mm)" / "Dày · Rộng · Dài"), rồi lấy ô chữ
> đứng một mình gần nhất phía trên làm tiêu đề khối. Không đoán theo vị trí cột —
> biểu mẫu có nhiều đời, chèn thêm cột là lệch hết.

## 1. Mười hai họ, xếp theo số khối

| Họ | Khối | Bộ cột CHUẨN (≥50% số khối của họ) |
|---|---:|---|
| **PAINT** | 1.071 | *SƠN*: STT · Mã hàng · Màu sơn · ĐVT · **Định mức** · Đơn giá · TT · NCC<br>*HOÁ CHẤT*: STT · Tên vật tư · ĐVT · Đơn giá · **Số kg / ghế** · **Tiêu hao VNĐ/kg nhôm** · TT · NCC |
| **FRAME** | 958 | Stt · Tên chi tiết · **Loại** · Quy cách tinh (mm): Dày · Rộng · Dài · Số lượng · **Đơn vị (m)** · Trọng lượng (kg) · Ghi chú |
| **HARDWARE** | 901 | STT · TÊN HÀNG HÓA · ĐVT · SL/SP · ĐGIÁ · TT *(Vật Liệu 43%)* |
| **CUSHION** | 634 | *bảng VẢI-NỆM (64%)*: LOẠI VẢI · TÊN SẢN PHẨM · QUY CÁCH (mm): dài · rộng · dày · M2 · TỔNG VẢI M2 · **hao hụt vải 10%** · **nvl phụ 10%** · ĐƠN GIÁ · TỔNG TIỀN VẢI<br>*bảng quy cách (30%)*: Stt · Tên chi tiết · Dày · Rộng · Dài · **Mộng** · SL · Diện Tích (m2) · K. Lượng (m3) |
| **WOOD** | 473 | Stt · Tên chi tiết · Kích thước tinh chế (mm): Dày · Rộng · Dài · **Mộng** · Số lượng · Diện Tích (m2) · K. Lượng (m3) · Ghi chú |
| **DAN** (mây/dây dù) | 135 | STT · **Tên SP** · **Mã số** · ĐVT · **Số lượng kg / 1 cái** · Đơn giá · Thành tiền · Ghi chú |
| **PACKAGING** | 117 | = HARDWARE (STT · TÊN HÀNG HÓA · ĐVT · SL/SP · Vật Liệu · ĐGIÁ · TT) |
| **POLYWOOD** | 106 | = WOOD, **Mộng 100%** |
| **FABRIC** | 56 | hai bảng như CUSHION, thêm **Mét tới · Tổng vải · NVL phụ 5% · Công may, cắt** |
| **PANEL** | 41 | = WOOD, **Mộng 85%** |
| **ZIPPER** | 15 | = HARDWARE |
| KHÁC / không tên | 111 | phần lớn là "VẬT TƯ LẮP RÁP" (= HARDWARE) và khối khung không đặt tiêu đề |

## 2. Sáu chỗ `part-layouts.ts` đang SAI hoặc THIẾU

### 2.1 PAINT — họ LỚN NHẤT (1.071 khối) mà không có bố cục nào

`layoutOf()` không có nhánh cho SƠN/HOÁ CHẤT nên chúng rơi về `supply`, tức bày
ra `Dày · Rộng · Dài` (sơn không có kích thước nào) và **giấu mất toàn bộ cột
thật**: Mã hàng · Màu sơn · Định mức · NCC · Số kg/ghế · Tiêu hao VNĐ/kg nhôm.

Mẫu thật (`C0011HG-AL Ghế 5 bậc Florenz`):

```
SƠN       STT · Mã hàng · Màu sơn · ĐVT · Định mức · Đơn giá · Thành tiền · NCC
          1  · Ghế     · Graphit · Kg  · 1.17     · 76.500   · 89.505     · Việt Sapa
HÓA CHẤT  STT · Tên vật tư          · ĐVT · Đơn giá · Số kg/Ghế · Tiêu hao VNĐ/kg nhôm
          1  · Tẩy dầu phun TD-226S · Kg  · 33.400  · 13        · 300
```

### 2.2 DAN (mây · dây dù · dây đan) — 135 khối, cũng không có bố cục

Bộ cột không giống nhóm nào: có **Mã số** (mã của nhà cung cấp dây) và đơn vị
định mức là **kg / 1 cái** chứ không phải "SL/SP".

### 2.3 POLYWOOD và PANEL đang bị bỏ mất cột **Mộng**

Bố cục `sheet` không có `COL.tenonMm`, trong khi số liệu: POLYWOOD **100%** khối
có cột Mộng, PANEL **85%**. Đây là kích thước ăn vào m³ nên bỏ là tính thiếu.

### 2.4 CUSHION và FABRIC mỗi họ có HAI bảng khác nhau, app chỉ có một

64% khối nệm là **bảng vải** (LOẠI VẢI · M2 · TỔNG VẢI M2 · hao hụt · nvl phụ),
30% là **bảng quy cách** (Dày/Rộng/Dài/Mộng/Diện tích/m³). Ép chung một bộ cột
thì bảng nào cũng thiếu quá nửa số ô.

### 2.5 HARDWARE / PACKAGING / ZIPPER đang bày 3 cột kích thước gần như luôn rỗng

`supply` mở đầu bằng `Dày · Rộng · Dài`. Đo trên dữ liệu đã nạp: `dim_a` 1%,
`dim_b` 16%, `cut_length` 17%. Biểu mẫu thật KHÔNG có ba cột này — chỉ có
TÊN HÀNG HÓA · ĐVT · SL/SP · Vật Liệu.

### 2.6 FRAME — "Đơn vị (m)" và "Tổng chiều dài (m)" là MỘT cột, hai tên

54% khối ghi "Đơn vị (m)", 46% ghi "Tổng chiều dài (m)" — cộng lại đúng 100%.
Kiểm số: `Dọc tựa Φ25 dài 780 × 2 cái → 1,56`. App đã có `total_length_m`, chỉ
cần biết đây là cùng một thứ khi đọc file.

**Bẫy của biểu mẫu đời cũ**: bản không có cột `Dày vật liệu (δ)` thì người lập
ghi δ vào **Ghi chú** (0.6 · 0.8), và cột "Dày" chứa **chữ** `Φ25` chứ không phải
số. Đó là lý do 350 dòng khung trong DB thiếu δ.

## 3. Quyết định thiết kế

**Số dẫn xuất chuyển sang CHO ĐIỀN, không bắt buộc tự tính** (user chốt
19/08/2026). `Tổng chiều dài (m)` · `Trọng lượng (kg)` · `Diện tích (m²)` ·
`K. Lượng (m³)` trở thành ô nhập bình thường; `calcPartDerived` chỉ còn điền khi
ô để TRỐNG (`technical.service.ts` vốn đã dùng `?? d.x` nên số người nhập luôn
thắng — không phải sửa tầng ghi).

**Cột tiền (Đơn giá · Thành tiền · NCC) KHÔNG đưa vào định mức** — user CHỐT
19/08/2026: *"bỏ phần giá luôn, định mức chỉ ghi nhận định mức"*. Cùng lý lẽ đã
dùng khi gỡ "Mã VT kho": giá và nhà cung cấp là dữ liệu của Cung ứng, để hai nơi
cùng giữ thì hai nơi lệch nhau. Định mức trả lời *cần bao nhiêu*, không trả lời
*bao nhiêu tiền*.

---

## 4. Đã làm — 19/08/2026

### 4.1 Bỏ giá khỏi định mức (user chốt)

**Định mức chỉ ghi nhận ĐỊNH MỨC.** Không có ô Đơn giá · Thành tiền · NCC ·
Tiêu hao VNĐ/kg nhôm · TỔNG TIỀN VẢI · Công may cắt, dù biểu mẫu gốc có.

Kéo theo một hệ quả gọn: cột **"NVL phụ %"** của bảng vải (54–61% khối có) cũng
bỏ — nó là hệ số nhân vào TIỀN chứ không phải lượng vật tư, nên đi cùng quyết
định trên chứ không phải bị quên.

### 4.2 Nệm và Vải tách thành hai nhóm riêng

Lý do bằng số: khối đề "Quy cách Nệm:" thì **64% thật ra là bảng VẢI**, chỉ 30%
là bảng quy cách nệm. Hai bảng không chung cột nào ngoài kích thước.

| | Nệm / mút / gòn (`CUSHION`) | Vải / textilene (`FABRIC`) |
|---|---|---|
| Cột | Dày · Rộng · Dài · **Mộng** · SL · DT (m²) · **m³** · m³/tấm | **Loại vải** · **Dài · Rộng · Dày** (thứ tự biểu mẫu vải) · SL · M² · **Hao hụt vải %** · **Tổng vải (m²)** · Khổ (m) · Mét tới |
| Đơn vị mua | cái (nệm) · tấm (mút) · kg (gòn) | m² hoặc mét khổ |

`Tổng vải (m²)` = `M² × (1 + hao hụt%)` — con số đem đi đặt, khác M² là diện tích
tinh của miếng. File ghi cả hai cột cạnh nhau nên màn hình cũng có cả hai.

**Chặn ở nguồn**: `bom-import-all.mjs` nay xét `vai|textilen` **TRƯỚC** `nem` —
trước đây tiêu đề "Quy cách Nệm + vải:" nuốt luôn phần vải vào nhóm nệm.

Thêm tiêu đề khối mặc định cho FABRIC · POLYWOOD · PANEL (trước chỉ có 5 nhóm
được điền sẵn, nhóm khác phải gõ tay nên đẻ ra biến thể chữ).

### 4.3 Kiểm trên UI thật (`CH0113HG-AL Armchair`)

```
Khung            STT · Tên chi tiết · Loại · Dày · Rộng · Dài · SL · Trọng lượng (kg) · δ · ✓ Phôi
Nệm / mút / gòn  STT · Cụm · Tên chi tiết · Dày · Rộng · Dài · Mộng · SL · ĐVT · m³/tấm · Vật liệu · DT (m²) · m³
Vải / textilene  STT · Cụm · Tên chi tiết · Loại vải · Dài · Rộng · Dày · SL · ĐVT · Hao % · Khổ (m) · DT (m²) · Tổng dài (m)
Ngũ kim          STT · Tên hàng hoá · ĐVT · SL · Vật liệu          ← hết ba cột kích thước rỗng
Tem / nhãn       STT · Tên hàng hoá · ĐVT · SL
```

### 4.4 Còn treo

- Khối **Sơn & hoá chất** (1.071 khối trong file) và **Mây / dây đan** (135) hiện
  có **0 dòng trong DB** — bộ nạp cũ bỏ qua. Bố cục đã sẵn, chưa có dữ liệu thật
  để soi.
- ~~`bom-derived-fix.mjs --apply`~~ **ĐÃ CHẠY** 19/08/2026: ghi 2.810 dòng, thẻ
  "Tổng hợp vật tư" rỗng 204/209 → 21/209 SP. Chạy lại lần hai ra 0 dòng cần sửa.
- 137 dòng vẫn còn ĐƠN GIÁ nằm trong ô `part_no` (đã che ở tầng hiển thị, chưa
  dọn dữ liệu).

### 4.5 Sửa hiển thị sau khi vá dữ liệu (19/08/2026)

Chạy `bom-derived-fix.mjs --apply` xong, số hiện lên thì lộ ra ba chỗ bày sai:

**1. Thẻ "Tổng hợp vật tư" gọi sai tên vật liệu.** Bản cũ dồn mọi thứ không phải
khung vào một dòng tên **"Vải / bề mặt bọc"** — `TB0261 Ext Table` không có sợi
vải nào mà vẫn hiện "Vải 4,6097 m²" (thật ra là diện tích nan gỗ). Người mua đọc
bảng này để đi đặt hàng, gọi sai tên là đặt sai thứ. Nay **gộp theo từng họ**,
mỗi dòng mang đúng tên họ đó.

**2. Vải có dòng m³.** `calcPartDerived` vẫn ra thể tích cho dòng vải (nó nhận
"khối đặc" bằng việc không khai ô Loại), nhưng m³ của tấm vải dày 2mm là số vô
nghĩa — không ai đặt vải theo mét khối. Nay mỗi họ khai ĐƠN VỊ MUA của chính nó:
gỗ/nệm → m³ · vải → m² · polywood/mặt bàn → cả hai.

**3. Cột STT của khối vật tư đang chứa ĐƠN GIÁ.** 137 dòng (NGŨ KIM 105 · TEM 20
· BAO BÌ 12) có `part_no` là giá tiền do bộ nạp cũ đọc lệch cột: Bulong M6×25 →
`1760`, Tem bảo hành → `2000`, Gót chân Ø25 → `3200`. Vá ở tầng hiển thị
(`seqLabels`): xét theo CẢ KHỐI, khối nào có số vượt xa số dòng thì đánh lại theo
vị trí; khối nào `part_no` lành lặn vẫn giữ số của tờ giấy để đối chiếu bản in.

**Chống trùng sơn**: hồ sơ đã có khối "Sơn & hoá chất" nhập tay thì thẻ tổng hợp
KHÔNG bơm thêm dòng sơn tự tính nữa — cùng luật "số người nhập thắng".

## 5. Cập nhật tính năng đọc BOM bằng AI — 19/08/2026

Sau khi đổi bố cục và đổi luật "không tự tính", `bom-ai.*` lệch với phần còn lại
ở 6 chỗ. Đã sửa:

| # | Chỗ | Trước | Sau |
|---|---|---|---|
| 1 | Prompt, mục "Bỏ qua" | *"Bỏ qua cột tính sẵn: Tổng chiều dài, Diện tích, Đơn giá, Thành tiền"* — làm ngược đúng thứ vừa chốt | Chỉ bỏ **cột tiền** (ĐGIÁ · TT · NCC · Tiêu hao VNĐ/kg · TỔNG TIỀN VẢI · NVL phụ % · Công may cắt) |
| 2 | Trường trích | 15 trường | +8: `color` (Màu sơn) · `waste_pct` · `roll_width_m` · `m3_per_sheet` · `wood_species` · `total_length_m` · `paint_area_m2` · `volume_m3` |
| 3 | Bẫy "K. Lượng (m3)" | `weight_kg` chỉ ghi *"khối lượng theo bảng cân NCC"* | Nêu thẳng bẫy trong mô tả: cột tên "K. Lượng (m3)" là THỂ TÍCH, phải vào `volume_m3` |
| 4 | Nệm ↔ vải | không có luật | Mục riêng: 64% khối đề "nệm" thật ra là bảng vải ⇒ **tách hai `sections`, nhìn BỘ CỘT chứ không nhìn tiêu đề** |
| 5 | Mô tả cấu trúc file | 3 dạng bảng | 7 dạng, có SƠN & HOÁ CHẤT và MÂY / DÂY ĐAN; nói rõ cột lượng của hai họ này không tên là "Số lượng" nhưng vẫn là `qty` |
| 6 | Đường ghi | `productPartsBulkSchema` không nhận `total_length_m` / `paint_area_m2` / `volume_m3` → zod lột im lặng | Đã mở ba trường |

**Ranh giới giữ nguyên**: mô hình được CHÉP ô file đã ghi, KHÔNG được nhân chia
ra số mới. Mục "# Chép, đừng tính" nói rõ cả hai vế.

4 test canh mới trong `bom-ai.schema.test.ts`: có đủ trường dẫn xuất · không có
trường tiền nào · mô tả `weight_kg` phải nhắc bẫy m3 · có `color`/`waste_pct`/
`roll_width_m`. Prompt sinh ra dài 7.031 ký tự, kiểm đủ 6 từ khoá.

### Còn treo — màn DUYỆT bản nháp AI

`BomAiImport.tsx` dựng bảng duyệt bằng **11 cột cứng hình khối khung**
(Dạng · Hệ VL · Dày A · Rộng B · Dày thành · Dài cắt · SL · ĐVT) cho MỌI nhóm —
đúng cái bệnh mà `part-layouts.ts` đã chữa cho màn chính. Hậu quả: 8 trường vừa
thêm trích được nhưng người duyệt KHÔNG nhìn thấy để kiểm (khối sơn không có ô
Màu sơn, khối vải không có ô hao hụt/khổ).

Cách chữa: cho bảng duyệt đọc `inputCellsFor(group_code)` và render bằng
`PartField` như lưới gõ tay — cần một lớp adapter vì bản nháp AI giữ số/null còn
`PartDraft` là `Record<InputKey, string>`.

### 4.6 Cột biểu mẫu LUÔN HIỆN, cột hệ mới tự ẩn (19/08/2026)

`columnsFor()` trước đây ẩn MỌI cột mà cả nhóm bỏ trống. Luật đó sinh ra để chặn
"ngũ kim hiện ba cột kích thước rỗng" — đúng với cột HỆ, nhưng sai với cột của
BIỂU MẪU: hồ sơ vừa tạo từ file BOM chưa có SL/δ/khối lượng thì khối khung chỉ
còn **8 cột**, người nhập không nhìn ra mình còn thiếu gì.

`LAYOUTS` nay tách hai:

| | Xử lý | Ví dụ (khung) |
|---|---|---|
| `form` | **luôn hiện**, ô trống ghi `—` | Loại · Dày · Rộng · Dài · Phi hao uốn · SL · Tổng dài · Trọng lượng · DT sơn · δ · Ghi chú · ✓Phôi |
| `extra` | tự ẩn khi cả nhóm trống | Dài cây · CT/cây · Số cây · ĐVT · Vật liệu · Màu |

Đo lại trên hồ sơ `CH0273HG-AL` (tạo từ file BOM, 11 dòng chưa có SL): khối khung
từ 8 cột → **14 cột**, đúng bộ biểu mẫu. Các nhóm khác không phình: ngũ kim và
tem vẫn 6 cột, không có cột kích thước nào.
