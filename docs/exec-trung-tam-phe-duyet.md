# Khu Giám đốc — Trung tâm phê duyệt

Dựng lại 17/09/2026. Tài liệu gốc `exec-v3-approval-center.md` (15/08/2026) đã
mất khỏi repo; file này ghi lại thiết kế còn sống, đo trên mã nguồn và trên màn
đang chạy, cộng những gì còn treo.

---

## 1. Ba tầng — thiết kế gốc, vẫn đúng

Khu này tổ chức theo **việc cần xử lý**, không theo bảng dữ liệu:

| Tầng | Màn | Câu hỏi |
| --- | --- | --- |
| **Action** | `/exec` · `/exec/approvals` | Hôm nay tôi phải ký gì? |
| **Monitoring** | `/exec/production` · `/exec/orders` · `/exec/purchasing` · `/exec/tracking` | Việc đang chạy thế nào? |
| **Analysis** | `/exec/approvals/history` · `/exec/luat-ky` | Đã quyết những gì, theo luật nào? |

12 route, 25 file `.tsx`, ~4.400 dòng.

**Duyệt báo giá là TUỲ CHỌN** — Sale tự quyết có bấm "Trình GĐ duyệt" hay không;
`draft → sent` không qua GĐ vẫn là đường chính. Migration 0149 đã áp remote,
permission `sales.quote.approve` gán vai `director`. Đừng dựng lại luồng duyệt
báo giá BẮT BUỘC: 0013→0022 đã bỏ vì nghẽn Sale, và 0025 (drop 3 cột duyệt) coi
như bỏ — áp vào sẽ phá repo sau 0149.

---

## 2. Đo trên màn đang chạy (17/09/2026)

| Màn | Số thật |
| --- | --- |
| `/exec` | "Có 15 phiếu đang chờ chữ ký của bạn" · LSX 0 · Đơn mua 15 · Báo giá 0 · 36 đơn hàng đang thực hiện · 14 lệnh SX đang chạy |
| `/exec/approvals` | 15 phiếu; mỗi thẻ tự nói vì sao đáng chú ý: *"Giá trị lớn · chờ 15 ngày · Ngày hàng về đã qua 17 ngày"* |
| `/exec/approvals/history` | 28 quyết định · 5 đã duyệt · 1 trả lại để sửa |

Thẻ phiếu nói lý do cần chú ý thay vì chỉ liệt kê mã — đúng chi tiết đáng chép
của SAP My Inbox (*dòng trong hộp thư tự nói ra quyết định cần ra*).

**Con số đáng lo, và nó không phải lỗi phần mềm**: 15 đơn chờ ký, cái lâu nhất
**15 ngày**, trong khi ngày hàng về đã qua 17 ngày. Hệ thống báo đúng và báo rõ;
chỗ tắc là chưa ai ký. Vai `director` vẫn chưa gán cho ai — Giám đốc đang đăng
nhập bằng `admin`.

---

## 3. Sửa 17/09/2026 — một bộ từ vựng cho một việc

### 3.1 Vấn đề: ba tên cho cùng một hành động

`decide('reject')` đưa đơn về **nháp**, giữ số phiếu và lịch sử, để người soạn
sửa theo lý do rồi gửi lại ([`pos.service.ts`](../src/modules/dept/supply/pos.service.ts)).
Đó là **Request change** của Dynamics — mở đường đi tiếp, không đóng cửa.

Nhưng ba chỗ gọi ba tên:

| Chỗ | Gọi là |
| --- | --- |
| Nút trên thẻ phiếu | "Trả lại" |
| Sổ lịch sử ký | "Từ chối" (badge ĐỎ) |
| Trạng thái đơn sau đó | "Nháp" |
| Con dấu trong ghi chú đơn | `[Từ chối] …` |

Đây là lối mòn #1 của [`tieu-chi-workflow-erp.md`](./tieu-chi-workflow-erp.md):
**một bộ từ vựng trạng thái cho cả hệ thống**. Triệu chứng đúng như tài liệu mô
tả — người dùng hỏi "trả lại rồi thì nó nằm ở đâu", và mỗi chỗ trả lời một kiểu.

### 3.2 Đã sửa

Thống nhất về **"Trả lại để sửa"** ở mọi chỗ người dùng đọc: nút, tiêu đề hộp,
ô nhập (*"Cần sửa gì…"*), toast, sổ lịch sử, thẻ thống kê, con dấu ghi chú.

Hai đổi thay đi kèm, và chúng quan trọng hơn cái tên:

- **Bỏ màu đỏ.** Badge lịch sử đỏ → hổ phách (khớp `withdrawn`, cũng là "quay về
  nháp"); nút xác nhận `destructive` → `secondary`; hành động trên màn Mua hàng
  bỏ `danger`, hạ `stakes` từ `nang` xuống `vua`. Đỏ dành cho việc không lùi
  được. Để đỏ ở đây thì người duyệt ngần ngại bấm đúng cái nút họ nên bấm — và
  quay ra ký bừa hoặc để phiếu nằm im, đúng thứ đang xảy ra với 15 đơn kia.
- **Icon `X` → `Undo2`.** `X` đọc thành "đóng lại"; việc này là trả về.
- **Câu hậu quả nói đơn đi đâu**: *"Phiếu quay về NHÁP, giữ nguyên số và lịch sử
  — người soạn sửa theo lý do rồi gửi duyệt lại."*

**MÃ TRONG SỔ GIỮ NGUYÊN `rejected`.** Đổi nhãn là việc của tầng nhìn; đổi giá
trị đã ghi vào sổ là viết lại lịch sử, và không đáng để chữa một cái tên. Có
test canh cả hai vế trong `actions.test.ts` — nhãn nói đúng việc, và mức độ
không bị nâng lại thành `nang`/`danger`.

---

## 4. Còn treo

| # | Việc | Loại |
| --- | --- | --- |
| 1 | **Delegate** — Giám đốc đi vắng thì uỷ quyền ký, cả phòng không đứng | nghiệp vụ + **cần migration** |
| 2 | **Chuyển sang kit mới** — ~~25 file~~ hai màn chính XONG 17/09; mười màn theo dõi còn lại vẫn theme v3 | giao diện |
| 3 | **Gán vai `director`** cho người thật thay vì để Giám đốc dùng `admin` | vận hành |

Về #2, cân nhắc trước khi làm: CLAUDE.md quy định *"màn cũ chuyển sang kit mới
khi có việc nghiệp vụ chạm vào nó, không chuyển vì lý do thẩm mỹ"*. Chuyển cả
khu GĐ chỉ vì nó trông khác Mua hàng là đi ngược luật đó — nên hoặc chốt làm
kèm một việc nghiệp vụ (ví dụ #1), hoặc chốt bỏ luật đó cho khu này.

Về #1, `Delegate` cần một bảng uỷ quyền (ai → ai, phạm vi, từ ngày, đến ngày,
lý do) và một chỗ đọc nó trong `assertAction`. Migration mới, phải áp lên remote
— không tự áp, hỏi chủ dự án trước.

**Cách thêm một loại phiếu mới vào Trung tâm phê duyệt**: mở rộng `SignItem.kind`
+ các map `KIND_*` + `useApprovalDecision` + `loadPending*Detail`, theo đúng
khuôn của `quote`.

---

## 5. Chuyển hai màn chính sang kit — 17/09/2026

Chủ dự án chốt: làm hai màn Giám đốc dùng hàng ngày, mười màn theo dõi để
nguyên. Bản vẽ duyệt trước khi code (canvas *Giám đốc · Trung tâm phê duyệt*).

**Chuyển HỆ, không thiết kế lại.** Cả năm khối của `/exec` và mọi luật của
`/exec/approvals` giữ nguyên; đổi lớp token và thành phần.

### 5.1 Gắn kit vào khu đang mặc theme v3

`_shell/KitFrame.tsx` — cùng cách khu Mua hàng làm: `WorkspaceShell` gắn
`.theme-v3` ở gốc (sidebar, thanh trên), `ExecKitFrame` gắn `.kit` quanh phần
nội dung. Hai lớp token lồng nhau là CÓ CHỦ Ý; luật "một file một hệ" nói về
file màn hình, còn vỏ và nội dung là hai file khác nhau.

Thang mật độ RIÊNG (`hg.exec.dense`), không dùng chung với Mua hàng: Giám đốc
đọc để ký, người mua gõ như Excel — hai nhịp làm việc khác nhau.

Mười màn theo dõi KHÔNG hỏng vì lớp này: token `.kit` chỉ thêm biến, không xoá
biến của `.theme-v3`.

### 5.2 `/exec` — Tổng quan

| | Trước | Sau |
| --- | --- | --- |
| Đầu trang | `PageHeader` ba tầng | `ScreenHeader compact` một hàng, kèm ba dữ kiện (chờ chữ ký · lâu nhất · cần chú ý) |
| Ô phê duyệt | thẻ `rounded-xl border p-4` | `WorkTile` của kit, `hint` bắt buộc nói con số ĐẾM CÁI GÌ |
| Cảnh báo | lưới thẻ | lưới `Table` 30px, một dòng một cảnh báo |
| Tên khối | `<h2>` chữ nhỏ | dải 26px nền xám, ngăn bằng vạch |

### 5.3 `/exec/approvals` — Trung tâm phê duyệt

Đây là màn đáng chuyển nhất, và lý do đo được:

- Bản cũ có **HAI bố cục cho cùng một danh sách** — thẻ dọc dưới 1280px, bảng
  từ 1280px lên — khoảng 250 dòng mã để giữ chúng khớp nhau. Nay một lưới cho
  mọi bề rộng.
- Với 15 phiếu đang chờ, thẻ cao ~110px bắt Giám đốc cuộn **ba màn hình**. Lưới
  30px cho cả 15 phiếu vào một màn.
- **Chân bảng cộng tiền theo từng loại tệ** — câu hỏi đầu tiên của người ký
  ("tổng bao nhiêu tiền đang chờ tôi") mà bản cũ chỉ trả lời sau khi đã tích
  chọn.
- **Thanh hành động luôn hiện**, cùng luật với màn Đơn mua: `Ký duyệt` ·
  `Trả lại để sửa` · `Xem kỹ`; chưa chọn thì xám kèm *"Chọn một phiếu trong
  bảng trước"*. Chọn nhiều thì nút ký đổi thành `Ký n phiếu`, còn `Trả lại` vẫn
  khoá — trả lại phải ghi lý do cho từng phiếu.

**Ba luật giữ nguyên, không đụng**: phiếu *Giá trị lớn* không có ô tích; ký
nhiều phiếu gọi tuần tự và phiếu lỗi nằm lại trong hộp; màn rỗng nói thật vì
sao rỗng (đã ký hết ↔ chưa ai lập phiếu).

### 5.4 Vá kèm

`ApprovalDetailScreen` vẫn còn nút **"Từ chối"** — chỗ cuối cùng trong khu còn
gọi tên cũ, sót lại từ đợt thống nhất từ vựng ở mục 3. Nay là *"Trả lại để
sửa"* kèm icon `Undo2`, khớp với Trung tâm phê duyệt và sổ lịch sử.

---

## 6. Màn thẩm định phiếu — THIẾT KẾ LẠI 17/09/2026

Khác hai màn ở mục 5: đây không phải chuyển hệ mà làm lại từ **nhiệm vụ**.

Giám đốc ngồi trước 15 phiếu, mỗi phiếu hỏi bốn câu theo đúng thứ tự:

1. bao nhiêu tiền, cho ai?
2. có gì bất thường không? — không thì ký luôn
3. nếu có: dòng nào gây ra nó?
4. **ký xong thì phiếu tiếp theo ở đâu?**

Câu 4 là thứ bản cũ bỏ sót hoàn toàn.

### 6.1 Bốn thay đổi

| # | Việc | Vì sao |
| --- | --- | --- |
| 1 | **Đi tuyến tính `‹ n/N ›` + nút "Ký & sang phiếu sau"** | Bản cũ ký xong `router.push` về danh sách, người ký phải tìm lại chỗ dừng — với 15 phiếu là 15 lần quay đầu. Tiêu chí 9 của [`tieu-chi-man-chung-tu-erp.md`](./tieu-chi-man-chung-tu-erp.md) |
| 2 | **Quyết định thành dải NGANG trên đầu** | Cột phải 340px ăn chỗ của lưới; ở màn hẹp nó xếp chồng thành khối cao lêu nghêu, mở phiếu ra chưa thấy vật tư đâu |
| 3 | **Cảnh báo tách từng dải, chỉ thẳng vào dòng** | Bản cũ gộp một câu ở khay phải: *"cần xem kỹ từng dòng"* — đúng nhưng bắt người ký tự dò, dù 3 dòng hay 40 dòng |
| 4 | **Lưới vật tư MỘT bố cục** | `PoLineTable` cũ có thẻ dọc dưới 672px và bảng 9 cột từ 672px lên, ~160 dòng mã giữ chúng khớp nhau — cùng lối mòn đã dọn ở Trung tâm phê duyệt |

Khay phải còn lại **chỉ để đọc**: số liệu chốt · luồng duyệt · *"lệnh này còn
chờ gì"*. Không còn nút nào.

**LSX và Báo giá GIỮ NGUYÊN khung cũ.** Hai loại đó hiện 0 phiếu chờ nên không
kiểm được trên dữ liệu thật; đổi mù một màn không ai mở là cách chắc chắn để
làm hỏng nó trong im lặng.

### 6.2 Hai số liệu mới

- **Cột "Giá lần trước"** — `pricesRepo.lastPurchases` vốn đã có (dùng ở bảng kê
  vật tư của lệnh), chỉ gọi lại kèm `excludePoId`. **Tham số đó bắt buộc**: đơn
  đang chờ ký cũng nằm trong `supply_purchase_order_lines` và chỉ đơn
  `cancelled` mới bị loại, nên không loại chính nó thì nó là lần mua mới nhất
  và cột luôn hiện "không đổi" dù giá vừa tăng 12%.
- **"Lệnh này còn chờ gì"** — đếm đơn cùng lệnh đang chờ chữ ký, lấy từ chính
  `signBox` (một lần gọi phục vụ cả `‹n/N›` lẫn con số này).

### 6.3 ĐO TRÊN DỮ LIỆU THẬT: cột so giá hiện CHƯA có gì để so

Kiểm ba phiếu bất kỳ trong 15 phiếu đang chờ: **mọi dòng đều trả "dòng tự do"**,
không dòng nào trỏ vào mã vật tư (`material_id` null).

Lý do: 15 đơn này đều **nạp từ file Excel** (`Nạp từ file: Mer 02-26.xlsx…`), và
đường nạp đó ghi tên vật tư dạng chữ chứ không khớp vào danh mục. Cột so giá
hoạt động đúng — nó nói thật rằng không so được — nhưng sẽ trống cho tới khi
đơn được lập trên hệ thống hoặc dòng nạp từ file được gán mã.

Đây là **vấn đề dữ liệu, không phải giao diện**, và cùng gốc với ghi chú
"Người lập đơn — (nạp từ file)" ở khay phải.
