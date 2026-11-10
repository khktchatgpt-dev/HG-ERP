'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { lsxStatusLabel } from '@/lib/lsx-status'
import { daysLeft, type Payload, type Pick, type TabKey } from './ho-so-lenh.shared'

export type HoSoLenhProps = {
  data: Payload
  canRecord: boolean
  canComplete: boolean
  canForceComplete: boolean
  canPlan: boolean
  meId: string
  meName: string
}

/**
 * State + xử lý Hồ sơ lệnh (S3, B5). Mọi số đã tính ở server (một hàm với Ghi
 * sản lượng + Giao nhận); hook này chỉ lọc, chọn ô, và gọi ba mutation: đóng
 * lệnh · phiếu PBS (ghi chính thức / xoá nháp) · sửa job (tổ / hạn).
 */
export function useHoSoLenh(p: HoSoLenhProps) {
  const { data } = p
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('dong_bo')
  const [chiDinhHinh, setChiDinhHinh] = useState(true)
  const [spLoc, setSpLoc] = useState('')
  /** Cụm đang BUNG chi tiết (mặc định gấp — 104 chi tiết là không đọc nổi). */
  const [bung, setBung] = useState<Set<string>>(() => new Set())
  const [pick, setPick] = useState<Pick | null>(null)
  /** Khối "Khối lượng theo công đoạn" (bước 2, 09/11): ô đang chọn → bảng
   *  Đồng bộ tô cột đó; `klBung` = đang bày bảng theo dòng SP thay cho dải ô. */
  const [congDoanChon, setCongDoanChon] = useState<string | null>(null)
  const [klBung, setKlBung] = useState(false)
  const chonCongDoan = (code: string) => {
    const next = congDoanChon === code ? null : code
    setCongDoanChon(next)
    if (next && typeof document !== 'undefined') {
      document
        .querySelector(`[data-stage-col="${next}"]`)
        ?.scrollIntoView({ inline: 'center', block: 'nearest' })
    }
  }
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)

  const lines = useMemo(
    () =>
      data.lines.filter(
        (l) =>
          (!chiDinhHinh || l.has_components) && (!spLoc || l.order_line_id === spLoc),
      ),
    [data.lines, chiDinhHinh, spLoc],
  )
  const toggleBung = (id: string) =>
    setBung((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // ── Số đầu trang (mỗi ô kèm mẫu số) ───────────────────────────────────
  const tongDat = data.lines.reduce((a, l) => a + l.qty, 0)
  const soDinhHinh = data.lines.filter((l) => l.has_components).length
  const soChiTiet = data.lines.reduce(
    (a, l) => a + l.rows.filter((r) => r.tier === 'part').length,
    0,
  )
  const finishStage =
    data.stages.filter((s) => s.count_level === 'unit').at(-1)?.code ?? null
  const hoanThien = finishStage
    ? data.lines.reduce(
        (a, l) =>
          a + (l.rows.find((r) => r.tier === 'finish')?.cells[finishStage]?.done ?? 0),
        0,
      )
    : 0
  const tonCongDoan = data.lines.reduce(
    (a, l) =>
      a +
      l.rows
        .filter((r) => r.parent_id == null && r.tier !== 'part')
        .reduce(
          (b, r) =>
            b + Object.values(r.cells).reduce((c, x) => c + Math.max(0, x.on_hand), 0),
          0,
        ),
    0,
  )
  const pgtChoNhan = data.pgt.filter(
    (d) => d.status === 'da_giao' && !d.reverses_doc_id,
  ).length
  const jobsTre = data.jobs.filter(
    (j) =>
      j.status !== 'done' && j.planned_end && j.planned_end.slice(0, 10) < data.today,
  ).length
  const shipLeft = daysLeft(data.lsx.ship_date, data.today)

  // ── Đóng lệnh ──────────────────────────────────────────────────────────
  const closable = data.lsx.status === 'approved' || data.lsx.status === 'in_progress'
  const viecDo = data.jobs.filter((j) => j.status !== 'done').length
  const noPlan = data.jobs.length === 0
  const dongWhy = !p.canComplete
    ? 'Quản đốc / Giám đốc mới đóng được lệnh'
    : !closable
      ? data.lsx.status === 'completed' || data.lsx.status === 'cancelled'
        ? `Lệnh đã ${lsxStatusLabel(data.lsx.status).toLowerCase()} — không đóng lại được`
        : `Lệnh đang ${lsxStatusLabel(data.lsx.status).toLowerCase()}`
      : noPlan
        ? 'Chưa có công việc nào — định hình + lên kế hoạch trước'
        : viecDo > 0
          ? `${viecDo} việc chưa xong${p.canForceComplete ? ' — ép đóng kèm lý do' : ''}`
          : null
  const [epMo, setEpMo] = useState(false)
  const [epLyDo, setEpLyDo] = useState('')
  // Hộp xác nhận TRƯỚC khi đóng (10/11/2026): đóng lệnh khép vòng đời + đổi
  // trạng thái đơn hàng, trước đó một cú bấm là xong, không hỏi, không kiểm
  // hoàn thiện đủ chưa (lệnh TEST bấm nhầm là đóng ngay).
  const [xacNhanMo, setXacNhanMo] = useState(false)
  const hoiDong = () => {
    if (busy || dongWhy) return
    setLoi(null)
    setXacNhanMo(true)
  }
  const dongLenh = async (override: boolean) => {
    if (busy) return
    if (override && !epLyDo.trim()) {
      setLoi('Ép đóng lệnh phải ghi lý do')
      return
    }
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/dept/production/lsx/${data.lsx.id}/complete`, {
        method: 'POST',
        body: { override, note: override ? epLyDo.trim() : null },
      })
      setEpMo(false)
      setXacNhanMo(false)
      setEpLyDo('')
      setThongBao(`Đã đóng lệnh ${data.lsx.code} — đơn hàng chuyển sang hoàn thành`)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không đóng được lệnh'))
    } finally {
      setBusy(false)
    }
  }

  // ── Phiếu PBS ──────────────────────────────────────────────────────────
  const [xoaHoi, setXoaHoi] = useState<string | null>(null)
  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    setLoi(null)
    try {
      await fn()
      setThongBao(label)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không thực hiện được'))
    } finally {
      setBusy(false)
    }
  }
  const pbsChinhThuc = (id: string, no: string) =>
    run(`Phiếu ${no} đã ghi chính thức`, () =>
      api(`/api/dept/production/entry-docs/${id}`, { method: 'PATCH' }),
    )
  const pbsXoa = (id: string, no: string) => {
    if (xoaHoi !== id) {
      setXoaHoi(id)
      return
    }
    setXoaHoi(null)
    void run(`Đã xoá phiếu ${no}`, () =>
      api(`/api/dept/production/entry-docs/${id}`, { method: 'DELETE' }),
    )
  }

  // ── Kế hoạch tổ & hạn: sửa từng job ────────────────────────────────────
  type JobDraft = { team: string; start: string; end: string; reason: string }
  const [jobNhap, setJobNhap] = useState<Record<string, JobDraft>>({})
  const jobDraft = (j: Payload['jobs'][number]): JobDraft =>
    jobNhap[j.id] ?? {
      team: j.team_department_id ?? '',
      start: j.planned_start?.slice(0, 10) ?? '',
      end: j.planned_end?.slice(0, 10) ?? '',
      reason: '',
    }
  const patchJob = (id: string, patch: Partial<JobDraft>, j: Payload['jobs'][number]) =>
    setJobNhap((m) => ({ ...m, [id]: { ...jobDraft(j), ...(m[id] ?? {}), ...patch } }))
  const jobDirty = (j: Payload['jobs'][number]) => {
    const d = jobNhap[j.id]
    if (!d) return false
    return (
      d.team !== (j.team_department_id ?? '') ||
      d.start !== (j.planned_start?.slice(0, 10) ?? '') ||
      d.end !== (j.planned_end?.slice(0, 10) ?? '')
    )
  }
  const luuJob = (j: Payload['jobs'][number]) => {
    const d = jobDraft(j)
    if (j.status !== 'todo' && !d.reason.trim()) {
      setLoi(`Việc "${j.stage}" đã chạy — đổi tổ / hạn phải ghi lý do`)
      return
    }
    void run('Đã lưu kế hoạch', async () => {
      await api(`/api/dept/production/jobs/${j.id}`, {
        method: 'PATCH',
        body: {
          team_department_id: d.team || null,
          planned_start: d.start || null,
          planned_end: d.end || null,
          reason: d.reason.trim() || null,
        },
      })
      setJobNhap((m) => {
        const n = { ...m }
        delete n[j.id]
        return n
      })
    })
  }

  const stageLabel = (code: string) =>
    data.stages.find((s) => s.code === code)?.label ?? code
  const teamName = (id: string | null) =>
    data.teams.find((t) => t.id === id)?.name ?? null
  const jobOf = (lineId: string, stage: string) =>
    data.jobs.find((j) => j.production_order_line_id === lineId && j.stage === stage) ??
    null

  return {
    p,
    data,
    tab,
    setTab,
    chiDinhHinh,
    setChiDinhHinh,
    spLoc,
    setSpLoc,
    lines,
    bung,
    toggleBung,
    pick,
    setPick,
    congDoanChon,
    chonCongDoan,
    klBung,
    setKlBung,
    busy,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    tongDat,
    soDinhHinh,
    soChiTiet,
    finishStage,
    hoanThien,
    tonCongDoan,
    pgtChoNhan,
    jobsTre,
    shipLeft,
    closable,
    viecDo,
    dongWhy,
    epMo,
    setEpMo,
    epLyDo,
    setEpLyDo,
    xacNhanMo,
    setXacNhanMo,
    hoiDong,
    dongLenh,
    xoaHoi,
    pbsChinhThuc,
    pbsXoa,
    jobDraft,
    patchJob,
    jobDirty,
    luuJob,
    stageLabel,
    teamName,
    jobOf,
  } as const
}

export type HoSoLenhCtx = ReturnType<typeof useHoSoLenh>
