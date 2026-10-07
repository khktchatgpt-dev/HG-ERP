'use client'

import { AlertTriangle, Download, FileUp, RefreshCw, Save, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import {
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Nhan,
  ToolBtn,
} from '../../_erp/ui'
import {
  useImportQuote,
  type Customer,
  type ImportQuoteCtx,
  type RowView,
} from './useImportQuote'

const INPUT =
  'h-7 rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none'
const BTN_SUB =
  'inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-card px-2.5 text-[13px] text-foreground hover:bg-muted disabled:opacity-50'
const BTN_PRI =
  'inline-flex h-8 items-center gap-1.5 rounded-sm bg-[var(--primary)] px-3 text-[13px] font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50'

/* Lưới dày: tiêu đề 28px, ô hai dòng chữ cố định (~46px), vạch ngang mảnh, số mono căn phải. */
const TH =
  'h-7 border-b border-border bg-muted px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase'
const TD = 'h-[46px] border-b border-border px-2 align-middle text-[13px]'
const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'
const SUB = 'text-muted-foreground block truncate text-[11px] leading-4'

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dims = (r: RowView) =>
  r.length_mm != null && r.width_mm != null && r.height_mm != null
    ? `${r.length_mm}×${r.width_mm}×${r.height_mm}`
    : '—'
/** Một dòng đóng gói gọn: ĐVT · SL/thùng · thùng · NW/GW · 40HC. */
const packText = (r: RowView) =>
  [
    r.unit,
    r.qty_per_carton != null && `${r.qty_per_carton}/thùng`,
    r.carton_l_cm != null &&
      r.carton_w_cm != null &&
      r.carton_h_cm != null &&
      `thùng ${r.carton_l_cm}×${r.carton_w_cm}×${r.carton_h_cm}`,
    (r.nw_kg != null || r.gw_kg != null) && `NW ${r.nw_kg ?? '?'} / GW ${r.gw_kg ?? '?'}`,
    r.loading_40hc != null && `${r.loading_40hc}/40HC`,
  ]
    .filter(Boolean)
    .join(' · ')
const amount = (r: RowView) =>
  r.qty != null && r.unit_price != null
    ? r.qty * r.unit_price * (1 - (r.discount_pct ?? 0) / 100)
    : null

/**
 * NHẬP BÁO GIÁ TỪ EXCEL — khuôn F kiểu ERP (07/10/2026). Hai nhịp, không ghi gì
 * tới khi bấm Lưu. Lưới là nhân vật chính: mỗi dòng file một hàng hai dòng chữ —
 * trái là SP trong file (ảnh + tên + mã), giữa là quy cách và SP SẼ DÙNG (khớp /
 * tạo mới / bạn chọn), phải là số. Dòng mơ hồ bày ứng viên để chọn tại chỗ.
 */
export function ImportQuoteScreen({ customers }: { customers: Customer[] }) {
  const d = useImportQuote(customers)
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          { label: 'Nhập từ Excel' },
        ]}
        title="Nhập báo giá từ file Excel"
        sub="Soi từng dòng rồi mới lưu — SP mới kèm ảnh vào thư viện, file gốc gắn vào báo giá."
        actions={
          <>
            {/* Thẻ <a> thật để trình duyệt nhận content-disposition — Link của Next điều hướng client-side, không tải xuống được. */}
            <a
              href="/api/dept/sales/quotes/import/template"
              download
              className="border-border bg-card text-foreground hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[13px] whitespace-nowrap"
            >
              <Download className="h-4 w-4" strokeWidth={1.8} /> Tải file mẫu
            </a>
            {d.preview && (
              <ToolBtn onClick={d.reset} icon={RefreshCw}>
                Chọn file khác
              </ToolBtn>
            )}
            {d.preview && (
              <ToolBtn onClick={d.save} icon={Save} primary>
                Lưu {d.counts.kept} dòng
              </ToolBtn>
            )}
          </>
        }
      />
      {!d.preview ? <ChonFile d={d} /> : <XemTruoc d={d} />}
    </ErpPage>
  )
}

function ChonFile({ d }: { d: ImportQuoteCtx }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
      <FileUp className="text-muted-foreground size-8" strokeWidth={1.5} />
      <p className="text-[14px] font-medium">Chọn file báo giá (.xlsx)</p>
      <p className="text-muted-foreground max-w-xl text-center text-[13px]">
        Dùng mẫu <b>BÁO GIÁ — SẢN PHẨM MỚI</b>: mỗi dòng một SP, ảnh chèn đè lên ô cột
        “Ảnh” của đúng dòng, kích thước D×R×C mm. Cột <b>SL / MOQ</b> và <b>CK %</b> là
        tuỳ chọn — có SL thì tờ in thêm cột Qty và Amount.
      </p>
      <label className={`${BTN_PRI} cursor-pointer`}>
        <FileUp className="size-4" strokeWidth={1.8} /> Chọn file…
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          disabled={d.busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void d.readFile(f)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

function XemTruoc({ d }: { d: ImportQuoteCtx }) {
  const p = d.preview!
  const pickRow = d.pickFor != null ? d.rows.find((r) => r.row === d.pickFor) : null
  const goto = (id?: string) => {
    if (!id) return
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }
  const allOn = d.counts.kept > 0 && d.counts.kept === d.counts.total - d.counts.blocked
  return (
    <>
      <CountStrip>
        <CountCell
          label="Dòng đọc được"
          value={d.counts.total}
          sub={`sheet ${p.sheet_name} · tiêu đề dòng ${p.header_row}`}
          on={d.filter === 'all'}
          onClick={() => d.setFilter('all')}
        />
        <CountCell
          label="Khớp SP có sẵn"
          value={d.counts.existing}
          sub="dùng lại hồ sơ"
          on={d.filter === 'existing'}
          onClick={() => d.setFilter('existing')}
        />
        <CountCell
          label="Sẽ tạo SP mới"
          value={d.counts.new}
          sub="vào thư viện khi lưu"
          tone={d.counts.new ? 'done' : 'neutral'}
          on={d.filter === 'new'}
          onClick={() => d.setFilter('new')}
        />
        <CountCell
          label="Cần xem"
          value={d.counts.blocked}
          sub="thiếu dữ liệu · mơ hồ · trùng"
          tone={d.counts.blocked ? 'stop' : 'neutral'}
          on={d.filter === 'blocked'}
          onClick={() => d.setFilter('blocked')}
        />
        <CountCell
          label="Sẽ lưu"
          value={d.counts.kept}
          sub={
            d.counts.withQty ? `${d.counts.withQty} dòng có SL / MOQ` : 'chỉ chào đơn giá'
          }
        />
      </CountStrip>

      <FilterRow>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Khách hàng *</span>
          <select
            id="f-customer"
            className={`${INPUT} min-w-[260px]`}
            value={d.customerId}
            onChange={(e) => d.pickCustomer(e.target.value)}
          >
            <option value="">— chọn khách hàng —</option>
            {d.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Tiền tệ</span>
          <input
            className={`${INPUT} w-16 font-mono`}
            value={d.currency}
            onChange={(e) => d.setCurrency(e.target.value.toUpperCase().slice(0, 3))}
          />
        </label>
        <span className="text-muted-foreground ml-auto text-xs">
          File <span className="text-foreground font-mono">{p.source_name}</span> · gắn
          vào ngăn Tài liệu của báo giá
        </span>
      </FilterRow>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-8" />
            <col className="w-10" />
            <col className="w-12" />
            <col />
            <col className="w-[230px]" />
            <col className="w-[150px]" />
            <col className="w-[72px]" />
            <col className="w-[88px]" />
            <col className="w-[52px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-center`}>
                <input
                  type="checkbox"
                  aria-label="Lấy tất cả"
                  checked={allOn}
                  onChange={(e) => d.setAll(e.target.checked)}
                />
              </th>
              <th className={`${TH} text-right`}>#</th>
              <th className={`${TH} text-center`}>Ảnh</th>
              <th className={TH}>Sản phẩm</th>
              <th className={TH}>Quy cách · đóng gói</th>
              <th className={TH}>Tình trạng</th>
              <th className={`${TH} text-right`}>SL/MOQ</th>
              <th className={`${TH} text-right`}>Đơn giá</th>
              <th className={`${TH} text-right`}>CK%</th>
              <th className={`${TH} text-right`}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {d.visible.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="text-muted-foreground px-6 py-8 text-center text-[13px]"
                >
                  Không có dòng nào ở nhóm này.
                </td>
              </tr>
            )}
            {d.visible.map((r) => (
              <Dong key={r.row} d={d} r={r} />
            ))}
          </tbody>
          {d.kept.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted text-[12px] font-medium">
                <td className="border-border h-8 border-t px-2" colSpan={6}>
                  <span className="text-muted-foreground">
                    Tổng {d.kept.length} dòng sẽ lưu
                    {d.tong.withQty < d.kept.length &&
                      ` · ${d.kept.length - d.tong.withQty} dòng chỉ chào đơn giá (không vào tổng)`}
                  </span>
                </td>
                <td className={`border-border h-8 border-t px-2 ${NUM}`}>
                  {d.kept.reduce((s, r) => s + (r.qty ?? 0), 0).toLocaleString('en-US')}
                </td>
                <td className="border-border h-8 border-t" colSpan={2} />
                <td className={`border-border h-8 border-t px-2 ${NUM}`}>
                  {fmt(d.tong.value)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {p.skipped.length > 0 && (
        <ErpStatusBar
          left={`Bỏ ${p.skipped.length} dòng khi đọc file: ${p.skipped
            .slice(0, 5)
            .map((s) => `dòng ${s.row} (${s.reason})`)
            .join(' · ')}${p.skipped.length > 5 ? '…' : ''}`}
        />
      )}

      <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
        <span className="text-[13px]">
          <span className="text-muted-foreground">Sẽ lưu</span>{' '}
          <span className="font-mono font-semibold tabular-nums">{d.counts.kept}</span>
          <span className="text-muted-foreground"> dòng · </span>
          <span className="font-mono font-semibold tabular-nums">
            {fmt(d.tong.value)} {d.currency}
          </span>
        </span>
        <span className="bg-border h-4 w-px" />
        {d.missing.length ? (
          <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="text-[var(--stop)]">Còn thiếu:</span>
            {d.missing.map((m, i) => (
              <button
                key={i}
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
                onClick={() => goto(m.focus)}
              >
                {m.msg}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-[13px] text-[var(--done)]">
            Đủ điều kiện — tạo báo giá NHÁP, soi lại rồi gửi khách
          </span>
        )}
        <span className="flex-1" />
        <button type="button" className={BTN_SUB} onClick={d.reset}>
          <X className="size-3.5" strokeWidth={1.8} /> Huỷ
        </button>
        <button
          type="button"
          className={BTN_PRI}
          disabled={d.busy || d.missing.length > 0}
          onClick={d.save}
        >
          <Save className="size-4" strokeWidth={1.8} />
          {d.busy ? 'Đang lưu…' : `Lưu ${d.counts.kept} dòng thành báo giá`}
        </button>
      </div>

      <ProductSearchDialog
        open={d.pickFor != null}
        onOpenChange={(v) => {
          if (!v) d.setPickFor(null)
        }}
        customerId={d.customerId || null}
        usedIds={new Set()}
        multi={false}
        title={
          pickRow ? `Chọn SP cho dòng ${pickRow.row} — ${pickRow.name ?? ''}` : 'Chọn SP'
        }
        onConfirm={(ps) => {
          if (d.pickFor != null && ps[0]) d.setPick(d.pickFor, ps[0])
          d.setPickFor(null)
        }}
      />
    </>
  )
}

function Dong({ d, r }: { d: ImportQuoteCtx; r: RowView }) {
  const blocked = r.effective === 'blocked'
  const off = d.skip.has(r.row) || blocked
  const amt = amount(r)
  const warn = r.warnings[0]
  return (
    <tr
      id={`row-${r.row}`}
      tabIndex={-1}
      className={`${off ? 'text-muted-foreground' : ''} hover:bg-muted/40 focus:bg-[var(--accent)]/40 focus:outline-none`}
    >
      <td className={`${TD} text-center`}>
        <input
          type="checkbox"
          checked={!off}
          disabled={blocked}
          onChange={() => d.toggle(r.row)}
          aria-label={`Lấy dòng ${r.row}`}
        />
      </td>
      <td className={`${TD} text-muted-foreground text-right font-mono text-xs`}>
        {r.row}
      </td>
      <td className={`${TD} px-1 text-center`}>
        {/* Ảnh nhúng trong file ưu tiên; không có thì ảnh thư viện của SP sẽ dùng — tooltip nói rõ nguồn. */}
        <Thumb
          src={r.thumb}
          alt={r.name ?? ''}
          title={
            r.image_data_url
              ? 'Ảnh trong file Excel — gắn vào SP mới khi lưu'
              : r.thumb
                ? 'Ảnh trong thư viện của SP sẽ dùng'
                : r.has_image
                  ? 'Có ảnh trong file (quá lớn để xem trước) — vẫn gắn khi lưu'
                  : 'Chưa có ảnh (file không có, thư viện cũng chưa)'
          }
        />
      </td>
      <td className={`${TD} min-w-0`}>
        <span className="block truncate font-medium" title={r.name ?? ''}>
          {r.name ?? '—'}
        </span>
        <span className={`${SUB} font-mono`}>
          {[r.code, r.customer_item_code && `KH ${r.customer_item_code}`]
            .filter(Boolean)
            .join(' · ') || 'không mã'}
          {r.description_en && <span className="font-sans"> · {r.description_en}</span>}
        </span>
        {r.ambiguous && !r.pick && r.missing.length === 0 && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            {r.candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                className="border-border bg-card inline-flex shrink-0 items-center gap-1 rounded-sm border py-px pr-1.5 pl-px font-mono text-[11px] hover:border-[var(--primary)]"
                title={c.name}
                onClick={() => d.setPick(r.row, c)}
              >
                <Thumb src={c.image_url} alt={c.name} size={18} />
                {c.code}
              </button>
            ))}
          </span>
        )}
      </td>
      <td className={`${TD} min-w-0`}>
        <span className="block truncate font-mono text-xs tabular-nums">
          {dims(r)} <span className="text-muted-foreground">mm</span>
          {r.material && (
            <span className="text-muted-foreground font-sans"> · {r.material}</span>
          )}
        </span>
        <span className={SUB} title={packText(r)}>
          {packText(r) || '—'}
        </span>
      </td>
      <td className={`${TD} min-w-0`}>
        <TinhTrang d={d} r={r} />
      </td>
      <td className={`${TD} ${NUM}`}>
        {r.qty != null ? r.qty.toLocaleString('en-US') : ''}
      </td>
      <td className={`${TD} ${NUM} ${r.unit_price == null ? 'text-[var(--stop)]' : ''}`}>
        {r.unit_price != null ? fmt(r.unit_price) : 'thiếu'}
      </td>
      <td className={`${TD} ${NUM}`}>{r.discount_pct != null ? r.discount_pct : ''}</td>
      <td className={`${TD} ${NUM}`}>
        {amt != null ? fmt(amt) : <span className="text-muted-foreground">—</span>}
        {warn && (
          <span className="mt-0.5 block text-right" title={warn}>
            <AlertTriangle
              className="inline size-3 text-[var(--warn)]"
              strokeWidth={1.8}
            />
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * Cột "Tình trạng" — một nhãn + một dòng phụ. Không bày lại SP đã khớp (nó chính
 * là SP trong file); chỉ nói mã thư viện khi KHÁC mã trong file (khớp qua mã khách).
 */
function TinhTrang({ d, r }: { d: ImportQuoteCtx; r: RowView }) {
  const link = (label: string, onClick: () => void) => (
    <button
      type="button"
      className="shrink-0 text-[11px] text-[var(--primary)] hover:underline"
      onClick={onClick}
    >
      {label}
    </button>
  )
  const libCode = r.effectiveLabel?.split(' — ')[0] ?? null
  const showLib = libCode && libCode.toLowerCase() !== (r.code ?? '').toLowerCase()
  if (r.missing.length > 0)
    return (
      <>
        <Nhan tone="stop">thiếu dữ liệu</Nhan>
        <span className={`${SUB} text-[var(--stop)]`} title={r.why ?? ''}>
          {r.why}
        </span>
      </>
    )
  if (r.effective === 'blocked' && r.ambiguous && !r.pick)
    return (
      <>
        <Nhan tone="warn">chọn 1 trong {r.candidates.length}</Nhan>
        <span className={SUB}>
          bấm mã bên trái · {link('tìm…', () => d.setPickFor(r.row))}
        </span>
      </>
    )
  if (r.effective === 'blocked')
    return (
      <>
        <Nhan tone="stop">trùng</Nhan>
        <span className={`${SUB} text-[var(--stop)]`} title={r.why ?? ''}>
          {r.why}
        </span>
      </>
    )
  if (r.effective === 'new')
    return (
      <>
        <Nhan tone="done">SP mới</Nhan>
        <span className={SUB}>
          {r.code ? 'mã theo file' : 'cấp mã tạm'} ·{' '}
          {link('đã có?', () => d.setPickFor(r.row))}
        </span>
      </>
    )
  return (
    <>
      <span className="flex items-center gap-1.5">
        <Nhan tone="neutral">{r.pick ? 'bạn chọn' : 'có sẵn'}</Nhan>
        {link('đổi', () => d.setPickFor(r.row))}
        {r.pick && link('bỏ', () => d.setPick(r.row, null))}
      </span>
      <span className={`${SUB} font-mono`} title={r.effectiveLabel ?? ''}>
        {showLib ? `→ ${libCode}` : 'đúng mã trong file'}
      </span>
    </>
  )
}

/** Ảnh: thư viện (đường dẫn ký) hoặc nhúng (data URL). Không ảnh → ô trống cùng cỡ, giữ hàng thẳng. */
function Thumb({
  src,
  alt,
  size = 36,
  title,
}: {
  src: string | null
  alt: string
  size?: number
  title?: string
}) {
  if (!src)
    return (
      <span
        className="border-border bg-muted inline-block rounded-sm border align-middle"
        style={{ width: size, height: size }}
        title={title ?? 'Chưa có ảnh'}
      />
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ảnh ký sẵn / data URL, không qua next/image
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="border-border bg-card inline-block rounded-sm border object-contain align-middle"
      style={{ width: size, height: size }}
      title={title ?? 'Ảnh trong thư viện'}
    />
  )
}
