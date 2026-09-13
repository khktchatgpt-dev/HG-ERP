# Thiết kế khâu QUẢN LÝ CÔNG NỢ NHÀ CUNG CẤP (AP)

Viết 11/09/2026. Trả lời: **gồm những màn nào, mỗi màn làm gì, thông tin gì,
luồng chạy ra sao, báo cáo nào.**

Làm theo đúng sáu bước của [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md)
§5 — **máy trạng thái trước, chọn khuôn màn CUỐI CÙNG**. Lối mòn cũ là nhảy thẳng
vào bước 6 rồi mới phát hiện luồng chưa rõ.

Nền tham chiếu ERP thật (SAP MM/FI, Oracle, D365, Odoo) đã viết riêng ở
[`cong-no-ncc-va-da-tien-te.md`](cong-no-ncc-va-da-tien-te.md). Tài liệu này là
thiết kế **cụ thể cho HG**.

---

## 0. Đo hiện trạng — số thật, không phải ước lượng

| Đo (11/09/2026, sau đợt nhập kho) | Số |
| --------------------------------- | -- |
| Đơn mua `received` | **44** |
| Đơn mua kẹt `draft` (đơn GIA CÔNG, xem §7.4) | **23** |
| Giá trị hàng đã nhập kho | **6.578.066.971 VND · 27.581 USD** |
| Hoá đơn NCC đã vào sổ | **2 tờ · 13.980.000 VND** |
| **GR/IR — đã nhận, CHƯA có hoá đơn** | **6.570.366.971 VND · 27.581 USD** |
| Phiếu chi NCC | **0** |
| NCC đang có công nợ | **27** |
| Dòng tỷ giá đã khai | **1** |
| **NCC khai số ngày công nợ** | **2 / 164** (trước 11/09 là 0) |

**Một con số nói hết**: 6,57 tỷ hàng đã nằm trong kho mà **chưa có tờ hoá đơn
nào**. Toàn bộ thiết kế dưới đây xoay quanh việc thu hẹp khoảng đó — và giữ nó
hiện ra chứ không giấu đi.

---

## 1. Bước 1 — Câu hỏi nghiệp vụ của từng vai

Mỗi vai MỘT câu. Màn nào không trả lời câu nào thì màn đó chưa có lý do tồn tại.

| Vai | Câu hỏi |
| --- | ------- |
| **Kế toán công nợ** | Hôm nay tôi phải vào sổ tờ nào, đòi hoá đơn ai? |
| **Kế toán trưởng** | Tuần này phải chi bao nhiêu, cho ai, lấy tiền ở đâu? |
| **Giám đốc** | Công ty đang nợ tổng bao nhiêu, có khoản nào quá hạn? |
| **Cung ứng** | NCC đòi tiền có đúng không, lệch ở dòng nào? |
| **Kế toán tổng hợp** | Số dư TK 331 cuối kỳ là bao nhiêu để lên báo cáo? |

Năm câu, **năm màn khác nhau** — theo [[moi-trang-mot-vai-tro]]. Gom cả năm vào
một "dashboard công nợ" là màn không ai dùng được.

---

## 2. Bước 2 — Máy trạng thái

AP có **ba** chứng từ, không phải một. Mỗi cái một vòng đời riêng.

### 2.1 Hoá đơn NCC (`accounting_supplier_invoices` — 0188)

```
        ┌──────────────── huỷ ────────────────┐
        │                                     ▼
   [nháp] ──vào sổ──► [đã vào sổ] ──trả đủ──► [đã tất toán]
      ▲                    │
      └─── mở lại ─────────┘
```

| Chuyển tiếp | Ai làm | Điều kiện | Hệ quả | Đường lùi |
| ----------- | ------ | --------- | ------ | --------- |
| nháp → đã vào sổ | Kế toán | có ≥1 dòng, tổng > 0, **khớp đối chiếu trong dung sai** | **SINH CÔNG NỢ** TK 331, vào tuổi nợ | mở lại |
| đã vào sổ → nháp | Kế toán | chưa có phiếu chi nào trỏ vào | công nợ giảm ngay | vào sổ lại |
| bất kỳ → huỷ | Kế toán | chưa trả đồng nào | ra khỏi mọi sổ | không (lập tờ mới) |
| đã vào sổ → tất toán | **máy tính ra** | Σ phiếu chi ≥ tổng tờ | rơi khỏi tuổi nợ | — |

⭐ **"Đã tất toán" là SUY RA, không lưu cột** — tiêu chí 2.5. Lưu thành trạng
thái là sớm muộn có tờ mang nhãn "đã trả" mà số dư vẫn còn.

⭐ **Đối chiếu là CỔNG VÀO SỔ** (tiêu chí 2.7) — hiện **chưa nối**: hoá đơn vào
sổ được mà không cần khớp. Đây là lỗ hổng nghiêm trọng nhất còn lại.

### 2.2 Đề nghị thanh toán (CHƯA CÓ BẢNG)

```
   [soạn] ──gửi duyệt──► [chờ duyệt] ──duyệt──► [đã duyệt] ──chi──► [đã chi]
                              │
                              └── từ chối ──► [soạn]  (bắt lý do)
```

Đây là chứng từ **đang thiếu hoàn toàn**, và là trung tâm của AP thật: gom các
hoá đơn đến hạn của nhiều NCC thành **một đợt chi**, một lần duyệt.

### 2.3 Phiếu chi (`accounting_supplier_payments` — 0167)

Đã có bảng, **chưa có vòng đời**: ghi thẳng, không duyệt. Và **chưa gắn hoá đơn**
— mới gắn đơn mua. Hệ quả đo được: `paidPerInvoice()` trả map rỗng, nên **bảng
tuổi nợ bày nguyên số dư mọi hoá đơn**, trả một phần không trừ được.

### 2.4 Phép thử A4

Vẽ ba máy trạng thái trên một tờ giấy, không mũi tên nào cụt. Chỗ **cụt hiện
nay**: hoá đơn `đã vào sổ` không có đường sang `đã tất toán` vì phiếu chi không
biết nó thuộc hoá đơn nào.

---

## 3. Bước 3 — Ngoại lệ, liệt kê TRƯỚC đường thuận

Đường thuận (hàng về → hoá đơn khớp → trả đủ) là thiểu số. Bảy ngoại lệ phải có
chỗ chứa; ngoại lệ không nối được vào một chuyển tiếp có thật nghĩa là máy trạng
thái còn thiếu.

| # | Ngoại lệ | Thật đến đâu | Nối vào đâu |
| - | -------- | ------------ | ----------- |
| 1 | Hàng về trước hoá đơn (GR/IR) | **6,57 tỷ ngay lúc này** | dải "ngoài sổ" + việc "đi đòi hoá đơn" |
| 2 | Hoá đơn về trước hàng | thường với NCC ứng trước | verdict `doi_truoc` của đối chiếu |
| 3 | Giá hoá đơn ≠ giá đơn | tỷ giá, phụ phí, chiết khấu chốt sau | verdict `lech_gia` + **ngưỡng dung sai** |
| 4 | Một hoá đơn cho nhiều đơn mua | NCC thép/nhôm gộp tháng | 0188 nối ở **mức dòng** ✅ |
| 5 | Trả hàng / NCC giảm giá | hàng lỗi sau kiểm | **giấy báo có — CHƯA CÓ** |
| 6 | Đặt cọc trước khi giao | đơn khuôn, đơn nhập khẩu | **trả trước — CHƯA CÓ** |
| 7 | Trả một phần nhiều lần | điều khoản 30/70 | ghi được nhiều phiếu, **chưa trừ theo tờ** |

---

## 4. Bước 4 — Ai giữ bóng

Trạng thái không có người giữ là trạng thái chết.

| Trạng thái | Người giữ | Đếm bao lâu |
| ---------- | --------- | ----------- |
| Hàng đã về, chưa có hoá đơn | **Cung ứng** (đi đòi NCC xuất) | từ ngày nhập kho |
| Hoá đơn nháp | Kế toán công nợ | từ ngày nhận tờ |
| Hoá đơn lệch quá dung sai | **Cung ứng** (xác minh giá) | từ ngày đối chiếu |
| Hoá đơn đã vào sổ, đến hạn | Kế toán trưởng | từ ngày đến hạn |
| Đề nghị chi chờ duyệt | Giám đốc | từ ngày gửi |

⭐ Hai dòng in đậm là của **Cung ứng, không phải Kế toán** — đây là lý do quyền
`accounting.supplier_invoice.*` đã mở cho **cả hai phòng** (xem `actions.ts`).

---

## 5. Bước 5 — Vết

| Chuyển tiếp | Ghi gì | Bắt lý do? |
| ----------- | ------ | ---------- |
| Vào sổ | ai, lúc nào, số dư trước/sau | không |
| Mở lại | ai, lúc nào | **có** — số công nợ đổi sau lưng người đã đối chiếu |
| Huỷ tờ | ai, lúc nào | **có** |
| Vào sổ dù lệch quá dung sai | ai duyệt, lệch bao nhiêu | **có** |
| Ghi phiếu chi | ai, trỏ vào tờ nào | không |
| Xoá phiếu chi | ai | **có** |

Dùng lại `stampNote` (`src/lib/po-note.ts`) — lý do **CỘNG THÊM** vào ghi chú,
không ghi đè. Đây là lỗi đã vấp một lần ở đơn mua và làm mất dữ liệu thật.

---

## 6. Bước 6 — Bản đồ MÀN × KHUÔN

Bây giờ mới chọn khuôn. Sáu khuôn ở [`/design-lab`](../src/app/design-lab/page.tsx).

### 6.1 Đã có (9 màn)

| Màn | Khuôn | Câu hỏi nó trả lời | Trạng thái |
| --- | ----- | ------------------ | ---------- |
| `/finance/so-cong-no` | **C** + tầng soi | Tổng nợ? Từng NCC? Gồm khoản nào? | ✅ có Excel 2 sheet |
| `/finance/tuoi-no` | **C** | Nợ nào quá hạn bao lâu, trả ai trước? | ✅ |
| `/finance/hoa-don-ncc` | **D** | NCC đòi đúng không, lệch ở DÒNG nào? | ✅ đối chiếu 3 chiều |
| `/finance/hoa-don-ncc/moi` | **F** | Nhập tờ hoá đơn nhanh mà không sai? | ✅ PO flip |
| `/finance/hoa-don-ncc/so` | **C** | Tờ nào chưa vào sổ? | ✅ có nút Vào sổ |
| `/finance/cong-no-ncc` | cũ (theme v3) | Ghi thanh toán | ⚠ cơ sở phiếu nhập |
| `/finance/bao-cao` | **C** | Tiền mua đang nằm ở mốc nào? | ✅ + Excel 5 sheet |
| `/finance/theo-lenh` | **C** | Lệnh nào trót cam kết bao nhiêu? | ✅ + bảng chéo |
| `/finance/invoices` | cũ | sổ hoá đơn CŨ (bảng khác) | ⚠ đừng nhầm |

### 6.2 CÒN THIẾU — xếp theo "chặn việc gì"

| # | Màn | Khuôn | Câu hỏi | Vì sao cần |
| - | --- | ----- | ------- | ---------- |
| **M1** | **Chứng từ hoá đơn NCC** `/finance/hoa-don-ncc/[id]` | **D** | Tờ này gồm gì, ai giữ, vướng gì? | Hiện chỉ có danh sách — **không xem được dòng, không sửa, không có dòng thời gian**. Một chứng từ không có màn chứng từ là vi phạm nguyên lý 1.1 |
| **M2** | **Phiếu chi gắn hoá đơn** (sửa màn có) | **F** | Trả tờ nào, bao nhiêu, còn lại bao nhiêu? | Gỡ mũi tên cụt §2.4. Không có nó thì tuổi nợ **vĩnh viễn sai** |
| **M3** | **Đề nghị thanh toán** `/finance/de-nghi-chi` | **C** → **D** | Tuần này trả ai, tổng bao nhiêu? | Trung tâm AP thật. Gom nhiều tờ nhiều NCC thành một đợt, một lần duyệt |
| **M4** | **Hộp thư công nợ** `/finance/viec-cua-toi` | **B** | Việc nào chờ TÔI? | 4 làn: tờ nháp chờ vào sổ · tờ lệch chờ xác minh · **hàng về chưa có HĐ** · đến hạn trả |
| **M5** | **Hồ sơ công nợ một NCC** `/finance/ncc/[id]` | **E** | NCC này làm ăn ra sao, nợ bao nhiêu? | Dải hiệu suất: nợ hiện tại · quá hạn dài nhất · % giao đúng hẹn · % hoá đơn khớp lần đầu. **Không có vòng đời duyệt** — đừng nhét vào khuôn D |
| **M6** | **Khai tỷ giá** `/finance/ty-gia` | **F** | 1 USD hôm nay bao nhiêu? | `fx_rates` chỉ nạp được bằng SQL → mọi số dư ngoại tệ hiện "chưa quy đổi" |
| **M7** | **Giấy báo có / trả hàng** | **D** | Trả hàng rồi, nợ giảm bao nhiêu? | Ngoại lệ #5 — hiện kế toán phải ghi tay ngoài sổ |
| **M8** | **Trả trước / cấn trừ** | **D** | Đã ứng bao nhiêu, cấn vào tờ nào? | Ngoại lệ #6 |
| **M9** | **Khoá kỳ** | (nút, không phải màn) | Kỳ này chốt chưa? | Không có thì sổ đã in ra vẫn sửa được sau lưng |

---

## 7. Tính năng & thông tin — chi tiết bốn màn quan trọng nhất

### 7.1 M1 · Chứng từ hoá đơn NCC (Khuôn D)

**Ba trục trạng thái** của khuôn D: `StatusTrack` (nháp → vào sổ → tất toán) ·
`HolderBar` (ai đang giữ, bao lâu) · `ActionPane` (hành động chia nhóm).

| Khối | Nội dung |
| ---- | -------- |
| Đầu tờ | NCC · số HĐ · ngày · hạn · tiền tệ · **tỷ giá đã dùng** · đơn mua nguồn |
| Lưới dòng | mã VT · tên · SL · ĐVT · đơn giá · thành tiền · VAT% · **dòng đơn mua đã nối** |
| `FactBox` đối chiếu | đặt / về / đòi + **verdict từng dòng**, lệch thì nói lệch ở đâu |
| Thanh toán | các phiếu chi trỏ vào tờ này · **còn phải trả** |
| `Timeline` | vào sổ / mở lại / sửa / chi — ai, lúc nào, lý do |
| `NoteStream` | trao đổi giữa Kế toán ↔ Cung ứng ngay trên tờ |

**Hành động** (`ActionPane`, nhóm theo hệ quả):
- *Thuận*: Vào sổ · Ghi thanh toán
- *Lùi*: Mở lại (bắt lý do) · Huỷ (bắt lý do)
- *Bị chặn*: nút khoá **kèm câu nói vướng gì và cách gỡ** — luật kiểm mục 05

### 7.2 M2 · Phiếu chi gắn hoá đơn

Đổi `accounting_supplier_payments`: thêm bảng nối **phiếu chi × hoá đơn × số tiền
phân bổ** (một phiếu trả nhiều tờ, một tờ trả nhiều lần).

| Thông tin | Ghi chú |
| --------- | ------- |
| Ngày chi · phương thức · số UNC | có sẵn |
| **Phân bổ vào từng hoá đơn** | MỚI — đây là mắt xích còn thiếu |
| Tỷ giá ngày chi | có cột (0189), chưa dùng |
| **Chênh lệch tỷ giá đã thực hiện** | tự tính = (tỷ giá chi − tỷ giá HĐ) × ngoại tệ |

Xong M2 thì: tuổi nợ đúng · trả một phần chạy · hoá đơn tự tất toán · lãi/lỗ tỷ
giá ra số.

### 7.3 M3 · Đề nghị thanh toán (Khuôn C → D)

**Màn danh sách**: mọi hoá đơn đến hạn trong N ngày, lọc theo NCC · tiền tệ · rổ
tuổi. Tick chọn → "Lập đề nghị chi".

**Chứng từ đề nghị**: gom theo NCC, mỗi dòng một hoá đơn, có tổng theo tiền tệ.
Gửi duyệt → Giám đốc duyệt → sinh phiếu chi hàng loạt.

⭐ **Không tự động nối ngân hàng.** Chưa đủ khối lượng, rủi ro tiền thật cao hơn
nhiều so với cái tiết kiệm được.

### 7.4 Luồng CHƯA CÓ: nhận thành phẩm GIA CÔNG

23 đơn (~300.000 USD) là **đơn gia công thành phẩm**, không phải mua vật tư — xem
[[don-gia-cong-thanh-pham]]. Chúng **không nhập kho vật tư được** (kho ghi theo
`material_id`) nên vĩnh viễn không tới `received`, và công nợ gia công hiện **nằm
ngoài mọi con số**.

Cần một luồng riêng: nhận **thành phẩm** theo LSX → công nợ gia công. Đây là việc
độc lập với AP vật tư, đừng nhồi chung.

---

## 8. Báo cáo tài chính

| Báo cáo | Ai đọc | Nguồn | Trạng thái |
| ------- | ------ | ----- | ---------- |
| **Sổ chi tiết công nợ TK 331** | Kế toán tổng hợp | hoá đơn + phiếu chi, theo KỲ | ✅ + Excel |
| **Bảng tuổi nợ** | Kế toán trưởng | hoá đơn chưa trả × hạn | ✅ (sẽ đúng sau M2) |
| **Bảng đối chiếu công nợ gửi NCC** | gửi RA NGOÀI | sổ chi tiết một NCC | ❌ **thiếu — kế toán đang làm tay** |
| **Dự báo dòng tiền chi** | Giám đốc | hạn thanh toán × số dư | ❌ |
| **Phân tích chi mua hàng** (Pareto, một nguồn) | Cung ứng · GĐ | dòng đơn mua | ✅ |
| **Số dư TK 331 lên bảng cân đối** | Kế toán tổng hợp | dư cuối kỳ quy VND | ✅ (chờ M6 cho ngoại tệ) |

**Bảng đối chiếu gửi NCC** là thứ thiếu đáng kể nhất: cuối kỳ kế toán phải gửi
từng NCC một bản xác nhận số dư, và hiện đang gõ tay từ màn hình.

---

## 9. Thứ tự làm — xếp theo "chặn việc gì", không theo độ khó

**Đợt 0 — CHỐT CHẶN, làm trước mọi thứ** ✅ XONG 11/09/2026

0. **Khai điều khoản thanh toán** — đo ra **164 NCC / 0 NCC có số ngày**, nên cả
   6,578 tỷ công nợ KHÔNG khoản nào có hạn: tuổi nợ trống, không biết trả ai
   trước, không dự báo được dòng tiền. Đã dựng `/finance/dieu-khoan-ncc` (Khuôn
   F) + `lib/payment-terms.ts` (15 test) + ô `payment_net_days` trong hồ sơ NCC.
   **Còn lại là việc NHẬP LIỆU**: 23/25 NCC đang nợ vẫn chưa có điều khoản ghi ở
   đâu cả — phải hỏi Cung ứng.

**Đợt 1 — gỡ mũi tên cụt** (không cần quyết gì thêm)
1. **M2** phiếu chi gắn hoá đơn → tuổi nợ đúng, trả một phần chạy, tờ tự tất toán.
2. **M1** màn chứng từ hoá đơn → một chứng từ phải có màn chứng từ.
3. **Đối chiếu thành CỔNG VÀO SỔ** + ngưỡng dung sai (tiêu chí 2.7).

**Đợt 2 — để trả tiền đúng**
4. **M3** đề nghị thanh toán + duyệt chi.
5. **M4** hộp thư công nợ — 4 làn việc.
6. **Bảng đối chiếu công nợ gửi NCC** (bản in + Excel).

**Đợt 3 — đóng nốt vòng**
7. **M6** khai tỷ giá + chênh lệch tỷ giá khi chi.
8. **M7** giấy báo có · **M8** trả trước.
9. **M5** hồ sơ công nợ một NCC.
10. **M9** khoá kỳ + đánh giá lại cuối kỳ.

**Song song, không thuộc AP vật tư**: luồng nhận thành phẩm gia công (§7.4).

### Cần chủ dự án quyết trước Đợt 1

| Câu | Vì sao chặn |
| --- | ----------- |
| **Ngưỡng dung sai đối chiếu** là bao nhiêu? (vd ±2% hoặc ±50.000 đ) | Không có ngưỡng thì mọi chênh vài đồng đều phải người duyệt, và người duyệt sẽ duyệt mù |
| **Ai duyệt chi**, từ mức tiền nào? | Quyết định máy trạng thái của M3 |
| **Tỷ giá**: một ô xấp xỉ (TT 53) hay hai ô mua/bán (TT 200)? | Quyết định M6 có một ô hay hai |

---

## 10. Không nên làm

- **Không dựng sổ cái tổng hợp** (GL, bút toán kép). Công ty một xưởng dùng phần
  mềm kế toán riêng để nộp thuế; ERP này chỉ cần **sổ chi tiết công nợ đúng**.
- **Không tự động hoá thanh toán** (nối ngân hàng).
- **Không gom năm câu hỏi ở §1 vào một dashboard.**
- **Không lưu "đã thanh toán" thành cột trạng thái** — suy ra từ phiếu chi.
- **Không quy đổi ngoại tệ ở tầng hiển thị khi chưa có tỷ giá.** Thà bày hai con
  số theo hai tiền tệ còn hơn một con số sai.
