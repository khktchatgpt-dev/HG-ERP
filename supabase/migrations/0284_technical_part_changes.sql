-- 0284: technical_product_part_changes — NHẬT KÝ DÒNG ĐỊNH MỨC (N1, 02/11/2026).
--
-- Vì sao: định mức chỉ có cột "sửa lần cuối" (updated_at/updated_by) nên mỗi lần
-- sửa ĐÈ MẤT số cũ — đo 02/11: 0 dòng lịch sử, bản chốt hồ sơ SP (0143) 5 dòng.
-- Cung ứng biết "lệnh đổi" (0282) nhưng không biết DÒNG NÀO đổi GÌ để sửa đơn.
-- Bản vẽ https://claude.ai/artifact/DvGDS3wgazvG3CNsz4xsJJ, user duyệt 02/11.
--
-- Ghi bằng TRIGGER ngay trong DB: màn hồ sơ SP, đọc BOM bằng AI, chép SP, sinh
-- từ định hình, script nạp file — mọi đường ghi đều đi qua, không đường nào lọt.
--
--   Chỉ ghi các trường ẢNH HƯỞNG VIỆC MUA (Q1): mã vật tư, tên chi tiết, SL/SP,
--   ĐVT, quy cách (dày × rộng, độ dày thành, dài cắt), ghi chú vật liệu, khối
--   lượng, hao hụt. `group_code` đi kèm ảnh chụp để bày nhóm, không tính là
--   thay đổi. Sửa mà không đụng trường nào trong danh sách → KHÔNG ghi (đổi thứ
--   tự dòng, diện tích sơn, cụm…).
--   `before` / `after`: ảnh chụp các trường trên (null cho thêm / xoá).
--   `changed_by`: thêm / sửa = `updated_by` của dòng. XOÁ thì dòng đã mất nên
--   DB không tự biết ai xoá: màn hồ sơ SP ghi `updated_by` NGAY TRƯỚC khi xoá
--   (trigger set_updated_at đẩy updated_at = now()); trigger chỉ nhận người đó
--   khi updated_at nằm trong 10 giây vừa qua — xoá bằng script / mã cũ thì để
--   trống ("không ghi người") thay vì gán nhầm cho người sửa lần trước.
--
-- AN TOÀN: lỗi trong trigger bị NUỐT (raise warning) — ghi nhật ký hỏng không
-- được làm hỏng lượt lưu định mức của Kỹ thuật.
--
-- RLS: enable row level security, KHÔNG policy (anon chặn, secret key bypass).
-- Idempotent.

create table if not exists public.technical_product_part_changes (
  id             uuid primary key default gen_random_uuid(),
  -- KHÔNG FK ở cả hai cột: dòng / SP có thể đã bị xoá — chính lúc đó nhật ký
  -- mới cần. FK tới technical_products còn làm HỎNG việc xoá SP: xoá dây chuyền
  -- các dòng → trigger chèn nhật ký trỏ vào SP đang xoá → kiểm FK ở cuối câu
  -- lệnh (ngoài khối nuốt lỗi của trigger) đánh trượt cả lượt xoá.
  product_id     uuid not null,
  part_id        uuid not null,
  action         text not null check (action in ('insert', 'update', 'delete')),
  before         jsonb,
  after          jsonb,
  changed_fields text[] not null default '{}',
  changed_by     uuid references public.users(id) on delete set null,
  changed_at     timestamptz not null default now()
);

comment on table public.technical_product_part_changes is
  'Nhật ký dòng định mức (0284) — trigger ghi mọi lần thêm/sửa/xoá các trường ảnh hưởng việc mua, cũ → mới, ai, lúc nào';

create index if not exists technical_product_part_changes_product_idx
  on public.technical_product_part_changes (product_id, changed_at);

alter table public.technical_product_part_changes enable row level security;

create or replace function public.technical_part_changes_log()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cot   constant text[] := array[
    'material_code', 'part_name', 'qty', 'unit', 'dim_a_mm', 'dim_b_mm',
    'wall_thickness_mm', 'cut_length_mm', 'material_note', 'weight_kg', 'waste_pct'
  ];
  truoc jsonb;
  sau   jsonb;
  doi   text[] := '{}';
  c     text;
  ai    uuid;
  sp    uuid;
  dong  uuid;
begin
  begin
    if tg_op <> 'INSERT' then
      select jsonb_object_agg(k, v) into truoc
        from jsonb_each(to_jsonb(old)) e(k, v)
        where k = any(cot) or k = 'group_code';
    end if;
    if tg_op <> 'DELETE' then
      select jsonb_object_agg(k, v) into sau
        from jsonb_each(to_jsonb(new)) e(k, v)
        where k = any(cot) or k = 'group_code';
    end if;

    if tg_op = 'UPDATE' then
      foreach c in array cot loop
        if (truoc -> c) is distinct from (sau -> c) then
          doi := doi || c;
        end if;
      end loop;
      -- Không đổi trường nào ảnh hưởng việc mua → không ghi.
      if array_length(doi, 1) is null then
        return null;
      end if;
      ai := new.updated_by;
      sp := new.product_id;
      dong := new.id;
    elsif tg_op = 'INSERT' then
      ai := new.updated_by;
      sp := new.product_id;
      dong := new.id;
    else
      ai := case when old.updated_at > now() - interval '10 seconds'
                 then old.updated_by end;
      sp := old.product_id;
      dong := old.id;
    end if;

    insert into public.technical_product_part_changes
      (product_id, part_id, action, before, after, changed_fields, changed_by)
    values (
      sp,
      dong,
      lower(tg_op),
      truoc,
      sau,
      doi,
      ai
    );
  exception when others then
    raise warning 'technical_part_changes_log: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists technical_part_changes_log on public.technical_product_parts;
create trigger technical_part_changes_log
  after insert or update or delete on public.technical_product_parts
  for each row execute function public.technical_part_changes_log();
