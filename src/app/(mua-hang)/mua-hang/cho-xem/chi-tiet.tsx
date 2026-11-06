'use client'

import Link from 'next/link'
import { ExternalLink, Printer } from 'lucide-react'
import {
  chanNgan,
  henVe,
  kiemTruocTrinh,
  soGia,
  soNgayTu,
  soVn,
  tienVn,
  trangThaiXem,
  type XemDon,
} from '@/lib/cho-xem'
import type { ChoXemCtx } from './useChoXem'
import { gioPhut, ngayThang } from './luoi-don'

const NHAN_TT: Record<ReturnType<typeof trangThaiXem>, { cls: string; chu: string }> = {
  trinh_duoc: { cls: 'cx-ok', chu: 'Nháp · trình được' },
  gui_thang: { cls: 'hk-warn', chu: 'Đã ở bàn GĐ · anh chưa xem' },
  thieu: { cls: 'hk-warn', chu: 'Nháp · còn thiếu' },
  tra_lai: { cls: 'hk-mut', chu: 'Nháp · bị trả lại, chờ sửa' },
  da_xem: { cls: 'cx-ok', chu: 'Đã trình · chờ GĐ' },
}

/** "17/03/2027" từ YYYY-MM-DD. */
const ngayDu = (iso: string) =>
  `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/**
 * KHUNG CHI TIẾT DƯỚI LƯỚI (bản vẽ khung 6, Q8) — đơn đang xem, đủ để quyết
 * trình hay trả lại mà không mở đơn: dòng hàng + so giá đơn trước cùng NCC (Q6),
 * tiền · giao · trả, mục "Kiểm trước khi trình", ghi chú cho GĐ.
 */
export function ChiTiet({ d }: { d: ChoXemCtx }) {
  const x = d.dangXem
  if (!x) return null
  const t = trangThaiXem(x)
  const tt = NHAN_TT[t]
  const now = new Date(d.box.at)
  return (
    <section className="cx-ct" aria-label={`Chi tiết ${x.code}`}>
      <div className="cx-cth">
        <span className="cx-code">{x.code}</span>
        <span className="hk-b cx-cut" title={x.ncc_day_du}>
          {x.ncc_day_du}
        </span>
        <span className={`cx-tt ${tt.cls}`}>
          {t === 'thieu' && x.chan ? `Nháp · ${chanNgan(x.chan).toLowerCase()}` : tt.chu}
        </span>
        <span className="hk-mut cx-cut">
          {x.owner_name ?? 'Chưa rõ người lập'} lập {gioPhut(x.lap_at)}
          {x.sua_at.slice(0, 16) !== x.lap_at.slice(0, 16) &&
            ` · sửa ${gioPhut(x.sua_at)}`}
        </span>
        <span className="cx-rt">
          <Link href={x.href} className="hk-btn cx-vien">
            <ExternalLink size={14} aria-hidden />
            Mở đơn đầy đủ
          </Link>
          <a
            href={`/print/supply/${x.id}`}
            target="_blank"
            rel="noreferrer"
            className="hk-btn cx-vien"
          >
            <Printer size={14} aria-hidden />
            Phiếu đặt hàng
          </a>
        </span>
      </div>
      <div className="cx-ctb">
        <div className="cx-ctl">
          <DongHang x={x} />
        </div>
        <TienGiaoTra x={x} homNay={d.homNay} />
        <div className="cx-ctc" style={{ width: 236 }}>
          <h4>Kiểm trước khi trình</h4>
          <ul className="cx-ck">
            {kiemTruocTrinh(x, now, d.homNay).map((k, i) => (
              <li key={i}>
                <span
                  className={
                    k.kieu === 'ok'
                      ? 'i cx-ok'
                      : k.kieu === 'st'
                        ? 'i hk-late'
                        : 'i hk-warn'
                  }
                >
                  {k.kieu === 'ok' ? '✓' : k.kieu === 'st' ? '✗' : '!'}
                </span>
                <span className={k.kieu === 'st' ? 'hk-b' : undefined}>{k.chu}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ChanChiTiet d={d} x={x} t={t} now={now} />
    </section>
  )
}

/** Bảng dòng hàng — cột cuối so với lần mua gần nhất cùng NCC. */
function DongHang({ x }: { x: XemDon }) {
  return (
    <table className="cx-mini" aria-label={`Dòng hàng ${x.code}`}>
      <colgroup>
        <col />
        <col style={{ width: 88 }} />
        <col style={{ width: 84 }} />
        <col style={{ width: 96 }} />
        <col style={{ width: 124 }} />
      </colgroup>
      <thead>
        <tr>
          <th>Vật tư · {x.dong.length} dòng</th>
          <th className="r">SL</th>
          <th className="r">Đơn giá</th>
          <th className="r">Thành tiền</th>
          <th>Giá đơn trước</th>
        </tr>
      </thead>
      <tbody>
        {x.dong.map((l) => {
          const s = soGia(l.don_gia, l.truoc)
          const ma = l.truoc ? l.truoc.po_code.replace(/^PO-\d{4}-/, '') : ''
          return (
            <tr key={l.id}>
              <td title={[l.ten, l.ma, l.quy_cach].filter(Boolean).join(' · ')}>
                {l.ten}
                {l.quy_cach && <span className="hk-mut"> · {l.quy_cach}</span>}
                {l.ma && <span className="hk-num hk-mut"> {l.ma}</span>}
              </td>
              <td className="r hk-num">
                {l.qd == null ? (
                  <>
                    {soVn(l.sl)} <span className="hk-mut">{l.dvt ?? ''}</span>
                  </>
                ) : (
                  <span title={`${soVn(l.sl)} ${l.dvt ?? ''}`}>
                    {soVn(l.qd)} <span className="hk-mut">{l.dvt_gia ?? ''}</span>
                  </span>
                )}
              </td>
              <td className="r hk-num">
                {l.don_gia == null ? (
                  <span className="hk-warn">chưa giá</span>
                ) : (
                  soVn(l.don_gia, 2)
                )}
              </td>
              <td className="r hk-num">{soVn(l.thanh_tien, 0)}</td>
              <td
                title={
                  l.truoc ? `${soVn(l.truoc.gia, 2)} · ${l.truoc.po_code}` : undefined
                }
              >
                {!l.truoc ? (
                  <span className="hk-warn">mua lần đầu</span>
                ) : s?.kieu === 'bang' ? (
                  <>
                    <span className="cx-ok">giữ giá</span>{' '}
                    <span className="hk-mut">· {ma}</span>
                  </>
                ) : s ? (
                  <>
                    <span className={s.kieu === 'tang' ? 'hk-warn' : 'cx-ok'}>
                      {s.kieu === 'tang' ? '+' : '−'}
                      {soVn(s.pct, 1)}%
                    </span>{' '}
                    <span className="hk-mut">· {ma}</span>
                  </>
                ) : (
                  <span className="hk-mut">—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TienGiaoTra({ x, homNay }: { x: XemDon; homNay: string }) {
  const hen = henVe(x.expected_at, homNay)
  const conXuat = x.lenh_xuat ? soNgayTu(`${homNay}T00:00:00Z`, new Date(`${x.lenh_xuat}T00:00:00Z`)) : null // prettier-ignore
  return (
    <div className="cx-ctc" style={{ width: 272 }}>
      <h4>Tiền · giao · trả</h4>
      <dl className="cx-kv2">
        <dt>Tiền hàng</dt>
        <dd className="hk-num">{soVn(x.tien_hang, 0)}</dd>
        <dt>VAT {soVn(x.vat_rate, 1)}%</dt>
        <dd className="hk-num">{soVn(x.vat, 0)}</dd>
        <dt className="hk-b">Tổng</dt>
        <dd className="hk-num hk-b">{tienVn(x.value, x.currency)}</dd>
        <dt>Hẹn về</dt>
        <dd>
          {x.expected_at ? (
            <span className={hen?.gap ? 'hk-warn' : undefined}>
              <span className="hk-num">{ngayThang(`${x.expected_at}T05:00:00Z`)}</span> ·{' '}
              {hen?.chu}
            </span>
          ) : (
            <span className="hk-warn">chưa hẹn</span>
          )}
        </dd>
        {x.lsx ? (
          <>
            <dt>Lệnh xuất</dt>
            <dd>
              {x.lenh_xuat ? (
                <>
                  <span className="hk-num">{ngayDu(x.lenh_xuat)}</span>
                  {conXuat != null && <span className="hk-mut"> · {conXuat} ngày</span>}
                </>
              ) : (
                <span className="hk-mut">chưa có ngày</span>
              )}
            </dd>
          </>
        ) : (
          <>
            <dt>Cho việc</dt>
            <dd className="cx-cut" title={x.ngoai_lenh ?? undefined}>
              {x.ngoai_lenh ?? 'Ngoài lệnh'}
            </dd>
          </>
        )}
        <dt>Thanh toán</dt>
        <dd className="cx-cut" title={x.thanh_toan ?? undefined}>
          {x.thanh_toan ?? <span className="hk-warn">chưa ghi</span>}
        </dd>
        <dt>Hợp đồng</dt>
        <dd className="hk-num">{x.hop_dong ?? <span className="hk-mut">—</span>}</dd>
        {x.ghi_chu && (
          <>
            <dt>Ghi chú</dt>
            <dd className="cx-cut" title={x.ghi_chu}>
              {x.ghi_chu}
            </dd>
          </>
        )}
      </dl>
    </div>
  )
}

/** Chân khung: ô ghi chú cho GĐ (việc làm được), dấu đã xem, hay lý do trả lại. */
function ChanChiTiet({
  d,
  x,
  t,
  now,
}: {
  d: ChoXemCtx
  x: XemDon
  t: ReturnType<typeof trangThaiXem>
  now: Date
}) {
  if (t === 'da_xem' && x.mark)
    return (
      <div className="cx-ghi">
        <span className="cx-ok">✓ Anh đã xem {gioPhut(x.mark.at)}</span>
        {x.mark.note && <span>— “{x.mark.note}”</span>}
      </div>
    )
  if (t === 'tra_lai' && x.tra_lai)
    return (
      <div className="cx-ghi">
        <span className="hk-mut">
          Trả lại {gioPhut(x.tra_lai.at)}
          {x.tra_lai.by_name && ` · ${x.tra_lai.by_name}`}
          {` · ${soNgayTu(x.tra_lai.at, now)} ngày trước`}
        </span>
        <span>— “{x.tra_lai.reason ?? 'không ghi lý do'}”</span>
      </div>
    )
  if (t !== 'trinh_duoc' && t !== 'gui_thang') return null
  return (
    <div className="cx-ghi">
      <label htmlFor={`ghi-${x.id}`}>Ghi chú cho GĐ (không bắt buộc)</label>
      <input
        id={`ghi-${x.id}`}
        className="cx-inp"
        type="text"
        maxLength={500}
        value={d.ghiChu[x.id] ?? ''}
        onChange={(e) => d.setGhiChu({ ...d.ghiChu, [x.id]: e.target.value })}
        placeholder="Ví dụ: giá giữ như đơn trước cùng NCC; dòng mới đã hỏi giá 2 nơi"
      />
    </div>
  )
}
