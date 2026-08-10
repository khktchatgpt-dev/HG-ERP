# Khu Ban Giám đốc — thiết kế lại, giới hạn ở Sale + Cung ứng

Trạng thái: **BẢN THẢO chờ chốt** (09/08/2026). Chủ dự án chốt phạm vi:
*"phần của giám đốc giới hạn tại quản lý các thông tin quan trọng của phòng Sale
và Cung ứng"*.

Tức khu `/exec` **không còn là bảng điều hành xưởng**. Giám đốc nhìn hai phòng
đang thật sự vận hành trên hệ thống: **tiền vào (Sale)** và **tiền ra (Cung ứng)**.
Phần xưởng giữ nguyên trong code, chỉ rút khỏi tầm mắt Giám đốc.

> Việc này KHÔNG đụng module sản xuất, KHÔNG đụng DB. Chỉ đổi khu `/exec`.

---

## 1. Hiện trạng khu `/exec` — 4 màn, 2 màn rỗng hoàn toàn

| Màn | Nội dung | Số thật hôm nay | Xử lý |
|---|---|---|---|
| `/exec/ops` — Tháp điều hành | sơ đồ xưởng, dòng chảy BTP, chất lượng 7 ngày, + 2 thẻ cung ứng | xưởng **0 tuyệt đối**; 2 thẻ cung ứng dùng được | **Bỏ khỏi menu**, giữ lại 2 thẻ cung ứng chuyển sang trang chủ mới |
| `/exec/production` — Tiến độ sản xuất | kanban 20 LSX theo công đoạn | 20 lệnh đều kẹt "chờ vật tư/BOM", tiến độ 15% cứng | **Bỏ khỏi menu** |
| `/exec/orders` — Quản lý đơn hàng | sổ đơn theo giá trị & hạn giao | 20 đơn, **0 USD** (chưa dòng nào có giá) | **Giữ, làm lại** thành sổ đơn của Sale |
| `/exec/approvals` (+ lịch sử) | duyệt LSX + đơn mua vật tư | đang trống vì chưa có phiếu chờ | **Giữ nguyên** — đây là lõi, vừa cập nhật theo 0128 |

Trang chủ `/exec` hiện **redirect thẳng sang Tháp điều hành** → phải đổi, vì đó là
màn sắp bỏ.

## 2. Nguyên tắc thiết kế

1. **Giám đốc xem và quyết, không tác nghiệp.** Mọi thẻ dẫn về màn tác nghiệp của
   phòng, không cho sửa tại chỗ (trừ duyệt/từ chối).
2. **Quản trị theo ngoại lệ.** Trên cùng luôn là "việc cần bạn quyết" và "thứ đang
   trục trặc", không phải bảng số đẹp.
3. **Chỉ hiện thẻ có nguồn dữ liệu thật.** Thẻ nào phụ thuộc dữ liệu chưa có thì
   nêu rõ ở §5 và làm sau, không dựng ô rỗng.
4. **Hai vế đối xứng: BÁN ↔ MUA.** Đây là thứ chỉ Giám đốc nhìn được; hai phòng ai
   cũng chỉ thấy nửa của mình.

## 3. Điều hướng mới của khu Giám đốc

| Thứ tự | Mục | Route | Nội dung |
|---|---|---|---|
| 1 | **Bảng tin điều hành** | `/exec` (mới) | ngoại lệ cần quyết + hai vế Bán / Mua |
| 2 | **Phê duyệt** | `/exec/approvals` | LSX + đơn mua chờ duyệt (giữ) |
| 3 | **Sổ đơn hàng** | `/exec/orders` | Sale: đơn, giá trị, hạn giao, tiến độ giao |
| 4 | **Mua hàng & NCC** | `/exec/purchasing` (mới) | Cung ứng: chi mua, PO đọng/quá hẹn, NCC |
| — | Lịch sử phê duyệt | `/exec/approvals/history` | giữ (đã có 5 loại mốc sau 0128) |

Gỡ khỏi menu: *Tháp điều hành*, *Tiến độ sản xuất*. Route vẫn còn để không gãy
link cũ, nhưng không ai vào bằng menu nữa.

## 4. Bảng tin điều hành `/exec` — bố cục

```
┌ CẦN BẠN QUYẾT ────────────────────────────────────────────────────────┐
│  ⬤ 3 lệnh SX chờ duyệt   ⬤ 5 đơn mua chờ duyệt (đợi lâu nhất: 2 ngày) │
│  ⬤ 2 báo giá chờ duyệt                                    → Phê duyệt │
├ ĐANG TRỤC TRẶC ───────────────────────────────────────────────────────┤
│  ⚠ 4 đơn hàng trễ hạn giao   ⚠ 6 đơn mua quá hẹn NCC                  │
│  ⚠ 3 đơn đã duyệt >7 ngày chưa gửi NCC   ⚠ 5 vật tư dưới tồn tối thiểu│
├──────────────────────────┬────────────────────────────────────────────┤
│ BÁN — phòng Sale         │ MUA — phòng Cung ứng                       │
│  Doanh số tháng    ƒ     │  Giá trị mua tháng            ƒ            │
│  Đơn đang mở  20 · ƒ giá │  Đơn mua đang mở / đang về                 │
│  Sắp giao ≤7 ngày        │  Chi theo nhóm vật tư (top 5)              │
│  Top khách theo giá trị  │  Top NCC theo giá trị mua                  │
│  Tỉ lệ báo giá → đơn     │  NCC giao đúng hẹn (%)                     │
├──────────────────────────┴────────────────────────────────────────────┤
│ BÁN vs MUA THEO LỆNH — tiền vào / tiền ra / chênh lệch thô            │
└───────────────────────────────────────────────────────────────────────┘
```

### Dải cuối là thứ đáng giá nhất

**Bán vs Mua theo lệnh**: mỗi lệnh sản xuất gom một nhóm đơn hàng (tiền vào) và
kéo theo một nhóm đơn mua vật tư (tiền ra). Đặt hai con số cạnh nhau là Giám đốc
thấy ngay lô nào đang ăn mòn lãi — thông tin mà **không phòng nào tự thấy được**,
vì Sale chỉ nhìn vế bán còn Cung ứng chỉ nhìn vế mua. Dữ liệu đã nối sẵn: đơn
hàng ↔ lệnh (0113), lệnh ↔ đơn mua (`production_order_id` + gộp nhiều lệnh 0125).

## 5. Từng thẻ — nguồn dữ liệu và tình trạng

| Thẻ | Nguồn | Dùng được ngay? |
|---|---|---|
| Lệnh / đơn mua / báo giá chờ duyệt | `approvalsService`, `posService.list(pending)` | ✅ có sẵn |
| Đơn mua quá hẹn NCC | `lib/late-risk.ts` (đang dùng ở tháp điều hành) | ✅ |
| Đơn đã duyệt chưa gửi NCC | trạng thái `approved` + `approved_at` | ✅ |
| Vật tư dưới tồn tối thiểu | `warehouse_materials.min_stock` | ⚠️ chỉ **5 vật tư** đã đặt mức tối thiểu / 13.168 |
| Đơn hàng trễ hạn / sắp giao | `sales_orders.due_date` | ✅ |
| Tiến độ giao từng đợt | `sales_order_shipments` (0120) | ⚠️ **0 đợt giao** — chưa ai dùng |
| **Doanh số, giá trị đơn, top khách** | dòng đơn hàng | ❌ **71/71 dòng chưa có đơn giá** |
| **Giá trị mua, chi theo nhóm, top NCC** | dòng đơn mua | ❌ **0 đơn mua** trong DB |
| NCC giao đúng hẹn (%) | lịch sử PO + phiếu nhập | ❌ chờ có đơn mua thật |
| Bán vs Mua theo lệnh | cả hai vế trên | ❌ chờ cả hai |

**Kết luận thẳng:** khoảng một nửa bảng tin **chưa có số** cho tới khi vá được
hai chỗ: (1) đơn hàng phải có đơn giá, (2) phòng Cung ứng bắt đầu lập đơn mua
trên hệ thống. Đây không phải lỗi thiết kế — là thứ tự bắt buộc.

## 6. Lộ trình

| Bước | Việc | Ước lượng |
|---|---|---|
| **1** | ✅ **XONG 09/08/2026** — Đổi điều hướng: bỏ 2 mục xưởng, thêm *Bảng tin điều hành* + *Mua hàng & NCC*; `/exec` thôi redirect sang tháp | nửa buổi |
| **2** | ✅ **XONG 09/08/2026** — **Bảng tin điều hành**: "Cần bạn quyết" + "Đang trục trặc" + hai vế Bán/Mua + dải cảnh báo thiếu giá | 1 buổi |
| **3** | ✅ **XONG 09/08/2026** — Màn **Mua hàng & NCC**: PO theo trạng thái, quá hẹn, đọng chưa gửi, xếp hạng NCC | 1 buổi |
| **4** | **Vá giá đơn hàng** — kéo giá từ báo giá đã duyệt + nhập hàng loạt cho 20 đơn đang mở | 1–2 buổi |
| **5** | Bật các thẻ tiền: doanh số, giá trị mua, top khách/NCC | nửa buổi (sau bước 4) |
| **6** | Dải **Bán vs Mua theo lệnh** | 1 buổi |
| **7** | Cảnh báo đẩy: PO quá hẹn, đơn trễ hạn → thông báo cho GĐ (logic có, thiếu lịch chạy) | 1 buổi |

Bước 1–3 làm được **ngay hôm nay** vì không phụ thuộc dữ liệu còn thiếu; bước 5–6
chỉ có nghĩa sau bước 4.

## 7. Cần chốt

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 7.1 | Hai màn xưởng (`/exec/ops`, `/exec/production`): **gỡ khỏi menu** nhưng giữ route, hay xoá luôn file? | **Gỡ khỏi menu** — ngày xưởng lên hệ thống thì bật lại, không phải viết lại |
| 7.2 | Giám đốc có cần **duyệt báo giá bán** không? (hiện báo giá là hồ sơ riêng của Sale, không qua GĐ) | Nếu có ngưỡng giá trị thì nên — chờ ý anh/chị |
| 7.3 | Ngưỡng "giá trị lớn" hiện cứng **50tr** ở màn duyệt — giữ hay đổi? | Đưa vào Cấu hình để đổi không cần lập trình |
| 7.4 | Bảng tin nên gộp luôn **công nợ phải thu / phải trả** không? | Chưa — kế toán chưa lên hệ thống, sẽ ra số rỗng |
