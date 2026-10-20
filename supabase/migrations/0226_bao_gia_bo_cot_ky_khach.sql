-- Kinh doanh: BÁO GIÁ bỏ cột ký "KHÁCH HÀNG / CUSTOMER" trên mẫu in
-- (07/10/2026, lượt 6 hoàn thiện Sale — chủ dự án: "phần in báo giá khách hàng
-- không ký").
--
-- Vì sao: báo giá là tờ CHÀO gửi khách; khách ký ở hợp đồng / PO của họ, không
-- ký lên báo giá. Seed 0164 đặt 3 cột ký (Khách · Người lập · Giám đốc) theo mẫu
-- Excel cũ — thừa cột đầu.
--
-- Chỉ sửa DỮ LIỆU mẫu (doc_templates.kind = 'BG'), không đổi cấu trúc. Idempotent:
-- lọc theo role nên chạy lại không hại; nếu quản trị đã tự sửa cột ký thì cũng
-- chỉ bỏ đúng phần tử khách. RLS của doc_templates giữ nguyên (0164: bật, không
-- policy — anon chặn, khoá bí mật server bỏ qua).
update public.doc_templates
set signatures = coalesce(
  (
    select jsonb_agg(e)
    from jsonb_array_elements(signatures) as e
    where e->>'role' not ilike '%CUSTOMER%'
      and e->>'role' not ilike '%KHÁCH HÀNG%'
  ),
  '[]'::jsonb
)
where kind = 'BG'
  and exists (
    select 1 from jsonb_array_elements(signatures) as e
    where e->>'role' ilike '%CUSTOMER%' or e->>'role' ilike '%KHÁCH HÀNG%'
  );
