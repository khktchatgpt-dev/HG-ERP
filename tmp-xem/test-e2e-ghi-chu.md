# Test một lệnh TEST từ đầu đến giao hàng — ghi chú 10/11/2026

Quy ước: [THAO TÁC] = phải bấm quá nhiều / vòng vèo · [UI] = lỗi giao diện · [LOGIC] = lỗi nghiệp vụ / số · [THIẾU] = không có chỗ làm · [OK] = đi suôn.

## Bước 0 · Chuẩn bị
- Kịch bản: Bán hàng tạo khách TEST + đơn TEST (SP có định mức sẵn, SL nhỏ) → "Phát lệnh SX" (sales/lsx/[id]) → Gửi GĐ duyệt → /exec/approvals duyệt → bảng chi tiết tự nạp → /thongke/lo-trinh → /kehoach-sx/[id] Giao tổ & hạn → khu TK: /thongke/ghi từng công đoạn + /thongke/giao-nhan → Hồ sơ lệnh / Báo cáo → chặng thành phẩm → Bán hàng: kế hoạch xuất / ship-plan → xác nhận giao (completed → delivered) → đóng lệnh.
- Dev 3000 của sếp đã tắt lúc bắt đầu → khởi động lại bằng cấu hình `dev`; phiên đăng nhập trên pane mất, tạo tài khoản test bị chặn → cần sếp đăng nhập lại.

## Bước 1 · Bán hàng — khách TEST + đơn hàng
- Khách: "TEST E2E 10/11 — xoá sau", mã TEST, id a5815911-4d58-44ad-92c0-b6fc62b62af5. SP chọn: CH0119HG-AL (39 dòng định mức, bom_status done).
- [OK] Thêm khách: form gọn, lưu xong nhảy thẳng vào hồ sơ khách, hồ sơ có nút "Tạo đơn" → đi tiếp không phải quay lại danh sách.
- [THAO TÁC] Form tạo đơn KHÔNG tạo được khách tại chỗ: ô "Gõ tên khách…" chỉ chọn khách đã có → khách mới phải ra /sales/customers thêm trước rồi quay lại (2 màn cho 1 việc). Đề xuất: dòng "+ Thêm khách mới" trong ô chọn khách, mở hộp nhỏ 3 ô (tên · mã · quốc gia).
- Đơn: TEST-E2E-1011, PO-TEST-001, 20 cái CH0119HG-AL, hạn 15/12/2026, id a3c51cdd-4470-46c8-a714-55dbc2c0d006. Tạo xong nhảy vào hồ sơ đơn, trạng thái "Đã xác nhận", "VIỆC KẾ TIẾP: Phát lệnh sản xuất" — rõ bước tiếp.
- [OK] Chọn SP: gõ 6 ký tự ra đúng SP, tick → "Thêm 1 sản phẩm" tự đóng hộp; giá tự gợi ý 24,30 từ Giá bán KH; danh sách chặn "nhập số lượng > 0" bấm được, mất dần khi điền đủ → "Đủ điều kiện lưu".
- [THAO TÁC] Lưu đơn mất ~6 s (bấm lúc 0s, trang đích hiện sau 7s) — nút đổi "Đang lưu…" nhưng không có thanh tiến trình; người dùng dễ bấm lần hai.
- [UI] Hồ sơ đơn cảnh báo "Hợp đồng in sẽ thiếu: Incoterm · Thanh toán · Cảng xếp · Cảng dỡ" ngay khi tạo — với khách mới chưa khai điều khoản mặc định thì mọi đơn đều đỏ dòng này; đúng nhưng lặp. Chấp nhận được.

## Bước 2 · Phát lệnh → gửi duyệt
- Lệnh: "TEST-E2E 11/26", id b9f29a0d-0905-4a68-8f41-42f56c59602c. Hộp Phát lệnh chỉ hỏi Số lệnh · Hạn xuất (điền sẵn từ đơn) · Container → "Tạo lệnh nháp" → nhảy thẳng sang /sales/lsx/[id].
- [OK] Dòng lệnh tự chép từ đơn (1 dòng · 20 SP · đợt xuất 15/12 · quy cách lấy từ hồ sơ SP · CBM 0,082). Không phải "Soạn dòng lệnh" nếu đơn 1 dòng. "Việc kế tiếp: Gửi Giám đốc duyệt" đúng.
- [UI] Sau khi bấm "Tạo lệnh nháp" hộp thoại đứng yên ~3 s (nút không đổi chữ "Đang tạo…") rồi mới chuyển trang — khác nút Tạo đơn có "Đang lưu…". Thống nhất trạng thái chờ.
- [UI] Ô "Số lệnh" bắt gõ tay (vd 11/26-27 - MX) — không có gợi ý số kế tiếp theo tháng/khách; nhân viên phải mở sổ lệnh xem số cuối.
- [OK] Gửi duyệt: hộp xác nhận nói rõ hệ quả ("dòng lệnh khoá tới khi GĐ quyết; đơn chuyển sang Chờ duyệt lệnh"), nút "Đang ghi…".

## Bước 3 · GĐ duyệt lệnh
- [THAO TÁC] /exec/approvals mở mặc định tab "Cung ứng" (0 phiếu) dù chỉ "Sản xuất" có 1 phiếu — GĐ phải đọc dòng "Còn 1 phiếu ở phòng khác — bấm tab có số" rồi bấm thêm 1 lần. Đề xuất: mở sẵn tab đầu tiên có số > 0 (hoặc "Tất cả phòng" khi chỉ một phòng có phiếu).
- [OK] Dòng lệnh SX trong hộp ký bị "khoá" đúng luật (lệnh SX phải mở ra đọc, ký riêng) — tên lệnh là link sang trang ký.
- [OK] Trang ký lệnh bày đủ: đơn · SP · BOM xong · sơn/gỗ · luồng duyệt 4 mốc · "BOM đủ, sẵn sàng sản xuất". Hộp xác nhận nói hệ quả ("Duyệt xong Cung ứng mới đặt được vật tư").
- [THAO TÁC] Bấm "Duyệt" → ~10 s mới quay về hộp ký (POST approve 200). Trong 10 s đó trang đứng yên, hộp xác nhận đã đóng, nút Phê duyệt vẫn bấm được → dễ bấm lại. Cần khoá nút + "Đang duyệt…".
- [UI] Link "TEST-E2E 11/26" trong bảng hộp ký bấm KHÔNG chuyển trang (bấm 1 lần ở toạ độ link chỉ chọn dòng); phải gõ URL. Kiểm lại: click vào tên có bị hàng (row onClick) nuốt không.
- [OK] Duyệt xong bảng chi tiết TỰ NẠP: 39 dòng (14 khung AL · 2 gỗ · 23 ngũ kim), BOM phẳng → cụm mặc nhiên. Hồ sơ lệnh /thongke/lsx/[id] ra ngay: Đã định hình 1/1, Khối lượng 8 công đoạn: Phôi 600 ct · Hàn/Nguội 20 cái · Sơn 20 cái + 60 ct (gỗ) · Lắp ráp…Hoàn thiện 20 — số đúng (30 ct khung/SP × 20; 3 ct gỗ/SP × 20).
- [OK] Trang Vào việc đếm lệnh mới ngay: 18 đang chạy, Giao tổ & hạn 17 chưa giao (có TEST).
- [UI] Bảng Đồng bộ liệt kê cả 23 dòng NGŨ KIM (vít, bulon, LĐN…) không qua công đoạn nào — toàn ô "–", chiếm 2/3 bảng. Đề xuất: gập nhóm "ngũ kim / mua ngoài" mặc định (một dòng "23 chi tiết mua ngoài — không qua công đoạn").
- [UI] Thanh trạng thái Hồ sơ lệnh: "Đang chờ Cung ứng · 0 ngày — chờ vật tư về kho — xưởng chưa vào việc được" — lệnh vừa duyệt chưa có đơn mua nào; câu này đúng về bóng nhưng dễ hiểu nhầm là bị CHẶN ghi sổ. Kiểm bước 5 xem có chặn thật không.
- [LOGIC] Nhóm WOOD (Tay vịn, Tựa) chỉ đi qua Sơn; công đoạn "Gỗ" trong danh mục không nằm trong lộ trình → "Không đi qua: Gỗ". Xưởng thật gỗ phải qua tổ Gỗ (cắt/bào/khoan) trước sơn. Cấu hình nhóm vật tư → công đoạn cần rà lại với sếp.

## Bước 4 · Lộ trình công đoạn + Giao tổ & hạn
- [OK] /thongke/lo-trinh?lsx=TEST: dải thông tin SP đủ (20 cái · 0 cụm BOM phẳng · 39 ct = 16 rời + 23 ngũ kim · lộ trình hiệu lực Phôi → Hàn → Nguội → Sơn), bảng gập 2 dòng, câu đáy "BOM phẳng — không có cụm để khai, cụm mặc nhiên lo". Không phải làm gì — đúng.
- [THAO TÁC] Với lệnh BOM phẳng, bước "Lộ trình cụm" là bước RỖNG nhưng Hồ sơ lệnh / Vào việc vẫn bày nút "Lộ trình công đoạn" ngang hàng. Đề xuất: lệnh không có cụm thì nút đó ghi "(không cần)" hoặc ẩn, đưa thẳng tới Giao tổ & hạn.
- [UI] Hàng "16 chi tiết rời · theo nhóm vật tư" tick ✓ Phôi·Hàn·Nguội·Sơn gộp cả gỗ lẫn nhôm; 2 ct gỗ thật ra chỉ Sơn → phải bấm "mở từng dòng" mới thấy. Chấp nhận được.
- Giao tổ & hạn: 8 công đoạn × (tick + 2 ngày) = 24 thao tác + chọn tổ Sơn Nhôm. Tổ mặc định tự theo công đoạn [OK]; Sơn có 2 tổ → câu chặn đáy "Chưa lưu được — Cả lệnh · Sơn: 2 tổ cùng công đoạn — chọn một" hiện NGAY khi tick, mất khi chọn tổ [OK đúng Q4]; ô hiện "≥ 5 cái/ngày · 4 ngày làm" khi đủ 2 mốc [OK].
- [THAO TÁC] Không có cách rải hạn tự động: nhập 16 ngày tay cho 8 công đoạn. Đề xuất: nút "Rải lùi từ hạn xuất" (mỗi công đoạn n ngày mặc định theo cấu hình công đoạn, chồng lấn 1 ngày) rồi sửa tay chỗ cần — 1 thao tác thay 16.
- [THAO TÁC] Tick Cả lệnh phải bấm ĐÚP hoặc Space từng ô; không có "tick cả hàng Cả lệnh" (tick 8 công đoạn một nhịp). Đề xuất: nút "Tick hết công đoạn lệnh đi qua" ở ô đầu hàng Cả lệnh.
- [UI] Ô ngày là <input type=date> gốc trình duyệt (mm/dd/yyyy theo locale máy) — khác ô ngày VN của phần còn lại (ghi nhớ date-field-vn). Thống nhất về ô ngày VN dd/mm.
- Lưu kế hoạch: PUT …/plan 200, toast "Đã lưu kế hoạch: 1 dòng nhận từ Cả lệnh · 0 dòng tinh chỉnh" [OK], Nhật ký điều chỉnh = 1 [OK].
- [UI] **Ngay sau Lưu, lưới về TRẮNG** (mọi ô mất tổ/hạn, chân "0 có kế hoạch") dù lưu thành công; F5 mới thấy lại. Người dùng sẽ tưởng mất dữ liệu và nhập lại → ghi đè. Nguyên nhân khả dĩ: `router.refresh()` + state nháp reset trước khi prop mới về (mẫu "điều chỉnh state theo prop" của FeedbackScreen).
- [LOGIC] **Chỉ 4/8 công đoạn được ghi**: production_jobs có phoi·han·nguoi·son; Lắp ráp · Bao bì · Đóng gói · Hoàn thiện (chặng thành phẩm) BỊ RỚT không báo. Nguyên nhân: `plan.service.saveLsxPlan` lọc công đoạn theo `routesByLineFromShaping` = hợp lộ trình CHI TIẾT (BOM phẳng → phôi→hàn→nguội→sơn), không cộng `counting.finish` dù tally/Khối lượng vẫn bày 8 cột. Màn cho tick 8, server ghi 4, toast báo thành công — sai luật "con số là lời hứa".
- [LOGIC] **Sau khi có kế hoạch, số CẦN đổi**: Phôi 600 → 1.840 chi tiết; Sơn mất dòng "60 chi tiết" (gỗ). Vì `resolveComponentRoute` ưu tiên kế hoạch dòng SP trên nhóm vật tư khi chi tiết không có `stages` khai — 23 dòng NGŨ KIM (hàng mua, lộ trình rỗng) và 2 dòng GỖ (chỉ Sơn) bị gán lộ trình phôi→hàn→nguội→sơn của kế hoạch. 92 ct/SP × 20 = 1.840. Mọi màn cùng hàm nên cùng SAI: Ghi sản lượng tổ Phôi sẽ thấy cả vít, bulon. Đề xuất: kế hoạch chỉ là ĐƯỜNG LÙI khi nhóm KHÔNG suy được (nhóm lạ/trống), không đè lên nhóm đã biết (NGU_KIM rỗng cố ý, WOOD = Sơn).

## Bước 5 · Ghi sản lượng (mới mở, CHƯA ghi)
- [OK] /thongke/ghi?lsx=TEST mở đúng lệnh, tổ tự chọn "Tổ Phôi ★" theo kế hoạch, 8 tab công đoạn có số dòng, mỗi dòng có nút "Điền n còn lại", câu chặn đáy "chưa gõ số nào…" kèm "Tới ô đầu" bấm được.
- [LOGIC] **XÁC NHẬN bug kế hoạch đè nhóm**: tab Phôi bày 39 dòng gồm Tay vịn/Tựa (gỗ), 23 dòng vít · bulon · tán · LĐN · mạc đồng — thống kê tổ Phôi phải "cắt" cả con vít. Trước khi Lưu kế hoạch, Hồ sơ lệnh đếm Phôi = 600 (chỉ 14 ct khung) là đúng. Hệ quả dây chuyền: cụm mặc nhiên ở Hàn "đạt" suy từ chi tiết CHẬM NHẤT → vít không bao giờ được ghi → Hàn/Nguội/Sơn luôn 0 dù xưởng làm xong.
- DỪNG test ở đây để báo: 2 lỗi logic (rớt 4 công đoạn thành phẩm khi lưu; kế hoạch đè lộ trình nhóm) làm mọi số từ bước 5 trở đi sai — chạy tiếp chỉ ra số rác. Sửa xong chạy tiếp từ Ghi sản lượng (dữ liệu TEST còn nguyên: khách a5815911 · đơn a3c51cdd · lệnh b9f29a0d · 4 jobs).

## Sửa giữa chừng (10/11, sau bước 4)
- `stage-route.ts`: nhóm vật tư đã biết thắng kế hoạch; kế hoạch chỉ là đường lùi cho chi tiết chưa phân nhóm (+ `isKnownGroup`). `plan.service.routesByLineFromShaping`: cộng `counting.finish`. `useGiaoTo.luu`: bỏ reset nháp bằng dữ liệu cũ. Test: stage-route · default-assembly · line-stage-tally cập nhật theo luật mới; 418 file test xanh, typecheck sạch.
- Kiểm lại trên màn: Phôi về 600, Sơn 20·60 ngay khi tải lại (không cần lưu lại). Tick thêm 4 công đoạn thành phẩm theo ô dòng SP → Lưu → toast "0 dòng nhận từ Cả lệnh · 1 dòng tinh chỉnh", lưới GIỮ nguyên dữ liệu, Nhật ký 2 — cả hai lỗi đã hết.
- [UI] Hàng "Cả lệnh" sau khi dòng đã có KH thì trống trơn và ghi "áp xuống 0 dòng chưa có KH" — muốn sửa cả lệnh phải tick lại từ đầu 8 ô + bật Ghi đè. Đề xuất: khi mọi dòng có KH giống nhau, hàng Cả lệnh bày lại kế hoạch chung (mờ) để sửa một chỗ.

## Bước 5 · Ghi sản lượng (tiếp, sau sửa)
- Phôi: 14 dòng khung (đúng), tổ tự chọn Tổ Phôi ★, "Điền n còn lại" 14 lần → "Sắp ghi 14 dòng · 600 đạt" → Ghi sổ chính thức → PBS-2026-0025 lúc 14:04, dòng hiện "●+40 hôm nay · đủ", lệnh trong ô chọn đổi "còn 7 việc" [OK]. DB: 1 production_entry_docs da_xac_nhan + 14 production_entries.
- [THAO TÁC] Không có "Điền đủ tất cả dòng còn lại" — xưởng làm trọn lô thì phải bấm 14 lần (lệnh thật 60–300 dòng). Đề xuất nút ở chân cột Còn: "Điền đủ n dòng".
- [UI] Sau khi ghi, toast "Phiếu PBS-2026-0025 đã ghi chính thức" nằm GIỮA dải tab và bảng (đẩy bảng xuống) thay vì góc; chấp nhận được nhưng khác chuẩn toast các màn khác.
- [UI] Ô "Ngày ghi sổ" lại là <input type=date> gốc (mm/dd/yyyy) — cùng nhận xét với Giao tổ & hạn.

## Bước 5b · Giao nhận Phôi → Hàn
- Lập phiếu: chọn tổ (đầu trang) → Lập phiếu giao → công đoạn · tổ nhận · lệnh · ngày → gõ 14 ô Giao → Gửi → "Đã gửi phiếu PGT-2026-0001 cho Tổ Hàn" [OK], POST 200.
- [LOGIC] Admin không thuộc tổ nào nhưng màn tự nhận "tổ của tôi: Tổ Bao Bì" (tổ đầu bảng chữ cái?) — người không có tổ nên thấy "— chọn tổ —" và bị bắt chọn, không gán bừa.
- [UI] `?lsx=` trên URL không chọn sẵn lệnh ở bộ lọc ("tất cả") lẫn trong bảng lập phiếu (mặc định lệnh YOTRIO đầu danh sách → tải nhầm nguồn YOTRIO 1 lần rồi mới tới TEST). Nút "Lập phiếu giao" từ Hồ sơ lệnh mang lsx thì phải chọn sẵn.
- [THAO TÁC] 14 ô Giao gõ tay, không có "Giao hết phần xong − đã giao". Cùng đề xuất với Ghi sản lượng.
- [UI] Sau khi gửi, bảng phía dưới KHÔNG hiện phiếu vừa lập: 5 tab đều 0, dòng rỗng "Tổ Phôi chưa có phiếu nào đang chờ tổ khác nhận" trong khi phiếu vừa gửi thành công. Kiểm lại sau khi tải lại trang.
- Tải lại: "Tất cả phiếu 1" → xác nhận là lỗi làm tươi sau khi gửi (router.refresh không đổi số), không phải mất phiếu. Đổi tổ sang Tổ Hàn: "Chờ tôi nhận 1", phiếu bày 14 dòng, GIAO 600, nút "Nhận đủ" một phát cho cả phiếu [OK].
- [UI] Ô chọn "Tổ" ở đầu trang không nhớ (tải lại về Tổ Bao Bì) — thống kê tổ phải chọn lại mỗi lần vào. Nên nhớ theo localStorage hoặc theo tổ của tài khoản.
- "Nhận đủ" → ~8 s sau mới "Đã nhận đủ PGT-2026-0001 lúc 14:06", tab Đã nhận 1 [OK về số]. [THAO TÁC] 8 s chờ không có trạng thái "Đang nhận…" trên nút — cùng lỗi với Duyệt lệnh. Các mutation trong khu SX đều ~5–10 s trên dev; cần đo lại trên Vercel, nếu vẫn chậm thì xem lại số truy vấn tuần tự trong service.
- Tab Hàn: 1 dòng "Cụm khung (mặc nhiên)" cần 20, tổ tự chọn Tổ Hàn ★, cột theo cấu hình Hàn có "Loại máy hàn" [OK].
- [THAO TÁC] Đổi tab công đoạn là điều hướng server (~4–5 s mới đổi), bấm xong tưởng không ăn → bấm lần hai. Cần trạng thái đang tải trên tab (hoặc giữ sheet 8 công đoạn ở client).
- [LOGIC] KHẢ DỤNG ở Hàn = "—" dù Tổ Hàn vừa NHẬN đủ 600 chi tiết (PGT-2026-0001). Phiếu giao theo CHI TIẾT không quy ra khả dụng CỤM (= min(nhận ÷ ct/SP) = 20). Số năm con số ở cụm mặc nhiên thiếu mảnh "đã nhận"; hoặc ít nhất ghi "nhận 600 ct (đủ 20 cụm)".
- Nguội: PBS-2026-0027 [OK]. Sơn: 3 dòng (Tay vịn 40 · Tựa 20 · Cụm khung 20), tổ tự chọn Tổ Sơn Nhôm ★ theo kế hoạch, khả dụng cụm = 20 (suy từ Nguội xong vì không có phiếu giao) [OK]. Lệnh trong ô chọn đếm lùi "còn 7 → 6 → 5 việc" đúng từng phiếu [OK].
- [UI] Ô chọn tổ ở Sơn đánh ★ CẢ HAI "Tổ Sơn Nhôm ★" và "Tổ Sơn Sắt ★" (★ = tổ gắn công đoạn) trong khi kế hoạch đã giao Sơn Nhôm — nên chỉ ★ tổ trong kế hoạch, tổ kia để trơn.
- Lắp ráp: PBS-2026-0029, dòng "Thành phẩm (bộ)" đếm bộ [OK]. [LOGIC] Khả dụng ở Lắp ráp = "—" (chặng trước là Sơn đếm CỤM 20 + gỗ) trong khi Bao bì = 20 (chặng trước Lắp ráp cùng đếm bộ): suy "đã nhận = xong công đoạn trước" chỉ chạy khi cùng đơn vị. Cụm → bộ nên quy 1:1 theo SL cụm/SP (ở đây 1).
- Bao bì PBS-2026-0030 · Đóng gói PBS-2026-0031 (khả dụng 20 suy từ chặng trước cùng đơn vị bộ) [OK]. Mỗi lượt ghi ~6–8 s. Ô chọn lệnh đếm "còn 1 việc" trước khi ghi Hoàn thiện [OK].
- [THAO TÁC] Ghi 8 công đoạn cho một lệnh = 8 lần đổi tab (mỗi lần tải lại ~5 s) + 8 lần Ghi (mỗi lần ~7 s) ≈ 2 phút chờ thuần. Trên lệnh thật thống kê ghi mỗi ngày một công đoạn nên chấp nhận được, nhưng đổi tab nên là client-side.
- Hoàn thiện PBS-2026-0032 → "còn 0 việc"? (ô chọn lệnh vẫn ghi "còn 1 việc" lúc vừa ghi — đếm trước khi ghi).

## Bước 6 · Hồ sơ lệnh sau khi ghi đủ 8 công đoạn
- [OK] HOÀN THIỆN 20/20 bộ; khối Khối lượng: 8 công đoạn đạt 100% đúng đơn vị (Phôi 600 ct · Hàn/Nguội 20 cụm · Sơn 20 cụm + 60 ct · 4 chặng 20 cái), tổ & hạn hiện đủ; tab Kế hoạch 8 · Phiếu 9 (8 PBS + 1 PGT); thanh trạng thái "đang chạy — ghi sổ hằng ngày, xong thì đóng lệnh" chỉ đúng việc tiếp.
- [LOGIC] **ĐỒNG BỘ = 0 / 20** (cột cuối, dòng SP và chân bảng) trong khi mọi công đoạn 100% và Thành phẩm 20 — vì MIN lấy cả 23 dòng NGŨ KIM (đồng bộ 0, không qua công đoạn nào). Hàng mua phải loại khỏi MIN (hoặc coi là đủ khi kho đã cấp). Lệnh làm xong 100% mà "Đồng bộ 0" là số người dùng không tin được.
- [LOGIC] **TỒN TẠI CÔNG ĐOẠN = 140** "cụm / bộ chưa giao đi" = 7 công đoạn × 20 vì không lập PGT (hệ không bắt lập phiếu). Nhưng công đoạn sau đã GHI SỔ 20 thì hàng rõ ràng đã đi — "nhận" đã suy từ công đoạn trước (receivedOrFallback) mà "tồn" không suy ngược. Đề xuất: tồn = xong − max(đã giao, đã ghi ở công đoạn kế tiếp). Phôi có PGT nên tồn 0 — đúng.
- [UI] Ô ma trận "20tồn 20" dính chữ (thiếu khoảng/ngắt giữa số và "tồn").

## Bước 7 · Đóng lệnh
- [LOGIC] Bấm "Đóng lệnh" là ĐÓNG NGAY (POST /complete), KHÔNG có hộp xác nhận, không hỏi lý do, không kiểm "đã hoàn thiện đủ chưa". Hành động khép vòng đời lệnh + đổi trạng thái đơn hàng mà một cú bấm nhầm là xong. Cần hộp xác nhận nói hệ quả (đơn → hoàn thành, sổ khoá) + chặn/cảnh báo khi Hoàn thiện < SL đặt.
- [UI] Sau khi đóng: chip trạng thái "Lệnh đang completed" (mã trạng thái tiếng Anh lọt ra màn), nút "Đóng lệnh" vẫn hiện; tab Phiếu từ 9 còn 8 (PGT biến mất khỏi đếm?). Toast "Đã đóng lệnh … — đơn hàng chuyển sang hoàn thành" [OK].
- ~7 s cho POST complete — cùng nhận xét tốc độ.

## Bước 8 · Bán hàng xuất hàng
- [OK] Hồ sơ đơn sau khi đóng lệnh: trạng thái "Sẵn sàng xuất", việc kế tiếp "Ghi xuất hàng", ô Lệnh SX "8/8 công đoạn · Hoàn thành", Lịch sử 3 mốc (trình · duyệt · xưởng hoàn thành) — đơn tự kể đời nó.
- [OK] Ghi xuất hàng: hộp "một đợt, nhiều dòng", SL mặc định = phần còn lại, ngày + số cont chung cả đợt; tick dòng, Ghi xuất → "Đã xuất đủ", Đợt xuất 1 (10/11 · 20 · TEST-CONT-001 · nút Gỡ), lịch sử ghi "completed → shipped", việc kế tiếp "Xác nhận đã giao". Đi suôn, 4 thao tác.
- [UI] Hộp Ghi xuất mở INLINE dưới dải chỉ số (đẩy bảng dòng xuống) chứ không phải dialog — cùng kiểu với Phát lệnh; chấp nhận được, nhưng ô "Xuất đợt này" để trống dù mô tả nói "mặc định là phần còn lại" (phải gõ 20 hoặc tick dòng mới điền?). Kiểm lại: tick dòng có tự điền không.
- [UI] Lịch sử ghi "Trạng thái: completed → shipped" — mã trạng thái tiếng Anh lọt ra dòng nhật ký (cũng như "Lệnh đang completed" ở Hồ sơ lệnh). Dịch qua từ vựng chung.
- [OK] Xác nhận đã giao: hộp nhỏ 1 ô ghi chú + "Đã giao hàng" → trạng thái "Đã giao", việc kế tiếp "Đã khép", chỉ còn "In hợp đồng". DB: sales_orders delivered · production_orders completed. KHÉP CHUỖI xong 14:15 (bắt đầu 13:29, gồm ~25 phút sửa lỗi).

## Bước 9 · Sau khi khép — Vào việc
- [LOGIC] Đầu trang Vào việc: "800 đạt hôm nay" = 600 ct + 20 cụm + 20 cụm + 80 (20 cụm + 60 ct) + 20 + 20 + 20 + 20 bộ — CỘNG DỌC ba đơn vị thành một số, đúng thứ CLAUDE.md cấm ("chi tiết / cụm / bộ là ba đơn vị, cộng dọc là số vô nghĩa"). `pulse.qty` cần tách theo bậc đếm hoặc chỉ đếm bộ ở công đoạn cuối.
- [OK] 17 lệnh đang chạy (TEST đã rời), Giao tổ & hạn 16 chưa giao, "xưởng đang ghi sổ" bật khối Khi xưởng chạy.
