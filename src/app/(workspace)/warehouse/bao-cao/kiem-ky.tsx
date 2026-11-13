'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import type { KiemKyHien, KiemThangHien } from '@/modules/dept/warehouse/nxt.service'
import { HopThoai } from '../_erp/o-nhap'
import { dmy, fmtTien } from './bao-cao.shared'

/**
 * KIỂM TRƯỚC KHI CHỐT KỲ (B1 — chỉ đọc). Bản vẽ duyệt 13/11/2026 (khung 1 + 2):
 * https://claude.ai/artifact/6mgaRUw38AvLwCS1199P73
 *
 * Dòng lưu ý dưới thanh lọc và hộp danh sách kiểm đọc CÙNG một `KiemKyHien`
 * (tính bằng `lib/kho-kiem-ky` ở máy chủ) — hai chỗ không ra hai số. B1 chưa có
 * ô tích và nút Chốt: chốt sổ là B2, dựng khi Kế toán bắt đầu chốt tháng (Q1).
 */

const mm = (t: string) => t.slice(5, 7)

/** ['2026-09','2026-10'] → "09, 10/2026"; khác năm thì ghi đủ từng tháng. */
function noiThang(ts: string[]): string {
  if (ts.length === 0) return ''
  if (ts.length > 4) return `${mm(ts[0])}/${ts[0].slice(0, 4)} – ${mm(ts.at(-1)!)}/${ts.at(-1)!.slice(0, 4)}` // prettier-ignore
  const nam = ts[0].slice(0, 4)
  return ts.every((t) => t.startsWith(nam))
    ? `${ts.map(mm).join(', ')}/${nam}`
    : ts.map((t) => `${mm(t)}/${t.slice(0, 4)}`).join(', ')
}

const NHAN_COT_XUAT: Record<string, string> = {
  choLenh: 'cho lệnh',
  kkThieu: 'KK thiếu',
  xuatKhac: 'khác',
}

const TRANG_THAI_DOT: Record<string, string> = {
  open: 'chưa bắt đầu đếm',
  counting: 'đang đếm',
  review: 'chờ duyệt',
}

/** Dòng "Chưa chốt" dưới thanh lọc — chỉ khi xem một tháng trọn đã qua. */
export function DongChuaChot({ kk, onMo }: { kk: KiemKyHien; onMo: () => void }) {
  const phan: ReactNode[] = []
  if (kk.soChan > 0)
    phan.push(
      <span key="c">
        <b className="kh-stop">{kk.soChan}</b> điều kiện chặn
      </span>,
    )
  if (kk.tong.lenhChuaXuat > 0)
    phan.push(
      <span key="l">
        <b className="kh-warn">{kk.tong.lenhChuaXuat} lệnh</b> nhận hàng chưa có phiếu
        xuất
      </span>,
    )
  if (kk.tong.maThieuGia > 0)
    phan.push(
      <span key="m">
        <b className="kh-warn">{kk.tong.maThieuGia} mã</b> chưa có giá
      </span>,
    )
  if (kk.tong.dongThieuTyGia > 0)
    phan.push(<span key="t">{kk.tong.dongThieuTyGia} dòng ngoại tệ thiếu tỷ giá</span>)
  return (
    <div className="kh-note" role="status">
      <span className="tag">Chưa chốt</span>
      <span>
        Sổ kho chưa chốt tháng nào. Trước khi chốt:{' '}
        {phan.length === 0
          ? 'không còn gì phải soát.'
          : phan.flatMap((p, i) => (i === 0 ? [p] : [' · ', p]))}
      </span>
      <button type="button" className="kh-lnk nx-kk-mo" onClick={onMo}>
        Danh sách kiểm
      </button>
    </div>
  )
}

type Muc = {
  key: string
  loai: 'dat' | 'chan' | 'luuy'
  nhan: string
  noi: ReactNode
  tiep?: ReactNode
  phu?: ReactNode
}

function DongDs({ m }: { m: Muc }) {
  const cls = m.loai === 'dat' ? 'kh-mut' : m.loai === 'chan' ? 'kh-stop' : 'kh-warn'
  const dau = m.loai === 'dat' ? '✓' : m.loai === 'chan' ? '✕' : '!'
  return (
    <li>
      <span className={cls} aria-hidden>
        {dau}
      </span>
      <span className={`kq ${cls}`}>{m.nhan}</span>
      <span className={m.loai === 'dat' ? 'kh-mut' : undefined}>{m.noi}</span>
      <span className="tiep">{m.tiep}</span>
      {m.phu && <span className="phu">{m.phu}</span>}
    </li>
  )
}

/** Mục "mã chưa có giá" của một tháng — component riêng để giữ trạng thái mở/thu. */
function DongMaThieuGia({ t }: { t: KiemThangHien }) {
  const nhieu = t.maThieuGia.length > 3
  const [mo, setMo] = useState(!nhieu)
  return (
    <DongDs
      m={{
        key: `m-${t.thang}`,
        loai: 'luuy',
        nhan: `Tháng ${mm(t.thang)}`,
        noi: (
          <>
            <b>{t.maThieuGia.length} mã</b> chưa lần nhập nào có giá — dòng xuất của các
            mã này ghi không giá
          </>
        ),
        tiep: nhieu ? (
          <button
            type="button"
            className="kh-lnk"
            onClick={() => setMo((v) => !v)}
            aria-expanded={mo}
          >
            {mo ? 'Thu lại' : `Xem ${t.maThieuGia.length} mã`}
          </button>
        ) : undefined,
        phu: mo
          ? t.maThieuGia.map((v, i) => (
              <span key={v.id}>
                {i > 0 && ', '}
                <span className="kh-ma">{v.code}</span> {v.name}
              </span>
            ))
          : undefined,
      }}
    />
  )
}

export function KiemKyHop({ kk, onClose }: { kk: KiemKyHien; onClose: () => void }) {
  const thangs = kk.thangs.map((t) => t.thang)
  const truoc = thangs.slice(0, -1)
  const tonAm = kk.thangs.filter((t) => t.tonAm.length > 0)

  const chan: Muc[] = [
    ...tonAm.map((t): Muc => ({
      key: `am-${t.thang}`,
      loai: 'chan',
      nhan: `Tháng ${mm(t.thang)}`,
      noi: (
        <>
          <b>{t.tonAm.length} mã tồn âm</b> cuối {dmy(t.den).slice(0, 5)}:{' '}
          {t.tonAm.slice(0, 6).map((v, i) => (
            <span key={v.id}>
              {i > 0 && ', '}
              <span className="kh-ma">{v.code}</span>
            </span>
          ))}
          {t.tonAm.length > 6 && ' …'}
        </>
      ),
      tiep: (
        <Link href="/warehouse/ton" className="kh-lnk">
          Mở Tồn kho
        </Link>
      ),
    })),
    ...kk.dotMo.map((d): Muc => ({
      key: `kk-${d.id}`,
      loai: 'chan',
      nhan: 'Kiểm kê',
      noi: (
        <>
          Đợt <span className="kh-ma">{d.code}</span>{' '}
          {TRANG_THAI_DOT[d.status] ?? d.status}, chốt sổ{' '}
          {d.freeze_ngay ? dmy(d.freeze_ngay) : '—'}
        </>
      ),
      tiep: (
        <Link href={`/warehouse/kiem-ke/${d.id}`} className="kh-lnk">
          Mở đợt
        </Link>
      ),
      phu: 'Duyệt hoặc huỷ đợt trước: số thừa/thiếu của đợt phải vào sổ trong kỳ.',
    })),
  ]
  const dat: string[] = []
  if (tonAm.length === 0) dat.push('0 mã tồn âm cuối tháng')
  if (kk.dotMo.length === 0) dat.push('0 đợt kiểm kê đang mở có mốc chốt sổ trong kỳ')

  const lenh: Muc[] = kk.thangs
    .filter((t) => t.lenhChuaXuat.length > 0)
    .map((t) => ({
      key: `l-${t.thang}`,
      loai: 'luuy',
      nhan: `Tháng ${mm(t.thang)}`,
      noi: (
        <>
          <b>
            {t.lenhChuaXuat.length} / {t.lenhNhan} lệnh
          </b>{' '}
          nhận hàng trong tháng mà chưa có phiếu xuất
        </>
      ),
      tiep: (
        <Link href="/warehouse/ton?xem=lenh" className="kh-lnk">
          Tồn theo lệnh
        </Link>
      ),
      phu: (
        <>
          {t.lenhChuaXuat.map((l) => l.code).join(', ')}. Tổ đã lấy hàng thì ghi bù phiếu
          xuất trước khi chốt.
        </>
      ),
    }))
  const tyGia: Muc[] = kk.thangs
    .filter((t) => t.dongThieuTyGia > 0)
    .map((t) => ({
      key: `t-${t.thang}`,
      loai: 'luuy',
      nhan: `Tháng ${mm(t.thang)}`,
      noi: (
        <>
          <b>{t.dongThieuTyGia} dòng</b> nhập ngoại tệ thiếu tỷ giá — giá trị tháng không
          gồm các dòng này
        </>
      ),
    }))

  return (
    <HopThoai
      title={`Chốt sổ kho đến hết ${dmy(kk.den)}`}
      subtitle={
        truoc.length > 0
          ? `Tháng ${noiThang(truoc)} chưa chốt — chốt lần này khoá cả ${noiThang(thangs)}, mỗi tháng một bản chốt.` // prettier-ignore
          : undefined
      }
      onClose={onClose}
      width={780}
      footer={
        <>
          <span className="chua kh-mut">
            Chưa bật nút Chốt — danh sách để soát trước khi chốt.
          </span>
          <button type="button" className="kh-btn" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      <div className="nx-kk-k">Kiểm trước khi chốt</div>
      <ul className="nx-kk" aria-label="Kiểm trước khi chốt">
        {dat.length > 0 && (
          <DongDs m={{ key: 'dat', loai: 'dat', nhan: 'Đạt', noi: dat.join(' · ') }} />
        )}
        {chan.map((m) => (
          <DongDs key={m.key} m={m} />
        ))}
        {lenh.map((m) => (
          <DongDs key={m.key} m={m} />
        ))}
        {kk.thangs
          .filter((t) => t.maThieuGia.length > 0)
          .map((t) => (
            <DongMaThieuGia key={t.thang} t={t} />
          ))}
        {tyGia.map((m) => (
          <DongDs key={m.key} m={m} />
        ))}
      </ul>

      <div className="nx-kk-k">Sẽ ghi vào bản chốt</div>
      <table className="nx-kk-tb">
        <thead>
          <tr>
            <th>Tháng</th>
            <th className="r">Dòng xuất nhận giá</th>
            <th className="r">Dòng KK thừa nhận giá</th>
            <th className="r">Giá trị xuất</th>
            <th className="r">Giá trị tồn cuối cả kho</th>
          </tr>
        </thead>
        <tbody>
          {kk.thangs.map((t) => {
            const cot = Object.entries(t.dongXuatTheoCot).filter(([, n]) => n > 0)
            return (
              <tr key={t.thang}>
                <td className="kh-num">
                  {mm(t.thang)}/{t.thang.slice(0, 4)}
                </td>
                <td
                  className="r kh-num"
                  title={
                    cot.map(([k, n]) => `${NHAN_COT_XUAT[k]}: ${n}`).join(' · ') ||
                    undefined
                  }
                >
                  {t.dongXuat > 0 ? t.dongXuat : <span className="kh-empty">·</span>}
                  {cot.length === 1 && (
                    <span className="kh-mut"> ({NHAN_COT_XUAT[cot[0][0]]})</span>
                  )}
                </td>
                <td className="r kh-num">
                  {t.dongKkThua > 0 ? t.dongKkThua : <span className="kh-empty">·</span>}
                </td>
                <td className="r kh-num">
                  {t.gtXuat ? fmtTien(t.gtXuat) : <span className="kh-empty">·</span>}
                </td>
                <td className={t.thang === thangs.at(-1) ? 'r kh-num kh-b' : 'r kh-num'}>
                  {t.gtTonCuoi ? (
                    fmtTien(t.gtTonCuoi)
                  ) : (
                    <span className="kh-empty">·</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="nx-kk-sau">
        Sau khi chốt: không ghi được phiếu ngày ≤ {dmy(kk.den)}. Đảo hoặc điều chỉnh phiếu
        cũ vẫn được, phiếu mới mang ngày hôm nay.
      </p>
    </HopThoai>
  )
}
