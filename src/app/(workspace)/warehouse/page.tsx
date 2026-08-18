import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  PackageSearch,
  Truck,
} from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { stockRepo, docsRepo } from '@/modules/dept/warehouse/stock.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { Badge } from '@/components/Badge'

export const dynamic = 'force-dynamic'

/**
 * DASHBOARD KHO (plan-kho-redesign GĐ1) — chỉ THEO DÕI, thao tác nằm ở màn
 * nghiệp vụ. Trả lời bốn câu của người trực kho mỗi sáng: hôm nay có gì VỀ,
 * có lệnh nào chờ CẤP, cái gì SẮP HẾT, hôm nay đã nhập/xuất bao nhiêu phiếu.
 */
export default async function WarehouseHome() {
  const user = await authService.requirePageUser()
  void user
  const today = new Date().toISOString().slice(0, 10)

  const [materials, lowStock, docsToday, openShipments, openPos, pendingStocktake] =
    await Promise.all([
      materialsRepo.list({ active_only: true, page: 1, page_size: 1 }),
      stockRepo.list({ low_only: true }),
      docsRepo.countTodayByKind(),
      poShipmentsRepo.listOpen(),
      supplyRepo.listOpenPos(),
      docsRepo.countPending(), // biên bản kiểm kê chờ duyệt (0157)
    ])

  const overdue = openShipments.filter((s) => s.expected_date < today)
  const dueToday = openShipments.filter((s) => s.expected_date === today)
  const upcoming = openShipments.filter((s) => s.expected_date > today)
  // PO mở mà CHƯA có đợt nào chờ — vẫn phải ngóng, nhưng không có ngày cụ thể.
  const poWithShipment = new Set(openShipments.map((s) => s.po_id))
  const posNoShipment = openPos.filter((p) => !poWithShipment.has(p.id))

  const dmy = (iso: string) =>
    new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kho' }]}
        title="Tổng quan kho"
        description="Tồn tự tính từ phiếu nhập/xuất — màn này chỉ theo dõi, thao tác nằm ở Nhập kho / Cấp vật tư."
      />

      {/* Bốn ô đầu — đúng sketch: tồn, cảnh báo, nhập/xuất hôm nay */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Mã vật tư đang dùng"
          value={materials.total}
          icon={<Boxes className="size-4" strokeWidth={1.8} />}
          href="/warehouse/materials"
        />
        <StatCard
          label="Sắp hết (dưới tồn min)"
          value={lowStock.length}
          tone={lowStock.length > 0 ? 'warn' : undefined}
          icon={<PackageSearch className="size-4" strokeWidth={1.8} />}
          href="/warehouse/stock?low=1"
        />
        <StatCard
          label="Phiếu nhập hôm nay"
          value={docsToday.receipt ?? 0}
          icon={<ArrowDownToLine className="size-4" strokeWidth={1.8} />}
          href="/warehouse/docs"
        />
        <StatCard
          label="Phiếu xuất hôm nay"
          value={docsToday.issue ?? 0}
          icon={<ArrowUpFromLine className="size-4" strokeWidth={1.8} />}
          href="/warehouse/docs"
        />
      </div>

      {/* Biên bản kiểm kê chờ duyệt (0157) — tồn chưa đổi cho tới khi duyệt. */}
      {pendingStocktake > 0 && (
        <Link
          href="/warehouse/docs?kind=stocktake"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <b>{pendingStocktake}</b> biên bản kiểm kê chờ duyệt — tồn chưa điều chỉnh cho
          tới khi quản lý Kho duyệt
        </Link>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Chờ nhập — đợt giao NCC đã hẹn */}
        <section className="bg-card rounded-xl border">
          <header className="flex items-center gap-2 border-b px-4 py-2.5">
            <Truck className="text-muted-foreground size-4" strokeWidth={1.8} />
            <b className="text-[13px]">Hàng chờ nhận</b>
            <span className="text-muted-foreground text-xs">
              {openShipments.length} đợt · {posNoShipment.length} đơn chưa hẹn đợt
            </span>
            <Link
              href="/warehouse/nhap"
              className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-0.5 text-xs"
            >
              Nhập kho <ChevronRight className="size-3.5" />
            </Link>
          </header>
          {openShipments.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-[12.5px]">
              Không có đợt giao nào đang hẹn. Đơn đang mở chưa khai đợt nằm ở màn Nhập
              kho.
            </p>
          ) : (
            <div className="divide-border/60 divide-y">
              {[...overdue, ...dueToday, ...upcoming].slice(0, 6).map((s) => {
                const late = s.expected_date < today
                const isToday = s.expected_date === today
                return (
                  <Link
                    key={s.id}
                    href="/warehouse/nhap"
                    className="hover:bg-accent flex items-center gap-2.5 px-4 py-2 transition-colors"
                  >
                    <span
                      className="t-data w-12 shrink-0 text-[12px] font-semibold"
                      style={{
                        color: late
                          ? 'var(--stop)'
                          : isToday
                            ? 'var(--warn)'
                            : 'var(--muted-foreground)',
                      }}
                    >
                      {dmy(s.expected_date)}
                    </span>
                    <DocChip className="text-[11px]">{s.po_code}</DocChip>
                    <span className="t-body min-w-0 flex-1 truncate">
                      {s.supplier_name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11.5px]">
                      đợt {s.seq} · {s.line_count} dòng
                    </span>
                    {late && <Badge tone="red">Quá hẹn</Badge>}
                    {isToday && <Badge tone="amber">Hôm nay</Badge>}
                    {s.status === 'arrived' && <Badge tone="blue">Xe tới</Badge>}
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Vật tư sắp hết */}
        <section className="bg-card rounded-xl border">
          <header className="flex items-center gap-2 border-b px-4 py-2.5">
            <PackageSearch className="text-muted-foreground size-4" strokeWidth={1.8} />
            <b className="text-[13px]">Vật tư dưới tồn tối thiểu</b>
            <span className="text-muted-foreground text-xs">{lowStock.length} mã</span>
            <Link
              href="/warehouse/stock?low=1"
              className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-0.5 text-xs"
            >
              Tồn kho <ChevronRight className="size-3.5" />
            </Link>
          </header>
          {lowStock.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-[12.5px]">
              Không mã nào dưới mức tối thiểu.
            </p>
          ) : (
            <div className="divide-border/60 divide-y">
              {lowStock.slice(0, 6).map((s) => (
                <Link
                  key={s.material_id}
                  href="/warehouse/stock?low=1"
                  className="hover:bg-accent flex items-center gap-2.5 px-4 py-2 transition-colors"
                >
                  <span className="t-data text-muted-foreground w-20 shrink-0 truncate text-[11px]">
                    {s.code}
                  </span>
                  <span className="t-body min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="t-data shrink-0 text-[12px] font-medium text-[var(--warn)]">
                    {s.on_hand.toLocaleString('vi-VN')}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    / min {(s.min_stock ?? 0).toLocaleString('vi-VN')} {s.unit}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Lối đi nhanh theo nghiệp vụ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            [
              '/warehouse/nhap',
              'Nhập kho',
              'Đợt giao chờ nhận, lập phiếu nhập, trả NCC',
              ArrowDownToLine,
            ],
            [
              '/warehouse/xuat',
              'Cấp vật tư SX',
              'Lệnh đang chạy — cần / đã cấp / còn thiếu',
              ArrowUpFromLine,
            ],
            [
              '/warehouse/stocktake',
              'Kiểm kê',
              'Biên bản đếm, chênh lệch hệ thống vs thực tế',
              ClipboardCheck,
            ],
            [
              '/warehouse/docs',
              'Sổ chứng từ',
              'Mọi phiếu nhập / xuất / kiểm kê đã lập',
              Boxes,
            ],
          ] as const
        ).map(([href, title, desc, Icon]) => (
          <Link
            key={href}
            href={href}
            className="bg-card rounded-xl border p-4 transition-colors hover:border-[var(--primary)]/40"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--accent)]">
                <Icon
                  className="size-4 text-[var(--accent-foreground)]"
                  strokeWidth={1.8}
                />
              </span>
              <span className="text-[13px] font-semibold">{title}</span>
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
  icon,
  href,
}: {
  label: string
  value: number
  tone?: 'warn'
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link
      href={href}
      className="bg-card rounded-xl border px-3.5 py-2.5 transition-colors hover:border-[var(--primary)]/40"
    >
      <div className="flex items-center justify-between">
        <p className="t-label text-muted-foreground truncate">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p
        className="mt-1 font-mono text-[22px] leading-none font-semibold tabular-nums"
        style={tone === 'warn' && value > 0 ? { color: 'var(--warn)' } : undefined}
      >
        {value.toLocaleString('vi-VN')}
      </p>
    </Link>
  )
}
