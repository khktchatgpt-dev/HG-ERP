# Luồng vận hành: Kế hoạch - Cung ứng ↔ Sản xuất

Cập nhật 07/2026 (sau SX-P1…P5). Mô tả **ai làm gì, ở màn nào, hệ thống tự làm
gì** trong chuỗi từ lúc có lệnh sản xuất đến lúc giao hàng. Tài khoản test:
`docs/test.md`. Kịch bản nghiệm thu: `docs/uat-checklist.md` mục 8b–8e.

## 0. Sơ đồ tổng

```
Sales tạo đơn ──► phát LSX ──► GĐ DUYỆT LSX ──► notify KH-CƯ + Kỹ thuật + Xưởng
                                    │
        ┌───────────────────────────┤
        ▼ (Kế hoạch)                ▼ (Cung ứng)
  Nhập BẢNG CHI TIẾT          Nhu cầu vật tư (kg + số cây,
  (grid giống Excel,          ưu tiên bảng chi tiết, fallback BOM)
  BOM chỉ tham khảo)                │
        │                     So giá NCC ─► tạo PO ─► GĐ DUYỆT PO ─► gửi NCC
        │                           │
        │                     Kho NHẬP theo PO (QC đạt/loại)
        │                     PO tự partial/received · ⚠ quá hẹn giao
        ▼                           ▼
  Xưởng thấy chi tiết   ◄──   Kho XUẤT theo LSX (chỉ lệnh đã duyệt/đang SX)
  phải làm                    Xưởng xác nhận ĐÃ NHẬN vật tư
        │
        ▼ (hằng ngày)
  Tổ báo SẢN LƯỢNG per công đoạn (SL/kg/phế/máy-màu)
  + GIA CÔNG NGOÀI giao ↔ nhận (TTP, Vinh…)
        │
        ▼ (hệ thống tự tính)
  Thiếu/(Dư) · %HT per công đoạn · %HT tổng · ĐỒNG BỘ bộ SP
  → Bảng tổng /production/board (thay sheet quan li) + xuất Excel/CSV
        │
        ▼
  Báo HOÀN THÀNH ─► đơn Completed ─► Sales xác nhận GIAO HÀNG
```

## 1. Vai trò & màn hình chính

| Vai | Workspace | Việc chính |
|---|---|---|
| Sales (Bán Hàng) | `/sales` | Đơn hàng, phát LSX, spec SX, xác nhận giao |
| GĐ / Ban quản lý | `/exec` | Duyệt LSX + PO tập trung (thấy tổng tiền, hồ sơ) |
| **Kế hoạch** (phòng KH-CƯ) | `/planning` | **Bảng chi tiết & định mức per LSX**, bảng điều phối tiến độ, bảng tổng |
| **Cung ứng** (phòng KH-CƯ) | `/planning` | NCC + bảng giá, PO đủ vòng đời, canh hàng về |
| Kho | `/warehouse` | PNK theo PO (QC), PXK theo LSX, tồn realtime |
| **Xưởng** (thống kê tổ) | `/production` | Card lệnh đang chạy, báo sản lượng ngày, nhận VT, gia công ngoài, hoàn thành |

Ghi chú phân quyền: phòng KH-CƯ hiện chung quyền Kế hoạch + Thu mua (tách vị
trí chờ OI-13). Xưởng = mọi phòng gán workspace `production` (Xưởng Sản Xuất,
Cắt Vải… — thêm tổ mới qua `/admin/departments`, không cần code). KH-CƯ vẫn
bấm thay xưởng được khi cần (quyền không thu hẹp).

## 2. Luồng chi tiết theo bước

### B1 — Phát & duyệt lệnh
1. Sales tạo đơn (từ báo giá hoặc trực tiếp) → **Phát LSX** ngay trên chi tiết
   đơn (1 đơn = 1 LSX; thiếu BOM vẫn phát được — BR-07, chỉ cảnh báo).
2. GĐ nhận notification → duyệt ở `/exec` (hoặc chi tiết LSX). **Từ chối kèm
   lý do → Sales sửa 4 trường header + "Gửi duyệt lại"** (không ngõ cụt).
3. Duyệt xong: đơn sang "Đã phát LSX"; **KH-CƯ + Kỹ thuật + Xưởng cùng nhận
   notification** — cả ba nhánh khởi động song song.

### B2 — Kế hoạch nhập bảng chi tiết (nền của mọi thứ phía sau)
1. Mở chi tiết LSX → khối **"Bảng chi tiết & định mức"** — grid giống Excel:
   Cụm · Chi tiết · Vật tư · Loại · quy cách Dày/Rộng/Dài · CT/SP · ĐM kg ·
   CT/cây. **Nhập tay là nguồn sự thật**; 2 nút gợi ý điền sẵn: *Chép từ lệnh
   trước* (nhanh nhất) / *Gợi ý từ BOM* (BOM có thể chưa có hoặc sai — chỉ là
   khung).
2. Hệ tự tính ngay khi gõ: **Tổng cần = CT/SP × SL đơn · Kg = tổng × ĐM ·
   Số cây = làm tròn lên(tổng ÷ hệ số)** — thiếu ĐM/hệ số hiện "—" kèm lý do,
   không bao giờ `#DIV/0!`.
3. Bảng là **snapshot của lệnh**: Kỹ thuật sửa BOM sau không đổi số lệnh đang
   chạy. Lệnh đã có sản lượng → bảng **khoá ghi đè** (tránh mất sổ).
4. Bảng điều phối `/planning/production` nhắc bằng badge **"Chưa nhập chi
   tiết"** cho lệnh đã duyệt còn trống.

### B3 — Cung ứng mua vật tư
1. Tạo PO từ LSX: khối nhu cầu **ưu tiên bảng chi tiết** (mỗi vật tư hiện
   "cần X (tồn Y) ≈ Z kg · N cây"), lệnh chưa nhập bảng thì fallback BOM×SL.
   Tồn kho chỉ để tham khảo — người mua tự quyết (không tự trừ).
2. Mỗi dòng so **giá chào hiện hành các NCC + giá mua gần nhất**, chọn NCC tự
   điền giá. PO vào vòng duyệt GĐ (BR-05) → gửi NCC (in đơn đặt, **email do NV
   tự gửi** — DN đã chốt không làm tính năng email).
3. Hàng về: Kho lập PNK theo PO (QC đạt/loại), PO **tự** chuyển Về một
   phần/Về đủ; Cung ứng nhận notification. Quá hẹn giao → badge **⚠ Trễ** +
   lọc + widget.

### B4 — Cấp vật tư cho xưởng
1. Kho xuất theo LSX (chỉ lệnh **đã duyệt/đang SX** — service chặn lệnh
   chờ duyệt/từ chối/huỷ), guard tồn không cho xuất âm.
2. Xưởng (hoặc KH-CƯ) bấm **"Đã nhận vật tư"** trên LSX — ghi log ai nhận, khi nào.

### B5 — Sản xuất & báo cáo hằng ngày (thay file Excel)
1. Thống kê tổ mở lệnh ở `/production` → khối **"Sản lượng theo công đoạn"**:
   chọn công đoạn (PHÔI/HÀN/NGUỘI/SƠN — danh mục sửa được) + ngày → điền SL
   (+ phế phẩm, kg, máy/màu) cho chi tiết nào thì ghi chi tiết đó. Tổ tự ghi
   theo phòng người nhập. **Nhập vượt tổng cần: cảnh báo, không chặn.**
2. **Gia công ngoài**: ghi từng đợt *Giao đi* / *Nhận về* (kèm hàng hỏng) per
   chi tiết × đơn vị (TTP, Vinh — nằm trong danh mục NCC); hệ đối chiếu
   giao/nhận/thiếu/%HT. Nhận > giao → cảnh báo.
3. Ghi nhầm → **xoá bản ghi rồi nhập lại** (chỉ người nhập/QL; lệnh kết thúc
   thì sổ khoá) — không sửa đè, giữ vết.
4. Hệ tự tổng hợp: đã làm, **Thiếu/(Dư)**, %HT per công đoạn; **%HT tổng**
   (theo công đoạn cuối); **đồng bộ bộ SP** = chi tiết chậm nhất quyết định.
5. **Bảng tổng `/production/board`** (thay sheet `quan li`): mọi chi tiết ×
   công đoạn của các lệnh đang chạy, lọc theo lệnh/trạng thái, **nút Xuất
   Excel (CSV)**. KH-CƯ và xưởng cùng xem một bảng.
6. Song song, KH-CƯ theo dõi ở **bảng điều phối** `/planning/production`
   (nguy cơ trễ ⚠ kèm lý do, vật tư/BOM, đổi giai đoạn + hoàn thành tại chỗ)
   và cập nhật **giai đoạn hiện tại** của lệnh (mức tóm tắt, in trên hồ sơ).

### B6 — Kết thúc & ngoại lệ
- Đủ hàng → **Báo hoàn thành** (xưởng/KH-CƯ/GĐ) → đơn Completed → Sales xác
  nhận **Đã giao** → đơn bất biến.
- **Sửa đơn sau khi phát LSX** (đổi SL/hạn giao): được, có vết; KH-CƯ + GĐ
  nhận notification "kiểm tra vật tư & tiến độ" (dòng SP bị thay → bảng chi
  tiết của dòng đó phải nhập lại).
- **Huỷ đơn giữa chừng**: dialog liệt kê hệ quả thật → LSX dừng, PO chưa gửi
  NCC tự huỷ, PO đã gửi NCC báo Cung ứng xử lý tay; vật tư đã xuất không tự
  hoàn kho (Kho lập phiếu nhập lại nếu thu hồi).

## 3. Nguyên tắc dữ liệu (để không tranh cãi lại)

1. **Bảng chi tiết nhập tay, snapshot per lệnh** — BOM chỉ gợi ý (user chốt 07/2026).
2. **Sổ sản lượng / gia công append-only** — xoá + nhập lại, không sửa đè.
3. **Mọi đại lượng dẫn xuất** (tổng cần, kg, số cây, thiếu/dư, %HT, đồng bộ)
   **tính ở server từ sổ gốc, không lưu cứng** — không lệch số, không `#DIV/0!`.
4. Duyệt là bất biến: LSX/PO đã duyệt không sửa nội dung — sửa = huỷ/tạo lại
   hoặc gửi duyệt lại, đều có vết.

## 4. Còn lại của SRS sản xuất chi tiết

- Import danh mục + định mức + tiến độ từ file Excel gốc (FR-MD-08/NFR-CP-01)
  và test đối chiếu số — **chờ DN gửi file** `Tổng TĐ SX- TK - KT.xlsx`.
- Báo cáo kỳ theo tổ/tuần/tháng (FR-RP-02/03) + chốt kỳ tháng (FR-SY-05).
- Ràng tổ ↔ công đoạn (tổ chỉ báo công đoạn của mình) — nếu DN cần (đề xuất OI-14).
- Đối chiếu công nợ gia công theo kỳ (FR-OS-03) — GĐ2 cùng phân hệ kế toán.
