'use client'

// BẢN CỦA KHO (12/10/2026) — chép từ bảng điều chỉnh của Cung ứng; không kit (B6).
import { parseNum } from '@/lib/cut-plan/paste'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

export type DongDc = {
  po_line_id: string
  code: string
  name: string
  unit: string
  /** Số đang ghi trên sổ: dòng gốc + các lần điều chỉnh trước. */
  hien: number
}

/** Gom dòng sổ của phiếu theo DÒNG ĐƠN — người sửa nghĩ theo dòng đơn, không theo dòng sổ. */
export function dongDieuChinh(row: DaVeRow): DongDc[] {
  const out = new Map<string, DongDc>()
  for (const l of row.lines) {
    const cur = out.get(l.po_line_id)
    if (cur) cur.hien += l.qty
    else
      out.set(l.po_line_id, {
        po_line_id: l.po_line_id,
        code: l.material_code,
        name: l.material_name,
        unit: l.unit,
        hien: l.qty,
      })
  }
  for (const d of out.values())
    d.hien = Math.round((d.hien + (row.chenh_theo_dong?.[d.po_line_id] ?? 0)) * 1e6) / 1e6
  return [...out.values()]
}

/** Số đúng người dùng đã gõ, chỉ những dòng ĐỌC ĐƯỢC và KHÁC số đang ghi. */
export function dongDoi(dong: DongDc[], go: Record<string, string>) {
  return dong.flatMap((d) => {
    const raw = go[d.po_line_id]
    if (raw == null || raw.trim() === '') return []
    const n = parseNum(raw)
    if (n == null || n < 0) return [{ po_line_id: d.po_line_id, qty: NaN, d }]
    return Math.abs(n - d.hien) > 1e-9 ? [{ po_line_id: d.po_line_id, qty: n, d }] : []
  })
}

/**
 * BẢNG ĐIỀU CHỈNH CHÊNH LỆCH (C) — mỗi dòng đơn: đang ghi · số đúng · chênh.
 * Ô "Số đúng" để trống = giữ nguyên dòng đó. Ô cập nhật theo từng phím (không đợi
 * rời ô) để nút ghi mở ngay — cùng lý do với hộp Sửa thông tin.
 */
export function DieuChinhBang({
  dong,
  go,
  onGo,
}: {
  dong: DongDc[]
  go: Record<string, string>
  onGo: (po_line_id: string, v: string) => void
}) {
  const luoi = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 108px 80px', gap: 8, alignItems: 'center' } as const // prettier-ignore
  return (
    <div className="kh-ds">
      <div
        style={{
          ...luoi,
          background: '#eef1f6',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: 'var(--kh-ink3)',
        }}
      >
        <span>Vật tư</span>
        <span style={{ textAlign: 'right' }}>Đang ghi</span>
        <span style={{ textAlign: 'right' }}>Số đúng</span>
        <span style={{ textAlign: 'right' }}>Chênh</span>
      </div>
      {dong.map((d) => {
        const raw = go[d.po_line_id] ?? ''
        const n = raw.trim() ? parseNum(raw) : null
        const chenh = n == null ? null : Math.round((n - d.hien) * 1e6) / 1e6
        return (
          <div key={d.po_line_id} style={luoi}>
            <span style={{ minWidth: 0 }}>
              <span className="kh-ma">{d.code}</span>
              <span
                className="kh-mut"
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                }}
                title={d.name}
              >
                {d.name}
              </span>
            </span>
            <span className="kh-num" style={{ textAlign: 'right' }}>
              {so(d.hien)} <span className="kh-mut">{d.unit}</span>
            </span>
            <input
              inputMode="decimal"
              className="kh-o num"
              value={raw}
              placeholder={so(d.hien)}
              onChange={(e) => onGo(d.po_line_id, e.target.value)}
              aria-label={`Số đúng của ${d.code}`}
            />
            <span
              className={`kh-num kh-b ${chenh == null || chenh === 0 ? 'kh-mut' : n == null || n < 0 ? 'kh-stop' : ''}`}
              style={{ textAlign: 'right' }}
            >
              {raw.trim() && n == null
                ? 'sai số'
                : chenh == null || chenh === 0
                  ? '—'
                  : `${chenh > 0 ? '+' : ''}${so(chenh)}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
