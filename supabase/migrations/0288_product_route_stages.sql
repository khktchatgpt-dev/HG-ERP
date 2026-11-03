-- 0288: LỘ TRÌNH KHAI THEO CỤM — danh sách công đoạn, không phải khoảng đầu–cuối.
--
-- Bước B2 của docs/san-xuat-cau-hinh-thiet-ke.md (chủ dự án duyệt 03/11/2026).
--
-- VẤN ĐỀ. `technical_product_clusters.first_stage/final_stage` (0097) là một
-- KHOẢNG trên danh mục công đoạn có thứ tự cố định — ghế nhôm "phôi → nguội →
-- sơn" (không hàn) không khai được bằng khoảng. Lệnh đang suy lộ trình theo
-- nhóm vật tư (`lib/stage-route`), đúng cho khung sắt, sai cho mọi ngoại lệ.
-- Bản tư vấn 03/11 (mục 2) và sổ Excel v2 của xưởng (DM_CUM cột G..L) đều khai
-- bằng cờ x từng công đoạn.
--
-- THIẾT KẾ. Ba cột `stages text[]` (mã catalog production_stage, ĐÚNG THỨ TỰ
-- chạy; null = chưa khai, để máy suy như cũ):
--   technical_product_clusters.stages  — lộ trình của CỤM (cả bước chi tiết lẫn
--                                        bước cụm; tách theo bậc đếm 0287 lúc
--                                        định hình: bước đếm 'part' thuộc chi
--                                        tiết trong cụm, còn lại thuộc dòng cụm)
--   technical_product_parts.stages     — ghi đè cho CHI TIẾT RỜI (không cụm);
--                                        null = suy theo nhóm vật tư
--   production_components.stages       — bản CHỤP lúc định hình lệnh (người
--                                        thắng máy; kế hoạch lệnh `production_jobs`
--                                        vẫn thắng khi có)
-- Thứ tự ưu tiên khi hỏi "dòng này đi qua công đoạn nào" (lib/stage-route
-- `resolveComponentRoute`): kế hoạch lệnh → stages chụp trên lệnh → stages của
-- cụm / dòng định mức → nhóm vật tư → rỗng (không đoán).
--
-- GIỮ first_stage/final_stage: dữ liệu cũ (7 dòng final, 1 first) vẫn đọc được
-- qua `clipRoute`; không chuyển đổi, không xoá cột.
--
-- RLS: không đổi (ba bảng đã enable, no policies). Idempotent: add column if
-- not exists. Không chạm dữ liệu — 30 cụm hiện có null = hành vi y như trước.

alter table public.technical_product_clusters
  add column if not exists stages text[];
comment on column public.technical_product_clusters.stages is
  'Lộ trình cụm: mã production_stage đúng thứ tự chạy (0288). null = chưa khai, suy theo nhóm vật tư.';

alter table public.technical_product_parts
  add column if not exists stages text[];
comment on column public.technical_product_parts.stages is
  'Ghi đè lộ trình cho chi tiết RỜI (0288). null = suy theo group_code. Dòng trong cụm theo cụm.';

alter table public.production_components
  add column if not exists stages text[];
comment on column public.production_components.stages is
  'Bản chụp lộ trình lúc định hình (0288). null = suy theo group_code; kế hoạch lệnh vẫn thắng.';
