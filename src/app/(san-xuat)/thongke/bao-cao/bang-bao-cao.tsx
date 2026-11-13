'use client'

import { cx, dm, dmy, fmt, LEVEL, thu } from './bao-cao.shared'
import type { BaoCaoCtx } from './useBaoCao'

/** Sáu bảng của màn Báo cáo — mỗi bảng một hàm, cùng lưới `.sx-tb`. */

export function BangSanLuongTo({ d }: { d: BaoCaoCtx }) {
  const { p } = d
  const rows = p.san_luong_to
  const nD = p.days.length
  const wide = nD > 14
  return (
    <div className="sx-grid">
      <div className="sx-mh">
        Sản lượng theo tổ × ngày
        <span
          className="mut"
          style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
        >
          đạt (phế) · chỉ tiêu = Σ chỉ tiêu ngày đã khai · tô khi &lt; 80%
        </span>
      </div>
      <table className="sx-tb" style={{ minWidth: 380 + nD * (wide ? 44 : 72) + 250 }}>
        <colgroup>
          <col style={{ width: 170 }} />
          <col style={{ width: 70 }} />
          {p.days.map((x) => (
            <col key={x} style={{ width: wide ? 44 : 72 }} />
          ))}
          <col style={{ width: 90 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Tổ · công đoạn</th>
            <th>Đếm</th>
            {p.days.map((x) => (
              <th key={x} className="r" title={dmy(x)}>
                {wide ? dm(x).slice(0, 2) : `${thu(x)} ${dm(x)}`}
              </th>
            ))}
            <th className="r">Σ kỳ</th>
            <th className="r">Chỉ tiêu</th>
            <th className="r">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={nD + 5}
                className="mut"
                style={{ height: 60, textAlign: 'center' }}
              >
                Không có sổ nào trong kỳ {dmy(p.from)} – {dmy(p.to)}
                {d.team && ' của tổ đang lọc'} — đổi kỳ hoặc bỏ lọc tổ
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const pctN = r.target != null && r.target > 0 ? r.total_qty / r.target : null
            return (
              <tr key={`${r.team_id}|${r.stage}`} className="d">
                <td title={`${r.team_name} · ${r.stage_label}`}>
                  {r.team_name} · {r.stage_label}
                </td>
                <td className="mut">{LEVEL[r.count_level]}</td>
                {r.by_day.map((c, i) => (
                  <td
                    key={i}
                    className={cx('r num', c.qty === 0 && c.defect === 0 && 'empty')}
                    title={c.defect > 0 ? `phế ${fmt(c.defect)}` : undefined}
                  >
                    {c.qty === 0 && c.defect === 0
                      ? '—'
                      : wide
                        ? fmt(c.qty)
                        : `${fmt(c.qty)}${c.defect > 0 ? ` (${fmt(c.defect)})` : ''}`}
                  </td>
                ))}
                <td className="r num">
                  {fmt(r.total_qty)}
                  {r.total_defect > 0 && ` (${fmt(r.total_defect)})`}
                </td>
                <td className={cx('r num', r.target == null && 'mut')}>
                  {r.target == null ? '—' : fmt(r.target)}
                </td>
                <td className={cx('r num', pctN == null ? 'mut' : pctN < 0.8 && 'warn')}>
                  {pctN == null ? 'chưa chỉ tiêu' : `${Math.round(pctN * 100)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>{rows.length} dòng tổ × công đoạn</td>
            <td colSpan={nD + 3} className="mut" style={{ fontWeight: 400 }}>
              không cộng dọc: chi tiết + cụm + bộ là ba đơn vị · chốt sổ:{' '}
              {rows
                .map((r) => `${r.team_name} ${r.locked_days}/${nD}`)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(' · ') || '—'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function BangLoi({ d }: { d: BaoCaoCtx }) {
  const { p } = d
  const max = p.loi[0]?.share ?? 0
  return (
    <div className="sx-grid">
      <div className="sx-mh">
        Lỗi theo mã (Pareto)
        <span
          className="mut"
          style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
        >
          kỳ {dmy(p.from)} – {dmy(p.to)} · phế + sửa lại
        </span>
      </div>
      <table className="sx-tb" style={{ minWidth: 900 }}>
        <colgroup>
          <col style={{ width: 250 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 64 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 64 }} />
          <col style={{ width: 72 }} />
          <col style={{ width: 200 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Mã lỗi</th>
            <th>Công đoạn</th>
            <th className="r">Phế</th>
            <th className="r">Sửa lại</th>
            <th className="r">Cộng</th>
            <th className="r">Tích luỹ</th>
            <th>Tỷ trọng</th>
            <th>Lệnh gặp nhiều</th>
          </tr>
        </thead>
        <tbody>
          {p.loi.length === 0 && (
            <tr>
              <td colSpan={8} className="mut" style={{ height: 60, textAlign: 'center' }}>
                Kỳ này không có phế / sửa lại nào — đây là tin mừng, không phải màn hỏng
              </td>
            </tr>
          )}
          {p.loi.map((r, i) => (
            <tr key={i} className="d">
              <td title={r.label}>
                {r.code ? (
                  <>
                    <span className="ma">{r.code}</span> · {r.label}
                  </>
                ) : (
                  <>
                    <span className="mut">gõ tay · </span>
                    {r.label}
                  </>
                )}
              </td>
              <td className={cx(r.stage_label === 'chung' && 'mut')}>{r.stage_label}</td>
              <td className={cx('r num', r.defect === 0 && 'empty')}>{fmt(r.defect)}</td>
              <td className={cx('r num', r.rework === 0 && 'empty')}>{fmt(r.rework)}</td>
              <td className="r num">{fmt(r.total)}</td>
              <td className="r num">{r.cum_pct}%</td>
              <td>
                <span
                  className="sx-bar"
                  style={{ width: `${max > 0 ? Math.round((r.share / max) * 100) : 0}%` }}
                />
              </td>
              <td className="ma">{r.top_lsx ?? ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>
              {p.loi.filter((r) => r.code).length} mã có phát sinh /{' '}
              {p.loi_tong.codes_total}
            </td>
            <td className="r num">{fmt(p.loi_tong.defect)}</td>
            <td className="r num">{fmt(p.loi_tong.rework)}</td>
            <td className="r num">{fmt(p.loi_tong.defect + p.loi_tong.rework)}</td>
            <td colSpan={3} className="mut" style={{ fontWeight: 400 }}>
              lý do gõ tay (không mã) đứng riêng từng câu: {p.loi_tong.free_text} dòng kỳ
              này
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function BangSuaLaiTreo({ d }: { d: BaoCaoCtx }) {
  const rows = d.p.sua_lai_treo
  const tong = rows.reduce((a, r) => a + r.treo, 0)
  return (
    <div className="sx-grid">
      <div className="sx-mh">
        Sửa lại còn treo
        <span
          className="mut"
          style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
        >
          mọi kỳ, lệnh đang chạy · treo = Σ sửa lại − đạt ghi SAU lần sửa (bù theo thứ tự
          ghi)
        </span>
      </div>
      <table className="sx-tb" style={{ minWidth: 960 }}>
        <colgroup>
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 70 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Lệnh</th>
            <th>SP</th>
            <th>Dòng</th>
            <th>Công đoạn</th>
            <th>Tổ</th>
            <th className="r">Sửa lại</th>
            <th className="r">Đã bù</th>
            <th className="r">Còn treo</th>
            <th>Ghi sửa gần nhất</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="mut" style={{ height: 60, textAlign: 'center' }}>
                Không có hàng sửa lại nào còn treo trên các lệnh đang chạy
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="d">
              <td className="ma">
                <a className="lnk" href={`/thongke/lsx/${r.lsx_id}`}>
                  {r.lsx_code}
                </a>
              </td>
              <td className="ma">{r.product_code}</td>
              <td title={r.comp}>
                {r.cluster && <span className="mut">{r.cluster} · </span>}
                {r.comp}
              </td>
              <td>{r.stage_label}</td>
              <td>{r.team_name ?? <span className="empty">—</span>}</td>
              <td className="r num">{fmt(r.rework)}</td>
              <td className={cx('r num', r.bu === 0 && 'empty')}>{fmt(r.bu)}</td>
              <td className="r num warn">{fmt(r.treo)}</td>
              <td className="num">{dmy(r.last_date)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>{rows.length} dòng còn treo</td>
            <td className="r num">{fmt(tong)}</td>
            <td className="mut" style={{ fontWeight: 400 }}>
              không cộng dọc khác đơn vị
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function BangTonCongDoan({ d }: { d: BaoCaoCtx }) {
  const rows = d.p.ton_cong_doan
  return (
    <div className="sx-grid">
      <div className="sx-mh">
        Tồn công đoạn
        <span
          className="mut"
          style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
        >
          lệnh đang chạy, hiện trạng · tồn = xong (chính thức) − đã giao đi · cùng hàm với
          Hồ sơ lệnh và Giao nhận
        </span>
      </div>
      <table className="sx-tb" style={{ minWidth: 960 }}>
        <colgroup>
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 80 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Lệnh</th>
            <th>SP</th>
            <th>Dòng</th>
            <th>Công đoạn</th>
            <th>Đếm</th>
            <th className="r">Xong</th>
            <th className="r">Đã giao</th>
            <th className="r">Tồn</th>
            <th className="r">Chờ nhận</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="mut" style={{ height: 60, textAlign: 'center' }}>
                Không có tồn tại công đoạn nào — chưa lệnh nào có sổ chính thức, hoặc mọi
                thứ đã giao đi hết
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="d">
              <td className="ma">
                <a className="lnk" href={`/thongke/lsx/${r.lsx_id}`}>
                  {r.lsx_code}
                </a>
              </td>
              <td className="ma">{r.product_code}</td>
              <td title={r.comp}>
                {r.cluster && <span className="mut">{r.cluster} · </span>}
                {r.comp}
              </td>
              <td>{r.stage_label}</td>
              <td className="mut">{LEVEL[r.count_level]}</td>
              <td className="r num">{fmt(r.done)}</td>
              <td className={cx('r num', r.shipped === 0 && 'empty')}>
                {fmt(r.shipped)}
              </td>
              <td className={cx('r num', r.on_hand > 0 && 'warn')}>{fmt(r.on_hand)}</td>
              <td className={cx('r num', r.cho_nhan === 0 && 'empty')}>
                {fmt(r.cho_nhan)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={9}>
              {rows.length} dòng × công đoạn có tồn
              <span className="mut" style={{ fontWeight: 400 }}>
                {' '}
                · không cộng dọc: mỗi dòng mang đơn vị của công đoạn nó đứng
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function BangDinhMuc({ d }: { d: BaoCaoCtx }) {
  const { p, dm } = d
  return (
    <div className="sx-grid">
      <div className="sx-hc">
        <label className="c">
          Lệnh
          <select
            value={d.dmLsx}
            onChange={(e) => d.doiDmLsx(e.target.value)}
            aria-label="Lệnh định mức"
          >
            {p.lsx.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.customer_name}
              </option>
            ))}
          </select>
        </label>
        {dm && (
          <span className="mut">
            {dm.snapped_at
              ? `định mức chốt ${dmy(dm.snapped_at)}`
              : 'lệnh CHƯA chốt định mức — cột "cần" không có nghĩa'}
          </span>
        )}
        {d.dmLsx && (
          <a
            className="lnk sp"
            href={`/api/dept/production/reports?type=dinh-muc&lsx=${d.dmLsx}&format=xlsx`}
          >
            Tải Excel
          </a>
        )}
      </div>
      {d.dmBusy ? (
        <div className="sx-fine">Đang tải…</div>
      ) : !dm ? (
        <div className="sx-fine">Chọn lệnh để xem</div>
      ) : (
        <table className="sx-tb" style={{ minWidth: 760 }}>
          <colgroup>
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 70 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Mã VT</th>
              <th>Vật tư</th>
              <th>ĐVT</th>
              <th className="r">Cần (ĐM)</th>
              <th className="r">Kho đã xuất</th>
              <th className="r">Kg sổ thống kê</th>
            </tr>
          </thead>
          <tbody>
            {dm.rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="mut"
                  style={{ height: 48, textAlign: 'center' }}
                >
                  Lệnh chưa bóc được nhu cầu vật tư
                </td>
              </tr>
            )}
            {dm.rows.map((r) => (
              <tr key={r.material_code} className="d">
                <td className="ma">{r.material_code}</td>
                <td title={r.material_name ?? undefined}>{r.material_name}</td>
                <td className="mut">{r.unit}</td>
                <td className="r num">{fmt(r.qty_needed)}</td>
                <td className={cx('r num', r.qty_issued === 0 && 'empty')}>
                  {fmt(r.qty_issued)}
                </td>
                <td className={cx('r num', r.kg_logged == null && 'empty')}>
                  {r.kg_logged == null ? '—' : fmt(r.kg_logged)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>
                {dm.rows.length} vật tư
                <span className="mut" style={{ fontWeight: 400 }}>
                  {' '}
                  · hai cột “thực” CỐ Ý tách: sổ kho và sổ thống kê đo hai điều khác nhau
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
