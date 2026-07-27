-- TÌM SẢN PHẨM CHỊU ĐƯỢC DẤU VÀ LỖI GÕ (user chốt 27/07/2026).
--
-- Trước migration này thư viện sản phẩm tìm bằng `ilike '%q%'` trên 5 cột rời.
-- Ba kiểu gõ rất thường gặp đều ra 0 kết quả:
--   1. KHÔNG DẤU — gõ "ghe xep" không ra "Ghế xếp Florenz" (ilike không bỏ dấu).
--   2. NHIỀU TỪ  — gõ "ghe florenz" không ra, vì `%…%` đòi cả chuỗi liền nhau.
--   3. LỆCH 1 KÝ TỰ — gõ "floren"/"folrenz" không ra, dù mắt người đọc là một.
--
-- Cách chữa: một cột `search_text` gộp sẵn 5 trường, đã hạ chữ thường và BỎ DẤU,
-- kèm chỉ mục trigram (GIN). Từ đó:
--   · khớp chặt  = ilike từng từ trên `search_text` (app AND các từ lại)
--   · khớp gần   = similarity() qua hàm `technical_products_fuzzy` bên dưới,
--                  CHỈ dùng khi khớp chặt không ra gì
--
-- `unaccent` mặc định KHÔNG immutable (từ điển nạp từ file, Postgres không dám
-- hứa kết quả bất biến) nên không dùng thẳng trong cột generated. Bọc lại thành
-- `immutable_unaccent` — thủ thuật chuẩn, đánh đổi có chủ ý: nếu ai đó đổi file
-- từ điển unaccent thì phải `REINDEX`. Ta không đổi, nên chấp nhận được.
--
-- RLS: không tạo bảng mới. Hàm `technical_products_fuzzy` để `security invoker`
-- (mặc định) nên nó chạy theo quyền người gọi — anon vẫn bị RLS chặn như cũ,
-- server dùng secret key vẫn bypass. Không mở thêm cửa nào.
--
-- Idempotent: create extension/function/index if not exists, add column if not
-- exists.

create extension if not exists unaccent with schema public;
create extension if not exists pg_trgm with schema public;

create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
strict
parallel safe
as $$ select public.unaccent('public.unaccent', $1) $$;

-- `code_legacy` PHẢI nằm trong đây: mã cũ (S0049HG-AL) là mã mọi file Excel và
-- bản vẽ đang gọi — người dùng gõ nó chứ không gõ mã mới.
alter table public.technical_products
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(
      lower(
        coalesce(code, '') || ' ' ||
        coalesce(code_legacy, '') || ' ' ||
        coalesce(name, '') || ' ' ||
        coalesce(name_foreign, '') || ' ' ||
        coalesce(customer_item_code, '') || ' ' ||
        coalesce(customer_name, '')
      )
    )
  ) stored;

create index if not exists technical_products_search_trgm_idx
  on public.technical_products using gin (search_text public.gin_trgm_ops);

-- Xếp hạng theo độ giống — dùng làm LỐI LÙI khi khớp chặt ra 0 dòng.
-- Trả về id + điểm để app tự lọc tiếp theo bộ lọc đang bật (khách, trạng thái…),
-- thay vì nhân đôi toàn bộ logic lọc vào trong SQL.
--
-- Dùng `word_similarity` (toán tử `<%`) chứ KHÔNG phải `similarity`: `search_text`
-- là chuỗi dài gộp mã + tên + khách, còn từ khoá thì ngắn. So cả chuỗi thì
-- "folrenz" vs "ch0200hg-al ghe xep florenz shelter home" chỉ ra 0.08 — dưới mọi
-- ngưỡng, tức fuzzy không bao giờ chạy. `word_similarity` so từ khoá với ĐOẠN
-- GIỐNG NHẤT bên trong chuỗi nên "folrenz" ra 0.375, "floren" ra 0.857.
--
-- Ngưỡng 0.35 viết THẲNG vào điều kiện chứ không dùng toán tử `<%`: ngưỡng của
-- `<%` nằm ở GUC `pg_trgm.word_similarity_threshold`, mà role của Supabase không
-- được phép gắn `SET` đó lên hàm. Đánh đổi: mất chỉ mục GIN ở nhánh này, phải
-- quét bảng. Chấp nhận được vì (a) đây chỉ là LỐI LÙI, chạy khi khớp chặt ra 0
-- dòng, và (b) `search_text` là cột text ngắn, vài nghìn dòng quét vẫn dưới 10ms.
-- Ngưỡng mặc định 0.6 bắt được lỗi thiếu ký tự ("floren" → 0.857) nhưng KHÔNG bắt
-- được lỗi đảo ký tự ("folrenz" → 0.375) — đúng kiểu gõ sai hay gặp nhất.
create or replace function public.technical_products_fuzzy(
  p_q text,
  p_limit int default 50
)
returns table (id uuid, score real)
language sql
stable
as $$
  select p.id, word_similarity(public.immutable_unaccent(lower(p_q)), p.search_text) as score
  from public.technical_products p
  where word_similarity(public.immutable_unaccent(lower(p_q)), p.search_text) >= 0.35
  order by score desc, p.code
  limit greatest(p_limit, 1)
$$;

comment on function public.technical_products_fuzzy is
  'Xếp hạng SP theo word_similarity trigram, ngưỡng 0.35. Lối lùi khi tìm khớp '
  'chặt ra 0 dòng — đủ để "folrenz" ra "Florenz" mà không đổ về cả bảng.';
