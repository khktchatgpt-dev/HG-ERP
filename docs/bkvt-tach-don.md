# Bảng kê vật tư của LSX → tách đơn theo NCC

Trạng thái: **khung xong, chờ UAT với dữ liệu thật** (01/08/2026).
Migration [`0108_lsx_material_plan.sql`](../supabase/migrations/0108_lsx_material_plan.sql)
**đã apply lên DB thật**.

## Mô hình thật (rà 8 file ở `E:\PO`)

Một LSX có một sheet **BKVT** liệt kê từng dòng:

```
Mã SP      Tên SP        Tên vật tư          ĐVT  đm/sp  SL   VTRL      SL đặt  Tồn  SL cần đặt  NCC
22024-217  Bàn Santorin  Nút nhựa vuông 76   Cái    4    50   Gót chân    200         206        TTL
22024-217  Bàn Santorin  Vít 4x15, 7 màu     Con   24    50               1200        1236       TN
```

Tức **BKVT = Σ (định mức của SP × số lượng SP đó trong lệnh)**; một LSX nhiều SP
thì các khối BOM xếp nối nhau, phân biệt bằng cột `Mã SP`. `đm/sp × SL = SL đặt`,
rồi `× 1,03` (hao 3%) ra `SL cần đặt`. **Đơn đặt hàng = lọc bảng đó theo cột NCC**
— LSX 04 ra 8 đơn cho 8 nhà cung cấp. Trước đây app bắt soạn tay từng đơn.

## Vì sao bảng riêng, không đọc thẳng định mức

- Cột NCC / tồn / hao / đơn giá là quyết định của **người mua cho riêng lệnh này**,
  không thuộc hồ sơ kỹ thuật của sản phẩm.
- `v_lsx_material_status` (BOM × SL − đã xuất) hiện trả **0 dòng**: định mức mới có
  66 dòng/4 SP và **0 dòng mang `material_code`** (đợt "định mức v2 — cấp CỤM" làm
  lại cấu trúc, bộ 6.910 dòng nạp hồi 26/07 không còn). Dựng màn trên nguồn đó thì
  mở ra trắng bảng.
- Hai nguồn cùng đổ vào một bảng (`source` = `excel` | `bom` | `manual`) nên khi
  định mức đủ, chỉ cần thêm nút "lấy nhu cầu từ BOM" — màn hình và nút tách đơn
  không phải viết lại.

## Đường đi

| Bước | Ở đâu |
|---|---|
| Nạp sheet BKVT từ file LSX | nút "Nạp từ file LSX" — đọc file **ngay trên máy người dùng** (`xlsx` nạp động), gửi dòng lên `POST /api/dept/supply/lsx-plan` |
| Dò vật tư & NCC | server: tên vật tư → `warehouse_materials` (bỏ dấu, chuẩn hoá khoảng trắng); mã NCC → `supply_suppliers.code` |
| Gán NCC / đánh dấu không mua | chọn nhiều dòng → `PATCH /api/dept/supply/lsx-plan` |
| Tách đơn | `POST /api/dept/supply/lsx-plan/split` → mỗi NCC một PO, gắn `production_order_id` |

Màn hình: [`/planning/lsx/[id]/bkvt`](../src/app/(workspace)/planning/lsx/%5Bid%5D/bkvt/BkvtManager.tsx),
vào từ thẻ "Vật tư & cung ứng" trong hồ sơ LSX (chỉ shell Kế hoạch — GĐ chỉ xem).

## Những chỗ cố ý làm khác cho khỏi mất dữ liệu

- **Vật tư ghi bằng cả hai**: `material_id` (nếu khớp kho) và `material_name`
  nguyên văn. File thật có tên chưa từng vào kho ("Pat xoay 3 lỗ vít, 7 màu") —
  bắt buộc khoá ngoại là mất dòng, mà mất dòng nghĩa là **quên mua**. Dòng chưa
  khớp vẫn hiện, đánh dấu đỏ, và **không tách đơn được** (dòng PO bắt buộc có
  `material_id`) → StatsBar có ô "Chưa khớp kho".
- **Cột NCC không phải lúc nào cũng là nhà cung cấp**: `HGIA` = xưởng tự làm rồi
  xuất đi xi, `TQ` = hàng Trung Quốc, `ĐỦ` = tồn đủ khỏi mua, `CHƯA MUA`. Vì thế
  `status` tách khỏi `supplier_id` — dòng "đã quyết" mà không sinh đơn nào.
- **Gộp theo vật tư trước khi tạo đơn**: cùng một con vít dùng cho 3 SP là 3 dòng
  bảng kê nhưng phải là MỘT dòng đơn (`poCreateSchema` cũng chặn trùng vật tư).
  Ghi chú dòng đơn giữ vết từng SP: `Bàn Santorin (4/sp) · XC Keros (2/sp)`.
- **Ô tồn bỏ trống = CHƯA TRA tồn**, không phải tồn 0 → vẫn đặt đủ. Đọc nhầm chỗ
  này là thiếu hàng cả lệnh.
- **Làm tròn LÊN** khi tính hao: 200 × 1,03 = 206 (file thật cũng 206). Làm tròn
  xuống là thiếu.
- **Nạp lại file đã sửa** thì thay hết dòng cùng nguồn, **trừ dòng đã vào đơn** —
  đơn đang chạy còn trỏ vào nó (`po_line_id`).
- **Mẫu đơn** của mỗi NCC lấy theo mẫu chiếm đa số trong vật tư của nhóm; không
  vật tư nào khai thì `accessory` — BKVT là bảng kê phụ kiện/ngũ kim, mẫu phụ kiện
  có sẵn đúng bộ cột đm/sp · SL · tồn · hao.

## Đã kiểm trên file thật

Parser chạy đúng cả hai kiểu bố cục (`npm run check` sạch, 675 test):

| File | Sheet | Kết quả |
|---|---|---|
| `LSX 04 + BẢNG KÊ VT.xlsx` | BKVT | 41 dòng · 2 SP · 41 dòng có NCC (`TTL · HGIA · TN · TQ · MT · HAPPYCO · ATP · HÀO · WC`) |
| `THEO DÕI VẬT TƯ - LSX 02.26.xlsx` | BKVT | 153 dòng · 9 SP · **0 dòng có NCC** — file này không có cột NCC, dòng về trạng thái "chưa quyết" |

Parser **bám tiêu đề cột chứ không bám vị trí**: hai file đặt cột khác nhau và gõ
khác nhau (`SL/ĐH` vs `SL`, `Đm/sp` vs `đm/sp`, `SL dặt hàng` — thiếu dấu). Mã SP
chỉ ghi ở dòng đầu mỗi khối rồi bỏ trống → kế thừa dòng trên.

## UAT ngày 01/08 — chạy hết luồng với dữ liệu thật

Nạp sheet BKVT của `LSX 04` (41 dòng) vào một LSX, gán NCC, bấm tách đơn:

| Bước | Kết quả |
|---|---|
| Nạp file | 41 dòng · 37 tự gán NCC theo mã viết tắt · 4 vào trạng thái không mua (TQ, HGIA) |
| Khớp danh mục kho | 28/41 (13 dòng tên mơ hồ — `Vít 4x15` có 7 biến thể trong kho) |
| Tách đơn | **6 đơn đặt** (PO-2026-0004…0009), 20 dòng, mẫu `accessory`, vào thẳng `pending_approval` |
| Sau tách | 25 dòng bảng kê mang trạng thái "đã vào đơn" + `po_line_id`, nút còn "Tách 0 đơn" |

Dữ liệu UAT đã xoá sạch sau khi kiểm (6 đơn + 20 dòng + 41 dòng bảng kê + 78 thông báo).

Hai điều rút ra:
- Tách 6 đơn mất **~13 giây** (tạo tuần tự, mỗi đơn kèm notify Giám đốc). Nút có
  spinner nhưng nên gộp notify hoặc chạy song song nếu lệnh nhiều NCC hơn.
- Trang cần **tải lại** mới thấy trạng thái mới: `router.refresh()` chạy trước khi
  loạt đơn tạo xong.

## Việc còn lại

- **Đối chiếu tiền với sheet `Tổng hợp ĐH`** của chính file LSX 04 (file có sẵn
  tổng thanh toán từng đơn: TTL 2.628.601 · MT 4.220.284 · TN 17.500.055…). UAT
  vừa rồi mới kiểm số dòng, chưa kiểm tiền vì bảng kê không có đơn giá.
- **13 dòng tên mơ hồ** đã có đường xử: nút "chọn vật tư" ngay trên dòng. Còn
  thiếu chiều ngược lại — tạo nhanh vật tư mới từ dòng khi kho thật sự chưa có
  (`LĐN 8x20x15` không tồn tại, kho chỉ có x10/x2/x5).
- **Ghi ngược `đm/sp` vào định mức SP** (user chốt 01/08: có, nhưng phải duyệt
  từng SP) — chưa làm; mỗi dòng BKVT chính là một dòng định mức nên đây là cách
  lấp dần phần ngũ kim/phụ kiện đang trống.
- **Nguồn `bom`**: nút "lấy nhu cầu từ định mức" — bật khi định mức đã nạp lại.
