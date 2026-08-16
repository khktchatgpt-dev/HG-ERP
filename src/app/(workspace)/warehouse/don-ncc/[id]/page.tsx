import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowDownToLine, ArrowLeft, ExternalLink, Printer, Truck } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { Badge } from '@/components/Badge'
import { DocChip } from '@/components/erp/DocChip'
import { PageHeader } from '@/components/erp/PageHeader'
import { poStatusLabel, poStatusTone } from '@/lib/po-status'
import { fmtMoney, poLineAmount, poMoney } from '@/lib/po-line'
import { HttpError } from '@/server/http'

/**
 * CHI TIẾT ĐƠN ĐẶT NCC — GÓC NHÌN KHO (16/08/2026, nối từ /warehouse/don-ncc).
 *
 * Trả lời 3 câu của người giữ kho, theo đúng thứ tự họ hỏi khi xe sắp tới:
 *   1. Đơn này gồm GÌ, về tới đâu, còn chờ bao nhiêu?  → bảng dòng
 *   2. Bao giờ về, đợt nào?                             → kế hoạch giao
 *   3. Đã nhập những phiếu nào rồi?                     → sổ phiếu của đơn
 * Toàn trang CHỈ ĐỌC + nút lập phiếu nhập — sửa đơn là việc của Cung ứng
 * (nút "Xem bên Cung ứng" sang trang đầy đủ điều khoản/duyệt).
 */
export default async function WarehousePoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  let detail
  try {
    detail = await posService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { po, lines, status_lines, extra_lsx, warehouse_docs } = detail
  const shipments = await posService.listShipments(user, po.id)

  const today = new Date().toISOString().slice(0, 10)
  const late =
    po.expected_at &&
    po.expected_at.slice(0, 10) < today &&
    !['received', 'cancelled'].includes(po.status)
  const lsxCodes = po.lsx_code
    ? [po.lsx_code, ...extra_lsx.map((l) => l.code)].join(' + ')
    : null
  const num = (n: number) => n.toLocaleString('vi-VN')
  const dmy = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')
  const m = poMoney({
    subtotalRaw: lines.reduce((s, l) => s + poLineAmount(l), 0),
    discount: po.discount_amount,
    vatRate: po.vat_rate,
    priceIncludesVat: po.price_includes_vat,
    currency: po.currency,
  })
  const receivable = [
    'approved',
    'ordered',
    'confirmed',
    'in_transit',
    'partial',
  ].includes(po.status)

  const card = 'bg-card rounded-xl border'
  const cardHead =
    'flex flex-wrap items-center gap-2 border-b border-border/70 px-3.5 py-2.5 text-[13px]'

  return (
    <div className="flex flex-col gap-4 pb-10">
      <PageHeader
        breadcrumbs={[
          { label: 'Kho', href: '/warehouse' },
          { label: 'Đơn đặt NCC', href: '/warehouse/don-ncc' },
          { label: po.code },
        ]}
        title={`Đơn đặt ${po.code}`}
        description={`${po.supplier_name} · ${lsxCodes ? `LSX ${lsxCodes}` : 'đơn ngoài LSX'}`}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && receivable && (
              <Link
                href={`/warehouse/docs?new=receipt&po=${po.id}`}
                className="bg-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                <ArrowDownToLine className="size-4" strokeWidth={1.8} /> Lập phiếu nhập
              </Link>
            )}
            <Link
              href={`/planning/pos/${po.id}`}
              className="border-input hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm shadow-xs"
            >
              <ExternalLink className="size-4" strokeWidth={1.8} /> Xem bên Cung ứng
            </Link>
            <Link
              href="/warehouse/don-ncc"
              className="border-input hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm shadow-xs"
            >
              <ArrowLeft className="size-4" strokeWidth={1.8} /> Về danh sách
            </Link>
          </div>
        }
      />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── TRÁI: dòng hàng → kế hoạch giao → sổ phiếu ─────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className={card}>
            <div className={cardHead}>
              <b>Dòng hàng</b>
              <span className="text-muted-foreground">
                {status_lines.length} dòng vật tư kho
              </span>
            </div>
            <div className="overflow-x-auto px-3.5 py-2">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-muted-foreground border-border/60 border-b text-left text-[10px] uppercase">
                    <th className="py-1.5 pr-2">Vật tư</th>
                    <th className="w-28 py-1.5 pr-2 text-right">SL đặt</th>
                    <th className="w-24 py-1.5 pr-2 text-right">Đã về</th>
                    <th className="w-28 py-1.5 pr-2 text-right">Còn chờ</th>
                    <th className="w-20 py-1.5 pr-2 text-right">QC loại</th>
                  </tr>
                </thead>
                <tbody>
                  {status_lines.map((l) => (
                    <tr key={l.id} className="border-border/40 border-b">
                      <td className="py-1.5 pr-2">
                        <span className="t-data text-muted-foreground text-[11px]">
                          {l.material_code}
                        </span>{' '}
                        {l.material_name}
                      </td>
                      <td className="t-data py-1.5 pr-2 text-right">
                        {num(l.qty_ordered)} {l.material_unit}
                      </td>
                      <td className="t-data py-1.5 pr-2 text-right">
                        {num(l.qty_received)}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {l.closed_short_at ? (
                          <Badge tone="gray">Chốt thiếu {num(l.qty_missing)}</Badge>
                        ) : l.qty_open > 0 ? (
                          <span className="t-data font-medium text-amber-600">
                            {num(l.qty_open)}
                          </span>
                        ) : (
                          <Badge tone="green">Đủ</Badge>
                        )}
                      </td>
                      <td className="t-data text-muted-foreground py-1.5 pr-2 text-right">
                        {l.qty_rejected > 0 ? num(l.qty_rejected) : '—'}
                      </td>
                    </tr>
                  ))}
                  {lines.some((l) => l.material_id == null) && (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-2 text-xs">
                        Đơn còn {lines.filter((l) => l.material_id == null).length} dòng
                        TỰ DO (gỗ/gia công) — nghiệm thu ngoài sổ kho, Cung ứng xác nhận
                        bên trang đơn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className={card}>
            <div className={cardHead}>
              <Truck className="text-muted-foreground size-4" strokeWidth={1.8} />
              <b>Kế hoạch giao</b>
              <span className="text-muted-foreground">
                {shipments.length > 0
                  ? `${shipments.length} đợt`
                  : 'NCC chưa hẹn đợt — giao lúc nào nhận lúc đó'}
              </span>
            </div>
            {shipments.length > 0 && (
              <div className="divide-border/50 divide-y">
                {shipments.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-[13px]"
                  >
                    <span className="t-data w-16 shrink-0">{dmy(s.expected_date)}</span>
                    <span className="min-w-0 flex-1">
                      Đợt {s.seq} · {s.lines.length} dòng
                      {s.note ? (
                        <span className="text-muted-foreground"> · {s.note}</span>
                      ) : null}
                    </span>
                    {s.status === 'arrived' && <Badge tone="blue">Xe tới</Badge>}
                    {s.status === 'received' && <Badge tone="green">Đã nhận</Badge>}
                    {s.status === 'cancelled' && <Badge tone="gray">Đã huỷ</Badge>}
                    {s.status === 'planned' && s.expected_date < today && (
                      <Badge tone="red">Quá hẹn</Badge>
                    )}
                    {canEdit && (s.status === 'planned' || s.status === 'arrived') && (
                      <Link
                        href={`/warehouse/docs?new=receipt&po=${po.id}&shipment=${s.id}`}
                        className="text-primary text-xs underline-offset-2 hover:underline"
                      >
                        Nhập đợt này
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={card}>
            <div className={cardHead}>
              <b>Sổ phiếu của đơn</b>
              <span className="text-muted-foreground">
                {warehouse_docs.length > 0
                  ? `${warehouse_docs.length} phiếu đã lập`
                  : 'chưa có phiếu nào'}
              </span>
            </div>
            {warehouse_docs.length > 0 && (
              <div className="divide-border/50 divide-y">
                {warehouse_docs.map((d) => (
                  <div
                    key={d.doc_id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2 text-[13px]"
                  >
                    <DocChip className="text-[11px]">{d.code}</DocChip>
                    <Badge tone={d.kind === 'receipt' ? 'green' : 'red'}>
                      {d.kind === 'receipt' ? 'Nhận' : 'Trả NCC'}
                    </Badge>
                    <span className="t-data">{num(d.qty_total)}</span>
                    <span className="text-muted-foreground min-w-0 flex-1 text-xs">
                      {new Date(d.at).toLocaleString('vi-VN')}
                    </span>
                    <a
                      href={`/print/warehouse/${d.doc_id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                    >
                      <Printer className="size-3.5" strokeWidth={1.8} /> In
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── PHẢI: thẻ tóm tắt ──────────────────────────────────────────── */}
        <aside className={`${card} px-3.5 py-3 text-[13px]`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge tone={poStatusTone(po.status)}>{poStatusLabel(po.status)}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Nhà cung cấp</span>
              <b className="text-right">{po.supplier_name}</b>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Hẹn giao</span>
              <span className={`t-data ${late ? 'font-semibold text-red-600' : ''}`}>
                {po.expected_at ? dmy(po.expected_at) : '—'}
                {late && ' · quá hẹn'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Lệnh sản xuất</span>
              <span className="t-data text-right">{lsxCodes ?? 'ngoài LSX'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Phụ trách (CƯ)</span>
              <span className="text-right">{po.assignee_name ?? '—'}</span>
            </div>
            <div className="border-border/60 mt-1 flex items-center justify-between gap-2 border-t pt-2">
              <span className="text-muted-foreground">Tổng thanh toán</span>
              <b className="t-data">{fmtMoney(m.grandTotal, po.currency)}</b>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
