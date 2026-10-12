# Kho — hoàn thiện đợt 2 để nhận lại việc từ Cung ứng (12/10/2026)

Đọc sau [`kho-hoan-thien.md`](kho-hoan-thien.md) (đợt 1, 16/09).

**Mục tiêu chủ dự án chốt 12/10:** từ 01/10 Cung ứng đang ghi phiếu thay Kho (gán
tạm vai `warehouse_staff`). Muốn chuyển dần việc về cho Kho, nhưng **khu Kho phải
đủ tính năng trước** — không bắt thủ kho dùng một khu kém hơn thứ Cung ứng đang có.

Nguyên tắc phân vai sau chuyển giao:

| Việc | Ai |
| --- | --- |
| Đặt hàng, NCC xác nhận, hẹn/dời đợt giao, chốt thiếu, đòi bù | **Cung ứng** (việc với NCC) |
| Nhận hàng, cân, kiểm, ghi phiếu nhập, ghi sự cố lúc nhận | **Kho** |
| Ghi xuất khi tổ lấy, hoàn kho, kiểm kê, báo cáo tồn | **Kho** |
| Xem hàng đã về / phiếu nhập / tồn để quyết mua | Cung ứng **chỉ xem** |

---

## Số đo 12/10/2026 (DB thật)

| Phép đo | Số |
| --- | ---: |
| Tài khoản Kho | **2** — Lê Khắc Hào (Thủ kho, wh1), Hà Nguyễn Nữ (Kho NVL, wh2) — **chưa đăng nhập lần nào** |
| Cung ứng gán tạm vai Kho | 4 — Nga, Đình Huy, Truyền, Anh Thi |
| Phiếu nhập từ 16/09 | 72, ~5/ngày — Nga 50, Truyền 17, Kho 1 |
| Phiếu xuất từ 16/09 | 28, chỉ 01–02/10; **từ 03/10: 0** |
| Lệnh đã nhận hàng / đã có xuất | **15 / 2** — 13 lệnh nhận mà chưa xuất mã nào, 3 trong số đó đã `completed` |
| Mã tồn âm | **4** (NH-0199 −3.467 cây · ACQ0001 · 0002 · 0005) — dòng KK-2026-0004 mồ côi sau khi xoá phiếu nạp nền |
| Đợt kiểm kê treo | KK-2026-0005 `counting` từ 15/09, 254 dòng |
| Báo cáo Nhập–Xuất–Tồn theo kỳ | không có |
| Màn kiểm kê trong khu Kho | không có (service + bảng 0157/0199/0200 còn nguyên) |

**Đọc số:** xuất đứng không phải vì thiếu người bấm — Cung ứng **không đứng ở kho**
nên không thấy tổ lấy hàng. Xuất là việc chỉ Kho làm được, nên chuyển giao cũng là
cách duy nhất để sổ xuất sống lại. Hiện tồn trên máy là **tồn ảo** (hàng đã vào sản
phẩm vẫn nằm trong kho).

---

## Đối chiếu: Cung ứng đang có gì mà khu Kho chưa có

Bên Cung ứng được làm liền 01/10–05/10 khi dùng thật; khu Kho dựng 16/09 rồi đứng.

| Việc | Bên Cung ứng (đang dùng) | Khu Kho | Khoảng trống |
| --- | --- | --- | --- |
| Danh sách hàng sắp về | **Theo dõi đơn hàng**: Quá hẹn · Hôm nay · 7 ngày · Chưa hẹn, lọc người / lệnh / mẫu đơn / ngoài lệnh, gom, badge menu | **Hàng về** (16/09): 4 làn + ô tìm | lọc theo lệnh & ngày về, badge, gom theo **chuyến hàng** (một xe nhiều đơn) |
| Form phiếu nhập | `PhieuNhapScreen` | **dùng chung** | ✅ ngang nhau (kg cân, lùi ngày, số phiếu NCC, nhắc) |
| Hàng đã về | **Đã về**: rổ *Cần xử lý* (còn thiếu, chưa ghi số NCC, thiếu kg cân), Phiếu tôi lập, mọi ngày | Sổ phiếu (lọc mã lý do) | rổ **Cần xử lý**, lọc người lập |
| Chi tiết phiếu nhập | Sửa phiếu **3 kiểu** (bổ sung thông tin · sửa số lượng · chênh lệch), **Ghi kg cân bổ sung**, lịch sử phiếu | chỉ **Đảo phiếu** + In | Sửa phiếu, Ghi kg, lịch sử |
| Sự cố lúc nhận (lỗi, sai quy cách, thiếu) | "Ghi sự cố giao hàng" trong hộp Giao nhận | không có | người phát hiện là người nhận → Kho phải ghi được, Cung ứng xử lý |
| Kho được báo khi hàng sắp về | — | không có | NCC xác nhận / ghi chuyến hàng → báo Kho |
| Xuất cho lệnh | — | form có, nhưng **tìm tay từng mã** | "điền từ hàng đã về cho lệnh" |
| Tồn theo lệnh · Báo cáo kỳ · Kiểm kê | — | không có | dựng mới |

Phần với NCC (NCC xác nhận, hẹn giao bù, chốt thiếu, dời/tách/huỷ đợt, nghiệm thu
ngoài sổ) **ở lại Cung ứng** — không chép sang Kho.

---

## Giai đoạn 1 — Khu Kho đủ tính năng

Mỗi bước dừng nghiệm thu. Tái dùng khối có sẵn của Cung ứng (dời vào chỗ dùng
chung), không viết bản thứ hai.

**B0 · Dọn sổ** (dữ liệu, cần Q1–Q2): phiếu điều chỉnh bù 4 mã âm về 0; huỷ
KK-2026-0005. Nghiệm thu: 0 mã âm, 0 đợt kiểm kê mở.

**B1 · Hàng về của Kho ngang Theo dõi đơn hàng.** Lọc lệnh / ngày về / NCC, gom
theo chuyến hàng, badge "quá hẹn + hôm nay" trên menu Kho — đếm bằng đúng hàm của
Theo dõi (`incomingBucket`) để hai phòng thấy cùng một số. Chỉ có nút **Nhận hàng**,
không có nút việc với NCC.

> **B1 DỰNG XONG 12/10/2026** (bản vẽ https://claude.ai/artifact/AVjPo69BkZc9N9NNydvWER,
> duyệt theo đề xuất Q1–Q6; màn Theo dõi bên Cung ứng GIỮ NGUYÊN theo lệnh chủ dự án).
> Một dòng = một đơn, nguồn `loadWatchPos` + `incomingBucket` (29 đơn: quá hẹn 9 · hôm nay 1 ·
> 7 ngày 8 · sau 11 — khớp Theo dõi); badge menu Kho = 10 (`nav-badges.warehouseBadges`);
> cột Đợt từ `hangVeRepo` + `dotKeTiep` (PO-0100 "đợt 1 đã nhập trước · Đợt 2/2 · 22/10");
> Nhận hàng mở `?dot=` đợt kế tiếp; mã đơn mở hộp `?don=` chỉ xem (`tai-hang-cua-don.ts`
> + `hang-cua-don.tsx`). Bỏ nhãn "cân kg" của bản vẽ: từ 02/10 kg cân không bắt buộc và
> xét theo từng dòng (`lib/can-kg`), nhãn theo mẫu đơn sẽ báo sai.

> **B0 XONG 12/10** — 4 mã âm: mỗi mã chỉ còn 1 dòng KK-2026-0004 mồ côi (phiếu vào đã bị
> xoá cứng) → xoá 4 dòng đó, tồn 0. Kèm: 44 phiếu đứng tên admin@hg.com chuyển về người phụ
> trách đơn (chủ dự án: "đơn thật chuyển về đúng người"), xoá 2 phiếu E2E test PNK/PXK-2026-0001
> (+ trừ 45 ở dòng KK-0004 của VT-NK-001 để khỏi âm). Backup ở `backups/kho-*-2026-10-12.json`.
> KK-2026-0005 (treo counting từ 15/09) CHƯA xử lý.
>
> **B2 + luật màn hẹp XONG 12/10** (bản vẽ https://claude.ai/artifact/Me6k3W7JPPX3AHMyPzQ2Wt):
> 2a chi tiết phiếu `6e48e17` · 2b Sổ phiếu `3bd8683` · 2c Hàng về + form nhận `6c4d35a`.
> Luật: đo KHUNG bằng `lib/use-be-rong` (không đo cửa sổ — sidebar mở/thu đổi 212px), ẩn cột
> bậc thấp thay vì cuộn ngang, một vùng cuộn mỗi màn. Nghiệm thu 1536×730 / 1280×800 / 1024×700
> sidebar mở: 4 màn Kho 0 cuộn ngang, đúng 1 vùng cuộn. B3 (ghi sự cố lúc nhận) là bước kế.

**B2 · Phiếu đã nhập: sửa được tại Kho.** Chi tiết phiếu `/warehouse/phieu/[id]`
thêm Sửa phiếu 3 kiểu + Ghi kg cân bổ sung + lịch sử (dùng lại `sua-phieu.tsx`,
`kg-can-sheet.tsx`, `lib/phieu-nhap-lich-su.ts`). Sổ phiếu thêm rổ **Cần xử lý**
và lọc "Tôi lập". Hiện có 3 phiếu thiếu kg cân (PNK-0054/0057/0058) — Kho xử được
ngay ở khu mình.

**B3 · Ghi sự cố lúc nhận.** Trên form nhận hàng / chi tiết phiếu: nút "Ghi sự
cố" dùng chung đường ghi `GhiSuCoSheet` hiện có → hiện ở hộp Giao nhận của Cung
ứng để họ xử lý với NCC.

> **B3 (bản gọn) XONG 12/10** `f05d848` (bản vẽ https://claude.ai/artifact/WLinMQm3FQ1T7NVufZQHjS):
> ⋯ trên dòng Hàng về + hộp Báo sự cố RIÊNG của Kho (nhận / từ chối nhận cả lô → "[Từ chối nhận]"
> đầu mô tả), nhãn "N sự cố", mục Sự cố trong hộp Hàng của đơn; server phát `po.issue_recorded` →
> thông báo `po_issue` cho người phụ trách đơn. **Migration 0231 CHƯA ÁP** — áp xong mới có thông
> báo (trước đó sự cố vẫn ghi vào sổ). Đo trước khi dựng: sổ sự cố 0 dòng, nên chỉ làm bản gọn.

**B4 · Xuất cho lệnh: điền từ hàng đã về cho lệnh.** Chọn lệnh → khối "Hàng về cho
lệnh này còn trong kho" (nhận qua đơn của lệnh, cả đơn gộp lệnh − đã xuất cho
lệnh, ≤ tồn thực) → tích / Lấy tất cả → sửa số thực lấy → Ghi sổ. **Không dùng định
mức** (chốt 16/09). `XuatScreen.tsx` 805 dòng → khối là file riêng.

**B5 · Tồn theo lệnh.** Công tắc "Theo lệnh" ở Tồn kho: mỗi lệnh đã nhận · đã xuất
· còn trong kho; rổ **Lệnh xong còn hàng** với hai nút Xuất bổ sung / Về tồn chung (Q4).

**B6 · Báo cáo Nhập–Xuất–Tồn theo kỳ** `/warehouse/bao-cao`: tồn đầu (RPC 0200) ·
nhập theo N1/N2/N3/N4 · xuất theo X1/X3/X5/khác · tồn cuối · giá trị; lọc nhóm /
lệnh; Excel. Nghiệm thu: tổng kỳ 10/2026 khớp Sổ phiếu cùng kỳ.

**B7 · Kiểm kê định kỳ** `/warehouse/kiem-ke` trên service có sẵn: lập đợt theo
nhóm / toàn kho → đếm mù → gửi duyệt → áp chênh N4/X5 → in 05-VT.

**B8 · Bàn làm việc Kho + thông báo.** Trang đầu khu Kho: hàng về hôm nay · lệnh có
hàng chờ xuất · lệnh xong còn hàng · mã dưới mức · kiểm kê đang mở. Kho nhận thông
báo khi NCC xác nhận ngày giao / có chuyến hàng ghi về.

## Giai đoạn 2 — Chuyển giao

**C1 · Chạy song song (~2 tuần).** Mở tài khoản wh1/wh2 (đặt mật khẩu tạm, bắt đổi
khi vào lần đầu — đã có), hướng dẫn một buổi. Kho ghi phiếu; Cung ứng vẫn giữ quyền
để đỡ khi Kho vắng. Đo hằng tuần: % phiếu nhập/xuất do Kho lập, số phiếu phải sửa.

**C2 · Cắt.** Khi Kho lập ≥ 90% phiếu trong một tuần: gỡ vai `warehouse_staff` gán tay
của 4 NV Cung ứng (trang phân quyền, có nhật ký). Ở Theo dõi đơn hàng, nút "Nhận
hàng" đổi thành **xem phiếu** + trạng thái "Kho đã nhận / chưa". (Q7: có giữ quyền
dự phòng hẹp cho Cung ứng không.)

---

## Vẫn CHƯA làm — có lý do

| Việc | Vì sao |
| --- | --- |
| So định mức khi xuất | chốt 16/09; định mức chưa gắn mã VT đủ |
| Cất hàng vào kệ | 5/13.229 mã có kệ; ~5 phiếu/ngày |
| Trả hàng NCC (X3) | 0 lô hàng khoá |
| Lô / mã vạch / nhiều kho | backlog đã bỏ; 0 mã có mã vạch |

## Câu cần chủ dự án chốt

| # | Câu | Đề xuất |
| --- | --- | --- |
| Q1 | 4 mã tồn âm? | Phiếu điều chỉnh bù về 0, giữ dòng cũ |
| Q2 | KK-2026-0005? | Huỷ |
| Q4 | Hàng dư của lệnh đã xong? | Về tồn chung bằng thao tác có lý do, không tự động |
| Q5 | Kiểm kê định kỳ? | Cuối tháng luân phiên theo nhóm, cuối quý toàn kho |
| Q6 | Báo cáo kỳ có tiền? | Có, đơn giá nhập; ghi rõ 19 dòng chưa có giá |
| Q7 | Sau khi cắt, Cung ứng còn được ghi phiếu nhập dự phòng? | Có, quyền hẹp mới chỉ "nhập theo đơn mua" — không xuất, không kiểm kê |
| Q8 | Ai trong Kho duyệt kiểm kê (người đếm không tự duyệt)? | Thủ kho Hào duyệt, chị Nữ đếm |
