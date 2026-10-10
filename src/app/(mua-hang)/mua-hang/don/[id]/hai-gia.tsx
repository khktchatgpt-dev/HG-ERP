'use client'

import { CellHint, NumInput } from '@/components/kit'
import {
  HAI_GIA,
  dv2MotDv,
  haiGia,
  haiGiaPatch,
  type Line,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { roundMoney } from '@/lib/po-line'
import type { PoTemplate } from '@/lib/po-template'
import { numStr, toNum } from './don-chung-tu.shared'

/**
 * MỘT Ô GIÁ CỦA MẪU CÓ HAI CỘT GIÁ (xốp 09/10/2026; nhôm · sắt/inox · gỗ · kính
 * 10/10/2026). "Đơn giá" (theo ĐVT đặt) và "Đơn giá kg/m³/m²" đứng cạnh nhau;
 * dòng chỉ lưu một giá theo cơ sở tiền của nó, ô kia bày số quy đổi (chữ nhạt)
 * để đối chiếu báo giá NCC. GÕ vào ô nào thì dòng tính tiền theo ô đó —
 * `NumInput` chỉ chốt khi có gõ, nên Tab đi qua không đổi gì.
 */
export function HaiGiaO({
  label,
  theo,
  l,
  template,
  currency,
  onPatch,
}: {
  label: string
  theo: 'dvt' | 'dv2'
  l: Line
  template: PoTemplate
  currency: string
  onPatch: (part: Partial<Line>) => void
}) {
  const cfg = HAI_GIA[template]
  const g = haiGia(template, l)
  const mine = theo === 'dvt' ? g.donGia : g.gia2
  const active = g.theo === theo
  // Chưa biết lượng quy đổi của một ĐVT thì không tính được theo kg/m³/m² — tiền
  // sẽ ra SL × giá/kg. Bảo thiếu số nào thay vì cho gõ.
  if (theo === 'dv2' && dv2MotDv(template, l) == null) {
    return <CellHint title={`Điền số quy đổi của dòng (${cfg?.thieu?.replace('cần ', '')}) — khi đó mới nhập được giá theo ${cfg?.dv}`}>{cfg?.thieu}</CellHint> // prettier-ignore
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
        onCommit={(v) => onPatch(haiGiaPatch(template, theo, toNum(v)))}
        // .kit thắng lớp Tailwind (bẫy đã dính) — màu nhạt đặt bằng style.
        style={active ? undefined : { color: 'var(--ink-3)' }}
      />
      {!active && mine != null && (
        <CellHint
          title={
            theo === 'dv2'
              ? `Quy đổi từ giá theo ĐVT ÷ ${cfg?.dv} của một ĐVT — gõ số vào đây để tính tiền theo ${cfg?.dv}`
              : `Quy đổi từ giá/${cfg?.dv} × ${cfg?.dv} của một ĐVT — gõ số vào đây để tính tiền theo ĐVT`
          }
        >
          quy đổi
        </CellHint>
      )}
    </>
  )
}

/** Ô giá ở chế độ xem — số tính tiền đậm, số quy đổi nhạt. */
export function HaiGiaXem({
  theo,
  l,
  template,
  currency,
}: {
  theo: 'dvt' | 'dv2'
  l: Line
  template: PoTemplate
  currency: string
}) {
  const g = haiGia(template, l)
  const v = theo === 'dvt' ? g.donGia : g.gia2
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
