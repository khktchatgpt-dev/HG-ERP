import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpFromLine,
  Ban,
  BookOpen,
  Boxes,
  Building2,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Columns3,
  CircleDollarSign,
  CircleX,
  Clock,
  Copy,
  Factory,
  FileSpreadsheet,
  FileText,
  FilterX,
  History,
  Info,
  Lock,
  NotebookPen,
  Package,
  Pencil,
  PenLine,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Route,
  Save,
  Search,
  Send,
  ShoppingCart,
  SquareArrowOutUpRight,
  Stamp,
  StickyNote,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
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
  // Thêm 24/09/2026 (bước icon) — mỗi cái lặp lại ở ≥ 2 màn kit:
  hoaDon: ReceiptText, // hoá đơn NCC — tờ biên nhận, khác `tien` (con số)
  baoGia: FileText, // báo giá chờ duyệt — tờ văn bản, chưa phải đơn
  so: BookOpen, // một SỔ: sổ công nợ, sổ phiếu, sổ hoá đơn — trang đọc dồn
  ghiChu: StickyNote, // ghi chú đính trên chứng từ

  /* ── Thời gian ─────────────────────────────────────────────────────── */
  hen: CalendarClock, // hẹn giao — lịch CÓ kim đồng hồ: một mốc đang chạy
  quaHen: CalendarX2, // quá hẹn — lịch gạch chéo, đọc được cả khi mất màu
  lich: CalendarRange, // khoảng ngày, lịch hàng về
  cho: Clock, // đang chờ ai đó

  /* ── Bước trong vòng đời ───────────────────────────────────────────── */
  banNhap: PenLine, // bản nháp, đang soạn
  // Duyệt / phê duyệt / ký — CON DẤU. Trước 24/09 khái niệm này mang BỐN hình:
  // búa ở đây, con dấu ở Trang chủ GĐ, khiên ở Chi tiết duyệt, dấu tích ở Trung
  // tâm duyệt — bốn màn liền nhau của cùng một người. Chọn con dấu vì thanh điều
  // hướng khu GĐ (chỗ người ký nhìn MỖI NGÀY) đã dùng nó cho mục Chờ tôi phê
  // duyệt, và vì duyệt ở đây là ký + đóng dấu, không phải xử án.
  duyet: Stamp,
  traLai: Undo2, // trả lại để sửa — phiếu quay về nháp, KHÔNG phải xoá
  ghiSo: NotebookPen, // ghi sổ / ghi sản lượng — con số thành chính thức
  luuNhap: Save, // lưu nháp — chưa thành chính thức, khác `ghiSo`
  dinhHinh: Route, // định hình lộ trình công đoạn của lệnh
  gui: Send, // gửi NCC
  nhanHang: Truck, // giao nhận, hàng đang về
  nhapKho: ArrowDownToLine, // nhập kho
  xuatKho: ArrowUpFromLine, // xuất kho
  xong: CircleCheck, // đã xong, đã đủ
  canhBao: TriangleAlert, // vướng, nguy cơ
  // Một màn (Chi tiết duyệt) nhưng là khái niệm riêng mà người ký cần nhận ra
  // ngay: giá cao hơn lần mua trước. `canhBao` chung chung thì mất nghĩa đó.
  giaTang: TrendingUp,
  // Hai khái niệm thêm 24/09/2026 cho `Toast` (B2): thao tác HỎNG, và tin
  // trung tính. Tách `loi` khỏi `canhBao`: cảnh báo là "làm được nhưng coi
  // chừng", lỗi là "không làm được" — hai việc người dùng phải phản ứng khác nhau.
  loi: CircleX, // thao tác không thành
  thongTin: Info, // tin trung tính, không cần làm gì

  /* ── Thao tác ──────────────────────────────────────────────────────── */
  them: Plus,
  sua: Pencil,
  xoa: Trash2,
  // Ba khái niệm của thanh hành động chứng từ (Action), mỗi cái ≥ 2 màn:
  saoChep: Copy, // sao chép / nhân bản thành chứng từ mới
  huy: Ban, // huỷ, ngừng — chứng từ còn đó nhưng thôi hiệu lực (khác `xoa`)
  khoa: Lock, // khoá — chặn thao tác tiếp, mở lại được
  // Đảo phiếu: ghi một phiếu NGƯỢC, phiếu gốc còn nguyên — nguyên lý "không xoá
  // chỉ đảo" của hệ. Cố ý khác `traLai` (Undo2: về nháp) và `xoa` (thùng rác).
  dao: RotateCcw,
  mo: SquareArrowOutUpRight, // mở chứng từ / sang trang khác
  in: Printer,
  excel: FileSpreadsheet,
  tim: Search,
  boLoc: FilterX, // bỏ bộ lọc
  lamMoi: RefreshCw,
  toi: User, // của tôi, người phụ trách
  lichSu: History, // lịch sử ký, vết thay đổi
  baoCao: ChartColumn, // báo cáo, tiến độ luỹ kế
  // Bảng (B5, 24/09/2026) — có mặt ở MỌI bảng dùng máy bảng:
  sapTang: ArrowUp, // cột đang sắp tăng dần
  sapGiam: ArrowDown, // cột đang sắp giảm dần
  sapXep: ArrowUpDown, // cột sắp được, đang chưa sắp
  cot: Columns3, // chọn cột hiển thị + mật độ
  tick: Check, // dấu chọn trong menu — KHÁC `xong` (vòng tròn: một việc đã xong)

  /* ── Di chuyển ─────────────────────────────────────────────────────── */
  // Hai nghĩa KHÁC nhau, đừng gộp: `quayLai` là rời màn về nơi đã đến (mũi
  // tên thẳng); `truoc`/`sau` là bước sang phần tử liền kề trong CÙNG một dãy
  // (trang, phiếu n/N) — chữ V, như mọi bộ phân trang.
  quayLai: ArrowLeft,
  truoc: ChevronLeft,
  sau: ChevronRight,
} satisfies Record<string, LucideIcon>

export type IcoName = keyof typeof MAP

/**
 * NGHĨA của từng khái niệm — cho trang tra `/design-lab/thanh-phan/icon`.
 * Kiểu `Record<IcoName, …>`: thêm khái niệm vào MAP mà quên ghi nghĩa ở đây là
 * lỗi biên dịch, nên trang tra không bao giờ thiếu dòng.
 */
export const ICO_MEANING: Record<
  IcoName,
  readonly ['Đối tượng' | 'Thời gian' | 'Vòng đời' | 'Thao tác' | 'Di chuyển', string]
> = {
  don: ['Đối tượng', 'Đơn đặt vật tư / đơn mua'],
  lenh: ['Đối tượng', 'Lệnh sản xuất'],
  ncc: ['Đối tượng', 'Nhà cung cấp'],
  vattu: ['Đối tượng', 'Vật tư, mặt hàng'],
  kho: ['Đối tượng', 'Kho, tồn kho'],
  tien: ['Đối tượng', 'Tiền, giá trị, thanh toán'],
  hoaDon: ['Đối tượng', 'Hoá đơn NCC, đối chiếu hoá đơn'],
  baoGia: ['Đối tượng', 'Báo giá chờ duyệt'],
  so: ['Đối tượng', 'Một sổ: công nợ, phiếu, hoá đơn'],
  ghiChu: ['Đối tượng', 'Ghi chú đính trên chứng từ'],
  hen: ['Thời gian', 'Hẹn giao — một mốc đang chạy'],
  quaHen: ['Thời gian', 'Quá hẹn'],
  lich: ['Thời gian', 'Khoảng ngày, lịch, kế hoạch'],
  cho: ['Thời gian', 'Đang chờ ai đó'],
  banNhap: ['Vòng đời', 'Bản nháp, đang soạn'],
  duyet: ['Vòng đời', 'Duyệt, phê duyệt, ký'],
  traLai: ['Vòng đời', 'Trả lại để sửa — về nháp, không xoá'],
  gui: ['Vòng đời', 'Gửi NCC'],
  nhanHang: ['Vòng đời', 'Giao nhận, hàng đang về'],
  nhapKho: ['Vòng đời', 'Nhập kho'],
  xuatKho: ['Vòng đời', 'Xuất kho'],
  ghiSo: ['Vòng đời', 'Ghi sổ — con số thành chính thức'],
  luuNhap: ['Vòng đời', 'Lưu nháp — chưa chính thức'],
  dinhHinh: ['Vòng đời', 'Định hình lộ trình công đoạn'],
  xong: ['Vòng đời', 'Đã xong, đã đủ, không có gì bất thường'],
  canhBao: ['Vòng đời', 'Vướng, nguy cơ — làm được nhưng coi chừng'],
  giaTang: ['Vòng đời', 'Giá cao hơn lần mua trước'],
  loi: ['Vòng đời', 'Thao tác không thành'],
  thongTin: ['Vòng đời', 'Tin trung tính'],
  them: ['Thao tác', 'Thêm, soạn, tạo mới'],
  sua: ['Thao tác', 'Sửa'],
  xoa: ['Thao tác', 'Xoá — việc không lùi được'],
  saoChep: ['Thao tác', 'Sao chép, nhân bản thành chứng từ mới'],
  huy: ['Thao tác', 'Huỷ, ngừng — còn đó nhưng thôi hiệu lực'],
  khoa: ['Thao tác', 'Khoá — chặn thao tác tiếp, mở lại được'],
  dao: ['Thao tác', 'Đảo phiếu — ghi phiếu ngược, không xoá'],
  mo: ['Thao tác', 'Mở chứng từ / sang trang khác'],
  in: ['Thao tác', 'In, bản in'],
  excel: ['Thao tác', 'Xuất Excel, bảng kê'],
  tim: ['Thao tác', 'Tìm'],
  boLoc: ['Thao tác', 'Bỏ bộ lọc, xem tất cả'],
  lamMoi: ['Thao tác', 'Làm mới'],
  toi: ['Thao tác', 'Của tôi, người phụ trách'],
  lichSu: ['Thao tác', 'Lịch sử ký, vết thay đổi'],
  baoCao: ['Thao tác', 'Báo cáo, tiến độ luỹ kế'],
  quayLai: ['Di chuyển', 'Về nơi đã đến'],
  truoc: ['Di chuyển', 'Phần tử trước trong cùng một dãy'],
  sau: ['Di chuyển', 'Phần tử sau trong cùng một dãy'],
  sapTang: ['Thao tác', 'Cột đang sắp tăng dần'],
  sapGiam: ['Thao tác', 'Cột đang sắp giảm dần'],
  sapXep: ['Thao tác', 'Cột sắp xếp được, đang chưa sắp'],
  cot: ['Thao tác', 'Chọn cột hiển thị và mật độ dòng'],
  tick: ['Thao tác', 'Dấu chọn trong menu — khác xong'],
}

export function Ico({
  name,
  size = 16,
  label,
  className,
  style,
}: {
  /** Khái niệm nghiệp vụ (`duyet`, `quaHen`, `ghiSo`…). Tập ĐÓNG — không nhận tên hình tự do. */
  name: IcoName
  /** 16 trong nút, 14 trong chip và tiêu đề khối, 13 trong nhãn dòng. */
  size?: number
  /**
   * Icon ĐỨNG MỘT MÌNH thì đây là nội dung của nó. Có `label` = có `role="img"`
   * + `aria-label`; không có = `aria-hidden`, tức icon chỉ trang trí cho chữ
   * đứng cạnh. Không có đường thứ ba: icon câm mà không có chữ nào bên cạnh là
   * một nút không ai đọc được.
   */
  label?: string
  /** Chỉ để căn chỉnh (lề, co giãn) — không tô màu. */
  className?: string
  /** Chỉ để ăn theo màu của CON SỐ đứng cạnh (luật 2) — không tô màu riêng. */
  style?: React.CSSProperties
}) {
  const I = MAP[name]
  return (
    <I
      size={size}
      strokeWidth={1.8}
      className={className}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  )
}
