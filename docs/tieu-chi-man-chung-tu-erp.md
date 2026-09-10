# Tiêu chí màn CHỨNG TỪ theo ERP — đo được, và điểm của màn Đơn mua

Viết 10/09/2026 sau khi chủ dự án chấm màn `/mua-hang/don/[id]` là "chưa đạt tiêu
chí ERP". Lỗi của tôi là chép xương của màn mẫu `/design-lab/mau-erp` — mà màn mẫu
là bản TRƯNG BÀY thành phần, không phải một màn chứng từ đang được dùng 8 tiếng
mỗi ngày. Dưới đây là tiêu chí rút từ ba màn thật: *Purchase order details* của
Dynamics 365 F&O, *Manage Purchase Orders* (object page) của SAP Fiori, và form
Purchase Order của Odoo 17. Mỗi tiêu chí phải ĐO ĐƯỢC, không thì không chấm được.

| # | Tiêu chí | Ngưỡng | Của ai | Màn trước khi sửa | Sau khi sửa |
|---|---|---|---|---|---|
| 1 | **Dòng hàng là nhân vật chính**: lưới dòng nhìn thấy ngay khi mở, chiếm phần lớn màn | Lưới bắt đầu trong 1/3 màn đầu ở 1080p; ≥ 50% chiều cao còn lại | Dynamics mở ở *Lines view* | ✗ Tiêu đề lưới ở 547px | ✓ ở 1080p: tiêu đề lưới ở **325px** (< 360), lưới + chi tiết dòng chiếm 70% phần còn lại. ○ ở 1280×860 thì 325 > 287 — chưa đạt ngưỡng 1/3 trên màn thấp |
| 2 | **Dải nhận diện gọn**: số hiệu, đối tác, trạng thái, người giữ trong ≤ 2 hàng | ≤ 110px ở 1280 | Cả ba | ✗ 5 dải xếp chồng ≈ 289px | ✓ **105px** = một hàng nhận diện (số hiệu · đối tác cắt … · hai trục) + một hàng nút thông minh mang luôn viên "đang chờ ai" + một hàng bảng kiểm |
| 3 | **Trường xếp theo NHÓM có tên**, 3 cột ở ≥ 1280, nhãn trái cố định | ≥ 2 nhóm, mỗi nhóm ≤ 8 trường | Dynamics FastTab General / Delivery / Price | ✗ Một nhóm 12 trường | ✓ Chung · Giao hàng · Giá & thuế |
| 4 | **Chi tiết dòng đang chọn** hiện dưới lưới, sửa được tại đó | Có khối "Chi tiết dòng" đổi theo dòng chọn | Dynamics *Line details* | ✗ Không có; ô đặc thù nhồi vào lưới | ✓ Có, 3 cột, sửa được |
| 5 | **Lưới gọn**: chỉ cột đọc-mà-quyết ở lưới, cột hiếm dùng xuống chi tiết dòng | ≤ 11 cột ở lưới | Dynamics | ✗ 15 cột với mẫu kính | ✓ **11** (bỏ cột Tồn khỏi lưới — xuống chi tiết dòng) |
| 6 | **Mật độ ERP**: hàng ≤ 26px, ô nhập ≤ 24px, chữ nền 12–13px | đo bằng `getComputedStyle` | SAP GUI, Dynamics | ✗ 30 / 28 | ✓ **25** / 24 (mặc định dày cho chứng từ) |
| 7 | **Nút thông minh**: chứng từ liên quan hiện thành số đếm bấm được ngay đầu trang | Đợt giao · Phiếu kho · Trao đổi · Tài liệu | Odoo smart buttons | ✗ Chỉ liệt kê trong FactBox | ✓ Dải đếm dưới số hiệu |
| 8 | **Action Pane theo bước**, nút khoá kèm lý do, nhóm gắn nhãn | Đã có | Dynamics | ✓ | ✓ |
| 9 | **Điều hướng bản ghi** ‹ n/N › và tab trình duyệt mang mã | Đã có | SAP, Dynamics | ✓ | ✓ |
| 10 | **Trao đổi + tài liệu trên chứng từ** | Có khối chatter và đính kèm | Odoo | ✗ Dẫn sang bản cũ | ✓ Khối "Trao đổi" (ghi chú + mốc máy ghi trộn chung, dùng lại `PoNotesPanel`) và "Tài liệu đính kèm" (`DocumentFiles`) ngay dưới đầu đơn; nút thông minh cuộn tới khối |
| 11 | **Không thẻ nổi**: lưới sát mép, khối ngăn bằng một vạch mảnh, FactBox một vạch dọc | Đệm thân màn 0; FastTab/FactBox không viền bốn phía, không bo góc, không lề | SAP GUI, Dynamics | ✗ Thẻ bo góc + lề 7–14px quanh lưới và FactBox | ✓ Kit mặc định phẳng từ 10/09/2026 |

Bốn thứ đầu là chỗ "trông không giống ERP" dù từng thành phần đều là ERP: một màn
ERP thật dồn 70% diện tích cho lưới và chi tiết dòng, phần đầu đơn chỉ là một dải
nhận diện, còn trường đầu đơn nằm gấp lại thành nhóm để mở khi cần. Màn trước làm
ngược: đầu đơn nở hết cỡ, lưới bị đẩy xuống dưới nếp gấp.

## Cách kiểm nhanh (ba phút, không cần đọc mã)

1. Mở `/mua-hang/don/<id>` ở 1280×1080. Tiêu đề lưới nằm trên vạch 1/3 màn (360px)? (1)
2. Đếm số dải trên lưới: số hiệu, hành động, nhận diện — có quá 3 không? (2)
3. Mở "Tổng quan": có tên nhóm, 3 cột, nhãn thẳng hàng? (3)
4. Bấm một dòng: khối "Chi tiết dòng" dưới lưới đổi theo? Bấm Sửa: sửa được trong đó? (4)
5. Đếm cột lưới ≤ 11? (5) Đo `tbody tr` ≤ 26px? (6)
6. Dưới số hiệu có dải "Đợt giao n · Phiếu kho n · …" bấm được? (7)
## Số đo sau đợt sửa 10/09/2026 (1280 rộng, đơn PO-2026-0065, 10 dòng)

| Đại lượng | Trước | Sau |
|---|---|---|
| Tiêu đề lưới cách đỉnh cửa sổ | 547px | 325px |
| Dải nhận diện (đỉnh `.k-doc` → đáy bảng kiểm) | 289px | 105px |
| Số cột lưới | 15 | 11 |
| Cao một hàng lưới | 30px | 25px |
| Số hàng riêng trên lưới sau thanh hành động | 6 (đầu đơn, trục, nút thông minh, người giữ, bảng kiểm, thanh công cụ lưới) | 3 |

Ba chỗ gộp: (a) đầu đơn thành MỘT hàng — số hiệu 18px, đối tác cắt bằng `…`, hai trục
cùng hàng (`DocHead compact`); (b) viên "đang chờ ai" đứng cuối hàng nút thông minh
(`SmartLinks trailing` + `HolderBar inline`) thay vì chiếm một dải riêng; (c) ở chế độ xem,
hai nút của lưới nằm bên phải tiêu đề FastTab (`FastTab actions`) — thanh công cụ lưới chỉ
hiện khi sửa, lúc đó ô tìm vật tư cần chỗ.

Còn lại: tiêu chí 1 ở màn 1280×860 (laptop) chưa đạt vì thanh hành động hai tầng + định
vị + thanh trên đã chiếm 154px trước khi chứng từ bắt đầu. Muốn đạt trên màn thấp thì phải
gập nhãn nhóm của Action Pane — sẽ cân nhắc khi có người dùng thật trên laptop 13".
