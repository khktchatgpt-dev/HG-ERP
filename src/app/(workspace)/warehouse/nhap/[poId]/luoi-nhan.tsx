'use client'

import { Fragment, useRef, useState } from 'react'
import { isoToVn } from '@/lib/date-vn'
import type { NhanDot } from '@/lib/kho-dot-giao'
import {
  danhGiaVuot,
  sauPhieu,
  type DongNhan,
  type TinhTrang,
} from '@/lib/kho-phieu-nhap'
import { kgDuKien, lechKg } from '@/lib/can-kg'
import { useBeRong } from '@/lib/use-be-rong'
import {
  CellHint,
  Code,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  LineStatus,
  NumInput,
  Pick,
  Tag,
  TextInput,
  Th,
} from '@/components/kit'

const TINH_TRANG: { value: TinhTrang; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]
const fmt = (n: number) => n.toLocaleString('vi-VN')
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. */
const docSo = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0

/** Khung hẹp hơn: cột Ghi chú co thành nút ✎ mở dòng phụ. */
const GON = 1150
/** Hẹp hơn nữa (1024 có sidebar mở ≈ 797px): cột số và Đợt co lại. */
const HEP = 900

/**
 * LƯỚI PHIẾU NHẬP — tách khỏi `PhieuNhapScreen` (12/10/2026, Kho đợt 2 · Bước
 * 2c) để thêm luật màn hẹp mà màn không vượt trần 800 dòng. Logic ô giữ nguyên.
 *
 * Đo trước khi sửa (PO-2026-0090, 25 dòng): lưới 1180px trong khung 1065px ở
 * 1280 (sidebar mở) và 797px ở 1024 — riêng ô Ghi chú 300px. Nay:
 *  · < 1150px: Ghi chú thành nút ✎ (● khi đã có chữ); bấm mở DÒNG PHỤ ngay dưới
 *    để gõ. Dòng "Sai quy cách" luôn mở dòng phụ — ghi chú bắt buộc, và thanh
 *    chốt nhảy tới `#ghi-chu-<i>` nên ô phải có mặt trong DOM.
 *  · < 900px: cột số 66px, Đợt rút thành "đ2" (câu đủ ở `title`), Tình trạng hẹp.
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
  const gon = rong < GON
  const hep = rong < HEP
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
  const minWidth = hep
    ? 760 + (coKg ? 120 : 0)
    : gon
      ? 900 + (hasDots ? 72 : 0) + (coKg ? 140 : 0)
      : coKg
        ? 1220
        : 1180
  const soCot = 11 + (coKg ? 1 : 0)

  const oGhiChu = (r: DongNhan, i: number) => (
    <TextInput
      id={`ghi-chu-${i}`}
      value={r.note}
      onCommit={(v) => patch(i, { note: v })}
      disabled={busy}
      placeholder={
        r.status === 'blocked'
          ? 'bắt buộc: vì sao sai quy cách'
          : 'ghi chú (không bắt buộc)'
      }
      label={`Ghi chú ${r.code}`}
    />
  )

  return (
    <div ref={khung} className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <Grid minWidth={minWidth}>
        <GridHead>
          <Th width={30}>#</Th>
          <Th width={hep ? 84 : 96}>Mã</Th>
          <Th width={wDot}>Đợt</Th>
          <Th>Tên vật tư</Th>
          <Th width={hep ? 46 : 52}>ĐVT</Th>
          <Th num width={wSo}>
            Đặt
          </Th>
          <Th num width={wSo}>
            Đã về
          </Th>
          <Th num width={wSo}>
            Còn chờ
          </Th>
          <Th num width={hep ? 104 : 120}>
            Lần này
          </Th>
          {coKg && (
            <Th num width={hep ? 120 : 140}>
              Kg cân (nếu có)
            </Th>
          )}
          <Th width={hep ? 112 : 146}>Tình trạng</Th>
          <Th width={gon ? 44 : coKg ? 200 : 300}>{gon ? '' : 'Ghi chú'}</Th>
        </GridHead>
        <GridBody>
          {rows.map((r, i) => {
            const vuot = r.editable ? danhGiaVuot(r) : null
            const phu = gon && r.editable && (moGhiChu.has(i) || r.status === 'blocked')
            return (
              <Fragment key={r.po_line_id}>
                <GridRow>
                  <td className="k-c-n">{i + 1}</td>
                  <td>
                    <Code>{r.code}</Code>
                  </td>
                  <td className="text-k-label">
                    {(() => {
                      const n = nhan.get(r.po_line_id) ?? { kind: 'none' as const }
                      if (n.kind === 'this') {
                        const cau = `đợt ${n.seq} · ${fmt(n.qty)} ${r.unit}`
                        return hep ? (
                          <span title={cau}>đ{n.seq}</span>
                        ) : (
                          <Tag tone="neutral">{cau}</Tag>
                        )
                      }
                      if (n.kind === 'other') {
                        const cau = `đợt ${n.seq} · ${isoToVn(n.date).slice(0, 5)}${n.arrived ? ' · xe đã tới' : ''}` // prettier-ignore
                        return (
                          <span className="text-[var(--ink-3)]" title={cau}>
                            {hep ? `đ${n.seq}` : cau}
                          </span>
                        )
                      }
                      if (n.kind === 'done')
                        return hep ? (
                          <span
                            className="text-[var(--done)]"
                            title={`đã nhận đợt ${n.seq}`}
                          >
                            ✓{n.seq}
                          </span>
                        ) : (
                          <Tag tone="done">đã nhận đợt {n.seq}</Tag>
                        )
                      return (
                        <span className="text-[var(--ink-empty)]">
                          {hasDots && !hep ? 'chưa xếp đợt' : '—'}
                        </span>
                      )
                    })()}
                  </td>
                  <td
                    className="max-w-0"
                    title={[
                      r.name,
                      r.chi_tiet,
                      gon && r.note ? `Ghi chú: ${r.note}` : null,
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  >
                    <div className="truncate">{r.name}</div>
                    {r.chi_tiet && (
                      <div className="text-k-label truncate text-[var(--ink-3)]">
                        {r.chi_tiet}
                      </div>
                    )}
                  </td>
                  <td className="text-[var(--ink-3)]">{r.unit}</td>
                  <td className="k-r num">{fmt(r.qty_ordered)}</td>
                  <td className="k-r num text-[var(--ink-3)]">{fmt(r.qty_received)}</td>
                  <td className="k-r num">
                    {r.editable ? (
                      fmt(r.qty_open)
                    ) : (
                      <span className="text-[var(--ink-empty)]">0</span>
                    )}
                  </td>
                  <td className="k-r">
                    {r.editable ? (
                      <>
                        <NumInput
                          id={`lan-nay-${i}`}
                          value={String(r.qty)}
                          disabled={busy}
                          onCommit={(v) => patch(i, { qty: docSo(v) })}
                          aria-label={`Lần này ${r.code}`}
                        />
                        {(() => {
                          // Thiếu KHÔNG chặn: đơn thành "Về một phần", người mua
                          // quyết giao bù / chốt thiếu ở trang đơn. Nói trước.
                          const sp = sauPhieu(r)
                          return sp?.kind === 'thieu' ? (
                            <CellHint tone="neutral">
                              còn thiếu {fmt(sp.n)} {r.unit}
                            </CellHint>
                          ) : null
                        })()}
                        {r.status === 'blocked' && r.qty > 0 && (
                          <CellHint tone="warn">
                            {fmt(r.qty)} {r.unit} vào KHOÁ
                          </CellHint>
                        )}
                        {vuot &&
                          (vuot.trong_dung_sai ? (
                            <CellHint tone="neutral">
                              vượt {vuot.pct.toFixed(0)}% · trong dung sai{' '}
                              {r.over_tolerance_pct}%
                            </CellHint>
                          ) : (
                            <CellHint
                              tone="warn"
                              onClick={moHopLyDo}
                              title="Vượt ngưỡng của mã — bấm để ghi lý do nhận vượt"
                            >
                              vượt {vuot.pct.toFixed(0)}% · dung sai{' '}
                              {r.over_tolerance_pct}% ·{' '}
                              {coLyDoVuot ? 'đã có lý do' : 'ghi lý do'}
                            </CellHint>
                          ))}
                      </>
                    ) : (
                      <LineStatus kind={r.closed_short ? 'short' : 'done'}>
                        {r.closed_short ? 'đã chốt thiếu' : 'đã đủ'}
                      </LineStatus>
                    )}
                  </td>
                  {coKg && (
                    <td className="k-r">
                      {r.editable && r.can_kg ? (
                        <>
                          <NumInput
                            id={`kg-can-${i}`}
                            value={r.kg_can == null ? '' : String(r.kg_can)}
                            disabled={busy}
                            placeholder="cân rồi ghi"
                            onCommit={(v) =>
                              patch(i, { kg_can: v.trim() ? docSo(v) || null : null })
                            }
                            aria-label={`Kg cân thực ${r.code}`}
                          />
                          {(() => {
                            const du = kgDuKien(r.qty, {
                              qty_ordered: r.qty_ordered,
                              qty2: r.kg_don,
                            })
                            if (r.qty > 0 && !(r.kg_can! > 0))
                              return (
                                <CellHint tone="warn">
                                  bắt buộc{du != null ? ` · đơn ~${fmt(du)} kg` : ''}
                                </CellHint>
                              )
                            const l = r.kg_can ? lechKg(r.kg_can, du) : null
                            return l != null ? (
                              <CellHint tone={Math.abs(l) >= 3 ? 'warn' : 'neutral'}>
                                đơn ~{fmt(du!)} kg · lệch {l > 0 ? '+' : ''}
                                {l.toLocaleString('vi-VN')}%
                              </CellHint>
                            ) : null
                          })()}
                        </>
                      ) : (
                        <span className="text-[var(--ink-empty)]">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    {r.editable ? (
                      <Pick
                        value={r.status}
                        onChange={(v) => patch(i, { status: v as TinhTrang })}
                        options={TINH_TRANG}
                        label={`Tình trạng ${r.code}`}
                        width={hep ? 100 : 130}
                        disabled={busy}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </td>
                  <td>
                    {!r.editable ? (
                      <span className="text-[var(--ink-empty)]">—</span>
                    ) : gon ? (
                      <button
                        type="button"
                        onClick={() => lat(i)}
                        aria-expanded={phu}
                        aria-label={`${phu ? 'Đóng' : 'Mở'} ghi chú ${r.code}`}
                        title={r.note || 'Thêm ghi chú'}
                        className={
                          r.note
                            ? 'font-semibold text-[var(--act-text)]'
                            : 'text-[var(--ink-3)] hover:text-[var(--act-text)]'
                        }
                      >
                        {r.note ? '●' : '✎'}
                      </button>
                    ) : (
                      oGhiChu(r, i)
                    )}
                  </td>
                </GridRow>
                {phu && (
                  <tr className="bg-[var(--surface-raised)]">
                    <td />
                    <td colSpan={soCot - 1} className="py-1">
                      <span className="flex items-center gap-2">
                        <span className="text-k-label shrink-0 font-semibold text-[var(--ink-2)] uppercase">
                          Ghi chú {r.code}
                        </span>
                        <span className="min-w-0 flex-1">{oGhiChu(r, i)}</span>
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </GridBody>
        <GridFoot>
          <td
            colSpan={5}
            title={`Nhận theo phần còn mở của ${dangTheoDot ? 'đợt' : 'đơn'} — dòng đã đủ không có ô nhập`}
          >
            Tổng{' '}
            <span className="font-normal text-[var(--ink-3)]">
              · {rows.length} dòng · {rows.filter((r) => !r.editable).length} đã đủ
            </span>
          </td>
          <td className="k-r num">{fmt(tong.tong_dat)}</td>
          <td className="k-r num">{fmt(tong.tong_da_ve)}</td>
          <td className="k-r num">{fmt(conCho)}</td>
          <td className="k-r num">{fmt(tong.lan_nay)}</td>
          {coKg && <td className="k-r num">{kgCan > 0 ? `${fmt(kgCan)} kg` : '—'}</td>}
          <td
            colSpan={2}
            className="font-normal text-[var(--ink-3)]"
            // Chữ dòng tổng không được ép hai cột cuối phình 299px ở khung hẹp (đo 12/10).
            style={gon ? { whiteSpace: 'normal' } : undefined}
          >
            {tong.so_dong_nhan} dòng nhận · {fmt(tong.vao_khoa)} vào khoá ·{' '}
            {fmt(tong.dung_duoc)} dùng được
          </td>
        </GridFoot>
      </Grid>
    </div>
  )
}
