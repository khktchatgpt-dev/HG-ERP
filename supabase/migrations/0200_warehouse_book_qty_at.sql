-- 0200 — `warehouse_book_qty_at`: tồn SỔ tại một MỐC THỜI GIAN.
--
-- Đợt kiểm kê (0199) chốt sổ tại `freeze_at`, và chênh lệch của đợt phải tính
-- so với tồn TẠI MỐC ĐÓ, không phải tồn lúc duyệt. Hàm này là cách đọc con số
-- ấy.
--
-- VÌ SAO LÀ RPC CHỨ KHÔNG TÍNH Ở TS. Đường TS phải kéo mọi dòng sổ của các mã
-- trong phạm vi về rồi tự cộng — mà PostgREST trần 1000 dòng một lượt, im
-- lặng. Đúng cái bẫy đã cắn hai lần ở dự án này (màn Tồn kho mất mọi mã từ
-- chữ M trở đi, và /planning/stock giấu mất mã có tồn). Cộng dồn là việc của
-- Postgres.
--
-- KHÔNG CÓ CHUYỆN "ẢNH CHỤP SỔ". Sổ chỉ cộng thêm (luật 0194) nên tồn tại bất
-- kỳ mốc nào đều suy lại được từ chính các dòng — không bảng nào phải giữ số
-- dư, và không có đường nào để số dư lệch khỏi sổ.
--
-- `security invoker` + `search_path` cố định: hàm chỉ đọc, và phải chịu đúng
-- tư thế RLS của người gọi như mọi view của phân hệ này (anon bị chặn vì bảng
-- gốc bật RLS không policy; secret key bypass).

create or replace function public.warehouse_book_qty_at(
  p_at           timestamptz,
  p_material_ids uuid[]
)
returns table (material_id uuid, qty numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    mv.material_id,
    coalesce(sum(
      case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    ), 0) as qty
  from public.warehouse_movements mv
  where mv.created_at <= p_at
    and (p_material_ids is null or mv.material_id = any (p_material_ids))
  group by mv.material_id;
$$;

comment on function public.warehouse_book_qty_at is
  'Tồn sổ tại một mốc thời gian (0200) — nền của sổ đóng băng khi kiểm kê. Mã KHÔNG có dòng nào trước mốc sẽ không xuất hiện trong kết quả: người gọi coi thiếu = 0.';
