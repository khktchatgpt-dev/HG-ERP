-- 0282: supply_lsx_reviews — MỐC SOÁT số cần vật tư của lệnh (Cung ứng, 02/11/2026).
--
-- Vì sao cần: Kỹ thuật sửa định mức, hay lệnh đổi SL / SP / ngày xuất, thì phòng
-- Cung ứng không hề được báo (đo 02/11: sửa định mức không phát sự kiện nào; 5 lần
-- sửa lệnh thật đều nạp bằng script nên 0 thông báo; 6/17 lệnh đang chạy có định
-- mức sửa SAU khi duyệt). Thay vì dựa vào sự kiện, màn Kế hoạch mua SO số cần
-- hiện tại với MỐC lần soát trước — bắt được mọi đường sửa, kể cả script.
-- Bản vẽ https://claude.ai/artifact/RL9ToGvjouLFkhNVeruAbS, user duyệt 02/11/2026.
--
-- Mỗi lần NV Cung ứng bấm "Đã soát" là MỘT DÒNG MỚI (không ghi đè): dòng mới nhất
-- là mốc đang dùng, cả dãy là lịch sử soát (ai, lúc nào, mấy thay đổi, ghi chú).
-- Lệnh chưa có dòng nào → mốc là ảnh chụp định mức lúc duyệt (0142).
--
--   `snapshot`  số Cần từng vật tư ĐÚNG như bảng kê tính (đã quy đổi đơn vị mua,
--               gồm số tay 0184 và định mức chưa kiểm), khoá theo material_id;
--               vật tư chưa có mã kho khoá '~' + khoá gom của lib/bom-chua-ma;
--               kèm ngày xuất, mốc vật tư, SL từng SP (xem lib/lenh-doi.ts).
--   `changes`   số thay đổi người bấm đã nhìn thấy lúc soát.
--
-- RLS: enable row level security, KHÔNG policy — anon/publishable key bị chặn hoàn
-- toàn, server dùng secret key bypass (mọi truy cập qua API route; quyền ghi =
-- phòng Cung ứng + admin, kiểm ở service). Idempotent.

create table if not exists public.supply_lsx_reviews (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  reviewed_by         uuid references public.users(id) on delete set null,
  reviewed_at         timestamptz not null default now(),
  changes             integer not null default 0 check (changes >= 0),
  note                text,
  snapshot            jsonb not null default '{}'::jsonb
);

comment on table public.supply_lsx_reviews is
  'Mốc soát số cần vật tư của lệnh (0282) — mỗi lần Cung ứng bấm Đã soát một dòng; dòng mới nhất là mốc so thay đổi định mức/lệnh';

create index if not exists supply_lsx_reviews_lsx_idx
  on public.supply_lsx_reviews (production_order_id, reviewed_at desc);

alter table public.supply_lsx_reviews enable row level security;
