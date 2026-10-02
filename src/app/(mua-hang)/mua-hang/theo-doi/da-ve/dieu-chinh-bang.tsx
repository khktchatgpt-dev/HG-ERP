'use client'

import { Code } from '@/components/kit'
import { parseNum } from '@/lib/cut-plan/paste'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const O_SO =
  'num h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] text-k-sm bg-[var(--surface-card)] px-2 text-right hover:border-[var(--ink-3)] focus:border-[var(--act)]'

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
  return (
    <div className="flex flex-col">
      <div className="text-k-label grid grid-cols-[minmax(0,1fr)_88px_104px_80px] gap-2 border-b border-[var(--line)] pb-1 font-bold tracking-[.06em] text-[var(--ink-label)] uppercase">
        <span>Vật tư</span>
        <span className="text-right">Đang ghi</span>
        <span className="text-right">Số đúng</span>
        <span className="text-right">Chênh</span>
      </div>
      {dong.map((d) => {
        const raw = go[d.po_line_id] ?? ''
        const n = raw.trim() ? parseNum(raw) : null
        const chenh = n == null ? null : Math.round((n - d.hien) * 1e6) / 1e6
        return (
          <div
            key={d.po_line_id}
            className="grid grid-cols-[minmax(0,1fr)_88px_104px_80px] items-center gap-2 border-b border-[var(--line)] py-1.5"
          >
            <span className="text-k-sm flex min-w-0 flex-col items-start">
              <span className="whitespace-nowrap">
                <Code>{d.code}</Code>
              </span>
              <span className="w-full truncate text-[var(--ink-2)]" title={d.name}>
                {d.name}
              </span>
            </span>
            <span className="num text-k-sm text-right">
              {so(d.hien)} <span className="text-[var(--ink-3)]">{d.unit}</span>
            </span>
            <input
              inputMode="decimal"
              className={O_SO}
              value={raw}
              placeholder={so(d.hien)}
              onChange={(e) => onGo(d.po_line_id, e.target.value)}
              aria-label={`Số đúng của ${d.code}`}
            />
            <span
              className={`num text-k-sm text-right font-semibold ${
                chenh == null || chenh === 0
                  ? 'text-[var(--ink-3)]'
                  : n == null || n < 0
                    ? 'text-[var(--stop)]'
                    : 'text-[var(--ink)]'
              }`}
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
