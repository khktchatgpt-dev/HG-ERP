# Thiết kế lại ĐỊNH MỨC SẢN PHẨM — bản v2, bám biểu mẫu BOM mới

> **Nguồn chuẩn của bản này** (user đưa 27/07/2026):
> `BOM_Shelter Home_ ghế 3 Đan dây.xlsx` và `BOM_Shelter Home_ ghế 3 30x100 uống cong.xlsx`
> — biểu mẫu **"BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN"**, lần ban hành 1, hiệu lực 28-02-2026.
>
> Khác biệt lớn nhất so với mọi biểu mẫu đã khảo sát: có **cột `Parts/ Bộ phận`** —
> tức **CỤM** đã trở thành một cột chính thức trên bảng định mức, không còn nằm
> ngầm trong prefix tên chi tiết. Toàn bộ thiết kế dưới đây lấy trục
> **KHỐI → CỤM → CHI TIẾT** làm trục chính.

## 0. Quyết định user đã chốt (27/07/2026)

| # | Quyết định | Hệ quả |
|---|---|---|
| **D1** | **Xoá sạch** 1.316 dòng định mức cũ, làm lại theo cấu trúc mới | migration được đổi ngữ nghĩa cột, không cần tương thích ngược |
| **D2** | Diện tích sơn dùng **chu vi thật** (ống tròn = π·Ø); hiện thêm số theo công thức file để đối chiếu | `bom-calc` giữ 2 số, cột chính là số đúng |
| **D3** | `Bank 1` / `Bank 2` là **2 món của một bộ** "Shelter Home ghế 3" | **1 sheet BOM = 1 sản phẩm**; bộ ghép bằng `technical_product_set_items` |
| **D4** | **Bỏ mọi thứ tiền và phí khỏi định mức** — định mức chỉ giữ số lượng / quy cách | drop `unit_price`, `amount`; không thêm `currency`/NCC; khối tổng hợp thành **tổng hợp vật tư theo số lượng**; không có nhóm `LABOR` |

D4 gỡ được đúng chỗ mâu thuẫn nặng nhất của biểu mẫu Excel (xem §1.5) và làm
ranh giới với Cung ứng / Giá thành sạch hẳn: định mức trả lời **"cần bao nhiêu"**,
không trả lời "hết bao nhiêu tiền".

---

## 1. Giải phẫu biểu mẫu mới (đọc từ 2 file, không suy diễn)

### 1.1 Bố cục sheet `BOM`

| Vùng | Nội dung | Ghi chú |
|---|---|---|
| R2–R5 (F..P) | **Kiểm soát tài liệu**: Tạo Bảng kê (`Thức`), Xác nhận, Lần ban hành `1`, Trang `1/1`, Hiệu lực `28-2-2026`, Cập nhập | khối ISO, hệ chưa có chỗ lưu |
| R6 | Tiêu đề `BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN` | |
| B8:E16 | **Ảnh sản phẩm** — 3 ảnh nhúng / file | |
| R8–R14 (F..P) | TÊN SP `Bank 1`/`Bank 2` · Mã Số HG *(trống)* · K.HÀNG `SHELTER HOME` · MÃ K.HÀNG *(trống)* · KTSP `2300 x 840 x 580` (WxDxH mm) · KL.Thực tế/BK `10kg` · **Nhiên Liệu `Nhôm`** · Khối lượng `=K36` · Option `1cái / thùng` · KTBB `2340 · 880 · 620` · Cái/40HC `38` · NW · GW · GM `=(D+W)×2+L` · Fedex `=CONVERT(GM,mm,in)` | |
| **R17+ các KHỐI** | mỗi khối = 1 dải tiêu đề + 1 bảng riêng + 1 dòng Tổng cộng | **bộ cột khác nhau từng khối** |
| Sheet `Data` | Nhôm 2.7 · Sắt 7.85 · Inox 7.93; dạng: Vuông/Hộp/Tròn/LA/Tole | bảng tra tỉ trọng |
| Sheet `SOP PACKING` | trống ở cả 2 file | |

### 1.2 Các khối và bộ cột

Cột in đậm = **hệ thống lấy**; cột gạch ngang = ~~bỏ theo D4~~.

| Tiêu đề trong file | Họ layout | Cột |
|---|---|---|
| `Quy cách :` (kim loại) | **metal** | Stt · **Parts/Bộ phận** · Tên chi tiết · Loại · Dày · Rộng · Dài · **Phi hao chi tiết uốn** · SL · Tổng chiều dài (m) · Trọng lượng (kg) · Diện tích sơn (M²) · Dày vật liệu (δ) · Ghi chú · **Xác nhận Phôi** · ~~Đơn giá~~ · ~~Thành tiền~~ |
| `Quy cách gỗ:` | **wood** | Stt · Tên chi tiết · Dày · Rộng · Dài · **Mộng** · SL · Diện Tích (m²) · K.Lượng (m³) · Ghi chú |
| `Quy cách Nệm:` | **soft** | y như wood (nệm/vải vẫn có m³ trong 2 file này) |
| `VẬT TƯ NGŨ KIM` | **supply** | STT · TÊN HÀNG HÓA · Dày/Rộng/Dài · ĐVT · SL/SP · **Vật Liệu** · ~~ĐGIÁ~~ · Ghi chú · ~~TT~~ |
| `VẬT TƯ BAO BÌ` | **supply** | y như ngũ kim (`Vật Liệu` = Carton 5 lớp · PE Foam · OPP · Silica gel · Decal giấy) |
| `Nhôm+ Sơn + gỗ + dây` | **rollup** | STT · TÊN HÀNG HÓA · ĐVT · **SL/SP** · ~~ĐGIÁ~~ · ~~TT~~ · Ghi chú → thành **tổng hợp vật tư** (§3.5) |

Bốn họ `metal/wood/soft/supply` **khớp đúng** với `src/components/technical/part-layouts.ts`
đã dựng từ 246 file cũ ⇒ phần layout không phải làm lại, chỉ bổ sung cột mới và
bỏ 2 cột tiền.

### 1.3 Cụm — bằng chứng từ file

| File | Cột `Parts/ Bộ phận` |
|---|---|
| `ghế 3 30x100 uống cong` | `Cụm khung` ×4 dòng (Chân trước+Tay vin, Tựa, Chân sau, chân giữa) · `Cụm mê` ×6 dòng (Đố trước, Dọc mê+đố sau, Giằng mê, 3 dòng Nẹp vải) · **2 dòng để trống** (Pát góc, Pát Chân) |
| `ghế 3 Đan dây` | trống toàn bộ 15 dòng |

⇒ Hai kết luận thiết kế:
1. Cụm **không bắt buộc** — SP đơn giản để trống, và phải có chỗ hiển thị đàng hoàng
   cho dòng không thuộc cụm nào (nhóm ảo **"Rời"**, không được ẩn).
2. Cụm **không có số riêng** trong biểu mẫu (không có "SL cụm/SP", không có KL cụm).
   Nhưng sổ `Tổng TĐ SX` của xưởng đếm theo cụm từ công đoạn hàn trở đi ⇒ cụm cần
   chỗ để *tuỳ chọn* khai `SL cụm/SP` + lộ trình công đoạn, mặc định trống.

### 1.4 Công thức Excel (đã giải mã, cần code lại)

```
Tổng chiều dài (m) = (Dài + Phi hao uốn) × SL / 1000
Trọng lượng (kg)   = tiết_diện(Loại) × Tổng chiều dài × ρ(Nhiên liệu)
    Hộp    (2·δ·(Dày+Rộng) − 4δ²) /1000       Vuông (4·δ·Rộng − 4δ²) /1000
    Tròn   (Rộng − δ)·δ·3.14 /1000            LA/Tole  δ·Rộng /1000
    TD-HG04 (profile riêng)  = 0.260 kg/m × Tổng chiều dài   ← hằng số kg/m
    ρ: Nhôm 2.7 · Sắt 7.85 · Inox 7.93
Diện tích sơn (M²) = SL × (Dày + Rộng) × 2 × Dài × 10⁻⁶      ← KHÔNG cộng phi hao
Gỗ/Nệm: Diện tích = SL × (Dày+Rộng) × 2 × (Dài + Mộng) × 10⁻⁶
        K.Lượng   = Dày × Rộng × (Dài + Mộng) × SL / 10⁹
Sơn (rollup)       = Σ Diện tích sơn ÷ 5        (5 m²/kg, đang hard-code trong file)
```

Ba công thức tiết diện Hộp/Vuông/Tròn của file **trùng khít** nghiệp vụ hình học
đúng (`crossSectionM2` trong `src/lib/bom-calc.ts` cho cùng kết quả) ⇒ không có
tranh chấp ở phần khối lượng. Bốn điểm **lệch thật** giữa file và `bom-calc.ts`,
phải xử lý:

| # | File Excel | `bom-calc.ts` hiện tại | Xử lý |
|---|---|---|---|
| L1 | Tổng dài **cộng** Phi hao uốn (mm) | bỏ qua phi hao | thêm `bend_waste_mm`, cộng vào |
| L2 | DT sơn dùng chu vi **hình chữ nhật** `(a+b)×2` cho **mọi** dạng, kể cả ống tròn (Ø16 → 64 mm thay vì 50,3 mm, **+27%**) | chu vi thật `π·a` | **D2**: cột chính = chu vi thật; giữ thêm `paint_area_box_m2` theo công thức file, hiện trong tooltip để đối chiếu bảng kê giấy |
| L3 | `TD-HG04` = 0.260 kg/m | không có khái niệm kg/m | thêm `kg_per_m` |
| L4 | LA/Tole: tiết diện `δ × Rộng` | `Dày × Rộng` | LA/Tole ưu tiên δ, thiếu δ mới lấy Dày |

### 1.5 Bằng chứng "Excel đang sai" — lý do phải chuyển vào hệ thống

Không phải lý thuyết, đây là lỗi trong đúng 2 file mẫu:

* **Tổng SL sai 6 cái**: file `30x100 uống cong` dòng Tổng cộng lấy `SUM(I20:I29)` = **16**,
  nhưng bảng có dữ liệu tới dòng 31 (Pát góc 4 + Pát chân 2) ⇒ số thật là **22**.
  Dải sum chưa nới khi thêm dòng. *Đây chính là 2 dòng không thuộc cụm nào* — nên
  §4.1 quy định nhóm "Rời" không bao giờ được ẩn.
* **Đặt hàng thiếu một nửa** — nặng nhất. File `30x100 uống cong` dòng 28
  "Nẹp vải hông mê" có **SL = 2**, nhưng cả hai công thức đều trỏ `I27` (SL của
  dòng TRÊN = 1):
  `J28 = (G28+H28)*I27/1000` → 0,58 m thay vì 1,16 m
  `L28 = I27*(E28+F28)*2*G28*…` → 0,04176 m² thay vì 0,0835 m²
  Sai số lan sang khối lượng (0,1508 kg thay vì 0,3016 kg). Cắt theo bảng kê này
  là **thiếu đúng một cây nẹp mỗi sản phẩm**. Bộ đọc file bắt được ngay khi nạp.
* **Diện tích sơn trỏ nhầm cột**: file `Đan dây` L23 = `I23*(E23+F23)*2*H23*10^-6`
  — nhân với **H23 (Phi hao uốn, đang trống)** thay vì G23 (Dài) ⇒ ra **0**.
  Dòng "Chống tựa" coi như không tốn sơn.
* **Thành tiền trỏ sai ô**: file `Đan dây` R27 = `K27*Q26` (giá của dòng 26).
* **Trộn 2 loại tiền trong một cột**: khối rollup file `Đan dây` có `Gỗ keo tay 1,62`
  và `Gỗ keo đố trước 6,045` ghi chú **"Giá USD"** đứng cùng cột với `Dây dù đen 383.400`
  VND ⇒ khối này **không có dòng tổng**, vì cộng lại thì vô nghĩa. Bằng chứng mạnh
  nhất cho **D4**: tiền không thuộc về bảng định mức.
* **KL thực tế là chuỗi** `"10kg"`, KTSP là chuỗi `"2330 x 840 x 580"` ⇒ không tính được.
* Dải `SUM(J20:J35)` chạy quá vùng dữ liệu; `SUM(M63:M72)` bắt đầu từ dòng tiêu đề.

⇒ Mọi đại lượng dẫn xuất (tổng dài, KL, DT sơn, m³, các dòng tổng) **phải là số
tính ra**, không phải số nhập tay. Người dùng vẫn ghi đè được từng ô, nhưng ô bị
ghi đè phải **hiện cờ lệch** so với số tính.

---

## 2. Đối chiếu schema hiện tại

`technical_product_parts` (31 cột, sau 0092–0096) đã có: `group_code` (FK
`technical_part_groups`), `section_title`, `unit_basis`, `set_item_label`,
`part_no`, `part_name`, `material_code/kind`, `profile_shape/code`, `dim_a_mm`,
`dim_b_mm`, `wall_thickness_mm`, `cut_length_mm`, `tenon`, `qty`, `unit`,
`waste_pct`, `weight_kg`, `total_length_m`, `paint_area_m2`, `volume_m3`,
`unit_price`, `amount`, `material_note`, `note`, `sort_order`.

| # | Việc | Cột / bảng |
|---|---|---|
| T1 | **Cụm** (`Parts/ Bộ phận`) — thiếu | bảng `technical_product_clusters` + `parts.cluster_id` |
| T2 | Phi hao uốn tính bằng **mm**, không phải % | thêm `bend_waste_mm`, **drop `waste_pct`** |
| T3 | **Xác nhận Phôi** (xưởng tick từng dòng) | `blank_confirmed_at`, `blank_confirmed_by` |
| T4 | Mộng dùng để **tính** (Dài + Mộng) nhưng đang là text | `tenon_mm` numeric (giữ `tenon` text cho chú thích) |
| T5 | Profile tính theo **kg/m** (`TD-HG04 / 0.260`) | `kg_per_m` |
| T6 | DT sơn theo công thức file, để đối chiếu (D2) | `paint_area_box_m2` |
| T7 | Màu (sơn / vật tư) — là **quy cách**, không phải tiền | `color` |
| T8 | Nhiên liệu nền + tỉ trọng của SP | `technical_products.base_material` |
| T9 | Kiểm soát tài liệu (lần ban hành / hiệu lực / người lập / xác nhận) | 4 cột trên `technical_products` |
| T10 | KL thực tế vs KL tính | `technical_products.actual_weight_kg` |
| T11 | Hệ số sơn (5 m²/kg) | `technical_products.paint_coverage_m2_per_kg` |
| T12 | Ai sửa dòng cuối | `updated_by` |
| **T13** | **Tiền — bỏ (D4)** | **drop `unit_price`, `amount`** |
| **T14** | **Món trong bộ — bỏ (D3)** | **drop `set_item_label`**; 1 sheet = 1 SP, bộ ghép bằng `technical_product_set_items` |

**Về T14:** biểu mẫu mới có đúng **một** ô `TÊN SP` cho cả sheet (`Bank 2`), tức
một file = một sản phẩm. Bộ "Shelter Home ghế 3" = SP mã `ST…` trỏ tới Bank 1 và
Bank 2 qua `set_items.item_product_id`, mỗi món giữ định mức riêng — không nhân
đôi dòng. Giữ `set_item_label` chỉ tạo thêm một cấp gom vô nghĩa trong bảng
(khối → **món** → cụm → chi tiết = 4 cấp). Bỏ nó, còn đúng 3 cấp.

---

## 3. Thiết kế cấu trúc

### 3.1 CỤM là bảng riêng, KHÔNG phải cột text, KHÔNG phải dòng tự-FK

```sql
create table if not exists public.technical_product_clusters (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.technical_products(id) on delete cascade,
  name            text not null,                 -- "Cụm khung", "Cụm mê" — đúng chữ cột B
  qty_per_product numeric(14,4),                 -- SL cụm / SP (sổ Tổng TĐ SX); null = chưa khai
  first_stage     text,                          -- code production_stages, mặc định 'han'
  final_stage     text,                          -- mặc định 'son'
  note            text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, name)
);
```

**Vì sao bảng riêng, không phải 2 cách kia:**

| Cách | Vấn đề |
|---|---|
| `cluster text` trên từng dòng (đúng như Excel) | gõ lệch một ký tự là tách thành 2 cụm — đúng chỗ vỡ của Excel; và không có chỗ treo `SL cụm/SP` + lộ trình |
| dòng `kind='assembly'` + `parent_part_id` tự-FK | cụm thành một dòng định mức có `qty` ⇒ rủi ro **cộng hai lần** vào tổng KL; phải thêm invariant "cha phải là assembly, cùng product"; dòng cụm để trống hết cột quy cách |
| bảng riêng + `cluster_id` (**chọn**) | tên cụm lưu 1 chỗ → đổi tên không drift; cụm có số riêng khi cần; dòng định mức vẫn thuần "thứ cắt/mua được" nên mọi phép tổng an toàn; `cluster_id is null` = dòng rời, hợp lệ vĩnh viễn |

**Chốt: chỉ 2 cấp đếm, không cụm-lồng-cụm.**
Cây đầy đủ: `SẢN PHẨM → KHỐI (group + section) → CỤM → CHI TIẾT`.

### 3.2 Cột thay đổi trên dòng định mức

```sql
alter table public.technical_product_parts
  add column cluster_id         uuid references public.technical_product_clusters(id) on delete set null,
  add column bend_waste_mm      numeric(10,2),          -- T2 "Phi hao chi tiết uốn"
  add column tenon_mm           numeric(10,2),          -- T4 Mộng, tham gia công thức
  add column kg_per_m           numeric(12,4),          -- T5 profile tra bảng (TD-HG04 = 0.260)
  add column paint_area_box_m2  numeric(14,6),          -- T6 DT sơn theo công thức file (đối chiếu)
  add column color              text,                   -- T7
  add column blank_confirmed_at timestamptz,            -- T3 Xác nhận Phôi
  add column blank_confirmed_by uuid references public.users(id) on delete set null,
  add column updated_by         uuid references public.users(id) on delete set null;

-- D4: định mức không cầm tiền.  T2: phi hao là mm.  D3: một sheet một SP.
alter table public.technical_product_parts
  drop column unit_price,
  drop column amount,
  drop column waste_pct,
  drop column set_item_label;
```

### 3.3 Cột thêm cho sản phẩm

```sql
alter table public.technical_products
  add column base_material              text,           -- T8 'AL' | 'IR' | 'IN' → tra ρ
  add column actual_weight_kg           numeric(12,3),  -- T10 "KL.Thực tế / BK"
  add column paint_coverage_m2_per_kg   numeric(8,2) default 5,  -- T11
  add column bom_rev                    integer,        -- T9 Lần ban hành
  add column bom_effective_date         date,           -- T9 Hiệu lực
  add column bom_prepared_by            text,           -- T9 Tạo Bảng kê ("Thức")
  add column bom_approved_by            text;           -- T9 Xác nhận
```

`base_material` chỉ là **mặc định**; `parts.material_kind` per-dòng vẫn thắng — cần
cho SP khung Sắt + đế Nhôm, thứ mà biểu mẫu Excel với **một** ô `Nhiên Liệu` duy
nhất không diễn tả được.

### 3.4 Khối (block) — giữ cách suy từ `(group_code, section_title)`

Không tạo bảng `sections`. Khối đã hiện đúng bằng `group_code` + `section_title` +
`sort_order`, `part-layouts.ts` đã chọn bộ cột theo nhóm, và thứ tự khối khác nhau
giữa 2 file (file `Đan dây` có *gỗ* rồi *nệm*; file kia chỉ *nệm*) — `sort_order`
tải được. Thêm bảng nữa chỉ tăng chỗ để lệch.

Danh mục `technical_part_groups` (9 nhóm hiện có) **giữ nguyên** — theo D4 không
mở nhóm `LABOR`. `MAT_BAN` (mặt bàn đá/sintered) 2 file này không có ⇒ hoãn.

### 3.5 Khối cuối = TỔNG HỢP VẬT TƯ (số lượng), tính chứ không nhập

Khối `Nhôm+ Sơn + gỗ + dây` sau khi bỏ 2 cột tiền còn lại đúng phần có giá trị:
**thứ gì, bao nhiêu, đơn vị nào** — chính là đầu vào Cung ứng cần.

| Dòng | ĐVT | Nguồn |
|---|---|---|
| `Nhôm` | kg | **tính**: Σ `weight_kg` của khối metal, tách theo `material_kind` |
| `Sơn` | kg | **tính**: Σ `paint_area_m2` ÷ `paint_coverage_m2_per_kg` |
| `Gỗ keo` | m³ | **tính**: Σ `volume_m3` của khối wood |
| `Dây dù đen` | kg | **dòng thật**, nhóm `DAY_DAN` |
| ~~`Công đan`~~ | — | **bỏ** — là tiền công, và số lượng 5,4 kg trùng đúng dòng dây |

⇒ UI hiện khối này là **panel tính sẵn**, mọi dòng có ký hiệu `ƒ` trừ dòng vật tư
thật. Không sửa được tại panel — muốn đổi thì sửa dòng gốc.

### 3.6 Vòng đời & quyền

| `bom_status` | Ai sửa |
|---|---|
| `none` / `drawing` (NHÁP) | Kỹ thuật **và** thống kê xưởng — CRUD từng dòng |
| `done` (ĐÃ CHỐT) | chỉ Kỹ thuật; xưởng gửi đề xuất |

**Điểm mới:** cột `Xác nhận Phôi` là quyền **xưởng phôi**, tick được ở **mọi**
trạng thái (kể cả `done`) vì nó không sửa số liệu — chỉ ghi "đã xác nhận phôi đúng
như định mức". Đây là vòng phản hồi Sản xuất → Kỹ thuật nhẹ nhất, có sẵn trong
biểu mẫu; làm trước màn "So lệch định mức" (vẫn giữ trong lộ trình).

---

## 4. Thiết kế UI/UX

### 4.1 Tab **Định mức** — trục KHỐI → CỤM → CHI TIẾT

```
┌ Định mức chi tiết ──────── [Tìm] [Chép SP khác] [Nhập từ file BOM] [Nhập tại chỗ] ┐
│ 22 chi tiết · 2 cụm · 12,571 kg nhôm · 3,256 m² sơn · 12/22 ✓phôi                 │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ▾ KHUNG · Quy cách:                    Nhôm ρ2,7    12 dòng · 12,571 kg           │
│                                                                                   │
│   ▾ ⬢ Cụm khung        4 ct · 7,115 kg · hàn→sơn · 1 cụm/SP                  ⋯   │
│     Stt Tên chi tiết      Loại Dày Rộng Dài  Phi hao SL TổngDài  KL   DTsơn δ  ✓ │
│      1  Chân trước+Tay vin Hộp  30  100 1575    —    2   3,150 3,661 0,819 1,7 ○ │
│      2  Tựa                Hộp  30  100 1800    —    1   1,800 2,092 0,468 1,7 ✓ │
│      …                                          ─────  ───── ───── ─────         │
│      Σ Cụm khung                                    7   6,290 7,115 1,572         │
│                                                                                   │
│   ▾ ⬢ Cụm mê           6 ct · 4,318 kg · hàn→sơn                            ⋯   │
│      …                                                                            │
│   ▾ ○ Rời (không thuộc cụm)                     2 ct · 0,138 kg             ⋯   │
│      Pát góc · Pát Chân                                                           │
│                                                                                   │
│   Σ KHỐI KHUNG                                     22  19,085 12,571 3,256        │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ▾ NỆM & VẢI · Quy cách Nệm:            4 dòng · 0,712 m³   (cột Mộng, m², m³)     │
│ ▾ NGŨ KIM                              5 dòng            (cột ĐVT, Vật liệu, Màu) │
│ ▾ BAO BÌ                               5 dòng                                     │
├───────────────────────────────────────────────────────────────────────────────────┤
│ ▾ ƒ TỔNG HỢP VẬT TƯ                        (số lượng — Cung ứng đọc bảng này)     │
│   ƒ Nhôm          kg  12,571     ← Σ khối KHUNG                                   │
│   ƒ Sơn           kg   0,651     ← 3,256 m² ÷ 5 m²/kg                             │
│   ƒ Gỗ keo        m³   0,005     ← Σ khối GỖ                                      │
│     Dây dù đen    kg   5,400                                                      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Nguyên tắc hiển thị:

1. **Bộ cột theo họ khối** — giữ `part-layouts.ts`, sửa: bỏ `COL.price`/`COL.amount`;
   `metal` thêm `Phi hao (mm)` + `✓ Phôi`; `wood`/`soft` thêm `Mộng (mm)`;
   `supply` thêm `Màu`.
2. **Cột rỗng tự ẩn theo từng nhóm** — cơ chế `columnsFor()` đã có, giữ.
3. **Dòng tổng ở 3 mức**: Σ cụm → Σ khối → Σ SP. Tất cả **tính**, không nhập.
4. **Số ghi đè hiện cờ**: ô người nhập lệch >5% so với hình học → viền vàng +
   tooltip "hình học tính ra X" (`deviation()` đã có trong `bom-calc.ts`).
   Cột DT sơn: tooltip hiện thêm **"theo công thức bảng kê: Y m²"** (D2).
5. **Nhóm "Rời" không bao giờ bị ẩn** — đúng 2 dòng Pát bị lọt khỏi dòng Tổng cộng
   của file Excel là do bị bỏ quên (§1.5).
6. **Ký hiệu `ƒ`** cho mọi số tự tính, để người dùng biết chỗ nào sửa được.

### 4.2 Thao tác với cụm

| Thao tác | Cách làm |
|---|---|
| Gán cụm cho 1 dòng | ô `Cụm` trên dòng là **combobox**: chọn cụm có sẵn, hoặc gõ tên mới → tạo cụm ngay (gõ y như cột B của Excel, nhưng lưu bằng `cluster_id`) |
| Gom nhiều dòng | tick checkbox nhiều dòng → thanh hành động nổi lên → **"Gom thành cụm…"** → nhập tên |
| Đổi tên cụm | ⋯ trên dải cụm → sửa 1 chỗ, mọi dòng theo (không drift) |
| Đặt lộ trình / SL cụm/SP | ⋯ → hộp nhỏ: `SL cụm/SP`, `công đoạn đầu`, `công đoạn cuối` (mặc định hàn→sơn) |
| Bỏ cụm | ⋯ → dòng con về **Rời**, cụm xoá (`on delete set null`, không mất dòng nào) |
| Chuyển cụm hàng loạt | tick nhiều dòng → "Chuyển sang cụm…" |

Không kéo-thả: bảng có scroll ngang, kéo-thả trên bảng rộng là nguồn của lỗi thả
sai chỗ. Combobox + tick nhiều dòng phủ đủ nhu cầu và gõ nhanh hơn.

### 4.3 Đầu hồ sơ — thẻ "Bảng kê" tái hiện block header

Thẻ mới trên tab **Thông số**, đọc như đầu trang biểu mẫu:

* **Nhận diện**: Tên SP · Mã HG · Khách · Mã khách · Ảnh (gallery 3 ảnh) ·
  **Thuộc bộ**: chip trỏ sang SP bộ nếu món này nằm trong `set_items` (D3).
* **Kỹ thuật**: KTSP `W × D × H mm` · **Nhiên liệu** (`Nhôm ρ2,7` — select hiện
  tỉ trọng) · KL tính `ƒ12,571 kg` cạnh **KL thực tế** `10 kg`, lệch >10% thì cờ
  vàng (đúng thứ ô `KL.Thực tế / BK` của biểu mẫu định so).
* **Đóng gói**: Option `1 cái/thùng` · KTBB `2340×880×620` · Cái/40HC `38` ·
  NW · GW · `ƒGM 5.340 mm` · `ƒFedex 210,2 in` (2 số cuối tự tính, bỏ ô trùng).
* **Kiểm soát tài liệu** (dòng nhỏ, chữ nhạt): `Lần ban hành 1 · Hiệu lực
  28/02/2026 · Lập: Thức · Xác nhận: — · Cập nhật: <updated_by, thời điểm>`.

### 4.4 Nhập liệu

| Đường vào | Trạng thái |
|---|---|
| **Nhập tại chỗ** (ô trong bảng thành ô nhập, dòng trống cuối mỗi cụm) | đã có, giữ; thêm cột Cụm / Phi hao / Mộng, bỏ ô `waste_pct` và 2 ô tiền |
| **Nhập từ file BOM** (upload đúng template này) | **mới** — nhận diện dải tiêu đề khối, đọc **cột B thành cụm**, map `Loại`→`profile_shape`, lấy **giá trị** công thức (không lấy chuỗi công thức), bỏ dòng rỗng, và **cảnh báo** khi dòng Tổng cộng của file lệch số tính (vụ SL 16 vs 22) |
| **Dán từ Excel** (paste vùng ô) | đã có, thêm cột Cụm |
| **Chép từ SP khác** | đã có; phải chép **cả cụm** (tạo cụm cùng tên bên SP đích) |

### 4.5 Kết xuất

* **In bảng định mức** — layout đúng biểu mẫu (khối kiểm soát tài liệu, ảnh, các
  khối theo thứ tự, dòng Tổng cộng), **không có cột tiền**. Đây là tờ giấy xưởng dùng.
* **Xuất Excel** theo template, để gửi ra ngoài.
* Trang cho **Cung ứng**: gộp theo `material_code`, số = `qty × units_per_product`,
  cộng thêm bảng §3.5.

---

## 5. Ảnh hưởng tới các phòng khác

| Phòng | Trục đọc | Thay đổi |
|---|---|---|
| Kỹ thuật | KHỐI → CỤM → CHI TIẾT | chủ hồ sơ, CRUD + gom cụm |
| Sản xuất | phôi đếm **chi tiết**, hàn trở đi đếm **cụm** | `suggest('bom')` mang thêm `cluster` + `first/final_stage` + `source_part_id`; `production_components.cluster` map từ `clusters.name` |
| Cung ứng | vật tư → tổng nhu cầu | view gộp theo `material_code` (0096 đã nối bằng mã text) + bảng tổng hợp §3.5 |
| Giá thành | — | **không đọc định mức nữa** (D4). Giá lấy từ bảng giá NCC bên Cung ứng, ghép với số lượng của §3.5 |

`production_components` giữ vai trò **snapshot theo LSX** (0084/0090) — không đổi.
Thêm `source_part_id` để về sau so lệch từng dòng.

**Phạm vi ảnh hưởng của 4 lệnh `drop column` — đã rà, gọn hơn dự kiến:**

| Chỗ | Đang dùng | Sau khi đổi |
|---|---|---|
| `technical.repo.ts:437` (`PART_COLS`) | liệt kê cả 4 cột | sửa danh sách cột |
| `technical.repo.ts:374–395`, `technical.service.ts:415–441` | type + insert | bỏ 4 trường, thêm `cluster_id` |
| `lib/bom-copy.ts:16,29` | chép `set_item_label`, `waste_pct` | chép `cluster_id` (tạo cụm cùng tên bên SP đích) + `bend_waste_mm` |
| **`production/components.service.ts:152`** | `cluster: p.set_item_label ?? null` — **đang mượn nhãn món làm cụm** | `cluster: p.cluster.name` — đây chính là chỗ thiết kế mới trả về đúng nghĩa |
| `part-layouts.ts`, `ProductPartsCard`, `PartRowInline`, `PartsBulkEntry`, `PartLineEdit`, `ProductProfileCards` | cột + ô nhập | §4.1/§4.4 |

`unit_price`/`amount` **không** có chỗ đọc nào ngoài module Kỹ thuật — 40+ file
còn lại khớp chữ `amount` là của báo giá / đơn hàng / PO / hoá đơn, dùng bảng riêng.
Bỏ tiền khỏi định mức **không đụng** Kinh doanh, Cung ứng hay Kế toán.

---

## 6. Lộ trình

| Bước | Việc | Trạng thái |
|---|---|---|
| 0 | **Xoá định mức cũ** (D1) | ✅ 1.316 dòng / 49 SP đã xoá, 49 SP về `bom_status='none'`. Bản lưu: `supabase/backups/2026-07-27_technical_product_parts.{json,csv}` |
| 1 | `0097_bom_cluster_and_form_fields.sql` | ✅ đã apply lên DB thật |
| 2 | `sync-types` | ✅ |
| 3 | `bom-calc.ts` v2 | ✅ phi hao mm · kg/m · LA theo δ · DT sơn 2 số (D2) · m³ · 8 test đối chiếu **từng ô** của 2 file mẫu |
| 4 | schema + repo + service + route | ✅ `clusters` CRUD, gán cụm hàng loạt, `blank_confirm` (quyền xưởng), bỏ `waste_pct`/`unit_price`/`amount`/`set_item_label` |
| 5 | UI tab Định mức | ✅ §4.1 + §4.2 — cụm, nhóm Rời, tổng theo cụm, gom cụm hàng loạt, đổi tên tại chỗ |
| 6 | Thẻ "Bảng kê" đầu hồ sơ | ⬜ §4.3 — cột DB đã có (`base_material`, `actual_weight_kg`, `bom_rev`…), chưa dựng giao diện |
| 7 | Bộ đọc file BOM mới | 🟡 bản thử `scripts/seed-bom-sample.mjs` chạy được (đã nạp cả 2 file); chưa thành nút bấm trong app |
| 8 | `suggest('bom')` mang cụm + lộ trình | 🟡 cụm đã đúng (thay chỗ mượn `set_item_label`); lộ trình `first/final_stage` chưa truyền |
| 9 | In / Xuất Excel + trang Cung ứng | ⬜ §4.5 |

**Đối chiếu sau khi nạp thật** (`scripts/seed-bom-sample.mjs`):

| File | Dòng | Cụm | Kết quả |
|---|---|---|---|
| `Đan dây` (TEST-BANK2) | 36 | 0 — tất cả Rời | **khớp mọi ô** đã tính sẵn trong file |
| `30x100 uống cong` (TEST-BANK1) | 26 | Cụm khung · Cụm mê · 16 dòng Rời | khớp mọi ô **trừ** dòng 28 mà file tính sai (§1.5) |

Các tổng đối chiếu được: nệm `Σ m² = 11,8688` (file J48 = 11,86882) · `Σ m³ = 0,711881`
(file K48 = 0,7118814) · khung `Σ kg = 12,7215` (file 12,5707 + phần dòng 28 bị thiếu).

Test bắt buộc (`CLAUDE.md`): `bom-calc` v2 phải khớp **từng ô** của 2 file mẫu —
trừ các ô Excel sai đã liệt kê ở §1.5, những ô đó test theo số **đúng**, kèm
comment chỉ rõ file gốc sai chỗ nào.

---

## 7. Còn chờ chốt

**Q3 — KTSP đơn vị nào.** Biểu mẫu ghi **mm** (`2300 x 840 x 580`), hệ đang lưu
`packing.l/w/h_cm` theo **cm**. Đổi sang mm cho khớp biểu mẫu (phải sửa chỗ đọc ở
Kinh doanh / báo giá), hay giữ cm và chỉ đổi đơn vị khi hiện/in?
