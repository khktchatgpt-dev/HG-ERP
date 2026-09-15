-- 0192: THUẾ SUẤT VAT TRÊN HỒ SƠ NHÀ CUNG CẤP.
--
-- Vì sao cần: thuế suất mặc định của đơn mua đang do MẪU ĐƠN quyết, hằng số
-- trong mã (`PO_TEMPLATE_META` ở `src/lib/po-template.ts`): nhôm 10, phụ kiện 8,
-- gỗ 10… Nhưng thuế là thoả thuận với TỪNG nhà cung cấp, không phải thuộc tính
-- của loại hàng. Đơn thật 05 HG/ĐT (Đức Toàn Phú Tài, gỗ) ghi 8% trong khi mẫu
-- gỗ khai 10% — người soạn phải nhớ gõ đè mỗi lần, quên là đơn in sai thuế.
--
-- Cách làm: cho khai thuế suất ngay trên hồ sơ NCC, đơn mới kế thừa xuống — ĐÚNG
-- lối `currency` đang chạy (chọn NCC gỗ là ô tiền tệ tự sang USD). Mẫu đơn vẫn
-- là mức rơi về khi NCC chưa khai, và ô thuế trên form vẫn sửa được từng đơn.
--
-- null = CHƯA KHAI, khác hẳn 0 (hàng không chịu thuế). Đây là lý do cột để
-- nullable chứ không default 10 — default là quay lại đúng cái bệnh đang chữa.
--
-- RLS: bảng `supply_suppliers` đã bật row level security không policy từ 0074,
-- thêm cột không đổi tư thế bảo mật.
--
-- SAU KHI CHẠY: "sync types" để `src/lib/database.types.ts` có cột mới, nếu
-- không `next build` sẽ đỏ trên Vercel.

alter table public.supply_suppliers
  add column if not exists vat_rate numeric(5, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supply_suppliers'::regclass
      and conname = 'supply_suppliers_vat_rate_check'
  ) then
    alter table public.supply_suppliers
      add constraint supply_suppliers_vat_rate_check
      check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100));
  end if;
end $$;

comment on column public.supply_suppliers.vat_rate is
  'Thuế suất VAT thoả thuận với NCC này (%). Đơn mua mới kế thừa xuống, vẫn sửa được từng đơn. null = chưa khai, rơi về mức của mẫu đơn; 0 = không chịu thuế (0192).';
