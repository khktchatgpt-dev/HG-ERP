<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:hg-erp-ui-rules -->

# HG-ERP UI/UX Design System Rules (BẮT BUỘC CHO MỌI AGENT & CLAUDE CODE)

Dự án này là hệ thống **Phần mềm Quản trị Doanh nghiệp Sản xuất (Enterprise ERP)** phục vụ công nhân viên, kế toán, cung ứng, quản đốc xưởng và ban giám đốc.
**ĐÂY LÀ HỆ THỐNG ERP CHUYÊN NGHIỆP, TUYỆT ĐỐI KHÔNG PHẢI LANDING PAGE HAY DỰ ÁN NGHỆ THUẬT.**

---

### 1. TUYỆT ĐỐI CẤM (Anti-Patterns):

- ❌ **CẤM giả lập vật thể thực (Skeuomorphism)**: Tuyệt đối không dựng màn hình thành "tờ phiếu in", "tờ giấy A4", "con dấu mộc xoay nghiêng `-rotate-3`", hay chia lề giấy kỳ dị. Đây là giao diện ứng dụng web SaaS ERP trên màn hình máy tính.
- ❌ **CẤM chia layout bất đối xứng hẹp**: Không tạo sidebar ghim dính 200px chèn ép bảng dữ liệu. Bảng dữ liệu lớn phải được ưu tiên không gian hiển thị rộng rãi, rõ ràng.
- ❌ **CẤM đặt thanh hành động nổi dính đáy màn hình (Sticky floating bottom bar)** một cách đơn độc. Action Toolbar phải luôn đặt ở **Góc trên bên phải của Header** theo chuẩn ERP (nút chính nổi bật + dropdown menu ⋯ cho tác vụ phụ).
- ❌ **Màn MỚI và màn DỰNG LẠI không dùng bộ kit** (`@/components/kit`, `@/components/erp/*`, `@/components/shadcn/*`) — chốt 03/11/2026. Viết CSS riêng của khu theo lối ERP ở [`docs/erp-khong-kit.md`](docs/erp-khong-kit.md). Không import kit mà vẫn dùng nút bo góc, chip tròn, thẻ bóng đổ thì vẫn là dáng kit — cũng không được.
- ⚠️ **Ưu tiên token hệ thống** cho màu: `var(--primary)`, `var(--warn)`, `var(--done)`, `var(--stop)`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground` — để một màu hành động, ba màu vòng đời còn có nghĩa. Không còn lint chặn màu cứng (gỡ 30/09/2026), nên đây là kỷ luật, không phải hàng rào.

---

### 2. BỘ KIT UI — CHỈ ĐỂ SỬA TẠI CHỖ MÀN CŨ

> **Màn MỚI KHÔNG dùng kit** — theo [`docs/erp-khong-kit.md`](docs/erp-khong-kit.md) (chốt 03/11/2026).
> `@/components/kit` và danh sách bộ CŨ dưới đây chỉ dùng khi sửa nhỏ tại chỗ màn đang chạy bằng chúng.
> Trong một file chỉ dùng MỘT hệ; trộn hai hệ là hai bộ token đánh nhau.

Bộ cũ (`src/components/erp/*` & `src/components/shadcn/*`):

- **Chuỗi liên kết chứng từ cha → con**: Dùng `@/components/erp/RefChain` (ví dụ: Đơn hàng khách → Lệnh sản xuất → Đơn đặt vật tư).
- **Mã chứng từ & mã vật tư**: Dùng `@/components/erp/DocChip` (font mono trên nền tint accent).
- **Dải chỉ số KPI đầu trang**: Dùng `@/components/erp/StatTile` & `StatTiles` (4 thẻ tóm tắt trạng thái, hạn giao, tiến độ nhập kho, tổng tiền).
- **Thanh trạng thái / Stepper vòng đời**: Dùng `PoStatusStepper` hoặc `OrderStageBar`.
- **Thanh điều hướng**: Dùng `@/components/erp/Breadcrumbs` + liên kết quay lại danh sách (`<ArrowLeft />`).
- **Bảng dữ liệu**: Dùng `@/components/shadcn/table` (bắt buộc sticky header `TableHeader`, font-mono căn phải cho số lượng và tiền tệ, chân bảng tổng kết kế toán).
- **Phân tách nội dung nghiệp vụ**: Dùng `@/components/shadcn/tabs` (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`).
- **Thao tác hành động**: Nút hành động chính (Primary Action) + nút phụ + DropdownMenu (⋯) luôn đặt ở **Góc trên bên phải của Page Header**.
- **Nhãn trạng thái**: Dùng `@/components/Badge` với hệ tone chuẩn (`primary`, `warn`, `done`, `stop`, `gray`).
- **Trạng thái rỗng**: Dùng `@/components/erp/EmptyState`.

---

### 3. MÀN HÌNH MẪU ĐỂ THAM KHẢO & BẮT CHƯỚC (Gold Standard References):

**MÀN MỚI → theo sáu khuôn màn.** Sổ `/design-lab` (màn mẫu, sách tra, trang chụp) ĐÃ XOÁ
07/10/2026 — đừng dựng lại trang nào dưới `src/app/design-lab`, kể cả trang tạm để duyệt.
Việc đầu tiên là xác định màn thuộc khuôn nào, rồi mở MÀN THẬT cùng khuôn làm tham chiếu:

| Khuôn              | Trả lời câu hỏi                                 | Màn thật tham chiếu                       |
| ------------------ | ----------------------------------------------- | ----------------------------------------- |
| A · Vào việc       | Hôm nay tôi phải làm gì?                        | `/mua-hang` (Bàn làm việc)                |
| B · Hộp thư        | Việc nào chờ tôi, ở MỌI loại chứng từ?          | `/mua-hang/hop-thu`, `/exec/approvals`    |
| C · Danh sách      | Trong tập này, cái nào cần tôi động vào?        | `/mua-hang/don`, `/mua-hang/vat-tu`       |
| D · Chứng từ       | Tờ này ở đâu, ai giữ, vướng gì?                 | `/mua-hang/don/[id]`, `/thongke/lsx/[id]` |
| E · Hồ sơ danh mục | Đối tượng này là ai, làm ăn ra sao, dùng ở đâu? | `/mua-hang/ncc/[id]`, `/khuon/[id]`       |
| F · Bảng nhập liệu | Khai 40 dòng nhanh như Excel mà không sai?      | `/mua-hang/don/moi`, `/thongke/ghi`       |

Quy trình (nhiệm vụ → luồng → artboard Artifact HTML được duyệt → dựng → kiểm), nguyên tắc và
luật kiểm: skill `erp-ui` (`.claude/skills/erp-ui/`). Xem thêm mục "Thiết kế theo hướng ERP"
trong CLAUDE.md.

**Hai nhầm lẫn hay gặp**: hồ sơ danh mục (E) KHÔNG có vòng đời duyệt — chỗ của ba trục trạng
thái ở đó là dải hiệu suất; màn nhập liệu (F) thì lưới là nhân vật chính, đầu đơn co thành
dải chip chứ không phải lưới nhãn–giá trị.

**Màn CŨ (168 file, còn theme v3 + `@/components/erp`)** — sửa tại chỗ thì bám các mẫu này:

- **Trang Chi tiết Đơn đặt hàng (PO)** (đã chuyển sang kit mới): `src/app/(workspace)/planning/pos/[id]/PoDetailScreen.tsx`
- **Trang Chi tiết Đơn hàng (Sales Order)**: `src/components/sales/OrderDetailView.tsx`
- **Trang Chi tiết Lệnh sản xuất (LSX)**: `src/components/production/LsxDetailView.tsx`

<!-- END:hg-erp-ui-rules -->
