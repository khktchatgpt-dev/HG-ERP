'use client'

import Link from 'next/link'
import { isoToVn } from '@/lib/date-vn'
import { conPhaiNhap } from '@/lib/de-nghi-nhap'
import { GoiY } from '../_erp/o-nhap'
import type { DongForm } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/**
 * TÌNH HÌNH NHẬP của phiếu đề nghị đã duyệt (0238 · Đ4, bản vẽ DN-5), viết lại
 * không kit (Kho lối ERP · B5). Mỗi dòng nói đã nhập bao nhiêu trên số duyệt, ở
 * phiếu nhập nào (bấm mở PNK). Đếm từ SỔ KHO — đảo một PNK thì số ở đây tự lùi.
 * Khung < 900px: cột Phiếu nhập xuống thành gợi ý dưới Đã nhập.
 */
export function TinhHinhNhap({
  rows,
  hep,
  daChot,
}: {
  rows: DongForm[]
  hep: boolean
  /** Phiếu đã "Chốt xong" (Q14) — dòng thiếu ghi "chốt thiếu". */
  daChot: boolean
}) {
  const muaDong = rows.filter((r) => (r.can ?? 0) > 0)
  const du = muaDong.filter((r) => conPhaiNhap(r.can ?? 0, r.da_nhap ?? 0) <= 0).length
  return (
    <table className="kh-tb" aria-label="Tình hình nhập theo phiếu đề nghị">
      <colgroup>
        <col style={{ width: 34 }} />
        <col style={{ width: hep ? 86 : 100 }} />
        <col />
        <col style={{ width: 56 }} />
        <col style={{ width: 92 }} />
        <col style={{ width: 92 }} />
        {!hep && <col style={{ width: 200 }} />}
        <col style={{ width: hep ? 110 : 140 }} />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Mã</th>
          <th>Tên vật tư</th>
          <th>ĐVT</th>
          <th className="r">Số duyệt</th>
          <th className="r">Đã nhập</th>
          {!hep && <th>Phiếu nhập</th>}
          <th>Tình trạng</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const can = r.can ?? r.approved_qty ?? r.qty ?? 0
          const da = r.da_nhap ?? 0
          const con = conPhaiNhap(can, da)
          const phieu = r.phieu_nhap ?? []
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
              <td title={r.name}>{r.name}</td>
              <td className="kh-mut">{r.unit}</td>
              <td className="r kh-num go">
                <b>{fmt(can)}</b>
                {r.approved_qty != null && r.qty != null && (
                  <GoiY tone="warn">đề nghị {fmt(r.qty)}</GoiY>
                )}
              </td>
              <td className="r kh-num go">
                {da > 0 ? fmt(da) : <span className="kh-empty">0</span>}
                {hep && phieu.length > 0 && (
                  <GoiY>{phieu.map((p) => p.code).join(', ')}</GoiY>
                )}
              </td>
              {!hep && (
                <td className="go">
                  {phieu.length === 0 ? (
                    <span className="kh-empty">—</span>
                  ) : (
                    phieu.map((p) => (
                      <span key={p.doc_id} style={{ display: 'block' }}>
                        <span className="kh-sq c-nhap" aria-hidden />
                        <Link href={`/warehouse/phieu/${p.doc_id}`} className="kh-lnk">
                          {p.code}
                        </Link>
                        <span className="kh-mut" style={{ fontSize: 12 }}>
                          {' '}
                          {isoToVn(p.doc_date)}
                          {phieu.length > 1 && ` · ${fmt(p.qty)}`}
                        </span>
                      </span>
                    ))
                  )}
                </td>
              )}
              <td>
                {can <= 0 ? (
                  <span className="kh-tag">không mua</span>
                ) : con <= 0 ? (
                  <span className="kh-tag done">
                    {da > can ? `đủ · vượt ${fmt(da - can)}` : 'đủ'}
                  </span>
                ) : daChot ? (
                  <span className="kh-tag">chốt thiếu {fmt(con)}</span>
                ) : (
                  <span className="kh-tag warn">còn {fmt(con)}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={hep ? 7 : 8}>
            Đã nhập đủ {du}/{muaDong.length} dòng
            {rows.length > muaDong.length &&
              ` · ${rows.length - muaDong.length} dòng lãnh đạo duyệt 0 (không mua)`}
            {' · '}số đếm từ sổ kho, đảo phiếu nhập thì tự lùi
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
