'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { DailyTarget } from '@/modules/dept/production/targets.repo'

/**
 * Lưới CHỈ TIÊU NGÀY: hàng = tổ SX, cột = công đoạn. Lưu = ghi đè trọn ngày
 * (ô trống không gửi). Toàn cảnh xưởng ưu tiên số ở đây, thiếu thì dùng số
 * suy từ lộ trình.
 */

const keyOf = (team: string, stage: string) => `${team}|${stage}`

export function TargetsGrid({
  date,
  teams,
  stages,
  targets,
  canEdit,
}: {
  date: string
  teams: { id: string; name: string }[]
  stages: { code: string; label: string }[]
  targets: DailyTarget[]
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [cells, setCells] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      targets.map((t) => [keyOf(t.team_department_id, t.stage), String(t.qty)]),
    ),
  )

  const filled = useMemo(
    () => Object.values(cells).filter((v) => v.trim() !== '').length,
    [cells],
  )

  function setCell(team: string, stage: string, v: string) {
    setCells((c) => ({ ...c, [keyOf(team, stage)]: v }))
    setDirty(true)
  }

  // Giao cho CẢ KHOẢNG ngày một lần (tài liệu tư vấn KH mục 3 — 24/08/2026):
  // cùng lưới chỉ tiêu/ngày áp cho [ngày..đến ngày], khỏi mở từng ngày nhập lại.
  const [applyTo, setApplyTo] = useState('')

  function datesInRange(from: string, to: string): string[] {
    const out: string[] = []
    const d = new Date(`${from}T00:00:00Z`)
    const end = Date.parse(`${to}T00:00:00Z`)
    while (d.getTime() <= end && out.length < 62) {
      out.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return out
  }

  async function save() {
    const rows: { team_department_id: string; stage: string; qty: number }[] = []
    for (const [k, v] of Object.entries(cells)) {
      const s = v.trim()
      if (s === '') continue
      const qty = Number(s)
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error('Có ô không phải số hợp lệ (≥ 0)')
        return
      }
      const [team, stage] = k.split('|')
      rows.push({ team_department_id: team, stage, qty })
    }
    const days = applyTo && applyTo > date ? datesInRange(date, applyTo) : [date]
    if (days.length > 31) {
      toast.error('Khoảng áp dụng tối đa 31 ngày')
      return
    }
    setBusy(true)
    try {
      // Ghi đè TRỌN từng ngày trong khoảng — chỉ tiêu là số/ngày (không chia).
      for (const d of days) {
        await api('/api/dept/production/targets', {
          method: 'PUT',
          body: { date: d, rows },
        })
      }
      toast.success(
        days.length > 1
          ? `Đã giao chỉ tiêu cho ${days.length} ngày (${new Date(days[0]).toLocaleDateString('vi-VN')} → ${new Date(days[days.length - 1]).toLocaleDateString('vi-VN')})`
          : 'Đã lưu chỉ tiêu ngày',
        `${rows.length} ô/ngày — Toàn cảnh xưởng dùng ngay số này`,
      )
      setDirty(false)
      setApplyTo('')
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
          { label: 'Chỉ tiêu ngày' },
        ]}
        title="Chỉ tiêu sản lượng ngày"
        description="Giao chỉ tiêu per tổ × công đoạn. Ô TRỐNG = không giao → Toàn cảnh dùng số suy từ lộ trình; ô 0 là chỉ tiêu thật (tổ làm việc khác)."
      />

      <div className="flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Ngày</span>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="bg-background rounded-md border px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border px-3 py-2 text-xs font-medium"
          >
            Xem
          </button>
        </form>
        <span className="text-muted-foreground text-xs">{filled} ô đã giao chỉ tiêu</span>
        {canEdit && (
          <span className="ml-auto flex items-end gap-2">
            <label
              className="flex flex-col gap-1 text-xs"
              title="Bỏ trống = chỉ lưu ngày đang xem. Chọn ngày = áp CÙNG lưới này cho mọi ngày từ ngày đang xem đến ngày chọn (ghi đè chỉ tiêu cũ của các ngày đó, tối đa 31 ngày)."
            >
              <span className="text-muted-foreground">Áp dụng đến ngày (tuỳ chọn)</span>
              <input
                type="date"
                value={applyTo}
                min={date}
                onChange={(e) => {
                  setApplyTo(e.target.value)
                  if (e.target.value) setDirty(true)
                }}
                className="bg-background rounded-md border px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={() => void save()}
              disabled={busy || !dirty}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}
              {applyTo && applyTo > date
                ? `Giao ${new Date(date).toLocaleDateString('vi-VN')} → ${new Date(applyTo).toLocaleDateString('vi-VN')}`
                : `Lưu chỉ tiêu ngày ${new Date(date).toLocaleDateString('vi-VN')}`}
            </button>
          </span>
        )}
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
              <th className="sticky left-0 bg-inherit px-3 py-2">Tổ</th>
              {stages.map((s) => (
                <th key={s.code} className="px-2 py-2 text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="sticky left-0 bg-inherit px-3 py-1.5 font-medium whitespace-nowrap">
                  {t.name}
                </td>
                {stages.map((s) => (
                  <td key={s.code} className="px-1 py-1 text-right">
                    <input
                      inputMode="decimal"
                      value={cells[keyOf(t.id, s.code)] ?? ''}
                      onChange={(e) => setCell(t.id, s.code, e.target.value)}
                      disabled={!canEdit}
                      placeholder="—"
                      className="t-data bg-background w-20 rounded border px-1.5 py-1 text-right tabular-nums disabled:opacity-60"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        Lưu ghi đè TRỌN ngày đang xem — xoá số một ô rồi Lưu là bỏ giao chỉ tiêu ô đó.
      </p>
    </div>
  )
}
