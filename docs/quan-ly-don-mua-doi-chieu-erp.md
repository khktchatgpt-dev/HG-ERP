# Quản lý đơn mua — phòng thu mua làm việc thế nào trong ERP thật

Viết 16/09/2026 sau khi chủ dự án chấm màn `/mua-hang/don`: _"các thao tác chỉnh
sửa xoá chỉ có ở trang chi tiết, màn này chỉ có thể thao tác để vào trang chi
tiết… hiện tại tôi thấy đang thiết kế theo hướng web"_.

Tài liệu này trả lời ba câu: **ERP thật cho người mua làm gì ngay trên danh
sách**, **một phòng nhiều người thì chia việc ra sao**, và **một lệnh sản xuất
nhiều đơn thì theo dõi thế nào**.

Khác với [`mua-hang-phieu-mua.md`](./mua-hang-phieu-mua.md) — tài liệu đó chốt
_bố cục_ màn danh sách. Đây là _tính năng_ và _luồng_.

---

## 1. Đo trên màn hiện tại — bốn phát hiện

### 1.1 Hành động ĐÃ CÓ ĐỦ, nhưng không ai tìm ra

`actions.ts` khai **13 hành động** cho khay: Sửa đơn · Nhân bản · Xoá nháp ·
Huỷ đơn · Gửi Giám đốc duyệt · Duyệt · Rút về nháp · Từ chối · Gửi nhà cung cấp ·
Đổi hẹn giao · Ghi việc đã giục · Hạ về nháp để sửa · Sửa điều khoản.

Chúng chỉ hiện khi **bấm chọn một dòng** — và màn không có dấu hiệu nào mời bấm.
Mở màn ra, chưa chọn gì, thì không thấy một nút hành động nào. Đây không phải
thiếu tính năng; đây là **thiếu khả kiến**, và nó đúng là thứ khiến màn "giống
web": web giấu bớt để trông gọn, ERP bày ra để người quen tay biết mình có gì.

### 1.2 Sửa và Nhân bản đều là ĐƯỜNG LINK sang trang khác

```
EDIT → href: /mua-hang/don/{id}?sua=1
DUP  → href: /mua-hang/don/moi?tu={id}
```

Không có thao tác nào sửa được dữ liệu **tại chỗ**. Đổi một ngày hẹn giao cũng
phải rời danh sách.

### 1.3 Hàng loạt chỉ có MỘT hành động, và rất dễ bị chặn

`bulkActionFor` lấy hành động **đầu tiên** có cờ `bulk` của bước hiện tại, và
đòi **mọi dòng cùng một trạng thái**. Chọn 5 đơn mà 3 nháp 2 đã duyệt thì thanh
chỉ nói "các đơn đang chọn không cùng một bước". Không gán được người phụ trách
hàng loạt, không đổi hẹn giao hàng loạt.

### 1.4 Không có đường nhìn NGƯỢC từ lệnh sản xuất

Gom theo lệnh cho biết "lệnh này có những đơn nào", nhưng không cho biết **lệnh
này đã đặt đủ chưa**. Dải "Lệnh trống" chỉ đếm lệnh chưa có đơn NÀO — lệnh có 3
đơn mà còn thiếu 7 mã vật tư thì không hiện ở đâu.

---

## 2. ERP thật làm thế nào

### 2.1 Dynamics 365 — Action Pane LUÔN HIỆN, nút mờ đi chứ không biến mất

Đây là câu trả lời trực tiếp cho lời chê ở đầu tài liệu. Tài liệu Microsoft nói
rõ luật: _các nút trong action pane được bật là những nút thực hiện được hành
động hợp lệ với lựa chọn hiện tại; khi người dùng đổi lựa chọn, trạng thái
bật/tắt của từng nút phải được cập nhật lại._

Nghĩa là nút **luôn nhìn thấy**. Chưa chọn dòng thì nút xám, chọn rồi thì sáng
lên — chứ không phải cả thanh biến mất. Người mua mở màn ra là biết ngay màn này
làm được những gì, kể cả trước khi chọn gì.

Ba nút **hệ thống tự thêm** vào Action Pane của mọi list page, đáng chú ý:

| Nút | Làm gì |
| --- | --- |
| **New** | Tạo bản ghi mới |
| **Delete** | Xoá bản ghi đang chọn |
| **Edit** | Chuyển màn sang **chế độ sửa** — ngay trên danh sách, phím tắt F2 |

Nút **Edit** mới là điểm khác căn bản: ở Dynamics, danh sách có hai chế độ
_xem_ và _sửa_, và sửa xong lưu ngay tại đó. Không phải mở trang khác.

Hai chi tiết nữa của Action Pane đáng chép:

- **Tràn dòng có kỷ luật**: thiếu chỗ thì nút dồn vào menu tràn, tính từ phải
  sang — không bao giờ đẻ thanh cuộn ngang.
- **Tìm hành động** (Ctrl+' hoặc Alt+Q): gõ 2–4 chữ ra đúng nút cần, rồi con trỏ
  quay về chỗ cũ. Cho người dùng 8 tiếng/ngày, đây là thứ thay chuột.

### 2.2 Odoo — sửa nhiều dòng cùng lúc ngay trên lưới

Odoo bật `multi_edit="1"` trên tree view: **chọn nhiều dòng, sửa một ô, áp cho
tất cả**. Chỉ được với trường không tính toán và không chỉ-đọc. Người dùng vẫn
mở form chi tiết được khi cần — hai đường song song, không phải một đường.

Đây là mẫu đúng cho việc "gán 12 đơn cho một người" hay "dời hẹn giao 5 đơn của
cùng một nhà cung cấp".

### 2.3 Luồng đầy đủ của phòng thu mua — chín bước P2P

Tài liệu ngành xếp procure-to-pay thành chín bước:

| # | Bước | HG-ERP hôm nay |
| --- | --- | --- |
| 1 | Xác định nhu cầu | có — định mức theo lệnh |
| 2 | **Lập yêu cầu mua** (requisition) | có `/mua-hang/yeu-cau`, chưa thành chứng từ có vòng đời |
| 3 | **Duyệt yêu cầu** | **chưa có** — duyệt đang nằm ở đơn mua, không ở yêu cầu |
| 4 | Phát hành đơn mua | có |
| 5 | Nhận hàng | có |
| 6 | Nhận hoá đơn NCC | **chưa có** |
| 7 | Theo dõi hiệu suất NCC | có KPI NCC |
| 8 | **Đối chiếu ba chiều** rồi mới duyệt trả | **chưa có** — công nợ đang tính theo phiếu nhập |
| 9 | Trả tiền | chưa có |

Ba chỗ thiếu (3, 6, 8) đã ghi trong
[`tieu-chi-workflow-erp.md`](./tieu-chi-workflow-erp.md) §2.7 và
[`so-cong-no-tk331.md`]. Không thuộc phạm vi màn danh sách, nhưng nhắc để đừng
tưởng màn đơn mua là toàn bộ phòng mua.

### 2.4 Một phòng nhiều người — SAP dùng NHÓM MUA, không dùng một cái tên

SAP có khái niệm **purchasing group**: _một buyer hoặc một nhóm buyer chịu trách
nhiệm về một mảng mua_. Nó là **khoá tổ chức**, và được dùng xuyên suốt: trên
yêu cầu mua, trên đơn mua, khi tìm nguồn hàng, khi báo cáo, khi duyệt, và khi
theo dõi việc theo từng buyer.

Hai điều rút ra:

1. **Trách nhiệm gắn với NHÓM, người chỉ là thành viên.** Người nghỉ phép thì
   đơn vẫn có chủ. HG-ERP đang gắn `assigned_to` = một người, nên người đó nghỉ
   là đơn thành vô chủ — không ai thấy nó trong "Chờ tôi xử lý" của mình.
2. **Nhóm mua còn là mặc định khi lập đơn**: vật tư nào thuộc nhóm nào thì đơn
   tự mang nhóm đó. Đây là cách SAP chia việc mà không phải gán tay từng đơn.

Dynamics bổ sung hai thứ mà HG-ERP chưa có, đã ghi trong
[`thiet-ke-huong-erp.md`](./thiet-ke-huong-erp.md):

- **Request change** — người duyệt trả đơn về cho người soạn mà KHÔNG kết thúc
  luồng (khác "Từ chối" vốn phá sạch trạng thái).
- **Delegate** — người duyệt đi vắng thì uỷ quyền, cả phòng không bị đứng.

### 2.5 Một lệnh nhiều đơn — pegging và gộp đơn

Hai mẫu đối nghịch nhau, và ERP sản xuất có cả hai:

- **Gộp lên**: người mua đặt MỘT đơn phủ NHIỀU lệnh đang mở, thay vì chạy theo
  từng lệnh một. HG-ERP **đã làm** (đơn gộp nhiều lệnh, migration 0125) — đúng
  hướng, và `poMatches` đã xử lý để đơn gộp vẫn lọt khi lọc theo một lệnh phụ.
- **Truy ngược (pegging)**: nối một nguồn cung cụ thể — một đơn mua, một lô tồn
  — với đúng lệnh sản xuất đang cần nó, để người lập kế hoạch tra được quan hệ
  chi tiết ↔ lệnh.

Và thứ quan trọng nhất cho bối cảnh "một lệnh nhiều đơn": báo cáo **nhu cầu ròng
theo từng mã**, đã trừ phần đang có trên các đơn mua đang mở. Đó mới là câu
"lệnh này còn thiếu gì", và nó khác hẳn câu "lệnh này có những đơn nào".

---

## 3. Đề xuất cho HG-ERP — cải thiện tại chỗ, không dựng lại màn

Xếp theo tỉ lệ lợi ích trên công sức. Mỗi việc độc lập.

| # | Việc | Gỡ phát hiện nào | Chép của |
| --- | --- | --- | --- |
| 1 | **Thanh hành động luôn hiện**, nút xám khi chưa chọn dòng, kèm `title` nói vì sao xám | 1.1 | Dynamics Action Pane |
| 2 | **Sửa nhanh tại chỗ** ba trường trên khay: hẹn giao, người phụ trách, ghi chú — không rời màn | 1.2 | Dynamics edit mode |
| 3 | **Hàng loạt mở rộng**: gán người phụ trách, đổi hẹn giao — và cho phép chọn khác bước, nút nào không áp được thì xám kèm lý do | 1.3 | Odoo multi-edit |
| 4 | **Cột "Đặt đủ chưa"** ở dòng nhóm khi gom theo lệnh — số mã còn thiếu, bấm sang Vật tư theo lệnh | 1.4 | pegging / net need |
| 5 | **Nhóm mua** thay cho một cái tên: đơn thuộc nhóm, người là thành viên | 2.4 | SAP purchasing group |
| 6 | **Trả về người soạn** (không phá trạng thái) và **uỷ quyền duyệt** | 2.4 | Dynamics |

Việc 1–3 là **giao diện**, làm được ngay, không đụng nghiệp vụ. Việc 4 cần một
truy vấn mới. Việc 5–6 là **thay đổi nghiệp vụ** — cần chủ dự án quyết trước.

---

## 4. Điều KHÔNG nên chép

- **Đừng làm sửa-tại-chỗ cho MỌI cột.** Odoo giới hạn ở trường không tính toán
  là có lý do. Giá, thuế, tiền phải đi qua form có kiểm tra — sửa tay trên lưới
  là đường ngắn nhất tới một con số không ai giải thích được.
- **Đừng thêm bước duyệt yêu cầu mua khi chưa đau.** Chín bước P2P là của công
  ty có phòng mua tách khỏi phòng dùng. Ở đây người mua ngồi cạnh xưởng.
- **Đừng chép Action Pane có tab gập của Dynamics.** Tab gập sinh ra cho màn có
  40+ hành động; 13 hành động thì một thanh phẳng là đủ, và gập lại còn tốn một
  cú bấm.
- **Đừng bỏ trang chi tiết.** Sửa tại chỗ là cho việc nhanh; đổi dòng hàng, chia
  đợt giao, chốt phần thiếu vẫn phải mở tờ đầy đủ.

---

## Nguồn

- [Action controls — Dynamics 365 F&O](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/user-interface/action-controls)
- [How to: Enable and Disable an Action Pane Button on a List Page](https://learn.microsoft.com/en-us/dynamicsax-2012/developer/how-to-enable-and-disable-an-action-pane-button-on-a-list-page)
- [System-defined buttons — Dynamics 365 F&O](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/user-interface/system-defined-buttons)
- [Batch edit in List View — Odoo forum](https://www.odoo.com/forum/help-1/batch-edit-in-list-view-under-sales-purchase-or-any-module-212536)
- [The Procure-to-Pay (P2P) Process in a Nutshell (9 Steps) — Kissflow](https://kissflow.com/procurement/procure-to-pay-process-guide/)
- [Purchase-to-Pay (P2P) Process Explained — Medius](https://www.medius.com/blog/purchase-to-pay-process/)
- [Purchasing group in SAP](https://www.newsaperp.com/en/blog-sappo-purchasinggroupinsap)
- [Purchasing Group and User Assignment — SAP Community](https://community.sap.com/t5/spend-management-q-a/purchasing-group-and-user-assignment/qaq-p/2016208)
- [How to Use an ERP to Improve your Purchasing Processes — Genius ERP](https://www.geniuserp.com/resources/blog/how-to-use-an-erp-to-improve-your-purchasing-processes/)
- [3 Steps to Identify Missing Parts and Evaluate Shortages for Production Orders — SAPinsider](https://sapinsider.org/3-steps-to-identify-missing-parts-and-evaluate-shortages-for-production-orders/)
