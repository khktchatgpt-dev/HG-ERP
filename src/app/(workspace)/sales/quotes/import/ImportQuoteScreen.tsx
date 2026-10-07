'use client'

import { Download, FileUp, RefreshCw, Save, Search, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import {
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  NUM,
  Nhan,
  TD,
  TH,
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

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dims = (r: RowView) =>
  r.length_mm != null && r.width_mm != null && r.height_mm != null
    ? `${r.length_mm}×${r.width_mm}×${r.height_mm}`
    : '—'

/**
 * NHẬP BÁO GIÁ TỪ EXCEL — khuôn F kiểu ERP (07/10/2026). Hai nhịp, không ghi gì
 * tới khi bấm Lưu. Dòng mơ hồ (khớp nhiều SP) không còn chỉ "bị chặn": bày ứng
 * viên để chọn tại chỗ, hoặc mở hộp tìm. Dòng "SP mới" cũng đổi được sang SP có
 * sẵn nếu người dùng biết. Thanh chốt đáy nói còn thiếu gì, bấm là nhảy tới.
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
        sub="Đọc file → khớp SP có sẵn / tạo SP mới kèm ảnh → báo giá nháp. File gốc gắn vào báo giá. Không ghi gì cho tới khi bấm Lưu."
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
                Lưu {d.counts.kept} dòng thành báo giá
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
      <p className="text-muted-foreground text-xs">
        Sau khi đọc, bạn soi từng dòng: khớp SP nào, tạo SP mới nào, dòng nào cần chọn
        tay.
      </p>
    </div>
  )
}

function XemTruoc({ d }: { d: ImportQuoteCtx }) {
  const p = d.preview!
  const go = (id?: string) => {
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ block: 'center' })
  }
  const pickRow = d.pickFor != null ? d.rows.find((r) => r.row === d.pickFor) : null
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
        <span className="text-muted-foreground text-xs">
          File: <span className="font-mono">{p.source_name}</span> — sẽ gắn vào ngăn Tài
          liệu của báo giá
        </span>
      </FilterRow>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} w-8 px-2`}>Lấy</th>
              <th className={`${TH} w-12 text-right`}>Dòng</th>
              <th className={`${TH} min-w-[260px]`}>Sản phẩm trong file</th>
              <th className={`${TH} min-w-[260px]`}>Việc sẽ làm</th>
              <th className={`${TH} w-[120px]`}>KT (mm)</th>
              <th className={`${TH} w-[80px] text-right`}>SL/MOQ</th>
              <th className={`${TH} w-[100px] text-right`}>Đơn giá</th>
              <th className={`${TH} w-[60px] text-right`}>CK %</th>
              <th className={`${TH} w-10 text-center`}>Ảnh</th>
            </tr>
          </thead>
          <tbody>
            {d.visible.length === 0 && (
              <tr>
                <td
                  colSpan={9}
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

      {/* thanh chốt đáy */}
      <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
        <span className="text-[13px]">
          <span className="text-muted-foreground">Sẽ lưu</span>{' '}
          <span className="font-mono font-semibold tabular-nums">{d.counts.kept}</span>
          <span className="text-muted-foreground"> dòng</span>
          {d.tong.withQty > 0 && (
            <>
              <span className="text-muted-foreground"> · tổng theo SL </span>
              <span className="font-mono font-semibold tabular-nums">
                {fmt(d.tong.value)} {d.currency}
              </span>
              {d.tong.withQty < d.counts.kept && (
                <span className="text-muted-foreground">
                  {' '}
                  ({d.tong.withQty}/{d.counts.kept} dòng có SL)
                </span>
              )}
            </>
          )}
        </span>
        <span className="bg-border h-4 w-px" />
        {d.missing.length ? (
          <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="text-[var(--stop)]">Chưa lưu được — còn thiếu:</span>
            {d.missing.map((m, i) => (
              <button
                key={i}
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
                onClick={() => {
                  go(m.focus)
                  document.getElementById(m.focus ?? '')?.focus()
                }}
              >
                {m.msg}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-[13px] text-[var(--done)]">
            Đủ điều kiện — tạo báo giá NHÁP, bạn soi lại rồi gửi khách
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
  const off = d.skip.has(r.row) || r.effective === 'blocked'
  return (
    <tr id={`row-${r.row}`} className={`${off ? 'opacity-60' : ''} hover:bg-muted/40`}>
      <td className={`${TD} px-2`}>
        <input
          type="checkbox"
          checked={!off}
          disabled={r.effective === 'blocked'}
          onChange={() => d.toggle(r.row)}
          aria-label={`Lấy dòng ${r.row}`}
        />
      </td>
      <td className={`${TD} text-muted-foreground text-right font-mono text-xs`}>
        {r.row}
      </td>
      <td className={`${TD} py-1`}>
        <div className="flex flex-col">
          <span className="font-medium">{r.name ?? '—'}</span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {[r.code, r.customer_item_code && `KH: ${r.customer_item_code}`]
              .filter(Boolean)
              .join(' · ') || 'không mã'}
          </span>
          {r.warnings.map((w) => (
            <span key={w} className="text-[11px] text-[var(--warn)]">
              ⚠ {w}
            </span>
          ))}
        </div>
      </td>
      <td className={`${TD} py-1`}>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {r.effective === 'blocked' ? (
              <Nhan tone="stop">cần xem</Nhan>
            ) : r.effective === 'existing' ? (
              <Nhan tone="neutral">{r.pick ? 'SP bạn chọn' : 'dùng SP có sẵn'}</Nhan>
            ) : (
              <Nhan tone="done">tạo SP mới</Nhan>
            )}
            {r.effectiveLabel && (
              <span className="text-muted-foreground truncate text-[12px]">
                {r.effectiveLabel}
              </span>
            )}
          </div>
          {r.why && <span className="text-[11px] text-[var(--stop)]">{r.why}</span>}
          {r.missing.length === 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {r.candidates
                .filter((c) => c.id !== r.pick?.id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="border-border hover:bg-muted rounded-sm border px-1.5 py-0.5 font-mono text-[11px]"
                    title={c.name}
                    onClick={() => d.setPick(r.row, c)}
                  >
                    {c.code}
                  </button>
                ))}
              <button
                type="button"
                className="text-[11px] text-[var(--primary)] hover:underline"
                onClick={() => d.setPickFor(r.row)}
              >
                <Search className="mr-0.5 inline size-3" strokeWidth={1.8} />
                {r.pick
                  ? 'đổi SP…'
                  : r.effective === 'new'
                    ? 'thật ra đã có? chọn SP…'
                    : 'tìm SP…'}
              </button>
              {r.pick && (
                <button
                  type="button"
                  className="text-muted-foreground text-[11px] hover:underline"
                  onClick={() => d.setPick(r.row, null)}
                >
                  bỏ chọn
                </button>
              )}
            </div>
          )}
        </div>
      </td>
      <td className={`${TD} font-mono text-xs tabular-nums`}>{dims(r)}</td>
      <td className={`${TD} ${NUM}`}>
        {r.qty != null ? r.qty.toLocaleString('en-US') : ''}
      </td>
      <td className={`${TD} ${NUM}`}>{r.unit_price != null ? fmt(r.unit_price) : '—'}</td>
      <td className={`${TD} ${NUM}`}>{r.discount_pct != null ? r.discount_pct : ''}</td>
      <td className={`${TD} text-center`}>
        {r.has_image ? '🖼' : <span className="text-muted-foreground">—</span>}
      </td>
    </tr>
  )
}
