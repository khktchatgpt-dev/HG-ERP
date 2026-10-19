'use client'

import { useState } from 'react'
import Link from 'next/link'
import { isoToVn } from '@/lib/date-vn'
import { lenhGon, type LenhDong, type MaChiTiet } from './ton-lenh.shared'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const EPS = 1e-6

type Ngan = 'con' | 'het' | 'du'

/**
 * CHI TIẾT MỘT LỆNH — mở NGAY DƯỚI DÒNG của Tồn kho theo lệnh (Kho lối ERP · B1,
 * K2: chi tiết dưới dòng thay hộp nổi). Chỉ để xem; nút duy nhất là "Xuất cho
 * lệnh này" (mở phiếu xuất đã chọn sẵn lệnh).
 *
 * Ba ngăn: Còn trong kho · Kho hết · Đã xuất đủ. Mã chung với lệnh khác thì nói
 * rõ lệnh kia; ở ngăn Kho hết mỗi dòng nói VÌ SAO (tồn 0, hay tồn đang chia cho
 * lệnh hạn xuất sớm hơn — NK-0044 của 06-MX đang chia cho YOTRIO).
 */
export function LenhChiTiet({ lenh, rows }: { lenh: LenhDong; rows: MaChiTiet[] }) {
  const con = rows.filter((r) => r.con > EPS && r.chia > EPS)
  const het = rows.filter((r) => r.con > EPS && r.chia <= EPS)
  const du = rows.filter((r) => r.con <= EPS)
  const [ngan, setNgan] = useState<Ngan>(con.length > 0 ? 'con' : het.length > 0 ? 'het' : 'du') // prettier-ignore
  const theoMa = (a: MaChiTiet, b: MaChiTiet) => a.code.localeCompare(b.code, 'vi')
  const ds = (ngan === 'con' ? con : ngan === 'het' ? het : du).slice().sort(theoMa)
  const thieu = (r: MaChiTiet) => r.chia < r.con - EPS

  return (
    <div role="region" aria-label={`Hàng của lệnh ${lenh.code}`}>
      <div className="kh-in-tabs" role="tablist" aria-label="Hàng của lệnh">
        {(
          [
            ['con', 'Còn trong kho', con.length],
            ['het', 'Kho hết', het.length],
            ['du', 'Đã xuất đủ', du.length],
          ] as const
        ).map(([id, ten, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={ngan === id}
            onClick={() => setNgan(id)}
          >
            {ten} <span className="kh-num">{n}</span>
          </button>
        ))}
        <span className="sp">
          {lenh.xuat_cuoi
            ? `xuất gần nhất ${isoToVn(lenh.xuat_cuoi)}`
            : 'chưa ghi xuất lần nào'}
          {!lenh.xong && con.length > 0 && (
            <Link href={`/warehouse/xuat?lsx=${lenh.id}`} className="kh-btn p">
              Xuất cho lệnh này
            </Link>
          )}
        </span>
      </div>

      {ds.length === 0 ? (
        <div className="kh-in-rong">
          {ngan === 'con'
            ? 'Kho không còn hàng nào của lệnh này để xuất.'
            : ngan === 'het'
              ? 'Mọi mã còn phần của lệnh đều còn hàng trong kho.'
              : 'Chưa mã nào đã xuất đủ phần đã về.'}
        </div>
      ) : (
        <table
          className="kh-in"
          aria-label={
            ngan === 'con'
              ? 'Mã còn trong kho'
              : ngan === 'het'
                ? 'Mã kho hết'
                : 'Mã đã xuất đủ'
          }
        >
          <colgroup>
            <col style={{ width: 96 }} />
            <col />
            <col style={{ width: 56 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            {ngan !== 'du' && <col style={{ width: 108 }} />}
            {ngan === 'con' && <col style={{ width: 88 }} />}
            {ngan !== 'du' && <col style={{ width: ngan === 'con' ? 190 : 280 }} />}
          </colgroup>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên vật tư</th>
              <th>ĐVT</th>
              <th className="r">Đã về</th>
              <th className="r">Đã xuất</th>
              {ngan !== 'du' && <th className="r">Còn của lệnh</th>}
              {ngan === 'con' && <th className="r">Kho chia</th>}
              {ngan !== 'du' && <th>{ngan === 'con' ? 'Ghi chú' : 'Vì sao kho hết'}</th>}
            </tr>
          </thead>
          <tbody>
            {ds.map((r) => (
              <tr key={r.material_id}>
                <td className="kh-ma">{r.code}</td>
                <td title={r.name} className={ngan === 'het' ? 'kh-mut' : undefined}>
                  {r.name}
                </td>
                <td className="kh-mut">{r.unit}</td>
                <td className="r kh-num">{so(r.ve)}</td>
                <td className="r kh-num kh-mut">{r.xuat > EPS ? so(r.xuat) : '·'}</td>
                {ngan !== 'du' && <td className="r kh-num kh-b">{so(r.con)}</td>}
                {ngan === 'con' && (
                  <td className={`r kh-num${thieu(r) ? 'kh-warn' : ''}`}>{so(r.chia)}</td>
                )}
                {ngan !== 'du' && (
                  <td
                    title={
                      r.chung.length > 0 ? `Chung với ${r.chung.join(', ')}` : undefined
                    }
                  >
                    {ngan === 'con' ? (
                      <>
                        {thieu(r) && (
                          <span className="kh-tag warn">thiếu {so(r.con - r.chia)}</span>
                        )}
                        {r.chung.length > 0 && (
                          <span className="kh-tag">
                            chung {r.chung.map(lenhGon).join(', ')}
                          </span>
                        )}
                      </>
                    ) : r.ton > EPS && r.chung.length > 0 ? (
                      `Kho còn ${so(r.ton)}, đang chia cho ${r.chung.map(lenhGon).join(', ')}`
                    ) : (
                      'Tồn dùng được bằng 0'
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="kh-in-rong" style={{ padding: '6px 12px', fontSize: 11.5 }}>
        {lenh.xong
          ? 'Lệnh đã xong: kho không còn hàng của lệnh, không ghi xuất bù (sẽ làm âm tồn). '
          : 'Ghi xuất ở phiếu xuất — số điền sẵn đúng cột "Kho chia". '}
        Số theo ĐVT từng mã, không cộng dồn.
      </div>
    </div>
  )
}
