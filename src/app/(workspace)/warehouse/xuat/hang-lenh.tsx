'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn } from '@/lib/date-vn'
import type { HangLenhRow } from '@/lib/kho-hang-lenh'
import { lenhGon } from '../ton/ton-lenh.shared'
import { searchMatcher } from '@/lib/search-text'
import { HopThoai } from '../_erp/o-nhap'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. */
const docSo = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'))

export type LayHang = {
  id: string
  code: string
  name: string
  unit: string
  qty_ok: number
  qty: number
}

/**
 * LẤY HÀNG CỦA LỆNH — Kho đợt 2 · Bước 4 (bản vẽ B4-1/B4-2/B4-3
 * https://claude.ai/artifact/4x4FTaGvwxx1xqF6ozFZLA), viết lại không kit ở
 * Kho lối ERP · B3 (14/10/2026).
 *
 * Chọn lệnh xong, khối này nạp `GET lsx/[id]/hang-lenh`, nói "kho còn N mã của
 * lệnh", mở hộp tích chọn với số điền sẵn = min(còn của lệnh, tồn dùng được)
 * (Q1) rồi đưa cả loạt vào lưới phiếu — số vẫn sửa được trước khi Ghi sổ. Mã đã
 * về mà kho hết: bày mờ, không tích được, có lý do (Q4). Lệnh quá hạn xuất hàng
 * mà còn hàng trên máy: nói ra để ghi bù (Q3).
 */
export function HangLenh({
  lsx,
  today,
  onLay,
}: {
  lsx: { id: string; code: string; status: string; ship_date: string | null }
  today: string
  /** Đưa các mã đã chọn vào lưới phiếu (màn tự gộp, giữ dòng đã có). */
  onLay: (chon: LayHang[]) => void
}) {
  const [rows, setRows] = useState<HangLenhRow[] | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [mo, setMo] = useState(false)

  // Đổi lệnh = màn dựng lại khối này bằng `key={lsx.id}` (state mới, rows null).
  useEffect(() => {
    let huy = false
    api<{ rows: HangLenhRow[] }>(`/api/dept/warehouse/lsx/${lsx.id}/hang-lenh`)
      .then((r) => !huy && setRows(r.rows))
      .catch((e) => !huy && setLoi(apiErrorText(e)))
    return () => {
      huy = true
    }
  }, [lsx.id])

  const conTon = rows?.filter((r) => !r.het).length ?? 0
  const het = rows?.filter((r) => r.het).length ?? 0
  const quaHan = !!lsx.ship_date && lsx.ship_date.slice(0, 10) < today
  // Lệnh đã xong (mở xuất 27/10/2026): phiếu này chỉ để GHI BÙ phần tổ đã lấy.
  const daXong = lsx.status === 'completed'

  if (loi)
    return (
      <div className="kh-note">
        <span className="tag">Hàng của lệnh</span>
        <span>
          Không tải được hàng đã về cho lệnh {lsx.code}: {loi}. Vẫn thêm dòng được bằng ô
          tìm.
        </span>
      </div>
    )
  return (
    <>
      <div className="kh-note mut" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="tag">Hàng của lệnh</span>
        {rows == null ? (
          <span className="kh-mut">Đang tìm hàng đã về cho lệnh {lsx.code}…</span>
        ) : rows.length === 0 ? (
          <span className="kh-mut">
            Chưa có hàng nào đã mua cho lệnh <b className="kh-num">{lsx.code}</b> về kho
            mà chưa xuất. Mã tổ lấy thì thêm bằng ô tìm bên dưới.
          </span>
        ) : (
          <>
            <span>
              Kho còn <b className="kh-num">{conTon}</b> mã đã mua cho lệnh{' '}
              <b className="kh-num">{lsx.code}</b>, chưa ghi xuất
              {het > 0 && <span className="kh-mut"> · {het} mã đã về nhưng kho hết</span>}
              .
            </span>
            <button
              type="button"
              className={conTon > 0 ? 'kh-btn p' : 'kh-btn'}
              onClick={() => setMo(true)}
            >
              Lấy hàng của lệnh{conTon > 0 ? ` (${conTon})` : ''}
            </button>
            {!daXong && quaHan && conTon > 0 && (
              <span className="kh-warn">
                Lệnh đã quá hạn xuất hàng {isoToVn(lsx.ship_date!.slice(0, 10))} — xưởng
                đã dùng thì ghi bù để tồn trên máy đúng kho thật.
              </span>
            )}
          </>
        )}
        {daXong && (
          <span className="kh-warn">
            Lệnh đã hoàn thành — phiếu này là GHI BÙ: chỉ ghi phần tổ đã lấy thật mà chưa
            ghi sổ, ngày chứng từ lùi về ngày lấy.
          </span>
        )}
      </div>
      {mo && rows && (
        <HangLenhHop
          lsxCode={lsx.code}
          rows={rows}
          onClose={() => setMo(false)}
          onLay={(c) => {
            onLay(c)
            setMo(false)
          }}
        />
      )}
    </>
  )
}

type Ro = 'con' | 'het' | 'tat_ca'

function HangLenhHop({
  lsxCode,
  rows,
  onClose,
  onLay,
}: {
  lsxCode: string
  rows: HangLenhRow[]
  onClose: () => void
  onLay: (chon: LayHang[]) => void
}) {
  // Mặc định tích HẾT mã còn tồn, số = gợi ý (Q1).
  const [chon, setChon] = useState<Set<string>>(
    () => new Set(rows.filter((r) => !r.het).map((r) => r.material_id)),
  )
  const [so_, setSo] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.material_id, so(r.goi_y)])),
  )
  const [q, setQ] = useState('')
  const [ro, setRo] = useState<Ro>(rows.some((r) => !r.het) ? 'con' : 'tat_ca')
  const conTon = rows.filter((r) => !r.het).length
  const hien = useMemo(() => {
    const khop = searchMatcher(q)
    return rows.filter(
      (r) =>
        (ro === 'tat_ca' || (ro === 'con' ? !r.het : r.het)) && khop([r.code, r.name]),
    )
  }, [rows, ro, q])
  const lay = rows
    .filter((r) => chon.has(r.material_id))
    .map((r) => ({ r, qty: docSo(so_[r.material_id] ?? '') }))
  const sai = lay.filter((x) => !Number.isFinite(x.qty) || x.qty < 0)
  const latHet = (on: boolean) =>
    setChon(
      on ? new Set(rows.filter((r) => !r.het).map((r) => r.material_id)) : new Set(),
    )

  return (
    <HopThoai
      title={`Hàng của lệnh ${lsxCode}`}
      subtitle={`${conTon} mã còn trong kho · ${rows.length - conTon} mã đã về nhưng kho hết`}
      onClose={onClose}
      width={920}
      footer={
        <>
          <span
            className="kh-mut"
            style={{ marginRight: 'auto', fontSize: 12, alignSelf: 'center' }}
          >
            {sai.length > 0
              ? `Số chưa đúng ở ${sai.map((x) => x.r.code).join(', ')}`
              : 'Số điền sẵn = min(còn của lệnh, tồn dùng được) — sửa ở đây hoặc trong lưới phiếu.'}
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={lay.length === 0 || sai.length > 0}
            onClick={() =>
              onLay(
                lay.map(({ r, qty }) => ({
                  id: r.material_id,
                  code: r.code,
                  name: r.name,
                  unit: r.unit,
                  qty_ok: r.ton,
                  qty,
                })),
              )
            }
          >
            Đưa {lay.length} dòng vào phiếu
          </button>
        </>
      }
    >
      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <input
          className="kh-o"
          style={{ width: 220 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Lọc mã, tên…"
          aria-label="Lọc hàng của lệnh"
        />
        <span className="kh-loc-nho" role="group" aria-label="Rổ hàng của lệnh">
          <button type="button" aria-pressed={ro === 'con'} onClick={() => setRo('con')}>
            Còn tồn {conTon}
          </button>
          <button type="button" aria-pressed={ro === 'het'} onClick={() => setRo('het')}>
            Kho hết {rows.length - conTon}
          </button>
          <button
            type="button"
            aria-pressed={ro === 'tat_ca'}
            onClick={() => setRo('tat_ca')}
          >
            Tất cả {rows.length}
          </button>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5 }}>
          Đã chọn <b className="kh-num">{chon.size}</b> ·{' '}
          <button
            type="button"
            className="kh-lnk"
            style={{ fontFamily: 'inherit' }}
            onClick={() => latHet(chon.size === 0)}
          >
            {chon.size === 0 ? 'chọn hết mã còn tồn' : 'bỏ chọn hết'}
          </button>
        </span>
      </span>
      {ro !== 'con' && rows.some((r) => r.het) && (
        <p className="kh-mut" style={{ fontSize: 12 }}>
          Mã “kho hết”: đã về cho lệnh nhưng tồn hiện bằng 0 — đã dùng cho việc khác, hoặc
          kiểm kê đã đưa về 0 (đợt nạp nền 11/09). “Giữ cho …”: mã chung nhiều lệnh, tồn
          chia trước cho lệnh hạn xuất sớm hơn. Không gợi ý; tổ vẫn lấy thì thêm bằng ô
          tìm.
        </p>
      )}
      <table className="kh-in" aria-label={`Hàng của lệnh ${lsxCode}`}>
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 96 }} />
          <col />
          <col style={{ width: 50 }} />
          <col style={{ width: 104 }} />
          <col style={{ width: 76 }} />
          <col style={{ width: 108 }} />
          <col style={{ width: 116 }} />
          <col style={{ width: 108 }} />
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Chọn" />
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r">Về cho lệnh</th>
            <th className="r">Đã xuất</th>
            <th className="r">Còn của lệnh</th>
            <th className="r">Tồn dùng được</th>
            <th className="r">Lấy lần này</th>
          </tr>
        </thead>
        <tbody>
          {hien.map((r) => {
            const on = chon.has(r.material_id)
            const it = !r.het && r.goi_y < r.con
            return (
              <tr key={r.material_id}>
                <td>
                  {r.het ? (
                    <span className="kh-empty" title="Kho hết — không lấy được">
                      —
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={on}
                      aria-label={`Lấy ${r.code}`}
                      onChange={(e) =>
                        setChon((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(r.material_id)
                          else n.delete(r.material_id)
                          return n
                        })
                      }
                    />
                  )}
                </td>
                <td className="kh-ma">{r.code}</td>
                <td title={r.name} className={r.het ? 'kh-mut' : undefined}>
                  {r.name}
                </td>
                <td className="kh-mut">{r.unit}</td>
                <td className="r kh-num">{so(r.ve)}</td>
                <td className="r kh-num kh-mut">{so(r.xuat)}</td>
                <td className="r kh-num kh-b">{so(r.con)}</td>
                <td
                  className={`r kh-num${it ? 'kh-warn' : r.het ? 'kh-mut' : ''}`}
                  title={
                    r.giu_cho
                      ? `Kho còn ${so(r.ton)}, chia trước cho ${r.giu_cho.join(', ')}`
                      : it
                        ? `Kho chỉ còn ${so(r.goi_y)} cho lệnh này`
                        : undefined
                  }
                >
                  {so(r.ton)}
                </td>
                <td className="r">
                  {r.het ? (
                    <span className="kh-mut">
                      {r.giu_cho && r.ton > 0
                        ? `giữ cho ${r.giu_cho.map(lenhGon).join(', ')}`
                        : 'kho hết'}
                    </span>
                  ) : (
                    <input
                      className="kh-o num"
                      value={so_[r.material_id] ?? ''}
                      onChange={(e) =>
                        setSo((m) => ({ ...m, [r.material_id]: e.target.value }))
                      }
                      disabled={!on}
                      inputMode="decimal"
                      aria-label={`Lấy lần này ${r.code}`}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </HopThoai>
  )
}
