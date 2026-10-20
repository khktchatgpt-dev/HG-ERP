# Kế hoạch thiết kế lại phòng Cung ứng

Chốt hướng 09/09/2026. Bộ kit ERP (`src/components/kit/Erp.tsx`) đã xong và có
trang mẫu chạy được tại `/design-lab/mau-erp`. Tài liệu này nói **đổi màn nào,
theo thứ tự nào, và xong là như thế nào**.

Nền lý luận nằm ở [`thiet-ke-huong-erp.md`](./thiet-ke-huong-erp.md) — không lặp lại ở đây.

---

## 1. Điểm xuất phát, đo trên CSDL và mã nguồn 09/09/2026

| Đo cái gì                                        | Số      |
| ------------------------------------------------ | ------- |
| Route trong workspace Cung ứng                   | 21      |
| Trong đó là redirect / tái dùng của phòng khác   | 4       |
| Màn thật của Cung ứng                            | **17**  |
| Tổng dòng mã 17 màn đó                           | ~21.200 |
| Đơn mua đã tạo                                   | 68      |
| Đơn **từng được duyệt**                          | **0**   |
| Đơn nằm nháp (TB 6,5 ngày, lâu nhất 8)           | 65      |
| Dòng mua gắn với lệnh SX (`supply_po_line_lsx`)  | **0**   |
| Mã vật tư đang thiếu cho 15 lệnh đang chạy       | 142     |
| Vật tư có giá mua (10 / 13.226)                  | 0,08%   |

Ba số in đậm là toàn bộ vấn đề: **hệ thống là nơi soạn thảo, chưa phải nơi vận
hành**. Kế hoạch này xếp thứ tự theo đúng một tiêu chí — việc nào làm cho chứng
từ **chạy** thì làm trước, việc nào làm cho nó **đẹp** thì làm sau.

### Bốn route KHÔNG thuộc phạm vi

`/planning/board` (redirect sang `/production`), `/planning/docs` (tái dùng
`warehouse/docs`), `/planning/tracking` (tái dùng `sales/TrackingScreen`),
`/planning/lsx/[id]/ho-so` (tái dùng `production/LsxDetailScreen`).

Đụng vào chúng là đụng mã của Sản xuất / Kho / Bán hàng. **Để nguyên.** Khi các
phòng đó chuyển sang kit mới thì bốn màn này tự đổi theo.

---

## 2. Năm nguyên tắc chuyển đổi

1. **Người mua không bao giờ mở màn trắng.** Mọi chứng từ phải sinh ra từ một
   con số thiếu tính được, không từ một cái form rỗng.
2. **Mỗi màn trả lời một câu hỏi nghiệp vụ**, không bày một bảng dữ liệu. Màn
   nào không phát biểu được câu hỏi của nó thì màn đó là thừa.
3. **Dày, nhưng có kỷ luật căn chỉnh.** Chữ nền giữ 13px. Dễ đọc đến từ lưới
   nhãn–giá trị và tương phản, không từ phóng to chữ.
4. **Chuyển từng màn, mỗi màn một nhánh + PR.** Không đập một lượt.
5. **Màn nào chuyển xong thì chạy `npm run ui:baseline`** để nó rớt khỏi danh
   sách nợ cũ và từ đó bị canh ở mức `error` vĩnh viễn.

---

## 3. Bản đồ 17 màn → 9

| Route hiện tại               | Dòng  | Số phận       | Thành gì                                       |
| ---------------------------- | ----: | ------------- | ---------------------------------------------- |
| `/planning`                  |   218 | **Đổi**       | Hộp thư việc — "hôm nay tôi phải làm gì"       |
| —                            |     — | **MỚI**       | `/planning/can-doi` — sổ cân đối vật tư        |
| `/planning/pos`              | 3.398 | Đổi           | Danh sách đơn xếp theo "ai đang giữ"           |
| `/planning/pos/[id]`         | 2.885 | Đổi           | Chứng từ theo mẫu `/design-lab/mau-erp`        |
| `/planning/pos/new`          | 6.268 | Đổi           | Sinh từ đề nghị mua, không phải form trắng     |
| `/planning/pos/[id]/edit`    |   146 | Giữ           | Sửa điều khoản — nhỏ, đúng việc                |
| `/planning/viec-cua-toi`     |   229 | **Gộp**       | → vào `/planning` (hộp thư)                    |
| `/planning/hang-sap-ve`      |   143 | **Gộp**       | → tab "Đang về" của sổ cân đối                 |
| `/planning/van-de`           |   240 | **Gộp**       | → dải cảnh báo trên hộp thư                    |
| `/planning/hop`              |   160 | **Gộp**       | → dải cảnh báo trên hộp thư                    |
| `/planning/lsx`              |   850 | Giữ, đổi vỏ   | "Vật tư theo lệnh" — câu của người mua          |
| `/planning/lsx/[id]`         |   736 | Giữ, đổi vỏ   | Đơn mua của một lệnh                            |
| `/planning/lsx/[id]/bang-ke` | 1.758 | Giữ           | Xuất Excel — không phải màn nhìn                |
| `/planning/suppliers`        | 2.088 | **Hạ cấp**    | Tra cứu, rời nav chính                          |
| `/planning/suppliers/[id]`   |   975 | Giữ, đổi vỏ   | Hồ sơ NCC (FactBox lấy số từ đây)              |
| `/planning/materials`        |    60 | **Hạ cấp**    | Tra cứu                                         |
| `/planning/materials/nhom`   |   526 | Giữ           | Quản trị danh mục — ít dùng                     |
| `/planning/stock`            |   526 | **Hạ cấp**    | Tra cứu                                         |

**Nav từ 10 mục xuống 5**: Hộp thư việc · Cân đối · Đơn đặt · Vật tư theo lệnh ·
Nhận hàng. Bốn màn tra cứu (NCC, Vật tư, Tồn, Danh mục) vào bằng ô tìm kiếm toàn
cục và bằng cách bấm vào mã ở bất kỳ đâu — chúng là _danh mục_, không phải _việc_.

---

## 4. Bảy đợt

Ước lượng là **khoảng**, không phải cam kết. Con số nói lên độ nặng tương đối
giữa các đợt chứ không phải lịch giao.

### Đợt 0 — Sổ cân đối, chỉ là một view SQL · ~1 ngày

**Câu hỏi**: 142 mã đang thiếu là những mã nào, cho lệnh nào, hạn nào.

Chưa cần giao diện. Dựng `v_supply_balance`: `CẦN` (BOM chốt × sản lượng lệnh) −
`CÓ` (tồn khả dụng) − `ĐANG VỀ` (đã đặt chưa nhận) = `CÒN THIẾU`, kèm `HẠN CẦN`.
Truy vấn đã chạy thử được trên dữ liệu thật, không phải sửa dữ liệu gì.

**Xong khi**: có view + test canh phép trừ + `sync types`.
**Vì sao trước tiên**: mọi màn sau đều soi vào sổ này. Làm sau thì phải sửa lại
màn đã dựng.

### Đợt 1 — Chi tiết đơn đặt · ~3–4 ngày

**Câu hỏi**: đơn này đang ở đâu, ai giữ, còn vướng gì.

Thay `/planning/pos/[id]` (2.885 dòng) bằng khung kit mới — mẫu đã dựng sẵn ở
`/design-lab/mau-erp`, việc còn lại là **cắm dữ liệu thật vào**. Thêm bốn thứ
màn cũ chưa có: bảng kiểm chặn gửi duyệt, cột "mua cho lệnh nào", cột tồn trên
từng dòng, và nhật ký thay đổi trường.

**Xong khi**: mở một đơn thật thấy đủ 10 đặc trưng như trang mẫu.
**Vì sao sớm**: đây là màn có mẫu sẵn — rủi ro thấp nhất, và là chỗ chứng minh
kit mới chịu được dữ liệu thật.

### Đợt 2 — Danh sách đơn · ~2–3 ngày

**Câu hỏi**: đơn nào đang kẹt và kẹt ở tay ai.

`/planning/pos` xếp theo **ai đang giữ + bao lâu** thay vì theo ngày tạo. Lõi
tính đã có sẵn (`flow-core.ts`, có test). Thêm ngưỡng tuổi theo bước.

**Xong khi**: 65 đơn nháp 6,5 ngày hiện thành một khối đỏ không ai bỏ qua được.

### Đợt 3 — Màn Cân đối + Đề nghị mua · ~4–5 ngày

**Câu hỏi**: hôm nay phải mua gì, cho lệnh nào, trước ngày nào.

Màn **mới hoàn toàn**, và là màn đầu tiên trong hệ thống trả lời một câu hỏi
thay vì hiện một cái bảng. Tab chia Trễ / 7 ngày / Sắp tới. Nút "Đề nghị mua"
mở **hộp thoại dẫn từng bước, tick sẵn hết** — không phải form trắng, và không
phải tick hàng loạt.

Kèm chứng từ mới **Đề nghị mua**, và **đổ dữ liệu vào `supply_po_line_lsx` ngay
lúc sinh đề nghị** chứ không bắt ai gắn tay về sau.

**Xong khi**: tạo được một đơn mua mà không mở màn trắng lần nào.
**Rủi ro**: cần chốt quyết định #1 và #3 ở mục 6 trước khi bắt đầu.

### Đợt 4 — Soạn đơn · ~5–7 ngày · **nặng nhất**

`/planning/pos/new` là 6.268 dòng, gần một phần ba toàn bộ mã của phòng, và
gánh 5 mẫu đơn khác nhau. Đây là chỗ dễ vỡ nhất trong cả kế hoạch.

**Không viết lại từ đầu.** Giữ nguyên phần tính toán và validate (đã đúng, có
test); chỉ thay lớp vỏ sang kit mới và thêm đường vào từ Đề nghị mua.

**Xong khi**: soạn đơn từ đề nghị và soạn tay đều ra cùng một kết quả.

### Đợt 5 — Hộp thư việc = trang chủ · ~3 ngày

Gộp `/planning`, `/planning/viec-cua-toi`, `/planning/van-de`, `/planning/hop`
thành **một** màn: việc chia Trễ / Hôm nay / Sắp tới, xuyên mọi loại chứng từ.
Bốn route cũ chuyển hướng qua `MOVED_PREFIXES` trong `proxy.ts`.

**Xong khi**: nav còn 5 mục, và mỗi con số trên nav mở ra đúng chừng ấy dòng.

### Đợt 6 — Hạ cấp bốn màn tra cứu · ~2 ngày

NCC, Vật tư, Tồn, Danh mục rời nav, vào bằng tìm kiếm toàn cục. Đổi vỏ sang kit
mới ở mức tối thiểu.

### Sau đó — cần bạn quyết trước

Trả lại người soạn · Uỷ quyền duyệt · Cảnh báo đơn nằm im. Rẻ về mã nguồn nhưng
là **thay đổi nghiệp vụ**.

---

## 5. Đường lùi

Cơ chế chạy song song `?v4=1` **đã bị gỡ** ngày 09/09/2026 cùng lúc với việc xoá
các mẫu cũ. Đó là chủ ý: nuôi hai bản cùng lúc nghĩa là mọi sửa lỗi phải làm hai
lần, và bản cũ không bao giờ chết.

Thay bằng: **mỗi đợt một nhánh + PR**, bản cũ nằm nguyên trong git. Hỏng thì
`git revert` một PR, không phải gỡ cờ rải khắp mã.

Không dựng lại cơ chế song song. Nếu một đợt lớn quá để revert gọn thì chia nhỏ
đợt đó, đừng chia đôi giao diện.

---

## 6. Sáu quyết định còn treo

Bốn cái đầu chặn Đợt 3 và Đợt 4 — không quyết thì không bắt đầu được.

| #   | Câu hỏi                                                                                                                                        | Chặn đợt |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **80% dòng định mức không có mã vật tư** (807/4.203 có). Phần còn lại tả bằng quy cách thép. Luật quy đổi _quy cách → mã cây thép mua_ do Kỹ thuật hay Cung ứng giữ? | 3        |
| 2   | **Đề nghị mua có cần duyệt riêng không?** Tôi nghiêng một cổng — thêm cổng lúc chưa đau là tự trói.                                              | 3        |
| 3   | **Gộp đơn theo NCC hay tách theo lệnh?** Một mã thiếu cho 3 lệnh: một đơn (rẻ, phải chia lại khi về kho) hay ba đơn (dễ truy, mất giá tốt)?     | 3, 4     |
| 4   | **Ngưỡng "kẹt" mỗi bước.** Đề xuất: nháp 2 ngày · chờ duyệt 1 · chờ NCC xác nhận 3 · quá hẹn giao 0.                                            | 2        |
| 5   | **Giá mua**: 0,08% vật tư có giá. Nhập dần theo đơn, hay có đợt nạp bảng giá NCC?                                                                | 4        |
| 6   | **Trả lại người soạn + Uỷ quyền duyệt** — có làm không, ai được uỷ quyền cho ai?                                                                 | sau      |

---

## 7. Không làm

- **Không thêm trạng thái mới.** 9 trạng thái đang có đã đủ, và chưa cái nào
  chạy quá cái thứ hai.
- **Không làm dashboard biểu đồ ở trang chủ.** Biểu đồ trả lời "tháng này thế
  nào"; người mua hỏi "hôm nay tôi phải làm gì".
- **Không chép hình thức SAP.** Fiori dựng cho hàng nghìn người dùng nhiều quốc
  gia; một xưởng không cần lớp trừu tượng đó.
- **Không đụng 4 route tái dùng của phòng khác** (mục 1).
- **Không viết lại `pos/new` từ đầu** — chỉ thay vỏ.
- **Không nhét file mới vào `ui-baseline.json`** để qua cổng lint.

---

## 8. Thứ tự rút gọn

```
Đợt 0  Sổ cân đối (view SQL)            ~1 ngày    ← không chặn gì, làm ngay được
Đợt 1  Chi tiết đơn                     ~3–4 ngày  ← có mẫu sẵn, rủi ro thấp nhất
Đợt 2  Danh sách đơn                    ~2–3 ngày  ← cần quyết định #4
Đợt 3  Cân đối + Đề nghị mua            ~4–5 ngày  ← cần quyết định #1, #2, #3
Đợt 4  Soạn đơn                         ~5–7 ngày  ← nặng nhất, cần #3, #5
Đợt 5  Hộp thư việc = trang chủ         ~3 ngày
Đợt 6  Hạ cấp 4 màn tra cứu             ~2 ngày
```

**Đợt 0 và Đợt 1 bắt đầu được ngay hôm nay** — không chờ quyết định nào.
