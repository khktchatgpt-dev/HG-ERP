'use client'

import { VAT_CHON, vatNhan } from '@/lib/de-nghi'
import { chenhGia, dangVeCau, giaTruocCau, trungCau, tonNhan } from '@/lib/de-nghi-goi-y'
import { GoiY } from '../_erp/o-nhap'
import type { DongForm } from './de-nghi.shared'

/**
 * Gợi ý dưới một dòng phiếu đề nghị — màn KHO lập phiếu (Đ6 · DN-7), viết lại
 * không kit (Kho lối ERP · B5). Không chặn gì: chỉ nói tồn thật hay chưa theo
 * dõi, giá lần trước, có trùng phiếu khác hay đơn mua Cung ứng đang về không.
 * Câu dài được XUỐNG DÒNG (`GoiY`), không ép cột số phình ra.
 */

type Ton = ReturnType<typeof tonNhan>

/** Ô Tồn hiện tại (khung rộng). */
export function TonO({ ton }: { ton: Ton }) {
  if (!ton) return <span className="kh-empty">—</span>
  if (ton.chuaTheoDoi)
    return (
      <i
        className="kh-mut"
        style={{ fontSize: 12 }}
        title="Mã này chưa từng nhập / xuất trên hệ thống — số 0 không có nghĩa là kho hết"
      >
        chưa theo dõi
      </i>
    )
  return <span className={ton.het ? 'kh-warn' : 'kh-mut'}>{ton.text}</span>
}

/** Dưới ô Số lượng: tồn — chỉ khi khung hẹp đã bỏ cột Tồn. */
export function GoiYSoLuong({ ton }: { ton: Ton }) {
  if (!ton) return null
  return (
    <GoiY tone={ton.het ? 'warn' : 'mut'}>
      {ton.chuaTheoDoi ? 'chưa theo dõi tồn' : 'tồn ' + ton.text}
    </GoiY>
  )
}

/** Dưới TÊN vật tư: trùng đề nghị khác + đơn mua Cung ứng còn về (cột co giãn). */
export function GoiYTen({ r }: { r: DongForm }) {
  const trung = trungCau(r.trung, r.unit)
  const ve = dangVeCau(r.dang_ve, r.unit)
  if (!trung && !ve) return null
  return (
    <>
      {trung && (
        <span className="kh-hint warn" style={{ textAlign: 'left' }}>
          {trung}
        </span>
      )}
      {ve && (
        <span className="kh-hint" style={{ textAlign: 'left' }}>
          {ve}
        </span>
      )}
    </>
  )
}

/** Dưới ô Đơn giá dự kiến: lần mua trước (đơn Cung ứng / Kho tự mua) + chênh %. */
export function GoiYGia({ r }: { r: DongForm }) {
  if (!r.material_id) return null
  const cau = giaTruocCau(r.gia_goi_y)
  if (!cau)
    return (
      <GoiY title="Chưa có giá mua trên hệ thống — chưa từng có đơn mua / phiếu nhập Kho tự mua">
        chưa mua lần nào
      </GoiY>
    )
  const c = chenhGia(r.unit_price, r.gia_goi_y)
  return (
    <>
      <GoiY title={`${r.gia_goi_y?.po_code} · ${r.gia_goi_y?.supplier_name}`}>{cau}</GoiY>
      {c != null && Math.abs(c) >= 5 && (
        <GoiY tone={c > 0 ? 'warn' : 'mut'}>
          {c > 0 ? `cao hơn lần trước ${c}%` : `thấp hơn lần trước ${-c}%`}
        </GoiY>
      )}
    </>
  )
}

/**
 * Ô VAT của dòng (Đ7 · 0239). Một phiếu có dòng có VAT (NCC xuất hoá đơn) lẫn
 * dòng không VAT (tiệm không hoá đơn) → chọn theo dòng.
 */
export function VatO({
  r,
  sua,
  onChange,
}: {
  r: DongForm
  sua: boolean
  onChange: (v: number) => void
}) {
  if (!sua) return <span className="kh-mut">{vatNhan(r.vat_rate)}</span>
  return (
    <select
      className="kh-o"
      value={String(r.vat_rate ?? 0)}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      aria-label={`VAT dòng ${r.code ?? r.name}`}
      style={{ width: 72 }}
    >
      {VAT_CHON.map((v) => (
        <option key={v} value={String(v)}>
          {v ? `${v}%` : 'Không'}
        </option>
      ))}
    </select>
  )
}
