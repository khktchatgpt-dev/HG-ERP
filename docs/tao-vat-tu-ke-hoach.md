# Tạo vật tư — kế hoạch cập nhật sau khi nạp sổ Cung ứng

Ngày 02/08/2026. Danh mục vừa từ **1.320 → 13.064 vật tư**, và điều đó làm hỏng
mấy giả định mà form "Thêm vật tư mới" đang dựa vào.

## Form hiện tại và chỗ nó không còn đúng

| Ô | Hôm nay | Vấn đề ở quy mô 13.064 |
|---|---|---|
| Mã VT | đã bỏ, server tự cấp | ổn |
| Tên vật tư | text tự do + chặn trùng mức "chắc chắn" | ổn, nhưng xem §2 |
| ĐVT | **text tự do** | 131 cách viết trong sổ, 25 trong app, danh mục `catalog_items` 14 nhãn **không ai đọc** |
| Nhóm | **text tự do** | vừa gộp về 15 nhóm; gõ tay là đẻ nhóm thứ 16 ngay hôm sau |
| Nhóm phụ | **không có ô** | sổ có 109 nhóm phụ, hiện nhét trong `note` — không lọc được |
| kg/m, dài cây | có, tự tính từ tên | ổn |
| Mẫu đơn | gán ngầm = mẫu đang soạn | sai khi khai vật tư không thuộc mẫu đó |

## 1. ĐVT: combobox, không phải ô trống

Danh mục `catalog_items` type=`unit` đã tồn tại từ 06/07 với 14 nhãn và **chưa
màn hình nào đọc nó**. Việc cần làm:

1. Seed thêm cho đủ **55 nhãn chuẩn** (bảng đã duyệt: `docs/dvt-chuan-hoa.md`).
2. Ô ĐVT thành combobox gợi ý từ danh mục đó — **vẫn gõ tự do được**, vì hàng lạ
   như `Nhãn`, `Thẻ`, `Lố` là ĐVT thật của xưởng.
3. Chuẩn hoá lúc lưu: `trim` + `normalize('NFC')` + đối chiếu không phân biệt
   hoa/thường với danh mục, trùng thì lấy đúng nhãn chuẩn.

Điểm 3 quan trọng hơn vẻ ngoài của nó. Danh mục app từng có **hai chuỗi "cái"**
trông y hệt nhau — `63 e1 69` và `63 61 301 69` (á dựng sẵn vs a + dấu sắc rời).
5 vật tư mang chuỗi thứ hai. Không ai nhìn ra được bằng mắt.

## 2. Nhóm + nhóm phụ: chọn, không gõ

Sau đợt gộp còn 15 nhóm (14 của sổ + `(trống)`). Sổ còn tầng thứ hai: **109 nhóm
phụ** (`Vòng bi - bạc đạn`, `Sơn - dầu hoàn thiện gỗ`, `Bulon - tán - đinh tán`).

- Nhóm: `<select>` từ 14 nhóm chuẩn. Không cho gõ tự do — đây là xương sống
  phân loại, không phải nhãn tuỳ hứng.
- Nhóm phụ: `<select>` lọc theo nhóm đang chọn, cho thêm mới.
- **Cần migration**: thêm cột `sub_group` vào `warehouse_materials`. Hiện nhóm
  phụ nằm trong `note` dạng text — nạp thì được, lọc thì không.

Nhóm quyết định phạm vi so trùng tên (`scopedSureKey`), nên gõ sai nhóm là chặn
trùng hụt. Đó là lý do phải khoá lại thành danh sách chọn.

## 3. Mẫu đơn: hỏi thẳng, đừng suy ngầm

Form đang gán `po_template = mẫu đang soạn`. Đúng khi người dùng khai đúng thứ
họ đang mua, sai khi tiện tay khai luôn món khác.

Nay đã có hàm phân loại theo tên (`scripts/materials-drive-lib.mjs` →
`templateFor`). Đưa nó vào `src/lib/` rồi:

- Form **đề xuất** mẫu theo tên vừa gõ, hiện rõ *"đề xuất: Phụ kiện — vì tên có
  chữ 'bu lông'"*.
- Cho đổi bằng một `<select>` 5 mẫu.
- Riêng `aluminium`: **chỉ cho chọn khi đã có kg/m**, vì thiếu thì `lineReady`
  chặn gửi dòng và người soạn đơn kẹt.

Bài học từ đợt nạp: gán mẫu theo nhóm thì 2/3 cụm "nhôm" của sổ nhận nhầm mẫu
nhôm — `Cromate nhôm` là hoá chất, `Cân treo nhôm 150kg` là cái cân. Gán theo
tên thì đúng.

## 4. Ô tìm vật tư phải chịu được 13.064 dòng

`MaterialPicker` tìm ở server, `limit 25`, tối thiểu 2 ký tự — vẫn ổn. Nhưng:

- Gõ "hộp" giờ ra hàng trăm kết quả ở nhiều nhóm. **Cần hiện nhóm + nhóm phụ**
  trên từng dòng kết quả, không thì không phân biệt được
  `Inox hộp 25x50x1` với `Thép hộp mạ kẽm 25x50x1.0mm`.
- Nên có bộ lọc nhóm ngay trong ô tìm.

## 5. Việc dọn còn treo (không chặn code)

| | Số | Nguồn |
|---|---:|---|
| Cụm trùng ngay trong sổ Drive | 105 | `docs/trung-trong-so-drive.md` |
| Trùng chéo app ↔ sổ sau khi gộp nhóm | 72 | in ra khi chạy `materials-group-merge.mjs` |
| ĐVT không đoán được — `MTK`×21, `cal`×4, `ve`×2 | ~36 | chờ phòng Cung ứng |
| Dòng dịch vụ/phí đã loại khỏi danh mục | 121 | cần chỗ khác để đặt hàng dịch vụ |

Mục cuối đáng bàn riêng: cước vận chuyển, phí kiểm định, đại tu máy **vẫn phải
đặt và trả tiền**, nhưng không phải vật tư kho. Hiện chúng không nằm đâu cả.

## Thứ tự đề xuất

1. Migration `sub_group` + seed 55 ĐVT vào `catalog_items` *(nửa ngày)*
2. Form: ĐVT combobox + nhóm/nhóm phụ select + mẫu đơn đề xuất *(1 ngày)*
3. `MaterialPicker` hiện nhóm, thêm lọc nhóm *(nửa ngày)*
4. Script dọn 105 + 72 cụm trùng, dry-run trước *(nửa ngày)*

Mục 1–2 nên làm cùng nhau: đổi form mà chưa có cột `sub_group` thì lại phải sửa
form lần nữa.
