# Thống kê sản xuất — thiết kế lại, đọc từ file `QUAN_LY_TIEN_DO_SX_v2`

Viết 22/09/2026. Nguồn: `QUAN_LY_TIEN_DO_SX_v2 (Repaired).xlsx` — 19 sheet, bóc
toàn bộ công thức, đối chiếu với mã nguồn và **DB thật** (đo cùng ngày, số ở §6).

Tài liệu này trả lời đúng một câu chủ dự án đặt ra: **file Excel trực quan hơn màn
Thống kê trên hệ thống ở chỗ nào, và phải dựng lại thế nào cho bằng.**

**Đọc trước:**

1. [`san-xuat-quy-trinh-vai-tro.md`](san-xuat-quy-trinh-vai-tro.md) — quy trình, vai, máy trạng thái.
2. [`san-xuat-thiet-ke-giao-dien.md`](san-xuat-thiet-ke-giao-dien.md) — bản đồ màn khu Sản xuất.
3. [`san-xuat-test-case-thong-ke.md`](san-xuat-test-case-thong-ke.md) — 21 ca chạy thật 22/09, 6 lỗi đã vá.
4. [`/design-lab`](../src/app/design-lab/page.tsx) — sáu khuôn màn.

---

## 1. File có gì — 19 sheet, ba lớp

**Nguyên tắc của file: MỘT file = MỘT lệnh sản xuất.** Đây là ràng buộc lớn nhất
của nó, và cũng là thứ app không được chép lại (§5).

| Lớp          | Sheet                                   | Vai trò                                                                      |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| **Khai báo** | `THONG_TIN`, `DANH_MUC`                 | Đầu lệnh, danh sách SP, 7 công đoạn, danh sách tổ + điểm gia công ngoài      |
| **Định mức** | `DM_CUM` (100 dòng), `DM_CHITIET` (300) | SP → cụm → chi tiết, hệ số nhân, và cờ `x` "cụm này đi qua công đoạn nào"    |
| **Ghi sổ**   | `CD_PHOI` … `CD_DONGGOI` (7 sheet)      | Ma trận **dòng × 100 cột ngày**, mỗi ô = số làm được RIÊNG ngày đó           |
| **Ghi sổ**   | `GC_1` … `GC_5` (5 sheet)               | Gia công ngoài: 4 đợt giao + ma trận ngày trả về                             |
| **Báo cáo**  | `TONG_HOP`, `BC_CONG_DOAN`              | Tự động 100%, 4 biểu đồ, không có ô nhập nào                                 |

Sức chứa khai trong `HDSD`: 20 SP · 100 cụm · 300 chi tiết · 100 ngày · 5 điểm gia
công. Hết 100 ngày thì **phải copy file**, không được đổi ngày bắt đầu.

---

## 2. Mô hình dữ liệu — ba tầng đếm, và app chỉ có hai

Đây là **khác biệt gốc**; mọi khác biệt về giao diện đều mọc ra từ đây.

```
File Excel:   BỘ  ──(Cụm/SP)──▶  CỤM  ──(CT/cụm)──▶  CHI TIẾT
              400      × 2         800      × 1          800

App hôm nay:  BỘ  ─────────(qty_per_unit)─────────▶  CHI TIẾT
```

- `DM_CUM.E` = **Cụm/SP** (ví dụ "Dọc tựa" 2 cái mỗi ghế).
- `DM_CHITIET.K` = **CT/cụm** (ví dụ "Chân trước" 2 cái mỗi cụm chân trước).
- `Tổng cần (CT) = SL bộ × Cụm/SP × CT/cụm`.

Tầng **CỤM** không phải trang trí: **6/7 công đoạn của file đếm theo CỤM**, chỉ
Phôi đếm theo CHI TIẾT (`DANH_MUC.C`). Tổ hàn báo "hôm nay hàn 120 cụm chân
trước", không báo 240 chân.

**Trong DB hôm nay** (đo 22/09): 876 dòng `production_components`, trong đó
**32 dòng có `cluster`, 1 dòng `kind='assembly'`**. Tầng cụm gần như trống. App
đang vá bằng `lib/default-assembly.ts` ("cụm mặc nhiên" — BOM phẳng thì từ hàn trở
đi đếm theo BỘ). Vá đó đúng hướng, nhưng nó **suy** ra tầng giữa còn file thì
**khai** tầng giữa. Suy được số lượng cụm, không suy được TÊN cụm — mà tên cụm
("Cụm chân trước") chính là thứ tổ trưởng gọi nhau ngoài xưởng.

**Cờ `x` — lộ trình khai theo CỤM, không suy theo nhóm vật tư.** `DM_CUM` cột
G..L: mỗi cụm đánh `x` vào công đoạn nó phải đi qua. App suy lộ trình từ
`group_code` (`lib/stage-route.ts`) vì **875/876 chi tiết thiếu `first_stage`, 869
thiếu `final_stage`**. Suy thì phủ được gần hết, nhưng suy sai một nhóm là cả cột
sai mà không ai biết — khai thì sai ở đâu nhìn thấy ở đó.

---

## 3. Bảy phép tính của file — app có chưa

Chép nguyên văn công thức, vì đây là phần phải làm cho đúng.

| #   | Tên trong file                                 | Công thức                                              | App có?                                     |
| --- | ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| 1   | **Nội bộ đã làm** (`CD_*.H`)                   | `SUM(P:DK)` — cộng 100 cột ngày                        | ✅ `production_entries`                     |
| 2   | **GC ngoài đã trả** (`CD_*.I`)                 | `Σ GC_n.M` với `GC_n.E2` = công đoạn này               | ⚠️ bảng có, **0 dòng, 0 màn**               |
| 3   | **Cụm đủ phôi** (`CD_PHOI.N`)                  | `INT(J / CT-per-cụm)`                                  | ❌ không có                                 |
| 4   | **Bộ tương đương** (`CD_*.N`)                  | `INT(J / Cụm-per-bộ)`                                  | ⚠️ có trong `worklist.setsDone`, không bày  |
| 5   | **Bộ đồng bộ per mảnh** (`BC.M32`)             | `INT( CD_PHOI.N / Cụm-per-bộ )`                        | ❌                                          |
| 6   | **Bộ tương đương per SP × công đoạn** (`BC.L8`) | `MINIFS(bộ-đồng-bộ theo SP)` — **mảnh chậm nhất**      | ⚠️ tính được, không có màn                  |
| 7   | **Bộ hoàn chỉnh** (`BC.Z8`)                    | `MIN` qua các công đoạn SP đi qua                      | ⚠️ `LsxCard.done_sets` gần giống            |

Chuỗi `MIN` ba tầng của file rất sạch: **mảnh → cụm → bộ**, rồi `MIN` lần nữa
**qua các công đoạn**. Kết quả cuối cùng (`Bộ hoàn chỉnh`) là con số duy nhất trả
lời "giao được bao nhiêu".

### 3b. Hai mẫu số — file bày cả hai, app chỉ bày một

Đây là **lỗi đã cắn app một lần**, và mã nguồn còn giữ vết:

- `TONG_HOP.G12` = `Tổng đã làm ÷ Tổng cần` — **đếm theo MẢNH**. Ghi 150 cái chân
  là cột nhích lên ngay.
- `BC_CONG_DOAN.M8` = `Bộ tương đương ÷ SL bộ` — **đếm theo BỘ** (`MIN`). Ghi 150
  chân mà chưa ghi tựa thì vẫn 0%.

Cả hai đều đúng, và trả lời hai câu khác nhau: _"xưởng có làm việc không"_ vs
_"giao được bao nhiêu bộ"_. App chỉ có cái thứ hai, nên màn báo **"Chưa bắt đầu ·
0%" ngay sau khi thống kê vừa ghi 150** — đúng lỗi L3 trong
[`san-xuat-test-case-thong-ke.md`](san-xuat-test-case-thong-ke.md), đã vá tạm bằng
`parts_started`. Bản vá đó cứu được câu "đã có ai làm chưa", nhưng **vẫn chưa có
con số % theo mảnh**.

> **Đề xuất:** mọi chỗ bày % tiến độ đều bày **hai số cạnh nhau** —
> `98% mảnh · 62% bộ`. Một số một mình ở đây luôn nói dối một nửa.

### 3c. Kế hoạch — hai tầng, có đường lùi

- `THONG_TIN.J5:J11` — ngày KH xong **chung cả lệnh**, 7 công đoạn.
- `THONG_TIN.C38:I57` — ngày KH xong **riêng từng SP × từng công đoạn**; bỏ trống
  thì rơi về tầng chung.
- `TONG_HOP.J12` = `KH xong − Thực tế xong` → **Sớm(+)/Trễ(−) ngày**.
- `TONG_HOP` khối §KH THEO SẢN PHẨM: `✓ xong · ○ trong hạn · 🔴 quá hạn · – không áp dụng`.

App có `production_jobs.planned_end`, nhưng **cả DB chỉ có 4 dòng
`production_jobs`** và không có lưới nhập ngày KH theo SP × công đoạn. Tức tầng kế
hoạch trên thực tế chưa sống.

---

## 4. Vì sao file trực quan hơn — ba cơ chế, không phải "đẹp hơn"

Chẩn đoán phải cụ thể, nếu không thì bản vá sẽ chỉ là sơn lại màu.

### 4.1 Bảng chéo dày — một màn, hai chiều

`BC_CONG_DOAN` Phần 1: mỗi dòng 1 SP × 7 công đoạn, **mỗi công đoạn hai cột**
(Bộ tương đương · % đồng bộ), chốt bằng Bộ hoàn chỉnh + Trạng thái. 2 SP × 7 công
đoạn = **toàn bộ tình hình lệnh gói trong 2 dòng**.

Màn `/thongke/lsx/[id]` hôm nay bày danh sách **phẳng** `(SP × công đoạn)` — cùng
dữ liệu đó thành 14 dòng, và muốn so "Sơn của SP A với Sơn của SP B" thì phải lướt
mắt qua 7 dòng xen giữa. Mắt người so theo CỘT rất nhanh; so hai dòng cách nhau thì
không.

### 4.2 Trục thời gian nhìn thấy được

`CD_*` có **100 cột ngày**, cột hôm nay tô cam tự động. Nhìn ngang một dòng là thấy
nhịp: tổ làm liền 4 ngày rồi nghỉ 6 ngày. Nhìn dọc một cột là thấy cả xưởng hôm đó
làm gì.

Màn `/thongke/ghi` hôm nay ghi **một ngày một lần** và không bày lịch sử. Người ghi
không thấy mình đang ở đâu trong nhịp.

Thêm `TONG_HOP` §SẢN LƯỢNG 14 NGÀY: ma trận `7 công đoạn × 14 ngày` + cột tổng. App
**không có gì tương đương**.

### 4.3 Màu mã hoá vòng đời ở TỪNG Ô, không chỉ ở nhãn dòng

File phân biệt rành mạch bốn thứ mà app hay gộp:

| Ký hiệu               | Nghĩa                                             |
| --------------------- | ------------------------------------------------- |
| `–` (gạch dài)        | công đoạn **không nằm trong lộ trình** của cụm/SP |
| `-` (gạch ngắn, ô số) | có trong lộ trình, **chưa làm gì** (0)            |
| `(300)` ngoặc đỏ      | **thiếu** 300                                     |
| `100%` xanh           | đủ                                                |

App **đã làm đúng chỗ này** ở `StageStrip` của `/thongke/lenh` (ô sọc = ngoài lộ
trình, khác hẳn ô 0%). Giữ nguyên và nhân rộng ra các màn khác.

### 4.4 Và bốn biểu đồ

`% hoàn thành theo công đoạn` (cột) · `% tổng theo sản phẩm` (thanh ngang) ·
`Nội bộ vs GC ngoài` (cột chồng) · `Sản lượng 14 ngày` (đường, 7 chuỗi) ·
`Vật tư` (vành khuyên).

**Kit hiện có 0 thành phần biểu đồ** — `src/components/kit/` không có file nào vẽ
dữ liệu, và `package.json` không có thư viện biểu đồ nào.

---

## 5. Cái app có mà file KHÔNG có — đừng đánh đổi mất

Chép file cho giống là một cái bẫy. Bảy thứ app hơn hẳn, và tất cả đều mất nếu quay
về mô hình "một file một lệnh, ai cũng sửa được mọi ô":

1. **Xuyên lệnh.** 19 lệnh trong một màn, hộp thư "việc chờ tôi". File: mở 19 file.
2. **Vết.** `production_entry_docs` — phiếu có người ghi, giờ ghi, sửa lại phải có
   lý do. Excel gõ đè là **mất sạch**, không ai biết ai gõ.
3. **Chốt sổ ngày** (`production_day_locks`). File không khoá được theo ngày.
4. **Ai đang giữ lệnh, nằm im bao lâu** (`lib/lsx-holder`). File không có khái niệm này.
5. **Phân quyền theo vai.** File chỉ có "protect sheet, không mật khẩu".
6. **Định mức tự sinh từ hồ sơ SP.** File phải gõ tay `DM_CUM` + `DM_CHITIET` cho
   từng lệnh — tới 300 dòng mỗi lệnh.
7. **Kẹp trần + quy đổi kg** (backflush). File cho `%` vượt 100 một cách tự nhiên.

> **Luật rút ra cho bản thiết kế:** lấy **cách BÀY** của file, giữ **cách GHI** của
> app. Ma trận ngày là thứ để **ĐỌC**; viết thì vẫn đi qua phiếu có vết.

---

## 6. Độ phủ dữ liệu hôm nay (đo 22/09/2026, DB thật)

Đo trước khi thiết kế — nếu không thì nửa số màn dưới đây bật lên sẽ trống trơn.

| Bảng                           | Số dòng                                  | Ý nghĩa                                    |
| ------------------------------ | ---------------------------------------- | ------------------------------------------ |
| `production_orders`            | **19** (13 đã duyệt · 5 nháp · 1 đang SX) | 13 lệnh nằm ở "đã duyệt", không ai giữ    |
| `production_order_lines`       | 291                                      | dòng SP                                    |
| `production_components`        | **876**, nhưng chỉ 8/19 lệnh có          | **11 lệnh chưa định hình**                 |
| ↳ có `cluster`                 | **32**                                   | tầng cụm gần như trống (§2)                |
| ↳ thiếu `first_stage`          | **875**                                  | lộ trình đang suy từ `group_code`          |
| `production_jobs`              | **4**                                    | tầng kế hoạch chưa sống                    |
| `production_entries`           | **0**                                    | sổ sạch sau đợt test 22/09                 |
| `production_entry_docs`        | **0**                                    |                                            |
| `production_transfers`         | **0**                                    | giao tổ: Q3 đã chốt CÓ, chưa có màn        |
| `production_outsource_entries` | **0**                                    | gia công ngoài: chưa có màn                |
| `production_day_locks`         | **0**                                    |                                            |

**Danh mục công đoạn có 12 mã**: `phoi · han · nguoi · mai · son · moc · dan · may ·
lap_rap · bao_bi · dong_goi · hoan_thien`. File Excel chỉ dùng 7.

**Tổ ↔ công đoạn (`departments.stage_code`)** — 6/19 phòng có mã: `Tổ Phôi→phoi ·
Tổ Hàn→han · Tổ Nguội→nguoi · Tổ Sơn Sắt→son · Tổ Sơn Nhôm→son · Tổ May→may`.
**Không tổ nào mang `mai`, `moc`, `dan`, `lap_rap`, `bao_bi`, `dong_goi`,
`hoan_thien`**; `Cắt Vải` và `Tổ Cơ Điện` để trống. Tức **7/12 công đoạn chưa có tổ
nào nhận**.

> Đây là việc DỮ LIỆU, không phải tính năng — nhưng nó chặn mọi màn ở §7. Làm màn
> trước khi vá chỗ này thì màn nào cũng rỗng, và rồi không ai tin màn nữa.

---

## 7. Thiết kế đề xuất — bảy màn, theo khuôn

Khuôn tra ở [`/design-lab`](../src/app/design-lab/page.tsx). Cột "Có gì rồi" nói
thật, để không dựng lại cái đã có.

| #      | Màn                            | Khuôn        | Thay sheet nào       | Có gì rồi                       |
| ------ | ------------------------------ | ------------ | -------------------- | ------------------------------- |
| **T1** | Lệnh sản xuất (danh sách)      | **C**        | —                    | ✅ `/thongke/lenh`, kit, đủ     |
| **T2** | **Bảng đồng bộ của lệnh**      | **D** tab    | `BC_CONG_DOAN` P1    | ❌ dựng mới                     |
| **T3** | **Theo mảnh**                  | **D** tab    | `BC_CONG_DOAN` P2    | ❌ dựng mới                     |
| **T4** | Ghi sản lượng + **dải ngày**   | **F**        | `CD_*`               | ⚠️ có form, thiếu dải           |
| **T5** | **Gia công ngoài**             | **C + F**    | `GC_1..5`            | ❌ backend có, 0 màn            |
| **T6** | **Kế hoạch ngày xong**         | **F**        | `THONG_TIN` C38:I57  | ❌ dựng mới                     |
| **T7** | Tổng hợp lệnh                  | **D** đầu    | `TONG_HOP`           | ⚠️ có `MetricStrip`, thiếu bảng |

### T2 — Bảng đồng bộ (tab của `/thongke/lsx/[id]`)

**Câu hỏi:** _lệnh này giao được bao nhiêu bộ, và kẹt ở công đoạn nào?_

Bảng chéo. Ghim trái `Mã SP · Tên SP · SL bộ`, cuộn ngang qua **các công đoạn CÓ
TRONG LỘ TRÌNH của lệnh** (không bày đủ 12 — công đoạn không ai đi qua là cột rác).
Mỗi công đoạn **hai dòng chữ trong một ô**:

```
┌───────────┬──────────┬──────────┬──────────┬──────────┬──────────────┐
│ Mã SP     │   Phôi   │   Hàn    │  Nguội   │   Sơn    │ BỘ HOÀN CHỈNH│
│ (ghim)    │          │          │          │          │              │
├───────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ FDA50089N │   250    │   250    │    –     │    –     │      –       │
│ 400 bộ    │  62,5%   │  62,5%   │   0,0%   │   0,0%   │  Đang làm    │
└───────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
```

**Bốn luật bắt buộc:**

1. Ô trống ba kiểu phân biệt được: `–` ngoài lộ trình (nền sọc) · `0` chưa làm ·
   `(300)` thiếu. Gộp lại là nói dối bằng khoảng trắng (§4.3).
2. **Cột cuối là kết luận, không phải tổng:** `Bộ hoàn chỉnh = MIN` qua các công
   đoạn SP đi qua. Ghi rõ ở chân bảng — _"Bộ hoàn chỉnh = công đoạn chậm nhất,
   KHÔNG phải trung bình"_. Nguyên tắc 6 của sổ: số suy ra từ phép tính phải bày
   phép tính (`WhyBox`).
3. **Bấm vào một ô → mở T3 đã lọc sẵn** đúng (SP × công đoạn) đó. Không có đường
   này thì bảng chỉ báo tin xấu mà không chỉ chỗ.
4. Chân bảng nói tổng **KHÔNG gồm gì** — ví dụ _"không gồm 2 SP chưa định hình chi
   tiết"_.

### T3 — Theo mảnh

**Câu hỏi:** _trong công đoạn này, mảnh nào đang kéo cả bộ xuống?_

Dòng = chi tiết (hoặc cụm). Cột: `CT/cụm · Cụm/bộ · SL cần · SL đã làm · Thiếu/Dư ·
% mảnh · Đồng bộ (bộ)`.

**Mặc định sắp xếp theo "Đồng bộ (bộ)" tăng dần** — mảnh chậm nhất lên đầu. File
Excel giữ nguyên thứ tự khai báo nên người dùng phải tự dò; sắp xếp là chỗ app làm
hơn được ngay mà không tốn gì.

Cột `Thiếu/Dư` giữ đúng quy ước file: `(300)` trong ngoặc, tone `--stop`; dư thì
`+120`, tone `--warn` — **dư cũng là vấn đề**, phôi thừa là tiền chết.

### T4 — Ghi sản lượng, thêm dải 14 ngày (sửa màn đang có)

**Giữ nguyên cách ghi** (phiếu có vết, một ngày một lần — §5). **Thêm** vào mỗi dòng
việc một dải chỉ đọc:

```
Chân trước · Tổ Phôi     ▁▃▅█▂▁▁ ▁▁▂▅▃▍     800/800 · 100%
                         └ 14 ngày, cột hôm nay viền đậm
```

Rê chuột / chạm vào một cột → `18/09: 120 · phiếu PBS-0042`. Bấm → mở phiếu.

**Vì sao chỉ đọc:** ma trận sửa trực tiếp chính là thứ làm file Excel mất vết. Muốn
sửa số của ngày cũ thì đi qua đường "sửa lại, có lý do" đã dựng ở M4.

Thêm **cột hôm nay tô nổi** như file — người ghi biết mình đang gõ vào đúng ô.

### T5 — Gia công ngoài (màn mới, backend đã có)

Hôm nay `outsource.service.ts` + `production_outsource_entries` đã sống nhưng
**không có một màn nào**, nên sản lượng gia công ngoài **không vào được tiến độ**.
File Excel coi đây là công dân hạng nhất: 5 sheet riêng, và `CD_*.I` cộng thẳng vào
tổng đã làm.

Hai mặt:

- **Danh sách (khuôn C):** dòng = `(điểm gia công × công đoạn)`. Cột `Tổng giao ·
  Đã trả · Hỏng/Phế · Còn nợ · % trả · Hạn trả · Trạng thái`. Chip lọc: `Quá hạn
  trả · Còn nợ · Đã trả đủ · Chưa giao` — mỗi chip **đếm bằng đúng hàm nó lọc**.
- **Ghi giao/trả (khuôn F):** lưới chi tiết × đợt giao, và ô trả về theo ngày. File
  cố định **4 đợt** vì đó là giới hạn của Excel, không phải của nghiệp vụ — app nên
  cho **n đợt**, mỗi đợt một dòng có ngày.

**Và sửa phép tính tiến độ:** mọi chỗ đang lấy `done` phải tách làm hai nguồn —
`nội bộ` + `gia công ngoài trả về` — rồi cộng, đúng như `CD_*.H + I = J`. Không
tách thì không ai biết xưởng tự làm được bao nhiêu và thuê ngoài bao nhiêu.

### T6 — Kế hoạch ngày xong từng công đoạn

Lưới `SP × công đoạn`, mỗi ô một ngày (`DateInput`). Bỏ trống → rơi về ngày KH chung
của lệnh, và **ô phải hiện ngày kế thừa dưới dạng chữ mờ**, không để trống trơn —
trống mà không thấy gì thì người dùng tưởng chưa có kế hoạch.

Từ đó mới sinh được cột `Sớm(+)/Trễ(−)` và dấu `✓ ○ 🔴 –` ở T2/T7 — thứ file làm
được mà app chưa.

### T7 — Đầu trang lệnh: bảng tiến độ theo công đoạn

Thêm vào `/thongke/lsx/[id]` (dưới `StatusTrack`, trên các tab) đúng bảng `TONG_HOP`
§TIẾN ĐỘ THEO CÔNG ĐOẠN:

| Công đoạn | Tổng cần | Nội bộ | GC ngoài | Tổng | Còn lại | % mảnh | % bộ | KH xong | Thực tế | Sớm/Trễ | Trạng thái | Tổ  |
| --------- | -------- | ------ | -------- | ---- | ------- | ------ | ---- | ------- | ------- | ------- | ---------- | --- |

7–12 dòng, đọc hết trong một nhịp mắt. Trạng thái theo file: `Xong · Quá KH · Sắp
xong · Đang làm · Chưa làm · – không áp dụng` — nhưng **thay emoji bằng `Tag` của
kit**; emoji trong ô bảng là lỗi đã ghi ở `ui-v3-loi-hay-vi-pham`.

### T7b — Khối "Cảnh báo & điểm nghẹn"

File gói gọn 5 dòng ở `TONG_HOP` J58:L62, và đó là khối đáng chép nhất:

```
Sản lượng hôm nay             0
Sản lượng 7 ngày gần nhất     2.140
Công đoạn chậm nhất           Đóng gói (26%)
Số công đoạn quá kế hoạch     2
GC ngoài còn nợ               97
```

Mỗi dòng **bấm được**, nhảy thẳng tới chỗ xử lý. Đây là khác biệt lớn nhất giữa
"bảng số" và "màn việc".

---

## 8. Năm thành phần kit phải bổ sung

Kit hôm nay (`src/components/kit/`) **không có thành phần nào vẽ dữ liệu**. Dựng
T2–T7 bằng kit hiện tại là phải chế CSS tại chỗ — đúng dấu hiệu "kit còn thiếu" mà
sổ `/design-lab` nói.

| Thành phần    | Dùng ở      | Mô tả                                                                                                                                                             |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MatrixTable` | T2, T3, T7  | Bảng chéo: ghim N cột trái, cuộn ngang, **tiêu đề hai tầng** (nhóm công đoạn → cột con), chân tổng dính. `Table` hiện tại không có tiêu đề hai tầng.                |
| `DayStrip`    | T4, T7b     | Dải n ngày, mỗi ngày một cột cao theo số, cột hôm nay viền đậm, hover ra số + mã phiếu. SVG nội tuyến, **không thêm thư viện biểu đồ**.                             |
| `DualPct`     | khắp nơi    | Ô hai mẫu số: `98% mảnh · 62% bộ` (§3b). Một thành phần dùng chung để không mỗi màn viết một kiểu.                                                                  |
| `DeltaNum`    | T2, T3, T7  | Số lệch theo quy ước file: `(300)` trong ngoặc + `--stop` khi thiếu, `+120` + `--warn` khi dư, `—` khi bằng.                                                        |
| `MiniBars`    | T7          | Thanh ngang so sánh (% theo công đoạn / theo SP), chồng được hai chuỗi nội bộ vs GC ngoài.                                                                          |

**Quy ước màu:** bốn thành phần trên **chỉ dùng `--stop · --warn · --done` cho vòng
đời và `--act` cho thứ bấm được** — không tự đặt bảng màu riêng. Khi làm phần vẽ
thật (`MiniBars`, `DayStrip`) thì **nạp skill `dataviz` trước khi viết dòng mã vẽ
đầu tiên**; đừng tự chọn palette.

---

## 9. Lộ trình — sáu bước, mỗi bước nghiệm thu được

Theo luật "làm từng bước một": mỗi bước dừng lại báo cáo, không đi hàng loạt.

| Bước   | Việc                                                                                       | Nghiệm thu bằng                                                           |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **B0** | **Vá dữ liệu (§6)** — gán `stage_code` cho 7 công đoạn chưa có tổ; định hình 11 lệnh thiếu | `departments` đủ mã; `production_components` phủ ≥ 15/19 lệnh            |
| **B1** | `DualPct` + hai mẫu số ở T1/T4                                                              | Ghi 150 chân → màn báo `19% mảnh · 0% bộ`, không còn "Chưa bắt đầu"       |
| **B2** | `MatrixTable` + **T2 Bảng đồng bộ**                                                         | Mở 1 lệnh thật, đọc được "giao được bao nhiêu bộ" trong một nhịp mắt      |
| **B3** | **T3 Theo mảnh** + bấm ô T2 nhảy sang, lọc sẵn                                               | Từ ô `62,5%` bấm ra đúng mảnh đang kéo xuống                             |
| **B4** | **T5 Gia công ngoài** (2 màn) + cộng GC vào tiến độ                                          | Ghi 1 phiếu giao + 1 phiếu trả → `%` ở T2/T7 nhích lên                    |
| **B5** | `DayStrip` ở T4 + **T7b Cảnh báo**                                                          | Nhìn dải thấy nhịp 14 ngày; 5 dòng cảnh báo bấm được                     |
| **B6** | **T6 Kế hoạch ngày xong** → cột Sớm/Trễ ở T7                                                | Nhập KH cho 1 SP → T7 hiện `Trễ 3 ngày`                                  |

B0 đứng trước tất cả và **không thương lượng được**: B2–B6 đều đọc `cluster`,
`stage_code`, `production_components`. Dựng màn trước khi vá dữ liệu là dựng màn
rỗng.

---

## 10. Bảy câu phải chốt trước khi viết dòng mã đầu tiên

Không có câu trả lời thì thiết kế nào cũng là đoán.

- ~~**C1 — Có khai tầng CỤM không?**~~ **CHỐT 23/09/2026: CÓ KHAI.** Lý do chủ dự
  án nêu: _"tuỳ sản phẩm sẽ có các công đoạn khác nhau"_ — tức lộ trình phải khai
  được ở cấp cụm, không suy chung cho cả sản phẩm. Xem §11: hoá ra rẻ hơn nhiều so
  với ước tính ban đầu trong tài liệu này.
- **C2 — Lộ trình khai theo cụm (cờ `x`) hay tiếp tục suy theo `group_code`?**
- **C3 — Bảy công đoạn hay mười hai?** File dùng 7; danh mục app có 12, trong đó 7
  chưa có tổ nào nhận. Bảng chéo 12 cột rộng gấp đôi.
- **C4 — Gia công ngoài có đếm vào tiến độ không?** File: có, cộng thẳng. Trả lời
  "không" thì T5 chỉ còn là sổ theo dõi nợ, không phải nguồn tiến độ.
- **C5 — Số đợt giao gia công: cố định 4 (như file) hay n đợt?**
- **C6 — Khối "Xuất hàng & đồng bộ theo thùng"** (`TONG_HOP` §92) làm ở Sản xuất hay
  ở Bán hàng? Bán hàng đã có `sales_order_shipments` — làm hai chỗ là hai con số.
- **C7 — Phế (`CD_*.K`) ghi ở đâu?** File cho gõ tay thẳng vào dòng; app có bảng mã
  lỗi (`defect_codes`). Gõ tay nhanh hơn, mã lỗi thống kê được.

---

## 11. C1 đã chốt — và nó rẻ hơn tài liệu này ước tính

Viết 23/09/2026, sau khi chủ dự án chốt **CÓ khai tầng cụm**. Đo lại thì §2 và §10
của tài liệu này **ước tính quá tay**: chỗ này không cần migration nào, và cũng
không phải "Kỹ thuật nhập lại 876 dòng".

### 11.1 Lược đồ ĐÃ CÓ TỪ 07/2026

Migration **0097** (`0097_bom_cluster_and_form_fields.sql`) đã dựng bảng
`technical_product_clusters` với đúng ba thứ file Excel cần:

| Cột file Excel        | Cột đã có trong DB                 |
| --------------------- | ---------------------------------- |
| `DM_CUM.D` Tên cụm    | `name`                             |
| `DM_CUM.E` **Cụm/SP** | `qty_per_product`                  |
| `DM_CUM.G..L` cờ `x`  | `first_stage` / `final_stage`      |

Header của 0097 còn giải thích vì sao cụm là **bảng riêng** chứ không phải cột
text: _"cột text → gõ lệch 1 ký tự là tách thành 2 cụm (đúng chỗ vỡ của Excel)"_.

Và `components.service.suggest` (định hình LSX) **đã đọc đủ cả ba**: sinh dòng
`kind='assembly'` với `qty_per_unit = qty_per_product`, đặt `first_stage`/
`final_stage` của cụm, rồi **kẹp `final_stage` của chi tiết thành viên về ngay
trước công đoạn ghép** và tính `qty_per_assembly = part.qty / qtyPer`. API
`PATCH /api/dept/technical/products/[id]/clusters/[clusterId]` cũng đã nhận cả ba
(`productClusterUpdateSchema`).

### 11.2 Nút thắt thật: **không màn nào cho GÕ hai trường đó vào**

`ProductPartsCard.tsx` **bày** `qty_per_product` và lộ trình trên dải cụm, nhưng
nút chỉ có "Đổi tên" và "Bỏ cụm". Cả đường ghi bỏ trống. Hậu quả đo được
22/09/2026:

| Số đo                               | Giá trị     |
| ----------------------------------- | ----------- |
| `technical_product_clusters`        | 136 dòng / 54 SP |
| ↳ có `qty_per_product`              | **0 / 136** |
| ↳ có `first_stage` / `final_stage`  | **2 / 136** |
| Dòng định mức có `cluster_id`       | 794 / 4.203 |
| `production_components` là assembly | **1 / 876** |

`suggest` có nhánh `if (!first) continue` — cụm không định vị được công đoạn ghép
thì bỏ qua, để phẳng. Đó chính là lý do cả DB nổi đúng **một** dòng cụm.

### 11.3 Đã làm 23/09 — ô khai cụm

`ProductPartsCard` thêm nút **"Khai cụm"** mở hộp tại chỗ dưới dải cụm (không phải
hộp thoại — người khai đang nhìn danh sách chi tiết, và chính nó là căn cứ để biết
cụm ghép ở công đoạn nào):

- **SL cụm / 1 SP** — số, bỏ trống thì lúc định hình hiểu là 1.
- **Công đoạn ĐẦU của cụm** — chọn từ danh mục 12 mã (`catalog_items`, không hằng
  số hoá ở client). Bỏ trống = suy theo nhóm vật tư như cũ.
- **Công đoạn CUỐI** — bỏ trống = tới hết lộ trình.

Dải cụm nay nói thẳng **"chưa khai SL cụm/SP" / "chưa khai lộ trình"** bằng tone
`--warn` thay vì im lặng — 134 cụm đang thiếu mà không màn nào từng nói ra.

Nút Lưu **khoá kèm lý do tại chỗ** (không cho bấm rồi mới báo lỗi): SL ≤ 0 · công
đoạn cuối đứng trước công đoạn đầu · khai cuối mà không khai đầu. Chân hộp nói
trước hệ quả: _"N chi tiết của cụm sẽ DỪNG ở công đoạn ngay trước «Hàn»; từ đó trở
đi xưởng đếm theo CỤM."_

### 11.4 B0 viết lại

Bỏ dòng "Kỹ thuật nhập lại 876 dòng" ở §9. B0 thật là **dữ liệu**, không phải mã:

| B0.x | Việc                                                                     | Đo được bằng                         |
| ---- | ------------------------------------------------------------------------ | ------------------------------------ |
| a    | ~~Ô khai cụm~~ **XONG 23/09**                                            | `npm run check` sạch                 |
| b    | Kỹ thuật khai `qty_per_product` + lộ trình cho 136 cụm                    | `0 → 136` có SL; `2 → 136` có lộ trình |
| c    | Dọn tên cụm — hiện có rác: `C · D · E … O` (13 cụm một SP), `cụm · tấm · chắn · trên · dưới`, và `Cụm mê` vs `cụm mê` lệch hoa thường | 136 tên, không cặp nào trùng sau khi gọn hoa thường |
| d    | Gắn `cluster_id` cho 3.409 dòng định mức còn rời                          | 794 → ≥ 3.000                        |
| e    | Gán `stage_code` cho 7 công đoạn chưa tổ nào nhận (§6)                    | `departments` đủ mã                  |
| f    | Chạy lại "định hình" các lệnh → dòng cụm nổi lên                          | `kind='assembly'` từ 1 → hàng trăm   |

**b và c là việc của người, không phải của máy** — máy không biết "Cụm chân trước"
gồm những chi tiết nào. Đây là chỗ tốn thời gian thật của C1, và nó nằm ở Kỹ thuật.

---

## 12. Màn NHẬP LIỆU của Thống kê — chẩn đoán và thiết kế

Viết 23/09/2026, trả lời câu "còn vấn đề giao diện nhập liệu thì sao". Mục này
thay phần T4 ngắn ở §7 — đây là màn thống kê mở nhiều lần nhất trong ngày.

### 12.1 Kết luận trước: cái FORM không phải vấn đề

Đo `EntrySheetForm.tsx` (1.186 dòng) — nó đã theo đủ năm luật khuôn F, và đã có
những thứ file Excel **không** có:

| Đã có                                                    | Excel có không?        |
| -------------------------------------------------------- | ---------------------- |
| Đầu phiếu co thành `HeadChips` một hàng                  | —                      |
| Cột "Còn" **bấm được** để điền đủ phần thiếu             | ❌                     |
| Dán vùng từ Excel (`parsePasteGrid`), phím ← → ↑ ↓        | (là Excel)             |
| `today_qty` — "hôm nay đã ghi 120" chống gõ đúp           | ❌ gõ đè là mất sạch   |
| `pending` — "chờ duyệt +80" tách khỏi đã đạt              | ❌                     |
| Cảnh báo MỀM khi vượt phần còn thiếu, nhuộm ngay lúc rời ô | ❌                     |
| `CommitBar.blocked` + nhảy tới đúng ô hỏng                | ❌                     |
| Chấm ● tổ hệ đề xuất (đang cầm hàng / ghi 7 ngày qua)     | ❌                     |
| Khoá sổ ngày, báo TRƯỚC trong cửa sổ 30 ngày              | ❌                     |
| `NumInput` nhả focus khi lăn chuột                        | (Excel cũng dính bẫy)  |

**Đừng viết lại màn này.** Việc phải làm là THÊM CỘT NGỮ CẢNH, không phải đổi
cách gõ.

### 12.2 Bốn khoảng trống thật

Cột hiện có: `Dòng ghi · Cần · Đã đạt · Còn · SL đạt · Phế · Sửa lại · Lý do`
(+ `kg · Người làm · Ghi chú` khi bật "Cột chi tiết").

Cột của `CD_*`: `Tổng cần · Tổ nội bộ · **Nội bộ đã làm** · **GC ngoài đã trả** ·
TỔNG · Phế · Còn lại · **%** · **Bộ tương đương** · Ghi chú · **100 cột ngày**.

| # | Thiếu gì                    | Cột Excel    | Vì sao người ghi cần                                                                     |
| - | --------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| 1 | **Trục thời gian của DÒNG** | `P..DK`      | Không thấy nhịp. "Chi tiết này lần cuối có người làm là bao giờ?" — không màn nào trả lời |
| 2 | **Bộ tương đương**          | `CD_*.N`     | Gõ 150 chân xong không biết mình vừa đẩy được **bao nhiêu bộ**                            |
| 3 | **Tách nội bộ / GC ngoài**  | `H` vs `I`   | "Đã đạt 300" gộp cả hàng thuê ngoài — không biết tổ mình làm được bao nhiêu                |
| 4 | **Trần của công đoạn trước** | `CD_PHOI.N` | Đứng ở Hàn không biết phôi mới đủ cho 250 cụm — gõ 400 là ghi một con số không có thật    |

### 12.3 Trục thời gian — app đã có MỘT nửa, và là nửa khác

Phải nói rõ chỗ này vì dễ tưởng đã xong:

- `/thongke/ngay` **đã có ma trận 7 ngày** (`entriesService.dayMatrix`) — nhưng
  trục là **TỔ × NGÀY**. Nó trả lời _"hôm đó tổ nào làm, tổ nào chưa chốt sổ"_.
- Excel `CD_*` có trục **DÒNG × NGÀY**. Nó trả lời _"chi tiết này được làm vào
  những ngày nào"_.

Hai câu khác nhau, không thay nhau được. Cái thứ hai **chưa tồn tại**.

### 12.4 Thiết kế — dòng ghi mới

Ngân sách chiều ngang đã chật (11 cột). **Không thêm 14 cột ngày** — thêm MỘT cột
`DayStrip` rộng ~110px:

```
┌────────────────────────────┬──────┬────────────────┬─────┬──────┬──────┬─────┐
│ Dòng ghi                   │  Cần │ Đã đạt         │ Còn │ 14 ngày      │ SL đạt│
├────────────────────────────┼──────┼────────────────┼─────┼──────────────┼───────┤
│ ● Cụm chân trước · Chân    │  800 │ 500            │ 300 │ ▁▃▅█▂▁▁▁▁▂▅▃▁▍│ [   ] │
│   trước                    │      │ nội bộ 500     │     │  ↑ hôm nay   │       │
│   hôm nay đã ghi 120       │      │ +GC 0 · 250 bộ │     │              │       │
└────────────────────────────┴──────┴────────────────┴─────┴──────────────┴───────┘
```

**Bốn thay đổi, không cái nào đụng vào cách gõ:**

1. **Cột "Đã đạt" tách ba dòng chữ**: tổng · `nội bộ N` + `GC M` · `K bộ`. Ba số
   này đã tính được ở server (`worklist.service` có `setsDone`; `outsource` có
   nguồn GC) — chỉ chưa ai bày ra.
2. **Cột `14 ngày`** — `DayStrip` chỉ đọc, cột hôm nay viền đậm, hover ra
   `18/09: 120 · PBS-0042`, bấm mở phiếu. **Chỉ ĐỌC** (§5): ma trận sửa trực tiếp
   chính là thứ làm Excel mất vết.
3. **Hàng nhóm SP hiện BỘ ĐỒNG BỘ = MIN** của các dòng con, kèm tên dòng đang
   kéo xuống: `FDA50089N · 400 cái — đồng bộ 250 bộ (kẹt ở "Hộp trượt")`.
   Đây là chỗ đắt nhất mà rẻ nhất: `GroupRow` đã có, phép `MIN` đã có.
4. **Trần của công đoạn trước** hiện ở ô "Cần" khi trần < cần:
   `800 · phôi mới đủ 250`. Cảnh báo MỀM như `over` hiện nay — sổ vẫn cho ghi dư
   (làm bù, gộp đợt), chỉ nhuộm để người gõ nhìn lại.

### 12.5 Bốn việc, xếp theo giá trị ÷ công

| Việc                                    | Công  | Giá trị                                                            |
| --------------------------------------- | ----- | ------------------------------------------------------------------ |
| **N1** Hàng nhóm SP hiện đồng bộ + kẹt ở đâu | nhỏ   | **cao nhất** — trả lời thẳng "giao được bao nhiêu bộ", 0 dữ liệu mới |
| **N2** Cột "Đã đạt" tách nội bộ / GC / bộ | nhỏ   | cao — hết gộp hàng thuê ngoài vào công của tổ                       |
| **N3** `DayStrip` 14 ngày               | vừa   | cao — cần thành phần kit mới + một truy vấn range                   |
| **N4** Trần công đoạn trước             | vừa   | vừa — chặn con số không có thật ngay lúc gõ                         |

N1 + N2 **không cần dữ liệu mới, không cần thành phần kit mới** — làm được ngay.
N3 cần `DayStrip` (§8). N4 phải chờ tầng cụm có số (§11.4 B0.b).

### 12.6 Cái KHÔNG chép từ Excel

- **Không** cho sửa ô ngày cũ ngay trên ma trận. Sửa hồi tố đi qua đường "sửa
  lại, có lý do" đã dựng — đó là thứ Excel không có và là lý do app hơn nó.
- **Không** gộp nhiều lệnh vào một lưới. Đã thử, bị chê rối (208 dòng / 8 lệnh ở
  Phôi, 22/09); Excel cũng một file một lệnh nên vốn không có tình huống này.
- **Không** thêm cột `%` trên dòng nhập. `Cần · Đã đạt · Còn` đã đủ ở tầm dòng;
  `%` thuộc về màn báo cáo (T2/T7), nơi so sánh giữa các dòng mới có nghĩa.

---

## 13. Ma trận kiểu Excel — nên hay không? Và ERP lớn làm thế nào

Viết 23/09/2026. Câu hỏi đáng trả lời bằng bằng chứng chứ không bằng khẩu vị.

### 13.1 Khuyến nghị — tách làm ba, không trả lời chung một tiếng

| Dùng ma trận để…                          | Nên?      | Vì sao                                                       |
| ----------------------------------------- | --------- | ------------------------------------------------------------ |
| **ĐỌC** sản lượng (dòng × ngày)           | **CÓ**    | Đây chính là thứ file Excel hơn app, và app đang thiếu hẳn   |
| **GHI** sản lượng (gõ thẳng vào ô ngày)   | **KHÔNG** | Phá đúng những thứ app hơn Excel — xem 13.3                  |
| **GHI** kế hoạch / chỉ tiêu (SP × công đoạn, tổ × ngày) | **CÓ** | Đây là _planning by bucket_, và ERP lớn làm đúng kiểu đó (13.4) |

Nói gọn: **ma trận là một LĂNG KÍNH, không phải một CÁI PHỄU.**

### 13.2 Bốn ERP lớn ghi sản lượng thế nào — không hệ nào dùng ma trận ngày

| Hệ                   | Màn ghi sản lượng                                     | Hình dạng                                            |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **SAP S/4HANA PP**   | `CO11N` xác nhận một công đoạn                        | **Form** — một công đoạn một lần                     |
| **SAP S/4HANA PP**   | `CO12` xác nhận hàng loạt                             | **Bảng, MỖI DÒNG LÀ MỘT XÁC NHẬN** — không phải ngày |
| **Dynamics 365 SCM** | Report as finished / Job card journal                 | **Sổ: header (ngày) + lines (SL, SL lỗi, lý do lỗi)** |
| **Dynamics 365 SCM** | Production floor execution                            | Màn cảm ứng, một việc mỗi lần, nút to                |
| **Odoo MRP**         | Produce wizard / Shop Floor                           | Form một lần một, kanban theo tổ                     |
| **NetSuite**         | Work Order Completion                                 | Giao dịch: header + lines                            |

Hình dạng chung ở **cả bốn hệ**: **NGÀY nằm trên HEADER, SỐ LƯỢNG nằm trên
LINES.** Không hệ nào bắt người dùng điền một lưới `mặt hàng × ngày` để xác nhận
sản lượng. Đó chính xác là mô hình phiếu **PBS** app đang có — app đang đứng đúng
chỗ ERP lớn đứng, không phải đang đi sau.

### 13.3 Vì sao ma trận GHI sẽ làm app tệ đi — đo được, không phải cảm tính

**Một ô ma trận chứa ĐƯỢC MỘT SỐ.** Một dòng phiếu hiện tại mang **bảy** trường
(`LineDraft`): `qty · defect · rework · reason · kg · worker · note` — cộng thêm ô
riêng của từng công đoạn (`production_stage_fields`, 0207).

Chuyển sang ma trận thì chỉ còn hai đường, cả hai đều tệ hơn:

1. **Vứt sáu trường kia** → mất mã lý do phế, mất người làm, mất kg backflush.
   Tức là lùi về đúng chỗ file Excel đang đứng.
2. **Mỗi ô mở một popup bảy ô** → chậm hơn hẳn form hiện tại, vì form hiện tại
   gõ được cả cột bằng bàn phím và dán được cả vùng từ Excel.

Và ba thứ nữa mất theo, đều là thứ §5 đã liệt kê: **vết** (ô gõ đè không có người
ghi/giờ ghi), **chốt sổ ngày** (ô ngày không có trạng thái khoá), **duyệt**
(`pending` là thuộc tính của PHIẾU, không của ô).

> Ma trận ghi được là vì Excel **không có** ba thứ đó. Chép hình dạng mà không
> chép được cái giá của nó thì là chép nhầm.

### 13.4 Nhưng ERP lớn CÓ dùng ma trận — ở hai chỗ, và cả hai đều không phải xác nhận

Đây là chỗ câu trả lời không được cực đoan:

- **Bảng chấm công.** SAP **CATS** (`CAT2`) "Time Sheet: Data Entry View" là lưới
  **công việc × ngày**, sửa trực tiếp. Dynamics/Project Operations timesheet cũng
  vậy. **Và nó dừng ở 7 CỘT — đúng một tuần**; muốn nhập kỳ hai tuần thì phải mở
  màn thứ hai.
- **Kế hoạch theo kỳ.** SAP IBP / APO planning book, Dynamics master planning
  forecast: lưới `chỉ tiêu × kỳ`, sửa trực tiếp.

Điểm chung của hai chỗ này: **không có chứng từ cho từng ô**. Một ô chấm công
không cần số hiệu, không ai duyệt riêng nó, không đảo riêng nó. Ô sản lượng thì
có — nó là một phiếu PBS.

**Suy ra cho HG-ERP:** ma trận GHI hợp lệ ở **T6 (ngày KH xong theo SP × công
đoạn)** và **Chỉ tiêu ngày** (`/kehoach-sx/chi-tieu`) — đó là planning by bucket.
Không hợp lệ ở ghi sản lượng.

Và nếu có làm ma trận ghi ở hai chỗ đó: **giữ 7 cột, đừng 100**. Chính `HDSD` của
file Excel cũng thú nhận trần 100 ngày là cái bẫy — _"Hết 100 ngày: đổi Ngày bắt
đầu là KHÔNG được (sẽ lệch số đã nhập) — hãy copy file"_.

### 13.5 Vậy cái gì làm file Excel "trực quan hơn"?

Không phải ma trận **ghi được**. Là ma trận **nhìn thấy được**.

Trong file, một ma trận gánh cả hai vai cùng lúc: vừa là chỗ gõ, vừa là bức tranh
100 ngày. Người dùng cảm thấy mất mát khi sang app là mất **vai thứ hai** — chứ
không ai nhớ thao tác gõ vào ô ngày (thao tác đó còn tệ hơn: dễ gõ lệch cột, và
`HDSD` phải viết hẳn một dòng "CỘT NGÀY HÔM NAY" tô cam để người ta khỏi gõ nhầm).

**Tách hai vai ra là xong**, và đó đúng là §12.4:

- **Vai GHI** giữ nguyên phiếu PBS (đúng chuẩn cả bốn ERP lớn).
- **Vai ĐỌC** trả lại bằng ma trận **chỉ đọc**: `DayStrip` 14 ngày trên mỗi dòng
  ghi, cộng một màn "Sổ công đoạn" đầy đủ `dòng × ngày` để xem lại cả đợt.

Ma trận chỉ-đọc còn làm được thứ Excel không làm nổi: **mỗi ô dẫn tới phiếu gốc**
(`18/09: 120 · PBS-0042` → bấm ra phiếu, thấy ai ghi, lý do phế, sửa lại lần nào).
Ô Excel bấm vào chỉ ra một con số trần trụi.

---

## Nguồn

- `QUAN_LY_TIEN_DO_SX_v2 (Repaired).xlsx` — 19 sheet, bóc toàn bộ công thức 22/09/2026.
- DB thật, đo 22/09/2026: `production_*`, `departments`, `catalog_items`.
- Mã nguồn: `src/modules/dept/production/{worklist,jobs,entries,so-tong,outsource}.service.ts`,
  `src/app/(san-xuat)/thongke/*`,
  `src/lib/{stage-route,default-assembly,finish-stages,production-summary}.ts`.
