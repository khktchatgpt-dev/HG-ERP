'use client'

import { tonNhan } from '@/lib/de-nghi-goi-y'
import { GoiY, OChu, OSo } from '../_erp/o-nhap'
import { GoiYGia, GoiYSoLuong, GoiYTen, TonO, VatO } from './goi-y-dong'
import { MUC_DICH_GOI_Y, type DongForm } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "2,5" = 2,5. Rỗng = null. */
const docSo = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * LƯỚI PHIẾU ĐỀ NGHỊ khi còn NHÁP / CHỜ DUYỆT (Kho lối ERP · B5, không kit). Số
 * hoá tờ giấy anh Hào gửi Zalo 13/10: Tên · ĐVT · SL · Đơn giá · Mục đích, cộng
 * TỒN HIỆN TẠI (lãnh đạo thấy vì sao cần mua) và giá mua gần nhất tự điền. Thứ
 * chưa có mã thì gõ tên tự do. Khung < 900px bỏ cột Tồn / VAT / Thành tiền (tồn
 * xuống dưới ô số lượng, VAT dưới ô giá).
 */
export function LuoiDeNghi({
  rows,
  sua,
  hep,
  patch,
  xoa,
  tong,
  soChuaMa,
  dsMucDich,
}: {
  rows: DongForm[]
  sua: boolean
  hep: boolean
  patch: (i: number, p: Partial<DongForm>) => void
  xoa: (i: number) => void
  tong: { hang: number; thieuGia: number }
  soChuaMa: number
  /** id `<datalist>` gợi ý mục đích. */
  dsMucDich: string
}) {
  const soCot = (hep ? 7 : 10) + (sua ? 1 : 0)
  return (
    <>
      <table className="kh-tb" aria-label="Dòng vật tư đề nghị mua">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: hep ? 86 : 100 }} />
          <col />
          <col style={{ width: 70 }} />
          {!hep && <col style={{ width: 96 }} />}
          <col style={{ width: hep ? 90 : 104 }} />
          <col style={{ width: 120 }} />
          {!hep && <col style={{ width: 86 }} />}
          {!hep && <col style={{ width: 116 }} />}
          <col style={{ width: hep ? 110 : 150 }} />
          {sua && <col style={{ width: 52 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            {!hep && <th className="r">Tồn hiện tại</th>}
            <th className="r">{hep ? 'SL' : 'Số lượng'}</th>
            <th className="r">{hep ? 'Giá dự kiến' : 'Đơn giá dự kiến'}</th>
            {!hep && <th>VAT</th>}
            {!hep && <th className="r">Thành tiền</th>}
            <th>{hep ? 'Mục đích' : 'Mục đích / tổ dùng'}</th>
            {sua && <th aria-label="Xoá dòng" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tuDo = !r.material_id
            const ton = tonNhan(r)
            return (
              <tr key={r.key} className="d f">
                <td className="kh-num kh-mut">{i + 1}</td>
                <td>
                  {r.code ? (
                    <span className="kh-ma">{r.code}</span>
                  ) : (
                    <span className="kh-tag warn">chưa có mã</span>
                  )}
                </td>
                <td className="go" title={r.name}>
                  {sua && tuDo ? (
                    <OChu
                      id={`dn-ten-${i}`}
                      value={r.name}
                      onCommit={(v) => patch(i, { name: v })}
                      placeholder="tên vật tư (chưa có mã)"
                      label={`Tên vật tư dòng ${i + 1}`}
                      tone={r.name.trim() ? undefined : 'nen'}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.name}
                    </span>
                  )}
                  <GoiYTen r={r} />
                </td>
                <td className={sua && tuDo ? 'go' : 'kh-mut'}>
                  {sua && tuDo ? (
                    <OChu
                      value={r.unit}
                      onCommit={(v) => patch(i, { unit: v })}
                      placeholder="ĐVT"
                      label={`ĐVT dòng ${i + 1}`}
                    />
                  ) : (
                    r.unit
                  )}
                </td>
                {!hep && (
                  <td className="r kh-num">
                    <TonO ton={ton} />
                  </td>
                )}
                <td className="r go">
                  {sua ? (
                    <OSo
                      id={`dn-qty-${i}`}
                      value={r.qty == null ? '' : String(r.qty)}
                      onCommit={(v) => patch(i, { qty: docSo(v) })}
                      label={`Số lượng ${r.code ?? r.name}`}
                    />
                  ) : (
                    <>
                      <b className="kh-num">
                        {r.qty == null ? '—' : fmt(r.approved_qty ?? r.qty)}
                      </b>
                      {r.approved_qty != null && r.qty != null && (
                        <GoiY tone="warn">đề nghị {fmt(r.qty)}</GoiY>
                      )}
                    </>
                  )}
                  <GoiYSoLuong ton={hep ? ton : null} />
                </td>
                <td className="r go">
                  {sua ? (
                    <OSo
                      value={r.unit_price == null ? '' : String(r.unit_price)}
                      onCommit={(v) => patch(i, { unit_price: docSo(v) })}
                      label={`Đơn giá dự kiến ${r.code ?? r.name}`}
                    />
                  ) : (
                    <span className="kh-num">
                      {r.unit_price == null ? '—' : fmt(r.unit_price)}
                    </span>
                  )}
                  <GoiYGia r={r} />
                  {hep && (
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: 3,
                      }}
                    >
                      <VatO r={r} sua={sua} onChange={(v) => patch(i, { vat_rate: v })} />
                    </span>
                  )}
                </td>
                {!hep && (
                  <td className={sua ? 'go' : undefined}>
                    <VatO r={r} sua={sua} onChange={(v) => patch(i, { vat_rate: v })} />
                  </td>
                )}
                {!hep && (
                  <td className="r kh-num">
                    {r.qty != null && r.unit_price != null ? (
                      fmt(Math.round(r.qty * r.unit_price))
                    ) : (
                      <span className="kh-empty">—</span>
                    )}
                  </td>
                )}
                <td className={sua ? 'go' : 'kh-mut'}>
                  {sua ? (
                    <OChu
                      value={r.purpose}
                      onCommit={(v) => patch(i, { purpose: v })}
                      placeholder="tổ / việc dùng"
                      label={`Mục đích dòng ${i + 1}`}
                      list={dsMucDich}
                    />
                  ) : (
                    r.purpose || '—'
                  )}
                </td>
                {sua && (
                  <td>
                    <button
                      type="button"
                      className="mo"
                      style={{ width: 'auto', color: 'var(--kh-stop)' }}
                      onClick={() => xoa(i)}
                      aria-label={`Xoá dòng ${i + 1}`}
                    >
                      Xoá
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={soCot}
                className="kh-mut"
                style={{ textAlign: 'center', padding: 22 }}
              >
                {sua
                  ? 'Chưa có dòng nào — gõ mã hoặc tên ở ô “Thêm dòng”; thứ chưa có mã thì bấm “+ Dòng chưa có mã”.'
                  : 'Phiếu không có dòng nào.'}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={hep ? 6 : 8}>
              {rows.length} dòng
              {soChuaMa > 0 && ` · ${soChuaMa} dòng chưa có mã (gắn mã khi nhập kho)`}
            </td>
            {!hep && <td className="r kh-num">{fmt(tong.hang)}</td>}
            <td colSpan={sua ? 2 : 1} style={{ fontWeight: 400 }}>
              {hep ? `${fmt(tong.hang)} · ` : ''}tiền hàng chưa VAT
              {tong.thieuGia > 0 && ` · ${tong.thieuGia} dòng chưa có giá`}
            </td>
          </tr>
        </tfoot>
      </table>
      <datalist id={dsMucDich}>
        {MUC_DICH_GOI_Y.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </>
  )
}
