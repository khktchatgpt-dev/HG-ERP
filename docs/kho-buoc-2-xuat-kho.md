# Kho · Bước 2 — Xuất kho theo thực tế lấy

Viết 16/09/2026, sau khi Bước 1 (nhập theo đơn) dựng xong 6 việc và còn việc
chạy thật. Đọc cùng [`kho-buoc-1-nhap-kho.md`](kho-buoc-1-nhap-kho.md) —
cùng luật: một màn, 0 migration, dữ liệu thật từ commit đầu, mỗi việc một
commit có cách kiểm, chạy thật rồi mới sang bước sau.

**Quyết định của chủ dự án 16/09/2026: KHÔNG xuất theo định mức lúc này.**
Đo cùng ngày: 14 lệnh đang chạy, 6 lệnh có bảng chi tiết nhưng **0 dòng gắn
mã vật tư**, bảng kê tay 0 dòng, tồn chỉ 1 mã khác 0, cấp SX ghi sổ 1 dòng
trong 2 tháng. Màn "cần / đã cấp / còn thiếu" lúc này là màn toàn "chưa có
hàng" và số cần không ai tin. Chốt nghiệp vụ 15/09 cũng đã nói: tổ tự ra kho
lấy, thủ kho ghi sổ sau. Vậy sổ chỉ cần biết **xuất mã gì, bao nhiêu, cho
lệnh hay tổ nào**.

---

## 1. Câu hỏi nghiệp vụ

| Vai | Câu hỏi | Màn |
| --- | --- | --- |
| Thủ kho | Tổ vừa lấy gì, tôi ghi sổ cho lệnh/tổ nào? | **Phiếu xuất** |
| Cung ứng / Kế hoạch | Lệnh này đã xuất gì rồi? | đã có: `/planning/lsx` đọc sổ theo lệnh — không dựng lại |
| Quản lý kho | Tháng này xuất lẻ / huỷ bao nhiêu? | sổ phiếu `/planning/docs?kind=issue` — bước phụ sau |

Không có hàng đợi ở bước này: nguồn việc là **xe đẩy vừa rời kho**, không có
chứng từ nào sinh ra trước. Vào khu Kho → mục "Xuất kho" → là form.

## 2. Phạm vi — một màn, một route

### 2.1 `/warehouse/xuat` — Phiếu xuất · Khuôn F (bảng nhập liệu)

Lưới là nhân vật chính; đầu phiếu co thành **dải chip** (`HeadChips`) vì mỗi
hàng đầu trang là một hàng lưới bị lấy mất.

| Chip | Giá trị | Bắt buộc |
| --- | --- | --- |
| Loại xuất | **Cho lệnh SX** / Xuất lẻ | ✓ |
| Lệnh SX | ô tìm trong lệnh đã duyệt / đang SX (14 lệnh) | ✓ khi Cho lệnh |
| Lý do | mã hướng ra của `warehouse_reason_codes`: X2 dùng chung/sửa chữa · X6 · X7 khác (X4 huỷ chỉ khi có duyệt — bước phụ) | ✓ khi Xuất lẻ |
| Tổ / người nhận | gõ tự do, gợi ý tên tổ từ danh mục phòng (Tổ Phôi, Tổ Hàn, Tổ Nguội, Tổ Sơn Sắt, Tổ Sơn Nhôm, Tổ May, Cắt Vải, Tổ Cơ Điện) | ✓ |
| Ngày chứng từ | mặc định hôm nay, lùi ≤ 7 ngày | ✓ |

Lưới (`Grid*`), dòng thêm bằng **ô tìm vật tư** ở dòng cuối (gõ mã hoặc tên,
Enter chọn — `Lookup` của kit, đọc `GET /api/dept/warehouse/materials?q=`):

| Cột | Nguồn / luật |
| --- | --- |
| Mã · Tên · ĐVT | danh mục |
| **Tồn dùng được** | `warehouse_stock.qty_ok` — đọc lúc thêm dòng |
| Lần này | `NumInput`; > tồn dùng được → `CellHint` "tồn 120, xuất 150 — thiếu 30" và thanh chốt chặn |
| Ghi chú | tự do |

Cột "giữ cho lệnh khác" **không vẽ** ở bước này (cần định mức). Server vẫn
chặn 409 `RESERVED_CONFLICT` khi lấn phần giữ cho lệnh khác; màn bắt lỗi đó
và mở `Sheet` "Xuất lấn phần đang giữ cho lệnh X" bắt lý do rồi gửi lại với
`override_reserved`. Đây là đường ngoại lệ có thật trong service, không phải
màn đoán.

Hành động: **Ghi sổ** (Ctrl+Enter) · Xoá dòng · Huỷ. Sau ghi sổ: toast mã
PXK, **form mới trống** ngay tại chỗ (thủ kho ghi cho 3 tổ liên tiếp), link
"Xem phiếu" sang sổ chứng từ. Khác phiếu nhập (về hàng đợi): xuất không có
hàng đợi để về.

### 2.2 Route

Khôi phục `src/app/api/dept/warehouse/docs/issue/route.ts` từ `20033fb^`
(nếu có) hoặc viết 12 dòng: `parseJson(issueDocSchema)` →
`stockService.createIssueDoc`. Service đã có đủ: guard trạng thái lệnh, guard
tồn, guard giữ chỗ, mã X1 tự gắn cho lệnh, `reason_code` bắt buộc cho xuất lẻ
(zod đang optional — siết ở biên API là việc của bước này, không đụng service).

**Không migration.**

## 3. Dữ liệu — đã có gì

| Cần | Có | Ở đâu |
| --- | --- | --- |
| Phiếu xuất + dòng sổ hướng ra | ✅ | `warehouse_docs.kind='issue'`, `warehouse_movements` |
| Mã lý do hướng ra | ✅ | 0197, `lib/kho-ma-ly-do.ts` |
| Tồn dùng được theo mã | ✅ | view `warehouse_stock.qty_ok` (0194/0198) |
| Lệnh đang chạy | ✅ | `production_orders` approved / in_progress |
| Tên tổ | ✅ | `departments` |
| Xuất đã ghi theo lệnh (cho `/planning/lsx`) | ✅ | `issuedByLsx` NET |

## 4. Thứ tự thi công — 5 việc

| # | Việc | Kiểm bằng |
| --- | --- | --- |
| 1 | Route issue + mục nav "Xuất kho" + trang vỏ | vai Kho mở `/warehouse/xuat` được; `curl` POST issue trả 201 |
| 2 | Dải chip + lưới + ô tìm vật tư (chưa ghi) | thêm 3 mã bằng ô tìm, tồn dùng được hiện đúng `/planning/stock` |
| 3 | Cảnh báo tại chỗ + thanh chốt | 3 ca: chưa có dòng · vượt tồn · xuất lẻ thiếu lý do |
| 4 | Ghi sổ + sheet lấn phần giữ chỗ | ghi sổ thật 1 phiếu thử trên mã có tồn |
| 5 | Chủ dự án ghi sổ thật một lượt tổ lấy | mục 5 |

## 5. Nghiệm thu

1. Phiếu `PXK-2026-00xx` xuất hiện ở `/planning/docs?kind=issue`, `posted`.
2. `warehouse_stock.qty_ok` của mã giảm đúng số xuất; không âm.
3. Dòng sổ có `reason_code` = X1 (theo lệnh) hoặc mã đã chọn (xuất lẻ),
   `production_order_id` đúng lệnh.
4. `/planning/lsx` của lệnh đó hiện "đã xuất" tăng đúng.
5. Ghi cho ba tổ liên tiếp không phải rời trang.

**Điều kiện tiên quyết**: có tồn thật để xuất — tức **Bước 1 việc 5 phải xong
trước** (nhận thật ít nhất một đợt). Tồn đang là 1 mã khác 0.

## 6. Cố ý chưa làm

So định mức (cần/đã cấp/còn thiếu, `lib/cap-vat-tu.ts` giữ nguyên chờ định
mức có mã VT) · hoàn kho từ lệnh (N3) · xuất huỷ có duyệt (X4) · trả NCC (X3)
· dán từ Excel · quét mã · sổ phiếu xuất riêng · in phiếu 02-VT mới.
