# Màn "Phiếu mua" — đối chiếu bốn hệ ERP và quyết định thiết kế

Viết 10/09/2026 cho `/mua-hang/don`, bản dựng lại của `/planning/pos`. Đo trên mã
nguồn thật (`planning/pos/*`, 68 đơn, 65 nháp) và trên tài liệu chính thức của
SAP Fiori, Dynamics 365 F&O, Odoo 17, NetSuite.

Câu hỏi màn này trả lời: **"trong sổ đơn mua, cái nào cần tôi động vào — và tôi
động vào được ngay ở đây không?"** Khuôn C của sổ thiết kế, cộng khay kiểm tra.

---

## 1. Bốn hệ lớn dựng màn danh sách đơn mua ra sao

| Đặc trưng | SAP Fiori — *Manage Purchase Orders* | Dynamics 365 F&O — *All purchase orders* | Odoo — *Purchase › Orders* | NetSuite — *Purchase Orders* |
|---|---|---|---|---|
| Khuôn | **List Report**: thanh lọc + bảng thông minh | **List page** + Action Pane + FactBox | Danh sách / Kanban / Lịch, cùng một thanh lọc | Saved search dựng thành danh sách |
| Khung nhìn lưu được | **Variant** ("My Purchase Orders", "Overdue") — chọn ở đầu thanh lọc | **Saved view** theo người, có mặc định ("My open orders") | **Favorites** = bộ lọc + gom nhóm đặt tên | Saved search |
| Trạng thái | Tách cột: *Approval status*, *Delivery status*, *Invoice status* | **Ba trục**: PO status / Document status / Approval status | *State* + *Receipt status* + *Billing status* | Một cột Status |
| Gom nhóm | Không trên bảng (đẩy sang Analytical List Page) | Group by trường bất kỳ trên grid | **Group by** là điều khiển hạng nhất (Vendor / Date / Status…) | Theo saved search |
| Hàng loạt | Mass actions trên toolbar bảng | Action Pane áp lên dòng đang chọn | Menu Action trên dòng chọn | Mass update |
| Hành động trên dòng | Chủ yếu mở Object Page | **Action Pane luôn hiện, nút khoá kèm lý do** | Nút trong form | Mở bản ghi |
| Chọn cột | Hộp thoại personalization | Column chooser, lưu vào view | Toggle cột tuỳ chọn | Trong saved search |
| Mật độ | Compact / Cozy / Condensed | — | — | — |
| Đèn "kịp sản xuất" | Không có | Không có | Không có | Không có |

**Ba mẫu chung của cả bốn hệ**, và là thứ màn cũ thiếu:

1. **Khung nhìn có tên.** Người dùng không lọc lại mỗi sáng; họ mở "Đơn của tôi"
   hay "NCC trễ hẹn" đã đặt sẵn. Màn cũ có 4 ô số + 7 tab + 2 chip + 2 select,
   nhưng không cái nào có tên để nhớ và không cái nào gửi link cho người khác được.
2. **Trạng thái tách trục.** Cả bốn đều tách "đơn ở bước nào" khỏi "hàng về chưa"
   khỏi "tiền trả chưa". Màn cũ gộp thành một badge + một cột "Về kho" đứng xa nhau.
3. **Gom nhóm là điều khiển, không phải hai màn.** Odoo và Dynamics cho gom theo
   bất kỳ trường nào bằng một menu. Màn cũ có đúng hai kiểu xem cứng: "Theo lệnh
   SX" và "Danh sách", và gom theo NCC — câu hỏi khi chuẩn bị gọi điện — thì không
   làm được.

**Đặc trưng riêng của HG-ERP, không hệ nào có, và phải GIỮ:** đèn *Kịp SX?* so
hẹn giao của đơn với hạn vật tư của lệnh (`lib/po-fit`). Nó trả lời đúng câu của
xưởng, không phải của phòng mua. Bốn hệ lớn không có vì họ dựng cho người mua
chuyên trách; ở đây người mua ngồi cạnh xưởng.

---

## 2. Điều KHÔNG chép

- **Kanban kéo thả (Odoo).** Người mua không kéo đơn qua cột; trạng thái đổi qua
  hành động có kiểm quyền, kéo thả là mời bấm nhầm.
- **Lịch (Odoo).** Câu "ngày nào có hàng" đã có trang riêng *Hàng sắp về*.
- **Analytical List Page (SAP).** Biểu đồ trả lời câu của kỳ, không phải hôm nay.
- **Trục thanh toán.** Chưa có phân hệ; bày cột "Thanh toán" toàn dấu "—" là dạy
  người dùng bỏ qua cột đó. Ghi rõ "chưa nối" ở chú thích thay vì vẽ cột rỗng.

---

## 3. Lối mòn của màn cũ, đo được

| # | Lối mòn | Bằng chứng trong mã |
|---|---|---|
| 1 | Hai kiểu xem cứng thay vì gom nhóm | `PosByLsx` / `PoFlatTable` là hai component riêng, chuyển bằng công tắc |
| 2 | Lọc có nhưng không đặt tên, không lên URL | `PoFilterState` sống trong `useState`, F5 là mất; không gửi link được |
| 3 | Hành động giấu sau menu ⋯ từng dòng | `poRowMenu` — 5 mục, phải mở từng dòng mới biết có gì |
| 4 | **Rút về nháp không có nút ở đâu** | `usePoActions.withdrawPo` tồn tại, `emptyHint` còn nhắc "Thu hồi về nháp", nhưng không nút nào gọi — người gửi nhầm phải nhờ Giám đốc từ chối |
| 5 | Nhân bản có hàm, không có mục menu | `openEdit(po,'duplicate')` có, menu ⋯ không có |
| 6 | Bấm dòng là rời trang | Mọi thao tác đều `router.push` sang chi tiết, mất chỗ đứng |
| 7 | Cột cố định | `buildPoColumns` trả một bộ; ẩn cột theo breakpoint chứ không theo người dùng |
| 8 | Hạn vật tư sửa được nhưng chỉ trong thẻ lệnh | Xem "Danh sách" là mất đường sửa |

Điều màn cũ làm ĐÚNG và giữ nguyên: sáu rổ trạng thái theo "chỗ đơn đang nằm"
(`po-filter.ts`), công tắc *của tôi / quá hẹn / chưa hẹn* nhân với rổ chứ không
thay rổ, đếm chip trên toàn bộ đơn chứ không trên kết quả lọc, cảnh báo trần
1.000 đơn, tách "quá hẹn mà chưa gửi" khỏi "NCC trễ".

---

## 4. Quyết định thiết kế cho `/mua-hang/don`

### 4.1 Bố cục — Khuôn C + khay

```
ScreenHeader   tiêu đề · dữ kiện (tổng, chờ tôi, quá hẹn) · [+ Soạn đơn]
FilterBar      [Khung nhìn ▾] [Tìm…] [Rổ trạng thái ▾] [NCC ▾] [Loại ▾]
               (·) Của tôi  (·) Quá hẹn  (·) Chưa hẹn      [Gom theo ▾] [Cột ▾] Bỏ lọc
Table          tick · Đơn · NCC · Chuỗi · Trạng thái đơn · Về kho · Hẹn giao · Kịp SX · Phụ trách · Giá trị · Tạo
               GroupRow theo gom nhóm, meta cộng sẵn (số đơn, tiền theo tệ, quá hẹn)
BulkBar        khi có dòng tích và MỌI dòng cùng bước
InspectPanel   đơn đang chọn: đến lượt ai · hai trục trạng thái · kịp SX (sửa hạn) · chuỗi · hành động
StatusBar
```

### 4.2 Khung nhìn có tên — ĐÃ GỠ 16/09/2026, xem mục 7

Bảy khung nhìn đặt sẵn, mỗi cái là một tổ hợp lọc + gom + sắp, và **mã nằm trên
URL** (`?nhin=cho-duyet`). Sửa lọc đi thì URL đổi sang dạng đầy đủ
(`?trang_thai=pending&ncc=…&gom=ncc`), vẫn gửi link được. Không lưu theo
người (chưa cần — bảy cái đặt sẵn phủ đủ câu hỏi thường gặp; thêm lưu theo người
khi có người thứ hai xin).

| Mã | Tên | Lọc | Gom | Thay cho thứ gì ở màn cũ |
|---|---|---|---|---|
| `toi` | Đơn của tôi | mine | lệnh SX | chip "Của tôi" + xem theo lệnh |
| `cho-duyet` | Chờ duyệt | rổ pending | — | ô số 1 |
| `chua-gui` | Đã duyệt · chưa gửi NCC | rổ ready | NCC | ô số 2 |
| `tre` | NCC trễ hẹn | rổ inflight + late | NCC | ô số 3 |
| `dang-ve` | Đang về | rổ inflight | tuần hẹn giao | tab "Đang về" |
| `chua-hen` | Chưa hẹn giao | noEta | — | chip "Chưa hẹn giao" |
| `tat-ca` | Tất cả | — | lệnh SX | mặc định cũ |

### 4.3 Hai trục trạng thái, tách cột

*Trạng thái đơn* (rổ + nhãn 9 trạng thái) và *Về kho* (x/y dòng) đứng cạnh nhau.
Trục thứ ba *Thanh toán* không vẽ — ghi ở chú thích chân bảng "chưa nối phân hệ".

### 4.4 Gom theo — chép Odoo group-by

Năm cách: **Lệnh SX** (giữ nghiệp vụ cũ, kèm meta tiền theo tệ và số quá hẹn),
**NCC** (chuẩn bị gọi điện), **Trạng thái**, **Người phụ trách** (họp giao việc),
**Tuần hẹn giao** (xếp lịch nhận). Cộng "Không gom" = bảng phẳng.

Gom theo Lệnh SX chỉ hiện lệnh CÓ đơn. Lệnh đang chạy mà chưa có đơn nào là câu
hỏi của trang *Vật tư theo lệnh* — ở đây chỉ một dải nhắc kèm số và link, không
dựng lại thẻ lệnh trống (mỗi trang một câu hỏi, chốt 05/09/2026).

### 4.5 Hành động — chép Action Pane của Dynamics, đặt ở khay

Khay kiểm tra bày **đủ** hành động của bước hiện tại, nút không dùng được thì
khoá kèm `title` nói lý do — không giấu. Danh sách theo bước:

| Bước | Nút chính | Nút phụ |
|---|---|---|
| Nháp | Gửi Giám đốc duyệt | Sửa · Nhân bản · Xoá nháp |
| Chờ duyệt | Duyệt *(người có quyền)* | **Rút về nháp** · Từ chối *(kèm lý do)* |
| Đã duyệt | Gửi nhà cung cấp | Đổi hẹn giao · Nhân bản |
| Đang về | Mở đơn *(ghi nhận nhận hàng ở Kho)* | Đổi hẹn giao · Ghi việc đã giục |
| Đã đóng | Mở đơn | Nhân bản / Tạo lại từ đơn |

Hàng loạt: chỉ khi mọi dòng tích **cùng bước** — gửi duyệt, duyệt, gửi NCC. Khác
bước thì thanh nói thẳng "các đơn đang chọn không cùng một bước" thay vì giấu nút.

Cố ý **không** đưa lên danh sách: bàn giao (cần danh sách người nhận), huỷ đơn đã
gửi, chốt phần thiếu — ba việc cần ngữ cảnh của trang chi tiết.

### 4.6 Chọn cột, mật độ — nhớ theo máy

Column chooser với bộ mặc định; `.kit-dense` cho người quen Excel. Cả hai lưu
`localStorage`, đọc bằng `useSyncExternalStore` (không setState trong effect).

### 4.7 Sửa hạn vật tư ngay trong khay

Đèn *Kịp SX?* chỉ có nghĩa khi hạn vật tư của lệnh đúng. Khay hiện hạn đó và
cho sửa tại chỗ (`PATCH /lsx/{id}/materials-due`) — đúng lúc người mua đang nhìn
một đơn và hỏi "kịp không". Màn cũ chỉ sửa được trong thẻ lệnh, xem phẳng là mất.

---

## 5. Bản đồ tính năng cũ → mới (kiểm không sót)

| Tính năng ở `/planning/pos` | Ở `/mua-hang/don` |
|---|---|
| 4 ô số bấm được | 4 khung nhìn đặt sẵn tương ứng, cộng 3 |
| 7 tab vòng đời | ô "Rổ trạng thái" trên thanh lọc, đếm trên toàn bộ |
| Tìm / NCC / Loại / Của tôi / Chưa hẹn / Bỏ lọc | giữ nguyên, lên URL |
| Theo lệnh ⇄ Danh sách | "Gom theo" 5 cách + Không gom |
| Đầu thẻ lệnh: khách, đơn hàng, tiền theo tệ, quá hẹn, về kho | meta của GroupRow |
| Panel "N lệnh chưa có đơn" | dải nhắc + link *Vật tư theo lệnh* |
| Sửa hạn vật tư của lệnh | trong khay khi chọn đơn thuộc lệnh |
| Đặt thêm đơn / Mở trang lệnh | link trong meta nhóm và trong khay |
| Menu ⋯: Xem · Sửa · Gửi duyệt · Duyệt · Từ chối · Gửi NCC | khay: đủ, cộng Rút về nháp · Nhân bản · Xoá nháp · Đổi hẹn · Ghi việc đã giục |
| Hàng loạt: gửi duyệt / duyệt / gửi NCC | giữ, cùng luật "cùng bước" |
| `?view=<id>` sau khi lưu nháp | mở khay đúng đơn đó, không đẩy sang trang khác |
| Cảnh báo trần 1.000 | giữ |
| Cột: tick, PO/NCC, chuỗi, giá trị, trạng thái, về kho, hẹn·kịp, phụ trách, ngày tạo | đủ, thêm chọn cột |
| Đơn huỷ mờ đi; chip "gộp N lệnh" / "mua chung" | giữ |
| Sắp xếp cột, phân trang (bảng phẳng) | sắp xếp; không phân trang — bảng tự cuộn dưới trần đã nói |

---

## 6. Logic dùng chung, KHÔNG tính lại

`po-filter.ts` (rổ, khớp lọc, đếm), `pos-groups.ts` (gom theo lệnh, tiền theo tệ),
`lib/po-status`, `lib/late-risk`, `lib/po-fit`, `lib/supply-watch`. Màn mới chỉ
thêm một lớp mỏng: khung nhìn có tên ↔ URL, và gom theo bốn trục còn lại.

---

## 7. Sửa lại 16/09/2026 — gỡ chỗ chồng chéo

Chủ dự án chấm màn là "khá rối và chưa hợp lí". Đo trên mã: **23 điều khiển trên
bốn dải** trước khi lưới bắt đầu, và **một việc có hai đường làm**.

### 7.1 Lỗi nằm trong chính tài liệu này

Hai mục ở trên nói ngược nhau, và người viết mã làm cả hai:

- **§4.2** — bảng khung nhìn có cột *"Thay cho thứ gì ở màn cũ"*: chip "Của
  tôi", bốn ô số, bảy tab vòng đời.
- **§5** — bản đồ tính năng: *"Tìm / NCC / Loại / Của tôi / Chưa hẹn / Bỏ lọc —
  **giữ nguyên**"*.

Một mục nói THAY, mục kia nói GIỮ. Kết quả là màn có đủ cả hai: bảy khung nhìn
gói sẵn lọc+gom+sắp, và ngay cạnh là từng mảnh rời của chính chúng.

| Khung nhìn | Làm lại được bằng | Ở đâu |
|---|---|---|
| Đơn của tôi | chip **Của tôi** | hàng 2 |
| NCC trễ hẹn | chip **Quá hẹn** | hàng 2 |
| Chưa hẹn giao | chip **Chưa hẹn giao** | hàng 2 |
| Chờ duyệt · Đã duyệt chưa gửi · Đang về | ô **Rổ trạng thái** | hàng 1 |
| phần gom của mọi khung nhìn | ô **Gom theo** | hàng 2 |

Động vào bất kỳ ô nào thì khung nhìn rơi về "tuỳ chỉnh", nên người dùng không
bao giờ biết mình đang đứng ở đâu.

### 7.2 Sáu việc đã làm

Giữ nguyên bố cục — vẫn header + hai hàng lọc + bảng + khay. Chỉ gỡ chỗ trùng.

| # | Việc | Vì sao |
|---|---|---|
| 1 | **Gỡ khung nhìn đặt tên** (cả `?nhin=`) | Chủ dự án chốt là dùng chip và ô lọc rời. Link vẫn gửi được: `encodeView` vốn đã sinh dạng đầy đủ |
| 2 | **Bốn số ở header bấm được** | Chúng lặp đúng số của ba chip ngay dưới — một lần bấm được, một lần không |
| 3 | **Bỏ chip "Quá hẹn"** | Nó đếm `late + lateUnsent` gộp, header tách hai; hai chỗ hai số cho cùng một khái niệm |
| 4 | **Sắp xếp + Cột + Dày → nút "Hiển thị"** | Ba tuỳ chỉnh hiển thị, đặt một lần rồi thôi, không đứng ngang hàng với lọc |
| 5 | **Ngày lập + Loại đơn → nút "Lọc thêm"** có số | Ba bộ lọc dùng thưa nhất chiếm chỗ ngang ô hay dùng nhất |
| 6 | **"Bỏ lọc" luôn hiện, khoá khi rỗng** | Nút hiện/biến mất làm cả hàng bên phải nhảy ngang |

**Gom theo Ở LẠI ngoài.** Nó là câu hỏi nghiệp vụ — xem theo lệnh hay theo nhà
cung cấp đổi hẳn cách đọc bảng — không phải tuỳ chỉnh hiển thị.

Kết quả: **hai hàng lọc từ 16 điều khiển còn 10**, và không còn chỗ nào nói hai
lần. Số dải giữ nguyên 4 — nén dải là thiết kế lại, không phải cải thiện.

### 7.3 Trục `lateSide` — con số phải giữ lời hứa

Việc 2 lộ ra một lỗi cũ hơn: `countPos` tách `late` (đơn đã gửi, lỗi ở nhà cung
cấp) khỏi `lateUnsent` (đơn còn nằm ở mình) **từ 05/09**, nhưng `poMatches` thì
không tách. Nên thẻ "NCC trễ hẹn" đếm 6 mà bấm vào ra 9.

`PoFilterState.lateSide: 'any' | 'sent' | 'unsent'` vá đúng chỗ đó, mặc định
`'any'` nên màn cũ `/planning/pos` không đổi gì. Có test canh cặp đếm–lọc trong
`po-filter.test.ts`.

### 7.4 Đợt hai 16/09/2026 — hành động và cột

Chủ dự án chấm tiếp: _"màn này chỉ có thể thao tác để vào trang chi tiết"_,
_"nên tối giản thông tin vì đã có trang chi tiết rồi"_, _"bỏ tự lọc khi mới vào
trang đi"_. Nền đối chiếu ERP cho đợt này ở
[`quan-ly-don-mua-doi-chieu-erp.md`](./quan-ly-don-mua-doi-chieu-erp.md).

| Việc | Trước | Sau |
| --- | --- | --- |
| **Thanh hành động** | 13 hành động nằm trong khay, khay chỉ mở khi bấm chọn dòng — mở màn ra không thấy nút nào | Thanh LUÔN HIỆN trên đầu bảng; chưa chọn thì xám kèm "Chọn một đơn trong bảng trước". Khay còn đúng nút chính |
| **Bàn giao** | chỉ ở trang chi tiết — chuyển 12 đơn là mở 12 trang | Hành động hạng nhất, có ở mọi bước còn sống, chạy hàng loạt |
| **Hàng loạt** | một hành động, đòi mọi đơn cùng bước | đủ danh sách, lý do khoá đếm được ("1/2 đơn… lẫn 2 bước"); Bàn giao chạy được cả khi lẫn bước |
| **Cột "Chuỗi liên kết"** | `<mã đơn khách> › <mã lệnh>`, chữ mờ, không bấm được | cột **"Lệnh SX"**, mã lệnh bấm được để lọc cả màn về lệnh đó |
| **Lọc thêm** | ba ô ngày/loại nằm trong một `Sheet` trượt ra che màn | HÀNG LỌC PHỤ mở tại chỗ, đẩy bảng xuống 33px rồi trả lại — đang lọc thì phải nhìn được danh sách đổi theo từng ô mình chỉnh (SAP Fiori "Adapt filters") |
| **Bộ cột mặc định** | 8 cột | **6**: NCC · Lệnh SX · Trạng thái · Hẹn giao · Phụ trách · Giá trị. "Về kho", "Kịp SX?", "Ngày tạo" bật lại ở hộp Hiển thị |
| **Xoá đơn** | nút `Xoá nháp` CHỈ tồn tại ở bước nháp; các bước sau biến mất hẳn nên tạo nhầm rồi lỡ gửi duyệt là tìm không ra | nút có mặt ở MỌI bước, khoá thì chỉ đường: chờ duyệt → "Rút về nháp trước", đã gửi → "dùng Huỷ đơn", đã đóng → "hết đường". Luật sổ không đổi: chỉ nháp mới xoá thật |
| **Vào trang** | lọc sẵn `mine` — sổ 67 đơn mà màn mở ra chỉ thấy 2 | cả sổ, gom theo lệnh. Muốn xem việc mình thì bấm thẻ "Của tôi" |

Hai điều rút ra, đáng nhớ hơn từng việc:

- **Lọc sẵn mà không nói là lọc thì đọc thành mất dữ liệu.** Đây là cùng một lỗi
  với "con số là lời hứa", chỉ ở chiều ngược: màn hứa đang bày cả sổ trong khi
  nó bày một phần.
- **Tối giản đúng chỗ là đổi MẶC ĐỊNH, không phải bỏ tính năng.** Ba cột rời
  khỏi bộ mặc định vẫn bật lại được; người đã lưu bộ cột riêng không bị đụng.
