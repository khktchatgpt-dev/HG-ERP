# Giai đoạn 1 — Danh mục vật tư suy từ định mức

Nguồn: 9.705 dòng định mức của 280 sản phẩm trong
`DATABASE_SP/CSV/dinh_muc_vat_tu.csv`. Chạy ngày 2026-07-25.

Kết quả: [`4-danh-muc-vat-tu.csv`](import-templates/4-danh-muc-vat-tu.csv) (2.039
vật tư) và [`4b-vat-tu-can-ra-tay.csv`](import-templates/4b-vat-tu-can-ra-tay.csv)
(349 dòng không tự sinh được mã).

---

## 1. Kết quả

| Nhóm | Số vật tư | Dùng chung ≥2 SP | Ghi chú |
|---|---|---|---|
| KHUNG | 777 | 49% | Tin cậy cao, sinh mã tự động hoàn toàn |
| VẬT TƯ / phụ kiện | 645 | 38% | Chỉ 79 mã gom tự động được, còn lại rà tay |
| NỆM & VẢI | 237 | 23% | Gần như đặt riêng theo SP |
| GỖ / POLYWOOD | 227 | 26% | Gần như đặt riêng theo SP |
| BAO BÌ | 122 | 13% | Thùng carton làm riêng từng SP |
| KHÁC / DÂY ĐAN | 31 | 0% | |
| **Tổng** | **2.039** | | **1.183 mã cần rà tay** |

Con số này **cao hơn nhiều so với ước lượng 400–600** tôi đưa lúc lập kế hoạch.
Lý do ở mục 3.

## 2. Quy tắc sinh mã

**Khung** — danh tính là *vật liệu + dạng + tiết diện + độ dày thành*. Chiều dài
không tính vào mã vì đó là kích thước cắt, thuộc về dòng định mức:

```
VT-AL-HOP-20x40x1      Ống nhôm hộp 20×40 dày 1      (56 sản phẩm dùng)
VT-AL-TRON-D16x1       Ống nhôm tròn Ø16 dày 1       (30 sản phẩm)
VT-AL-VUONG-D20x1      Ống nhôm vuông 20 dày 1       (30 sản phẩm)
VT-AL-LA-4x20          La nhôm 4×20                  (34 sản phẩm)
VT-IR-HOP-20x40x0.8    Ống sắt hộp 20×40 dày 0.8     (22 sản phẩm)
VT-AL-PF-TDHG04        Profile nhôm theo mã khuôn
```

Vật liệu suy từ mã vật liệu của **sản phẩm** chứa dòng đó, vì cột vật liệu trên
dòng định mức chỉ điền 15%. Đây là một **giả định**: chi tiết trong sản phẩm nhôm
được coi là nhôm. Nếu thực tế có sản phẩm nhôm dùng vài chi tiết sắt thì phải sửa
tay — dữ liệu hiện không phân biệt được.

**Phụ kiện** — chỉ gom tự động 4 họ có quy cách rõ ràng: bu lông, tán rút, lông
đền, vít. Ví dụ `VT-PK-BULONG-M6X20` gom đúng 81 dòng viết 6 kiểu khác nhau
(`Bulon m6x20`, `Bulong chân trước(M6x20)`, `Bulon M6 x 20`…).

Cố ý **không** gom "tán dù", "tán cấy", "tán keo" chung với "tán rút" — đó là các
loại tán khác nhau. Nguyên tắc áp dụng xuyên suốt: **thà dư mã còn hơn gộp nhầm
hai vật tư khác nhau**, vì gộp nhầm thì đặt mua sai mà không ai phát hiện.

## 3. Vì sao số vật tư cao hơn dự kiến

**63% vật tư chỉ được đúng một sản phẩm dùng.** Chỉ 169 vật tư được từ 5 sản phẩm
trở lên dùng chung.

Tách theo nhóm thì thấy rõ hai bản chất khác nhau:

- **Khung và phụ kiện** có dùng chung thật (49% và 38%). Ống nhôm hộp 20×40 dày 1
  xuất hiện ở 56 sản phẩm. Đây **đúng là danh mục tồn kho**, mua theo quy cách.
- **Nệm, gỗ, bao bì** hầu như mỗi sản phẩm một kiểu (13–26%). Nệm 6×52×54 chỉ
  dùng cho đúng một cái ghế; thùng carton cũng đóng riêng từng sản phẩm.

**Đề xuất**: chỉ đưa **khung + phụ kiện (khoảng 1.400 mã)** vào danh mục vật tư
kho — đó là thứ thực sự đặt mua theo quy cách và cần theo dõi tồn. Nệm, gỗ, bao bì
nên là **hàng đặt theo sản phẩm**: hoặc chỉ khai loại chung (vải X, nệm dày Y, giấy
carton 5 lớp) rồi ghi kích thước ở dòng định mức, chứ không dựng mỗi kích thước
thành một mã tồn kho.

Cần bạn quyết hướng này trước khi nạp, vì nó đổi hẳn quy mô danh mục.

## 4. Vấn đề dữ liệu phát hiện thêm

**Cột phân nhóm trong file không tin được.** Đã gặp `bulon m6x15` nằm trong nhóm
"NỆM & VẢI" và `Bàn`, `Bọ bắt nhựa trượt` nằm trong nhóm "GỖ / POLYWOOD". Vì vậy
bộ sinh mã ưu tiên nhận diện theo **tên chi tiết**, bất kể nhóm khai là gì.

**Một mã khuôn viết nhiều kiểu.** `TD-HG04` / `td-hg04` / `TD HG04` là một; tương
tự `DT-BD-02` / `DT- BD 02` / `DTBD-02`. Đã gom bằng cách bỏ hết dấu ngăn — 7 mã
khuôn được gom lại từ nhiều cách viết. Tổng cộng 94 mã khuôn.

**Tên bao bì đôi khi chỉ là kích thước.** Có dòng tên là `1190*75*1205`, không có
tên hàng. Không suy được đó là thùng, xốp hay giấy.

**349 dòng không sinh được mã** — chủ yếu là dòng khung thiếu dạng profile hoặc
thiếu tiết diện. Danh sách đầy đủ kèm lý do ở
[`4b-vat-tu-can-ra-tay.csv`](import-templates/4b-vat-tu-can-ra-tay.csv).

## 5. Việc tiếp theo

1. **Bạn quyết phạm vi danh mục** (mục 3) — chỉ khung + phụ kiện, hay cả 2.039.
2. **Kho duyệt 777 vật tư khung** — phần này tin cậy nhất, duyệt xong nạp được ngay.
3. **Rà 1.183 mã cần rà tay**, ưu tiên theo cột `so_san_pham` giảm dần: vật tư
   nhiều sản phẩm dùng thì rà trước, vật tư chỉ 1 sản phẩm để sau.
4. **Bổ sung cột quy cách** cho `warehouse_materials` (dạng, tiết diện, độ dày
   thành, khối lượng trên mét) — hiện chưa có chỗ chứa. Lưu ý migration `0043`
   chưa apply nên bảng còn thiếu cả cột khối lượng và kích thước.

Cột `cac_cach_viet_goc` trong file danh mục liệt kê các cách viết gốc đã gom vào
mỗi mã — dùng để kiểm tra xem có gom nhầm không.
