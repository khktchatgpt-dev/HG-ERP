# Đang làm dở

Ghi lại lúc: 2026-07-16, nhánh `feat/mau-showroom-va-toi-uu-anh`.

Hai mảng làm trong đợt này: **tối ưu chi phí ảnh Supabase** và **quản lý mẫu
showroom (P1)**. `npm run check` sạch (348 test). Dưới đây là những gì CHƯA xong.

---

## 1. Việc phải làm ngay — có hiệu lực sai nếu bỏ qua

### 1.1 Migration `0060` CHƯA APPLY ⚠️

`supabase/migrations/0060_storage_bucket_size_limit.sql` mới nằm trong repo,
**chưa chạy lên Supabase**. Đã kiểm ngày 16/07: `storage.buckets.file_size_limit`
vẫn là 10485760 (10MB) cho cả 3 bucket.

Hệ quả: bảng giới hạn theo `doc_type` (`src/lib/file-limits.ts`) cho `drawing` và
`assembly` 20MB, **nhưng Storage vẫn chặn ở 10MB**. Upload bản vẽ 10–20MB sẽ hỏng
ở bước PUT với lỗi khó hiểu, dù app bảo là hợp lệ.

→ Apply `0060` (SQL editor hoặc `npx supabase db push`).

Ghi chú: `0061_technical_samples.sql` **đã apply** rồi (16/07) và đã verify: 3
bảng, RLS bật + 0 policy, partial unique index `technical_sample_loan_active_uniq`
hoạt động. Types đã sync.

### 1.2 Dữ liệu demo còn trong DB thật

Đang có **4 mẫu `MS-2026-0001` → `MS-2026-0004`** + 2 phiếu mượn, gắn vào SP thật
(`test-03`, `test02`, `TEST-QUICK-01`). Tên người mượn *"Cty TNHH Nội Thất Minh
Long"*, *"Anh Tuấn (Kinh doanh)"* là **bịa** — tạo để xem giao diện.

→ Xoá trước khi dùng thật. Xoá theo mã, ĐỪNG quét theo `product_id` (SP đó có thể
có file/bản vẽ thật):

```sql
delete from technical_sample_loans where sample_id in
  (select id from technical_samples where code like 'MS-2026-%');
delete from technical_samples where code like 'MS-2026-%';
update technical_products set showroom_sample = false
  where code in ('test-03', 'test02', 'TEST-QUICK-01');
delete from doc_counters where kind in ('MS', 'PM');  -- để mã thật bắt đầu từ 0001
```

---

## 2. Mẫu showroom — còn thiếu

### 2.1 Trang chi tiết mẫu — CHƯA CÓ (404)

`/technical/showroom/[id]` chưa tồn tại. Bấm vào mã mẫu ở danh sách là **404**.
Danh sách đã link sẵn tới đó (`SamplesManager.tsx`).

Cần có:
- Thông tin mẫu + đổi vị trí / tình trạng.
- **Sổ theo dõi**: bảng các lượt mượn của mẫu đó, mới nhất trước.
  API đã sẵn sàng: `GET /api/dept/technical/loans?sample_id=…`.
- **Lịch sử tình trạng**: API sẵn sàng, `GET /api/dept/technical/samples/[id]`
  trả kèm `events`.
- **Media 4 góc** (xem 2.2).

### 2.2 Media "4 góc" — hạ tầng xong, CHƯA CÓ UI

Đã có:
- `files.sample_id` (parent kind `sample`, migration 0061) — đã khai ở
  `files.schema.ts`, `files.repo.ts`, `files.service.ts`, `lib/upload.ts`,
  `api/files/route.ts`.
- Quyền: chỉ Kỹ thuật gắn được ảnh mẫu (`files.service.ts`
  `assertCanWriteParent`). Không có nhánh này thì rơi vào "any signed-in user" —
  Sales cũng sửa được ảnh mẫu.
- Quota 4 ảnh/mẫu: `assertSamplePhotoQuota()` trong `files.service.ts`
  (`MAX_SAMPLE_PHOTOS`). Ép ở service, không ở DB — đổi số khỏi migration.
  Có kẽ hở race giữa 2 upload cùng lúc; hậu quả là 5 ảnh, không mất dữ liệu.

Chưa có: **giao diện upload/xem 4 góc** ở trang chi tiết mẫu.

Danh sách hiện dùng **ảnh của SP** (`product_image_file_id`) làm thumbnail — đúng
như đã chốt ("ảnh lấy từ sản phẩm luôn cũng được").

### 2.3 Test bất biến `status` ⟺ sổ — CHƯA VIẾT

Rủi ro lớn nhất của thiết kế: `technical_samples.status = 'on_loan'` là dữ liệu
**suy ra** từ "có phiếu mượn chưa trả", nhưng lưu denormalized để list nhanh.

Đã tự chứng minh là trôi được: chèn thẳng SQL một phiếu mượn (bỏ qua service) thì
mẫu hiện *"Đang sửa"* mà cột "Đang ở đâu" vẫn có người mượn. App không gây ra được
điều này (mọi đường đi đều qua service, đã chặn: xem `samples.schema.test.ts`,
`samples.transitions.test.ts`), nhưng bất biến chưa được test.

→ Viết test: `status='on_loan'` ⟺ tồn tại loan `returned_at is null`.

### 2.4 Event bus — CHƯA LÀM (kế hoạch xếp P2)

Chưa khai `sample.loaned` / `sample.returned` / `sample.lost` ở
`src/events/types.ts`, chưa có handler.

Nhắc quá hạn hiện **chỉ tính lúc đọc** (badge đỏ "quá N ngày" ở cột "Đang ở đâu",
`overdueDays()` trong `SamplesManager.tsx`). Gửi thông báo chủ động cần scheduler
— chưa có trong dự án.

### 2.5 Cột cũ `showroom_sample` — mới xong bước 1/3

Lộ trình 3 bước (xem `docs/ke-hoach-mau-showroom.md` mục 7):

1. ✅ Service tự set `showroom_sample = (SP còn mẫu chưa thanh lý)` —
   `syncProductFlag()` trong `samples.service.ts`.
2. ❌ **Checkbox nhập tay vẫn còn** ở `ProductForm.tsx:472` → hai nguồn sự thật,
   người dùng tick tay một đằng, bảng mẫu một nẻo. Gỡ đi.
3. ❌ Hai chỗ đọc cột cũ chưa chuyển sang bảng mẫu:
   `src/app/print/lsx/[id]/page.tsx:161` và `production.repo.ts:274,287,316`.
   Xong mới `drop column` được.

---

## 3. Tối ưu chi phí ảnh — còn thiếu

Đã đo thật: ảnh gốc 1.981.033 byte PNG → 6.816 byte WebP qua `/_next/image`
(**giảm 99,7%**); lượt xem sau là 304 Not Modified, 300 byte. Token signed URL giữ
nguyên qua reload (cache trình duyệt trúng).

Còn lại:

- **Bước 0 của kế hoạch chưa làm**: mở Supabase dashboard → Reports → Storage đo
  egress THẬT trước/sau. Giờ mới có mốc để so. Con số "79 GB/tháng" trong
  `docs/ke-hoach-toi-uu-file-anh.md` là ước lượng của tôi, chưa đối chiếu.
- **Chưa verify trên production build**: lúc đo, optimizer trả
  `cache-control: max-age=0, must-revalidate` — đó là hành vi dev mode. Production
  sẽ theo `minimumCacheTTL` 4h (`next.config.ts`). Cần xác nhận sau khi deploy.
- **Luồng "đổi ảnh SP xoá ảnh cũ" chưa chạy thử lần nào** trong trình duyệt
  (`ProductImagePanel.tsx`) — lúc làm thì Browser pane hỏng (screenshot timeout,
  click không vào). Đây là phần rủi ro nhất vì nó **xoá vĩnh viễn** ảnh cũ. Thứ
  tự đã cố ý an toàn: tải lên → trỏ đại diện sang ảnh mới → mới xoá ảnh cũ.
  Nhưng cần bấm thử.

---

## 4. Nợ kỹ thuật phát hiện dọc đường (chưa sửa)

- **`docs/test.md` chứa mật khẩu dùng chung của 6 tài khoản test và đang được
  commit vào repo.** Nếu các tài khoản này tồn tại trên production thì nên tách
  mật khẩu ra khỏi git.
- **`ToastProvider` dựng lại object context mỗi lần render**
  (`src/components/ui/Toast.tsx:41` — `const api: Ctx = {...}` không memo). Hệ
  quả: đưa `toast` vào deps của `useCallback`/`useEffect` là lặp vô tận. Đã dính
  một lần ở `ProductImagePanel` (đã sửa bằng cách bỏ khỏi deps). Nên bọc `useMemo`
  để bẫy này không giăng cho người sau.
- **`files.size_bytes` của dữ liệu CŨ không đáng tin** — trước đây là số client tự
  khai, không ai đo lại. Từ 16/07 `finalize` đã ghi đè bằng số đo thật
  (`storage.info()`), nhưng các dòng cũ vẫn giữ số khai. Thống kê dung lượng theo
  cột này chỉ đúng với file tải lên từ nay.
