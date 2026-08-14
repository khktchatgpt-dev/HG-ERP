# Sổ đơn hàng của Giám đốc — thiết kế lại theo chuỗi Khách → Đơn → Lệnh → Vật tư

Trạng thái: chốt 14/08/2026. Bổ sung cho [exec-v2-ky-duyet-plan.md](exec-v2-ky-duyet-plan.md)
(§8.6 từng hỏi "trả `/exec/orders` về phòng hay xoá" — câu trả lời của chủ dự án
là **giữ cho GĐ nhưng làm lại**: sổ hiện tại là một danh sách dài không phân
loại, không trả lời được "khách này có bao nhiêu đơn").

## 1. Nghiệp vụ — chuỗi 4 tầng (đo từ dữ liệu thật 14/08/2026)

```
KHÁCH HÀNG (3)
  └── ĐƠN HÀNG (20) — mã PO của khách, tiền tệ, hạn giao   [sales_orders]
        └── LỆNH SẢN XUẤT (8) — 1 lệnh GỘP nhiều đơn cùng khách (0113)
              └── ĐƠN MUA VẬT TƯ (0) — theo lệnh; 1 đơn mua có thể
                  gộp thêm lệnh phụ (0125: supply_po_extra_lsx)
```

Ba khách hiện tại cho thấy đủ ba kiểu quan hệ:

| Khách | Đơn | Lệnh | Kiểu |
|---|---|---|---|
| ROSCO | 13 | 1 | **nhiều đơn → một lệnh** (lệnh `01/26-27 - ROSCO` gộp 13 đơn PT-138-*) |
| MERXX | 4 | 4 | một đơn → một lệnh |
| YOTRIO | 3 | 1 | nhiều đơn → một lệnh |

### Vấn đề của sổ cũ

Sổ cũ đổ phẳng **20 thẻ đơn** từ `v_order_tracking`, mỗi đơn một thẻ ngang nhau:

- ROSCO chiếm **13 thẻ gần giống hệt nhau** — cùng khách, cùng lệnh, cùng trạng
  thái. Đó chính là cái "sổ rất dài" mà chủ dự án phàn nàn.
- Không trả lời được câu hỏi tự nhiên nhất của GĐ: *khách này có bao nhiêu đơn,
  tổng bao nhiêu tiền, lệnh chạy tới đâu, vật tư mua tới đâu* — vì đơn vị hiển
  thị là ĐƠN, trong khi câu hỏi đặt theo KHÁCH và theo LỆNH.
- Duyệt LSX tại chỗ trong panel — trùng vai với Hộp ký (từ 14/08).

## 2. Thiết kế mới — sổ phân tầng theo đúng chuỗi

Đơn vị hiển thị = **KHÁCH HÀNG** (3 mục thay vì 20). Mỗi khách mở ra các
**LỆNH SX** của khách đó; mỗi lệnh liệt kê **các đơn** nó gộp + tiến độ sản
xuất + tình hình vật tư. Nhìn một khối là thấy nguyên chuỗi Đơn → Lệnh → Mua.

```
┌ KPI: sổ đang chạy · đang SX · chờ duyệt · sắp giao · nguy cơ trễ · trễ hạn ┐
├ Tìm kiếm · chip lọc (Tất cả / Chờ duyệt / Đang SX / Nguy cơ trễ / Chờ giao)┤
│                                                                            │
│ ▼ ROSCO ──────────────── 13 đơn · 0 USD · ⚠ 2 trễ ─────────────────────── │
│    ┌ LỆNH 01/26-27-ROSCO  [Đã duyệt]  SX 0/13 việc · vật tư: chưa có đơn ┐│
│    │   PT-138-155-HG   45 SP   0 USD    giao 11/01/27   ⚠ trễ            ││
│    │   PT-138-156-HG   …                                                 ││
│    └──────────────────────────────────────────── Mở hồ sơ lệnh → ────────┘│
│ ▶ MERXX HANDELS GMBH ──── 4 đơn · 4 lệnh · 0 USD ───────────────────────  │
│ ▶ YOTRIO GROUP ─────────── 3 đơn · 1 lệnh · 0 USD ──────────────────────  │
└────────────────────────────────────────────────────────────────────────────┘
```

Quyết định thiết kế:

1. **Bỏ duyệt tại chỗ.** Duyệt là việc của Hộp ký; sổ này để XEM và đi sâu.
   Bấm lệnh → `/exec/lsx/[id]` (hồ sơ lệnh đầy đủ, duyệt được ở đó nếu cần).
2. **Vật tư hiện theo lệnh, hai con số tách bạch** (0133): `pos_open` = đơn đã
   duyệt đang về, `pos_unsent` = còn nháp/chờ ký — "đang về 2 · chưa gửi 1".
   Chưa có đơn nào thì ghi thẳng "chưa có đơn vật tư" thay vì số 0 câm.
3. **Đơn chưa phát lệnh** gom vào nhóm riêng trong khách — GĐ thấy ngay đơn nào
   còn nằm ngoài sản xuất.
4. **Lọc áp vào ĐƠN, cấu trúc giữ nguyên**: lọc "nguy cơ trễ" thì khách/lệnh chỉ
   hiện những đơn dính lọc; khách không còn đơn nào thì ẩn cả khối.
5. Khách xếp theo **tổng giá trị giảm dần**, trong khách lệnh xếp theo mã.

Dữ liệu: vẫn `v_order_tracking` (đủ mọi cột cần), nhóm ở client — 20 hay 500
đơn đều nhẹ. Không cần migration, không cần service mới.

## 2b. Vòng 2 (15/08/2026) — "đang tắc ở đâu" thay cho "chạy được bao xa"

Vòng 1 gom đơn theo khách, hết cảnh 13 thẻ ROSCO giống nhau. Nhưng mở ra vẫn
chưa trả lời được câu quan trọng nhất. Đo lại toàn bộ 20 đơn đang mở:

| Chỉ số | Kết quả |
|---|---|
| Nhãn tiến độ | **20/20 đơn** cùng hiện "Chuẩn bị sản xuất 15%" |
| Dòng SP chưa chốt định mức | **69/71** |
| Đơn mua vật tư | 0 |
| Công đoạn SX đã lên lộ trình | 0 |
| Đơn thiếu hạn giao | **7/20** |
| Đơn thiếu đơn giá | 20/20 |

`orderProgress` gộp MỌI trạng thái sau khi lệnh được ký vào một nhãn duy nhất
— tức mù đúng đoạn dài nhất của vòng đời đơn. Màn hình nói được một câu, và câu
đó vô dụng.

### Bậc tắc (`src/lib/order-gate.ts`) — mỗi đơn đứng ở đúng một bậc, kèm CHỦ

| Bậc | Ai giữ bóng |
|---|---|
| Chưa phát lệnh | Kinh doanh |
| Chờ ký lệnh | Ban Giám đốc |
| **Chờ chốt định mức** | **Kỹ thuật** |
| Chưa mua vật tư | Cung ứng |
| Đơn mua chưa gửi | Cung ứng |
| Vật tư đang về | Nhà cung cấp |
| Chờ lên kế hoạch | Kế hoạch SX |
| Đang sản xuất | Xưởng |
| Chờ giao | Kho |

Cố ý KHÔNG suy từ `sales_orders.status`: cột đó đứng yên ở `lsx_issued` suốt từ
lúc ký lệnh tới lúc xong sản xuất. Bậc suy từ tín hiệu thật của từng khâu —
`lines_bom_pending`, `pos_total`/`pos_unsent`/`pos_open`, `materials_received_at`,
`jobs_done`/`jobs_total`. Hai tín hiệu cuối do **migration 0148** thêm vào view:
thiếu `pos_total` thì `pos_open = 0` mang hai nghĩa trái ngược ("chưa lập đơn
mua" ↔ "đã về đủ") mà đoán nhầm vế nào cũng ra lời khuyên sai.

### Màn hình

1. **Phễu tắc lên đầu** — mỗi bậc một ô: số đơn + tên bậc + phòng đang giữ. Bậc
   giữ nhiều đơn nhất tô hổ phách, kèm một câu tóm tắt. Bấm ô để lọc.
   Hôm nay nó nói đúng một câu thật: *"20 đơn cùng đứng ở chờ chốt định mức,
   Kỹ thuật đang giữ."*
2. **Khối lỗ hổng dữ liệu** — 20 đơn thiếu giá (kèm link đi điền), 7 đơn thiếu
   hạn giao. Không có khối này thì màn hình im lặng nói dối: "0 đơn nguy cơ trễ"
   trong khi 7 đơn không có hạn để mà đo.
3. Dòng lệnh trong mỗi khách hiện **bậc + phòng giữ** thay cho hai con số PO rời
   rạc vốn ghi "chưa có đơn vật tư" cho cả lệnh vừa ký lẫn lệnh đã xong định mức.
4. Bỏ chip lọc theo trạng thái đơn (Chờ duyệt / Đang SX / Chờ giao) — phễu làm
   việc đó chính xác hơn. Giữ "Nguy cơ trễ", thêm "Thiếu hạn giao".

## 3. Chưa làm (chờ dữ liệu / chốt)

- **Tiền của từng khối = 0** cho tới khi điền giá ở `/sales/orders/gia` (G0.2).
- Tiến độ **giao hàng từng đợt** (`sales_order_shipments`) — bảng có từ 0120
  nhưng 0 đợt giao; khi Sale bắt đầu ghi đợt giao thì thêm cột "đã giao x/y".
- Đối chiếu **tiền vào (đơn) ↔ tiền ra (vật tư) theo lệnh** — cần đơn mua thật.
