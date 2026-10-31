'use client'

import { Fragment, useState } from 'react'
import type { ApLedgerResult } from '@/modules/dept/accounting/ap-ledger.service'
import { entryLabel, type LedgerLine } from '@/lib/ap-ledger'
import { looksLikeHgCode } from '@/lib/ap-receipt-ledger'
import { dmy, money, monthLabel, qtyFmt } from './cong-no.shared'

type Detail = NonNullable<ApLedgerResult['detail']>
type Item = NonNullable<LedgerLine['items']>[number]

/**
 * TẦNG 3 — SỔ CHI TIẾT MỘT NCC × TIỀN TỆ, THEO DÒNG HÀNG.
 *
 * Bản vẽ duyệt 31/10/2026 (bản 2) sau khi đọc sổ Excel của Kế toán: Kế toán đọc
 * và đối chiếu theo DÒNG HÀNG (tên hàng · ĐVT · SL giao · đơn giá · thành tiền ·
 * VAT · tổng), mỗi lần giao khoá bằng SỐ PHIẾU GIAO CỦA NCC. Đo cùng ngày trên
 * Minh Thắng tháng 10: chênh đơn giá (100 đ vs 120 đ), chênh số lượng (2.400 vs
 * 2.328) chỉ lộ ra ở mức dòng hàng.
 *
 * Mỗi phiếu một dòng nền xám (số dư luỹ kế nằm ở đây), dòng hàng ngay dưới.
 * Phiếu một dòng hàng thì gộp vào dòng phiếu. Phiếu đảo / trả hàng gập sẵn.
 * Cột "Số HĐ" của bản vẽ chưa bày: chưa có chỗ ghi (bước sau), cột toàn "—" là
 * nội dung thừa.
 */
export function SoChiTiet({
  d,
  p,
  onClose,
}: {
  d: Detail
  p: ApLedgerResult
  onClose: () => void
}) {
  const c = d.currency
  const [flat, setFlat] = useState(false)
  // Khoá = vị trí dòng; mặc định mở phiếu nhập, gập phiếu đảo / trả hàng.
  const [toggled, setToggled] = useState<Set<number>>(new Set())
  const isOpen = (l: LedgerLine, i: number) =>
    !flat && (l.kind === 'invoice') !== toggled.has(i)
  const toggle = (i: number) =>
    setToggled((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  const inc = d.lines.filter((l) => l.kind === 'invoice')
  const sum = (ls: LedgerLine[], f: (l: LedgerLine) => number | undefined) =>
    ls.reduce((s, l) => s + (f(l) ?? 0), 0)
  const itemCount = d.lines.reduce((s, l) => s + (l.items?.length ?? 0), 0)
  const closing = d.lines.at(-1)?.running ?? d.opening
  const receipt = p.basis === 'receipt'

  return (
    <>
      <div className="cn-dhead">
        <h2>
          {d.supplier_name} · <span className="cn-num">{c}</span>
        </h2>
        <span className="cn-mut">
          {monthLabel(p.month)} · {d.lines.length} chứng từ
          {itemCount ? ` · ${itemCount} dòng hàng` : ''}
        </span>
        <span className="cn-actions">
          {itemCount > 0 && (
            <button type="button" className="cn-btn" onClick={() => setFlat((v) => !v)}>
              {flat ? 'Mở dòng hàng' : 'Gập theo phiếu'}
            </button>
          )}
          <button type="button" className="cn-btn" onClick={onClose}>
            Đóng
          </button>
        </span>
      </div>
      <table className="cn-grid" style={{ minWidth: 1180 }}>
        <thead>
          <tr>
            <th>Ngày giao</th>
            <th>Số phiếu NCC</th>
            <th>Chứng từ</th>
            <th>Đơn mua · Lệnh</th>
            <th>Tên hàng</th>
            <th>ĐVT</th>
            <th className="r">SL giao</th>
            <th className="r">Đơn giá</th>
            <th className="r">Chưa VAT</th>
            <th className="r">VAT</th>
            <th className="r">Tổng cộng</th>
            <th className="r">Số dư luỹ kế</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={11} className="cn-mut">
              Số dư đầu {monthLabel(p.month)}
            </td>
            <td className="r">
              <b>{money(d.opening, c)}</b>
            </td>
          </tr>
          {d.lines.map((l, i) => {
            const sign = l.kind === 'invoice' ? 1 : -1
            const items = l.items ?? []
            const one = items.length === 1 && !flat ? items[0] : null
            const open = isOpen(l, i)
            return (
              <Fragment key={`${l.kind}-${l.doc_no}-${l.date}-${i}`}>
                <tr className="cn-grp">
                  <td className="cn-num">{dmy(l.date)}</td>
                  <td>
                    <PartyDoc l={l} receipt={receipt} />
                  </td>
                  <td>
                    <span className="cn-num">{l.doc_no}</span>
                    {entryLabel(l) !== 'Phiếu nhập' && (
                      <span className="cn-sub">
                        {entryLabel(l)}
                        {l.note ? ` · ${l.note}` : ''}
                      </span>
                    )}
                  </td>
                  <td>
                    {l.po_code ? <span className="cn-num">{l.po_code}</span> : '—'}
                    {l.lsx_code && <span className="cn-sub">{l.lsx_code}</span>}
                  </td>
                  {one ? (
                    <ItemCells it={one} c={c} sign={sign} />
                  ) : (
                    <>
                      <td colSpan={4}>
                        {items.length > 1 ? (
                          <button
                            type="button"
                            className="cn-link"
                            aria-expanded={open}
                            onClick={() => toggle(i)}
                          >
                            {open ? '▾' : '▸'} {items.length} dòng hàng
                          </button>
                        ) : (
                          <span className="cn-mut">—</span>
                        )}
                      </td>
                      <td className="r">
                        {l.net != null ? money(sign * l.net, c) : '—'}
                      </td>
                      <td className="r">
                        {l.vat != null ? money(sign * l.vat, c) : '—'}
                      </td>
                      <td className="r">
                        <b>{money(sign * l.amount, c)}</b>
                      </td>
                    </>
                  )}
                  <td className="r">
                    <b>{money(l.running, c)}</b>
                  </td>
                </tr>
                {open &&
                  items.length > 1 &&
                  items.map((it, j) => (
                    <tr key={j}>
                      <td colSpan={4} />
                      <ItemCells it={it} c={c} sign={sign} />
                      <td />
                    </tr>
                  ))}
              </Fragment>
            )
          })}
          {d.lines.length === 0 && (
            <tr>
              <td colSpan={12} className="cn-mut">
                Tháng này không có giao dịch — số dư giữ nguyên từ tháng trước.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={8}>
              Tổng cộng {monthLabel(p.month)} · {receipt ? 'hàng giao' : 'hoá đơn'} (
              {inc.length})
            </td>
            <td className="r">
              {money(
                sum(inc, (l) => l.net),
                c,
              )}
            </td>
            <td className="r">
              {money(
                sum(inc, (l) => l.vat),
                c,
              )}
            </td>
            <td className="r">
              {money(
                sum(inc, (l) => l.amount),
                c,
              )}
            </td>
            <td className="r">{money(closing, c)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}

/** Bảy ô của một dòng hàng: tên · ĐVT · SL · đơn giá · chưa VAT · VAT · tổng. */
function ItemCells({ it, c, sign }: { it: Item; c: string; sign: number }) {
  return (
    <>
      <td>{it.name}</td>
      <td>{it.unit ?? '—'}</td>
      <td className="r">{qtyFmt(sign * it.qty)}</td>
      <td className="r">{money(it.price, c)}</td>
      <td className="r">{money(sign * it.net, c)}</td>
      <td className="r">{money(sign * it.vat, c)}</td>
      <td className="r">{money(sign * it.amount, c)}</td>
    </>
  )
}

/**
 * Ô "Số phiếu NCC" — khoá Kế toán dùng để khớp từng lần giao. Ghi mã đơn HG
 * vào đây (32/154 phiếu, đo 31/10/2026) thì nói ra ngay trên dòng, vì nhìn qua
 * nó trông như đã có số.
 */
function PartyDoc({ l, receipt }: { l: LedgerLine; receipt: boolean }) {
  if (l.party_doc_no) {
    return (
      <>
        <span className="cn-num">{l.party_doc_no}</span>
        {looksLikeHgCode(l.party_doc_no) && (
          <span className="cn-sub cn-warn" title="Ô này đang ghi mã đơn của HG, không phải số in trên phiếu giao của NCC — Kế toán không khớp được với sổ">mã đơn HG</span>
        )}
      </>
    )
  }
  if (receipt && l.kind === 'invoice') return <span className="cn-warn">chưa ghi</span>
  return <span className="cn-mut">—</span>
}
