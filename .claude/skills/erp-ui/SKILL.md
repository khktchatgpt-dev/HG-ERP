---
name: erp-ui
description: Quy trình thiết kế + dựng màn giao diện cho HG-ERP — từ nhiệm vụ nghiệp vụ, qua bản thiết kế được duyệt, tới màn dựng bằng kit và kiểm bằng số. Dùng khi user nói "làm màn", "thêm trang", "thiết kế giao diện", "sửa UI/UX", "màn này khó dùng", "dựng lại màn …", hoặc khi sắp tạo/sửa một file .tsx hiển thị cho người dùng.
---

# erp-ui

Skill này là **QUY TRÌNH**, không phải máy sinh trang.

Hai skill UI cũ (`add-erp-page`, `frontend-design`) bị gỡ 13/09/2026 vì chúng dựng sẵn "một trang danh sách + CRUD" bằng bộ kit cũ. Cách đó dẫn tới lối mòn "mỗi màn một bảng". Skill này không có khuôn code để chép. Nó bắt đi đúng thứ tự: **nhiệm vụ → luồng → bản thiết kế được duyệt → dựng bằng kit → kiểm bằng số**.

> **Sổ `/design-lab` ĐÃ XOÁ 07/10/2026** (chủ dự án: "không dùng nữa", trước đó 06/10: "UI/UX quá kém"). Không còn màn mẫu `/design-lab/mau-*`, sách tra `/design-lab/thanh-phan`, trang chụp `/design-lab/chup`. **Đừng dựng lại trang nào dưới `src/app/design-lab`**, kể cả trang tạm để duyệt. Mẫu tham chiếu nay là MÀN THẬT đang chạy (bảng ở bước 3).

Hai luật của chủ dự án đứng trên mọi thứ dưới đây:

- **Làm từng bước một.** Mỗi lượt làm một bước nghiệm thu được, rồi DỪNG và báo cáo.
- **Khuôn là tham chiếu, không ép 100%** (chốt 16/09/2026). Thiết kế theo nhiệm vụ của từng chức năng. Khuôn và kit là đồ nghề, không phải đích.

---

## Bước 0 — Màn cũ hay màn mới?

| File đang import                              | Hệ                        | Làm gì                                                     |
| --------------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| `@/components/kit`                            | Kit ERP mới (`.kit`)      | Theo skill này                                             |
| `@/components/erp/*`, `@/components/shadcn/*` | Theme v3 cũ (`.theme-v3`) | Sửa TẠI CHỖ bằng hệ cũ; mẫu ở mục "Theme v3" của CLAUDE.md |
| Chưa có file (màn mới)                        | —                         | **Luôn** là kit mới                                        |

- **Một file chỉ dùng một hệ.** Trộn hai hệ là hai bộ token đánh nhau.
- **Đừng chuyển màn cũ sang kit vì thẩm mỹ.** Chỉ chuyển khi có việc nghiệp vụ chạm vào nó; khi đó cả màn đi qua đủ quy trình dưới đây.

---

## Quy trình — 7 bước, có MỘT cổng duyệt

### 1. Nhiệm vụ — ai, làm gì, bao nhiêu lần

Viết ra, trước khi mở bất kỳ file nào:

- **Vai**: thủ kho, NV cung ứng, thống kê tổ, kế toán, giám đốc…
- **Câu hỏi nghiệp vụ, một câu.** Ví dụ "đơn nào chưa gửi NCC?", không phải "cần màn danh sách đơn".
- **Tần suất và bối cảnh**: 40 lần/ngày tại bàn, hay 2 lần/tuần trong buổi họp?
- **Đo dữ liệu thật trước khi xây.** Đếm trên DB số dòng mà tính năng sẽ bày. Nếu độ phủ là 0/30 thì tính năng chưa có lý do tồn tại. Phải đo bằng đúng bảng thật, không đo bằng một bảng thay thế.

### 2. Luồng — chỉ khi màn thuộc vòng đời một chứng từ

Đọc `docs/tieu-chi-workflow-erp.md` §5 và làm đủ sáu bước. Máy trạng thái đi TRƯỚC, chọn màn đi SAU:

1. Câu hỏi của từng vai.
2. Máy trạng thái: tập trạng thái đóng. Mỗi chuyển tiếp ghi đủ: ai làm được / điều kiện / hệ quả / đường lùi.
3. Ngoại lệ trước đường thuận.
4. Ai giữ bóng ở từng trạng thái.
5. Vết (và có bắt lý do không).
6. Bây giờ mới chọn khuôn.

Phân biệt ngay: **danh mục ≠ chứng từ.** Danh mục (NCC, vật tư, SP) không có vòng đời duyệt. Đừng bịa một vòng đời cho nó.

### 3. Điểm xuất phát bố cục — khuôn + màn tương đương của ERP lớn

Chọn khuôn gần nhất làm **điểm xuất phát**, rồi mở MÀN THẬT cùng khuôn để xem cách dự án đã giải (đọc mã + mở trong trình duyệt).

| Câu người dùng đang hỏi                         | Khuôn              | Màn thật tham chiếu                                                       |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Hôm nay tôi phải làm gì?                        | A · Vào việc       | `/mua-hang` (Bàn làm việc), `exec/ExecHomeScreen.tsx`                     |
| Việc nào chờ tôi, ở MỌI loại chứng từ?          | B · Hộp thư        | `/mua-hang/hop-thu`, `/exec/approvals` (`ApprovalCenterScreen.tsx`)       |
| Trong tập này, cái nào cần tôi động vào?        | C · Danh sách      | `/mua-hang/don` (`DonScreen.tsx`), `/mua-hang/vat-tu`, `/thongke/lenh`    |
| Tờ này ở đâu, ai giữ, vướng gì?                 | D · Chứng từ       | `/mua-hang/don/[id]` (`DonChungTuScreen.tsx`), `/thongke/lsx/[id]`        |
| Đối tượng này là ai, làm ăn ra sao, dùng ở đâu? | E · Hồ sơ danh mục | `/mua-hang/ncc/[id]` (`HoSoNccScreen.tsx`), `/khuon/[id]`                 |
| Khai 40 dòng nhanh như Excel mà không sai?      | F · Bảng nhập liệu | `/mua-hang/don/moi` (soạn đơn mua), `/thongke/ghi` (`EntrySheetForm.tsx`) |

Màn tham chiếu là bản ĐÃ CHẠY, không phải chuẩn mực: chép cách giải việc, không chép lỗi. Ghi chú đầu file của từng màn nói nó theo khuôn nào và vì sao.

- Không khớp khuôn nào nghĩa là câu hỏi ở bước 1 chưa rõ. Quay lại bước 1, đừng chế khuôn thứ bảy.
- Khớp khuôn nhưng nghiệp vụ cần khác thì **đi theo nghiệp vụ**. Ví dụ màn nhận hàng cần ba cột số + tình trạng lô ngay trên dòng: đừng cắt nghiệp vụ cho vừa khuôn.
- Tham khảo màn **tương đương đúng chức năng đó** ở SAP / Odoo / Dynamics / NetSuite. Chép cái giải quyết việc thật, và ghi rõ chép của ai.
- **Đừng chép** thứ `docs/tieu-chi-workflow-erp.md` §6 đã loại: cây tổ chức 4 tầng, khoá kỳ sớm, tách 3 trục trạng thái khi chưa cần, ma trận uỷ quyền nhiều tầng.

### 4. Bản thiết kế — CỔNG DUYỆT, không có ngoại lệ

**Mọi màn mới, và mọi lần dựng lại một màn, đều phải có artboard được user duyệt TRƯỚC khi viết code.** Không có ngoại lệ cho "màn nhỏ".

Tiền lệ 16/09/2026: code thẳng form Phiếu xuất, bỏ qua khâu này. User nhận xét: _"giao diện lại gớm rồi, bỏ qua khâu thiết kế hả"_.

- Artboard là một **Artifact HTML riêng cho màn đó**, thiết kế kỹ (token màu của kit, chữ 13px, lưới có cột + chân tổng, bố cục kiểu Dynamics/SAP: thanh công cụ góc phải, không thẻ bo tròn/bóng đổ). Tiền lệ được duyệt: bản vẽ Hồ sơ lệnh (05/10), màn ký đơn mua bày đủ dòng + đợt giao (07/10).
  - Sửa vòng sau thì publish lại **cùng file** → cùng URL, để user so được hai bản.
  - Canvas chung cũ (`G9Zso…`) không đọc được nữa; **không** dựng trang tạm trong `src/app` (`/design-lab/tam-*` bị chê "UI/UX quá kém" 06/10 và cả sổ đã xoá 07/10).
- Mở đầu artboard bằng **số đo** của bước 1 (màn cũ thiếu gì, bao nhiêu dòng/đơn bị ảnh hưởng) và kết bằng **các câu cần chốt**, mỗi câu có một đề xuất.
- Artboard phải bày **hình dạng dữ liệu thật** (mã, số, tên đúng kiểu dữ liệu đã đo ở bước 1), không dùng lorem. Phải bày đủ các trạng thái mà màn sẽ gặp:
  - rỗng (kèm lý do + việc tiếp);
  - bị chặn (kèm lý do + cách gỡ);
  - dòng lỗi;
  - dài (có đầu/chân dính không?).
- **DỪNG ở đây.** Báo link, nêu các quyết định cần user chốt, rồi chờ. Chỉ sang bước 5 khi user đã duyệt.

### 5. Dựng bằng kit

- Import **chỉ từ `@/components/kit`**, không import thẳng file con.
- Tra thành phần ở bảng "cần gì → dùng gì" [references/tra-thanh-phan.md](references/tra-thanh-phan.md), rồi đọc **JSDoc trên khai báo kiểu props** trong `src/components/kit/*.tsx` (nguồn sự thật duy nhất từ khi sách tra `/design-lab/thanh-phan` bị xoá 07/10/2026). Danh sách xuất khẩu: `src/components/kit/index.ts`.
- Server component tải dữ liệu **song song** (`Promise.all`), rồi truyền xuống một Screen `'use client'` — chỉ thứ client cần.
- Chia file theo khuôn ở mục "Cấu trúc code React" của CLAUDE.md (`page` → `XxxScreen` → `useXxx` → khối). File `.tsx` quá 800 dòng là lint đỏ.
- File `'use client'` chỉ `import type` từ `@/modules` / `@/server` (`hg/client-server-boundary`).
- Gọi API từ client qua `api()`/`ApiError` (`@/lib/api`), không `fetch` tay. Mutation đi theo chuỗi try/catch → `router.refresh()` → toast (`useToast` của kit).
- Shell nằm ở layout `(<ws>)/layout.tsx`, không bọc trong page.
- **Kit là đồ nghề cho khung, không phải hàng rào** (chủ dự án 06/10/2026: "đừng phụ thuộc quá vào kit"). Kit hụt thì viết Tailwind + token ngay trong màn. Chỉ đưa vào kit khi thứ đó lặp lại ở màn thứ hai — theo mục "Khi kit thiếu" dưới đây.
- **BẪY `.kit .num` / `.kit th`**: CSS của kit KHÔNG nằm trong `@layer`, nên thắng mọi class Tailwind (`text-left`, `whitespace-normal`…). Cần đè thì dùng `style={{ … }}` inline (dính 07/10/2026 ở lưới màn ký).

### 6. Kiểm — bằng số, trên trình duyệt thật

1. Chạy qua **luật kiểm** ở [references/luat-kiem.md](references/luat-kiem.md). Mọi dòng phải đạt; dòng nào không áp dụng thì nói vì sao.
2. Kiểm trên preview (dev server) ở **1280×800**. Pane nhỏ thì vùng bảng cao 0px và không đo được gì.
   - Bấm thử từng ô có số và đếm tay số dòng nhận được.
   - Tab hết màn: vòng focus phải luôn nhìn thấy, không bị đầu/chân dính che.
   - Thử trạng thái rỗng và bị chặn bằng dữ liệu thật, hoặc bằng một bộ lọc.
3. Chạy `npm run check` (typecheck + lint + test) và phải sạch. Đỏ thì chưa xong.
4. Rà mã bằng skill ngoài: `vercel-react-best-practices` (waterfall, re-render, gửi thừa dữ
   liệu xuống client) và `web-design-guidelines` (a11y/UX). Chỗ vênh với luật dự án thì luật
   dự án thắng — bảng vênh ở mục Skills của CLAUDE.md.
5. Mở MÀN THẬT trong trình duyệt ở 1280×800 và NHÌN ở 1:1 — soi bằng số (độ rộng cột, số dòng,
   `scrollWidth` của lưới) không thay được việc nhìn. Đo thêm bề rộng tối thiểu của lưới: laptop
   phóng 125% trừ sidebar chỉ còn ~1.000px.
   - Màn cần đăng nhập mà Claude không có phiên: KHÔNG tự nhập mật khẩu thật. Nhờ user mở và
     chụp, hoặc user đăng nhập sẵn trong pane trình duyệt.
   - Trang chụp `/design-lab/chup` đã xoá cùng sổ (07/10/2026). Dữ liệu đóng băng cho test màn
     nằm ở `src/test/fixtures/*.json`.
   - (Playwright + ảnh chuẩn đã gỡ 30/09/2026.)

### 7. Báo cáo và dừng

Báo số đo trước/sau, ảnh chụp, và các điểm còn treo, rồi dừng. Không tự sang màn tiếp theo.

---

## Luật cứng — tiêu chí đo được, không phải khẩu vị

1. **Một màn trả lời một câu hỏi nghiệp vụ.**
2. **Chứng từ tự kể chuyện đời nó**: đang ở bước nào (`StatusTrack`), ai giữ (`HolderBar`), đã có chuyện gì (`Timeline`, `NoteStream`).
3. **Con số là một lời hứa.**
   - Badge, chip, ô việc phải đếm bằng ĐÚNG hàm mà trang đích dùng. Hai nguồn số là lỗi, dù hôm nay chúng tình cờ bằng nhau.
   - Số 0 không phải lúc nào cũng xấu: đừng tô đỏ.
4. **Dày, có kỷ luật.**
   - Chữ nền 13px, thang `text-k-label/sm/body/lg/title/doc` (11·12·13·15·18·24). Khoảng cách theo bậc Tailwind.
   - Không thẻ nổi: khối ngăn nhau bằng một vạch mảnh, lưới sát mép.
   - Chữa "khó nhìn" bằng tương phản, không bằng nới thoáng.
5. **Một màu hành động, ba màu vòng đời.**
   - `--act` dành cho thứ bấm được / đang chọn.
   - `--stop`, `--warn`, `--done` chỉ mã hoá vòng đời dữ liệu, không bao giờ lên nút hay dòng đang chọn.
   - **Nền đặc = bấm được.**
   - Màu chỉ qua token (`var(--…)`): không palette Tailwind, không hex.
6. **Số nào không kiểm được thì không ai tin.** Chân bảng nói tổng KHÔNG gồm gì; số suy ra thì bày phép tính nguyên văn (`WhyBox`).
7. **Bị chặn thì nói vướng gì và cách gỡ, TẠI CHỖ.** Không cho bấm rồi mới báo lỗi. Phân biệt ba kiểu chặn:
   - Thiếu điều kiện nghiệp vụ: `PrimaryStep why`, cộng danh sách `Checks` nói điều kiện nào còn thiếu.
   - Bảng nhập chưa lưu được: `CommitBar blocked` + `onGoBlocked`. Câu chặn phải bấm được và nhảy tới đúng ô phải sửa.
   - Không có quyền: `Btn blockedBy` / `PermHint`. Nút khoá mềm, nói bộ phận nào giữ quyền. Đừng dùng kiểu này cho lý do nghiệp vụ.
8. **Rỗng thì nói lý do và việc tiếp** (`Empty`: `reason` + `next` là bắt buộc ở tầng kiểu).
9. **Icon theo khái niệm**, chỉ qua `<Ico name>` hoặc prop `icon`.
   - Nút có động từ quen thuộc (Lưu, Duyệt, In…) phải có icon.
   - Nút chỉ có icon phải có `aria-label`.
10. **Ưu tiên thành phần kit** thay cho `table`, `button`, `input`, `select`, `textarea` thô — kit không có thứ cần thì viết thẳng (lint chặn thẻ thô đã gỡ 30/09/2026).
11. **Không skeuomorphism**: không "tờ giấy in", con dấu xoay, lề giấy.
12. **Nút hành động ở góc trên phải header** (`ActionPane` / `ScreenHeader actions`). Ngoại lệ duy nhất là thanh chốt đáy `CommitBar` của khuôn F.

Các bẫy đã dính thật (Tailwind quét chú thích, lớp `text-` bọc biến bị hiểu là màu, `min-h-screen` giết sticky, portal mất token…) nằm ở [references/bay-da-dinh.md](references/bay-da-dinh.md). **Đọc file đó trước khi viết CSS/className.**

---

## Khi kit thiếu

Chỉ đưa một thành phần vào kit khi nó đã lặp ở **màn thứ hai** — lần đầu cứ viết Tailwind + token trong màn. Khi đưa vào, làm đủ bốn việc:

1. Viết thành phần trong `src/components/kit/*.tsx` và xuất khẩu qua `index.ts`.
2. Ghi **JSDoc cho từng prop trên KHAI BÁO KIỂU**, không phải trên biến destructure — đó là chỗ duy nhất người sau tra được thuộc tính (sách tra sinh từ mã đã xoá cùng `/design-lab` 07/10/2026).
3. Thêm một dòng vào [references/tra-thanh-phan.md](references/tra-thanh-phan.md) đúng nhóm việc.
4. Có test dựng + `axe` (`expectNoViolations` ở `src/test/a11y.ts`) nếu thành phần có tương tác (`src/components/kit/*.test.tsx`).
