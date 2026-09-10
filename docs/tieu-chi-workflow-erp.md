# Tiêu chí thiết kế LUỒNG theo hướng ERP

Viết 11/09/2026. Sổ [`/design-lab`](../src/app/design-lab/page.tsx) trả lời **"màn
trông thế nào"** — sáu khuôn, sáu nguyên tắc, mười bốn luật kiểm. Tài liệu này trả
lời câu đứng TRƯỚC nó: **"luồng chạy thế nào"**.

Thứ tự đó không đảo được, và đảo nó chính là lối mòn cũ. Bắt đầu bằng "cần màn gì"
thì mỗi phòng đẻ ra một bộ từ vựng, một cách duyệt, một chỗ xem việc — và không
ai gộp lại được nữa. Bắt đầu bằng "luồng chạy thế nào" thì khuôn màn gần như tự
rơi ra.

Mọi con số dưới đây đo trên chính mã nguồn HG-ERP, có đường dẫn để kiểm lại.

---

## 1. Bốn nguyên lý nền — thứ khiến ERP khác app quản lý

### 1.1 Chứng từ là nguyên tử, không phải bản ghi

SAP gọi là *Belegprinzip*: **không có bút toán nào mà không có chứng từ**. Mọi
thay đổi trạng thái kinh doanh phải đi qua một tờ có **số hiệu, người lập, thời
điểm**, và tờ đó không sửa được sau khi ghi sổ.

Hệ quả thẳng vào giao diện: **không có màn nào cho sửa trực tiếp số tồn**. Muốn
tồn tăng thì lập phiếu nhập. Muốn tồn giảm thì lập phiếu xuất. Muốn sửa sai thì
lập phiếu đảo.

App quản lý thường làm ngược: một ô số tồn, ai có quyền thì gõ đè. Nhanh hơn thật
— và sau ba tháng không ai trả lời được "vì sao tồn mã này từ 400 xuống 120".

### 1.2 Danh mục ≠ Chứng từ

Hai loại dữ liệu, hai luật sống hoàn toàn khác nhau:

|                     | Danh mục (master)                 | Chứng từ (transaction)          |
| ------------------- | --------------------------------- | ------------------------------- |
| Ví dụ               | Nhà cung cấp, Vật tư, Sản phẩm    | Đơn mua, Phiếu nhập, Lệnh SX    |
| Vòng đời duyệt      | **KHÔNG có**                      | Có, và là xương sống của nó     |
| Sửa                 | Sửa tại chỗ, có vết               | Khoá dần theo bước              |
| Câu hỏi người dùng  | "Đối tượng này làm ăn ra sao?"    | "Tờ này đang ở đâu, ai giữ?"    |
| Đo hiệu quả bằng    | Dải hiệu suất (`MetricStrip`)     | Trục trạng thái (`StatusTrack`) |

Nhầm hai thứ này là lỗi thiết kế đắt nhất. Nhét danh mục vào khuôn chứng từ thì
phải bịa ra một vòng đời, rồi người dùng đi tìm nút "gửi duyệt" trên thứ không ai
duyệt bao giờ. Đây đúng là khác biệt giữa Khuôn D và Khuôn E của sổ.

### 1.3 Ba dòng chảy song song, tra ngược được cả ba

Một đơn mua không sinh ra một dòng chảy mà **ba**:

| Dòng chảy   | Đơn mua đóng góp gì   | Phiếu nhập đóng góp gì | Hoá đơn NCC đóng góp gì |
| ----------- | --------------------- | ---------------------- | ----------------------- |
| **Chứng từ** | tờ gốc                | con của đơn            | con của phiếu           |
| **Lượng**   | đã đặt (cam kết)      | đã về (thật)           | —                       |
| **Tiền**    | cam kết chi           | —                      | phải trả (thật)         |

SAP có nút *Belegfluss* (document flow) trên mọi chứng từ, bấm ra cả cây cha–con.
Nguyên tắc rút ra: **đứng ở bất kỳ tờ nào cũng đi ngược lên gốc và xuôi xuống mọi
con được**, không phải mở màn khác rồi tự lọc.

Chỗ hay bị bỏ sót là **dòng tiền tách khỏi dòng lượng**. Hàng về không có nghĩa
là nợ phát sinh đúng bằng số đó — xem mục 2.7.

### 1.4 Không xoá, chỉ đảo

Sai thì lập **chứng từ đảo** trỏ về tờ gốc, hai tờ cùng nằm trong sổ và triệt tiêu
nhau. SAP có MBST cho hàng, MR8M cho hoá đơn, FB08 cho bút toán. Không hệ nào cho
xoá một tờ đã ghi sổ.

Lý do không phải để làm khó: **tổng sổ phải cộng lại đúng bằng những gì đã xảy
ra**, kể cả cái sai. Xoá tờ sai là làm sổ nói dối một cách trơn tru.

Chỗ hay hiểu nhầm: **nháp chưa phải là tờ đã ghi sổ.** SAP cũng cho xoá chứng từ
*parked*. Xoá nháp là đúng; xoá tờ đã qua bàn duyệt mới là sai.

HG-ERP làm đúng cả hai vế — `reversal_of_doc_id` ở Kho
([`stock.repo.ts:198`](../src/modules/dept/warehouse/stock.repo.ts)), và đơn mua
chỉ xoá cứng được khi còn `draft`, từ `pending_approval` trở đi bắt buộc huỷ có
lý do.

---

## 2. Bảy tiêu chí thiết kế luồng — mỗi tiêu chí phải ĐO được

### 2.1 Một bộ từ vựng trạng thái cho cả hệ thống

**Chép của**: Odoo — mọi model đều dùng trường `state` với cùng bộ nền
`draft / confirmed / done / cancel`, khác nhau chỉ ở phần giữa.

**Cách đo**: liệt kê mọi `*_STATUSES` trong mã. Hai chứng từ đi qua **cùng một
việc nghiệp vụ** phải dùng **cùng một tên trạng thái**.

**Triệu chứng vi phạm**: người dùng hỏi "từ chối rồi thì nó nằm ở đâu", và mỗi
loại chứng từ trả lời một kiểu.

### 2.2 Việc được ĐẨY tới người, xuyên mọi loại chứng từ

**Chép của**: SAP *My Inbox*, Odoo *Activities*.

**Cách đo**: một người kiêm hai phòng phải mở **mấy nơi** để biết mình còn nợ
việc gì. ERP thật: **một**. Con số này là thước đo trực tiếp.

**Triệu chứng vi phạm**: người dùng tự nhớ, hoặc lập một sổ Excel riêng để nhớ hộ
hệ thống.

### 2.3 Mỗi bước có MỘT người giữ bóng, và đếm được bao lâu

**Chép của**: Dynamics *work items*, SAP *workflow agent*.

**Cách đo**: mở bất kỳ chứng từ nào, trong **2 giây** trả lời được hai câu: *ai
đang giữ* và *giữ bao lâu rồi*. Tuổi phải tính theo **bước hiện tại**, không phải
tuổi tờ giấy — "chờ duyệt 1 tiếng" và "chờ duyệt 9 ngày" là hai tình huống khác
hẳn nhau.

**Triệu chứng vi phạm**: chứng từ nằm im mà không ai biết. Đo trước đây trên
HG-ERP: **66/68 đơn nằm im 5–7 ngày**, hệ thống không hề báo.

### 2.4 Đường NGOẠI LỆ thiết kế trước đường thuận

Đây là tiêu chí bị bỏ qua nhiều nhất, và là lối mòn tốn kém nhất.

**Vì sao**: đường thuận chạy đúng **một lần** cho mỗi chứng từ. Ngoại lệ thì chạy
đi chạy lại: NCC giao thiếu, giao trễ, giao sai hàng, đòi tăng giá sau khi đã
nhận đơn, mình đặt nhầm sau khi đã gửi, hàng về phải trả lại.

**Cách đo**: đếm hành động trên màn chứng từ, tính tỉ lệ phục vụ ngoại lệ. Màn
chứng từ ERP thật rơi vào khoảng **60–70%**. Dưới 30% nghĩa là mới làm xong
happy path.

**Triệu chứng vi phạm**: người dùng xử lý ngoại lệ bằng cách **huỷ đơn tạo lại**,
hoặc bằng ô ghi chú. Cả hai đều phá sổ.

### 2.5 Trạng thái là SỰ THẬT ĐÃ XẢY RA, không phải kết quả tính

Luật phân biệt, hỏi đúng một câu cho mỗi trạng thái: **"có người nào bấm nút để
nó thành thế này không?"**

- **Có** → trạng thái LƯU. `approved`, `ordered`, `received`. Nó là một sự kiện,
  có người, có giờ, có vết.
- **Không** → trạng thái TÍNH, không bao giờ lưu. `overdue`, `late`, `sắp hết
  hạn`. Nó là một phép so sánh giữa dữ liệu và đồng hồ.

**Triệu chứng vi phạm**: xuất hiện một cron job đi sửa trạng thái. Cron đó là cái
giá phải trả, và giữa hai lần chạy thì số trên màn sai.

### 2.6 Mọi chuyển tiếp để lại vết đọc được bằng lời người

**Chép của**: Odoo *chatter* + Dynamics *workflow history*. Hai thứ khác nhau và
cần cả hai: máy ghi mốc (ai bấm gì lúc nào), người ghi lý do (vì sao).

**Cách đo**: sau 3 tháng, mở một đơn bất kỳ đã dời hẹn hai lần, trả lời được **vì
sao dời** mà không phải hỏi ai.

**Triệu chứng vi phạm**: câu trả lời nằm trên Zalo.

### 2.7 Tiền vào sổ ở điểm ĐỐI CHIẾU, không ở điểm nhận hàng

**Chép của**: *three-way match* của SAP MM — đối chiếu **ba** tờ trước khi trả
tiền:

| Tờ           | Nói điều gì               |
| ------------ | ------------------------- |
| Đơn mua      | giá đã **cam kết**        |
| Phiếu nhập   | lượng đã **về thật**      |
| Hoá đơn NCC  | số NCC **đang đòi**       |

**Vì sao ba chứ không hai**: giá trên đơn là cam kết, giá trên hoá đơn là thứ NCC
thật sự đòi. Hai số này lệch nhau là **chuyện thường**, không phải sự cố — tỷ giá
đổi, phụ phí vận chuyển, hàng loại sau kiểm, chiết khấu chốt sau. Đối chiếu hai
chiều (đơn × phiếu nhập) không có chỗ nào chứa phần lệch đó.

**Cách đo**: công nợ NCC có bằng **tổng hoá đơn chưa trả** không? Nếu công nợ
tính từ phiếu nhập thì đang là hai chiều.

**Triệu chứng vi phạm**: kế toán giữ một sổ Excel riêng để đối chiếu hoá đơn, vì
số trong hệ thống không khớp số NCC đòi.

---

## 3. Đo trên HG-ERP hôm nay — sáu lối mòn còn lại

| #   | Lối mòn                                | Bằng chứng trong mã                                                                                          | Vi phạm |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | **Hệ thống tự mâu thuẫn về "từ chối"** | Trong cùng một hàm `decide()`: trạng thái ghi `'draft'`, còn sự kiện bắn ra `decision: 'rejected'`. Đơn mua **không có** `rejected`; Lệnh SX và Báo giá **có** | 2.1     |
| 2   | **Từ chối GHI ĐÈ ghi chú của đơn**     | `note: reason ? '[Từ chối] …' : before.note` — lý do từ chối **thay chỗ** ghi chú người soạn đã viết, không cộng thêm | 2.6     |
| 3   | **Đơn hàng khách không có bước nháp**  | `ORDER_STATUSES` bắt đầu thẳng ở `confirmed`                                                                   | 2.1     |
| 4   | **Trạng thái suy ra bị đóng băng**     | `overdue` nằm trong `INVOICE_STATUSES` — quá hạn là phép so ngày, không phải việc ai bấm                        | 2.5     |
| 5   | **Công nợ NCC đối chiếu hai chiều**    | Công nợ = phiếu nhập có giá − đã trả. Chính mã tự thú bằng `missing_price_count`: *"phát sinh đang đếm hụt"*     | 2.7     |
| 6   | **Hộp thư việc nhốt trong một phòng**  | `supply-watch.ts` chỉ đọc đơn mua. Người kiêm Mua hàng + Kho phải mở hai nơi                                     | 2.2     |

Lối mòn 5 là cái đắt nhất: nó chặn phòng Kế toán khỏi dùng hệ thống thật, vì con
số công nợ **biết là đang thiếu** mà không có chỗ để bù.

Lối mòn 2 là cái dễ sửa nhất và đang **mất dữ liệu thật**: người soạn viết ghi chú
cho đơn, Giám đốc từ chối, ghi chú đó biến mất.

Cần nói cho công bằng — năm thứ HG-ERP đã làm đúng và đừng đụng vào:

- **Chứng từ đảo ở Kho** (1.4) — `reversal_of_doc_id`, đúng nguyên lý.
- **Xoá cứng CHỈ đơn nháp** (1.4) — đúng chuẩn: nháp chưa vào sổ, chưa gửi ai.
  Từ `pending_approval` trở đi thì chặn xoá, chỉ cho huỷ có lý do. Mã ghi rõ lý
  do ngay tại chỗ. Đây không phải lối mòn, đừng "sửa".
- **Người giữ bóng trên đơn mua** (2.3) — `HolderBar` đếm tuổi theo bước hiện tại.
- **Vết trên đơn mua** (2.6) — trao đổi của người trộn chung dòng với mốc máy ghi.
- **Sổ mở theo dòng** — `qty_open` + `closed_short_at`: một dòng đơn không "xong"
  bằng trạng thái, nó xong khi lượng còn mở về 0 **hoặc** được chốt thiếu có lý
  do. Đây đúng là *open-item principle*, nhiều app quản lý không có.

---

## 4. Luồng quyết định giao diện — bảng ánh xạ

Đây là chỗ hai tài liệu nối vào nhau. Chốt xong luồng thì khuôn màn tự rơi ra:

| Tiêu chí luồng           | Đẻ ra màn gì                     | Thành phần kit                     |
| ------------------------ | -------------------------------- | ---------------------------------- |
| 2.1 một từ vựng          | không đẻ màn — đẻ **thư viện**   | `StatusTrack`, `po-status.ts`      |
| 2.2 việc đẩy tới người   | **Khuôn B · Hộp thư**            | `WorkLanes`, chuông trong shell    |
| 2.3 người giữ bóng       | **Khuôn D · Chứng từ**           | `HolderBar`                        |
| 2.4 đường ngoại lệ       | **Khuôn D** — Action Pane chia nhóm | `ActionPane` + nút khoá kèm lý do |
| 2.5 trạng thái tính      | **Khuôn C · Danh sách**          | `Chip` có số đếm, `assessPoLate`   |
| 2.6 vết                  | **Khuôn D** — Trao đổi + Dòng thời gian | `NoteStream`, `Timeline`    |
| 2.7 đối chiếu ba chiều   | **màn CHƯA CÓ: Hoá đơn NCC**     | Khuôn D mới                        |

Đọc theo chiều ngược lại cũng đúng, và đây mới là phần hữu ích: **một khuôn màn
không gắn được với tiêu chí luồng nào thì màn đó chưa có lý do tồn tại.**

---

## 5. Sáu bước thiết kế một luồng mới

Làm đúng thứ tự này. Lối mòn cũ là nhảy thẳng vào bước 6.

1. **Viết câu hỏi nghiệp vụ của từng vai** — "hôm nay tôi phải làm gì", không
   phải "cần màn gì". Mỗi vai một câu.
2. **Vẽ máy trạng thái**: tập trạng thái **đóng**, và với mỗi chuyển tiếp ghi đủ
   bốn thứ — *ai làm được / điều kiện / hệ quả / đường lùi*.
3. **Liệt kê ngoại lệ TRƯỚC**, mỗi ngoại lệ phải nối vào một chuyển tiếp có thật.
   Ngoại lệ không nối được nghĩa là máy trạng thái còn thiếu.
4. **Chốt ai giữ bóng** ở từng trạng thái. Trạng thái không có người giữ là
   trạng thái chết.
5. **Chốt vết**: mỗi chuyển tiếp ghi lại cái gì, và có bắt lý do không.
6. **Bây giờ mới chọn khuôn màn** ở `/design-lab`.

Phép thử của bước 2: **vẽ được máy trạng thái lên một tờ giấy A4 mà không có mũi
tên nào cụt.** Không có trạng thái nào chỉ vào mà không ra được.

---

## 6. Điều KHÔNG nên chép của ERP lớn

Tài liệu này khuyên chép nhiều thứ, nên phải nói rõ chỗ dừng. Bốn thứ SAP và
Dynamics có mà công ty một xưởng chép vào là tự trói:

- **Mã giao dịch và cây tổ chức bốn tầng của SAP.** Chúng sinh ra cho tập đoàn
  nhiều pháp nhân, nhiều quốc gia. Một xưởng không có gì để phân tầng.
- **Kỳ kế toán và khoá sổ.** Chỉ làm khi kế toán **thật sự** chốt sổ theo tháng
  và cần chặn ghi lùi. Làm sớm là mỗi lần sửa số phải xin mở kỳ.
- **Tách ba trục trạng thái** (đơn / tài liệu / duyệt) như Dynamics. Chỉ đáng khi
  "về một phần" thành chuyện thường ngày. Chín trạng thái hiện tại đang đủ.
- **Ma trận uỷ quyền nhiều tầng.** Một tầng duyệt (Giám đốc) là đủ. Cái đang
  thiếu không phải thêm tầng, mà là **Delegate** — Giám đốc đi vắng thì cả phòng
  đứng.

Nguyên tắc chung: **đừng thêm khái niệm cho tới khi đau**. Nhưng cũng đừng nhầm
"chưa đau" với "chưa ai kêu" — lối mòn 4 ở mục 3 không ai kêu, vì kế toán đã âm
thầm mở một sổ Excel riêng.
