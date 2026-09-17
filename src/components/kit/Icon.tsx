import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Factory,
  FileSpreadsheet,
  FilterX,
  Gavel,
  Package,
  Pencil,
  PenLine,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShoppingCart,
  SquareArrowOutUpRight,
  Trash2,
  TriangleAlert,
  Truck,
  User,
} from 'lucide-react'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KIT — TỪ VỰNG ICON
 * ═══════════════════════════════════════════════════════════════════════
 *
 * VÌ SAO LÀ BẢN ĐỒ KHÁI NIỆM, KHÔNG PHẢI CỔNG CHUYỂN TIẾP TÊN ICON.
 *
 * Nếu mỗi màn tự `import { Send } from 'lucide-react'` thì sớm muộn "gửi NCC"
 * ở màn này là cánh diều giấy, ở màn kia là mũi tên, ở màn thứ ba là chiếc xe
 * tải — và người dùng phải học lại hình ở từng màn. Ở đây chỗ gọi khai KHÁI
 * NIỆM NGHIỆP VỤ (`gui`, `duyet`, `quaHen`), hình do kit giữ. Đổi hình thì đổi
 * một chỗ, cả app theo.
 *
 * Bản đồ này CỐ Ý ĐÓNG. Thiếu khái niệm thì thêm vào đây kèm một dòng lý do,
 * chứ không mở cửa cho tên icon tự do — mở ra là về lại chỗ cũ.
 *
 * BA LUẬT DÙNG (chép quy ước v3 ở CLAUDE.md, giờ áp cho kit):
 *
 *  1. Icon ĐỨNG TRƯỚC CHỮ trong nút và chip; 16px là cỡ trong nút, 20px cho
 *     tab/điều hướng. Icon đứng MỘT MÌNH bắt buộc có `label` — nó thành nội
 *     dung cho trình đọc màn hình, không còn là trang trí.
 *  2. ICON KHÔNG TỰ MANG MÀU. `currentColor` để nó ăn theo màu chữ bên cạnh;
 *     tô màu riêng là mượn mất ngôn ngữ màu của vòng đời (`--stop/--warn/
 *     --done`) và của hành động (`--act`).
 *  3. Icon KHÔNG THAY CHỮ trong bảng và biểu mẫu. Nó là mốc cho mắt quét, chữ
 *     mới là nội dung — ERP đọc bằng chữ, không đoán bằng hình.
 */
const MAP = {
  /* ── Chứng từ và đối tượng ─────────────────────────────────────────── */
  don: ShoppingCart, // đơn đặt vật tư
  lenh: Factory, // lệnh sản xuất — xưởng, không phải tờ giấy
  ncc: Building2, // nhà cung cấp
  vattu: Package, // vật tư / mặt hàng
  kho: Boxes, // kho, tồn
  tien: CircleDollarSign, // tiền, giá trị

  /* ── Thời gian ─────────────────────────────────────────────────────── */
  hen: CalendarClock, // hẹn giao — lịch CÓ kim đồng hồ: một mốc đang chạy
  quaHen: CalendarX2, // quá hẹn — lịch gạch chéo, đọc được cả khi mất màu
  lich: CalendarRange, // khoảng ngày, lịch hàng về
  cho: Clock, // đang chờ ai đó

  /* ── Bước trong vòng đời ───────────────────────────────────────────── */
  banNhap: PenLine, // bản nháp, đang soạn
  duyet: Gavel, // duyệt / phê duyệt — búa, cùng hình với khu Giám đốc
  gui: Send, // gửi NCC
  nhanHang: Truck, // giao nhận, hàng đang về
  nhapKho: ArrowDownToLine, // nhập kho
  xuatKho: ArrowUpFromLine, // xuất kho
  xong: CircleCheck, // đã xong, đã đủ
  canhBao: TriangleAlert, // vướng, nguy cơ

  /* ── Thao tác ──────────────────────────────────────────────────────── */
  them: Plus,
  sua: Pencil,
  xoa: Trash2,
  mo: SquareArrowOutUpRight, // mở chứng từ / sang trang khác
  in: Printer,
  excel: FileSpreadsheet,
  tim: Search,
  boLoc: FilterX, // bỏ bộ lọc
  lamMoi: RefreshCw,
  toi: User, // của tôi, người phụ trách
} satisfies Record<string, LucideIcon>

export type IcoName = keyof typeof MAP

export function Ico({
  name,
  size = 16,
  /**
   * Icon ĐỨNG MỘT MÌNH thì đây là nội dung của nó. Có `label` = có `role="img"`
   * + `aria-label`; không có = `aria-hidden`, tức icon chỉ trang trí cho chữ
   * đứng cạnh. Không có đường thứ ba: icon câm mà không có chữ nào bên cạnh là
   * một nút không ai đọc được.
   */
  label,
  className,
}: {
  name: IcoName
  size?: number
  label?: string
  className?: string
}) {
  const I = MAP[name]
  return (
    <I
      size={size}
      strokeWidth={1.8}
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
