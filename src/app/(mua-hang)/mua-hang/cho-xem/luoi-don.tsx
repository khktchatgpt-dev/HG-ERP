'use client'

import Link from 'next/link'
import {
  chanNgan,
  congTheoTien,
  henVe,
  lamDuocNgay,
  soGia,
  soNgayTu,
  soVn,
  tichDuoc,
  tienVn,
  trangThaiXem,
  type XemDon,
} from '@/lib/cho-xem'
import { ngayGioVn } from '@/lib/date-vn'
import type { ChoXemCtx } from './useChoXem'

/** "05/11 09:35" giờ VN. */
export const gioPhut = (iso: string) => {
  const a = ngayGioVn(iso)
  return `${a.slice(0, 5)} ${a.slice(11)}`
}
/** "05/11" giờ VN. */
export const ngayThang = (iso: string) => ngayGioVn(iso).slice(0, 5)
/** Tiền gọn trên lưới: VND không ghi mã tiền (cột đã ghi "gồm VAT"), ngoại tệ có. */
export const tienGon = (x: { value: number; currency: string }) =>
  x.currency === 'VND' ? soVn(x.value, 0) : tienVn(x.value, x.currency)

/** Lớp màu của nhóm khi gom theo trạng thái (vạch + nền nhạt — hop-ky.css). */
const LOP_NHOM: Record<string, string> = {
  trinh_duoc: 'lp-tp-ok',
  gui_thang: 'lp-po',
  thieu: 'lp-tp-wn',
  tra_lai: 'lp-cx-mu',
}

const COT = [
  { w: 34, nhan: '' },
  { w: 132, nhan: 'Trạng thái' },
  { w: 122, nhan: 'Mã đơn' },
  { w: 146, nhan: 'Người lập' },
  { w: 146, nhan: 'Nhà cung cấp' },
  { nhan: 'Mua gì · lệnh / hạng mục' },
  { w: 88, nhan: 'Hẹn về', r: true },
  { w: 122, nhan: 'Gồm VAT', r: true },
] as const

/**
 * LƯỚI ĐƠN (bản vẽ khung 6): gom theo TRẠNG THÁI mặc định (Q9), mỗi dòng hai
 * tầng — tầng dưới chữ nhỏ nói thêm (im n ngày, sửa ngày, lệnh · số dòng · giữ
 * giá, hẹn còn bao lâu). Bỏ ổ khoá (Q10): cột Trạng thái nói vì sao. Nhóm "Bị
 * trả lại" thu gọn sẵn (Q11).
 */
export function LuoiDon({ d }: { d: ChoXemCtx }) {
  const ten = d.tab === 'cho' ? 'Đơn chờ trưởng phòng xem' : 'Đơn đã trình, chờ Giám đốc'
  const lam = lamDuocNgay(d.rows)
  return (
    <div className="cx-luoi">
      <table className="hk-tb" aria-label={ten}>
        <colgroup>
          {COT.map((c, i) => (
            <col key={i} style={'w' in c ? { width: c.w } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COT.map((c, i) => (
              <th
                key={i}
                className={'r' in c ? 'r' : undefined}
                aria-label={i === 0 ? 'Tích' : undefined}
              >
                {c.nhan}
              </th>
            ))}
          </tr>
        </thead>
        {d.khoi.map((g) => {
          const gon = g.gon && !d.moNhom.has(g.key)
          const tichDuocKhoi = d.tab === 'cho' ? g.rows.filter(tichDuoc) : []
          const caKhoi =
            tichDuocKhoi.length > 0 && tichDuocKhoi.every((x) => d.tich.has(x.id))
          const lop = d.gom === 'trang_thai' ? (LOP_NHOM[g.key] ?? 'lp-all') : 'lp-all'
          return (
            <tbody key={g.key}>
              <tr className={`grp ${lop}`}>
                <th scope="rowgroup" colSpan={COT.length}>
                  {g.gon ? (
                    <button
                      type="button"
                      className="cx-caret"
                      aria-expanded={!gon}
                      onClick={() => d.batNhom(g.key)}
                    >
                      {gon ? '▸' : '▾'} <span className="ten">{g.ten}</span>
                    </button>
                  ) : (
                    <span className="ten">{g.ten}</span>
                  )}{' '}
                  · <b className="hk-num">{g.rows.length}</b>{' '}
                  {d.tab === 'cho' && g.rows.every((x) => x.nhap) ? 'nháp' : 'đơn'}
                  {g.tinhSo
                    ? ` · ${congTheoTien(g.rows)
                        .map((t) => tienVn(t.value, t.currency))
                        .join(' · ')}`
                    : ' · không tính vào số chờ'}
                  {gon && ' · bấm để mở'}
                  {tichDuocKhoi.length > 1 && (
                    <span className="rr">
                      <label>
                        <input
                          type="checkbox"
                          checked={caKhoi}
                          onChange={(e) => d.tichKhoi(g.rows, e.target.checked)}
                          aria-label={`Tích ${tichDuocKhoi.length} đơn dưới ngưỡng trong nhóm ${g.ten}`}
                        />
                        Tích {tichDuocKhoi.length} đơn dưới ngưỡng
                      </label>
                    </span>
                  )}
                </th>
              </tr>
              {!gon && g.rows.map((x) => <DongDon key={x.id} d={d} x={x} />)}
            </tbody>
          )
        })}
        <tfoot>
          <tr>
            <td colSpan={COT.length - 1}>
              {d.tab === 'cho'
                ? `Làm được ngay: ${lam.length} đơn — chân tổng không cộng nháp còn thiếu, không cộng nháp bị trả lại`
                : `Cộng ${d.rows.length} đơn đã trình, đang chờ Giám đốc`}
            </td>
            <td className="r hk-num">
              {congTheoTien(d.tab === 'cho' ? lam : d.rows).map((t) => (
                <div key={t.currency}>{tienGon(t)}</div>
              ))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Cột Trạng thái: chữ chính + tầng dưới — lời thay cho ổ khoá (Q10). */
function oTrangThai(
  x: XemDon,
  now: Date,
): { cls: string; chu: string; l2: string | null } {
  switch (trangThaiXem(x)) {
    case 'trinh_duoc':
      return {
        cls: 'cx-ok',
        chu: 'Trình được',
        l2: x.big ? 'giá trị lớn' : x.tra_lai?.da_sua ? 'đã sửa sau trả lại' : null,
      }
    case 'gui_thang':
      return { cls: 'hk-warn', chu: 'Đã ở GĐ', l2: 'NV gửi thẳng, anh chưa xem' }
    case 'thieu': {
      const im = soNgayTu(x.sua_at, now)
      return {
        cls: 'hk-warn',
        chu: chanNgan(x.chan ?? ''),
        l2: im >= 1 ? `im ${im} ngày` : `sửa ${gioPhut(x.sua_at).slice(6)}`,
      }
    }
    case 'tra_lai':
      return {
        cls: 'hk-mut',
        chu: 'Bị trả lại',
        l2: x.tra_lai
          ? `${ngayThang(x.tra_lai.at)}${x.tra_lai.by_name ? ` · ${x.tra_lai.by_name}` : ''}`
          : null,
      }
    case 'da_xem':
      return {
        cls: 'cx-ok',
        chu: 'Đã trình',
        l2: x.mark ? `xem ${gioPhut(x.mark.at)}` : null,
      }
  }
}

function DongDon({ d, x }: { d: ChoXemCtx; x: XemDon }) {
  const now = new Date(d.box.at)
  const t = trangThaiXem(x)
  const mo = t === 'thieu' || t === 'tra_lai'
  const tt = oTrangThai(x, now)
  const mua = [x.loai, x.materials.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
  const them = x.materials.length - 2
  const giu = x.dong.filter((l) => soGia(l.don_gia, l.truoc)?.kieu === 'bang').length
  const boiCanh = [
    x.lsx ?? x.ngoai_lenh ?? 'Ngoài lệnh',
    `${x.dong.length} dòng`,
    giu > 0 ? `${giu} giữ giá đơn trước` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const hen = henVe(x.expected_at, d.homNay)
  const chon = d.dangXem?.id === x.id
  return (
    <tr
      className={['d', chon ? 'on' : '', mo ? 'cx-mo' : ''].filter(Boolean).join(' ')}
      onClick={() => d.chonDong(x.id)}
      aria-selected={chon}
    >
      <td onClick={(e) => e.stopPropagation()}>
        {d.tab === 'cho' && tichDuoc(x) ? (
          <input
            type="checkbox"
            checked={d.tich.has(x.id)}
            onChange={() => d.batTich(x)}
            aria-label={`Tích ${x.code}`}
          />
        ) : null}
      </td>
      <td title={x.chan ?? undefined}>
        <span className={`cx-tt ${tt.cls}`}>{tt.chu}</span>
        {tt.l2 && <span className="cx-l2">{tt.l2}</span>}
      </td>
      <td>
        <Link href={x.href} className="hk-ma" onClick={(e) => e.stopPropagation()}>
          {x.code}
        </Link>
      </td>
      <td title={x.owner_name ?? undefined}>
        {x.owner_name ?? '—'}
        <span className="cx-l2">
          {mo ? `sửa ${ngayThang(x.sua_at)}` : `lập ${gioPhut(x.lap_at)}`}
        </span>
      </td>
      <td className={mo ? undefined : 'hk-b'} title={x.ncc_day_du}>
        {x.ncc}
      </td>
      <td title={[x.loai, ...x.materials].filter(Boolean).join(' · ')}>
        <span className="cx-1d">
          {mua || '—'}
          {them > 0 && <span className="hk-mut"> +{them}</span>}
        </span>
        <span className="cx-l2">{boiCanh}</span>
      </td>
      <td className="r hk-num">
        {x.expected_at ? (
          <>
            <span className={hen?.gap ? 'hk-warn' : undefined}>
              {x.expected_at.slice(8, 10)}/{x.expected_at.slice(5, 7)}
            </span>
            <span className={hen?.gap ? 'cx-l2 hk-warn' : 'cx-l2'}>{hen?.chu}</span>
          </>
        ) : (
          <span className="hk-mut">—</span>
        )}
      </td>
      <td className={mo ? 'r hk-num' : 'r hk-num hk-b'}>{tienGon(x)}</td>
    </tr>
  )
}
