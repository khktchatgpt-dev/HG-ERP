'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { COUNT_LEVEL_LABEL } from '@/lib/stage-config'
import { isFinishRowId } from '@/lib/finish-stages'
import { quyCachDong } from '@/lib/ghi-nhom'
import { tenCum } from '@/lib/ho-so-lenh'
import { khoaCum } from '@/lib/khoa-cum'
import { cellId, dmy, fmt, num, type EditCol, type Line } from './ghi.shared'
import type { GhiCtx } from './useGhi'

/**
 * Ghép lớp. KHÔNG dùng template string có khoảng trắng đầu (` r`): hook format
 * (sắp lớp Tailwind) LỘT khoảng trắng trong chuỗi mẫu → "edr", "nummut" (dính
 * 03/11/2026).
 */
const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

/**
 * LƯỚI GHI — bản gọn 12/11/2026 (https://claude.ai/artifact/6j48VVVcNEvMie7iNnbd3v,
 * Q1–Q9 duyệt). Chủ dự án: "thống kê không biết phải làm SL bao nhiêu, nhập ở đâu".
 *
 * - Hai nhóm cột: "LỆNH NÀY" (Phải làm · [Khả dụng] · Đã làm · Còn lại · [14
 *   ngày]) chỉ để XEM, và "HÔM NAY TỔ LÀM ĐƯỢC — GÕ VÀO Ô VÀNG". Ô gõ nền vàng
 *   có viền — quy ước "vàng = nhập tay" của chính file Excel thống kê (đo trước
 *   đó: ô gõ và ô xem cùng nền, viền 0px).
 * - Cột trống cả cột thì ẩn (Q3): Khả dụng ở công đoạn đầu, 14 ngày khi chưa ai
 *   ghi trong 14 ngày.
 * - Ô Lý do chỉ mở trên dòng có phế / sửa lại (Q4); ô Đạt không còn số mờ.
 * - Mỗi dòng là một chi tiết của MÃ HÀNG cho cả lệnh (gom đợt, Q1) — gõ số thì
 *   nhãn xanh trên dòng nói số sẽ chia vào đợt nào.
 */
export function LuoiGhi({ d }: { d: GhiCtx }) {
  const { sheet, cols, rows } = d
  const level = sheet.stage_cfg.count_level
  const tenCot1 =
    level === 'part' ? 'Chi tiết' : level === 'cluster' ? 'Cụm' : 'Thành phẩm'
  // Q10 bản vẽ 12/11: nhóm ĐỊNH MỨC — SL / SP · quy cách · kg / chi tiết; cột trống
  // cả cột thì ẩn (SL / SP luôn có). Cột Quy cách CO theo chuỗi dài nhất đang bày
  // (mono 12px ≈ 7,2px/ký tự + 16 đệm, đo thật 12/11): Phôi cần "20×80×1100·1,2",
  // Sơn chỉ "5×555×865"; tối thiểu 80 cho chữ tiêu đề "QUY CÁCH".
  const qcLen = rows.reduce((m, { l }) => Math.max(m, quyCachDong(l.spec).length), 0)
  const qcW = Math.min(134, Math.max(80, Math.ceil(qcLen * 7.2) + 16))
  const dmW = [SL_SP_W, ...(d.cotQuyCach ? [qcW] : []), ...(d.cotKgCt ? [52] : [])]
  // Tiêu đề đo thật 12/11: "KHẢ DỤNG" 64 + 16 đệm, "ĐÃ LÀM" 48 + 16 — bảng ở đúng
  // bề rộng tối thiểu (không giãn) thì 78 / 62 cắt mất 1px.
  const xemW = [74, ...(d.cotKhaDung ? [80] : []), 64, 66, ...(d.cot14 ? [100] : [])]
  // "×n" đã sang cột SL / SP → tên không cần 184 nữa: "Cùi nối ngang mê trước" vừa,
  // "Cụm mê · Nan liên kết…" cần 169 (đo 12/11).
  const nameW = 172
  const minW =
    nameW +
    dmW.reduce((a, b) => a + b, 0) +
    xemW.reduce((a, b) => a + b, 0) +
    cols.reduce((a, c) => a + c.width, 0)
  const nCols = 1 + dmW.length + xemW.length + cols.length

  return (
    <div className="sx-grid">
      {/* Chữ ẩn đặt ĐẦU khung cuộn: để ở cuối thì span absolute nằm dưới đáy 140 dòng,
          kéo dài cả tài liệu → trang có thanh cuộn dọc thừa, bảng hẹp đi 15px. */}
      <span className="sr-only">Đếm bằng {COUNT_LEVEL_LABEL[level]}</span>
      <table className="sx-tb sx-gh" style={{ minWidth: minW }}>
        <colgroup>
          <col style={{ width: nameW }} />
          {dmW.map((w, i) => (
            <col key={`d${i}`} style={{ width: w }} />
          ))}
          {xemW.map((w, i) => (
            <col key={`x${i}`} style={{ width: w }} />
          ))}
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="gh">
            <th className="lenh" />
            {/* Chỉ còn cột SL / SP (48px) thì chữ "ĐỊNH MỨC" 75px không vừa → "ĐM". */}
            <th className="dm" colSpan={dmW.length} title="Định mức">
              {dmW.length > 1 ? 'Định mức' : 'ĐM'}
            </th>
            <th className="lenh" colSpan={xemW.length}>
              Lệnh này
            </th>
            <th
              className="hom"
              colSpan={cols.length}
              title="Enter xuống dòng · Ctrl+V dán vùng từ Excel · bấm số ở cột Còn lại để điền đủ"
            >
              Hôm nay tổ làm được — gõ vào ô vàng
            </th>
          </tr>
          <tr className="cl">
            <th>{tenCot1}</th>
            <th
              className="r"
              title="Số lượng trên 1 sản phẩm: chi tiết / SP ở dòng chi tiết, cụm / SP ở dòng cụm — như cột CT/SP của file thống kê"
            >
              SL<span className="u">/ SP</span>
            </th>
            {d.cotQuyCach && (
              <th title="Dày × rộng × dài (mm) · độ dày thành — theo định mức hồ sơ SP">
                Quy cách
                <span className="u">
                  {qcW >= 110 ? 'dày×rộng×dài·thành' : 'dày×rộng×dài'}
                </span>
              </th>
            )}
            {d.cotKgCt && (
              <th className="r" title="Định mức kg của MỘT chi tiết">
                Kg<span className="u">/ chi tiết</span>
              </th>
            )}
            <th className="r">Phải làm</th>
            {d.cotKhaDung && (
              <th
                className="r"
                title="Đã nhận từ công đoạn trước − đã ghi ở đây (đạt + phế + sửa)"
              >
                Khả dụng
              </th>
            )}
            <th className="r">Đã làm</th>
            <th className="r" title="Bấm số để điền đủ phần còn lại vào ô Đạt">
              Còn lại
            </th>
            {d.cot14 && (
              <th title="Số đã ghi mỗi ngày ở công đoạn này (mọi phiếu), cũ → hôm nay">
                14 ngày
              </th>
            )}
            {cols.map((c) => (
              <th key={c.key} className={cx('hn', c.kind === 'num' && 'r')}>
                {c.label}
                {c.required ? ' *' : ''}
                {/* Dòng phụ: "Lỗi · hỏng" — chủ dự án 12/11 không thấy chỗ ghi hàng lỗi. */}
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
          {rows.map(({ g, l }, rIdx) => {
            const prev = rIdx > 0 ? rows[rIdx - 1] : null
            const newSp = !prev || prev.g.order_line_id !== g.order_line_id
            // Đầu nhóm cụm chỉ khi công đoạn đếm CHI TIẾT và mã hàng có khai cụm.
            const hasCum = level === 'part' && g.lines.some((x) => x.cluster)
            const inCum = hasCum && l.kind !== 'assembly'
            const newCum =
              inCum && (newSp || khoaCum(prev?.l.cluster) !== khoaCum(l.cluster))
            return (
              <Fragment key={l.component_id}>
                {/* Đang chọn MỘT mã hàng: thông tin mã nằm ở thanh chọn mã (Q11). */}
                {newSp && !d.motMa && <DauSp d={d} g={g} nCols={nCols} />}
                {newCum && <DauCum d={d} g={g} cluster={l.cluster} nCols={nCols} />}
                <Dong d={d} g={g} l={l} rIdx={rIdx} inCum={inCum} />
              </Fragment>
            )
          })}
        </tbody>
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
    </div>
  )
}

type Grp = GhiCtx['rows'][number]['g']

/** Cột SL / SP: chữ "SL" + dòng phụ "/ SP"; số 1–3 chữ số ("11", "0,5"). */
const SL_SP_W = 48

const dm = (iso: string) => dmy(iso).slice(0, 5)

/**
 * Đầu nhóm MÃ HÀNG (Q2, Q9): mã · tên · PHẢI LÀM bao nhiêu · mấy đợt · đủ bao
 * nhiêu bộ ở công đoạn này · hạn công đoạn (từ Giao tổ & hạn). "Thiếu …" chỉ
 * nói khi đã có chi tiết bắt đầu làm — lúc mọi thứ là 0 thì câu đó vô nghĩa.
 */
function DauSp({ d, g, nCols }: { d: GhiCtx; g: Grp; nCols: number }) {
  return (
    <tr className="grp">
      <td colSpan={nCols} title={`${g.product_code} · ${g.product_name}`}>
        <span className="ma">{g.product_code}</span> · {g.product_name}
        <ThongTinMa d={d} g={g} />
      </td>
    </tr>
  )
}

/** "phải làm 372 cái · 5 đợt · đủ 0/372 bộ · hạn phôi: …" — đầu nhóm và thanh chọn mã dùng chung. */
export function ThongTinMa({ d, g, lead = true }: { d: GhiCtx; g: Grp; lead?: boolean }) {
  const db = d.nhom.sp.get(g.order_line_id)
  const stage = d.sheet.stage_label.toLowerCase()
  const daLam = g.lines.some((x) => x.done > 0)
  return (
    <>
      <span className="mut" style={{ fontWeight: 400 }}>
        {lead ? ' · ' : ''}phải làm{' '}
      </span>
      <b className="num">{fmt(g.qty)}</b> {g.unit}
      <span className="mut" style={{ fontWeight: 400 }}>
        {g.dots > 1 && <> · {g.dots} đợt</>}
        {db?.sets != null && (
          <>
            {' '}
            · đủ <b className={db.sets >= g.qty ? 'num ok' : 'num'}>{fmt(db.sets)}</b>/
            {fmt(g.qty)} bộ
            {daLam && db.short.length > 0 && (
              <> · thiếu {db.short.slice(0, 3).join(', ')}</>
            )}
          </>
        )}{' '}
        · hạn {stage}:{' '}
        {g.han ? (
          <>
            {g.han.end ? (
              <b className={g.han.end < d.sheet.today ? 'stop' : undefined}>
                {dm(g.han.end)}
              </b>
            ) : (
              <span className="warn">chưa đặt</span>
            )}
            {g.han.teams.length > 0 && <> · {g.han.teams.join(', ')}</>}
          </>
        ) : (
          'chưa giao'
        )}
      </span>
    </>
  )
}

/** Đầu nhóm CỤM — số chi tiết + số bộ đủ của cụm ở công đoạn này. */
function DauCum({
  d,
  g,
  cluster,
  nCols,
}: {
  d: GhiCtx
  g: Grp
  cluster: string | null
  nCols: number
}) {
  const c = cluster ? d.nhom.cum.get(`${g.order_line_id}|${khoaCum(cluster)}`) : null
  return (
    <tr className="grp2">
      <td colSpan={nCols}>
        {cluster ?? 'Chi tiết rời'}
        {c && (
          <span className="mut">
            {' '}
            · {c.n} chi tiết
            {c.sets != null && (
              <>
                {' '}
                · đủ <b className="num">{fmt(c.sets)}</b> bộ
              </>
            )}
          </span>
        )}
      </td>
    </tr>
  )
}

/** Dải 14 ngày — CHỈ ĐỌC (ghi vẫn qua phiếu); như các cột ngày của sheet CD_*. */
function DaiNgay({ days }: { days: Line['days'] }) {
  if (days.length === 0) return <span className="empty">·</span>
  const max = Math.max(1, ...days.map((x) => x.qty))
  const tip =
    days
      .filter((x) => x.qty > 0)
      .map((x) => `${dm(x.date)}: ${fmt(x.qty)}${x.docs > 1 ? ` · ${x.docs} phiếu` : ''}`)
      .join(' · ') || 'Chưa ai ghi trong 14 ngày'
  return (
    <span className="sx-d14" title={tip}>
      {[...days]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((x, i) => (
          <i
            key={x.date}
            className={cx(x.qty <= 0 && 'z', i === days.length - 1 && 't') || undefined}
            style={{
              height: x.qty > 0 ? Math.max(2, Math.round((x.qty / max) * 16)) : 1,
            }}
          />
        ))}
    </span>
  )
}

function Dong({
  d,
  g,
  l,
  rIdx,
  inCum,
}: {
  d: GhiCtx
  g: Grp
  l: Line
  rIdx: number
  /** Dòng nằm dưới đầu nhóm cụm → thụt vào, bỏ tên cụm trước tên chi tiết. */
  inCum: boolean
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
  // Có SL mà không có ĐM kg → ô Kg nói thẳng: phiếu sẽ thiếu đúng dòng này ở kg.
  const noDm = l.dm_kg == null && qty > 0 && !(draft.kg ?? '').trim()
  const sug = d.suggestedSet.has(l.component_id)
  // Ô Lý do chỉ mở khi dòng có phần không đạt (Q4) — hoặc đã có chữ từ trước.
  const coLoi = defect > 0 || rework > 0 || !!(draft.reason ?? '').trim()
  const chia = d.chiaCua(l)
  const realId = l.parts[0]?.component_id ?? l.component_id

  return (
    <tr className={cx('d', sug && 'sug', inCum && 't2')}>
      <td
        title={`${g.product_code} · ${l.cluster ? `${l.cluster} · ` : ''}${l.name}${l.unit ? ` · ĐVT ${l.unit}` : ''}${l.dm_kg != null ? ` · ĐM ${fmt(l.dm_kg)} kg` : ''}`}
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
        {l.cluster && !isSet && !inCum && <span className="mut">{l.cluster} · </span>}
        {/* Cụm: bỏ đuôi "(mặc nhiên)" như Hồ sơ lệnh (tên đủ ở tooltip). Số / SP nằm
            ở cột SL / SP; dòng cụm nói thêm số chi tiết trong cụm. */}
        <b>{isSet ? tenCum(l.name) : l.name}</b>
        {isSet && l.cum_ct != null && l.cum_ct > 0 && (
          <span className="dmb">{l.cum_ct} chi tiết</span>
        )}
        {l.is_virtual && isFinishRowId(realId) && <span className="pill m">bộ</span>}
        {chia && (
          <span className="pill b" title="Số đạt tự chia cho đợt xuất sớm trước">
            {chia}
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
        className={cx('r num', l.cum_khai === false && 'warn')}
        title={
          l.cum_khai === false
            ? 'Kỹ thuật chưa khai SL cụm / SP — máy tạm tính 1 (khai ở Hồ sơ SP › Định mức › Khai cụm)'
            : isSet
              ? 'Số cụm trên 1 SP'
              : 'Số chi tiết trên 1 SP'
        }
      >
        {l.qty_per_unit != null ? fmt(l.qty_per_unit) : ''}
      </td>
      {d.cotQuyCach && (
        <td className="num qc" title={quyCachDong(l.spec) || undefined}>
          {quyCachDong(l.spec)}
        </td>
      )}
      {d.cotKgCt && (
        <td className="r num mut">
          {l.dm_kg != null ? fmt(Math.round(l.dm_kg * 1000) / 1000) : ''}
        </td>
      )}
      <td
        className="r num"
        title={
          l.qty_per_unit != null
            ? `${fmt(g.qty)} SP × ${fmt(l.qty_per_unit)} = ${fmt(l.needed)}`
            : undefined
        }
      >
        {fmt(l.needed)}
      </td>
      {d.cotKhaDung && (
        <td
          className={cx(
            'r num',
            l.available == null ? 'mut' : l.available <= 0 && 'empty',
          )}
          title={
            l.available == null
              ? 'Đầu lộ trình — đầu vào từ kho / NCC, không có khái niệm nhận'
              : undefined
          }
        >
          {l.available == null ? '·' : fmt(l.available)}
        </td>
      )}
      <td className={cx('r num', l.done === 0 && 'empty')}>
        {l.done === 0 ? '·' : fmt(l.done)}
      </td>
      <td className="r num con">
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
      {d.cot14 && (
        <td>
          <DaiNgay days={l.days} />
        </td>
      )}
      {cols.map((c, cIdx) => {
        const id = cellId(l.component_id, c.key)
        const err = d.errCells.has(id)
        const warn = c.key === 'qty' && (overRemaining || overAvail)
        if (c.key === 'reason' && !coLoi) {
          return <td key={c.key} className="ed off" />
        }
        const title =
          c.key === 'qty' && overAvail
            ? `Vượt khả dụng (${fmt(l.available ?? 0)}) — vẫn ghi được, có thể xưởng chưa lập phiếu giao`
            : c.key === 'qty' && overRemaining
              ? `Vượt phần còn thiếu (${fmt(l.remaining)}) — vẫn ghi được, kiểm lại cho chắc`
              : c.key === 'qty' && kgHint
                ? `= ${fmt(Number(kgHint))} kg (ĐM × SL)`
                : c.key === 'kg' && kgHint
                  ? `Bỏ trống = tự tính ${kgHint} kg (ĐM × SL)`
                  : c.key === 'kg' && noDm
                    ? 'Chi tiết chưa có ĐM kg — gõ kg cân thật, hoặc để trống (dòng không vào kg)'
                    : err
                      ? 'Ô bắt buộc trên dòng đã gõ'
                      : undefined
        const placeholder =
          c.key === 'kg'
            ? noDm
              ? 'thiếu ĐM'
              : kgHint
            : c.key === 'reason'
              ? 'vì sao?'
              : err
                ? 'bắt buộc'
                : undefined
        return (
          <td
            key={c.key}
            className={cx(
              'ed',
              c.kind === 'num' && 'r',
              err ? 'err' : warn && 'warn',
              c.key === 'kg' && noDm && 'nodm',
            )}
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
 * đổi từ ngoài (nút Còn lại, dán, khôi phục) ô cập nhật mà không cần effect.
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
        className={cx('sx-cell', p.value && 'has')}
        value={p.value}
        onChange={(e) => p.onCommit(e.target.value)}
        disabled={p.disabled}
        data-cell={p.cell}
        onKeyDown={p.onKeyDown}
        aria-label={p.ariaLabel}
      >
        <option value="">{p.placeholder ?? ''}</option>
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
      className={cx('sx-cell', c.kind === 'num' && 'num', v && 'has')}
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
