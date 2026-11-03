'use client'

import {
  CORE_FIELDS,
  CORE_FIELD_LABEL,
  COUNT_LEVELS,
  COUNT_LEVEL_LABEL,
  countingOf,
  type CoreMode,
} from '@/lib/stage-config'
import type { CongDoanCtx } from './cong-doan.shared'

/**
 * BẢNG CẤU HÌNH của công đoạn đang chọn (cột phải màn C1). Năm khối: đếm bằng ·
 * tổ phụ trách · ô lõi · ô riêng · mã lỗi; cuối là ngừng dùng / dùng lại.
 * Nhận `d` từ hook, không giữ state riêng.
 */
export function BangCauHinh({ d }: { d: CongDoanCtx }) {
  const { chon, nhap, them } = d
  if (them) return <ThemCongDoanForm d={d} />
  if (!chon || !nhap) {
    return (
      <div className="sx-rong">
        <b>Chưa chọn công đoạn</b>
        <p>Bấm một dòng bên trái để xem và sửa cách đếm, tổ, ô nhập, mã lỗi.</p>
      </div>
    )
  }

  // Mốc đếm NẾU lưu bản nháp này — để người sửa thấy hệ quả trước khi Lưu.
  const sauKhiLuu = countingOf(
    d.stages
      .filter((s) => s.is_active)
      .map((s) => ({
        code: s.code,
        label: s.label,
        meta: s.code === nhap.code ? nhap.meta : s.meta,
      })),
  )
  const labelOf = (c: string) => d.stages.find((s) => s.code === c)?.label ?? c
  const otherStages = d.stages.filter((s) => s.is_active && s.code !== nhap.code)
  const teamsOther = new Map(
    d.data.teams
      .filter((t) => t.stage_code && t.stage_code !== nhap.code)
      .map((t) => [t.id, t.stage_code!]),
  )

  return (
    <>
      <div className="sx-mh">
        <b>{chon.label}</b>
        <span className="ma">{chon.code}</span>
        {!chon.is_active && <span className="pill m">ngừng dùng</span>}
        {chon.doc_count > 0 && (
          <span className="pill b" title="Phiếu sản lượng đã ghi ở công đoạn này">
            {chon.doc_count.toLocaleString('vi-VN')} phiếu
          </span>
        )}
      </div>

      <div className="sx-blk">
        <h3>Tên hiển thị</h3>
        <input
          id="cd-ten"
          className="sx-in"
          style={{ width: '100%' }}
          value={nhap.label}
          aria-label="Tên công đoạn"
          aria-invalid={nhap.label.trim() === '' || undefined}
          onChange={(e) => d.doiNhap({ label: e.target.value })}
        />
      </div>

      <div className="sx-blk">
        <h3>Đếm bằng</h3>
        <div className="sx-row">
          {COUNT_LEVELS.map((lv) => (
            <label key={lv} className="sx-rd">
              <input
                type="radio"
                name="count_level"
                value={lv}
                checked={nhap.meta.count_level === lv}
                onChange={() => d.doiMeta({ count_level: lv })}
              />
              {COUNT_LEVEL_LABEL[lv]}
            </label>
          ))}
        </div>
        <div className="sx-row mut" style={{ fontSize: 12 }}>
          Đầu vào từ
          <select
            id="cd-input-from"
            className="sx-sel"
            value={nhap.meta.input_from ?? ''}
            aria-label="Công đoạn cấp đầu vào"
            onChange={(e) => d.doiMeta({ input_from: e.target.value || null })}
          >
            <option value="">— máy suy theo lộ trình —</option>
            {otherStages.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sx-fine" style={{ padding: '4px 0 0', border: 0 }}>
          Sau khi lưu: ghép ở <b>{sauKhiLuu.join ? labelOf(sauKhiLuu.join) : '—'}</b> ·
          thành phẩm{' '}
          <b>
            {sauKhiLuu.finish.length ? sauKhiLuu.finish.map(labelOf).join(' → ') : '—'}
          </b>
          {chon.doc_count > 0 && nhap.meta.count_level !== chon.meta.count_level && (
            <span className="warn">
              {' '}
              · đổi đơn vị khi đã có {chon.doc_count} phiếu — số cũ giữ nguyên nghĩa cũ
            </span>
          )}
        </div>
      </div>

      <div className="sx-blk">
        <h3>
          Tổ phụ trách
          <span className="hint">tổ xưởng — gợi ý tổ khi chọn công đoạn ghi sổ</span>
        </h3>
        <div className="sx-row">
          {d.data.teams.length === 0 && (
            <span className="mut">Chưa có tổ nào trong khu Sản xuất</span>
          )}
          {d.data.teams.map((t) => {
            const on = nhap.team_ids.includes(t.id)
            const khac = teamsOther.get(t.id)
            return (
              <label
                key={t.id}
                className="sx-ck"
                title={khac ? `đang phụ trách ${labelOf(khac)}` : undefined}
              >
                <input type="checkbox" checked={on} onChange={() => d.toggleTo(t.id)} />
                {t.name}
                {khac && !on && <span className="mut">({labelOf(khac)})</span>}
              </label>
            )
          })}
        </div>
      </div>

      <div className="sx-blk">
        <h3>
          Ô lõi trên phiếu ghi sổ
          <span className="hint">SL đạt luôn hiện và bắt buộc</span>
        </h3>
        <table className="sx-mini">
          <thead>
            <tr>
              <th>Ô</th>
              <th className="c">Ẩn</th>
              <th className="c">Hiện</th>
              <th className="c">Bắt buộc</th>
            </tr>
          </thead>
          <tbody>
            {CORE_FIELDS.map((f) => (
              <tr key={f}>
                <td>{CORE_FIELD_LABEL[f]}</td>
                {(['off', 'on', 'required'] as CoreMode[]).map((m) => (
                  <td key={m} className="c">
                    <input
                      type="radio"
                      name={`core-${f}`}
                      aria-label={`${CORE_FIELD_LABEL[f]} — ${m === 'off' ? 'ẩn' : m === 'on' ? 'hiện' : 'bắt buộc'}`}
                      checked={nhap.meta.core[f] === m}
                      onChange={() => d.doiCore(f, m)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sx-fine" style={{ padding: '4px 0 0', border: 0 }}>
          Có phế hoặc sửa lại thì lý do lỗi tự bắt buộc — không khai ở đây.
        </div>
      </div>

      <div className="sx-blk">
        <h3>
          Ô riêng của công đoạn
          <span className="hint">thêm một dòng, không sửa mã</span>
        </h3>
        {nhap.fields.length > 0 && (
          <table className="sx-mini">
            <thead>
              <tr>
                <th>Tên ô</th>
                <th>Khoá</th>
                <th>Kiểu</th>
                <th>Lựa chọn / dải</th>
                <th className="c">Bắt buộc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {nhap.fields.map((f, i) => (
                <tr key={f.id ?? `new-${i}`}>
                  <td style={{ width: 110 }}>
                    <input
                      className="sx-in"
                      value={f.label}
                      aria-label={`Tên ô ${i + 1}`}
                      aria-invalid={f.label === '' || undefined}
                      onChange={(e) => d.suaORieng(i, { label: e.target.value })}
                    />
                  </td>
                  <td style={{ width: 90 }}>
                    <input
                      className="sx-in ma"
                      value={f.field_key}
                      readOnly={f.id !== null}
                      title={
                        f.id !== null
                          ? 'Khoá đã dùng trong sổ — không đổi'
                          : 'Khoá đi vào sổ, bất biến'
                      }
                      aria-label={`Khoá ô ${i + 1}`}
                      aria-invalid={f.field_key === '' || undefined}
                      onChange={(e) => d.suaORieng(i, { field_key: e.target.value })}
                    />
                  </td>
                  <td style={{ width: 64 }}>
                    <select
                      className="sx-sel"
                      value={f.kind}
                      aria-label={`Kiểu ô ${i + 1}`}
                      onChange={(e) =>
                        d.suaORieng(i, {
                          kind: e.target.value as 'text' | 'number' | 'select',
                        })
                      }
                    >
                      <option value="text">chữ</option>
                      <option value="number">số</option>
                      <option value="select">chọn</option>
                    </select>
                  </td>
                  <td>
                    {f.kind === 'select' && (
                      <input
                        className="sx-in"
                        value={f.options_text}
                        placeholder="Hàng trần, Đang mây"
                        aria-label={`Lựa chọn ô ${i + 1}`}
                        onChange={(e) => d.suaORieng(i, { options_text: e.target.value })}
                      />
                    )}
                    {f.kind === 'number' && (
                      <span style={{ display: 'flex', gap: 4 }}>
                        <input
                          className="sx-in num"
                          value={f.min_value}
                          placeholder="min"
                          inputMode="decimal"
                          aria-label={`Tối thiểu ô ${i + 1}`}
                          onChange={(e) => d.suaORieng(i, { min_value: e.target.value })}
                        />
                        <input
                          className="sx-in num"
                          value={f.max_value}
                          placeholder="max"
                          inputMode="decimal"
                          aria-label={`Tối đa ô ${i + 1}`}
                          onChange={(e) => d.suaORieng(i, { max_value: e.target.value })}
                        />
                      </span>
                    )}
                    {f.kind === 'text' && <span className="empty">—</span>}
                  </td>
                  <td className="c" style={{ width: 54 }}>
                    <input
                      type="checkbox"
                      checked={f.required}
                      aria-label={`Bắt buộc ô ${i + 1}`}
                      onChange={(e) => d.suaORieng(i, { required: e.target.checked })}
                    />
                  </td>
                  <td className="xcol">
                    <button
                      type="button"
                      className="x"
                      aria-label={`Bỏ ô ${f.label || i + 1}`}
                      onClick={() => d.boORieng(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sx-row">
          <button type="button" className="sx-chip add" onClick={d.themORieng}>
            ＋ Thêm ô
          </button>
          {nhap.fields.length === 0 && (
            <span className="mut">công đoạn này chưa có ô riêng</span>
          )}
        </div>
      </div>

      <div className="sx-blk">
        <h3>
          Mã lỗi của {chon.label}
          <span className="hint">dùng cho cả phế lẫn sửa lại</span>
        </h3>
        {nhap.defect_codes.length > 0 && (
          <table className="sx-mini">
            <thead>
              <tr>
                <th>Tên lỗi</th>
                <th>Mã</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {nhap.defect_codes.map((x, i) => (
                <tr key={x.id ?? `new-${i}`}>
                  <td>
                    <input
                      className="sx-in"
                      value={x.label}
                      aria-label={`Tên lỗi ${i + 1}`}
                      aria-invalid={x.label === '' || undefined}
                      onChange={(e) => d.suaMaLoi(i, { label: e.target.value })}
                    />
                  </td>
                  <td style={{ width: 150 }}>
                    <input
                      className="sx-in ma"
                      value={x.code}
                      readOnly={x.id !== null}
                      title={
                        x.id !== null
                          ? 'Mã đã dùng trong sổ — không đổi'
                          : 'Mã đi vào sổ, bất biến'
                      }
                      aria-label={`Mã lỗi ${i + 1}`}
                      aria-invalid={x.code === '' || undefined}
                      onChange={(e) => d.suaMaLoi(i, { code: e.target.value })}
                    />
                  </td>
                  <td className="xcol">
                    <button
                      type="button"
                      className="x"
                      aria-label={`Bỏ mã ${x.label || i + 1}`}
                      onClick={() => d.boMaLoi(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sx-row">
          <button type="button" className="sx-chip add" onClick={d.themMaLoi}>
            ＋ Thêm mã
          </button>
        </div>
        <div className="sx-fine" style={{ padding: '4px 0 0', border: 0 }}>
          + {d.data.shared_defect_codes.length} mã dùng chung:{' '}
          {d.data.shared_defect_codes.map((x) => x.label).join(' · ')}
        </div>
      </div>

      <div className="sx-blk">
        {chon.is_active ? (
          chon.doc_count > 0 ? (
            <span className="mut">
              Không ngừng dùng được: đã có {chon.doc_count} phiếu sản lượng. Muốn bỏ thì
              rút khỏi lộ trình.
            </span>
          ) : (
            <button
              type="button"
              className="lnk"
              onClick={() => d.ngungDung(false)}
              disabled={d.busy}
            >
              Ngừng dùng công đoạn này
            </button>
          )
        ) : (
          <button
            type="button"
            className="lnk"
            onClick={() => d.ngungDung(true)}
            disabled={d.busy}
          >
            Dùng lại công đoạn này
          </button>
        )}
      </div>
    </>
  )
}

function ThemCongDoanForm({ d }: { d: CongDoanCtx }) {
  const t = d.them!
  const trung = d.stages.some((s) => s.code === t.code)
  const why =
    t.label.trim() === ''
      ? 'Nhập tên công đoạn'
      : t.code === ''
        ? 'Mã trống'
        : !/^[a-z0-9_]+$/.test(t.code)
          ? 'Mã chỉ gồm chữ thường, số, gạch dưới'
          : trung
            ? `Mã "${t.code}" đã có`
            : null
  return (
    <>
      <div className="sx-mh">
        <b>Thêm công đoạn</b>
        <span>vào cuối danh mục</span>
      </div>
      <div className="sx-blk">
        <h3>Tên</h3>
        <input
          id="cd-them-ten"
          className="sx-in"
          style={{ width: '100%' }}
          value={t.label}
          placeholder="Kiểm tra chất lượng"
          aria-label="Tên công đoạn mới"
          onChange={(e) => d.doiThem({ label: e.target.value })}
        />
      </div>
      <div className="sx-blk">
        <h3>
          Mã<span className="hint">bất biến sau khi dùng — sổ tham chiếu bằng mã</span>
        </h3>
        <input
          id="cd-them-ma"
          className="sx-in ma"
          style={{ width: '100%' }}
          value={t.code}
          placeholder="kiem_tra"
          aria-label="Mã công đoạn mới"
          aria-invalid={trung || undefined}
          onChange={(e) => d.doiThem({ code: e.target.value })}
        />
      </div>
      <div className="sx-blk">
        <div className="sx-row">
          {why ? (
            <>
              <span className="sx-btn p" aria-disabled="true" role="button" tabIndex={0}>
                Thêm
              </span>
              <span className="sx-why">{why}</span>
            </>
          ) : (
            <button
              type="button"
              className="sx-btn p"
              onClick={d.taoCongDoan}
              aria-busy={d.busy || undefined}
            >
              {d.busy ? 'Đang thêm…' : 'Thêm'}
            </button>
          )}
          <button type="button" className="sx-btn" onClick={d.dongThem}>
            Huỷ
          </button>
        </div>
        <div className="sx-fine" style={{ padding: '6px 0 0', border: 0 }}>
          Công đoạn mới đếm theo <b>chi tiết</b>, chưa tổ nào nhận — khai ngay sau khi
          thêm.
        </div>
      </div>
    </>
  )
}
