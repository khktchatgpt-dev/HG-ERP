'use client'

import { ngayGioVn } from '@/lib/date-vn'
import { soGia, soVn, tienVn, type XemDon } from '@/lib/cho-xem'
import type { ChoXemCtx } from './useChoXem'

/** Ngày "dd/mm" từ YYYY-MM-DD hoặc ISO. */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * XEM NHANH DƯỚI DÒNG (bản vẽ khung 1): dòng hàng + giá đơn trước cùng NCC (Q6)
 * bên trái, tiền + điều khoản bên phải, ghi chú cho Giám đốc ở dưới (không bắt
 * buộc — Q3). Đơn đã xem (tab 2) chỉ đọc: bày dấu + ghi chú đã để lại.
 */
export function XemNhanh({ x, d, cot }: { x: XemDon; d: ChoXemCtx; cot: number }) {
  const conLai = x.expected_at
    ? Math.round(
        (Date.parse(x.expected_at) - Date.parse(d.box.at.slice(0, 10))) / 86_400_000,
      )
    : null
  return (
    <tr>
      <td className="cx-ud" colSpan={cot}>
        <div className="cx-udw">
          <div className="cx-mini-box">
            <table className="cx-mini" aria-label={`Dòng hàng ${x.code}`}>
              <thead>
                <tr>
                  <th>Vật tư</th>
                  <th>Quy cách</th>
                  <th className="r">SL</th>
                  <th className="r">Quy đổi</th>
                  <th className="r">Đơn giá</th>
                  <th className="r">Thành tiền</th>
                  <th>Giá đơn trước · cùng NCC</th>
                </tr>
              </thead>
              <tbody>
                {x.dong.map((l) => {
                  const s = soGia(l.don_gia, l.truoc)
                  return (
                    <tr key={l.id}>
                      <td>
                        {l.ma && <span className="hk-num hk-mut">{l.ma} </span>}
                        {l.ten}
                      </td>
                      <td className="hk-num">{l.quy_cach ?? '—'}</td>
                      <td className="r hk-num">
                        {soVn(l.sl)}
                        {/* Giá tính theo quy đổi (m³, kg…) thì đơn vị của danh mục thường là
                          đơn vị tính giá, không phải của SL — bỏ để khỏi đọc "350 M³". */}
                        {l.dvt && l.qd == null && (
                          <span className="hk-mut"> {l.dvt}</span>
                        )}
                      </td>
                      <td className="r hk-num">
                        {l.qd == null ? '—' : `${soVn(l.qd)} ${l.dvt_gia ?? ''}`}
                      </td>
                      <td className="r hk-num">
                        {l.don_gia == null ? (
                          <span className="hk-warn">chưa giá</span>
                        ) : (
                          <>
                            {soVn(l.don_gia, 2)}
                            {l.dvt_gia && <span className="hk-mut"> /{l.dvt_gia}</span>}
                          </>
                        )}
                      </td>
                      <td className="r hk-num">{soVn(l.thanh_tien, 0)}</td>
                      <td className="cx-truoc">
                        {l.truoc ? (
                          <>
                            <span className="hk-num">{soVn(l.truoc.gia, 2)}</span>
                            <span className="hk-mut">
                              {' '}
                              · {l.truoc.po_code} · {dm(l.truoc.at)}
                            </span>{' '}
                            {s?.kieu === 'bang' && (
                              <span className="cx-ok">không đổi</span>
                            )}
                            {s?.kieu === 'tang' && (
                              <span className="hk-warn">tăng {soVn(s.pct, 1)}%</span>
                            )}
                            {s?.kieu === 'giam' && (
                              <span className="cx-ok">giảm {soVn(s.pct, 1)}%</span>
                            )}
                          </>
                        ) : (
                          <span className="hk-mut">chưa mua ở NCC này</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="cx-facts">
            <dl className="cx-kv">
              <dt>Tiền hàng</dt>
              <dd className="hk-num">{soVn(x.tien_hang, 2)}</dd>
              <dt>VAT {soVn(x.vat_rate, 1)}%</dt>
              <dd className="hk-num">{soVn(x.vat, 2)}</dd>
              <dt className="hk-b" style={{ color: 'var(--hk-ink)' }}>
                Tổng
              </dt>
              <dd className="hk-num hk-b">{tienVn(x.value, x.currency)}</dd>
              <dt>Thanh toán</dt>
              <dd>{x.thanh_toan ?? <span className="hk-warn">chưa ghi</span>}</dd>
              <dt>Hẹn giao</dt>
              <dd>
                {x.expected_at ? (
                  <>
                    <span className="hk-num">{dm(x.expected_at)}</span>
                    {conLai != null &&
                      (conLai < 0 ? (
                        <span className="hk-late"> · đã qua {-conLai} ngày</span>
                      ) : (
                        <span className="hk-mut"> · còn {conLai} ngày</span>
                      ))}
                  </>
                ) : (
                  <span className="hk-warn">chưa hẹn</span>
                )}
              </dd>
            </dl>
          </div>
        </div>
        {x.mark ? (
          <div className="cx-ghi">
            <span className="cx-ok">
              ✓ Anh đã xem {ngayGioVn(x.mark.at).slice(0, 16)}
            </span>
            {x.mark.note && <span>— “{x.mark.note}”</span>}
          </div>
        ) : (
          <div className="cx-ghi">
            <label htmlFor={`ghi-${x.id}`}>Ghi chú cho GĐ (không bắt buộc)</label>
            <input
              id={`ghi-${x.id}`}
              className="cx-inp"
              type="text"
              maxLength={500}
              value={d.ghiChu[x.id] ?? ''}
              onChange={(e) => d.setGhiChu({ ...d.ghiChu, [x.id]: e.target.value })}
              placeholder="Ví dụ: giá giữ như đơn trước"
            />
          </div>
        )}
      </td>
    </tr>
  )
}
