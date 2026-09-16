# Kho — hoàn thiện tính năng

Viết 16/09/2026, sau khi bốn bước chính (Nhập · Xuất · Tồn · Danh mục) dựng
xong. Sổ này **xếp hạng phần còn thiếu theo bằng chứng đo được**, không theo
cảm giác "còn thiếu gì thì làm nấy".

Luật xếp hạng, đúng ba luật của `docs/ke-hoach-thuc-hien.md`:

1. Cái đang **chặn người dùng làm xong một việc** đứng trước cái làm đẹp thêm.
2. Cái **đẩy người dùng ra khỏi khu Kho** tính là lỗi, không phải thiếu sót.
3. Không xây màn cho luồng **chưa chạy thật lần nào** — trừ khi chính nó là
   thứ đang chặn luồng chạy thật.

---

## Số đo 16/09/2026

| Phép đo | Số |
| --- | ---: |
| Phiếu nhập · xuất · kiểm kê | 47 · 2 · 1 |
| Phiếu đã bị đảo | 1 |
| Dòng sổ theo đơn · **ngoài đơn** · theo lệnh · lẻ · điều chỉnh | 144 · **3** · 1 · 1 · 117 |
| Dòng sổ có mã lý do | 1 (mã lý do mới bật 15/09, không backfill) |
| **Liên kết trong khu Kho trỏ ra khu khác** | **5** |

---

## A. Đang chặn — làm trước

### A1. Sổ phiếu kho `/warehouse/phieu` ✅ XONG 16/09/2026

**Hai lỗi cùng một chỗ.**

*Lỗi một*: cả ba màn Kho đều có nút "Xem sổ phiếu" trỏ sang `/planning/docs`
— khu Cung ứng, vỏ khác, menu khác. Thủ kho tra lại một tờ phiếu mình vừa
ghi là bị đá ra khỏi khu của mình. Đúng lối mòn "bị đá về vỏ cũ" mà module
Mua hàng đã phải sửa bằng một đợt riêng.

*Lỗi hai, nặng hơn*: **ghi nhầm thì không sửa được từ khu Kho.** Nguyên lý
"không xoá, chỉ đảo" đã có đường ghi (`stockService.reverseDoc`, đã dùng thật
1 lần) nhưng nút đảo chỉ nằm trong màn cũ của Cung ứng. Thủ kho ghi sai một
phiếu, mở khu Kho ra không có cách nào chữa.

Cần: danh sách phiếu (Khuôn C, lọc theo **mã lý do** là bộ lọc chính) +
chi tiết một phiếu (Khuôn D) + hành động **Đảo phiếu** bắt lý do. Phiếu đảo
và phiếu gốc nằm cạnh nhau, phiếu gốc gạch ngang.

Service đã có đủ: `listDocs` · `docDetail` · `reverseDoc`. **Không migration,
không service mới.**

**Đã dựng.** Đúng như dự tính: không migration, không service mới.

| Việc                           | Ở đâu                                            |
| ------------------------------ | ------------------------------------------------ |
| Danh sách (Khuôn C)            | `warehouse/phieu/page.tsx` + `SoPhieuScreen.tsx` |
| Chi tiết (Khuôn D)             | `warehouse/phieu/[id]/`                          |
| Luật chặn đảo — thuần, 11 test | `lib/kho-dao-phieu.ts`                           |
| Đọc ngược quan hệ đảo          | `docsRepo.reversedDocIds()`                      |
| 5 liên kết cũ                  | đã trỏ về `/warehouse/phieu`                     |

Ba điểm đáng ghi lại, vì đều là chỗ suýt làm sai:

- **Luật chặn đảo ra khỏi service.** `reverseDoc` có sáu chốt nhưng chúng chỉ
  lên tiếng SAU khi bấm. Tách thành `canDao` để màn biết luật TRƯỚC khi vẽ nút
  — nút xám phải nói vướng gì và gỡ thế nào. Một chốt ở lại server: đảo phiếu
  nhập còn phải đủ tồn, cái đó phụ thuộc tồn hiện tại nên chỉ server trả lời được.

- **Mã lý do của phiếu cũ suy tại chỗ ĐỌC.** 0197 chỉ bật mã từ 15/09 và không
  ghi lùi. Lọc theo mã mà không suy thì sổ nói "tháng 8 không có phiếu nào".
  `adjust` và `daily` cố ý KHÔNG suy được — bày "chưa có mã" là câu trả lời
  đúng, đoán thành X7 là bịa một con số cho báo cáo kế toán.

- **Dải cảnh báo chỉ hiện khi đang lọc.** Bản đầu treo nó thường trực làm lời
  giải thích; vàng mã hoá vòng đời dữ liệu, treo vĩnh viễn thì nó thành hình
  nền và lần có cảnh báo thật không ai thấy. Câu giải thích xuống chân màn.

Còn cắt chủ đích: rổ "Đã bị đảo" ĐẾM theo trang đang xem — cờ từng dòng thì
luôn đúng vì `reversedDocIds` đọc toàn sổ. Toàn sổ mới có 1 phiếu đảo.

Nghiệm thu trên dữ liệu thật 16/09/2026: PNK-2026-0010 hiện "đã bị đảo" và
gạch ngang, nằm ngay trên PXK-2026-0003 "đảo của PNK-2026-0010"; biên bản
KK-2026-0004 bị chặn đảo kèm câu chỉ sang vòng duyệt kiểm kê; PNK-2026-0055
mở được hộp đảo (CHƯA bấm ghi — đó là việc của chủ dự án).


### A2. Nhập hàng KHÔNG theo đơn `/warehouse/nhap/ngoai-don` ✅ XONG 16/09/2026

Màn Hàng về hiện chỉ nhận được hàng **có đơn mua**. Hàng về không có đơn
(mua lẻ, NCC giao kèm, hàng mượn) thì thủ kho không có đường ghi nào — mà sổ
đã có 3 dòng loại này, tức việc có thật.

`createReceiptDoc` nhận `po_id: null` sẵn. Cần một form nhẹ: NCC + lý do +
lưới mã / số lượng. Dùng lại đúng khung của phiếu nhập theo đơn.
**Đã dựng.** Đúng như dự tính: không migration, không service mới.

| Việc                                  | Ở đâu                                   |
| ------------------------------------- | --------------------------------------- |
| Form (Khuôn F)                        | `warehouse/nhap/ngoai-don/`             |
| Luật đầu phiếu + tổng, thuần, 23 test | `lib/kho-nhap-ngoai-don.ts`             |
| Ô `reason` cho phiếu nhập             | schema + service + mẫu in               |
| Lối vào                               | nút "Nhận không theo đơn" ở màn Hàng về |

**Điểm thiết kế quan trọng nhất không phải là bỏ hai cột Đặt / Đã về.** Đường
này dễ bị lạm dụng: nhẹ tay hơn nhận theo đơn thì người ta dùng nó để né mở
đơn mua, và Cung ứng mất dấu công nợ. Nên form làm ba việc ngược lại:

- **Bắt CHỌN vì sao không có đơn** — bốn lựa chọn, không phải ô gõ tự do. Hai
  người gõ "mua ngoài" và "mua lẻ" là cùng một việc mà báo cáo đếm thành hai
  loại, đúng cái lỗi mà bộ mã lý do sinh ra để dẹp. Mỗi lựa chọn kèm một câu
  nói HỆ QUẢ, vì người chọn cần biết tờ này rồi ai đọc.
- **NCC vừa gõ mà đang có đơn mở thì nói ngay**, kèm mã đơn và đường sang đó.
  Khớp theo tên, ĐÚNG TUYỆT ĐỐI chứ không gần đúng: cảnh báo nhầm NCC một lần
  là người dùng học cách bỏ qua dải đó mãi mãi.
- **Chân màn nói thẳng cái giá**: không gắn đơn mua nên Cung ứng KHÔNG đối
  chiếu công nợ tờ này.

Đầu phiếu dựng y hệt màn nhận theo đơn (FastTab + FieldGrid). Bản thiết kế
đầu tiên vẽ dải chip theo Khuôn F, nhưng thủ kho đi lại giữa hai màn suốt —
đầu phiếu khác hình là bắt họ học hai lần. Artboard đã sửa theo.

Cột Kệ cũng bỏ, cùng lý do với màn nhận theo đơn: service tự đặt hàng đạt vào
khu tiếp nhận, hàng khoá vào kệ khoá. Cất vào kệ thật là B3.

Mẫu in 01-VT nay có dòng "— Lý do nhập kho", nhưng CHỈ khi phiếu có lý do:
phiếu nhập theo đơn để trống `reason` nên 47 tờ cũ in ra không đổi một nét.

Nghiệm thu trên dữ liệu thật 16/09/2026: gõ "CÔNG TY TNHH VẠN VI THÀNH" hiện
đúng dải cảnh báo kèm mã đơn 1/2026-HG/VVT; thêm mã BUL0230, số 500, tổng ra
"500 dùng được"; bản xem trước in đúng mẫu 01-VT kèm dòng lý do. **CHƯA bấm
Ghi sổ** — tờ thử sẽ nằm vĩnh viễn trong sổ thật (sổ chỉ cộng thêm), nên lượt
ghi đầu tiên để chủ dự án tự chạy.


## B. Đáng làm, chưa chặn

### B1. Hoàn kho từ sản xuất `/warehouse/nhap/hoan-kho` ✅ XONG 16/09/2026

Tổ lấy dư thì trả lại kho. `createReceiptDoc` nhận `production_order_id` sẵn,
`issuedByLsx` đã tính NET. Chưa có đường ghi nào ở khu Kho. Sổ: 0 lần — nhưng
cấp cho lệnh cũng mới có 1 lần, nên con số 0 ở đây chưa nói lên điều gì.
**Đã dựng.** Không migration, không service mới.

| Việc                             | Ở đâu                              |
| -------------------------------- | ---------------------------------- |
| Form (Khuôn F)                   | `warehouse/nhap/hoan-kho/`         |
| Luật trần + kiểm, thuần, 17 test | `lib/kho-hoan-kho.ts`              |
| Tập lệnh hoàn kho được           | `lsxReturnRepo.list()`             |
| Lối vào                          | nút "Hoàn kho từ SX" ở màn Hàng về |

**Khác hẳn hai màn nhập kia ở một điểm quyết định cả bố cục: tập vật tư là
ĐÓNG.** Chỉ trả được thứ lệnh đã lĩnh, tối đa bằng phần đã lĩnh chưa hoàn
(`issuedByLsx` tính net). Nên không có ô tìm mã — lưới điền sẵn từ chính thứ
lệnh đang giữ, thủ kho chỉ gõ số trả, và trần từng dòng là con số bên trái nó.

Cũng không có cột Tình trạng: service chặn thẳng `qty_rejected` cho phiếu
hoàn — hàng lỗi xử ở xưởng, không đẩy sang kho thành "hàng khoá" rồi để đó.

Tập lệnh gồm cả lệnh **đã xong**, không chỉ đang chạy: SX xong mới gom vật tư
thừa mang trả là chuyện thường, và đó đúng là tập mà service cho phép. Lệch
nhau thì màn bày một lệnh rồi server từ chối.

Đổi lệnh là đổi URL (`?lsx=`), và trang dựng lại lưới bằng `key` chứ không
đồng bộ state trong effect. Số đang gõ dở thuộc về lệnh cũ, trần của chúng
vừa đổi, nên phải mất đi.

**Đo trước khi dựng, và con số đổi cách làm.** 16/09/2026: 14 lệnh hoàn kho
được, **0 lệnh có dòng cấp gắn lệnh** — dòng `ref_type='lsx'` duy nhất trong
sổ là dòng mồi từ 06/07, `production_order_id` để trống. Nghĩa là hôm nay mọi
lệnh đều rơi vào trạng thái rỗng. Đó không phải lỗi: chưa cấp thì không có gì
để hoàn. Nhưng nó đổi trọng tâm màn: **trạng thái rỗng là màn chính**, phải
nói thật và chỉ đường, nên nó có nút "Lập phiếu xuất cho lệnh này" và màn Xuất
kho nay đọc `?lsx=` để điền sẵn lệnh.

Nghiệm thu trên dữ liệu thật: 14 lệnh vào ô chọn; mở 06/26-27 - MX ra đúng câu
"chưa lĩnh vật tư nào" kèm lý do và nút; bấm nút sang màn Xuất kho thấy
"Cấp cho lệnh 06/26-27 - MX · MERXX HANDELS GMBH". **Đường GHI chưa chạy thật
được** — nó cần ít nhất một phiếu xuất trong sổ, cùng một nút thắt với việc
còn treo của Bước 2.


### B2. Bàn làm việc Kho `/warehouse` (Khuôn A)

Hiện cửa vào là Hàng về. Bốn ô việc (hàng về · chờ cất · chờ cấp · hàng
khoá), mỗi ô một dòng phụ nói **vì sao gấp**. Chỉ đáng làm khi ba màn kia đã
chạy thật vài tuần — trước đó mọi ô đều bằng 0.

### B3. Cất hàng vào kệ thật (C1)

Hiện mọi lượt nhập vào thẳng khu `TIEP-NHAN` (1 dòng sổ đang nằm đó). Bước
cất hàng biến "chờ cất" thành một câu truy vấn. Chỉ đáng khi kho bắt đầu
nhận nhiều chuyến một ngày.

## C. Chưa đáng — có lý do, đừng tự làm

| Việc | Vì sao chưa |
| --- | --- |
| Trả hàng NCC (X3) | `createReturnDoc` có sẵn, nhưng 0 lô hàng khoá trong DB — chưa có gì để trả |
| Xuất huỷ có duyệt (X4) | cần vòng duyệt; chưa ai huỷ lần nào |
| Kiểm kê theo đợt | bảng 0199/0200 có sẵn; làm khi kho nạp xong tồn thật |
| Tồn dự kiến theo thời gian | ba mảnh dữ liệu đã có, nhưng cần đợt giao + nhu cầu lệnh chạy thật |
| Hồ sơ một vật tư (Khuôn E) | danh mục vừa dựng đã trả lời đủ câu của Kho |
| Quét mã vạch | 0/13.229 mã có mã vạch |
| So định mức khi cấp | chủ dự án chốt 16/09: chưa cần |

---

## Thứ tự đề nghị

```
A1 Sổ phiếu + đảo phiếu ✅  →  A2 Nhập ngoài đơn ✅  →  B1 Hoàn kho SX ✅  →  B2 Bàn làm việc
```

A1 làm trước vì nó vừa bịt lỗ "đá người dùng ra khu khác", vừa mở đường chữa
sai — hai thứ chặn việc dùng thật.
