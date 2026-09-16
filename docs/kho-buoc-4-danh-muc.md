# Kho · Bước 4 — Danh mục vật tư (bản của Kho)

Viết 16/09/2026. **Đổi hướng so với kế hoạch gốc**: kế hoạch cũ ghi "danh mục
KHÔNG dựng lại, dùng `/mua-hang/vat-tu`". Chủ dự án chốt 16/09: **dựng lại từ
đầu trong khu Kho, không mượn màn của Cung ứng.**

Lý do đo được, và nó đúng: hai phòng hỏi hai câu khác nhau về cùng một bảng.

| | Cung ứng hỏi | Kho hỏi |
| --- | --- | --- |
| Câu chính | "mã này mua của ai, lần trước bao nhiêu tiền?" | "mã này **đơn vị gì, để kệ nào, dưới bao nhiêu thì phải báo**?" |
| Trường sở hữu | giá mua · NCC · mẫu đơn · quy đổi giá · thuế | **ngưỡng tồn · kệ gợi ý · mã vạch · dung sai · ngừng dùng** |
| Hàng đợi việc | không có | **52 mã "chờ Kho rà"** |

Ranh giới này **đã có sẵn trong mã**: `PURCHASING_EDITABLE_FIELDS` liệt kê
trường Cung ứng được sửa; mọi trường ngoài danh sách đó là của Kho, service
chặn sẵn. Màn này chỉ bày đúng phần của Kho.

---

## 1. Số thật 16/09/2026 — cái quyết định bố cục

| Phép đo | Số | Nói lên điều gì |
| --- | ---: | --- |
| Vật tư (đều đang dùng) | 13.229 | lướt hết là 265 trang — **màn này là một Ô TÌM, không phải bảng để lướt** |
| **Chờ Kho rà** | **52** | hàng đợi việc THẬT, không được chôn trong bộ lọc |
| Khai **ngưỡng tồn tối thiểu** | **5** | 0,04% — đây là việc ĐANG THIẾU, đáng làm nổi |
| Có kệ gợi ý | 12.988 | 0196 nạp theo nhóm; cần Kho sửa lại cho đúng biển hiệu |
| Trống nhóm phụ | 1.201 | |
| Khai trần tồn / điểm đặt lại / mã vạch / dung sai | **0 / 0 / 0 / 0** | **KHÔNG bày thành cột** — cột rỗng dạy người dùng bỏ qua cột đó |

Hai kết luận:

1. **Không dựng bảng 13.229 dòng để lướt.** Vào trang không tải danh sách dài;
   người dùng tới với một mã hoặc một rổ trong đầu.
2. **Ngưỡng tồn là việc chính của màn**, không phải một cột phụ: 5/13.229 nghĩa
   là cảnh báo "sắp hết" của cả phân hệ hiện gần như không chạy.

## 2. Phạm vi — một màn, không route mới

### 2.1 `/warehouse/vat-tu` — Danh mục vật tư · Khuôn C, sửa tại chỗ

Danh mục **không có vòng đời duyệt** (nguyên lý 1.2): sửa tại chỗ, có vết
(`warehouse_material_changes`, 0177), không có nút "gửi duyệt".

**Bốn rổ**, mỗi rổ một câu hỏi của Kho:

| Rổ | Điều kiện | Vì sao có |
| --- | --- | --- |
| **Chờ Kho rà** | `needs_review` | Cung ứng khai vội lúc soạn đơn — Kho xác nhận ĐVT / nhóm / kệ |
| **Chưa khai ngưỡng** | `min_stock = 0` | việc đang thiếu nhất |
| Chưa có kệ | `shelf_location` rỗng | |
| Tất cả | — | ghi rõ 13.229 |

**Cột**: Mã · Tên · ĐVT · Nhóm / nhóm phụ · **Kệ gợi ý** · **Ngưỡng tối thiểu**
· trạng thái. Không cột nào rỗng 100%.

**Sửa tại chỗ ngay trên dòng** — ba ô Kho gõ hằng ngày: ĐVT, Kệ gợi ý, Ngưỡng.
Gõ xong rời ô là `PATCH materials/[id]` (route đã có), sổ vết tự ghi. Không mở
hộp thoại cho ba ô này: Kho khai một lượt mấy chục mã, mỗi mã một hộp thoại là
mấy chục lần bấm thừa.

**Hành động dòng**: `Đã rà xong` (chỉ ở rổ Chờ Kho rà — hạ cờ `needs_review`),
`Xem tồn` (sang `/warehouse/ton?q=<mã>`), `Ngừng dùng`.

Tìm không dấu, lọc nhóm, rổ, trang — tất cả trên URL, lọc và cắt trang ở
server (`materialsService.list` đã làm).

### 2.2 Không route API mới, không migration

`GET materials` (lọc + phân trang + `needs_review`) và `PATCH materials/[id]`
đã có. Quyền: `warehouse.material.update` cho người Kho; Cung ứng mở màn này
thì ba ô sửa khoá kèm lý do (service vẫn chặn, màn chỉ nói trước).

## 3. Thứ tự thi công — 3 việc

| # | Việc | Kiểm bằng |
| --- | --- | --- |
| 1 | Artboard + kế hoạch (bản này) | chủ dự án duyệt |
| 2 | Màn `/warehouse/vat-tu` + mục nav | rổ Chờ Kho rà ra đúng 52 mã; tìm "vit" ra "vít"; F5 giữ lọc |
| 3 | Sửa tại chỗ + Đã rà xong | sửa ngưỡng một mã → `/warehouse/ton` rổ "Dưới mức" đổi theo; vết vào sổ 0177 |

## 4. Cố ý chưa làm

Hồ sơ một vật tư (Khuôn E) · thêm mã mới ở khu Kho (Cung ứng đang khai lúc
soạn đơn, đường đó chạy tốt) · gộp / tách mã trùng · quản lý nhóm (đã có
`/planning/materials/nhom`) · mã vạch · nhập Excel.
