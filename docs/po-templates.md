# Mẫu đơn đặt hàng theo loại hàng

Trạng thái: **đã làm xong khung + 5 mẫu, chờ UAT** (31/07/2026).
Nhánh: `feat/po-templates`. Migration `0106_po_templates_and_dies.sql` **đã apply lên DB thật**.

## Vấn đề gốc

Form tạo đơn cũ ([PoCreateForm](../src/app/(workspace)/planning/pos/new/PoCreateForm.tsx))
nhồi mọi loại hàng vào **một bảng 10 cột `min-w-[940px]`**, và bắt nhân viên đi
đường vòng: sang vùng "nhu cầu" bên trái → gõ lọc → bấm `+` → quay lại bảng nhập số.
Ô tìm từ kho còn bị `slice(0, 6)` nên gõ đúng tên vẫn có thể không thấy.

Nhưng vấn đề lớn hơn UI: **mô hình sai nghiệp vụ**. Rà 8 file đơn đặt thật của
phòng Cung ứng (thư mục `E:\PO` — mỗi file 1 LSX, mỗi sheet NCC là 1 đơn) cho thấy
Hoàng Gia **không dùng một mẫu đơn**. Có 5 mẫu khác nhau cả bộ cột dòng hàng, công
thức thành tiền, VAT, điều khoản lẫn khối chữ ký.

## 5 mẫu

| Mẫu | NCC tiêu biểu | Cột nhập riêng | Thành tiền | VAT | Chiết khấu | Chữ ký giữa |
|---|---|---|---|---|---|---|
| `accessory` | TTL, MT, TN, TP, ATP, PQ, HAPPYCO | vật liệu · đm/sp · quy cách · SL ĐH · tồn · HH% | SL đặt × giá | 8% chưa gồm | có | Người Lập |
| `aluminium` | Việt ECO, Tiến Đạt, Cát Tường, Taiwan, Việt Ý | mã khuôn · **kg/m** · dài cây (m) · cây dư | (kg/m × dài × cây) × giá/kg | 10% chưa gồm | không | TP KẾ HOẠCH |
| `metal_kg` | Kim Vĩnh Phú, Hào Tư Hùng, Thông Đạt | vật liệu · kích thước · màu/bề mặt · **kg/đv** | (SL × kg/đv) × giá/kg | 10% đã gồm | không | TP KẾ HOẠCH |
| `carton` | Bao bì 3/2 | cách mở AD/MR · pcs/ctn · D×R×C lọt lòng · m² | thùng × giá/thùng **hoặc** m² × giá/m² | 8% chưa gồm | không | Người Lập |
| `simple` | — | quy cách | SL × giá | 10% đã gồm | không | Người Lập |

`carton` cho chọn cơ sở tính tiền **từng dòng** (user chốt) vì NCC chào lẫn lộn hai kiểu.

Công thức m²/thùng lấy đúng từ file, khác nhau theo cách mở (D/R/C = lọt lòng, mm):

- `AD`: `((D+2C)×(R+2C) + (D+2C+20)×(R+2C+20)) / 10⁶`
- `MR`: `((D+2C)×(R+2C−10)) × 2 / 10⁶`

## Thiết kế

**Không có trục tính tiền thứ hai.** Mọi mẫu vẫn quy về `poLineAmount` sẵn có —
`price_basis` `'unit'` (SL × giá) hoặc `'unit2'` (qty2 × giá, unit2 = kg/m²).
[`deriveLine()`](../src/lib/po-template.ts) chỉ dịch ô nhập của mẫu thành
`(qty_ordered, qty2, unit2, price_basis)`. Nhờ vậy **đơn cũ (`simple`) không đổi một
đồng nào**, và không phải viết lại logic tiền cho từng mẫu.

Server **tự dẫn xuất lại** `qty2/price_basis` trong `pos.service.ts` chứ không tin
số client gửi — nếu không, một request thủ công có thể ghi tổng kg không khớp
`kg/m × dài × cây` rồi đi thẳng qua bàn duyệt của Giám đốc.

Thiếu thông số quy đổi (chưa khai kg/m) thì `deriveLine` trả `'unit'` chứ **không**
trả `qty2 = 0`: dòng tính sai rõ ràng và nhân viên thấy ngay, hơn là im lặng ra
thành tiền 0.

### Form

**Một form duy nhất cho tạo / sửa / nhân bản.** `PoCreateForm` nhận `initial`
(`mode: 'edit' | 'duplicate'`); `/planning/pos/[id]/edit` dựng nó từ
`posService.detail`, `?duplicate=1` thì lưu thành đơn mới.

Trước đây `PosManager` có form sửa RIÊNG trong modal theo mô hình cũ (~645 dòng,
bảng cột cứng, không biết mẫu đơn). Sửa một đơn nhôm bằng form đó sẽ hạ mẫu về
`simple`, xoá kg/m + dài cây, và thành tiền tụt từ (tổng kg × giá/kg) xuống
(số cây × giá/kg) — sai ~6 lần, im lặng. Đã xoá hẳn form đó; `PosManager` giờ
điều hướng sang trang soạn đơn (1621 → 818 dòng, trang danh sách cũng thôi nạp
1.000 vật tư + 200 LSX vốn chỉ để nuôi cái modal).

Hồi quy khoá bug này: `src/app/(workspace)/planning/pos/new/po-line.test.ts` —
mở đơn đã lưu ra sửa phải cho lại ĐÚNG số tiền cũ, cả 5 mẫu.

`poUpdateSchema` bỏ `.default('simple')` cho `template`: khi tạo, không khai thì
là `simple`; khi sửa, không khai phải là "giữ nguyên mẫu cũ".

Chọn LSX → chọn mẫu → chọn NCC. Bảng tự đổi cột theo mẫu. Ô **nền xám** là số hệ
thống tự tính (tổng kg, m², thành tiền) — không gõ được. Hai ô luôn phải gõ là
**SL đặt** và **Đơn giá**. Dòng nhập nhanh nằm cuối bảng: chọn vật tư xong con trỏ
ở lại ô tìm nên thêm dòng liên tiếp không rời bàn phím.

Vật tư **tìm ở server** (`/api/dept/supply/po-materials`), lọc theo mẫu đang soạn,
vật tư chưa khai mẫu vẫn hiện nhưng **xếp sau** (`order po_template nullsFirst:false`
— thiếu dòng này thì danh sách mẫu nhôm toàn hoá chất chưa khai vì sắp theo mã).
Trang cũ nạp sẵn 1.000 vật tư + toàn bộ tồn + 500 PO ngay ở server render; nay chỉ
nạp NCC + LSX.

## Danh mục khuôn nhôm

`technical_dies` — 136 khuôn từ sheet `KHUÔN`. `kg/m` là thuộc tính của **khuôn**,
không phải của vật tư; chọn mã khuôn trên dòng là tự có kg/m.

```bash
node scripts/dies-import.mjs "E:/PO/YOTRIO-01-BIỂU MẪU TÍNH NHÔM ĐẶT NCC.xlsx" --reset
```

Những chỗ file gốc "bẩn" mà script phải chịu được (xem comment đầu file):

- Dòng lệch cột (kg/m nằm ở cột ĐVT).
- `"0,714/ 6 mét"` = khối lượng **cả cây 6 m**, phải chia ra 0,119 kg/m. Đối chiếu
  hình học: La 22×2 mm² × 2,7 g/cm³ = 0,119 — khớp.
- Dấu phẩy lúc là ngăn nghìn (`13,500,000`), lúc là thập phân (`0,714`) → `num(v, mode)`
  bắt gọi phải khai, không đoán từ hình dạng chuỗi.
- `\bhư\b` **không** dùng được: regex JS không cờ `u` coi "ư" không phải word-char
  nên `\b` không khớp và mọi dòng khuôn hư đều lọt lưới.
- Cùng mã nhiều đời (mở lại / bỏ gân / tăng dày) khác kg/m → `is_current` đánh dấu
  đời đang dùng.
- Dưới bảng khuôn cùng sheet còn bảng tra + khối công thức → dừng khi gặp 5 dòng
  trống liên tiếp.

## Đã verify

`npm run check` sạch (typecheck + lint 0 lỗi + 648 test).

Số trong `src/lib/po-template.test.ts` lấy **từ đơn thật**, không bịa — mỗi case ghi
rõ nguồn để sau này sửa công thức còn đối chiếu với giấy đang ký:

- Nhôm, Việt ECO LSX 01 dòng 1: 0,248 kg/m × 5,65 m × 273 cây → 382,5276 kg ×
  102.000 = **39.017.815** (khớp file).
- Inox, Kim Vĩnh Phú dòng 1: 9,325 kg/cây × 20 → 186,5 kg × 73.200 = **13.651.800**.
- Phụ kiện, TTL dòng 1: 206 × 2.000 = **412.000**.
- Carton AD 660×660×120 → **1,6564 m²**; MR 655×250×35 → **0,4495 m²**.
- Cột "SL cần đặt (hh 3%)": 200 → 206, 400 → 412, 1200 → 1236.

Verify tay trên preview: cả 5 mẫu đổi đúng cột + VAT + chiết khấu; chọn khuôn
`VEC-B768` tự điền 0,257 kg/m; phiếu in nhôm ra đúng 39.017.815 với đủ điều khoản
và khối chữ ký "TRƯỞNG PHÒNG KẾ HOẠCH".

## Còn lại / lưu ý

- **`warehouse_materials.kg_per_m`**: nhóm "Nhôm" có sẵn 252/276 dòng, nên phần lớn
  dòng nhôm tự điền được kg/m ngay khi chọn vật tư; 24 dòng còn lại tra qua ô chọn
  khuôn hoặc gõ tay. Nhóm "Sắt"/"Inox" thì gần như trống (1/232) — mẫu `metal_kg`
  vốn nhập kg/đơn-vị theo phiếu cân của NCC nên không chặn.
  (Cột `kg_per_m` + `default_bar_length_m` có trên DB nhưng KHÔNG migration nào
  trong repo tạo ra — ai đó thêm qua SQL editor.)
- **`item_categories` (migration 0042/0043) chưa từng được apply lên DB thật** —
  bảng không tồn tại, `warehouse_materials` cũng không có `category_id`. Grouping
  đang chạy thật vẫn là cột text `group_name`. Vì vậy `po_template` gắn thẳng lên
  `warehouse_materials`.

- **Phân loại mẫu theo `group_name` (0106) đoán sai 2 chỗ, đã vá ở `0107`:**
  "Khuôn nhôm" (169) bị gán `aluminium` vì khớp `%nhôm%` — nhưng mua khuôn là mua
  **bộ khuôn**, giá theo bộ, không có kg/m (0/169 dòng có `kg_per_m`, trong khi
  nhóm "Nhôm" là 252/276), và mẫu nhôm bắt buộc kg/m + dài cây mới cho gửi đơn →
  chuyển về `simple`. 64 vật tư chưa khai (Mây-dây, Kính, Sơn, Hoá chất, Gỗ) →
  `simple`, riêng "Ngũ kim" → `accessory`. Sau vá: nhôm 276 · inox/sắt 232 ·
  simple 230 · phụ kiện 124 · carton 52, không còn dòng nào chưa khai.
  ⚠️ Đừng nhầm `technical_dies` (danh mục khuôn, để TRA kg/m khi đặt nhôm cây) với
  nhóm vật tư "Khuôn nhôm" (mặt hàng khuôn để MUA).
- Chưa làm: trục **BKVT → gán NCC → tách đơn theo NCC** (mô hình thật trong file
  Excel: đơn hàng = bảng kê vật tư lọc theo cột NCC). Hiện vẫn soạn từng đơn một.
- Chưa làm: cột theo dõi về hàng ngay trên đơn (`Ngày về / SL / Số kg / Còn lại`)
  mà mẫu nhôm và inox có sẵn trong file.
- Số ĐH vẫn là `PO-YYYY-NNNN`, chưa theo dạng `3/2026-HG/TTL` (cần mã ngắn NCC).
