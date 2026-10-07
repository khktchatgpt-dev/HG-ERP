'use client'

import Link from 'next/link'
import { CalendarRange, ClipboardList } from 'lucide-react'
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
  Thanh,
  ToolBtn,
} from '../_erp/ui'
import {
  daysBetween,
  fmtD,
  fmtN,
  isRunning,
  LSX_LABEL,
  lsxTone,
  shortName,
  SORT_LABEL,
  TAB_LABEL,
  type SortKey,
  type Tab,
} from './so-lenh.shared'
import { useSoLenh, type SoLenhProps } from './useSoLenh'

/**
 * SỔ LỆNH SẢN XUẤT của Sale — khuôn C · Danh sách, kiểu ERP: "lệnh nào cần tôi
 * động vào?". Dải ô đếm = bước vòng đời + hai rổ việc (xuất ≤ 14 ngày, chưa
 * chia đợt); lưới phẳng: tiến độ công đoạn thật, vật tư, lô kế tiếp (D1), bản N.
 * Phát lệnh làm ở trang đơn (chọn đơn gộp tại đó) — ô "Đơn chờ lệnh" dẫn sang.
 */
export function SoLenhScreen(props: SoLenhProps) {
  const d = useSoLenh(props)
  const TABS: Tab[] = [
    'all',
    'draft',
    'pending',
    'running',
    'completed',
    'rejected',
    'due_soon',
    'no_lots',
  ]
  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Lệnh sản xuất' }]}
        title="Lệnh sản xuất"
        sub={`${fmtN(d.scope.length)} lệnh · ${fmtN(d.customers.length)} khách`}
        actions={
          <>
            <ToolBtn href="/sales/ke-hoach-xuat" icon={CalendarRange}>
              Kế hoạch xuất
            </ToolBtn>
            {d.canIssue && (
              <ToolBtn href="/sales/orders?tab=todo" icon={ClipboardList} primary>
                Phát lệnh từ đơn
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
              on={d.tab === t}
              onClick={() => d.setTab(t)}
              tone={
                t === 'rejected' && n > 0
                  ? 'stop'
                  : (t === 'due_soon' || t === 'no_lots' || t === 'pending') && n > 0
                    ? 'warn'
                    : t === 'completed'
                      ? 'done'
                      : 'neutral'
              }
              width="min-w-[118px] flex-1 basis-0"
            />
          )
        })}
        <CountCell
          label="Đơn chờ lệnh"
          value={fmtN(d.awaiting)}
          sub="phát ở trang đơn"
          tone={d.awaiting > 0 ? 'warn' : 'neutral'}
          href="/sales/orders"
          width="min-w-[118px] flex-1 basis-0"
        />
      </CountStrip>

      <FilterRow>
        {d.mineCount > 0 && (
          <Seg
            label="Phạm vi"
            value={d.mineOnly ? 'mine' : 'all'}
            onChange={(v) => d.setMineOnly(v === 'mine')}
            options={[
              { value: 'mine', label: 'Tôi lập', count: d.mineCount },
              { value: 'all', label: 'Cả phòng', count: d.rows.length },
            ]}
          />
        )}
        <Chon
          label="Khách"
          value={d.customer}
          onChange={d.setCustomer}
          options={[
            { value: 'all', label: 'Mọi khách hàng' },
            ...d.customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
          width={220}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="số lệnh · đơn · PO lô"
            className="border-border bg-card text-foreground h-7 w-[240px] rounded-sm border px-2 text-[13px] focus:border-[var(--primary)] focus:outline-none"
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
      </FilterRow>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1240px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} w-10 text-right`}>#</th>
              <th className={`${TH} w-[170px]`}>Số lệnh</th>
              <th className={`${TH} w-[160px]`}>Khách hàng</th>
              <th className={`${TH} w-[150px]`}>Đơn</th>
              <th className={`${TH} w-[130px]`}>Trạng thái</th>
              <th className={`${TH} w-[150px]`}>Công đoạn</th>
              <th className={`${TH} w-[90px]`}>Vật tư</th>
              <th className={`${TH} w-[110px]`}>Hạn xuất</th>
              <th className={`${TH} w-[190px]`}>Lô kế tiếp</th>
              <th className={`${TH} w-20 text-right`}>SL</th>
              <th className={`${TH} w-20 text-right`}>Đã xếp lô</th>
              <th className={`${TH} w-[90px]`}>Người lập</th>
            </tr>
          </thead>
          <tbody>
            {d.visible.map((r, i) => {
              const ship = r.next_lot?.ship_date ?? r.ship_date
              const days = ship ? daysBetween(d.today, ship) : null
              const run = isRunning(r)
              return (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    <Link
                      href={`/sales/lsx/${r.id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      {r.code}
                    </Link>
                    {r.revision > 1 && (
                      <span className="ml-1">
                        <Nhan tone="warn">bản {r.revision}</Nhan>
                      </span>
                    )}
                  </td>
                  <td className={`${TD} truncate`} title={r.customer_name}>
                    {r.customer_name}
                  </td>
                  <td
                    className={`${TD} truncate font-mono text-xs`}
                    title={r.order_codes.join(', ')}
                  >
                    {r.order_codes[0] ?? '—'}
                    {r.order_codes.length > 1 && (
                      <span className="text-muted-foreground">
                        {' '}
                        +{r.order_codes.length - 1}
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    <Nhan tone={lsxTone(r.status)}>
                      {LSX_LABEL[r.status] ?? r.status}
                    </Nhan>
                  </td>
                  <td className={TD}>
                    {run || r.status === 'completed' ? (
                      r.jobs_total > 0 ? (
                        <Thanh
                          ratio={r.jobs_done / r.jobs_total}
                          label={`${r.jobs_done}/${r.jobs_total}`}
                          tone={r.jobs_done === r.jobs_total ? 'done' : undefined}
                        />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          chưa lên kế hoạch
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-xs`}>
                    {!run ? (
                      <span className="text-muted-foreground">—</span>
                    ) : r.materials_received_at ? (
                      <span className="text-[var(--done)]">đã nhận</span>
                    ) : r.materials_due_at && r.materials_due_at < d.today ? (
                      <span className="text-[var(--stop)]">quá hạn VT</span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa nhận</span>
                    )}
                  </td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    {fmtD(r.ship_date)}
                    {run && days != null && days < 0 && (
                      <span className="ml-1 text-[var(--stop)]">quá {-days}n</span>
                    )}
                    {run && days != null && days >= 0 && days <= 14 && (
                      <span className="ml-1 text-[var(--warn)]">còn {days}n</span>
                    )}
                  </td>
                  <td className={`${TD} truncate text-xs`}>
                    {r.next_lot ? (
                      <>
                        <span className="font-mono">{fmtD(r.next_lot.ship_date)}</span>
                        {r.next_lot.po && (
                          <span className="text-muted-foreground">
                            {' '}
                            · {r.next_lot.po}
                          </span>
                        )}
                        <span className="text-muted-foreground"> · {r.lots} lô</span>
                      </>
                    ) : run ? (
                      <Link
                        href={`/sales/ke-hoach-xuat?lsx=${r.id}`}
                        className="text-[var(--warn)] hover:underline"
                      >
                        chưa chia đợt
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${TD} ${NUM}`}>{fmtN(r.qty)}</td>
                  <td
                    className={`${TD} ${NUM} ${r.lot_qty < r.qty && run ? 'text-[var(--warn)]' : ''}`}
                  >
                    {r.lots ? fmtN(r.lot_qty) : '—'}
                  </td>
                  <td className={`${TD} text-xs`} title={r.created_by_name ?? ''}>
                    {shortName(r.created_by_name)}
                  </td>
                </tr>
              )
            })}
            {d.visible.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className={`${TD} text-muted-foreground py-8 text-center`}
                >
                  Không có lệnh nào khớp. Đổi ô đếm phía trên, bỏ lọc khách hoặc xoá từ
                  khoá.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-muted font-medium">
              <td className={`${TD} border-t`} colSpan={9}>
                Cộng {fmtN(d.filtered.length)} lệnh
                {d.filtered.length > d.visible.length && (
                  <button
                    type="button"
                    onClick={d.more}
                    className="ml-2 text-xs font-normal text-[var(--primary)] hover:underline"
                  >
                    xem thêm (đang hiện {fmtN(d.visible.length)})
                  </button>
                )}
              </td>
              <td className={`${TD} ${NUM} border-t`}>
                {fmtN(d.filtered.reduce((s, r) => s + r.qty, 0))}
              </td>
              <td className={`${TD} ${NUM} border-t`}>
                {fmtN(d.filtered.reduce((s, r) => s + r.lot_qty, 0))}
              </td>
              <td className={`${TD} border-t`} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ErpStatusBar
        left={
          <>
            {fmtN(d.visible.length)}/{fmtN(d.filtered.length)} lệnh
            {d.mineOnly ? ' · lệnh tôi lập' : ' · cả phòng'} · hạn xuất = lô sớm nhất khi
            đã chia đợt
          </>
        }
        right={`Hôm nay ${fmtD(d.today)}`}
      />
    </ErpPage>
  )
}
