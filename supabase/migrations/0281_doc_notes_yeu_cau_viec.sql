-- 0281 — YÊU CẦU VIỆC TRÊN CHỨNG TỪ (doc_notes kind = 'request').
--
-- Quản lý Cung ứng xin 29/10/2026: "thêm mục yêu cầu công việc khi thao tác trên
-- ERP để các bạn thấy và làm tiếp". Bản vẽ duyệt
-- https://claude.ai/artifact/HkyxtrrXDMwzfLiJVH6ZMC — chủ dự án chốt C1–C5 theo đề
-- xuất (giao mọi phòng · bắt buộc gắn đơn mua / lệnh SX · một người nhận · báo xong
-- bắt một câu kết quả · ai xem được chứng từ thì giao được).
--
-- VÌ SAO TRÊN doc_notes, KHÔNG PHẢI bảng `tasks`: module Việc có 22 việc, việc cuối
-- tạo 26/06/2026 — không ai mở. Ô ghi chú trên đơn mua thì 93 ghi chú / 30 ngày
-- (đo 29/10). Yêu cầu việc là bản tổng quát của câu hỏi GĐ (0218): một ghi chú MỞ
-- cho tới khi có người đóng — chỉ thêm người nhận và hạn.
--
-- Vòng đời (luật ở `src/lib/doc-requests.ts`, không ở DB):
--   Đang mở   = resolved_at null
--   Đã xong   = resolved_how 'done'      (người nhận báo xong, kèm câu kết quả)
--   Đã huỷ    = resolved_how 'cancelled' (người giao huỷ, kèm lý do)
--   Đóng      = resolved_how 'closed'    (chứng từ bị huỷ — máy đóng)
--   Mở lại    = xoá resolved_* về null. Câu kết quả / lý do / chuyển người được
--               ghi thành ghi chú thường trả lời yêu cầu (reply_to) — vết nằm
--               trong dòng trao đổi, không cần bảng sự kiện riêng.
--
-- Thông báo: NỐI 5 loại `doc_request*` vào ràng buộc đang có trên DB thay vì chép
-- lại danh sách cứng. Đo 29/10 trên DB thật: ràng buộc có 64 loại, nhiều loại
-- (feedback_*, payroll_*, asset_issue_*, po_inbound_*) đến từ nhánh mà file
-- migration của nhánh này không có — chép cứng là xoá mất chuông của họ.
-- CAVEAT: migration nào SAU này viết lại notifications_type_check bằng danh sách
-- cứng phải giữ 5 loại doc_request*, nếu không chuông yêu cầu việc tắt im lặng
-- (bus nuốt lỗi, yêu cầu vẫn được ghi).
--
-- An toàn khi DB đi trước mã: mã cũ trên main đọc yêu cầu như một ghi chú thường
-- (hiện thân bài), không lọc sai, không đếm sai chỗ nào — chỉ không có nút.
--
-- RLS: không thêm bảng; doc_notes / notifications đã ENABLE, không policy (anon bị
-- chặn, secret key của server bypass) — giữ nguyên. Idempotent: add column if not
-- exists, drop + add lại constraint, create index if not exists, khối DO chỉ thêm
-- loại còn thiếu.

-- 1) Người nhận + hạn
alter table public.doc_notes
  add column if not exists assignee_id uuid references public.users(id) on delete restrict,
  add column if not exists due_on date;

comment on column public.doc_notes.assignee_id is
  'Người nhận yêu cầu việc (kind = request). Một người — cần hai người thì hai yêu cầu.';
comment on column public.doc_notes.due_on is
  'Hạn của yêu cầu việc (ngày VN). Trống = không hạn. Quá hạn là nhãn suy ra, không phải trạng thái.';

-- 2) Loại + cách đóng
alter table public.doc_notes drop constraint if exists doc_notes_kind_check;
alter table public.doc_notes
  add constraint doc_notes_kind_check check (kind in ('note', 'question', 'request'));

alter table public.doc_notes drop constraint if exists doc_notes_resolved_how_check;
alter table public.doc_notes
  add constraint doc_notes_resolved_how_check
  check (resolved_how is null
         or resolved_how in ('answered', 'decided', 'closed', 'done', 'cancelled'));

alter table public.doc_notes drop constraint if exists doc_notes_request_assignee_check;
alter table public.doc_notes
  add constraint doc_notes_request_assignee_check
  check (kind <> 'request' or assignee_id is not null);

-- 3) Truy vấn chính: "giao cho tôi, còn mở" (sắp theo hạn) và "tôi đã giao".
create index if not exists doc_notes_open_requests_assignee_idx
  on public.doc_notes (assignee_id, due_on)
  where kind = 'request' and resolved_at is null and deleted_at is null;

create index if not exists doc_notes_requests_author_idx
  on public.doc_notes (author_id, created_at desc)
  where kind = 'request' and deleted_at is null;

-- 4) Loại thông báo — nối thêm vào danh sách đang có trên DB.
do $$
declare
  def text;
  cur text[];
  want text[] := array['doc_request', 'doc_request_done', 'doc_request_reopened',
                       'doc_request_reassigned', 'doc_request_cancelled'];
begin
  select pg_get_constraintdef(c.oid)
    into def
    from pg_constraint c
   where c.conrelid = 'public.notifications'::regclass
     and c.conname = 'notifications_type_check';

  -- Dạng chuẩn `ANY (ARRAY['a'::text, 'b'::text])`: mỗi loại một chuỗi trong nháy.
  select coalesce(array_agg(distinct m[1]), '{}')
    into cur
    from regexp_matches(coalesce(def, ''), '''([a-z0-9_]+)''', 'g') as m;
  -- Dạng mảng gộp `ANY ('{a,b}'::text[])` (ai đó dựng bằng một mảng literal) —
  -- đo được khi chạy thử 29/10: regex trên ra 0 loại với dạng này.
  if coalesce(array_length(cur, 1), 0) = 0 and def ~ '''\{[a-z0-9_,]+\}''' then
    cur := string_to_array(substring(def from '''\{([a-z0-9_,]+)\}'''), ',');
  end if;

  -- Không đọc ra được loại nào = ràng buộc đã đổi tên / dạng. Dựng tiếp ở đây là ra
  -- một ràng buộc CHỈ 5 loại và chặn mọi chuông khác — dừng hẳn còn hơn.
  if coalesce(array_length(cur, 1), 0) = 0 then
    raise exception '0281: không đọc được notifications_type_check — kiểm tay trước khi áp';
  end if;

  if cur @> want then
    return; -- đã đủ, chạy lại không đổi gì
  end if;

  cur := array(select distinct x from unnest(cur || want) as x order by x);
  execute 'alter table public.notifications drop constraint if exists notifications_type_check';
  -- Viết lại dạng `type in ('a', 'b', …)` — Postgres lưu thành dạng chuẩn ở trên, để
  -- migration sau (và chính khối này khi chạy lại) đọc ra được từng loại.
  execute format(
    'alter table public.notifications add constraint notifications_type_check check (type in (%s))',
    (select string_agg(quote_literal(x), ', ' order by x) from unnest(cur) as x));
end
$$;
