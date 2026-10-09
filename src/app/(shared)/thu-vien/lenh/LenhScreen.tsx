'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { HO_SO_TEN, type HoSoO } from '@/lib/ho-so-sp'
import { lsxStatusLabel } from '@/lib/lsx-status'
import type { LsxHoSo, LsxHoSoLine } from '@/modules/dept/technical/lsx-ho-so.service'
import { AnhNho, OHoSo } from '../thu-vien.shared'
import { dmyShort } from '../[id]/ho-so.shared'

type Loc = '' | 'bom' | 'so' | 'bv' | 'dg' | 'anh' | 'du'

/**
 * LỆNH SX · HỒ SƠ SP — khuôn C · Danh sách theo kiểu ERP (09/10/2026, chủ dự án:
 * "thiết kế thiên hướng ERP"): cùng hệ với /thu-vien — thanh đầu có dữ kiện bấm
 * được, hàng lọc, MỘT lưới dày tiêu đề dính + chân tổng, mỗi lệnh là một hàng
 * nhóm mang số đếm, không thẻ nổi. Câu hỏi của màn: "lệnh nào sắp xuất mà SP còn
 * thiếu định mức / hồ sơ?" — sắp theo ngày xuất gần nhất, mặc định ẩn SP đã đủ.
 */
export function LenhScreen({ lenh, all }: { lenh: LsxHoSo[]; all: boolean }) {
  const [loc, setLoc] = useState<Loc>('')
  const [chiThieu, setChiThieu] = useState(true)
  const [q, setQ] = useState('')
  const [kh, setKh] = useState('')
  const [maLenh, setMaLenh] = useState('')
  /** Xuất trong N ngày tới (0 = mọi lệnh). */
  const [xuat, setXuat] = useState(0)
  const [now] = useState(() => Date.now())

  const khach = [
    ...new Set(lenh.map((l) => l.customer).filter((v): v is string => !!v)),
  ].sort()
  const conNgay = (s: string | null) =>
    s ? Math.round((new Date(s).getTime() - now) / 86_400_000) : null
  const thieuCua = (r: LsxHoSoLine) => r.thieu.length > 0 || r.thieu_so > 0
  const khop = (r: LsxHoSoLine) => {
    if (loc === 'bom') return r.thieu.includes('bom')
    if (loc === 'so') return r.thieu_so > 0
    if (loc === 'bv') return r.thieu.includes('bv')
    if (loc === 'dg') return r.thieu.includes('dg') || r.thieu.includes('xc')
    if (loc === 'anh') return r.thieu.includes('anh')
    if (loc === 'du') return !thieuCua(r)
    return !chiThieu || thieuCua(r)
  }
  const qq = q.trim().toLowerCase()
  const hien = lenh
    .filter((l) => !kh || l.customer === kh)
    .filter((l) => !maLenh || l.id === maLenh)
    .filter((l) => {
      if (!xuat) return true
      const d = conNgay(l.ship_date)
      return d != null && d <= xuat
    })
    .map((l) => ({
      ...l,
      rows: l.lines.filter(
        (r) =>
          khop(r) &&
          (!qq || r.code.toLowerCase().includes(qq) || r.name.toLowerCase().includes(qq)),
      ),
    }))
    .filter((l) => l.rows.length > 0 || (!qq && loc === '' && !chiThieu))

  const tong = lenh.reduce(
    (a, l) => {
      a.sp += l.counts.sp
      a.bom += l.counts.thieu_bom
      a.so += l.counts.thieu_so
      a.bv += l.counts.thieu_bv
      a.dg += l.counts.thieu_dg
      a.anh += l.counts.thieu_anh
      a.du += l.counts.du
      return a
    },
    { sp: 0, bom: 0, so: 0, bv: 0, dg: 0, anh: 0, du: 0 },
  )
  const hienSp = hien.reduce((a, l) => a + l.rows.length, 0)
  return (
    <>
      <header className="head">
        <div className="head-l">
          <span className="eyebrow">Dùng chung</span>
          <h1>Lệnh SX · hồ sơ sản phẩm</h1>
          <span className="fact">
            Lệnh <b>{lenh.length}</b>
          </span>
          <span className="fact">
            Dòng SP <b>{tong.sp}</b>
          </span>
          <Fact
            k="bom"
            label="Chưa có định mức"
            n={tong.bom}
            w
            loc={loc}
            setLoc={setLoc}
          />
          <Fact
            k="so"
            label="Định mức thiếu số"
            n={tong.so}
            w
            loc={loc}
            setLoc={setLoc}
          />
          <Fact k="bv" label="Thiếu bản vẽ" n={tong.bv} w loc={loc} setLoc={setLoc} />
          <Fact k="dg" label="Thiếu đóng gói" n={tong.dg} w loc={loc} setLoc={setLoc} />
          <Fact k="anh" label="Thiếu ảnh" n={tong.anh} loc={loc} setLoc={setLoc} />
          <Fact k="du" label="Đủ hồ sơ" n={tong.du} loc={loc} setLoc={setLoc} />
        </div>
        <div className="head-r">
          <button
            type="button"
            className={cn('btn', chiThieu && 'on')}
            aria-pressed={chiThieu}
            onClick={() => setChiThieu(!chiThieu)}
            title="Ẩn các SP đã đủ hồ sơ"
          >
            Chỉ SP còn thiếu
          </button>
          <Link className="btn" href={all ? '/thu-vien/lenh' : '/thu-vien/lenh?tat_ca=1'}>
            {all ? 'Chỉ lệnh đang chạy' : 'Cả lệnh đã xong'}
          </Link>
        </div>
      </header>

      <div className="filters">
        <input
          className="pick"
          style={{ width: 240 }}
          placeholder="Tìm mã HG, tên SP…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Tìm sản phẩm"
        />
        <select
          className="pick"
          value={kh}
          onChange={(e) => setKh(e.target.value)}
          aria-label="Khách"
        >
          <option value="">Mọi khách ({khach.length})</option>
          {khach.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          className="pick"
          value={maLenh}
          onChange={(e) => setMaLenh(e.target.value)}
          aria-label="Lệnh"
        >
          <option value="">Mọi lệnh ({lenh.length})</option>
          {lenh.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </select>
        <select
          className="pick"
          value={xuat}
          onChange={(e) => setXuat(Number(e.target.value))}
          aria-label="Xuất trong"
        >
          <option value={0}>Mọi ngày xuất</option>
          <option value={7}>Xuất trong 7 ngày</option>
          <option value={14}>Xuất trong 14 ngày</option>
          <option value={30}>Xuất trong 30 ngày</option>
          <option value={60}>Xuất trong 60 ngày</option>
        </select>
        <select
          className="pick"
          value={loc}
          onChange={(e) => setLoc(e.target.value as Loc)}
          aria-label="Còn thiếu"
        >
          <option value="">Còn thiếu: bất kỳ</option>
          <option value="bom">Chưa có định mức</option>
          <option value="so">Định mức thiếu số</option>
          <option value="bv">Thiếu bản vẽ</option>
          <option value="dg">Thiếu đóng gói / xếp cont</option>
          <option value="anh">Thiếu ảnh</option>
          <option value="du">Đã đủ hồ sơ</option>
        </select>
        {(q || kh || maLenh || xuat || loc) && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ('')
              setKh('')
              setMaLenh('')
              setXuat(0)
              setLoc('')
            }}
          >
            Bỏ lọc
          </button>
        )}
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
          Sắp theo ngày xuất gần nhất · bấm dữ kiện ở đầu trang để lọc theo thứ còn thiếu
        </span>
      </div>

      <div className="scroll">
        <table className="bang" aria-label="SP trên lệnh sản xuất">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <span className="sr">Ảnh</span>
              </th>
              <th style={{ width: 118 }}>Mã HG</th>
              <th>Tên sản phẩm</th>
              <th className="num" style={{ width: 70 }}>
                SL
              </th>
              <th style={{ width: 96 }}>Xuất</th>
              <th style={{ width: 196 }}>Hồ sơ</th>
              <th style={{ width: 150 }}>Định mức</th>
              <th style={{ width: 240 }}>Còn thiếu</th>
            </tr>
          </thead>
          {hien.map((l) => {
            const d = conNgay(l.ship_date)
            return (
              <tbody key={l.id}>
                <tr className="grp">
                  <th scope="rowgroup" colSpan={8}>
                    <Link className="code" href={`/thu-vien/lenh#${l.id}`} id={l.id}>
                      {l.code}
                    </Link>
                    <span className="n">{l.customer ?? '—'}</span>
                    <span className="n">
                      xuất {l.ship_date ? dmyShort(l.ship_date) : 'chưa chốt'}
                      {d != null && (
                        <span
                          className={cn(d < 0 ? 'red' : d <= 14 ? 'pend' : 'muted')}
                          style={{ float: 'none', marginLeft: 4 }}
                        >
                          (
                          {d < 0
                            ? `quá ${-d} ngày`
                            : d === 0
                              ? 'hôm nay'
                              : `còn ${d} ngày`}
                          )
                        </span>
                      )}
                    </span>
                    <span className="n">
                      {lsxStatusLabel(l.status)}
                      {l.revision > 0 ? ` · bản #${l.revision}` : ''}
                    </span>
                    <span className="n">
                      {l.counts.sp} SP · định mức {l.counts.bom}/{l.counts.sp}
                      {l.counts.thieu_so ? ` · ${l.counts.thieu_so} thiếu số` : ''}
                      {l.counts.thieu_bv ? ` · ${l.counts.thieu_bv} thiếu bản vẽ` : ''}
                      {l.counts.thieu_dg ? ` · ${l.counts.thieu_dg} thiếu đóng gói` : ''}
                    </span>
                    {l.counts.du === l.counts.sp ? (
                      <span className="ok">đủ hồ sơ</span>
                    ) : (
                      <span className="pend">
                        {l.counts.sp - l.counts.du} SP còn thiếu
                      </span>
                    )}
                  </th>
                </tr>
                {/* cùng SP có thể nằm nhiều dòng trên một lệnh (đợt xuất khác nhau) → khoá theo thứ tự */}
                {l.rows.map((r, i) => (
                  <tr key={`${r.product_id || r.code}:${i}`}>
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
                    <td title={r.name}>
                      {r.name}
                      {r.locked && (
                        <span className="tag done" style={{ marginLeft: 6 }}>
                          khoá
                        </span>
                      )}
                    </td>
                    <td className="num">{r.qty.toLocaleString('vi-VN')}</td>
                    <td className="num muted">
                      {r.ship_date ? dmyShort(r.ship_date) : '—'}
                    </td>
                    <td>
                      {r.check ? (
                        <OHoSo check={r.check} />
                      ) : (
                        <span className="muted">chưa có hồ sơ</span>
                      )}
                    </td>
                    <td className={cn(r.parts === 0 && 'red')}>
                      {r.parts === 0 ? (
                        'chưa có'
                      ) : r.thieu_so > 0 ? (
                        <span className="pend" style={{ float: 'none' }}>
                          {r.parts} dòng · {r.thieu_so} thiếu số
                        </span>
                      ) : (
                        <span className="ok" style={{ float: 'none' }}>
                          {r.parts} dòng · đủ số
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(thieuCua(r) ? 'loi' : 'muted')}
                      style={{ whiteSpace: 'normal' }}
                    >
                      {thieuCua(r)
                        ? [
                            ...r.thieu.map((o: HoSoO) => HO_SO_TEN[o]),
                            ...(r.thieu_so ? [`${r.thieu_so} dòng thiếu số`] : []),
                          ].join(' · ')
                        : 'đủ'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )
          })}
          {hien.length === 0 && (
            <tbody>
              <tr>
                <td
                  colSpan={8}
                  className="muted"
                  style={{ textAlign: 'center', height: 60 }}
                >
                  Không có dòng nào khớp — bỏ bớt lọc hoặc tắt “Chỉ SP còn thiếu”.
                </td>
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr>
              <td colSpan={3}>
                Hiện {hienSp} / {tong.sp} dòng SP trên {hien.length} / {lenh.length} lệnh
                {all ? ' (cả đã xong)' : ' đang chạy'}
              </td>
              <td colSpan={5} style={{ fontWeight: 400 }}>
                Hồ sơ đếm bằng đúng 6 ô của thư viện (BOM · Bản vẽ · Ảnh · Đóng gói · Xếp
                cont · Mẫu). Định mức “thiếu số” = dòng không có SL hoặc thanh không có
                dài cắt.
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="foot">
        <span>
          {tong.bom} SP chưa có định mức · {tong.so} thiếu số · {tong.du} đủ hồ sơ
        </span>
        <span className="num" style={{ marginLeft: 'auto' }}>
          {hienSp} dòng
        </span>
      </div>
    </>
  )
}

/** Dữ kiện ở đầu trang: bấm là lọc theo thứ còn thiếu (đúng hàm đếm của bảng). */
function Fact({
  k,
  label,
  n,
  w,
  loc,
  setLoc,
}: {
  k: Loc
  label: string
  n: number
  w?: boolean
  loc: Loc
  setLoc: (l: Loc) => void
}) {
  return (
    <button
      type="button"
      className={cn('fact', loc === k && 'on')}
      aria-pressed={loc === k}
      onClick={() => setLoc(loc === k ? '' : k)}
    >
      {label} <b className={cn(w && n > 0 && 'w')}>{n}</b>
    </button>
  )
}
