'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Lock, LockOpen } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { STATUS_LABEL, type EntryDocStatus } from '@/lib/entry-doc-flow'

/**
 * SỔ NGÀY: phiếu của một ngày gom theo TỔ + nút chốt sổ per tổ (B3).
 * Ngày đổi bằng điều hướng ?date= — dữ liệu là server render, không fetch tay.
 */

type DocRow = {
  id: string
  doc_no: string
  lsx_id: string
  lsx_code: string | null
  stage: string
  status: EntryDocStatus
  team_id: string | null
  team_name: string | null
  created_by_name: string | null
  total_qty: number
  total_defect: number
  line_count: number
}

const TONE: Record<EntryDocStatus, 'gray' | 'amber' | 'green' | 'red'> = {
  nhap: 'gray',
  cho_xac_nhan: 'amber',
  da_xac_nhan: 'green',
  tu_choi: 'red',
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('vi-VN')
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function NgayScreen({
  date,
  today,
  stages,
  docs,
  locks,
  unlockedPast,
  canLock,
  canUnlock,
}: {
  date: string
  today: string
  stages: Record<string, string>
  docs: DocRow[]
  locks: { team_id: string; team_name: string | null; locked_by_name: string | null }[]
  unlockedPast: { entry_date: string; team_id: string; team_name: string }[]
  canLock: boolean
  canUnlock: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const lockByTeam = useMemo(() => new Map(locks.map((l) => [l.team_id, l])), [locks])

  // Gom phiếu theo tổ — tổ có khoá mà không có phiếu vẫn hiện (đã chốt sổ trống).
  const teams = useMemo(() => {
    const m = new Map<string, { name: string; docs: DocRow[] }>()
    for (const d of docs) {
      const id = d.team_id ?? 'khong-to'
      const t = m.get(id) ?? { name: d.team_name ?? '(không tổ)', docs: [] }
      t.docs.push(d)
      m.set(id, t)
    }
    for (const l of locks) {
      if (!m.has(l.team_id)) m.set(l.team_id, { name: l.team_name ?? '?', docs: [] })
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [docs, locks])

  const go = (d: string) => router.push(`/thongke/ngay?date=${d}`)

  async function lock(teamId: string, teamLabel: string) {
    if (busy) return
    setBusy(true)
    try {
      await api('/api/dept/production/logbook/lock', {
        method: 'POST',
        body: { entry_date: date, team_department_id: teamId },
      })
      toast.success(`Đã chốt sổ ${teamLabel} — ngày ${fmtDate(date)}`)
      router.refresh()
    } catch (e) {
      toast.error('Không chốt được sổ', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function unlock(teamId: string, teamLabel: string) {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/dept/production/logbook/lock?date=${date}&team=${teamId}`, {
        method: 'DELETE',
      })
      toast.success(`Đã mở khoá sổ ${teamLabel}`)
      router.refresh()
    } catch (e) {
      toast.error('Không mở khoá được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Sổ ngày' },
        ]}
        title="Sổ ngày & chốt sổ"
        description="Phiếu báo sản lượng của ngày, gom theo tổ — chốt sổ là khoá ghi/sửa của tổ trong ngày."
      />

      {/* Chọn ngày */}
      <section className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => go(shift(date, -1))}>
          <ChevronLeft aria-hidden />
          Hôm trước
        </Button>
        <Input
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="h-8 w-40 text-xs"
          aria-label="Chọn ngày"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={date >= today}
          onClick={() => go(shift(date, 1))}
        >
          Hôm sau
          <ChevronRight aria-hidden />
        </Button>
        {date !== today && (
          <Button variant="outline" size="sm" onClick={() => go(today)}>
            Hôm nay
          </Button>
        )}
      </section>

      {/* Ngày cũ có sổ mà quên chốt — sổ mở vô hạn là mất ý nghĩa khoá số liệu */}
      {unlockedPast.length > 0 && (
        <section className="rounded-lg border border-[var(--warn)]/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-4 py-2.5 text-xs">
          <span className="font-semibold text-[var(--warn)]">Quên chốt sổ: </span>
          {unlockedPast.map((p, i) => (
            <span key={`${p.entry_date}|${p.team_id}`}>
              {i > 0 && ' · '}
              <Link
                href={`/thongke/ngay?date=${p.entry_date}`}
                className="underline hover:text-[var(--primary)]"
              >
                {p.team_name} — {fmtDate(p.entry_date)}
              </Link>
            </span>
          ))}
        </section>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon="▦"
          title={`Ngày ${fmtDate(date)} chưa có phiếu nào`}
          description="Ghi sổ từ màn Tiến độ theo lệnh — phiếu sẽ tự gom về đây theo tổ."
        />
      ) : (
        teams.map(([teamId, t]) => {
          const lk = lockByTeam.get(teamId)
          const totalQty = t.docs.reduce((a, d) => a + d.total_qty, 0)
          return (
            <section key={teamId} className="bg-card overflow-hidden rounded-lg border">
              <div className="bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-2">
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="t-data text-muted-foreground text-xs">
                  {t.docs.length} phiếu · Σ đạt {fmt(totalQty)}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  {lk ? (
                    <>
                      <Badge tone="green">
                        Đã chốt sổ{lk.locked_by_name ? ` — ${lk.locked_by_name}` : ''}
                      </Badge>
                      {canUnlock && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => unlock(teamId, t.name)}
                        >
                          <LockOpen aria-hidden />
                          Mở khoá
                        </Button>
                      )}
                    </>
                  ) : (
                    canLock && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => lock(teamId, t.name)}
                      >
                        <Lock aria-hidden />
                        Chốt sổ ngày
                      </Button>
                    )
                  )}
                </span>
              </div>
              {t.docs.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
                        <th className="px-4 py-1.5">Số phiếu</th>
                        <th className="py-1.5 pr-2">Lệnh</th>
                        <th className="py-1.5 pr-2">Công đoạn</th>
                        <th className="py-1.5 pr-2 text-right">Dòng</th>
                        <th className="py-1.5 pr-2 text-right">Σ đạt</th>
                        <th className="py-1.5 pr-2 text-right">Phế</th>
                        <th className="py-1.5 pr-2">Trạng thái</th>
                        <th className="py-1.5 pr-4">Người lập</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.docs.map((d) => (
                        <tr key={d.id} className="border-b last:border-b-0">
                          <td className="px-4 py-1.5">
                            <DocChip>{d.doc_no}</DocChip>
                          </td>
                          <td className="py-1.5 pr-2">
                            <Link
                              href={`/thongke/lsx/${d.lsx_id}`}
                              className="t-data text-xs hover:text-[var(--primary)] hover:underline"
                            >
                              {d.lsx_code ?? '—'}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-2">{stages[d.stage] ?? d.stage}</td>
                          <td className="t-data py-1.5 pr-2 text-right">
                            {d.line_count}
                          </td>
                          <td className="t-data py-1.5 pr-2 text-right font-semibold">
                            {fmt(d.total_qty)}
                          </td>
                          <td className="t-data py-1.5 pr-2 text-right">
                            {d.total_defect > 0 ? (
                              <span className="text-[var(--warn)]">
                                {fmt(d.total_defect)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-2">
                            <Badge tone={TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                          </td>
                          <td className="text-muted-foreground py-1.5 pr-4 text-xs">
                            {d.created_by_name ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
