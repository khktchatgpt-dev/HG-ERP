# Danh sách NCC rút từ đơn đặt thật — ĐÃ NẠP

Trạng thái: **xong phần hồ sơ NCC** (01/08/2026). Phần sinh số ĐH còn treo, xem
mục cuối.

Nguồn: 8 file đơn của phòng Cung ứng ở `E:\PO` (mỗi file 1 LSX, mỗi sheet NCC là
1 đơn) — **62 sheet đơn → 26 nhà cung cấp**. Nạp bằng
[`scripts/suppliers-import.mjs`](../scripts/suppliers-import.mjs), chạy lại được:

```bash
node scripts/suppliers-import.mjs                # dry-run, in bảng + xung đột
node scripts/suppliers-import.mjs --apply        # ghi vào supply_suppliers
```

`supply_suppliers` trước đó chỉ có 5 NCC seed demo (Gia công TTP, Gia công Vinh,
Gỗ Tân Mai, Nhôm Việt Phát, Phụ kiện Hải Long). **Vẫn giữ nguyên** vì đã dính
chứng từ (4 PO + 10 dòng bảng giá) — cần thì ẩn bằng `is_active`, đừng xoá.

## 26 NCC đã nạp

Mã = mã viết tắt trên số ĐH. Mẫu = mẫu đơn hay dùng (xem [po-templates.md](./po-templates.md)).

| Mã | Tên đầy đủ | MST | Liên hệ | Mẫu |
|---|---|---|---|---|
| TTL | CÔNG TY TNHH SX & TM DV TÂN THÀNH LONG | 4101075030 | 097.557.3135 (Chị Yến) | accessory |
| MT | CÔNG TY TNHH TM-DV-TH MINH THẮNG | 4100942107 | 0935579589 (chị Loan) | accessory |
| TN | CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN | 4100577768 | 0914.412.818 (Cô Thu) | accessory |
| TP | CÔNG TY TNHH DV & TM TÂN PHÁT | — | 0982.049.880 (Chị Hoa) | accessory |
| ATP | CÔNG TY TNHH SX TM TH AN THÀNH PHÁT | 4101577898 | 0914.062.935 (anh Ánh) | accessory |
| STP | CÔNG TY CỔ PHẦN HAPPYCO | 3603421388 | 0909.525.400 | accessory |
| PQ | Doanh Nghiệp Tư Nhân PQ | 4100777083 | 0935772772 (Anh Ẩn) | accessory |
| WC | CÔNG TY CỔ PHẦN WECARE GROUP | 4101562154 | 0378.339.009 (chị Hương) | accessory |
| HH | CÔNG TY TNHH THIẾT BỊ CN HUY HOÀNG | 0901035551 | 0912.912.177 (Anh Hiếu) | accessory |
| CT | CÔNG TY TNHH XUẤT NHẬP KHẨU CÁT TƯỜNG | — | 0909460776 | accessory |
| THP | CỬA HÀNG TÂN HIỆP PHÁT | — | — | accessory |
| TĐ | Công Ty TNHH Nhôm Tiến Đạt | 3700775914 | 08 37291230 | aluminium |
| VEC | Công ty TNHH Aluminum Việt Eco | 2301031894 | 0949179881 (Sơn) | aluminium |
| TW | Công Ty TNHH Sản xuất thương mại Ngô Sơn | 1102022847 | 0931 468 214 (Thi) | aluminium |
| VY | Công ty TNHH Nhôm Việt Ý | 0107595790 | 0832322666 (Bích Ngọc) | aluminium |
| HGHN | Công ty CP SX và XNK nhôm Hoàng Gia | 0107595790 | — | aluminium |
| — | Công Ty TNHH Nhôm Taiwant | 1102022847 | 0931 468 214 (Thi) | aluminium |
| — | Công Ty TNHH Nhôm Đoàn Gia | — | 0931 468 214 (Thi) | aluminium |
| KVP | Công ty TNHH SX TM DV Kim Vĩnh Phú | 0311147703 | — | metal_kg |
| HTH | Công ty TNHH TM SX Hào Tư Hùng | 4100725409 | 0905 412 939 | metal_kg |
| GA | Công ty Gia Anh | — | 0978729965 (A. Tuyên) | metal_kg |
| NTL | Công ty TNHH SX-TM Nam Thuận Lợi | — | 086 264 0815 (Hiền) | metal_kg |
| AHP | CÔNG TY TNHH TM VÀ DỊCH VỤ ÂN HOÀN PHÁT | — | 0934970779 | metal_kg |
| — | Công ty TNHH SX TM DV Thông Đạt | 0313199295 | 0983 310304 | metal_kg |
| — | Công Ty TNHH đầu tư Thép Sơn Giang Thịnh | 0314261002 | 0909185797 | metal_kg |
| 3/2 | CÔNG TY CỔ PHẦN BAO BÌ 3/2 | 4200528940 | 0933358636 (Chị Hạnh) | carton |

Địa chỉ đầy đủ nằm trong DB — bảng này rút gọn cho dễ đọc. 22/26 có MST, 23/26 có
số điện thoại, 26/26 có địa chỉ.

## Quyết định đã chốt (01/08/2026) — mã dùng chung cho hai pháp nhân

`supply_suppliers.code` là UNIQUE, mà file gốc dùng một mã cho hai công ty (người
lập copy sheet cũ, sửa tên mà quên sửa số ĐH). Bốn ca, đã chốt và **ghi thành
`CODE_RULES` trong script** để chạy lại vẫn ra đúng:

| Mã | Giữ mã | Để trống (chờ Cung ứng đặt mã) | Căn cứ |
|---|---|---|---|
| `TĐ` | Nhôm Tiến Đạt (7 đơn) | Thông Đạt (inox, 2 đơn) | áp đảo về số đơn |
| `GA` | Gia Anh | Kim Vĩnh Phú → nhận mã riêng `KVP` | 1 sheet KVP ghi "ĐH: 01HG/KVP" |
| `TW` | Ngô Sơn | Taiwant · Đoàn Gia | Đoàn Gia là pháp nhân khác, mượn mã |
| `CT` | Cát Tường (10 đơn) | Thép Sơn Giang Thịnh | sheet "SƠN THỊNH" mượn mã |

NCC không có mã vẫn nạp đủ hồ sơ, `note` ghi rõ mã từng thấy trên đơn.

## Hai chỗ dữ liệu gốc mâu thuẫn — CẦN XÁC MINH

Script **không tự gộp**, nạp cả hai và đánh dấu trong `note`:

- **MST 0107595790** đứng tên cả `Nhôm Việt Ý` (3 đơn) lẫn `CP SX & XNK nhôm
  Hoàng Gia` (HG HN, 1 đơn) — địa chỉ y hệt nhau (Ô CN 11, CCN Nguyên Khê, Hà Nội).
- **MST 1102022847** đứng tên cả `SX TM Ngô Sơn` lẫn `Nhôm Taiwant`. Nhiều khả
  năng Taiwant là tên cũ/thương hiệu, Ngô Sơn là pháp nhân — nhưng chưa có giấy.

Đối chiếu hoá đơn rồi gộp tay là xong; gộp bừa theo MST thì mất hẳn một NCC.

## Việc còn treo: số ĐH `3/2026-HG/TTL`

Đã có mã viết tắt nên **sinh được** số ĐH theo nếp phòng, nhưng định dạng trong
file không thống nhất: `3/2026- HG/TTL` · `01 HG/TĐ` · `04/202 (HG-PQ)` · `HG/VEC`.
Phải chốt MỘT dạng chuẩn với phòng Cung ứng rồi mới thay `PO-YYYY-NNNN` hiện tại
— cố khớp cả bốn dạng thì không parse lại được.

## Ghi chú cho lần chạy lại

Script chịu được những chỗ bẩn sau (có comment trong file):

- Hai kiểu khối đầu sheet: nhãn + giá trị chung ô (mẫu cũ) và tách ô (mẫu mới).
- Dòng đầu sheet là hồ sơ Hoàng Gia — chặn cứng MST `4100644894`, chỉ đọc từ
  dòng "Kính gửi" trở xuống.
- Ô MST định dạng SỐ bị Excel nuốt số 0 đầu (`107595790`) → bù lại thành 10 số,
  không thì một NCC ra hai hồ sơ.
- Mã `3/2` của Bao bì 3/2 — cắt ở dấu "/" đầu thì thành `3`.
- Chỉ ĐIỀN Ô TRỐNG khi NCC đã tồn tại, không ghi đè dữ liệu người dùng đã sửa
  trên app.
