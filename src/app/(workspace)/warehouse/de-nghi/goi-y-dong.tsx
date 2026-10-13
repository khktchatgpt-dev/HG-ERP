'use client'

import { CellHint } from '@/components/kit'
import {
  chenhGia,
  dangVeCau,
  giaTruocCau,
  trungCau,
  type TonDong,
  tonNhan,
} from '@/lib/de-nghi-goi-y'
import type { DongForm } from './de-nghi.shared'

/**
 * Gợi ý dưới một dòng phiếu đề nghị — màn KHO lập phiếu (Đ6 · DN-7). Không chặn
 * gì: chỉ nói tồn thật hay chưa theo dõi, giá lần trước, có trùng phiếu khác hay
 * đơn mua Cung ứng đang về không. Tách khỏi `DeNghiScreen` (chạm trần 800 dòng).
 */

type Ton = ReturnType<typeof tonNhan>

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

/** Dưới ô Số lượng: tồn (khung hẹp), trùng đề nghị khác, đơn mua còn về. */
export function GoiYSoLuong({ r, ton }: { r: DongForm & TonDong; ton: Ton }) {
  const trung = trungCau(r.trung, r.unit)
  const ve = dangVeCau(r.dang_ve, r.unit)
  return (
    <>
      {ton && (
        <CellHint tone={ton.het ? 'warn' : 'neutral'}>
          {ton.chuaTheoDoi ? 'chưa theo dõi tồn' : `tồn ${ton.text}`}
        </CellHint>
      )}
      {trung && <CellHint tone="warn">{trung}</CellHint>}
      {ve && <CellHint tone="neutral">{ve}</CellHint>}
    </>
  )
}

/** Dưới ô Đơn giá dự kiến: lần mua trước (đơn Cung ứng / Kho tự mua) + chênh %. */
export function GoiYGia({ r }: { r: DongForm }) {
  if (!r.material_id) return null
  const cau = giaTruocCau(r.gia_goi_y)
  if (!cau) return <CellHint tone="neutral">chưa có giá mua trên hệ thống</CellHint>
  const c = chenhGia(r.unit_price, r.gia_goi_y)
  return (
    <>
      <CellHint
        tone="neutral"
        title={`${r.gia_goi_y?.po_code} · ${r.gia_goi_y?.supplier_name}`}
      >
        {cau}
      </CellHint>
      {c != null && Math.abs(c) >= 5 && (
        <CellHint tone={c > 0 ? 'warn' : 'neutral'}>
          {c > 0 ? `cao hơn lần trước ${c}%` : `thấp hơn lần trước ${-c}%`}
        </CellHint>
      )}
    </>
  )
}
