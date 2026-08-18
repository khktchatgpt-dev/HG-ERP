import { Package, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { poLineAmount } from '@/lib/po-line'
import { colKey, LSX_FORM, specColumnsOf } from '@/modules/dept/sales/lsx-template'
import { money } from './approval-helpers'
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

// Tiền: `money` / `moneyByCurrency` ở approval-helpers.ts (toán thuần, có test).

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
  amber: 'text-[var(--warn)]',
  red: 'text-[var(--stop)] font-medium',
}

/**
 * Cột quy cách trên bảng SP của màn duyệt — LẤY THẲNG từ mẫu phiếu lệnh
 * (`LSX_FORM`), không khai lại.
 *
 * 17/08/2026 — sửa lỗi trang "Xem kỹ" của Lệnh sản xuất CRASH TRẮNG. Bản cũ khai
 * cứng khoá `machine/cushion/paint/glass/wood`, đó là khoá của `tech_spec` trong
 * HỒ SƠ SP; còn `spec` của DÒNG LỆNH dùng khoá mẫu cột `may/nem/son/kinh/go`
 * (0114, `SPEC_FROM_PRODUCT` đã ánh xạ khi nạp dòng). Tra sai khoá ra
 * `undefined`, rồi `.trim()` ném TypeError — hỏng cả trang, Giám đốc không mở
 * nổi phiếu để đọc. Kể cả không ném thì 5 cột quy cách cũng luôn trống rỗng.
 */
const SPEC_COLUMNS = specColumnsOf(LSX_FORM).map((c) => ({
  key: colKey(c),
  label: c.label,
}))

export const BOM: Record<ApprovalLsxLine['bom_status'], { label: string; cls: string }> =
  {
    done: {
      label: 'BOM xong',
      cls: 'text-[var(--done)] bg-[color-mix(in_srgb,var(--done)_12%,transparent)]',
    },
    drawing: {
      label: 'Đang vẽ',
      cls: 'text-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)]',
    },
    none: {
      label: 'Chưa có BOM',
      cls: 'text-[var(--stop)] bg-[color-mix(in_srgb,var(--stop)_12%,transparent)]',
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
      <div className="flex items-center gap-2 text-sm text-[var(--done)]">
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
          ? 'bg-[color-mix(in_srgb,var(--stop)_12%,transparent)] text-[var(--stop)]'
          : 'bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] text-[var(--warn)]',
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
  // `?? ''` chứ không tra thẳng: `spec` là Record<string, string> nên TypeScript
  // hứa mọi khoá đều có, còn thực tế dòng lệnh chỉ mang khoá nào Sales điền.
  const specOf = (ln: ApprovalLsxLine, key: string) => (ln.spec[key] ?? '').trim()
  const usedSpecs = SPEC_COLUMNS.filter((f) => lines.some((ln) => specOf(ln, f.key)))
  return (
    /*
      @container: đo BỀ RỘNG CỦA CHÍNH KHỐI NÀY, không phải bề rộng màn hình.
      Bảng nằm trong cột trái của bố cục 2 cột, nên "màn 1280px" có thể chỉ còn
      640px chỗ thật — dùng media query theo màn là đoán sai. Dưới 42rem đổi
 sang THẺ, đúng luật /design-lab mục 12: "bảng thành thẻ, không bóp cột".
    */
    <div className="@container">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Sản phẩm · thông số SX &amp; BOM</SectionLabel>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {lines.length} SP · {totalQty.toLocaleString('vi-VN')} cái
        </span>
      </div>

      {/* ── Khối hẹp: mỗi SP một thẻ ──────────────────────────────────────── */}
      <ul className="divide-border/60 divide-y @2xl:hidden">
        {lines.map((ln, i) => (
          <li key={`c-${ln.product_code}-${i}`} className="flex gap-3 py-3">
            {ln.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ln.image_url}
                alt={ln.product_name}
                className="bg-background size-14 shrink-0 rounded border object-contain"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded border">
                <Package className="size-4 opacity-50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <div className="font-medium">{ln.product_name}</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {ln.product_code}
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {ln.qty.toLocaleString('vi-VN')}{' '}
                  <span className="text-muted-foreground font-sans text-xs font-normal">
                    {ln.product_unit}
                  </span>
                </span>
              </div>
              <div className="mt-1.5">
                <span
                  className={cn(
                    'inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
                    BOM[ln.bom_status].cls,
                  )}
                >
                  {BOM[ln.bom_status].label}
                </span>
              </div>
              {usedSpecs.some((f) => specOf(ln, f.key)) && (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {usedSpecs
                    .filter((f) => specOf(ln, f.key))
                    .map((f) => (
                      <div key={f.key} className="min-w-0">
                        <dt className="text-muted-foreground text-[11px]">{f.label}</dt>
                        <dd className="whitespace-pre-line">{specOf(ln, f.key)}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>
          </li>
        ))}
        <li className="flex items-baseline justify-between py-2.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Tổng SL
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {totalQty.toLocaleString('vi-VN')}
          </span>
        </li>
      </ul>

      {/* ── Khối rộng: bảng ngang kiểu bản in ─────────────────────────────── */}
      <div className="-mx-1 hidden overflow-x-auto @2xl:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-border/60 border-b text-left text-[11px] uppercase">
              <th className="w-8 py-2 pr-2 text-right font-medium">STT</th>
              <th className="w-14 px-2 py-2 font-medium">Hình</th>
              <th className="w-full px-2 py-2 font-medium">Sản phẩm</th>
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
              <tr key={`${ln.product_code}-${i}`} className="align-top">
                <td className="text-muted-foreground py-3 pr-2 text-right tabular-nums">
                  {i + 1}
                </td>
                <td className="px-2 py-3">
                  {ln.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ln.image_url}
                      alt={ln.product_name}
                      className="bg-background size-12 rounded border object-contain"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded border">
                      <Package className="size-4 opacity-50" />
                    </div>
                  )}
                </td>
                {/* Mã nằm DƯỚI tên như bảng vật tư của đơn mua — cùng một lối đọc. */}
                <td className="px-2 py-3">
                  <div className="font-medium">{ln.product_name}</div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                    {ln.product_code}
                  </div>
                </td>
                <td className="text-muted-foreground px-2 py-3 whitespace-nowrap">
                  {ln.product_unit}
                </td>
                <td className="px-2 py-3 text-right font-medium tabular-nums">
                  {ln.qty.toLocaleString('vi-VN')}
                </td>
                <td className="px-2 py-3">
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
                  <td
                    key={f.key}
                    className="min-w-[7rem] px-2 py-3 text-xs whitespace-pre-line"
                  >
                    {specOf(ln, f.key) || (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-border/60 border-t">
              {/* 4 cột trước SL: STT · Hình · Sản phẩm · ĐVT (mã SP đã gộp vào tên). */}
              <td colSpan={4} className="py-2 pr-2 text-right font-semibold">
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
export function PoLineTable({
  lines,
  total,
  currency,
}: {
  lines: PoLine[]
  total: number
  currency: string
}) {
  if (!lines.length) return null
  const hasQty2 = lines.some((ln) => ln.qty2 != null)
  return (
    // Cùng luật với bảng SP: đo bề rộng KHỐI, hẹp thì đổi sang thẻ. Bảng vật tư
    // có tới 9 cột nên bóp vào cột trái 640px là không đọc nổi.
    <div className="@container">
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

      {/* ── Khối hẹp: mỗi dòng vật tư một thẻ ─────────────────────────────── */}
      <ul className="divide-border/60 divide-y @2xl:hidden">
        {lines.map((ln) => (
          <li key={`c-${ln.id}`} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{ln.material_name}</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {ln.material_code}
                  {ln.spec ? ` · ${ln.spec}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-sm font-semibold tabular-nums">
                  {ln.unit_price != null ? (
                    money(poLineAmount(ln), currency)
                  ) : (
                    <span className="text-[var(--warn)]">chưa có giá</span>
                  )}
                </div>
                <div className="text-muted-foreground font-mono text-xs tabular-nums">
                  {Number(ln.qty_ordered).toLocaleString('vi-VN')} {ln.material_unit}
                  {ln.unit_price != null && ` × ${fmtVnd(ln.unit_price)}`}
                </div>
              </div>
            </div>
            {(ln.qty2 != null || (ln.note && ln.note.trim())) && (
              <div className="text-muted-foreground mt-1 text-xs">
                {ln.qty2 != null && (
                  <span className="text-[var(--primary)]">
                    quy đổi {Number(ln.qty2).toLocaleString('vi-VN')} {ln.unit2 ?? ''}
                  </span>
                )}
                {ln.qty2 != null && ln.note?.trim() ? ' · ' : ''}
                {ln.note?.trim()}
              </div>
            )}
          </li>
        ))}
        <li className="flex items-baseline justify-between py-2.5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Tổng cộng
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {money(total, currency)}
          </span>
        </li>
      </ul>

      {/* ── Khối rộng: bảng đủ cột như bản in ─────────────────────────────── */}
      <div className="-mx-1 hidden overflow-x-auto @2xl:block">
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
              {/* Tiền tệ đặt ở TIÊU ĐỀ cột — ô số giữ trần để cột số thẳng hàng. */}
              <th className="px-2 py-2 text-right font-medium">Đơn giá ({currency})</th>
              <th className="px-2 py-2 text-right font-medium">
                Thành tiền ({currency})
              </th>
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
                  <td className="px-2 py-2 text-right whitespace-nowrap text-[var(--primary)] tabular-nums">
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
                        <span className="text-xs text-[var(--primary)]">/{ln.unit2}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[var(--warn)]">chưa có</span>
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
                {money(total, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
