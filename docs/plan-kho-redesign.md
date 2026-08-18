# Kế hoạch: thiết kế lại khu Kho theo nghiệp vụ

> Soạn 16/08/2026 từ bản phân tích của chủ dự án (7 mục). Nguyên tắc chốt của
> bản phân tích — "Kho là nơi XÁC NHẬN biến động, tồn tự tính từ nhập/xuất/điều
> chuyển/kiểm kê" — hệ thống ĐÃ đúng từ nền: `warehouse_stock` là VIEW trên
> `warehouse_movements`, không ai gõ số tồn trực tiếp. Kế hoạch này là bài toán
> BÀY LẠI THEO NGHIỆP VỤ + bù các mảnh thiếu, không phải đập nền.

## Đối chiếu 7 mục với hiện trạng (rà code 16/08/2026)

| Mục đề xuất | Hiện trạng | Kết luận |
|---|---|---|
| 1. Dashboard kho | Trang chủ Kho chỉ đếm danh mục vật tư | **GĐ1 — làm mới** |
| 2. Nhập kho (chờ nhập / đã nhập / trả NCC) | Form PNK + trả NCC có đủ, nhưng chôn trong modal của màn Chứng từ; "chờ nhập" đã CÓ DỮ LIỆU từ đợt giao 0152/0153 | **GĐ1 — màn riêng** |
| 3. Xuất kho — cấp vật tư SX theo nhu cầu | Luồng "LSX → BOM → nhu cầu → prefill phiếu xuất" ĐÃ CHẠY (smartLsxNeeds, cần/đã cấp/còn), nhưng cũng chôn trong modal | **GĐ1 — màn riêng** |
| 4. Tồn kho 3 cột Tồn/Đang giữ/Khả dụng | ĐÃ CÓ đúng đề xuất (`/warehouse/stock`, reservedByCommittedLsx) | Không làm |
| 5. Kiểm kê có DUYỆT chênh lệch | Có kiểm kê (0077) nhưng điều chỉnh tồn NGAY khi nhân viên lập biên bản — chưa có bước quản lý duyệt | **GĐ2** |
| 6. Vị trí kho dạng cây / nhiều kho | `shelf_location` text tự do trên vật tư; một kho chính | **GĐ3** (chờ nhu cầu thật — hiện 1 kho) |
| 7. Theo dõi lô (lot) truy xuất nguồn gốc | Chưa có; movement đã nối po_line_id nên truy được PO/NCC ở mức PHIẾU, chưa ở mức LÔ | **GĐ3** (schema mới, đụng cả nhập lẫn xuất) |

## GĐ1 — Bày lại theo nghiệp vụ (KHÔNG migration) ✅ làm ngay

**Sidebar Kho mới** (workspaces.config):

```
KHO
  Tổng quan            /warehouse            (dashboard mới)
  Nhập kho             /warehouse/nhap       (MỚI — chờ nhập theo đợt/PO)
  Cấp vật tư SX        /warehouse/xuat       (MỚI — LSX → cần/đã cấp/còn)
  Tồn kho              /warehouse/stock      (giữ nguyên)
  Kiểm kê              /warehouse/stocktake  (giữ nguyên)
  Chứng từ             /warehouse/docs       (giữ — sổ mọi phiếu + form)
  Danh mục vật tư      /warehouse/materials  (giữ nguyên)
```

**Dashboard `/warehouse`** — theo đúng sketch: khối Tồn (số mã VT đang dùng,
sắp hết); khối Hôm nay (phiếu nhập/xuất lập hôm nay); khối Chờ xử lý (đợt giao
quá hẹn/hôm nay/sắp tới, PO mở chưa có đợt); danh sách vật tư sắp hết + đợt
sắp về, mỗi dòng bấm sang màn nghiệp vụ. Chỉ theo dõi — không nhồi thao tác.

**`/warehouse/nhap` — Chờ nhập**: nguồn là ĐỢT GIAO planned/arrived (0152) xếp
theo ngày (quá hẹn đỏ, hôm nay vàng) + PO mở chưa khai đợt. Mỗi dòng: nút
"Lập phiếu nhập" → `/warehouse/docs?new=receipt&po=<id>&shipment=<id>` (form
sẵn có, mở sẵn + chọn sẵn đợt). Kèm lối "Trả hàng NCC" (`?new=return`).

**`/warehouse/xuat` — Cấp vật tư cho sản xuất**: danh sách LSX đang chạy, bung
một lệnh → bảng đúng 3 cột của sketch (Cần / Đã cấp / Còn — API
`/api/dept/warehouse/lsx-needs` sẵn có) → nút "Tạo phiếu xuất" →
`/warehouse/docs?new=issue&lsx=<id>` (form sẵn có, prefill nhu cầu như cũ).

**DocsManager** nhận deep-link `?new=receipt|issue|return` (+ `po`, `shipment`,
`lsx`) để các màn nghiệp vụ mở thẳng form — form KHÔNG viết lại, chỉ thêm
initial props.

## GĐ2 — Kiểm kê có duyệt (migration nhỏ)

Trạng thái biên bản: `draft → pending_approval → applied/rejected`. Nhân viên
đếm & lập; QUẢN LÝ duyệt thì movements điều chỉnh mới được ghi (hiện ghi ngay).
Cần cột `status/approved_by/approved_at` trên phần stocktake + service tách
"lập biên bản" khỏi "áp chênh lệch". Giữ nguyên nguyên tắc: điều chỉnh là
MOVEMENT, không sửa số tồn.

## GĐ3 — Lô hàng & vị trí kho (schema mới, chờ chốt phạm vi)

- **Lot**: bảng `warehouse_lots` (mã lô LOT-yymmdd-nnn, material, NCC, PO,
  ngày nhập, SL) + `lot_id` trên movements. Nhập theo đợt 0153 là chỗ sinh lô
  tự nhiên (mỗi PNK theo đợt = 1 lô). Truy xuất: Thành phẩm → LSX → phiếu xuất
  → lô → NCC. Đụng cả nhập lẫn xuất (xuất phải chọn lô — FIFO gợi ý) → làm khi
  chủ dự án chốt cần truy xuất tới mức lô.
- **Vị trí**: nâng `shelf_location` text thành danh mục Khu/Kệ/Ngăn khi có
  nhiều kho thật. Hiện một kho — chưa đáng phức tạp hoá.

## Thứ tự & luật đi

GĐ1 xong dùng được ngay (không migration). GĐ2/GĐ3 mỗi cái một migration riêng,
làm khi được duyệt. Mỗi GĐ: `npm run check` sạch + build.
