# Kế hoạch SX — GĐ 2 (chỉ tiêu ngày + vạch thời gian) + GĐ 3 (ma trận tiến độ, nghẽn WIP)

> Soạn 23/08/2026. Trạng thái: **✅ XONG TOÀN BỘ 23/08/2026 — kể cả 2.2**
> (user chốt "hoàn thành SX" cuối ngày: 0168 production_daily_targets đã
> apply remote, màn `/kehoach-sx/chi-tieu`, overview ưu tiên chỉ tiêu thật
> qua `resolveDailyTargets` — chỉ tiêu 0 cũng là chỉ tiêu). `npm run check`
> sạch, 1525 test. Bản đồ tổng: `plan-san-xuat-roadmap.md`.
>
> Ghi nhận khi làm (khác kế hoạch):
>
> - `deriveDailyTarget` / `isTeamStageBottleneck` / `paceTone` nằm ở
>   `src/lib/production-summary.ts` (có test đủ các case đã liệt kê).
> - Overview quay lại `loadActiveContext` (perf note của GĐ1 hết hiệu lực —
>   components + entries bulk giờ ĐƯỢC dùng để tính needed/done per job).
> - "Viền nghẽn ở ô sổ tổng" KHÔNG làm — ô sổ tổng theo (chi tiết × công
>   đoạn), nghẽn theo (tổ × công đoạn), ánh xạ gượng ép. Thay bằng: badge
>   "Nghẽn: <công đoạn>" + tồn WIP ở panel tổ của Toàn cảnh xưởng, và tô nền
>   late/behind (`paceTone`) + % trên ô sổ tổng.
> - Màn tiến độ: `/kehoach-sx/tien-do`, cửa sổ hôm nay −7 → +21 ngày, icon
>   nav `chart-gantt` (đã đăng ký nav-icons).

---

## GĐ 2 — Chỉ tiêu ngày & nhìn theo thời gian

**Vấn đề.** Khoảng trống lớn nhất hệ thống: chỉ đo thực tế
(`production_entries`), không có kế hoạch để so. Bảng "Kế hoạch hôm nay 1.500
/ đạt 1.280 / 85%" trong tài liệu tư vấn hiện không tính được.
`production_jobs.planned_start/planned_end` là HẠN công đoạn per dòng SP,
không phải chỉ tiêu SL/ngày.

### 2.1 Bước 1 — SUY chỉ tiêu, không bắt ai nhập thêm

Nguyên tắc: đừng thêm màn nhập khi chưa chứng minh người ta cần con số này.

Hàm thuần (đề nghị đặt `src/lib/production-summary.ts` cạnh `backflushKg`):

```
deriveDailyTarget(job, needQty, doneQty, date):
  # needQty = SL cần của (dòng SP × công đoạn), lấy từ calcComponent() đang
  #           dùng ở sổ tổng / báo cáo tháng — KHÔNG tự tính lại
  # doneQty = đã làm luỹ kế đến hết hôm qua
  remainingDays = số ngày từ date → job.planned_end (đếm cả date, bỏ CN)
  if remainingDays <= 0: return needQty - doneQty   # quá hạn: nợ dồn cả
  return (needQty - doneQty) / remainingDays
```

- **Bỏ Chủ nhật** là giả định — xưởng có làm CN mùa cao điểm. Để hằng số
  `WORKING_SUNDAYS = false` một chỗ, đừng rải rác; hỏi user khi demo.
- Job chưa lên lộ trình (`planned_end` null) → không có chỉ tiêu, không tính
  vào mẫu số %.
- Overview: KPI **"Kế hoạch hôm nay / Đạt / %"** toàn xưởng + per tổ (cộng
  `deriveDailyTarget` của mọi job doing/todo có kế hoạch hôm nay nằm trong
  khoảng). Số suy hiện kèm dấu hiệu "(suy từ lộ trình)" — đừng để người xem
  tưởng là chỉ tiêu giao thật.

Test bắt buộc (logic thuần, rủi ro cao): quá hạn nợ dồn, planned_end null,
chia phần dư, khoảng chỉ 1 ngày, doneQty > needQty (kẹp 0).

### 2.2 Bước 2 — bảng chỉ tiêu thật (CHỈ làm khi xưởng muốn giao chỉ tiêu)

Đây là bước tuỳ chọn, mở khi user xác nhận muốn GIAO chỉ tiêu chứ không chỉ
xem số suy. Migration (đánh số lúc code, sau 0165):

```sql
-- production_daily_targets — chỉ tiêu sản lượng NGÀY × TỔ × CÔNG ĐOẠN.
-- Khớp sổ thật của thống kê (ma trận ngày×tổ×công đoạn), KHÔNG chẻ theo
-- dòng SP — giao chỉ tiêu theo tổ là mức xưởng thực sự điều hành.
-- RLS enabled, no policies (anon chặn, secret-key server bypass).
create table if not exists production_daily_targets (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  team_department_id uuid not null references departments(id) on delete cascade,
  stage text not null,
  qty numeric(14,2) not null check (qty >= 0),
  note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_date, team_department_id, stage)
);
alter table production_daily_targets enable row level security;
```

- Trigger `set_updated_at` như mọi bảng. Ghi qua service mới
  `targetsService.saveDay` (upsert theo unique), quyền cùng nhóm với
  `/kehoach-sx` (soi `perms.ts`).
- UI: tab "Chỉ tiêu ngày" trong `/kehoach-sx` — lưới tổ × công đoạn cho 1
  ngày, gõ nhanh kiểu FastEntryGrid (tái dùng pattern phím tắt, không copy
  nguyên file).
- Overview: có chỉ tiêu thật cho (ngày, tổ, công đoạn) thì **ưu tiên**, thiếu
  thì rơi về số suy — một hàm `resolveDailyTarget` gói cả hai, test cả nhánh.

### 2.3 Màn vạch thời gian (thay Gantt)

Trang mới `/kehoach-sx/tien-do` (SSR, không thư viện chart mới — CSS grid):

- Mỗi lệnh 1 hàng; trong hàng, mỗi công đoạn 1 vạch từ
  `min(planned_start)` → `max(planned_end)` của các job công đoạn đó.
- Trục ngang: hôm nay ± ~3 tuần, vạch dọc "hôm nay".
- Màu: vạch bình thường `--accent` nhạt; **đỏ (`--stop`)** khi
  `planned_end < hôm nay` mà công đoạn còn job todo/doing; xám khi xong hết.
- Bấm vạch → sang `/kehoach-sx/[id]` (PlanEditor) sửa lộ trình.
- Đây là màn ĐỌC — không kéo-thả. Kéo-thả chỉ cân nhắc khi user đòi sau khi
  dùng thử.

**Khối lượng GĐ 2:** bước 1 + 2.3 ≈ 2 buổi; bước 2 (nếu mở) +1 buổi.

---

## GĐ 3 — Ma trận tiến độ + cảnh báo nghẽn WIP

**Vấn đề.** Sổ tổng (`thongke/so-tong`) đã đúng hình (hàng = chi tiết/cụm,
cột = công đoạn, ô = đã làm/cần) nhưng là màn tra cứu — chưa trả lời nhanh
"nghẽn ở đâu". Dữ liệu `production_transfers` (giao − trả) chưa lên bất kỳ
màn điều hành nào.

### 3.1 Nâng sổ tổng thành ma trận điều hành

- Mỗi ô thêm **%** (đã làm/cần) và tô nền theo ngưỡng: <50% quá nửa thời gian
  kế hoạch → nền `--warn` nhạt; công đoạn đứng sau đói việc vì công đoạn
  trước chưa nhả (xem 3.2) → viền `--stop`. Giữ chữ số là chính, màu chỉ phụ
  hoạ — in trắng đen vẫn đọc được (màn này có nút In).
- Thêm hàng tổng per lệnh: % hoàn thành lệnh = MIN % các công đoạn cuối
  (nhất quán với cột "Đồng bộ" hiện có, đừng phát minh công thức thứ hai).

### 3.2 Tồn WIP tại tổ + cảnh báo nghẽn

Tồn WIP tại (tổ × công đoạn × chi tiết) =
`Σ transfers issue − Σ transfers return − Σ entries đã làm` (cùng công thức
TransferBoard đang dùng — trích ra hàm thuần dùng chung, có test).

Cảnh báo nghẽn — quy tắc đơn giản trước:

```
nhịp tổ = trung bình SL đạt/ngày của (tổ × công đoạn) trong 7 ngày có ghi sổ gần nhất
tồn WIP / nhịp > NGHEN_THRESHOLD_DAYS (mặc định 3 ngày) → nghẽn
nhịp = 0 mà tồn > 0 quá 2 ngày → nghẽn (tổ ôm phôi không làm)
```

Ngưỡng để hằng số một chỗ, chỉnh sau theo phản hồi xưởng — đừng làm màn cấu
hình vội.

UI:

- Panel "Tải việc theo tổ" ở Toàn cảnh xưởng (đã thêm SL ở GĐ 1): thêm cột
  **Tồn WIP** + badge "Nghẽn" khi dính quy tắc trên.
- Sổ tổng: ô công đoạn của tổ nghẽn nhận viền cảnh báo (3.1).

### Test

- Hàm tồn WIP + quy tắc nghẽn: unit test (nhịp 0, tổ mới nhận phôi hôm nay,
  trả phôi nhiều hơn nhận — kẹp 0, đúng 7 ngày cửa sổ chỉ đếm ngày CÓ ghi sổ).
- % ma trận: tái dùng test `calcComponent` hiện có, chỉ thêm case tổng lệnh
  = MIN công đoạn cuối.

### Khối lượng

GĐ 3: ~2 buổi (1 buổi hàm + test, 1 buổi UI hai màn).
