# Rà các màn khu Sản xuất + Thống kê — 11/11/2026, 1280×800, vai admin
Quy ước: [UI] cắt/tràn/chồng · [CHỮ] thừa/khó hiểu/mã lọt · [LOGIC] số sai · [THAO TÁC] vòng vèo · [OK]

## Rà tĩnh trong mã (trước khi có phiên)
- [CHỮ] Thanh trạng thái bày tên bảng / đường dẫn mã cho người dùng: Giao nhận "· production_transfer_docs"; Lộ trình công đoạn "production_components.stages" (2 chỗ); Hồ sơ lệnh "· lib/wip-numbers". Báo cáo: dòng "Nguồn: … cùng hàm với Hồ sơ lệnh và Giao nhận" + dòng phải "Kỳ tự do, trần 92 ngày · Excel: …" dài.
- [CHỮ] Mã trạng thái tiếng Anh còn lọt ở nhánh fallback `?? x.status` (HoSoLenh pill, tab-ke-hoach, tab-phieu) — chỉ khi gặp mã lạ, chấp nhận.

## 1 · Vào việc (/production)
- [OK] Không tràn, không cắt chữ; đạt hôm nay theo đơn vị; hai bảng việc đọc được.
## 2 · Lệnh sản xuất (/thongke/lenh)
- [UI] Bảng 1.480px trong khung 1.228px (cuộn ngang có chủ ý) nhưng cột cuối "Mở ›" và một phần "Vướng gì → gỡ ở đâu" nằm ngoài màn ở 1280 — người dùng không biết có nút Mở. Đề xuất: ghim cột "Mở" bên phải (như cột Lệnh ghim trái) hoặc bỏ cột Mở (mã lệnh đã là link).
- [CHỮ] Caption dải chip: "chip đếm bằng đúng hàm lọc · cùng số với ô việc ở Tình hình xưởng" — Tình hình xưởng đã đổi tên thành Vào việc (10/11); câu này là lời giải thích kỹ thuật, bỏ được.
- [CHỮ] Chip "Nằm im ≥3 ngày 17/17" — mọi lệnh đều "nằm im" vì chưa có sổ; chip 17/17 không lọc được gì, chỉ gây lo. Cân nhắc ẩn khi = tổng.
- [CHỮ] Thanh trạng thái phải: "nguồn jobsService.overview — cùng hàm với Tình hình xưởng" — tên hàm + tên màn cũ. Trái: 3 dòng giải thích ô sọc/ô xám dài.
## 3 · Lộ trình công đoạn (/thongke/lo-trinh)
- [OK] Bảng gọn, chip đếm đúng (1 còn cụm chưa khai · 7 chờ KT · 1 chưa nạp · 8 xong). [CHỮ] góc phải "production_components.stages".
- [CHỮ] Breadcrumb "Sản xuất › 2 · Kế hoạch chuẩn bị ›" mang số thứ tự nhóm menu — nên bỏ "2 ·".
## 4 · Giao tổ & hạn — DANH SÁCH (/kehoach-sx)
- [UI] Vẫn là màn KIT cũ (tiêu đề "Kế hoạch sản xuất" lặp 2 lần, thẻ KPI bo góc, chip "Chưa lên lộ trình", cột Ưu tiên 0) trong khi menu gọi "Giao tổ & hạn" và màn [id] đã dựng lại không kit 10/11 — hai hệ cạnh nhau.
- [LOGIC] Cột "SL đạt / cần": 0/49.380, 0/46.788, 0/98.950 — cộng dọc MỌI chi tiết (ngũ kim lẫn khung) thành một số; lệnh MX 13 "98.950" trong khi đúng đơn vị là 2.000 cái. Cùng lỗi đã sửa ở jobs.service 09/11 nhưng màn danh sách còn dùng số cũ.
- [CHỮ] "Chưa lên lộ trình" — từ 04/11 kế hoạch không phải lộ trình; phải là "Chưa giao tổ & hạn". Mô tả đầu "Lệnh đã duyệt chờ lên lộ trình công đoạn + giao tổ + hạn. Số ưu tiên lớn = xưởng làm trước" — cũ.
- [THAO TÁC] Không có bước nào từ danh sách này dẫn thẳng vào ô cần sửa; chỉ bấm mã lệnh.
## 5 · Giao tổ & hạn — MỘT LỆNH (/kehoach-sx/[id], ROSCO 01: 37 dòng)
- [CHỮ] 36/37 dòng lặp nguyên câu "chưa định hình — không biết số chi tiết" dưới mã SP — 36 lần cùng một câu. Đề xuất: một dòng gộp "36 dòng chưa định hình (chờ Kỹ thuật)" đầu bảng, dưới mã SP chỉ ghi "chưa định hình".
- [UI] Chân bảng bị cắt chữ: "37 dòng · 1 có kế hoạch · 36 chưa định h…" (ô đầu quá hẹp).
- [UI] Cột "MÀI" xuất hiện với đơn vị trống (có 1 job cũ gắn Mài) — ô đơn vị rỗng, hàng Cả lệnh để trống ở cột này không nói lý do.
- [OK] Ô "?" + chân cột "+ ?" cho dòng chưa định hình đúng Q5; dòng TB0096 có số đầy đủ.
## 6 · Chỉ tiêu ngày (/kehoach-sx/chi-tieu)
- [UI] Màn KIT cũ; bảng 13 tổ × 12 công đoạn tràn 1.191/1.163 — cột cuối "HOÀN THIỆN" cắt còn "HOÀN TH". Breadcrumb "Kế hoạch sản xuất ›" là tên cũ. Ô ngày mm/dd/yyyy.
- [CHỮ] Bày cả tổ không làm công đoạn nào (Cắt Vải, Tổ Cơ Điện, Xưởng Sản Xuất) và 12 cột kể cả công đoạn không tổ nào gắn (Mài, Gỗ, Đan) — 156 ô, phần lớn vô nghĩa. Đề xuất: chỉ bày ô (tổ × công đoạn) có trong kế hoạch hoặc tổ gắn công đoạn đó.
- [CHỮ] Mô tả đầu dài 2 dòng ("Ô TRỐNG = không giao → Toàn cảnh dùng số suy từ lộ trình; ô 0 là chỉ tiêu thật") — "Toàn cảnh" là tên màn đã bỏ.
## 7 · Báo cáo (/thongke/bao-cao)
- [OK] Rỗng nói lý do + việc tiếp ("đổi kỳ hoặc bỏ lọc tổ"); tab đếm đúng.
- [CHỮ] Hai dòng thanh trạng thái dài ("Nguồn: sổ sản lượng (mọi phiếu trong kỳ) · tồn công đoạn chỉ đếm phiếu chính thức · cùng hàm với Hồ sơ lệnh và Giao nhận" + "Kỳ tự do, trần 92 ngày · Excel: sản lượng · phế · …"). Caption bảng "đạt (phế) · chỉ tiêu = Σ chỉ tiêu ngày đã khai · tô khi < 80%" chấp nhận được.
- [CHỮ] Ô Tổ liệt kê cả Cắt Vải, Cơ Điện, Xưởng Sản Xuất (không bao giờ có sổ).
## 8 · Cấu hình công đoạn (/production/cau-hinh/cong-doan)
- [UI] Bảng trái cắt chữ hàng loạt: tiêu đề "ĐẾM BẰNG / Ô RIÊNG / MÃ LỖI" cụt, cột # cắt "10 11 12" thành "1…", mã "hoan_thien" cụt, ghi chú "công đoạn ghép — đổi đơn vị: chi tiết → …" và "Tổ Sơn Nhôm · Tổ Sơn Sắt" cụt. Bảng chiếm ~55% bề rộng mà vẫn thiếu chỗ vì cột Ghi chú dài; nên cho ghi chú xuống dòng hoặc bỏ cột Ghi chú khỏi bảng (đã có ở khung phải).
- [CHỮ] Đầu trang có HAI nút khoá cùng câu "Chưa đổi gì" ("Huỷ · Chưa đổi gì", "Lưu Phôi · Chưa đổi gì") — một câu là đủ, hoặc ẩn Huỷ khi chưa đổi. Thanh trạng thái phải "catalog.production_stage.meta" là mã.
- [CHỮ] Khung phải dài (tổ phụ trách 13 ô tick, ô lõi, ô riêng, mã lỗi) — màn cấu hình, chấp nhận.
## 9 · Hồ sơ lệnh (/thongke/lsx/[id], MX 13: 8 dòng SP · 273 chi tiết)
- [UI] Bảng Đồng bộ ~300 hàng, trong đó ~190 hàng ngũ kim toàn "–" (đã ghi ở báo cáo E2E; MX 13 làm rõ: 23 vít × 8 SP). Gập nhóm mua ngoài là việc cần nhất ở màn này.
- [UI] Chữ phụ ô "Tồn tại công đoạn" bị cắt: "cụm / bộ chưa giao đi · 0 phiếu chờ nhận" (ô 5 cột ở 1280 không đủ chỗ) — rút còn "chưa giao đi · 0 chờ nhận". Tên chi tiết dài ("Liên kết nan cánh lớn. Thẩm thẳng bào vu…") cắt, có title.
- [CHỮ] Caption "Ô = đạt luỹ kế · (tồn chưa giao) · bấm ô để xem năm con số", "đơn vị đổi dọc lộ trình: chi tiết → cụm → bộ · không cộng ngang", "Công đoạn mang 2 đơn vị (…) bày hai dòng, không cộng" — ba câu giải thích cùng một ý trên một màn. Giữ một.
- [OK] Số đúng đơn vị (Phôi 48.200 ct · Hàn 2.000 cái · Sơn 2.000 + 36.750 ct); câu chặn Đóng lệnh "Chưa có công việc nào — định hình + lên kế hoạch trước" đúng.
## 10 · Bảng chi tiết (/thongke/lsx/[id]/dinh-hinh)
- [UI] Tiêu đề cột "CT/SP *" cắt; cột Lộ trình cắt "Phôi → Hàn → Nguội → Sơn" (cột hẹp 60px, chỉ đọc) — bỏ mũi tên, ghi "4 CĐ" hoặc nới cột. Chân bảng "Σ kg = ĐM kg × CT/SP, chỉ dòng có ĐM · c…" cắt.
- [CHỮ] Thanh trạng thái phải lộ "production_components · ghi đè trọn bộ…". Dòng gợi ý phím + câu "lộ trình công đoạn khai ở màn riêng" ở đầu bảng OK.
## 11 · Ghi sản lượng (/thongke/ghi, GIGA 01: 603 dòng Phôi)
- [UI] Lưới 1.248px trong khung 1.202px → cuộn ngang nhẹ, cột "Người làm" ra ngoài màn; tiêu đề "Đã phôi" cắt. Khi bật "Cột chi tiết" còn rộng hơn. Đề xuất: cột Lý do lỗi / Máy cắt / Quy cách co theo bề rộng, hoặc ẩn Máy cắt · Quy cách sau nút "Cột chi tiết".
- [OK] Banner "Chưa bày hết — còn 393 dòng… lưới bày tối đa 200 dòng" nói rõ giới hạn; sau khi cắt chữ 10/11 màn thoáng hơn.
## 12 · Giao nhận (/thongke/giao-nhan)
- [UI] Tiêu đề cột "Chênh" cắt. [CHỮ] "tổ của tôi: Tổ Bao Bì" cho admin không tổ (đã ghi E2E); thanh trạng thái phải "… · production_transfer_docs".
## 13 · Sổ ngày & chốt sổ (/thongke/ngay)
- [UI] Màn KIT cũ duy nhất còn lại trong khu Thống kê (bo góc, mô tả dài). Breadcrumb "Thống kê xưởng › Sổ ngày" — tên khu cũ.
- [CHỮ] Trạng thái rỗng: "Ghi sổ từ màn Tiến độ theo lệnh — phiếu sẽ tự gom về đây theo tổ" — "Tiến độ theo lệnh" là màn đã bỏ, phải là "Ghi sản lượng" và là LINK.
