-- KÍCH THƯỚC TRẠNG THÁI MỞ / KÉO GIÃN (user chốt 30/07/2026).
--
-- Vấn đề: 20/67 file BOM khai KTSP thành HAI bộ số chứ không phải ba số đơn:
--   · bàn kéo giãn — chỉ chiều dài đổi:  '1800/2500 x 1000 x 740'
--   · ghế gấp      — sâu tăng, cao giảm: '580 x 760/935 x 1110/995'
--   · bàn xếp      — gấp phẳng còn 225mm dày: '600 x 880/740 x 910/225'
-- Ba cột `length_mm/width_mm/height_mm` chỉ chứa được một trạng thái, nên trước
-- migration này cả 20 SP đó bị bỏ trắng kích thước.
--
-- Cách chữa: thêm 3 cột `*_open_mm` = kích thước ở trạng thái MỞ / KÉO GIÃN.
-- Ba cột cũ giữ nguyên nghĩa và giá trị = trạng thái ĐÓNG / GẤP (trạng thái dùng
-- để xếp cont, nên báo giá và xếp container vẫn đọc đúng cột cũ như trước).
-- Cột `*_open_mm` để trống với SP không gập/mở — đại đa số thư viện.
--
-- Cách xác định đâu là "mở": trạng thái có MẶT BẰNG lớn hơn (dài hoặc rộng lớn
-- hơn), rồi áp cùng vị trí cho chiều cao — vì chiều cao đi ngược: ghế gấp mở ra
-- thì THẤP xuống (1110→995), bàn xếp mở ra thì CAO lên (225→910).
--
-- 15/20 SP tách được máy móc. 5 SP còn lại CỐ Ý để trống, điền tay:
--   · C0170HG-AL, C0176HG-AL — file ghi lẫn cm vào giữa dãy mm ('111/840',
--     '730/106'); nhân 10 lên là đoán, mà đoán sai thì số chảy vào báo giá.
--   · SU0092HG-AL '1970x610x345/1005' — chỉ chiều cao có 2 trạng thái nên không
--     có mặt bằng làm mốc để biết 345 hay 1005 mới là "mở".
--   · C0200HG-AL, SU0181HG-AL — file bỏ trống ô KTSP.
--
-- RLS: chỉ thêm cột vào bảng đã có; `technical_products` vẫn bật RLS không
-- policy như migration gốc (anon bị chặn, secret key bypass).
--
-- Idempotent: `add column if not exists` + `coalesce` chỉ điền ô trống.

alter table public.technical_products
  add column if not exists length_open_mm numeric,
  add column if not exists width_open_mm  numeric,
  add column if not exists height_open_mm numeric;

comment on column public.technical_products.length_open_mm is
  'Chiều dài ở trạng thái MỞ/kéo giãn (mm). Null = SP không gập/mở. Cột length_mm là trạng thái đóng/gấp.';
comment on column public.technical_products.width_open_mm is
  'Chiều rộng ở trạng thái MỞ/kéo giãn (mm). Null = SP không gập/mở.';
comment on column public.technical_products.height_open_mm is
  'Chiều cao ở trạng thái MỞ/kéo giãn (mm). Ghế gấp mở ra THẤP hơn lúc gấp — số này có thể nhỏ hơn height_mm.';

with src(legacy_code, length_mm, width_mm, height_mm,
         length_open_mm, width_open_mm, height_open_mm) as (values
  ('B0066HG-AL'::text, 600::numeric, 1200::numeric, 875::numeric, null::numeric, null::numeric, null::numeric),
  ('B0067HG-AL', 600, 1800, 870, null, null, null),
  ('C0113HG-AL', 760, 580, 1110, 935, null, 995),
  ('C0114HG-AL', 650, 580, 1090, 1000, null, 880),
  ('C0119HG-AL', 705, 605, 1150, 1070, null, 845),
  ('C0180HG-AL', 710, 610, 1090, 1040, null, 860),
  ('C0195HG-IN', 700, 600, 1170, 900, null, 990),
  ('C0201HG-IN', 720, 590, 1100, 1060, null, 840),
  ('T0164HG-AL', 1000, 1800, 740, null, 2500, null),
  ('T0168HG-AL', 700, 800, 750, null, 1200, null),
  ('T0169HG-AL', 1000, 1800, 740, null, 2400, null),
  ('T0173HG-AL', 650, 650, 740, null, 1300, null),
  ('T0174HG-AL', 740, 600, 225, 880, null, 910),
  ('T0182HG-AL', 900, 1500, 740, null, 2000, null),
  ('T0199HG-IN', 1000, 1800, 750, null, 2400, null)
),
calc as (
  select p.id,
         coalesce(p.length_mm, s.length_mm) as length_mm,
         coalesce(p.width_mm,  s.width_mm)  as width_mm,
         coalesce(p.height_mm, s.height_mm) as height_mm,
         coalesce(p.length_open_mm, s.length_open_mm) as length_open_mm,
         coalesce(p.width_open_mm,  s.width_open_mm)  as width_open_mm,
         coalesce(p.height_open_mm, s.height_open_mm) as height_open_mm
  from public.technical_products p
  join src s on s.legacy_code = p.code_legacy
)
update public.technical_products p
set length_mm = c.length_mm,
    width_mm = c.width_mm,
    height_mm = c.height_mm,
    length_open_mm = c.length_open_mm,
    width_open_mm = c.width_open_mm,
    height_open_mm = c.height_open_mm
from calc c
where c.id = p.id
  and (p.length_mm, p.width_mm, p.height_mm,
       p.length_open_mm, p.width_open_mm, p.height_open_mm)
   is distinct from
      (c.length_mm, c.width_mm, c.height_mm,
       c.length_open_mm, c.width_open_mm, c.height_open_mm);
