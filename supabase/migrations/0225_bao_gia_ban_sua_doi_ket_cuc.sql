-- Kinh doanh: BÁO GIÁ có BẢN SỬA ĐỔI, KẾT CỤC và GIÁ THÀNH CHỤP LÚC CHÀO
-- (07/10/2026, lượt 4 hoàn thiện Sale — chốt D3: giữ màn báo giá, nối giá thành).
--
-- Vì sao: 6 báo giá, cái mới nhất 09/08/2026, 0/53 đơn sinh từ báo giá. Sale
-- chào giá nhiều ĐỢT REVISE trên Excel vì màn không sửa được bản đã gửi, không
-- có kết cục (tab "Đã gửi" chỉ đầy lên), và không thấy giá thành kế hoạch
-- (0220) lúc chào.
--
--   sales_quotes.revision_no  : số bản (1 = bản đầu); bản sửa đổi = bản sao
--                               thành nháp mới, revision_no + 1
--   sales_quotes.revision_of  : bản gốc mà bản này sửa (cùng khách, cùng range)
--   sales_quotes.lost_reason  : lý do thua (status 'lost')
--   status thêm: superseded (bị bản sửa đổi thay) · won (đã ra đơn) ·
--                lost (khách không chọn) · cancelled (Sale rút)
--   sales_quote_lines.plan_price_snapshot / plan_at : giá thành KH lúc chào —
--                               giá thành đổi về sau vẫn tra được lúc chào lãi
--                               bao nhiêu. Chỉ ghi khi người lập có quyền
--                               technical.plan_cost.view.
--   sales_quote_lines.qty     : đã có (0057, nullable) — nay là SL dự kiến/MOQ.
--
-- RLS: không đổi (hai bảng ENABLED, no policies từ 0013). Idempotent.
-- Apply: SQL editor / supabase db push. Sau đó "sync types".

alter table public.sales_quotes
  add column if not exists revision_no integer not null default 1,
  add column if not exists revision_of uuid references public.sales_quotes(id) on delete set null,
  add column if not exists lost_reason text;

alter table public.sales_quotes drop constraint if exists sales_quotes_status_check;
alter table public.sales_quotes
  add constraint sales_quotes_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'sent',
                    'superseded', 'won', 'lost', 'cancelled'));

create index if not exists sales_quotes_revision_of_idx
  on public.sales_quotes (revision_of);

alter table public.sales_quote_lines
  add column if not exists plan_price_snapshot numeric(18, 2)
    check (plan_price_snapshot is null or plan_price_snapshot >= 0),
  add column if not exists plan_at timestamptz;

comment on column public.sales_quotes.revision_no is 'Số bản báo giá (1 = bản đầu); bản sửa đổi là nháp mới, revision_of trỏ bản trước (0225).';
comment on column public.sales_quote_lines.plan_price_snapshot is 'Giá thành kế hoạch (FOB ước tính, 0220) chụp lúc chào — để tra lãi lúc chào dù giá thành đổi về sau.';
