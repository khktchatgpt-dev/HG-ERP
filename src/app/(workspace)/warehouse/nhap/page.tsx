import Link from 'next/link'
import { ArrowDownToLine, CalendarDays, Truck, Undo2 } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { Badge } from '@/components/Badge'

export const dynamic = 'force-dynamic'

/**
 * NHẬP KHO — CHỜ NHẬN (plan-kho-redesign GĐ1). Trục nhìn là "hôm nay có gì về":
 * đợt giao NCC đã hẹn (0152) xếp theo ngày, quá hẹn nổi đỏ; dưới là đơn đang mở
 * CHƯA khai đợt (NCC giao lúc nào không biết trước — vẫn phải ngóng).
 *
 * Nút "Lập phiếu nhập" mở form PNK sẵn có với PO + đợt CHỌN SẴN — Kho không
 * phải dò lại đơn trong dropdown. Tồn chỉ đổi khi phiếu được lập (nguyên tắc:
 * kho xác nhận biến động, không gõ số tồn).
 */
export default async function WarehouseInboundPage() {
  const user = await authService.requirePageUser()
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || (user.role === 'manager' && isWh) || isWh
  const today = new Date().toISOString().slice(0, 10)

  const [shipments, openPos] = await Promise.all([
    poShipmentsRepo.listOpen(),
    supplyRepo.listOpenPos(),
  ])
  const poWithShipment = new Set(shipments.map((s) => s.po_id))
  const posNoShipment = openPos.filter((p) => !poWithShipment.has(p.id))

  const groups: { label: string; tone: string; rows: typeof shipments }[] = [
    {
      label: 'Quá hẹn',
      tone: 'var(--stop)',
      rows: shipments.filter((s) => s.expected_date < today),
    },
    {
      label: 'Hôm nay',
      tone: 'var(--warn)',
      rows: shipments.filter((s) => s.expected_date === today),
    },
    {
      label: 'Sắp tới',
      tone: 'var(--primary)',
      rows: shipments.filter((s) => s.expected_date > today),
    },
  ].filter((g) => g.rows.length > 0)

  const dmy = (iso: string) =>
    new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Nhập kho' }]}
        title="Nhập kho — chờ nhận"
        description="Đợt giao nhà cung cấp đã hẹn, xếp theo ngày. Lập phiếu nhập là tồn tự tăng — không ai gõ số tồn trực tiếp."
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Link
                  href="/warehouse/docs?new=return"
                  className="border-input hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                >
                  <Undo2 className="size-4" /> Trả hàng NCC
                </Link>
                <Link
                  href="/warehouse/docs?new=receipt"
                  className="bg-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  <ArrowDownToLine className="size-4" /> Lập phiếu nhập
                </Link>
              </>
            )}
          </div>
        }
      />

      {shipments.length === 0 && posNoShipment.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-xl border py-14 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-xl">
            <Truck className="text-muted-foreground size-6" strokeWidth={1.8} />
          </span>
          <p className="t-title mt-4">Không có hàng nào đang chờ nhận</p>
          <p className="t-body text-muted-foreground mt-1 max-w-sm">
            Khi Cung ứng gửi đơn và NCC hẹn lịch, các đợt giao sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.label} className="bg-card overflow-hidden rounded-xl border">
              <header className="flex items-center gap-2.5 border-b px-4 py-2.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: g.tone }}
                  aria-hidden
                />
                <b className="text-[13px]">{g.label}</b>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold tabular-nums"
                  style={{
                    color: g.tone,
                    background: `color-mix(in srgb, ${g.tone} 12%, transparent)`,
                  }}
                >
                  {g.rows.length}
                </span>
              </header>
              <div className="divide-border/60 divide-y">
                {g.rows.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                  >
                    <span
                      className="t-data inline-flex w-14 shrink-0 items-center gap-1 text-[12.5px] font-semibold"
                      style={{ color: g.tone }}
                    >
                      <CalendarDays className="size-3.5" strokeWidth={1.8} />
                      {dmy(s.expected_date)}
                    </span>
                    <DocChip className="text-[11px]">{s.po_code}</DocChip>
                    <span className="t-body min-w-0 flex-1 truncate font-medium">
                      {s.supplier_name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[11.5px]">
                      đợt {s.seq} · {s.line_count} dòng ·{' '}
                      <span className="t-data">
                        {s.total_qty.toLocaleString('vi-VN')}
                      </span>
                    </span>
                    {s.status === 'arrived' && <Badge tone="blue">Xe tới</Badge>}
                    {/* K4: Kho xem thẳng đơn (dòng hàng, SL, đợt) — user chốt
                        16/08: Kho thấy đủ như Cung ứng, khỏi làm màn riêng. */}
                    <Link
                      href={`/planning/pos/${s.po_id}`}
                      className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-2 hover:underline"
                    >
                      Xem đơn
                    </Link>
                    {canEdit && (
                      <Link
                        href={`/warehouse/docs?new=receipt&po=${s.po_id}&shipment=${s.id}`}
                        className="border-input hover:bg-accent inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                      >
                        <ArrowDownToLine className="size-3.5" /> Lập phiếu nhập
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          {posNoShipment.length > 0 && (
            <section className="bg-card overflow-hidden rounded-xl border">
              <header className="flex items-center gap-2.5 border-b px-4 py-2.5">
                <b className="text-[13px]">Đơn đang mở — chưa hẹn đợt giao</b>
                <span className="text-muted-foreground text-xs">
                  {posNoShipment.length} đơn · NCC giao lúc nào chưa biết, vẫn nhận được
                </span>
              </header>
              <div className="divide-border/60 divide-y">
                {posNoShipment.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                  >
                    <DocChip className="text-[11px]">{p.code}</DocChip>
                    <span className="t-body min-w-0 flex-1 truncate">
                      {p.supplier_name}
                    </span>
                    {p.lsx_code && (
                      <span className="t-data text-muted-foreground text-[11px]">
                        LSX {p.lsx_code}
                      </span>
                    )}
                    <Link
                      href={`/warehouse/don-ncc/${p.id}`}
                      className="text-muted-foreground hover:text-foreground shrink-0 text-xs underline-offset-2 hover:underline"
                    >
                      Xem đơn
                    </Link>
                    {canEdit && (
                      <Link
                        href={`/warehouse/docs?new=receipt&po=${p.id}`}
                        className="border-input hover:bg-accent inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                      >
                        <ArrowDownToLine className="size-3.5" /> Lập phiếu nhập
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
