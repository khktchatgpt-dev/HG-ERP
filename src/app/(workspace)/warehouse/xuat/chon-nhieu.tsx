'use client'

import { useMemo, useState } from 'react'
import { locChonNhieu, nhomCoTon, type VatTuTon } from '@/lib/kho-chon-vat-tu'
import { HopThoai } from '../_erp/o-nhap'
import type { LayHang } from './hang-lenh'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "108,40" = 108,4. Ô trống = 0; chữ lạ = NaN (báo sai). */
const docSo = (v: string) =>
  v.trim() === '' ? 0 : Number(v.trim().replace(/\./g, '').replace(',', '.'))
/** Bày tối đa chừng này dòng — lọc thêm để thấy phần còn lại (tập còn tồn sẽ lớn sau kiểm kê). */
const TRAN = 300

/**
 * CHỌN NHIỀU TỪ TỒN KHO — hộp của màn Xuất hàng (27/10/2026). Chủ dự án: "chỉ
 * chọn 1 lần thì phải thao tác lặp đi lặp lại nhiều lần". Cùng lối với hộp "Lấy
 * hàng của lệnh" mà Kho đã quen: tích mã, gõ số lấy, đưa cả loạt vào phiếu.
 *
 * Danh sách là các mã CÒN TỒN màn đã nạp sẵn — lọc, tích, gõ số đều tại máy,
 * không gọi server. Gõ số vào dòng nào là dòng đó tự được tích; Enter ở ô số
 * xuống dòng dưới (đi một mạch như bảng tính); Ctrl+Enter đưa vào phiếu.
 */
export function ChonNhieuHop({
  ds,
  cuaLenh,
  lsxCode,
  trongPhieu,
  onClose,
  onLay,
}: {
  ds: readonly VatTuTon[]
  /** Mã đã về cho lệnh đang chọn — gắn nhãn, xếp lên đầu, có nút lọc riêng. */
  cuaLenh: ReadonlySet<string>
  lsxCode: string | null
  /** id → số thứ tự dòng (1-based) của mã đã có trong phiếu. */
  trongPhieu: ReadonlyMap<string, number>
  onClose: () => void
  onLay: (chon: LayHang[]) => void
}) {
  const [q, setQ] = useState('')
  const [nhom, setNhom] = useState('')
  const [chiCuaLenh, setChiCuaLenh] = useState(false)
  const [chon, setChon] = useState<Set<string>>(() => new Set())
  const [soLay, setSoLay] = useState<Record<string, string>>({})

  const nhomDs = useMemo(() => nhomCoTon(ds), [ds])
  const hien = useMemo(
    () => locChonNhieu(ds, { q, nhom, chiCuaLenh, cuaLenh }),
    [ds, q, nhom, chiCuaLenh, cuaLenh],
  )
  const bay = hien.slice(0, TRAN)

  const lay = ds
    .filter((vt) => chon.has(vt.id))
    .map((vt) => ({ vt, raw: soLay[vt.id] ?? '' }))
    .map((x) => ({ ...x, qty: docSo(x.raw) }))
  const sai = lay.filter((x) => !Number.isFinite(x.qty) || x.qty < 0)
  const vuot = lay.filter((x) => x.qty > x.vt.qty_ok)
  const coThe = lay.length > 0 && sai.length === 0

  const tich = (id: string, on: boolean) =>
    setChon((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const oSo = (id: string) =>
    document.getElementById(`chon-nhieu-${id}`) as HTMLInputElement | null
  const xuongDuoi = (i: number) => {
    for (let j = i + 1; j < bay.length; j++) {
      const el = oSo(bay[j].id)
      if (el) {
        el.focus()
        el.select()
        return
      }
    }
  }
  const dua = () => {
    if (!coThe) return
    onLay(
      lay.map(({ vt, qty }) => ({
        id: vt.id,
        code: vt.code,
        name: vt.name,
        unit: vt.unit,
        qty_ok: vt.qty_ok,
        qty,
      })),
    )
  }

  return (
    <HopThoai
      title="Chọn nhiều từ tồn kho"
      subtitle={`${ds.length} mã đang có tồn dùng được · gõ số vào dòng nào là dòng đó được chọn`}
      onClose={onClose}
      width={980}
      footer={
        <>
          <span
            className={sai.length > 0 || vuot.length > 0 ? 'kh-warn' : 'kh-mut'}
            style={{ marginRight: 'auto', fontSize: 12, alignSelf: 'center' }}
          >
            {sai.length > 0
              ? `Số chưa đúng ở ${sai.map((x) => x.vt.code).join(', ')}`
              : vuot.length > 0
                ? `${vuot.map((x) => x.vt.code).join(', ')} lấy quá tồn — ghi sổ sẽ bị chặn, sửa trước khi ghi`
                : 'Để trống số thì dòng vào phiếu với số 0, gõ tiếp trong lưới.'}
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={!coThe}
            onClick={dua}
            title="Ctrl + Enter"
          >
            Đưa {lay.length} dòng vào phiếu
          </button>
        </>
      }
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            dua()
          }
        }}
      >
        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <input
            className="kh-o"
            style={{ width: 240 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Lọc mã, tên, kệ…"
            aria-label="Lọc mã còn tồn"
          />
          <select
            className="kh-o"
            style={{ width: 200 }}
            value={nhom}
            onChange={(e) => setNhom(e.target.value)}
            aria-label="Nhóm vật tư"
          >
            <option value="">Mọi nhóm ({ds.length})</option>
            {nhomDs.map((n) => (
              <option key={n.nhom} value={n.nhom}>
                {n.nhom} ({n.so})
              </option>
            ))}
          </select>
          {lsxCode && cuaLenh.size > 0 && (
            <span className="kh-loc-nho" role="group" aria-label="Phạm vi">
              <button
                type="button"
                aria-pressed={!chiCuaLenh}
                onClick={() => setChiCuaLenh(false)}
              >
                Mọi mã còn tồn
              </button>
              <button
                type="button"
                aria-pressed={chiCuaLenh}
                onClick={() => setChiCuaLenh(true)}
              >
                Chỉ hàng của lệnh {lsxCode}
              </button>
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12.5 }}>
            Đã chọn <b className="kh-num">{chon.size}</b>
            {chon.size > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="kh-lnk"
                  style={{ fontFamily: 'inherit' }}
                  onClick={() => setChon(new Set())}
                >
                  bỏ chọn hết
                </button>
              </>
            )}
          </span>
        </span>

        <div
          style={{
            maxHeight: 'min(52vh, 460px)',
            overflow: 'auto',
            border: '1px solid var(--kh-line)',
          }}
        >
          <table className="kh-in dinh" aria-label="Mã còn tồn">
            <colgroup>
              <col style={{ width: 34 }} />
              <col style={{ width: 96 }} />
              <col />
              <col style={{ width: 64 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th aria-label="Chọn" />
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th>ĐVT</th>
                <th>Kệ</th>
                <th className="r">Tồn dùng được</th>
                <th className="r">Lấy lần này</th>
              </tr>
            </thead>
            <tbody>
              {bay.map((vt, i) => {
                const dong = trongPhieu.get(vt.id)
                const on = chon.has(vt.id)
                const raw = soLay[vt.id] ?? ''
                const qty = docSo(raw)
                const qua = on && qty > vt.qty_ok
                return (
                  <tr key={vt.id}>
                    <td>
                      {dong ? (
                        <span
                          className="kh-empty"
                          title={`Đã có ở dòng ${dong} của phiếu`}
                        >
                          —
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`Chọn ${vt.code}`}
                          onChange={(e) => {
                            tich(vt.id, e.target.checked)
                            if (e.target.checked) oSo(vt.id)?.focus()
                          }}
                        />
                      )}
                    </td>
                    <td className="kh-ma">{vt.code}</td>
                    <td title={vt.name}>
                      {cuaLenh.has(vt.id) && <span className="kh-tag run">của lệnh</span>}
                      {vt.name}
                    </td>
                    <td className="kh-mut">{vt.unit}</td>
                    <td className="kh-mut">{vt.ke ?? '—'}</td>
                    <td className="r kh-num">{so(vt.qty_ok)}</td>
                    <td className="r">
                      {dong ? (
                        <span className="kh-mut">đã có ở dòng {dong}</span>
                      ) : (
                        <input
                          id={`chon-nhieu-${vt.id}`}
                          className={qua ? 'kh-o num need' : 'kh-o num'}
                          value={raw}
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label={`Lấy lần này ${vt.code}`}
                          title={qua ? `Tồn dùng được chỉ ${so(vt.qty_ok)}` : undefined}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const v = e.target.value
                            setSoLay((m) => ({ ...m, [vt.id]: v }))
                            // Gõ số là chọn — đỡ một cú bấm ô tích cho mỗi dòng.
                            if (v.trim() !== '' && !on) tich(vt.id, true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault()
                              xuongDuoi(i)
                            }
                          }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
              {bay.length === 0 && (
                <tr>
                  <td colSpan={7} className="kh-in-rong">
                    {ds.length === 0
                      ? 'Kho chưa có mã nào còn tồn dùng được — nhận hàng hoặc Cập nhật số thực tế trước khi xuất.'
                      : 'Không mã còn tồn nào khớp bộ lọc — bỏ bớt chữ lọc hoặc chọn "Mọi nhóm".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hien.length > TRAN && (
          <p className="kh-mut" style={{ fontSize: 12 }}>
            Đang bày {TRAN} / {hien.length} mã — gõ thêm chữ lọc để thấy phần còn lại.
          </p>
        )}
      </div>
    </HopThoai>
  )
}
