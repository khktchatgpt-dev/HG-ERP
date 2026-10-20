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

## Đợt 1 — Đóng nốt module Mua hàng · ✅ XONG 11/09/2026

**Mục tiêu đo được**: không còn nút nào trên màn đơn mua dẫn ngược về
`/planning`. Người mua làm trọn một đơn trong module mới.

| Việc                                                | Trạng thái                    | Commit    |
| --------------------------------------------------- | ----------------------------- | --------- |
| **Huỷ đơn đã gửi, bắt lý do**                       | ✅ xong                       | `5b4d4b7` |
| **Bàn giao người phụ trách**                        | ⏭ BỎ QUA — chủ dự án quyết   | —         |
| **Sửa điều khoản trên đơn đã duyệt**                | ✅ xong                       | `5b4d4b7` |
| **Chốt thiếu theo TỪNG DÒNG + mở lại dòng đã chốt** | ✅ xong                       | `3fc4852` + `5b4d4b7` |
| **Sửa lỗi từ chối ghi đè ghi chú** (lối mòn 2)      | ✅ xong — `lib/po-note.ts`    | `362985e` |

Đúng như dự đoán, đây chỉ là **nối màn vào route đã có**: không đường ghi mới,
không migration.

**Đã chạy thật trọn vòng** trên đơn thử `PO-2026-0069` (soạn → gửi duyệt →
duyệt → gửi NCC → chốt thiếu 1 trong 3 dòng → mở lại → huỷ đơn). Đây cũng là
lần đầu có đơn đi quá bước "đã duyệt" trong toàn bộ CSDL.

### Năm thứ chỉ lộ ra khi BẤM THỬ, test thuần không thấy

Ghi lại vì đây là bài học về cách nghiệm thu, không phải danh sách lỗi vặt.

1. **Sheet không khoá nút xác nhận khi thiếu lý do** — bấm được, rồi zod trả
   400 và người dùng nhận toast "Không làm được". Đúng thứ luật kiểm mục 05 của
   `/design-lab` cấm. Kit `SheetActions` vốn CÓ prop `disabled` kèm comment tả
   đúng ca này; màn chỉ quên truyền. Ảnh hưởng cả Từ chối / Chốt thiếu / Ghi
   việc đã giục / Đổi hẹn giao.
2. **Ma trận theo dòng chỉ hiện khi đã có phiếu nhập** — tức đúng lúc cần nhất
   (NCC báo hết một mã mà chưa về gì) thì bảng không hiện, và nút chốt-thiếu-
   theo-dòng vô hình ở chính ca nó sinh ra để phục vụ.
3. **`.k-note` không có `white-space`** nên vết lý do xếp lớp dồn hết về một
   dòng. Không đặt `pre-wrap` thẳng lên nó được — nó là flex container.
4. **Nút xác nhận nuốt cả tên vật tư** (`Chốt thiếu · ACQ0002 · Banh điện ắc
   quy N150 GLOBE`). Nút đỏ phá huỷ mà đọc ra là tên hàng thì không còn đọc ra
   là hành động gì → thêm `confirmLabel`.
5. **Điều khoản của đơn thật phần lớn NULL trong DB** — màn bày ra là mặc định
   của MẪU. Nên bấm "Lưu điều khoản" mà không gõ gì cũng chốt cứng bộ mặc định
   vào đơn. Nhất quán với chế độ sửa đầy đủ và màn có nói ra, nhưng phải biết.

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

---

## Trạng thái khi tạm dừng — 11/09/2026

Nhánh `ui-mau`, **3 commit, chưa push**, working tree sạch, `npm run check` xanh
(2.083 test). Từng commit đã kiểm riêng bằng worktree tạm — cả ba mốc đều
typecheck + test xanh, không mốc nào tham chiếu thứ chưa tồn tại.

```
5b4d4b7  feat(mua hàng): ba hành động còn thiếu trên màn chứng từ đơn mua
3fc4852  feat(mua hàng): lõi quyết định việc chốt thiếu của TỪNG dòng
362985e  fix(mua hàng): lý do CỘNG THÊM vào ghi chú đơn, không ghi đè
```

**Dữ liệu để lại**: đơn thử `PO-2026-0069` đang ở trạng thái *Đã huỷ*, ghi chú
nói rõ là đơn chạy thử (giống `PO-2026-0067` từ 06/09). Đơn đã gửi thì không
xoá được, chỉ huỷ.

### Làm gì tiếp — theo thứ tự

1. **Đợt 2 · việc của chủ dự án** — chạy một đơn THẬT đi hết vòng đời, có phiếu
   nhập của Kho gắn vào đơn. Chặn đợt 4. Không ai làm thay được.
2. **Đợt 3 · bốn trang danh mục** — chạy song song được, không chờ đợt 2.
3. **Đợt 4 · hoá đơn NCC** — chỉ bắt đầu sau đợt 2, và cần bốn câu trả lời
   nghiệp vụ ở mục Đợt 4.

### Hai quyết định vẫn đang treo

- **Bàn giao người phụ trách**: chủ dự án bảo bỏ qua ngày 11/09. Route
  `reassign` vẫn còn, chỉ là màn mới không có nút. Muốn bật lại thì cần thêm bộ
  chọn người — không phải một dòng.
- **Thống nhất từ vựng "từ chối"** (mục "Việc dọn vặt"): vẫn chưa chọn Hướng A
  hay B.

### Một việc dọn mới, phát sinh trong đợt này

Trần **2000 ký tự** của `note` trong `poTermsPatchSchema` giờ là bẫy thật: vết
`stampNote` xếp lớp dần nên đơn sống lâu có thể chạm trần **mà người sửa không
gõ gì vào ô đó**. Đã chặn ở màn (đếm + khoá nút + chỉ cách gỡ), nhưng cách chữa
đúng là tách vết máy ghi ra khỏi ghi chú người viết — cùng hướng với khối "Trao
đổi" (`doc-notes`) đang có sẵn. Chưa làm, có chủ ý: chờ xem người dùng thật có
chạm trần không.
