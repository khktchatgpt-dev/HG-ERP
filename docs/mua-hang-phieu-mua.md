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

### 4.2 Khung nhìn có tên — chép SAP variant / Dynamics saved view

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
