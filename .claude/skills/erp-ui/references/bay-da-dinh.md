# Bẫy đã dính thật — đọc trước khi viết className / CSS

Mỗi bẫy dưới đây đã làm hỏng một màn thật trong dự án, và đi kèm dấu hiệu nhận ra cùng cách chữa. Thêm bẫy mới vào đây khi gặp, **kèm ngày và màn**.

## CSS / Tailwind

1. **Tailwind v4 quét MỌI file, kể cả chú thích và chuỗi.**
   - Viết trong chú thích một thứ trông giống lớp tuỳ ý, có `...` hay `*` trong ngoặc vuông, là Tailwind sinh ra CSS hỏng và **cả app mất CSS**.
   - Chữa: diễn đạt bằng chữ, đừng viết ví dụ lớp có ký tự đại diện. (Ghi chú BẪY trong `eslint-rules/hg-ui.mjs`, 24/09/2026.)
2. **Lớp `text-` bọc `var(...)` trong ngoặc vuông, Tailwind hiểu là MÀU chứ không phải cỡ chữ.**
   - Cỡ chữ đi qua `text-k-label/sm/body/lg/title/doc`.
   - Lint `hg/no-arbitrary-size` chặn ở mọi file.
3. **Token chỉ sống trong `.kit`.**
   - Portal (Radix render ra `<body>`) phải bọc nội dung trong một thẻ div mang lớp `kit contents`, không thì mất toàn bộ màu.
   - Lớp phủ của kit đã tự làm việc này. **Đừng tự dựng lớp phủ.**
4. **`.kit .num` nằm ngoài layer nên thắng lớp tiện ích** (ví dụ `text-left`). `NumInput align="left"` trong vùng `.kit` hiện không có tác dụng (ghi ở JSDoc của `NumInput`).

## Bố cục bảng

5. **Cha đặt `min-h-screen` thì bảng không bao giờ cuộn trong khung**, và tiêu đề cột dính lẫn chân tổng dính đều vô hiệu. Dùng `ScreenFrame` cho mọi màn có bảng dài.
6. **Bảng nhiều cột phải khai `ScreenFrame tableMin`.**
   - Không khai thì bảng rơi về 680px và bị BÓP (cắt chữ) thay vì cuộn ngang.
   - Nguồn: đợt soi khu Thống kê, 23/09/2026.
7. **Một dòng cá biệt định đoạt bề rộng cả bảng.**
   - Lệnh gộp 13 đơn, nối trong ô `nowrap` không có `max-width`, nở cột thành 1415px và bảng thành 2647px.
   - Luật: ô nào nhận DANH SÁCH có độ dài không chặn thì cắt (2 mục + "+N nữa") VÀ đặt bề rộng tối đa.
8. **Pseudo-element trên thẻ `tr` đẻ ra một ô vô hình**, đẩy cả bảng `table-fixed` lệch một cột (04/09/2026, bảng phiếu mua).
   - Chữa: đặt vạch trạng thái lên Ô ĐẦU, không đặt lên hàng.
   - Cách đo nhanh: so toạ độ x của các ô tiêu đề với các ô của dòng đầu.
9. **`table-fixed` không tự cắt nội dung quá khổ.** Nó vẽ tràn sang ô bên cạnh, nên ô có chữ dài cần `overflow-hidden` + cắt chữ.
10. **Thủ pháp `gap:1px` + nền container màu vạch chỉ đúng khi lưới ĐẦY.**
    - `auto-fit` gần như không bao giờ đầy, nên nền xám lộ ra thành khối giữa trang (`MetricStrip`, 23/09/2026).
    - Chữa: vẽ vạch bằng `box-shadow`.
11. **Dòng bảng không bấm được, và đường vào chi tiết nằm ở cột CUỐI**, tức cột rơi ra ngoài màn khi bảng tràn.
    - Chữa: đưa mã chứng từ vào cột ghim (`pin`), dạng `Code as="a"`.

## Số và dữ liệu

12. **Hai nguồn số cho cùng một khái niệm.**
    - Chip đếm từ `production_jobs` (4 dòng) trong khi trang đích đếm từ chi tiết, nên 13/14 dải rỗng dù lệnh có 8 công đoạn (23/09/2026).
    - Luật: con số trên chip/badge/ô việc gọi CHUNG hàm với trang đích.
13. **PostgREST trả tối đa 1000 dòng.**
    - Lọc SAU khi phân trang là giấu đúng những dòng cần thấy (Kho & tồn, 02/09/2026).
    - Lọc ở truy vấn, hoặc tải đủ trang.
14. **Tô màu theo điều kiện quá rộng.** `remaining > 0 ? warn : done` tô cam cả cột ở lệnh chưa ai bắt đầu. Số đầy đủ không phải tin xấu; trạng thái chưa bắt đầu thì không tô.
15. **Số kiểu Việt: "1.390" là 1390, không phải 1,39.**
    - `NumInput` trả CHUỖI THÔ khi rời ô; chỗ gọi tự hiểu và kiểm, ví dụ bằng `parseNum` ở `src/lib/cut-plan/paste.ts`.
    - Đừng dùng ô số của kit v3 cho dữ liệu dán từ Excel.
16. **Ô ngày: đừng dùng ô ngày gốc của trình duyệt.** Nó vẽ theo ngôn ngữ máy người dùng. Dùng `DateInput`: giá trị ISO, hiện `dd/mm/yyyy`, lịch tiếng Việt.

## React / Next 16

17. **React Compiler lint:** không đọc `ref` trong lúc render, không `setState` trong effect để đồng bộ. Dùng `useSyncExternalStore`, hoặc suy ra bằng `useMemo`.
18. `params`, `searchParams`, `cookies()` đều **async**, phải `await`.

## Kiểm trên trình duyệt (preview)

19. **Pane quá nhỏ (cao ~387px) thì vùng bảng cao 0px.** Đặt 1280×800 trước khi đo.
20. **Pane bị ẩn** (cửa sổ app không được focus) thì không có sự kiện cuộn, không có `requestAnimationFrame`. Chụp màn hình trước để đánh thức.
21. **Turbopack bỏ sót thay đổi ghi bằng `node -e` / `touch`**, nên CSS cũ vẫn được phục vụ. Sửa file bằng Edit/Write.
    - Gỡ một chuỗi bẫy Tailwind khỏi file `.md` thì CSS vẫn KHÔNG dựng lại, **kể cả khi khởi động lại dev server**: bộ đệm lâu dài giữ tập lớp cũ.
    - Phải sửa thật `src/app/globals.css` bằng Edit để Tailwind quét lại (24/09/2026).
22. **Đừng xoá `.next/dev` khi dev server đang chạy.**
23. **Route sâu dưới `[id]` trả 404 dạng HTML** nghĩa là Next không khớp route: khởi động lại dev server. 404 dạng JSON mới là `NotFound` của app.
24. **Bash tool nuốt backtick và gạch chéo ngược** trong heredoc / `node -e`. Nội dung có hai ký tự đó thì viết bằng Write/Edit.
