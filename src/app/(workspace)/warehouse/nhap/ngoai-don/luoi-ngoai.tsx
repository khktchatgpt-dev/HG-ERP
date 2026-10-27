'use client'

import { useRef } from 'react'
import type { DongNhanNgoai, TinhTrangNhan } from '@/lib/kho-nhap-ngoai-don'
import { CHO_GHI_HANG_KHOA } from '@/lib/kho-phieu-nhap'
import { useBeRong } from '@/lib/use-be-rong'
import { GoiY, OChu, OSo, docSoVn } from '../../_erp/o-nhap'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

const TINH_TRANG: { value: TinhTrangNhan; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]

function OTinhTrang({
  r,
  patch,
  disabled,
}: {
  r: DongNhanNgoai
  patch: (p: Partial<DongNhanNgoai>) => void
  disabled: boolean
}) {
  return (
    <select
      className="kh-o"
      value={r.tinh_trang}
      onChange={(e) => patch({ tinh_trang: e.target.value as TinhTrangNhan })}
      aria-label={`Tình trạng ${r.code}`}
      disabled={disabled}
      style={r.tinh_trang === 'blocked' ? { color: 'var(--kh-warn)', fontWeight: 600 } : undefined} // prettier-ignore
    >
      {TINH_TRANG.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  )
}

/**
 * LƯỚI NHẬP NGOÀI ĐƠN — Kho lối ERP · B6, không kit. Không có cột Đặt / Đã về
 * (không có đơn để so); Tồn nay chỉ để đối chiếu bằng mắt — nhập không có trần.
 * Khung < 600px (điện thoại): mỗi dòng một khối, ô số to.
 */
export function LuoiNgoai({
  rows,
  patch,
  xoa,
  tong,
  busy,
}: {
  rows: DongNhanNgoai[]
  patch: (i: number, p: Partial<DongNhanNgoai>) => void
  xoa: (i: number) => void
  tong: { tong: number; so_dong: number; dung_duoc: number; vao_khoa: number }
  busy: boolean
}) {
  const khung = useRef<HTMLDivElement>(null)
  const rong = useBeRong(khung)
  /* "Sai quy cách" tạm ẩn (`CHO_GHI_HANG_KHOA`, 26/10/2026): mua ngoài đơn mà hàng
     sai thì không nhập phần sai — lô khoá chưa có lối ra. */
  const coTinhTrang = CHO_GHI_HANG_KHOA || rows.some((r) => r.tinh_trang === 'blocked')
  const ghiChuCho = (r: DongNhanNgoai) =>
    r.tinh_trang === 'blocked'
      ? 'bắt buộc: vì sao sai quy cách'
      : 'ghi chú (không bắt buộc)'

  if (rong > 0 && rong < 600)
    return (
      <div ref={khung} className="kh-pl" aria-label="Dòng hàng nhận">
        {rows.length === 0 && (
          <div className="kh-pl-dong kh-mut">
            <span className="full">
              Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô “Thêm dòng”.
            </span>
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.id} className="kh-pl-dong">
            <span style={{ minWidth: 0 }}>
              <span className="kh-ma">{r.code}</span>
              <span style={{ display: 'block', fontWeight: 600 }}>{r.name}</span>
              <span className="kh-mut kh-num" style={{ display: 'block', fontSize: 12 }}>
                tồn nay {r.ton == null ? '?' : fmt(r.ton)} {r.unit}
              </span>
            </span>
            <span>
              <OSo
                id={`nhan-qty-${i}`}
                value={String(r.qty)}
                onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                label={`Nhận ${r.code}`}
                disabled={busy}
              />
            </span>
            <span className="full" style={{ display: 'flex', gap: 8 }}>
              {coTinhTrang && (
                <OTinhTrang r={r} patch={(p) => patch(i, p)} disabled={busy} />
              )}
              <span style={{ flex: 1 }}>
                <OChu
                  id={`nhan-note-${i}`}
                  value={r.note}
                  onCommit={(v) => patch(i, { note: v })}
                  placeholder={ghiChuCho(r)}
                  label={`Ghi chú ${r.code}`}
                  disabled={busy}
                />
              </span>
              <button
                type="button"
                className="kh-btn"
                onClick={() => xoa(i)}
                aria-label={`Bỏ dòng ${r.code}`}
                disabled={busy}
              >
                Bỏ
              </button>
            </span>
          </div>
        ))}
      </div>
    )

  return (
    <div ref={khung} className="kh-grid">
      <table className="kh-tb" aria-label="Dòng hàng nhận">
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 104 }} />
          <col />
          <col style={{ width: 56 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 120 }} />
          {coTinhTrang && <col style={{ width: 132 }} />}
          <col style={{ width: rong > 0 && rong < 1000 ? 180 : 280 }} />
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>ĐVT</th>
            <th className="r" title="Chỉ để đối chiếu bằng mắt — nhập không có trần">
              Tồn nay
            </th>
            <th className="r">Nhận</th>
            {coTinhTrang && <th>Tình trạng</th>}
            <th>Ghi chú</th>
            <th aria-label="Bỏ dòng" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="d f">
              <td className="kh-num kh-mut">{i + 1}</td>
              <td className="kh-ma">{r.code}</td>
              <td title={r.name}>{r.name}</td>
              <td className="kh-mut">{r.unit}</td>
              <td className="r kh-num kh-mut">
                {r.ton == null ? <span className="kh-empty">?</span> : fmt(r.ton)}
              </td>
              <td className="r go">
                <OSo
                  id={`nhan-qty-${i}`}
                  value={String(r.qty)}
                  onCommit={(v) => patch(i, { qty: docSoVn(v) })}
                  label={`Nhận ${r.code}`}
                  disabled={busy}
                />
                {r.tinh_trang === 'blocked' && r.qty > 0 && (
                  <GoiY tone="warn">
                    {fmt(r.qty)} {r.unit} vào KHOÁ
                  </GoiY>
                )}
              </td>
              {coTinhTrang && (
                <td className="go">
                  <OTinhTrang r={r} patch={(p) => patch(i, p)} disabled={busy} />
                </td>
              )}
              <td className="go">
                <OChu
                  id={`nhan-note-${i}`}
                  value={r.note}
                  onCommit={(v) => patch(i, { note: v })}
                  placeholder={ghiChuCho(r)}
                  label={`Ghi chú ${r.code}`}
                  disabled={busy}
                />
              </td>
              <td>
                <button
                  type="button"
                  className="mo"
                  style={{ width: 'auto', color: 'var(--kh-stop)' }}
                  onClick={() => xoa(i)}
                  aria-label={`Bỏ dòng ${r.code}`}
                  disabled={busy}
                >
                  Bỏ
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={coTinhTrang ? 9 : 8}
                className="kh-mut"
                style={{ textAlign: 'center', padding: 20 }}
              >
                Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô “Thêm dòng” phía trên. Mã
                chưa có trong danh mục thì xin mã ở{' '}
                <a
                  className="kh-lnk"
                  href="/warehouse/vat-tu"
                  target="_blank"
                  rel="noreferrer"
                >
                  Danh mục vật tư ↗
                </a>{' '}
                rồi quay lại.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>Tổng · {rows.length} dòng</td>
            <td className="r kh-num">{fmt(tong.tong)}</td>
            <td colSpan={coTinhTrang ? 3 : 2} style={{ fontWeight: 400 }}>
              {tong.so_dong} dòng có số
              {coTinhTrang &&
                ` · ${fmt(tong.dung_duoc)} dùng được · ${fmt(tong.vao_khoa)} vào khoá`}{' '}
              · nhiều ĐVT, tổng chỉ để đếm
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
