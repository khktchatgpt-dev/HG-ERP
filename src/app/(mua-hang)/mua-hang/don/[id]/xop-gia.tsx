'use client'

import { CellHint, NumInput } from '@/components/kit'
import {
  xopHaiGia,
  xopM3MoiTam,
  type Line,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { roundMoney } from '@/lib/po-line'
import type { PoTemplate } from '@/lib/po-template'
import { numStr, toNum } from './don-chung-tu.shared'

/**
 * MỘT Ô GIÁ CỦA DÒNG XỐP (09/10/2026). Hai ô "Đơn giá" (theo tấm) và "Đơn giá m³"
 * đứng cạnh nhau; dòng chỉ lưu một giá theo cơ sở tiền của nó, ô kia bày số quy
 * đổi qua m³/tấm (chữ nhạt) để đối chiếu báo giá NCC. GÕ vào ô nào thì dòng tính
 * tiền theo ô đó — `NumInput` chỉ chốt khi có gõ, nên Tab đi qua không đổi gì.
 */
export function XopGiaO({
  label,
  theo,
  l,
  template,
  currency,
  onPatch,
}: {
  label: string
  theo: 'tam' | 'm3'
  l: Line
  template: PoTemplate
  currency: string
  onPatch: (part: Partial<Line>) => void
}) {
  const g = xopHaiGia(template, l)
  const mine = theo === 'tam' ? g.donGia : g.giaM3
  const active = g.theo === theo
  const per = xopM3MoiTam(l)
  // Chưa biết m³/tấm thì không tính được theo m³ — tiền sẽ ra SL × giá/m³.
  if (theo === 'm3' && per == null) {
    return (
      <CellHint title="Gõ quy cách D×R×Dày (vd 580x540x60) để máy tính m³/tấm — khi đó mới nhập được giá theo m³">
        cần D×R×Dày
      </CellHint>
    )
  }
  return (
    <>
      <NumInput
        aria-label={label}
        value={
          active
            ? numStr(l.price)
            : mine == null
              ? ''
              : String(roundMoney(mine, currency))
        }
        onCommit={(v) =>
          onPatch({
            price: toNum(v),
            carton_basis: theo === 'm3' ? 'm3' : 'ctn',
            price_per: '',
          })
        }
        // .kit thắng lớp Tailwind (bẫy đã dính) — màu nhạt đặt bằng style.
        style={active ? undefined : { color: 'var(--ink-3)' }}
      />
      {!active && mine != null && (
        <CellHint
          title={
            theo === 'm3'
              ? 'Quy đổi từ giá theo tấm ÷ m³/tấm — gõ số vào đây để tính tiền theo m³'
              : 'Quy đổi từ giá/m³ × m³/tấm — gõ số vào đây để tính tiền theo tấm'
          }
        >
          quy đổi
        </CellHint>
      )}
    </>
  )
}

/** Ô giá xốp ở chế độ xem — số tính tiền đậm, số quy đổi nhạt. */
export function XopGiaXem({
  theo,
  l,
  template,
  currency,
}: {
  theo: 'tam' | 'm3'
  l: Line
  template: PoTemplate
  currency: string
}) {
  const g = xopHaiGia(template, l)
  const v = theo === 'tam' ? g.donGia : g.giaM3
  if (v == null) return <span className="text-[var(--ink-3)]">—</span>
  const txt = roundMoney(v, currency).toLocaleString('vi-VN')
  return g.theo === theo ? (
    <>{txt}</>
  ) : (
    <span className="text-[var(--ink-3)]" title="Số quy đổi — tiền tính theo cột kia">
      {txt}
    </span>
  )
}
