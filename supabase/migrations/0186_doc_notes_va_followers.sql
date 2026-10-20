-- 0186: GHI CHÚ TRAO ĐỔI TRÊN CHỨNG TỪ (doc_notes) + NGƯỜI THEO DÕI.
--
-- Vì sao: chứng từ đã có DÒNG THỜI GIAN — nhưng đó là thứ MÁY ghi (duyệt lúc
-- nào, ai gửi NCC). Không có chỗ nào cho thứ NGƯỜI viết. Hệ quả đo được: mọi
-- câu "sao đơn này chưa duyệt", "NCC báo trễ 3 ngày, đã gọi xác nhận" đang nằm
-- trên Zalo — và khi cần tra lại sau ba tháng thì không ai tìm ra. 66/68 đơn
-- đang nằm im 5-7 ngày mà không dòng nào giải thích vì sao.
--
-- Đây là khoảng cách lớn nhất so với ERP thật (Odoo gọi là "chatter"): chứng từ
-- phải là NƠI TRAO ĐỔI, không chỉ là nơi lưu số liệu.
--
-- ĐA HÌNH (doc_type + doc_id) chứ không phải khoá ngoại tới supply_purchase_orders:
-- ghi chú cần cho MỌI loại chứng từ (đơn đặt, lệnh sản xuất, phiếu kho, báo
-- giá). Làm riêng mỗi loại một bảng thì màn hình cũng phải viết lại mỗi loại
-- một lần, và cái thứ tư sẽ không ai buồn làm. Đánh đổi: DB không tự bảo toàn
-- tham chiếu — service phải kiểm chứng từ có thật trước khi ghi.
--
-- HAI LOẠI GHI CHÚ, tách bạch bằng `audience`:
--   'internal' — nội bộ, NCC không bao giờ thấy
--   'partner'  — nội dung đã/sẽ gửi ra ngoài (email, Zalo cho NCC)
-- Gộp một loại là sớm muộn có người gõ "thằng này giao hàng như mèo mửa" vào ô
-- rồi bấm gửi cho chính nhà cung cấp đó.
--
-- KHÔNG SỬA, KHÔNG XOÁ (chỉ soft-delete bằng deleted_at): ghi chú sửa được thì
-- không còn là bằng chứng. Giá trị của nó nằm ở chỗ không đổi được.
--
-- doc_followers: ai được báo khi có ghi chú mới. Suy ra TỰ ĐỘNG ở service
-- (người soạn, người phụ trách, người duyệt) — bắt người dùng tự bấm "theo dõi"
-- thì không ai bấm, và tính năng chết.
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key (server) bypass, đúng tư
-- thế mọi bảng khác của dự án.

create table if not exists public.doc_notes (
  id uuid primary key default gen_random_uuid(),
  -- 'po' | 'lsx' | 'receipt' | 'quote' — service khai, không ràng buộc ở DB để
  -- thêm loại chứng từ mới không phải chạy migration.
  doc_type text not null,
  doc_id uuid not null,
  author_id uuid not null references public.users(id) on delete restrict,
  audience text not null default 'internal'
    check (audience in ('internal', 'partner')),
  body text not null check (length(trim(body)) > 0),
  -- Ghi chú trả lời một ghi chú khác. Một cấp thôi: chuỗi trả lời lồng nhau
  -- trên chứng từ nghiệp vụ là thứ chưa ai cần mà đọc thì rối.
  reply_to uuid references public.doc_notes(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Soft-delete: gõ nhầm thì ẩn đi, nhưng dòng vẫn còn để không ai xoá dấu vết.
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null
);

-- Truy vấn chính: "mọi ghi chú của chứng từ này, mới nhất trước".
create index if not exists doc_notes_doc_idx
  on public.doc_notes (doc_type, doc_id, created_at desc);

create table if not exists public.doc_followers (
  doc_type text not null,
  doc_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  -- 'auto' = hệ thống suy ra (soạn/phụ trách/duyệt); 'manual' = tự bấm theo dõi.
  -- Phân biệt để người tự bỏ theo dõi không bị hệ thống gắn lại mỗi lần đụng đơn.
  source text not null default 'auto' check (source in ('auto', 'manual')),
  -- Có giá trị = người này đã CHỦ ĐỘNG bỏ theo dõi, đừng thêm lại.
  muted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (doc_type, doc_id, user_id)
);

create index if not exists doc_followers_user_idx
  on public.doc_followers (user_id);

alter table public.doc_notes enable row level security;
alter table public.doc_followers enable row level security;

comment on table public.doc_notes is
  'Trao đổi của NGƯỜI trên chứng từ (đối lại dòng thời gian do MÁY ghi). Không sửa, không xoá cứng.';
comment on column public.doc_notes.audience is
  'internal = nội bộ, NCC không thấy. partner = nội dung đã/sẽ gửi ra ngoài.';
comment on table public.doc_followers is
  'Ai được báo khi chứng từ có ghi chú mới. source=auto do service suy ra; muted_at = đã chủ động bỏ theo dõi.';
