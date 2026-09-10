# Kế hoạch thực hiện — từ tiêu chí luồng tới việc làm được

Viết 11/09/2026, dựng từ [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md)
(sáu lối mòn đo được) và phần còn thiếu của module Mua hàng.

## Ba luật xếp thứ tự

1. **Việc không cần chủ dự án quyết → làm trước.** Việc cần quyết nghiệp vụ mà
   xếp lên đầu thì cả kế hoạch đứng chờ một câu trả lời.
2. **Việc đang chặn phòng khác dùng hệ thống → ưu tiên cao.** Nặng hơn việc làm
   đẹp thêm chỗ đã chạy được.
3. **Đừng xây màn cho luồng CHƯA CHẠY THẬT lần nào.** Đo hôm nay: 66/68 đơn dừng
   ở nháp — nửa sau vòng đời (gửi NCC → nhận hàng → hoá đơn) chưa chạy thật bao
   giờ. Xây màn cho nó trước khi chạy thử là xây mù.

---

## Đợt 1 — Đóng nốt module Mua hàng · KHÔNG cần quyết gì

**Mục tiêu đo được**: không còn nút nào trên màn đơn mua dẫn ngược về
`/planning`. Người mua làm trọn một đơn trong module mới.

| Việc                                                      | Đang thiếu vì                                          | Cỡ    |
| --------------------------------------------------------- | ------------------------------------------------------ | ----- |
| **Huỷ đơn đã gửi, bắt lý do**                             | Route `cancel` đã có, màn mới chưa gọi                 | nhỏ   |
| **Bàn giao người phụ trách**                              | Route `reassign` đã có                                 | nhỏ   |
| **Sửa điều khoản trên đơn đã duyệt**                      | Route `terms` đã có                                    | nhỏ   |
| **Chốt thiếu theo TỪNG DÒNG + mở lại dòng đã chốt**       | Route `close-short` đã nhận `line_id`, màn mới gửi null | vừa   |
| **Sửa lỗi từ chối ghi đè ghi chú** (lối mòn 2)            | Mất dữ liệu thật, đã có chip việc riêng                | nhỏ   |

Bốn việc đầu đều là **nối màn vào route đã có**, không mở đường ghi mới, không
migration. Rủi ro thấp nhất trong cả kế hoạch.

**Xong đợt này thì**: module Mua hàng tự đứng được, đủ điều kiện chạy thử thật.

---

## Đợt 2 — Chạy thật một đơn · VIỆC CỦA CHỦ DỰ ÁN

Đây không phải việc lập trình. Không ai làm thay được, và nó **chặn đợt 4**.

Một đơn thật đi hết: soạn → Giám đốc duyệt → gửi NCC → NCC xác nhận → Kho lập
phiếu nhập → về đủ. Mỗi bước dừng lại xem màn có nói đúng thứ mình cần không.

**Vì sao phải làm trước đợt 4**: chưa có phiếu nhập thật nào gắn đơn thì không
đối chiếu được hoá đơn với cái gì. Xây màn hoá đơn lúc đó là đoán.

Cái thu được ngoài việc kiểm màn: một bộ dữ liệu thật để đợt 3 và 4 dựng trên
đó, thay vì dữ liệu giả.

---

## Đợt 3 — Bốn trang danh mục và tồn · rẻ nhất

**Mục tiêu**: bốn trang đang trống trong module Mua hàng có nội dung thật.

| Trang            | Khuôn                    | Ghi chú                                        |
| ---------------- | ------------------------ | ---------------------------------------------- |
| Nhà cung cấp     | **E · Hồ sơ danh mục**   | Đã có mẫu chạy được `/design-lab/mau-ho-so-ncc` |
| Vật tư           | **E**                    | Chép cấu trúc từ trang NCC                     |
| Bảng giá         | **E**                    | Lịch sử giá mua đọc từ dòng đơn (0177)         |
| Tồn & cân đối    | **C · Danh sách**        | Bản cũ `/planning/stock` đã có logic           |
| Nhận hàng        | **C**                    | Danh sách chờ nhận theo ngày, dẫn sang Kho     |

Rẻ vì Khuôn E đã có mẫu dựng sẵn bằng kit, và logic nghiệp vụ đã nằm ở bản cũ —
đây là **dựng lại giao diện**, không phải viết nghiệp vụ mới.

**Bẫy phải tránh**: hồ sơ danh mục KHÔNG có vòng đời duyệt. Chỗ của ba trục trạng
thái ở đây là **dải hiệu suất** (`MetricStrip`), mỗi ô kèm mẫu số.

---

## Đợt 4 — Hoá đơn NCC và đối chiếu ba chiều · đắt nhất, giá trị cao nhất

**Mục tiêu**: công nợ NCC đúng bằng tổng hoá đơn chưa trả, không còn
`missing_price_count`.

Đây là lối mòn 5, cái đang chặn phòng Kế toán dùng hệ thống thật.

**Phát hiện làm đổi phạm vi**: bảng `accounting_invoices` đã tồn tại nhưng
**không dùng lại được cho việc này**:

| Cần cho đối chiếu ba chiều | `accounting_invoices` hiện có |
| -------------------------- | ----------------------------- |
| Nối tới nhà cung cấp       | chỉ có `party_name` — chữ tự do |
| Nối tới đơn mua            | không có                      |
| Nối tới phiếu nhập         | không có                      |
| Dòng hoá đơn để khớp dòng  | không có, chỉ một số `amount` |

Nó là **sổ đăng ký hoá đơn**, không phải sổ chi tiết công nợ. Nên đợt này cần
một migration thật.

**Các bước**:

1. Migration: hoá đơn NCC có **dòng**, nối `supplier_id` + `po_id` + phiếu nhập.
2. Màn Hoá đơn NCC (Khuôn D) — nhập hoá đơn, khớp với phiếu nhập đã về.
3. Bảng đối chiếu: đặt / về / NCC đòi, và **phần lệch nằm ở đâu**.
4. Chuyển công nợ từ "phiếu nhập có giá" sang "hoá đơn chưa trả".

**Cần chủ dự án quyết trước khi làm** — bốn câu, đều là nghiệp vụ:

- Ai nhập hoá đơn NCC: Cung ứng lúc nhận, hay Kế toán lúc vào sổ?
- Một hoá đơn có bao giờ gồm nhiều đơn mua không?
- Giá hoá đơn lệch giá đơn thì ai được duyệt phần lệch, ngưỡng bao nhiêu?
- Hàng về nhưng hoá đơn chưa tới có phải là chuyện thường không?

**Chặn bởi**: đợt 2 (phải có phiếu nhập thật gắn đơn).

---

## Việc dọn vặt — xen kẽ khi tiện, không cần một đợt riêng

| Việc                                    | Lối mòn | Cỡ  | Rủi ro                                       |
| --------------------------------------- | ------- | --- | -------------------------------------------- |
| Bỏ `overdue` khỏi `INVOICE_STATUSES`, chuyển thành phép tính | 4 | nhỏ | Phải rà mọi chỗ đang đọc trạng thái đó       |
| `ORDER_STATUSES` thêm bước nháp         | 3       | vừa | Chạm màn Bán hàng — chỉ làm khi có việc ở đó |
| Thống nhất từ vựng "từ chối"            | 1       | vừa | Chạm 3 phòng, cần chốt hướng trước           |

Riêng việc thứ ba có **hai hướng ngược nhau**, phải chọn một:

- **Hướng A — Đơn mua thêm `rejected`.** Giống Lệnh SX và Báo giá. Thấy được đơn
  nào từng bị từ chối. Đổi lại: thêm một trạng thái, thêm một ô lọc.
- **Hướng B — Bỏ `rejected` ở Lệnh SX và Báo giá, tất cả về nháp.** Ít trạng
  thái hơn, đúng tinh thần "đừng thêm khái niệm tới khi đau". Đổi lại: mất dấu
  vết ai từng bị từ chối, trừ khi đọc chatter.

Tôi nghiêng về **Hướng B** cho công ty một xưởng, nhưng đây là quyết định của
chủ dự án vì nó đổi cách phòng Kỹ thuật và Bán hàng đọc màn của họ.

---

## Chưa làm, có chủ ý — và lý do

| Việc                              | Vì sao chưa                                                        |
| --------------------------------- | ------------------------------------------------------------------ |
| Hộp thư việc xuyên phòng          | Đáng làm, nhưng chỉ có giá trị khi Kho và SX cũng đẩy việc vào. Sau đợt 3 |
| Kỳ kế toán / khoá sổ              | Chỉ khi kế toán thật sự chốt sổ theo tháng                          |
| Tách ba trục trạng thái           | Chỉ khi "về một phần" thành chuyện thường ngày                      |
| Request change / Delegate         | Cần quyết nghiệp vụ; hiện Giám đốc đi vắng thì cả phòng đứng        |
| **Tắt `/planning`**               | Chỉ sau khi module mới chạy thật ít nhất 2 tuần không sự cố         |

Dòng cuối quan trọng nhất: **hai module đang sống song song là trạng thái tạm,
không phải đích đến.** Càng để lâu càng tốn công giữ hai bên không lệch nhau.

---

## Tóm tắt đường đi

```
Đợt 1 (tôi làm ngay)  ──►  Đợt 2 (chủ dự án chạy thử)  ──►  Đợt 4 (hoá đơn NCC)
                                      │
                                      └──►  Đợt 3 (4 trang danh mục) — chạy song song được
```

Đợt 3 không phụ thuộc đợt 2, làm song song được. Chỉ đợt 4 là bị chặn thật.
