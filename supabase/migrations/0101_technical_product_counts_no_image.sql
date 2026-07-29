-- Kỹ thuật: thêm số đếm "SP chưa có ảnh" vào technical_product_counts().
--
-- Bối cảnh: thư viện SP hiện các chip lọc kiêm số đếm (Định mức / Trạng thái).
-- Thiếu ảnh là lỗ hổng hồ sơ có thật và đo được — tại thời điểm viết là 87/537
-- SP — nhưng chưa đếm ở đâu, nên không ai thấy để đi đòi ảnh. Thêm một cột đếm
-- vào đúng function gộp sẵn (0069) thay vì bắn thêm một HEAD-count riêng: vẫn
-- 1 query / 1 lần quét bảng như trước.
--
-- DROP rồi CREATE chứ không CREATE OR REPLACE: Postgres không cho đổi kiểu trả
-- về của function đang tồn tại, mà thêm cột vào `returns table` chính là đổi
-- kiểu trả về ("cannot change return type of existing function").
--
-- RLS: KHÔNG đổi. technical_products vẫn ENABLE row level security, no policies
-- (anon bị chặn, server dùng secret key nên bypass). Function giữ nguyên tư thế
-- của 0069: security invoker + search_path = '' (chuẩn Supabase, chặn
-- search_path injection).
--
-- Idempotent: drop if exists → create. Chạy lại nhiều lần đều ra cùng một kết quả.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

drop function if exists public.technical_product_counts();

create function public.technical_product_counts()
returns table (
  total        bigint,
  active       bigint,
  bom_none     bigint,
  bom_drawing  bigint,
  bom_done     bigint,
  no_image     bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint,
    count(*) filter (where is_active)::bigint,
    count(*) filter (where bom_status = 'none')::bigint,
    count(*) filter (where bom_status = 'drawing')::bigint,
    count(*) filter (where bom_status = 'done')::bigint,
    count(*) filter (where image_file_id is null)::bigint
  from public.technical_products
$$;
