# Kho — việc còn lại

Chốt 15/09/2026, nhánh `feat/thiet-ke-kho`. Đọc cùng
[`thiet-ke-kho.md`](thiet-ke-kho.md) (dữ liệu & luồng) và
[`thiet-ke-kho-ui.md`](thiet-ke-kho-ui.md) (chia module & màn).

Sổ này chỉ ghi **cái CHƯA làm** và **cái đã biết là nợ**. Cái đã làm nằm trong
lịch sử commit, không chép lại ở đây.

---

## 0. Việc phải làm TRƯỚC KHI NẠP TỒN THẬT

Đây không phải mục ưu tiên cao, mà là mục có **hạn**.

Tồn hiện đang là **0 trên cả 13.229 mã** (phiếu `KK-2026-0004` ngày 15/09 đưa
về 0 để nạp lại). Chừng nào còn thế, mọi thay đổi mô hình kho là "thêm cột".
Sau khi nạp tồn thật, cùng thay đổi đó thành "chia lại số dư từng mã theo kệ và
theo trạng thái, làm tay, sai thì không ai phát hiện".

Cụ thể còn đúng một việc trong nhóm này: **Đợt 3 §2.1 — mã lý do** (xem dưới).
Nó thêm một cột vào `warehouse_movements`; thêm trước khi có tồn thì mọi dòng
sổ về sau đều có mã lý do, thêm sau thì có một khoảng lịch sử không có.

---

## 1. Việc của CHỦ DỰ ÁN — phần mềm không làm thay được

### 1.1 Rà 13 khu thật vừa nạp ⚠️

`0195` nạp 13 kệ thật, tên **suy từ nhóm vật tư trong danh mục, không phải đo
ngoài xưởng**. Mở [`/warehouse/ke`](../src/app/(workspace)/warehouse/ke/page.tsx)
và đối chiếu với biển hiệu thật: đổi tên, thêm khu, hoặc ngừng dùng khu không có
thật. Màn chặn ngừng khu đang giữ hàng nên không dọn nhầm được.

Nếu xưởng chưa đánh mã kệ ngoài thực địa thì **đây là việc sơn biển**, không
phải việc phần mềm. Không có biển thật thì `bin_id` chỉ là một ô rỗng nữa.

### 1.2 Năm mã có kệ cũ không khớp khu nào

`A-01 · B-01 · B-03 · B-04 · C-02` — do người dùng tự khai trước đây, `0196`
**cố ý không đè**. Chúng không khớp khu nào trong 13 khu mới nên lúc cất hàng sẽ
không có gợi ý, phải chọn tay. Vô hại, và là dấu hiệu để biết 5 mã đó cần rà.

### 1.3 Ba câu nghiệp vụ còn treo

| # | Câu | Chặn cái gì |
| --- | --- | --- |
| **a** | **Xưởng lấy vật tư thế nào ngoài thực địa?** Ai ra kho lấy · theo giấy gì · ký ở đâu | **Màn Cấp vật tư** — câu rủi ro nhất, xem §4.1 |
| b | Có ai kiểm hàng trước khi nhập không, và là ai? | Có thể bỏ hẳn trạng thái `qc` — xem §5.4 |
| c | Kiểm kê đếm mù hay đếm mở? | Mặc định của Đợt 3 §2.2 (đang tạm chọn **mù**) |

Câu **a** là câu quan trọng nhất trong cả sổ này. Sổ ghi `ref_type='lsx'` đúng
**1 dòng trong 2 tháng**, nghĩa là việc cấp vật tư — mục đích chính của phân hệ
— đang chạy hoàn toàn ngoài hệ thống. Mọi thứ khác trong sổ đúng dù trả lời thế
nào; riêng màn Cấp vật tư thì không.

---

## 2. Đợt 3 — mã lý do + kiểm kê có phạm vi

### 2.1 Mười hai mã lý do — ĐÃ CHỐT ĐƯỜNG, NỀN DỮ LIỆU XONG

**Va chạm §6.1 đã chốt 15/09/2026: mã nằm trên DÒNG SỔ.** Xem §6.1 để biết vì
sao và cái gì còn phải dọn.

**Bước 1 — nền dữ liệu: XONG** (`0197_warehouse_reason_codes.sql` +
[`src/lib/kho-ma-ly-do.ts`](../src/lib/kho-ma-ly-do.ts) + 22 test).

- Bảng `warehouse_reason_codes` (14 mã, không phải 12 — xem dưới) +
  `warehouse_movements.reason_code` nullable có FK.
- **Bộ 12 gốc nở thành 14**: nuốt trọn 7 mã của phiên kia, thêm `X6` (xuất dùng
  chung · sửa chữa) và `X7` (xuất khác). Bộ 12 gốc gộp chúng vào `X2`, mà `X2`
  vào giá thành LỆNH còn hai cái này là chi phí chung — gộp là mất đúng chỗ kế
  toán cần tách.
- **Không backfill 265 dòng cũ.** Sổ chỉ cộng thêm (luật 0194); chỗ đọc suy mã
  qua `suyMaTuLichSu(ref_type, direction)`. `adjust` và `daily` **trả null có
  chủ ý** — chúng không suy được, và đoán bừa thành `X7` là bịa số cho báo cáo.
- **Nguồn luật là file TS, bảng DB giữ toàn vẹn FK.** Có test đọc thẳng file SQL
  seed so với danh sách TS, nên hai bên không lệch mà không ai biết.

**⚠️ `0197` CHƯA APPLY lên DB remote** (phiên này không có quyền MCP Supabase).
Phải apply trước khi làm bước 2, và `sync types` ngay sau đó.

**Bước 2 — CÒN LẠI**: zod bắt `reason_code` cho dòng mới · service ghi mã ·
lưới soạn phiếu đổi cột theo `doiUng` của mã · sổ phiếu lọc theo mã (§2.5) ·
`needsApproval` nối vào đường duyệt.

Chừng nào bước 2 chưa xong thì "vì sao có dòng sổ này" **vẫn tán ra ba chỗ**:
`docs.kind` (4 giá trị) + `movements.ref_type` (6 giá trị) + ô `reason` tự do.
Bảng mã đã có nhưng chưa nơi nào GHI vào — cột `reason_code` hôm nay rỗng trên
mọi dòng, nên đừng đọc nó như một nguồn số cho tới khi bước 2 xong.

Thiết kế đầy đủ ở [`thiet-ke-kho.md` §5.3](thiet-ke-kho.md) và bảng 12 mã ở
[`thiet-ke-kho-ui.md` §2.2](thiet-ke-kho-ui.md).

### 2.2 Đợt kiểm kê có phạm vi và sổ đóng băng

Bảng `warehouse_stocktakes` + `warehouse_stocktake_lines.book_qty_frozen`.
Xem [`thiet-ke-kho.md` §5.4](thiet-ke-kho.md).

Đợt 1 đã chặn đường "đếm cả danh mục" (bắt chọn phạm vi trước) — đó là hàng rào
tạm, dựng được ngay, không cần migration. Cái thật còn thiếu:

- **Phạm vi LƯU ĐƯỢC** (khu / nhóm / danh sách mã), không phải một bộ lọc URL.
- **Sổ đóng băng lúc mở đợt.** Không đóng băng thì người đếm xong hai tiếng,
  trong khoảng đó có phiếu nhập, và chênh lệch tính ra sai mà không ai biết.
- **Đếm mù** — giấu cột Sổ lúc đếm, có công tắc. Chờ câu §1.3c.
- Vòng đời `Mở → Đang đếm → Đối chiếu → Đã duyệt`, phân người đếm.
- Tab bày trước **sẽ sinh phiếu N4/X5 nào** — kiểm kê là chỗ duy nhất một cú
  bấm sửa được tồn, nên phải là chỗ minh bạch nhất.

Mẫu chạy được: [`/design-lab/kho/kiem-ke`](../src/app/design-lab/kho/kiem-ke/page.tsx).

### 2.3 Màn Hàng mắc

[`/design-lab/kho/hang-khoa`](../src/app/design-lab/kho/hang-khoa/page.tsx) đã
dựng mẫu; màn thật chưa có.

Màn này **chỉ tồn tại được vì hàng không đạt nay vào sổ** (Đợt 2). Cột **tuổi**
là lý do nó tồn tại: hàng mắc không ai nhắc thì nằm hết tháng. Người phải quyết
thường **không phải Kho** — dòng đẩy lên bàn làm việc của Cung ứng.

Gộp luôn đường **trả hàng NCC** vào đây, không làm màn riêng: trả hàng là một
chuyến xe cho một NCC, nên "gom mọi lô của NCC đó vào một phiếu" phải nằm ngay
cạnh danh sách lô.

### 2.4 Tách `DocsManager.tsx` (2.225 dòng)

**Cố ý hoãn từ Đợt 1** và ghi lý do ở [`thiet-ke-kho.md` §6](thiet-ke-kho.md):
`/warehouse/docs` chỉ 0,28 MB nên đây là vấn đề *bảo trì*, không phải vấn đề dữ
liệu. Đợt 3 dựng lại soạn phiếu theo mã lý do (lưới đổi cột theo mã) — lúc đó
tách file là **hệ quả tự nhiên của việc dựng lại**, không phải một lượt refactor
riêng làm hai lần một việc.

### 2.5 Sổ phiếu lọc theo mã lý do

Bộ lọc chính là **mã lý do**, không phải ngày: người đi soát hỏi "tháng này có
bao nhiêu phiếu huỷ", không hỏi "phiếu ngày 12/09". Phiếu đảo và phiếu gốc nằm
cạnh nhau, phiếu gốc gạch ngang.
Mẫu: [`/design-lab/kho/so-phieu`](../src/app/design-lab/kho/so-phieu/page.tsx).

---

## 3. Đợt 4 — tồn dự kiến

### 3.1 `v_warehouse_projection` — tồn dự kiến theo thời gian

**Rẻ nhất mà giá trị cao nhất của cả phân hệ.** Ba mảnh dữ liệu đều ĐÃ CÓ:
`qty_ok` · đợt giao NCC đã hẹn (`supply_po_shipments`) · nhu cầu LSX đã duyệt
(`reservedByCommittedLsx`). Chưa ai ghép chúng thành một hình.

Câu người lập kế hoạch thật sự hỏi không phải "hôm nay còn bao nhiêu" mà **"đến
ngày xưởng cần thì còn bao nhiêu"** — và không màn tồn nào trả lời nổi, vì tồn
là một lát cắt. Chép Dynamics *Item Availability by Event* / SAP *MD04*.

### 3.2 Hồ sơ vật tư — Khuôn E

`/warehouse/vat-tu/[id]`. Đây là **danh mục**: không vòng đời duyệt, nên chỗ của
ba trục trạng thái là **dải hiệu suất**, mỗi ô kèm mẫu số. Tab "Tồn theo kệ" đọc
`v_warehouse_stock_by_bin` (đã có từ 0194).
Mẫu: [`/design-lab/kho/vat-tu`](../src/app/design-lab/kho/vat-tu/page.tsx).

### 3.3 `NoteStream` + `Followers` trên phiếu kho

Đơn mua đã có; phiếu kho chưa. Kho là nơi tranh luận nhiều nhất ("hàng này ai
cho nhập", "sao thiếu 3 cây") và hiện những câu đó nằm trên Zalo.

---

## 4. Chưa xếp đợt

### 4.1 Màn Cấp vật tư ⚠️ CHỜ CÂU §1.3a

Luật khó nhất của cả phân hệ: **không bao giờ chỉ nói "không đủ tồn"**. Mỗi dòng
thiếu phải nói thiếu bao nhiêu · hàng đang mắc ở đâu · gỡ thế nào, kèm nút đi
tiếp. "Không đủ tồn" đúng về dữ liệu và vô dụng về nghiệp vụ.

Bốn nhãn dòng **không được gộp**: đã cấp đủ · hàng có nhưng chờ kiểm · một phần
đang khoá · chưa có hàng. Gộp ba cái sau thành "thiếu" là mất đúng thông tin
quyết định việc tiếp theo — đi nhắc KCS, đi hỏi Cung ứng, hay đi xin mua.
Mẫu: [`/design-lab/kho/cap-vat-tu`](../src/app/design-lab/kho/cap-vat-tu/page.tsx).

### 4.2 Bàn làm việc kho — Khuôn A

`/warehouse` hiện vẫn là dashboard cũ. Bản mới: sáu ô **việc** (không phải chỉ
số), mỗi ô có dòng phụ nói **vì sao gấp**, và mọi con số tính từ chính hàm mà
màn đích dùng.
Mẫu: [`/design-lab/kho`](../src/app/design-lab/kho/page.tsx).

### 4.3 Hàng về — thêm làn "Chưa hẹn ngày"

`/warehouse/nhap` đang chia ba làn Quá hẹn / Hôm nay / Sắp tới (đúng mẫu Odoo).
Thiếu làn thứ tư: **NCC không nhận hẹn ngày, "giao khi có xe"** — thứ mẫu nước
ngoài không có mà NCC Việt Nam bắt buộc phải có. Giấu tập đó đi thì thủ kho phải
nhớ bằng đầu.

### 4.4 Cờ `needs_inspection` theo nhóm — khai rồi, CHƯA ĐỌC

`0194` khai trong header rằng cờ nằm ở `catalog_items.meta->>'needs_inspection'`
(type `material_group`), mặc định tắt. **Chưa nơi nào đọc nó.**

Vô hại hôm nay: mặc định tắt nghĩa là hành xử y hệt phương án hai trạng thái, và
người nhận vẫn tự chọn "Chờ kiểm" từng dòng được. Nhưng cờ đã khai mà không đọc
là một lời hứa treo — hoặc nối vào, hoặc xoá khỏi header.

---

## 5. Nợ kỹ thuật đã biết

### 5.1 `qty_rejected` và `stock_status` là hai đường song song ⚠️

Đợt 2 **cố ý không gỡ** `qty_rejected`: nó có **1 dòng trong toàn DB** nhưng
**20+ chỗ ở Cung ứng đọc** (`qty_received = qty + qty_rejected`, sổ mở theo dòng,
báo cáo, Excel). Gỡ là một lượt riêng, chạm module Cung ứng.

Hai đường không đánh nhau — hàng khoá vẫn là `direction='in'` với `qty > 0` nên
"NCC đã chở tới" vẫn đếm đủ. Nhưng **form phiếu nhập giờ có cả hai ô**: "QC loại"
(số, đường cũ) và "Tình trạng" (đường mới). Hai cách nói "hàng này hỏng" là đúng
thứ gây nhầm mà cả bản thiết kế chê.

Việc cần làm: bỏ ô "QC loại" khỏi form, chuyển mọi nơi đọc `qty_rejected` sang
đếm dòng `stock_status='blocked'`.

### 5.2 `qc_status` chỉ nhất quán ở ĐƯỜNG FORM

Form phiếu nhập suy `qc_status` từ `stock_status` (đạt→pass, sai quy cách→fail)
nên một điều khiển, hai cột luôn khớp. Nhưng **API vẫn nhận hai trường rời nhau**
— gọi thẳng `/api/dept/warehouse/docs/receipt` vẫn gửi được `qc_status: 'fail'`
kèm `stock_status: 'ok'`. Service chưa chặn.

### 5.3 `is_low` vẫn tính trên `on_hand`, không trên `qty_ok`

**Cố ý**, ghi lý do trong header `0194`: nó là ngưỡng đặt lại hàng, và `0160` ghi
rõ ba nơi phải đồng nhất (view + cron `0159` + `notifyLowStock`). Đổi nền tính là
**đổi hành vi một cron** — đáng làm, nhưng phải đi một migration riêng có tên
đúng, không đi ké một migration cấu trúc.

Lập luận cho việc đổi: hàng khoá sắp trả NCC thì không nên tính vào "tôi có đủ
chưa để khỏi phải mua".

### 5.4 Trạng thái `qc` có thể thừa

Chờ câu §1.3b. Thủ kho vừa nhận vừa kiểm → bỏ `qc`, còn `ok`/`blocked`: phiếu
nhập còn hai lựa chọn thay vì ba, màn Tồn bớt một cột, bớt một rổ.

**Giữ là chiều rẻ hơn**: không bật nhóm nào thì trạng thái đó không bao giờ xuất
hiện — chi phí bằng 0. Bỏ hẳn rồi cần lại thì phải chia lại số dư từng mã bằng tay.

### 5.5 Tìm ở màn Tồn kho CÓ DẤU

View `warehouse_stock` không có cột `search_text` không dấu như bảng
`warehouse_materials`, nên gõ "vit" không ra "vít". Vá bằng cách thêm cột vào
view — để đi kèm lượt sửa view tiếp theo, không đẻ một migration chỉ cho một cột.

### 5.6 Rổ `short` phân trang trong bộ nhớ

`available` cần `reserved`, không nằm trong view SQL. Tập có giữ chỗ bị chặn bởi
số dòng định mức của các lệnh đang cam kết (vài trăm) nên hôm nay không sao. Nếu
số lệnh mở tăng mạnh thì phải đưa `reserved` xuống SQL.

### 5.7 `binsRepo.materialCountByBin` quét `limit 20000`

Đủ cho một kho 13k mã × vài khu. Kho lớn hơn thì phải đếm bằng SQL aggregate.

### 5.8 Chỗ thiếu test

Có test: 5 ca hành vi Đợt 2 (mặc định khu/trạng thái · hàng khoá vào sổ · khoá
thiếu lý do bị chặn trước khi ghi dòng nào · kho chưa khai khu vẫn nhận được ·
khai thẳng kệ thật).

**Chưa có test:**

- `stockRepo.page` / `counts` — ánh xạ rổ → điều kiện SQL. Verify tay qua trình
  duyệt (13.229 mã · trang 1/265 · trang cuối 29 dòng · "Nhôm hộp" 96 mã/2 trang
  · dưới mức 5 · thiếu cho LSX 3), **không phải hàng rào tự động**.
- `createTransferDoc` — kể cả nhánh quan trọng nhất: kiểm tồn theo ĐÚNG Ô và
  cộng dồn theo ô trước khi so.
- `binsService` — mỗi loại khu ảo chỉ một · không ngừng khu đang giữ hàng ·
  không ngừng khu ảo.
- Màn Sơ đồ kệ, Cất hàng (UI, verify tay).

### 5.9 Mười hai màn mẫu ở `/design-lab/kho` là MẪU, không phải màn thật

Dựng bằng số liệu giả (mã vật tư thật, lượng và ngày dựng). Chúng **không đọc
DB**. Đừng nhầm "màn mẫu chạy được" với "tính năng đã có".

---

## 6. Rủi ro phối hợp — DB dùng CHUNG

### 6.1 Phiên khác đã thêm `warehouse_docs.reason_code` ⚠️

Lịch sử migration của DB (đọc 15/09/2026) có **ba migration không có file trong
nhánh này**:

| Version | Tên | Đụng gì |
| --- | --- | --- |
| `20260915061650` | `dot_giao_co_ma` | `supply_po_shipments.code` |
| `20260915072702` | `phieu_kho_ghi_to_nhan` | `warehouse_docs.team_department_id` |
| `20260915074425` | `phieu_xuat_ly_do_co_ma` | **`warehouse_docs.reason_code`** |

Chúng do **phiên khác** apply lên cùng một DB remote (còn hai worktree khác đang
chạy). Hai hệ quả:

**① `warehouse_docs.reason_code` TRÙNG KHÁI NIỆM với Đợt 3 §2.1 — ĐÃ CHỐT
15/09/2026: MÃ NẰM TRÊN DÒNG SỔ.**

Họ đặt mã lý do trên **PHIẾU**; bản thiết kế đặt trên **DÒNG SỔ**. Lập luận
quyết định không phải "chuẩn SAP" mà là một dòng mã đo được:
[`stock.service.ts:725`](../src/modules/dept/warehouse/stock.service.ts:725)
tính `ref_type` **theo từng dòng** cho phiếu nhập
(`l.po_line_id ? 'po' : … : 'external'`) — nên một phiếu nhập **hôm nay đã trộn
được** dòng mua theo đơn và dòng mua ngoài đơn. Mã trên phiếu thì cặp dòng đó
chỉ mang được một mã, hoặc phải cấm trộn, tức đổi hành vi một form đang chạy
thật. Đường xuất thì `ref_type: input.kind` theo phiếu, nên phiên kia **không
sai với phần họ chạm** — chỉ là chỗ đặt không phủ nổi đường nhập.

**Còn phải dọn** (KHÔNG làm trong `0197`, cố ý):

- `warehouse_docs.reason_code` vẫn còn trên DB và **nhánh kia đang chạy trên
  nó**. Drop một cột đang có code đọc là làm hỏng worktree người khác.
- Sau khi nhánh `feat/cung-ung-nap-du-lieu-va-soan-don` merge: chuyển 69 dòng
  UI + schema + repo của họ sang ghi `movements.reason_code`, ánh xạ 7 mã → mã
  mới (`sx`→X1 · `bu-hao`→X2 · `sua-may`/`mau`/`noi-bo`→X6 · `huy`→X4 ·
  `khac`→X7), rồi **một migration riêng** drop cột trên phiếu. Chừng nào chưa
  drop thì đúng là hai đường cùng sống — đây là **nợ có hạn**, không phải thiết
  kế.
- `src/lib/ly-do-xuat.ts` của họ bị `kho-ma-ly-do.ts` thay; xoá cùng lượt đó.

**② `database.types.ts` trong nhánh này là SIÊU TẬP.** Nó sync từ DB thật nên
chứa cả cột của họ, trong khi `supabase/migrations/` ở đây không tạo những cột
đó. Không gãy gì cho nhánh này (mã ở đây không đọc chúng, và type dư không làm
`next build` đỏ), nhưng **người merge phải biết**: dựng một DB mới chỉ từ thư mục
migrations của nhánh này sẽ thiếu ba thứ trên.

### 6.2 Migration của nhánh này ĐÃ APPLY lên DB remote

`0193` · `0194` · `0195` · `0196` đã chạy trên DB dùng chung **trước khi nhánh
được merge**. Nghĩa là các nhánh khác đang thấy schema mới mà không có file.
Bình thường với cách làm hiện tại, nhưng nếu ai revert nhánh này thì phải **gỡ
schema bằng tay** — `git revert` không đụng tới DB.

### 6.3 TRÙNG SỐ MIGRATION 0193 · 0194 · 0195 ⚠️ CHẶN MERGE

Phát hiện 15/09/2026, sổ trước chưa ghi. **Hai nhánh dùng cùng ba số cho sáu
việc khác nhau**, và cả sáu đã apply lên DB remote:

| Số | Nhánh này (`feat/thiet-ke-kho`) | Nhánh kia (`feat/cung-ung-nap-du-lieu-va-soan-don`) |
| --- | --- | --- |
| `0193` | `warehouse_bins` | `dot_giao_co_ma` |
| `0194` | `warehouse_stock_status` | `phieu_kho_ghi_to_nhan` |
| `0195` | `warehouse_bins_seed_thuc_te` | `phieu_xuat_ly_do_co_ma` |

Vi phạm quy ước CLAUDE.md ("Never reuse a number"). Merge cả hai vào `main` thì
thư mục có hai `0193`, hai `0194`, hai `0195` — và ai dựng DB mới từ thư mục
này sẽ chạy chúng theo thứ tự chữ cái, không theo thứ tự đã chạy thật.

**Cách gỡ**: nhánh này ff được lên `main` nên **merge trước và giữ số**; nhánh
kia đánh lại thành `0198/0199/0200` (`0197` đã dùng). Đổi TÊN FILE không đụng
DB — `supabase_migrations.schema_migrations` ghi version theo dấu thời gian
(`20260915061650`…), không theo tên file trong repo. **Việc đổi số là của phiên
đang giữ nhánh kia**, đừng sửa chéo worktree.
