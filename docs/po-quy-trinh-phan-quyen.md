# Quy trình đơn đặt vật tư (PO) — sở hữu, phân quyền & phê duyệt

Trạng thái: **ĐÃ TRIỂN KHAI 09/08/2026 theo phương án khuyến nghị §6** (xem
[po-phan-quyen-plan.md](./po-phan-quyen-plan.md) — migration 0128). Mục 3
"lỗ hổng" dưới đây là mô tả HIỆN TRẠNG CŨ trước 0128, giữ lại làm bối cảnh.
Trưởng phòng Cung ứng / Ban Giám đốc muốn điều chỉnh phương án nào trong §6
thì báo IT sửa tiếp.

Code liên quan: `src/modules/dept/supply/pos.service.ts` (nghiệp vụ),
`src/modules/core/rbac/actions.ts` (luật thao tác), `0073_rbac.sql` (seed vai/quyền),
`src/events/handlers/po.notifications.ts` (thông báo).

---

## 1. Nhân sự & vai hiện có trong hệ thống

| Vai trong hệ thống | Ai mang vai này | Quyền liên quan PO hiện tại |
|---|---|---|
| `supply_staff` (NV Cung ứng) | Nhân viên phòng Cung ứng (gán tự động theo phòng) | `supply.member` → được **tạo / sửa / gửi duyệt / dời hẹn / huỷ / xoá nháp** MỌI đơn (`supply.po.manage`) |
| `head` (Trưởng phòng) | `head_user_id` của phòng — tức **Trưởng phòng Cung ứng** | Chỉ có `team.dashboard.view`. **Không có vai trò gì riêng trong luồng PO** — nếu trưởng phòng cũng thuộc phòng Cung ứng thì thao tác bằng quyền `supply.member` như nhân viên |
| `director` (Ban Giám đốc / Quản lý) | Mọi user có `users.role = 'manager'` | `supply.po.approve` → **duyệt / từ chối** đơn chờ duyệt |
| `admin` (IT) | `users.role = 'admin'` | Bypass toàn bộ |
| Các phòng khác (Kho, Kế toán…) | — | `supply.po.view` là PUBLIC → **xem** được mọi đơn (Kho nhận hàng, Kế toán xem phải trả) |

## 2. Hiện trạng luồng PO (as-is)

### 2.1 Chuỗi trạng thái

```
draft ──submit──▶ pending_approval ──approve──▶ approved ──▶ ordered ──▶ confirmed ──▶ in_transit ──▶ partial/received
  │                     │reject                                                              (Kho tự cập nhật khi nhập hàng)
  └─xoá hẳn             ▼
                    cancelled  ◀── huỷ có lý do (mọi trạng thái trước khi nhận hàng)
```

- Đơn tạo ra vào **NHÁP** (0116) — người soạn sửa/xoá tự do, bấm *Gửi duyệt* mới
  tới bàn GĐ và mới notify.
- **BR-05**: chưa duyệt thì không gửi được NCC (`approved → ordered` là chốt chặn).
- Sau duyệt: nội dung (giá, dòng hàng, NCC) **khoá** — chỉ còn *dời hẹn giao* (ghi
  vết lý do) và *huỷ* (kèm lý do).
- Server tự dẫn xuất số lượng/kg theo mẫu đơn (`withDerived`) — client không ghi
  đè được tổng tiền.
- Quyết định duyệt/từ chối được **audit** (`approval_events`) + notify người tạo.

### 2.2 Ma trận quyền thực tế hiện nay

| Thao tác | NV Cung ứng A | NV Cung ứng B | Trưởng phòng CƯ | Giám đốc | Admin |
|---|---|---|---|---|---|
| Xem đơn của A | ✔ | ✔ | ✔ | ✔ | ✔ |
| Sửa **nháp** của A | ✔ | **✔ (lỗ hổng)** | ✔ (qua `supply.member`) | ✖ (trừ khi kiêm NV CƯ) | ✔ |
| **Xoá hẳn nháp** của A | ✔ | **✔ (lỗ hổng)** | ✔ | ✖ | ✔ |
| Gửi duyệt đơn của A | ✔ | **✔ (lỗ hổng)** | ✔ | ✖ | ✔ |
| Sửa đơn **chờ duyệt** của A | ✔ | **✔ (lỗ hổng)** | ✔ | ✖ | ✔ |
| Duyệt / từ chối | ✖ | ✖ | ✖ | ✔ | ✔ |
| Gửi NCC / xác nhận / đang giao | ✔ | ✔ | ✔ | ✖ | ✔ |
| Dời hẹn giao, huỷ | ✔ | ✔ | ✔ | ✖ | ✔ |

`created_by` **có lưu** từ ngày đầu nhưng chỉ dùng để notify khi GĐ duyệt/từ chối
— **không dùng để chặn quyền** ở bất kỳ đâu.

## 3. Phân tích lỗ hổng

- **G1 — Không tách theo người tạo.** NV B mở nháp của NV A: sửa dòng hàng, đổi
  NCC, xoá hẳn, hoặc bấm gửi duyệt thay — hệ thống cho hết. Hai người cùng theo
  hai NCC khác nhau có thể giẫm chân nhau mà không ai hay (xoá nháp thì mất
  không vết — chỉ duyệt/từ chối mới có audit).
- **G2 — Trưởng phòng Cung ứng vô hình trong quy trình.** Đơn của NV đi **thẳng
  lên Giám đốc**; trưởng phòng không có bước soát, không có quyền chính danh nào
  khác nhân viên. Thực tế trưởng phòng thường là người nắm giá và NCC — bỏ qua
  bước này thì GĐ phải soát chi tiết từng đơn.
- **G3 — Thông báo gửi duyệt bắn cho MỌI manager toàn công ty** (lọc theo
  `role ∈ {admin, manager}`), không theo quyền `supply.po.approve`. GĐ phụ trách
  mảng khác cũng nhận thông báo PO.
- **G4 — Đơn "chờ duyệt" vẫn sửa được nội dung mà không ghi vết, không báo lại
  GĐ.** GĐ nhận thông báo lúc 9h với tổng 100 triệu; 9h05 người soạn (hoặc bất kỳ
  NV nào — do G1) sửa thành 300 triệu; GĐ bấm duyệt theo trí nhớ thông báo cũ.
- **G5 — Chỉ audit bước duyệt.** Tạo/sửa/xoá/gửi NCC không có nhật ký — không
  truy được "ai đổi giá dòng này hôm qua".

## 4. Quy trình đề xuất (to-be)

Nguyên tắc: **nháp là của cá nhân, đơn đã gửi là của phòng, đơn đã duyệt là cam
kết của công ty.** Càng đi xa trong chuỗi trạng thái, số người được đụng càng hẹp
và mọi thay đổi càng phải ghi vết.

### 4.1 Vai & trách nhiệm (RACI rút gọn)

| Bước | NV Cung ứng (người tạo) | Trưởng phòng CƯ | Giám đốc | Kho |
|---|---|---|---|---|
| Soạn nháp | **R** | C (được sửa thay khi cần) | — | — |
| Gửi duyệt | **R** | A (nắm được đơn nào đang lên GĐ) | I (nhận thông báo) | — |
| Duyệt / từ chối | I (nhận kết quả) | I | **A/R** | — |
| Gửi NCC, theo dõi giao | **R** | A (thay khi NV vắng) | — | I |
| Dời hẹn / huỷ | **R** (kèm lý do) | **R** (thay khi cần) | R (được phép) | I |
| Nhận hàng (partial/received) | I | I | — | **R** |

### 4.2 Ma trận quyền đề xuất

| Thao tác | Người tạo | NV CƯ khác | Trưởng phòng CƯ | Giám đốc | Admin |
|---|---|---|---|---|---|
| Xem | ✔ | ✔ | ✔ | ✔ | ✔ |
| Sửa / xoá / gửi duyệt **nháp** | ✔ | ✖ | ✔ | ✖ | ✔ |
| Sửa đơn **chờ duyệt** | ✔ *(ghi vết + notify lại GĐ)* | ✖ | ✔ *(ghi vết)* | ✖ | ✔ |
| Duyệt / từ chối | ✖ | ✖ | ✖ *(trừ khi được cấp quyền)* | ✔ | ✔ |
| Gửi NCC → xác nhận → đang giao | ✔ | ✖ | ✔ | ✖ | ✔ |
| Dời hẹn giao / huỷ (kèm lý do) | ✔ | ✖ | ✔ | ✔ | ✔ |
| **Bàn giao đơn** (đổi người phụ trách) | ✖ | ✖ | ✔ | ✔ | ✔ |

Điểm mới so với hiện trạng:

1. **Khoá theo người tạo** ở mọi thao tác ghi — NV khác chỉ XEM. Không chặn
   "cả phòng cùng xem" (Kho, Kế toán vẫn xem như cũ).
2. **Trưởng phòng Cung ứng thành vai chính danh**: sửa/thao tác được mọi đơn
   trong phòng (để đỡ việc khi NV vắng), là người **bàn giao** đơn khi NV nghỉ
   việc/nghỉ phép (đổi người phụ trách, có ghi vết) — thay cho việc "ai cũng sửa
   được" như nay.
3. **Sửa đơn chờ duyệt → tự động notify lại người duyệt** kèm đánh dấu "đã sửa
   sau khi gửi" (vá G4). Phương án mạnh hơn — sửa là kéo về nháp, phải gửi duyệt
   lại — đưa vào câu hỏi chốt §6.2.
4. **Thông báo gửi duyệt chỉ bắn cho người có quyền `supply.po.approve`** thay vì
   mọi manager (vá G3).
5. **Audit vòng đời PO**: ghi `approval_events` (hoặc bảng audit riêng) cho các
   mốc tạo / sửa-khi-chờ-duyệt / gửi duyệt / gửi NCC / dời hẹn / huỷ / bàn giao —
   tối thiểu là các mốc từ "gửi duyệt" trở đi (vá G5, mức độ chốt ở §6.5).

### 4.3 Tình huống vận hành cần lời giải sẵn

- **NV tạo đơn rồi nghỉ phép, hàng cần gửi NCC gấp** → Trưởng phòng thao tác
  thay (quyền sẵn có) hoặc bàn giao đơn cho NV khác — không cần nhờ admin.
- **NV nghỉ việc** → Trưởng phòng bàn giao một loạt đơn đang mở sang NV mới;
  lịch sử vẫn ghi ai tạo, ai đang phụ trách.
- **GĐ từ chối đơn** → hiện tại đơn thành `cancelled`, NV phải tạo lại từ đầu.
  Đề xuất: từ chối trả đơn về **NHÁP** kèm lý do để sửa và gửi lại (giữ số PO,
  giữ lịch sử) — chốt ở §6.3.

## 5. Việc kỹ thuật tương ứng (làm sau khi chốt §6)

1. **Quyền mới** `supply.lead` (permission) gán cho vai Trưởng phòng CƯ — hoặc
   tái dùng vai `head` + kiểm tra phòng. Khuyến nghị permission riêng: trưởng
   phòng có thể uỷ quyền cho phó phòng mà không đụng `head_user_id`.
2. **Service** `pos.service.ts`: các method `update/remove/submit/advance/
   reschedule/cancel` thêm kiểm tra row-level `created_by === user.id` (hoặc có
   `supply.lead` / admin). RBAC registry đã ghi chú sẵn chỗ cho điều kiện
   row-level — đúng pattern hiện dùng ở sales (chủ khách hàng).
3. **Bàn giao đơn**: thêm cột `assigned_to` (mặc định = `created_by`, đơn cũ
   backfill) + endpoint đổi người phụ trách (chỉ lead/GĐ/admin) + ghi vết. Khoá
   quyền theo `assigned_to` thay vì `created_by` để bàn giao xong người mới làm
   tiếp được.
4. **Notify**: `submit()` lọc người nhận theo `canAction(u, 'supply.po.approve')`
   thay vì `role ∈ {admin, manager}`; sửa-khi-chờ-duyệt emit `po.updated` → notify
   lại người duyệt.
5. **Audit**: mở rộng `approval_events` (đã có sẵn cho po/lsx decided) ghi thêm
   các mốc §4.2-5.
6. **UI** `/supply/pos`: thêm cột *Người phụ trách*, bộ lọc *Đơn của tôi*, ẩn nút
   sửa/xoá theo cờ `canEdit` trả từ server (đúng pattern hồ sơ SP dùng chung).

Không cần migration phá vỡ gì: `created_by` đã lưu từ đơn đầu tiên nên luật mới
áp được cho toàn bộ đơn cũ; chỉ thêm cột `assigned_to` + backfill.

## 6. Câu hỏi cần CHỐT — Trưởng phòng Cung ứng & Ban Giám đốc

| # | Câu hỏi | Phương án khuyến nghị |
|---|---|---|
| 6.1 | Khoá theo người tạo ở **mức nào**? (a) chỉ khoá nháp, từ chờ-duyệt trở đi cả phòng thao tác được như cũ; (b) khoá toàn bộ vòng đời như §4.2 | **(b)** — kèm quyền trưởng phòng + bàn giao thì không vướng khi vắng người |
| 6.2 | Đơn **chờ duyệt** bị sửa thì: (a) cho sửa + notify lại GĐ; (b) sửa là tự kéo về NHÁP, gửi duyệt lại từ đầu | **(b)** an toàn hơn cho GĐ — con số GĐ thấy luôn là con số cuối |
| 6.3 | GĐ **từ chối**: (a) huỷ hẳn như nay; (b) trả về NHÁP kèm lý do để sửa gửi lại | **(b)** |
| 6.4 | Có thêm **bước duyệt sơ bộ của Trưởng phòng CƯ** trước khi lên GĐ không (2 cấp duyệt)? Hoặc chỉ đơn vượt ngưỡng giá trị X mới cần GĐ, dưới ngưỡng trưởng phòng duyệt luôn? | Bắt đầu **1 cấp như nay** (GĐ duyệt hết); nếu số đơn/ngày tăng thì thêm ngưỡng giá trị sau — schema không đổi |
| 6.5 | Audit đến mức nào: (a) chỉ các mốc trạng thái; (b) cả nội dung sửa (trước/sau từng lần sửa nháp) | **(a)** trước — (b) nhiều dữ liệu, làm khi có nhu cầu truy vết thật |
| 6.6 | Ai giữ quyền `supply.lead` ngoài Trưởng phòng CƯ (phó phòng? người được uỷ quyền khi trưởng phòng vắng)? | Danh sách do Trưởng phòng CƯ đề xuất, admin gán qua `/admin/permissions` |

---

*Sau khi hai anh/chị chốt bảng §6, cập nhật cột "Phương án khuyến nghị" thành
"ĐÃ CHỐT" kèm ngày, rồi mới bắt tay sửa code theo checklist §5.*
