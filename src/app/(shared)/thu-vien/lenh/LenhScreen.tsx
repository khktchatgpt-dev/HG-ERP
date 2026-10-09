'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HO_SO_TEN } from '@/lib/ho-so-sp'
import { lsxStatusLabel } from '@/lib/lsx-status'
import type { LsxHoSo } from '@/modules/dept/technical/lsx-ho-so.service'
import { AnhNho, OHoSo } from '../thu-vien.shared'
import { dmyShort } from '../[id]/ho-so.shared'

/**
 * Trang theo dõi của Kỹ thuật: lệnh nào sắp xuất mà SP còn thiếu định mức / hồ
 * sơ. Dùng bộ thẻ `.hs` của hồ sơ SP. Lọc "Chỉ SP còn thiếu" giấu các dòng đã đủ
 * để mắt chỉ còn việc phải làm.
 */
export function LenhScreen({ lenh, all }: { lenh: LsxHoSo[]; all: boolean }) {
  const [chiThieu, setChiThieu] = useState(true)
  const [mo, setMo] = useState<Record<string, boolean>>({})
  // Mốc "hôm nay" lấy một lần khi mở trang — render thuần, không gọi Date.now() giữa chừng.
  const [now] = useState(() => Date.now())
  const tong = lenh.reduce(
    (a, l) => {
      a.sp += l.counts.sp
      a.thieuBom += l.counts.thieu_bom
      a.thieuSo += l.counts.thieu_so
      a.du += l.counts.du
      return a
    },
    { sp: 0, thieuBom: 0, thieuSo: 0, du: 0 },
  )
  const ngay = (s: string | null) => {
    if (!s) return { t: 'chưa chốt', tone: 'gray' }
    const d = Math.round((new Date(s).getTime() - now) / 86_400_000)
    return {
      t: `${dmyShort(s)} · ${d < 0 ? `quá ${-d} ngày` : d === 0 ? 'hôm nay' : `còn ${d} ngày`}`,
      tone: d < 0 ? 'bad' : d <= 14 ? 'warn' : 'gray',
    }
  }

  return (
    <div className="hs">
      <section className="card">
        <header className="head">
          <div style={{ minWidth: 0 }}>
            <div className="crumb">
              <Link href="/thu-vien">Thư viện sản phẩm</Link> › Lệnh sản xuất
            </div>
            <h1>Lệnh sản xuất · hồ sơ sản phẩm</h1>
            <div className="meta">
              <span className="chip">
                {lenh.length} lệnh {all ? '(cả đã xong)' : 'đang chạy'}
              </span>
              <span className="chip">{tong.sp} dòng SP</span>
              {tong.thieuBom > 0 && (
                <span className="pill bad">{tong.thieuBom} SP chưa có định mức</span>
              )}
              {tong.thieuSo > 0 && (
                <span className="pill warn">{tong.thieuSo} SP định mức thiếu số</span>
              )}
              <span className="pill ok">{tong.du} SP đủ hồ sơ</span>
            </div>
          </div>
          <div className="r">
            <button
              type="button"
              className={cn('btn', chiThieu && 'on')}
              onClick={() => setChiThieu(!chiThieu)}
            >
              {chiThieu ? 'Đang ẩn SP đã đủ' : 'Chỉ SP còn thiếu'}
            </button>
            <Link
              className="btn"
              href={all ? '/thu-vien/lenh' : '/thu-vien/lenh?tat_ca=1'}
            >
              {all ? 'Chỉ lệnh đang chạy' : 'Cả lệnh đã xong'}
            </Link>
          </div>
        </header>
      </section>

      {lenh.length === 0 && (
        <section className="card">
          <div className="pad">
            Không có lệnh nào đang chạy. Lệnh mới do Kế hoạch SX lập ở khu Sản xuất.
          </div>
        </section>
      )}

      {lenh.map((l) => {
        const n = ngay(l.ship_date)
        const rows = chiThieu
          ? l.lines.filter((r) => r.thieu.length > 0 || r.thieu_so > 0)
          : l.lines
        const open = mo[l.id] ?? true
        return (
          <section key={l.id} className="card">
            <div
              className="card-h sec-dm"
              style={{ cursor: 'pointer' }}
              onClick={() => setMo({ ...mo, [l.id]: !open })}
            >
              <h2>
                <span className="ic-sec">
                  <ClipboardList aria-hidden />
                </span>
                {l.code}
              </h2>
              <span className="sub">{l.customer ?? '—'}</span>
              <span className={cn('pill', n.tone)}>{n.t}</span>
              <span className="chip">{lsxStatusLabel(l.status)}</span>
              {l.revision > 0 && <span className="chip">bản #{l.revision}</span>}
              <span className="r">
                <span className="chip">{l.counts.sp} SP</span>
                <span className={cn('pill', l.counts.thieu_bom ? 'bad' : 'ok')}>
                  định mức {l.counts.bom}/{l.counts.sp}
                </span>
                {l.counts.thieu_so > 0 && (
                  <span className="pill warn">{l.counts.thieu_so} thiếu số</span>
                )}
                {l.counts.thieu_bv > 0 && (
                  <span className="pill warn">{l.counts.thieu_bv} thiếu bản vẽ</span>
                )}
                {l.counts.thieu_dg > 0 && (
                  <span className="pill warn">{l.counts.thieu_dg} thiếu đóng gói</span>
                )}
                {l.counts.thieu_anh > 0 && (
                  <span className="pill gray">{l.counts.thieu_anh} thiếu ảnh</span>
                )}
                <Link
                  className="btn xs"
                  href={`/mua-hang/yeu-cau/${l.id}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Hồ sơ lệnh (Cung ứng)"
                >
                  <ExternalLink size={12} aria-hidden />
                  Hồ sơ lệnh
                </Link>
              </span>
            </div>
            {open && (
              <table className="soi" aria-label={`SP trên lệnh ${l.code}`}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <span className="sr">Ảnh</span>
                    </th>
                    <th style={{ width: 120 }}>Mã HG</th>
                    <th>Tên sản phẩm</th>
                    <th className="num" style={{ width: 70 }}>
                      SL
                    </th>
                    <th style={{ width: 110 }}>Xuất</th>
                    <th style={{ width: 200 }}>Hồ sơ</th>
                    <th style={{ width: 150 }}>Định mức</th>
                    <th style={{ width: 220 }}>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.product_id || r.code}>
                      <td>
                        <AnhNho url={r.image_url} alt="" />
                      </td>
                      <td>
                        {r.product_id ? (
                          <Link
                            className="code"
                            href={`/thu-vien/${r.product_id}`}
                            title="Mở hồ sơ"
                          >
                            {r.code}
                          </Link>
                        ) : (
                          <span className="muted">{r.code}</span>
                        )}
                      </td>
                      <td title={r.name} style={{ maxWidth: 360 }}>
                        {r.name}
                        {r.locked && (
                          <span className="tag done" style={{ marginLeft: 6 }}>
                            khoá
                          </span>
                        )}
                      </td>
                      <td className="num">{r.qty.toLocaleString('vi-VN')}</td>
                      <td className="muted">
                        {r.ship_date ? dmyShort(r.ship_date) : '—'}
                      </td>
                      <td>
                        {r.check ? (
                          <OHoSo check={r.check} />
                        ) : (
                          <span className="muted">chưa có hồ sơ</span>
                        )}
                      </td>
                      <td>
                        {r.parts === 0 ? (
                          <span className="pill bad">Chưa có</span>
                        ) : r.thieu_so > 0 ? (
                          <span className="pill warn">
                            {r.parts} dòng · {r.thieu_so} thiếu số
                          </span>
                        ) : (
                          <span className="pill ok">{r.parts} dòng · đủ số</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'normal' }}>
                        {r.thieu.length === 0 && r.thieu_so === 0 ? (
                          <span className="muted">đủ</span>
                        ) : (
                          <span className="loi">
                            {[
                              ...r.thieu.map((o) => HO_SO_TEN[o]),
                              ...(r.thieu_so ? [`${r.thieu_so} dòng thiếu số`] : []),
                            ].join(' · ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="muted" style={{ textAlign: 'center' }}>
                        Mọi SP trên lệnh đã đủ hồ sơ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}
