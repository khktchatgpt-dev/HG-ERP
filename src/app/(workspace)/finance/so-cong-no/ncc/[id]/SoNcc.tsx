'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SoNcc as Data } from '@/modules/dept/accounting/cong-no-thang.service'
import type { SheetDoc, SheetLine, SheetMonth } from '@/lib/cong-no-thang'
import { looksLikeHgCode } from '@/lib/ap-receipt-ledger'
import { Khung, dmy, mm, money, qtyFmt } from '../../bang-tinh.shared'

/** Phiếu nhiều dòng hơn số này thì gập phần đuôi ("▸ N dòng nữa"). */
const SHOW_LINES = 5

/**
 * MÀN 2 — SỔ MỘT NCC (bản vẽ Ht7MpqcutpTUyG4r4DvymN bản 3, duyệt 31/10/2026).
 *
 * Như một sheet trong sổ Excel "công nợ chi tiết" của Kế toán: mỗi dòng một dòng
 * hàng, mỗi tháng chốt "Tổng cộng T10/2026". Khác sổ Excel ở hai chỗ có chủ ý:
 * tháng MỚI NHẤT ở trên (Q15 — mở ra là thấy tháng đang làm), và ô lặp của cùng
 * một phiếu in mờ (″) thay vì chép lại. Trang chiếm trọn chiều cao, không chia đôi
 * (Q14); đổi NCC và khoảng tháng ngay trên trang.
 *
 * Mặc định: tháng mới nhất trong khoảng MỞ, tháng cũ gập thành dòng phiếu, phiếu
 * đảo gập, phiếu dài chỉ bày 5 dòng đầu.
 */
export function SoNcc({ data, tu, den }: { data: Data; tu?: string; den?: string }) {
  const router = useRouter()
  const allMonths = useMemo(
    () => [...new Set(data.sheet.map((m) => m.month))],
    [data.sheet],
  )
  const [from, setFrom] = useState(tu ?? allMonths.at(-1) ?? '')
  const [to, setTo] = useState(den ?? allMonths[0] ?? '')
  const sheet = data.sheet.filter((m) => m.month >= from && m.month <= to)
  const latest = sheet[0]?.month

  // Khoá đã bấm đổi trạng thái (so với mặc định) — tháng `m:`, phiếu `d:`, đuôi phiếu `t:`.
  const [flip, setFlip] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setFlip((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const monthOpen = (m: SheetMonth) => (m.month === latest) !== flip.has(`m:${m.month}`)
  const docOpen = (d: SheetDoc) =>
    (d.kind === 'in' || d.kind === 'unreversal') !== flip.has(`d:${d.key}`)

  const setRange = (f: string, t: string) => {
    const [a, b] = f <= t ? [f, t] : [t, f]
    setFrom(a)
    setTo(b)
    window.history.replaceState(null, '', `?tu=${a}&den=${b}`)
  }

  const docCount = sheet.reduce(
    (s, m) => s + new Set(m.docs.map((d) => d.doc_code)).size,
    0,
  )
  const grand = sheet.reduce(
    (s, m) => ({ net: s.net + m.net, vat: s.vat + m.vat, amount: s.amount + m.amount }),
    { net: 0, vat: 0, amount: 0 },
  )
  const oneCurrency = new Set(sheet.map((m) => m.currency)).size <= 1
  const cur = sheet[0]?.currency ?? 'VND'
  const backMonth = to || allMonths[0]

  return (
    <Khung>
      <div className="bt-tool">
        <Link
          className="bt-btn"
          href={`/finance/so-cong-no${backMonth ? `?ky=${backMonth}` : ''}`}
        >
          ← Danh sách tháng {backMonth ? Number(backMonth.slice(5)) : ''}
        </Link>
        <select
          className="bt-btn"
          aria-label="Nhà cung cấp"
          style={{ maxWidth: 360 }}
          value={data.supplier?.id ?? ''}
          onChange={(e) =>
            router.push(`/finance/so-cong-no/ncc/${e.target.value}?tu=${from}&den=${to}`)
          }
        >
          {!data.supplier && <option value="">— chọn nhà cung cấp —</option>}
          {data.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {allMonths.length > 0 && (
          <>
            <span className="bt-lbl">Từ</span>
            <select
              className="bt-btn"
              aria-label="Từ tháng"
              value={from}
              onChange={(e) => setRange(e.target.value, to)}
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {mm(m)}
                </option>
              ))}
            </select>
            <span className="bt-lbl">đến</span>
            <select
              className="bt-btn"
              aria-label="Đến tháng"
              value={to}
              onChange={(e) => setRange(from, e.target.value)}
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {mm(m)}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="bt-right">
          {data.supplier && sheet.length > 0 && (
            <a
              className="bt-btn p"
              href={`/api/dept/accounting/cong-no-thang/export?ncc=${data.supplier.id}&tu=${from}&den=${to}`}
            >
              Xuất Excel NCC này
            </a>
          )}
        </div>
      </div>

      {!data.supplier ? (
        <div className="bt-empty">
          <b>Nhà cung cấp này chưa có phiếu nhập nào gắn đơn mua.</b>
          <span>Chọn nhà cung cấp khác ở ô trên, hoặc quay lại danh sách tháng.</span>
        </div>
      ) : sheet.length === 0 ? (
        <div className="bt-empty">
          <b>
            {data.supplier.name} không có phiếu nhập từ {mm(from)} đến {mm(to)}.
          </b>
          {data.last_date && (
            <span>
              Phiếu gần nhất ngày {dmy(data.last_date)}. Đổi khoảng tháng ở trên.
            </span>
          )}
        </div>
      ) : (
        <>
          <div className="bt-info">
            {sheet.length} tháng · {docCount} phiếu nhập · tiền gồm VAT theo đơn mua ·
            tháng mới nhất ở trên
          </div>
          <div className="bt-scroll">
            <table className="xl" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th style={{ width: 82 }}>Ngày giao</th>
                  <th style={{ width: 100 }}>Số phiếu NCC</th>
                  <th style={{ width: 104 }}>Phiếu nhập</th>
                  <th style={{ width: 150 }}>Đơn hàng / LSX</th>
                  <th>Tên SP</th>
                  <th style={{ width: 40 }}>ĐVT</th>
                  <th style={{ width: 60 }}>SL giao</th>
                  <th style={{ width: 60 }}>Đơn giá</th>
                  <th style={{ width: 92 }}>Thành tiền</th>
                  <th style={{ width: 78 }}>VAT</th>
                  <th style={{ width: 96 }}>Tổng cộng</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((m) => {
                  const open = monthOpen(m)
                  return (
                    <Fragment key={`${m.month}-${m.currency}`}>
                      <tr className="band">
                        <td colSpan={11}>
                          THÁNG {mm(m.month)}
                          {m.currency !== 'VND' ? ` · ${m.currency}` : ''}{' '}
                          <button
                            type="button"
                            className="more"
                            style={{ fontWeight: 400 }}
                            aria-expanded={open}
                            onClick={() => toggle(`m:${m.month}`)}
                          >
                            {open
                              ? '▾ gập theo phiếu'
                              : `▸ mở ${m.docs.reduce((s, d) => s + d.lines.length, 0)} dòng hàng`}
                          </button>
                        </td>
                      </tr>
                      {m.docs.map((d) =>
                        open && docOpen(d) ? (
                          <DocLines
                            key={d.key}
                            d={d}
                            c={m.currency}
                            showAll={flip.has(`t:${d.key}`)}
                            onMore={() => toggle(`t:${d.key}`)}
                          />
                        ) : (
                          <DocSummary
                            key={d.key}
                            d={d}
                            c={m.currency}
                            canOpen={open}
                            onOpen={() => toggle(`d:${d.key}`)}
                          />
                        ),
                      )}
                      <tr className="tot">
                        <td colSpan={8}>
                          Tổng cộng T{mm(m.month)} ·{' '}
                          {new Set(m.docs.map((d) => d.doc_code)).size} phiếu
                          {m.unpriced ? ` (thiếu ${m.unpriced} dòng chưa giá)` : ''}
                        </td>
                        <td className="r">{money(m.net, m.currency)}</td>
                        <td className="r">{money(m.vat, m.currency)}</td>
                        <td className="r">{money(m.amount, m.currency)}</td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
              {sheet.length > 1 && oneCurrency && (
                <tfoot>
                  <tr>
                    <td colSpan={8}>
                      Cộng {mm(from)} – {mm(to)}
                    </td>
                    <td className="r">{money(grand.net, cur)}</td>
                    <td className="r">{money(grand.vat, cur)}</td>
                    <td className="r">{money(grand.amount, cur)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </Khung>
  )
}

/** Bốn ô đầu của phiếu — dòng đầu in đủ, các dòng sau của cùng phiếu in ″ mờ. */
function DocHead({ d, first }: { d: SheetDoc; first: boolean }) {
  if (!first) {
    return (
      <>
        <td className="r rep">{dmy(d.date)}</td>
        <td className="rep">″</td>
        <td className="rep">″</td>
        <td className="rep">″</td>
      </>
    )
  }
  return (
    <>
      <td className="r">{dmy(d.date)}</td>
      <td className="nw">
        {d.party_doc_no ? (
          // Ô ghi MÃ ĐƠN HG thay vì số phiếu NCC (32/154 phiếu, đo 31/10/2026): in màu
          // cảnh báo + gạch chấm, câu giải thích ở tooltip — không chiếm thêm bề ngang.
          looksLikeHgCode(d.party_doc_no) ? (
            <span
              className="cut hgma"
              style={{ maxWidth: 100 }}
              title={`${d.party_doc_no} — ô này đang ghi mã đơn của HG, không phải số in trên phiếu giao của NCC`}
            >
              {d.party_doc_no}
            </span>
          ) : (
            <span className="cut" style={{ maxWidth: 100 }} title={d.party_doc_no}>
              {d.party_doc_no}
            </span>
          )
        ) : (
          <span className="mut">—</span>
        )}
      </td>
      <td className="nw">{d.doc_code}</td>
      <td className="nw">
        <span
          className="cut"
          style={{ maxWidth: 150 }}
          title={[d.po_code, d.lsx_code].filter(Boolean).join(' · ')}
        >
          {d.po_code}
          {d.lsx_code ? <span className="mut"> · {d.lsx_code}</span> : null}
        </span>
      </td>
    </>
  )
}

function Money({ v, c }: { v: number | null; c: string }) {
  return v == null ? <span className="nogia">chưa có giá</span> : <>{money(v, c)}</>
}

function LineCells({ l, c }: { l: SheetLine; c: string }) {
  return (
    <>
      <td className="ten" title={l.name}>
        {l.name}
      </td>
      <td>{l.unit ?? ''}</td>
      <td className="r">{qtyFmt(l.qty)}</td>
      <td className="r">
        <Money v={l.price} c={c} />
      </td>
      <td className="r">
        <Money v={l.net} c={c} />
      </td>
      <td className="r">
        <Money v={l.vat} c={c} />
      </td>
      <td className="r">
        <Money v={l.amount} c={c} />
      </td>
    </>
  )
}

/** Phiếu mở: từng dòng hàng; phiếu dài chỉ bày `SHOW_LINES` dòng đầu. */
function DocLines({
  d,
  c,
  showAll,
  onMore,
}: {
  d: SheetDoc
  c: string
  showAll: boolean
  onMore: () => void
}) {
  const lines = showAll ? d.lines : d.lines.slice(0, SHOW_LINES)
  const hidden = d.lines.length - lines.length
  const neg = d.kind === 'reversal' || d.kind === 'return'
  return (
    <>
      {lines.map((l, i) => (
        <tr key={i} className={neg ? 'neg' : undefined}>
          <DocHead d={d} first={i === 0} />
          <LineCells l={l} c={c} />
        </tr>
      ))}
      {hidden > 0 && (
        <tr>
          <td className="rep" colSpan={4} />
          <td colSpan={7}>
            <button type="button" className="more" onClick={onMore}>
              ▸ {hidden} dòng nữa của {d.doc_code}
            </button>
          </td>
        </tr>
      )}
      {showAll && d.lines.length > SHOW_LINES && (
        <tr>
          <td className="rep" colSpan={4} />
          <td colSpan={7}>
            <button type="button" className="more" onClick={onMore}>
              ▾ gập bớt {d.doc_code}
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

/** Phiếu gập: một dòng — tên hàng nếu chỉ một dòng, không thì "N dòng hàng"; phiếu đảo nói phiếu gốc. */
function DocSummary({
  d,
  c,
  canOpen,
  onOpen,
}: {
  d: SheetDoc
  c: string
  canOpen: boolean
  onOpen: () => void
}) {
  const neg = d.kind === 'reversal' || d.kind === 'return'
  const what =
    d.kind === 'reversal'
      ? `Đảo phiếu ${d.reversal_of ? `${d.reversal_of.code} (nhập ${dmy(d.reversal_of.date).slice(0, 5)})` : 'nhập'}`
      : d.kind === 'return'
        ? 'Trả hàng NCC'
        : d.kind === 'unreversal'
          ? 'Đảo phiếu trả hàng'
          : null
  const single = !what && d.lines.length === 1 ? d.lines[0] : null
  return (
    <tr className={neg ? 'neg' : undefined}>
      <DocHead d={d} first />
      {single ? (
        <LineCells l={single} c={c} />
      ) : (
        <>
          <td colSpan={4}>
            {what ? `${what} · ` : ''}
            {canOpen ? (
              <button type="button" className="more" onClick={onOpen}>
                ▸ {d.lines.length} dòng
              </button>
            ) : (
              <span className="mut">{d.lines.length} dòng hàng</span>
            )}
            {d.unpriced ? <span className="tag">{d.unpriced} chưa giá</span> : null}
          </td>
          <td className="r">{money(d.net, c)}</td>
          <td className="r">{money(d.vat, c)}</td>
          <td className="r">{money(d.amount, c)}</td>
        </>
      )}
    </tr>
  )
}
