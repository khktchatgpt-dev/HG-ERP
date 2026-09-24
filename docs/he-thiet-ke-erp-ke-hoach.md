# Hệ thiết kế ERP — rà soát và kế hoạch hoàn thiện

Viết 24/09/2026. Rà bằng số đo trên mã nguồn, không phải cảm nhận. Mỗi con số
trong tài liệu này đo lại được bằng lệnh ghi ở phụ lục.

**Đọc cùng:**

- [`/design-lab`](../src/app/design-lab/page.tsx) — sổ thiết kế hiện tại: sáu
  nguyên tắc, sáu khuôn màn, luật kiểm 14 dòng.
- [`thiet-ke-huong-erp.md`](thiet-ke-huong-erp.md) — đối chiếu HG-ERP với
  SAP/Odoo/Dynamics/NetSuite ở tầng nghiệp vụ.
- Ghi nhớ dự án: `chuan-hoa-ui-ve-shadcn` (chốt 12/08), `kit-moi-thieu-thu-vien-ui`
  (17/09), `kit-bay-bo-cuc-va-hai-nguon-so` (23–24/09).

---

## 0. Kết luận trước

**Tư duy ERP của hệ thiết kế này mạnh. Nền móng kỹ thuật thì yếu.** Hai điều
này phải tách bạch, vì chữa nhầm chỗ là phá thứ đang tốt.

| Mặt                                         | Điểm | Vì sao                                                                                   |
| ------------------------------------------- | ---: | ---------------------------------------------------------------------------------------- |
| Mẫu hình nghiệp vụ ERP (khuôn, nguyên tắc)  | 9/10 | Sáu khuôn màn, `Empty` bắt buộc lý do + việc tiếp, `WhyBox`, `HolderBar`, mẫu số bắt buộc |
| Định nghĩa token                            | 6/10 | Có màu/chữ/khoảng/bo/z; thiếu chuyển động, thiếu bậc nổi, không có chế độ tối            |
| **Dùng token thật**                         | 3/10 | 70% cỡ chữ trong kit lõi gõ cứng `text-[11.5px]` thay vì `var(--fs-*)`                   |
| Độ phủ thành phần so với bộ chuẩn ERP       | 7/10 | ~95 thành phần; thiếu Toast, Popover, Menu thả, Tabs chung, Lịch chọn ngày, Phân trang   |
| **Hành vi & truy cập của lớp phủ**          | 3/10 | Hộp thoại khai `aria-modal` nhưng KHÔNG giữ focus — phím Tab lọt ra trang phía sau       |
| **Tận dụng thư viện**                       | 2/10 | Radix đã cài, shadcn đã bọc sẵn 16 thành phần — kit không dùng cái nào                    |
| Nhất quán tên gọi                           | 6/10 | Hai hệ bảng, hai ô tìm-chọn, hai dải bước                                                 |
| Tài liệu thành phần                         | 3/10 | 11 mục cho ~95 thành phần; 0 bảng thuộc tính, 0 mục "nên/đừng"                           |
| Kiểm thử                                    | 2/10 | Chỉ test logic thuần; 0 test dựng giao diện, 0 test truy cập, 0 thư viện test UI          |
| Độ phủ trên app                             | 3/10 | 51/458 file giao diện (11%); 16 màn kit phải mượn Toast của hệ cũ                        |
| **Tổng**                                    | **44/100** |                                                                                  |

**Một câu:** giữ nguyên tầng tư duy (khuôn, nguyên tắc, luật kiểm) — thay tầng
máy (hành vi, token, thư viện, kiểm thử) bên dưới nó, **không đổi API** để 73
chỗ gọi không phải sửa.

---

## 1. Rà soát — số đo ngày 24/09/2026

### 1.1 Ba tầng đang sống, và kit bỏ qua hai tầng dưới

```
Tầng 1  radix-ui ^1.6.7             ĐÃ CÀI — Dialog, Popover, Menu, Tooltip, Tabs, Toast…
          │                         (hành vi + truy cập: giữ focus, portal, phím, ARIA)
Tầng 2  src/components/shadcn/*     ĐÃ BỌC 16 thành phần trên tầng 1 — mang token theme v3
          │                         alert-dialog · dialog · dropdown-menu · popover · select
          │                         tabs · tooltip · checkbox · skeleton · …
Tầng 3  src/components/kit/*        TỰ VIẾT 100% — 0 import từ tầng 1 hay 2
                                    7.608 dòng (1.863 dòng CSS tay), ~95 thành phần
```

Chỉ `Icon.tsx` dùng thư viện (`lucide-react`, vá 17/09). `class-variance-authority`
đã cài nhưng kit không dùng — biến thể của `Btn` viết bằng chuỗi điều kiện tay.

**Đây là lần thứ ba vấn đề này được nêu.** 12/08 đã chốt _"chuẩn hoá về shadcn,
viết lại kit thành lớp mỏng, GIỮ NGUYÊN API"_. Kit mới dựng sau đó (tháng 9) lại
đi hướng ngược — tự viết toàn bộ. 17/09 chủ dự án chê lại, mới vá được phần icon.

### 1.2 Hành vi của các điều khiển tự viết

Đo bằng cách trích thân từng hàm và đếm dấu hiệu hành vi (script ở phụ lục):

| Thành phần | Dòng | `role`                       | Esc | Mũi tên | Giữ focus | Portal |
| ---------- | ---: | ---------------------------- | :-: | :-----: | :-------: | :----: |
| `Sheet`    |  144 | dialog + `aria-modal`        |  ✓  |    —    |   **✗**   |   ✗    |
| `PickFind` |  163 | combobox · listbox · option  |  ✓  |    ✓    |     —     | **✗**  |
| `Lookup`   |  146 | listbox · option             |  ✓  |    ✓    |     —     | **✗**  |
| `DateInput`|   96 | —                            |  —  |    —    |     —     |   —    |
| `Tip`      |    — | tự viết, không Radix         |  —  |    —    |     —     |   ✗    |
| `Btn`      |   69 | 0 thuộc tính `aria-*`        |  —  |    —    |     —     |   —    |

Hai lỗ nặng nhất:

- **`Sheet` khai `aria-modal="true"` nhưng không giữ focus** — không bắt phím
  Tab, không `inert` phần nền. Trình đọc màn hình được báo "đây là hộp modal",
  còn người dùng bàn phím bấm Tab thì lọt ra trang phía sau. Khai modal mà không
  giữ focus **tệ hơn** không khai gì. Đây đúng là việc Radix Dialog giải sẵn.
- **Hai ô tìm-chọn không dùng portal** — danh sách thả nằm trong DOM của ô, nên
  đặt trong vùng `overflow: auto` (bảng cuộn, hộp thoại) là bị cắt cụt.

`Pick` dùng `<select>` bản địa **có chủ đích** (chú thích ghi rõ lý do) — đó là
quyết định đúng, giữ nguyên.

### 1.3 Token: có thang, nhưng không ai dùng

`tokens.css` khai đủ thang chữ (10 bậc `--fs-*`), khoảng (`--sp-*`, `--pad-*`),
bo góc (4), z-index (4). Nhưng:

| Nơi                  | `text-[Npx]` gõ cứng | `var(--fs-*)` | Đệm/khe `[Npx]` gõ cứng |
| -------------------- | -------------------: | ------------: | ----------------------: |
| Kit lõi              |               **77** |            33 |                  **71** |
| 51 màn dùng kit      |              **105** |             — |                 **158** |

Và thang đang **trôi**: tám cỡ chữ khác nhau trong khoảng 5px — `10 · 10.5 · 11 ·
11.5 · 12 · 12.5 · 13 · 15`. Hai cỡ `12px` (19 lần) và `10px` (7 lần) **không có
trong thang token**. Mắt người không phân biệt được 11px với 11.5px; tám bậc
trong 5px là tám lựa chọn tuỳ hứng, không phải một thang.

Nguyên nhân gốc: cổng ESLint `hg/no-hardcoded-color` chặn **màu** gõ cứng, không
chặn **cỡ** và **khoảng** — nên màu giữ được kỷ luật, cỡ thì trôi.

Còn thiếu hẳn: token **chuyển động** (0), token **bậc nổi** (chỉ 1 bóng, cho
hộp modal), **chế độ tối** (0).

### 1.4 Tên gọi trùng — cùng một việc, hai thành phần

| Việc              | Hai bản                                     | Hệ quả đã đo được                                              |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Bảng dữ liệu      | `Table/Row/Cell/TFoot` · `Grid/GridRow/Td/GridFoot` | Bẫy lệch cột chân bảng có **hai cửa** — rà `<TFoot` sót màn dùng `GridFoot` (24/09) |
| Ô tìm-rồi-chọn    | `PickFind` · `Lookup`                       | Hai bản cùng thiếu portal, sửa phải sửa hai lần                |
| Dải bước vòng đời | `StatusTrack` · `StageBar`                  | `StageBar` còn tô `--act` đặc — đúng thứ luật 16/09 cấm        |

### 1.5 Tài liệu: tủ trưng bày, chưa phải sách tra

`/design-lab/thanh-phan` có **11 mục cho ~95 thành phần**. Nó trưng thành phần
trong ngữ cảnh — rất tốt để hiểu **khi nào dùng** — nhưng:

- 0 bảng thuộc tính (props)
- 6 lần nhắc tới trạng thái (hover / disabled / loading / focus)
- 3 lần nhắc tới truy cập (aria / bàn phím)
- 0 mục "nên / đừng"

Người dựng màn mới vì thế phải **đọc mã nguồn kit** để biết prop nào có. Chú
thích trong mã nguồn rất tốt — nhưng chú thích không phải tài liệu.

### 1.6 Kiểm thử: chỉ có logic

`kit-core.test.ts` + `flow-core.test.ts` — logic thuần. Không có
`@testing-library/react`, không có `jsdom`/`happy-dom`, không có `axe`. Tức là
**không có gì canh** chuyện giữ focus, vai trò ARIA, hay độ tương phản.

### 1.7 Độ phủ trên app

| Đo (bỏ qua chính thư viện + design-lab) | Số       |
| --------------------------------------- | -------- |
| File giao diện `.tsx`                   | 458      |
| Dùng kit mới                            | 51 (11%) |
| Dùng `erp/*` + `shadcn/*` (hệ cũ)       | 179      |
| Dùng **cả hai** (vi phạm "một file một hệ") | 2    |
| Màn kit phải **mượn Toast** của hệ cũ   | **16**   |

16 màn mượn Toast không phải lỗi của người viết màn — kit **không có Toast**, nên
họ buộc phải trộn hệ.

### 1.8 Bằng chứng: các lỗi đã dính thật (đợt soi 23–24/09)

Mỗi lỗ hổng ở trên đã sinh ra ít nhất một lỗi thật mà người dùng nhìn thấy:

| Lỗ hổng                      | Lỗi đã dính                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| Không test giao diện         | **7 màn** lệch cột chân bảng — chân bảng dính cao 313px đè lên thân bảng    |
| Không có cửa khai bề rộng    | Cả app đúng 1 file khai được `--table-min`; bảng bị bóp thay vì cuộn        |
| Thủ pháp CSS mong manh       | `MetricStrip` lộ khối xám ~37.000px² khi lưới không đầy                     |
| Token màu dùng sai nghĩa     | `--act` (= bấm được) tô trên thanh tiến độ không bấm được                   |
| Không kiểm truy cập          | Dải công đoạn 12 ô **câm** với trình đọc màn hình                            |

Tất cả đã vá — nhưng vá từng ca. Kế hoạch dưới đây là để **lớp lỗi** đó không
sinh ra nữa.

---

## 2. Tiêu chí tham chiếu — chọn lọc từ các hệ ERP lớn

Không chép nguyên một hệ nào. Mỗi nguồn được lấy **đúng một thứ nó làm giỏi
nhất**, kèm lý do nó hợp với HG-ERP.

| Nguồn                              | Lấy gì                                                                   | Vì sao hợp HG-ERP                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **SAP Fiori Design Guidelines**    | Khuôn màn (floorplan); ba bậc mật độ cozy/compact/condensed; cách báo lỗi theo mức (dải thông báo → hộp thông báo → toast) | Sáu khuôn A–F của sổ vốn dựng theo tư duy này; kit đã có 2/3 bậc mật độ |
| **Microsoft Fluent 2 / Dynamics 365** | Action Pane · FastTab · FactBox; token theo **ý nghĩa** chứ không theo hình | Kit đã **mượn đúng tên gọi** của Dynamics — nên chuẩn hoá theo nó là rẻ nhất |
| **IBM Carbon**                     | Bảng dữ liệu: nhiều cỡ dòng do người dùng chọn; truy cập đặt lên đầu     | Bảng là nơi người dùng ERP nhìn nhiều nhất; Carbon là hệ làm bảng kỹ nhất |
| **Salesforce Lightning (SLDS)**    | **Khuôn tài liệu thành phần** ("blueprint"): mục đích · biến thể · trạng thái · truy cập · nên/đừng | Chữa đúng lỗ 1.5 — tài liệu hiện là tủ trưng bày         |
| **WCAG 2.2 mức AA**                | Chuẩn đo truy cập                                                        | Bắt buộc, đo được, có công cụ tự động (`axe`)                       |
| **WAI-ARIA Authoring Practices**   | Mẫu hành vi cho combobox · dialog · menu · tabs · grid                   | Radix cài đặt đúng các mẫu này — dùng Radix là tuân thủ sẵn         |

### 2.1 Mười tiêu chí đo được

Mỗi tiêu chí có **phép đo**, để "xong" là một con số chứ không phải cảm nhận.

| #   | Tiêu chí                                    | Phép đo                                                      | Hiện tại | Đích   |
| --- | ------------------------------------------- | ------------------------------------------------------------ | -------- | ------ |
| T1  | Lớp phủ giữ focus, Esc đóng, trả focus về   | test render + `axe` trên mọi lớp phủ                         | 0/5      | 5/5    |
| T2  | Thành phần tương tác đứng trên thư viện đã kiểm | số thành phần tương tác tự viết hành vi                  | ~8       | 0      |
| T3  | Cỡ chữ/khoảng đi qua token                  | số `text-[Npx]` + `p-[Npx]` gõ cứng (kit + màn kit)          | 411      | ≤ 20   |
| T4  | Thang chữ gọn                               | số cỡ chữ khác nhau trong khoảng 10–15px                     | 8        | 5      |
| T5  | Tương phản chữ ≥ 4,5:1, đồ hoạ ≥ 3:1 (WCAG 1.4.3 / 1.4.11) | `axe` + đo token                              | chưa đo  | 100%   |
| T6  | Không gì che ô đang focus (WCAG 2.4.11 — mới ở 2.2) | test cuộn bảng có tiêu đề/chân dính                   | chưa đo  | 0 lỗi  |
| T7  | Vùng bấm tối thiểu 24×24px (WCAG 2.5.8)     | đo DOM các nút biểu tượng                                    | chưa đo  | 100%   |
| T8  | Mỗi thành phần có trang tài liệu đủ 6 mục   | số thành phần có đủ mục                                      | ~0/95    | 95/95  |
| T9  | Không trùng tên cho cùng một việc           | số cặp trùng (mục 1.4)                                       | 3        | 0      |
| T10 | Màn kit không mượn hệ cũ                    | số màn kit import `ui/Toast`, `shadcn/*`, `erp/*` (không trùng) | 18   | 0      |

T6 đáng nói riêng: tiêu chí này **mới có ở WCAG 2.2**, và nó mô tả đúng lỗi chân
bảng đè thân bảng mà đợt soi 23/09 tìm ra ở 7 màn.

---

## 3. Quyết định kiến trúc

### 3.1 Kit = lớp giao diện trên Radix không-kiểu (headless), dùng token của kit

```
Radix (hành vi + ARIA)  →  kit (token .kit + API hiện có)  →  73 chỗ gọi (không đổi)
```

**Đúng hướng 12/08, hiểu cho đúng.** "Chuẩn hoá về shadcn" nên hiểu là chuẩn hoá
theo **phương pháp** của shadcn — _Radix + `cva` + token của chính mình_ — chứ
không phải **nhập nguyên** file `components/shadcn/*`. Lý do:

- File `shadcn/*` mang token theme v3 (`bg-card`, `text-muted-foreground`). Kit
  bọc chúng là nhét token v3 vào nội dung `.kit` — đúng cái "hai bộ token đánh
  nhau" mà CLAUDE.md cấm.
- Radix không mang kiểu nào. Kit lấy **hành vi** từ Radix, giữ **hình** của
  mình. Không bên nào đè bên nào.
- `shadcn/*` vẫn phục vụ 179 file hệ cũ như hiện nay, không đụng tới.

### 3.2 Giữ nguyên API — luật số một của mọi bản đổi ruột

Đúng quy tắc đã chốt 12/08: _"mỗi lần đổi một component, GIỮ NGUYÊN API cũ để
không phải sửa hàng chục chỗ gọi; chỉ đổi ruột."_ `Sheet` đổi sang Radix Dialog
bên trong, nhưng `<Sheet open onClose title stakes>` vẫn y nguyên. Sửa thành
phần một chỗ, 73 màn hưởng ngay.

Ngoại lệ duy nhất: **gộp các bản trùng** (mục 1.4). Ở đó giữ tên cũ làm bí danh
một thời gian, gỡ dần khi màn có việc nghiệp vụ chạm tới.

### 3.3 Thư viện — thêm gì, bỏ gì

| Nhu cầu                   | Thư viện                                  | Đã cài? | Thay cho                   | Vì sao chọn                                                                  |
| ------------------------- | ----------------------------------------- | :-----: | -------------------------- | ---------------------------------------------------------------------------- |
| Lớp phủ, menu, tabs, tooltip | `radix-ui`                             |   ✓     | `Sheet`, `Tip`, (mới) Popover/Menu/Tabs | Đã cài; cài đặt đúng mẫu WAI-ARIA; không mang kiểu            |
| Toast                     | Radix Toast (trong `radix-ui`)            |   ✓     | `ui/Toast` hệ cũ           | Không thêm gói; gỡ được 16 chỗ mượn hệ cũ                                    |
| Biến thể thành phần       | `class-variance-authority`                |   ✓     | chuỗi điều kiện tay        | Đã cài; biến thể khai một chỗ, kiểm được kiểu                                |
| Ô tìm-rồi-chọn            | `cmdk`                                    |   —     | `PickFind` + `Lookup`      | Gộp hai bản làm một; lọc + phím + ARIA sẵn; nhỏ (~5 KB)                      |
| Chọn ngày                 | `react-day-picker` + `date-fns`           |   —     | `DateInput`                | Ngày kiểu Việt bất kể ngôn ngữ trình duyệt (lỗi `date-field-vn`, còn 44 chỗ)  |
| Máy bảng                  | `@tanstack/react-table`                   |   —     | lõi `Table` + `Grid`       | Không mang kiểu; sắp xếp, ẩn cột, ghim cột, đổi độ rộng — giữ nguyên hình kit |
| Bảng dài                  | `@tanstack/react-virtual`                 |   —     | mẹo `memo` tay             | Lưới 1.000 dòng từng phải chắp vá hiệu năng (ghi nhớ 25/08)                  |
| Biểu mẫu                  | `react-hook-form` + `@hookform/resolvers` |   —     | `useState` từng ô          | Zod đã là chuẩn ở biên API — dùng lại **cùng schema** ở client              |
| Test giao diện            | `@testing-library/react` + `happy-dom`    |   —     | (không có)                 | Chạy trong Vitest đang có                                                    |
| Test truy cập             | `vitest-axe` (lõi `axe-core`)             |   —     | (không có)                 | Bắt tương phản, vai trò, nhãn — tự động                                      |

**Cố ý KHÔNG thêm:**

- **Thư viện biểu đồ.** Giữ quyết định của `thong-ke-thiet-ke-tu-excel.md` §8:
  thanh tiến độ, dải 14 ngày, ô hai mẫu số là SVG nội tuyến vài chục dòng. Thêm
  thư viện biểu đồ khi có một trang phân tích thật cần nó, không trước.
- **Storybook.** `/design-lab` đã là nơi trưng bày, và nó chạy trên dữ liệu thật
  của khuôn màn. Hai nơi trưng bày là hai nơi lệch nhau.
- **Thư viện chuyển động.** Chuyển động của ERP chỉ cần 3 khoảng thời gian + 1
  đường cong — token CSS là đủ.
- **Chế độ tối** — xem câu Q3 ở mục 8.

---

## 4. Token — hoàn thiện và siết

### 4.1 Thang đích

| Nhóm       | Hiện có                                    | Đích                                                                                       |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Màu        | Đủ: hành động, vòng đời ×3, mực, nền, kẻ, `--fill` | Giữ. Thêm cặp `-wash`/`-line` cho `--fill` nếu cần                                  |
| Cỡ chữ     | 10 token nhưng 8 cỡ đang dùng trôi         | **5 bậc**: nhãn 11 · phụ 12 · thân 13 · mục 15 · tiêu đề 18 (+ số chứng từ 24)            |
| Khoảng     | `--sp-*`, `--pad-*`, `--gutter`            | Lưới **4px**: 4 · 8 · 12 · 16 · 24 · 32. Đưa về đây mọi `p-[7px]`, `px-[9px]`              |
| Bo góc     | 4 bậc                                      | Giữ                                                                                        |
| Bậc nổi    | 1 (`--shadow-modal`)                       | 3: thả (menu, popover) · nổi (tooltip) · modal                                             |
| Chuyển động| **0**                                      | 3 thời lượng (nhanh 120ms · vừa 180ms · chậm 240ms) + 1 đường cong + tôn trọng `prefers-reduced-motion` |
| z-index    | 4                                          | Giữ; thêm `--z-toast`                                                                      |
| Mật độ     | 2 bậc (30px / 25px)                        | Thêm bậc 3 **condensed** (22px) chỉ cho bảng lớn — đúng Fiori, xem Q4                       |

Thang chữ 5 bậc thay 8: gộp `10/10.5/11 → 11`, `11.5/12/12.5 → 12`. Dữ liệu cho
thấy đây không phải mất độ phân giải — 11px và 11.5px người đọc không phân biệt
được, nhưng người viết mã phải phân vân giữa hai cái đó mỗi lần.

### 4.2 Cổng ESLint mới — cùng khuôn với `hg/no-hardcoded-color`

Nguyên nhân gốc của trôi cỡ là **cổng chỉ chặn màu**. Thêm hai luật, cùng cơ chế
bánh cóc (`ui-baseline.json`) đang chạy:

- `hg/no-arbitrary-size` — cấm `text-[Npx]`, gợi ý token gần nhất theo số.
- `hg/no-arbitrary-space` — cấm `p-/m-/gap-[Npx]` lệch lưới 4px.

Có test đi kèm như luật cũ (bài học ở CLAUDE.md: _lint hỏng thì im lặng_).

---

## 5. Bộ thành phần đích

Trạng thái: **giữ** (đã tốt) · **đổi ruột** (giữ API, thay hành vi) · **gộp** ·
**mới**.

### 5.1 Lớp phủ — rủi ro truy cập cao nhất, làm trước

| Thành phần    | Trạng thái  | Máy                | Ghi chú                                                             |
| ------------- | ----------- | ------------------ | ------------------------------------------------------------------- |
| `Sheet`       | ✅ đổi ruột (B1) | Radix Dialog  | Giữ `stakes` (vạch mức hệ quả) — đó là phần hay của nó              |
| `Tip`         | ✅ đổi ruột (B1) | Radix Tooltip | Esc tắt, `aria-describedby`, không bị vùng cuộn cắt                 |
| `Popover`     | ✅ mới (B1)  | Radix Popover      | Nền cho lọc nâng cao, chọn cột, xem nhanh                          |
| `Menu`        | ✅ đổi ruột (B1) | Radix DropdownMenu | **Sửa lại 24/09:** `Menu` ĐÃ CÓ trong `Nav.tsx` — là menu thả tự viết, không phải menu điều hướng như bản đầu ghi. Đổi ruột, không tạo mới |
| `Toast`       | ✅ mới (B2)  | Radix Toast        | Cùng API bản cũ; 16 màn đã chuyển, 0 màn kit còn mượn `ui/Toast`    |
| ~~`ConfirmSheet`~~ | **bỏ** (B1) | —            | Không tạo: `Sheet stakes="nang"` mang `role="alertdialog"`. Thêm một bản xác nhận riêng là thêm một cặp trùng tên — đúng lỗi mục 1.4 |

### 5.2 Nhập liệu

| Thành phần             | Trạng thái | Máy                    | Ghi chú                                                     |
| ---------------------- | ---------- | ---------------------- | ----------------------------------------------------------- |
| `Btn`                  | đổi ruột   | `cva` + Radix Slot     | Thêm `aria-busy` khi đang chạy, `aria-disabled` + lý do đọc được |
| `TextInput`/`NumInput`/`TextArea` | giữ + sửa | —            | Chuẩn hoá nhãn, lỗi, gợi ý — `aria-describedby`             |
| `Pick`                 | **giữ**    | `<select>` bản địa     | Quyết định đúng, đã ghi lý do trong mã                     |
| `PickFind` + `Lookup`  | **gộp** → `Combobox` | `cmdk` + Radix Popover | Một bản, có portal                             |
| `DateInput`            | đổi ruột   | `react-day-picker`     | Luôn `dd/mm/yyyy`, có lịch thả                              |
| `Tick` / `GridCheck`   | đổi ruột   | Radix Checkbox         | Có trạng thái "một phần" cho chọn-tất-cả                    |
| `Switch`, `RadioGroup` | **mới**    | Radix                  | Hiện đang dùng `Chip` thay — sai vai trò ARIA               |
| `Form` + `Field`       | **mới**    | `react-hook-form` + zod | Dùng lại schema zod của API                                |

### 5.3 Hiển thị dữ liệu

| Thành phần                       | Trạng thái | Máy                     | Ghi chú                                                                    |
| -------------------------------- | ---------- | ----------------------- | -------------------------------------------------------------------------- |
| `Table` + `Grid`                 | **gộp máy**, giữ hai vỏ | `@tanstack/react-table` | Hai vỏ vì hai khuôn khác nhau (danh sách vs dòng chứng từ); chung một máy + chung `useColSpanGuard` |
| Bảng dài                         | **mới**    | `@tanstack/react-virtual` | Bật tự động khi > 200 dòng                                               |
| Chọn cột / mật độ dòng           | **mới**    | Radix Popover           | Carbon: mật độ là **tuỳ chọn người dùng**                                  |
| `Pagination`                     | **mới**    | —                       | Chuẩn cho sổ phiếu, nhật ký                                                |
| `Tag`, `Code`, `Num`, `CoverageBar` | giữ     | —                       |                                                                            |
| `MatrixTable`, `DayStrip`, `DualPct`, `DeltaNum`, `MiniBars` | **mới** | SVG nội tuyến | Theo `thong-ke-thiet-ke-tu-excel.md` §8                          |

### 5.4 Điều hướng, khung màn, chứng từ ERP

| Nhóm                  | Trạng thái | Ghi chú                                                                               |
| --------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `Tabs` chung          | **mới** (Radix Tabs) | `ActionPane` là tab của thanh lệnh — không dùng lại được cho tab nội dung    |
| `StatusTrack` + `StageBar` | **gộp** → `StatusTrack` | `StageBar` không màn nghiệp vụ nào dùng — chỉ trang trưng bày design-lab; bỏ cả hai chỗ                                     |
| `Crumb`, `NavRail`, `TopBar` | giữ  |                                                                                       |
| `ScreenFrame`, `ScreenHeader`, `Empty`, `WhyBox`, `WorkTile` | **giữ** | Đây là phần mạnh nhất của kit                              |
| `DocHead`, `HolderBar`, `FastTab`, `FactBox`, `Timeline`, `NoteStream` | **giữ** | Mẫu chứng từ ERP — đúng chuẩn Dynamics/Odoo          |

---

## 6. Chuẩn tài liệu — mỗi thành phần một trang

Theo khuôn "blueprint" của SLDS. Mỗi trang ở `/design-lab/thanh-phan/[ten]` có
**đúng sáu mục**, thiếu mục nào thì trang chưa xong:

1. **Dùng khi nào / đừng dùng khi nào** — một câu mỗi vế.
2. **Biến thể** — bảng, mỗi biến thể một ví dụ sống.
3. **Thuộc tính** — bảng `prop · kiểu · mặc định · nghĩa`. Sinh từ kiểu TypeScript
   để không lệch mã.
4. **Trạng thái** — mặc định · rê chuột · focus · đang chạy · bị chặn · lỗi · rỗng.
5. **Truy cập** — vai trò ARIA · phím · trình đọc màn hình đọc ra gì.
6. **Nên / đừng** — rút từ lỗi đã dính thật (mục 1.8), không phải lời khuyên chung.

Cấu trúc `/design-lab` sau khi xong:

```
/design-lab                 Nguyên tắc (6) · Luật kiểm (14 → thêm 4 dòng truy cập)
/design-lab/token           MỚI — thang màu, chữ, khoảng, bậc nổi, chuyển động
/design-lab/thanh-phan      Mục lục thành phần
/design-lab/thanh-phan/*    MỚI — một trang mỗi thành phần, đủ 6 mục
/design-lab/mau-*           Sáu khuôn màn A–F (giữ)
/design-lab/kho/*           Bộ màn Kho (giữ)
```

---

## 7. Chất lượng — bốn lớp canh

| Lớp                 | Công cụ                         | Canh cái gì                                         | Hiện có      |
| ------------------- | ------------------------------- | --------------------------------------------------- | ------------ |
| Logic thuần         | Vitest                          | Phép tính trong `kit-core`, `flow-core`             | ✓            |
| Dựng + truy cập     | Testing Library + `vitest-axe`  | Mỗi thành phần: vai trò, phím, giữ focus, tương phản | **mới**     |
| Chuông lúc chạy dev | hook kiểu `useColSpanGuard`     | Lỗi trình duyệt không báo (lệch cột, v.v.)          | ✓ 1 chuông (24/09) |
| Cổng lint           | `eslint-rules/hg-ui.mjs`        | Màu cứng, thẻ thô, **cỡ + khoảng cứng**             | 2 luật → **4** |

Mỗi thành phần đổi ruột phải có test dựng + `axe` **trước khi** coi là xong. Đó
là cách chắc chắn lỗi `aria-modal` không giữ focus không quay lại.

---

## 8. Câu phải chốt

- ~~**Q1 — Kit đứng trên Radix không-kiểu, hay bọc thẳng `shadcn/*`?**~~
  **CHỐT 24/09/2026: Radix không-kiểu.** Kit lấy hành vi từ Radix, giữ hình và
  token `.kit` của mình; không nhập file `shadcn/*` (mang token v3).
- ~~**Q2 — Toast: Radix Toast hay `sonner`?**~~ **CHỐT 24/09/2026: Radix Toast**
  — không thêm gói nào.
- **Q3 — Chế độ tối: làm không?** Khuyến nghị **không**, trừ khi có ca dùng thật
  (ca đêm ở xưởng, màn hình treo tường). Làm nửa vời thì mọi thành phần mới phải
  kiểm hai lần.
- **Q4 — Mật độ bậc 3 "condensed" (22px) cho bảng lớn** — có cần không? Carbon
  và Fiori đều có; bảng 1.000 dòng của thống kê là ca dùng rõ nhất.
- ~~**Q5 — Máy bảng `@tanstack/react-table`**: đổi cả `Table` lẫn `Grid`, hay chỉ
  `Table` trước?~~ **CHỐT 24/09/2026: cả hai** — một máy, hai vỏ (§9.7).
- ~~**Q6 — Thang chữ 5 bậc**: đồng ý gộp `10/10.5/11 → 11` và `11.5/12/12.5 → 12`?~~
  **CHỐT 24/09/2026: đồng ý** — làm ở B3 (§9.4).

---

## 9. Lộ trình — mỗi bước nghiệm thu được bằng số

Theo luật "làm từng bước một": mỗi bước xong thì dừng, báo số, rồi mới sang bước
sau. Thứ tự theo **rủi ro cho người dùng**, không theo độ dễ.

| Bước  | Việc                                                                                     | Nghiệm thu                                                                    |
| ----- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **B0** | Nền: cài Testing Library + `happy-dom` + `vitest-axe`; khuôn trang tài liệu 6 mục       | `npm test` chạy được một test dựng + `axe` mẫu                                |
| **B1** | Lớp phủ trên Radix: `Sheet`, `Tip`; thêm `Popover`, `Menu`, `ConfirmSheet`              | T1: 5/5 lớp phủ qua test giữ focus + `axe`                                    |
| **B2** | `Toast` trên Radix; gỡ 16 màn mượn `ui/Toast`                                           | T10: số màn kit mượn hệ cũ 18 → ≤ 5                                           |
| **B3** | Token: thang chữ 5 bậc, lưới khoảng 4px, bậc nổi, chuyển động; thêm 2 luật lint         | T3: 411 → ≤ 20; T4: 8 → 5                                                     |
| **B3½** | Icon: phủ icon theo khái niệm cho màn kit, gom hình trùng, luật `hg/kit-icon` (chèn 24/09 theo yêu cầu) | Màn kit có icon 14/53 → ≥ 40; 0 import lucide thô ngoài `Icon.tsx` |
| **B4** | Nhập liệu: `Combobox` (gộp 2 bản, `cmdk`), `DateInput` (`react-day-picker`), `Btn` (`cva`) | T9: cặp trùng 3 → 1; ô ngày luôn `dd/mm/yyyy`                               |
| **B5** | Bảng: máy `@tanstack/react-table`, bảng dài ảo hoá, chọn cột / mật độ                   | Bảng 1.000 dòng cuộn mượt; T6: 0 lỗi che ô focus                              |
| **B6** | Trực quan dữ liệu: `MatrixTable`, `DayStrip`, `DualPct`, `DeltaNum`, `MiniBars`         | Dùng được ở màn Thống kê (T2/T4 của tài liệu Excel)                           |
| **B7** | Tài liệu: một trang mỗi thành phần, đủ 6 mục                                            | T8: 95/95                                                                     |
| **B8** | Di trú màn cũ — **chỉ khi có việc nghiệp vụ chạm**, không vì thẩm mỹ (giữ luật CLAUDE.md) | Độ phủ tăng dần; không có mục tiêu % ép buộc                                  |

B0 đứng trước tất cả: không có công cụ test thì B1 không nghiệm thu được, và lỗi
`aria-modal` sẽ quay lại mà không ai biết.

### 9.1 B0 — XONG 24/09/2026

| Hạng mục                   | Kết quả                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Thư viện                   | `@testing-library/react` 16 · `@testing-library/dom` 10 · `@testing-library/user-event` 14 · `happy-dom` 20 · `axe-core` 4.13 — cài dev, không gói nào sinh cảnh báo audit mới |
| **Lệch so với kế hoạch**   | Dùng thẳng `axe-core` thay cho `vitest-axe`: gói bọc đứng yên đã lâu, việc nó làm chỉ vài dòng — `src/test/a11y.ts` |
| Cấu hình                   | `vitest.config.ts` nhận `*.test.tsx`; môi trường chung GIỮ `node`, file test giao diện tự khai `happy-dom` ở dòng đầu |
| Test mẫu                   | `src/components/kit/kit.a11y.test.tsx` — `Empty`, `Btn`, `Sheet`: 6 đạt                     |
| **Đặc tả chạy được cho B1** | 2 test `it.fails` ghi lỗi đã biết của `Sheet`: Tab lọt ra ngoài hộp; đóng hộp không trả focus về nút đã mở. Đã chạy riêng để xác nhận chúng sai ĐÚNG lý do, không phải sai vì viết hỏng |
| Khuôn tài liệu             | `design-lab/_lab/CompDoc.tsx` — 6 mục BẮT BUỘC ở tầng kiểu (bỏ một mục → lỗi `TS2322`, đã thử) + `tested` bắt buộc trỏ test hoặc nói vì sao chưa có |
| Trang mẫu                  | `/design-lab/thanh-phan/empty` — ghi THẬT hai chỗ yếu của `Empty` (tiêu đề là `<div>`, chưa `role="status"`) |
| Cổng                       | `npm run check` sạch — 188 file, 2.749 đạt + 2 sai-như-dự-kiến; thời gian cả bộ 20,97 giây, không chậm đi |

**Bánh cóc cho B1**: khi `Sheet` dựng lại trên Radix Dialog, hai test `it.fails`
sẽ ĐÚNG → chuyển ĐỎ → người vá đổi `it.fails` thành `it`. Lỗi không thể âm thầm
quay lại, và cũng không thể âm thầm "được vá" mà không ai ghi nhận.

### 9.2 B1 — XONG 24/09/2026

**Nghiệm thu T1: 5/5 lớp phủ** qua test giữ focus / phím / `axe` — `Sheet` (dialog),
`Sheet` mức nặng (alertdialog), `Tip`, `Menu`, `Popover`. Test: 14 trong
`kit.a11y.test.tsx`. Cổng: 188 file, **2.757 đạt, 0 sai-như-dự-kiến**.

| Thành phần | Trước (tự viết)                                                  | Sau (Radix)                                                        |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Sheet`    | `aria-modal` nhưng Tab lọt ra nền; đóng thì focus rơi về `<body>` | Tab vòng trong hộp; focus về đúng nút mở; mức nặng = `alertdialog` |
| `Tip`      | `role="tooltip"` không nối với nút; không Esc; bị vùng cuộn cắt  | `aria-describedby` trên nút; Esc tắt; portal + tự lật phía         |
| `Menu`     | `role="menu"` mà không có phím mũi tên; nút "⋯" không tên; mục khoá `opacity` | Mũi tên, bỏ qua mục khoá; "Thêm thao tác"; mục khoá mực `--ink-empty` + nói lý do |
| `Popover`  | (chưa có)                                                        | Mới — nền cho B4 (ô tìm-chọn) và B5 (chọn cột)                     |

**Bánh cóc đã làm đúng việc của nó.** Lần chạy đầu sau khi đổi ruột, test trả focus
vẫn ĐỎ: Radix Dialog trả focus về `Dialog.Trigger` của chính nó, mà `Sheet` được
điều khiển từ ngoài bằng `open` — không có trigger nào để trả về. Nếu chỉ tin
"Radix tự lo" thì lỗi đã lọt. Vá bằng cách `Sheet` tự ghi phần tử đang focus lúc
mở và trả về đúng nó lúc đóng.

**Hai chỗ đổi so với kế hoạch:**

- `Menu` **không phải thành phần mới** — nó đã có trong `Nav.tsx` (bản đầu kế hoạch
  ghi nhầm là menu điều hướng). Đổi ruột, giữ API `items`/`label`, chỉ thêm
  `ariaLabel` và `blockedBy`.
- `ConfirmSheet` **bỏ** — `Sheet stakes="nang"` mang `role="alertdialog"`.

**Ba bẫy của portal, đã xử lý** (ghi lại vì B2–B5 sẽ gặp lại y hệt):

1. Token kit chỉ khai trong `.kit`, không ở `:root` → portal ra `<body>` là mất
   token. Bọc `<div className="kit contents">` bên trong portal — `contents` để
   lớp bọc không tạo hộp nào.
2. Ra portal thì z-index tính ở gốc: tooltip z 40 sẽ CHÌM dưới hộp thoại z 60.
   Thêm token `--z-pop: 70` cho mọi lớp nổi qua portal.
3. Hộp modal đánh `aria-hidden` cho phần còn lại của trang → chạy `axe` trên cả
   trang báo oan. Chạy `axe` trên chính lớp phủ.

**Chưa kiểm bằng mắt:** thanh điều hướng thật của app (`NavRailLink` dùng `Tip`
khi thu gọn) — cần đăng nhập. `Tip` giờ gắn thẳng vào `Link` (không còn lớp
`<span>` bọc); link đó tự đặt `w-8 h-8` nên không xô lệch, nhưng chưa nhìn tận mắt.

### 9.3 B2 — XONG 24/09/2026

**Nghiệm thu T10: 18 → 3** màn kit còn mượn hệ cũ (đích ≤ 5). Cổng: 188 file,
**2.761 đạt**.

`src/components/kit/Toast.tsx` trên Radix Toast, **cùng API** với `ui/Toast`
(`success / error / info / warning / show`, chữ ký `(title, description?)`). Đặt
SONG SONG với bản cũ trong `Providers.tsx` — hai context khác nhau, không giẫm
nhau. 16 màn kit chuyển bằng đúng một dòng import, 70 file hệ cũ không đụng tới.

| Lỗi của bản cũ                                       | Bản kit                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| MỌI toast `role="alert"` — ngắt lời kể cả "đã lưu"   | Thành công/thường đọc `polite`; chỉ lỗi/cảnh báo `assertive` (WCAG 4.1.3) — đã đo trên trình duyệt thật |
| Tự biến mất 4 giây, không dừng khi rê chuột/focus    | Radix dừng đồng hồ khi rê, khi focus, khi cửa sổ mất tiêu điểm |
| Bàn phím không với tới                               | F8 nhảy vào khay                                               |
| Tin thường tô `--act` (màu hành động)                | Tin thường dùng mực xám — `--act` chỉ còn nghĩa "bấm được"      |
| Lớp theme dò DOM trong effect để né lệch hydrate     | Lớp `.kit` gắn tĩnh → HTML server và client khớp sẵn           |

Thêm: token `--z-toast: 80` (toast nổi trên cả hộp thoại — lỗi hay bật ra đúng lúc
vừa bấm xác nhận trong hộp); hai khái niệm icon `loi` (CircleX), `thongTin` (Info);
mẫu bốn sắc thái ở `/design-lab/thanh-phan`.

**Test bắt thêm một lỗi thật:** `label` của Radix Toast có HAI chỗ — ở Provider
(tên từng toast) và ở **Viewport** (tên vùng khay). Viewport mặc định tiếng Anh
`"Notifications ({hotkey})"`, nên người dùng trình đọc màn hình nghe
_"Notifications F8"_. Đã đặt `"Thông báo ({hotkey})"`.

**Ba màn còn lại của T10 không phải do Toast:** `PoDetailScreen` (màn chuyển kit dở
dang, còn 9 thứ hệ cũ — việc của B8); `ConfirmDialog`, `NavRailLink` là hạ tầng,
không phải màn kit.

**Bẫy môi trường (đã dính khi kiểm B2):** xoá `.next/dev` trong lúc dev server đang
chạy làm Turbopack sập (mã `0xC0000409`) và mất luôn font Google đã đệm; lần biên
dịch sau gặp mạng chập chờn thì Turbopack NHỚ lỗi tải font → mọi trang 500. Chữa
bằng khởi động lại server. Chạy typecheck khi dev đang mở thì lọc dòng
`.next/dev` khỏi kết quả, đừng xoá thư mục.

### 9.4 B3 — XONG 24/09/2026

**Nghiệm thu T3: 411 → 0** cỡ chữ/khoảng gõ cứng trong kit + 63 màn kit (đích ≤ 20).
**T4: 8 → 4** cỡ chữ trong khoảng 10–15px (đích 5) — đo trên trình duyệt: màn mẫu
Chứng từ chỉ còn `11 · 12 · 13 · 24`. Cổng: 188 file, **2.780 đạt**; typecheck và
lint 0 lỗi.

| Hạng mục        | Kết quả                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Thang chữ       | `--fs-label 11 · --fs-sm 12 · --fs-body 13 · --fs-lg 15 · --fs-title 18 · --fs-doc 24`; bí danh cũ (`--fs-micro`, `--fs-num*`, `--fs-section`) trỏ về bậc thật, không xoá để khỏi gãy chỗ gọi |
| Lớp dùng        | `text-k-label / k-sm / k-body / k-lg / k-title / k-doc` — khai ở `@theme inline` của `globals.css` |
| Khoảng          | Theo bậc Tailwind: số chẵn giữ đúng bậc, số lẻ về bội số 4 gần nhất, `1px` → `px`                |
| Bậc nổi         | `--shadow-float` (tooltip) · `--shadow-drop` (menu, popover, toast, ô chọn) · `--shadow-modal`   |
| Chuyển động     | `--dur-fast 120 · --dur-base 180 · --dur-slow 240` + `--ease-out`; `prefers-reduced-motion` đưa cả ba về 0 |
| Chuyển đổi      | Một lượt máy trên 70 file: 226 cỡ chữ hỏng, 174 cỡ px, 182 khoảng px; 7 cỡ px trong `erp.css`     |
| Luật lint       | `hg/no-arbitrary-size`, `hg/no-arbitrary-space` — 20 ca test mới (39 tổng); đã thử bằng một file dò cố ý sai |

**Phát hiện lớn nhất: 226 chỗ viết cỡ chữ từ trước tới nay KHÔNG có tác dụng.**
Tailwind v4 hiểu lớp `text-` bọc `var(--fs-…)` trong ngoặc vuông là **màu**, không
phải cỡ — nên suốt thời gian qua các chữ đó hiện theo cỡ của phần tử cha (thường
13px). Hệ quả thấy được sau B3: chữ phụ và nhãn trên các màn kit **nhỏ đi đúng như
thiết kế ban đầu định** (13 → 12 / 11px). Đây không phải đổi thiết kế, mà là thiết
kế lần đầu tiên chạy thật. Luật `no-arbitrary-size` chặn cách viết này ở **mọi**
file, kể cả màn hệ cũ, và ngay lần chạy đầu đã bắt thêm một chỗ nữa — trong chính
`Toast` viết ở B2.

**Phạm vi luật tự dò** (file import `@/components/kit` hoặc nằm trong
`components/kit/`), nên 168 màn hệ cũ không bị đụng và `ui-baseline.json` không
dài thêm dòng nào. Toạ độ và kích thước (`top-[3px]`, `w-[52px]`, `size-[6px]`)
**cố ý ngoài luật** — đó là vị trí chính xác, không thuộc thang khoảng.

**Bẫy đã dính trong lúc làm:** Tailwind v4 quét mọi file trong repo, kể cả chú
thích và chuỗi thông báo lỗi của luật lint. Viết nguyên văn ví dụ có `var(...)`
hay `var(--fs-*)` trong ngoặc vuông là Tailwind sinh ra `color: var(...)` → CSS
**toàn app** không biên dịch. Test, typecheck, lint vẫn xanh — chỉ trình duyệt thấy.
Đã ghi BẪY ngay trong `hg-ui.mjs`.

**Còn lại, cố ý chưa làm:** 111 khoảng px trong `erp.css` (CSS thuần, luật lint
không với tới — dọn khi chạm vào từng khối); cỡ chữ của phần vỏ sổ `/design-lab`
(tiêu đề 36px, `<code>` 0,92em) — là trang trưng bày, không phải kit.

### 9.5 B3½ — Icon — XONG 24/09/2026

Chèn vào giữa B3 và B4 theo yêu cầu chủ dự án, sau khi rà thấy kế hoạch B0–B8 chỉ
nhắc icon ở phần đo, không có bước nào lo nó.

| Số đo                                   | Trước           | Sau             |
| --------------------------------------- | --------------- | --------------- |
| Màn kit có icon                         | 14 / 53         | **44 / 52**     |
| Nút · chip · action có icon             | 23 / 266        | **195 / 266**   |
| — trong đó `Action` (thanh chứng từ)    | 0 / 60 (không có prop `icon`) | **37 / 60** |
| Số hình cho khái niệm "duyệt"           | **4**           | **1**           |
| Màn kit import thẳng `lucide-react`     | 4               | 1 (có lý do, B8) |
| Khái niệm trong bản đồ                  | 30              | 48              |

Cổng: 188 file, **2.801 đạt**; typecheck và lint 0 lỗi.

**Phát hiện đáng nói nhất — một khái niệm, bốn hình.** "Duyệt" là búa ở bản đồ
khái niệm, con dấu ở Trang chủ GĐ và ở thanh điều hướng, khiên ở Chi tiết duyệt,
dấu tích ở Trung tâm duyệt — bốn màn liền nhau của cùng một người ký. Gốc: ba màn
khu GĐ import thẳng `lucide-react`, không đi qua bản đồ. Chốt **con dấu**: thanh
điều hướng (chỗ người ký nhìn mỗi ngày) đã dùng nó, và duyệt ở đây là ký + đóng
dấu. Cùng lượt đó sửa hai chỗ sai nghĩa: ô "Hạn giao khách" dùng **xe tải** (xe tải
là hàng *đang về*, hạn giao là một *mốc hẹn*); dải "Không có gì bất thường" dùng
**khiên duyệt** cho một trạng thái đã ổn.

| Việc | Kết quả |
| ---- | ------- |
| `Action` | Thêm prop `icon` — thanh hành động chứng từ (kiểu ribbon Dynamics) trước đó KHÔNG có cách nào mang icon, nên mọi màn Chứng từ và cả 6 màn mẫu đều trơn |
| Bản đồ khái niệm | +18 khái niệm, mỗi cái có lý do (lặp ≥ 2 màn, hoặc là nghĩa riêng người dùng cần nhận ra: `giaTang`, `dao`) |
| `ICO_MEANING` | Nghĩa bắt buộc cho từng khái niệm, kiểu `Record<IcoName,…>` — thêm khái niệm mà quên ghi nghĩa là lỗi biên dịch |
| Sách tra | `/design-lab/thanh-phan/icon` — 6 mục theo `CompDoc`, bảng từ vựng dựng thẳng từ `ICO_MEANING` nên không lệch được khỏi mã |
| Luật `hg/kit-icon` | Ba lỗi: import `lucide-react` ngoài `Icon.tsx` · `Btn`/`Action` có động từ quen thuộc (In, Sửa, Xoá, Duyệt, Ghi sổ, Đảo phiếu…) mà thiếu icon · nút chỉ có icon mà không có tên. 15 ca test |
| Test truy cập | Icon trang trí KHÔNG chen vào tên nút ("In phiếu" chứ không phải "hình, In phiếu"); icon có nhãn là `role="img"`; nút ‹ › có `aria-label` qua `axe` |

**Chọn icon theo NGHĨA, không theo chữ.** Lượt gắn tự động phải sửa tay nhiều lần vì
đọc chữ máy móc sẽ sai nghĩa: "Nghiệm thu ngoài **sổ**" không phải mở sổ; "**Xoá** hết
bộ lọc" là bỏ lọc, không phải thùng rác; "Gửi **đối chiếu**" là gửi, không phải hoá
đơn; "Xem tất cả" trong trạng thái rỗng là bỏ lọc, nhưng "Xem tất cả 15 lệnh" có
đường dẫn là sang danh sách lệnh. Và `\b` của JavaScript chỉ hiểu chữ ASCII — "Về",
"Xoá", "Mở" từng trượt hết khỏi luật; luật lint có ca test canh đúng lỗi này.

**Cố ý để trơn:** nút huỷ/lùi (Thôi, Để sau, Đóng, Bỏ chọn — Fiori và Carbon đều để
trơn), chip trạng thái vòng đời (chữ + màu đã đủ; 22/28 chip), và các hành động chưa
có khái niệm rõ (Chốt phần thiếu, Quét mã vạch, Báo KCS…) — thêm khái niệm cho
từng cái một là nở bản đồ thành từ điển hình.

**Còn lại:** `PoDetailScreen` vẫn import lucide (màn chuyển kit dở, việc của B8 —
có `eslint-disable` kèm lý do); `approval-parts.tsx` và 168 màn theme v3 dùng lucide
theo quy ước cũ, ngoài phạm vi luật.

### 9.6 B4 — Nhập liệu — XONG 24/09/2026

**Nghiệm thu T9: cặp trùng 3 → 1** (còn `Table`/`Grid`, việc của B5). **Ô ngày:**
0 `<input type="date">` trong file kit; lịch thả tiếng Việt, luôn `dd/mm/yyyy`.
Cổng: 188 file, **2.812 đạt**; typecheck và lint 0 lỗi. Đã chạy thật trên màn
Xuất kho (ô Lệnh, ô tra vật tư, ô ngày chứng từ).

| Việc | Kết quả |
| ---- | ------- |
| `Combobox` (mới, `cmdk` + Radix Popover) | Thay `PickFind` + `Lookup`: một vỏ, hai nguồn (`options` lọc tại chỗ / `search` hỏi server). **Cùng tên prop** với hai bản cũ nên 12 chỗ gọi chỉ đổi tên thẻ. Danh sách ra portal — hết bị bảng cuộn cắt; tự né mép màn |
| `DateInput` (tách file, `react-day-picker`) | Lịch của trình duyệt (tiếng Anh, tuần bắt đầu Chủ nhật, `showPicker` không chạy mọi nơi) → lịch `vi`: "Tháng 9/2026", T2…CN, tuần bắt đầu thứ Hai; Alt+↓ mở, mũi tên đi, Enter chọn, con trỏ về ô chữ. Màu/cỡ theo token (ô 28px, ngày chọn nền nhạt — không nền đặc) |
| `Btn` (`cva`) | Giữ nguyên prop. Khoá theo quyền → `aria-disabled` + lý do nối bằng `aria-describedby` (nút `disabled` thật rơi khỏi Tab, người dùng trình đọc không bao giờ nghe được lý do). Khoá = nền xám đặc thay `opacity`. Thêm `busy` (vòng quay, `aria-busy`, chặn bấm đôi mà không đánh rơi tiêu điểm). Mặc định `type="button"` |
| `StageBar` | **Gỡ** — không màn nghiệp vụ nào dùng, và nó tô `--act` đặc đúng thứ luật 16/09 cấm. Mẫu ở sổ đổi sang `StatusTrack` |
| Sổ | Mục 8.5 "Tìm-rồi-chọn · ngày · nút" — trước B4 sổ chưa hề trưng ô nhập nào |
| Test | +10 ca: Combobox (ARIA, gõ không dấu, portal, ↓/Esc, kiểu tra), DateInput (gõ liền, lịch, `max`), Btn (khoá mềm, `busy`, `type`) |

**Test bắt được bốn lỗi thật — ba trong đó có từ trước B4:**

1. **Ô ngày kẹt ở `03/08` khi gõ liền từng phím** (`lib/date-vn.ts`, dùng chung với
   `erp/DateField` của theme v3 — tức lỗi ở CẢ HAI hệ). Sau khi ô tự chèn `/`, chuỗi
   `03/082` bị hiểu là người dùng tự chia hai đoạn, đoạn hai bị cắt còn 2 số, năm
   gõ tiếp bị nuốt. Test cũ chỉ đưa cả chuỗi vào một lần (đường DÁN), không bao giờ
   thử đường GÕ. Nay số tràn đoạn thì sang đoạn sau; có test gõ từng phím canh.
2. **Gõ để lọc rồi Enter là XOÁ lựa chọn** (`PickFind` cũ để sáng dòng "— chưa chọn
   —"). Và `cmdk` còn tự đặt dòng sáng về dòng đầu mỗi lần chữ đổi — không cờ nào
   tắt được — nên `Combobox` dùng ô nhập riêng, `cmdk` chỉ lo danh sách.
3. **`cmdk` gắn cứng `aria-expanded="true"`** kể cả khi danh sách đóng.
4. **`aria-controls` trống trên app thật** (test đạt vì môi trường test vẽ phần nổi
   cùng nhịp; Radix trên trình duyệt vẽ SAU một nhịp). Đổi sang callback ref; test
   thêm `waitFor` canh.

Cộng hai lỗi nhỏ: ngày trong ô bị căn phải dù mã ghi `text-left` (lớp `.kit .num`
nằm ngoài layer Tailwind nên luôn thắng); ô nhãn ngày đọc cho trình đọc màn hình
theo đúng dạng `dd/mm/yyyy` người dùng đang thấy.

**Còn lại, ngoài phạm vi:** 25 `<input type="date">` ở màn theme v3 (đo 24/09, trước
đây ghi 44) — dọn khi có việc nghiệp vụ chạm vào (B8). Ô ngày của v3 đã được hưởng
bản vá gõ liền vì dùng chung `lib/date-vn`.

### 9.7 B5 — Máy bảng — XONG 24/09/2026

**Q5 CHỐT: đổi cả hai vỏ.** Theo đúng hàng 5.2 của kế hoạch — **gộp máy, giữ hai vỏ**:
`useKitTable` (trên `@tanstack/react-table` v9 + `@tanstack/react-virtual`) là MỘT
máy; `Table` (danh sách toàn trang) và `Grid` (lưới dòng chứng từ) cùng nhận
`engine={…}`. Tên hai vỏ vẫn còn — có chủ ý, vì hai khuôn khác nhau (C vs D) — nên
T9 tính theo máy là **3 → 0 phần trùng**, theo tên là **2 tên, 1 máy**.

Cổng: 189 file, **2.823 đạt**; typecheck và lint 0 lỗi.

| Nghiệm thu | Kết quả |
| ---------- | ------- |
| **Bảng 1.000 dòng cuộn mượt** | Mẫu ở sổ (`/design-lab/thanh-phan#may-bang`): DOM luôn **~38 dòng** thay vì 1.000; đầu bảng VT-0001…, giữa VT-0472…, đáy …VT-1000. Nhảy cả khung: trung vị 23ms, p95 46ms; sắp xếp 1.000 dòng 42–71ms — đo ở chế độ **dev**, bản build nhanh hơn |
| **T6: 0 lỗi che ô focus** | Tab xuôi + ngược qua mọi link trong bảng, đo `elementFromPoint`: màn NCC (máy mới) **59/344 → 0/344**; màn Đơn mua (kiểu ghép JSX cũ, chưa chuyển máy) **64/320 → 0/320** |

| Việc | Kết quả |
| ---- | ------- |
| `useKitTable` | Sắp xếp (vòng tăng → giảm → bỏ; so chữ tiếng Việt bằng `Intl.Collator('vi')`, số theo số, ô trống luôn cuối), ẩn/hiện cột, mật độ Thường/Dày. Lựa chọn của người xem nhớ theo máy (`prefsKey`) qua `useSyncExternalStore` — không lệch hydrate, đổi ở tab này tab kia theo |
| Chân bảng tự chia cột | Mỗi cột khai ô tổng của nó; dải cột không tổng tự gộp; nhãn ở dải đầu, câu "tổng không gồm gì" ở dải cuối. **Ẩn cột nào cũng không lệch** — lỗi từng dính 7 màn giờ không viết ra được ở chế độ máy |
| `TableSettings` | Nút "Cột" → menu Radix: tick cột (menu không đóng khi tick), chọn mật độ, đặt lại. Cột định danh (ghim) khoá |
| Tiêu đề sắp được | Là nút thật (Tab + Enter), `aria-sort` ở `<th>`; cột không sắp thì là chữ thường, không phải nút giả |
| Ảo hoá | Tự bật khi > 200 dòng. Dùng **dòng đệm** trên/dưới thay cho `display: grid` của ví dụ TanStack — grid làm cột lệch và tiêu đề/chân hết dính. `aria-rowcount` / `aria-rowindex` báo tổng thật cho trình đọc màn hình |
| T6 | `scroll-padding` trên vùng cuộn, **đo thật** chiều cao tiêu đề, chân và bề rộng cột ghim (`ResizeObserver`) — áp cho MỌI `Table`, kể cả ~40 màn kiểu ghép JSX |
| Màn thật | Nhà cung cấp (`/mua-hang/ncc`) chuyển sang máy: sắp theo tên, mặt hàng, số đơn, dở dang, đơn gần nhất. "Tổng chi" cố ý **không** sắp — NCC mua bằng hai loại tiền không có một con số để xếp hạng |
| Icon | +5 khái niệm: `sapTang`, `sapGiam`, `sapXep`, `cot`, `tick` |

**Bốn lỗi bắt được trong lúc làm — cả bốn là lỗi thật, không phải lỗi môi trường:**

1. **Cuộn tới giữa bảng thì thân bảng TRẮNG.** React gắn `ref` của thẻ cha SAU layout
   effect của con, nên bộ ảo hoá khởi động khi vùng cuộn còn `null` và không bao giờ
   nghe sự kiện cuộn. Tái hiện được trong test trước khi sửa; nay vùng cuộn đi qua
   state (callback ref) và có test canh.
2. **Bảng ảo hoá nháy trống ở lượt vẽ đầu** (và HTML dựng ở server không có dòng nào)
   vì chưa đo được khung → thêm khung ước lượng ban đầu.
3. **Chừa cố định 44px cho chân bảng là đoán sai**: chân màn NCC cao 65px (câu lưu ý
   xuống dòng) nên vẫn 16/172 lần Tab ô focus lọt dưới chân. Nay đo thật.
4. Luật React Compiler chặn đọc `ref` trong lúc vẽ và `setState` trong effect — viết
   lại kho lựa chọn bằng `useSyncExternalStore`.

**Bẫy môi trường (đừng kết luận sai):** khung xem trước khi cửa sổ app không được
focus ở trạng thái `hidden` — trình duyệt **không phát sự kiện cuộn, không chạy khung
vẽ**, bảng ảo hoá trông như hỏng. Chụp màn hình trước để khung được vẽ, và kiểm lỗi
trong test trước khi đổ cho môi trường. Và khung xem trước cao 387px thì vùng bảng
còn 0px — đo T6 phải đặt khung 1280×800.

**Chưa làm (để lúc có việc chạm):** ~40 màn còn kiểu ghép JSX — chuyển khi màn đó cần
sắp xếp/chọn cột/> 200 dòng, không chuyển hàng loạt. `Grid` không ảo hoá (không có
vùng cuộn dọc riêng — chứng từ > 200 dòng là dấu hiệu nên tách chứng từ).

### 9.8 B6 — Bày số cho Thống kê — XONG 24/09/2026

**Nghiệm thu: dùng được ở màn Thống kê.** Chạy trên màn thật: **T2** "Bảng đồng bộ"
ở `/thongke/lsx/[id]` (lệnh `02/26-27 - MX`: 9 SP × 8 công đoạn, tiêu đề hai tầng,
chân 14 cột khớp 14 cột lá; bấm ô "Sơn" → danh sách việc lọc đúng Sơn và cuộn tới);
**T4** cột "14 ngày" ở `/thongke/ghi` (94 dải, 11/09→24/09, ô hôm nay có viền). Sổ sản
lượng thật đang trống nên ở đó mọi số là 0 — mẫu có số nằm ở
`/design-lab/thanh-phan#bay-so`. Cổng: 190 file, **2.836 đạt**.

| Thành phần | Việc | Ghi chú |
| ---------- | ---- | ------- |
| `DualPct` | `98% mảnh · 62% bộ` — hai mẫu số cạnh nhau (§3b của tài liệu Excel) | % tiến độ làm tròn XUỐNG: 99,6% in 99%, không bao giờ "100%" khi chưa đủ |
| `DeltaNum` | `(300)` thiếu (đỏ) · `+120` dư (hổ phách — dư cũng là vấn đề) · `—` đủ | Trình đọc nghe "thiếu 300 bộ", không nghe "300" |
| `DayStrip` | Dải n ngày SVG, một màu, đầu cột bo, ngày 0 có vạch mốc, hôm nay có viền | Một điểm Tab; mũi tên đi từng ngày, ô rê ra số trước rồi ngày + số phiếu; bảng ẩn cho trình đọc |
| `MiniBars` | Thanh ngang so sánh; hai chuỗi thì chồng, khe 2px, chú giải bắt buộc | Số ở đầu thanh bằng mực chữ, không mang màu thanh |
| `MatrixTable` | Bảng chéo: tiêu đề hai tầng (`colgroup`), ghim nhiều cột, ô đầu dòng là tiêu đề dòng, chân dính | `NGOAI_LO_TRINH` → ô sọc "ngoài lộ trình", khác ô 0; `onCell` chỉ biến ô thành nút ở cột `pick` |

**Màu dữ liệu chọn bằng bộ kiểm của hướng dẫn dataviz, không bằng mắt.** Kit trước B6
chỉ có một màu hành động và ba màu vòng đời — không màu nào được dùng cho chuỗi dữ
liệu. Thêm `--viz-1` `#008c9e` (xanh ngọc, 4,0:1) và `--viz-2` `#d884c6`. Đã loại:
tím `#6f45c2` (cách `--act` chỉ ΔE 10,9 — trông như bấm được), ngọc đậm (dính
`--done`), xám `--fill` (trượt ngưỡng độ đậm màu cho chuỗi). Cặp hai chuỗi tốt nhất
vẫn ở vùng "phải kèm mã phụ" (mù màu ΔE 7,1) — nên `MiniBars` hai chuỗi bắt buộc khe +
chú giải + nhãn số.

**Bộ kiểm lộ một điểm yếu CÓ SẴN của kit:** `--stop` (đỏ) và `--warn` (hổ phách) gần như
trùng nhau với người mù màu đỏ-lục (ΔE 0,9). Kit vốn luôn kèm chữ/nhãn cạnh màu vòng
đời nên chưa vỡ, nhưng **đừng bao giờ** dùng hai màu này làm tín hiệu duy nhất.

**Dữ liệu mới ở service:** `WorklistRow.pieces_needed/pieces_done` (% theo mảnh, mỗi chi
tiết kẹp ở mức cần) và `EntrySheetLine.days` (14 ngày, lấy từ chính lượt đọc sổ — không
thêm truy vấn).

**Lỗi bắt được trong lúc làm:**

1. **Chuông canh lệch cột của kit báo oan bảng hai tầng** (`thead=25, tfoot=14` cho một
   bảng đúng): nó cộng ô của cả hai hàng tiêu đề. Nay chỉ đếm hàng đầu; có test chạy
   cả hai chiều (đỏ trước khi sửa).
2. **Nền sọc ô ngoài lộ trình bị kiểu chung của bảng kit đè** ở dòng chẵn — ô "ngoài lộ
   trình" trông y như ô trống, tức luật 1 của T2 hỏng. Test không bắt được (không dựng
   CSS); chỉ thấy khi mở trình duyệt.
3. Có sẵn ở màn ghi: dòng tiêu đề nhóm hụt một ô (biến `cols` 7/10, bảng 8/11 cột).
4. Tránh "hai nguồn số": dòng tóm tắt của khối mới không nhắc lại "bộ xong" — dải chỉ số
   đếm theo công đoạn cuối, bảng đếm theo công đoạn chậm nhất.

**Chưa làm (thuộc lộ trình Thống kê, không phải hệ thiết kế):** T3 "Theo mảnh" (bấm ô T2
hiện chỉ lọc danh sách việc, chưa mở màn theo mảnh), T5 gia công ngoài (MiniBars hai
chuỗi đã sẵn chờ dữ liệu), T6 kế hoạch ngày xong, T7b cảnh báo.

### 9.9 B7 — Sách tra thành phần — XONG 24/09/2026

**Nghiệm thu T8: 102/102 thành phần có trang đủ sáu mục** (đích kế hoạch 95/95 — kit đã
nở thêm ở B1–B6). Gom thành **58 trang theo HỌ** ở `/design-lab/thanh-phan/[slug]`:
`GridSep`, `Th`, `GridBtn` không có nghĩa khi đứng một mình, viết 102 trang thì 40 trang
là "xem trang Grid". Cổng: 193 file, **2.901 đạt**; typecheck + lint sạch.

| Chỉ số | Trước | Sau |
| ------ | ----- | --- |
| Thành phần có trang đủ 6 mục | 2 (`Empty`, `Ico`) | **102/102** |
| Prop có ghi nghĩa | 98/367 | **367/367** |
| Trang có ví dụ SỐNG qua `axe` | 2 | **58** |

**Mục 3 (thuộc tính) không viết tay.** `scripts/kit-api-lib.mjs` đọc kiểu TypeScript +
JSDoc trên KHAI BÁO KIỂU của kit → `_lab/kit-api.json` (`npm run kit:api`) → `CompDoc`
dựng bảng. Nghĩa của prop nay nằm cạnh khai báo, nơi người sửa prop nhìn thấy.

**Bốn lớp canh** — `_lab/kit-docs.test.tsx` + `_lab/kit-api.test.ts`: thành phần mới
không thuộc họ nào → đỏ; họ không có trang hoặc trang dựng hỏng / thiếu mục / lỗi `axe`
→ đỏ; prop không có JSDoc → đỏ; JSON cũ hơn mã → đỏ kèm câu lệnh phải chạy. Cộng một
lớp thứ năm: bảng "cần gì → dùng gì" của skill `erp-ui` phải nhắc đủ mọi họ.

**Cách làm:** khung (sổ họ, `CompDoc` sinh mục 3, route động, test) dựng tay trước; 58
trang chia cho 6 agent theo FILE kit (không hai agent sửa chung một khai báo). Luật cho
agent: mục 5 ghi THẬT kể cả chỗ yếu; nên/đừng phải có nguồn (chú thích mã, tài liệu,
git) — không bịa sự cố; `tested` chỉ trỏ file test khi test thật sự dựng thành phần.
Kết quả: **18 họ** trỏ được file test (lớp phủ, nhập liệu, bảng, trực quan dữ liệu),
**40 họ** ghi thẳng "chưa có test" kèm lý do — gần hết khối Chứng từ và Khung màn.

**Lỗi THẬT lộ ra khi viết tài liệu — chưa sửa, đã ghi trên từng trang.** Đây là giá trị
lớn nhất của B7: viết mục "truy cập" bắt phải đọc từng thuộc tính ARIA.

| Nhóm | Lỗi |
| ---- | --- |
| **Vi phạm luật "nền đặc = bấm được"** | `Action` chính bị khoá mềm vẫn tô `--act` đặc (`.k-act-p` đứng sau `.k-act-off` cùng độ ưu tiên, erp.css ~231/252); `GridBtn` và `SmartLinks` khoá vẫn dùng `opacity` — cách mà `Action` đã bỏ vì trượt tương phản |
| **Rơi tiêu điểm / không tới được bằng phím** | `SheetActions busy` dùng `disabled` thật (không `aria-busy`) → tiêu điểm rơi khỏi hộp đúng lúc bấm xác nhận; `PrimaryStep why` khoá cứng → rời thứ tự Tab, lý do không gắn vào nút; `GridRow`/`Row onClick` bấm được bằng chuột, không bằng phím; `HeadChip` không `onClick` vẫn là nút nhận focus mà không làm gì |
| **Thiếu `type="button"`** (trong `<form>` thì bấm = gửi form) | `Chip`, nút ✕ của `SearchInput`, `Code as="button"`, nút của `NoticeBar`, tab `WorkLanes`, nút tìm của `CommandBar`/`TopBar`, nút thu gọn `NavRail` |
| **Mốc/tên thiếu** | `<nav>`/`<aside>` không tên (`NavRail`+`TopBar`, `CommandBar`, `InspectPanel`, `FactBox`) — hai cái trên một trang là `landmark-unique`; `Crumb` không `nav`, dấu › bị đọc, mắt cuối không `aria-current`; `SearchInput` chỉ có placeholder làm tên; `NavRail` thu gọn: link chỉ có icon, không tên |
| **Thứ bậc tiêu đề cứng** | `FieldGroup` luôn `<h4>`, `InspectPanel` luôn `<h4>` — dưới `<h2>` là nhảy bậc |
| **Không thông báo khi đổi** | `Empty`, `Loading`, `NoticeBar`, `Checks`, `HolderBar`, `CommitBar`, kết quả `Combobox` — không có vùng `status` |
| **Hành vi sai** | `NextAction.since` khai mà không đọc; `NoteComposer` xoá ô ngay sau `onSubmit` không chờ lưu (mà `DocNotesPanel` báo lỗi "Nội dung vẫn còn trong ô" — sai); `Combobox` chế độ tra: `search` ném lỗi thì không ai bắt; `DeltaNum` coi `NaN` là 0 → dữ liệu thiếu đọc thành "đủ"; `CommitBar blocked` không có `onGoBlocked` là nút chết (đang dính ở 3 màn); `Btn href` rơi mất `aria-label`/`onClick`/`target`; prop rải cuối đè hành vi (`onBlur` vào `NumInput` là mất `onCommit`); `WhyBox` gộp khoảng trắng nên cột căn bằng dấu cách lệch |
| **Khác** | `HolderBar` tuổi luôn đỏ kể cả "1 ngày"; `NavRail` thu gọn đếm `warn` hiện chấm `--act`; spinner + `Loading` bỏ qua giảm chuyển động; `Tick` vùng bấm 13px |

**Ba phát hiện về chính kit:** (1) `NavRail`/`TopBar`/`UserCard`/`Count`/`CommandBar`
**không màn thật nào dùng** — vỏ thật là `WorkspaceShell`; chúng chỉ sống trong màn mẫu.
(2) Bảng thuộc tính `Combobox` chỉ bày phần chung của hai chế độ (bộ trích thu kiểu hợp
về phần giao) — prop riêng từng chế độ nằm ở mục biến thể. (3) Ba chú thích kit từng nói
sai mã và đã sửa: `InspectPanel` ẩn dưới 1280px (không phải 1240), `TextArea` chưa tự
giãn tới `maxRows`, `DocHead.compact` không bỏ nhãn trục.

**Sự cố trong lúc làm:** skill `erp-ui` viết cùng lúc có một chuỗi giống lớp Tailwind bọc
`var` rỗng → CẢ app mất CSS trên dev (lần thứ hai trong ngày). Chữa: sửa chuỗi + test
`src/test/tailwind-trap.test.ts` quét mọi file repo. Gỡ chuỗi khỏi `.md` thì CSS KHÔNG
dựng lại, kể cả khởi động lại dev server — phải sửa thật `globals.css`.

**Việc tiếp theo đề xuất (chưa làm):** một đợt "B7½" sửa các lỗi trên — phần lớn là 1–3
dòng mỗi lỗi và mỗi lỗi có sẵn câu mô tả trên trang tài liệu; lỗi "nền đặc" và "rơi tiêu
điểm" nên đi trước vì chạm luật đã chốt.

### 9.10 B7½ — Sửa lỗi lộ ra từ sách tra — XONG 24/09/2026

**Nghiệm thu: mọi lỗi ở bảng §9.9 có test ĐỎ trên mã cũ, XANH sau khi sửa** (trừ ba sửa
CSS thuần, đo bằng trình duyệt). Cổng: 197 file, **3.005 đạt** (từ 2.901); typecheck +
lint sạch. API chỉ THÊM prop (`label`, `level`, `panelId`, `rowHeader`, `target`/`rel`,
`id`), gỡ đúng một prop chết (`NextAction.since` — 0 chỗ gọi). Test mới:
`erp.a11y.test.tsx` (20), `primitives.a11y.test.tsx` (27), `table.a11y.test.tsx`,
`shell-flow.a11y.test.tsx` (34), cộng ca mới trong `kit.a11y` / `viz`.

| Nhóm | Đã sửa |
| ---- | ------ |
| Nền đặc = bấm được | `Action` chính khoá: đo trên trình duyệt `--act` đặc → nền xám `rgb(243,245,248)`, chữ 5,4:1. `GridBtn`, `SmartLinks` bỏ `opacity` → cùng kiểu xám đặc; `SmartLinks` thành khoá MỀM có lý do |
| Rơi tiêu điểm | `SheetActions busy` → khoá mềm `Btn busy`; `PrimaryStep why` → khoá mềm + `aria-describedby`; `Btn` coi `aria-disabled` của chỗ gọi là khoá mềm; `GridRow` / `Row` / dòng máy bảng (cả khi ảo hoá) bấm được bằng Enter/Space |
| `type="button"` | `Chip`, ✕ `SearchInput`, `Code as="button"`, nút `NoticeBar`, tab `WorkLanes`, nút tìm `CommandBar`/`TopBar`, nút thu gọn `NavRail` |
| Mốc có tên | `NavRail` "Điều hướng chính"; `TopBar`/`CommandBar`/`Crumb` "Đường dẫn" + `aria-current`; `InspectPanel` theo mã + việc; `FactBox`/`Crumb` nhận `label` |
| Thông báo | `Empty`, `Loading`, `NoticeBar` (status / alert theo tone), `Checks`, `HolderBar`, `CommitBar`, `Combobox` (MỘT vùng, nói sau khi kết quả về) |
| Hành vi | `NoteComposer` chờ lưu xong mới xoá ô (+ `DocNotesPanel` ném lỗi tiếp — câu "Nội dung vẫn còn trong ô" nay đúng); `Combobox` bắt lỗi `search`; `DeltaNum` NaN/null = "?" "chưa có số"; `MiniBars` hai chuỗi bắt `series` ở TẦNG KIỂU + chữ ẩn từng chuỗi; `CommitBar` không `onGoBlocked` = chữ, màn nhập hoá đơn NCC có đường nhảy tới ô; `Btn href` chuyển đủ prop xuống link; prop chỗ gọi GHÉP chứ không ĐÈ; `WhyBox` giữ khoảng trắng; `HolderBar` màu theo ngưỡng (< 3 · 3–6 · ≥ 7 ngày — cùng mốc "nằm im" / "kẹt" đã có trong mã; CHỐT 24/09/2026); `WorkLanes` ← → Home End; `NavRail` thu gọn đọc được tên link |

**Cách làm và sự cố:** 4 agent chia theo file kit; chủ dự án yêu cầu không chờ nên dừng
cả bốn giữa chừng và làm tiếp tay từ đúng chỗ dừng (24 test đỏ = danh sách việc còn
lại). Một "lỗi lệch hydrate" hoá ra là test gọi `act` ngoài Testing Library mà thiếu cờ
`IS_REACT_ACT_ENVIRONMENT` — và test hỏng không dọn phần tử gắn `<body>` nên LÂY sang
các test sau (đếm thừa nút, Tab lạc chỗ). Sửa test, dọn trong `finally`.

**Còn lại, ghi thật (không chặn):** `CommandBar` mảnh có `href` vẫn là `<a>` trần (chỉ
dùng ở màn mẫu); `PrimaryStep` có cả `blockedBy` lẫn `why` thì nút chỉ mô tả bằng lý do
quyền; gợi ý phím của `NoteComposer` vẫn luôn "⌘+Enter"; `action-pane` chưa có test dựng.

B8 cố ý **không** đặt mục tiêu phần trăm. CLAUDE.md đã chốt đúng: _"Đừng viết
lại 168 file cho đều nhau — đổi rất nhiều rủi ro lấy rất ít giá trị."_ Vì kit giữ
nguyên API, màn nào đã dùng kit tự hưởng mọi bản vá ở B1–B7 mà không phải sửa.

---

## Phụ lục — đo lại các con số

```bash
# 1.1 — kit import thư viện nào
grep -hn "^import" src/components/kit/*.tsx | grep -v "from '\./\|from '@/lib\|from 'react'"

# 1.3 — cỡ chữ gõ cứng vs token trong kit lõi
grep -oh "text-\[[0-9.]*px\]" src/components/kit/*.tsx | wc -l
grep -oh "var(--fs-[a-z-]*)" src/components/kit/*.tsx | wc -l

# 1.3 — phân bố cỡ chữ gõ cứng
grep -rhoE "text-\[[0-9.]+px\]" src/components/kit src/app | sort | uniq -c | sort -rn

# 1.7 — màn kit mượn Toast hệ cũ
grep -rl "from '@/components/kit'" src/app --include=*.tsx | xargs grep -l "components/ui/Toast"

# 1.2 — hành vi điều khiển: script trích thân hàm + đếm dấu hiệu,
#       lưu tại scratchpad phiên 24/09 (a11y.mjs)
```
