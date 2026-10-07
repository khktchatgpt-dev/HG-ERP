'use client'

import Link from 'next/link'
import { CalendarRange, Plus, Tags } from 'lucide-react'
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
  shortName,
  SORT_LABEL,
  sumByCurrency,
  TAB_LABEL,
  type SortKey,
  type Tab,
} from './so-don-hang.shared'
import { useSoDonHang, type SoDonHangProps } from './useSoDonHang'

/**
 * SỔ ĐƠN BÁN — khuôn C · Danh sách, kiểu ERP (Dynamics list page / SAP list
 * report): "trong sổ này, đơn nào cần tôi động vào?". Dải ô đếm = bộ lọc theo
 * bước vòng đời + hai rổ việc (quá hạn, thiếu dữ liệu); lưới PHẲNG một đơn một
 * dòng (sổ Mua hàng cũng chọn phẳng 30/09/2026), cột Đã xuất / còn như sổ Excel
 * "order HG"; chân bảng cộng theo tiền tệ.
 */
export function SoDonHangScreen(props: SoDonHangProps) {
  const d = useSoDonHang(props)
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
  const shownClosed = !(d.hideClosed && d.tab === 'all')
  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Đơn hàng' }]}
        title="Đơn hàng bán"
        sub={`${fmtN(d.scope.length)} đơn · ${fmtN(d.customersInScope.length)} khách`}
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
              sub={
                t === 'done' ? 'chờ xuất' : t === 'running' ? 'đã phát lệnh' : undefined
              }
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
          value={d.customer}
          onChange={d.setCustomer}
          options={[
            { value: 'all', label: 'Mọi khách hàng' },
            ...d.customersInScope.map((c) => ({ value: c.id, label: c.name })),
          ]}
          width={220}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="số đơn · PO · lệnh · mã SP · mã khách"
            className="border-border bg-card text-foreground h-7 w-[260px] rounded-sm border px-2 text-[13px] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <Chon
          label="Sắp"
          value={d.sort}
          onChange={(v) => d.setSort(v as SortKey)}
          options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
            value: k,
            label: SORT_LABEL[k],
          }))}
          width={170}
        />
        {d.tab === 'all' && (
          <Tick checked={d.hideClosed} onChange={d.setHideClosed}>
            Ẩn đơn đã giao / đã huỷ
          </Tick>
        )}
        <span className="text-muted-foreground ml-auto text-xs">
          {d.count('cancelled') > 0 && (
            <button
              type="button"
              onClick={() => d.setTab('cancelled')}
              className="hover:text-[var(--primary)] hover:underline"
            >
              {fmtN(d.count('cancelled'))} đã huỷ
            </button>
          )}
        </span>
      </FilterRow>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col className="w-[150px]" />
            <col />
            <col className="w-[136px]" />
            <col className="w-[150px]" />
            <col className="w-[118px]" />
            <col className="w-[68px]" />
            <col className="w-[96px]" />
            <col className="w-[128px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Số đơn · PO khách</th>
              <th className={TH}>Khách hàng</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Lệnh SX</th>
              <th className={TH}>Hạn giao</th>
              <th className={`${TH} text-right`}>SL</th>
              <th className={`${TH} text-right`}>Đã xuất</th>
              <th className={`${TH} text-right`}>Giá trị</th>
              <th className={TH}>Người tạo</th>
            </tr>
          </thead>
          <tbody>
            {d.visible.map((o, i) => {
              const days = d.lateDays(o)
              const late = d.isLate(o)
              const left = Math.max(o.qty - o.shipped, 0)
              return (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
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
                    {o.lsx_id && o.lsx_code ? (
                      <Link
                        href={`/sales/lsx/${o.lsx_id}`}
                        className="text-[var(--primary)] hover:underline"
                      >
                        {o.lsx_code}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">chưa phát</span>
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
                  <td
                    className={`${TD} truncate text-xs`}
                    title={o.created_by_name ?? ''}
                  >
                    {shortName(o.created_by_name)}
                  </td>
                </tr>
              )
            })}
            {d.visible.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className={`${TD} text-muted-foreground py-8 text-center`}
                >
                  Không có đơn nào khớp. Đổi ô đếm phía trên, bỏ lọc khách hoặc xoá từ
                  khoá.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-muted font-medium">
              <td className={`${TD} border-t`} colSpan={6}>
                Cộng {fmtN(d.filtered.length)} đơn
                {d.filtered.length > d.visible.length && (
                  <button
                    type="button"
                    onClick={d.more}
                    className="ml-2 text-xs font-normal text-[var(--primary)] hover:underline"
                  >
                    xem thêm (đang hiện {fmtN(d.visible.length)})
                  </button>
                )}
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

      <ErpStatusBar
        left={
          <>
            {fmtN(d.visible.length)}/{fmtN(d.filtered.length)} đơn
            {d.mineOnly ? ' · đang xem đơn của tôi' : ' · cả phòng'}
            {d.total > d.orders.length &&
              ` · sổ có ${fmtN(d.total)} đơn, mới tải ${fmtN(d.orders.length)}`}
          </>
        }
        right={`Hôm nay ${fmtD(d.today)}`}
      />
    </ErpPage>
  )
}
