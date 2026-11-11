'use client'

import { useState, type ReactNode } from 'react'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import { isFinishRowId } from '@/lib/finish-stages'
import { cellId, fmt, num, type EditCol, type Line } from './ghi.shared'
import type { GhiCtx } from './useGhi'

/**
 * Ghép lớp. KHÔNG dùng template string có khoảng trắng đầu (` r`): hook format
 * (sắp lớp Tailwind) LỘT khoảng trắng trong chuỗi mẫu → "edr", "nummut" (dính
 * 03/11/2026).
 */
const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

/**
 * LƯỚI GHI — một bảng dính đầu/chân, cột đổi theo cấu hình công đoạn.
 *
 * Cột cố định: Dòng · SP · Cần · Khả dụng · Đã <công đoạn> · Còn. Cột gõ:
 * `d.cols` (SL đạt · Phế · Sửa lại · Lý do · ô riêng · Người làm · Kg · Ghi
 * chú — hiện/ẩn/bắt buộc theo C1). Ô vượt → nền vàng (cảnh báo); ô bắt buộc
 * còn trống trên dòng đã gõ → nền đỏ (chặn, thanh chốt chỉ tới).
 */
export function LuoiGhi({ d }: { d: GhiCtx }) {
  const { sheet, cols, rows } = d
  const level = sheet.stage_cfg.count_level
  const tenCot1 =
    level === 'part' ? 'Chi tiết' : level === 'cluster' ? 'Cụm' : 'Thành phẩm'
  // 11/11/2026: cột "Đã <công đoạn>" 62 → 70 (tiêu đề "Đã phôi" bị cắt); các cột
  // chữ tự do bên ghi.shared co lại để Phôi (nhiều ô riêng nhất) vừa 1.200px.
  const fixedW = [196, 112, 58, 78, 70, 58]
  const minW = fixedW.reduce((a, b) => a + b, 0) + cols.reduce((a, c) => a + c.width, 0)
  const nCols = fixedW.length + cols.length

  return (
    <div className="sx-grid">
      <table className="sx-tb" style={{ minWidth: minW }}>
        <colgroup>
          {fixedW.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>{tenCot1}</th>
            <th>SP</th>
            <th className="r">Cần</th>
            <th
              className="r"
              title="Đã nhận từ công đoạn trước − đã ghi ở đây (đạt + phế + sửa)"
            >
              Khả dụng<span className="u">nhận − đã ghi</span>
            </th>
            <th className="r">Đã {sheet.stage_label.toLowerCase()}</th>
            <th className="r">Còn</th>
            {cols.map((c) => (
              <th key={c.key} className={c.kind === 'num' ? 'r' : undefined}>
                {c.label}
                {c.required && c.key !== 'qty' ? ' *' : c.key === 'qty' ? ' *' : ''}
                {c.hint && <span className="u">{c.hint}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={nCols}
                className="mut"
                style={{ height: 60, textAlign: 'center' }}
              >
                {d.chiGoiY
                  ? 'Tổ đang chọn chưa được gợi ý dòng nào — tắt "Dòng gợi ý" để thấy mọi dòng'
                  : 'Công đoạn này chưa có dòng nào trong lệnh'}
              </td>
            </tr>
          )}
          {rows.map(({ g, l }, rIdx) => (
            <Dong key={l.component_id} d={d} g={g} l={l} rIdx={rIdx} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6}>Sắp ghi {d.typed.length} dòng</td>
            {cols.map((c) => (
              <td key={c.key} className={c.kind === 'num' ? 'r num' : undefined}>
                {c.key === 'qty'
                  ? fmt(d.typedQty)
                  : c.key === 'defect'
                    ? fmt(d.typedDefect)
                    : c.key === 'rework'
                      ? fmt(d.typedRework)
                      : ''}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {/* Gợi ý lý do: danh mục công đoạn trước, lý do gõ gần đây sau. */}
      <datalist id="defect-reasons">
        {d.pickableCodes.map((c) => (
          <option key={c.code} value={c.label} />
        ))}
        {sheet.recent_defect_reasons
          .filter((r) => !d.codeByLabel.has(r.toLowerCase()))
          .map((r) => (
            <option key={r} value={r} />
          ))}
      </datalist>
      <span className="sr-only">Đếm bằng {COUNT_LEVEL_LABEL[level]}</span>
    </div>
  )
}

function Dong({
  d,
  g,
  l,
  rIdx,
}: {
  d: GhiCtx
  g: GhiCtx['rows'][number]['g']
  l: Line
  rIdx: number
}) {
  const { sheet, cols } = d
  const can = sheet.can_record
  const draft = d.draftOf(l.component_id)
  const qty = num(draft.qty)
  const defect = num(draft.defect)
  const rework = num(draft.rework)
  const adding = qty + defect + rework
  const overRemaining = l.remaining > 0 && qty + defect > l.remaining
  const overAvail = l.available != null && adding > 0 && adding > l.available
  const isSet = l.kind === 'assembly'
  const kgHint =
    l.dm_kg != null && qty > 0 ? String(Math.round(l.dm_kg * qty * 100) / 100) : ''
  const sug = d.suggestedSet.has(l.component_id)

  return (
    <tr className={cx('d', sug && 'sug')}>
      <td
        title={`${l.cluster ? `${l.cluster} · ` : ''}${l.name}${l.unit ? ` · ĐVT ${l.unit}` : ''}`}
      >
        {sug && (
          <span
            className="lnk"
            style={{ textDecoration: 'none', marginRight: 4 }}
            title="Hệ gợi ý: tổ đang cầm hàng / ghi gần đây"
          >
            ●
          </span>
        )}
        {l.cluster && !isSet && <span className="mut">{l.cluster} · </span>}
        <b>{l.name}</b>
        {l.is_virtual && (
          <span className="pill m">
            {isFinishRowId(l.component_id) ? 'bộ' : 'mặc nhiên'}
          </span>
        )}
        {l.today_qty > 0 && (
          <span className="pill b" title="Đã ghi hôm nay (mọi phiếu) — tránh gõ đúp">
            +{fmt(l.today_qty)} hôm nay
          </span>
        )}
        {l.pending > 0 && <span className="pill m">chờ +{fmt(l.pending)}</span>}
      </td>
      <td
        className="ma"
        title={`${g.product_code} · ${g.product_name} · ${fmt(g.qty)} ${g.unit}`}
      >
        {g.product_code}
      </td>
      <td className="r num">{fmt(l.needed)}</td>
      <td
        className={cx('r num', l.available == null ? 'mut' : l.available <= 0 && 'empty')}
        title={
          l.available == null
            ? 'Đầu lộ trình — đầu vào từ kho / NCC, không có khái niệm nhận'
            : undefined
        }
      >
        {l.available == null ? '—' : fmt(l.available)}
      </td>
      <td className={cx('r num', l.done === 0 && 'empty')}>{fmt(l.done)}</td>
      <td className="r num">
        {l.remaining <= 0 ? (
          <span className="ok">đủ</span>
        ) : can ? (
          <button
            type="button"
            className="lnk num"
            onClick={() => d.patch(l.component_id, 'qty', String(l.remaining))}
            title={`Điền ${fmt(l.remaining)} còn lại cho ${l.name}`}
          >
            {fmt(l.remaining)}
          </button>
        ) : (
          fmt(l.remaining)
        )}
      </td>
      {cols.map((c, cIdx) => {
        const id = cellId(l.component_id, c.key)
        const err = d.errCells.has(id)
        const warn = c.key === 'qty' && (overRemaining || overAvail)
        const title =
          c.key === 'qty' && overAvail
            ? `Vượt khả dụng (${fmt(l.available ?? 0)}) — vẫn ghi được, có thể xưởng chưa lập phiếu giao`
            : c.key === 'qty' && overRemaining
              ? `Vượt phần còn thiếu (${fmt(l.remaining)}) — vẫn ghi được, kiểm lại cho chắc`
              : c.key === 'kg' && kgHint
                ? `Bỏ trống = tự tính ${kgHint} kg (ĐM × SL)`
                : err
                  ? 'Ô bắt buộc trên dòng đã gõ'
                  : undefined
        const placeholder =
          c.key === 'qty' && l.remaining > 0
            ? fmt(l.remaining)
            : c.key === 'kg'
              ? kgHint
              : c.key === 'reason'
                ? 'vì sao?'
                : err
                  ? 'bắt buộc'
                  : undefined
        return (
          <td
            key={c.key}
            className={cx('ed', c.kind === 'num' && 'r', err ? 'err' : warn && 'warn')}
            title={title}
          >
            <O
              id={id}
              col={c}
              value={draft[c.key] ?? ''}
              onCommit={(v) => d.patch(l.component_id, c.key, v)}
              disabled={!can}
              placeholder={placeholder}
              cell={`${rIdx}:${cIdx}`}
              onKeyDown={d.onCellKey(rIdx, cIdx)}
              onPaste={d.onCellPaste(rIdx, cIdx)}
              ariaLabel={`${c.label} ${l.name}`}
            />
          </td>
        )
      })}
    </tr>
  )
}

/**
 * Một ô gõ: giữ chữ tại chỗ, CHỐT lúc rời ô. `key` theo `value` để khi giá trị
 * đổi từ ngoài (nút Còn, dán, khôi phục) ô cập nhật mà không cần effect.
 */
function O(p: {
  id: string
  col: EditCol
  value: string
  onCommit: (v: string) => void
  disabled: boolean
  placeholder?: string
  cell: string
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  ariaLabel: string
}): ReactNode {
  return <OInner key={p.value} {...p} />
}

function OInner(p: Parameters<typeof O>[0]) {
  const [v, setV] = useState(p.value)
  const c = p.col
  if (c.kind === 'select') {
    return (
      <select
        id={p.id}
        className="sx-cell"
        value={p.value}
        onChange={(e) => p.onCommit(e.target.value)}
        disabled={p.disabled}
        data-cell={p.cell}
        onKeyDown={p.onKeyDown}
        aria-label={p.ariaLabel}
      >
        <option value="">{p.placeholder ?? '—'}</option>
        {(c.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }
  return (
    <input
      id={p.id}
      className={cx('sx-cell', c.kind === 'num' && 'num')}
      type="text"
      inputMode={c.kind === 'num' ? 'decimal' : undefined}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== p.value) p.onCommit(v)
      }}
      disabled={p.disabled}
      placeholder={p.placeholder}
      list={c.key === 'reason' ? 'defect-reasons' : undefined}
      data-cell={p.cell}
      onKeyDown={p.onKeyDown}
      onPaste={p.onPaste}
      aria-label={p.ariaLabel}
      // Lăn chuột trên ô số đang focus KHÔNG được đổi giá trị — ô là `text`.
    />
  )
}
