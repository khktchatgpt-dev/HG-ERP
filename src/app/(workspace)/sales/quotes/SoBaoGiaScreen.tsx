'use client'

import Link from 'next/link'
import { FileUp, Plus } from 'lucide-react'
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
  ToolBtn,
} from '../_erp/ui'
import {
  daysBetween,
  fmtD,
  fmtMoney,
  fmtN,
  QUOTE_LABEL,
  quoteTone,
  shortName,
  SORT_LABEL,
  TAB_LABEL,
  type SortKey,
  type Tab,
} from './so-bao-gia.shared'
import { useSoBaoGia, type SoBaoGiaProps } from './useSoBaoGia'

/**
 * SỔ BÁO GIÁ — khuôn C · Danh sách, kiểu ERP: "báo giá nào cần tôi động vào?".
 * Ô đếm theo vòng đời + ba rổ việc (hết hiệu lực, nằm im ≥ 14 ngày, đã đóng);
 * lưới phẳng: bản N, hiệu lực, dòng, trị giá tham chiếu (Σ net × SL), đơn đã
 * ra. Báo giá chết từ 09/08/2026 vì không có kết cục và không sửa được bản đã
 * gửi — hai thứ đó nay là cột "Trạng thái" + "Bản".
 */
export function SoBaoGiaScreen(props: SoBaoGiaProps) {
  const d = useSoBaoGia(props)
  const TABS: Tab[] = [
    'all',
    'draft',
    'pending',
    'sent',
    'won',
    'lost',
    'expired',
    'stale',
    'closed',
  ]
  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Báo giá' }]}
        title="Báo giá"
        sub={`${fmtN(d.scope.length)} báo giá · ${fmtN(d.customers.length)} khách`}
        actions={
          <>
            {d.canEdit && (
              <ToolBtn href="/sales/quotes/import" icon={FileUp}>
                Nhập từ Excel
              </ToolBtn>
            )}
            {d.canEdit && (
              <ToolBtn href="/sales/quotes/new" icon={Plus} primary>
                Lập báo giá
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
              sub={t === 'stale' ? '≥ 14 ngày' : undefined}
              on={d.tab === t}
              onClick={() => d.setTab(t)}
              tone={
                (t === 'expired' || t === 'lost') && n > 0
                  ? 'stop'
                  : (t === 'stale' || t === 'pending') && n > 0
                    ? 'warn'
                    : t === 'won'
                      ? 'done'
                      : 'neutral'
              }
              width="min-w-[96px] flex-1 basis-0"
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
            placeholder="số BG · khách · đơn"
            className="border-border bg-card text-foreground h-7 w-[220px] rounded-sm border px-2 text-[13px] focus:border-[var(--primary)] focus:outline-none"
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
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col className="w-[128px]" />
            <col />
            <col className="w-[124px]" />
            <col className="w-[168px]" />
            <col className="w-[56px]" />
            <col className="w-[136px]" />
            <col className="w-[132px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Số BG · bản</th>
              <th className={TH}>Khách hàng</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Hiệu lực</th>
              <th className={`${TH} text-right`}>Dòng</th>
              <th className={`${TH} text-right`}>Trị giá tham chiếu</th>
              <th className={TH}>Đơn hàng</th>
              <th className={TH}>Người lập</th>
            </tr>
          </thead>
          <tbody>
            {d.visible.map((r, i) => {
              const exp = d.expired(r)
              const left = r.valid_to ? daysBetween(d.today, r.valid_to) : null
              return (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <Link
                      href={`/sales/quotes/${r.id}`}
                      className="font-mono text-xs text-[var(--primary)] hover:underline"
                    >
                      {r.code}
                    </Link>
                    <span className="text-muted-foreground block text-[11px] leading-4">
                      {r.revision_no > 1 ? (
                        <span className="text-[var(--warn)]">bản {r.revision_no}</span>
                      ) : (
                        'bản 1'
                      )}
                      {r.revisions > 0 && ` · +${r.revisions} bản sau`}
                    </span>
                  </td>
                  <td className={`${TD} truncate`} title={r.customer_name}>
                    {r.customer_name}
                  </td>
                  <td className={TD}>
                    <Nhan tone={exp ? 'stop' : quoteTone(r.status)}>
                      {exp ? 'Hết hiệu lực' : (QUOTE_LABEL[r.status] ?? r.status)}
                    </Nhan>
                  </td>
                  <td className={`${TD} font-mono text-xs whitespace-nowrap`}>
                    {r.valid_to ? (
                      <>
                        {fmtD(r.valid_from)} → {fmtD(r.valid_to)}
                        {!exp && left != null && left <= 7 && r.status === 'sent' && (
                          <span className="ml-1 text-[var(--warn)]">còn {left}n</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--warn)]">chưa khai</span>
                    )}
                  </td>
                  <td className={`${TD} ${NUM}`}>{fmtN(r.line_count)}</td>
                  <td className={`${TD} ${NUM}`}>
                    {r.ref_value > 0 ? (
                      <>
                        {fmtMoney(r.ref_value)}{' '}
                        <span className="text-muted-foreground text-xs">
                          {r.currency}
                        </span>
                        {r.lines_no_qty > 0 && (
                          <span className="text-muted-foreground block text-[11px]">
                            thiếu SL {r.lines_no_qty} dòng
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">chưa có SL</span>
                    )}
                  </td>
                  <td className={`${TD} truncate font-mono text-xs`}>
                    {r.orders.length ? (
                      r.orders.map((o, k) => (
                        <span key={o.id}>
                          {k > 0 && ', '}
                          <Link
                            href={`/sales/orders/${o.id}`}
                            className="text-[var(--primary)] hover:underline"
                          >
                            {o.code}
                          </Link>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${TD} text-xs`} title={r.owner_name ?? ''}>
                    <span className="block truncate">{shortName(r.owner_name)}</span>
                    <span className="text-muted-foreground block font-mono text-[11px] leading-4">
                      {fmtD(r.created_at)}
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
                  Không có báo giá nào khớp. Đổi ô đếm phía trên, bỏ lọc khách hoặc xoá từ
                  khoá.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-muted font-medium">
              <td className={`${TD} border-t`} colSpan={5}>
                Cộng {fmtN(d.filtered.length)} báo giá
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
                  · trị giá tham chiếu chỉ gồm dòng có SL
                </span>
              </td>
              <td className={`${TD} ${NUM} border-t`}>
                {fmtN(d.filtered.reduce((s, r) => s + r.line_count, 0))}
              </td>
              <td className={`${TD} ${NUM} border-t text-xs`}>
                {[...new Set(d.filtered.map((r) => r.currency))]
                  .map(
                    (cur) =>
                      `${fmtMoney(d.filtered.filter((r) => r.currency === cur).reduce((s, r) => s + r.ref_value, 0))} ${cur}`,
                  )
                  .join(' · ') || '—'}
              </td>
              <td className={`${TD} border-t`} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <ErpStatusBar
        left={
          <>
            {fmtN(d.visible.length)}/{fmtN(d.filtered.length)} báo giá
            {d.mineOnly ? ' · tôi lập' : ' · cả phòng'}
          </>
        }
        right={`Hôm nay ${fmtD(d.today)}`}
      />
    </ErpPage>
  )
}
