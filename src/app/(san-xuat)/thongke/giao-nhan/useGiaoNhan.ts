'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  docInTab,
  num,
  TABS,
  type Doc,
  type NhanDraft,
  type Payload,
  type SourceRow,
  type TabKey,
} from './giao-nhan.shared'

/**
 * State + xử lý màn Giao nhận (S5, 0289). Hai nửa: hộp phiếu (trái) và bảng
 * lập phiếu (phải, mở khi bấm "Lập phiếu giao"). Mọi mutation: api() →
 * router.refresh() → thông báo một dòng tại chỗ.
 */
export function useGiaoNhan(p: Payload) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('cho_nhan')
  const [lsxLoc, setLsxLoc] = useState<string>('')
  // Tổ ĐANG ĐỨNG: tổ của người xem; admin / thống kê chung chọn tổ ở đầu trang.
  const [teamId, setTeamId] = useState<string>(
    () => p.me?.team_id ?? p.teams.find((t) => t.stage_code)?.id ?? '',
  )
  const team = p.teams.find((t) => t.id === teamId) ?? null
  const stageLabel = (c: string | null) =>
    c ? (p.stages.find((s) => s.code === c)?.label ?? c) : '—'
  const teamName = (id: string | null) => p.teams.find((t) => t.id === id)?.name ?? '—'

  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [nhap, setNhap] = useState<Record<string, NhanDraft>>({})
  /** Hộp hỏi lý do: huỷ hoặc đảo một phiếu. */
  const [hoi, setHoi] = useState<{
    kind: 'huy' | 'dao'
    doc: Doc
    reason: string
  } | null>(null)

  const counts = useMemo(() => {
    const out = {} as Record<TabKey, number>
    for (const t of TABS) {
      out[t] = p.docs.filter(
        (d) => (!lsxLoc || d.lsx_id === lsxLoc) && docInTab(d, t, teamId),
      ).length
    }
    return out
  }, [p.docs, teamId, lsxLoc])
  const docs = useMemo(
    () =>
      p.docs.filter((d) => (!lsxLoc || d.lsx_id === lsxLoc) && docInTab(d, tab, teamId)),
    [p.docs, tab, teamId, lsxLoc],
  )

  const draftOf = (lineId: string, qty: number): NhanDraft =>
    nhap[lineId] ?? { received: String(qty), reason: '' }
  const patchNhan = (lineId: string, patch: Partial<NhanDraft>) => {
    setNhap((n) => ({
      ...n,
      [lineId]: { ...(n[lineId] ?? { received: '', reason: '' }), ...patch },
    }))
    setLoi(null)
  }
  /** Dòng có chênh mà chưa lý do — chặn "Xác nhận" của phiếu đó. */
  const thieuLyDo = (d: Doc) =>
    d.lines.find((l) => {
      const x = draftOf(l.id, l.qty)
      return num(x.received) !== l.qty && !x.reason.trim()
    }) ?? null
  const coChenh = (d: Doc) =>
    d.lines.some((l) => num(draftOf(l.id, l.qty).received) !== l.qty)

  const run = async (label: string, fn: () => Promise<{ doc_no: string }>) => {
    if (busy) return
    setBusy(true)
    setLoi(null)
    try {
      const r = await fn()
      const gio = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      setThongBao(`${label} ${r.doc_no} lúc ${gio}`)
      setHoi(null)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không thực hiện được'))
    } finally {
      setBusy(false)
    }
  }

  const nhanDu = (d: Doc) =>
    run('Đã nhận đủ', () =>
      api<{ doc_no: string }>(`/api/dept/production/giao-nhan/${d.id}`, {
        method: 'POST',
        body: { action: 'nhan' },
      }),
    )
  const xacNhan = (d: Doc) =>
    run('Đã xác nhận', () =>
      api<{ doc_no: string }>(`/api/dept/production/giao-nhan/${d.id}`, {
        method: 'POST',
        body: {
          action: 'nhan',
          lines: d.lines.map((l) => {
            const x = draftOf(l.id, l.qty)
            return {
              transfer_id: l.id,
              received_qty: num(x.received),
              diff_reason: x.reason.trim() || null,
            }
          }),
        },
      }),
    )
  const huy = () =>
    hoi &&
    run('Đã huỷ', () =>
      api<{ doc_no: string }>(`/api/dept/production/giao-nhan/${hoi.doc.id}`, {
        method: 'POST',
        body: { action: 'huy', reason: hoi.reason.trim() },
      }),
    )
  const dao = () =>
    hoi &&
    run('Đã lập phiếu đảo', () =>
      api<{ doc_no: string }>(`/api/dept/production/giao-nhan/${hoi.doc.id}`, {
        method: 'POST',
        body: { action: 'dao', reason: hoi.reason.trim() },
      }),
    )

  // ── Lập phiếu giao ─────────────────────────────────────────────────────
  const [moForm, setMoForm] = useState(false)
  const [fromStage, setFromStage] = useState<string>(team?.stage_code ?? '')
  const [toTeamId, setToTeamId] = useState<string>('')
  const [lsxId, setLsxId] = useState<string>(p.lsx[0]?.id ?? '')
  const [date, setDate] = useState(p.today)
  const [nguon, setNguon] = useState<SourceRow[] | null>(null)
  const [nguonLoi, setNguonLoi] = useState<string | null>(null)
  const [giao, setGiao] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')

  const taiNguon = async (lsx: string, stage: string) => {
    setNguon(null)
    setNguonLoi(null)
    setGiao({})
    if (!lsx || !stage) return
    try {
      const rows = await api<SourceRow[]>(
        `/api/dept/production/giao-nhan/nguon?lsx=${lsx}&stage=${encodeURIComponent(stage)}`,
      )
      setNguon(rows)
      // Gợi ý tổ nhận: tổ phụ trách công đoạn kế tiếp của dòng đầu tiên có lộ trình.
      const next = rows.find((r) => r.next_stage)?.next_stage ?? null
      const suggested = next ? p.teams.find((t) => t.stage_code === next) : null
      setToTeamId((cur) => cur || suggested?.id || '')
    } catch (e) {
      setNguonLoi(apiErrorText(e, 'Không tải được dòng của lệnh'))
    }
  }
  const moLapPhieu = () => {
    const st = fromStage || team?.stage_code || ''
    setFromStage(st)
    setMoForm(true)
    void taiNguon(lsxId, st)
  }
  const doiLenh = (id: string) => {
    setLsxId(id)
    void taiNguon(id, fromStage)
  }
  const doiFromStage = (st: string) => {
    setFromStage(st)
    setToTeamId('')
    void taiNguon(lsxId, st)
  }
  const doiTeam = (id: string) => {
    setTeamId(id)
    const st = p.teams.find((t) => t.id === id)?.stage_code ?? ''
    setFromStage(st)
    if (moForm) void taiNguon(lsxId, st)
  }

  const dongGiao = useMemo(
    () => (nguon ?? []).filter((r) => num(giao[r.component_id]) > 0),
    [nguon, giao],
  )
  const tongGiao = dongGiao.reduce((a, r) => a + num(giao[r.component_id]), 0)
  const vuotTon = dongGiao.filter((r) => num(giao[r.component_id]) > r.on_hand)
  const toTeam = p.teams.find((t) => t.id === toTeamId) ?? null
  const toStage = toTeam?.stage_code ?? null
  const guiWhy = !teamId
    ? 'Chọn tổ giao'
    : !fromStage
      ? 'Tổ này chưa gắn công đoạn — gán ở Cấu hình › Công đoạn'
      : !lsxId
        ? 'Chọn lệnh'
        : !toTeamId
          ? 'Chọn tổ nhận'
          : !toStage
            ? 'Tổ nhận chưa gắn công đoạn'
            : toStage === fromStage
              ? 'Tổ nhận cùng công đoạn với tổ giao'
              : date > p.today
                ? 'Ngày chưa tới'
                : dongGiao.length === 0
                  ? 'Chưa gõ số giao ở dòng nào'
                  : null

  const guiPhieu = async () => {
    if (guiWhy || busy) return
    setBusy(true)
    setLoi(null)
    try {
      const r = await api<{ doc_no: string; warnings: string[] }>(
        '/api/dept/production/giao-nhan',
        {
          method: 'POST',
          body: {
            production_order_id: lsxId,
            from_stage: fromStage,
            from_team_id: teamId,
            to_stage: toStage,
            to_team_id: toTeamId,
            entry_date: date,
            note: note.trim() || null,
            lines: dongGiao.map((x) => ({
              component_id: x.component_id,
              qty: num(giao[x.component_id]),
            })),
          },
        },
      )
      setThongBao(
        `Đã gửi phiếu ${r.doc_no} cho ${toTeam?.name ?? ''}${r.warnings.length ? ` — ${r.warnings.join(' · ')}` : ''}`,
      )
      setGiao({})
      setNote('')
      setMoForm(false)
      setTab('da_giao')
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không gửi được phiếu'))
    } finally {
      setBusy(false)
    }
  }

  return {
    p,
    tab,
    setTab,
    counts,
    docs,
    lsxLoc,
    setLsxLoc,
    teamId,
    team,
    doiTeam,
    stageLabel,
    teamName,
    busy,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    draftOf,
    patchNhan,
    thieuLyDo,
    coChenh,
    nhanDu,
    xacNhan,
    hoi,
    setHoi,
    huy,
    dao,
    moForm,
    setMoForm,
    moLapPhieu,
    fromStage,
    doiFromStage,
    toTeamId,
    setToTeamId,
    toTeam,
    toStage,
    lsxId,
    doiLenh,
    date,
    setDate,
    nguon,
    nguonLoi,
    giao,
    setGiao,
    note,
    setNote,
    dongGiao,
    tongGiao,
    vuotTon,
    guiWhy,
    guiPhieu,
  } as const
}

export type GiaoNhanCtx = ReturnType<typeof useGiaoNhan>
