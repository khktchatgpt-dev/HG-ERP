'use client'

import { Fragment } from 'react'
import { fmt } from '../da-ghi/so-da-ghi.shared'
import type { DanSoCtx } from './useDanSo'

/**
 * Lưới XEM TRƯỚC (khuôn F): một dòng một chi tiết, cột ngày là ô vàng chỉ đọc —
 * ô nào sẽ ghi / trùng số đã có / khác số đã có (không ghi đè) / ngày đã chốt.
 * Ô chữ sai tô đỏ kèm "bỏ ô"; dòng gần khớp có "nhận" gợi ý.
 */
export function LuoiXem({ d }: { d: DanSoCtx }) {
  const cot = d.doc.cot
  return (
    <div className="sx-ds-luoi">
      <table className="sx-tb sx-ds-tb">
        <thead>
          <tr>
            <th className="f c1">Chi tiết</th>
            <th>Cụm</th>
            <th>Tình trạng</th>
            <th className="r">CT/SP</th>
            <th className="r">Cần</th>
            {cot.map((c) => (
              <th key={c.iso} className="r dn">
                {c.nhan}
              </th>
            ))}
            <th className="r">Σ ghi</th>
          </tr>
        </thead>
        <tbody>
          {d.hien.map(({ r, x }, idx) => {
            const loi = x != null && x.van_de.length > 0
            const ma = x?.ma ?? r.ma_sp ?? ''
            const truoc =
              idx > 0 ? (d.hien[idx - 1].x?.ma ?? d.hien[idx - 1].r.ma_sp ?? '') : null
            const dauNhom = idx === 0 || ma !== truoc
            const nhom = dauNhom
              ? d.hien.filter((h) => (h.x?.ma ?? h.r.ma_sp ?? '') === ma).length
              : 0
            return (
              <Fragment key={r.hang}>
                {dauNhom && ma !== '' && (
                  <tr className="mh">
                    <td colSpan={5 + cot.length + 1}>
                      <b className="num">{ma}</b>
                      {x?.ten_sp ? <span className="mut"> {x.ten_sp}</span> : null}
                      {x?.kieu === 'ngoai' ? (
                        <span className="mut"> — không thuộc lệnh này, bỏ qua</span>
                      ) : null}
                      <span className="mut"> · {nhom} dòng</span>
                    </td>
                  </tr>
                )}
                <tr
                  key={r.hang}
                  id={`ds-${r.hang}`}
                  className={['d', d.nhay === r.hang ? 'chon' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="f c1" title={x?.van_de.join(' · ') || r.ten}>
                    {r.ten}
                  </td>
                  <td className="mut" title={r.cum}>
                    {r.cum}
                  </td>
                  <td className="tt">
                    {!x ? (
                      <span className="mut">…</span>
                    ) : x.kieu === 'ngoai' ? (
                      <span className="mut">Lệnh khác — bỏ qua</span>
                    ) : x.kieu === 'moi' && !loi ? (
                      <span className="act">Thêm mới</span>
                    ) : x.kieu === 'gan' ? (
                      <span className="warn">
                        Gần khớp: {x.gan}{' '}
                        <button
                          type="button"
                          className="lnk"
                          onClick={() => d.nhanGoiY(r.hang, x.gan ?? r.ten)}
                        >
                          nhận
                        </button>{' '}
                        <button
                          type="button"
                          className="lnk"
                          onClick={() => d.themMoi(r.hang)}
                        >
                          thêm mới
                        </button>
                      </span>
                    ) : loi && x.cum_chon && x.cum_chon.length > 0 ? (
                      <span className="stop" title={x.van_de.join(' · ')}>
                        Cụm “{r.cum || r.ten}” không có trên lệnh →{' '}
                        <select
                          aria-label={`Chọn cụm của lệnh cho ${r.cum || r.ten}`}
                          value=""
                          onChange={(e) => d.chonCum(r.ma_sp, r.cum, e.target.value)}
                        >
                          <option value="">chọn cụm…</option>
                          {x.cum_chon.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </span>
                    ) : loi ? (
                      <span className="stop" title={x.van_de.join(' · ')}>
                        {x.van_de[0]}
                      </span>
                    ) : (
                      <span
                        className="done"
                        title={
                          x.phan && x.phan.length > 0
                            ? 'Lấp theo thứ tự đợt: ' +
                              x.phan
                                .map(
                                  (p) =>
                                    `đợt ${p.dot} +${fmt(Object.values(p.theo_ngay).reduce((t, v) => t + v, 0))}`,
                                )
                                .join(' · ')
                            : undefined
                        }
                      >
                        {x.qua_cum ? `Khớp cụm: ${x.qua_cum}` : 'Khớp'}
                        {x.phan && x.phan.length > 1
                          ? ` · chia ${x.phan.length} đợt`
                          : ''}
                      </span>
                    )}
                  </td>
                  <td className="r num">{r.ct_sp ?? ''}</td>
                  <td className="r num">{x?.can != null ? fmt(x.can) : (r.can ?? '')}</td>
                  {cot.map((c) => {
                    const sai = r.sai.find((s) => s.iso === c.iso)
                    const qty = r.o[c.iso]
                    const o = x?.o[c.iso]
                    if (sai)
                      return (
                        <td
                          key={c.iso}
                          className="r num dsO sai"
                          title="Không đọc được thành số"
                        >
                          {sai.raw}{' '}
                          <button
                            type="button"
                            className="lnk"
                            onClick={() => d.boO(r.hang, c.iso)}
                            aria-label={`Bỏ ô ${c.nhan} của ${r.ten}`}
                          >
                            bỏ
                          </button>
                        </td>
                      )
                    if (qty == null) return <td key={c.iso} className="dsO" />
                    const tt = o?.tt ?? 'ghi'
                    const tip =
                      tt === 'trung'
                        ? 'Đã có sổ đúng số này — bỏ qua'
                        : tt === 'khac'
                          ? `Đã có sổ ${o?.co} khác số dán — không ghi đè, sửa ở Sổ theo ngày`
                          : tt === 'chot'
                            ? 'Ngày đã chốt sổ của tổ — không ghi'
                            : undefined
                    return (
                      <td key={c.iso} className={`r num dsO ${tt}`} title={tip}>
                        {fmt(qty)}
                      </td>
                    )
                  })}
                  <td className="r num">{x ? fmt(x.tong_ghi) : ''}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
