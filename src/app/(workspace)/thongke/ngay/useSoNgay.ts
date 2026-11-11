'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { shiftIso } from '@/lib/local-date'
import {
  buildRows,
  CHIPS,
  moSan,
  type DocRow,
  type LockRow,
  type UnlockRow,
} from './so-ngay.shared'
import type { DayTeam } from '@/modules/dept/production/entries.service'

export type Matrix = {
  days: string[]
  teams: { id: string; name: string | null }[]
  cells: Record<string, { qty: number; defect: number; drafts: number; locked: boolean }>
}

export type SoNgayInput = {
  date: string
  today: string
  teams: DayTeam[]
  docs: DocRow[]
  locks: LockRow[]
  unlocks: UnlockRow[]
  unlockedPast: { entry_date: string; team_id: string; team_name: string }[]
  matrix: Matrix
  canLock: boolean
  canUnlock: boolean
  myTeamId: string | null
}

export type XacNhan = { teamId: string; kind: 'chot' | 'mo_khoa' }

/**
 * State + xử lý của Sổ ngày: tab, chip, hàng mở, ô xác nhận dưới hàng tổ,
 * gọi chốt / mở khoá (API cũ; mở khoá nay kèm lý do), kết quả bày tại chỗ.
 */
export function useSoNgay(p: SoNgayInput) {
  const router = useRouter()
  const rows = useMemo(
    () => buildRows(p.teams, p.docs, p.locks, p.unlocks, p.myTeamId),
    [p.teams, p.docs, p.locks, p.unlocks, p.myTeamId],
  )
  const [tab, setTab] = useState<'ngay' | 'tuan'>('ngay')
  const [chip, setChip] = useState('chua_chot')
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(rows.filter(moSan).map((r) => r.id)),
  )
  const [xacNhan, setXacNhan] = useState<XacNhan | null>(null)
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const counts = useMemo(
    () => Object.fromEntries(CHIPS.map((c) => [c.id, rows.filter(c.test).length])),
    [rows],
  )
  const shown = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    return rows.filter(test)
  }, [rows, chip])

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const hoi = (x: XacNhan | null) => {
    setXacNhan(x)
    setLyDo('')
    setMsg(null)
  }
  const go = (d: string) => router.push(`/thongke/ngay?date=${d}`)

  async function chot(teamId: string, teamName: string) {
    if (busy) return
    setBusy(true)
    try {
      await api('/api/dept/production/logbook/lock', {
        method: 'POST',
        body: { entry_date: p.date, team_department_id: teamId },
      })
      setMsg({
        ok: true,
        text: `Đã chốt sổ ${teamName} ngày ${p.date.split('-').reverse().join('/')}`,
      })
      setXacNhan(null)
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: `Không chốt được sổ ${teamName}: ${apiErrorText(e)}` })
    } finally {
      setBusy(false)
    }
  }

  async function moKhoa(teamId: string, teamName: string) {
    if (busy || lyDo.trim().length < 5) return
    setBusy(true)
    try {
      const q = new URLSearchParams({ date: p.date, team: teamId, reason: lyDo.trim() })
      await api(`/api/dept/production/logbook/lock?${q}`, { method: 'DELETE' })
      setMsg({ ok: true, text: `Đã mở khoá sổ ${teamName} — lý do đã ghi nhật ký` })
      setXacNhan(null)
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: `Không mở khoá được ${teamName}: ${apiErrorText(e)}` })
    } finally {
      setBusy(false)
    }
  }

  return {
    ...p,
    rows,
    shown,
    counts,
    tab,
    setTab,
    chip,
    setChip,
    open,
    toggle,
    xacNhan,
    hoi,
    lyDo,
    setLyDo,
    busy,
    msg,
    chot,
    moKhoa,
    go,
    homTruoc: () => go(shiftIso(p.date, -1)),
    homSau: () => go(shiftIso(p.date, 1)),
  } as const
}

export type SoNgayCtx = ReturnType<typeof useSoNgay>
