# Nhóm định mức & cách tính — đọc từ 187 file BOM thật

> Tiếp nối `dinh-muc-redesign-plan.md` (27/07/2026). Bản kia dựng **trục
> KHỐI → CỤM → CHI TIẾT** từ **2 file** Shelter Home — đúng, và đã code xong.
> Bản này quét **toàn bộ 187 file** ở `E:\All BOM_Thức` để trả lời câu còn thiếu:
> **có bao nhiêu NHÓM định mức, mỗi nhóm cần thông tin gì và tính khác nhau ra
> sao** — vì đó mới là thứ Cung ứng dựa vào để gộp mua.
>
> Quét ngày 11/08/2026. Script: `scan-bom.js` + `classify.js` (scratchpad).

---

## 1. Số liệu quét — nhóm nào có thật, lớn cỡ nào

187 file · 53 tiêu đề khối khác nhau · quy về **12 nhóm**:

| Nhóm | Số file | Số dòng | Tiêu đề trong file |
|---|---:|---:|---|
| **FRAME** — khung kim loại | 161 | 2.610 | `Quy cách :` · `Quy cách nhôm:` · `Quy cách sắt:` · `Quy cách la sắt :` |
| **HARDWARE** — ngũ kim | 177 | 1.418 | `VẬT TƯ NGŨ KIM` · `VẬT TƯ` |
| **PACKAGING** — bao bì | 181 | 854 | `VẬT TƯ BAO BÌ` · `VẬT TƯ ĐÓNG GÓI` |
| **WOOD** — gỗ | 155 | 530 | `Quy cách Gỗ:` (+ ` Gỗ Teck` ×27, ` Gỗ keo` ×7, ` Gỗ bạch đàn` ×4, ` Ván ép` ×1) |
| **CUSHION** — nệm / mút / gòn | 17 | 134 | `Quy cách Nệm:` · `Quy cách Nệm, gối:` · `QUY CÁCH MOUSE` · `GÒN TƠI + QUẤN` |
| **LABEL** — tem | 4 | 66 | `TEM` |
| **POLYWOOD** | 45 | 54 | `Quy cách Nan Polywood` |
| **PANEL** — kính / mặt đá / mặt bàn | 14 | 40 | `Quy cách Kính:` · `Quy cách Mặt đá:` · `Quy cách Mặt bàn:` |
| **ZIPPER** — dây kéo YKK | 4 | 26 | `ĐẦU DÂY KÉO YKK` |
| **FABRIC** — vải / textilene | 7 | 17 | `VẢI` · `QUY CÁCH VẢI TEXTILEN` · `Quy cách vải:` |
| **PAINT_CHEM** — sơn & hoá chất | 1 | 12 | `SƠN` · `HÓA CHẤT` · `Nhôm+ Sơn` |
| **RATTAN** — mây / dây đan | 1 | 2 | `MÂY` (thường nằm lẫn trong ngũ kim: "Dây 6mm · Kg · 3") |

Đối chiếu với `technical_part_groups` đang có (FRAME · WOOD · CUSHION · HARDWARE
→ NGU_KIM/SON_HC · PACKAGING · OTHER → DAY_DAN): **thiếu 5 nhóm** POLYWOOD,
PANEL, FABRIC, LABEL, ZIPPER; và **CUSHION đang gộp nhầm** nệm với vải — hai thứ
tính hoàn toàn khác nhau (xem §2.4 và §2.5).

---

## 2. Sáu HỌ CÁCH TÍNH (hiện code mới có bốn)

`part-layouts.ts` đang có `metal · wood · soft · supply`. Số liệu cho thấy phải
tách thành sáu, vì `soft` đang gánh ba cơ chế khác nhau và `panel/fabric` không
có chỗ.

### 2.1 `metal` — FRAME (161 file, 2.610 dòng)

Nhập: **Loại** · Dày · Rộng · Dài · **δ (dày vật liệu)** · **Phi hao uốn** · SL

Cột **Loại** có hai bản chất trộn lẫn — đây là chi tiết quan trọng nhất của
nhóm này:

| Kiểu giá trị | Số dòng | Ví dụ |
|---|---:|---|
| **hình dạng chuẩn** | 1.783 | Tròn 587 · Hộp 504 · Vuông 326 · LA 236 · Tole 40 · Lưới 7 |
| **mã khuôn ép** (profile riêng) | ~200 | `TD-HG04` 17 · `B433S` 21 · `TD-B109` 15 · `HG17` 14 · `TD-B477` 10 · `TW-HG05` 6 |
| **ký hiệu phi** | ~30 | `Φ25` · `Ø16` · `p25` · `p6 đặc` |

⇒ Hình dạng thì **suy được kg/m từ hình học × tỉ trọng** (sheet `Data`: nhôm 2.7 ·
sắt 7.85 · inox 7.93). Mã khuôn thì **không suy được** — phải tra bảng khuôn.
Vài file đã ghi sẵn ngay trên dòng tiêu đề: `TD-HG04 / 0.260`, `TW-HG05 / 0.177`,
`TD-B477 / 0.330`, `A593 / 0.357` — tức **mã khuôn → kg/m** là một danh mục thật,
cần bảng riêng (`supply_dies` đã có `DiePicker`, phải nối vào đây).

Tính ra: `tổng dài (m)` · `kg` · `m² sơn`.
**Mua theo CÂY** ⇒ xem §3.

### 2.2 `wood` — WOOD (155 file) + POLYWOOD (45 file)

Nhập: Dày · Rộng · Dài · **Mộng** · SL. Tính: `m²` · `m³`.

Khác biệt phải thêm: **loại gỗ** đang nằm trong tiêu đề khối (`Gỗ Teck`,
`Gỗ keo`, `Gỗ bạch đàn`, `Ván ép`, `Polywood`) chứ không phải một trường. Giá
teck ≠ keo ≠ bạch đàn nên Cung ứng **không gộp chung được** — phải là trường
riêng trên dòng.

Mua: gỗ tự nhiên theo **m³**; polywood/ván ép theo **TẤM** (cần quy cách tấm).

### 2.3 `panel` — PANEL (14 file): kính · mặt đá · mặt bàn

Cùng bộ cột với `wood` nhưng **không có mộng**, và số dùng để mua là `m²` chứ
không phải `m³`. Mua theo **TẤM cắt sẵn** hoặc **m²**.

### 2.4 `soft` — CUSHION (17 file): ba cơ chế trong một nhóm

| Loại | Nhập | Tính | Mua theo |
|---|---|---|---|
| Nệm / gối | Dày · Rộng · Dài · SL | m² · m³ | cái (đặt gia công) |
| **Mút (mousse)** | Quy cách tấm `440x420x120` · **m³/tấm** · SL | Σ m³ | **TẤM** |
| **Gòn tơi / gòn quấn** | **Khổ** (600, 650) · **số mét** · **kg** | kg | **KG** |

Ba dòng này hiện đổ chung vào `soft`, mà `soft` lại **bỏ m³** — sai với cả ba.

### 2.5 `fabric` — FABRIC (7 file): họ hoàn toàn mới

Biểu mẫu vải không có cột nào giống các nhóm khác:

```
LOẠI VẢI | ĐƠN GIÁ | Tên sản phẩm | Mét tới | hao hụt vải 2% | Tổng vải | ... | NVL phụ 5% | Công may, cắt
Vải Spun 230gr chống cháy Anh   Vải mê may liền nệm ngồi   3.85   0.08   3.93
Vải Textilen 1 lớp (Khổ 1m6)    Mê : 1 cái                 0.18   0.01   0.19   (hao hụt 3%)
```

Đặc thù bắt buộc phải có trường riêng:
- **Khổ vải** (1m6 …) — không có khổ thì không ra được mét.
- **% hao hụt** — 2% với vải thường, 3% với textilene; là con số đặt hàng thật.
- Quy cách cắt ghi bằng chữ: `620x510 = 1 tấm x 1 cái`.

Mua theo **MÉT**. (Cột tiền/công may bỏ theo D4 của bản kế hoạch trước.)

### 2.6 `supply` — HARDWARE · PACKAGING · LABEL · ZIPPER · RATTAN

Nhập: Tên hàng hoá · quy cách (text) · **ĐVT** · **SL/SP** · Vật liệu · Ghi chú.
Không có công thức — số nhập là số dùng luôn.

ĐVT thật đếm được trên 2.272 dòng: `cái` 1.293 · `con` 425 · `tấm` 47 · **`kg` 35**
· `bộ` 22 · `cuộn` 13 · `m²` 11 · `mét` 9 · `gói` 5 · `tờ` 2.

Lưu ý hai chỗ lệch nhóm trong file gốc:
- **Dây đan / mây** ghi lẫn trong ngũ kim (`Dây 6mm · Kg · 3`) — phải tách ra
  nhóm DAY_DAN khi nạp.
- Bao bì có dòng tính theo `m²` (giấy shell quấn SP) — không phải chỉ đếm cái.

### 2.7 `derived` — PAINT_CHEM: không nhập tay

```
SƠN      STT · Mã hàng · Màu sơn · ĐVT · Định mức · … · NCC
HÓA CHẤT STT · Tên vật tư · ĐVT · Đơn giá · Số kg / Ghế · Tiêu hao VNĐ/kg nhôm · NCC
Nhôm+Sơn Nhôm 2.60 kg/SP · Sơn xám cát ngoài trời 0.22 kg/SP
```

Sơn **suy ra** từ `Σ m² sơn ÷ độ phủ (m²/kg)` — `paint_coverage_m2_per_kg` đã có
trên hồ sơ SP. Hoá chất tính theo **kg/kg nhôm**. Cả hai là **dòng tính**, không
để người nhập gõ tay rồi lệch với khối khung.

---

## 3. Mắt xích còn thiếu: ĐƠN VỊ ĐỊNH MỨC ≠ ĐƠN VỊ MUA

Đây là lý do hôm nay Cung ứng vẫn phải nhập lại "bảng chi tiết" cho từng LSX dù
hồ sơ SP đã có định mức: hồ sơ trả lời *"tốn bao nhiêu mét / kg / m³"*, còn đơn
đặt hàng cần *"mua bao nhiêu CÂY / TẤM / CUỘN"*.

| Nhóm | Định mức ra | Mua theo | Thiếu trường |
|---|---|---|---|
| FRAME | m · kg | **cây** | `bar_length_m` (chiều dài cây) · `pcs_per_bar` (số chi tiết/cây) |
| WOOD | m³ | m³ | — |
| POLYWOOD / PANEL | m² | tấm | quy cách tấm (`sheet_w × sheet_l`) |
| FABRIC | mét tới | mét | `roll_width_m` (khổ) · `waste_pct` |
| CUSHION-mút | m³ | tấm | `m3_per_sheet` |
| CUSHION-gòn | kg | kg | khổ + số mét |
| HARDWARE/PACKAGING | ĐVT | ĐVT | — (1:1) |

`pcs_per_bar` là con số quyết định: sổ "Tổng hợp nhôm" của Cung ứng tính
`số cây = SL chi tiết ÷ số khúc trên 1 cây`, rồi **tách riêng theo chiều dài cây**
(525 cây 6m + 141 cây 5,9m, không cộng thành 666).

⇒ Khoá gộp của Cung ứng phải là **(mã vật tư, chiều dài cây)**, không phải chỉ
mã vật tư.

---

## 4. Việc phải làm

| # | Việc | Ghi chú |
|---|---|---|
| 1 | **Migration nhóm**: thêm `POLYWOOD` (con của WOOD), `PANEL`, `FABRIC`, `LABEL`, `ZIPPER`; đổi nhãn `CUSHION` thành "Nệm / mút / gòn" (bỏ chữ "vải") | chỉ thêm bản ghi danh mục, `technical_part_groups` đã là dữ liệu từ 0093 |
| 2 | **Cột mới** trên `technical_product_parts`: `wood_species` · `bar_length_m` · `pcs_per_bar` · `roll_width_m` · `waste_pct` · `sheet_w_mm`/`sheet_l_mm` · `m3_per_sheet` | 6 nhóm mới đều nhập được mà không phá dòng cũ |
| 3 | **Danh mục mã khuôn → kg/m**: nối `profile_code` với bảng khuôn (`DiePicker` đã có ở Cung ứng) | ~200 dòng dùng mã khuôn, không suy được kg/m từ hình học |
| 4 | `part-layouts.ts`: `metal · wood · panel · soft · fabric · supply` | thêm 2 họ, sửa `soft` (trả lại m³) |
| 5 | `bom-calc.ts`: công thức từng họ + test đối chiếu từng ô với file mẫu mỗi nhóm | bắt buộc theo CLAUDE.md |
| 6 | **Bộ nạp 187 file** theo nhóm, báo cáo dòng không khớp mã vật tư để duyệt | user tự tổng hợp định mức trước, nạp sau |
| 7 | **Rollup theo ĐƠN VỊ MUA** trên hồ sơ SP, và view nhu cầu LSX gộp theo `(mã VT, chiều dài cây)` | đây là thứ Cung ứng đọc |

Bước 1–5 làm được ngay và không phụ thuộc dữ liệu. Bước 6 chờ file của user.

### Đã làm (11/08/2026)

| # | Trạng thái |
|---|---|
| 1 | ✅ `0132_dinh_muc_nhom_va_don_vi_mua.sql` — 5 nhóm mới, đổi nhãn CUSHION/WOOD/DAY_DAN. **Đã apply remote.** |
| 2 | ✅ 8 cột mới + check ràng buộc dương; đã `sync-types`; nối qua schema → repo → service → UI |
| 3 | ✅ Ô "Mã khuôn ép" thành `DiePicker` — chọn khuôn kéo theo kg/m (TD-HG04 → 0,26) |
| 4 | ✅ `part-layouts.ts` sáu họ `metal · wood · sheet · soft · fabric · supply`; `soft` được trả lại cột m³ |
| 5 | 🟡 `bom-calc`: `barsForQty` + `fabricTotalM` (có test đối chiếu sổ Tổng hợp nhôm và khối vải Tinsley). Công thức số TẤM chưa làm — file gốc tính tay theo sơ đồ cắt, không có phép tính để mô phỏng |
| 6–7 | ⬜ chờ định mức user tổng hợp |

### Sửa định mức — bỏ hộp thoại (11/08/2026)

User chốt: **bỏ hẳn modal**, sửa hết trên dòng; ô tự tính **cho ghi đè** kèm cờ lệch.

| Việc | Trạng thái |
|---|---|
| Bút chì → biến đúng dòng đó thành lưới nhập; xoá `PartLineEdit.tsx` | ✅ |
| "+ Thêm dòng vào <nhóm>" → mở lưới nhập inline (`PartRowNew`) thay vì modal | ✅ |
| Ô **mã VT kho** + **mã khuôn** đưa xuống lưới (trước chỉ modal mới có) | ✅ |
| Chọn vật tư → tự điền **ĐVT** + **dài cây** (`default_bar_length_m`) nếu còn trống | ✅ |
| Chọn khuôn → tự điền **kg/m** | ✅ |
| **CT/cây** suy từ `⌊dài cây ÷ (dài cắt + phi hao)⌋`, hiện làm gợi ý mờ; gõ đè thì số người nhập thắng | ✅ `pcsPerBarFrom` + 5 test |

Số kiểm chứng: `⌊6000/1390⌋ = 4` và `⌊5900/390⌋ = 15` — trùng khít số ghi tay
trong `BOM_MERXX Bồn hoa lớn`. Một dòng khung từ 11 ô gõ tay còn 6 ô + 1 ô chọn.

**Ba quyết định user chốt 11/08/2026:**
- kg/m của mã khuôn lấy **từ danh mục khuôn** (`technical_dies` — 142 khuôn, 141 có kg/m; số khớp đúng chú thích trong file BOM: TD-HG04 0,260 · TW-HG05 0,177 · TD-B477 0,330 · A593 0,357).
- Khoá gộp mua = **(mã vật tư, chiều dài cây)**.
- Polywood là **nhóm riêng**, mua theo tấm.

---

## 5. Chờ chốt

- **C1** — Mã khuôn: lấy `kg/m` từ danh mục khuôn của Cung ứng, hay cho Kỹ thuật
  gõ thẳng `kg/m` trên dòng như file Excel đang làm?
- **C2** — Gộp mua tách theo chiều dài cây: xác nhận khoá gộp là
  **(mã vật tư, chiều dài cây)**.
- **C3** — Polywood: là nhóm con của WOOD (thừa kế cách tính m³) hay nhóm riêng
  mua theo tấm?

---

## Nạp thật vào hồ sơ SP (11/08/2026)

`scripts/bom-import-all.mjs` — dò khô mặc định, `--apply` mới ghi.

| | |
|---|---:|
| File quét | 187 |
| **Sheet đã nạp** | **60** |
| **Dòng định mức đã ghi** | **1.446** |
| Cụm tạo kèm | 36 |
| SP có định mức (trước → sau) | 4 → **65** / 594 |

Nhóm: FRAME 718 · NGU_KIM 560 · WOOD 187 · CUSHION 23 · PACKAGING 21 · FABRIC 10 · LABEL 8.

**Cách khớp hồ sơ** (chắc → mờ): mã trong ô "Mã Số HG"/"MÃ K.HÀNG" 35 · mã ở
TÊN SHEET 17 (file MERXX 90 sheet ghi mã ở đó) · tên SP đặc trưng 7 · tên SP +
tên khách 1.

**Ba mức chặn khi ghi**: mặc định dò khô · chỉ nạp SP đang có 0 dòng (không đè
bảng nhập tay) · không tự tạo sản phẩm mới.

### Còn lại — 201 sheet chưa nạp

| Loại | Sheet | Xử lý |
|---|---:|---|
| Chưa có hồ sơ SP trong hệ | 155 | phải khai hồ sơ trước; phần lớn là file MERXX tổng và các bộ LYPRODAN |
| Chỉ trùng TÊN, chưa chắc đúng SP | 39 | chờ người xác nhận — tên quá chung ("Table", "Bàn", "Đôn", "Ghế 1", "Coffee Table") |
| SP đã có định mức nhập tay | 7 | cố ý bỏ, không đè |

### CẢNH BÁO — chưa dùng để gộp mua được

**1.527 dòng định mức, chỉ 1 dòng có `material_code`.** File BOM gốc KHÔNG có
cột mã vật tư kho — chỉ có tên và quy cách. Mà `v_lsx_material_status` nối định
mức với kho bằng đúng mã đó, nên nhu cầu vật tư của Cung ứng VẪN trả rỗng.

Việc còn lại: gắn mã kho cho từng dòng. Ô tìm trên thẻ sửa đã sẵn sàng; nên viết
thêm một bước dò tự động theo tên + quy cách (như `bkvt-import.mjs` đã làm cho
ngũ kim) rồi để Kỹ thuật duyệt phần không chắc.

### Đợt 2 — khai hồ sơ mới + ảnh (11/08/2026)

`node scripts/bom-import-all.mjs --create-missing --images --apply`

| | |
|---|---:|
| **Hồ sơ khai mới** | **144** (CH 46 · TB 42 · OT 30 · BN 10 · SL 8 · ST 8) |
| **Ảnh SP moi từ file, gắn làm ảnh đại diện** | **121** |
| Dòng định mức đợt 2 | 2.466 |
| **Tổng sau 2 đợt** | 738 SP · **209 SP có định mức** · **3.993 dòng** · 140 cụm |
| SP có ảnh | 489 → **610** |

**Ảnh** moi từ `xl/media/*` trong chính file BOM: bám `sheet→drawing→media` để
file tổng 90 sheet lấy đúng ảnh của từng sheet; bỏ ảnh có `descr` chứa "logo"
và ảnh neo ở dòng < 4 (vùng khung tên), lấy ảnh to nhất còn lại.

**Suy hồ sơ từ tờ BOM** — ba luật phải vá sau khi dò khô lộ ra:
- **Tên file thắng ô "K.HÀNG"**: nhiều tờ copy từ mẫu khách khác mà quên sửa
  (`BOM_ROSCO_12.xlsx` vẫn ghi K.HÀNG "MERXX").
- **Bỏ mã cũ dính đuôi tên**: "Ghế 5pos Naxos 22025-309" → tên "Ghế 5pos Naxos",
  mã vào `code_legacy`.
- **Tên chỉ là số** (file ROSCO đặt theo số thứ tự: "12", "693T") → ghép tên
  khách: "ROSCO 12".

**Ba lỗi gặp khi ghi, đã sửa trong script:**
1. `part_no` là cột int mà cột đầu vài tờ là ô công thức → lọt `39584.6`. Nay chỉ
   nhận số nguyên 1–9999.
2. Một tờ hỏng làm sập cả mẻ và để lại hồ sơ rỗng. Nay bọc try/catch từng hồ sơ,
   lỗi thì xoá hồ sơ vừa tạo rồi đi tiếp.
3. **supabase-js chặn 1.000 dòng bất kể `.limit()`** → tập "SP đã có định mức"
   thiếu, nạp chồng lên bảng đã có (1 SP bị nhân đôi, đã dọn). Nay phân trang
   bằng `.range()`.

`bom_status` phải nâng tay sau khi ghi thẳng DB (`none` → `drawing` cho SP có
dòng) vì insert trực tiếp không đi qua service.

### Đợt 3 — gắn mã vật tư kho, chuỗi thông (11/08/2026)

`node scripts/bom-material-match.mjs --apply`

Khớp bằng ĐÚNG bộ khoá server dùng để chặn trùng lúc tạo vật tư
(`src/lib/material-key.ts`) — chỗ chặn và chỗ dò phải hiểu "trùng" giống nhau.

| | |
|---|---:|
| Dòng chưa có mã | 3.992 |
| **Đã gắn (mức CHẮC)** | **647** |
| Để rà tay (mức MỜ) | 50 |
| Chưa khớp | 3.295 |

Gắn theo nhóm: NGŨ KIM 354 · KHUNG 280 · BAO BÌ 39 · TEM 14 · GỖ 10.

**Hai lối dựng tên đem đi khớp:**
- Nhóm MUA RỜI (ngũ kim · bao bì · tem): `part_name` chính là tên hàng → khớp thẳng.
- Nhóm GIA CÔNG (khung · gỗ): `part_name` là tên CHI TIẾT ("Chân sau"), phải dựng
  lại tên vật tư từ vật liệu + hình dạng + tiết diện → `"nhôm hộp 30x100x1.7li"`.
  Tròn/vuông chỉ nêu MỘT chiều vì danh mục kho viết vậy.

**Ba chốt an toàn học được khi làm:**
1. **Mức MỜ không tự ghi.** `namesAlike` chỉ để cảnh báo; gán bừa một mã sai là
   Cung ứng mua nhầm mà không ai thấy. Xuất `mat-fuzzy.txt` cho người rà.
2. **Không lấy `part_name` làm dự phòng cho nhóm gia công** — "Chân sau" đem đi
   khớp danh mục kho là mời gọi gán bừa.
3. **Log phải in chuỗi THỰC SỰ khớp**, không in chuỗi dựng. Bản đầu in nhầm nên
   nhìn như "nhôm lưới 2x2li → Nhãn", che mất chuyện match đến từ đường khác.

Hiệu năng: `namesAlike` đòi CÙNG số từ và mọi từ mang số phải khớp tuyệt đối →
rổ ứng viên `"số từ | bộ số"` thay cho quét 13.168 vật tư mỗi dòng (52 triệu phép
so, quá 10 phút chưa xong).

### Kết quả cuối — Cung ứng đã bóc được nhu cầu

Form soạn đơn cho LSX 02/26-27 nay tự đề xuất **16 vật tư**, số lượng tính từ
`Σ định mức × SL` của mọi SP trong lệnh:

```
Vít 6x20, 7 màu   VIT0063   16.800 Con    ← 16 con/SP × (700 bồn lớn + 350 nhỏ)
LĐS 6X16X1Ly đen  LON0018    1.300 Con
Mạc đồng dán      NK-0018    1.200 Cái
Tán rút 6         BUL0260    1.200 Con
Túi vải           XM-0103    1.140 Cái
```

Lưu ý: **bảng chi tiết theo LSX ĐÈ lên BOM**. Lệnh 02/26-27 còn 4 dòng nhập demo
làm cả lệnh chỉ ra 1 vật tư; xoá đi thì mới ra đủ 16.

### Đợt 4 — rà và bổ sung ảnh + file BOM lưu trữ (11/08/2026)

`node scripts/bom-import-all.mjs --images --attach-file --apply`

Mọi sheet KHỚP được hồ sơ đều là nguồn ảnh + file lưu trữ cho hồ sơ đó, **kể cả
sheet không nạp định mức** (SP đã có bảng nhập tay). Chạy lại được: SP đã có ảnh
thì không đè, đã có file BOM thì bỏ qua.

| | |
|---|---:|
| Ảnh bổ sung | +19 |
| **File BOM gắn vào hồ sơ** | **+128** |
| SP có ảnh | 610 → **629** / 738 |
| SP có file BOM lưu trữ | **419** / 738 |

Sheet lạc hồ sơ giảm **155 → 10** sau khi 144 hồ sơ mới vào hệ (chúng khớp ngược
lại). 10 sheet còn lại là file ROSCO đặt tên theo số ("5", "693T", "7 ghế").

**Còn thiếu, và vì sao:**

| | Số SP | Lý do |
|---|---:|---|
| Thiếu ảnh | 109 | **83** không có tờ BOM nào khớp → không có nguồn ảnh; **26** có định mức nhưng tờ không có ảnh dùng được (chỉ logo, hoặc ảnh < 4 KB) |
| Thiếu file BOM | 319 | phần lớn là SP chưa có tờ BOM; **64 SP** bị chặn bởi trần dung lượng |

**Một file duy nhất gây ra 64 ca chặn**: `BOM MERXX CẦN CHUẨN HÓA LEAD TIME…xlsx`
nặng **19,4 MB** (90 sheet), vượt trần 10 MB của `doc_type: 'bom'`
(`src/lib/file-limits.ts`). Mọi file khác đều dưới 9 MB. Ba đường xử lý, chưa
chọn: nâng trần cho 'bom'; tách workbook đó thành 90 file một-sheet rồi gắn từng
cái (mất ảnh nhúng vì SheetJS không ghi ảnh, nhưng ảnh SP đã moi riêng); hoặc để
nguyên và chấp nhận 64 SP không có file gốc đính kèm.

### File tổng MERXX 19,4 MB — CHỐT: BỎ QUA phần còn lại (11/08/2026)

`BOM MERXX CẦN CHUẨN HÓA LEAD TIME HẾT NGÀY 27-07-2026.xlsx` (19,44 MB · 90 sheet)
là file DUY NHẤT trong kho vượt trần 10 MB của `doc_type: 'bom'`.

Đã xử lý bằng `scripts/bom-split-workbook.mjs`: tách 90 sheet thành 90 file riêng
**ở mức zip** — giữ nguyên XML của tờ gốc kể cả ảnh nhúng, chỉ vá `workbook.xml`,
rels của nó và `[Content_Types].xml`. Không đi qua bộ ghi lại của SheetJS nên
không mất ảnh/định dạng. Tự kiểm: mở lại từng file, đối chiếu tên sheet + số
dòng với bản gốc — 90/90 đạt, cỡ 0,03–2,20 MB.

Kết quả: **gắn 53 file**, bỏ 32 (SP đã có file BOM), còn **5 sheet chưa gắn**.

**User chốt: BỎ QUA 5 sheet còn lại.** Nguyên nhân đã xác định — lúc khai hồ sơ
hàng loạt, khoá chống trùng dùng `tên + tên file`, mà sau khi cắt mã khỏi tên thì
`Bàn NK 65 26441-217` và `Bàn NK 65 26440-219` ra cùng tên "Bàn NK 65" nên bản
thứ hai bị nuốt. Muốn làm sau thì đưa `code_legacy` vào khoá chống trùng, và cho
`matchProduct` nhận thêm dạng tên đã ghép khách ("ROSCO 5") để không tạo trùng.

### Đợt 5 — 'tròn' vs 'phi' + phân tích phần còn trống (13/08/2026)

User hỏi "có nên thêm hết định mức vào kho không" → chốt nguyên tắc: **kho chỉ
chứa thứ MUA VÀO và nhập-xuất-tồn được**. Chi tiết gia công (Chân sau…) không
bao giờ thành mã kho — chúng map về NGUYÊN LIỆU.

**Mở khóa từ vựng**: máy dựng "nhôm tròn 25x1li" nhưng danh mục gọi "Nhôm **phi**
25x1li" — thêm biến thể tròn→phi vào `bom-material-match.mjs`, gắn thêm **172
dòng mức CHẮC** (FRAME 182 hit trong đó 172 chắc; NGU_KIM/PACKAGING/LABEL lẻ tẻ).
Tổng đã gắn: 648 → **820/3.993**.

**3.173 dòng còn trống chia rổ** (`scripts/dinh-muc-gap-analysis.mjs`, 1.050 tổ hợp):

| Rổ | Tổ hợp / dòng | Xử lý |
|---|---|---|
| Nguyên liệu (khung/gỗ/tấm) danh tính ĐỦ nhưng kho không có mã | ~490 / ~1.700 | phần lớn là danh tính THIẾU MẢNH: "nhôm tròn 1li" (94 dòng — thiếu đường kính), "nhôm" (66), "sắt tròn" (48), "tròn 25x1.2li" (33 — thiếu vật liệu), "sắt tròn 19" (44 — thiếu độ dày, kho có nhiều biến thể phi 19) → **Kỹ thuật bổ sung tiết diện trên thẻ sửa** rồi máy chạy lại; phần kho thiếu thật (gỗ bạch đàn 25, gỗ Teck 20…) → **mở vài mã nguyên liệu mới** |
| Mua rời (ngũ kim/bao bì/tem) không khớp mã nào | 509 / 892 | ứng viên MÃ MỚI — xuất danh sách kèm tần suất cho Kho duyệt hàng loạt, KHÔNG cho máy tự đẻ (bài học materials-dedupe) |
| Mờ / trùng chéo chờ người chọn | ~37 / ~96 | mat-fuzzy.txt + các ca "Long đền" khớp 2 mã |
| Không dựng được danh tính | — / 393 | dòng thiếu cả vật liệu lẫn tiết diện trong file gốc |
| Chờ nghiệp vụ (nệm 42, vải, kính) | 6 / 58 | user chốt: may nội bộ (map mút/vải/gòn) hay đặt ngoài nguyên cái (mở mã) |

Bài học đợt này: trước khi kết luận "kho thiếu mã", soi TỪ VỰNG danh mục — một
từ lệch ('tròn'/'phi') giấu cả trăm mã có sẵn.
