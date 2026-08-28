'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Download,
  Factory,
  FileSpreadsheet,
  FileText,
  Handshake,
  History,
  Home,
  Inbox,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Printer,
  Ruler,
  Scale,
  Search,
  Send,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  User,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'

import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { DateField } from '@/components/erp/DateField'
import { DocChip } from '@/components/erp/DocChip'
import { PageHeader } from '@/components/erp/PageHeader'
import { RefChain } from '@/components/erp/RefChain'
import { RowMenu } from '@/components/erp/RowMenu'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/shadcn/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { Input } from '@/components/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Separator } from '@/components/shadcn/separator'
import { Skeleton } from '@/components/shadcn/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Textarea } from '@/components/shadcn/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Khung trình bày chung của lab                                       */
/* ------------------------------------------------------------------ */

const NAV = [
  ['dinh-huong', 'Định hướng'],
  ['man-hinh-mau', 'Màn hình mẫu'],
  ['mau', 'Màu'],
  ['chu', 'Chữ'],
  ['icon', 'Icon'],
  ['nut-nhap-lieu', 'Nút & form'],
  ['trang-thai', 'Trạng thái'],
  ['bang', 'Bảng'],
  ['chi-tiet', 'Trang chi tiết'],
  ['kpi', 'Số liệu'],
  ['hop-thoai', 'Lớp phủ'],
  ['mobile', 'Mobile'],
  ['trong-tai', 'Trống & tải'],
  ['kit', 'Kit dùng chung'],
] as const

function Section({
  id,
  code,
  title,
  lead,
  children,
}: {
  id: string
  code: string
  title: string
  lead?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 py-10 first:pt-6 sm:py-12">
      <p className="t-label font-mono text-[var(--primary)]">{code}</p>
      <h2 className="t-display mt-1">{title}</h2>
      {lead && <p className="t-body text-muted-foreground mt-2 max-w-2xl">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function DemoCard({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('bg-card rounded-xl border shadow-xs', className)}>
      {title && (
        <div className="t-label text-muted-foreground border-b px-4 py-2.5">{title}</div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

/* DocChip nay là component dùng chung: `@/components/erp/DocChip`. */

/* ------------------------------------------------------------------ */
/* Dữ liệu giả cho demo                                                */
/* ------------------------------------------------------------------ */

type PoStatus = 'draft' | 'pending' | 'approved' | 'late' | 'done'

const PO_STATUS: Record<
  PoStatus,
  { label: string; tone: 'gray' | 'blue' | 'green' | 'amber' | 'red'; spine: string }
> = {
  draft: { label: 'Nháp', tone: 'gray', spine: 'transparent' },
  pending: { label: 'Chờ duyệt', tone: 'amber', spine: 'var(--warn)' },
  approved: { label: 'Đã duyệt', tone: 'blue', spine: 'var(--primary)' },
  late: { label: 'Quá hẹn', tone: 'red', spine: 'var(--stop)' },
  done: { label: 'Hoàn tất', tone: 'green', spine: 'var(--done)' },
}

const PO_ROWS: Array<{
  code: string
  supplier: string
  owner: string
  date: string
  total: string
  status: PoStatus
}> = [
  {
    code: 'PO-2608-041',
    supplier: 'Thép Nam Kim',
    owner: 'Lệ Hằng',
    date: '14/08',
    total: '128.400.000',
    status: 'pending',
  },
  {
    code: 'PO-2608-040',
    supplier: 'Gỗ Trường Thành',
    owner: 'Lệ Hằng',
    date: '14/08',
    total: '86.120.500',
    status: 'approved',
  },
  {
    code: 'PO-2608-038',
    supplier: 'Bao bì Tân Á',
    owner: 'M. Trang',
    date: '13/08',
    total: '12.750.000',
    status: 'late',
  },
  {
    code: 'PO-2608-036',
    supplier: 'Xốp EPS Miền Nam',
    owner: 'Lệ Hằng',
    date: '12/08',
    total: '43.900.000',
    status: 'done',
  },
  {
    code: 'PO-2608-035',
    supplier: 'Kính Hải Long',
    owner: 'M. Trang',
    date: '12/08',
    total: '215.080.000',
    status: 'approved',
  },
  {
    code: 'PO-2608-033',
    supplier: 'Sơn tĩnh điện Á Đông',
    owner: 'Lệ Hằng',
    date: '11/08',
    total: '9.680.000',
    status: 'draft',
  },
]

/* ------------------------------------------------------------------ */
/* Trang lab                                                           */
/* ------------------------------------------------------------------ */

export function DesignLab() {
  return (
    <div className="theme-v3 bg-background text-foreground min-h-screen">
      <LabHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <Hero />
        <Separator />
        <AppFrameSection />
        <Separator />
        <PaletteSection />
        <Separator />
        <TypeSection />
        <Separator />
        <IconSection />
        <Separator />
        <ControlsSection />
        <Separator />
        <StatusSection />
        <Separator />
        <TableSection />
        <Separator />
        <DetailSection />
        <Separator />
        <KpiSection />
        <Separator />
        <OverlaySection />
        <Separator />
        <MobileSection />
        <Separator />
        <EmptyLoadingSection />
        <Separator />
        <KitSection />
        <LabFooter />
      </main>
    </div>
  )
}

function LabHeader() {
  return (
    <header className="bg-card/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-[var(--primary)] font-mono text-[13px] font-bold text-white">
            HG
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">Design Lab</p>
            <p className="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
              theme v3 · HG Ledger
            </p>
          </div>
        </div>
        <nav className="ml-auto hidden items-center gap-1 overflow-x-auto lg:flex">
          {NAV.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

/* 01 — Định hướng: luận đề + một tờ phiếu thật làm bằng chứng */

function Hero() {
  return (
    <Section
      id="dinh-huong"
      code="01 · ĐỊNH HƯỚNG"
      title="Sổ chứng từ số — lạnh, chính xác, một màu hành động"
      lead="Đơn vị làm việc của HG là tờ PHIẾU: đơn hàng, lệnh sản xuất, phiếu mua. Giao diện mới lấy tờ phiếu làm chuẩn — nền xám-xanh lạnh để số liệu nổi lên, mực navy thay đen tuyền, mã và số luôn là chữ đẳng khoảng. Royal cobalt là màu HÀNH ĐỘNG duy nhất; ba màu trạng thái amber/đỏ/lục chỉ nói về vòng đời phiếu, không bao giờ lẫn với nút bấm."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          {[
            [
              'Một màu hành động',
              'Mọi thứ bấm được đều cobalt. Thấy cobalt là biết "chỗ này làm việc được" — không còn sky/emerald/violet tranh nhau.',
            ],
            [
              'Mã & số là mặt chữ riêng',
              'PO-2608-041, 128.400.000 ₫ — JetBrains Mono, chữ số đẳng khoảng. Cột tiền thẳng hàng, mã phiếu nhận ra từ xa.',
            ],
            [
              'Vạch sống của phiếu',
              'Vạch 3px mép trái mã hoá vòng đời. Quét 60 dòng bằng thị giác ngoại vi, không phải đọc chữ từng dòng.',
            ],
            [
              'Hover có giọng',
              'Di chuột, chọn dòng, tab đang mở — đều ánh tint cobalt nhạt thay vì xám. Cả app cùng một giọng thương hiệu.',
            ],
          ].map(([t, d]) => (
            <div key={t} className="bg-card rounded-xl border p-4 shadow-xs">
              <p className="t-title">{t}</p>
              <p className="t-body text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>

        {/* Tờ phiếu mẫu — thesis của cả hệ */}
        <div
          className="spine bg-card overflow-hidden rounded-xl border shadow-xs"
          style={{ '--spine': 'var(--warn)' } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <DocChip>PO-2608-041</DocChip>
                <Badge tone="amber">Chờ duyệt</Badge>
              </div>
              <h3 className="t-title mt-2">Phiếu mua vật tư — Thép Nam Kim</h3>
              <p className="t-body text-muted-foreground mt-0.5">
                Người lập: Phan Thị Lệ Hằng · 14/08/2026
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="In phiếu">
              <Printer />
            </Button>
          </div>
          <div className="px-5 py-3">
            {[
              ['Thép hộp 40×80×1.4 mm', '2.400 kg', '45.600.000'],
              ['Thép tấm 2 li CT3', '1.180 kg', '24.900.000'],
              ['Que hàn KT-421', '120 kg', '57.900.000'],
            ].map(([name, qty, amount]) => (
              <div
                key={name}
                className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0"
              >
                <span className="t-body min-w-0 truncate">{name}</span>
                <span className="t-data text-muted-foreground shrink-0">{qty}</span>
                <span className="t-data w-24 shrink-0 text-right">{amount}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-3">
              <span className="t-label text-muted-foreground">Tổng cộng</span>
              <span className="font-mono text-[17px] font-semibold tracking-tight tabular-nums">
                128.400.000 ₫
              </span>
            </div>
          </div>
          <div className="bg-muted/60 flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button variant="outline" size="sm">
              Trả về sửa
            </Button>
            <Button size="sm">
              <Check /> Duyệt phiếu
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* 02 — Màu */

function Swatch({
  hex,
  name,
  role,
  border,
}: {
  hex: string
  name: string
  role: string
  border?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn('size-10 shrink-0 rounded-lg', border && 'border')}
        style={{ background: hex }}
      />
      <div className="min-w-0 leading-tight">
        <p className="text-[13px] font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-[12px]">{role}</p>
        <p className="text-muted-foreground font-mono text-[11px] uppercase">{hex}</p>
      </div>
    </div>
  )
}

function PaletteSection() {
  return (
    <Section
      id="mau"
      code="03 · MÀU"
      title="Bảng màu"
      lead="Nền lạnh — mực navy — một màu hành động — ba màu trạng thái. Phụ chú giữ nguyên tắc tương phản ~7:1 vì chữ trong app toàn cỡ 11–13px và màn hình xưởng chói sáng."
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <DemoCard title="Nền & viền">
          <div className="flex flex-col gap-4">
            <Swatch hex="#f5f6f8" name="Canvas" role="Nền trang" border />
            <Swatch hex="#ffffff" name="Thẻ / phiếu" role="Bề mặt nội dung" border />
            <Swatch hex="#f2f4f7" name="Muted" role="Nền phụ, ô chẵn" border />
            <Swatch hex="#e4e7ec" name="Viền" role="Đường kẻ hairline" border />
          </div>
        </DemoCard>
        <DemoCard title="Mực">
          <div className="flex flex-col gap-4">
            <Swatch hex="#101828" name="Mực chính" role="Chữ nội dung" />
            <Swatch hex="#475467" name="Mực phụ" role="Phụ chú — 7.5:1 trên nền trắng" />
            <Swatch hex="#98a2b3" name="Placeholder" role="Chỉ cho ô trống" border />
          </div>
        </DemoCard>
        <DemoCard title="Hành động">
          <div className="flex flex-col gap-4">
            <Swatch
              hex="#2743c4"
              name="Royal cobalt"
              role="Nút chính, link, focus ring"
            />
            <Swatch
              hex="#eef1fc"
              name="Tint cobalt"
              role="Hover, dòng chọn, mã chứng từ"
              border
            />
          </div>
        </DemoCard>
        <DemoCard title="Trạng thái — chỉ ba">
          <div className="flex flex-col gap-4">
            <Swatch hex="#b45309" name="Cần để mắt" role="--warn · chờ xử lý, sắp hẹn" />
            <Swatch hex="#b42318" name="Đã hỏng" role="--stop · quá hẹn, từ chối" />
            <Swatch hex="#1f7a4c" name="Đóng sổ" role="--done · hoàn tất" />
          </div>
        </DemoCard>
      </div>
    </Section>
  )
}

/* 03 — Chữ */

function TypeSection() {
  return (
    <Section
      id="chu"
      code="04 · CHỮ"
      title="Thang chữ 5 bậc + mặt chữ dữ liệu"
      lead="Giữ Be Vietnam Pro — mặt chữ vẽ riêng cho dấu tiếng Việt. Điểm khác biệt nằm ở chỗ MÃ và SỐ tách hẳn sang JetBrains Mono đẳng khoảng: bảng tiền thẳng cột, mã phiếu không lẫn với câu chữ."
    >
      <DemoCard>
        <div className="flex flex-col gap-5">
          {(
            [
              [
                't-display',
                'Tiêu đề trang — Theo dõi đơn mua vật tư',
                '20px · 600 · dùng đúng 1 lần mỗi trang',
              ],
              ['t-title', 'Tiêu đề khối — Vật tư chờ về trong tuần', '15px · 600'],
              [
                't-body',
                'Chữ nội dung — Đơn PO-2608-041 gồm 3 dòng vật tư, giao về kho A trước ngày 20/08.',
                '13px · mặc định của mọi bảng và form',
              ],
              [
                't-label',
                'NHÃN CỘT · TRẠNG THÁI · NGƯỜI PHỤ TRÁCH',
                '11px · 500 · viết hoa, giãn ký tự',
              ],
            ] as const
          ).map(([cls, sample, note]) => (
            <div key={cls} className="grid items-baseline gap-1 sm:grid-cols-[140px_1fr]">
              <span className="text-muted-foreground font-mono text-[11px]">{cls}</span>
              <div>
                <p className={cls}>{sample}</p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">{note}</p>
              </div>
            </div>
          ))}
          <div className="grid items-baseline gap-1 sm:grid-cols-[140px_1fr]">
            <span className="text-muted-foreground font-mono text-[11px]">t-data</span>
            <div>
              <p className="t-data">
                PO-2608-041 · LSX-2608-17 · 128.400.000 ₫ · 2.400 kg · w37.26
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                JetBrains Mono, tabular-nums — mọi mã, tiền, số lượng, ngày
              </p>
            </div>
          </div>
        </div>
      </DemoCard>
    </Section>
  )
}

/* 04 — Nút & nhập liệu */

function ControlsSection() {
  const [saving, setSaving] = useState(false)
  const [ngay, setNgay] = useState('2026-08-03')
  return (
    <Section
      id="nut-nhap-lieu"
      code="06 · NÚT & NHẬP LIỆU"
      title="Nút và ô nhập"
      lead="Nút đặc cobalt chỉ dành cho hành động chính — mỗi màn một nút. Còn lại là outline/ghost để mắt không phải cạnh tranh. Focus ring cùng màu hành động, không còn ring amber lẫn với màu cảnh báo."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Nút — biến thể & cỡ">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button>
                <Plus /> Tạo phiếu mua
              </Button>
              <Button variant="secondary">
                <FileSpreadsheet /> Xuất Excel
              </Button>
              <Button variant="outline">
                <SlidersHorizontal /> Lọc
              </Button>
              <Button variant="ghost">Bỏ qua</Button>
              <Button variant="destructive">
                <Trash2 /> Xoá phiếu
              </Button>
              <Button variant="link">Xem lịch sử</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg">Cỡ lớn</Button>
              <Button>Mặc định</Button>
              <Button size="sm">Cỡ nhỏ</Button>
              <Button size="icon" variant="outline" aria-label="Tải lại">
                <Search />
              </Button>
              <Button disabled>Không khả dụng</Button>
              <Button
                onClick={() => {
                  setSaving(true)
                  setTimeout(() => setSaving(false), 1500)
                }}
                disabled={saving}
              >
                {saving && <Loader2 className="animate-spin" />}
                {saving ? 'Đang lưu…' : 'Lưu (bấm thử)'}
              </Button>
            </div>
          </div>
        </DemoCard>

        <DemoCard title="Form — thêm dòng vật tư">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="t-label text-muted-foreground">Tên vật tư</span>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input className="pl-8" placeholder="Gõ để tìm trong sổ vật tư…" />
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="t-label text-muted-foreground">Đơn vị tính</span>
                <Select defaultValue="kg">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="theme-v3">
                    {['kg', 'cây', 'tấm', 'm', 'cái', 'thùng'].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="t-label text-muted-foreground">Số lượng</span>
                <Input
                  inputMode="decimal"
                  placeholder="0"
                  className="t-data text-right"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="t-label text-[var(--stop)]">Đơn giá — bắt buộc</span>
                <Input
                  aria-invalid
                  defaultValue=""
                  placeholder="VND / đơn vị"
                  className="t-data text-right"
                />
                <span className="text-[11px] text-[var(--stop)]">
                  Chưa nhập đơn giá. Lấy từ báo giá gần nhất hoặc gõ tay.
                </span>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="t-label text-muted-foreground">Ghi chú giao hàng</span>
              <Textarea rows={2} placeholder="VD: giao kho A, báo bảo vệ trước 30 phút" />
            </label>
            <label className="flex items-center gap-2">
              <Checkbox defaultChecked />
              <span className="t-body">Cộng dòng này vào barem kg/m của mẫu đơn</span>
            </label>
          </div>
        </DemoCard>

        <DemoCard title="Ô ngày — luôn dd/mm/yyyy">
          <div className="grid gap-4">
            <p className="t-body text-muted-foreground">
              <code className="t-data">&lt;input type=&quot;date&quot;&gt;</code> vẽ chữ theo NGÔN
              NGỮ TRÌNH DUYỆT chứ không theo app: máy cài Chrome tiếng Anh hiện{' '}
              <code className="t-data">mm/dd/yyyy</code> trong khi mọi chỗ khác của app và mọi
              chứng từ giấy đọc <code className="t-data">dd/mm/yyyy</code>. Hai ô dưới đang giữ
              CÙNG MỘT ngày — so chữ để thấy.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="t-label text-[var(--primary)]">
                  DateField (kit) — đúng
                </span>
                <DateField value={ngay} onChange={setNgay} aria-label="Hẹn giao" />
                <span className="text-muted-foreground text-[11px]">
                  Gõ số liền tay tự chèn dấu; nút lịch vẫn mở bộ chọn của trình duyệt.
                </span>
              </label>
              <label className="grid gap-1.5">
                <span className="t-label text-muted-foreground">
                  input type=&quot;date&quot; — theo trình duyệt
                </span>
                <Input
                  type="date"
                  value={ngay}
                  onChange={(e) => setNgay(e.target.value)}
                  className="t-data"
                />
                <span className="text-muted-foreground text-[11px]">
                  Chrome tiếng Anh: mm/dd/yyyy. Không có cách nào nhìn ra ô đang nói kiểu nào.
                </span>
              </label>
            </div>
            <p className="t-body text-muted-foreground">
              Giá trị thật cả hai ô đang giữ:{' '}
              <span className="t-data text-foreground">{ngay || '(trống)'}</span> — DateField chỉ
              đổi CHỮ, giá trị vào/ra vẫn là ISO nên chỗ gọi không phải sửa gì.
            </p>
          </div>
        </DemoCard>
      </div>
    </Section>
  )
}

/* 05 — Trạng thái */

function StatusSection() {
  return (
    <Section
      id="trang-thai"
      code="07 · TRẠNG THÁI"
      title="Nhãn và vạch sống"
      lead="Nhãn nền nhạt — màu đặc để dành cho nút. Vạch 3px mép trái lặp lại đúng màu nhãn, để bảng dày đọc được bằng thị giác ngoại vi."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Nhãn trạng thái (Badge tone)">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gray">Nháp</Badge>
            <Badge tone="amber">Chờ duyệt</Badge>
            <Badge tone="blue">Đã duyệt</Badge>
            <Badge tone="red">Quá hẹn</Badge>
            <Badge tone="green">Hoàn tất</Badge>
          </div>
          <p className="t-body text-muted-foreground mt-4">
            Cùng một component <code className="t-data text-[12px]">Badge</code> đang dùng
            ở 45 tệp — đổi token là 45 chỗ tự khớp, không sửa dòng gọi nào.
          </p>
        </DemoCard>
        <DemoCard title="Vạch sống trên dòng phiếu">
          <div className="flex flex-col gap-2">
            {(
              [
                ['LSX-2608-17 · Giường tầng KT-B24', 'Đang chạy tổ Hàn', 'var(--warn)'],
                [
                  'LSX-2608-15 · Kệ sắt V lỗ 5 tầng',
                  'Quá hẹn giao 2 ngày',
                  'var(--stop)',
                ],
                [
                  'LSX-2608-12 · Bàn học chống gù',
                  'Đóng gói xong, chờ xuất',
                  'var(--done)',
                ],
              ] as const
            ).map(([code, note, spine]) => (
              <div
                key={code}
                className="spine bg-card flex items-center justify-between gap-3 overflow-hidden rounded-lg border px-4 py-3"
                style={{ '--spine': spine } as React.CSSProperties}
              >
                <div className="min-w-0">
                  <p className="t-body truncate font-medium">{code}</p>
                  <p className="text-muted-foreground text-[12px]">{note}</p>
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </div>
            ))}
          </div>
        </DemoCard>
      </div>
    </Section>
  )
}

/* 06 — Bảng dữ liệu */

function TableSection() {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const cell = density === 'compact' ? 'py-1.5' : 'py-2.5'
  return (
    <Section
      id="bang"
      code="08 · BẢNG DỮ LIỆU"
      title="Bảng — nơi cả hệ được thử lửa"
      lead="Header nhãn hoa 11px, mã và tiền mono thẳng cột, vạch sống mép trái, hover tint cobalt. Mật độ dòng là lựa chọn của NGƯỜI DÙNG (ý mượn từ Carbon/IBM) — thống kê xưởng cần nhìn 40 dòng một màn, kế toán cần dòng thở."
    >
      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input className="h-8 w-56 pl-8" placeholder="Tìm mã, nhà cung cấp…" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="theme-v3">
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              <SelectItem value="pending">Chờ duyệt</SelectItem>
              <SelectItem value="late">Quá hẹn</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center rounded-lg border p-0.5">
            {(
              [
                ['comfortable', 'Thoáng'],
                ['compact', 'Gọn'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setDensity(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
                  density === value
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="t-label text-muted-foreground w-0 pl-4">
                Mã phiếu
              </TableHead>
              <TableHead className="t-label text-muted-foreground">
                Nhà cung cấp
              </TableHead>
              <TableHead className="t-label text-muted-foreground hidden sm:table-cell">
                Người mua
              </TableHead>
              <TableHead className="t-label text-muted-foreground hidden md:table-cell">
                Ngày lập
              </TableHead>
              <TableHead className="t-label text-muted-foreground text-right">
                Tổng tiền
              </TableHead>
              <TableHead className="t-label text-muted-foreground">Trạng thái</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {PO_ROWS.map((row) => {
              const st = PO_STATUS[row.status]
              return (
                <TableRow
                  key={row.code}
                  className="spine hover:bg-[var(--accent)]/50"
                  style={{ '--spine': st.spine } as React.CSSProperties}
                >
                  <TableCell className={cn('pl-4', cell)}>
                    <DocChip>{row.code}</DocChip>
                  </TableCell>
                  <TableCell className={cn('t-body font-medium', cell)}>
                    {row.supplier}
                  </TableCell>
                  <TableCell
                    className={cn(
                      't-body text-muted-foreground hidden sm:table-cell',
                      cell,
                    )}
                  >
                    {row.owner}
                  </TableCell>
                  <TableCell className={cn('t-data hidden md:table-cell', cell)}>
                    {row.date}
                  </TableCell>
                  <TableCell className={cn('t-data text-right', cell)}>
                    {row.total}
                  </TableCell>
                  <TableCell className={cell}>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </TableCell>
                  <TableCell className={cn('pr-2', cell)}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Thao tác"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="theme-v3">
                        <DropdownMenuItem>
                          <FileText /> Xem phiếu
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pencil /> Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Printer /> In
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive">
                          <Trash2 /> Xoá
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <p className="t-data text-muted-foreground text-[12px]">1–6 / 128 phiếu</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled
              aria-label="Trang trước"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              aria-label="Trang sau"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* 07 — KPI */

function KpiSection() {
  return (
    <Section
      id="kpi"
      code="10 · THẺ SỐ LIỆU"
      title="Số liệu nói bằng mono"
      lead="Nhãn hoa nhỏ, con số mono lớn, biến động dùng đúng màu trạng thái. Không gradient, không icon trang trí — con số là nhân vật chính."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            [ShoppingCart, 'PO đang mở', '37', 'phiếu', '+4 tuần này', 'up'],
            [ClipboardCheck, 'Chờ GĐ duyệt', '9', 'phiếu', '2 phiếu > 48 giờ', 'warn'],
            [Truck, 'Quá hẹn giao', '3', 'phiếu', '−2 so tuần trước', 'down'],
            [Wallet, 'Tiền hàng chờ về', '1,84', 'tỷ ₫', '12 NCC', 'flat'],
          ] as const
        ).map(([Icon, label, value, unit, note, trend]) => (
          <div key={label} className="bg-card rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="t-label text-muted-foreground">{label}</p>
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent)]">
                <Icon
                  className="size-4 text-[var(--accent-foreground)]"
                  strokeWidth={1.8}
                />
              </span>
            </div>
            <p className="mt-2 font-mono text-[28px] leading-none font-semibold tracking-tight tabular-nums">
              {value}
              <span className="text-muted-foreground ml-1 text-[13px] font-normal">
                {unit}
              </span>
            </p>
            <p
              className={cn(
                'mt-2 flex items-center gap-1 text-[12px] font-medium',
                trend === 'up' && 'text-[var(--done)]',
                trend === 'down' && 'text-[var(--done)]',
                trend === 'warn' && 'text-[var(--warn)]',
                trend === 'flat' && 'text-muted-foreground',
              )}
            >
              {trend === 'up' && <ArrowUpRight className="size-3.5" />}
              {trend === 'down' && <ArrowDownRight className="size-3.5" />}
              {trend === 'warn' && <AlertTriangle className="size-3.5" />}
              {note}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-card mt-4 rounded-xl border p-4 shadow-xs">
        <div className="flex items-baseline justify-between">
          <p className="t-title">Giá trị mua theo tuần</p>
          <p className="t-data text-muted-foreground text-[12px]">8 tuần gần nhất</p>
        </div>
        <div className="mt-4 flex h-28 items-end gap-2">
          {[42, 61, 38, 74, 55, 90, 68, 81].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  'w-full rounded-t-sm',
                  i === 7 ? 'bg-[var(--primary)]' : 'bg-[var(--primary)]/20',
                )}
                style={{ height: `${h}%` }}
              />
              <span className="t-data text-muted-foreground text-[10px]">w{30 + i}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

/* 08 — Hộp thoại & menu */

function OverlaySection() {
  const toast = useToast()
  return (
    <Section
      id="hop-thoai"
      code="11 · HỘP THOẠI & MENU"
      title="Lớp phủ"
      lead="Dialog cho quyết định, dropdown cho thao tác dòng, tooltip cho nút chỉ có icon, toast báo kết quả. Tất cả cùng token — kể cả khi render qua portal."
    >
      <DemoCard>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Check /> Mở hộp thoại duyệt
              </Button>
            </DialogTrigger>
            {/* bg-card: DialogContent mặc định dùng bg-background — trên canvas
                xám của v3 sẽ ra hộp thoại xám; hộp thoại là "tờ phiếu" nên nền trắng. */}
            <DialogContent className="theme-v3 bg-card">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Duyệt <DocChip>PO-2608-041</DocChip>
                </DialogTitle>
                <DialogDescription>
                  Phiếu 128.400.000 ₫ của Thép Nam Kim sẽ chuyển sang &quot;Đã duyệt&quot;
                  và báo cho người mua đặt hàng. Không thu hồi được sau khi NCC xác nhận.
                </DialogDescription>
              </DialogHeader>
              <label className="grid gap-1.5">
                <span className="t-label text-muted-foreground">
                  Ghi chú cho người mua
                </span>
                <Textarea rows={2} placeholder="Không bắt buộc" />
              </label>
              <DialogFooter>
                <Button variant="outline">Để sau</Button>
                <Button onClick={() => toast.success('Đã duyệt PO-2608-041')}>
                  Duyệt phiếu
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Menu thao tác <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="theme-v3">
              <DropdownMenuItem>
                <FileText /> Xem phiếu
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Truck /> Ghi nhận hàng về
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 /> Huỷ phiếu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Thông báo">
                <Bell />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="theme-v3">
              Tooltip cho nút chỉ có icon
            </TooltipContent>
          </Tooltip>

          <Button
            variant="secondary"
            onClick={() => toast.success('Đã lưu phiếu', 'PO-2608-041 · 3 dòng vật tư')}
          >
            Toast thành công
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.error('Không lưu được', 'Dòng 2 chưa có đơn giá')}
          >
            Toast lỗi
          </Button>
        </div>
      </DemoCard>
    </Section>
  )
}

/* 09 — Mobile */

function MobileSection() {
  return (
    <Section
      id="mobile"
      code="12 · MOBILE"
      title="Điện thoại — cho người duyệt và người chạy xưởng"
      lead="Trên điện thoại, bảng nhường chỗ cho THẺ PHIẾU (vẫn giữ vạch sống + mã mono), điều hướng dồn xuống thanh tab đáy trong tầm ngón cái. Khung bên dưới là mô phỏng 375px — chính trang lab này cũng responsive, thu cửa sổ lại để xem."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {[
            [
              'Thanh tab đáy, tối đa 5 mục',
              'Trang chính của vai trò đó + Chờ tôi duyệt + Thông báo. Không nhét cả sidebar 12 mục vào hamburger.',
            ],
            [
              'Mục tiêu chạm 44px',
              'Dòng thẻ, nút duyệt, tab — đều cao tối thiểu 44px. Thống kê xưởng thao tác bằng một tay, vừa đi vừa bấm.',
            ],
            [
              'Duyệt được trong 2 chạm',
              'GĐ mở app → tab "Chờ duyệt" đã đỏ số → vuốt xem phiếu → Duyệt. Không bắt tìm qua menu.',
            ],
            [
              'Bảng thành thẻ, không bóp cột',
              'Bảng 7 cột bóp vào 375px là tra tấn. Mỗi dòng thành một thẻ: mã + NCC + tiền + trạng thái, bấm vào mới xem chi tiết.',
            ],
          ].map(([t, d]) => (
            <div key={t} className="bg-card rounded-xl border p-4 shadow-xs">
              <p className="t-title">{t}</p>
              <p className="t-body text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>

        {/* Khung điện thoại mô phỏng */}
        <div className="mx-auto w-full max-w-[360px] rounded-[2.2rem] border-[6px] border-[#101828] bg-[#101828] shadow-lg">
          <div className="bg-background flex h-[640px] flex-col overflow-hidden rounded-[1.85rem]">
            <div className="bg-card flex items-center justify-between border-b px-4 pt-3 pb-2.5">
              <div>
                <p className="t-label text-muted-foreground">Cung ứng</p>
                <p className="text-[15px] font-semibold">Chờ tôi duyệt</p>
              </div>
              <span className="grid size-8 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-foreground)]">
                LH
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {(
                [
                  ['9', 'chờ duyệt', 'var(--warn)'],
                  ['3', 'quá hẹn', 'var(--stop)'],
                  ['37', 'đang mở', 'var(--primary)'],
                ] as const
              ).map(([n, label, color]) => (
                <div
                  key={label}
                  className="bg-card flex shrink-0 items-baseline gap-1.5 rounded-full border py-1.5 pr-3.5 pl-3"
                >
                  <span
                    className="font-mono text-[15px] font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {n}
                  </span>
                  <span className="text-muted-foreground text-[12px]">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-3">
              {PO_ROWS.slice(0, 4).map((row) => {
                const st = PO_STATUS[row.status]
                return (
                  <div
                    key={row.code}
                    className="spine bg-card overflow-hidden rounded-xl border px-4 py-3"
                    style={{ '--spine': st.spine } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <DocChip>{row.code}</DocChip>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="t-body mt-1.5 truncate font-medium">{row.supplier}</p>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-muted-foreground text-[12px]">
                        {row.owner} · {row.date}
                      </span>
                      <span className="t-data">{row.total} ₫</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="bg-card grid grid-cols-5 border-t px-1 pt-1.5 pb-3">
              {(
                [
                  [Home, 'Trang chính', false],
                  [ClipboardList, 'Chờ duyệt', true],
                  [Package, 'Phiếu mua', false],
                  [Bell, 'Thông báo', false],
                  [User, 'Cá nhân', false],
                ] as const
              ).map(([Icon, label, active]) => (
                <div
                  key={label}
                  className={cn(
                    'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg',
                    active ? 'text-[var(--primary)]' : 'text-muted-foreground',
                  )}
                >
                  <div className="relative">
                    <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                    {label === 'Chờ duyệt' && (
                      <span className="absolute -top-1 -right-2 grid size-3.5 place-items-center rounded-full bg-[var(--stop)] font-mono text-[8px] leading-none font-bold text-white">
                        9
                      </span>
                    )}
                  </div>
                  <span className="text-[9.5px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* 10 — Trống & tải */

function EmptyLoadingSection() {
  return (
    <Section
      id="trong-tai"
      code="13 · TRỐNG & TẢI"
      title="Màn trống là lời mời, skeleton giữ khung"
      lead="Màn trống nói rõ tiếp theo làm gì. Skeleton lặp đúng bố cục của dữ liệu thật để mắt không bị giật khi nội dung về."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <DemoCard title="Trạng thái trống">
          <div className="flex flex-col items-center py-8 text-center">
            <span className="bg-muted grid size-12 place-items-center rounded-xl">
              <Inbox className="text-muted-foreground size-6" />
            </span>
            <p className="t-title mt-4">Chưa có phiếu nào chờ bạn duyệt</p>
            <p className="t-body text-muted-foreground mt-1 max-w-xs">
              Khi người mua gửi phiếu lên, phiếu sẽ hiện ở đây và app báo qua chuông thông
              báo.
            </p>
            <Button variant="outline" className="mt-4">
              <Factory /> Xem phiếu toàn công ty
            </Button>
          </div>
        </DemoCard>
        <DemoCard title="Đang tải">
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-[12.5px]">
              <Loader2 className="size-4 animate-spin" />
              Đang tải 128 phiếu…
            </div>
          </div>
        </DemoCard>
      </div>
    </Section>
  )
}

/* 02 — Màn hình mẫu: bố cục hoàn chỉnh sidebar + topbar + nội dung */

function AppFrameSection() {
  return (
    <Section
      id="man-hinh-mau"
      code="02 · MÀN HÌNH MẪU"
      title="Một màn làm việc hoàn chỉnh"
      lead="Không phải component rời — đây là bố cục thật của một màn nghiệp vụ: sidebar 2 nhóm (NGHIỆP VỤ ở trên, THEO DÕI kèm số đếm ở dưới), topbar có breadcrumb + tìm kiếm ⌘K, vùng nội dung xếp theo thứ bậc cố định: tiêu đề trang → dải số liệu → tab lọc → bảng. Người dùng học bố cục này MỘT lần, mọi màn khác lặp lại y hệt."
    >
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <div className="bg-card flex h-[600px] min-w-[960px]">
          {/* Sidebar */}
          <aside className="flex w-60 shrink-0 flex-col border-r">
            <button className="hover:bg-accent flex items-center gap-2.5 border-b px-4 py-3 text-left transition-colors">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--primary)] font-mono text-[13px] font-bold text-white">
                HG
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13px] font-semibold">
                  Hoàng Gia ERP
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  Khu Cung ứng
                </span>
              </span>
              <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
            </button>

            <nav className="flex-1 overflow-y-auto px-2.5 py-3">
              <p className="t-label text-muted-foreground px-2 pb-1.5">Nghiệp vụ</p>
              {(
                [
                  [Home, 'Tổng quan', null, false],
                  [ShoppingCart, 'Phiếu mua', null, true],
                  [Building2, 'Nhà cung cấp', null, false],
                  [Warehouse, 'Kho & tồn', null, false],
                  [Factory, 'Lệnh sản xuất', null, false],
                ] as const
              ).map(([Icon, label, badge, active]) => (
                <SidebarItem
                  key={label}
                  Icon={Icon}
                  label={label}
                  badge={badge}
                  active={active}
                />
              ))}
              <p className="t-label text-muted-foreground px-2 pt-4 pb-1.5">Theo dõi</p>
              {(
                [
                  [ClipboardCheck, 'Chờ tôi duyệt', '9', false],
                  [Truck, 'Hàng sắp về', '5', false],
                  [BarChart3, 'Báo cáo mua', null, false],
                ] as const
              ).map(([Icon, label, badge, active]) => (
                <SidebarItem
                  key={label}
                  Icon={Icon}
                  label={label}
                  badge={badge}
                  active={active}
                />
              ))}
            </nav>

            <div className="flex items-center gap-2.5 border-t px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-foreground)]">
                LH
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-medium">
                  Phan Thị Lệ Hằng
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  Cung ứng · supply_lead
                </span>
              </span>
              <Settings className="text-muted-foreground size-4 shrink-0" />
            </div>
          </aside>

          {/* Vùng phải */}
          <div className="bg-background flex min-w-0 flex-1 flex-col">
            <div className="bg-card flex h-13 shrink-0 items-center gap-3 border-b px-5">
              <nav className="text-muted-foreground flex items-center gap-1.5 text-[12.5px]">
                <span>Cung ứng</span>
                <ChevronRight className="size-3.5" />
                <span className="text-foreground font-medium">Phiếu mua</span>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input
                    className="h-8 w-64 pr-12 pl-8"
                    placeholder="Tìm phiếu, NCC, vật tư…"
                  />
                  <kbd className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label="Thông báo"
                >
                  <Bell />
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--stop)]" />
                </Button>
                <span className="grid size-8 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-[var(--accent-foreground)]">
                  LH
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="t-display">Theo dõi phiếu mua</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone="amber">9 chờ duyệt</Badge>
                    <Badge tone="red">3 quá hẹn</Badge>
                    <span className="text-muted-foreground text-[12px]">
                      Cập nhật 5 phút trước
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <FileSpreadsheet /> Xuất Excel
                  </Button>
                  <Button size="sm">
                    <Plus /> Tạo phiếu mua
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-3">
                {(
                  [
                    ['Đang mở', '37', 'var(--primary)'],
                    ['Chờ duyệt', '9', 'var(--warn)'],
                    ['Quá hẹn', '3', 'var(--stop)'],
                    ['Về đủ tháng này', '21', 'var(--done)'],
                  ] as const
                ).map(([label, n, color]) => (
                  <button
                    key={label}
                    className="bg-card rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:border-[var(--primary)]/40"
                  >
                    <p className="t-label text-muted-foreground">{label}</p>
                    <p
                      className="mt-1 font-mono text-[20px] leading-none font-semibold tabular-nums"
                      style={{ color }}
                    >
                      {n}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1 border-b">
                {(
                  [
                    ['Tất cả', '128', true],
                    ['Chờ duyệt', '9', false],
                    ['Quá hẹn', '3', false],
                    ['Nháp', '6', false],
                  ] as const
                ).map(([label, n, active]) => (
                  <button
                    key={label}
                    className={cn(
                      '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'text-muted-foreground hover:text-foreground border-transparent',
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {n}
                    </span>
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground ml-auto"
                >
                  <SlidersHorizontal /> Bộ lọc
                </Button>
              </div>

              <div className="bg-card mt-3 overflow-hidden rounded-lg border">
                {PO_ROWS.slice(0, 4).map((row) => {
                  const st = PO_STATUS[row.status]
                  return (
                    <div
                      key={row.code}
                      className="spine flex items-center gap-4 border-b px-4 py-2.5 last:border-0 hover:bg-[var(--accent)]/50"
                      style={{ '--spine': st.spine } as React.CSSProperties}
                    >
                      <DocChip>{row.code}</DocChip>
                      <span className="t-body min-w-0 flex-1 truncate font-medium">
                        {row.supplier}
                      </span>
                      <span className="text-muted-foreground hidden items-center gap-1 text-[12px] lg:flex">
                        <User className="size-3.5" /> {row.owner}
                      </span>
                      <span className="t-data w-24 text-right">{row.total}</span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function SidebarItem({
  Icon,
  label,
  badge,
  active,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  badge: string | null
  active: boolean
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
        active
          ? 'bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground font-medium',
      )}
    >
      <Icon className="size-4.5 shrink-0" strokeWidth={active ? 2.1 : 1.8} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full bg-[var(--stop)] px-1.5 font-mono text-[10.5px] font-semibold text-white tabular-nums">
          {badge}
        </span>
      )}
    </button>
  )
}

/* 05 — Icon */

const ICON_INVENTORY = [
  [ShoppingCart, 'Phiếu mua / Cung ứng'],
  [Factory, 'Sản xuất / LSX'],
  [Warehouse, 'Kho & tồn'],
  [Ruler, 'Kỹ thuật / BOM'],
  [Handshake, 'Kinh doanh / Đơn hàng'],
  [Calculator, 'Kế toán / Công nợ'],
  [Users, 'Nhân sự'],
  [BarChart3, 'Báo cáo / GĐ'],
  [FileText, 'Phiếu, chứng từ'],
  [ClipboardCheck, 'Chờ duyệt'],
  [Truck, 'Giao nhận'],
  [Package, 'Hàng hoá / SP'],
  [Boxes, 'Tồn kho'],
  [Scale, 'Cân / kg'],
  [CalendarDays, 'Ngày hẹn'],
  [Banknote, 'Tiền / thanh toán'],
  [History, 'Lịch sử'],
  [Paperclip, 'Đính kèm'],
  [PenLine, 'Lập / sửa phiếu'],
  [Printer, 'In phiếu'],
] as const

function IconSection() {
  return (
    <Section
      id="icon"
      code="05 · ICON"
      title="Một bộ icon — Lucide, nét 1.8"
      lead="Chỉ dùng MỘT thư viện (Lucide, ~1.500 icon, cùng hệ với shadcn) để mọi icon cùng độ dày nét, cùng khung 24px — trộn 2–3 bộ là mắt nhận ra ngay sự lệch. Mỗi khái niệm nghiệp vụ ánh xạ CỐ ĐỊNH vào một icon, dùng thống nhất toàn app: đã thấy xe tải là giao nhận thì ở đâu cũng vậy."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <DemoCard title="Từ vựng icon nghiệp vụ — dùng cố định">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
            {ICON_INVENTORY.map(([Icon, label]) => (
              <div
                key={label}
                className="hover:bg-accent flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
              >
                <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-lg">
                  <Icon className="size-4.5" strokeWidth={1.8} />
                </span>
                <span className="text-[11.5px] leading-tight font-medium">{label}</span>
              </div>
            ))}
          </div>
        </DemoCard>
        <DemoCard title="Quy tắc dùng">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Button size="sm" className="shrink-0">
                <Plus /> Tạo phiếu
              </Button>
              <p className="t-body text-muted-foreground">
                Trong nút, menu, ô nhập: icon{' '}
                <strong className="text-foreground">16px</strong>, luôn đứng TRƯỚC chữ.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-muted grid size-9 shrink-0 place-items-center rounded-lg">
                <Factory className="size-5" strokeWidth={1.8} />
              </span>
              <p className="t-body text-muted-foreground">
                Sidebar, tab đáy mobile, đầu thẻ:{' '}
                <strong className="text-foreground">20px</strong>, nét 1.8 (đang chọn thì
                2.1).
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="In phiếu"
                  >
                    <Printer />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="theme-v3">In phiếu</TooltipContent>
              </Tooltip>
              <p className="t-body text-muted-foreground">
                Icon đứng một mình bắt buộc có{' '}
                <strong className="text-foreground">tooltip</strong> + aria-label. Không
                bắt người dùng đoán hình.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-[var(--warn)]">
                <AlertTriangle className="size-4" /> Quá hẹn
              </span>
              <p className="t-body text-muted-foreground">
                Icon KHÔNG tự mang màu — màu đi theo chữ bên cạnh (token trạng thái).
                Không có icon trang trí đứng không.
              </p>
            </div>
          </div>
        </DemoCard>
      </div>
    </Section>
  )
}

/* 09 — Trang chi tiết & dòng hoạt động */

function DetailSection() {
  return (
    <Section
      id="chi-tiet"
      code="09 · TRANG CHI TIẾT"
      title="Chi tiết phiếu — thông tin xếp tầng, không trải phẳng"
      lead="Cấu trúc cố định của mọi trang chi tiết: đầu phiếu (mã + trạng thái + hành động) → thông số key–value 2 cột → dòng vật tư → đính kèm; cột phải là DÒNG HOẠT ĐỘNG kể lại đời phiếu theo thời gian. Ai mở phiếu nào cũng biết tìm gì ở đâu."
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Thân phiếu */}
        <div
          className="spine bg-card overflow-hidden rounded-xl border shadow-xs"
          style={{ '--spine': 'var(--primary)' } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <DocChip>PO-2608-040</DocChip>
                <Badge tone="blue">Đã duyệt</Badge>
                <Badge tone="gray">USD</Badge>
              </div>
              <h3 className="t-title mt-2">Phiếu mua gỗ — Gỗ Trường Thành</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Printer /> In
              </Button>
              <Button variant="outline" size="sm">
                <Pencil /> Sửa
              </Button>
              <Button size="sm">
                <Truck /> Ghi nhận hàng về
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
            {(
              [
                [Building2, 'Nhà cung cấp', 'Gỗ Trường Thành'],
                [User, 'Người mua', 'Phan Thị Lệ Hằng'],
                [PenLine, 'Ngày lập', '14/08/2026'],
                [CalendarDays, 'Hẹn về kho', '22/08/2026'],
                [Warehouse, 'Kho nhận', 'Kho A — vật tư gỗ'],
                [Banknote, 'Thanh toán', 'Công nợ 30 ngày'],
              ] as const
            ).map(([Icon, label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="t-label text-muted-foreground flex items-center gap-1.5">
                  <Icon className="size-3.5" strokeWidth={1.8} /> {label}
                </dt>
                <dd className="t-body mt-0.5 truncate font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t px-5 py-3">
            <p className="t-label text-muted-foreground pb-2">Dòng vật tư · 2</p>
            {(
              [
                ['Gỗ thông xẻ sấy 25×100', '4.2 m³', '52.500.000'],
                ['Ván MDF 17 li phủ melamine', '86 tấm', '33.620.500'],
              ] as const
            ).map(([name, qty, amount]) => (
              <div
                key={name}
                className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0"
              >
                <span className="t-body min-w-0 truncate">{name}</span>
                <span className="t-data text-muted-foreground shrink-0">{qty}</span>
                <span className="t-data w-24 shrink-0 text-right">{amount}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-2.5">
              <span className="t-label text-muted-foreground">Tổng cộng</span>
              <span className="font-mono text-[15px] font-semibold tabular-nums">
                86.120.500 ₫
              </span>
            </div>
          </div>

          <div className="bg-muted/40 border-t px-5 py-3">
            <p className="t-label text-muted-foreground flex items-center gap-1.5 pb-2">
              <Paperclip className="size-3.5" /> Đính kèm · 2
            </p>
            <div className="flex flex-col gap-1">
              {(
                [
                  ['bao-gia-go-truong-thanh-0826.pdf', 'PDF · 1,2 MB'],
                  ['bkvt-po-2608-040.xlsx', 'Excel · 214 KB'],
                ] as const
              ).map(([name, meta]) => (
                <button
                  key={name}
                  className="hover:bg-accent group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors"
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="t-data min-w-0 flex-1 truncate text-[12px]">
                    {name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {meta}
                  </span>
                  <Download className="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dòng hoạt động */}
        <div className="bg-card rounded-xl border shadow-xs">
          <div className="t-label text-muted-foreground flex items-center gap-1.5 border-b px-4 py-2.5">
            <History className="size-3.5" /> Dòng hoạt động
          </div>
          <div className="px-4 py-4">
            <div className="relative flex flex-col gap-5 before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px before:bg-[var(--border)]">
              {(
                [
                  [
                    Truck,
                    'Về kho một phần',
                    '2.1 / 4.2 m³ gỗ thông đã nhập Kho A',
                    '15/08 · 09:40',
                    'var(--done)',
                  ],
                  [
                    MessageSquare,
                    'A Nhân bình luận',
                    '"Ván MDF báo NCC giao trễ 2 ngày, đã chốt lại 24/08."',
                    '15/08 · 08:12',
                    'var(--muted-foreground)',
                  ],
                  [
                    CircleCheck,
                    'GĐ duyệt phiếu',
                    'Duyệt sau 4 giờ · không ghi chú',
                    '14/08 · 16:05',
                    'var(--primary)',
                  ],
                  [
                    Send,
                    'Gửi duyệt',
                    'Lệ Hằng gửi lên Giám đốc',
                    '14/08 · 11:52',
                    'var(--muted-foreground)',
                  ],
                  [
                    PenLine,
                    'Lập phiếu',
                    'Tạo từ định mức LSX-2608-17 · 2 dòng',
                    '14/08 · 11:30',
                    'var(--muted-foreground)',
                  ],
                ] as const
              ).map(([Icon, title, detail, time, color]) => (
                <div key={title} className="relative flex gap-3">
                  <span
                    className="bg-card z-10 grid size-8 shrink-0 place-items-center rounded-full border"
                    style={{ color }}
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[12.5px] font-semibold">{title}</p>
                      <p className="t-data text-muted-foreground text-[11px]">{time}</p>
                    </div>
                    <p className="t-body text-muted-foreground mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="text-muted-foreground hover:text-foreground mt-4 flex items-center gap-1.5 text-[12px] font-medium transition-colors">
              <History className="size-3.5" /> Xem cả 12 sự kiện
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* 14 — Kit dùng chung: chính các component thật của app, sau khi thay ruột */

type KitRow = (typeof PO_ROWS)[number]

function KitSection() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'late'>('all')
  const [selected, setSelected] = useState<KitRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const toast = useToast()

  const rows = PO_ROWS.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      (q === '' || `${r.code} ${r.supplier}`.toLowerCase().includes(q.toLowerCase())),
  )

  const columns: Column<KitRow>[] = [
    {
      key: 'code',
      header: 'Mã phiếu',
      width: '130px',
      sortValue: (r) => r.code,
      cell: (r) => <DocChip>{r.code}</DocChip>,
    },
    {
      key: 'supplier',
      header: 'Nhà cung cấp',
      sortValue: (r) => r.supplier,
      cell: (r) => <span className="t-body font-medium">{r.supplier}</span>,
    },
    {
      key: 'total',
      header: 'Tổng tiền',
      width: '120px',
      align: 'right',
      sortValue: (r) => Number(r.total.replaceAll('.', '')),
      cell: (r) => <span className="t-data">{r.total}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      cell: (r) => {
        const st = PO_STATUS[r.status]
        return <Badge tone={st.tone}>{st.label}</Badge>
      },
    },
    {
      key: 'actions',
      header: '',
      width: '50px',
      align: 'right',
      cell: (r) => (
        <RowMenu
          items={[
            { label: 'Xem phiếu', onClick: () => toast.info(`Mở ${r.code}`) },
            { label: 'Sửa', onClick: () => toast.info(`Sửa ${r.code}`) },
            {
              label: 'Xoá',
              danger: true,
              onClick: () => toast.error(`Đã xoá ${r.code} (demo)`),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <Section
      id="kit"
      code="14 · KIT DÙNG CHUNG"
      title="Component thật của app — sau khi thay ruột"
      lead="Bên dưới KHÔNG phải mockup: đây là chính PageHeader, StatsBar, Toolbar, DataTable, RowMenu, RefChain, Modal đang được hàng chục màn hình gọi — vừa được viết lại thành lớp mỏng trên shadcn + token, GIỮ NGUYÊN API nên không chỗ gọi nào phải sửa. Đổi theme là cả app đổi theo."
    >
      <div className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs sm:p-5">
        <PageHeader
          breadcrumbs={[{ label: 'Cung ứng', href: '#kit' }, { label: 'Phiếu mua' }]}
          title="Theo dõi phiếu mua"
          description="Toàn bộ phiếu mua vật tư của công ty, mới nhất xếp trên."
          meta={
            <>
              <Badge tone="amber">9 chờ duyệt</Badge>
              <Badge tone="red">3 quá hẹn</Badge>
            </>
          }
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setModalOpen(true)}>
                <Pencil /> Mở Modal kit
              </Button>
              <Button size="sm">
                <Plus /> Tạo phiếu
              </Button>
            </>
          }
        />

        <StatsBar
          stats={[
            { label: 'Đang mở', value: 37, tone: 'blue' },
            { label: 'Chờ duyệt', value: 9, tone: 'amber', hint: '2 phiếu > 48h' },
            { label: 'Quá hẹn', value: 3, tone: 'red' },
            { label: 'Về đủ', value: 21, tone: 'green' },
            { label: 'Nháp', value: 6, tone: 'gray' },
            { label: 'NCC hoạt động', value: 12 },
          ]}
        />

        <RefChain
          nodes={[
            { label: 'Đơn hàng', value: 'DH-2026-0003', href: '#kit' },
            { label: 'Lệnh SX', value: 'LSX-2608-17', href: '#kit' },
            { label: 'Phiếu mua', value: 'PO-2608-041', current: true },
          ]}
        />

        <div>
          <Toolbar
            left={
              <>
                <ToolbarInput
                  value={q}
                  onChange={setQ}
                  placeholder="Tìm mã, nhà cung cấp…"
                  icon={<Search />}
                  className="w-56"
                />
                <ToolbarSelect
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'Mọi trạng thái' },
                    { value: 'pending', label: 'Chờ duyệt' },
                    { value: 'late', label: 'Quá hẹn' },
                  ]}
                />
              </>
            }
            right={
              <span className="text-muted-foreground text-xs">
                {selected.length > 0
                  ? `Đã chọn ${selected.length} phiếu`
                  : `${rows.length} phiếu`}
              </span>
            }
          />
          <DataTable
            rows={rows}
            columns={columns}
            keyFn={(r) => r.code}
            selection={{ selected, onChange: setSelected, keyFn: (r) => r.code }}
            pageSize={4}
            pageSizeOptions={[4, 10, 25]}
          />
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal dùng chung"
      >
        <p className="t-body text-muted-foreground">
          Đây là <code className="t-data text-[12px]">components/Modal</code> mà các form
          hiện hữu đang gọi — nay ăn token nên tự khớp theme, không sửa chỗ gọi nào.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Đóng
          </Button>
          <Button
            onClick={() => {
              setModalOpen(false)
              toast.success('Đã lưu (demo)')
            }}
          >
            Lưu
          </Button>
        </div>
      </Modal>
    </Section>
  )
}

function LabFooter() {
  return (
    <footer className="text-muted-foreground border-t py-8">
      <p className="t-body max-w-2xl">
        Theme v3 <b>đã áp dụng toàn app</b> từ 15/08/2026 (class{' '}
        <code className="t-data text-[12px]">theme-v3</code> ở{' '}
        <code className="t-data text-[12px]">WorkspaceShell</code>; token ở{' '}
        <code className="t-data text-[12px]">globals.css</code>). Trang này giữ làm sổ
        tham chiếu: thêm màn mới thì soi mẫu ở đây — màu, chữ, icon, bố cục, component đều
        lấy từ cùng bộ token.
      </p>
    </footer>
  )
}
