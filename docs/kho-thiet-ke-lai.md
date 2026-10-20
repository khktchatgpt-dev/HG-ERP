# Kho — thiết kế lại theo chuẩn kho sản xuất

> Chủ dự án 15/09/2026: *"thiết kế sơ sài, thông tin nghèo nàn, chưa sát thực tế
> các kho trong ngành sản xuất — đừng đi theo thiết kế hiện tại."*
>
> Tài liệu này đo hiện trạng bằng schema và màn thật, đối chiếu với SAP WM/EWM,
> Dynamics 365 SCM, Odoo Inventory và NetSuite WMS, rồi chốt bảy lỗ hổng và thứ
> tự lấp. Đối chiếu nền chung ở [`thiet-ke-huong-erp.md`](thiet-ke-huong-erp.md);
> luồng chứng từ ở [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md).

---

## 01 · Hiện trạng — đo, không đoán

Phải nói công bằng trước khi chê: phần kho KHÔNG rỗng. Đo ngày 15/09/2026:

| Có sẵn | Bằng chứng |
| --- | --- |
| Tồn là VIEW cộng từ phiếu, không ai gõ số tồn | `warehouse_stock` (0010) |
| Nhập / xuất / trả NCC / hoàn kho từ LSX / kiểm kê | `warehouse_docs.kind` |
| Phiếu có DUYỆT và có ĐẢO | `status`, `approved_by`, `reversal_of_doc_id` |
| Nhận theo ĐỢT GIAO, kèm số phiếu NCC | `shipment_id`, `supplier_doc_no` |
| QC loại tách khỏi số đạt | `qty_rejected`, `qc_status` |
| Nhận vượt phải có lý do, dung sai theo vật tư | `over_tolerance_pct` |
| Đặt trước / khả dụng | màn Tồn kho, cột *Đặt trước · Khả dụng* |
| Điểm đặt lại, min/max, ABC thô | `min_stock`, `max_stock`, `reorder_point`, `reorder_qty` |
| Giá vốn theo dòng chuyển động | `warehouse_movements.unit_cost` |
| Đơn vị kép | `unit2_factor`, `qty2_actual` |
| Danh mục 13.229 vật tư có nhóm, quy cách, barcode | `warehouse_materials` |

Cái thiếu **không phải chức năng lẻ**. Cái thiếu là ba TRỤC mà mọi kho sản xuất
đều quản, còn ở đây chưa tồn tại như một khái niệm:

1. **HÀNG NẰM Ở ĐÂU** — không có danh mục vị trí, chỉ có một ô chữ tự do.
2. **HÀNG THUỘC LÔ NÀO** — không có khái niệm lô, kể cả với vải và sơn.
3. **HÀNG ĐANG Ở TRẠNG THÁI VẬT LÝ NÀO** — chờ kiểm, đạt, lỗi, chờ trả: cả bốn
   cùng nằm chung một con số tồn.

Ba trục đó là lý do người dùng thấy "nghèo nàn": không phải ít nút, mà là mỗi
màn chỉ trả lời được *bao nhiêu*, không trả lời được *ở đâu · lô nào · dùng được
chưa*.

---

## 02 · Kho sản xuất thật quản gì — đối chiếu 4 hệ

| Trục | SAP WM/EWM | Dynamics 365 | Odoo | NetSuite | HG hiện tại |
| --- | --- | --- | --- | --- | --- |
| Vị trí | Storage type → section → **bin** | Warehouse → **Location** (aisle/rack/shelf/bin) | **Location** phân cấp | **Bin** | ô chữ `shelf_location` |
| Lô | **Batch** có đặc tính | **Batch/Serial** | **Lot/Serial** + hạn | **Lot** | *không có* |
| Trạng thái hàng | **Stock type**: unrestricted / quality / blocked | **Inventory status** | **Location** riêng cho QC | **Status** | *không có* |
| Nhập kho | Inbound delivery → **GR → putaway** | Receive → **Put away** | Receipt → **Internal transfer** | Receive → **Putaway** | một bước |
| Xuất SX | Transfer order + **pick list** | **Picking work** | Delivery + **wave** | **Pick task** | một bước |
| Kiểm kê | **Cycle counting** theo ABC | **Cycle count plan** | **Scheduled count** | **Count task** | chỉ kiểm toàn bộ |
| Định giá | MAP / FIFO / chuẩn | FIFO / trung bình | FIFO / AVCO | FIFO / LIFO / AVG | có `unit_cost`, chưa có báo cáo |

Điểm chung của cả bốn: **nhận hàng KHÔNG phải một bước**. Hàng vào cổng, nằm chờ
kiểm, kiểm xong mới vào kệ và mới được tính là dùng được. Gộp ba bước thành một
là chỗ HG đang khác thực tế nhất.

---

## 03 · Bảy lỗ hổng, xếp theo mức đau CHO HG

HG làm bàn ghế ngoại thất xuất khẩu: nhôm cây, ống sắt, vải, mút, sơn tĩnh điện,
bao bì carton. Thứ tự dưới đây theo mức thiệt hại thật của ngành này, không theo
độ đầy đủ của lý thuyết.

### ① LÔ VẢI — đau nhất, hiện không có gì

Vải nhuộm theo **dye lot**. Hai lô khác nhau lệch màu mắt thường thấy được. Một
bộ bàn ghế ghép nệm từ hai lô là cả lô hàng xuất bị khách trả.

Đơn vải của HG đang chạy: `1/2026-HG/VPR` 29.691 mét, giao **3 đợt**. Ba đợt gần
như chắc chắn là ba lô nhuộm khác nhau. Hệ thống hiện ghi tất cả vào **một con
số tồn 29.691 mét** — không cách nào biết đợt nào còn bao nhiêu, và không cách
nào ngăn tổ may lấy lẫn.

Cần: lô có **mã, ngày nhập, số cuộn, số lô của NCC**; xuất phải chọn lô; cảnh báo
khi một LSX bị cấp từ hai lô.

Cùng cơ chế dùng cho **sơn tĩnh điện** (mã màu + batch + hạn dùng) và **mút**
(tỷ trọng theo lô).

### ② KHU CHỜ KIỂM — hàng chưa kiểm đang được tính là dùng được

Hiện `qty_rejected` ghi số loại, nhưng số ĐẠT vào tồn **ngay khi lập phiếu**.
Thực tế: xe về chiều tối, hàng xuống sân, sáng hôm sau mới kiểm. Trong khoảng đó
hệ thống nói "có 1.950 cái dùng được" trong khi chưa ai mở thùng.

Cần **trạng thái hàng** (SAP gọi stock type):

```
chờ kiểm  →  đạt (dùng được)
          →  lỗi → trả NCC
          →  khoá (chờ xử lý)
```

Tồn khả dụng chỉ đếm phần **đạt**. Đây cũng là cái làm "nhập kho" tách thành hai
bước đúng như mọi ERP: **ghi nhận hàng về** rồi **nghiệm thu nhập kệ**.

### ③ VỊ TRÍ THẬT — 13.229 mã trong một ô chữ tự do

`shelf_location` là text trên vật tư (mặc định) và trên dòng chuyển động. Không
có danh mục vị trí, nên không tra được "kệ A3 đang có gì", không kiểm kê theo
khu, không in được đường đi lấy hàng.

Cần danh mục **vị trí** phẳng hai cấp là đủ cho một kho: `KHU → Ô`
(ví dụ `NHOM-A / A-03`), gắn loại hàng chứa được (cây dài, cuộn, pallet, hoá
chất). Chưa cần ba tầng như SAP.

### ④ PHIẾU LĨNH THEO LSX — thiếu đường đi

"Cấp vật tư SX" hiện là một phiếu xuất. Kho thật cần **phiếu lĩnh**: gom nhu cầu
của một lệnh, **xếp theo vị trí** để người lấy đi một vòng, tick từng dòng khi
lấy, thiếu thì ghi ngay tại dòng.

### ⑤ KIỂM ĐẾM CHU KỲ — 13.229 mã không đếm hết một lần được

Chỉ có kiểm kê toàn bộ. Kho thật đếm xoay vòng theo ABC: hàng A tháng/lần, B
quý/lần, C năm/lần. Có sẵn `min_stock`/`reorder_point` để phân hạng.

### ⑥ ĐỊNH GIÁ TỒN — có dữ liệu, chưa có câu trả lời

`unit_cost` đã ghi trên từng dòng nhập. Chưa có báo cáo "tồn này đang là bao
nhiêu tiền", mà đó là số kế toán hỏi mỗi cuối kỳ.

### ⑦ ĐƠN VỊ KÉP Ở MÀN TỒN — nhôm đếm cây hay đếm kg

`qty2_actual` có trên chuyển động. Màn tồn chỉ bày một đơn vị. Nhôm mua theo kg,
cấp theo cây; không bày cả hai thì hai phòng đọc hai số.

---

## 04 · Thiết kế màn — sáu màn, không phải tám mục rời

Bỏ cách xếp menu hiện tại (Tổng quan · Nhập kho · Đơn đặt NCC · Cấp vật tư SX ·
Kiểm kê · Tồn kho · Sổ chứng từ · Danh mục). Xếp lại theo **việc người kho làm
trong một ca**:

### A · Bàn làm việc ca (Khuôn A)
Năm con số của hôm nay: lô phải nhận · lô đang chờ kiểm · phiếu lĩnh chưa lấy ·
mã dưới tối thiểu · việc kiểm đếm tới hạn. Mỗi ô bấm vào là danh sách việc.

### B · Nhận hàng (Khuôn C → D)
Ba bước tách bạch, mỗi bước một chứng từ đọc được:

```
Chờ nhận (đợt GH-…)  →  Ghi nhận hàng về  →  Kiểm nhận  →  Nhập kệ
                          (tạo LÔ)           (đạt/lỗi)     (chọn vị trí)
```

Bước "Ghi nhận hàng về" là chỗ **sinh lô**: mã lô, số lô của NCC, số cuộn/kiện.

### C · Xuất kho (Khuôn C → F)
Phiếu lĩnh theo LSX, dòng **xếp theo vị trí**, chọn lô khi vật tư có quản lô,
cảnh báo khi một LSX phải lấy từ hai lô vải.

### D · Tồn kho — ba góc nhìn, một dữ liệu
Theo **vật tư** (đang có) · theo **vị trí** (kệ nào đang chứa gì) · theo **lô**
(lô nào còn bao nhiêu, nhập ngày nào, hết hạn khi nào).

### E · Kiểm kê
Toàn bộ (như hiện tại) + **chu kỳ** theo hạng ABC, sinh phiếu đếm theo khu.

### F · Danh mục
Vật tư (đã có) · **vị trí** (mới) · **lô** (mới, chỉ đọc — lô sinh từ phiếu nhập).

---

## 05 · Schema cần thêm

```
warehouse_locations            khu/ô lưu trữ
  id · warehouse_id · code · name · kind(cay-dai|cuon|pallet|hoa-chat|ke-thuong)
  parent_id · is_active

warehouse_lots                 lô hàng
  id · material_id · code(LO-YYYY-NNNN) · supplier_lot_no
  received_doc_id · received_at · expiry_date · note

warehouse_movements  (+ cột)
  lot_id · location_id · stock_status(cho-kiem|dat|loi|khoa)
```

Ba cột thêm vào `warehouse_movements` giữ nguyên nguyên tắc **tồn là view cộng
từ phiếu** — chỉ là view nay nhóm theo (vật tư × vị trí × lô × trạng thái) thay
vì chỉ theo vật tư. Không đẻ bảng tồn, không ai gõ số tồn.

**Vật tư quản lô hay không là một CỜ trên vật tư**, không bắt cả 13.229 mã khai
lô. Đếm theo nhóm danh mục thật (15/09/2026):

| Nhóm bật cờ quản lô | Số mã |
| --- | ---: |
| Mút - xốp - nệm - gòn | 804 |
| Sơn - keo - hoá chất | 533 |
| Vải - da - chỉ - phụ liệu may | 332 |
| **Cộng** | **1.669** |

1.669 trên 13.229 — **13%**. Phần còn lại (bu lông 1.498, bao bì 1.696, dụng cụ
1.064…) không quản lô, khai nhập như hiện tại. Con số này là lý do dùng CỜ chứ
không bật đại trà: bắt người nhận khai lô cho từng thùng ốc vít là cách chắc
chắn nhất để họ khai bừa, rồi dữ liệu lô mất giá trị ở đúng chỗ cần nó.

---

## 06 · Thứ tự làm

| Đợt | Việc | Vì sao trước |
| --- | --- | --- |
| 1 | Trạng thái hàng (②) + tách nhận hàng thành 2 bước | Sửa chỗ hệ thống đang NÓI SAI: hàng chưa kiểm đang tính là dùng được |
| 2 | Lô hàng (①) cho vật tư có cờ | Đau nhất về tiền — lệch màu là mất cả lô xuất |
| 3 | Vị trí (③) + tồn theo vị trí | Nền cho phiếu lĩnh và kiểm đếm |
| 4 | Phiếu lĩnh theo LSX (④) | Dùng được ngay khi có vị trí |
| 5 | Kiểm đếm chu kỳ (⑤) | Cần ABC, mà ABC cần vài tháng dữ liệu xuất |
| 6 | Định giá tồn (⑥) + đơn vị kép (⑦) | Kế toán hỏi cuối kỳ, chưa chặn việc hàng ngày |

## 07 · Thứ KHÔNG làm

- **Nhiều kho.** Đang có đúng một kho `MAIN`. Mọi thứ dựng sẵn cho ba kho là
  dựng cho bài toán chưa tồn tại — giữ `warehouse_id` như hiện tại là đủ.
- **Serial number từng cái.** Bàn ghế không bán theo số máy.
- **Wave picking / sóng lấy hàng.** Cần khi một ca có hàng trăm phiếu lĩnh; HG
  chưa tới đó.
- **Quét mã vạch.** Đã chốt KHÔNG làm (xem memory dự án). Vị trí và lô vẫn khai
  tay được — làm barcode sau thì không phải sửa lại schema.
