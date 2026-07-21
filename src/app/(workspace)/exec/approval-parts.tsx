import { Package, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { poLineAmount } from '@/lib/po-line'
import { type PoLine } from '@/app/(workspace)/planning/pos/PosManager'
import type { ApprovalLsxLine, ApprovalOrderInfo } from './approval-types'

/**
 * Mảnh trình bày DÙNG CHUNG cho khu Phê duyệt: buồng lái master-detail
 * (ApprovalCockpit — panel 1 cột) lẫn trang chi tiết đơn duyệt
 * (ApprovalDetailScreen — 2 cột + sidebar quyết định). Thuần presentational.
 */

// ── Helpers định dạng ────────────────────────────────────────────────────────
export const fmtD = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('vi-VN') : '—'
export const fmtVnd = (n: number) => n.toLocaleString('vi-VN')
export const fmtTr = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 1_000_000).toLocaleString('vi-VN')} tr` : fmtVnd(n)

/** Số ngày TỚI mốc (âm = đã trễ). null nếu không có ngày. */
export function daysUntil(
  dateIso: string | null | undefined,
  nowIso: string,
): number | null {
  if (!dateIso) return null
  const d = new Date(dateIso).getTime()
  const n = new Date(nowIso).getTime()
  if (!Number.isFinite(d) || !Number.isFinite(n)) return null
  return Math.ceil((d - n) / 86_400_000)
}

export type DueTone = 'muted' | 'amber' | 'red'
export function dueBadge(days: number | null): { text: string; tone: DueTone } {
  if (days == null) return { text: '—', tone: 'muted' }
  if (days < 0) return { text: `trễ ${-days} ngày`, tone: 'red' }
  if (days === 0) return { text: 'hạn hôm nay', tone: 'red' }
  if (days <= 3) return { text: `còn ${days} ngày`, tone: 'amber' }
  return { text: `còn ${days} ngày`, tone: 'muted' }
}
export const DUE_TEXT: Record<DueTone, string> = {
  muted: 'text-muted-foreground',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400 font-medium',
}

export const SPEC_FIELDS: { key: keyof ApprovalLsxLine['spec']; label: string }[] = [
  { key: 'machine', label: 'Máy' },
  { key: 'cushion', label: 'Nệm' },
  { key: 'paint', label: 'Sơn' },
  { key: 'glass', label: 'Kính' },
  { key: 'wood', label: 'Gỗ' },
]

export const BOM: Record<ApprovalLsxLine['bom_status'], { label: string; cls: string }> =
  {
    done: {
      label: 'BOM xong',
      cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60',
    },
    drawing: {
      label: 'Đang vẽ',
      cls: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/60',
    },
    none: {
      label: 'Chưa có BOM',
      cls: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/60',
    },
  }

// ── Mảnh UI nhỏ ──────────────────────────────────────────────────────────────
export function Signal({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'alert'
  children: React.ReactNode
}) {
  if (tone === 'ok') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-4 shrink-0" />
        <span>{children}</span>
      </div>
    )
  }
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm',
        tone === 'alert'
          ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
          : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
      )}
    >
      <TriangleAlert className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
      {children}
    </div>
  )
}

export function Fact({
  label,
  children,
  tone,
  wrap,
  wide,
}: {
  label: string
  children: React.ReactNode
  tone?: DueTone
  /** Cho phép xuống dòng (trường dài như điều khoản, chứng từ). */
  wrap?: boolean
  /** Chiếm 2 cột (trường dài) để bớt xuống dòng. */
  wide?: boolean
}) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-sm font-medium',
          wrap ? 'break-words' : 'truncate',
          tone && DUE_TEXT[tone],
        )}
      >
        {children}
      </dd>
    </div>
  )
}

// Khối thông tin thương mại của đơn hàng gốc (Sales) — bối cảnh để GĐ duyệt LSX.
export function OrderInfo({ o }: { o: ApprovalOrderInfo }) {
  const yn = (v: boolean | null) => (v == null ? null : v ? 'Có' : 'Không')
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <SectionLabel>Thông tin đơn hàng (Sales)</SectionLabel>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {o.customer_po_no && <Fact label="PO khách">{o.customer_po_no}</Fact>}
        <Fact label="Ngày đặt">{fmtD(o.order_created_at)}</Fact>
        {o.due_date && <Fact label="Hạn giao (đơn)">{fmtD(o.due_date)}</Fact>}
        {o.owner_name && <Fact label="Người phụ trách">{o.owner_name}</Fact>}
        {o.deposit_percent != null && <Fact label="Đặt cọc">{o.deposit_percent}%</Fact>}
        <Fact label="Tiền tệ">{o.currency}</Fact>
        {o.quote_code && <Fact label="Từ báo giá">{o.quote_code}</Fact>}
        {o.payment_method && <Fact label="Phương thức TT">{o.payment_method}</Fact>}
        {o.payment_terms && (
          <Fact label="Thanh toán" wrap wide>
            {o.payment_terms}
          </Fact>
        )}
        {o.price_term && (
          <Fact label="Incoterm / ĐK giá" wrap wide>
            {o.price_term}
          </Fact>
        )}
        {o.port_of_loading && (
          <Fact label="Cảng xếp (POL)" wrap>
            {o.port_of_loading}
          </Fact>
        )}
        {o.port_of_discharge && (
          <Fact label="Cảng dỡ (POD)" wrap>
            {o.port_of_discharge}
          </Fact>
        )}
        {o.qty_tolerance_pct != null && (
          <Fact label="Dung sai SL">±{o.qty_tolerance_pct}%</Fact>
        )}
        {o.partial_shipment != null && (
          <Fact label="Giao từng phần">{yn(o.partial_shipment)}</Fact>
        )}
        {o.transhipment != null && <Fact label="Chuyển tải">{yn(o.transhipment)}</Fact>}
        {o.required_docs && (
          <Fact label="Chứng từ" wrap wide>
            {o.required_docs}
          </Fact>
        )}
      </dl>
    </div>
  )
}

// ── Bảng sản phẩm LSX (ngang, kiểu bản in) ──────────────────────────────────
export function LsxProductTable({ lines }: { lines: ApprovalLsxLine[] }) {
  if (!lines.length) return null
  const totalQty = lines.reduce((s, ln) => s + ln.qty, 0)
  const usedSpecs = SPEC_FIELDS.filter((f) => lines.some((ln) => ln.spec[f.key].trim()))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Sản phẩm · thông số SX &amp; BOM</SectionLabel>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {lines.length} SP · {totalQty.toLocaleString('vi-VN')} cái
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-border/60 border-b text-left text-[11px] uppercase">
              <th className="w-8 py-2 pr-2 text-right font-medium">STT</th>
              <th className="w-12 px-2 py-2 font-medium">Hình</th>
              <th className="px-2 py-2 font-medium">Mã SP</th>
              <th className="px-2 py-2 font-medium">Tên sản phẩm</th>
              <th className="px-2 py-2 font-medium">ĐVT</th>
              <th className="px-2 py-2 text-right font-medium">SL</th>
              <th className="px-2 py-2 font-medium">BOM</th>
              {usedSpecs.map((f) => (
                <th key={f.key} className="px-2 py-2 font-medium">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border/50 divide-y">
            {lines.map((ln, i) => (
              <tr key={`${ln.product_code}-${i}`} className="align-middle">
                <td className="text-muted-foreground py-2 pr-2 text-right tabular-nums">
                  {i + 1}
                </td>
                <td className="px-2 py-2">
                  {ln.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ln.image_url}
                      alt={ln.product_name}
                      className="bg-background size-9 rounded object-contain"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded">
                      <Package className="size-4 opacity-50" />
                    </div>
                  )}
                </td>
                <td className="text-muted-foreground px-2 py-2 font-mono text-xs whitespace-nowrap">
                  {ln.product_code}
                </td>
                <td className="px-2 py-2 font-medium whitespace-nowrap">
                  {ln.product_name}
                </td>
                <td className="text-muted-foreground px-2 py-2 whitespace-nowrap">
                  {ln.product_unit}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {ln.qty.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-2">
                  <span
                    className={cn(
                      'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
                      BOM[ln.bom_status].cls,
                    )}
                  >
                    {BOM[ln.bom_status].label}
                  </span>
                </td>
                {usedSpecs.map((f) => (
                  <td key={f.key} className="px-2 py-2 text-xs whitespace-nowrap">
                    {ln.spec[f.key].trim() ? (
                      ln.spec[f.key]
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border/60 border-t">
              <td colSpan={5} className="py-2 pr-2 text-right font-semibold">
                Tổng SL
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">
                {totalQty.toLocaleString('vi-VN')}
              </td>
              <td colSpan={usedSpecs.length + 1} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Bảng dòng đơn vật tư (đủ cột như bản in) ─────────────────────────────────
export function PoLineTable({ lines, total }: { lines: PoLine[]; total: number }) {
  if (!lines.length) return null
  const hasQty2 = lines.some((ln) => ln.qty2 != null)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>
          <span className="inline-flex items-center gap-1">
            <Package className="size-3.5" /> Chi tiết vật tư
          </span>
        </SectionLabel>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {lines.length} dòng
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table
          className={cn('w-full text-sm', hasQty2 ? 'min-w-[720px]' : 'min-w-[640px]')}
        >
          <thead>
            <tr className="text-muted-foreground border-border/60 border-b text-left text-[11px] uppercase">
              <th className="w-8 py-2 pr-2 text-right font-medium">STT</th>
              <th className="py-2 pr-3 font-medium">Tên vật tư</th>
              <th className="px-2 py-2 font-medium">Quy cách</th>
              <th className="px-2 py-2 font-medium">ĐVT</th>
              <th className="px-2 py-2 text-right font-medium">Số lượng</th>
              {hasQty2 && (
                <th className="px-2 py-2 text-right font-medium">SL quy đổi</th>
              )}
              <th className="px-2 py-2 text-right font-medium">Đơn giá</th>
              <th className="px-2 py-2 text-right font-medium">Thành tiền</th>
              <th className="py-2 pl-2 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-border/50 divide-y">
            {lines.map((ln, i) => (
              <tr key={ln.id}>
                <td className="text-muted-foreground py-2 pr-2 text-right tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2 pr-3">
                  <div className="font-medium">{ln.material_name}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {ln.material_code}
                  </div>
                </td>
                <td className="text-muted-foreground px-2 py-2 text-xs">
                  {ln.spec ?? '—'}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{ln.material_unit}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {Number(ln.qty_ordered).toLocaleString('vi-VN')}
                </td>
                {hasQty2 && (
                  <td className="px-2 py-2 text-right whitespace-nowrap text-violet-600 tabular-nums dark:text-violet-400">
                    {ln.qty2 != null
                      ? `${Number(ln.qty2).toLocaleString('vi-VN')} ${ln.unit2 ?? ''}`
                      : '—'}
                  </td>
                )}
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {ln.unit_price != null ? (
                    <>
                      {fmtVnd(ln.unit_price)}
                      {ln.price_basis === 'unit2' && ln.unit2 && (
                        <span className="text-xs text-violet-600 dark:text-violet-400">
                          /{ln.unit2}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">chưa có</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                  {ln.unit_price != null ? fmtVnd(poLineAmount(ln)) : '—'}
                </td>
                <td className="text-muted-foreground py-2 pl-2 text-xs">
                  {ln.note && ln.note.trim() ? ln.note : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border/60 border-t">
              <td
                colSpan={hasQty2 ? 6 : 5}
                className="py-2 pr-2 text-right font-semibold"
              >
                Tổng cộng
              </td>
              <td />
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap tabular-nums">
                {fmtVnd(total)} ₫
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
