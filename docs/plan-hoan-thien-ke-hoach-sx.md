# Hoàn thiện Kế hoạch sản xuất (đối chiếu tư vấn 11 mục — 23/08/2026)

> User cung cấp tài liệu tư vấn về vai Kế hoạch SX và chốt "hoàn thiện phần
> kế hoạch sản xuất trước". Trạng thái: **✅ XONG + NGHIỆM THU UI THẬT
> 23/08/2026** — 0169 đã apply remote, `npm run check` sạch (1532 test).
>
> Nghiệm thu UI thật (Chrome, click từng bước): PlanList 5 KPI + 2 cột mới;
> Theo tổ (Cắt Vải 0% xếp trước, Xưởng SX 67% dự kiến 25/8); Chỉ tiêu ngày
> nhập 250 → Toàn cảnh nhảy 757→1.007 → dọn; kịch bản lý do: sửa hạn không
> lý do bị chặn đúng toast PLAN_REASON_REQUIRED, kèm lý do thì lưu + khối
> lịch sử hiện diff "Hàn: hạn 25/08 → 27/08".
>
> **REGRESSION BẮT ĐƯỢC NHỜ TEST UI THẬT (unit test mock không lộ):** 0165
> drop cột `order_line_id` đã KÉO THEO unique cũ của production_jobs → upsert
> `replaceForLine` ON CONFLICT chết 500 (lưu kế hoạch hỏng từ 0165). Vá:
> **0170** dựng unique mới (production_order_id, production_order_line_id,
> stage) — đã apply remote. BÀI HỌC: drop column kéo rụng constraint/index
> chứa nó — 0165 đã rà VIEW phụ thuộc mà quên rà UNIQUE.

## Đối chiếu 11 mục

| # | Mục tài liệu | Kết luận |
|---|---|---|
| 1-2 | Vai trò + thực thể "Kế hoạch" riêng (KH001, trạng thái Nháp→Đóng) | **KHÔNG làm thực thể riêng** — đã chốt từ roadmap SX: kế hoạch = lộ trình + giao tổ + hạn TRÊN LỆNH (production_jobs); LSX đã có vòng đời 7 trạng thái. Thêm tầng KH001 là thêm mã số phải nhập không thêm thông tin. |
| 3 | Phân bổ 1 công đoạn cho NHIỀU tổ (Tổ 1 400 / Tổ 2 300) | **CHƯA làm** — model hiện tại 1 (dòng SP × công đoạn) = 1 tổ. Trùng câu hỏi §3.5 của `phan-tich-ban-giao-to.md`; chờ câu trả lời thực tế 2 tuần go-live. Tạm thời: chỉ tiêu ngày (0168) đã chia được SL/ngày per tổ; sổ thống kê vốn cho phép nhiều tổ ghi cùng công đoạn. |
| 4 | Tiến độ KH vs thực tế theo ngày + **dự kiến xong đúng hạn không** | Ma trận ngày/sổ tổng/overview đã có; **DỰ KIẾN HOÀN THÀNH là gap thật → LÀM** (forecast = còn lại ÷ nhịp 7 ngày). |
| 5 | Màn **tiến độ theo tổ** (KH/đã làm/còn/%) | **GAP THẬT → LÀM**: `/kehoach-sx/theo-to`. |
| 6 | **Điều chỉnh kế hoạch có LỊCH SỬ + lý do**, không sửa đè im lặng | **GAP THẬT → LÀM** (0169 `production_plan_changes`): tự ghi diff mỗi lần sửa lộ trình; lệnh ĐANG CHẠY sửa phải kèm lý do. |
| 7 | Vòng trạng thái KH riêng + quyền theo trạng thái | Không làm vòng riêng (xem #1-2); phần "đang SX chỉ sửa qua điều chỉnh + lý do" lấy vào #6; hoàn thành đã khoá sẵn (assertEditable). |
| 8 | KH xem số thống kê, không nhập | Đã đúng từ 0084 — thống kê là người nhập duy nhất. |
| 9 | Dashboard riêng cho KH (sắp đến hạn, % SL, trạng thái) | PlanList đã có 3 KPI; **bổ sung**: KPI "Sát hạn xuất", cột SL đạt/cần (%) + dự kiến xong per lệnh. |
| 10 | Sao chép kế hoạch | **Đã có tương đương tốt hơn**: lộ trình MẶC ĐỊNH per SP (`save_as_default` → technical_products.stage_route) tự gợi ý cho mọi lệnh sau — copy theo SP chứ không theo lệnh. Không làm thêm. |
| 11 | Quyền 3 vai (KH lập/điều phối · Thống kê ghi · Tổ trưởng giám sát) | Đã đúng nguyên văn: `production.plan.manage` / `production.output.record` / role-tag production_leader; 3 workspace riêng. |

## Việc code đợt này

1. **0169 `production_plan_changes`** — nhật ký điều chỉnh: diff jsonb
   (thêm/bớt công đoạn, đổi tổ, đổi hạn) + người + lý do. `saveLinePlan`
   tự ghi khi có khác biệt; dòng SP có việc ĐÃ CHẠY (doing/done) mà sửa
   → BẮT lý do (code `PLAN_REASON_REQUIRED`). PlanEditor thêm ô lý do +
   khối "Lịch sử điều chỉnh". (patchJob lẻ chưa log — ghi nhận giới hạn.)
2. **`/kehoach-sx/theo-to`** — per tổ: việc todo/doing/done, SL kế hoạch
   (Σ needed các công đoạn tổ giữ), đã làm, còn, %, nhịp/ngày (7 ngày có
   sổ), **dự kiến xong**, so hạn muộn nhất → cảnh báo trễ.
3. **PlanList** — KPI "Sát hạn xuất"; cột "SL đạt/cần (%)" + "Dự kiến xong"
   per lệnh (overview mở rộng qty_needed/qty_done/forecast_date).

## Đối chiếu tài liệu tư vấn THỨ BA (24/08/2026 — "Tạo kế hoạch sản xuất")

User đưa thêm tài liệu về form "Tạo kế hoạch" (mã KH-xxx, wizard 3 bước, phân
bổ SL per tổ, vòng trạng thái riêng). Đối chiếu:

| Mục | Kết luận |
|---|---|
| 1, 7, 8 — Thực thể KH-xxx + vòng trạng thái + wizard | KHÔNG làm — lần thứ BA cùng đề xuất, đã chốt 2 lần: kế hoạch sống trên lệnh. |
| 2 — Chọn SP từ danh mục, không gõ tay | Đã đúng: dòng lệnh gắn product_id từ thư viện SP. |
| 3 — Phân rã theo ngày ("hôm nay 100, làm 70, thiếu 30") | Đã có (số suy + chỉ tiêu 0168). **ĐIỂM LẤY THÊM → ĐÃ LÀM 24/08**: ô "Áp dụng đến ngày" ở màn Chỉ tiêu — giao CÙNG lưới cho cả khoảng ngày một lượt (tối đa 31 ngày, ghi đè từng ngày; chỉ tiêu là số/ngày, không chia). Verify: PUT 3 ngày 24–26/08 nhận đúng rồi dọn. |
| 4–5 — Phân bổ SL per tổ / per công đoạn | Chính tài liệu tự khuyên: "đang thống kê theo công đoạn thì khai theo công đoạn… đừng phức tạp" — hệ đang ở đúng nhánh (jobs per công đoạn × tổ). Chia 1 công đoạn cho NHIỀU tổ vẫn treo theo câu 5 phân tích bàn giao. |
| 6 — Validation khi lưu | Phần áp được đã có (ngày kết thúc ≥ bắt đầu, công đoạn hợp lệ/lặp, chặn xoá đã chạy); "tổng phân bổ = KH" không áp vì model không giữ SL per job. |
| 9 — Thống kê không tạo lại KH, tổ trưởng chỉ xem tổ mình | Đã đúng nguyên văn từ 0084/0087. |

Ghi chú test 24/08: tab Chrome bị kẹt input (cửa sổ không nhận trusted event
— activeElement=BODY) nên bước bấm tay verify bằng API cùng payload; UI field
render đúng (screenshot). Bấm tay thật đã pass hôm 23/08 trên cùng màn.

## "Theo tuần" — quyết định + màn Kế hoạch tuần (24/08/2026)

User hỏi ý kiến về kế hoạch THEO TUẦN. Quyết định (đồng bộ 3 lần từ chối
thực thể KH): **tuần là LĂNG KÍNH ĐỌC, không phải thực thể** — nhu cầu điều
hành theo tuần là thật (nhịp xuất w37.26 của Sales) nhưng bản ghi "KH-tuần"
chỉ đẻ mã số phải nhập; mọi dữ liệu tuần đã suy được từ jobs + targets +
entries.

ĐÃ LÀM: màn `/kehoach-sx/tuan` (weekService.board — có test, không migration):
① Lệnh phải XUẤT trong tuần (%SL + dự kiến kịp/trễ so ship_date);
② Việc đến hạn từng ngày (quá hạn đánh ⚠);
③ Ma trận tổ × 7 ngày "đạt/chỉ tiêu" + Σ tuần — giao chỉ tiêu cả tuần bằng
   "Áp dụng đến ngày" ở màn Chỉ tiêu.
Điều hướng ← Tuần trước · Tuần này · Tuần sau →. Verify UI thật 24/08: tuần
24–30/8 hiện đúng "LSX-TEST-UI xuất 28/8 · 800/1.800 (44%) · dự kiến 27/8 —
kịp" + việc hạn 27/8 vừa điều chỉnh.

## Tài liệu tư vấn THỨ TƯ (24/08 — "KH-xxx + wizard + BTP") — đối chiếu

Cùng họ với 3 tài liệu trước, lõi giống hệt: thực thể KH-001 + wizard 3 bước +
trạng thái phát hành riêng → **từ chối LẦN TƯ, cùng lý do**: kế hoạch sống
trên lệnh (production_jobs), thêm tầng KH là thêm mã số phải nhập không thêm
thông tin. Điểm tài liệu nói đúng thì hệ ĐÃ chạy đúng nguyên văn: kế hoạch
không nhập sản lượng (thống kê nhập, "Đã SX" đọc từ sổ); tổ trưởng chỉ
xem/bắt đầu/xác nhận; timeline = /kehoach-sx/tien-do; dashboard = StatsBar +
Toàn cảnh + /theo-to; phân quyền = production.plan.manage / /to / /thongke.

Điểm MỚI duy nhất của bản này: chuỗi **BTP (bán thành phẩm) input→output per
công đoạn** + đếm nhận/đạt/lỗi/chuyển tiếp. KHÔNG lấy mô hình mã BTP tuyến
tính (BTP-MB-CAT → BTP-MB-GC…) vì: (1) hệ đã đếm MỊN HƠN — sổ thống kê theo
(ngày × tổ × công đoạn × chi tiết/cụm) trên BOM 2 cấp, chính là "một công
đoạn ra nhiều BTP" mà mục 6 tài liệu thừa nhận mô hình tuyến tính không xử
được; (2) "đầu ra trước = đầu vào sau" đã có bằng transfers + WIP + đồng bộ
SP=MIN các công đoạn (đúng logic nhận 100 → đạt 95 → công đoạn sau 95); (3)
sinh danh mục mã BTP là thêm lớp phải bảo trì — bộ ba (dòng lệnh × công đoạn
× chi tiết) đã định danh duy nhất bán thành phẩm. Tab "Vấn đề/phát sinh" có
cấu trúc: đã chốt không làm form sự cố (QC không lên hệ thống); kênh hiện có
= note trên job + lý do phế + cảnh báo nghẽn WIP/thiếu VT — go-live cho thấy
thiếu thật thì mới mở lại. Flow view per lệnh (CẮT 100/100 → HÀN 95/100):
lăng kính đọc nhỏ, cân nhắc SAU go-live nếu người dùng thật cần.

Nếu có tài liệu thứ NĂM cùng họ → chỉ vào mục này, đừng đối chiếu lại.

## Thiết kế lại theo thực tế điều độ (24/08 — user chốt qua 4 câu hỏi)

User: "thiết kế hiện tại không giống thực tế công việc của người lên kế hoạch".
Hỏi 4 câu, chốt được: việc thật = ưu tiên lệnh + phân tổ + đặt mốc + trả lời
kịp hạn; **kế hoạch lập ở tầm CẢ LỆNH** (không phải per dòng SP); độ mịn giữ
ngày bắt đầu/kết thúc; người tiêu thụ chính là THỐNG KÊ (nhìn để giao phôi).
Bằng chứng thiết kế cũ sai tầm: 11/11 lệnh active trống kế hoạch — công cụ
đúng mà không ai dùng là trả lời sai câu hỏi.

ĐÃ LÀM: `saveLsxPlan` (lsxPlanSchema `{scope:'lsx'}` cùng route PUT plan) —
MỘT lộ trình công đoạn+tổ+hạn cho cả lệnh, server rải xuống từng dòng theo
`stage_route` riêng của SP (dòng không có công đoạn thì không sinh việc; dòng
chưa có lộ trình nhận đủ); kiểm TOÀN BỘ trước khi ghi (một dòng vướng công
đoạn đã chạy → chặn cả lượt, chỉ tên dòng); diff gộp ghi MỘT bản
`production_plan_changes` với line_id **null = CẢ LỆNH** (UI lịch sử hiện
nhãn CẢ LỆNH); lý do bắt buộc khi lệnh có việc chạy. UI: khối "Kế hoạch cả
lệnh" viền cobalt trên cùng PlanEditor — chip công đoạn + bảng tổ/ngày/SL
các dòng áp/nhịp suy (`paceForWindow`) + nút "Áp cho tất cả dòng SP"; mồi
draft từ dòng có nhiều công đoạn nhất. Tầng dòng SP giữ nguyên = tinh chỉnh
ngoại lệ. Verify UI thật trên LSX-TEST-UI 24/08: áp thêm Mài (chặn thiếu lý
do đúng, việc đang chạy giữ nguyên, lịch sử "CẢ LỆNH + Mài") rồi gỡ trả
nguyên trạng.

BỔ SUNG cùng ngày (user: "bỏ áp cho tất cả đi"): fan-out MẶC ĐỊNH chỉ áp cho
dòng CHƯA có kế hoạch — dòng đã lập/tinh chỉnh giữ nguyên (`lines_kept` trả
về + toast nói rõ); muốn ghi đè phải tick "Ghi đè cả N dòng đã có kế hoạch"
(cờ `overwrite`, mặc định false), lúc đó mới hiện ô lý do + guard đã-chạy.
Mọi dòng đã có KH mà không bật ghi đè → 400 chỉ đường bật cờ (verify UI
thật). Nút đổi nhãn theo cờ: "Áp cho dòng chưa có KH" / "Áp & ghi đè kế hoạch".

BỔ SUNG tiếp (user: "làm sao biết SL từng công đoạn, tiến độ, vấn đề"): bảng
**Tiến độ theo công đoạn** ngay trên trang kế hoạch lệnh — lib
`lsxStageProgress` (có test): per công đoạn quy về BỘ SP theo đúng quy tắc
"đồng bộ SP=MIN" của sổ Tổng TĐ SX áp cho TỪNG công đoạn (min theo chi tiết
của floor(done×SL dòng/tổng cần), cap SL dòng; chi tiết chỉ tham gia trong
khoảng [first..final] — summary.stages đã cắt sẵn; tổng cần 0 bỏ khỏi min);
cột: SL đạt/cần, %, việc xong x/y dòng, quá hạn KH (planned_end < hôm nay &
chưa done), phế (đơn vị chi tiết), ghi chú tổ (note đầu + đếm). Nguồn:
entriesService.summary (cùng payload Hồ sơ lệnh) + jobs từ planService.get.
Nghẽn WIP/thiếu VT cố ý KHÔNG kéo vào (cần transfers) — chú thích trỏ Toàn
cảnh. Verify trên LSX-TEST-UI: Phôi 100/100·100%, Hàn 30/100·phế 7, Nguội
0/100·1 việc quá hạn — khớp sổ seed.
