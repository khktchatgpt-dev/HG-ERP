# Đánh giá hệ thống — Bộ phận Kế hoạch SX / Cung ứng (`/planning`)

Tài khoản test: `cungung.test@hg.com` (NV · Kế Hoạch SX-cung ứng, role `employee`)
Ngày test: 13/07/2026 · Phương pháp: đăng nhập trực tiếp qua trình duyệt (localhost:3000) + chạy test suite Vitest + rà soát code.

---

## Tóm tắt

Bộ phận cung ứng có nghiệp vụ **lõi rất chắc**: tạo PO từ LSX với đề xuất mua thông minh (net tồn − giữ chỗ − đã đặt), ràng buộc BR-05 / BR-06 được thực thi và có unit test đầy đủ. Test suite **286/286 pass** (riêng module supply 23/23).

Tuy nhiên có **1 lỗi chặn (blocker)**: trang **Nhà cung cấp** — nơi "Thêm NCC" và bảng giá NCC — **crash hoàn toàn với chính role Cung ứng**. Đây là chức năng được liệt kê trong `test.md` ("Thêm NCC") nên mức độ ưu tiên cao.

---

## Kết quả test từng chức năng

| Chức năng | Đường dẫn | Kết quả |
|---|---|---|
| Đăng nhập role cung ứng | `/login` → `/planning` | ✅ OK |
| Dashboard tổng quan (stats + quick link) | `/planning` | ✅ OK — số liệu đúng (5 NCC, 1 PO đã gửi, 1 LSX đang SX) |
| Danh sách PO (lọc, sắp xếp, phân trang) | `/planning/pos` | ✅ OK — 2 PO, bộ lọc trạng thái/NCC hoạt động |
| **Tạo PO từ LSX** | `/planning/pos` → *+ Tạo đơn đặt* | ✅ OK — chọn LSX tự nạp **Đề xuất mua theo bảng chi tiết** (cần/tồn khả dụng/đã đặt/đề xuất), nút *Điền theo đề xuất* điền đúng dòng + đơn vị phụ (kg/cây), cảnh báo ⚠ vật tư thiếu định mức |
| Tiến độ sản xuất (điều phối LSX) | `/planning/production` | ✅ OK — đổi giai đoạn / báo hoàn thành trên bảng |
| **Nhà cung cấp (Thêm NCC + bảng giá)** | `/planning/suppliers` | ❌ **CRASH** — "This page couldn't load. A server error occurred." |

> Lưu ý: mình **không bấm submit** ở bước tạo PO để tránh tạo dữ liệu thật + gửi thông báo cho Giám đốc. Toàn bộ luồng đã chạy đúng tới ngay trước khi gửi duyệt.

---

## 🐞 Lỗi chặn: trang Nhà cung cấp crash với role Cung ứng

**Hiện tượng:** vào `/planning/suppliers` (hoặc bấm quick-link "Nhà cung cấp" / menu sidebar) → error boundary "This page couldn't load", digest `ERROR 49697413`. Chỉ role Cung ứng bị; admin/manager vào bình thường → nên dễ bị lọt khi kiểm thử bằng tài khoản admin.

**Nguyên nhân gốc:** `src/app/(workspace)/planning/suppliers/page.tsx` (dòng ~14) gọi:

```ts
materialsService.list(user, { page: 1, page_size: 1000, active_only: true })
```

`materialsService.list` chặn quyền bằng `canViewWarehouse(user)` — chỉ cho **admin / manager / phòng Kho**. NV Cung ứng (role `employee`, phòng "Kế Hoạch SX-cung ứng") **không** qua được → `throw Forbidden(403)` → `Promise.all` reject → Server Component render lỗi → error boundary.

**Bằng chứng đối chiếu:** trang PO anh em `pos/page.tsx` lấy danh mục vật tư qua **repo trực tiếp, không gate**:

```ts
materialsRepo.list({ active_only: true, page: 1, page_size: 1000 })   // ✅ pos → chạy tốt
materialsService.list(user, { ... })                                  // ❌ suppliers → 403
```

Cùng mục đích (nạp danh mục vật tư cho picker) nhưng hai trang dùng hai đường khác nhau → suppliers vỡ.

**Đề xuất sửa (1 dòng, theo đúng pattern trang PO):** trong `suppliers/page.tsx` đổi lời gọi materials sang `materialsRepo.list({ active_only: true, page: 1, page_size: 1000 })` và bỏ `user` khỏi lời gọi đó (nhớ import `materialsRepo`). Hoặc, nếu muốn giữ service, mở `canViewWarehouse` cho phòng Cung ứng (read-only danh mục vật tư).

**Hệ quả hiện tại:** NV Cung ứng **không thể Thêm NCC / quản lý bảng giá qua UI** (dù API `POST /api/dept/supply/suppliers` vẫn cho phép — service `suppliersService.create` chỉ cần `isSupplyStaff`, đã có test pass). Nghĩa là backend đúng quyền, chỉ trang UI vỡ.

---

## Đánh giá logic nghiệp vụ (rà code + unit test)

Phần lõi được thiết kế tốt và có test bảo vệ:

- **BR-06** (1 PO = 1 LSX + 1 NCC): service kiểm tồn tại NCC/LSX, chặn NCC ngừng giao dịch, chặn LSX chưa được GĐ duyệt. ✅ có test.
- **BR-05** (chưa duyệt không gửi NCC): `advance` chỉ cho `approved → ordered`; mọi trạng thái khác bị chặn 400. ✅ có test (`it.each` các trạng thái).
- **Phân quyền:** tạo/sửa PO, NCC, bảng giá đều gate `isSupplyStaff`; duyệt PO gate manager/admin; NV thường không duyệt được. ✅ có test.
- **Sửa PO** chỉ khi `pending_approval` (sau duyệt là cam kết). ✅ có test.
- **Đề xuất mua** (`po-suggestion` + `orderedPendingByLsx`): dùng `qty_missing` của PO đã duyệt để không đếm trùng hàng đã về; PO chờ duyệt chỉ cảnh báo, không tự trừ. Logic thuần, có test riêng (8 test pass).
- **So giá NCC** (`pickCurrentPrices`): lấy giá hiệu lực ≤ ngày, bỏ giá tương lai, sort rẻ trước, không quy đổi khác tiền tệ. ✅ có test.

---

## Quan sát nhỏ (không chặn)

- **Cảnh báo hydration của Next.js** hiện trên overlay dev là do **extension trình duyệt** chèn thuộc tính `__processed_...` vào `<body>` (giá trị đổi mỗi lần load) — **không phải bug của app**. Có thể bỏ qua; nếu muốn overlay sạch khi dev thì test ở cửa sổ ẩn danh / tắt extension.
- **UX khi lỗi:** trang suppliers rơi thẳng vào error boundary trắng. Nên có `error.tsx` thân thiện hơn cho khu vực workspace, hoặc fallback danh mục vật tư = `[]` để trang vẫn mở được phần NCC.
- Chưa test bước **submit tạo PO** và **duyệt PO** (cần tài khoản GĐ + chấp nhận tạo dữ liệu thật). Có thể chạy nếu anh muốn nghiệm thu đầu-cuối.

---

## Khuyến nghị ưu tiên

1. **Sửa ngay** trang `/planning/suppliers` (blocker — 1 dòng) để NV Cung ứng dùng được "Thêm NCC" + bảng giá.
2. Rà các trang workspace khác xem còn chỗ nào gọi `*.Service.list` bị gate nhầm phòng (pattern giống lỗi này).
3. (Tuỳ chọn) Thêm E2E test đăng nhập đúng role cho từng trang workspace để bắt sớm lỗi "chạy với admin nhưng vỡ với role thật".
