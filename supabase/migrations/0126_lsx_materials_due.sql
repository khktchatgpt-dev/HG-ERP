-- 0126: HẠN VẬT TƯ PHẢI VỀ của lệnh sản xuất (production_orders.materials_due_at).
--
-- Sổ "Tổng hợp ĐH" của Cung ứng có ô "Hạn VT phải về: 07/09" — mốc mọi đơn đặt
-- của lệnh phải về trước để kịp sản xuất. Cột L của sổ ("Kịp SX?") so ngày về
-- (thực tế ?? dự kiến) với mốc này ra 🔴 Trễ SX / 🟡 Sát hạn / 🟢 Kịp.
-- Nhập tay bởi Kế hoạch-Cung ứng (khác ship_date = hạn XUẤT HÀNG cho khách).
--
-- RLS: chỉ thêm cột — bảng đã enable row level security không policy, không đổi
-- tư thế.

alter table production_orders
  add column if not exists materials_due_at date;

comment on column production_orders.materials_due_at is
  'Hạn VẬT TƯ phải về kho để kịp sản xuất (sổ Tổng hợp ĐH) — đèn "Kịp SX?" của màn theo dõi đơn đặt so với mốc này.';
