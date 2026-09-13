# Công nợ nhà cung cấp & đa tiền tệ — ERP thật làm thế nào

Viết 11/09/2026. Trả lời hai câu: **đơn mua lẫn VND/USD thì xử lý ra sao**, và
**phân hệ công nợ NCC (AP) của ERP gồm những gì**.

Đo trên CSDL thật cùng ngày, không phải lý thuyết suông.

> **Thiết kế cụ thể cho HG** — màn nào, khuôn nào, thứ tự làm — nằm ở tài liệu
> anh em: [thiet-ke-cong-no-ncc.md](thiet-ke-cong-no-ncc.md). File này là phần
> ĐỐI CHIẾU với ERP thật; file kia là phần THI CÔNG.

---

## 0. HG-ERP đang ở đâu

| Đo                                            | Số                     |
| --------------------------------------------- | ---------------------- |
| Đơn mua VND                                   | 42 đơn / 129 dòng      |
| Đơn mua USD                                   | 24 đơn / 77 dòng       |
| **Lệnh SX mang CẢ HAI tiền tệ**               | **6**                  |
| Bảng có cột `currency`                        | 7                      |
| **Bảng có cột TỶ GIÁ**                        | **0**                  |
| Phiếu chi NCC đã ghi                          | 0                      |
| Hoá đơn NCC thật                              | 0                      |

> Bảng trên là ảnh chụp **trước** các đợt sửa cùng ngày — giữ nguyên làm mốc so
> sánh. Cái gì đã thay đổi xem §2.5 và bảng §3 (0189 đã thêm `fx_rates` + cột tỷ
> giá lưu cứng; sổ TK 331 theo kỳ đã dựng).

Hai dòng in đậm là toàn bộ vấn đề. Hệ thống **biết** một đơn bằng USD, nhưng
**không biết 1 USD bằng bao nhiêu VND** — nên không thể nói "công ty đang nợ nhà
cung cấp bao nhiêu tiền" bằng một con số.

Còn một chỗ ngầm định đáng lưu: `warehouse_movements.unit_cost` **không có cột
tiền tệ**. Giá vốn trên phiếu nhập đang được hiểu theo tiền tệ của ĐƠN MUA
(`payables.repo` join ngược để lấy). Chạy được, nhưng là quy ước ngầm — ai đọc
thẳng bảng kho sẽ tưởng mọi `unit_cost` đều là VND.

---

## 1. Đa tiền tệ — ERP thật làm thế nào

### 1.1 Ba vai trò tiền tệ, không phải một

| Vai                       | Là gì                                | Của HG                  |
| ------------------------- | ------------------------------------ | ----------------------- |
| **Tiền giao dịch**        | tiền ghi trên tờ chứng từ            | VND hoặc USD (theo NCC) |
| **Tiền hạch toán**        | tiền của sổ sách công ty             | **VND**                 |
| **Tiền báo cáo** (nếu có) | tiền của tập đoàn mẹ khi hợp nhất    | không có                |

**Luật nền của ERP**: mỗi chứng từ tiền tệ lưu **cả hai** con số cùng lúc —
`amount` (tiền giao dịch) **và** `amount_base` (đã quy ra VND) **và** `fx_rate`
+ `fx_date` đã dùng. Không lưu chỉ một rồi tính lại khi cần.

Vì sao phải lưu cứng: **tỷ giá của một chứng từ đã ghi sổ KHÔNG BAO GIỜ đổi**.
Hoá đơn ghi ngày 03/08 ở tỷ giá 25.400 thì mãi mãi là 25.400, kể cả hôm nay tỷ
giá 26.000. Tính lại lúc đọc nghĩa là mỗi ngày mở sổ ra một số khác — và không
ai đối chiếu được với báo cáo đã in tháng trước.

### 1.2 Tỷ giá lấy ở MỐC NÀO

Đây là phần hay bị làm sai nhất. Trong luồng mua hàng có **bốn mốc**, và mỗi mốc
xử lý khác nhau:

| Mốc               | Ghi sổ?  | Tỷ giá                                     |
| ----------------- | -------- | ------------------------------------------ |
| **Đặt hàng (PO)** | KHÔNG    | chỉ tham khảo, để ước tính cam kết         |
| **Nhận hàng (GR)**| CÓ       | tỷ giá **ngày nhập kho** → giá trị tồn kho |
| **Hoá đơn (IR)**  | CÓ       | tỷ giá **ngày hoá đơn** → khoản phải trả   |
| **Thanh toán**    | CÓ       | tỷ giá **ngày chi** → chênh lệch thực hiện |

Đơn mua **không sinh bút toán**, nên tỷ giá trên đơn chỉ để ước tính. Đây chính
là lý do màn `/finance/bao-cao` gọi hai mốc đầu là **ƯỚC TÍNH** — không phải
tôi thận trọng quá, đó là đúng chuẩn.

### 1.3 Chênh lệch tỷ giá — hai loại, đừng lẫn

**Đã thực hiện** (realized): hoá đơn ghi 10.000 USD ở tỷ giá 25.400 → nợ
254.000.000 đ. Ba tháng sau trả ở tỷ giá 26.000 → chi 260.000.000 đ.
**Lỗ tỷ giá 6.000.000 đ**, vào chi phí tài chính. Đây là tiền thật đã mất.

**Chưa thực hiện** (unrealized): cuối kỳ, các khoản phải trả ngoại tệ **còn đang
mở** được đánh giá lại theo tỷ giá cuối kỳ. Chênh lệch ghi nhận vào kết quả kinh
doanh nhưng **chưa phải tiền thật** — kỳ sau đánh giá lại thì nó đảo.

Ở Việt Nam đây là yêu cầu bắt buộc của chế độ kế toán (đánh giá lại số dư gốc
ngoại tệ cuối kỳ), không phải tuỳ chọn.

### 1.4 Điều TUYỆT ĐỐI không được làm

**Không cộng hai tiền tệ.** Không có tỷ giá thì `100.000.000 VND + 5.000 USD`
không phải một con số — nó là hai con số. Bản đầu của `lsx-finance.ts` đã mắc
đúng lỗi này: hard-code `'VND'` rồi cộng thẳng, tức ngầm khai 1 USD = 1 VND.
Con số ra **trông vẫn bình thường** nên không ai bắt được bằng mắt. Nay
`rollupByLsx` trả `Map<lệnh, Map<tiền tệ, …>>` và `totalOf` ghi rõ chỉ nhận một
tiền tệ.

### 1.5 Việc cụ thể cho HG-ERP, theo thứ tự

1. **Bảng tỷ giá** `fx_rates(currency, rate_date, rate, source)` — nguồn gõ tay
   hoặc chép từ Vietcombank. Không cần API, một dòng mỗi ngày cho mỗi ngoại tệ.
2. **Lưu cứng tỷ giá lên chứng từ ghi sổ**: thêm `fx_rate` + `fx_date` +
   `amount_base` vào `accounting_supplier_invoices` và
   `accounting_supplier_payments`. Phiếu nhập kho thì thêm `currency` cho tường
   minh thay vì suy ngược qua đơn.
3. **Công nợ hiển thị hai tầng**: theo từng tiền tệ (số gốc, luôn đúng) **và**
   quy VND (số tổng, kèm ngày tỷ giá đã dùng). Không bao giờ chỉ hiện số quy đổi
   mà giấu số gốc.
4. **Chênh lệch tỷ giá khi thanh toán** — tính tự động lúc ghi phiếu chi.
5. **Đánh giá lại cuối kỳ** — làm sau cùng, chỉ khi kế toán thật sự chốt sổ tháng.

Bước 1–3 là đủ để con số công nợ dùng được. Bước 4–5 là kế toán tài chính đúng
chuẩn, chưa gấp khi chưa chốt sổ.

---

## 2. Phân hệ công nợ NCC (AP) trong ERP thật

### 2.1 Các chứng từ — và vì sao cần từng cái

| Chứng từ                  | Việc của nó                                     | HG-ERP  |
| ------------------------- | ----------------------------------------------- | ------- |
| Hồ sơ NCC                 | điều khoản TT, tài khoản NH, mã số thuế         | ✅ có   |
| Đơn mua (PO)              | cam kết, KHÔNG sinh nợ                          | ✅ có   |
| Phiếu nhập (GR)           | hàng vào kho → tăng tồn, tăng GR/IR             | ✅ có   |
| **Hoá đơn NCC (IR)**      | **sinh khoản PHẢI TRẢ**, mang VAT               | ⚠ vừa có (0188) |
| **Giấy báo có / trả lại** | hàng trả, NCC giảm giá → **giảm** phải trả      | ❌ chưa |
| **Đề nghị / phiếu chi**   | trả tiền, kèm chênh lệch tỷ giá                 | ⚠ có bảng (0167), chưa có luồng |
| **Trả trước cho NCC**     | ứng tiền trước, sau cấn trừ vào hoá đơn         | ❌ chưa |

Hai dòng ❌ không phải chuyện hiếm: **hàng trả lại NCC** và **đặt cọc trước** là
việc thường ngày của xưởng. Thiếu chúng thì kế toán phải ghi tay ngoài sổ, và
con số công nợ trong máy vĩnh viễn lệch.

### 2.2 Quy trình chuẩn

```
Đơn mua ──► Nhận hàng ──► Nhận hoá đơn ──► ĐỐI CHIẾU BA CHIỀU
                                               │
                        khớp ──────────────────┤
                        lệch trong dung sai ───┤──► Ghi sổ phải trả
                        lệch quá dung sai ─────┘        │
                              └► chờ người duyệt        ▼
                                                   Đến hạn TT
                                                        │
                                              Đề nghị thanh toán (gom theo NCC)
                                                        │
                                                 Duyệt chi ──► Phiếu chi
                                                        │
                                              Chênh lệch tỷ giá (nếu ngoại tệ)
```

**Điểm mấu chốt**: đối chiếu ba chiều là **cổng vào sổ**, không phải một màn tra
cứu. Hoá đơn không khớp thì không được ghi sổ phải trả — đó là chốt chặn duy
nhất ngăn trả tiền cho hàng chưa về hoặc trả sai giá.

HG-ERP đã có phép đối chiếu (`lib/three-way-match.ts`) nhưng **chưa nối nó vào
cổng ghi sổ** — hiện hoá đơn vào sổ được mà không cần khớp.

### 2.3 Tính năng — bắt buộc và nên có

**Bắt buộc** (thiếu là không vận hành được):

1. **Hạn thanh toán suy từ điều khoản** — "30 ngày kể từ ngày hoá đơn" phải tự
   tính ra ngày, không gõ tay. HG-ERP có `terms_payment` dạng **chữ tự do**, máy
   không đọc được → phải tách thành `net_days` có cấu trúc.
2. **Bảng tuổi nợ (aging)** — 0–30 / 31–60 / 61–90 / >90 ngày, theo NCC và theo
   tiền tệ. Đây là **báo cáo số một** của mọi phân hệ AP; không có nó thì không
   ai biết nên trả ai trước.
3. **Đề nghị thanh toán** — máy chọn hoá đơn đến hạn, gom theo NCC, ra danh sách
   chi. Thiếu cái này thì kế toán lọc Excel bằng tay mỗi tuần.
4. **Trả một phần** — một hoá đơn trả làm nhiều lần, số dư tự trừ dần.
5. **Giấy báo có / trả lại hàng** — giảm khoản phải trả có chứng từ.
6. **Sổ chi tiết theo NCC** — mọi phát sinh và thanh toán của một NCC trên một
   màn, cộng dồn ra số dư. HG-ERP có (`supplierDetail`).

**Nên có** (chưa gấp với một xưởng):

7. Đối chiếu sao kê NCC — NCC gửi bảng kê, so với sổ mình, tìm chỗ lệch.
8. Thuế nhà thầu (WHT) — cần khi trả tiền ra nước ngoài.
9. Chiết khấu thanh toán sớm (2/10 net 30).
10. Tài khoản trung gian GR/IR và đối chiếu số dư của nó.
11. Khoá kỳ kế toán — chốt sổ tháng, không cho sửa ngược.
12. Hạn mức tín dụng NCC, cảnh báo vượt.

### 2.4 Ba khái niệm hay bị bỏ sót

**GR/IR — tài khoản trung gian.** Hàng về trước hoá đơn là chuyện thường. Lúc
đó nợ đã phát sinh (hàng nằm trong kho mình) nhưng chưa có chứng từ. ERP treo
khoản đó vào tài khoản trung gian; khi hoá đơn về thì cấn trừ. Số dư GR/IR còn
lại chính là **"đã nhận, chưa có hoá đơn"** — HG-ERP vừa bày con số này trên
màn công nợ, nhưng chưa có tài khoản để cấn trừ.

**Dung sai đối chiếu.** ERP nào cũng cho lệch trong ngưỡng (vd ±2% hoặc ±50.000
đ) đi thẳng, chỉ chặn phần vượt. Không có dung sai thì mọi chênh vài đồng làm
tròn đều phải người duyệt — và người duyệt sẽ duyệt mù.

**Một hoá đơn ↔ nhiều đơn mua.** NCC thép/nhôm thường gộp nhiều lần giao trong
tháng vào một hoá đơn. Vì thế 0188 nối ở **mức dòng** (`po_line_id` trên dòng
hoá đơn) chứ không phải một cột `po_id` ở đầu hoá đơn.

### 2.5 Sổ chi tiết công nợ theo KỲ — thứ trả lời "tôi đang nợ những gì"

Câu hỏi của kế toán — *"tôi có những công nợ nào, tổng bao nhiêu, từng NCC bao
nhiêu"* — **không** trả lời được bằng thêm một màn thống kê nữa. Trước 11/09/2026
HG-ERP có bốn màn công nợ và chúng cho bốn con số khác nhau, vì cả bốn đều là
**ảnh chụp "tại thời điểm này"**:

| Màn                  | Cơ sở                        | Số (đo 11/09/2026) |
| -------------------- | ---------------------------- | ------------------ |
| `/finance/cong-no-ncc` | phiếu nhập kho có giá      | 7.700.000          |
| `/finance/hoa-don-ncc` | hoá đơn NCC                | 11.340.000         |
| `/finance/bao-cao`     | đơn NCC đã xác nhận        | 12.200.000         |
| `/finance/theo-lenh`   | cam kết theo đơn mua       | 5.682.550.116      |

Bốn con số đều **đúng** theo cơ sở của nó. Thứ thiếu là khái niệm **KỲ**: kế
toán không làm việc bằng ảnh chụp, họ làm việc bằng

```
Dư đầu kỳ  +  Phát sinh tăng  −  Phát sinh giảm  =  Dư cuối kỳ
```

Không có cấu trúc đó thì không chốt sổ được, không đối chiếu với kỳ trước được,
và không ai trả lời được "tháng này công nợ tăng hay giảm". Đó chính là **sổ chi
tiết công nợ phải trả người bán (TK 331)** — `/finance/so-cong-no`, lõi thuần ở
`src/lib/ap-ledger.ts` (có test).

**Bốn quyết định của sổ này, và lý do:**

1. **Phát sinh tăng là HOÁ ĐƠN, không phải phiếu nhập.** Nợ phải trả là nghĩa vụ
   pháp lý: nó ra đời khi NCC xuất hoá đơn, và mang VAT. Phiếu nhập kho nói hàng
   đã về — đó là cơ sở của *giá trị tồn kho*. Hai thứ lệch nhau **đúng bằng
   GR/IR**, và phần đó bày RIÊNG ở dải "ngoài sổ" chứ không cộng vào số dư; cộng
   vào là ghi nợ hai lần khi hoá đơn về.
2. **Dư đầu kỳ CỘNG DỒN từ giao dịch, không có ô khai tay.** Sổ nào cho gõ tay số
   dư đầu kỳ thì sớm muộn số đó lệch khỏi tổng giao dịch, và không ai biết bên
   nào sai.
3. **Tiền tệ không bao giờ cộng lẫn.** Số dư gốc ngoại tệ là số dư thật; cột quy
   VND chỉ để lên báo cáo. Thiếu tỷ giá thì để **trống**, không thay bằng 0 —
   10.000 USD hiện thành 0 đ đọc ra là "không nợ gì".
4. **Dư cuối ngoại tệ đánh giá lại theo tỷ giá CUỐI KỲ**, không phải tỷ giá lúc
   ghi hoá đơn (đó là chênh lệch tỷ giá chưa thực hiện — §1.3).

Sổ chi tiết của từng NCC có cột **số dư luỹ kế**: đối chiếu công nợ là hai bên đi
từng dòng tìm chỗ số dư bắt đầu lệch; bảng không có cột đó thì mỗi lần dò phải
cộng tay lại từ đầu sổ. Bản Excel (`/api/dept/accounting/so-cong-no/export`) có
cả sổ tổng hợp lẫn sổ chi tiết, vì kế toán in ra để đối chiếu và lưu hồ sơ.

⚠ **Sổ đúng không có nghĩa là sổ đầy.** Đo 11/09/2026: mới 1 hoá đơn vào sổ. Sổ
này chỉ có giá trị khi hoá đơn NCC được nhập đều — đó là việc nhập liệu, không
phải việc của phần mềm.

---

## 3. Đối chiếu HG-ERP với chuẩn

| Tính năng                        | HG-ERP                                   |
| -------------------------------- | ---------------------------------------- |
| Hoá đơn NCC có dòng              | ✅ 0188                                  |
| Đối chiếu ba chiều               | ✅ `lib/three-way-match.ts`, có test     |
| Đối chiếu là **cổng vào sổ**     | ❌ hoá đơn vào sổ không cần khớp         |
| Dung sai đối chiếu               | ❌ chưa có ngưỡng                        |
| Hạn TT suy từ điều khoản         | ✅ `net_days` (0189), suy ra `due_date`   |
| **Bảng tuổi nợ**                 | ✅ `/finance/tuoi-no`, `lib/ap-aging.ts`  |
| **Sổ chi tiết công nợ theo kỳ**  | ✅ `/finance/so-cong-no` (§2.5)          |
| Đề nghị thanh toán               | ❌ chưa                                  |
| Trả một phần                     | ⚠ ghi được nhiều phiếu, chưa trừ theo HĐ |
| Giấy báo có / trả lại            | ❌ chưa                                  |
| Trả trước / đặt cọc              | ❌ chưa                                  |
| Tỷ giá                           | ⚠ `fx_rates` + cột lưu cứng (0189); CHƯA có màn khai tỷ giá |
| Chênh lệch tỷ giá                | ❌ chưa                                  |
| Khoá kỳ                          | ❌ chưa                                  |

---

## 4. Thứ tự nên làm

Xếp theo "chặn việc gì" chứ không theo độ khó.

**Đợt A — để con số dùng được** (không cần quyết gì thêm)

1. ~~`fx_rates` + lưu cứng `fx_rate`/`amount_base` lên hoá đơn và phiếu chi.~~ ✅ 0189
2. ~~Tách `terms_payment` → `net_days` có cấu trúc, suy ra `due_date`.~~ ✅ 0189
3. ~~**Bảng tuổi nợ** theo NCC × tiền tệ × khoảng ngày.~~ ✅ `/finance/tuoi-no`
4. ~~**Sổ chi tiết công nợ theo kỳ** (TK 331).~~ ✅ `/finance/so-cong-no` — §2.5
5. **Màn khai tỷ giá.** Bảng `fx_rates` đã có nhưng chỉ nạp được bằng SQL, nên
   mọi số dư ngoại tệ hiện bày "chưa quy đổi" và KHÔNG có dòng tổng quy VND.

**Đợt B — để trả tiền đúng**

4. Đối chiếu ba chiều thành **cổng vào sổ**, kèm ngưỡng dung sai.
5. Đề nghị thanh toán + trả một phần trừ theo từng hoá đơn.

**Đợt C — đóng nốt vòng**

6. Giấy báo có / trả lại hàng.
7. Trả trước và cấn trừ.
8. Chênh lệch tỷ giá khi thanh toán.
9. Khoá kỳ, đánh giá lại cuối kỳ.

**Cần chủ dự án quyết trước Đợt A**: tỷ giá lấy từ đâu (gõ tay / Vietcombank),
và ngưỡng dung sai đối chiếu là bao nhiêu.

---

## 5. Không nên làm

- **Không quy đổi ngoại tệ ở tầng hiển thị** khi chưa có bảng tỷ giá. Thà bày
  hai con số theo hai tiền tệ còn hơn một con số sai.
- **Không dựng sổ cái tổng hợp** (GL, bút toán kép). Công ty một xưởng dùng
  phần mềm kế toán riêng để nộp thuế; ERP này chỉ cần sổ chi tiết công nợ đúng.
- **Không tự động hoá thanh toán** (nối ngân hàng). Chưa đủ khối lượng, và rủi
  ro tiền thật cao hơn nhiều so với cái tiết kiệm được.
