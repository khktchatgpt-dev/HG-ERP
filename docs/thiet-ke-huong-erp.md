# Thiết kế theo hướng ERP — HG-ERP đang ở đâu

Đối chiếu hệ thống với SAP Fiori, Odoo, Dynamics 365, NetSuite, Zoho.
Nguồn: `~/.hermes/skills/creative/erp-ui-design/references/flow-patterns.md`
(14 mẫu, ~45 nguồn tài liệu chính thức). Đo trên mã nguồn + DB thật 09/09/2026.

---

## Khác biệt gốc: web là NƠI ĐẾN, ERP là NƠI LÀM VIỆC

| | Web/SaaS | ERP nội bộ |
|---|---|---|
| Người dùng | khách lạ, phải thuyết phục | nhân viên, 8 tiếng/ngày, 5 màn quen |
| Tối ưu cho | lần dùng **đầu tiên** | lần dùng **thứ 500** |
| Điều hướng | khám phá, menu đẹp | trí nhớ vị trí, phím tắt |
| Một màn | một thông điệp | một **câu hỏi nghiệp vụ** |
| Dữ liệu | minh hoạ | **là nhân vật chính** |
| Chứng từ | không có | đi qua tay nhiều phòng |

Sai lầm thường gặp không nằm ở màu sắc hay bố cục. Nó nằm ở chỗ **web thiết kế
cho MỘT người dùng, ERP thiết kế cho MỘT DÂY CHUYỀN người**. Một đơn đặt hàng
đi Cung ứng → Giám đốc → NCC → Kho. Màn hình nào không nói được "giờ đến lượt
ai" thì đẹp mấy cũng không dùng được.

---

## Ba trục mà mọi ERP lớn đều có

### Trục 1 — CHỨNG TỪ tự kể chuyện đời nó

Mọi ERP lớn đặt ba thứ ngay trên đầu chứng từ, trước mọi bảng số:

| Thứ | SAP | Odoo | Dynamics |
|---|---|---|---|
| Đang ở bước nào | object page header | statusbar bấm được | Business Process Flow |
| Ai giữ / việc gì | My Inbox | Next Activity | centralized work list |
| Đã có chuyện gì | (thiếu — SAP không có) | **chatter** | timeline |

Điểm đáng học nhất là **chatter của Odoo**: tin nhắn + ghi chú + người theo dõi
+ việc hẹn lịch, tất cả nằm ngay dưới chứng từ. Nó biến chứng từ thành nơi trao
đổi, thay vì mọi người nhắn Zalo rồi hệ thống không biết gì.

Dynamics chia **ba trường trạng thái độc lập** (Purchase order status / Document
status / Approval status) với lý do ghi rõ trong tài liệu: *một thanh tuyến tính
không diễn tả nổi tình trạng về hàng một phần*. HG-ERP đang gộp cả ba vào một
enum 9 giá trị — chỗ này sẽ gãy khi đơn về một phần mà vẫn đang chờ sửa giá.

### Trục 2 — VIỆC được ĐẨY tới người, không để người đi TÌM

SAP My Inbox, Dynamics centralized work list, Odoo systray activity menu — cả ba
đều là **một chỗ duy nhất, xuyên mọi loại chứng từ**, trả lời "hôm nay tôi phải
làm gì".

Hai chi tiết SAP làm mà đáng chép:
1. **Dòng trong hộp thư tự nói ra quyết định cần ra** — `Approve: <tên việc>`,
   không phải chỉ hiện mã chứng từ.
2. **Hộp thư dẫn ngược về ngữ cảnh** — bấm vào là thấy chứng từ gốc, không phải
   quyết định trong chân không.

Odoo chia việc thành **Trễ / Hôm nay / Sắp tới** — ba nhóm này là ba thái độ
khác nhau, gộp lại thành một danh sách là mất thông tin.

### Trục 3 — TRANG CHỦ là cửa vào việc, không phải bảng biểu đồ

SAP Fiori launchpad: mỗi ô là một ứng dụng **kèm số việc đang chờ**, lọc theo
vai trò. Tài liệu SAP nói thẳng: *"chỉ đưa vào những gì người dùng cần để bắt
đầu ngày làm việc"*.

NetSuite gọi là **Center** — bộ trang đổi theo vai trò, mỗi trang là dashboard
gồm các portlet, trong đó có **Reminders** đếm việc quá hạn.

Nguyên tắc chung: **con số trên ô là một lời hứa** — bấm vào phải ra đúng chừng
ấy dòng cần xử lý. Sai một dòng là hỏng niềm tin vào toàn bộ trang chủ.

---

## HG-ERP đang ở đâu — đo trên mã nguồn

### Đã có, và làm đúng

| Thứ | Bằng chứng |
|---|---|
| Thanh bậc trên chứng từ | `PoDetailScreen.tsx` — 8 bước |
| Badge số việc sống trên menu | `nav-badges.ts` — "Chờ tôi xử lý", "Hàng sắp về" |
| Trang chủ theo vai trò | `planning/page.tsx` — 6 thẻ vào việc |
| Chuỗi chứng từ | `RefChain` — Đơn khách › LSX › PO |
| Dòng thời gian | tab trên chi tiết đơn |
| Sửa tại chỗ | `InspectPanel` — 3 màn |
| Từ chối bắt buộc kèm lý do | `pos.schema.ts` — ngang chuẩn Zoho |

Đặc biệt đúng: `nav-badges.ts` có ghi chú *"badge nói 5 mà mở ra thấy 7 là hỏng
niềm tin vào cả sidebar — đếm bằng đúng hàm mà trang dùng"*. Đó chính là nguyên
tắc "con số là lời hứa" của SAP, tự nghĩ ra chứ không chép.

### Bốn lỗ hổng thật

**1. Hộp thư việc bị nhốt trong một phòng.**
`countMyTodos` chỉ đếm PO có `assigned_to = tôi`. Người vừa lo mua hàng vừa lo
kho phải mở hai khu, tự nhớ mình còn nợ gì bên kia. SAP/Dynamics/Odoo đều làm
hộp thư **xuyên mọi loại chứng từ**.

**2. Không có nơi trao đổi trên chứng từ.**
Có dòng thời gian (máy ghi), không có chatter (người viết). Thực tế: mọi trao
đổi "sao đơn này chưa duyệt" diễn ra trên Zalo, và khi cần tra lại thì không ai
tìm ra. Đây là khoảng cách lớn nhất so với Odoo.

**3. Chỉ có duyệt/từ chối.**
Dynamics có thêm **Request change** (trả về người soạn mà KHÔNG kết thúc luồng)
và **Delegate** (người duyệt đi vắng không chặn cả phòng). Từ chối phá sạch
trạng thái luồng — người soạn phải làm lại từ đầu.

**4. Không ai biết đơn đang kẹt.**
Đo thật: **66/68 đơn nằm im 5–7 ngày**. Hệ thống không hề báo. Cần một ngưỡng
tuổi thọ + nơi hiện ra.

---

## Đề xuất, xếp theo tỉ lệ lợi ích trên công sức

| Ưu tiên | Việc | Vì sao |
|---|---|---|
| 1 | **Chatter trên chứng từ** — ghi chú + người theo dõi | Kéo trao đổi từ Zalo về hệ thống. Khoảng cách lớn nhất |
| 2 | **Hộp thư việc xuyên phòng** — gộp PO + LSX + phiếu kho, chia Trễ/Hôm nay/Sắp tới | Người kiêm nhiệm hết phải nhớ thủ công |
| 3 | **Request change + Delegate** | Nghiệp vụ, cần bạn quyết |
| 4 | **Cảnh báo đơn nằm im** ≥3 ngày, hiện trên trang chủ | 66/68 đơn đang kẹt mà không ai biết |
| 5 | Tách trạng thái tài liệu / duyệt / nhận hàng | Chỉ cần khi đơn về một phần trở nên phổ biến |

Ba việc đầu là **thay đổi nghiệp vụ**, không phải đổi giao diện — cần bạn quyết
trước khi làm.

---

## Điều KHÔNG nên chép

- **Đừng chép hình thức SAP.** Fiori dựng cho hàng nghìn người dùng qua nhiều
  quốc gia; công ty một xưởng không cần lớp trừu tượng đó.
- **Đừng làm dashboard biểu đồ ở trang chủ.** Biểu đồ trả lời "tháng này thế
  nào"; người mua hàng hỏi "hôm nay tôi phải làm gì".
- **Đừng thêm trạng thái cho tới khi đau.** 9 trạng thái đang đủ. Dynamics tách
  ba trục vì họ có hàng chục nghìn khách với đủ kiểu quy trình.
