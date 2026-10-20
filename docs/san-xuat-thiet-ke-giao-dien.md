# Quản lý sản xuất — thiết kế giao diện từ đầu đến cuối

Viết 18/09/2026. Đây là bản thiết kế GIAO DIỆN cho toàn khu Sản xuất: màn chính,
màn phụ, luồng người dùng theo từng vai, và bản đồ màn cũ → màn mới.

**Đọc trước, theo thứ tự:**

1. [`san-xuat-quy-trinh-vai-tro.md`](san-xuat-quy-trinh-vai-tro.md) — quy trình,
   vai trò, máy trạng thái. Tài liệu này giả định người đọc đã nắm nó.
2. [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md) — luồng chạy thế nào.
3. [`thiet-ke-huong-erp.md`](thiet-ke-huong-erp.md) — nền đối chiếu ERP chung.
4. [`/design-lab`](../src/app/design-lab/page.tsx) — sáu khuôn màn + thư viện
   thành phần.

Tài liệu này đứng ở tầng "màn trông thế nào". Nó KHÔNG mở lại các câu nghiệp vụ
đã chốt; chỗ nào còn treo thì ghi rõ là treo.

---

## 1. Bốn hệ ERP dựng màn sản xuất ra sao

Đối chiếu theo **loại màn**, không theo hệ — vì cái cần học là _họ chia màn thế
nào_, không phải _họ có bao nhiêu màn_.

| Loại màn                        | SAP S/4HANA PP                                       | Dynamics 365 SCM                                  | Odoo MRP                                        | NetSuite                         |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| **Danh sách lệnh**              | Manage Production Orders — filter bar + variant       | All production orders — list page + Action Pane   | Manufacturing Orders — list/kanban + group by   | Work Orders list                 |
| **Chi tiết lệnh**               | Object Page: header facts + tab Components/Operations | Details master: FastTabs + Related information     | MO form: Components / Work Orders + **chatter** | WO record + Operations sublist   |
| **Việc theo CÔNG ĐOẠN**         | Monitor Production Operations (xuyên mọi lệnh)        | Job list theo work center                          | Work Orders menu (xuyên mọi MO)                 | Operation list                   |
| **Bàn làm việc của xưởng**      | Confirm Production Operation (CO11N)                  | **Production floor execution** — terminal cảm ứng | **Shop Floor** — kanban theo tổ, nút to (tablet) | Manufacturing Mobile (quét mã)   |
| **Ghi hàng loạt**               | Collective Confirmation (CO12) — lưới                 | Journal lines — lưới                               | (không có màn riêng)                            | Mass build                       |
| **Trang của quản đốc**          | Production Supervisor Overview Page — thẻ ngoại lệ    | Workspace: ô đếm bấm được                          | Overview kanban theo work center                | Dashboard portlet                |
| **Xếp lịch**                    | Capacity planning board (Gantt)                       | Gantt scheduling board                             | Planning (Gantt, bản trả phí)                   | Advanced Manufacturing           |
| **Thiếu vật tư**                | Material Coverage / Shortage list                     | Check availability + shortage                      | Check availability trên MO                      | Item availability                |

**Bảy điều đáng chép, và lý do:**

1. **HAI BỀ MẶT, không phải nhiều khu.** Cả bốn hệ đều tách rõ _văn phòng_ (danh
   sách giàu bộ lọc, trang chứng từ nhiều tab) khỏi _mặt xưởng_ (một việc mỗi
   lần, nút to, ít trường). Odoo tách thành hẳn một app "Shop Floor"; Dynamics
   gọi là "Production floor execution". Đây là ranh giới THIẾT BỊ và TƯ THẾ làm
   việc, không phải ranh giới phòng ban.
2. **Trang chứng từ = một trang, nhiều tab.** Không ai tách "xem lệnh" và "sửa
   lệnh" thành hai đường. Tab là cách duy nhất nhét Components + Operations +
   lịch sử + tài liệu vào một chỗ mà vẫn đọc được.
3. **Có một màn nhìn theo CÔNG ĐOẠN xuyên mọi lệnh.** Tổ hàn không quan tâm
   lệnh nào — họ hỏi "hôm nay tổ tôi phải hàn những gì". Màn theo lệnh không trả
   lời được câu đó. SAP có Monitor Production Operations, Odoo có menu Work
   Orders riêng.
4. **Ghi nhận = sản lượng đạt + phế + lý do, tại chỗ.** Cả bốn hệ đặt ba ô đó
   cạnh nhau trên cùng một màn. Không hệ nào bắt đi sang màn khác để khai phế.
5. **Trang quản đốc là các Ô NGOẠI LỆ BẤM ĐƯỢC**, không phải biểu đồ. SAP gọi
   là Overview Page: mỗi thẻ là một câu hỏi ("lệnh nào chưa thả", "phiếu nào
   chưa xác nhận") và bấm vào là ra danh sách đã lọc sẵn.
6. **Chatter trên chứng từ** (Odoo). Đây là khoảng cách lớn nhất của HG-ERP với
   Odoo, đã ghi trong `thiet-ke-huong-erp.md`. Kit đã có `NoteStream` /
   `NoteComposer` / `Followers` — sẵn sàng dùng.
7. **Kiểm đủ vật tư TRƯỚC khi thả lệnh xuống xưởng.** Odoo "Check availability",
   Dynamics "Check availability". HG đã có dữ liệu (`v_lsx_material_status`)
   nhưng chưa đặt nó vào đúng chỗ trong luồng.

---

## 2. Điều KHÔNG chép

Phần này quan trọng ngang phần trên. Hai nhóm:

**A. Dự án đã chốt KHÔNG làm — đừng đề xuất lại:**

- **Kanban lệnh theo công đoạn.** Một SP nằm ở nhiều công đoạn cùng lúc (BOM hai
  cấp), nên thẻ không có một cột để đứng. Odoo Shop Floor kanban được vì mỗi
  work order là một thẻ đơn trị; HG không có cấu trúc đó.
- **Tầng "Kế hoạch SX" duyệt riêng** (thực thể KH-xxx + vòng trạng thái riêng) —
  đã từ chối ba lần.
- **Form máy móc / giờ vào-ra / nguyên nhân lỗi bốn nhóm** — QC không lên hệ
  thống, dữ liệu sẽ trống.
- **Màn BOM riêng trong khu Sản xuất** — định mức thuộc hồ sơ SP bên Kỹ thuật.
- **Gantt kéo-thả** — treo chủ đích, chưa có nhu cầu.
- **Kho thành phẩm** — chốt 18/09: đóng gói xong xếp chờ container.

**B. Có trong ERP lớn nhưng không hợp một xưởng:**

- **Work center capacity / OEE / máy-giờ.** Cần dữ liệu giờ máy mà xưởng không
  ghi. Ô OEE luôn trống còn tệ hơn không có ô nào.
- **Thả lệnh (release) như một trạng thái riêng.** SAP tách Created → Released
  vì có tầng in phiếu công đoạn và đặt chỗ năng lực. HG không có hai thứ đó.
- **Biểu đồ ở trang chủ.** Biểu đồ trả lời "tháng này thế nào"; quản đốc hỏi
  "hôm nay lệnh nào kẹt".
- **Quét mã vạch** (NetSuite Manufacturing Mobile). Xưởng chưa dán mã.

---

## 3. Hiện trạng — đo được, 18/09/2026

**11 mục nav trên 4 khu, ~19 route:**

| Khu           | Mục nav                                                                              | Vai đích        |
| ------------- | ------------------------------------------------------------------------------------ | --------------- |
| `/production` | Toàn cảnh xưởng                                                                      | quản đốc        |
| `/to`         | Việc của tổ                                                                          | tổ trưởng       |
| `/thongke`    | Ghi sản lượng · Tiến độ theo lệnh · Sổ ngày & chốt sổ                                | thống kê        |
| `/kehoach-sx` | Kế hoạch SX · Kế hoạch tuần · Tiến độ · Chỉ tiêu ngày · Theo tổ · Lệnh đang chạy     | kế hoạch        |

**Ba vấn đề đo được, không phải cảm tính:**

1. **13 màn, 0 dòng sổ.** Mọi màn tiến độ/tuần/chỉ tiêu/theo tổ/báo cáo đều là
   dẫn xuất của `production_entries`. Rỗng hết.
2. **6 mục nav cho Kế hoạch** — nhiều hơn số màn mà một người lập kế hoạch thật
   sự mở trong ngày. "Tiến độ", "Theo tổ", "Kế hoạch tuần", "Lệnh đang chạy" trả
   lời bốn biến thể của cùng một câu hỏi.
3. **Toàn bộ 13 màn còn ở theme cũ** (`components/erp` + `shadcn`), 0 file dùng
   `@/components/kit`.

---

## 4. Quyết định nền — HAI BỀ MẶT, không phải bốn khu

Đây là quyết định lớn nhất của bản thiết kế, và nó **mâu thuẫn với quyết định
07/2026** ("gia đình Sản xuất tách theo VAI: mỗi vai một workspace"). Nêu ra để
chủ dự án quyết, không tự đảo.

**Bằng chứng từ bốn hệ:** không hệ nào chia module sản xuất theo _phòng ban_. Họ
chia theo **tư thế làm việc**:

- **Bề mặt VĂN PHÒNG** — ngồi máy tính, màn hình rộng, nhiều cột, nhiều bộ lọc.
  Kế hoạch + quản đốc + thống kê đều làm ở đây.
- **Bề mặt XƯỞNG** — đứng máy, màn hình nhỏ hoặc tablet, một việc mỗi lần, nút
  to. Tổ trưởng làm ở đây.

Vai được xử bằng **lọc nav theo năng lực** (`NavCapability` — cơ chế này đã có
sẵn), không phải bằng workspace riêng.

**Đề xuất:**

| Hôm nay                                     | Đề xuất                                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `/production` + `/kehoach-sx` + `/thongke`  | **một khu `/san-xuat`**, nav lọc theo vai                   |
| `/to`                                       | **giữ nguyên** — đây là bề mặt xưởng, đúng chỗ               |

**Lợi:** người kiêm nhiệm (thống kê ôm nhiều tổ, quản đốc kiêm kế hoạch) hết
phải nhảy khu; một thanh nav duy nhất; badge đếm việc gom về một chỗ.
**Hại:** phải sửa `workspaces.config.ts` + 19 route + `MOVED_PREFIXES`; và nếu
xưởng thật sự muốn mỗi vai một cửa hẹp thì gộp lại là bước lùi.

**Nếu chủ dự án giữ bốn khu** thì phần còn lại của tài liệu vẫn dùng được nguyên
— chỉ khác chỗ mục nav nằm ở khu nào.

---

## 5. Bản đồ màn — chính và phụ

Chín màn. Mỗi màn trả lời **một** câu hỏi (nguyên tắc 1 của `/design-lab`).

### Màn CHÍNH (5)

| #   | Màn                    | Khuôn | Câu hỏi nghiệp vụ                              | Vai               |
| --- | ---------------------- | ----- | ---------------------------------------------- | ----------------- |
| M1  | **Tình hình xưởng**    | A     | Hôm nay lệnh nào kẹt, ai phải gỡ?              | quản đốc, GĐ      |
| M2  | **Lệnh sản xuất**      | C     | Trong các lệnh đang chạy, cái nào cần tôi động? | kế hoạch, quản đốc |
| M3  | **Chi tiết lệnh**      | D     | Lệnh này tới đâu, vướng gì, ai giữ?            | mọi vai           |
| M4  | **Ghi sản lượng**      | F     | Hôm nay tổ làm được bao nhiêu?                 | thống kê          |
| M5  | **Việc của tổ**        | A     | Tổ tôi đang nợ việc gì?                        | tổ trưởng (xưởng) |

### Màn PHỤ (4)

| #   | Màn                        | Khuôn | Câu hỏi                                     | Vào từ đâu           |
| --- | -------------------------- | ----- | ------------------------------------------- | -------------------- |
| P1  | **Sổ ngày & chốt sổ**      | C     | Hôm nay đã ghi gì, tổ nào chưa chốt?        | M4, M1               |
| P2  | **Định hình chi tiết**     | F     | Lệnh này gồm những chi tiết nào?            | M3 (tab), M2         |
| P3  | **Kế hoạch & giao tổ**     | D     | Ai làm công đoạn nào, hạn bao giờ?          | M3 (tab)             |
| P4  | **Báo cáo**                | C     | Kỳ vừa rồi sản lượng/phế/năng suất ra sao?  | M1                   |

### Khay và hộp thoại (không phải màn)

Dùng `Sheet` của kit, trượt từ phải, KHÔNG rời trang:

- Khay **chi tiết một dòng việc** (từ M2/M5) — xem nhanh rồi đóng.
- Khay **ghi nhanh một công đoạn** (từ M5) — tổ trưởng báo số ngay tại chỗ.
- Khay **lý do** — mở lại lệnh, đóng lệnh ép qua gate, mở khoá sổ ngày.
- Hộp **xác nhận** khi ghi vượt số còn lại (đã có, giữ).

---

## 6. Luồng UI theo vai

Mỗi luồng là một chuỗi bấm thật, không phải sơ đồ khối.

### 6.1 Thống kê — luồng chạy nhiều nhất trong ngày

```
M4 Ghi sản lượng
 ├─ chọn LỆNH (ô chọn nhớ lệnh lần trước)
 ├─ chọn CÔNG ĐOẠN (dải tab, kèm số việc còn)
 ├─ chọn TỔ (tự gợi theo công đoạn, ★; tổ đã chốt sổ hiện 🔒 + chặn)
 ├─ gõ số vào lưới — Enter/mũi tên đi ô, Ctrl+D chép ô trên
 │   · ô SL vượt "Còn" → viền vàng NGAY khi gõ (mềm, không chặn)
 │   · thiếu lý do phế → khoá nút Ghi
 ├─ thanh đáy CommitBar: "Sắp ghi N dòng · Σ đạt X · phế Y"
 └─ Ghi sổ chính thức → phiếu PBS-… → toast + link mở phiếu
        └─ cuối ngày: P1 Sổ ngày → Chốt sổ theo tổ
```

**Ba chỗ hay hỏng, phải thiết kế trước:**

- Gõ nhầm sau khi chốt sổ → phải mở khoá được **tại chỗ** (hiện phải gọi Giám
  đốc — xem lỗ hổng C).
- Ghi hồi tố ngày cũ là hợp lệ; ngày tương lai thì không. Header lưới phải đổi
  nền khi ngày ≠ hôm nay.
- Mất mạng giữa chừng → buffer localStorage, khôi phục có toast.

### 6.2 Tổ trưởng — bề mặt xưởng, một việc mỗi lần

```
M5 Việc của tổ  (mở ra là thấy NGAY việc của tổ mình, không phải chọn gì)
 ├─ WorkTiles: Trễ hạn · Hôm nay · Sắp tới   (ô đếm bấm được)
 ├─ danh sách việc: SP · công đoạn · cần/đạt/còn · thanh %
 └─ bấm một việc → KHAY ghi nhanh: [SL đạt] [Phế] [Lý do] → Ghi
```

Đây là bản HG của Odoo Shop Floor / Dynamics Production floor execution: nút to,
ba ô, không có bộ lọc nào. **Chỉ mở nếu Q2 trả lời "tổ trưởng có đăng nhập".**

### 6.3 Quản đốc — vào việc theo ngoại lệ

```
M1 Tình hình xưởng
 ├─ WorkTiles (ô nào cũng bấm ra danh sách ĐÃ LỌC, không ra bảng trống):
 │   Lệnh trễ hạn xuất · Lệnh chưa định hình · Thiếu vật tư ·
 │   Tổ chưa chốt sổ hôm qua · Công đoạn nghẽn · Lệnh nằm im ≥3 ngày
 ├─ Nhịp hôm nay: Σ đạt · Σ phế · số tổ đã chốt sổ
 ├─ Bảng LỆNH (khuôn C) — mỗi dòng một lệnh:
 │   mã · khách · hạn xuất(+trễ) · dải 12 ô công đoạn · %bộ xong ·
 │   dự kiến xong · "đang kẹt ở đâu · việc phải làm"
 └─ bấm lệnh → M3
```

**Dải 12 ô công đoạn** là thứ đáng chép nhất cho màn này: thứ tự cố định, ô sọc
= không nằm trong lộ trình, viền `--stop` = nghẽn. Đọc được theo CỘT, tức so
được giữa các lệnh — điều mà bảng số không làm được.

### 6.4 Kế hoạch — từ lệnh mới tới giao tổ

```
M2 Lệnh sản xuất (lọc: chưa định hình / chưa lên kế hoạch / đang chạy)
 └─ M3 Chi tiết lệnh
     ├─ tab Chi tiết   → P2 Định hình (nạp từ BOM, sửa lưới)
     ├─ tab Kế hoạch   → P3 giao tổ + hạn cho cả lệnh, rồi tinh chỉnh từng dòng
     ├─ tab Vật tư     → thiếu gì, đơn mua nào đang về  ← cổng "đủ vật tư chưa"
     └─ tab Tiến độ    → bảng công đoạn × SP
```

### 6.5 Giám đốc

Không có màn riêng. `/exec/production` đọc lại M1 ở chế độ chỉ-xem, cộng ô "lệnh
sắp trễ hạn giao".

---

## 7. Bố cục từng màn chính

### M3 — Chi tiết lệnh (khuôn D, màn khó nhất)

Đây là màn duy nhất mọi vai đều mở, nên nó gánh nhiều nhất.

```
┌─ DocHead ──────────────────────────────────────────────────────┐
│ LSX-06/26-27 - MX        [Ghi sản lượng] [Định hình] [⋯]       │
│ MERXX HANDELS GMBH · ĐH 18023 HG-MX · hạn xuất 29/11 (còn 72đ) │
├─ StatusTrack ──────────────────────────────────────────────────┤
│ nháp ─ chờ duyệt ─ ●đã duyệt ─ đang SX ─ hoàn thành            │
├─ HolderBar ────────────────────────────────────────────────────┤
│ Đang chờ: Kế hoạch giao tổ · đã 6 ngày                         │
├─ MetricStrip ──────────────────────────────────────────────────┤
│ 0/1.700 bộ xong │ 8 SP │ 72/72 việc còn │ 0 phế │ 106 mã thiếu │
├─ FastTab ──────────────────────────────────────────────────────┤
│ [Tiến độ] [Chi tiết] [Kế hoạch] [Vật tư] [Phiếu] [Dòng thời gian] │
│                                                                 │
│  bảng công đoạn × SP, sticky header + sticky chân tổng         │
├─ NoteStream ───────────────────────────────────────────────────┤
│ trao đổi trên lệnh + người theo dõi                            │
└─────────────────────────────────────────────────────────────────┘
```

Luật kiểm bắt buộc cho màn này:

- `HolderBar` phải nói **ai đang giữ và đã bao lâu** — không có thì "đã duyệt"
  vẫn là trạng thái chết (lỗ hổng D).
- Nút bị khoá phải nói **vướng gì và cách gỡ, ngay tại chỗ** — không cho bấm rồi
  mới báo lỗi. Ví dụ: "Đóng lệnh — còn 72 việc chưa xong. Xem việc còn lại."
- Bảng dài: dùng `ScreenFrame`, không đặt `min-h-screen` ở cha (nếu không thì cả
  sticky header lẫn sticky chân đều vô hiệu).

### M2 — Lệnh sản xuất (khuôn C)

- `FilterBar` chip: Đang chạy · Trễ hạn · Chưa định hình · Chưa lên KH · Thiếu VT.
  Mỗi chip **đếm bằng đúng hàm mà trang đích dùng** (nguyên tắc 3).
- Cột: mã lệnh (`DocChip`) · khách · hạn xuất · SL bộ · %xong · công đoạn đang
  đứng · người giữ · thiếu VT.
- Gom theo: khách / hạn xuất tháng / trạng thái (chép group-by của Odoo).
- Bấm dòng → khay xem nhanh; bấm mã → M3.
- Hành động hàng loạt ở `ActionPane` góc trên phải (chép Action Pane Dynamics).

### M4 — Ghi sản lượng (khuôn F)

Lưới là nhân vật chính. Đầu đơn co thành `HeadChips` (lệnh · ngày · tổ), vì mỗi
hàng đầu trang là một hàng lưới bị lấy mất.

- Cột mặc định: Chi tiết · Cần · Đã đạt · **SL đạt** · **Phế** · **Lý do phế**.
  Kg / Người làm / Ghi chú ẩn sau nút "Cột chi tiết" (nhớ theo máy).
- Đóng băng cột tên chi tiết + hàng tiêu đề. Cuộn ngang mất tên = gõ sai dòng.
- `CommitBar` đáy: tổng sắp ghi + lý do chưa ghi được, **bấm được**.
- Ô số KHÔNG dùng `type=number` (lăn chuột đổi giá trị ngầm) — hiện màn cũ vẫn
  đang dùng, cần sửa.

### M1 — Tình hình xưởng (khuôn A)

Đã có bản dựng thử: artifact "Tình hình xưởng" (13/09). Bố cục ô việc → nhịp hôm
nay → bảng lệnh có dải công đoạn → tổ hôm nay → cần quyết.

---

## 8. Bản đồ màn cũ → mới (kiểm không sót)

| Màn cũ                     | Đi đâu                                  |
| -------------------------- | --------------------------------------- |
| `/production` Toàn cảnh    | → **M1**, dựng lại bằng kit             |
| `/production/lsx/[id]`     | → **M3**                                |
| `/production/plan`         | → M3 tab Kế hoạch                       |
| `/production/team`         | → M1 khối "Tổ hôm nay"                  |
| `/to` Việc của tổ          | → **M5** (giữ bề mặt riêng)             |
| `/to/lenh`, `/to/lsx/[id]` | → M5 + M3 chỉ-xem                       |
| `/to/qua-trinh`            | → M3 tab Dòng thời gian                 |
| `/thongke/ghi`             | → **M4** (đã chạy được, chuyển kit sau) |
| `/thongke/lenh`            | → **M2**                                |
| `/thongke/ngay`            | → **P1**                                |
| `/thongke/lsx/[id]`        | → M3                                    |
| `…/dinh-hinh`              | → **P2**                                |
| `/kehoach-sx`              | → M2 (lọc "chưa lên KH")                |
| `/kehoach-sx/[id]`         | → **P3** = M3 tab Kế hoạch              |
| `/kehoach-sx/tuan`         | → M1 (bộ chọn tuần)                     |
| `/kehoach-sx/tien-do`      | → M2 (chế độ xem vạch thời gian)        |
| `/kehoach-sx/chi-tieu`     | → **giữ nguyên** màn riêng, ít dùng     |
| `/kehoach-sx/theo-to`      | → M1 khối "Tổ hôm nay"                  |
| `/kehoach-sx/lenh`         | → M2 (trùng, **bỏ**)                    |
| `/exec/production`         | → M1 chỉ-xem                            |

**11 mục nav → 6**: Tình hình xưởng · Lệnh sản xuất · Ghi sản lượng · Sổ ngày ·
Chỉ tiêu ngày · Báo cáo. (Việc của tổ nằm ở bề mặt xưởng.)

---

## 9. Thứ tự làm — TRẠNG THÁI 18/09/2026

Xếp theo luật của [`ke-hoach-thuc-hien.md`](ke-hoach-thuc-hien.md): việc không
cần chủ dự án quyết làm trước; đừng dựng màn cho luồng chưa chạy thật.

| Đợt | Việc                                                        | Trạng thái |
| --- | ----------------------------------------------------------- | ---------- |
| 1   | Vá nền: `stage_code` tổ, quyền mở khoá sổ ngày, vai quản đốc | ❌ **CHƯA LÀM** |
| 2   | **M4 Ghi sản lượng** — kit + bỏ `type=number` + dán Excel     | ✅ xong    |
| 3   | **M2 Lệnh sản xuất** — gộp các màn hỏi trùng câu             | ✅ xong    |
| 4   | **M3 Chi tiết lệnh** — khuôn D + HolderBar + chatter          | ✅ xong    |
| 5   | **M1 Tình hình xưởng** — ô việc dẫn sang danh sách đã lọc    | ✅ xong    |
| 6   | **M5 Việc của tổ** — chỉ đọc (Q2)                            | ✅ xong    |
| 7   | Gộp khu (§4)                                                 | ✅ xong    |

**ĐỢT 1 LÀ ĐỢT DUY NHẤT CÒN NỢ, và nó vốn phải đi ĐẦU.** Nó bị nhảy cóc vì các
đợt sau không cần ai quyết, còn đợt 1 thì vướng Q6. Q6 đã chốt 18/09 (bỏ mài và
mộc) nhưng ba việc vá nền thì chưa ai làm. Đo 18/09/2026:

| Việc còn nợ                          | Số đo hôm nay                                      |
| ------------------------------------ | -------------------------------------------------- |
| `stage_code` cho tổ                  | 4/9 tổ TRỐNG: Xưởng SX · Cắt Vải · Cơ Điện · **Sơn Nhôm** |
| Quyền mở khoá sổ ngày                | vẫn chỉ `director` + `admin` — thống kê chốt nhầm phải gọi GĐ |
| Vai quản đốc                         | chưa có; `production.progress.track` vẫn chỉ `director` + `admin` |
| Lệnh chưa định hình                  | 6/14 lệnh đang chạy                                 |
| Lệnh quá hạn xuất mà vẫn mở          | 5                                                   |
| Quyền mồ côi sau khi gỡ xác nhận     | `production.jobs.confirm` còn grant cho `production_leader` |

**Và số quan trọng nhất vẫn là 0.** `production_entries` = 0, `production_entry_docs`
= 0, `production_day_locks` = 0. Năm màn đã dựng xong đều đang đọc từ một cái sổ
chưa ai ghi dòng nào. Giao diện hết việc; thứ còn thiếu là một vòng chạy thật.

**Đợt 2 đi trước đợt 5 có chủ đích.** M1 và M2 chỉ đẹp khi có số; số chỉ có khi
M4 chạy thật. Dựng màn quản đốc trước là dựng một màn rỗng lần nữa.

---

## 10. Câu phải chốt

1. **Gộp ba khu thành một `/san-xuat`, hay giữ bốn khu?** (§4 — mâu thuẫn với
   quyết định 07/2026, phải chủ dự án quyết.)
2. **Q1 — ai ghi sổ?** Một thống kê mỗi tổ (7 tài khoản đang có) hay hai người
   ôm nhiều tổ. Quyết định M4 mở ra là "tổ của tôi" hay "chọn tổ trước".
3. **Q2 — tổ trưởng có đăng nhập không?** Quyết định M5 có tồn tại không.
4. **Q3 — giao hàng giữa tổ có đếm không?** Có thì cần thêm một màn; không thì
   tắt `production_transfers` khỏi giao diện.
5. **Q6 — mài và mộc do tổ nào làm?** Đang chặn cứng: hai tab đó mở ra mà không
   chọn được tổ, mà chưa chọn tổ thì không ghi được.
6. **Chatter trên lệnh** — làm hay không? Kit đã có sẵn thành phần; đây là
   khoảng cách lớn nhất với Odoo.

---

## 11. Còn thiếu gì để dùng THẬT — đo 18/09/2026

Giao diện đã xong cả bảy đợt. Phần này đo xem một ngày làm việc thật vấp ở đâu.
Mọi số lấy trực tiếp từ CSDL production.

### 11.1 Nút thắt LỚN NHẤT không nằm ở phần mềm: 77% dòng SP chưa có định mức

| Số đo trên 14 lệnh đang chạy          | Giá trị              |
| ------------------------------------- | -------------------- |
| Dòng SP                               | 206 (125 mã SP)      |
| **Dòng KHÔNG có định mức ở hồ sơ SP** | **158 (77%)**        |
| Mã SP thiếu định mức                  | **79**               |
| **Số BỘ bị kẹt vì thiếu định mức**    | **22.484 / 52.282 (43%)** |
| Dòng ĐÃ có định mức mà chưa định hình | 9                    |

Đối chiếu cột "đã định hình" với cột "có định mức" thì thấy chúng **trùng khít
gần như từng lệnh một**. Nghĩa là định hình không bị kẹt vì ai lười bấm — nó bị
kẹt vì **hồ sơ SP bên Kỹ thuật chưa có định mức**.

Chuỗi phụ thuộc là một chiều và không có đường vòng:

```
Hồ sơ SP có định mức  →  Định hình chi tiết  →  Ghi sổ sản lượng  →  Mọi màn có số
```

Không có mắt xích đầu thì bốn màn vừa dựng vĩnh viễn trống, bất kể giao diện đẹp
đến đâu.

**Việc phải làm, xếp theo độ rẻ:**

1. **9 dòng đã có định mức mà chưa định hình** — bấm "Định hình từ BOM" là xong.
   Rẻ nhất, làm ngay.
2. **5 mã SP đã có file BOM đính kèm** — chạy "Đọc file BOM bằng AI" là ra định
   mức nháp, Kỹ thuật soi rồi lưu.
3. **74 mã SP chưa có cả file BOM trong hệ thống.** Đây là khối chính. File BOM
   thật nằm trên Drive (đợt rà 08/09 quét 415 file), chỉ chưa ai gắn vào hồ sơ
   SP. Cần một đợt nạp file + chạy AI, không phải gõ tay 74 bộ định mức.

### 11.2 Ba năng lực có SERVICE và API nhưng KHÔNG có màn

Chúng bị xoá cùng khu Thống kê cũ ngày 26/08 và chưa dựng lại:

| Năng lực           | Backend | Giao diện | Hậu quả khi chạy thật                                    |
| ------------------ | ------- | --------- | -------------------------------------------------------- |
| **Gia công ngoài** | ✅ đủ   | ❌ không  | Hàng gửi NCC làm không nhập được → sản lượng công đoạn HỤT so với thực tế, người dùng mất tin vào số |
| **Báo cáo kỳ**     | ✅ đủ (có cả xuất Excel) | ❌ không | Thống kê vẫn phải làm báo cáo tháng bằng Excel tay        |
| **Giao tổ (WIP)**  | ✅ đủ   | ❌ không  | Không đối chiếu được "giao cho tổ bao nhiêu / tổ làm bao nhiêu" — cột có thật trong sổ Excel của xưởng |

Gia công ngoài là cái **cấp nhất**: `entriesService.summary` đã cộng phần NCC
nhận về vào sản lượng công đoạn, nên thiếu màn nhập không chỉ là thiếu tính năng
— nó làm con số của cả công đoạn sai về phía thiếu.

Giao tổ thì còn chờ câu Q3 (xưởng có đếm hàng lúc giao giữa tổ không). Chưa
chốt thì đừng dựng.

### 11.3 Việc dọn dữ liệu, không phải việc lập trình

- **5 lệnh quá hạn xuất vẫn đang mở** (01→05/26-27 MX, hạn 07–13/09). Hoặc chúng
  đã xong ngoài đời và cần đóng, hoặc chúng thật sự trễ và cần đổi hạn. Để
  nguyên thì mọi ô "trễ hạn" trên trang chủ đếm nhầm mãi.
- **14/14 lệnh đang nằm im ≥3 ngày**, nhiều lệnh Cung ứng giữ 43 ngày. Con số
  này đúng, và nó nói rằng chuỗi vật tư mới là chỗ tắc thật.

### 11.4 Hai câu nghiệp vụ còn treo

- **Q1 — ai ghi sổ?** Hiện có 7 tài khoản "Thống kê Tổ X". Màn ghi sổ có ô chọn
  tổ nên CẢ HAI mô hình đều chạy được — câu này KHÔNG chặn, chỉ ảnh hưởng việc
  có nên khoá ô chọn tổ lại hay không.
- **Q3 — giao giữa tổ có đếm không?** Chặn việc dựng màn giao tổ.

### 11.5 Kết luận

Phần mềm **đủ để chạy thử ngay hôm nay** với những lệnh đã định hình (39 dòng SP
trên 8 lệnh). Thứ chặn mở rộng ra cả xưởng là **định mức**, không phải mã nguồn.

Thứ tự đề nghị:

1. Chạy thử 1 lệnh đã định hình trong 3 ngày → tìm lỗi thật của luồng.
2. Nạp BOM cho 79 mã SP còn thiếu (đợt dữ liệu, dùng AI đọc file).
3. Dựng màn **Gia công ngoài** — sau khi (1) cho thấy xưởng có gửi ngoài thật.
4. Dựng màn **Báo cáo kỳ** khi đã có vài tuần số liệu để in.

---

## 12. Dữ liệu THỬ trên UI (18/09/2026) — và cách xoá

Dựng để bấm thử giao diện khi sổ còn trắng. **Đây KHÔNG phải số thật của xưởng.**

Nằm trên lệnh `06/26-27 - MX` (hạn xuất 29/11 còn xa nên sai sót không ảnh hưởng
giao hàng), công đoạn **Phôi**, tổ **Tổ Phôi**. Ba phiếu, số hiệu mang dấu
`PBS-THU-` nên không thể lẫn với phiếu thật, và **không tiêu số của bộ đếm PBS**.

| Phiếu          | Ngày      | Nội dung                                                  |
| -------------- | --------- | --------------------------------------------------------- |
| `PBS-THU-0001` | hôm kia   | SP CH0022HG-AL, 10 chi tiết, ~60% tổng cần — **đã chốt sổ** |
| `PBS-THU-0002` | hôm qua   | phần còn lại; 2 chi tiết CỐ Ý còn thiếu; 6 phế có lý do   |
| `PBS-THU-0003` | hôm nay   | SP CH0238HG-IR, 6 chi tiết, ~25%; 2 phế — **chưa chốt sổ** |

Bày ra được đủ các trạng thái đáng xem: công đoạn đang làm dở (80%), dòng còn
thiếu, phế kèm lý do, một ngày đã chốt (thử mở khoá) và một ngày chưa chốt (thử
chốt), phiếu in có chữ ký.

**XOÁ SẠCH** — một câu, theo đúng dấu `PBS-THU-`:

```sql
delete from public.production_entries
where doc_id in (select id from public.production_entry_docs where doc_no like 'PBS-THU-%');

delete from public.production_entry_docs where doc_no like 'PBS-THU-%';

delete from public.production_day_locks
where team_department_id = (select id from public.departments where name = 'Tổ Phôi')
  and entry_date >= current_date - 2;
```

Xoá dòng sổ TRƯỚC rồi mới xoá phiếu: `production_entries.doc_id` trỏ vào phiếu.
