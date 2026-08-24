# Kế hoạch SX — GĐ 4 (tầng báo cáo) + GĐ 5 (vá chất lượng dữ liệu)

> Soạn 23/08/2026. Trạng thái: **✅ XONG 23/08/2026** (trừ 5.4 — chủ đích chờ
> bài lương SP; 5.3 đã hủy từ GĐ 1). `npm run check` sạch, 1507 test.
> Bản đồ tổng: `plan-san-xuat-roadmap.md`.
>
> Ghi nhận khi làm (khác kế hoạch):
>
> - Tầng dữ liệu: `reports.service.ts` (sanLuong/phe/nangSuat/dinhMuc, trần kỳ
>   92 ngày) + `reports-excel.ts` + route `GET /api/dept/production/reports`
>   (`?format=xlsx` tải file). Trang `bao-cao` đã chuyển sang gọi service.
> - "So khớp từng ô với bản cũ trên 1 tháng dữ liệu thật" KHÔNG thực hiện
>   được: bảng production_* trên remote còn RỖNG (module chưa go-live số
>   liệu). Thay bằng port NGUYÊN VĂN công thức cũ + unit test cố định hành vi
>   (by_day theo from, lũy kế mọi kỳ, tổng cần từ calcComponent).
> - `OutsourceWorkbench` KHÔNG có ô kg → 5.1 chỉ backflush phía server
>   (`outsourceService.record`), không có hint UI để thêm.
> - 0166 (constraint return reason) ĐÃ apply remote — bảng rỗng, backfill chỉ
>   là phòng thủ.

---

## GĐ 4 — Tầng báo cáo

**Vấn đề.** Báo cáo tháng (`thongke/bao-cao/page.tsx`, 317 dòng) là SSR
thuần: gom số ngay trong page, không có service/API — muốn Excel, mobile,
dashboard hay kỳ tự do đều phải viết lại từ đầu. Khoá cứng theo tháng
(`monthRange`, :24–31). `worker_name` đã lưu từng lần ghi sổ nhưng chưa có
báo cáo nào đọc. Chưa có báo cáo phế, chưa có định mức vs thực dùng.

### 4.1 Tách tầng dữ liệu — làm TRƯỚC mọi báo cáo mới

- Module mới trong `src/modules/dept/production/`: `reports.service.ts` (+
  `reports.repo.ts` nếu query dài). Nhận `{from, to, team?, stage?, lsx?}` —
  kỳ TỰ DO, tháng chỉ là trường hợp riêng.
- Route mỏng `GET /api/dept/production/reports?type=...` — `handle()` +
  `requireUser` + `parseQuery` (zod) + `assertAction` (cùng action khu
  `thongke` đang gác — soi `perms.ts`).
- **Trang `bao-cao` hiện có chuyển sang gọi service này** (vẫn SSR được — page
  server component gọi thẳng service, không cần qua HTTP). Số phải khớp
  từng ô với bản cũ trước khi xoá code gom cũ — chạy song song 1 nhịp, diff
  bằng mắt trên 1 tháng có dữ liệu thật.

### 4.2 Bốn loại báo cáo

| type        | Nội dung                                                                                                   | Nguồn                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `san-luong` | ma trận hiện có nhưng kỳ tự do; nhóm được theo ngày/tuần/tháng, tổ, công đoạn, SP                           | `production_entries` + `calcComponent()`                         |
| `phe`       | phế theo tổ / công đoạn / lý do (`defect_reason` gom nhóm text — KHÔNG dựng danh mục lý do vội)             | `production_entries.defect_qty/defect_reason`                    |
| `dinh-muc`  | per LSX: cần (snapshot × SL dòng) vs đã xuất kho vs kg backflush → hao hụt, chênh lệch                     | `production_order_boms` × lines, `v_lsx_material_status`, `kg`   |
| `nang-suat` | SL đạt/phế theo `worker_name` (text, gom `trim/upper` để đỡ lệch chính tả) — kèm chú thích "tên gõ tay"     | `production_entries.worker_name`                                 |

Ghi chú `dinh-muc`: hai con số "thực dùng" CỐ Ý khác nhau — kg backflush là
số sổ thống kê (phần lớn = ĐM × SL nên chỉ lệch khi gõ tay kg), đã xuất kho
là số sổ kho. Báo cáo bày CẢ HAI cạnh "cần", đừng trộn thành một cột.

### 4.3 Xuất Excel

- Theo pattern `lsx-excel.ts` (exceljs, đã có sẵn cách dựng khuôn + ô gộp).
  Route `?format=xlsx` trên cùng endpoint reports.
- BẪY đã biết (memory `xuat-excel-ho-so-sp`): ô gộp exceljs + numFmt có dấu
  phẩy — soi lại doc đó trước khi viết.
- Nút "Tải Excel" đặt cạnh nút In hiện có ở màn báo cáo.

### Test GĐ 4

- `reports.service`: kỳ tự do cắt đúng biên (from=to 1 ngày; qua tháng; qua
  năm); phế gom lý do sau trim/upper; `dinh-muc` với LSX chưa snapshot (phải
  báo "chưa chốt định mức" chứ không ra 0 sạch); worker_name rỗng gom vào
  "(không ghi tên)".
- So khớp bản cũ: 1 tháng thật, từng ô ma trận (viết test so sánh 2 hàm gom
  trong thời gian chuyển tiếp rồi mới xoá hàm cũ).

**Khối lượng GĐ 4:** ~3–4 buổi (tầng dữ liệu + chuyển màn cũ 1,5 buổi; 3 báo
cáo mới 1,5 buổi; Excel 1 buổi).

---

## GĐ 5 — Vá chất lượng dữ liệu & ràng buộc

Bốn việc độc lập, mỗi việc ≤ nửa buổi:

### 5.1 Backflush kg cho gia công ngoài

`production_outsource_entries.kg` không được tự điền như đường ghi sổ thường
(`entriesService.record` có `backflushKg`, outsource không). Sửa
`outsourceService.record`: kg bỏ trống → `backflushKg(kg, dm_kg, qty)` với
`dm_kg` của component. UI OutsourceWorkbench thêm gợi ý "Bỏ trống = tự tính
ĐM × SL" như FastEntryGrid (:335, :429). Test: gửi đi/nhận về đều backflush.

### 5.2 Ràng buộc DB: hoàn trả phải có lý do

0090 ghi "reason bắt buộc ở service" — DB chưa ép. Migration (đánh số lúc
code):

```sql
-- transfers: hoàn trả (return) bắt buộc reason — nâng ràng buộc từ service
-- xuống DB. Idempotent qua drop/add trong do-block vì Postgres không có
-- "add constraint if not exists".
do $$ begin
  alter table production_transfers
    add constraint production_transfers_return_reason_ck
    check (direction <> 'return' or reason is not null);
exception when duplicate_object then null; end $$;
```

Trước khi apply: query đếm dòng `return` có `reason is null` trên remote —
có dòng cũ vi phạm thì backfill `'(không ghi lý do — dữ liệu cũ)'` trong cùng
migration.

### 5.3 `jobsService.overview` thiếu assertAction — ĐÃ RÀ, KHÔNG LÀM

Rà 23/08 khi làm GĐ 1: đây là CHỦ ĐÍCH, không phải lỗ hổng — comment ở
`production/page.tsx` ghi rõ user đã chốt "tách UI theo vai, KHÔNG tách quyền;
vào bằng URL vẫn xem được". Đừng thêm assertAction ở đây nữa.

### 5.4 FK danh mục công nhân — KHÔNG làm bây giờ

`worker_name` giữ text tự do đúng ghi chú 0090: *"nâng sau khi làm lương sản
phẩm"*. Chỉ làm cùng bài lương SP (danh mục công nhân + backfill khớp tên +
UI chọn thay gõ). Ghi ở đây để khỏi ai "tiện tay" làm sớm — làm sớm là đẻ
danh mục không ai bảo trì.

### Ngoài lề đã ghi nhận, KHÔNG thuộc đợt này

- `bom-snapshot.repo.ts:129–142` xoá dòng thừa bằng loop N+1 — chỉ đáng sửa
  nếu profiling thấy chậm thật (số dòng nhỏ).
- Backfill 0142 chụp định mức "hôm nay" cho 8 lệnh cũ — dữ liệu gốc đã mất,
  chấp nhận, đừng cố "sửa sử".
