# Ghi nhận sản lượng — thiết kế lại theo chuẩn ERP

Viết 19/09/2026. Phạm vi: **cách xưởng báo số mỗi ngày** — đạt bao nhiêu, hỏng
bao nhiêu, vì sao hỏng, và sửa lại được bao nhiêu.

**Đọc trước:** [`san-xuat-quy-trinh-vai-tro.md`](san-xuat-quy-trinh-vai-tro.md)
(quy trình, vai trò) · [`san-xuat-thiet-ke-giao-dien.md`](san-xuat-thiet-ke-giao-dien.md)
(bản đồ màn) · [`/design-lab`](../src/app/design-lab/page.tsx) khuôn F.

Tài liệu này KHÔNG mở lại các câu đã chốt. Nó chỉ trả lời một câu: **sổ sản
lượng cần ghi thêm gì, và màn nhập phải đổi ra sao.**

---

## 1. Vì sao phải sửa bây giờ

Hai lý do, cả hai đều là cửa sổ đang mở và sẽ đóng:

**Sổ đang có 0 dòng.** Đổi cấu trúc sổ lúc này là sửa vài file. Đổi sau khi
xưởng đã ghi vài trăm dòng thật là phải chuyển đổi dữ liệu, và mọi con số lịch
sử đều phải giải thích "trước ngày X thì cột này nghĩa khác".

**Đợt nạp 74 mã BOM sắp chạy.** Sau đợt đó là chạy thử thật. Thói quen ghi sổ
hình thành trong hai tuần đầu; sửa màn nhập sau khi thống kê đã quen tay là lấy
đi thứ họ vừa học được.

---

## 2. Đối chiếu bốn hệ — chỉ phần ghi nhận

Tra 19/09/2026. Chi tiết và nguồn: xem mục 7.

| | Ô khi báo sản lượng | Lý do lỗi | Sửa lại |
| --- | --- | --- | --- |
| **SAP S/4HANA PP** | Đạt · Phế · **Sửa lại** | Danh mục, không bắt buộc | Có (nhiều đường, rất nặng) |
| **Dynamics 365 SCM** | Đạt · Lỗi | **4 lý do cứng** không sửa được | Không |
| **NetSuite** | Đạt · Phế *(chỉ công đoạn cuối)* | **Lọc theo tổ** — mạnh nhất | Không |
| **Odoo MRP** | *(không có ô nào)* | Tag, chỉ từ bản 18 | Không |

**Ba điều rút ra:**

1. **Chỉ SAP tách đủ ba loại số, và chỉ số ĐẠT mới chạy tiếp sang công đoạn
   sau.** Đây là quyết định kiến trúc, không phải tính năng thêm — ba hệ kia
   thiếu nó nên đều phải chắp vá bằng chứng từ ngoài.
2. **Lý do lỗi lọc theo tổ** (NetSuite) là thứ quyết định danh mục có được dùng
   hay không. Tổ hàn phải chỉ thấy lỗi hàn; bày cả 17 mã ra là không ai chọn.
3. **Không hệ nào bắt buộc khai lý do ngay từ đầu.** Cho ghi nhanh trước, siết
   sau — trừ khi đã có sẵn danh sách ngắn để chọn một chạm.

**Đừng lấy Odoo làm mẫu ở phần này.** Đọc mã nguồn `mrp_workorder.py` (18.0):
`qty_producing` ghi thẳng ngược lại lệnh, nên mọi công đoạn dùng chung một con
số. Không chặn vượt số, không chặn sai thứ tự, không có rework.

---

## 3. HG đang ở đâu — đo 19/09/2026

**Ba thứ đã đúng hơn phần lớn hệ lớn:**

- Ghi **theo từng công đoạn thật** (Odoo không làm được).
- Ghi **theo TỔ**, tên người tuỳ chọn — mô hình NetSuite, đúng cho lương sản
  phẩm về sau.
- Đã có **danh mục 17 mã lỗi, có cột `stage_code`** để lọc theo công đoạn
  (`production_defect_codes`, migration 0067) — đúng mô hình NetSuite.

**Hai lỗ hổng:**

| Lỗ hổng | Đo được | Hệ quả |
| --- | --- | --- |
| **Lý do lỗi là chữ tự do** | Bảng danh mục `production_defect_codes` đã bị 0084 **cố ý drop** (xem dưới). Màn ghi dùng ô chữ + gợi ý lý do vừa gõ | "trầy xước" / "bị xước" / "xước sơn" là ba lý do khác nhau trong mắt máy → không Pareto, không so được giữa tổ |
| **Không có ô "sửa lại"** | Sổ chỉ có `qty` và `defect_qty` | Hàng mài lại/sơn lại được phải khai là phế (thổi phồng tỷ lệ phế, mất số) hoặc lờ đi rồi ghi lại (không ai biết đã tốn thêm một lượt công) |

> **Đính chính 19/09 — chữ tự do là QUYẾT ĐỊNH, không phải lỗi.** Bản đầu của
> tài liệu này viết "danh mục 17 mã nằm chết" và đoán rằng migration 0067 hỏng.
> Sai. 0067 đã apply 20/07/2026; **0084 `production_v2` drop bảng đó bốn ngày
> sau, có chủ đích** — nguyên văn header: *"Phế = số + lý do text tự do (bỏ
> danh mục mã lỗi — user chốt đơn giản hoá)"*.
>
> Nên dựng lại danh mục là **đảo một quyết định của chủ dự án**, phải hỏi.
> Lập luận để hỏi: mối lo cũ là danh sách dài và rườm; nay ô chọn lọc theo công
> đoạn (tổ sơn ~7 mục thay vì 17) và danh mục là **tuỳ chọn** — gõ tự do vẫn
> ghi được như hiện nay.
>
> Cách tra đúng loại câu hỏi này: `list_migrations` xem đã apply chưa →
> `grep "drop table"` các migration **sau** nó → rồi mới kết luận. Đừng suy từ
> việc bảng vắng trong `database.types.ts`.

Với nội thất kim loại, sửa lại là số lớn: mối hàn lệch mài lại, sơn lỗi chà
lại là việc hằng ngày.

---

## 4. Quyết định thiết kế

### 4.1 Ba ô, và chỉ ĐẠT mới chạy tiếp

Chép mô hình SAP. Một dòng sổ có ba số:

| Ô | Nghĩa | Chạy tiếp công đoạn sau? | Vào tổng cần? |
| --- | --- | --- | --- |
| **SL đạt** | Làm xong, đạt chất lượng | ✅ có | ✅ trừ vào "còn" |
| **Phế** | Bỏ hẳn, không cứu được | ❌ không | ✅ ăn mất đầu vào |
| **Sửa lại** | Hỏng nhưng cứu được, đang chờ sửa | ❌ không | ❌ **chưa** trừ gì cả |

**Sửa xong thì ghi lần thứ hai vào ô ĐẠT.** Không đẻ lệnh sản xuất phụ như SAP
— quá nặng cho một xưởng. Đếm đúng là đủ.

**Vì sao "sửa lại" không trừ vào tổng cần:** vì món đó vẫn còn, chưa mất. Trừ
nó đi là làm "còn phải làm" nhỏ hơn thực tế, rồi khi sửa xong ghi lại vào đạt
thì tổng vượt số lệnh.

### 4.2 Lý do: chọn từ danh mục, không gõ tay

Đổi ô chữ tự do thành **ô chọn đã lọc theo công đoạn đang ghi**, còn chừa lối
thoát.

- Thêm cột `defect_code` — tham chiếu `production_defect_codes.code` **bằng
  code, không FK cứng** (đúng triết lý danh mục của dự án: nhãn sửa được mà sổ
  cũ không sai).
- Giữ `defect_reason` (chữ) nhưng đổi vai: từ *lý do chính* thành **ghi chú
  thêm**, bắt buộc khi chọn mã `khac` (Nguyên nhân khác).
- Ô chọn bày: lý do của **công đoạn đang ghi** + lý do **dùng chung** (`stage_code`
  null). Tổ sơn thấy ~7 mục, không phải 17.

**Đây là thời điểm duy nhất làm được rẻ:** sổ 0 dòng nên không có dữ liệu cũ để
chuyển đổi.

### 4.3 Danh mục lý do phải rà lại

Seed 0067 viết theo lộ trình **cũ**. Ba việc:

- **Bỏ nhóm `mai`** (2 mã) — công đoạn mài đã gỡ khỏi lộ trình 18/09.
- **Thiếu mã cho:** nguội · đan · may · lắp ráp · bao bì · đóng gói.
- **Lý do SỬA LẠI dùng chung danh mục với phế** — cùng một hiện tượng ("lệch
  mối hàn"), khác ở chỗ cứu được hay không. Tách hai danh mục là bắt người khai
  học thuộc hai bảng.

---

## 5. Thiết kế màn — khuôn F

### 5.1 Lưới: thêm một cột, không phá bố cục

Hiện tại: `Chi tiết · Cần · Đã đạt · [SL đạt] · [Phế] · [Lý do phế]`

Mới: `Chi tiết · Cần · Đã đạt · [SL đạt] · [Phế] · [Sửa lại] · [Lý do]`

Ba ô nhập **đứng liền nhau** (mô hình SAP), vì người khai đọc một dòng và quyết
một lần: món này đạt, hỏng, hay cứu được.

**Cột Lý do giữ cơ chế hiện có: chỉ hiện khi dòng CÓ phế hoặc CÓ sửa lại.** Nhờ
vậy lưới thường ngày vẫn 6 cột, không cuộn ngang — đúng luật khuôn F.

### 5.2 Ô chọn lý do — ba yêu cầu

1. **Gõ để lọc**, không phải xổ danh sách rồi cuộn. Danh sách ngắn (7–10 mục)
   nên gõ hai ký tự là ra.
2. **Chọn "Nguyên nhân khác" → ô chữ hiện ngay cạnh**, cùng hàng, không mở hộp
   thoại.
3. **Nhớ lý do vừa dùng** đưa lên đầu danh sách — tổ hàn một buổi thường lặp
   cùng vài lý do.

### 5.3 Tín hiệu màu — theo luật dự án

Ô có số > 0 mới đổi nền, ô trống để nguyên:

- Phế > 0 → nền `--stop-wash` (đỏ nhạt)
- Sửa lại > 0 → nền `--warn-wash` (hổ phách nhạt)
- **Không tô màu ô SL đạt** — đạt là việc bình thường, tô màu thì cả bảng đỏ
  rực và tín hiệu mất nghĩa.

Giữ đúng nguyên tắc 5 của sổ thiết kế: ba màu vòng đời không bao giờ lên nút.

### 5.4 Chân bảng và thanh chốt

Chân bảng (dính đáy) cộng bốn số: **Σ đạt · Σ phế · Σ sửa lại · tỷ lệ đạt lần
đầu**.

`CommitBar` đổi câu: `Sắp ghi N dòng · Σ đạt X · phế Y · sửa lại Z`.

Câu chặn (bấm được, nhảy đúng ô) thêm một vế: *"3 dòng có phế/sửa lại chưa chọn
lý do"*.

### 5.5 Những chỗ khác phải đổi theo

| Màn | Đổi gì |
| --- | --- |
| **M3 Chi tiết lệnh** | MetricStrip thêm ô "Chờ sửa lại"; bảng tiến độ thêm cột |
| **M1 Tình hình xưởng** | Nhịp hôm nay thêm "sửa lại"; cân nhắc ô việc "Tổ có tỷ lệ phế cao" |
| **Phiếu in PBS** | Thêm cột sửa lại + dòng cộng |
| **Sổ ngày** | Hiện đủ ba số khi soi lại |

---

## 6. Thứ tự làm và nghiệm thu

Luật: **mỗi đợt nghiệm thu được rồi mới sang đợt sau.**

| Đợt | Việc | Trạng thái 19/09 |
| --- | --- | --- |
| **1** | Migration `0206`: `rework_qty` + `defect_code`, nới ràng buộc, dựng lại bảng danh mục + seed, tắt nhóm mài, thêm 12 mã nháp | ✅ **đã apply remote 19/09** |
| **2** | Schema + repo + service: `rework_qty` không trừ tổng cần, không chạy tiếp; lý do bắt buộc khi phế/sửa > 0 | ✅ xong, 7 test mới |
| **3** | Lưới ghi sổ: cột Sửa lại + danh mục lý do lọc theo công đoạn đổ vào gợi ý | ✅ xong, bấm thật trên màn |
| **4** | Lan sang M3 · M1 · phiếu in PBS · sổ ngày | ✅ xong — chưa verify bằng số thật |
| **5** | *(sau khi có vài tuần số)* Báo cáo: Pareto lý do, tỷ lệ đạt lần đầu theo tổ | ⏸ chờ số |

**Nghiệm thu end-to-end 19/09** — ghi một phiếu thật rồi xoá sạch: 10 đạt / 2
phế / 3 sửa lại trên lệnh 04/26-27 - MX, lý do gõ "Nứt mối hàn".

| Kiểm | Kết quả |
| --- | --- |
| DB | `rework_qty=3`, `defect_code='han_nut'`, `defect_reason=null` — chữ hoá thành **mã** |
| M3 | "CHỜ SỬA LẠI · 3 · chưa tính vào đã xong" |
| M1 | "PHẾ HÔM NAY 2 / trên 10 đạt" + "CHỜ SỬA LẠI 3" |
| Sổ ngày | cột Sửa lại, dòng phiếu đủ ba số |
| Phiếu in | 7 cột, lý do in ra **chữ** "Nứt mối hàn" (dịch ngược từ mã) |
| Lọc theo công đoạn | tab Sơn 7 gợi ý, tab Hàn 6 — không lẫn công đoạn khác |

**Một tác dụng phụ phải nhớ khi dọn dữ liệu thử:** lượt ghi đầu kéo lệnh
`approved` → `in_progress` **và** đơn hàng `lsx_issued` → `in_production`. Xoá
phiếu không tự trả lại — phải update tay hai trạng thái đó. Số hiệu PBS tiêu
mất một đơn vị (xoá không trả số), vô hại.

**Đợt 5 cố ý để sau.** Dựng báo cáo trên sổ rỗng là dựng một màn rỗng lần nữa —
đúng lỗi đã mắc với M1/M2.

Tổng đợt 1–4: **~2,5 ngày**, làm được trước đợt chạy thử.

---

## 7. Điều KHÔNG làm — và vì sao

**OEE.** Ba trong bốn hệ lớn không có sẵn (SAP chỉ có trong Digital
Manufacturing bán riêng; Dynamics và NetSuite không có; Odoo có menu nhưng công
thức trong mã nguồn chỉ là `productive_time / (productive_time + blocked_time)`,
không phải OEE sách vở). Cả hai thành phần *Availability* và *Performance* đều
cần giờ máy — xưởng không thu. Chỉ làm **tỷ lệ đạt lần đầu · tỷ lệ phế · tỷ lệ
sửa lại**, thuần số lượng.

**Phế có kế hoạch trong định mức.** SAP tách ba loại (assembly/component/
operation scrap), Dynamics có công thức luỹ kế qua công đoạn. Đó là bài toán
hoạch định vật tư, cần BOM sạch và lịch sử tỷ lệ phế ổn định. Đang 0 dòng sổ và
77% dòng SP thiếu định mức — thêm bây giờ là thêm một nguồn số không ai kiểm
được.

**Hạch toán giá trị phế** (Scrap method của Dynamics, Scrap Handling của
NetSuite). Cả bốn hệ đều chốt giá trị lúc **đóng lệnh**, không phải lúc công
nhân báo cáo. Giai đoạn này chỉ cần đếm đúng số lượng theo tổ và theo lý do.

**Lệnh rework riêng + trigger point** (SAP). Quá nặng. Ghi lần hai vào ô Đạt là
đủ đếm đúng.

**Bấm giờ vào/ra ca.** Không quét mã thì bấm giờ là bịa số. Bỏ hẳn trục thời
gian, giữ trục số lượng.

**Chặn cứng thứ tự công đoạn.** Ngay cả SAP cũng không ép được khi lệnh chạy
gối đầu (KBA 2011103). Bốn lớp cảnh báo mềm hiện có là lựa chọn đúng — giữ
nguyên.

---

## 8. Câu cần chốt trước khi code

1. **"Sửa lại" xưởng gọi là gì?** — "sửa lại", "làm lại", "chỉnh lại"? Nhãn
   trên màn phải đúng tiếng xưởng dùng, không phải tiếng ERP.
2. **Ai được ghi ô sửa lại?** — cùng người ghi sản lượng (thống kê), hay QC
   riêng? Hiện QC không lên hệ thống nên mặc định là thống kê.
3. **Danh mục lý do cho 6 công đoạn còn thiếu** — cần xưởng đọc lại và bổ sung.
   Đây là việc của người biết nghề, không phải của dev.
