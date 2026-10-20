'use client'

import type { KeyboardEvent } from 'react'
import { gioVn, vietSo, type DongDem } from './phieu-dem.shared'
import type { PhieuDemCtx } from './usePhieuDem'

/** Enter = xuống ô số đếm của dòng kế (đếm theo kệ, tay không rời bàn phím). */
function xuong(e: KeyboardEvent<HTMLInputElement>, ds: DongDem[], i: number) {
  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
  e.preventDefault()
  const ke = ds[i + 1]
  if (!ke) return
  const el = document.getElementById(`dem-${ke.id}`) as HTMLInputElement | null
  el?.focus()
  el?.select()
}

/** Chữ trong ô số đếm: đang gõ dở thì giữ nguyên chữ, không thì số đã lưu. */
function chuO(d: PhieuDemCtx, l: DongDem): string {
  const n = d.nhap[l.id]
  return n?.qty !== undefined ? n.qty : vietSo(l.dem)
}

/** Ô cần chú ý: đã bấm gửi mà còn trống, hoặc gõ chữ không phải số, hoặc xoá trắng số đã lưu. */
function canChu(d: PhieuDemCtx, l: DongDem): string | null {
  const n = d.nhap[l.id]
  if (d.sai.some((x) => x.id === l.id))
    return 'Không phải số — gõ lại (vd 1.390 hoặc 12,5)'
  if (n?.qty !== undefined && n.qty.trim() === '' && l.dem != null)
    return `Để trống không xoá được số đã lưu (${vietSo(l.dem)}) — gõ lại số đúng`
  if (d.daThuGui && d.soDem(l) == null) return 'Chưa đếm — hàng không còn thì gõ 0'
  return null
}

/**
 * LƯỚI ĐẾM — máy tính (bản vẽ KK-3). Không có cột số sổ khi đếm mù: server
 * đã xoá số đó khỏi dòng. Ô số và ô ghi chú gõ thẳng trên dòng, tự lưu.
 */
export function LuoiDem({ d }: { d: PhieuDemCtx }) {
  const ds = d.hien
  const sua = d.dangDem
  const coSo = ds.some((l) => l.so_so != null)
  return (
    <div className="kh-grid">
      <table className="kh-tb kk-luoi" aria-label="Phiếu đếm kiểm kê">
        <colgroup>
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 62 }} />
          <col style={{ width: 84 }} />
          {coSo && <col style={{ width: 96 }} />}
          <col style={{ width: 118 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th>Kệ</th>
            {coSo && <th className="r">Sổ lúc chốt</th>}
            <th className="r">Số đếm</th>
            <th>Ghi chú</th>
            <th>Lúc đếm</th>
          </tr>
        </thead>
        <tbody>
          {ds.map((l, i) => {
            const can = canChu(d, l)
            const n = d.nhap[l.id]
            return (
              <tr key={l.id} className={can ? 'd kk-can' : 'd'}>
                <td className="kh-ma">{l.code}</td>
                <td title={l.name}>{l.name}</td>
                <td className="kh-mut">{l.unit}</td>
                <td className={l.ke ? undefined : 'kh-empty'}>{l.ke ?? '—'}</td>
                {coSo && <td className="r kh-num kh-mut">{vietSo(l.so_so)}</td>}
                <td className="r">
                  {sua ? (
                    <input
                      id={`dem-${l.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={can ? 'kh-o num need' : 'kh-o num'}
                      value={chuO(d, l)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => d.go(l.id, { qty: e.target.value })}
                      onKeyDown={(e) => xuong(e, ds, i)}
                      aria-label={`Số đếm ${l.code}`}
                      aria-invalid={!!can}
                      title={can ?? undefined}
                    />
                  ) : (
                    <span className="kh-num kh-b">{vietSo(l.dem)}</span>
                  )}
                </td>
                <td style={{ whiteSpace: 'normal' }}>
                  {sua ? (
                    <input
                      type="text"
                      className="kh-o"
                      value={n?.note !== undefined ? n.note : (l.note ?? '')}
                      onChange={(e) => d.go(l.id, { note: e.target.value })}
                      placeholder="vd 5 cây cong, để riêng"
                      aria-label={`Ghi chú ${l.code}`}
                      maxLength={500}
                    />
                  ) : (
                    <span className="kh-mut">{l.note}</span>
                  )}
                </td>
                <td className="kh-mut kh-num">
                  {n ? <span className="kh-warn">chưa lưu</span> : gioVn(l.luc)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              Đã đếm {(d.dong.length - d.chuaDem.length).toLocaleString('vi-VN')} /{' '}
              {d.dong.length.toLocaleString('vi-VN')} dòng
              {d.chuaDem.length > 0 &&
                ` · còn ${d.chuaDem.length.toLocaleString('vi-VN')}`}
            </td>
            {coSo && <td />}
            <td />
            <td colSpan={2} className="kh-mut" style={{ fontWeight: 400 }}>
              {sua ? 'Enter = dòng kế · tự lưu sau 2 giây · Ctrl+S lưu ngay' : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * DANH SÁCH ĐẾM — điện thoại (bản vẽ KK-3 bên phải): người đếm cầm máy ra kệ.
 * Dòng chưa đếm lên đầu; ô số to, bàn phím số.
 */
export function DsDemDienThoai({ d }: { d: PhieuDemCtx }) {
  const ds = [...d.hien].sort(
    (a, b) => Number(d.soDem(a) != null) - Number(d.soDem(b) != null),
  )
  const sua = d.dangDem
  return (
    <div className="kh-grid kk-ds">
      {ds.map((l, i) => {
        const can = canChu(d, l)
        const daDem = d.soDem(l) != null
        return (
          <div key={l.id} className={can ? 'kk-it kk-can' : 'kk-it'}>
            <div>
              <b className="kh-ma">{l.code}</b>
              <div className="kk-ten">{l.name}</div>
              <span className="kh-mut">
                {l.unit}
                {l.ke ? ` · ${l.ke}` : ''}
                {daDem && <span className="kh-ok"> · đã đếm</span>}
              </span>
              {can && <div className="kh-warn kk-goi">{can}</div>}
            </div>
            {sua ? (
              <input
                id={`dem-${l.id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={can ? 'kh-o num kk-to need' : 'kh-o num kk-to'}
                value={chuO(d, l)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => d.go(l.id, { qty: e.target.value })}
                onKeyDown={(e) => xuong(e, ds, i)}
                aria-label={`Số đếm ${l.code}`}
                aria-invalid={!!can}
              />
            ) : (
              <span className="kh-num kh-b kk-to">{vietSo(l.dem)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
