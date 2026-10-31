'use client'

import type {
  ApLedgerResult,
  LedgerScreenRow,
} from '@/modules/dept/accounting/ap-ledger.service'
import { money } from './cong-no.shared'

/**
 * Tầng 2 — mỗi dòng một NCC × tiền tệ. Bấm cả dòng (hoặc tên NCC bằng bàn phím)
 * để mở sổ chi tiết ở nửa dưới. Chỉ HAI nhãn trên dòng, đều là việc phải làm:
 * cọc chưa ghi, dòng nhập chưa có giá. Số dư dương không tô màu — nợ NCC là
 * chuyện thường của mua bán.
 */
export function LuoiNcc({
  rows,
  all,
  total,
  cur,
  receipt,
  selected,
  onPick,
  onClear,
}: {
  rows: LedgerScreenRow[]
  all: LedgerScreenRow[]
  total: ApLedgerResult['totals'][number] | undefined
  cur: string
  receipt: boolean
  selected: ApLedgerResult['detail']
  onPick: (r: LedgerScreenRow) => void
  onClear: () => void
}) {
  const fx = cur !== 'VND'
  const cols = 6 + (receipt ? 2 : 0) + (fx ? 1 : 0)
  const n = (v: number) => (v ? money(v, cur) : '—')

  return (
    <table className="cn-grid">
      <thead>
        <tr>
          <th>Nhà cung cấp</th>
          {receipt && <th>Điều khoản</th>}
          <th className="r">Dư đầu</th>
          <th className="r">{receipt ? 'Nhận' : 'Hoá đơn'}</th>
          {receipt && <th className="r">Trả · đảo</th>}
          <th className="r">Đã trả</th>
          <th className="r">Dư cuối</th>
          <th className="r">{receipt ? 'Phiếu' : 'CT'}</th>
          {fx && <th className="r">Quy VND</th>}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={cols} className="cn-mut">
              Không NCC nào khớp bộ lọc.{' '}
              <button type="button" className="cn-link" onClick={onClear}>
                Bỏ lọc
              </button>
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const on =
            selected?.supplier_id === r.supplier_id && selected?.currency === r.currency
          return (
            <tr
              key={`${r.supplier_id}-${r.currency}`}
              className={on ? 'cn-click cn-sel' : 'cn-click'}
              onClick={() => onPick(r)}
            >
              <td className="cn-ncc">
                <button
                  type="button"
                  className="cn-name"
                  title={r.supplier_name}
                  aria-expanded={on}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPick(r)
                  }}
                >
                  {r.supplier_name}
                </button>
                {r.prepay && <span className="cn-tag">{r.prepay} chưa ghi</span>}
                {r.unpriced > 0 && (
                  <span className="cn-tag">{r.unpriced} dòng chưa giá</span>
                )}
              </td>
              {receipt && (
                <td>
                  {r.terms ? (
                    <span className="cn-terms" title={r.terms}>
                      {r.terms}
                    </span>
                  ) : (
                    <span className="cn-terms cn-mut">
                      {r.terms_distinct > 1 ? `${r.terms_distinct} điều khoản` : '—'}
                    </span>
                  )}
                </td>
              )}
              <td className={r.opening ? 'r' : 'r z'}>{n(r.opening)}</td>
              <td className={r.increase ? 'r' : 'r z'}>{n(r.increase)}</td>
              {receipt && <td className={r.returned ? 'r' : 'r z'}>{n(r.returned)}</td>}
              <td className={r.decrease ? 'r' : 'r z'}>{n(r.decrease)}</td>
              <td className="r">
                <b>{money(r.closing, cur)}</b>
              </td>
              <td className={r.entry_count ? 'r' : 'r z'}>{r.entry_count || '—'}</td>
              {fx && (
                <td className="r">
                  {r.closing_base == null ? (
                    <span className="cn-warn">chưa quy đổi</span>
                  ) : (
                    money(r.closing_base, 'VND')
                  )}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
      {total && (
        <tfoot>
          <tr>
            <td>
              {rows.length === all.length
                ? `Tổng ${cur} · ${all.length} NCC`
                : `Đang lọc ${rows.length}/${all.length} — tổng cả sổ ${cur}`}
            </td>
            {receipt && <td />}
            <td className="r">{money(total.opening, cur)}</td>
            <td className="r">{money(total.increase, cur)}</td>
            {receipt && <td className="r">{money(total.returned, cur)}</td>}
            <td className="r">{money(total.decrease, cur)}</td>
            <td className="r">{money(total.closing, cur)}</td>
            <td className="r">{all.reduce((s, r) => s + r.entry_count, 0) || '—'}</td>
            {fx && (
              <td className="r">
                {total.closing_base == null ? '—' : money(total.closing_base, 'VND')}
              </td>
            )}
          </tr>
        </tfoot>
      )}
    </table>
  )
}
