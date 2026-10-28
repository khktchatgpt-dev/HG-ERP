import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  Calculator,
  WalletCards,
  LockKeyhole,
  ArrowLeftRight,
  ArrowRightToLine,
  ArrowUpFromLine,
  Armchair,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarOff,
  CalendarRange,
  ChartColumn,
  ChartGantt,
  Circle,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Container,
  Factory,
  Gavel,
  FileText,
  Fingerprint,
  Grid3x3,
  Hammer,
  HeartPulse,
  History,
  Home,
  KeyRound,
  Library,
  MessagesSquare,
  Wrench,
  ListTodo,
  NotebookPen,
  BookOpenText,
  Package,
  Receipt,
  ReceiptText,
  Route,
  Scale,
  Scissors,
  ScrollText,
  Settings,
  Shapes,
  ShoppingCart,
  Stamp,
  Store,
  Table,
  TowerControl,
  TriangleAlert,
  Truck,
  Users,
  UsersRound,
  FolderKanban,
} from 'lucide-react'

/**
 * Bộ icon NAV (lucide) — thay dàn ký tự text (◧ ▤ ◫…) trông tạm bợ và lệch
 * baseline mỗi font một kiểu.
 *
 * Config nav đi qua ranh giới server→client (WorkspaceSidebar server truyền
 * `sections` xuống DesktopSidebar client) nên `icon` phải là CHUỖI serialize
 * được — chuỗi đó tra ở registry này phía client. Tên lạ → chấm tròn trung
 * tính, không vỡ menu.
 */
const REGISTRY: Record<string, LucideIcon> = {
  home: Home,
  'calendar-range': CalendarRange,
  'list-todo': ListTodo,
  'calendar-off': CalendarOff,
  'calendar-check': CalendarCheck,
  fingerprint: Fingerprint,
  bell: Bell,
  armchair: Armchair,
  users: Users,
  'users-round': UsersRound,
  'file-text': FileText,
  'circle-dollar-sign': CircleDollarSign,
  // Sơ đồ kệ (0193) — ô lưới là hình gần nhất với "khu trong kho".
  'grid-3x3': Grid3x3,
  'clipboard-list': ClipboardList,
  'folder-kanban': FolderKanban,
  'clipboard-check': ClipboardCheck,
  factory: Factory,
  'chart-column': ChartColumn,
  'chart-gantt': ChartGantt,
  receipt: Receipt,
  'receipt-text': ReceiptText,
  boxes: Boxes,
  package: Package,
  store: Store,
  container: Container,
  // Quy cắt phôi — kéo cắt là hình ảnh gần nhất với "cắt phôi" mà thợ nhận ra ngay.
  scissors: Scissors,
  // Tra giá vật tư — cái cân: đặt giá các NCC lên so.
  scale: Scale,
  'shopping-cart': ShoppingCart,
  truck: Truck,
  'triangle-alert': TriangleAlert,
  gavel: Gavel,
  route: Route,
  hammer: Hammer,
  history: History,
  'notebook-pen': NotebookPen,
  // Cách tính công (B2) — hệ số + quy tắc tính giờ.
  calculator: Calculator,
  // Kỳ công & chốt (B3).
  lock: LockKeyhole,
  // Hồ sơ lương (B4).
  wallet: WalletCards,
  // Sổ phiếu kho — sổ đã ghi, chỉ đọc; khác 'notebook-pen' là sổ đang viết.
  'book-open': BookOpenText,
  'arrow-right-to-line': ArrowRightToLine,
  'arrow-left-right': ArrowLeftRight,
  'arrow-down-to-line': ArrowDownToLine,
  'arrow-up-from-line': ArrowUpFromLine,
  shapes: Shapes,
  table: Table,
  'tower-control': TowerControl,
  stamp: Stamp,
  'building-2': Building2,
  'key-round': KeyRound,
  library: Library,
  // Góp ý hệ thống — hai bong bóng thoại: trao đổi qua lại, không phải "báo lỗi".
  'messages-square': MessagesSquare,
  wrench: Wrench,
  'scroll-text': ScrollText,
  'heart-pulse': HeartPulse,
  settings: Settings,
}

export function NavIcon({
  name,
  className,
  strokeWidth,
}: {
  name: string
  className?: string
  strokeWidth?: number
}) {
  const Icon = REGISTRY[name] ?? Circle
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden />
}
