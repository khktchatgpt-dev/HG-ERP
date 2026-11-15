'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DanhSachThang as Data } from '@/modules/dept/accounting/cong-no-thang.service'
import { monthTotals, type MonthRow } from '@/lib/cong-no-thang'
import { Khung, mm, money } from './bang-tinh.shared'

/**
 * MÀN 1 — CÔNG NỢ NCC CỦA MỘT THÁNG (khuôn C, bản vẽ bản 3 duyệt 31/10/2026).
 *
 * Mỗi NCC một dòng, ba số của tháng — đúng dòng "Tổng cộng T10/2026" Kế toán
 * chốt trong sổ Excel. Bấm tên NCC mở sổ riêng của NCC đó (Màn 2). Không còn dư
 * đầu / đã trả / dư cuối / điều khoản / công tắc: chủ dự án chấm "nhiều số thừa".
 *
 * Mọi tháng có sẵn trong trang, nên ‹ › đổi tháng TỨC THÌ (không tải lại); URL
 * vẫn ghi `?ky=` để gửi link cho nhau.
 */
export function DanhSachThang({ data, ky }: { data: Data; ky?: string }) {
  const months = data.months.map((m) => m.month)
  // Tháng trên URL thắng, kể cả tháng chưa có phiếu (bày trạng thái rỗng có lối về tháng gần nhất).
  const [month, setMonth] = useState(ky ?? months[0] ?? '')
  const [q, setQ] = useState('')

  const pick = (m: string) => {
    setMonth(m)
    window.history.replaceState(null, '', `?ky=${m}`)
  }
  const i = months.indexOf(month)
  const older = i >= 0 ? months[i + 1] : months[0]
  const newer = i > 0 ? months[i - 1] : undefined

  const all = data.byMonth[month] ?? []
  const needle = q.trim().toLowerCase()
  const rows = needle
    ? all.filter((r) => r.supplier_name.toLowerCase().includes(needle))
    : all
  const totals = monthTotals(rows)
  const vnd = rows.filter((r) => r.currency === 'VND')
  const other = totals.filter((t) => t.currency !== 'VND')
  const tVnd = totals.find((t) => t.currency === 'VND')

  return (
    <Khung>
      <div className="bt-tool">
        <button
          type="button"
          className="bt-btn sq"
          aria-label="Tháng trước"
          disabled={!older}
          onClick={() => older && pick(older)}
        >
          ‹
        </button>
        <select
          className="bt-btn"
          aria-label="Tháng"
          value={month}
          onChange={(e) => pick(e.target.value)}
        >
          {!months.includes(month) && month && (
            <option value={month}>Tháng {mm(month)}</option>
          )}
          {data.months.map((m) => (
            <option key={m.month} value={m.month}>
              Tháng {mm(m.month)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="bt-btn sq"
          aria-label="Tháng sau"
          disabled={!newer}
          onClick={() => newer && pick(newer)}
        >
          ›
        </button>
        <input
          className="bt-input"
          type="search"
          placeholder="Tìm nhà cung cấp…"
          aria-label="Tìm nhà cung cấp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="bt-right">
          {all.length > 0 && (
            <a
              className="bt-btn p"
              href={`/api/dept/accounting/cong-no-thang/export?ky=${month}`}
            >
              Xuất Excel tháng {Number(month.slice(5))}
            </a>
          )}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="bt-empty">
          <b>Tháng {mm(month)} chưa có phiếu nhập nào gắn đơn mua.</b>
          {months[0] && (
            <button type="button" className="bt-btn" onClick={() => pick(months[0])}>
              Xem tháng {mm(months[0])}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bt-info">
            Tiền gồm VAT theo đơn mua · tháng {mm(month)} · bấm tên nhà cung cấp để mở sổ của nhà cung cấp đó
          </div>
          <div className="bt-scroll">
            <table className="xl">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>STT</th>
                  <th>Nhà cung cấp</th>
                  <th style={{ width: 80 }}>Số phiếu</th>
                  <th style={{ width: 170 }}>Thành tiền chưa VAT</th>
                  <th style={{ width: 140 }}>VAT</th>
                  <th style={{ width: 190 }}>Tổng cộng T{mm(month)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="mut">
                      Không NCC nào tên chứa “{q.trim()}” trong tháng {mm(month)}.{' '}
                      <button type="button" className="more" onClick={() => setQ('')}>
                        Bỏ tìm
                      </button>
                    </td>
                  </tr>
                )}
                {vnd.map((r, k) => (
                  <Dong key={r.supplier_id} r={r} stt={k + 1} month={month} />
                ))}
                {other.map((t) => (
                  <GroupOther
                    key={t.currency}
                    t={t}
                    rows={rows.filter((r) => r.currency === t.currency)}
                    month={month}
                  />
                ))}
              </tbody>
              {tVnd && (
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      Tổng cộng T{mm(month)} · {tVnd.suppliers} NCC
                      {needle ? ' (đang lọc)' : ''}
                    </td>
                    <td className="r">{tVnd.docs}</td>
                    <td className="r">{money(tVnd.net)}</td>
                    <td className="r">{money(tVnd.vat)}</td>
                    <td className="r">{money(tVnd.amount)}</td>
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

function Dong({ r, stt, month }: { r: MonthRow; stt: number; month: string }) {
  const c = r.currency
  return (
    <tr className={r.amount < 0 ? 'neg' : undefined}>
      <td className="c">{stt}</td>
      <td className="nw">
        <Link
          className="link"
          href={`/finance/so-cong-no/ncc/${r.supplier_id}?tu=${month}&den=${month}`}
        >
          {r.supplier_name}
        </Link>
        {r.reversals > 0 && <span className="tag">có phiếu đảo</span>}
        {r.unpriced > 0 && <span className="tag">{r.unpriced} dòng chưa giá</span>}
      </td>
      <td className="r">{r.docs}</td>
      <td className="r">{money(r.net, c)}</td>
      <td className="r">{money(r.vat, c)}</td>
      <td className="r">
        {money(r.amount, c)}
        {c !== 'VND' ? ` ${c}` : ''}
      </td>
    </tr>
  )
}

/** Nhóm ngoại tệ cuối bảng — tổng riêng, không cộng vào VND. */
function GroupOther({
  t,
  rows,
  month,
}: {
  t: ReturnType<typeof monthTotals>[number]
  rows: MonthRow[]
  month: string
}) {
  return (
    <>
      <tr className="band">
        <td colSpan={6}>Ngoại tệ {t.currency}</td>
      </tr>
      {rows.map((r, k) => (
        <Dong key={r.supplier_id} r={r} stt={k + 1} month={month} />
      ))}
      <tr className="tot">
        <td colSpan={2}>
          Tổng cộng T{mm(month)} · {t.suppliers} NCC ({t.currency})
        </td>
        <td className="r">{t.docs}</td>
        <td className="r">{money(t.net, t.currency)}</td>
        <td className="r">{money(t.vat, t.currency)}</td>
        <td className="r">
          {money(t.amount, t.currency)} {t.currency}
        </td>
      </tr>
    </>
  )
}
