-- 0088_production_assembly_bom.sql — BOM 2 CẤP: chi tiết (part) → cụm (assembly).
--
-- Bối cảnh (đối chiếu file Excel gốc "Tổng TĐ SX-TK-KT", user chốt 07/2026):
-- xưởng làm theo CỤM và CHI TIẾT — 1 cụm gồm nhiều chi tiết, và ĐƠN VỊ ĐẾM ĐỔI
-- theo công đoạn: PHÔI đếm theo chi tiết (chân, mê, nan…), từ HÀN trở đi các chi
-- tiết đã hàn lại thành CỤM nên đếm theo cụm. Excel thể hiện đúng vậy: khối PHÔI
-- có tổng cần per chi tiết; khối HÀN/NGUỘI/SƠN chỉ dòng CỤM mới mang tổng cần.
--
-- production_components (0084) mới chỉ có `cluster` là NHÃN TEXT (không tham gia
-- tính toán). Bổ sung để cụm thành THỰC THỂ ĐẾM ĐƯỢC có chuỗi công đoạn riêng:
--   kind             'part' | 'assembly'. Mặc định 'part' → lệnh cũ giữ nguyên
--                    hành vi (không có cụm nào ⇒ mọi tính toán y như trước).
--   first_stage      công đoạn ĐẦU của chuỗi component (đối xứng với final_stage
--                    = công đoạn CUỐI). Cụm bắt đầu ở 'han'; null = từ đầu lộ
--                    trình dòng SP (mặc định của chi tiết). Cùng final_stage tạo
--                    khoảng [first_stage..final_stage] mà component tham gia —
--                    nhờ đó cụm KHÔNG bị tính ở phôi, chi tiết KHÔNG bị tính ở
--                    hàn (service assessJobProgress/summary dùng khoảng này).
--   qty_per_assembly (trên dòng CHI TIẾT) số chi tiết dùng cho 1 CỤM cùng
--                    `cluster` — để cảnh báo WIP liên cấp: hàn X cụm cần
--                    X×qty_per_assembly chi tiết đã xong công đoạn cuối của nó.
--                    Dòng cụm để null. Tương ứng cột "Cụm CT/SP" & định mức cụm
--                    của Excel; dòng cụm dùng qty_per_unit = số cụm / 1 SP.
--
-- RLS: không đổi (bảng đã enable, no policies — anon chặn, secret bypass). Chỉ
-- ADD COLUMN IF NOT EXISTS nên idempotent, an toàn re-run. Không đụng dữ liệu cũ
-- (mọi dòng hiện có mặc định kind='part', first_stage/qty_per_assembly null →
-- hành vi không đổi). Apply xong: "sync types" (đã cập nhật tay database.types.ts
-- kèm migration này).

alter table public.production_components
  add column if not exists kind text not null default 'part'
    check (kind in ('part', 'assembly')),
  add column if not exists first_stage text,
  add column if not exists qty_per_assembly numeric(14, 4)
    check (qty_per_assembly > 0);

-- Tra cứu chi tiết của 1 cụm (theo lệnh + cụm) khi kiểm WIP liên cấp.
create index if not exists production_components_cluster_idx
  on public.production_components (production_order_id, cluster);
