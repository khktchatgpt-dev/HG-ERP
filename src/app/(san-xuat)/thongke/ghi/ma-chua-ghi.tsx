'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  lyDoChuaGhi,
  type LenhOption,
  type LenhTinhTrang,
  type MaCuaLenh,
} from '@/lib/ma-chua-ghi'
import { fmt } from './ghi.shared'

/**
 * Ghi sản lượng NÓI THẬT khi sản phẩm chưa có định mức (bản vẽ 15/11/2026
 * https://claude.ai/artifact/MRFoxWghYveCnpdWf2fU3C, duyệt Q1–Q5). Trước đây mã
 * hàng không có bảng chi tiết biến mất khỏi màn, lệnh không có bảng nào không có
 * trong ô chọn lệnh, và `?lsx=` của lệnh đó lặng lẽ mở lệnh khác.
 */

/** Ô chọn lệnh hai nhóm: "Ghi được" · "Chưa ghi được — chưa có bảng chi tiết" (Q1). */
export function ChonLenh({
  options,
  value,
  onChange,
}: {
  options: LenhOption[]
  value: string
  onChange: (id: string) => void
}) {
  const ghi = options.filter((o) => o.open_count != null)
  const chua = options.filter((o) => o.open_count == null)
  return (
    <select
      className="lenh"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Lệnh sản xuất"
    >
      <optgroup label="Ghi được">
        {ghi.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code}
            {o.open_count ? ` · còn ${o.open_count} việc` : ' · đủ số'}
            {o.chua > 0 ? ` · ${o.chua}/${o.tong} mã chưa ghi được` : ''}
          </option>
        ))}
      </optgroup>
      {chua.length > 0 && (
        <optgroup label="Chưa ghi được — chưa có bảng chi tiết">
          {chua.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.ly_do}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/** Lối gỡ cho từng loại (Q4): Kỹ thuật khai định mức · người định hình bấm Nạp từ BOM. */
export const nhacKyThuatHref = '/phan-cong-viec?muc=giao'
export const napHref = (lsxId: string) => `/thongke/lsx/${lsxId}/dinh-hinh`
/**
 * Thống kê TỰ KHAI phần khung ở Bảng chi tiết (bản vẽ 15/11 SNZSog1E… Q1) — lọc
 * sẵn đúng mã. Chỉ bày cho người có quyền sửa bảng chi tiết (`canEditComponents`).
 */
export const khaiHref = (lsxId: string, ma?: string) =>
  `/thongke/lsx/${lsxId}/dinh-hinh${ma ? `?sp=${encodeURIComponent(ma)}` : ''}`

/** Bảng mã hàng chưa ghi được — mã · tên · số lượng · đợt · tình trạng · ai gỡ (Q2, Q3). */
export function BangMaChuaGhi({
  lsxId,
  ma,
  full = false,
  canKhai = false,
}: {
  lsxId: string
  ma: MaCuaLenh[]
  /** Người xem sửa được bảng chi tiết → mã chưa có định mức có "Tự khai ›". */
  canKhai?: boolean
  /** Màn lệnh chưa ghi được: bảng chiếm phần còn lại; dải bung thì cao tối đa 300px. */
  full?: boolean
}) {
  return (
    <div className={full ? 'sx-mcg full' : 'sx-mcg'}>
      <table className="sx-tb">
        <colgroup>
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 56 }} />
          <col style={{ width: 360 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Mã hàng</th>
            <th>Tên</th>
            <th className="r">Số lượng</th>
            <th className="r" title="Số dòng lệnh (đợt) của mã này">
              Đợt
            </th>
            <th>Tình trạng · ai gỡ</th>
          </tr>
        </thead>
        <tbody>
          {ma.map((m) => (
            <tr key={m.ma}>
              <td className="ma">{m.ma}</td>
              <td title={m.ten}>{m.ten}</td>
              <td className="r num">{fmt(m.sl)}</td>
              <td className="r num">{fmt(m.dot)}</td>
              <td>
                {m.tinh_trang === 'chua_nap' ? (
                  <>
                    <b>Có định mức ({fmt(m.n_dm)} dòng), chưa nạp vào lệnh</b> ·{' '}
                    <Link href={napHref(lsxId)} className="lnk">
                      Nạp ở Bảng chi tiết ›
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="warn">Chưa có định mức</span>
                    {canKhai ? (
                      <>
                        {' '}
                        ·{' '}
                        <Link href={khaiHref(lsxId, m.ma)} className="lnk">
                          Tự khai ›
                        </Link>{' '}
                        <span className="mut">· hoặc Kỹ thuật</span>
                      </>
                    ) : (
                      <span className="mut"> · Kỹ thuật</span>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Dải vàng dưới tab công đoạn khi lệnh ghi được MỘT PHẦN (Q3) — bung đúng bảng Q2. */
export function DaiMaChuaGhi({
  lenh,
  canKhai = false,
}: {
  lenh: LenhTinhTrang
  canKhai?: boolean
}) {
  const [mo, setMo] = useState(false)
  if (lenh.chua.length === 0) return null
  return (
    <>
      <div className="sx-note" role="status">
        <b>
          {fmt(lenh.chua.length)}/{fmt(lenh.ma.length)} mã hàng chưa ghi được
        </b>
        <span>
          · {fmt(lenh.sl_chua)} cái · {lyDoChuaGhi(lenh)} — lưới chỉ có mã đã có bảng chi
          tiết.
        </span>
        <button
          type="button"
          className="lnk"
          onClick={() => setMo((x) => !x)}
          aria-expanded={mo}
        >
          {mo ? 'Gập' : `Xem ${fmt(lenh.chua.length)} mã ▾`}
        </button>
        {lenh.n_chua_dm > 0 && canKhai && (
          <Link href={khaiHref(lenh.lsx_id)} className="lnk">
            Tự khai ở Bảng chi tiết ›
          </Link>
        )}
        {lenh.n_chua_dm > 0 && (
          <Link href={nhacKyThuatHref} className="lnk">
            Nhắc Kỹ thuật ›
          </Link>
        )}
        {lenh.n_chua_nap > 0 && (
          <Link href={napHref(lenh.lsx_id)} className="lnk">
            Nạp ở Bảng chi tiết ›
          </Link>
        )}
      </div>
      {mo && <BangMaChuaGhi lsxId={lenh.lsx_id} ma={lenh.chua} canKhai={canKhai} />}
    </>
  )
}

/** Dải đỏ khi `?lsx=` trỏ tới lệnh không còn chạy (Q5) — nói thẳng thay vì lặng lẽ đổi. */
export function DaiLenhKhongChay({
  code,
  status,
}: {
  code: string | null
  status: string | null
}) {
  const [an, setAn] = useState(false)
  if (an) return null
  const vi =
    status === 'completed'
      ? 'đã hoàn thành'
      : status === 'cancelled'
        ? 'đã huỷ'
        : status
          ? 'chưa duyệt'
          : 'không có trên hệ thống'
  return (
    <div className="sx-note stop" role="alert">
      <b>
        Lệnh trong đường dẫn{code ? ` (${code})` : ''} {vi}
      </b>
      <span>— Ghi sản lượng chỉ mở lệnh đang chạy; đang mở lệnh bạn ghi gần nhất.</span>
      <button type="button" className="lnk mut" onClick={() => setAn(true)}>
        Đóng
      </button>
    </div>
  )
}
