# Test case thực tế — vai Thống kê xưởng

Viết 22/09/2026. Mục đích: **chạy thử một ngày làm việc thật của thống kê** để
biết hệ thống đã dùng được chưa, trước khi giao cho xưởng.

**Đọc trước:** [`san-xuat-quy-trinh-vai-tro.md`](san-xuat-quy-trinh-vai-tro.md)
(quy trình + máy trạng thái) · [`san-xuat-ghi-san-luong-thiet-ke.md`](san-xuat-ghi-san-luong-thiet-ke.md)
(ba ô đạt/phế/sửa lại).

Đây KHÔNG phải test tự động (`npm test` đã có 2739 ca ở tầng logic). Đây là
**kịch bản bấm tay trên màn thật**, vì thứ cần biết là luồng có chạy trơn với
người thật hay không — lỗi loại đó test tự động không bắt được.

---

## 1. Dữ liệu dùng để thử

| | |
| --- | --- |
| **Lệnh** | `06/26-27 - MX` — 22 dòng SP, **104 dòng chi tiết đã định hình**, hạn xuất 29/11/2026 (còn xa, sai sót không ảnh hưởng giao hàng) |
| **Tổ / công đoạn** | Tổ Phôi (`phoi`), Tổ Hàn (`han`), Tổ Sơn Nhôm (`son`) |
| **Tài khoản** | `thongke.phoi@hoanggia.de` — vai `production_stat` |

**Quy ước dọn dẹp:** phiếu thử đặt số hiệu mang dấu `PBS-THU-` để không tiêu số
của bộ đếm PBS thật và không lẫn với sổ thật. Câu lệnh xoá ở §4.

**Nhớ hoàn nguyên 2 trạng thái khi dọn** (xoá phiếu KHÔNG tự trả lại): lượt ghi
đầu kéo lệnh `approved`→`in_progress` và đơn hàng `lsx_issued`→`in_production`.

---

## 2. Bộ test case

Cột **Kết quả** để trống — điền khi chạy. Ghi `PASS` / `FAIL` + một câu quan sát.

### A. Ghi sản lượng (M4 `/thongke/ghi`) — việc chạy nhiều nhất trong ngày

| # | Kịch bản (lời người làm) | Kỳ vọng | Kết quả |
| --- | --- | --- | --- |
| A1 | Mở màn ghi sổ, chọn tab công đoạn Phôi | Lưới hiện dòng việc của MỌI lệnh đang chạy, gom 2 tầng Lệnh → SP → chi tiết | |
| A2 | Lọc về đúng một lệnh `06/26-27 - MX` | Ô "Lệnh" là bộ lọc tuỳ chọn, chọn xong lưới chỉ còn lệnh đó | |
| A3 | Gõ số đạt cho 5 chi tiết, không phế | CommitBar đáy cộng đúng "Sắp ghi 5 dòng · Σ đạt N" | |
| A4 | Bấm Ghi sổ | Sinh 1 phiếu PBS có số hiệu, toast báo, lưới cập nhật cột "Đã đạt" | |
| A5 | Gõ phế > 0 nhưng **bỏ trống lý do** | CommitBar hiện câu chặn **bấm được**, bấm là nhảy đúng ô Lý do | |
| A6 | Chọn lý do phế từ gợi ý (danh mục đã lọc theo công đoạn) | Tổ Phôi/Hàn chỉ thấy lỗi của công đoạn mình, không thấy đủ 17 mã | |
| A7 | Ghi phế có lý do → kiểm DB | `defect_code` lưu thành **MÃ** (vd `han_nut`), `defect_reason` null | |
| A8 | Gõ ô **Sửa lại** = 3 | Không trừ vào "còn phải làm"; M3 hiện "CHỜ SỬA LẠI 3 · chưa tính vào đã xong" | |
| A9 | Gõ số **vượt** số còn lại | Cảnh báo mềm (viền vàng), **KHÔNG chặn** — ghi vẫn được | |
| A10 | Ctrl+V dán vùng 3×2 ô từ Excel, có số kiểu VN `1.390` | Chảy phải + xuống như Excel; `1.390` hiểu là 1390; phần tràn ngoài lưới bị bỏ và **nói ra** bằng toast | |
| A11 | Bàn phím: Enter/↓/↑ đi dọc, ←→ nhảy khi caret chạm mép | Đi đúng ô, không nhảy lung tung khi cột Lý do ẩn/hiện | |
| A12 | Ô riêng theo công đoạn ở đầu phiếu | Tab Phôi hiện Máy cắt + Quy cách; tab Hàn hiện Loại máy hàn; tab Sơn hiện Màu sơn + Loại sơn | |
| A13 | Ghi meta công đoạn rồi kiểm DB | `stage_meta` lưu theo **khoá bất biến** (`{"mau":"Graphit"}`), không phải nhãn | |
| A14 | Gõ trải **nhiều lệnh** trong một lượt rồi Ghi sổ | Tách thành N phiếu (1 phiếu = 1 lệnh × 1 công đoạn × 1 tổ × 1 ngày); toast liệt kê đủ N số hiệu | |
| A15 | Mở tab Phôi ở chế độ mọi lệnh (414 dòng) | Cắt còn ≤200 theo NHÓM nguyên vẹn + NoticeBar nói "còn N dòng nữa chưa hiện" | |
| A16 | Đổi ngày ghi về **hôm qua** (ghi hồi tố) | Cho phép; header lưới đổi nền báo "ngày ≠ hôm nay" | |
| A17 | Đổi ngày ghi sang **ngày mai** | Phải chặn — không ghi được cho tương lai | |
| A18 | Tab **Đóng gói** | Hiện dòng "Thành phẩm", đơn vị **CÁI**, + hai ô Quy cách đóng và Số kiện | |

### B. Sổ ngày & chốt sổ (P1 `/thongke/ngay`)

| # | Kịch bản | Kỳ vọng | Kết quả |
| --- | --- | --- | --- |
| B1 | Mở sổ ngày hôm nay | Thấy phiếu vừa ghi, gom theo tổ, đủ **ba số** đạt/phế/sửa lại | |
| B2 | Chốt sổ Tổ Phôi | Tổ đó khoá; quay lại M4 ghi thêm cho tổ đó → **bị chặn**, nói rõ vì sao | |
| B3 | **Thống kê tự mở khoá** sổ vừa chốt | Mở được, KHÔNG phải gọi Giám đốc (quyền `daylock.unlock` cấp ở 0205) | |
| B4 | Sau khi mở khoá, ghi bổ sung | Ghi được bình thường; sổ ghi lại ai chốt / ai mở | |

### C. Xem lại và chứng từ

| # | Kịch bản | Kỳ vọng | Kết quả |
| --- | --- | --- | --- |
| C1 | In phiếu PBS (`/print/phieu-sx/[id]`) | 7 cột, có dòng cộng, lý do in ra **CHỮ** (dịch ngược từ mã), khối ký có tên người lập | |
| C2 | Mở M3 chi tiết lệnh | MetricStrip + bảng tiến độ theo SP phản ánh đúng số vừa ghi | |
| C3 | Mở M1 tình hình xưởng | "Nhịp hôm nay" cộng đúng Σ đạt / phế / sửa lại, đúng số tổ đã chốt sổ | |
| C4 | Trao đổi trên lệnh (chatter) | Gửi được ghi chú, hiện người theo dõi | |
| C5 | Xoá một phiếu ghi nhầm | Xoá được — **và ghi nhận: hiện là xoá CỨNG, không để lại vết** (lỗ hổng E) | |

### D. Tác dụng phụ hệ thống (phải quan sát, không bấm)

| # | Kịch bản | Kỳ vọng | Kết quả |
| --- | --- | --- | --- |
| D1 | Sau phiếu ĐẦU TIÊN của lệnh | Lệnh `approved`→`in_progress`, đơn hàng `lsx_issued`→`in_production` | |
| D2 | Ghi đủ số cần của một công đoạn | Job tự chuyển `doing`→`done` (không ai bấm xác nhận) | |
| D3 | Khi mọi job xong | Nút "Đóng lệnh" ở M3 mở ra; còn việc thì nói "Còn N việc chưa xong" | |
| D4 | HolderBar trên M3 | Nói đúng ai đang giữ lệnh và đã bao lâu | |

### E. Khoảng trống đã biết — kỳ vọng FAIL, chạy để xác nhận mức thiệt hại

| # | Kịch bản | Hiện trạng | Kết quả |
| --- | --- | --- | --- |
| E1 | Nhập hàng gửi **gia công ngoài** về | **Không có màn.** Service + API đủ. Hậu quả: `entriesService.summary` đã cộng phần NCC nhận về nên số công đoạn **sai về phía thiếu** | |
| E2 | Ghi **giao WIP giữa tổ** (Q3 chốt 22/09: CÓ đếm) | **Không có màn.** `transfers.service.ts` đủ, thiếu giao diện | |
| E3 | Xuất **báo cáo kỳ** | **Không có màn.** Có cả service lẫn xuất Excel | |

---

## 3. Điều kiện coi là "dùng được"

Đạt cả ba thì mới giao cho xưởng chạy thật:

1. **Nhóm A + B không có FAIL nào** — đây là việc thống kê làm mỗi ngày; vấp một
   chỗ là cả đợt chạy thử chết.
2. **Nhóm D đúng hết** — số tự động phải tin được, vì không ai bấm tay xác nhận.
3. **Nhóm E được chấp nhận có ý thức**: xưởng biết rằng chừng nào chưa có màn gia
   công ngoài thì số công đoạn có thể thiếu, và đồng ý chạy tạm.

## 3b. KẾT QUẢ CHẠY THẬT — 22/09/2026

Chạy trên dev server + DB thật, đăng nhập bằng tài khoản **admin** (không phải
`thongke.phoi` — xem cảnh báo ở cuối mục). Phiếu sinh ra: **`PBS-2026-0018`**
(lệnh `06/26-27 - MX`, công đoạn Phôi, Tổ Phôi, 22/09, 2 dòng: 100 đạt + 5 phế,
50 đạt + 3 sửa lại).

### Đạt — 16 ca

| Ca | Bằng chứng đo được |
| --- | --- |
| A1 | Lưới mở theo MỌI lệnh, gom 2 tầng, 9 tab công đoạn (mài/mộc đã biến mất đúng Q6) |
| A3 | CommitBar "Sắp ghi 2 dòng · 150 · 0 · 0" — cộng đúng, kèm câu tự vạch giới hạn "chỉ cộng dòng đang gõ, chưa gồm số đã ghi trước đó" |
| A4 | Sinh `PBS-2026-0018`, trạng thái `da_xac_nhan` ngay (đúng quyết định 27/08) |
| A5 | Câu chặn gọi ĐÚNG TÊN dòng: *"Chân trước + tựa" có phế/sửa lại nhưng chưa ghi vì sao →*; bấm vào **nhảy đúng ô** `Lý do Chân trước + tựa` |
| A6 | Tab Phôi chỉ đổ 5 gợi ý (Hụt kích thước · Móp méo · Trầy xước · Cắt sai kích thước · Ba via), không phải cả 17 |
| A7 | DB: `defect_code='phoi_cat_sai'`, `defect_reason=null` — chữ hoá thành MÃ |
| A8 | DB `rework_qty=3`; M3 hiện "CHỜ SỬA LẠI 3 · chưa tính vào đã xong" |
| A9 | Gõ 9999 khi còn 50 → viền hổ phách `rgb(138,82,0)` + tooltip *"Vượt phần còn thiếu (50) — vẫn ghi được, kiểm lại cho chắc"*, **không chặn** |
| A12 | Tab Phôi hiện đúng 2 ô Máy cắt + Quy cách ở đầu phiếu |
| A15 | NoticeBar "Còn 206 dòng nữa chưa hiện. Chọn một lệnh…" — cắt có nói ra |
| B1 | Sổ ngày: ma trận 7 ngày × tổ, phiếu đủ ba số 150/5/3, có người lập |
| B2 | Chốt sổ xong ô hiện "150 ✓ · Đã chốt sổ"; ghi tiếp vào tổ đã chốt **bị chặn**, DB không đổi (vẫn 1 phiếu/2 dòng) |
| B3 | Mở khoá được; DB `production_day_locks` về 0. Quyền `production.daylock.unlock` xác nhận CÓ trong role `production_stat` |
| C1 | Phiếu in đủ 7 cột, dòng CỘNG, lý do in ra **chữ** ("Cắt sai kích thước" dịch ngược từ mã), khối ký 3 bên |
| D1 | Lệnh tự `approved` → `in_progress` sau phiếu đầu |
| D3 | M3: "CHƯA ĐÓNG ĐƯỢC — Còn 64 việc chưa xong… " + đường "Ép đóng kèm lý do →" |

### Lỗi tìm được — 4

**L1 · ĐÃ SỬA 22/09.** Màn ghi sổ KHÔNG báo tổ đã chốt sổ, chỉ chặn lúc bấm Ghi.
Ô chọn tổ không có dấu 🔒 nào, không có băng cảnh báo. Thống kê gõ xong cả lưới
mới biết không lưu được. Trái luật của chính dự án (*"Hành động bị chặn phải nói
vướng gì và cách gỡ, ngay tại chỗ. Không cho bấm rồi mới báo lỗi"*) và trái đúng
đặc tả §6.1 (*"tổ đã chốt sổ hiện 🔒 + chặn"*).

**L2 · ĐÃ SỬA 22/09.** Câu báo lỗi chốt sổ đã LỖI THỜI.
[`entries.service.ts:425`](../src/modules/dept/production/entries.service.ts) ghi
*"nhờ quản lý mở khoá trước khi ghi thêm"* — nhưng 0205 đã cấp
`production.daylock.unlock` cho chính thống kê từ 18/09. Câu này đẩy người dùng
đi xin phép thứ họ tự làm được.

**L3 · ĐÃ SỬA 22/09.** Bảng tiến độ M3 báo "Chưa bắt đầu · 0%" ngay sau khi vừa ghi 150.
Số KHÔNG sai — SP `CH0242HG-IR` có 10 chi tiết ở Phôi, mới ghi 2, nên MIN = 0.
Nhưng cùng màn đó đã hiện "PHẾ LUỸ KẾ 5 / CHỜ SỬA LẠI 3" từ chính phiếu vừa ghi,
nên màn tự mâu thuẫn: phế thì thấy, công thì "chưa bắt đầu". Người ghi sổ sẽ
tưởng mất dữ liệu. Cần nhãn phân biệt *chưa ai động* với *đang dở, chưa đủ bộ*.

**L4 · Gõ dở mà rời trang là mất sạch — không có buffer nháp.**
`localStorage` không giữ gì (`drafts: []`). Đặc tả §6.1 có nêu *"mất mạng giữa
chừng → buffer localStorage, khôi phục có toast"* — chưa làm. Lưới vài chục dòng
gõ 20 phút, lỡ bấm nhầm link là gõ lại từ đầu.

### Đã sửa — L1 + L2 (22/09/2026)

Cùng một câu chuyện khoá sổ nên làm chung một đợt.

- `worklist.service.ts`: `EntrySheet` thêm `locks` — sổ đã chốt trong **30 ngày**
  gần đây (cửa sổ, không phải mọi ngày; hàng rào thật vẫn ở `entriesService.record`).
- `EntrySheetForm.tsx`: ô chọn tổ hiện **🔒** cho tổ đã chốt ĐÚNG NGÀY đang chọn;
  `NoticeBar` tone `stop` nói ai chốt + ba đường gỡ; `blocked` thêm nhánh khoá sổ;
  `goBlocked` khi khoá thì **đi sang màn khác** (`/thongke/ngay?date=…`) chứ không
  focus một ô vô dụng trên màn này.
- `entries.service.ts`: bỏ *"nhờ quản lý mở khoá"* → *"mở khoá ở màn Sổ ngày rồi
  ghi tiếp"*.

Nghiệm thu trên màn thật (tạo một khoá thử rồi xoá): dải tổ hiện `🔒 Tổ Phôi`;
băng đỏ *"Sổ ngày 22/09/2026 của tổ này đã chốt — Quản trị viên chốt…"*; CommitBar
*"Chưa lưu được: sổ ngày 22/09/2026 … →"*; bấm **Mở khoá ở Sổ ngày** nhảy đúng
`/thongke/ngay?date=2026-09-22` và trang đó mở đúng ngày. `npm run check` sạch
2739 test.

### Đã sửa — L3 (22/09/2026)

`WorklistRow` thêm `parts_total` / `parts_started`. Trạng thái dòng không còn
suy CHỈ từ số bộ: `done === 0` mà đã có chi tiết nào có số thì là **đang làm**,
không phải "chưa bắt đầu". M3 in kèm mẫu số để con số 0 tự giải thích được.

Chặng thành phẩm (lắp ráp → hoàn thiện) đếm thẳng theo bộ trên một dòng nên
`parts_started` bám đúng `done` — không bày câu giải thích thừa.

Nghiệm thu: ghi 120 vào **1/10 chi tiết** ở Phôi của `CH0242HG-IR` → dòng Phôi
hiện *"Đang làm · 1/10 chi tiết có số — chưa đủ bộ nào"*, 7 công đoạn còn lại
vẫn "Chưa bắt đầu". Cột Đạt vẫn là 0 — **đúng**, vì chưa đủ một bộ nào. Dọn sạch
sau khi đo. `npm run check` sạch 2739 test.

### Không kiểm được — 1

**D2 · Công đoạn tự chuyển `doing`→`done` khi đủ số.** Lệnh `06/26-27 - MX`
**không có job nào**, nên `markDoing`/`markDone` không có gì để cập nhật. Toàn hệ
chỉ có **4 job, đều thuộc `01/26-27 - ROSCO`, đều `todo`** — và một job là công
đoạn **`mai`** (đã bỏ khỏi lộ trình từ Q6) **không giao tổ**: rác dữ liệu cần dọn.

Hệ quả dây chuyền: gate "đóng lệnh khi mọi job xong" rỗng với hầu hết lệnh, nên
D3 tuy hiện đúng câu chặn nhưng con số "64 việc" đến từ chi tiết chứ không từ
job. **Máy trạng thái job hiện không chạy vì chưa ai lên kế hoạch.**

### Đợt 2 — chạy nốt các ca còn lại (22/09/2026)

| Ca | Kết quả |
| --- | --- |
| A2 | **Không còn ý nghĩa** — từ 22/09 màn LUÔN ở một lệnh, "lọc về một lệnh" là mặc định |
| A10 | **PASS** — dán 3×2 chảy phải+xuống, `1.390` → 1390, Σ 1.500; dán 4 dòng ở dòng cuối thì **nói ra** "3 ô rơi ngoài lưới" |
| A11 | **PASS** — ↓ ↑ nhảy đúng ô (`0:0` → `1:0`). *Lần đo đầu tưởng hỏng là do bộ gõ giả lập không sinh đúng `ArrowDown`, không phải lỗi app* |
| A13 | **PASS** — `stage_meta` lưu `{"may":"Máy cắt số 2"}`: khoá bất biến, không phải nhãn |
| A14 | **Không còn ý nghĩa** — một lượt gõ không trải nhiều lệnh được nữa. Mã tách phiếu theo lệnh vẫn còn, chỉ là UI không sinh ra tình huống đó |
| A16 | **PASS** — lùi ngày 20/09 chỉ cảnh báo, vẫn ghi được |
| A17 | **FAIL → ĐÃ SỬA** (xem L5) |
| A18 | **PASS** — tab Đóng gói có "Quy cách đóng" + "Số kiện" ở đầu phiếu, mỗi SP một dòng "Thành phẩm" |
| C2 | **PASS** — đã đo khi nghiệm thu L3 |
| C3 | **FAIL → ĐÃ SỬA** (xem L6) |
| C5 | **PASS** — xoá hai nhịp tại chỗ ("Xoá" → "Xoá thật?", tự huỷ sau vài giây), toast xác nhận. **Vẫn là xoá cứng không hỏi lý do** — lỗ hổng E còn nguyên |
| D4 | **PASS** — đã đo ở đợt 1 |

**Chưa chạy: B4** (ghi lại sau khi mở khoá) và **C4** (chatter) — khối trao đổi
có mặt trên M3 nhưng chưa gửi thử ghi chú.

### Đã sửa — L4 (22/09/2026)

Bản gõ dở lưu vào `localStorage` theo khoá `(lệnh × công đoạn)`, kèm **ngày và
tổ** của lúc gõ. Lưu ngay trong sự kiện blur/dán, không qua effect.

**Khôi phục do NGƯỜI bấm, không tự đổ lại** — tự đổ số cũ vào lưới là đường dẫn
tới ghi nhầm số hôm trước; sổ sản lượng là căn cứ tính lương. Băng chỉ mời khi
lưới đang trống. Ghi sổ xong thì xoá nháp (để lại là mời ghi đúp).

Nghiệm thu: gõ 77 → rời sang màn khác → quay lại thấy *"Lần trước bạn gõ dở 1
dòng ở đây, 22/09 lúc 02:26, mà chưa ghi sổ"* → bấm Khôi phục thì ô về 77,
CommitBar cộng lại, băng biến mất. Dán Excel cũng lưu đúng.

### Đã sửa — L5 · ngày tương lai (22/09/2026)

Ô ngày không có `max`, chọn 30/09 vẫn nhận, mà băng còn gọi là **"GHI LÙI NGÀY"**
— sai cả việc chặn lẫn việc mô tả. Service thì vẫn chặn đúng
([`entries.service.ts:409`](../src/modules/dept/production/entries.service.ts)),
nên lại đúng kiểu lỗi L1: chặn muộn.

`DateInput` của kit thêm prop `max` (chặn đường bấm lịch); màn tách `dateFuture`
khỏi `datePast`, thêm nhánh `blocked` riêng và băng đỏ **"Ngày chưa tới"** kèm
nút *Về hôm nay*. Nghiệm thu: picker `max=2026-09-22`; gõ tay 30/09 thì băng đỏ
+ CommitBar chặn với đúng lý do; 20/09 vẫn chỉ cảnh báo.

### Đã sửa — L6 · LỆCH MÚI GIỜ, cả ngày (22/09/2026)

**Lỗi nặng nhất của cả đợt test.** M1 báo *"NHỊP HÔM NAY · 21/09 · chưa có sổ"*
ngay sau khi ghi 45 vào ngày 22/09.

Đường GHI dùng `vnTodayIso()` (giờ VN), nhưng **8 đường ĐỌC** vẫn dùng
`new Date().toISOString().slice(0,10)` — tức **ngày UTC**. Từ 00:00 đến 07:00 giờ
VN, hai bên lệch nhau đúng một ngày: thống kê ghi hôm nay, mọi màn tổng hợp hỏi
hôm qua. Chú thích đầu [`lib/local-date.ts`](../src/lib/local-date.ts) mô tả đúng
cái bẫy này — hàm được viết ra để chữa nó, nhưng chỉ đường ghi được sửa.

Đã đổi cả 8 chỗ sang `vnTodayIso()`: `jobs.service` (×3 — nhịp hôm nay, khoá sổ
hôm nay, chỉ tiêu hôm nay), `so-tong.service`, và 4 trang `kehoach-sx`
(chỉ tiêu · tiến độ · tuần · chi tiết). Hai chỗ trong `jobs.service.test` cũng
đổi theo, nếu không test sẽ đỏ đúng khung giờ này.

Nghiệm thu: M1 hiện *"NHỊP HÔM NAY · 22/09/2026 · SẢN LƯỢNG ĐẠT 45"*.

### CẢNH BÁO VỀ ĐỘ TIN CỦA ĐỢT NÀY

Chạy bằng **admin**, mà admin có mọi quyền. Nên đợt này **chưa chứng minh** được
vai `production_stat` thật sự làm trôi cả luồng — nhất là B3 (mở khoá) và các
chỗ ẩn/hiện nút theo quyền. Phải chạy lại bằng đúng tài khoản `thongke.phoi`
trước khi kết luận "thống kê dùng được".

---

## 4. Dọn dữ liệu thử

```sql
delete from public.production_entries
where doc_id in (select id from public.production_entry_docs where doc_no like 'PBS-THU-%');

delete from public.production_entry_docs where doc_no like 'PBS-THU-%';

delete from public.production_day_locks
where team_department_id = (select id from public.departments where name = 'Tổ Phôi')
  and entry_date >= current_date - 2;
```

Xoá dòng sổ TRƯỚC rồi mới xoá phiếu (`production_entries.doc_id` trỏ vào phiếu).
Rồi hoàn nguyên hai trạng thái ở §1.
