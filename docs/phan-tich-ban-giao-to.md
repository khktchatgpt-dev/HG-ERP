# Phân tích: Bàn giao giữa các TỔ trong xưởng (chưa code — cần đối chiếu thực tế)

> Soạn 23/08/2026 theo yêu cầu user: "vấn đề bàn giao từ tổ này cho tổ khác
> cần phân tích kĩ theo thực tế". Trạng thái: **PHÂN TÍCH — KHÔNG CODE** cho
> tới khi trả lời xong bộ câu hỏi §3 bằng quan sát thật tại xưởng.

## 1. Hệ thống hiện mô hình hoá bàn giao như thế nào

Sổ bàn giao (`production_transfers`, 0090) chỉ có **một chiều "vào tổ"**:

- `issue` — giao phôi/WIP VÀO một tổ để làm MỘT công đoạn (per chi tiết ×
  công đoạn × tổ), thay cột "SL giao 1..4" của sheet tổ Excel.
- `return` — tổ trả lại (lỗi/thừa), bắt buộc lý do (0166).
- Tồn WIP tại tổ = `issue − return − đã làm` (dẫn xuất, không lưu cứng).

**Bàn giao GIỮA hai tổ hiện là NGẦM**, ghép từ ba mảnh rời:

1. Tổ A ghi sản lượng đạt ở công đoạn X (`production_entries`) — số này *coi
   như* sẵn sàng cho công đoạn X+1.
2. Tổ trưởng A bấm "Xong công đoạn" → event `production.stage.done` notify tổ
   giữ công đoạn kế (đã có bàn giao mức THÔNG BÁO).
3. Thống kê ghi một dòng `issue` MỚI cho tổ B ở công đoạn X+1 — không ràng
   buộc gì với số tổ A đã báo đạt.

Nghĩa là: không có bản ghi nào nói "tổ A giao cho tổ B N cái, lúc nào, ai
nhận"; số giao vào B có thể gõ tuỳ ý so với số A báo đạt (chỉ có cảnh báo
`teamWipShortageWarning` khi tổ ghi VƯỢT số được giao).

## 2. Thực tế đã biết (từ hồ sơ nghiệp vụ cũ)

- Tổ chức: QC không lên hệ thống; **thống kê là người nhập duy nhất**, cầm
  quyền tổ trưởng; chuyển giao "theo số lượng".
- Sổ Excel gốc (Tổng TĐ SX): mỗi tổ một sheet với "SL giao 1..4 / Tổng giao /
  Thiếu-Dư" — tức thực tế cũng chỉ ghi **giao VÀO tổ**, không có sổ ký nhận
  hai chiều giữa tổ.
- BOM 2 cấp: phôi đếm theo CHI TIẾT, từ hàn đếm theo CỤM → điểm bàn giao
  phôi→hàn còn là điểm ĐỔI ĐƠN VỊ ĐẾM (n chi tiết = 1 cụm), đã xử lý một phần
  bằng `assemblyWipWarning` (cảnh báo hàn vượt số chi tiết có sẵn).
- Gia công ngoài xen giữa chuỗi (đi NCC rồi về tổ sơn) có sổ riêng
  (`production_outsource_entries` send/receive) — không nối với sổ bàn giao nội bộ.

## 3. Bộ câu hỏi PHẢI trả lời bằng quan sát thật (đi hỏi thống kê + 2-3 tổ trưởng)

1. **Ai xác nhận số bàn giao?** Tổ B có ĐẾM LẠI khi nhận không, hay nhận theo
   số tổ A/thống kê báo? Có chữ ký/xác nhận nào trên giấy hiện nay không?
2. **Đường đi vật lý:** chi tiết xong công đoạn X chuyển THẲNG sang tổ kế, hay
   qua bãi WIP/kho trung gian? Nếu có bãi — ai quản, có cần tồn bãi trên hệ?
3. **Lệch số giữa giao và nhận** có xảy ra không (rơi vãi, đếm nhầm, hao vận
   chuyển)? Khi lệch, hiện xử lý thế nào và AI CHỊU con số chênh?
4. **Trả lại (`return`) về đâu** — bãi phôi, tổ trước, hay kho? Ai nhận lại
   con số đó vào sổ của mình?
5. **Một công đoạn chia nhiều tổ** (2 tổ hàn cùng một chi tiết) có phổ biến
   không? Khi đó số "sẵn sàng cho công đoạn sau" gộp từ 2 nguồn — ai gộp?
6. **Nhịp ghi sổ:** thống kê ghi bàn giao NGAY lúc chuyển hay cuối ngày gộp
   một thể? (quyết định độ chi tiết timestamp và việc có cần mobile cho tổ
   trưởng xác nhận hay không)

## 4. Ba phương án thiết kế (để bàn SAU khi có câu trả lời §3)

| PA | Mô tả | Được | Mất | Hợp khi |
| -- | ----- | ---- | --- | ------- |
| **PA1 — Giữ nguyên** | Bàn giao tổ→tổ = thống kê ghi `issue` mới cho tổ B (như Excel cũ) | Không code thêm; đúng thói quen sổ hiện tại | Không đối chiếu được A-giao vs B-nhận; tồn "lơ lửng" giữa 2 tổ không ai giữ | §3.1 = "không ai đếm lại", §3.3 = "hầu như không lệch" |
| **PA2 — Bút toán chuyển 2 đầu** | Thêm loại bản ghi `handover`: `from_team/from_stage → to_team/to_stage`, một bút toán tự TRỪ WIP tổ A + CỘNG WIP tổ B | Một lần nhập, hai sổ khớp nhau theo định nghĩa; truy được "ai giao ai nhận bao nhiêu" | Migration + sửa công thức WIP + màn giao tổ; áp đặt quy trình chặt hơn thực tế nếu xưởng vốn lỏng | §3.3 = "có lệch và có tranh cãi", cần dấu vết 2 phía |
| **PA3 — Bàn giao ngầm theo sản lượng** | Không sổ bàn giao giữa tổ: số ĐẠT ở công đoạn X tự thành "sẵn sàng" cho X+1; chỉ `issue` MỘT lần ở đầu chuỗi | Ít nhập liệu nhất | Mất tồn WIP per tổ (panel nghẽn GĐ3 mù); không khớp sheet tổ Excel đang có cột giao | Xưởng nhỏ, chuyển thẳng tay-qua-tay, không bãi WIP |

**Điểm kỹ thuật chung nếu đi PA2** (ghi sẵn để khỏi quên): (a) điểm đổi đơn vị
phôi→cụm phải cho `qty_from ≠ qty_to` kèm hệ số (n chi tiết → m cụm);
(b) `handover` phải chặn vượt tồn khả dụng của tổ A (mềm, kiểu
`teamWipShortageWarning`); (c) gia công ngoài nên thành một "tổ ảo NCC" để
chuỗi bàn giao liền mạch thay vì hai sổ song song; (d) sổ giao tổ
(`TransferBoard`) và WIP overview (GĐ3) đổi công thức cùng một chỗ
(`summarizeTeamWip`) — có test.

## 5. Khuyến nghị trình tự

1. **Không code gì đợt này.** Go-live GĐ A chạy bằng mô hình hiện tại (PA1) —
   chính là sổ Excel cũ, xưởng không phải đổi thói quen.
2. Trong 2 tuần chạy song song, thống kê ghi chú lại MỌI lần số giao/nhận
   lệch nhau hoặc phải hỏi lại "phôi này đang ở tổ nào" — đó là dữ liệu trả
   lời §3.3/§3.2 thật, không phỏng đoán.
3. Hết 2 tuần: họp lại với bộ câu hỏi §3 đã điền → chọn PA → lúc đó mới lập
   plan code (nếu PA2 thì kèm migration + đổi `summarizeTeamWip`).
