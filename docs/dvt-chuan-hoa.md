# Chuẩn hoá ĐVT — bảng duyệt

Nguồn: 14 sổ vật tư trong `1. So vat tu (master)` trên Drive.
Quét **12177** vật tư, gặp **131** cách viết ĐVT.

Đề xuất gom về **55** đơn vị chuẩn. CHƯA ghi gì vào đâu.

## Gộp được — nghĩa không đổi

| ĐVT chuẩn | SL | Cách viết đang gặp (gộp vào) |
|---|---:|---|
| **Cái** | 5476 | `cái` · `caí` |
| **Kg** | 1727 | `kg` · `Ký` |
| **Con** | 1027 | `con` |
| **Tấm** | 641 | `tấm` |
| **Bộ** | 573 | `bộ` · `bô` · `Set` |
| **Mét** | 398 | `mét` · `m` · `met` |
| **M³** | 314 | `m3` |
| **Cuộn** | 258 | `cuộn` |
| **Thùng** | 234 | `thùng` |
| **Cây** | 196 | `cây` |
| **Dây** | 138 | `dây` |
| **Vòng** | 115 | `vòng` |
| **Mũi** | 92 | `mũi` |
| **Lon** | 87 | `lon` |
| **Ổ** | 80 | `ổ` |
| **Bì** | 67 | `bì` · `BÌ` |
| **M²** | 65 | `m2` |
| **Thanh** | 63 | `thanh` |
| **Hộp** | 61 | `hộp` |
| **Tờ** | 57 | `tờ` |
| **Chai** | 57 | `chai` |
| **Nhãn** | 46 | `nhãn` |
| **Viên** | 41 | `viên` · `VIên` |
| **Sợi** | 35 | `sợi` |
| **Lít** | 34 | `lít` · `lit` |
| **Chiếc** | 31 | `chiếc` |
| **Can** | 24 | `can` |
| **Vỉ** | 21 | `vỉ` |
| **PCS** | 17 | `pcs` |
| **Lô** | 17 | `lô` |
| **Đôi** | 15 | `đôi` |
| **Cặp** | 12 | `cặp` |
| **Ống** | 10 | `ống` |
| **Bó** | 9 | `bó` |
| **Phuy** | 9 | `phi` |
| **Xô** | 8 | `xô` |
| **Thẻ** | 7 | `thẻ` |
| **Yard** | 6 | `YARD` · `YDS` |
| **Khúc** | 5 | `khúc` |
| **Bình** | 5 | `bình` |
| **Cục** | 4 | `cục` |
| **Lưỡi** | 4 | `lưỡi` |
| **Inch** | 4 | `inch` |
| **Miếng** | 3 | `miếng` |
| **Bịch** | 2 | `bịch` |
| **Tem** | 2 | `tem` |
| **Túi** | 2 | — (đã chuẩn) |
| **Bánh** | 2 | — (đã chuẩn) |
| **Hột** | 2 | `hột` |
| **Quyển** | 2 | `quyển` · `sổ` |
| **Lá** | 1 | `lá` |
| **Chụp** | 1 | `chụp` |
| **Bao** | 1 | `bao` |
| **Lọ** | 1 | `lọ` |
| **Lố** | 1 | `lố` |

## KHÔNG gộp — cần người quyết (14 ca)

| Giá trị | SL | Vấn đề | Ví dụ |
|---|---:|---|---|
| `(trống)` | 1 | ô trống | BUL0334 LDE M6x16x1 |
| `Nắp bàn cầu` | 1 | LỆCH CỘT — giá trị này là tên hàng, dòng bị hỏng | LKT0001 Nan 100x1150x20,thanh,"Linh kiện |
| `Thùng 18 lit` | 1 | đơn vị KÈM QUY CÁCH → Thùng, đưa "18 lít" vào tên/quy cách | MAY0010 Dầu máy nén khí CS 46+ 18L |
| `Thùng 9L` | 1 | đơn vị KÈM QUY CÁCH → Thùng, đưa "9L" vào tên/quy cách | MAY0011 Dầu máy nén khí CS 46+ 9L |
| `lon/1kg` | 1 | đơn vị KÈM QUY CÁCH → Lon, đưa "1kg" vào quy cách | SAT0941 Hộp kẽm 13x26x0.8x6000mm |
| `5KG/T` | 2 | đơn vị KÈM QUY CÁCH → Thùng 5kg | SON0129 Sơn lót kháng kiềm Nanox |
| `cont` | 4 | CONTAINER — dòng này là phí vận chuyển, không phải vật tư | BUL0162 Phí hàng nhập tán rút TQ |
| `CNT` | 2 | CONTAINER — như trên | SAT0710 Vận chuyển thép cuộn |
| `bo` | 1 | không rõ (dòng "Phí hàng nhập") — nhiều khả năng cũng là phí | NHO0277 Phí hàng nhập tán rút nhôm |
| `MTK` | 21 | KHÔNG RÕ — hàng vải Textilen, cần hỏi phòng (mét tới? m²?) | VAI0085 Vải Textilen dệt phủ nhựa, màu x |
| `cal` | 4 | KHÔNG RÕ — hàng nhớt, gallon hay can? | MOB0021 Nhớt cầu 140-4 lít |
| `cài` | 1 | gõ nhầm — "cái" hay "cài"? | BOM0025 Bơm lá thủy lực VP-F30D |
| `cá` | 1 | gõ nhầm — cánh quạt bơm, chắc là "cái" | BOM0031 Cánh quạt máy bơm nước hồ xủ lý  |
| `ve` | 2 | KHÔNG RÕ — keo ron, "vòi"? "vỉ"? | KEO0082 Keo ron lớn |

## Dòng DỊCH VỤ / PHÍ lẫn trong sổ vật tư (6)

Không phải vật tư kho. Nhập thô là sinh ra "mặt hàng tồn kho" tên "Cước vận
chuyển kính" — Kho không bao giờ nhập/xuất được nó.

| ĐVT | SL | Ví dụ |
|---|---:|---|
| `lần` | 1 | Phí phát triển khuôn |
| `chuyến` | 1 | Cước vận chuyển vải |
| `báo cáo` | 1 | Phí kiểm định test vải |
| `bill` | 1 | Phí hàng nhập kính |
| `cont 20'` | 1 | Cước vận chuyển kính |
| `Máy` | 1 | Đại tu đầu nén máy airman |

## Chưa xếp vào đâu (18)

- `Thanh trượt HGR20-4000` × 1 — LKT0002 Sóng hở 3T1 dương,cái,"Linh kiện
- `Đầu chuyển M16x1.5 và EU 35x50` × 1 — LKT0003 Vận chuyển bậc thang 3 ly,tấm,"L
- `Bas I ghế 5 bậc Naxos` × 1 — LKT0015 Vận chuyển thanh nhựa nan Polywo
- `Bọ số 5` × 1 — LKT0016 Bán thành phẩm N5B1 mới màu 182 
- `Ngũ kim High Dining` × 1 — LKT0020 Mặt bàn,cái,"Linh kiện thành phẩ
- `max` × 1 — NUT0022 Nút bóp 4 phân
- `Đầu bắn tol` × 1 — LKT0021 Tấm lót mặt bàn bộ sofa love sea
- `thang` × 1 — PKN0137 Pát I Inox(Riva)
- `Món` × 1 — PKN0194 Pát liên kết mê
- `cai` × 1 — BAO0392 Palet 1mx1m2
- `Nhan` × 1 — BAO0491 Nhãn nệm
- `mm` × 1 — TEM0002 TEMPERED FROSTED
- `len` × 1 — KEO0044 Keo 300g
- `vĩ` × 1 — KEO0051 Keo AB Thái
- `vi` × 1 — KEO0103 Keo AB thái(dán sắt)
- `bánh` × 1 — VAI0215 Nỉ xám 1T mỏng đế nhựa
- `cái/ bộ` × 1 — GO0048 Phần gỗ ghế 5 bậc Capri
- `tam` × 1 — KIM0023 Kính 5mm trắng cường lực phun mờ
