# Danh sách NCC rút từ đơn đặt thật — ĐANG DỞ

Trạng thái: **chưa xong, đang chờ file nguồn.** Ghi lại 31/07/2026 để không mất
phần đã rút được.

## Việc đang làm

Mã viết tắt trên số ĐH (`3/2026-HG/**TTL**`) chính là tên NCC viết tắt. Cần:

1. Đọc hết các sheet đơn trong 8 file để lấy **tên đầy đủ, địa chỉ, MST, người
   liên hệ** của từng NCC + mã viết tắt tương ứng.
2. Bổ sung vào `supply_suppliers` (hiện chỉ có 5 NCC demo: Gia công TTP, Gia công
   Vinh, Gỗ Tân Mai, Nhôm Việt Phát, Phụ kiện Hải Long — không phải NCC thật).
3. Có mã viết tắt rồi mới sinh được số ĐH dạng `3/2026-HG/TTL` thay cho
   `PO-YYYY-NNNN` hiện tại.

## Vì sao dừng

**Thư mục `E:\PO` không còn truy cập được** (ổ rút ra hoặc đã chuyển chỗ). Trong
`~/Downloads` có bản sao của 3/8 file (`Copy of LSX 01/02/03…`) nhưng chưa quét.

Cần bạn cắm lại ổ `E:` hoặc cho biết thư mục mới, rồi chạy tiếp.

## Đã rút được (KHÔNG đầy đủ — đọc kỹ phần cảnh báo)

⚠️ Nhiều giá trị **bị cắt cụt ở 38 ký tự** do cách tôi in ra lúc khảo sát, không
phải nội dung thật của file. Chỗ nào cắt cụt đều đánh dấu `…`. **Đừng nhập thẳng
vào hệ thống** — phải đọc lại từ file gốc.

| Viết tắt | Tên đầy đủ (từ "Kính gửi") | MST | Địa chỉ | Liên hệ | Nhóm hàng | Mẫu đơn |
|---|---|---|---|---|---|---|
| TTL | CÔNG TY TNHH SX & TM DV TÂN THÀNH LON… | 4101075030 | Thôn Ngọc Thạch 1, Xã Tuy Phước Tây, T… | 097.557.3135 (Chị Yến) | Nút nhựa, LĐN, pát, mạc đồng, nút chân | accessory |
| MT | CÔNG TY TNHH TM-DV-TH MINH THẮNG | 4100942107 | 45 Mai Hắc Đế, TP. Quy Nhơn | 0935579589 (chị Loan) | Vít, eru, bộ tip, LĐ | accessory |
| STP *(sheet ghi HAPPYCO)* | CÔNG TY CỔ PHẦN HAPPYCO | 3603421388 | Số 526/2, KP 8A, P.Long Bình, T.Đồng N… | 0909.525.400 | Khoá bấm đà | accessory |
| PQ | Doanh Nghiệp Tư Nhân PQ | 4100777083 | Tổ 8-KV4-Phường Quy Nhơn Bắc-Tỉnh Gia … | 0935772772 (Anh Ẩn) | Nhãn, thẻ treo | accessory |
| 3/2 | CÔNG TY CỔ PHẦN BAO BÌ 3/2 | 4200528940 | QL 1A Xã Suối Hiệp, Huyện Diên Khánh, … | Chị Hạnh - 0933358636 | Thùng carton | carton |
| TĐ | Công ty TNHH sản xuất thương mại dịch … *(sheet tên "Thông Đạt")* | 0313199295 | 454A/8 Hưng Phú, Phường 9, Quận 8, TP.… | 0983 310304 (anh Cường) | Inox tấm | metal_kg |
| HTH | Công ty TNHH thương mại sản xuất Hào … *(Hào Tư Hùng)* | 4100725409 | Số 1035 Trần Hưng Đạo, Phường Quy Nhơn… | 0905 412 939 | Inox cây/ống | metal_kg |
| KVP | Công ty TNHH sản xuất thương … *(sheet tên "Kim Vĩnh Phú")* | 0311147703 | 779 Quốc Lộ 13, Khu Phố 7, Ph… | — | Inox | metal_kg |
| VEC | Công ty TNHH Aluminum Việt E… *(Việt Eco)* | 2301031894 | Lô II-2.5, Đường N2, KCN Quế… | — | Nhôm | aluminium |
| HGHN | Công ty Cổ Phần Sản xuất và … *(sheet "HG HN")* | 0107595790 | Số 84, Hữu Lê, Thành Phố Hà N… | — | Nhôm | aluminium |

### Mới biết tên, CHƯA có hồ sơ

Từ sheet "Tổng hợp ĐH" của LSX 04 (có mã ↔ tên, chưa có MST/địa chỉ):

- **TN** – Tường Nguyên (ty sắt, vít) · **TP** – Tân Phát (vít 4x15)
- **ATP** – An Thành Phát (bộ thanh trượt, con lăn, nút)

Từ tên sheet / cột NCC trong BKVT, chưa rút hồ sơ:

- Nhôm: **Tiến Đạt**, **Cát Tường**, **Taiwant**, **Việt Ý**, **Sơn Thịnh**
- Inox: **Nam Thuận Lợi**, **Gia Anh**
- Khác: **Wecare (WC)**, **VICTORY**, **Huy Hoàng**, **Ân Hoàng Phát**, **HÀO** (túi vải)

### Hai mã KHÔNG phải nhà cung cấp

Trong cột NCC của BKVT có hai giá trị đặc biệt, đừng tạo thành NCC:

- **HGIA** = Hoàng Gia tự làm (pát xưởng làm rồi xuất đi xi).
- **TQ** = hàng Trung Quốc / **ĐỦ** = tồn đủ khỏi mua / **CHƯA MUA** = chưa chốt NCC.

## Lưu ý khi làm tiếp

- Mã viết tắt trên số ĐH **không phải lúc nào cũng khớp tên sheet**: sheet
  "HAPPYCO" nhưng số ĐH ghi `01 HG/STP`. Lấy mã theo **số ĐH**, tên sheet chỉ để
  đối chiếu.
- Định dạng số ĐH không thống nhất giữa các đơn: `3/2026- HG/TTL`, `01 HG/TĐ`,
  `04/202 (HG-PQ)`, `HG/VEC`. Nếu sinh tự động thì phải chốt một dạng chuẩn với
  phòng Cung ứng chứ đừng cố khớp cả bốn.
- `supply_suppliers` đã có sẵn cột `code`, `short_name`, `tax_no`, `address`,
  `phone` — đủ chỗ chứa, không cần migration mới. `code` nên giữ mã viết tắt
  (TTL/MT/TN) vì đó là thứ đi vào số ĐH.
