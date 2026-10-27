'use client'

import { useRef, type KeyboardEvent } from 'react'
import { thieuTon, type DongXuat } from '@/lib/kho-phieu-xuat'
import { useBeRong } from '@/lib/use-be-rong'
import { GoiY, OChu, OSo, docSoVn } from '../_erp/o-nhap'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/**
 * LƯỚI PHIẾU XUẤT — Kho lối ERP · B3, không kit. Một mã một dòng; tồn dùng được
 * tra lúc thêm dòng; thiếu tồn nói ngay dưới ô Lần này (không chặn — server là
 * người quyết). Khung < 600px (điện thoại): mỗi dòng một khối, ô số to.
 */
export function LuoiXuat({
  rows,
  patch,
  xoa,
  tong,
}: {
  rows: DongXuat[]
  patch: (i: number, p: Partial<DongXuat>) => void
  xoa: (i: number) => void
  tong: { tong: number; so_dong: number }
}) {
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  /*
    Enter ở ô Lần này: xuống ô số dòng dưới; dòng cuối thì về ô tìm "+ Thêm dòng"
    (27/10/2026) — cả phiếu đi bằng bàn phím: gõ mã ↵ gõ số ↵ gõ mã ↵ … Ô số tự
    lưu ở Enter trước (handler của ô chạy trước, sự kiện mới nổi lên tới đây).
  */
  const sangO = (i: number) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return
    const ke = document.getElementById(
      i + 1 < rows.length ? `xuat-qty-${i + 1}` : 'xuat-tim',
    ) as HTMLInputElement | null
    ke?.focus()
    ke?.select()
  }

  if (rong > 0 && rong < 600)
    return (
      <div ref={khung} className="kh-pl" aria-label="Dòng hàng xuất">
        {rows.length === 0 && (
          <div className="kh-pl-dong kh-mut">
            <span className="full">
              Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô “Thêm dòng”.
            </span>
          </div>
        )}
        {rows.map((r, i) => {
          const th = thieuTon(r)
          return (
            <div key={r.id} className="kh-pl-dong">
              <span style={{ minWidth: 0 }}>
                <span className="kh-ma">{r.code}</span>
                <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
                <span
                  className="kh-mut kh-num"
                  style={{ display: 'block', fontSize: 12 }}
                >
                  tồn {r.qty_ok == null ? '?' : fmt(r.qty_ok)} {r.unit}
                </span>
              </span>
              <span onKeyDown={sangO(i)}>
                <OSo
                  id={`xuat-qty-${i}`}
                  value={String(r.qty)}
                  onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                  label={`Lần này ${r.code}`}
                  tone={th != null ? 'need' : undefined}
                />
                {th != null && <GoiY tone="warn">thiếu {fmt(th)}</GoiY>}
              </span>
              <span className="full" style={{ display: 'flex', gap: 8 }}>
                <span style={{ flex: 1 }}>
                  <OChu
                    value={r.note}
                    onCommit={(v) => patch(i, { note: v })}
                    placeholder="ghi chú (không bắt buộc)"
                    label={`Ghi chú ${r.code}`}
                  />
                </span>
                <button
                  type="button"
                  className="kh-btn"
                  onClick={() => xoa(i)}
                  aria-label={`Xoá dòng ${r.code}`}
                >
                  Xoá
                </button>
              </span>
            </div>
          )
        })}
      </div>
    )

  return (
    <div ref={khung} className="kh-grid">
      <table className="kh-tb" aria-label="Dòng hàng xuất">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: 124 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: rong > 0 && rong < 1000 ? 180 : 280 }} />
          <col style={{ width: 56 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r">Tồn dùng được</th>
            <th className="r">Lần này</th>
            <th>Ghi chú</th>
            <th aria-label="Xoá dòng" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const th = thieuTon(r)
            return (
              <tr key={r.id} className="d f">
                <td className="kh-num kh-mut">{i + 1}</td>
                <td className="kh-ma">{r.code}</td>
                <td title={r.name}>{r.name}</td>
                <td className="kh-mut">{r.unit}</td>
                <td className="r kh-num">
                  {r.qty_ok == null ? <span className="kh-empty">?</span> : fmt(r.qty_ok)}
                </td>
                <td className="r go" onKeyDown={sangO(i)}>
                  <OSo
                    id={`xuat-qty-${i}`}
                    value={String(r.qty)}
                    onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                    label={`Lần này ${r.code}`}
                    tone={th != null ? 'need' : undefined}
                  />
                  {th != null && (
                    <GoiY tone="warn">
                      tồn {fmt(r.qty_ok ?? 0)} — thiếu {fmt(th)}
                    </GoiY>
                  )}
                </td>
                <td className="go">
                  <OChu
                    value={r.note}
                    onCommit={(v) => patch(i, { note: v })}
                    placeholder="ghi chú (không bắt buộc)"
                    label={`Ghi chú ${r.code}`}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="mo"
                    style={{ width: 'auto', color: 'var(--kh-stop)' }}
                    onClick={() => xoa(i)}
                    aria-label={`Xoá dòng ${r.code}`}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="kh-mut"
                style={{ textAlign: 'center', padding: 20 }}
              >
                Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô “Thêm dòng” phía trên, bấm
                “Chọn nhiều từ tồn kho”, hoặc “Lấy hàng của lệnh”.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>Tổng · {rows.length} dòng</td>
            <td className="r kh-num">{fmt(tong.tong)}</td>
            <td colSpan={2} style={{ fontWeight: 400 }}>
              {tong.so_dong} dòng có số · nhiều ĐVT, tổng chỉ để đếm
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
