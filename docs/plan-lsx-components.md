# Kế hoạch: Bảng chi tiết theo LSX — liên kết Kế hoạch SX ↔ Cung ứng ↔ Xưởng

> **✅ P1 + P2 + P3 + P4 HOÀN THÀNH 07/2026** — migration 0038 đã apply + sync
> types; module `components` (schema/repo/service + test); công thức thuần
> `src/lib/component-needs.ts` (tổng cần/kg/số cây, chia 0 an toàn — test đối
> chiếu); grid nhập trong LsxDetailView (`LsxComponentsPanel` — gợi ý từ BOM /
> chép lệnh trước); `smartLsxNeeds` ưu tiên bảng chi tiết fallback BOM (needs
> API + form PO hiện kg/cây); cờ "Chưa nhập chi tiết" ở bảng điều phối; xưởng
> xem read-only. 243 test xanh. UAT mục 8d.

Lập 07/2026, là bước đầu của SRS sản xuất chi tiết (`docs/srs-san-xuat-chi-tiet.md`
— FR-MD-02/03, FR-PL-02/03, FR-SC-01). Tổng ~3–4 ngày, 4 phase.

## Quyết định thiết kế (user chốt 07/2026 — ghi để không tranh cãi lại)

**Bảng chi tiết (component) của mỗi LSX do NHÂN VIÊN KẾ HOẠCH NHẬP TAY, đối
chiếu file BOM đính kèm SP — KHÔNG lấy sống từ BOM kỹ thuật.** Lý do thực tế:
file BOM đôi lúc **chưa có** (bom_status none/drawing) hoặc **sai** — sản xuất
không chờ Kỹ thuật. Hệ quả thiết kế:

1. **Snapshot per lệnh**: mỗi LSX giữ bản chi tiết riêng của nó. Kỹ thuật sửa
   BOM sau đó KHÔNG làm đổi số liệu lệnh đang chạy (khớp NFR-MT-02 — không
   phá lịch sử). Đây cũng đúng tinh thần sheet `data` của file Excel gốc.
2. BOM kỹ thuật + file BOM chỉ là **nguồn tham khảo / gợi ý điền sẵn** — nhân
   viên sửa được từng dòng, nguồn sự thật là bản nhập của lệnh.
3. BR-07 giữ nguyên: thiếu BOM vẫn phát lệnh, vẫn nhập được bảng chi tiết.

## Đã có sẵn (nối vào, không xây lại)

- LSX + dòng SP của đơn (`production_orders` 1-1 đơn, dòng = `sales_order_lines`).
- Vật tư `warehouse_materials`; BOM kỹ thuật `technical_bom_lines` (nguồn gợi ý).
- Nhu cầu vật tư hiện tại: view `v_lsx_material_status` (BOM×SL − đã xuất) qua
  `lsxNeeds()` — dùng ở form tạo PO. Kế hoạch này sẽ **ưu tiên bảng chi tiết
  khi có, fallback view BOM** — Cung ứng không phải đổi thói quen.
- File BOM/bản vẽ đính SP (module files) — hiện được để đối chiếu khi nhập.
- Guard: `isSupplyStaff` (phòng KH-CƯ = U2 Kế hoạch + U3 Cung ứng theo SRS).

## P1 — DB + module (~1 ngày)

1. **Migration `0038_production_order_components.sql`** (chuẩn add-migration,
   RLS enable no policy, idempotent):

   Bảng `production_order_components` — chi tiết per LSX:
   - `id` uuid PK; `production_order_id` FK → production_orders **on delete
     cascade**; `order_line_id` FK → sales_order_lines on delete cascade
     (chi tiết thuộc SP nào trong lệnh).
   - `cluster` text (cụm — "CỤM TỰA"), `name` text not null (chi tiết —
     "TAY+TỰA").
   - `material_id` FK → warehouse_materials **on delete restrict, nullable**
     (chưa chọn được vật tư vẫn nhập dòng — nhưng dòng đó KHÔNG vào nhu cầu
     mua, UI cảnh báo).
   - Quy cách: `material_type` text (TRÒN/ĐẶC/HỘP…), `spec_thickness_mm`,
     `spec_width_mm`, `spec_length_mm` numeric(10,2) nullable.
   - Định mức: `qty_per_unit` numeric(14,4) > 0 (CT/SP), `dm_kg`
     numeric(14,4) ≥ 0 nullable (kg vật tư / 1 chi tiết), `pcs_per_bar`
     numeric(14,4) > 0 nullable (hệ số quy đổi: số chi tiết cắt được / 1 cây).
   - `sort_order` int, `note` text, timestamps + trigger updated_at.
   - Index theo `production_order_id`; KHÔNG unique theo tên (một chi tiết có
     thể 2 dòng khác quy cách).
2. **Module** `src/modules/dept/production/components.{schema,repo,service}.ts`:
   - Zod: dòng chi tiết + `componentsSaveSchema` (PUT ghi đè trọn bộ per
     order_line — pattern `bomSaveSchema`), max 500 dòng.
   - Service: `list(lsxId)` (mọi NV đọc); `save(user, lsxId, lines)` — guard
     `isSupplyStaff` + LSX chưa `completed/cancelled`; `suggestFromBom(lsxId)`
     — đọc technical_bom_lines của các SP trong lệnh trả dòng gợi ý (không ghi
     DB); `copyFromPrevious(lsxId)` — tìm LSX gần nhất có cùng product_id và
     copy bảng chi tiết (17 SP lặp lại nhiều lệnh — đây là đường nhập nhanh
     thực tế nhất).
   - **Công thức pure + test đối chiếu Excel (NFR-QA-01, NFR-CC-03)** trong
     `src/lib/component-needs.ts`:
     - `tong_can = qty_per_unit × qty_dòng_đơn`
     - `kg_can = tong_can × dm_kg` (null nếu thiếu ĐM)
     - `so_cay_can = ceil(tong_can / pcs_per_bar)`; **pcs_per_bar 0/null →
       trả null + reason 'THIEU_HE_SO'** — không bao giờ ra `#DIV/0!`.
     - Gộp nhu cầu theo vật tư (nhiều chi tiết cùng vật tư).
3. **API** thin routes: `GET/PUT /api/dept/production/lsx/[id]/components`,
   `GET .../components/suggest?source=bom|previous`.

## P2 — UI nhập bảng chi tiết (planning, ~1–1.5 ngày)

1. Khối **"Bảng chi tiết & định mức"** trong chi tiết LSX (LsxDetailView, chỉ
   render khi caller truyền cờ — planning bật, xưởng read-only): **grid nhập
   nhiều dòng giống Excel** (NFR-US-02) — cột: Cụm · Chi tiết · Vật tư (chọn
   từ danh mục, được để trống) · Loại · Dày/Rộng/Dài · CT/SP · ĐM kg ·
   Hệ số cây · Ghi chú; thêm/xoá dòng, Lưu cả bảng.
2. Thanh công cụ của grid: nút **"Gợi ý từ BOM kỹ thuật"** (kèm badge trạng
   thái BOM: chưa có/đang vẽ/đã vẽ — đúng tinh thần "BOM chỉ tham khảo"),
   nút **"Chép từ lệnh trước"**, link mở file BOM đính SP để đối chiếu.
3. Cột derived hiển thị ngay khi gõ (client tính bằng cùng hàm pure):
   Tổng cần · Kg cần · Số cây — dòng thiếu hệ số/ĐM hiện "—" + tooltip lý do.
4. Quyền: sửa = KH-CƯ + admin/manager; LSX completed/cancelled → read-only.

## P3 — Liên kết Cung ứng (~0.5–1 ngày)

1. `lsxNeeds()` nâng cấp: **LSX có bảng chi tiết → nhu cầu tính từ bảng chi
   tiết** (gộp theo vật tư: qty vật tư = tổng cần, kèm kg + số cây) − đã xuất;
   **chưa có bảng → fallback view BOM cũ** như hiện tại. Form tạo PO không
   đổi UX — chỉ hiện thêm 2 cột Kg / Số cây khi có dữ liệu.
2. Bảng điều phối `/planning/production`: cột "Vật tư / BOM" thêm trạng thái
   "Chưa nhập bảng chi tiết" (amber) cho LSX đã duyệt mà chưa có dòng nào —
   nhắc kế hoạch nhập trước khi mua.
3. FR-PL-04 (gộp nhu cầu nhiều lệnh) — **chưa làm đợt này**, ghi nhận cho
   SX-P2 đầy đủ.

## P4 — Hiển thị cho Xưởng (~0.5 ngày)

- `/production/lsx/[id]`: khối bảng chi tiết **read-only** (cụm, chi tiết,
  quy cách, tổng cần) — xưởng biết phải làm những chi tiết gì. Sản lượng theo
  công đoạn/ngày là SX-P3 của SRS, **ngoài phạm vi plan này**.

## Test bắt buộc

- Công thức `component-needs` đối chiếu số liệu mẫu từ file Excel (tổng cần,
  kg, số cây, chia 0 an toàn) — pure, table-driven.
- Quyền save (KH-CƯ được, xưởng/khác 403); chặn sửa khi LSX completed/cancelled.
- Zod: dòng chi tiết (qty_per_unit > 0, số âm bị chặn); save ghi đè trọn bộ.
- `lsxNeeds` ưu tiên bảng chi tiết / fallback BOM (mock 2 nhánh).

## Ngoài phạm vi (đừng làm lẫn — thuộc các phase SRS sau)

- Sản lượng hằng ngày per công đoạn/tổ + thiếu-dư/%HT/đồng bộ (SX-P3).
- Gia công ngoài TTP/Vinh (SX-P4). Import Excel hàng loạt (SX-P1 đầy đủ —
  đợt này nhập tay + chép lệnh trước là đủ dùng).
- Phiên bản BOM kỹ thuật (G-4) — snapshot per lệnh đã tách khỏi BOM nên không
  bị chặn bởi việc này.

## Rủi ro / lưu ý

- `order_line_id` cascade theo dòng đơn: sửa đơn thay dòng SP (replaceLines
  tạo dòng mới) sẽ **mất bảng chi tiết của dòng bị thay** — đúng logic (SP đổi
  thì chi tiết phải nhập lại) nhưng PHẢI cảnh báo trong event
  `order.changed_after_lsx` (đã có từ P2 vòng đời) + UI grid hiện notice.
  → kiểm tra `ordersRepo.replaceLines` để xác nhận hành vi, ghi rõ trong UAT.
- Đơn vị "số cây" là dẫn xuất hiển thị cho người mua — PO vẫn đặt theo ĐVT
  vật tư (cây/kg tuỳ danh mục), không đổi công thức thành tiền (OI-10 chờ DN).
- Grid nhập: giữ ERP kit (DataTable không phù hợp nhập liệu) — dựng bảng input
  thuần như BOM editor hiện có, đừng kéo thư viện grid mới vào.
