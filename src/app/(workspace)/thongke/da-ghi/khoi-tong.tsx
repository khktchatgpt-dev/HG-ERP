'use client'

import { Fragment } from 'react'
import type { SoDaGhiCtx } from './useSoDaGhi'
import { cx, fmt } from './so-da-ghi.shared'

/**
 * Khối TỔNG trên lưới Sổ đã ghi — bản vẽ 14/11/2026
 * https://claude.ai/artifact/CUUfVcZxHQTmXXQqn3bfZ3, bước 2 (Q3 + Q6).
 *
 * Xem Ngày → `TongNgay`: lệnh → mã hàng × công đoạn, nhìn một lần biết hôm đó ghi
 * gì cho lệnh nào (chép bảng chéo của Odoo Work Orders). Đứng NGOÀI vùng cuộn của
 * lưới. Bảng 7 ngày (Q6 cũ) đã bỏ cùng chế độ 7 ngày — bản vẽ 14/11 CpB5jKcS… Q5.
 */

/** Q3 — chỉ bày khi có từ hai ô (một mã × một công đoạn thì đầu phiếu đã nói hết). */
export function TongNgay({ d }: { d: SoDaGhiCtx }) {
  const t = d.tongNgay
  if (!t || t.nO < 2) return null
  return (
    <div className="sx-tong" role="region" aria-label="Tổng ngày">
      <div className="hd">
        <button
          type="button"
          className="tg"
          onClick={() => d.setTongMo(!d.tongMo)}
          aria-expanded={d.tongMo}
          aria-label={d.tongMo ? 'Gập Tổng ngày' : 'Mở Tổng ngày'}
        >
          {d.tongMo ? '▾' : '▸'}
        </button>
        <b>Tổng ngày</b>
        <span className="mut">
          đạt theo đơn vị đếm của từng công đoạn — không cộng ngang · bấm ô để mở đúng
          phiếu
        </span>
      </div>
      {d.tongMo && (
        <table className="sx-mx">
          <thead>
            <tr>
              <th>Lệnh · mã hàng</th>
              {t.cot.map((c) => (
                <th key={c.code} className="r">
                  {c.label}
                </th>
              ))}
              <th className="r">Dòng</th>
            </tr>
          </thead>
          <tbody>
            {t.hang.map((h) => (
              <Fragment key={h.lsx}>
                <tr className="lenh">
                  <td colSpan={t.cot.length + 2}>
                    Lệnh <span className="ma">{h.code}</span>
                  </td>
                </tr>
                {h.ma.map((g) => (
                  <tr key={g.code ?? '—'}>
                    <td className="sp" title={[g.code, g.name].filter(Boolean).join(' ')}>
                      <span className="ma">{g.code ?? '—'}</span>
                      {g.name && <span className="mut"> {g.name}</span>}
                    </td>
                    {t.cot.map((c) => {
                      const o = g.o.get(c.code)
                      if (!o)
                        return (
                          <td key={c.code} className="r empty">
                            ·
                          </td>
                        )
                      const on =
                        d.maChon?.lsx === h.lsx &&
                        d.maChon.stage === c.code &&
                        d.maChon.code === g.code
                      return (
                        <td key={c.code} className="o">
                          <button
                            type="button"
                            className={cx('cell', on && 'on')}
                            aria-pressed={on}
                            aria-label={`${c.label} · ${g.code ?? '—'}: đạt ${fmt(o.qty)}, ${o.n} dòng`}
                            onClick={() => d.chonO(h.lsx, c.code, g.code)}
                          >
                            <b className="num">{fmt(o.qty)}</b>
                            <span className="mut">{fmt(o.n)} dòng</span>
                          </button>
                        </td>
                      )
                    })}
                    <td className="r num mut">{fmt(g.n)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
