'use client'

import { Fragment } from 'react'
import { tenNccGon } from '@/lib/theo-doi-loc'
import {
  chiDongTuDo,
  ngay,
  ngayBatThuong,
  soNgayToi,
  type HangVeRow,
} from '@/lib/kho-hang-ve'
import type { SapDatRow } from '@/lib/kho-lich-hang-ve'

/**
 * ĐIỆN THOẠI (K5) của Nhận hàng: danh sách phẳng — chạm đơn là mở phiếu nhận
 * (hoặc xem hàng của đơn khi không nhận được). Không cuộn ngang. Đơn sắp đặt
 * nằm cuối, chỉ xem. (Tách khỏi HangVeScreen 27/10/2026 khi màn chạm trần 800 dòng.)
 */
export function DsDienThoai({
  nhom,
  sapKept,
  today,
  nhanDuoc,
  onNhan,
  onXem,
}: {
  nhom: { key: string; ten: string; mau: string; rows: HangVeRow[] }[]
  sapKept: SapDatRow[]
  today: string
  nhanDuoc: (r: HangVeRow) => boolean
  onNhan: (r: HangVeRow) => void
  onXem: (poId: string) => void
}) {
  return (
    <div className="kh-pl" aria-label="Đơn đang về">
      {nhom.map((g) => (
        <Fragment key={g.key}>
          <div className={`kh-pl-sec ${g.mau}`}>
            {g.ten} · {g.rows.length}
          </div>
          {g.rows.map((r) => {
            const n = r.expected_at ? soNgayToi(r.expected_at, today) : null
            const tre = !ngayBatThuong(r.expected_at, today) && n != null && n < 0 ? -n : 0 // prettier-ignore
            const duoc = nhanDuoc(r)
            return (
              <button
                key={r.po_id}
                type="button"
                className="kh-pl-row"
                onClick={() => (duoc ? onNhan(r) : onXem(r.po_id))}
              >
                <span style={{ minWidth: 0 }}>
                  <span className="kh-ma" style={{ color: 'var(--kh-act)' }}>
                    {r.po_code}
                  </span>
                  {r.su_co_mo > 0 && (
                    <span className="kh-tag warn" style={{ marginLeft: 6 }}>
                      {r.su_co_mo} sự cố
                    </span>
                  )}
                  <span
                    className="s"
                    style={{ display: 'block', color: 'var(--kh-ink)', fontWeight: 600 }}
                  >
                    {tenNccGon(r.supplier_name)}
                  </span>
                  <span className="s" style={{ display: 'block' }}>
                    {r.lsx_code ?? 'ngoài lệnh'} · về {r.lines_done}/{r.lines_total} dòng
                    {r.owner_name && ` · ${r.owner_name}`}
                  </span>
                </span>
                <span className="r">
                  <span
                    className={tre ? 'kh-stop kh-num' : 'kh-num'}
                    style={{ display: 'block' }}
                  >
                    {r.expected_at ? ngay(r.expected_at, today) : 'chưa hẹn'}
                  </span>
                  {tre > 0 && <span className="kh-stop">trễ {tre} ngày</span>}
                  <span
                    style={{
                      display: 'block',
                      color: duoc ? 'var(--kh-act)' : 'var(--kh-ink3)',
                      fontWeight: 600,
                    }}
                  >
                    {duoc ? 'Nhận ›' : chiDongTuDo(r) ? 'ngoài sổ ›' : 'xem ›'}
                  </span>
                </span>
              </button>
            )
          })}
        </Fragment>
      ))}
      {sapKept.length > 0 && (
        <>
          <div className="kh-pl-sec c-mut">Sắp đặt · chỉ xem · {sapKept.length}</div>
          {sapKept.map((s) => (
            <button
              key={s.po_id}
              type="button"
              className="kh-pl-row"
              onClick={() => onXem(s.po_id)}
            >
              <span style={{ minWidth: 0 }}>
                <span className="kh-ma">{s.po_code}</span>
                <span className="s" style={{ display: 'block' }}>
                  {tenNccGon(s.supplier_name)} · {s.owner_name ?? '—'}
                </span>
              </span>
              <span className="r kh-mut">
                {s.expected_at ? ngay(s.expected_at, today) : 'chưa hẹn'} · xem ›
              </span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
