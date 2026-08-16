-- 0156 — DUNG SAI NHẬN VƯỢT theo vật tư (plan-cung-ung-kho-hoan-thien GĐ B).
--
-- BỐI CẢNH: gỗ/kính/tôn cân đo lệch ±3-5% là chuyện thường, nhưng guard nhận
-- vượt (lib/po-receipt, 409 OVER_RECEIPT) chặn từ 0,1% → người nhận phải gõ
-- lý do cho những lệch vặt → học cách gõ bừa, cờ allow_over mất giá trị.
--
-- THIẾT KẾ: ngưỡng đặt TRÊN TỪNG VẬT TƯ (default 0 = chặt như cũ), trần 20%.
-- Không FK theo nhóm — nhóm là text tự do (free-text-over-fk); gán theo nhóm là
-- thao tác bulk trên UI danh mục. Dưới ngưỡng: cho qua + tự ghi note
-- "[Vượt x% trong dung sai]" vào dòng phiếu; trên ngưỡng: giữ nguyên cổng 409.
-- Nhận THIẾU không liên quan dung sai — xử bằng giao bù / chốt thiếu (0154).
--
-- RLS: bảng đã enable từ 0009. Idempotent. Apply xong chạy skill sync-types.

alter table public.warehouse_materials
  add column if not exists over_tolerance_pct numeric(5, 2) not null default 0
    check (over_tolerance_pct >= 0 and over_tolerance_pct <= 20);

comment on column public.warehouse_materials.over_tolerance_pct is
  'Dung sai NHẬN VƯỢT (%) trên SL đặt của dòng PO — 0 = chặn mọi mức vượt (0156)';
