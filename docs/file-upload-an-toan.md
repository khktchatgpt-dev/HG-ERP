# Upload file — tư thế an toàn & giao diện tài liệu

Cập nhật 15/08/2026. Ghi lại **các lớp bảo vệ hiện có** (để không ai gỡ nhầm) và
**những gì còn thiếu** (để không ai tưởng đã đủ).

## 1. Số thật của kho file (đo 15/08/2026)

| | |
|---|---|
| File đang sống | 1.347 · 1.325 MB |
| BOM (Excel BKQC) | 540 file · **1.012 MB = 76% kho** |
| Ảnh sản phẩm | 722 file · 241 MB |
| Nhóm file TRÙNG nhau | 71 nhóm / 191 bản ghi · **lãng phí 323 MB** |
| File mồ côi (init nhưng không finalize) | 2 |

Gói Supabase: **Pro** → dung lượng chưa phải vấn đề tiền. Nhưng 323 MB trùng lặp
là triệu chứng của lỗi MÔ HÌNH: một file `BKQC - LYPRODAN SET.xlsx` mô tả **cả
bộ sản phẩm** mà hệ thống bắt đính riêng từng SP, nên nó nằm trong kho 9 bản.
Sửa giao diện không trị được — xem §4.

## 2. Các lớp bảo vệ (thứ tự file đi qua)

| # | Lớp | Ở đâu | Bắt được gì |
|---|---|---|---|
| 1 | Đuôi file | `lib/file-signature.ts` → `extensionIssue`, gọi ở client + `initUploadSchema` + `uploadFromServer` | `.exe/.bat/.vbs`, Office **có macro** (`.xlsm/.docm/.pptm`), `.svg` |
| 2 | Allowlist MIME | `lib/file-limits.ts` → `ALLOWED_MIME`, gác ở `assertBucketAllowed` | kiểu file ngoài danh sách |
| 3 | Trần dung lượng (khai) | `maxBytesFor(doc_type)` ở client + `initUpload` | file to, báo sớm |
| 4 | Quyền theo hồ sơ cha | `assertCanWriteParent` | ai được đính vào SP/PO/mẫu |
| 5 | Tần suất | `/api/files` POST — 120 lượt / 10 phút / người | tài khoản lộ mật khẩu bơm rác |
| 6 | **Bucket allowed_mime_types** | migration 0151 | PUT thẳng lên Storage với content-type lạ |
| 7 | Trần dung lượng (đo THẬT) | `finalize` → `storage.getObjectSize` | client khai 1MB rồi PUT 40MB |
| 8 | **Chữ ký định dạng** | `finalize` → `storage.readHead` + `signatureIssue` | **đổi đuôi**: `.exe` đội lốt `.pdf` |

Lớp 6 và 8 thêm ngày 15/08/2026. Lớp 8 là lớp DUY NHẤT mở file ra xem bên trong;
nó đọc 8 byte đầu bằng HTTP Range nên không kéo cả file 50MB về server. Từ chối ở
bước này thì object bị xoá khỏi Storage + row xoá mềm ngay, không để lại rác.

**Đã kiểm chứng end-to-end** (15/08): file nội dung `MZ` (exe) đặt tên
`gia-mao.pdf`, khai `application/pdf` → PUT qua được, `finalize` chặn, object bị
gỡ, row `deleted_at` — không lọt vào hồ sơ.

### Nguyên tắc khi sửa các lớp này

- `ALLOWED_MIME` (app) và `allowed_mime_types` (bucket 0151) **phải khớp**. Lệch
  nhau thì upload chết ở tầng Storage với lỗi khó đọc. Có test canh
  (`file-signature.test.ts`).
- `signatureIssue` trả `null` cho định dạng KHÔNG có chữ ký ổn định (text/csv/
  json, dwg/dxf). Cố ý: đoán bừa thì chặn nhầm file thật.
- Đọc byte đầu THẤT BẠI (mạng lỗi, host không trả Range) → **cho qua**. Chặn dựa
  trên một phép đo hỏng sẽ khoá oan việc thật.
- `image/svg+xml` đã bỏ khỏi allowlist khi kho có đúng 0 file SVG. Đừng thêm lại:
  SVG là ảnh duy nhất chạy được `<script>`, mà signed URL trỏ thẳng host Supabase.

## 3. Giao diện tài liệu (hồ sơ SP)

- **Kéo-thả nhiều file** vào cả panel; hàng đợi (`UploadQueue`) có % thật cho
  từng file (PUT bằng `XMLHttpRequest` — `fetch` không báo được tiến độ gửi).
- Đoán loại: đuôi chỉ thuộc một ngăn thì theo đuôi (`.xlsx`→BOM, `.pptx`→đóng
  gói, `.dwg/.dxf`→bản vẽ); còn lại (PDF, ảnh) theo **tab đang mở**. Sửa được
  ngay trong hàng đợi trước khi lưu.
- Tải tuần tự, **một file lỗi không dừng mẻ** — dòng lỗi ở lại kèm lý do.
- Dòng file nói: **ai tải lên** · ngày · dung lượng. Nút **Xem trước** mở ảnh/PDF
  ngay trong trang (`FilePreviewDialog`); định dạng khác thì nói thẳng là phải
  tải về.
- Hạn mức + định dạng hiện ngay trên panel và trong menu, không đợi bị chặn.
- Admin: nút **Dọn file dở** ở `/admin/health` (chỉ xoá file mồ côi > 24h, tránh
  cắt ngang lần upload đang chạy).

## 4. Còn thiếu — xếp theo mức đáng làm

1. **Một file gắn NHIỀU sản phẩm.** Cách duy nhất trị tận gốc 323 MB trùng lặp:
   bảng nối `files ↔ products`, upload một lần rồi tick các SP cùng bộ. Ước
   lượng ~2 buổi vì đụng schema + màn hồ sơ SP + màn thư viện.
2. **Quét virus.** Lớp 1 chặn được macro theo ĐUÔI, nhưng `.xlsm` đổi tên thành
   `.xlsx` thì chữ ký vẫn là ZIP nên lọt — muốn bắt phải giải nén tìm
   `vbaProject.bin`, hoặc gắn ClamAV/dịch vụ quét.
3. **Dò trùng lúc upload.** `checksum` (sha256) đã bật từ 15/08 cho file ≤20MB —
   file cũ vẫn `null`. Có checksum rồi thì cảnh báo "file này đã có trong hồ sơ
   X" là việc nhỏ.
4. **Nới quyền xoá.** Hiện chỉ người tải lên + admin. Nhân viên nghỉ việc là file
   sai của họ nằm vĩnh viễn.
5. **Phiên bản tài liệu.** Cùng SP + cùng loại → xếp chồng v1/v2/v3 thay vì đẻ
   dòng mới.
6. **Xem trước Excel** (SheetJS) — đã dựng rồi bỏ 13/08; giờ có 540 file BOM nên
   đáng cân nhắc lại.
