'use client'

import { MATERIAL_FIELD_LABELS } from '@/lib/material-group-fields'
import { HopThoai } from '../_erp/o-nhap'

/*
 * PHẦN PHỤ CỦA HỘP SỬA MÃ (B7a) — tab Lịch sử (sổ vết 0177 + giá mua trên đơn,
 * chỉ xem) và hộp xác nhận đổi mã (Q3). Tách khỏi `sua-ma.tsx` cho dưới trần 800.
 */

export type ThayDoi = {
  id: string
  field: string
  before_value: string | null
  after_value: string | null
  source: string
  created_at: string
  actor_name?: string | null
  source_ref?: string | null
}
export type GiaMua = {
  po_id: string
  po_code: string
  supplier_name: string | null
  currency: string
  unit_price: number
  at: string
}

const NHAN: Record<string, string> = {
  ...MATERIAL_FIELD_LABELS,
  name: 'Tên',
  unit: 'ĐVT',
  code: 'Mã',
  group_name: 'Nhóm',
  sub_group: 'Nhóm con',
  note: 'Ghi chú',
  price_unit: 'Tính giá theo',
  last_purchase_price: 'Giá tham chiếu',
  default_supplier_id: 'NCC mặc định',
  over_tolerance_pct: 'Nhận vượt tối đa',
  shelf_location: 'Kệ',
  min_stock: 'Ngưỡng tồn',
  barcode: 'Mã vạch',
  needs_review: 'Chờ Kho rà',
  is_active: 'Đang dùng',
  deleted: 'Đã xoá mã',
}
const NGUON: Record<string, string> = {
  manual: 'sửa tay',
  po_enrich: 'từ đơn mua',
  import: 'script nạp',
  system: 'máy',
  retire: 'ngừng dùng / xoá',
}
export const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const tien = (n: number, cur = 'VND') =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
/** Ô số của hook giữ chữ dạng số JS ("0.239"); trống thì vẫn trống. */

/** Q3: đổi mã thì nói trước số dòng mã chữ đổi theo (đúng hai bảng `renameCodeRefs`). */
export function XacNhanDoiMa({
  m,
  maMoi,
  refs: xacNhanMa,
  busy,
  onBack: back,
  onOk,
}: {
  m: { code: string; name: string }
  maMoi: string
  refs: { parts: number; boms: number }
  busy: boolean
  onBack: () => void
  onOk: () => void
}) {
  return (
    <HopThoai
      title={`Đổi mã ${m.code} → ${maMoi}`}
      subtitle={m.name}
      onClose={back}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={back}>
            Quay lại sửa
          </button>
          <button type="button" className="kh-btn p" disabled={busy} onClick={onOk}>
            {busy ? 'Đang lưu…' : `Đổi sang ${maMoi}`}
          </button>
        </>
      }
    >
      <table className="kh-in" aria-label="Chỗ đổi theo mã mới">
        <tbody>
          <tr>
            <td>Dòng định mức hồ sơ SP ghi mã {m.code}</td>
            <td className="r kh-num kh-b">{xacNhanMa.parts.toLocaleString('vi-VN')}</td>
            <td className="kh-mut">đổi chữ mã theo</td>
          </tr>
          <tr>
            <td>Dòng BOM của lệnh sản xuất</td>
            <td className="r kh-num kh-b">{xacNhanMa.boms.toLocaleString('vi-VN')}</td>
            <td className="kh-mut">đổi chữ mã theo</td>
          </tr>
          <tr>
            <td>Phiếu kho, đơn mua, giá NCC</td>
            <td className="r kh-mut">—</td>
            <td className="kh-mut">trỏ theo vật tư, tự hiện mã mới (in lại ra mã mới)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Sổ vết giữ mã cũ {m.code}. Mã in trên giấy đã phát (phiếu đã in, tem kệ) vẫn là mã
        cũ — dán lại nếu cần.
      </p>
    </HopThoai>
  )
}

export function LichSu({ doi, gia }: { doi: ThayDoi[] | null; gia: GiaMua[] | null }) {
  return (
    <>
      <div className="kh-sec">
        <div className="st">
          Thay đổi danh mục<span className="o">sổ vết · 20 lần gần nhất</span>
        </div>
        {doi == null ? (
          <p className="kh-mut" style={{ padding: 10 }}>
            Đang tải…
          </p>
        ) : doi.length === 0 ? (
          <p className="kh-mut" style={{ padding: 10 }}>
            Chưa ai sửa mã này kể từ khi có sổ vết (0177).
          </p>
        ) : (
          <table className="kh-in" aria-label="Thay đổi danh mục">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Ô</th>
                <th>Trước → sau</th>
                <th>Ai / nguồn</th>
              </tr>
            </thead>
            <tbody>
              {doi.slice(0, 20).map((c) => (
                <tr key={c.id}>
                  <td className="kh-num kh-mut">{ngay(c.created_at)}</td>
                  <td>{NHAN[c.field] ?? c.field}</td>
                  <td style={{ whiteSpace: 'normal' }}>
                    <span className="kh-mut">{c.before_value ?? '—'}</span> →{' '}
                    {c.after_value ?? '—'}
                  </td>
                  <td className="kh-mut">
                    {[c.actor_name, NGUON[c.source] ?? c.source]
                      .filter(Boolean)
                      .join(' · ')}
                    {c.source === 'retire' && c.source_ref ? `: “${c.source_ref}”` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="kh-sec">
        <div className="st">
          Giá mua trên đơn<span className="o">10 lần gần nhất · chỉ xem</span>
        </div>
        {gia == null ? (
          <p className="kh-mut" style={{ padding: 10 }}>
            Đang tải…
          </p>
        ) : gia.length === 0 ? (
          <p className="kh-mut" style={{ padding: 10 }}>
            Chưa đơn nào trong hệ thống mua mã này.
          </p>
        ) : (
          <table className="kh-in" aria-label="Giá mua trên đơn">
            <thead>
              <tr>
                <th>Đơn</th>
                <th>NCC</th>
                <th>Ngày</th>
                <th className="r">Đơn giá</th>
              </tr>
            </thead>
            <tbody>
              {gia.slice(0, 10).map((g, i) => (
                <tr key={`${g.po_id}-${i}`}>
                  <td className="kh-ma">{g.po_code}</td>
                  <td>{g.supplier_name ?? '—'}</td>
                  <td className="kh-num kh-mut">{ngay(g.at)}</td>
                  <td className="r kh-num">
                    {tien(g.unit_price, g.currency)}{' '}
                    {g.currency === 'VND' ? '' : g.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
