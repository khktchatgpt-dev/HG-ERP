'use client'

import Link from 'next/link'
import { byUnitText, sortByUnit, teamText } from '@/lib/khoi-luong'
import type { KlStage } from '@/lib/khoi-luong'
import { cx, fmt } from './ho-so-lenh.shared'
import type { HoSoLenhCtx } from './useHoSoLenh'

/**
 * KHỐI LƯỢNG THEO CÔNG ĐOẠN — khối dưới dải 5 ô của tab Đồng bộ (bản vẽ bước
 * 2, 09/11/2026, https://claude.ai/artifact/2u4QXWAx6hsn8Gha4ari6d, duyệt Q1–Q7).
 *
 * Trả lời: "lệnh này phôi cắt bao nhiêu CHI TIẾT, hàn ra bao nhiêu CỤM, lắp
 * ráp bao nhiêu BỘ, ai làm, hạn nào". Một ô một công đoạn lệnh ĐI QUA (Q2),
 * số lớn kèm đơn vị, công đoạn hai đơn vị bày hai dòng không cộng (Q3), dòng
 * cuối là tổ & hạn từ production_jobs (Q4). Chi tiết chưa gán cụm bày vàng,
 * hệ không tự gộp (Q5). Bấm ô → bảng Đồng bộ bên dưới tô cột đó. Bung "theo
 * dòng SP" ra bảng một hàng mỗi SP — thứ người lập kế hoạch cầm sang Giao tổ.
 * Số từ `lib/khoi-luong` = cùng `tallyLineStages` với dải công đoạn ở Lệnh
 * sản xuất; màn này không cộng lại gì.
 */
export function KhoiLuong({ d }: { d: HoSoLenhCtx }) {
  const k = d.data.khoi_luong
  const lines = k.lines.filter((l) => l.has_components)

  if (k.stages.length === 0) {
    return (
      <div className="sx-kl">
        <div className="sx-kl-h">
          <b>Khối lượng theo công đoạn</b>
          <span className="mut">
            {fmt(k.lines.length)} dòng SP · {fmt(d.tongDat)} {k.lines[0]?.unit ?? 'cái'}
          </span>
        </div>
        <div className="sx-rong" style={{ padding: '14px 24px' }}>
          <b>
            Chưa có gì để đếm — {fmt(k.unshaped)}/{fmt(k.lines.length)} dòng SP chưa có
            bảng chi tiết
          </b>
          <p>
            Số “cần” của từng công đoạn suy từ định mức Kỹ thuật (số chi tiết trên 1 SP ×
            SL lệnh). Hồ sơ SP chưa có định mức thì chỉ biết tổng {fmt(d.tongDat)} ở chặng
            thành phẩm, không biết phôi phải cắt bao nhiêu.
          </p>
          <span>
            <Link className="sx-btn" href={`/thongke/lo-trinh?lsx=${d.data.lsx.id}`}>
              Xem Lộ trình công đoạn ›
            </Link>
            <span className="mut" style={{ marginLeft: 8 }}>
              chờ Kỹ thuật nạp định mức → bảng tự nạp lúc mở lại
            </span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="sx-kl">
      <div className="sx-kl-h">
        <b>Khối lượng theo công đoạn</b>
        <span className="mut">
          cần · đạt · tổ &amp; hạn — {fmt(k.stages.length)} công đoạn lệnh đi qua, thứ tự
          danh mục
        </span>
        <button type="button" className="lnk" onClick={() => d.setKlBung(!d.klBung)}>
          {d.klBung ? '▾ thu gọn' : `▸ theo dòng SP (${fmt(lines.length)})`}
        </button>
        <span className="sp">
          {d.klBung
            ? 'ô = cần · đơn vị ở tiêu đề cột · ô hai đơn vị ghi cả hai · cộng dọc được, cộng ngang không'
            : 'đơn vị đổi dọc lộ trình: chi tiết → cụm → bộ · không cộng ngang'}
        </span>
      </div>

      {d.klBung ? (
        <BangTheoSp d={d} />
      ) : (
        <div className="sx-kl-row" role="list">
          {k.stages.map((s) => (
            <O key={s.code} d={d} s={s} />
          ))}
        </div>
      )}

      <div className="sx-kl-note">
        {k.not_traversed.length > 0 && (
          <span>
            Không đi qua: <b>{k.not_traversed.join(' · ')}</b>
          </span>
        )}
        {k.stages.some((s) => s.by_unit.length > 1) && (
          <span>
            Công đoạn mang 2 đơn vị (cụm / bộ và chi tiết đi riêng, như tấm gỗ chỉ qua
            sơn) bày hai dòng, <b>không cộng</b>
          </span>
        )}
        {k.unassigned.parts > 0 && (
          <span className="w">
            <b>{fmt(k.unassigned.qty)}</b> chi tiết ({fmt(k.unassigned.parts)} dòng) đi
            qua công đoạn ghép mà không thuộc cụm nào — đang đếm lẫn cạnh cụm. Kỹ thuật
            gán vào cụm ở hồ sơ SP; hệ không tự gộp.
          </span>
        )}
        {k.unshaped > 0 && (
          <span className="w">
            {fmt(k.unshaped)} dòng SP chưa định mức — số trên chưa gồm chúng
          </span>
        )}
        {(() => {
          const thieu = k.stages.filter((s) => s.jobs === 0).length
          return thieu > 0 ? (
            <span className="w">
              {fmt(thieu)} / {fmt(k.stages.length)} công đoạn chưa giao tổ &amp; hạn →{' '}
              {d.p.canPlan ? (
                <Link className="lnk" href={`/kehoach-sx/${d.data.lsx.id}`}>
                  Giao tổ &amp; hạn ›
                </Link>
              ) : (
                <span className="mut">Kế hoạch SX giao</span>
              )}
            </span>
          ) : null
        })()}
      </div>
    </div>
  )
}

function O({ d, s }: { d: HoSoLenhCtx; s: KlStage }) {
  const units = sortByUnit(s.by_unit)
  const main = units[0]
  const pct = s.needed > 0 ? Math.round(Math.min(s.done / s.needed, 1) * 100) : 0
  const team = teamText(s)
  const on = d.congDoanChon === s.code
  const isDefault =
    main?.level === 'cluster' && main.unit !== 'cụm' && s.unassigned_qty === 0
  return (
    <button
      type="button"
      role="listitem"
      className={cx('sx-kc', on && 'sel')}
      onClick={() => d.chonCongDoan(s.code)}
      title={`${s.label}: ${byUnitText(units)} · đạt ${fmt(s.done)} — bấm để tô cột ở bảng Đồng bộ`}
      aria-pressed={on}
    >
      <span className="st">
        {s.label} <i>{s.index}</i>
      </span>
      {main && (
        <span className="n">
          {fmt(main.needed)}
          <small>{main.unit}</small>
        </span>
      )}
      {units.slice(1).map((u) => {
        const unassigned = u.level === 'part' && s.unassigned_qty > 0
        return (
          <span key={u.level + u.unit} className={cx('n sec', unassigned && 'warn')}>
            {fmt(u.needed)}
            <small>{u.unit}</small>
          </span>
        )
      })}
      <span className="pb">
        <b className={pct >= 100 ? 'f' : undefined} style={{ width: `${pct}%` }} />
      </span>
      <span className="dt">
        đạt <span className="num">{fmt(s.done)}</span> · {pct}%
        {/* Ô 154px chứa một ghi chú thôi: hai đơn vị nói trước, "mặc nhiên" khi còn chỗ. */}
        {units.length > 1 ? ' · 2 đơn vị' : isDefault && ' · mặc nhiên'}
      </span>
      {s.unassigned_qty > 0 && <span className="dt w">chưa gán cụm ›</span>}
      <span className={cx('dt', team.tone === 'warn' && 'w')}>{team.text}</span>
    </button>
  )
}

function BangTheoSp({ d }: { d: HoSoLenhCtx }) {
  const k = d.data.khoi_luong
  const lines = k.lines.filter((l) => l.has_components)
  const unitHead = (s: KlStage) =>
    sortByUnit(s.by_unit)
      .map((u) => u.unit)
      .join(' / ')
  return (
    <div className="sx-grid" style={{ maxHeight: 300 }}>
      <table className="sx-tb" style={{ minWidth: 150 + 70 + k.stages.length * 104 }}>
        <colgroup>
          <col style={{ width: 150 }} />
          <col style={{ width: 70 }} />
          {k.stages.map((s) => (
            <col key={s.code} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>Dòng SP</th>
            <th className="r">SL</th>
            {k.stages.map((s) => (
              <th key={s.code} className="r" title={`${s.label} · ${unitHead(s)}`}>
                {s.label} · {unitHead(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.order_line_id} className="d">
              <td title={l.product_name}>
                <span className="ma">{l.product_code}</span>
              </td>
              <td className="r num">{fmt(l.qty)}</td>
              {k.stages.map((s) => {
                const us = l.cells[s.code]
                if (!us || us.length === 0)
                  return (
                    <td key={s.code} className="r out">
                      –
                    </td>
                  )
                return (
                  <td key={s.code} className="r num">
                    {fmt(us[0].needed)}
                    {us.slice(1).map((u) => (
                      <span key={u.unit} className="u">
                        {' '}
                        · {fmt(u.needed)} {u.unit === 'chi tiết' ? 'ct' : u.unit}
                      </span>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Cộng {fmt(lines.length)} dòng</td>
            <td className="r num">{fmt(lines.reduce((a, l) => a + l.qty, 0))}</td>
            {k.stages.map((s) => {
              const us = sortByUnit(s.by_unit)
              return (
                <td key={s.code} className="r num">
                  {fmt(us[0]?.needed ?? 0)}
                  {us.slice(1).map((u) => (
                    <span key={u.unit} className="u">
                      {' '}
                      · {fmt(u.needed)} {u.unit === 'chi tiết' ? 'ct' : u.unit}
                    </span>
                  ))}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
