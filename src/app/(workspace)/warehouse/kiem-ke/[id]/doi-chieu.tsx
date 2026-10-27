'use client'

import { useMemo, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { HopThoai } from '../../_erp/o-nhap'
import { vietSo, type DoiChieuDl, type DongDem, type DotDem } from './phieu-dem.shared'

const tien = (n: number) => Math.round(n).toLocaleString('vi-VN')
const coDau = (n: number) => (n > 0 ? `+${vietSo(n)}` : vietSo(n))
const EPS = 1e-9

export type DongDoiChieu = DongDem & {
  chenh: number
  don_gia: number | null
  chenh_tien: number | null
}

/** Ghép dòng đếm với chênh đã tính ở server; đếm thừa / thiếu / tiền một lần. */
export function useDoiChieu(dong: DongDem[], dc: DoiChieuDl) {
  return useMemo(() => {
    const ds: DongDoiChieu[] = dong.map((l) => {
      const c = dc.theoDong[l.id] ?? { chenh: 0, don_gia: null, chenh_tien: null }
      return { ...l, ...c }
    })
    const thua = ds.filter((l) => l.chenh > EPS)
    const thieu = ds.filter((l) => l.chenh < -EPS)
    const cong = (xs: DongDoiChieu[]) => xs.reduce((s, l) => s + (l.chenh_tien ?? 0), 0)
    return {
      ds,
      thua,
      thieu,
      khop: ds.length - thua.length - thieu.length,
      tienThua: cong(thua),
      tienThieu: cong(thieu),
      thieuGia: [...thua, ...thieu].filter((l) => l.chenh_tien == null).length,
      // "Đáng soát": sổ còn hàng mà đếm ra 0 — hay gặp nhất là hàng đã cấp cho lệnh chưa ghi xuất.
      dangSoat: thieu.filter((l) => (l.dem ?? 0) === 0 && (l.so_so ?? 0) > 0),
    }
  }, [dong, dc])
}

export type TomDoiChieu = ReturnType<typeof useDoiChieu>

/**
 * KHỐI ĐỐI CHIẾU (Kho B7c, bản vẽ KK-4): dải số tóm tắt + bảng chênh. Bây giờ
 * mới hiện số sổ — đợt đã qua bước đếm nên đếm mù không còn gì để giữ.
 */
export function DoiChieu({
  t,
  dc,
  hep = false,
}: {
  t: TomDoiChieu
  dc: DoiChieuDl
  /** Khung < 700px: 3 cột (vật tư · chênh · tiền), không cuộn ngang. */
  hep?: boolean
}) {
  const [chiLech, setChiLech] = useState(true)
  const hien = chiLech ? t.ds.filter((l) => Math.abs(l.chenh) > EPS) : t.ds
  const rong = t.thua.length + t.thieu.length
  return (
    <>
      <div className="kk-strip" role="group" aria-label="Tóm tắt đối chiếu">
        <div>
          <span className="lbl">Dòng đếm</span>
          <b>{t.ds.length.toLocaleString('vi-VN')}</b>
        </div>
        <div>
          <span className="lbl">Khớp sổ</span>
          <b className="kh-ok">{t.khop.toLocaleString('vi-VN')}</b>
        </div>
        <div>
          <span className="lbl">Thừa · N4</span>
          <b>{t.thua.length}</b>
          <span className="kh-mut kh-num">+{tien(t.tienThua)} ₫</span>
        </div>
        <div>
          <span className="lbl">Thiếu · X5</span>
          <b className={t.thieu.length ? 'kh-stop' : undefined}>{t.thieu.length}</b>
          <span className="kh-mut kh-num">{tien(t.tienThieu)} ₫</span>
        </div>
        <div>
          <span className="lbl">Chênh ròng</span>
          <b className={t.tienThua + t.tienThieu < -0.5 ? 'kh-stop' : undefined}>
            {tien(t.tienThua + t.tienThieu)} ₫
          </b>
          <span className="kh-mut">
            đơn giá BQ {dc.tu.slice(8, 10)}/{dc.tu.slice(5, 7)}–{dc.den.slice(8, 10)}/
            {dc.den.slice(5, 7)}
          </span>
        </div>
      </div>

      {t.dangSoat.length > 0 && (
        <div className="kh-note" role="note">
          <span className="tag">Đáng soát</span>
          <span>
            {t.dangSoat.length} mã sổ còn hàng mà đếm ra 0 (
            {t.dangSoat
              .slice(0, 4)
              .map((l) => `${l.code} sổ ${vietSo(l.so_so)}`)
              .join(' · ')}
            {t.dangSoat.length > 4 ? ' …' : ''}). Hay gặp nhất: hàng đã cấp cho lệnh mà
            chưa ghi xuất — ghi xuất bù trước khi duyệt, vì duyệt rồi thì phần đó thành X5
            và rời giá thành lệnh.
          </span>
        </div>
      )}

      <div className="kh-fb">
        <label className="kk-chk">
          <input
            type="checkbox"
            checked={chiLech}
            onChange={(e) => setChiLech(e.target.checked)}
          />
          Chỉ dòng lệch
        </label>
        <span className="sp kh-mut">
          Chênh = số đếm − sổ lúc chốt · tiền = chênh × đơn giá bình quân kỳ (cùng hàm Báo
          cáo Nhập–Xuất–Tồn)
        </span>
      </div>

      {hien.length === 0 ? (
        <div className="kh-rong">
          <b>Mọi dòng khớp sổ</b>
          <p>
            {t.ds.length.toLocaleString('vi-VN')} dòng đếm đều bằng sổ lúc chốt. Duyệt sẽ
            sinh phiếu KK không có dòng chênh nào — chỉ để lưu biên bản.
          </p>
        </div>
      ) : hep ? (
        <div className="kh-grid">
          <table className="kh-tb kk-luoi" aria-label="Đối chiếu số đếm với sổ">
            <colgroup>
              <col />
              <col style={{ width: 92 }} />
              <col style={{ width: 104 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Vật tư · sổ → đếm</th>
                <th className="r">Chênh</th>
                <th className="r">Tiền</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((l) => {
                const lech = Math.abs(l.chenh) > EPS
                return (
                  <tr key={l.id} className={lech ? 'd kk-lech' : 'd'}>
                    <td style={{ whiteSpace: 'normal' }}>
                      <b className="kh-ma">{l.code}</b> {l.name}
                      <span
                        className="kh-mut kh-num"
                        style={{ display: 'block', fontSize: 11.5 }}
                      >
                        {vietSo(l.so_so)} → {vietSo(l.dem)} {l.unit}
                        {l.note ? ` · ${l.note}` : ''}
                      </span>
                    </td>
                    <td className={`r kh-num${l.chenh < -EPS ? 'kh-stop' : ''}`}>
                      {lech ? coDau(l.chenh) : <span className="kh-empty">·</span>}
                    </td>
                    <td className="r kh-num">
                      {!lech ? (
                        <span className="kh-empty">·</span>
                      ) : l.chenh_tien == null ? (
                        <span className="kh-warn">thiếu giá</span>
                      ) : (
                        tien(l.chenh_tien)
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="kh-grid">
          <table className="kh-tb kk-luoi" aria-label="Đối chiếu số đếm với sổ">
            <colgroup>
              <col style={{ width: 104 }} />
              <col />
              <col style={{ width: 58 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 98 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 200 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                <th className="r">Sổ lúc chốt</th>
                <th className="r">Đếm</th>
                <th className="r">Chênh</th>
                <th className="r">Đơn giá BQ</th>
                <th className="r">Chênh tiền</th>
                <th>Ghi chú người đếm</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((l) => {
                const lech = Math.abs(l.chenh) > EPS
                const tram = (l.dem ?? 0) === 0 && (l.so_so ?? 0) > 0
                return (
                  <tr key={l.id} className={lech ? 'd kk-lech' : 'd'}>
                    <td className="kh-ma">{l.code}</td>
                    <td title={l.name}>{l.name}</td>
                    <td className="kh-mut">{l.unit}</td>
                    <td className="r kh-num">{vietSo(l.so_so)}</td>
                    <td className="r kh-num kh-b">{vietSo(l.dem)}</td>
                    <td className={`r kh-num${l.chenh < -EPS ? 'kh-stop' : ''}`}>
                      {lech ? coDau(l.chenh) : <span className="kh-empty">·</span>}
                    </td>
                    <td className="r kh-num kh-mut">
                      {l.don_gia == null ? (
                        <span className="kh-empty">—</span>
                      ) : (
                        tien(l.don_gia)
                      )}
                    </td>
                    <td
                      className={`r kh-num${(l.chenh_tien ?? 0) < -0.5 ? 'kh-stop' : ''}`}
                    >
                      {!lech ? (
                        <span className="kh-empty">·</span>
                      ) : l.chenh_tien == null ? (
                        <span
                          className="kh-warn"
                          title="Mã chưa lần nhập nào có giá — không tính là 0"
                        >
                          thiếu giá
                        </span>
                      ) : (
                        `${l.chenh_tien > 0 ? '+' : ''}${tien(l.chenh_tien)}`
                      )}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {l.note}
                      {tram && <span className="kh-warn"> · lệch 100%</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  {rong} dòng lệch / {t.ds.length.toLocaleString('vi-VN')}
                  {chiLech && t.khop > 0 ? ` · không gồm ${t.khop} dòng khớp` : ''}
                  {t.thieuGia > 0
                    ? ` · ${t.thieuGia} dòng thiếu giá không cộng tiền`
                    : ''}
                </td>
                <td />
                <td />
                <td className="r kh-num">{tien(t.tienThua + t.tienThieu)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}

/**
 * HỘP XÁC NHẬN DUYỆT — duyệt là đổi tồn, nên nói rõ sẽ ghi gì và không huỷ được.
 */
export function HopDuyet({
  dot,
  t,
  onClose,
  onDone,
}: {
  dot: DotDem
  t: TomDoiChieu
  onClose: () => void
  onDone: (bao: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  async function duyet() {
    setBusy(true)
    setLoi(null)
    try {
      const r = await api<{
        doc_code: string
        applied: number
        xuat_bu?: { code: string; lsx_code: string }[]
      }>(`/api/dept/warehouse/stocktakes/${dot.id}/decide`, {
        method: 'POST',
        body: { decision: 'approve' },
      })
      // Cập nhật số thực tế: dòng "tổ đã lấy" đi thành phiếu xuất cho lệnh.
      const bu = (r.xuat_bu ?? []).map((p) => `${p.code} cho ${p.lsx_code}`).join(', ')
      onDone(
        `Đã duyệt ${dot.code} · sinh phiếu ${r.doc_code} (${r.applied} dòng chênh)${bu ? ` · xuất bù ${bu}` : ''}.`,
      )
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }
  return (
    <HopThoai
      title={`Duyệt đợt ${dot.code}`}
      subtitle="ghi chênh lệch vào sổ kho — không huỷ được"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            aria-disabled={busy}
            onClick={() => !busy && void duyet()}
          >
            {busy
              ? 'Đang duyệt…'
              : `Duyệt · ghi ${t.thua.length + t.thieu.length} dòng chênh`}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        Sinh một phiếu KK: <b>{t.thua.length}</b> dòng thừa (N4, nhập vào) và{' '}
        <b>{t.thieu.length}</b> dòng thiếu (X5, xuất ra), chênh ròng{' '}
        <b className="kh-num">{tien(t.tienThua + t.tienThieu)} ₫</b>. Chênh tính so với sổ
        lúc chốt, nên phiếu nhập/xuất ghi trong lúc đếm không bị xoá.
      </p>
      {t.dangSoat.length > 0 && (
        <p className="kh-warn" style={{ margin: 0 }}>
          Còn {t.dangSoat.length} mã đếm ra 0 trong khi sổ còn hàng — kiểm lại hàng đã cấp
          cho lệnh trước khi duyệt.
        </p>
      )}
      <p className="kh-mut" style={{ margin: 0 }}>
        Duyệt rồi mà sai: đảo phiếu KK ở Sổ phiếu, không huỷ đợt.
      </p>
      {loi && (
        <span className="kh-stop" role="alert">
          {loi}
        </span>
      )}
    </HopThoai>
  )
}
