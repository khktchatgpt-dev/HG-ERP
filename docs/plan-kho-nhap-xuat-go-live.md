# Phân tích & kế hoạch: Nhập/Xuất kho đủ nghiệp vụ để ĐƯA VÀO SỬ DỤNG

> Soạn 16/08/2026 theo câu hỏi của chủ dự án: "Kho có nên quản lý đơn đặt NCC
> không? Nhập/xuất kho hiện sơ sài, cần phân tích hoàn thiện để dùng thật."
> Trạng thái: **ĐÃ CHỐT 16/08/2026** — user trả lời 2 câu hỏi mục 4: ① phiếu đảo
> do NGƯỜI CÓ QUYỀN GHI SỔ lập thẳng (kèm lý do + notify quản lý); ② Kho ĐƯỢC
> thấy giá — K4 rút gọn: không làm màn không-giá, chỉ thêm link từ màn Nhập kho
> sang thẳng trang chi tiết đơn. Nối tiếp `quy-trinh-lsx-cung-ung-kho.md`.

## 1. Trả lời câu hỏi chủ quyền: Kho có nên QUẢN đơn đặt NCC không?

**KHÔNG — và đây là chủ đích, không phải thiếu sót.** Phân tách nhiệm vụ là
nguyên tắc chống nhầm lẫn + gian lận quan trọng nhất của chuỗi mua hàng:

- **Cung ứng QUẢN đơn** (giá, điều khoản, đàm phán, chốt thiếu, đòi giao bù) —
  người mua chịu trách nhiệm với NCC.
- **Kho QUẢN số thực nhận** (BR-08) — người nhận không được là người mua, và
  ngược lại người mua không tự ghi "đã nhận đủ" cho đẹp đơn.
- **Kho không nhìn thấy TIỀN** — kho chốt số lượng, kế toán chốt tiền. Cho Kho
  quản đơn là trộn hai vai và lộ giá mua cho cả phòng.

Nhưng "không quản" ≠ "không thấy". Cái Kho đang THIẾU là **tầm nhìn logistics
đầy đủ** về hàng sắp về: `/warehouse/nhap` mới liệt kê đợt + tên đơn, muốn biết
đơn gồm dòng nào / SL bao nhiêu / đã về bao nhiêu thì phải mở trang đơn bên khu
Cung ứng — trang đó **lộ đơn giá và tổng tiền**. Giải pháp là K4 bên dưới:
bung chi tiết logistics (dòng, SL đặt/đã về/còn chờ, đợt) NGAY TẠI màn Nhập
kho — không giá, không điều khoản.

## 2. Khoảng trống nhập/xuất khi dùng thật (rà code 16/08/2026)

### K1 — PHIẾU ĐẢO (huỷ phiếu sai) — chặn go-live, làm đầu tiên

Thực tế tuần đầu tiên chắc chắn có người gõ 1.000 thay vì 100. Hiện **không có
bất kỳ đường nào sửa/huỷ phiếu đã ghi** — sổ lệch chỉ còn cách chờ kiểm kê, mà
kiểm kê thì mất dấu "vì sao lệch". Chuẩn kế toán kho: KHÔNG sửa đè, KHÔNG xoá —
lập **phiếu đảo** (storno) ghi ngược toàn bộ movement của phiếu gốc, có vết.

Thiết kế:

- DB (`0161`): `warehouse_docs.reversal_of_doc_id uuid` (phiếu đảo trỏ phiếu
  gốc, on delete set null) + `reversed_by_doc_id` suy từ đó khi đọc (không lưu
  hai chiều). KHÔNG thêm kind mới — phiếu đảo của PNK là phiếu XUẤT và ngược
  lại, đúng bản chất sổ.
- Service `reverseDoc(user, docId, reason)`:
  - Chỉ phiếu `receipt`/`issue` đã `posted`; mỗi phiếu chỉ đảo MỘT lần; phiếu
    đảo không đảo tiếp (chống chuỗi vô hạn).
  - Sinh doc mới `reversal_of_doc_id = gốc`, reason bắt buộc, movements đảo
    chiều nguyên từng dòng (giữ po_line_id / production_order_id / qty_rejected
    đối xứng) → mọi view (tồn, supply_po_line_status, issuedByLsx) tự đúng
    không cần sửa.
  - Guard: đảo PNK mà tồn hiện tại không đủ (hàng đã xuất đi rồi) → 409 nói rõ
    "đã xuất X, muốn đảo phải thu hồi trước".
  - PNK theo PO: sau đảo gọi `refreshStatusFromReceipts` (đơn received quay
    partial — NCC coi như chưa giao phần đó); đợt 0153 nếu đã `received` quay
    `arrived`.
  - Notify quản lý Kho + (nếu theo PO) người phụ trách đơn.
- UI: chi tiết phiếu (DocDetail) thêm nút "Lập phiếu đảo" (canEdit) + badge
  "ĐÃ ĐẢO bởi PXK-…"/"Phiếu đảo của PNK-…" hai chiều; sổ chứng từ hiện quan hệ.

### K2 — HOÀN KHO TỪ SẢN XUẤT — chuyện xảy ra hằng tuần

Xuất 100 kg cho LSX, xưởng dùng 95, trả 5 về kho. Hiện không có đường ghi:
phiếu nhập chỉ có nguồn `po`/`external`, và `issuedByLsx` **chỉ cộng chiều
xuất** — có nhét movement nhập gắn LSX vào thì "đã cấp" vẫn không giảm, nhu cầu
còn lại của lệnh sai.

Thiết kế:

- Không cần migration: `warehouse_movements.production_order_id` đã có sẵn,
  chỉ đường nhập chưa dùng.
- `createReceiptDoc` nhận thêm `production_order_id` (loại trừ với `po_id` —
  một phiếu hoặc nhận NCC hoặc hoàn kho, không trộn); movements ghi
  `ref_type='lsx'`, gắn LSX. Guard: LSX phải `approved|in_progress|done` (SX
  xong mới trả thừa là chuyện thường), SL hoàn ≤ đã cấp còn lại của LSX đó.
- `issuedByLsx` + `issuedByLsxIds` đổi công thức thành **NET**: Σ out − Σ in
  (cùng production_order_id) → needs/reserved/backflush tự đúng.
- UI ReceiptForm: "Nguồn nhập" thêm lựa chọn **"Hoàn kho từ LSX"** → chọn LSX
  → prefill danh sách vật tư ĐÃ CẤP (đã cấp − đã hoàn) để gõ SL trả.
  Sổ/lịch sử hiện nhãn "Hoàn kho LSX" (movement in + production_order_id).

### K3 — PNK thiếu SỐ CHỨNG TỪ NCC + NGÀY CHỨNG TỪ

- Xe giao hàng nào cũng kèm **phiếu giao hàng/hoá đơn có số** — số đó là chìa
  khoá đối chiếu 3 chiều với kế toán và cãi nhau với NCC. Hiện chỉ có ô "người
  giao", số phiếu NCC phải nhét vào ghi chú tự do.
- Hàng về chiều tối, sáng hôm sau mới nhập máy — **ngày chứng từ ≠ ngày gõ**.
  Cột `doc_date` có sẵn trong DB nhưng form không cho chọn, luôn ăn ngày tạo.

Thiết kế: `0161` (gộp với K1) thêm `warehouse_docs.supplier_doc_no text` —
PNK theo PO hiện ô "Số phiếu giao NCC" + ô "Ngày chứng từ" (default hôm nay,
cho lùi tối đa 7 ngày — lùi xa hơn là chuyện bất thường, bắt ghi chú). PXK cũng
cho chọn ngày chứng từ. In 01-VT hiện số phiếu NCC.

### K4 — Kho xem chi tiết ĐƠN CHỜ NHẬN (không lộ giá)

`/warehouse/nhap` từng dòng đơn/đợt thêm nút **bung chi tiết**: bảng dòng
(mã VT, tên, ĐVT, SL đặt, đã về, còn chờ — từ `supply_po_line_status`, toàn cột
số lượng, KHÔNG đơn giá/thành tiền) + danh sách đợt với trạng thái. Kho chuẩn
bị mặt bằng/nhân lực và đối chiếu khi xe tới mà không cần mò sang khu Cung ứng.
API mới `GET /api/dept/warehouse/po-preview?po_id=` trả đúng tập cột đó
(guard `canViewWarehouse`).

### K5 — Cảnh báo XUẤT VƯỢT nhu cầu còn lại của LSX

Xuất theo LSX hiện prefill đúng "còn phải cấp" nhưng người gõ tay 200 khi lệnh
chỉ còn cần 100 là đi qua im lặng (chỉ chặn khi vượt tồn/khả dụng). Thêm cảnh
báo vàng trên form: `SL xuất > còn phải cấp` → "vượt nhu cầu còn lại của lệnh
(còn cần X)" — không chặn (bốc lố để đỡ chạy kho là chuyện thật, nhưng phải
thấy số).

### Đã cân nhắc và KHÔNG đưa vào đợt này

- Chuyển Kho thành người quản đơn NCC — phá phân tách nhiệm vụ (mục 1).
- Điều chuyển kho (DCK)/đa kho, lot/FIFO — giữ nguyên quyết định treo cũ.
- Sửa-tại-chỗ phiếu đã ghi — thay bằng phiếu đảo (K1), sổ sách không sửa đè.

## 3. Thứ tự thi công — ✅ TOÀN BỘ XONG 16/08/2026 (0161/0162 đã apply remote)

| # | Việc | Kết quả |
|---|---|---|
| 1 | **K1 phiếu đảo (0161 + 0162 notify)** | ✅ `reverseDoc`: đảo PNK↔PXK ref 'adjust' giữ po_line/LSX, guard tồn 409 `REVERSAL_STOCK_SHORT`, chặn QC-loại/đảo-kép, PO+đợt tự lùi, notify `wh_doc_reversed`; UI nút "Phiếu ghi sai? Lập phiếu đảo…" + badge hai chiều. 6 unit test + tích hợp DB thật pass |
| 2 | **K2 hoàn kho từ SX** | ✅ nguồn nhập "↩ Hoàn kho từ LSX" (prefill đã cấp qua `/lsx-issued`), `issuedByLsx`/`Ids` đổi công thức **NET** (out − in), guard hoàn ≤ đã cấp |
| 3 | K3 số phiếu NCC + ngày chứng từ | ✅ `supplier_doc_no` (0161) trên form + in 01-VT; `doc_date` chọn được cả PNK/PXK, lùi ≤ 7 ngày (schema chặn) |
| 4 | K4 (rút gọn theo quyết định ②) | ✅ link "Xem đơn" từ /warehouse/nhap sang trang chi tiết đơn |
| 5 | K5 cảnh báo xuất vượt nhu cầu | ✅ hint vàng "vượt nhu cầu còn lại của lệnh (còn cần X)" trên form xuất LSX |

BẪY ghi lại: embed PostgREST trên bảng TỰ TRỎ MÌNH (`reversal_of` self-join) mơ
hồ hai chiều → findById trả rỗng; mã phiếu gốc phải tra bằng truy vấn phụ
(`fillReversalCodes`), đừng embed.

## 4. Quyết định cần chủ dự án chốt trước khi code

1. **Ai được lập phiếu đảo?** (a) mọi người có quyền ghi sổ kho — nhanh, đủ vết;
   (b) chỉ quản lý Kho duyệt kiểu kiểm kê — chặt nhưng thêm một tầng chờ.
   Đề xuất: (a) + notify quản lý, vì phiếu đảo tự nó đã là chứng từ có vết.
2. **Kho có được thấy GIÁ trên đơn không?** Quyết định này định hình K4:
   đề xuất KHÔNG (chuẩn phân tách) — Kho dùng màn chi tiết không giá; ai kiêm
   nhiệm hai vai thì vẫn còn trang bên Cung ứng.
