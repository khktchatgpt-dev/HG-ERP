'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { Toolbar, ToolbarSelect } from '@/components/erp/Toolbar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { FastEntryGrid, type PendingCells } from './FastEntryGrid'
import type { RunningLsx } from '../entry/EntryWorkbench'

/**
 * SỔ GHI SẢN LƯỢNG toàn xưởng — 3 vùng: (1) lọc Ngày/Tổ/Công đoạn/LSX,
 * (2) bảng sổ trong ngày + lưới nhập nhanh kiểu bảng tính,
 * (3) footer dính đáy: Ghi sổ + Chốt sổ ngày (khoá theo tổ) + Mở khoá (QL).
 */

export type Stage = { code: string; label: string }
export type Team = { id: string; name: string }
export type DefectCodeOpt = { code: string; label: string; stage_code: string | null }

type LogEntry = {
  id: string
  production_order_id: string
  component_id: string
  stage: string
  team_department_id: string | null
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  defect_reason: string | null
  machine_note: string | null
  note: string | null
  created_at: string
  team_name: string | null
  created_by_name: string | null
  component_name: string | null
  lsx_code: string | null
}

type DayLock = {
  id: string
  team_department_id: string
  entry_date: string
  locked_at: string
  team_name: string | null
  locked_by_name: string | null
}

const sel =
  'rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export function LogbookScreen({
  lsxList,
  canRecord,
  stages,
  teams,
  defectCodes,
  ownTeam,
  initialStage,
  canUnlock,
}: {
  lsxList: RunningLsx[]
  canRecord: boolean
  stages: Stage[]
  teams: Team[]
  defectCodes: DefectCodeOpt[]
  /** Tổ của người dùng (null = không thuộc xưởng / chưa gán). */
  ownTeam: Team | null
  initialStage: string | null
  /** admin/manager — được mở khoá sổ đã chốt. */
  canUnlock: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  // Đang GHI SỔ (do FastEntryGrid báo lên) — tách khỏi busy (chốt/mở khoá).
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fTeam, setFTeam] = useState(ownTeam?.id ?? '')
  const [fStage, setFStage] = useState('')
  const [fLsx, setFLsx] = useState('')
  const [data, setData] = useState<{ entries: LogEntry[]; locks: DayLock[] } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  // Nút "Ghi sổ" ở footer gọi hàm save của FastEntryGrid qua ref — không dùng
  // state để tránh vòng render (registerSave chạy mỗi khi hàm save đổi).
  const saveRef = useRef<(() => void) | null>(null)
  const registerSave = useCallback((fn: () => void) => {
    saveRef.current = fn
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await api<{ entries: LogEntry[]; locks: DayLock[] }>(
        `/api/dept/production/logbook?date=${date}`,
      )
      setData(d)
    } catch (e) {
      toast.error('Không tải được sổ', e instanceof ApiError ? e.message : 'Có lỗi')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    void load()
  }, [load])

  const stageLabel = (code: string) => stages.find((s) => s.code === code)?.label ?? code
  const reasonLabel = (code: string | null) =>
    code ? (defectCodes.find((c) => c.code === code)?.label ?? code) : null

  const entries = useMemo(
    () =>
      (data?.entries ?? []).filter(
        (e) =>
          (!fTeam || e.team_department_id === fTeam) &&
          (!fStage || e.stage === fStage) &&
          (!fLsx || e.production_order_id === fLsx),
      ),
    [data, fTeam, fStage, fLsx],
  )

  const lockedTeamIds = useMemo(
    () => new Set((data?.locks ?? []).map((l) => l.team_department_id)),
    [data],
  )
  // Tổ đang "quan tâm" cho nút chốt: NV xưởng = tổ mình; QL = tổ đang lọc.
  const focusTeam = ownTeam ?? teams.find((t) => t.id === fTeam) ?? null
  const focusLock = focusTeam
    ? (data?.locks ?? []).find((l) => l.team_department_id === focusTeam.id)
    : null

  const totQty = entries.reduce((a, e) => a + Number(e.qty), 0)
  const totDefect = entries.reduce((a, e) => a + Number(e.defect_qty), 0)

  async function removeEntry(en: LogEntry) {
    const ok = await confirm({
      title: 'Xoá bản ghi sản lượng?',
      description: `${en.lsx_code ?? ''} · ${en.component_name ?? ''} · ${stageLabel(en.stage)} · SL ${en.qty}. Sổ append-only — xoá rồi nhập lại nếu ghi nhầm.`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/output/${en.id}`, { method: 'DELETE' })
      toast.success('Đã xoá bản ghi')
      await load()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function lockDay() {
    if (!focusTeam) return
    const ok = await confirm({
      title: `Chốt sổ ngày ${date} — ${focusTeam.name}?`,
      description:
        'Sau khi chốt, KHÔNG ghi thêm / xoá được bản ghi của tổ trong ngày này. Muốn sửa phải nhờ quản lý mở khoá.',
      tone: 'danger',
      confirmLabel: 'Chốt sổ',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api('/api/dept/production/logbook/lock', {
        method: 'POST',
        body: { entry_date: date, team_department_id: focusTeam.id },
      })
      toast.success(`Đã chốt sổ ${focusTeam.name}`, date)
      await load()
    } catch (e) {
      toast.error('Chốt sổ thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function unlockDay() {
    if (!focusTeam) return
    const ok = await confirm({
      title: `Mở khoá sổ ${focusTeam.name} ngày ${date}?`,
      description: 'Tổ sẽ ghi thêm / xoá được bản ghi của ngày này cho tới khi chốt lại.',
      confirmLabel: 'Mở khoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/logbook/lock?date=${date}&team=${focusTeam.id}`, {
        method: 'DELETE',
      })
      toast.success(`Đã mở khoá sổ ${focusTeam.name}`, date)
      await load()
    } catch (e) {
      toast.error('Mở khoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-16">
      <TopProgressBar active={busy || saving} />
      <PageHeader
        breadcrumbs={[
          { label: 'Sản xuất', href: '/production' },
          { label: 'Sổ sản lượng' },
        ]}
        title="Sổ ghi sản lượng"
        description="Sổ toàn xưởng theo ngày: nhập nhanh kiểu bảng tính (mũi tên/Enter di chuyển, Ctrl+Enter ghi sổ), phế bắt buộc chọn nguyên nhân, cuối ngày Chốt sổ để khoá số liệu."
      />

      <StatsBar
        stats={[
          { label: 'Lần ghi (đã lọc)', value: entries.length, tone: 'blue' },
          { label: 'Σ SL đạt', value: totQty.toLocaleString('vi-VN'), tone: 'green' },
          {
            label: 'Phế',
            value: totDefect.toLocaleString('vi-VN'),
            tone: totDefect > 0 ? 'red' : 'gray',
          },
          {
            label: 'Tổ đã chốt',
            value: (data?.locks ?? []).length,
            tone: (data?.locks ?? []).length > 0 ? 'amber' : 'gray',
          },
        ]}
      />

      {/* Vùng 1 — bộ lọc */}
      <Toolbar
        left={
          <>
            <span className="flex items-center gap-1">
              <button
                onClick={() => setDate((d) => shiftDate(d, -1))}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                title="Hôm trước"
              >
                ◀
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className={sel}
              />
              <button
                onClick={() => setDate((d) => shiftDate(d, 1))}
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                title="Hôm sau"
              >
                ▶
              </button>
            </span>
            <ToolbarSelect
              value={fTeam}
              onChange={setFTeam}
              options={[
                { value: '', label: 'Mọi tổ' },
                ...teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <ToolbarSelect
              value={fStage}
              onChange={setFStage}
              options={[
                { value: '', label: 'Mọi công đoạn' },
                ...stages.map((s) => ({ value: s.code, label: s.label })),
              ]}
            />
            <ToolbarSelect
              value={fLsx}
              onChange={setFLsx}
              options={[
                { value: '', label: 'Mọi lệnh SX' },
                ...lsxList.map((l) => ({ value: l.id, label: l.code })),
              ]}
            />
          </>
        }
      />

      {/* Vùng 2a — sổ của ngày */}
      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            Sổ ngày {date}
          </h2>
        </div>
        {!data ? (
          <p className="px-4 py-6 text-center text-xs text-zinc-400">Đang tải sổ…</p>
        ) : entries.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon="☷"
              title="Chưa có bản ghi nào khớp bộ lọc"
              description={canRecord ? 'Nhập sản lượng ở lưới bên dưới.' : ''}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                  <th className="px-3 py-1.5">Lệnh SX</th>
                  <th className="py-1.5 pr-2">Chi tiết</th>
                  <th className="py-1.5 pr-2">Công đoạn</th>
                  <th className="py-1.5 pr-2">Tổ</th>
                  <th className="w-16 py-1.5 pr-2 text-right">SL</th>
                  <th className="w-14 py-1.5 pr-2 text-right">Phế</th>
                  <th className="py-1.5 pr-2">Nguyên nhân lỗi</th>
                  <th className="w-16 py-1.5 pr-2 text-right">Kg</th>
                  <th className="py-1.5 pr-2">Máy / màu</th>
                  <th className="py-1.5 pr-2">Người ghi</th>
                  <th className="w-8 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {entries.map((en) => {
                  const locked =
                    !!en.team_department_id && lockedTeamIds.has(en.team_department_id)
                  return (
                    <tr
                      key={en.id}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/production/lsx/${en.production_order_id}`}
                          className="font-mono text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {en.lsx_code ?? '?'}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-2 font-medium">
                        {en.component_name ?? '?'}
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge>{stageLabel(en.stage)}</Badge>
                      </td>
                      <td className="py-1.5 pr-2">{en.team_name ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold">
                        {Number(en.qty).toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`py-1.5 pr-2 text-right ${en.defect_qty > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-zinc-400'}`}
                      >
                        {en.defect_qty > 0
                          ? Number(en.defect_qty).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                      <td className="py-1.5 pr-2">
                        {en.defect_qty > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            {reasonLabel(en.defect_reason) ?? '—'}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {en.kg != null ? Number(en.kg).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-zinc-500">
                        {en.machine_note || '—'}
                      </td>
                      <td className="py-1.5 pr-2 text-zinc-500">
                        {en.created_by_name ?? '—'}
                        <span className="text-zinc-400"> · {fmtTime(en.created_at)}</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {canRecord && (
                          <button
                            onClick={() => void removeEntry(en)}
                            disabled={busy || locked}
                            className="text-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
                            title={
                              locked
                                ? 'Sổ tổ này đã chốt — quản lý mở khoá trước'
                                : 'Xoá bản ghi (nhập nhầm) — chỉ người nhập / QL'
                            }
                            aria-label="Xoá bản ghi"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Vùng 2b — lưới nhập nhanh */}
      {canRecord && (
        <FastEntryGrid
          lsxList={lsxList}
          stages={stages}
          defectCodes={defectCodes}
          initialStage={initialStage}
          date={date}
          locked={!!focusLock && !!ownTeam}
          onSaved={load}
          onPendingChange={setPendingCount}
          onSavingChange={setSaving}
          registerSave={registerSave}
        />
      )}

      {/* Vùng 3 — footer chốt sổ (dính đáy) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur lg:pl-64 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex flex-wrap items-center gap-2">
          {focusTeam ? (
            focusLock ? (
              <Badge tone="red">
                🔒 {focusTeam.name}: đã chốt — {focusLock.locked_by_name ?? '?'} ·{' '}
                {fmtTime(focusLock.locked_at)}
              </Badge>
            ) : (
              <Badge tone="green">{focusTeam.name}: sổ đang mở</Badge>
            )
          ) : (
            <span className="text-xs text-zinc-400">Chọn tổ để chốt sổ</span>
          )}
          {(data?.locks ?? [])
            .filter((l) => l.team_department_id !== focusTeam?.id)
            .map((l) => (
              <Badge key={l.id} tone="gray">
                🔒 {l.team_name}
              </Badge>
            ))}
          <span className="ml-auto flex items-center gap-2">
            {canRecord && (
              <button
                disabled={busy || saving || pendingCount === 0}
                onClick={() => saveRef.current?.()}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {(busy || saving) && <Spinner size={12} />}
                {saving ? 'Đang ghi…' : `✓ Ghi sổ (${pendingCount} dòng)`}
              </button>
            )}
            {canRecord && focusTeam && !focusLock && (
              <button
                disabled={busy}
                onClick={() => void lockDay()}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                🔒 Chốt sổ ngày
              </button>
            )}
            {canUnlock && focusTeam && focusLock && (
              <button
                disabled={busy}
                onClick={() => void unlockDay()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                🔓 Mở khoá
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export type { PendingCells }
