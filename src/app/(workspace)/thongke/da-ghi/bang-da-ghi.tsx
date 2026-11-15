'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { isDraftStatus, parseSo, scaleKg, type SdgLine } from '@/lib/so-da-ghi'
import { productivity } from '@/lib/gio-cong'
import { oId, type NhomMa, type NhomPhieu, type SoDaGhiCtx } from './useSoDaGhi'
import { cx, fmt, fmtIn, gio, kgTxt } from './so-da-ghi.shared'

/**
 * LƯỚI SỔ ĐÃ GHI — hàng NGÀY (chỉ ở xem 7 ngày) → hàng PHIẾU → hàng MÃ HÀNG →
 * dòng sổ. Ô vàng (lớp .sx-dh như Bảng chi tiết) chỉ ở dòng còn sửa được; dòng
 * khoá là chữ thường, tooltip nói vì sao. 9 cột vừa 1.100px (bề rộng thật).
 *
 * Bản vẽ 14/11/2026 https://claude.ai/artifact/CUUfVcZxHQTmXXQqn3bfZ3 (duyệt
 * Q1–Q6; bước 1 = Q1·Q2·Q4·Q5): ngày đông nhất của xưởng 126 dòng / 4 công đoạn /
 * 5 phiếu — phiếu GẬP sẵn, đầu phiếu đủ nói công đoạn · lệnh · tổ · mã hàng · giờ
 * công · tổng để khỏi phải mở (chép Dynamics Route card journal); dòng gom dưới
 * hàng mã hàng nên bỏ cột Mã hàng.
 */
const COLS = 9

export function BangDaGhi({ d }: { d: SoDaGhiCtx }) {
  const { p, nhom } = d
  const officialLines = d.shown.filter((l) => !d.isDraftLine(l))
  const stages = new Set(officialLines.map((l) => l.stage))
  const motDonVi = stages.size <= 1
  const sumQty = officialLines.reduce((a, l) => a + l.qty, 0)
  const sumDefect = officialLines.reduce((a, l) => a + l.defect, 0)
  const sumKg = officialLines.reduce((a, l) => a + (l.kg ?? 0), 0)
  const docIds = new Set(officialLines.map((l) => l.doc_id).filter(Boolean))
  const gioCong = p.docs
    .filter((x) => docIds.has(x.id))
    .reduce((a, x) => a + (x.labor_hours ?? 0), 0)
  const ns = productivity(sumKg, gioCong || null)
  const nNhap = d.shown.length - officialLines.length

  return (
    <div className="sx-grid">
      <table className="sx-tb sx-dh sx-sdg">
        <colgroup>
          {/* Chi tiết 260 = ba cột đầu 402px chứa hai dòng đầu phiếu (công đoạn · lệnh · tổ). */}
          <col style={{ width: 260 }} />
          {/* Phải làm 76: chữ hoa "PHẢI LÀM" ở 66px bị cắt "PHẢI L…" (soi lệnh TEST 14/11). */}
          <col style={{ width: 76 }} />
          <col style={{ width: 66 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 54 }} />
          <col style={{ width: 62 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Chi tiết</th>
            <th className="r" title="SL SP × số chi tiết / SP — cùng số Hồ sơ lệnh">
              Phải làm
            </th>
            <th className="r" title="Đã làm chính thức tới nay ở công đoạn này">
              Đã làm
            </th>
            <th className="r">Đạt</th>
            <th className="r">Lỗi</th>
            <th className="r" title="Kg ghi lúc nhập (ĐM × đạt); sửa đạt thì kg đổi theo">
              Kg
            </th>
            <th>Người làm</th>
            <th>Lý do lỗi · ghi chú</th>
            <th className="c">Xoá</th>
          </tr>
        </thead>
        <tbody>
          {/* Xem 7 ngày: hàng NGÀY nay là bảng 7 ngày phía trên (Q6) — lưới chỉ bày
              ngày đang chọn, nên `nhom` có đúng một ngày. */}
          {nhom.map((g) =>
            g.phieu.map((ph) => (
              <Fragment key={ph.key}>
                <HangPhieu d={d} ph={ph} />
                {d.moPhieu(ph) &&
                  ph.ma.map((m) => (
                    <Fragment key={m.code ?? '—'}>
                      <HangMa m={m} chon={d.maDangChon(ph, m.code)} />
                      {m.lines.map((l) => (
                        <Dong key={l.id} d={d} l={l} />
                      ))}
                    </Fragment>
                  ))}
              </Fragment>
            )),
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              {fmt(d.shown.length)} dòng · chính thức {fmt(officialLines.length)}
              {nNhap > 0 && <span className="mut"> · nháp {fmt(nNhap)} không tính</span>}
            </td>
            <td className="r num">{motDonVi ? fmt(sumQty) : '—'}</td>
            <td className="r num">{sumDefect ? fmt(sumDefect) : ''}</td>
            <td className="r num">{kgTxt(sumKg)}</td>
            <td colSpan={COLS - 6}>
              {gioCong > 0 ? (
                <>
                  {fmt(gioCong)} giờ công
                  {ns != null && <> → {fmt(ns)} kg/giờ-người</>}
                </>
              ) : (
                <span className="mut">chưa có giờ công</span>
              )}
              {!motDonVi && (
                <span className="mut">
                  {' '}
                  · nhiều công đoạn: đạt không cộng dọc, kg cộng được
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Tổng đạt / lỗi / kg của một nhóm dòng — số SAU khi đã sửa thì chờ Lưu mới đổi. */
const tong = (lines: SdgLine[]) => ({
  qty: lines.reduce((a, l) => a + l.qty, 0),
  defect: lines.reduce((a, l) => a + l.defect, 0),
  kg: lines.reduce((a, l) => a + (l.kg ?? 0), 0),
})

/**
 * Đầu phiếu HAI dòng (Q1 + Q5): dòng 1 đậm "công đoạn · Lệnh … · tổ"; dòng 2 mờ
 * "mã hàng · n dòng · số phiếu · ca · giờ công". Tổng đạt / lỗi / kg đứng đúng cột.
 * Một phiếu = một lệnh × một công đoạn × một tổ, nên đạt cộng được (cùng đơn vị).
 */
function HangPhieu({ d, ph }: { d: SoDaGhiCtx; ph: NhomPhieu }) {
  const x = ph.doc
  const mo = d.moPhieu(ph)
  const t = tong(ph.lines)
  const nhap = x ? isDraftStatus(x.status) : false
  const khoa = ph.lines[0] ? d.why(ph.lines[0]) : null
  const hoi = x && d.phieuXoaCho === x.id
  const soat = ph.lines.filter((l) => d.flagOf(l.id).length > 0).length
  const stageLabel =
    x?.stage_label ?? d.p.stages.find((s) => s.code === ph.stage)?.label ?? ph.stage
  const maTxt =
    ph.ma.length === 1
      ? [ph.ma[0].code ?? '—', ph.ma[0].name].filter(Boolean).join(' ')
      : `${fmt(ph.ma.length)} mã hàng: ${ph.ma.map((m) => m.code ?? '—').join(' · ')}`
  const gioTxt = x
    ? [
        x.doc_no,
        x.shift ? `ca ${x.shift}` : null,
        x.labor_hours
          ? `${x.worker_count} CN × ${fmt(x.hours_per_worker ?? 0)} giờ`
          : 'chưa giờ công',
      ]
        .filter(Boolean)
        .join(' · ')
    : null
  // Dòng 2 bên TRÁI chỉ mã hàng + số dòng; số phiếu · ca · giờ công là dòng 2 bên
  // PHẢI — gộp một chỗ thì 402px cắt mất giờ công (soi lệnh TEST 14/11).
  const dong2 = `${maTxt} · ${fmt(ph.lines.length)} dòng`
  return (
    <tr className={cx('grp', 'ph', soat > 0 && 'soatp')}>
      <td colSpan={3} title={[dong2, gioTxt].filter(Boolean).join(' · ')}>
        <button
          type="button"
          className="tg"
          onClick={() => d.doiPhieu(ph)}
          aria-expanded={mo}
          aria-label={`${mo ? 'Gập' : 'Mở'} ${x?.doc_no ?? 'dòng lẻ'}`}
        >
          {mo ? '▾' : '▸'}
        </button>
        {x ? (
          <>
            {stageLabel} · Lệnh <span className="ma">{x.lsx_code}</span>
            {x.team_name && ` · ${x.team_name}`}
          </>
        ) : (
          <>
            {stageLabel} · <span className="mut">dòng lẻ trước khi có phiếu</span>
          </>
        )}
        <span className="l2">{dong2}</span>
      </td>
      <td className="r num">{fmt(t.qty)}</td>
      <td className="r num">{t.defect ? fmt(t.defect) : ''}</td>
      <td className="r num">{kgTxt(t.kg)}</td>
      <td colSpan={3} className="rt">
        {soat > 0 && <span className="warn">{fmt(soat)} cần soát · </span>}
        {x && (
          <>
            <i className={cx('sx-dot', nhap ? 'w' : 'g')} />
            {nhap ? 'NHÁP' : 'chính thức'}
            <span className="mut" style={{ fontWeight: 400 }}>
              {nhap && ' — chưa vào số'} · {gio(x.created_at)}
            </span>
            {nhap && !khoa && (
              <Link href={`/thongke/lsx/${x.lsx_id}?tab=phieu`} className="lnk">
                Ghi chính thức ›
              </Link>
            )}
            {/* Bản vẽ 14/11 (S1): ghi lại sau khi xoá dòng nhầm — đúng ngày, tổ, lệnh, công đoạn. */}
            {!x.lsx_closed && !(x.team_id && d.lockOf(x.team_id, x.entry_date)) && (
              <Link
                href={`/thongke/ghi?${new URLSearchParams({
                  lsx: x.lsx_id,
                  stage: x.stage,
                  date: x.entry_date,
                  ...(x.team_id ? { team: x.team_id } : {}),
                }).toString()}`}
                className="lnk"
              >
                Ghi thêm ›
              </Link>
            )}
            <a
              className="lnk mut"
              href={`/print/phieu-sx/${x.id}`}
              target="_blank"
              rel="noreferrer"
            >
              In
            </a>
            {!khoa && (d.p.can_all || x.created_by === d.p.me_id) && (
              <button
                type="button"
                className={cx('lnk', hoi ? 'stop' : 'mut')}
                onClick={() => void d.xoaPhieu(x)}
                disabled={d.busy}
              >
                {hoi ? 'Bấm lần nữa để xoá phiếu' : 'Xoá phiếu'}
              </button>
            )}
            {x.lsx_closed && <span className="mut"> · lệnh đã đóng — sổ khoá</span>}
            <span className="l2">{gioTxt}</span>
          </>
        )}
      </td>
    </tr>
  )
}

/** Hàng MÃ HÀNG trong phiếu (Q4): mã + tên SP + số dòng; tổng đứng đúng cột. */
function HangMa({ m, chon }: { m: NhomMa; chon: boolean }) {
  const t = tong(m.lines)
  const ten = [m.code ?? '—', m.name].filter(Boolean).join(' ')
  return (
    <tr className={cx('mh', chon && 'chon')}>
      <td colSpan={3} title={ten}>
        <span className="ma">{m.code ?? '—'}</span>
        {m.name && <> {m.name}</>}
        <span className="mut"> · {fmt(m.lines.length)} dòng</span>
      </td>
      <td className="r num">{fmt(t.qty)}</td>
      <td className="r num">{t.defect ? fmt(t.defect) : ''}</td>
      <td className="r num">{kgTxt(t.kg)}</td>
      <td colSpan={COLS - 6} />
    </tr>
  )
}

function Dong({ d, l }: { d: SoDaGhiCtx; l: SdgLine }) {
  const khoa = d.why(l)
  const f = d.flagOf(l.id)
  const nang = f.some((x) => x.kind === 'vuot_phai_lam' || x.kind === 'vuot_kha_dung')
  const dr = d.drafts[l.id] ?? {}
  const xoa = d.xoa.has(l.id)
  const hoi = d.xoaCho === l.id
  const chu = d.chu(l)
  const chan = d.chanO?.id === l.id ? d.chanO.field : null
  const qtyMoi = dr.qty != null ? parseSo(dr.qty) : l.qty
  const kg =
    qtyMoi != null && qtyMoi !== l.qty ? scaleKg(l.kg, l.qty, qtyMoi, l.dm_kg) : l.kg
  const doi = (k: 'qty' | 'defect' | 'worker' | 'text', goc: string) =>
    dr[k] != null && dr[k]!.trim() !== goc.trim()
  const tip =
    [...f.map((x) => `⚠ ${x.text}`), khoa].filter(Boolean).join('\n') || undefined

  const o = (
    k: 'qty' | 'defect' | 'worker' | 'text',
    goc: string,
    opt: { num?: boolean; ph?: string; label: string; max?: number },
  ) => {
    if (khoa)
      return (
        <td className={opt.num ? 'r num' : undefined} title={khoa}>
          {goc || <span className="empty">{opt.num ? '' : '—'}</span>}
        </td>
      )
    return (
      <td className={cx('ed', doi(k, goc) && 'chg', chan === k && 'err')}>
        <input
          id={oId(l.id, k)}
          className={cx('sx-cell', opt.num && 'num')}
          value={dr[k] ?? goc}
          placeholder={opt.ph}
          inputMode={opt.num ? 'decimal' : undefined}
          maxLength={opt.max}
          aria-label={`${opt.label} · ${l.name}`}
          aria-invalid={chan === k || undefined}
          onChange={(e) => d.setO(l.id, k, e.target.value)}
          disabled={xoa || d.taiLai}
        />
      </td>
    )
  }

  return (
    <tr
      id={`sdg-${l.id}`}
      className={cx(
        'd',
        xoa || hoi
          ? 'xoa xoa xoa'
          : f.length > 0 && (nang ? 'soat soat soat soat' : 'soatw soatw soatw soatw'),
      )}
      title={tip}
    >
      <td title={l.cluster ? `${l.cluster} · ${l.name}` : l.name}>
        {/* Dòng CỤM mang cluster = chính tên nó ("Cụm khung · Cụm khung") — khỏi lặp. */}
        {l.cluster && l.cluster !== l.name && <span className="mut">{l.cluster} · </span>}
        {l.name}
        {l.qty_per_unit != null && (
          <span className="mut num"> ×{fmt(l.qty_per_unit)}</span>
        )}
      </td>
      <td className={cx('r num', l.needed == null && 'empty')}>
        {l.needed == null ? '—' : fmt(l.needed)}
      </td>
      <td
        className={cx(
          'r num',
          l.done == null
            ? 'empty'
            : l.needed != null && l.done > l.needed
              ? 'stop'
              : l.needed != null && l.done >= l.needed && l.done > 0
                ? 'ok'
                : undefined,
        )}
      >
        {l.done == null ? '—' : fmt(l.done)}
      </td>
      {o('qty', fmtIn(l.qty), { num: true, label: 'Đạt' })}
      {o('defect', l.defect ? fmtIn(l.defect) : '', { num: true, label: 'Lỗi' })}
      <td className={cx('r num', kg == null && 'empty')}>
        {kg == null ? '—' : kgTxt(kg)}
      </td>
      {o('worker', l.worker, { label: 'Người làm', max: 100 })}
      {o('text', chu.goc, {
        label: chu.mode === 'ly_do' ? 'Lý do lỗi' : 'Ghi chú',
        ph: chu.mode === 'ly_do' ? 'lý do lỗi?' : '',
        max: 500,
      })}
      <td className="xo">
        {!khoa && (
          <button
            type="button"
            className={cx('sx-xo', (hoi || xoa) && 'hoi')}
            onClick={() => d.xinXoa(l.id)}
            disabled={d.taiLai}
            aria-label={
              xoa
                ? `Bỏ xoá dòng ${l.name}`
                : hoi
                  ? `Bấm lần nữa để xoá dòng ${l.name}`
                  : `Xoá dòng ${l.name}`
            }
            title={xoa ? 'Bỏ đánh dấu xoá' : hoi ? 'Bấm lần nữa để xoá' : 'Xoá dòng này'}
          >
            {xoa ? 'Bỏ xoá' : hoi ? 'Xoá?' : 'Xoá'}
          </button>
        )}
      </td>
    </tr>
  )
}
