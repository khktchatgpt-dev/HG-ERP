'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/Badge'

/**
 * SỔ GHI SẢN LƯỢNG — hồ sơ gốc của quá trình sản xuất (append-only, 0039).
 * Nâng cấp từ list thu gọn: bảng nhóm theo NGÀY (như sổ giấy) + tổng kết đầu
 * sổ + bộ lọc công đoạn/tổ/chi tiết + xuất CSV để lưu trữ/đối chiếu.
 */

export type LogEntry = {
  id: string
  component_id: string
  stage: string
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  defect_reason: string | null
  machine_note: string | null
  note: string | null
  team_name: string | null
  created_by_name: string | null
}

const WEEKDAY = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function fmtDay(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAY[d.getDay()]}, ${d.toLocaleDateString('vi-VN')}`
}

const sel =
  'rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function OutputLogBook({
  entries,
  stageLabel,
  componentName,
  canDelete,
  onDelete,
}: {
  entries: LogEntry[]
  stageLabel: (code: string) => string
  componentName: (id: string) => string
  /** Xoá bản ghi nhập nhầm — server vẫn chặn theo creator/QL. */
  canDelete: boolean
  onDelete: (en: LogEntry) => void
}) {
  const [fStage, setFStage] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fComp, setFComp] = useState('')

  const stageOpts = useMemo(() => [...new Set(entries.map((e) => e.stage))], [entries])
  const teamOpts = useMemo(
    () => [...new Set(entries.map((e) => e.team_name ?? '—'))],
    [entries],
  )
  const compOpts = useMemo(
    () => [...new Set(entries.map((e) => e.component_id))],
    [entries],
  )

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!fStage || e.stage === fStage) &&
          (!fTeam || (e.team_name ?? '—') === fTeam) &&
          (!fComp || e.component_id === fComp),
      ),
    [entries, fStage, fTeam, fComp],
  )

  // Nhóm theo ngày (mới nhất trước) — đọc theo nhịp ngày như sổ giấy.
  const byDay = useMemo(() => {
    const m = new Map<string, LogEntry[]>()
    for (const e of filtered) {
      const list = m.get(e.entry_date) ?? []
      list.push(e)
      m.set(e.entry_date, list)
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const totQty = filtered.reduce((a, e) => a + Number(e.qty), 0)
  const totDefect = filtered.reduce((a, e) => a + Number(e.defect_qty), 0)
  const defectPct = totQty > 0 ? ((totDefect / totQty) * 100).toFixed(1) : '0'

  /** Xuất CSV UTF-8 BOM (Excel mở đúng tiếng Việt) — theo bộ lọc đang chọn. */
  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = [
      'Ngày',
      'Công đoạn',
      'Chi tiết',
      'Tổ',
      'SL làm',
      'Phế',
      'Kg',
      'Máy / màu',
      'Ghi chú',
      'Người nhập',
    ]
    const rows = filtered.map((e) =>
      [
        e.entry_date,
        stageLabel(e.stage),
        componentName(e.component_id),
        e.team_name ?? '',
        e.qty,
        e.defect_qty,
        e.kg ?? '',
        e.machine_note ?? '',
        e.note ?? '',
        e.created_by_name ?? '',
      ]
        .map(esc)
        .join(','),
    )
    const csv = '﻿' + [header.map(esc).join(','), ...rows].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'so-san-luong.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-zinc-400">
        Sổ chưa có bản ghi nào — tổ báo sản lượng ngày ở form phía trên.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Tổng kết + bộ lọc + xuất */}
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900/60">
        <span>
          <b>{filtered.length}</b>/{entries.length} lần ghi
        </span>
        <span className="text-zinc-400">·</span>
        <span>
          Σ SL <b>{totQty.toLocaleString('vi-VN')}</b>
        </span>
        <span className="text-zinc-400">·</span>
        <span className={totDefect > 0 ? 'text-red-600 dark:text-red-400' : ''}>
          Phế <b>{totDefect.toLocaleString('vi-VN')}</b> ({defectPct}%)
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            value={fStage}
            onChange={(e) => setFStage(e.target.value)}
            className={sel}
          >
            <option value="">Mọi công đoạn</option>
            {stageOpts.map((c) => (
              <option key={c} value={c}>
                {stageLabel(c)}
              </option>
            ))}
          </select>
          <select
            value={fTeam}
            onChange={(e) => setFTeam(e.target.value)}
            className={sel}
          >
            <option value="">Mọi tổ</option>
            {teamOpts.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={fComp}
            onChange={(e) => setFComp(e.target.value)}
            className={sel}
          >
            <option value="">Mọi chi tiết</option>
            {compOpts.map((c) => (
              <option key={c} value={c}>
                {componentName(c)}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
            title="Xuất sổ (theo bộ lọc đang chọn) — Excel mở trực tiếp"
          >
            ⇩ Xuất CSV
          </button>
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400">
          Không có bản ghi khớp bộ lọc.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                <th className="py-1.5 pr-2">Công đoạn</th>
                <th className="py-1.5 pr-2">Chi tiết</th>
                <th className="w-16 py-1.5 pr-2 text-right">SL làm</th>
                <th className="w-14 py-1.5 pr-2 text-right">Phế</th>
                <th className="w-16 py-1.5 pr-2 text-right">Kg</th>
                <th className="py-1.5 pr-2">Máy / màu</th>
                <th className="py-1.5 pr-2">Ghi chú</th>
                <th className="py-1.5 pr-2">Tổ</th>
                <th className="py-1.5 pr-2">Người nhập</th>
                {canDelete && <th className="w-8 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {byDay.map(([day, list]) => {
                const dQty = list.reduce((a, e) => a + Number(e.qty), 0)
                const dDefect = list.reduce((a, e) => a + Number(e.defect_qty), 0)
                return [
                  <tr key={`d-${day}`} className="bg-zinc-50 dark:bg-zinc-900/60">
                    <td
                      colSpan={canDelete ? 10 : 9}
                      className="px-1 py-1 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase"
                    >
                      {fmtDay(day)} · {list.length} lần ghi · Σ SL{' '}
                      {dQty.toLocaleString('vi-VN')}
                      {dDefect > 0 && (
                        <span className="text-red-500">
                          {' '}
                          · phế {dDefect.toLocaleString('vi-VN')}
                        </span>
                      )}
                    </td>
                  </tr>,
                  ...list.map((en) => (
                    <tr
                      key={en.id}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 pr-2">
                        <Badge>{stageLabel(en.stage)}</Badge>
                      </td>
                      <td className="py-1.5 pr-2 font-medium">
                        {componentName(en.component_id)}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-semibold">
                        {Number(en.qty).toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`py-1.5 pr-2 text-right ${
                          en.defect_qty > 0
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {en.defect_qty > 0
                          ? Number(en.defect_qty).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {en.kg != null ? Number(en.kg).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-zinc-500">
                        {en.machine_note || '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-zinc-500 italic">
                        {en.note || '—'}
                      </td>
                      <td className="py-1.5 pr-2">{en.team_name ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-zinc-500">
                        {en.created_by_name ?? '—'}
                      </td>
                      {canDelete && (
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => onDelete(en)}
                            className="text-red-500 hover:text-red-700"
                            title="Xoá bản ghi (nhập nhầm) — chỉ người nhập / QL"
                            aria-label="Xoá bản ghi"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
