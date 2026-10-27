'use client'

import { Fragment, useRef, useState } from 'react'
import { isoToVn } from '@/lib/date-vn'
import type { NhanDot } from '@/lib/kho-dot-giao'
import {
  CHO_GHI_HANG_KHOA,
  danhGiaVuot,
  sauPhieu,
  type DongNhan,
  type TinhTrang,
} from '@/lib/kho-phieu-nhap'
import { kgDuKien, lechKg } from '@/lib/can-kg'
import { useBeRong } from '@/lib/use-be-rong'
import { GoiY, OChu, OSo, docSoVn } from '../../_erp/o-nhap'

const TINH_TRANG: { value: TinhTrang; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]
const fmt = (n: number) => n.toLocaleString('vi-VN')

/** Khung hẹp hơn: cột Ghi chú co thành nút ✎ mở dòng phụ. */
const GON = 1150
/** Hẹp hơn nữa (1024 có sidebar mở ≈ 797px): cột số và Đợt co lại. */
const HEP = 900

/**
 * LƯỚI PHIẾU NHẬP — Kho lối ERP · B2 (bản vẽ K-3), viết tay không kit. Ba cột số
 * Đặt / Đã về / Còn chờ đứng yên, chỉ Lần này · Kg cân · Tình trạng · Ghi chú gõ
 * được (Tình trạng tạm ẩn từ 26/10/2026 — `CHO_GHI_HANG_KHOA`). Câu nhắc hiện NGAY DƯỚI Ô (thiếu, vào khoá, vượt dung sai — bấm được để
 * ghi lý do).
 *
 * Khung < 1150px: Ghi chú thành nút ✎ (● khi đã có chữ) mở DÒNG PHỤ ngay dưới;
 * dòng "Sai quy cách" luôn mở dòng phụ — ghi chú bắt buộc, và thanh chốt nhảy
 * tới `#ghi-chu-<i>` nên ô phải có mặt. < 900px: cột số hẹp, Đợt rút thành "đ2".
 */
export function LuoiNhan({
  rows,
  nhan,
  hasDots,
  dangTheoDot,
  coKg,
  busy,
  patch,
  moHopLyDo,
  coLyDoVuot,
  tong,
  conCho,
  kgCan,
}: {
  rows: DongNhan[]
  /** Dòng thuộc đợt nào (`nhanDot`). */
  nhan: Map<string, NhanDot>
  hasDots: boolean
  /** Đang nhận theo một đợt (khác: theo phần mở của cả đơn). */
  dangTheoDot: boolean
  coKg: boolean
  busy: boolean
  patch: (i: number, p: Partial<DongNhan>) => void
  moHopLyDo: () => void
  coLyDoVuot: boolean
  tong: { tong_dat: number; tong_da_ve: number; lan_nay: number; so_dong_nhan: number; vao_khoa: number; dung_duoc: number } // prettier-ignore
  conCho: number
  kgCan: number
}) {
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  const gon = rong > 0 && rong < GON
  const hep = rong > 0 && rong < HEP
  const [moGhiChu, setMoGhiChu] = useState<Set<number>>(new Set())
  const lat = (i: number) =>
    setMoGhiChu((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  const wSo = hep ? 66 : 80
  const wDot = hep ? 48 : hasDots ? 128 : 56
  /* Cột Tình trạng tạm ẩn (`CHO_GHI_HANG_KHOA`) — chỉ hiện khi phiếu đang lập lại
     mang sẵn dòng khoá, để người sửa còn thấy và đổi về Đạt. */
  const coTinhTrang = CHO_GHI_HANG_KHOA || rows.some((r) => r.status === 'blocked')
  const soCot = 10 + (coKg ? 1 : 0) + (coTinhTrang ? 1 : 0)

  const oGhiChu = (r: DongNhan, i: number) => (
    <OChu
      id={`ghi-chu-${i}`}
      value={r.note}
      onCommit={(v) => patch(i, { note: v })}
      disabled={busy}
      placeholder={r.status === 'blocked' ? 'bắt buộc: vì sao sai quy cách' : 'ghi chú (không bắt buộc)'} // prettier-ignore
      label={`Ghi chú ${r.code}`}
      tone={r.status === 'blocked' && !r.note.trim() ? 'need' : undefined}
    />
  )

  const oDot = (r: DongNhan) => {
    const n = nhan.get(r.po_line_id) ?? { kind: 'none' as const }
    if (n.kind === 'this') {
      const cau = `đợt ${n.seq} · ${fmt(n.qty)} ${r.unit}`
      return hep ? (
        <span title={cau}>đ{n.seq}</span>
      ) : (
        <span className="kh-tag">{cau}</span>
      )
    }
    if (n.kind === 'other') {
      const cau = `đợt ${n.seq} · ${isoToVn(n.date).slice(0, 5)}${n.arrived ? ' · xe đã tới' : ''}` // prettier-ignore
      return (
        <span className="kh-mut" title={cau}>
          {hep ? `đ${n.seq}` : cau}
        </span>
      )
    }
    if (n.kind === 'done')
      return hep ? (
        <span className="kh-ok" title={`đã nhận đợt ${n.seq}`}>
          ✓{n.seq}
        </span>
      ) : (
        <span className="kh-tag done">đã nhận đợt {n.seq}</span>
      )
    return <span className="kh-empty">{hasDots && !hep ? 'chưa xếp đợt' : '—'}</span>
  }

  /* ĐIỆN THOẠI (K5, khung < 600px): mỗi dòng hàng một khối — số đứng trên, ô Lần
     này to, ghi chú cả bề ngang. Cùng id ô (`lan-nay-i`, `ghi-chu-i`) để thanh chốt
     nhảy tới được. */
  if (rong > 0 && rong < 600)
    return (
      <div ref={khung} className="kh-pl" aria-label="Dòng hàng nhận">
        {rows.map((r, i) => {
          const vuot = r.editable ? danhGiaVuot(r) : null
          const sp = r.editable ? sauPhieu(r) : null
          return (
            <div key={r.po_line_id} className="kh-pl-dong">
              <span style={{ minWidth: 0 }}>
                <span className="kh-ma">{r.code}</span>{' '}
                <span style={{ fontSize: 11.5 }}>{oDot(r)}</span>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
                <span
                  className="kh-mut kh-num"
                  style={{ display: 'block', fontSize: 12 }}
                >
                  đặt {fmt(r.qty_ordered)} · đã về {fmt(r.qty_received)} · còn{' '}
                  {r.editable ? fmt(r.qty_open) : 0} {r.unit}
                </span>
              </span>
              <span>
                {r.editable ? (
                  <>
                    <OSo
                      id={`lan-nay-${i}`}
                      value={String(r.qty)}
                      disabled={busy}
                      onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                      label={`Lần này ${r.code}`}
                    />
                    {sp?.kind === 'thieu' && <GoiY>còn thiếu {fmt(sp.n)}</GoiY>}
                    {vuot && !vuot.trong_dung_sai && (
                      <GoiY tone="warn" onClick={moHopLyDo}>
                        vượt {vuot.pct.toFixed(0)}% ·{' '}
                        {coLyDoVuot ? 'đã có lý do' : 'ghi lý do'}
                      </GoiY>
                    )}
                  </>
                ) : (
                  <span className={r.closed_short ? 'kh-warn' : 'kh-ok'}>
                    {r.closed_short ? 'đã chốt thiếu' : 'đã đủ'}
                  </span>
                )}
              </span>
              {r.editable && (
                <>
                  {coTinhTrang && (
                    <select
                      className="kh-o full"
                      value={r.status}
                      onChange={(e) => patch(i, { status: e.target.value as TinhTrang })}
                      aria-label={`Tình trạng ${r.code}`}
                      disabled={busy}
                    >
                      {TINH_TRANG.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {r.can_kg && (
                    <span className="full">
                      <OSo
                        id={`kg-can-${i}`}
                        value={r.kg_can == null ? '' : String(r.kg_can)}
                        disabled={busy}
                        placeholder="kg cân thực"
                        onCommit={(v) => patch(i, { kg_can: v.trim() ? docSoVn(v) || null : null })} // prettier-ignore
                        label={`Kg cân thực ${r.code}`}
                        tone={r.qty > 0 && !(r.kg_can! > 0) ? 'need' : undefined}
                      />
                    </span>
                  )}
                  <span className="full">{oGhiChu(r, i)}</span>
                </>
              )}
            </div>
          )
        })}
        <div className="kh-pl-dong kh-mut" style={{ fontSize: 12 }}>
          <span className="full">
            {rows.length} dòng · {rows.filter((r) => !r.editable).length} đã đủ · lần này{' '}
            {fmt(tong.lan_nay)}
          </span>
        </div>
      </div>
    )

  return (
    <div ref={khung} className="kh-grid">
      <table className="kh-tb" aria-label="Dòng hàng nhận">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: hep ? 84 : 96 }} />
          <col style={{ width: wDot }} />
          <col />
          <col style={{ width: hep ? 46 : 54 }} />
          <col style={{ width: wSo }} />
          <col style={{ width: wSo }} />
          <col style={{ width: wSo }} />
          <col style={{ width: hep ? 104 : 120 }} />
          {coKg && <col style={{ width: hep ? 120 : 140 }} />}
          {coTinhTrang && <col style={{ width: hep ? 112 : 136 }} />}
          <col style={{ width: gon ? 40 : coKg ? 180 : 210 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Đợt</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r">Đặt</th>
            <th className="r">Đã về</th>
            <th className="r">Còn chờ</th>
            <th className="r">Lần này</th>
            {coKg && <th className="r">Kg cân (nếu có)</th>}
            {coTinhTrang && <th>Tình trạng</th>}
            <th aria-label={gon ? 'Ghi chú' : undefined}>{gon ? '' : 'Ghi chú'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const vuot = r.editable ? danhGiaVuot(r) : null
            const phu = gon && r.editable && (moGhiChu.has(i) || r.status === 'blocked')
            const sp = r.editable ? sauPhieu(r) : null
            return (
              <Fragment key={r.po_line_id}>
                <tr className="d f">
                  <td className="kh-num kh-mut">{i + 1}</td>
                  <td className="kh-ma">{r.code}</td>
                  <td style={{ fontSize: 11.5 }}>{oDot(r)}</td>
                  <td
                    title={[
                      r.name,
                      r.chi_tiet,
                      gon && r.note ? `Ghi chú: ${r.note}` : null,
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  >
                    {r.name}
                    {r.chi_tiet && (
                      <span
                        className="kh-mut"
                        style={{
                          display: 'block',
                          fontSize: 11.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.chi_tiet}
                      </span>
                    )}
                  </td>
                  <td className="kh-mut">{r.unit}</td>
                  <td className="r kh-num">{fmt(r.qty_ordered)}</td>
                  <td className="r kh-num kh-mut">{fmt(r.qty_received)}</td>
                  <td className="r kh-num">
                    {r.editable ? fmt(r.qty_open) : <span className="kh-empty">0</span>}
                  </td>
                  <td className={r.editable ? 'r go' : 'r'}>
                    {r.editable ? (
                      <>
                        <OSo
                          id={`lan-nay-${i}`}
                          value={String(r.qty)}
                          disabled={busy}
                          onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                          label={`Lần này ${r.code}`}
                        />
                        {/* Thiếu KHÔNG chặn: đơn thành "Về một phần", người mua quyết giao bù / chốt thiếu. */}
                        {sp?.kind === 'thieu' && (
                          <GoiY>
                            còn thiếu {fmt(sp.n)} {r.unit}
                          </GoiY>
                        )}
                        {r.status === 'blocked' && r.qty > 0 && (
                          <GoiY tone="warn">
                            {fmt(r.qty)} {r.unit} vào KHOÁ
                          </GoiY>
                        )}
                        {vuot &&
                          (vuot.trong_dung_sai ? (
                            <GoiY>
                              vượt {vuot.pct.toFixed(0)}% · trong dung sai{' '}
                              {r.over_tolerance_pct}%
                            </GoiY>
                          ) : (
                            <GoiY
                              tone="warn"
                              onClick={moHopLyDo}
                              title="Vượt ngưỡng của mã — bấm để ghi lý do nhận vượt"
                            >
                              vượt {vuot.pct.toFixed(0)}% · dung sai{' '}
                              {r.over_tolerance_pct}% ·{' '}
                              {coLyDoVuot ? 'đã có lý do' : 'ghi lý do'}
                            </GoiY>
                          ))}
                      </>
                    ) : (
                      <span className={r.closed_short ? 'kh-warn' : 'kh-ok'}>
                        {r.closed_short ? 'đã chốt thiếu' : 'đã đủ'}
                      </span>
                    )}
                  </td>
                  {coKg && (
                    <td className={r.editable && r.can_kg ? 'r go' : 'r'}>
                      {r.editable && r.can_kg ? (
                        <>
                          <OSo
                            id={`kg-can-${i}`}
                            value={r.kg_can == null ? '' : String(r.kg_can)}
                            disabled={busy}
                            placeholder="cân rồi ghi"
                            onCommit={(v) => patch(i, { kg_can: v.trim() ? docSoVn(v) || null : null })} // prettier-ignore
                            label={`Kg cân thực ${r.code}`}
                            tone={r.qty > 0 && !(r.kg_can! > 0) ? 'need' : undefined}
                          />
                          {(() => {
                            const du = kgDuKien(r.qty, { qty_ordered: r.qty_ordered, qty2: r.kg_don }) // prettier-ignore
                            if (r.qty > 0 && !(r.kg_can! > 0))
                              return (
                                <GoiY tone="warn">
                                  bắt buộc{du != null ? ` · đơn ~${fmt(du)} kg` : ''}
                                </GoiY>
                              )
                            const l = r.kg_can ? lechKg(r.kg_can, du) : null
                            return l != null ? (
                              <GoiY tone={Math.abs(l) >= 3 ? 'warn' : 'mut'}>
                                đơn ~{fmt(du!)} kg · lệch {l > 0 ? '+' : ''}
                                {l.toLocaleString('vi-VN')}%
                              </GoiY>
                            ) : null
                          })()}
                        </>
                      ) : (
                        <span className="kh-empty">—</span>
                      )}
                    </td>
                  )}
                  {coTinhTrang && (
                    <td className={r.editable ? 'go' : undefined}>
                      {r.editable ? (
                        <select
                          className="kh-o"
                          value={r.status}
                          onChange={(e) =>
                            patch(i, { status: e.target.value as TinhTrang })
                          }
                          aria-label={`Tình trạng ${r.code}`}
                          disabled={busy}
                          style={r.status === 'blocked' ? { color: 'var(--kh-stop)', fontWeight: 600 } : undefined} // prettier-ignore
                        >
                          {TINH_TRANG.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="kh-empty">—</span>
                      )}
                    </td>
                  )}
                  <td className={r.editable && !gon ? 'go' : undefined}>
                    {!r.editable ? (
                      <span className="kh-empty">—</span>
                    ) : gon ? (
                      <button
                        type="button"
                        className="mo"
                        onClick={() => lat(i)}
                        aria-expanded={phu}
                        aria-label={`${phu ? 'Đóng' : 'Mở'} ghi chú ${r.code}`}
                        title={r.note || 'Thêm ghi chú'}
                        style={
                          r.note ? { color: 'var(--kh-act)', fontWeight: 700 } : undefined
                        }
                      >
                        {r.note ? '●' : '✎'}
                      </button>
                    ) : (
                      oGhiChu(r, i)
                    )}
                  </td>
                </tr>
                {phu && (
                  <tr className="phu">
                    <td />
                    <td colSpan={soCot - 1}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="kh-mut"
                          style={{
                            flex: 'none',
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          Ghi chú {r.code}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>{oGhiChu(r, i)}</span>
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={5}
              title={`Nhận theo phần còn mở của ${dangTheoDot ? 'đợt' : 'đơn'} — dòng đã đủ không có ô nhập`}
            >
              Tổng · {rows.length} dòng · {rows.filter((r) => !r.editable).length} đã đủ
            </td>
            <td className="r kh-num">{fmt(tong.tong_dat)}</td>
            <td className="r kh-num">{fmt(tong.tong_da_ve)}</td>
            <td className="r kh-num">{fmt(conCho)}</td>
            <td className="r kh-num">{fmt(tong.lan_nay)}</td>
            {coKg && <td className="r kh-num">{kgCan > 0 ? `${fmt(kgCan)} kg` : '—'}</td>}
            {/* Không cột Tình trạng thì ô cuối chỉ còn cột Ghi chú (40px khi gọn) — số
                dòng nhận đã nằm ở thanh chốt đáy, không nhồi vào ô bị cắt chữ. */}
            {coTinhTrang ? (
              <td colSpan={2} style={{ fontWeight: 400 }}>
                {tong.so_dong_nhan} dòng nhận · {fmt(tong.vao_khoa)} vào khoá
              </td>
            ) : (
              <td />
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
