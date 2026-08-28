import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
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
  FileText,
  Hammer,
  HeartPulse,
  History,
  Home,
  KeyRound,
  Library,
  ListTodo,
  NotebookPen,
  Package,
  Receipt,
  ReceiptText,
  Route,
  ScrollText,
  Settings,
  Shapes,
  ShoppingCart,
  Stamp,
  Store,
  Table,
  TowerControl,
  Truck,
  Users,
  UsersRound,
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
  bell: Bell,
  armchair: Armchair,
  users: Users,
  'users-round': UsersRound,
  'file-text': FileText,
  'circle-dollar-sign': CircleDollarSign,
  'clipboard-list': ClipboardList,
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
  'shopping-cart': ShoppingCart,
  truck: Truck,
  route: Route,
  hammer: Hammer,
  history: History,
  'notebook-pen': NotebookPen,
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
