# Thẻ sửa định mức theo từng nhóm — phân tích & kế hoạch

> User (11/08/2026): *"nút chỉnh sửa khi bật lên loạn thông tin, không biết chỉnh
> sửa gì — mỗi nhóm định mức chỉnh sửa thông tin khác nhau, tạo nhóm cũng vậy.
> Nếu cần thiết mỗi nhóm sẽ có thiết kế riêng."*
>
> Bản này CHỈ phân tích và lên kế hoạch. Chưa sửa code.

---

## 1. Đo hiện trạng

Bấm bút chì là dòng biến thành lưới nhập, số ô đúng theo họ khối — nhưng số ô ấy
quá lớn và nằm trên MỘT hàng ngang:

| Họ khối | Ô nhập | Danh sách ô |
|---|---:|---|
| **metal** (Khung) | **18** | STT · Cụm · Tên · Loại · Dày · Rộng · δ · Dài · Phi hao · SL · ĐVT · Màu · Mã khuôn · kg/m · Dài cây · CT/cây · Mã VT · Ghi chú |
| wood (Gỗ) | 13 | STT · Cụm · Tên · Loại gỗ · Dày · Rộng · Dài · Mộng · SL · ĐVT · Vật liệu · Mã VT · Ghi chú |
| sheet (Polywood · Kính) | 13 | STT · Cụm · Tên · Dày · Rộng · Dài · SL · ĐVT · Tấm R · Tấm D · Vật liệu · Mã VT · Ghi chú |
| soft (Nệm · mút · gòn) | 13 | STT · Cụm · Tên · Dày · Rộng · Dài · Mộng · SL · ĐVT · m³/tấm · Vật liệu · Mã VT · Ghi chú |
| fabric (Vải) | 12 | STT · Cụm · Tên · Khổ · Rộng · Dài · SL · ĐVT · Hao % · Vật liệu · Mã VT · Ghi chú |
| supply (Ngũ kim · Bao bì · Tem · Dây kéo) | 8 | STT · Tên hàng hoá · SL · ĐVT · Vật liệu · Màu · Mã VT · Ghi chú |

Khối khung 18 ô: trong đó **6 ô là do bản 0132 hôm nay thêm vào** (mã khuôn,
kg/m, dài cây, CT/cây, mã VT, và ĐVT). Thêm cột để phục vụ cung ứng đã làm dải
ngang vỡ trận.

## 2. Vì sao "loạn"

Bốn nguyên nhân, tách bạch:

1. **Nhãn rời khỏi ô.** Nhãn nằm ở hàng tiêu đề của bảng; dòng đang sửa cách nó
   vài chục dòng, mà bảng lại cuộn ngang — kéo sang phải là nhãn trôi mất. Người
   nhập nhìn 18 ô trắng không biết ô nào là gì.
2. **Trộn ba loại ô khác bản chất trên cùng một hàng.** (a) ô của biểu mẫu BOM
   (Loại · Dày · Rộng · Dài · SL), (b) ô hệ thêm để cung ứng mua được (mã kho ·
   mã khuôn · dài cây · CT/cây), (c) ô hệ TỰ TÍNH nhưng vẫn trông như ô nhập
   (kg/m, CT/cây). Ba thứ này khác nhau về nghĩa vụ: (a) bắt buộc, (b) nên có,
   (c) không cần đụng.
3. **Không phân biệt được đang ở nhóm nào.** Nhóm nào cũng là "một dải ô ngang";
   khác biệt chỉ nằm ở việc ô nào có mặt — mà muốn thấy thì phải đọc hết dải.
4. **Không thấy ô nào bắt buộc.** Chỉ `Tên chi tiết` và `SL` là bắt buộc để lưu,
   nhưng trên lưới chúng trông y hệt 16 ô còn lại.

Cùng bệnh ở **thanh tạo khối**: hỏi `Nhóm · Tiêu đề khối · Vật liệu chung · Cụm ·
ĐVT khối` cho MỌI nhóm, trong khi "Vật liệu chung" (nhôm/sắt/inox) vô nghĩa với
bao bì và tem, còn "Cụm" thì ngũ kim không dùng bao giờ.

## 3. Nguyên tắc thiết kế

- **Vùng nào biểu mẫu không có thì không hiện.** Ngũ kim tuyệt đối không được
  thấy ô tiết diện hay dài cây.
- **Mỗi vùng có nhãn riêng**, nhãn đi cùng ô chứ không nằm ở hàng tiêu đề xa.
- **Tách ô nhập khỏi ô tự tính.** Ô tự tính gom vào một chỗ trong vùng "để cung
  ứng mua", hiện kết quả kèm cách suy ra ("6,0 m · 4 khúc"), bấm đúp mới mở khoá.
- **Ô bắt buộc đánh dấu**, và thẻ không cho lưu khi thiếu.

## 4. Đặc tả từng nhóm

Ký hiệu: **đậm** = bắt buộc · *nghiêng* = hệ tự tính, hiện kết quả.

| Nhóm | Vùng 1 | Vùng 2 | Vùng 3 | Vùng 4 |
|---|---|---|---|---|
| **Khung** | Quy cách tinh: Loại · Dày · Rộng · δ | Cắt và SL: Dài · Phi hao · **SL** | Để cung ứng mua: Mã kho · Mã khuôn → *kg/m* · Dài cây → *CT/cây* | Màu · Ghi chú |
| **Gỗ** | Loại gỗ | Quy cách: Dày · Rộng · Dài · Mộng | **SL** · Mã kho | Ghi chú |
| **Polywood · Kính/mặt đá** | Quy cách: Dày · Rộng · Dài | **SL** | Quy cách tấm: Tấm R × Tấm D · Mã kho | Ghi chú |
| **Nệm / mút / gòn** | Quy cách: Dày · Rộng · Dài | **SL** | m³ mỗi tấm · Mã kho | Ghi chú |
| **Vải / textilene** | Loại vải · Khổ | Quy cách cắt: Rộng · Dài | **SL** · Hao hụt % → *tổng mét* · Mã kho | Ghi chú |
| **Ngũ kim · Bao bì · Tem · Dây kéo** | **ĐVT** · **SL/SP** | Vật liệu · Màu | Mã kho | Ghi chú |

Chung cho mọi nhóm: đầu thẻ hiện **Tên chi tiết** (bắt buộc) + **Cụm** (trừ họ
`supply` — biểu mẫu ngũ kim/bao bì không có cột cụm), và **STT**.

### Tạo khối — cũng cắt theo nhóm

| Nhóm | Hỏi những gì |
|---|---|
| Khung | Tiêu đề khối · Vật liệu chung (nhôm/sắt/inox) · Cụm mặc định |
| Gỗ | Tiêu đề khối · Loại gỗ mặc định |
| Polywood · Kính · Nệm · Vải | Tiêu đề khối |
| Ngũ kim · Bao bì · Tem · Dây kéo | Tiêu đề khối · ĐVT mặc định |

## 5. Quyết định còn treo — thẻ hay lưới

Hai lối nhập phục vụ hai việc khác nhau, và đây là chỗ cần user chốt:

| | Thẻ chia vùng | Lưới ngang |
|---|---|---|
| Sửa một dòng cho chính xác | tốt — có nhãn, có vùng | kém — 18 ô không nhãn |
| Gõ liền 12 dòng | chậm — mở/đóng từng thẻ | tốt — Tab/Enter chạy như bảng tính |
| Giống tờ Excel | không | có |

Ba phương án:

- **A. Bút chì mở thẻ · "Nhập tại chỗ" giữ lưới** *(khuyến nghị)* — mỗi lối một
  việc, không phải bỏ cái nào. Rủi ro: hai lối sửa cùng tồn tại, phải làm rõ
  bằng nhãn nút.
- **B. Bỏ hẳn lưới, chỉ dùng thẻ** — nhất quán tuyệt đối, nhưng nhập hàng loạt
  chậm hẳn; mà nhập hàng loạt chính là đường dùng nhiều nhất khi nạp 187 file.
- **C. Thẻ bung ngay dưới dòng đang sửa** — như A nhưng thẻ đẩy các dòng khác
  xuống thay vì đè lên, vẫn đối chiếu được quy cách dòng trên dưới.

## 6. Ảnh hưởng code

| File | Việc |
|---|---|
| `src/components/technical/part-layouts.ts` | thêm khai báo VÙNG (`zonesFor(groupCode)`) bên cạnh `inputCellsFor` đang có — cùng một nguồn định nghĩa ô, chỉ thêm tầng gom nhóm |
| `src/components/technical/PartRowInline.tsx` | tách phần dựng ô ra dùng chung cho cả lưới và thẻ |
| `PartCardEdit.tsx` *(mới)* | thẻ sửa một dòng, dựng theo `zonesFor` |
| `ProductPartsCard.tsx` | bút chì mở thẻ thay vì bật lưới; thanh tạo khối cắt theo nhóm |
| `bom-calc.ts` | không đổi — công thức đã có (`pcsPerBarFrom`, `fabricTotalM`, `barsForQty`) |

Không đụng schema, không migration, không đổi API.

## 7. Lộ trình

1. `zonesFor(groupCode)` + test: mỗi nhóm ra đúng bộ vùng, không lẫn ô của nhóm khác.
2. `PartCardEdit` cho họ `supply` trước (8 ô, đơn giản nhất) — dựng khung thẻ.
3. Mở rộng sang `metal` (18 ô, khó nhất) — chốt được cách bày vùng "để cung ứng mua".
4. Bốn họ còn lại.
5. Thanh tạo khối cắt theo nhóm.
6. Verify tay trên `C0097HG-IR` (hồ sơ đã nhập sẵn 15 chi tiết từ file BKQC).

## 7b. Đã làm (11/08/2026)

User chốt **phương án A** — bút chì mở thẻ, "Gõ nhiều dòng" giữ lưới.

| # | Việc | Trạng thái |
|---|---|---|
| 1 | `zonesFor(groupCode)` trong `part-layouts.ts` + `part-zones.test.ts` | ✅ 32 test: vùng gộp lại đúng bằng bộ ô của lưới, không ô nào lặp, ngũ kim không có ô tiết diện / dài cây / cụm |
| 2 | Tách `PartField.tsx` — một ô nhập dùng chung cho cả lưới và thẻ | ✅ lưới và thẻ đọc cùng một định nghĩa, không lệch nhau |
| 3 | `PartCardEdit.tsx` — thẻ chia vùng, nhãn từng ô, ô bắt buộc gắn dấu `*` | ✅ |
| 4 | Bút chì mở thẻ ngay dưới dòng (colSpan), nút cũ đổi tên thành **"Gõ nhiều dòng"** | ✅ |
| 5 | Thanh tạo khối: ẩn "Vật liệu khung" trừ khối khung, ẩn "Cụm" với ngũ kim/bao bì | ✅ |

Hai chỗ phải vá thêm khi thử thật trên `C0097HG-IR`:

- Thẻ nằm trong bảng cuộn ngang nên mở lúc đang kéo sang phải thì **nửa trái thẻ
  ra ngoài màn** → kéo bảng về đầu khi mở thẻ.
- Ô chứa thẻ trải hết bề ngang bảng (colSpan) nên hàng nút bị `ml-auto` đẩy ra
  **tận mép phải ngoài tầm nhìn** → ghim bề rộng thẻ `min(100%, 56rem)`.

## 8. Rủi ro

- **Thẻ dài quá màn hình** với khối khung (4 vùng). Nếu vượt, gom vùng 4 (Màu ·
  Ghi chú) vào một dòng cuối.
- **Hai lối sửa** (phương án A) dễ gây câu hỏi "sửa ở đâu". Giảm bằng cách đổi
  nhãn nút: bút chì = "Sửa dòng này", nút kia = "Gõ nhiều dòng".
- Chưa có gì bảo đảm bộ vùng đúng với thói quen xưởng — nên làm họ `supply`
  trước, cho user xem thật rồi mới nhân ra 5 họ còn lại.
