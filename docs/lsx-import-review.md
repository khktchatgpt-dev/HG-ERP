# LSX → thư viện SP: 3 mã CẦN NGƯỜI SOÁT (04/08/2026)

Nạp thư viện từ 8 file LSX của Sales bằng `scripts/lsx-products-import.mjs`.
Ba trường hợp dưới đây script **không tự ghi**: khớp được nhưng không đủ chắc,
ghi sai là hai sản phẩm dính vào nhau.

| Khách | Mã trên LSX | Nghi là | Tên SP trong thư viện | Vì sao không tự ghi |
|---|---|---|---|---|
| LAURA | `1708414.11` | `SL0005HG-IR` | GIƯỜNG TẮM NĂNG KHUNG SẮT ĐAN MÂY | khớp tên nhưng KHÁC khách — không tự điền |
| ROSCO | `H25-S205/RCFS CD` | `CH0099HG-AL` | New Chelsea Reclining Chair & Footstool | SP này đã nhận mã khách khác — 2 mã cùng trỏ 1 SP |
| ROSCO | `H25-S203/GLT TT CD` | `TB0096HG-AL` | New Chelsea Bistro Table Top | SP này đã nhận mã khách khác — 2 mã cùng trỏ 1 SP |

**Cách xử lý:** mở hồ sơ SP trong thư viện; nếu đúng là một SP thì điền mã khách
vào ô mã khách đặt; nếu là hai SP khác nhau (đời 2024 vs 2025 — ROSCO hay đặt
`H24-…` và `H25-… CD` cho hai phiên bản) thì tạo SP mới cho mã còn lại.

## Đã nạp gì (04/08/2026)

- **40 SP mới**: LAURA 23 · ROSCO 16 · YOTRIO 1. Mã HG sinh theo quy ước
  (loại + số + `HG-` + vật liệu khung), mã trên LSX vào `customer_item_code`.
- **7 SP có sẵn** được điền mã khách (trước đó chỉ 76/545 SP có mã khách).
- **30 ảnh** trích từ 3 file `.xlsx` theo ô neo → gắn đúng SP (17 cho SP mới,
  13 bù cho SP cũ đang thiếu ảnh).
- **23 SP của LAURA chưa có ảnh**: ảnh nằm trong file `.xls`, không đọc được ô
  neo nên không gán tự động. Muốn có ảnh thì mở file trong Excel, Save As sang
  `.xlsx` rồi chạy lại script — hoặc tải ảnh tay ở hồ sơ SP.
