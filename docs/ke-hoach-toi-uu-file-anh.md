# Kế hoạch tối ưu ảnh — cho ngày ảnh "rất nhiều"

Chốt hướng: 14/08/2026. (File này được `src/lib/file-limits.ts` trỏ tới từ
trước nhưng chưa từng được viết — nay viết thật, nhân vụ ảnh DSLR 12.8MB làm
vỡ trình xem ảnh ngay ngày đầu nới trần upload 5MB → 50MB.)

## 1. Hiện trạng đo được (14/08/2026)

| Loại | Số file | Tổng | Trung bình | Lớn nhất | >2MB |
|---|---|---|---|---|---|
| image (ảnh SP/mẫu) | 722 | 272 MB | 386 KB | 13 MB | 12 |
| bom | 540 | 1.012 MB | 1,9 MB | 9 MB | 195 |
| drawing | 50 | 39 MB | 793 KB | 5 MB | 3 |

Đọc số cho đúng: **kho ảnh hiện tại KHÔNG phải vấn đề** — 722 ảnh đa số nhập từ
hệ cũ, đã nhỏ (386KB). Vấn đề là **ảnh MỚI từ nay về sau**: trần vừa nới lên
50MB, người dùng bắt đầu đưa thẳng ảnh máy ảnh 10–15MB lên, và mỗi ảnh như thế
đắt gấp ~30 lần một ảnh bình thường ở MỌI tầng phía sau.

### Chuỗi phân phối hiện tại và chỗ rò

```
Storage (gốc) → signed URL (cache 1h, ổn định TRONG 1h) → Next Image (resize + cache 4h)
```

1. **Token đổi mỗi giờ** → key cache của `/_next/image` đổi theo → optimizer tải
   lại ảnh GỐC từ Supabase mỗi giờ, cho TỪNG cỡ hiển thị (384/1080/3840…).
   Ảnh gốc 400KB thì không sao; ảnh gốc 13MB thì mỗi lần là 13MB egress + vài
   giây CPU resize.
2. Cache của Next là **ephemeral** — mất khi restart/redeploy.
3. Đã vá triệu chứng (14/08): `imgOptTimeoutInSeconds` 7→30s, modal xem ảnh đi
   qua resize thay vì tải gốc. Nhưng gốc 13MB vẫn nằm đó, vẫn bị tải đi tải lại.

## 2. Ba bước, theo thứ tự đáng làm

### Bước 1 — Thu nhỏ ảnh NGAY LÚC UPLOAD ở client ⭐ đáng làm trước nhất

Chỉ áp cho `doc_type='image'` (ảnh chụp SP/mẫu): trước khi PUT, canvas resize về
tối đa **2560px cạnh dài, JPEG/WebP chất lượng ~0.85** → ảnh DSLR 13MB co còn
~400–800KB, vẫn dư nét cho màn 4K. Chặn vấn đề TỪ GỐC: mọi tầng sau (egress,
resize, cache) nhẹ đi 20–30 lần, và không phụ thuộc hạ tầng nào cả.

> **Đây là ĐẢO một quyết định cũ** — file-limits.ts từng ghi "cố ý KHÔNG nén ảnh
> khi upload, ảnh là dữ liệu gốc". Gốc rễ của quyết định đó là sợ mất chi tiết
> **BẢN VẼ** — điều đó GIỮ NGUYÊN: drawing/bom/cert/assembly không đụng. Chỉ đổi
> cho **ảnh chụp**: mục đích của nó là nhìn nhận diện sản phẩm, không phải lưu
> trữ kỹ thuật. Ai cần ảnh gốc tuyệt đối thì đính vào tab tài liệu (loại "Khác").
>
> Phương án giữ-cả-hai (upload gốc + bản hiển thị) đã cân nhắc và bỏ: tốn kho
> gấp đôi, code phức tạp hơn (2 file/1 ảnh, xoá phải xoá cặp), mà chưa ai thật
> sự cần ảnh gốc 13MB trong ERP.

Kèm theo: script nén-một-lần 12 ảnh >2MB đang có (tải về, resize, upload đè,
giữ nguyên file id/path → không đụng DB).

Ước lượng: ~1 buổi (sửa `uploadFile`/`FileUploader` + script + test).

### Bước 2 — URL ảnh ổn định + cache bất biến (khi deploy thật / ảnh ×5)

Route nội bộ `/api/img/[fileId]?w=…` (gác session, stream từ Storage, resize
bằng sharp) với `Cache-Control: immutable` — nội dung file không bao giờ đổi
(đổi ảnh = file mới, path mới) nên cache được vĩnh viễn ở trình duyệt lẫn CDN.
Hết cảnh token xoay vòng làm hỏng cache. Supabase chỉ bị kéo đúng 1 lần/ảnh/cỡ.

Ước lượng: ~1 buổi. Đáng làm khi có deploy chính thức sau CDN, hoặc khi thấy
egress Supabase tăng bất thường.

### Bước 3 — Khi lên gói Pro / lưu lượng lớn

- Supabase Image Transformations (`/render/image`, cần Pro): đẩy việc resize
  sang hạ tầng của Supabase, bỏ hẳn tầng sharp của app.
- Nếu tới mức đó mà bom/pdf cũng phình: cân nhắc lifecycle dọn file mồ côi
  (`files.deleted_at` đã soft-delete nhưng object có thể còn trên Storage).

## 3. Không làm

- **Không nén bản vẽ/BOM/chứng chỉ** — dữ liệu gốc, mất là không lấy lại.
- **Không sinh thumbnail server-side lúc finalize** (đã cân nhắc): thêm một
  đường ghi phức tạp (finalize phải tải file về, resize, upload bản phụ, dọn khi
  xoá) trong khi bước 1 đạt cùng kết quả với 1/3 độ phức tạp. Chỉ quay lại
  phương án này nếu sau này cần GIỮ ảnh gốc trên hệ thống.
