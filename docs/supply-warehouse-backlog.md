# Backlog — Định hướng lại Cung ứng & Kho (cập nhật 23/07/2026)

Đợt này đã xong (nhánh `feat/supply-warehouse-redesign`): PO ngoài LSX (0076) ·
tồn khả dụng/đặt trước · kiểm kê + điều chỉnh (0077) · barcode nhẹ (0078) ·
danh mục vật tư dùng chung chia chủ quyền theo nhóm trường · mua bù tồn
(0079, reorder cho PO ngoài LSX) · trả hàng NCC (0080/0081, phiếu xuất trả
gắn dòng PO, PO received quay lại partial).

## Dở dang / nợ nhỏ của đợt này

- [ ] **Test service `createReturnDoc`** — logic + guard đã chạy (trả ≤ đã về,
      ≤ tồn, PO phải partial/received) nhưng chưa có unit test như các service khác.
- [ ] **Nhãn movement trả NCC** — lịch sử nhập/xuất đang hiển thị dòng trả là
      "Theo đơn đặt · ↓ Xuất"; nên hiện "Trả NCC" khi `direction=out && ref_type=po`
      (StockManager `MovementHistory` + DocsManager `DocDetail`).
- [ ] **UAT tay trên dev** (DB Supabase dùng chung — thử bằng vật tư/PO test):
      PO ngoài LSX end-to-end, kiểm kê, trả NCC, bù tồn, quyền Cung ứng sửa vật tư.

## ③ Cảnh báo tự động (gói kế tiếp theo thứ tự đã chốt)

- [ ] PO quá hẹn giao → **đẩy notification** cho Cung ứng + GĐ (logic có sẵn ở
      `src/lib/late-risk.ts`, chỉ hiển thị UI; cần cron — cân nhắc pg_cron trên
      Supabase insert thẳng bảng notifications, hoặc quét khi login).
- [ ] Quét **tồn dưới min định kỳ** (hiện chỉ báo tại thời điểm xuất kho/kiểm kê).

## ④ Hồ sơ NCC sâu hơn

- [ ] Bảng `supplier_contacts` — nhiều người liên hệ per NCC (0046 đã ghi chú "để sau").
- [ ] **KPI giao hàng tự tính** từ lịch sử PO: % đúng hẹn, tỉ lệ QC loại, tỉ lệ
      trả hàng (đã có dữ liệu từ 0080) — thay cho chấm điểm tay ở tab đánh giá.

## Backlog Cung ứng (chưa xếp lịch)

- [ ] Lịch giao **kế hoạch nhiều đợt** trên dòng PO (hiện 1 `expected_at`/đơn;
      thực tế giao từng đợt chỉ phản ánh qua phiếu nhập).
- [ ] **Ngưỡng duyệt PO theo giá trị** (hiện mọi PO cùng 1 cổng duyệt; mới có
      badge "Giá trị lớn ≥ 50tr" ở màn duyệt GĐ).
- [ ] 3-way match PO ↔ phiếu nhập ↔ hoá đơn + công nợ phải trả — **GĐ2 kế toán**.

## Backlog Kho (chưa xếp lịch)

- [ ] In **biên bản kiểm kê** (mẫu 05-VT) — trang in hiện chỉ có 01-VT/02-VT.
- [ ] Nối **FIFO costing** (`fifo_receipt/fifo_issue` 0045 có sẵn trong DB nhưng
      service chưa gọi) — **GĐ2 kế toán**: giá đv kép (đ/kg vs tồn theo cây) phải
      chốt cách tính giá vốn/đơn-vị-tồn trước, làm vội sẽ ra số sai.
- [ ] `max_stock` cảnh báo **mua vượt trần** khi lập PO.
- [ ] **Đa kho + phiếu chuyển kho (DCK)**, **vị trí kệ có cấu trúc** — enum/cột DB
      chờ sẵn từ 0015/0017; CHỜ CHỐT có làm không (mục "Other" user chưa nói rõ;
      chỉ đáng làm nếu thực tế ≥ 2 kho vật lý).

## Đã chốt KHÔNG làm (đừng đề xuất lại)

Chứng từ PR riêng · RFQ trong app · gửi email PO cho NCC · quy đổi đa tệ ·
lot/serial/QR + in tem · backflushing · theo dõi hạn chứng chỉ NCC.
