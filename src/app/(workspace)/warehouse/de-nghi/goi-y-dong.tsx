'use client'

import { CellHint, Pick } from '@/components/kit'
import { VAT_CHON, vatNhan } from '@/lib/de-nghi'
import { chenhGia, dangVeCau, giaTruocCau, trungCau, tonNhan } from '@/lib/de-nghi-goi-y'
import type { DongForm } from './de-nghi.shared'

/**
 * Gợi ý dưới một dòng phiếu đề nghị — màn KHO lập phiếu (Đ6 · DN-7). Không chặn
 * gì: chỉ nói tồn thật hay chưa theo dõi, giá lần trước, có trùng phiếu khác hay
 * đơn mua Cung ứng đang về không. Tách khỏi `DeNghiScreen` (chạm trần 800 dòng).
 */

type Ton = ReturnType<typeof tonNhan>

/**
 * Câu gợi ý DÀI (trùng phiếu, đơn đang về, giá lần trước) — `CellHint` của kit là
 * một dòng không xuống hàng, câu dài làm cột số phình 300px và bóp cột tên (đo
 * 14/10). Cùng cỡ chữ / màu với CellHint nhưng được xuống dòng.
 */
function Goi({
  warn,
  left,
  title,
  children,
}: {
  warn?: boolean
  /** Căn trái (dưới cột chữ) — mặc định căn phải như CellHint ở cột số. */
  left?: boolean
  title?: string
  children: string
}) {
  return (
    <div
      title={title}
      className={
        warn
          ? 'text-k-label mt-px leading-[1.3] text-[var(--warn)]'
          : 'text-k-label mt-px leading-[1.3] text-[var(--ink-3)]'
      }
      style={{ whiteSpace: 'normal', textAlign: left ? 'left' : 'right' }}
    >
      {children}
    </div>
  )
}

/** Ô Tồn hiện tại (khung rộng). */
export function TonO({ ton }: { ton: Ton }) {
  if (!ton) return <span className="text-[var(--ink-empty)]">—</span>
  if (ton.chuaTheoDoi)
    return (
      <span
        className="text-k-sm text-[var(--ink-3)] italic"
        title="Mã này chưa từng nhập / xuất trên hệ thống — số 0 không có nghĩa là kho hết"
      >
        chưa theo dõi
      </span>
    )
  return (
    <span
      className={ton.het ? 'font-semibold text-[var(--warn)]' : 'text-[var(--ink-3)]'}
    >
      {ton.text}
    </span>
  )
}

/** Dưới ô Số lượng: tồn — chỉ khi khung hẹp đã bỏ cột Tồn. */
export function GoiYSoLuong({ ton }: { ton: Ton }) {
  if (!ton) return null
  return (
    <CellHint tone={ton.het ? 'warn' : 'neutral'}>
      {ton.chuaTheoDoi ? 'chưa theo dõi tồn' : 'tồn ' + ton.text}
    </CellHint>
  )
}

/**
 * Dưới TÊN vật tư: trùng đề nghị khác + đơn mua Cung ứng còn về. Đặt ở cột tên
 * (cột co giãn) chứ không ở cột số — câu dài nhồi vào cột 100px là dòng cao 97px.
 */
export function GoiYTen({ r }: { r: DongForm }) {
  const trung = trungCau(r.trung, r.unit)
  const ve = dangVeCau(r.dang_ve, r.unit)
  if (!trung && !ve) return null
  return (
    <>
      {trung && (
        <Goi warn left>
          {trung}
        </Goi>
      )}
      {ve && <Goi left>{ve}</Goi>}
    </>
  )
}

/** Dưới ô Đơn giá dự kiến: lần mua trước (đơn Cung ứng / Kho tự mua) + chênh %. */
export function GoiYGia({ r }: { r: DongForm }) {
  if (!r.material_id) return null
  const cau = giaTruocCau(r.gia_goi_y)
  if (!cau)
    return (
      <CellHint title="Chưa có giá mua trên hệ thống — chưa từng có đơn mua / phiếu nhập Kho tự mua">
        chưa mua lần nào
      </CellHint>
    )
  const c = chenhGia(r.unit_price, r.gia_goi_y)
  return (
    <>
      <Goi title={`${r.gia_goi_y?.po_code} · ${r.gia_goi_y?.supplier_name}`}>{cau}</Goi>
      {c != null && Math.abs(c) >= 5 && (
        <CellHint tone={c > 0 ? 'warn' : 'neutral'}>
          {c > 0 ? `cao hơn lần trước ${c}%` : `thấp hơn lần trước ${-c}%`}
        </CellHint>
      )}
    </>
  )
}

/**
 * Ô VAT của dòng (Đ7 · 0239). Chủ dự án 14/10: một phiếu có dòng có VAT (NCC
 * xuất hoá đơn) lẫn dòng không VAT (tiệm không hoá đơn) → chọn theo dòng.
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
  if (!sua) return <span className="text-[var(--ink-2)]">{vatNhan(r.vat_rate)}</span>
  return (
    <Pick
      value={String(r.vat_rate ?? 0)}
      onChange={(v) => onChange(Number(v) || 0)}
      options={VAT_CHON.map((v) => ({ value: String(v), label: v ? `${v}%` : 'Không' }))}
      label={`VAT dòng ${r.code ?? r.name}`}
      width={70}
    />
  )
}
