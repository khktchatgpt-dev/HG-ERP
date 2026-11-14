'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  chuCuaDong,
  draftProblem,
  flagsOf,
  isDraftStatus,
  khoaVi,
  parseSo,
  type SdgDoc,
  type SdgDraft,
  type SdgFlag,
  type SdgLine,
} from '@/lib/so-da-ghi'
import type { SoDaGhiPayload } from '@/modules/dept/production/so-da-ghi.service'

export type TabSdg = 'all' | 'soat' | 'nhap' | 'chinh'
export type CotSua = 'qty' | 'defect' | 'worker' | 'text'

/** id ô — id dòng là uuid từ máy chủ nên server/client ra cùng một chuỗi. */
export const oId = (lineId: string, f: CotSua) => `sdg-${lineId}-${f}`

/** Hàng NGÀY (xem 7 ngày) → hàng PHIẾU → dòng. Dòng lẻ (không phiếu) gom vào doc null. */
export type NhomPhieu = { doc: SdgDoc | null; key: string; lines: SdgLine[] }
export type NhomNgay = { date: string; phieu: NhomPhieu[] }

/**
 * State + xử lý Sổ đã ghi (bản vẽ 13/11/2026, Q1–Q7). Số đã tính ở server (ô Hồ
 * sơ lệnh); hook này lọc, gom, giữ các ô đang sửa + dòng chờ xoá rồi gửi MỘT
 * lượt "Lưu thay đổi".
 */
export function useSoDaGhi(p: SoDaGhiPayload) {
  const router = useRouter()
  const [tab, setTab] = useState<TabSdg>('all')
  const [tim, setTim] = useState('')
  const [drafts, setDrafts] = useState<Record<string, SdgDraft>>({})
  const [xoa, setXoa] = useState<Set<string>>(() => new Set())
  const [xoaCho, setXoaCho] = useState<string | null>(null)
  const [phieuXoaCho, setPhieuXoaCho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  /** Ngày đang MỞ ở xem 7 ngày — mặc định ngày neo (mới nhất). */
  const [ngayMo, setNgayMo] = useState<Set<string>>(() => new Set([p.date]))
  /** Phiếu đang GẬP (mặc định mở hết). */
  const [phieuGap, setPhieuGap] = useState<Set<string>>(() => new Set())

  // Xoá hai nhịp: "Xoá?" tự tắt sau 4 giây nếu không bấm lần hai.
  useEffect(() => {
    if (!xoaCho) return
    const t = setTimeout(() => setXoaCho(null), 4000)
    return () => clearTimeout(t)
  }, [xoaCho])
  useEffect(() => {
    if (!phieuXoaCho) return
    const t = setTimeout(() => setPhieuXoaCho(null), 4000)
    return () => clearTimeout(t)
  }, [phieuXoaCho])

  const docById = useMemo(() => new Map(p.docs.map((d) => [d.id, d])), [p.docs])
  const lineById = useMemo(() => new Map(p.lines.map((l) => [l.id, l])), [p.lines])
  const labelOf = useCallback((c: string) => p.defect_labels[c], [p.defect_labels])
  const flags = useMemo(() => flagsOf(p.lines, docById), [p.lines, docById])
  const lockSet = useMemo(
    () => new Set(p.locks.map((l) => `${l.team_id}|${l.date}`)),
    [p.locks],
  )
  const lockOf = (teamId: string | null, date: string) =>
    teamId ? (p.locks.find((l) => l.team_id === teamId && l.date === date) ?? null) : null
  const ctxKhoa = useMemo(
    () => ({
      locked: (t: string, d: string) => lockSet.has(`${t}|${d}`),
      meId: p.me_id,
      canAll: p.can_all,
    }),
    [lockSet, p.me_id, p.can_all],
  )
  const why = (l: SdgLine) =>
    khoaVi(l, l.doc_id ? (docById.get(l.doc_id) ?? null) : null, ctxKhoa)
  const isDraftLine = (l: SdgLine) =>
    !!l.doc_id && isDraftStatus(docById.get(l.doc_id)?.status)

  const counts = useMemo(() => {
    let soat = 0
    let nhap = 0
    for (const l of p.lines) {
      if (flags.has(l.id)) soat++
      if (l.doc_id && isDraftStatus(docById.get(l.doc_id)?.status)) nhap++
    }
    return { all: p.lines.length, soat, nhap, chinh: p.lines.length - nhap }
  }, [p.lines, flags, docById])

  const q = tim.trim().toLowerCase()
  const shown = useMemo(
    () =>
      p.lines.filter((l) => {
        const draft = !!l.doc_id && isDraftStatus(docById.get(l.doc_id)?.status)
        if (tab === 'soat' && !flags.has(l.id)) return false
        if (tab === 'nhap' && !draft) return false
        if (tab === 'chinh' && draft) return false
        if (!q) return true
        const d = l.doc_id ? docById.get(l.doc_id) : undefined
        return [l.product_code, l.name, l.cluster, d?.doc_no, d?.lsx_code]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q))
      }),
    [p.lines, tab, flags, docById, q],
  )

  const nhom: NhomNgay[] = useMemo(() => {
    const byDate = new Map<string, Map<string, NhomPhieu>>()
    for (const l of shown) {
      const m = byDate.get(l.entry_date) ?? new Map<string, NhomPhieu>()
      const key = l.doc_id ?? `le:${l.entry_date}`
      const g = m.get(key) ?? {
        doc: l.doc_id ? (docById.get(l.doc_id) ?? null) : null,
        key,
        lines: [],
      }
      g.lines.push(l)
      m.set(key, g)
      byDate.set(l.entry_date, m)
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, m]) => ({
        date,
        phieu: [...m.values()].sort((a, b) =>
          (a.doc?.created_at ?? '').localeCompare(b.doc?.created_at ?? ''),
        ),
      }))
  }, [shown, docById])

  // ── Ô đang sửa ───────────────────────────────────────────────────────────
  const setO = (id: string, f: CotSua, v: string) =>
    setDrafts((ds) => ({ ...ds, [id]: { ...ds[id], [f]: v } }))

  /** Số lỗi SAU sửa — quyết ô chữ là lý do hay ghi chú. */
  const loiMoi = (l: SdgLine) => {
    const d = drafts[l.id]?.defect
    return d != null ? (parseSo(d) ?? l.defect) : l.defect
  }
  /** Ô chữ của dòng: chế độ theo số lỗi SAU sửa, giá trị gốc tương ứng. */
  const chu = (l: SdgLine) => {
    const mode: 'ly_do' | 'ghi_chu' = loiMoi(l) > 0 ? 'ly_do' : 'ghi_chu'
    const goc = mode === 'ly_do' ? (l.defect > 0 ? chuCuaDong(l, labelOf).value : '') : l.note
    return { mode, goc, value: drafts[l.id]?.text ?? goc }
  }

  /** Thay đổi thật (gõ lại đúng số cũ thì không tính). */
  const edits = useMemo(() => {
    const out: {
      id: string
      qty?: number
      defect_qty?: number
      worker_name?: string
      text?: string
      problem: ReturnType<typeof draftProblem>
    }[] = []
    for (const [id, d] of Object.entries(drafts)) {
      const l = lineById.get(id)
      if (!l || xoa.has(id)) continue
      const e: (typeof out)[number] = { id, problem: null }
      const qty = d.qty != null ? parseSo(d.qty) : l.qty
      const defect = d.defect != null ? parseSo(d.defect) : l.defect
      if (d.qty != null && qty !== l.qty) e.qty = qty ?? NaN
      if (d.defect != null && defect !== l.defect) e.defect_qty = defect ?? NaN
      if (d.worker != null && d.worker.trim() !== l.worker) e.worker_name = d.worker.trim()
      const mode = (defect ?? l.defect) > 0 ? 'ly_do' : 'ghi_chu'
      const goc =
        mode === 'ly_do' ? (l.defect > 0 ? chuCuaDong(l, labelOf).value : '') : l.note
      if (d.text != null && d.text.trim() !== goc.trim()) e.text = d.text.trim()
      if (Object.keys(e).length <= 2) continue
      e.problem = draftProblem(l, {
        qty: d.qty,
        defect: d.defect,
        text: e.text ?? (mode === 'ly_do' && l.defect === 0 ? '' : undefined),
      })
      out.push(e)
    }
    return out
  }, [drafts, lineById, xoa, labelOf])

  const nThayDoi = edits.length + xoa.size
  const chan = edits.find((e) => e.problem)
  const chanO = chan ? { id: chan.id, field: chan.problem!.field, msg: chan.problem!.msg } : null

  // Rời trang khi còn thay đổi chưa lưu → trình duyệt hỏi lại.
  useEffect(() => {
    if (nThayDoi === 0) return
    const h = (ev: BeforeUnloadEvent) => {
      ev.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [nThayDoi])

  const toiO = (id: string, f: CotSua) => {
    const el = document.getElementById(oId(id, f))
    el?.scrollIntoView({ block: 'center' })
    ;(el as HTMLInputElement | null)?.focus()
  }

  /** Nhảy tới một dòng: mở ngày + phiếu chứa nó rồi đặt con trỏ vào ô Đạt. */
  const denDong = (l: SdgLine) => {
    setNgayMo((s) => new Set(s).add(l.entry_date))
    setPhieuGap((s) => {
      const n = new Set(s)
      n.delete(l.doc_id ?? `le:${l.entry_date}`)
      return n
    })
    requestAnimationFrame(() => {
      const el = document.getElementById(oId(l.id, 'qty')) ?? document.getElementById(`sdg-${l.id}`)
      el?.scrollIntoView({ block: 'center' })
      ;(el as HTMLInputElement | null)?.focus?.()
    })
  }

  const xinXoa = (id: string) => {
    if (xoa.has(id)) {
      setXoa((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
      return
    }
    if (xoaCho !== id) {
      setXoaCho(id)
      return
    }
    setXoaCho(null)
    setXoa((s) => new Set(s).add(id))
  }

  const boSua = () => {
    setDrafts({})
    setXoa(new Set())
    setXoaCho(null)
    setLoi(null)
  }

  const luu = async () => {
    if (busy || nThayDoi === 0) return
    if (chanO) {
      toiO(chanO.id, chanO.field)
      return
    }
    setBusy(true)
    setLoi(null)
    try {
      const res = await api<{ updated: number; deleted: number; docs_removed: number }>(
        '/api/dept/production/so-da-ghi',
        {
          method: 'POST',
          body: {
            edits: edits.map(({ problem: _p, ...e }) => e),
            deletes: [...xoa],
          },
        },
      )
      setDrafts({})
      setXoa(new Set())
      setThongBao(
        [
          res.updated ? `sửa ${res.updated} dòng` : null,
          res.deleted ? `xoá ${res.deleted} dòng` : null,
          res.docs_removed ? `bỏ ${res.docs_removed} phiếu không còn dòng` : null,
        ]
          .filter(Boolean)
          .join(' · ')
          .replace(/^./, (c) => `Đã lưu: ${c}`),
      )
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không lưu được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  const xoaPhieu = async (doc: SdgDoc) => {
    if (busy) return
    if (phieuXoaCho !== doc.id) {
      setPhieuXoaCho(doc.id)
      return
    }
    setPhieuXoaCho(null)
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/dept/production/entry-docs/${doc.id}`, { method: 'DELETE' })
      setThongBao(`Đã xoá phiếu ${doc.doc_no}`)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không xoá được phiếu'))
    } finally {
      setBusy(false)
    }
  }

  const doiNgay = (k: string) =>
    setNgayMo((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const doiPhieu = (k: string) =>
    setPhieuGap((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  /** Đường dẫn giữ các tham số đang chọn, đổi một vài cái. */
  const href = (o: { date?: string; xem?: string; to?: string | null; phieu?: null }) => {
    const sp = new URLSearchParams()
    const date = o.date ?? p.date
    if (date !== p.today) sp.set('date', date)
    const xem = o.xem ?? p.xem
    if (xem === 'tuan') sp.set('xem', 'tuan')
    const to = o.to === undefined ? p.team_id : o.to
    sp.set('to', to ?? 'all')
    const s = sp.toString()
    return `/thongke/da-ghi${s ? `?${s}` : ''}`
  }

  const flagOf = (id: string): SdgFlag[] => flags.get(id) ?? []

  return {
    p,
    tab,
    setTab,
    tim,
    setTim,
    counts,
    nhom,
    shown,
    flagOf,
    why,
    isDraftLine,
    lockOf,
    drafts,
    setO,
    chu,
    edits,
    nThayDoi,
    chanO,
    toiO,
    denDong,
    xoa,
    xoaCho,
    xinXoa,
    phieuXoaCho,
    xoaPhieu,
    boSua,
    luu,
    busy,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    ngayMo,
    doiNgay,
    phieuGap,
    doiPhieu,
    href,
    go: (u: string) => router.push(u),
  } as const
}

export type SoDaGhiCtx = ReturnType<typeof useSoDaGhi>
