'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { isDraftStatus, parseSo, scaleKg, type SdgLine } from '@/lib/so-da-ghi'
import { productivity } from '@/lib/gio-cong'
import { oId, type NhomPhieu, type SoDaGhiCtx } from './useSoDaGhi'
import { cx, dm, fmt, fmtIn, gio, kgTxt, thuDai } from './so-da-ghi.shared'

/**
 * LƯỚI SỔ ĐÃ GHI — hàng NGÀY (chỉ ở xem 7 ngày) → hàng PHIẾU → dòng sổ. Ô vàng
 * (lớp .sx-dh như Bảng chi tiết) chỉ ở dòng còn sửa được; dòng khoá là chữ
 * thường, tooltip nói vì sao. 10 cột vừa 1.100px (bề rộng thật).
 */
const COLS = 10

export function BangDaGhi({ d }: { d: SoDaGhiCtx }) {
  const { p, nhom } = d
  const tuan = p.xem === 'tuan'
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
  // Năng suất chỉ tính phiếu NGÀY — kg đầu kỳ là luỹ kế, không có giờ công (Q4 bản vẽ 14/11).
  const kgNgay = officialLines.filter((l) => !l.dau_ky).reduce((a, l) => a + (l.kg ?? 0), 0)
  const ns = productivity(kgNgay, gioCong || null)
  const nNhap = d.shown.length - officialLines.length
  const nDauKy = officialLines.filter((l) => l.dau_ky).length

  return (
    <div className="sx-grid">
      <table className="sx-tb sx-dh sx-sdg">
        <colgroup>
          <col style={{ width: 112 }} />
          <col style={{ width: 172 }} />
          <col style={{ width: 66 }} />
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
            <th>Mã hàng</th>
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
          {nhom.map((g) => {
            const mo = !tuan || d.ngayMo.has(g.date)
            return (
              <Fragment key={g.date}>
                {tuan && <HangNgay d={d} date={g.date} phieu={g.phieu} mo={mo} />}
                {mo &&
                  g.phieu.map((ph) => (
                    <Fragment key={ph.key}>
                      <HangPhieu d={d} ph={ph} />
                      {!d.phieuGap.has(ph.key) &&
                        ph.lines.map((l, i) => (
                          <Dong
                            key={l.id}
                            d={d}
                            l={l}
                            maHien={i === 0 || ph.lines[i - 1].product_code !== l.product_code}
                          />
                        ))}
                    </Fragment>
                  ))}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              {fmt(d.shown.length)} dòng · chính thức {fmt(officialLines.length)}
              {nNhap > 0 && <span className="mut"> · nháp {fmt(nNhap)} không tính</span>}
              {nDauKy > 0 && (
                <span className="mut"> · đầu kỳ {fmt(nDauKy)} không tính năng suất</span>
              )}
            </td>
            <td className="r num">{motDonVi ? fmt(sumQty) : '—'}</td>
            <td className="r num">{sumDefect ? fmt(sumDefect) : ''}</td>
            <td className="r num">{kgTxt(sumKg)}</td>
            <td colSpan={COLS - 7}>
              {gioCong > 0 ? (
                <>
                  {fmt(gioCong)} giờ công
                  {ns != null && <> → {fmt(ns)} kg/giờ-người</>}
                </>
              ) : (
                <span className="mut">chưa có giờ công</span>
              )}
              {!motDonVi && (
                <span className="mut"> · nhiều công đoạn: đạt không cộng dọc, kg cộng được</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function HangNgay({
  d,
  date,
  phieu,
  mo,
}: {
  d: SoDaGhiCtx
  date: string
  phieu: NhomPhieu[]
  mo: boolean
}) {
  const lock = d.lockOf(d.p.team_id, date)
  const lines = phieu.flatMap((x) => x.lines)
  const kg = lines.filter((l) => !d.isDraftLine(l)).reduce((a, l) => a + (l.kg ?? 0), 0)
  // Ngày chỉ có phiếu ĐẦU KỲ: không thuộc sổ ngày nào — không nhắc chốt, không "ghi thêm".
  const chiDauKy = lines.length > 0 && lines.every((l) => l.dau_ky)
  return (
    <tr className="grp ngay">
      <td colSpan={6}>
        <button
          type="button"
          className="tg"
          onClick={() => d.doiNgay(date)}
          aria-expanded={mo}
          aria-label={`${mo ? 'Gập' : 'Mở'} ngày ${dm(date)}`}
        >
          {mo ? '▾' : '▸'}
        </button>
        {thuDai(date)} {dm(date)}
        {chiDauKy ? (
          <span className="mut"> · đầu kỳ, không cần chốt</span>
        ) : (
          d.p.team_id && (
            <span className="mut">
              {' '}
              · <i className={cx('sx-dot', lock ? 'b' : 'w')} />
              {lock ? `đã chốt ${gio(lock.at)}${lock.by ? ` · ${lock.by}` : ''}` : 'chưa chốt'}
            </span>
          )
        )}
      </td>
      <td colSpan={4} className="rt">
        {fmt(phieu.length)} phiếu · {fmt(lines.length)} dòng · {kgTxt(kg)} kg
        {d.p.team_id && !chiDauKy && !lock && (
          <Link href={`/thongke/ghi?date=${date}&team=${d.p.team_id}`} className="lnk">
            Ghi thêm ngày này ›
          </Link>
        )}
        {d.p.team_id && !chiDauKy && (
          <Link href={`/thongke/ngay?date=${date}`} className="lnk">
            {lock ? 'Sửa: mở khoá ở Sổ ngày ›' : 'Chốt ở Sổ ngày ›'}
          </Link>
        )}
      </td>
    </tr>
  )
}

function HangPhieu({ d, ph }: { d: SoDaGhiCtx; ph: NhomPhieu }) {
  const x = ph.doc
  const gap = d.phieuGap.has(ph.key)
  const kg = ph.lines.reduce((a, l) => a + (l.kg ?? 0), 0)
  const nhap = x ? isDraftStatus(x.status) : false
  const khoa = ph.lines[0] ? d.why(ph.lines[0]) : null
  const hoi = x && d.phieuXoaCho === x.id
  const dauKy = x?.kind === 'dau_ky'
  return (
    <tr className="grp">
      <td colSpan={6}>
        <button
          type="button"
          className="tg"
          onClick={() => d.doiPhieu(ph.key)}
          aria-expanded={!gap}
          aria-label={`${gap ? 'Mở' : 'Gập'} ${x?.doc_no ?? 'dòng lẻ'}`}
        >
          {gap ? '▸' : '▾'}
        </button>
        {x ? (
          <>
            <span className="ma">{x.doc_no}</span>
            {dauKy && <span className="sx-dk">ĐẦU KỲ</span>}
            <span className="mut" style={{ fontWeight: 400 }}>
              {' '}
              · <span className="ma">{x.lsx_code}</span> · {x.stage_label}
              {!d.p.team_id && x.team_name && ` · ${x.team_name}`}
              {dauKy
                ? ` · tới hết ${dm(x.entry_date)} · không giờ công`
                : `${x.shift ? ` · ca ${x.shift}` : ''}${
                    x.labor_hours
                      ? ` · ${x.worker_count} CN × ${fmt(x.hours_per_worker ?? 0)} giờ = ${fmt(x.labor_hours)} giờ công`
                      : ' · chưa giờ công'
                  }`}
            </span>
          </>
        ) : (
          <span className="mut">Dòng lẻ trước khi có phiếu</span>
        )}
      </td>
      <td colSpan={4} className="rt">
        {x && (
          <>
            <i className={cx('sx-dot', nhap ? 'w' : 'g')} />
            {nhap ? 'NHÁP' : 'chính thức'}
            <span className="mut" style={{ fontWeight: 400 }}>
              {nhap && ' — chưa vào số'} · {gio(x.created_at)} · {fmt(ph.lines.length)} dòng
              {kg > 0 && ` · ${kgTxt(kg)} kg`}
            </span>
            {nhap && !khoa && (
              <Link href={`/thongke/lsx/${x.lsx_id}?tab=phieu`} className="lnk">
                Ghi chính thức ›
              </Link>
            )}
            {/* Bản vẽ 14/11 (S1): ghi lại sau khi xoá dòng nhầm — đúng ngày, tổ, lệnh, công đoạn. */}
            {!dauKy && !x.lsx_closed && !(x.team_id && d.lockOf(x.team_id, x.entry_date)) && (
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
          </>
        )}
      </td>
    </tr>
  )
}

function Dong({ d, l, maHien }: { d: SoDaGhiCtx; l: SdgLine; maHien: boolean }) {
  const khoa = d.why(l)
  const f = d.flagOf(l.id)
  const nang = f.some((x) => x.kind === 'vuot_phai_lam' || x.kind === 'vuot_kha_dung')
  const dr = d.drafts[l.id] ?? {}
  const xoa = d.xoa.has(l.id)
  const hoi = d.xoaCho === l.id
  const chu = d.chu(l)
  const chan = d.chanO?.id === l.id ? d.chanO.field : null
  const qtyMoi = dr.qty != null ? parseSo(dr.qty) : l.qty
  const kg = qtyMoi != null && qtyMoi !== l.qty ? scaleKg(l.kg, l.qty, qtyMoi, l.dm_kg) : l.kg
  const doi = (k: 'qty' | 'defect' | 'worker' | 'text', goc: string) =>
    dr[k] != null && dr[k]!.trim() !== goc.trim()
  const tip = [...f.map((x) => `⚠ ${x.text}`), khoa].filter(Boolean).join('\n') || undefined

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
          disabled={xoa}
        />
      </td>
    )
  }

  return (
    <tr
      id={`sdg-${l.id}`}
      className={cx(
        'd',
        xoa || hoi ? 'xoa xoa xoa' : f.length > 0 && (nang ? 'soat soat soat soat' : 'soatw soatw soatw soatw'),
      )}
      title={tip}
    >
      <td>{maHien ? <span className="ma">{l.product_code ?? '—'}</span> : null}</td>
      <td title={l.cluster ? `${l.cluster} · ${l.name}` : l.name}>
        {l.name}
        {l.qty_per_unit != null && <span className="mut num"> ×{fmt(l.qty_per_unit)}</span>}
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
      <td className={cx('r num', kg == null && 'empty')}>{kg == null ? '—' : kgTxt(kg)}</td>
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
