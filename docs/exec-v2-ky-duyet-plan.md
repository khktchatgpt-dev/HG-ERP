# Khu Ban Giám đốc v2 — đập bỏ, xây lại quanh việc KÝ

Trạng thái: **BẢN THẢO chờ chốt** (14/08/2026). Thay thế
[exec-gd-sale-cung-ung-plan.md](exec-gd-sale-cung-ung-plan.md) (09/08/2026) — bản
cũ thiết kế khu GĐ như một *bảng tin nhiều thẻ*; bản này thu về **một việc duy
nhất: ký phiếu**.

## 0. Đầu vào chủ dự án chốt (14/08/2026)

| Câu | Chốt |
|---|---|
| Phạm vi | **Sale + Cung ứng** (giữ nguyên chốt 09/08, không mở sang xưởng/kho/nhân sự) |
| Giám đốc vào hệ thống để làm gì | **Duyệt phiếu** (LSX, đơn mua, báo giá) — *chỉ* việc này |
| Thiết bị | **Cả máy tính lẫn điện thoại** |
| Dữ liệu đang trống | **Vá dữ liệu trước, xong mới xây** |

Câu trả lời thứ 2 là câu đổi toàn bộ thiết kế: ba lựa chọn còn lại (tiền vào/ra &
lãi lỗ theo lệnh, tiến độ giao hàng, hiệu suất phòng ban) **không được chọn**.
Nghĩa là phần lớn khu `/exec` hiện tại đang phục vụ việc mà Giám đốc nói mình
không làm.

---

## 1. Ba sự thật phải nhìn thẳng trước khi vẽ

### 1.1 Dữ liệu thật gần như trống (đo trong DB ngày 14/08/2026)

| Bảng | Số dòng | Hệ quả |
|---|---|---|
| `sales_orders` | 20 | dùng được |
| `sales_order_lines` | 71 — **71 dòng chưa có đơn giá** | mọi con số tiền của vế BÁN = 0 |
| `supply_purchase_orders` | **0** | vế MUA trắng hoàn toàn; **chưa từng có phiếu mua nào để ký** |
| `sales_order_shipments` | 0 | không có tiến độ giao |
| `production_entries` | 0 | xưởng chưa lên hệ thống |
| `approval_events` | 2 | cả lịch sử ký của công ty đúng 2 sự kiện |
| `sales_quotes` | 6 (8 dòng) | có, nhưng **chưa có luồng duyệt** |

Sale + Cung ứng hoàn thiện về **tính năng**, chưa hoàn thiện về **dữ liệu**. Khu
GĐ ăn số từ đúng hai nguồn này.

### 1.2 Vai `director` có 0 người — Giám đốc đang dùng vai `admin`

| Vai | Số người | Quyền |
|---|---|---|
| `director` | **0** | 23 quyền, đúng gu GĐ (duyệt + xem chéo 5 workspace, không có quyền quản trị) |
| `admin` | 3 | 35 quyền, **có cả `system.users.manage`, `system.rbac.manage`, `system.settings.manage`** |

Tài khoản `dir1@hoanggia.de` ("Điền Hg", phòng Ban Giám Đốc) đang mang vai
`admin` + `head`. Tức Giám đốc hiện đăng nhập bằng chìa khoá của IT: ký được,
nhưng đồng thời sửa được phân quyền và cấu hình hệ thống. Vai `director` đã dựng
sẵn từ lâu mà chưa gán cho ai.

**Đây là hạng mục số 0**, không phải chuyện phụ: mọi màn `/exec` bên dưới đều
gác theo `exec.approvals.view`, và nếu GĐ vẫn dùng vai admin thì không ai kiểm
chứng được thiết kế phân quyền có đúng không.

### 1.3 Khu `/exec` hiện tại: 5.463 dòng, hơn một phần ba là màn GĐ không dùng

| Màn | Dòng | Số thật hôm nay | Phán quyết |
|---|---|---|---|
| `ApprovalCockpit.tsx` + `approval-parts` + `ApprovalDetailScreen` | 1.879 | lõi, chạy được | **Giữ lõi, tách & làm lại vỏ** |
| `approvals/page.tsx` + `data.ts` + manager | 428 | chạy được | **Làm lại tầng nạp** (xem §5C) |
| `ExecDashboard.tsx` (bảng tin) | 347 | quá nửa thẻ ra 0 | **Bỏ** — thay bằng Hộp ký |
| `orders/OrdersOverview.tsx` + parts | 986 | 20 đơn, **0 tiền** | **Bỏ khỏi khu GĐ** (§5J) |
| `purchasing/PurchasingOverview.tsx` | 265 | **0 đơn mua** → trắng | **Bỏ khỏi khu GĐ** |
| `ops/OpsTower.tsx` | 306 | xưởng 0 tuyệt đối | **Xoá** (đã gỡ khỏi menu từ 09/08) |
| `production/ProductionPipeline.tsx` | 371 | 8 lệnh kẹt, tiến độ cứng | **Xoá** (đã gỡ khỏi menu) |
| `approvals/history/*` | 220 | 2 sự kiện | **Giữ, mở rộng** |

Tổng phần đề nghị bỏ/xoá: **~2.275 dòng**.

---

## 2. Nguyên tắc thiết kế v2

1. **Giám đốc chỉ có một việc: ký.** Trang chủ `/exec` không phải bảng tin — nó
   là *hộp phiếu chờ tôi ký*. Không có phiếu nào chờ thì màn hình nói "sạch",
   không cố lấp bằng biểu đồ.
2. **Ký trên điện thoại trong 30 giây; thẩm định sâu trên máy tính.** Không phải
   "responsive cho đẹp" — hai bố cục khác nhau cho hai tình huống khác nhau:
   đang đi đường ký phiếu đã tin tưởng ↔ ngồi bàn soi từng dòng vật tư.
3. **Không phiếu nào chờ trong im lặng.** Mỗi phiếu hiện rõ *đã chờ bao lâu*, và
   quá ngưỡng thì hệ thống nhắc — chứ không đợi Cung ứng gọi điện.
4. **Ô trống phải nói lý do.** Chưa có số thì ghi "chưa có đơn mua nào được lập",
   không hiện số 0 để GĐ tưởng công ty không mua gì.
5. **Mỗi chữ ký để lại bằng chứng.** Ai ký, lúc nào, phiếu trị giá bao nhiêu, lý
   do từ chối là gì — tra lại được sau 6 tháng.

---

## 3. Điều hướng mới

| # | Mục | Route | Thay cho |
|---|---|---|---|
| 1 | **Hộp ký** | `/exec` | Bảng tin điều hành (`ExecDashboard`) |
| 2 | **Phiếu đang xem** | `/exec/phieu/[loai]/[id]` | `/exec/approvals/{lsx,po}/[id]` |
| 3 | **Lịch sử ký** | `/exec/lich-su` | `/exec/approvals/history` |
| 4 | **Luật ký** *(tuỳ chọn)* | `/exec/luat-ky` | — (mới, §5F) |

Gỡ khỏi khu GĐ: `/exec/orders`, `/exec/purchasing`, `/exec/ops`,
`/exec/production`, `/exec/tracking`, `/exec/lsx`.

`/exec/approvals` giữ làm redirect về `/exec` để link cũ trong thông báo không
gãy (thêm cặp vào `MOVED_PREFIXES` trong `src/proxy.ts` — chạy trước gate đăng
nhập, xem CLAUDE.md).

---

## 4. Hộp ký `/exec` — bố cục

```
┌ HỘP KÝ ─────────────────────────────── [Tất cả] [Lệnh SX] [Đơn mua] [Báo giá] ┐
│                                                                               │
│  ⬤ 5 phiếu chờ bạn ký · lâu nhất 4 ngày · tổng 128 triệu                      │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ ĐƠN MUA  PO-2608-014        Gỗ Tân Phát        38,4 tr    ⏱ 4 ngày   │   │
│  │ 12 vật tư · lệnh LSX-260812 · hàng về 25/08 · lập bởi Lệ Hằng         │   │
│  │ ⚠ 3 vật tư chưa có giá tham chiếu           [Xem kỹ]  [Ký]  [Trả lại] │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ LỆNH SX  LSX-260814          Kunststoff       210,0 tr    ⏱ 1 ngày   │   │
│  │ 3 đơn · 18 SP · giao 12/09 · ⚠ 4 SP chưa chốt BOM                     │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  Đã ký hôm nay: 2 phiếu · 45 tr                              → Lịch sử ký     │
└───────────────────────────────────────────────────────────────────────────────┘
```

Điểm khác cốt lõi so với bảng tin cũ: **mỗi thẻ là một phiếu ký được ngay tại
chỗ**, không phải con số dẫn sang màn khác. "Xem kỹ" mới mở buồng lái thẩm định.

Trên điện thoại: mỗi phiếu một thẻ dọc, nút **Ký** / **Trả lại** to bằng ngón
tay cái ở đáy thẻ, vuốt xuống để tải lại.

---

## 5. Hạng mục

### A. Vai người ký — tách Giám đốc khỏi `admin` ⭐ làm trước

> **Trạng thái 14/08/2026: CHỜ NGƯỜI CÓ QUYỀN BẤM.** Việc này phải làm bằng
> giao diện `/admin/permissions/people` (hoặc `/admin/users`), không nên sửa
> thẳng DB — đi qua giao diện thì `rbac_audit_log` mới ghi đúng *ai* đã đổi.
> Ba thao tác, một tài khoản admin còn lại (`it@hoanggia.de` hoặc `admin@hg.com`)
> làm được trong 2 phút:
>
> 1. `/admin/permissions/people` → Điền Hg → **thêm vai `director`**.
> 2. Cùng màn đó → **gỡ vai `admin`**. (Giữ `head` — GĐ là trưởng phòng Ban GĐ.)
> 3. `/admin/users` → Điền Hg → đổi **Vai hệ thống: Quản trị → Quản lý**.
>
> Bước 3 dễ bị bỏ sót nhưng bắt buộc: `canEnterWorkspaceSync` mở cửa **mọi**
> workspace cho `users.role === 'admin'` bất kể RBAC, nên chỉ gỡ vai `admin` mà
> quên hạ trường này thì GĐ vẫn vào được `/admin`. Sau khi đổi, GĐ **không cần
> đăng nhập lại** — JWT chỉ mang `sub/email/pv`, vai đọc từ DB mỗi request.
>
> Sau khi làm, kiểm chứng: đăng nhập bằng tài khoản GĐ → vào được `/exec`,
> `/sales`, `/planning`; vào `/admin` phải bị chặn.

- Gán vai `director` cho `dir1@hoanggia.de`, gỡ `admin`.
- Rà 23 quyền của `director` xem có thiếu gì so với việc GĐ thực làm (đặc biệt
  `workspace.view.*` để GĐ mở chéo được màn của Sale/Cung ứng khi soi phiếu).
- Xác định **ai ký thay khi GĐ vắng** — hiện chỉ 3 tài khoản admin ký được, và
  cả 3 đều không phải người thứ hai của Ban GĐ.
- *Không cần code, chỉ thao tác trên `/admin/permissions` + kiểm chứng.*
  **½ buổi.**

### B. Hộp ký `/exec`

> **Trạng thái 14/08/2026: XONG** (trừ báo giá — chờ §5E). `/exec` giờ là Hộp ký;
> mục *Phê duyệt* đã rút khỏi menu (Hộp ký làm đúng việc đó ở trang chủ, để hai
> danh sách cạnh nhau thì không ai biết chỗ nào là chỗ đúng). Route
> `/exec/approvals/{lsx,po}/[id]` vẫn là màn "Xem kỹ" cho tới bước 4.
>
> Màn rỗng phân biệt hai chuyện cùng ra "0 phiếu": **đã ký hết** ↔ **chưa ai từng
> lập phiếu**. Hôm nay nó hiện đúng vế thứ hai: *"đơn mua chưa có đơn nào trên hệ
> thống (8 lệnh sản xuất đã có) — phòng Cung ứng còn đang làm ngoài Excel"*.
> Không có câu đó thì màn hình rỗng nói dối rằng Giám đốc đã ký hết việc.

- Trang chủ mới thay `ExecDashboard`: danh sách phiếu chờ, gộp 3 loại, xếp theo
  *chờ lâu nhất* rồi *giá trị lớn nhất*.
- Chip lọc theo loại; đếm số ngay trên chip.
- Ký / trả lại ngay trên thẻ (không bắt mở chi tiết) — có ô lý do bắt buộc khi
  trả lại.
- Dải "đã ký hôm nay" để GĐ biết mình vừa làm gì.
- Nguồn: `posService.list(pending)`, `lsxService.list(pending)` — đã có.
  **1,5 buổi.**

### C. Buồng lái thẩm định — giữ lõi, làm lại tầng nạp

> **Trạng thái 14/08/2026: XONG.** Kết cục khác dự kiến một chút — sau khi Hộp ký
> nhận vai danh sách, buồng lái master-detail không còn gì để làm, nên **xoá hẳn**
> thay vì tách file: `ApprovalCockpit.tsx` (1.000 dòng), `ApprovalsManager.tsx`
> (87), và `approvals/page.tsx` bản nạp nặng (183) — tổng **1.270 dòng**.
> `/exec/approvals` giờ redirect về `/exec`; chi tiết từng phiếu vẫn ở
> `/exec/approvals/{lsx,po}/[id]` (`ApprovalDetailScreen`, bố cục 2 cột, không
> đụng tới).
>
> **Ký hàng loạt được CHUYỂN chứ không mất**: chọn nhiều phiếu ngay trên Hộp ký →
> ký một lượt, gọi tuần tự từng phiếu, phiếu nào lỗi thì báo riêng và nằm lại
> trong hộp — một phiếu hỏng không xoá chữ ký của những phiếu trước nó.
>
> **Vá kèm một lỗi tiền tệ**: ngưỡng "giá trị lớn" là 50 triệu ĐỒNG nhưng bản cũ
> so thẳng `total >= 50_000_000` bất kể tiền tệ, nên một đơn **3.000 USD (~75
> triệu đồng) lọt qua như đơn nhỏ và được ký nhanh hàng loạt** — đúng loại đơn mà
> ngưỡng sinh ra để chặn. Chưa có tỉ giá trong hệ thống nên không quy đổi; chọn
> cách an toàn: tiền tệ khác VND luôn coi là giá trị lớn, phải mở ra ký riêng
> (`isBigApprovalIn`). §5F sẽ thay bằng ngưỡng theo từng tiền tệ.
>
> Lệnh SX thì **không bao giờ** mang cờ giá trị lớn dù số tiền to: ngưỡng đó canh
> CAM KẾT CHI TIỀN (đơn mua). Tiền của lệnh sản xuất là doanh thu sắp thu về, ký
> lệnh không tiêu đồng nào — gắn cờ vào đây thì mọi lệnh đều đỏ và cái cờ mất
> nghĩa.

`ApprovalCockpit.tsx` (1.000 dòng) là phần tốt nhất của khu GĐ hiện tại: bảng
phân tích riêng theo loại phiếu, cảnh báo thiếu giá, trạng thái BOM. **Không đập
phần này** — đập là mất công vô ích. Việc cần làm:

- **Sửa cách nạp dữ liệu.** `approvals/page.tsx` hiện nạp *đầy đủ* mọi phiếu chờ
  ngay từ server: mỗi PO một truy vấn `listLines`, mỗi LSX **bốn** truy vấn, cộng
  ký URL ảnh cho toàn bộ sản phẩm. 5 phiếu = ~25 truy vấn trước khi trang hiện
  chữ đầu tiên. Chuyển sang: danh sách nạp nhẹ, chi tiết nạp khi bấm "Xem kỹ".
- Tách 1.000 dòng thành: khung + bảng phân tích PO + bảng phân tích LSX.
- Bỏ cột trái (master list) — vai trò đó giờ là Hộp ký. Buồng lái thành *trang
  của một phiếu*.
  **2 buổi.**

### D. Ký trên điện thoại

- Bố cục riêng dưới `sm`: thẻ dọc, nút ký cố định đáy màn hình, không bảng ngang.
- Bảng vật tư/sản phẩm trên điện thoại đổi thành danh sách dòng gấp gọn, mở từng
  dòng xem chi tiết.
- Xác nhận ký bằng thao tác 2 nhịp (tránh chạm nhầm khi cầm một tay), phiếu
  **giá trị lớn** thì bắt gõ xác nhận.
  **1,5 buổi.**

### E. Duyệt BÁO GIÁ — hạng mục hoàn toàn mới

Hiện `sales_quotes.status` chỉ có `draft | sent` — **không có luồng duyệt nào**.
GĐ muốn ký báo giá thì phải dựng mới:

- Migration: thêm trạng thái `pending_approval | approved | rejected`, cột
  `submitted_at / approved_at / approved_by / reject_reason`.
- `approvals.repo`: mở `ApprovalEntityType` từ `'po' | 'lsx'` thành thêm
  `'quote'`.
- Service: `submit()` / `decide()` + event `quote.submitted` / `quote.decided`
  (đi qua event bus như `po.notifications.ts`, không gọi chéo service).
- UI: bên Sale có nút "Trình duyệt"; bên GĐ báo giá vào chung Hộp ký.
- Bảng phân tích báo giá cho GĐ: giá bán vs giá vốn ước tính (nếu có định mức),
  biên thô, so với báo giá gần nhất của cùng khách.
  **2,5 buổi** (1 migration + service + 2 màn).

> ⚠️ Cần chốt trước: **báo giá nào phải qua GĐ?** Bắt mọi báo giá đi qua sẽ biến
> Sale thành cổ chai. Khuyến nghị: chỉ báo giá vượt ngưỡng tiền, hoặc có giảm giá
> quá X%.

### F. Luật ký theo ngưỡng tiền

- Ngưỡng "giá trị lớn" hiện **cứng 50 triệu** trong `src/lib/exec-ops.ts:10`.
  Đưa vào `settings` để đổi không cần lập trình viên.
- Luật: dưới ngưỡng → trưởng phòng ký; trên ngưỡng → GĐ ký. Giảm số phiếu vào
  hộp của GĐ, đúng tinh thần "GĐ chỉ quyết việc đáng quyết".
- Màn `/exec/luat-ky` để GĐ tự chỉnh ngưỡng.
  **1 buổi.**

### G. Uỷ quyền khi Giám đốc vắng

- Bảng `exec_delegations` (người uỷ quyền, người nhận, từ ngày → đến ngày, phạm
  vi loại phiếu).
- Phiếu ký bởi người được uỷ quyền phải ghi rõ trong lịch sử: *"Ký thay GĐ theo
  uỷ quyền 12–20/08"*.
- Không có mục này thì GĐ đi công tác = toàn bộ đơn mua đứng.
  **1,5 buổi.**

### H. Nhắc ký

- Đã có: thông báo trong app khi phiếu được trình (`po.submitted` /
  `lsx.submitted` → `approver_ids`).
- Còn thiếu: **nhắc lại** khi phiếu chờ quá N giờ, và kênh ngoài app (GĐ không
  mở web thì không biết). Cần chốt kênh: Zalo? email? chỉ trong app?
- Cần một lịch chạy định kỳ (hiện dự án chưa có cron).
  **1–2 buổi tuỳ kênh.**

### I. Lịch sử ký & bằng chứng

- Giữ `/exec/approvals/history`, đổi route, mở rộng cho `quote`.
- Thêm: lọc theo khoảng thời gian, xuất Excel, hiển thị **giá trị phiếu tại thời
  điểm ký** (hiện chỉ ghi mã phiếu — 6 tháng sau tra lại không biết đã ký bao
  nhiêu tiền).
  **1 buổi.**

### J. Cắt bỏ

> **Trạng thái 14/08/2026: XONG phần xoá; phần "trả về phòng" CHỜ chốt §8.6.**

- ✅ **Đã xoá hẳn**: `/exec/ops` (page + `OpsTower.tsx`), `/exec/production`
  (page + `ProductionPipeline.tsx`), và `src/modules/dept/production/ops.service.ts`
  — service này chỉ có đúng một nơi gọi là `/exec/ops`, xoá màn thì nó chết theo.
  Tổng **1.008 dòng**.
- ⚠️ **Giữ lại có chủ đích**: `src/lib/exec-ops.ts` + test của nó. Sau khi xoá ở
  trên thì chỉ còn `isBigApproval` có nơi gọi, phần còn lại (tuần / WIP / phế /
  màu tổ) là toán của XƯỞNG, đã có test phủ, và `/production` + `/thongke` đang
  dựng. Đã ghi cảnh báo ngay đầu file để vòng sau còn nhớ mà dọn.
- ⏸ **Chưa đụng**: `/exec/orders`, `/exec/purchasing`, `/exec/tracking`,
  `/exec/lsx` — vẫn còn trong menu GĐ. Cố ý: `/exec/lsx/[id]` là đường GĐ **đang
  dùng để duyệt LSX tại chỗ**, cắt trước khi có Hộp ký là cắt mất đường ký đang
  chạy. Xử ở bước 3, sau khi chốt §8.6.
- **Chuyển chủ**: `/exec/orders` (986 dòng) và `/exec/purchasing` (265 dòng)
  không xoá mà **trả về đúng phòng** — nội dung của chúng là việc của Sale và
  Cung ứng, hai phòng đó mới dùng hằng ngày. GĐ có `workspace.view.*` nên vẫn mở
  xem được khi cần.
  **½ buổi.**

---

## 6. Giai đoạn 0 — vá dữ liệu (bắt buộc chạy trước §5B trở đi)

Bạn đã chốt "vá dữ liệu trước". Cụ thể:

| # | Việc | Loại | Ước lượng |
|---|---|---|---|
| ~~G0.1~~ | ~~Kéo giá từ báo giá sang đơn hàng~~ — **BỎ, không có gì để kéo** (xem dưới) | — | — |
| G0.2 | ✅ **XONG 14/08/2026** — Màn **Điền đơn giá** `/sales/orders/gia`: lưới sửa nhanh + dán từ Excel | có code | 1 buổi |
| G0.3 | **Nạp đơn mua thật** — 6 file đơn Excel đã đối chiếu khớp form (xem [po-forms-6-file-doi-chieu](po-forms-6-file-doi-chieu.md)) nhập lên hệ thống | thao tác, không code | Cung ứng làm |
| G0.4 | Gán vai `director` (§5A) | thao tác | 15 phút |

**Định nghĩa "vá xong"**: ≥1 đơn mua thật ở trạng thái chờ duyệt, và ≥80% dòng
đơn hàng đang mở có đơn giá. Chưa đạt thì Hộp ký dựng xong vẫn là hộp rỗng —
không kiểm chứng được thiết kế.

### Vì sao G0.1 bị bỏ (đo trong DB 14/08/2026)

Bản thảo giả định "đơn đã có `quote_code`, khớp dòng theo mã SP là kéo được giá".
Sai. Số thật:

- **20/20 đơn có `quote_id = null`** — không đơn nào được tạo từ báo giá, tất cả
  nhập thẳng. Không có đường nối để kéo giá qua.
- Cả hệ thống có **6 báo giá / 8 dòng**, thuộc 2 khách, 5/6 còn ở nháp. Kể cả nối
  được thì cũng chỉ phủ được vài dòng trong số 71.

Nên công cụ kéo giá tự động sẽ chạy đúng 0 dòng. Toàn bộ công dồn vào G0.2 — chỗ
thật sự điền được 71 dòng.

### G0.2 đã làm gì

`/sales/orders/gia` (mục **Điền đơn giá** trong sidebar Bán hàng):

- Lưới mọi dòng đơn còn sống, mặc định lọc *chỉ dòng thiếu giá*; gõ giá → dải
  chân màn hiện số dòng sẽ lưu + tổng tiền theo từng tiền tệ → lưu một lần.
- **Dán từ Excel**: bôi 2 cột (mã SP · giá) hoặc 3 cột (mã đơn · mã SP · giá).
- Dòng của đồng nghiệp bị **khoá** chứ không ẩn (`canMutateOwned`) — Sale vẫn
  thấy đơn nào còn thiếu giá để nhắc nhau, nhưng không sửa chéo được.
- Ghi `sales_order_changes` type `price_fill` (ai điền, lúc nào, từ số nào sang
  số nào), hiện thành một mốc riêng trên dòng thời gian của đơn.

Hai quyết định đáng nhớ:

1. **Không tự đoán dấu thập phân.** "1.200" là 1200 (Excel vi-VN) hay 1,2 (Excel
   en-US) — không đoán được từ chuỗi. Người dán chọn dấu một lần cho cả khối,
   hộp thoại hiện **bảng xem trước** giá cũ → giá mới trước khi điền, và dán
   **không lưu thẳng** — chỉ điền vào ô, người dùng soát rồi mới bấm Lưu. Toán
   này nằm ở `src/lib/price-paste.ts` với 22 test.
2. **Không phát `order.changed_after_lsx`.** Sự kiện đó cảnh báo Cung ứng rằng
   *vật tư có thể đã đặt theo số cũ* — nó nói về số lượng và hạn giao. Điền giá
   bán không đổi một gam vật tư nào; phát ra chỉ tạo 20 thông báo rác rồi mọi
   người học cách bỏ qua thông báo.

G0.3 là **việc của người, không phải của code**. Nếu Cung ứng chưa lập PO trên hệ
thống thì mọi thứ ở §5 đều không có gì để ký, và đây là rủi ro lớn nhất của cả kế
hoạch — nêu rõ ở đây để không ai bất ngờ.

---

## 7. Lộ trình đề nghị

| Bước | Hạng mục | Phụ thuộc | Ước lượng |
|---|---|---|---|
| 1 | §5A gán vai `director` + §5J cắt bỏ | — | 1 buổi |
| 2 | G0.1 + G0.2 vá giá đơn hàng | — | 2 buổi |
| 3 | §5B Hộp ký | bước 1 | 1,5 buổi |
| 4 | §5C buồng lái (sửa nạp + tách file) | bước 3 | 2 buổi |
| 5 | §5D ký trên điện thoại | bước 3–4 | 1,5 buổi |
| 6 | §5F luật ký theo ngưỡng | bước 3 | 1 buổi |
| 7 | §5I lịch sử ký | bước 3 | 1 buổi |
| 8 | §5E duyệt báo giá | bước 3, cần chốt §8.2 | 2,5 buổi |
| 9 | §5G uỷ quyền | bước 3 | 1,5 buổi |
| 10 | §5H nhắc ký | cần chốt kênh | 1–2 buổi |

Bước 1–2 chạy song song được. Tổng ~15 buổi làm việc; bước 1–5 (≈8 buổi) đã đủ
để GĐ ký được đàng hoàng trên cả máy lẫn điện thoại.

---

## 8. Cần chốt trước khi code

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 8.1 | Gán vai `director` cho `dir1@hoanggia.de` và **gỡ vai `admin`** — đồng ý? | Nên. GĐ không cần quyền sửa phân quyền/cấu hình hệ thống. |
| 8.2 | **Báo giá nào phải qua GĐ ký?** Mọi báo giá, hay chỉ vượt ngưỡng / giảm giá sâu? | Chỉ vượt ngưỡng — bắt hết sẽ nghẽn Sale |
| 8.3 | Ngưỡng "giá trị lớn" 50 triệu: giữ, đổi số, hay tách ngưỡng riêng cho từng loại phiếu? | Tách riêng: đơn mua và lệnh SX khác hẳn về độ lớn |
| 8.4 | **Ai ký thay khi GĐ vắng?** | Cần một cái tên; không có thì mục §5G vô nghĩa |
| 8.5 | Nhắc ký qua kênh nào ngoài app? | Chốt sau — cần biết GĐ có dùng Zalo công việc không |
| 8.6 | `/exec/orders` + `/exec/purchasing`: trả về phòng Sale/Cung ứng, hay xoá hẳn? | Trả về phòng — nội dung tốt, chỉ sai chủ sở hữu |
