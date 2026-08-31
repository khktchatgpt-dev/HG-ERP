-- 0180 — Tài liệu hồ sơ SP: mở rộng danh mục loại tài liệu
--
-- LÀM GÌ: nới `files_doc_type_valid` thêm 5 giá trị:
--   · sample_photo — ảnh MẪU ĐÃ DUYỆT (khác `image` = ảnh SP đại diện)
--   · label        — nhãn / mã vạch / shipping mark (file artwork)
--   · loading      — sơ đồ xếp cont
--   · approval     — hồ sơ khách duyệt mẫu (email/PO xác nhận)
--   · video        — video quay mẫu, hướng dẫn lắp
--
-- VÌ SAO: đo ngày 31/08/2026, 1 143 file gắn SP chỉ rơi vào ĐÚNG 3 loại —
-- image 654, bom 483, packing 6. Bốn loại còn lại (drawing/assembly/cert/other)
-- bằng 0. Nguyên nhân chính là định dạng bị chặn ở tầng MIME chứ không phải
-- thiếu danh mục (xem 0059/0150 cho gốc), nhưng mấy thứ trên thì đúng là chưa
-- có chỗ nào để đứng nên vẫn nằm ngoài hệ thống.
--
-- Vòng đời doc_type: 0059 (6 giá trị) → 0150 (+packing) → 0180 (+5 ở trên).
--
-- RLS: `files` đã bật RLS không policy từ migration tạo bảng — sửa CHECK không
-- đụng tới tư thế đó. Không tạo bảng/view mới.
--
-- CAVEAT: chỉ nới, KHÔNG chuyển đổi dữ liệu cũ. File nào đang `other`/null thì
-- vẫn nằm nguyên đó — phân loại lại là việc của người biết file đó là gì.
--
-- Sau khi áp: "sync types" (doc_type là cột text nên type không đổi, giữ nếp).

alter table public.files drop constraint if exists files_doc_type_valid;

alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in (
      'drawing',
      'bom',
      'packing',
      'assembly',
      'image',
      'sample_photo',
      'label',
      'loading',
      'cert',
      'approval',
      'video',
      'other'
    )
  ) not valid;

-- `not valid` rồi validate riêng: bảng đã có nghìn dòng, tách hai bước thì lần
-- khoá bảng ngắn hơn. Dữ liệu cũ chắc chắn hợp lệ (tập giá trị chỉ NỞ ra).
alter table public.files validate constraint files_doc_type_valid;
