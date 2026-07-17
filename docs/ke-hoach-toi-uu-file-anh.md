# Kế hoạch tối ưu chi phí file/ảnh (Supabase Storage)

Trạng thái: **đã triển khai bước 1–5** (2026-07-16). Còn lại: bước 0 (đo usage
thật trên dashboard) và apply migration `0060`.

## Kết quả đo thực tế

Ảnh thật trong Storage (`Gemini_Generated_Image…png`, 1.981.033 byte) qua
`/_next/image?w=256&q=75`:

```
[GỐC]    Supabase → 1.981.033 byte  image/png
[TỐI ƯU] /_next/image → 3.634 byte  image/webp   (200 OK)
==> giảm 99,8% byte mỗi lượt xem card
```

`remotePatterns` đã được kiểm đúng phạm vi:

| Request | Phản hồi optimizer |
|---|---|
| host Supabase + `/object/sign/` | `"url" parameter is valid…` → khớp |
| host Supabase + `/object/public/` | `"url" parameter is not allowed` |
| host lạ | `"url" parameter is not allowed` |
| `q=50` | `"q" parameter (quality) of 50 is not allowed` |

Signed URL ổn định: 2 lần gọi cùng object → cùng 1 URL, chỉ ký 1 lần
(`storage.test.ts`).

## 1. Hiện trạng

Ảnh + tài liệu sản phẩm nằm ở Supabase Storage (bucket `attachments`, private),
metadata ở bảng `public.files`. Bytes **không** đi qua Next server: upload PUT
thẳng lên signed upload URL, đọc thì server render ra signed download URL rồi
nhúng vào HTML.

Luồng đọc hiện tại (`technical/products/page.tsx:48-59`):

```
RSC render → với mỗi product → filesService.getDownloadUrl(fileId)
           → storage.createSignedUrl(path, 60)   ← TTL 60 giây
           → <Image src={signedUrl} unoptimized />
```

## 2. Vì sao tốn phí

Chi phí Supabase Storage = **dung lượng lưu** + **egress (băng thông tải về)**.
Egress mới là phần đắt, và hiện tại nó đang bị nhân lên nhiều lần:

| # | Nguyên nhân | Vị trí | Hệ quả |
|---|---|---|---|
| 1 | Thẻ `<Image unoptimized>` | `ProductsManager.tsx:506`, `ProductDetailView.tsx:193`, `QuoteDetailView.tsx:230` | Ô thumbnail 160×112 px vẫn tải về đúng file gốc 10 MB |
| 2 | Signed URL đổi token mỗi lần render | `storage.ts:18-28` | Cache key trình duyệt đổi theo → **cache không bao giờ trúng** → mỗi lần vào trang là tải lại toàn bộ ảnh |
| 3 | Không có `remotePatterns` trong `next.config.ts` | `next.config.ts` | Chính là lý do phải để `unoptimized`; mất luôn resize + WebP/AVIF + cache của Next |

Điểm 2 là chỗ đau nhất về tiền. Supabase trả về `Cache-Control: max-age=3600`
cho object, nhưng vì query string chứa token mới mỗi request, trình duyệt coi
đó là URL khác và tải lại từ đầu.

**Không nén ảnh khi upload** (quyết định 2026-07-16): bản vẽ và ảnh sản phẩm là
dữ liệu gốc, nén vào là mất chi tiết không lấy lại được. Chi phí của việc này
thấp — lưu trữ khoảng $0.021/GB/tháng, 200 SP × ảnh 5 MB ≈ 1 GB ≈ 2 cent/tháng.
Toàn bộ phần tiết kiệm dồn sang tầng phân phối: Next Image resize + WebP ở
server, client nhận ~25 KB, **file gốc trên Storage vẫn nguyên xi**.

**Ước lượng thô** — 200 sản phẩm có ảnh, ảnh trung bình 3 MB, 10 nhân viên mỗi
người mở trang danh sách 5 lần/ngày, mỗi trang 24 ảnh:

```
24 ảnh × 3 MB × 5 lần × 10 người × 22 ngày ≈ 79 GB egress/tháng
```

Chỉ riêng một màn hình danh sách. Sau khi tối ưu (thumbnail WebP ~25 KB + cache
trúng): cùng lưu lượng đó rơi xuống **dưới 1 GB/tháng**, tức giảm khoảng 99%.
Con số này cần đối chiếu lại với usage thật trên dashboard Supabase trước khi
chốt (xem bước 0).

## 3. Bug đang chờ nổ (không liên quan chi phí nhưng phải sửa cùng)

TTL signed URL = **60 giây** (`storage.ts:4`), trong khi URL được nhúng cứng vào
HTML server-render và không có đường refresh phía client. Nghĩa là:

- Mở trang, để đó qua 1 phút → quay lại thấy ảnh vỡ.
- Trang in (`src/app/print/quotes/[id]`, `src/app/print/lsx/[id]`): user mở
  preview, chỉnh khổ giấy, chọn máy in — quá 60 giây là ảnh 403 giữa chừng.

Nâng TTL là một dòng, và nó đi chung với hướng sửa cache ở dưới.

## 4. Kế hoạch

Xếp theo tỉ lệ lợi ích / công sức. Mỗi bước độc lập, làm được từng cái một.

### Bước 0 — Đo trước khi sửa (30 phút)

Vào Supabase dashboard → Reports → Storage: xem egress thật tháng vừa rồi, và
top object theo dung lượng. Không có số này thì không biết bước nào đáng làm
trước, và cũng không chứng minh được là đã tiết kiệm.

Cũng nên chạy nhanh:
```sql
select doc_type, count(*), pg_size_pretty(sum(size_bytes)) as total,
       pg_size_pretty(avg(size_bytes)::bigint) as avg
from public.files where deleted_at is null group by doc_type order by sum(size_bytes) desc;
```

### Bước 1 — Giới hạn dung lượng theo `doc_type` (2–3 giờ)

Thay `MAX_UPLOAD_BYTES` phẳng bằng bảng theo loại. `doc_type` đã có sẵn trong
`initUploadSchema:66` nên không cần migration phía app.

| `doc_type` | Giới hạn | Lý do |
|---|---|---|
| `image` | 5 MB | Ảnh sản phẩm — 5 MB đã dư cho ảnh điện thoại |
| `drawing` | 20 MB | Bản vẽ scan A3 300dpi / PDF nhiều trang |
| `assembly` | 20 MB | Hướng dẫn lắp ráp nhiều hình |
| `bom`, `cert`, `other`, `null` | 10 MB | Giữ như hiện tại |

Việc cần làm:
1. `files.schema.ts`: bỏ `.max(MAX_UPLOAD_BYTES)` khỏi `size_bytes`, chuyển sang
   `superRefine` đối chiếu theo `doc_type`. Export bảng giới hạn để client dùng
   chung, tránh lặp hằng số ở 3 chỗ như hiện nay.
2. `files.service.ts:128`: dùng bảng thay hằng số phẳng.
3. `upload.ts:15` + `FileUploader.tsx:29`: import từ schema, check theo doc_type
   → báo lỗi sớm cho user thay vì để PUT xong mới fail.
4. Migration mới: nâng `file_size_limit` của bucket `attachments` lên 20 MB
   (mức cao nhất trong bảng).

**⚠️ Bước 2 dưới đây là điều kiện để giới hạn này có hiệu lực thật.**

### Bước 2 — Verify dung lượng thật ở `finalize` (1–2 giờ) ⭐ bắt buộc

Hiện `size_bytes` **do client tự khai và server không kiểm lại**:
`initUpload` chỉ so con số client gửi (`files.service.ts:128`), `finalize` chỉ
set `finalized_at` mà không đối chiếu object thật (`files.service.ts:149-155`).
Client khai 1 MB rồi PUT 9 MB vẫn lọt. Thứ duy nhất chặn thật là
`file_size_limit` của bucket.

Mà `file_size_limit` chỉ có **một giá trị cho cả bucket** — không tách theo loại
được. Nên sau bước 1, trần cứng của bucket là 20 MB, và toàn bộ phần chênh
(image chỉ được 5 MB) sẽ **không được thực thi** nếu không có bước này.

Sửa `filesService.finalize`: gọi `storage.from(bucket).info(path)` lấy
`size` thật → nếu vượt giới hạn của `doc_type` thì `storage.remove()` object +
xoá row + throw `BadRequest`. Nếu khớp thì ghi đè `size_bytes` bằng số thật
trước khi `markFinalized` (số hiện trong DB cũng đang là số client khai, nên
thống kê dung lượng ở bước 0 đang không đáng tin).

### Bước 3 — Signed URL ổn định + TTL dài (1–2 giờ)

Trong `files.service.ts`, cache signed URL theo `fileId` trong bộ nhớ server
(`Map<fileId, {url, expiresAt}>`), TTL 1 giờ, trả lại cùng một URL cho đến khi
còn hạn.

Kết quả: URL không đổi giữa các lần render → cache trình duyệt trúng → lần thứ
hai trở đi mở trang là **0 byte egress**. Đây là bước hạ chi phí mạnh nhất mà
không đổi gì về dữ liệu. Đồng thời sửa luôn bug ở mục 3.

Cân nhắc: TTL dài hơn = URL rò rỉ (qua log, qua share link) sống lâu hơn. 1 giờ
là mức cân bằng hợp lý cho ERP nội bộ; nếu thấy nhạy cảm thì để 15 phút, vẫn
tốt hơn 60 giây rất nhiều.

### Bước 4 — Bật Next Image optimization (2–3 giờ) ⭐ gánh phần tiết kiệm chính

1. Thêm `images.remotePatterns` trỏ tới host Supabase trong `next.config.ts`.
2. Bỏ `unoptimized` ở 3 component, khai báo `sizes` đúng với kích thước hiển thị.

Next sẽ resize + chuyển WebP/AVIF và **cache bản đã tối ưu ở server**, nên
Supabase chỉ bị fetch 1 lần cho mỗi ảnh mỗi chu kỳ cache, thay vì mỗi lượt xem.

Vì đã bỏ nén khi upload, đây là bước gánh gần như toàn bộ phần tiết kiệm
egress: file gốc 5 MB nằm yên trên Storage, client chỉ nhận bản WebP ~25 KB
đúng bằng kích thước hiển thị.

Vướng: optimizer cache theo URL, mà signed URL có token → phải làm **sau bước
3** thì cache mới trúng. Nếu vẫn miss nhiều, phương án thay thế là route ổn định
`/api/files/[id]/raw` (302 redirect sang signed URL) rồi cho `<Image>` trỏ vào
đó — nhưng đổi lại tốn băng thông Vercel.

### Bước 5 — Cache-Control cho `/api/files/[id]` (30 phút)

Route trả signed URL hiện không có header cache nào. Thêm
`Cache-Control: private, max-age=<ttl-60>` khớp với TTL ở bước 3 để client khỏi
hỏi lại URL liên tục. Nhỏ, nhưng gần như free.

### Không nên làm

- **Nén ảnh khi upload**: đã loại (xem mục 2) — mất chi tiết bản vẽ, mà tiền
  tiết kiệm được không đáng so với bước 4.
- **Sinh thumbnail riêng lúc upload**: về bản chất vẫn là tạo bản nén, và bước 4
  đã cho kết quả tương đương mà không đụng schema.
- **Supabase Image Transformation** (`/render/image`): tính tiền theo origin
  image, mà bước 4 cho kết quả tương đương gần như miễn phí.
- **Chuyển ảnh sang bucket public**: có tiết kiệm được vài lần gọi API ký URL,
  nhưng ảnh sản phẩm/bản vẽ là dữ liệu kinh doanh, phơi ra public không đáng.

## 5. Thứ tự đề xuất

Hai nhánh độc lập, làm song song được:

- **Nhánh chi phí** (0 → 3 → 5 → 4): phần tiết kiệm thật. Sau bước 3 là đã thấy
  egress rơi rõ trên dashboard; bước 4 hạ nốt phần còn lại.
- **Nhánh giới hạn** (1 → 2): bước 2 là điều kiện để bước 1 có hiệu lực, đừng
  làm 1 mà bỏ 2 — sẽ ra một giới hạn chỉ có trên giấy.

Bước 3 sửa luôn bug ở mục 3, nên nếu chỉ làm được một việc thì làm bước 3.
