'use client'

import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Tags,
  X,
} from 'lucide-react'
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status-ui'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Nhan,
  NUM,
  Seg,
  TD,
  TH,
  Tick,
  ToolBtn,
} from '../_erp/ui'
import {
  fmtD,
  fmtMoney,
  fmtN,
  PAGE_SIZES,
  shortName,
  SORT_LABEL,
  sumByCurrency,
  TAB_LABEL,
  type Filters,
  type SortCol,
  type Tab,
} from './so-don-hang.shared'
import { useSoDonHang, type SoDonHangCtx, type SoDonHangProps } from './useSoDonHang'

const INPUT =
  'h-7 rounded-sm border border-border bg-card px-2 text-[13px] text-foreground focus:border-[var(--primary)] focus:outline-none'
const CHIP =
  'h-6 rounded-sm border border-border bg-card px-2 text-xs text-foreground hover:bg-muted'
const CHIP_ON =
  'h-6 rounded-sm border border-[var(--primary)] bg-[var(--accent)] px-2 text-xs'

const TABS: Tab[] = [
  'all',
  'todo',
  'running',
  'done',
  'partial',
  'shipped',
  'delivered',
  'late',
  'missing',
]

/**
 * SỔ ĐƠN BÁN — khuôn C · Danh sách, kiểu ERP (Dynamics list page / SAP list
 * report): "trong sổ này, đơn nào cần tôi động vào?". Dải ô đếm = bộ lọc vòng
 * đời; hai hàng lọc mịn (khách · người phụ trách · hạn giao · lệnh · thiếu dữ
 * liệu · tiền tệ · tìm); tiêu đề cột bấm để sắp; phân trang thật; tuỳ chọn
 * (phạm vi, cỡ trang, sắp, ẩn đã đóng) nhớ theo người dùng. Lưới PHẲNG một đơn
 * một dòng, chân bảng cộng theo tiền tệ.
 */
export function SoDonHangScreen(props: SoDonHangProps) {
  const d = useSoDonHang(props)
  const shownClosed = !(d.prefs.hideClosed && d.tab === 'all')
  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Đơn hàng' }]}
        title="Đơn hàng bán"
        sub={`${fmtN(d.scope.length)} đơn · ${fmtN(d.customersInScope.length)} khách${d.mineOnly ? ' · của tôi' : ' · cả phòng'}`}
        actions={
          <>
            <ToolBtn href="/sales/ke-hoach-xuat" icon={CalendarRange}>
              Kế hoạch xuất
            </ToolBtn>
            <ToolBtn href="/sales/orders/gia" icon={Tags}>
              Điền đơn giá
            </ToolBtn>
            {d.canEdit && (
              <ToolBtn href="/sales/orders/new" icon={Plus} primary>
                Tạo đơn hàng
              </ToolBtn>
            )}
          </>
        }
      />

      <CountStrip>
        {TABS.map((t) => {
          const n = d.count(t)
          return (
            <CountCell
              key={t}
              label={TAB_LABEL[t]}
              value={fmtN(n)}
              sub={t === 'done' ? 'chờ ghi xuất' : undefined}
              on={d.tab === t}
              onClick={() => d.setTab(t)}
              tone={
                t === 'late' && n > 0
                  ? 'stop'
                  : t === 'missing' && n > 0
                    ? 'warn'
                    : t === 'shipped' || t === 'delivered'
                      ? 'done'
                      : 'neutral'
              }
              width="min-w-[92px] flex-1 basis-0"
            />
          )
        })}
      </CountStrip>

      <BoLoc d={d} />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col className="w-[140px]" />
            <col />
            <col className="w-[140px]" />
            <col className="w-[112px]" />
            <col className="w-[60px]" />
            <col className="w-[80px]" />
            <col className="w-[120px]" />
            <col className="w-[100px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <ThSort d={d} col="code">
                Số đơn · PO khách
              </ThSort>
              <ThSort d={d} col="customer">
                Khách hàng
              </ThSort>
              <ThSort d={d} col="status">
                Trạng thái
              </ThSort>
              <ThSort d={d} col="due">
                Hạn giao
              </ThSort>
              <ThSort d={d} col="qty" right>
                SL
              </ThSort>
              <ThSort d={d} col="shipped" right>
                Đã xuất
              </ThSort>
              <ThSort d={d} col="total" right>
                Giá trị
              </ThSort>
              <ThSort d={d} col="owner">
                Phụ trách
              </ThSort>
            </tr>
          </thead>
          <tbody>
            {d.visible.map((o, i) => {
              const days = d.lateDays(o)
              const late = d.isLate(o)
              const left = Math.max(o.qty - o.shipped, 0)
              const stt = (d.page - 1) * d.prefs.pageSize + i + 1
              return (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{stt}</td>
                  <td className={`${TD} min-w-0`}>
                    <Link
                      href={`/sales/orders/${o.id}`}
                      className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
                      title={o.code}
                    >
                      {o.code}
                    </Link>
                    <span
                      className="text-muted-foreground block truncate font-mono text-[11px] leading-4"
                      title={o.customer_po_no ?? ''}
                    >
                      {o.customer_po_no ? (
                        `PO ${o.customer_po_no}`
                      ) : (
                        <span className="text-[var(--warn)]">thiếu PO</span>
                      )}
                    </span>
                  </td>
                  <td className={`${TD} truncate`} title={o.customer_name}>
                    {o.customer_name}
                  </td>
                  <td className={`${TD} min-w-0`}>
                    <Nhan tone={orderStatusTone(o.status)}>
                      {orderStatusLabel(o.status)}
                    </Nhan>
                    {o.missing.length > 0 && (
                      <span
                        className="block truncate text-[11px] leading-4 text-[var(--warn)]"
                        title={o.missing.join(' · ')}
                      >
                        thiếu {o.missing.join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    {o.due_date ? (
                      <>
                        {fmtD(o.due_date)}
                        {late && days != null && (
                          <span className="ml-1 text-[var(--stop)]">quá {-days}n</span>
                        )}
                        {!late &&
                          days != null &&
                          days >= 0 &&
                          days <= 14 &&
                          !shownClosed && (
                            <span className="ml-1 text-[var(--warn)]">còn {days}n</span>
                          )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${TD} ${NUM}`}>{fmtN(o.qty)}</td>
                  <td
                    className={`${TD} ${NUM} ${o.shipped > 0 ? '' : 'text-muted-foreground'}`}
                  >
                    {o.shipped > 0 ? (
                      <>
                        {fmtN(o.shipped)}
                        {left > 0 && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            còn {fmtN(left)}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${TD} ${NUM}`}>
                    {o.total > 0 ? (
                      <>
                        {fmtMoney(o.total)}{' '}
                        <span className="text-muted-foreground text-xs">
                          {o.currency}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${TD} min-w-0 text-xs`}>
                    <span
                      className="block truncate"
                      title={
                        o.owner_name
                          ? `Phụ trách khách: ${o.owner_name}`
                          : 'Khách chưa gán người phụ trách'
                      }
                    >
                      {o.owner_name ? (
                        shortName(o.owner_name)
                      ) : (
                        <span className="text-[var(--warn)]">chưa gán</span>
                      )}
                    </span>
                    <span
                      className="text-muted-foreground block truncate text-[11px] leading-4"
                      title={`Tạo: ${o.created_by_name ?? '—'} · ${fmtD(o.created_at)}`}
                    >
                      tạo {shortName(o.created_by_name)} · {fmtD(o.created_at)}
                    </span>
                  </td>
                </tr>
              )
            })}
            {d.visible.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className={`${TD} text-muted-foreground py-8 text-center`}
                >
                  Không có đơn nào khớp.{' '}
                  {d.activeFilters > 0 ? (
                    <button
                      type="button"
                      onClick={d.clearFilters}
                      className="text-[var(--primary)] hover:underline"
                    >
                      Xoá {d.activeFilters} ô lọc
                    </button>
                  ) : (
                    'Đổi ô đếm phía trên hoặc đổi phạm vi.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-muted font-medium">
              <td className={`${TD} border-t`} colSpan={5}>
                Cộng {fmtN(d.filtered.length)} đơn
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  · giá trị chưa gồm đơn giá 0
                </span>
              </td>
              <td className={`${TD} ${NUM} border-t`}>
                {fmtN(d.filtered.reduce((s, o) => s + o.qty, 0))}
              </td>
              <td className={`${TD} ${NUM} border-t`}>
                {fmtN(d.filtered.reduce((s, o) => s + o.shipped, 0))}
              </td>
              <td className={`${TD} ${NUM} border-t text-xs`} colSpan={2}>
                {sumByCurrency(d.filtered)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PhanTrang d={d} />

      <ErpStatusBar
        left={
          <>
            Sắp theo {SORT_LABEL[d.prefs.sort]} {d.prefs.dir === 'asc' ? '↑' : '↓'}
            {d.total > d.orders.length &&
              ` · sổ có ${fmtN(d.total)} đơn, mới tải ${fmtN(d.orders.length)}`}
            {' · tuỳ chọn phạm vi / cỡ trang / sắp nhớ cho riêng bạn'}
          </>
        }
        right={`Hôm nay ${fmtD(d.today)}`}
      />
    </ErpPage>
  )
}

/* ── Hai hàng lọc ──────────────────────────────────────────────────────── */
function BoLoc({ d }: { d: SoDonHangCtx }) {
  const f = d.f
  // `Chon` trả chuỗi; các ô lọc enum chỉ nhận giá trị từ chính options của nó.
  const set = (k: keyof Filters) => (v: string) => d.setFilter(k, v as never)
  return (
    <>
      <FilterRow>
        {d.mineCount > 0 && (
          <Seg
            label="Phạm vi"
            value={d.mineOnly ? 'mine' : 'all'}
            onChange={(v) => d.setMineOnly(v === 'mine')}
            options={[
              { value: 'mine', label: 'Của tôi', count: d.mineCount },
              { value: 'all', label: 'Cả phòng', count: d.orders.length },
            ]}
          />
        )}
        <Chon
          label="Khách"
          value={f.customer}
          onChange={set('customer')}
          options={[
            { value: 'all', label: 'Mọi khách hàng' },
            ...d.customersInScope.map((c) => ({ value: c.id, label: c.name })),
          ]}
          width={200}
        />
        <Chon
          label="Phụ trách"
          value={f.owner}
          onChange={set('owner')}
          options={[
            { value: 'all', label: 'Mọi người' },
            { value: 'me', label: `Tôi (${d.me.name})` },
            { value: 'none', label: 'Chưa gán ai' },
            ...d.owners
              .filter((o) => o.id !== d.me.id)
              .map((o) => ({ value: o.id, label: o.name })),
          ]}
          width={180}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={f.q}
            onChange={(e) => d.setFilter('q', e.target.value)}
            placeholder="số đơn · PO · mã SP · mã khách · người"
            className={`${INPUT} w-[220px]`}
          />
        </label>
        {d.tab === 'all' && (
          <Tick checked={d.prefs.hideClosed} onChange={(v) => d.setPref('hideClosed', v)}>
            Ẩn đã giao / đã huỷ
          </Tick>
        )}
      </FilterRow>
      <FilterRow>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Hạn giao
          <input
            type="date"
            value={f.dueFrom}
            onChange={(e) => d.setFilter('dueFrom', e.target.value)}
            className={`${INPUT} w-[118px]`}
            aria-label="Hạn giao từ"
          />
          <span>→</span>
          <input
            type="date"
            value={f.dueTo}
            onChange={(e) => d.setFilter('dueTo', e.target.value)}
            className={`${INPUT} w-[118px]`}
            aria-label="Hạn giao đến"
          />
        </label>
        <span className="flex items-center gap-1">
          <button type="button" className={CHIP} onClick={() => d.quickDue('week')}>
            Tuần
          </button>
          <button type="button" className={CHIP} onClick={() => d.quickDue('month')}>
            Tháng
          </button>
          <button type="button" className={CHIP} onClick={() => d.quickDue('late')}>
            Quá hạn
          </button>
          {(f.dueFrom || f.dueTo) && (
            <button type="button" className={CHIP_ON} onClick={() => d.quickDue('clear')}>
              bỏ ngày ×
            </button>
          )}
        </span>
        <Chon
          label="Thiếu"
          value={f.missing}
          onChange={set('missing')}
          options={[
            { value: 'all', label: 'Không lọc' },
            { value: 'any', label: 'Thiếu bất kỳ' },
            { value: 'PO', label: 'Thiếu PO' },
            { value: 'tuần giao', label: 'Thiếu tuần giao' },
            { value: 'điều khoản', label: 'Thiếu điều khoản' },
            { value: 'giá', label: 'Thiếu giá' },
          ]}
          width={140}
        />
        {d.currencies.length > 1 && (
          <Chon
            label="Tiền tệ"
            value={f.currency}
            onChange={set('currency')}
            options={[
              { value: 'all', label: 'Mọi loại' },
              ...d.currencies.map((c) => ({ value: c, label: c })),
            ]}
            width={100}
          />
        )}
        <span className="ml-auto flex items-center gap-2">
          {d.count('cancelled') > 0 && d.tab !== 'cancelled' && (
            <button
              type="button"
              onClick={() => d.setTab('cancelled')}
              className="text-muted-foreground text-xs hover:text-[var(--primary)] hover:underline"
            >
              {fmtN(d.count('cancelled'))} đã huỷ
            </button>
          )}
          {d.activeFilters > 0 && (
            <button
              type="button"
              onClick={d.clearFilters}
              className="inline-flex h-7 items-center gap-1 rounded-sm border border-[var(--primary)] bg-[var(--accent)] px-2 text-xs text-[var(--primary)]"
            >
              <X className="size-3" strokeWidth={2} /> Xoá lọc ({d.activeFilters})
            </button>
          )}
        </span>
      </FilterRow>
    </>
  )
}

/* ── Tiêu đề cột bấm để sắp ────────────────────────────────────────────── */
function ThSort({
  d,
  col,
  right,
  children,
}: {
  d: SoDonHangCtx
  col: SortCol
  right?: boolean
  children: React.ReactNode
}) {
  const on = d.prefs.sort === col
  return (
    <th
      className={`${TH} ${right ? 'text-right' : ''} p-0`}
      aria-sort={on ? (d.prefs.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => d.sortBy(col)}
        className={`hover:text-foreground inline-flex h-full w-full items-center gap-1 px-2 ${right ? 'justify-end' : ''} ${on ? 'text-foreground' : ''}`}
        title={`Sắp theo ${SORT_LABEL[col]}`}
      >
        {children}
        {on &&
          (d.prefs.dir === 'asc' ? (
            <ArrowUp className="size-3" strokeWidth={2} />
          ) : (
            <ArrowDown className="size-3" strokeWidth={2} />
          ))}
      </button>
    </th>
  )
}

/* ── Phân trang ────────────────────────────────────────────────────────── */
function PhanTrang({ d }: { d: SoDonHangCtx }) {
  const from = d.filtered.length === 0 ? 0 : (d.page - 1) * d.prefs.pageSize + 1
  const to = Math.min(d.page * d.prefs.pageSize, d.filtered.length)
  const btn =
    'inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card hover:bg-muted disabled:opacity-40'
  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-3 border-t px-6 py-1.5 text-[13px]">
      <span>
        Hiện{' '}
        <span className="font-mono tabular-nums">
          {from}–{to}
        </span>{' '}
        / <span className="font-mono tabular-nums">{fmtN(d.filtered.length)}</span> đơn
      </span>
      <span className="bg-border h-4 w-px" />
      <span className="flex items-center gap-1">
        <button
          type="button"
          className={btn}
          onClick={() => d.setPage(1)}
          disabled={d.page <= 1}
          aria-label="Trang đầu"
        >
          <ChevronsLeft className="size-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => d.setPage(d.page - 1)}
          disabled={d.page <= 1}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
        </button>
        <span className="px-2 font-mono tabular-nums">
          {d.page} / {d.pageCount}
        </span>
        <button
          type="button"
          className={btn}
          onClick={() => d.setPage(d.page + 1)}
          disabled={d.page >= d.pageCount}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => d.setPage(d.pageCount)}
          disabled={d.page >= d.pageCount}
          aria-label="Trang cuối"
        >
          <ChevronsRight className="size-4" strokeWidth={1.8} />
        </button>
      </span>
      <label className="text-muted-foreground flex items-center gap-2 text-xs">
        Mỗi trang
        <select
          className={INPUT}
          value={d.prefs.pageSize}
          onChange={(e) => d.setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
