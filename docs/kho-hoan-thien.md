# Kho — hoàn thiện tính năng

Viết 16/09/2026, sau khi bốn bước chính (Nhập · Xuất · Tồn · Danh mục) dựng
xong. Sổ này **xếp hạng phần còn thiếu theo bằng chứng đo được**, không theo
cảm giác "còn thiếu gì thì làm nấy".

Luật xếp hạng, đúng ba luật của `docs/ke-hoach-thuc-hien.md`:

1. Cái đang **chặn người dùng làm xong một việc** đứng trước cái làm đẹp thêm.
2. Cái **đẩy người dùng ra khỏi khu Kho** tính là lỗi, không phải thiếu sót.
3. Không xây màn cho luồng **chưa chạy thật lần nào** — trừ khi chính nó là
   thứ đang chặn luồng chạy thật.

---

## Số đo 16/09/2026

| Phép đo | Số |
| --- | ---: |
| Phiếu nhập · xuất · kiểm kê | 47 · 2 · 1 |
| Phiếu đã bị đảo | 1 |
| Dòng sổ theo đơn · **ngoài đơn** · theo lệnh · lẻ · điều chỉnh | 144 · **3** · 1 · 1 · 117 |
| Dòng sổ có mã lý do | 1 (mã lý do mới bật 15/09, không backfill) |
| **Liên kết trong khu Kho trỏ ra khu khác** | **5** |

---

## A. Đang chặn — làm trước

### A1. Sổ phiếu kho `/warehouse/phieu` ⚠️ hạng nhất

**Hai lỗi cùng một chỗ.**

*Lỗi một*: cả ba màn Kho đều có nút "Xem sổ phiếu" trỏ sang `/planning/docs`
— khu Cung ứng, vỏ khác, menu khác. Thủ kho tra lại một tờ phiếu mình vừa
ghi là bị đá ra khỏi khu của mình. Đúng lối mòn "bị đá về vỏ cũ" mà module
Mua hàng đã phải sửa bằng một đợt riêng.

*Lỗi hai, nặng hơn*: **ghi nhầm thì không sửa được từ khu Kho.** Nguyên lý
"không xoá, chỉ đảo" đã có đường ghi (`stockService.reverseDoc`, đã dùng thật
1 lần) nhưng nút đảo chỉ nằm trong màn cũ của Cung ứng. Thủ kho ghi sai một
phiếu, mở khu Kho ra không có cách nào chữa.

Cần: danh sách phiếu (Khuôn C, lọc theo **mã lý do** là bộ lọc chính) +
chi tiết một phiếu (Khuôn D) + hành động **Đảo phiếu** bắt lý do. Phiếu đảo
và phiếu gốc nằm cạnh nhau, phiếu gốc gạch ngang.

Service đã có đủ: `listDocs` · `docDetail` · `reverseDoc`. **Không migration,
không service mới.**

### A2. Nhập hàng KHÔNG theo đơn `/warehouse/nhap` → phiếu N2

Màn Hàng về hiện chỉ nhận được hàng **có đơn mua**. Hàng về không có đơn
(mua lẻ, NCC giao kèm, hàng mượn) thì thủ kho không có đường ghi nào — mà sổ
đã có 3 dòng loại này, tức việc có thật.

`createReceiptDoc` nhận `po_id: null` sẵn. Cần một form nhẹ: NCC + lý do +
lưới mã / số lượng. Dùng lại đúng khung của phiếu nhập theo đơn.

## B. Đáng làm, chưa chặn

### B1. Hoàn kho từ sản xuất (N3)

Tổ lấy dư thì trả lại kho. `createReceiptDoc` nhận `production_order_id` sẵn,
`issuedByLsx` đã tính NET. Chưa có đường ghi nào ở khu Kho. Sổ: 0 lần — nhưng
cấp cho lệnh cũng mới có 1 lần, nên con số 0 ở đây chưa nói lên điều gì.

### B2. Bàn làm việc Kho `/warehouse` (Khuôn A)

Hiện cửa vào là Hàng về. Bốn ô việc (hàng về · chờ cất · chờ cấp · hàng
khoá), mỗi ô một dòng phụ nói **vì sao gấp**. Chỉ đáng làm khi ba màn kia đã
chạy thật vài tuần — trước đó mọi ô đều bằng 0.

### B3. Cất hàng vào kệ thật (C1)

Hiện mọi lượt nhập vào thẳng khu `TIEP-NHAN` (1 dòng sổ đang nằm đó). Bước
cất hàng biến "chờ cất" thành một câu truy vấn. Chỉ đáng khi kho bắt đầu
nhận nhiều chuyến một ngày.

## C. Chưa đáng — có lý do, đừng tự làm

| Việc | Vì sao chưa |
| --- | --- |
| Trả hàng NCC (X3) | `createReturnDoc` có sẵn, nhưng 0 lô hàng khoá trong DB — chưa có gì để trả |
| Xuất huỷ có duyệt (X4) | cần vòng duyệt; chưa ai huỷ lần nào |
| Kiểm kê theo đợt | bảng 0199/0200 có sẵn; làm khi kho nạp xong tồn thật |
| Tồn dự kiến theo thời gian | ba mảnh dữ liệu đã có, nhưng cần đợt giao + nhu cầu lệnh chạy thật |
| Hồ sơ một vật tư (Khuôn E) | danh mục vừa dựng đã trả lời đủ câu của Kho |
| Quét mã vạch | 0/13.229 mã có mã vạch |
| So định mức khi cấp | chủ dự án chốt 16/09: chưa cần |

---

## Thứ tự đề nghị

```
A1 Sổ phiếu + đảo phiếu  →  A2 Nhập ngoài đơn  →  B1 Hoàn kho SX  →  B2 Bàn làm việc
```

A1 làm trước vì nó vừa bịt lỗ "đá người dùng ra khu khác", vừa mở đường chữa
sai — hai thứ chặn việc dùng thật.
