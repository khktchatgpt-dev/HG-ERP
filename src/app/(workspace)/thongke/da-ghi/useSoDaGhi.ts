'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouterBao } from '@/lib/tai-trang'
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

/** Một mã hàng trong phiếu — hàng mã (mã + tên + cộng) rồi dòng của nó (bản vẽ 14/11 Q4). */
export type NhomMa = { code: string | null; name: string | null; lines: SdgLine[] }
/** Hàng PHIẾU → hàng MÃ HÀNG → dòng (một ngày; `?phieu=` thì một phiếu). Dòng lẻ (không phiếu) gom vào doc null. */
export type NhomPhieu = {
  doc: SdgDoc | null
  key: string
  stage: string
  lines: SdgLine[]
  ma: NhomMa[]
}
export type NhomNgay = { date: string; phieu: NhomPhieu[] }

/**
 * State + xử lý Sổ đã ghi (bản vẽ 13/11/2026, Q1–Q7). Số đã tính ở server (ô Hồ
 * sơ lệnh); hook này lọc, gom, giữ các ô đang sửa + dòng chờ xoá rồi gửi MỘT
 * lượt "Lưu thay đổi".
 */
export function useSoDaGhi(p: SoDaGhiPayload) {
  const router = useRouterBao()
  const [tab, setTab] = useState<TabSdg>('all')
  const [tim, setTim] = useState('')
  const [drafts, setDrafts] = useState<Record<string, SdgDraft>>({})
  const [xoa, setXoa] = useState<Set<string>>(() => new Set())
  const [xoaCho, setXoaCho] = useState<string | null>(null)
  const [phieuXoaCho, setPhieuXoaCho] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Lượt tải lại sau Lưu / Ghi sổ mất 5–8 s (thử lệnh TEST 14/11): trong lúc đó
  // màn còn số cũ cạnh câu "Đã lưu" — giữ cờ chờ tới khi số mới về, khoá nút.
  const [taiLai, startTaiLai] = useTransition()
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  /** Ô Tổng ngày đang chọn (Q3): lệnh × mã hàng × công đoạn — tô hàng mã tương ứng. */
  const [maChon, setMaChon] = useState<{
    lsx: string
    stage: string
    code: string | null
  } | null>(null)
  /** Khối Tổng ngày mở / gập. */
  const [tongMo, setTongMo] = useState(true)
  /**
   * Phiếu người dùng tự mở / gập. Không có trong đây thì theo mặc định `macDinhMo`:
   * GẬP sẵn (bản vẽ 14/11/2026 Q1 — ngày 14/09 của xưởng 126 dòng, 5 phiếu).
   */
  const [moTay, setMoTay] = useState<Map<string, boolean>>(() => new Map())
  /** Chip công đoạn đang chọn (Q2) — null = mọi công đoạn. `?cd=` (tới từ Sổ công đoạn) chọn sẵn. */
  const [cd, setCd] = useState<string | null>(p.cd)

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

  const stageIdx = useMemo(() => new Map(p.stages.map((s, i) => [s.code, i])), [p.stages])

  // Lọc tab + ô tìm. Chip công đoạn lọc SAU bước này, nên số trên chip là đúng số
  // dòng bảng bày khi bấm chip đó.
  const q = tim.trim().toLowerCase()
  const quaLoc = useMemo(
    () =>
      p.lines.filter((l) => {
        const draft = !!l.doc_id && isDraftStatus(docById.get(l.doc_id)?.status)
        if (tab === 'soat' && !flags.has(l.id)) return false
        if (tab === 'nhap' && !draft) return false
        if (tab === 'chinh' && draft) return false
        if (!q) return true
        const d = l.doc_id ? docById.get(l.doc_id) : undefined
        return [l.product_code, l.product_name, l.name, l.cluster, d?.doc_no, d?.lsx_code]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(q))
      }),
    [p.lines, tab, flags, docById, q],
  )

  // Sổ theo ngày chỉ một ngày (bản vẽ 14/11 CpB5jKcS… Q5): nhiều ngày thì Sổ công đoạn.
  const trongNgay = quaLoc
  const theoLoTrinh = useCallback(
    (codes: Iterable<string>) =>
      [...new Set(codes)]
        .sort((a, b) => (stageIdx.get(a) ?? 999) - (stageIdx.get(b) ?? 999))
        .map((code) => ({
          code,
          label: p.stages.find((s) => s.code === code)?.label ?? code,
        })),
    [p.stages, stageIdx],
  )

  /**
   * Chip công đoạn (Q2): công đoạn CÓ dòng trong kỳ, theo lộ trình; số = số dòng
   * lưới bày khi bấm chip (đã qua tab + tìm + ngày đang chọn).
   */
  const cdCounts = useMemo(() => {
    const n = new Map<string, number>()
    for (const l of trongNgay) n.set(l.stage, (n.get(l.stage) ?? 0) + 1)
    return theoLoTrinh(p.lines.map((l) => l.stage)).map((s) => ({
      ...s,
      n: n.get(s.code) ?? 0,
    }))
  }, [p.lines, trongNgay, theoLoTrinh])

  const shown = useMemo(
    () => (cd ? trongNgay.filter((l) => l.stage === cd) : trongNgay),
    [trongNgay, cd],
  )

  /** Lệnh của dòng — mã lệnh nằm trên phiếu, dòng chỉ mang lsx_id. */
  const lsxCode = useMemo(
    () => new Map(p.docs.map((x) => [x.lsx_id, x.lsx_code])),
    [p.docs],
  )

  /**
   * Bảng TỔNG NGÀY (Q3): hàng = lệnh → mã hàng, cột = công đoạn có
   * dòng, ô = Σ đạt + số dòng. Cùng tập dòng với lưới (qua tab + tìm), KHÔNG qua chip
   * — bảng này là chỗ chọn chip. Chi tiết / cụm / bộ là ba đơn vị: không có cột tổng.
   */
  const tongNgay = useMemo(() => {
    const cot = theoLoTrinh(trongNgay.map((l) => l.stage))
    type O = { qty: number; n: number }
    const lenh = new Map<
      string,
      Map<
        string,
        { code: string | null; name: string | null; o: Map<string, O>; n: number }
      >
    >()
    for (const l of trongNgay) {
      const m = lenh.get(l.lsx_id) ?? new Map()
      const k = l.product_code ?? ''
      const g = m.get(k) ?? {
        code: l.product_code,
        name: l.product_name,
        o: new Map(),
        n: 0,
      }
      const o = g.o.get(l.stage) ?? { qty: 0, n: 0 }
      o.qty += l.qty
      o.n++
      g.o.set(l.stage, o)
      g.n++
      m.set(k, g)
      lenh.set(l.lsx_id, m)
    }
    const hang = [...lenh.entries()]
      .map(([lsx, m]) => ({
        lsx,
        code: lsxCode.get(lsx) ?? '—',
        ma: [...m.values()].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
    const nO = hang.reduce((a, h) => a + h.ma.reduce((b, g) => b + g.o.size, 0), 0)
    return { cot, hang, nO }
  }, [trongNgay, theoLoTrinh, lsxCode])

  const nhom: NhomNgay[] = useMemo(() => {
    const byDate = new Map<string, Map<string, NhomPhieu>>()
    for (const l of shown) {
      const m = byDate.get(l.entry_date) ?? new Map<string, NhomPhieu>()
      const key = l.doc_id ?? `le:${l.entry_date}|${l.stage}`
      const g = m.get(key) ?? {
        doc: l.doc_id ? (docById.get(l.doc_id) ?? null) : null,
        key,
        stage: l.stage,
        lines: [],
        ma: [],
      }
      g.lines.push(l)
      m.set(key, g)
      byDate.set(l.entry_date, m)
    }
    const gomMa = (lines: SdgLine[]): NhomMa[] => {
      const by = new Map<string, NhomMa>()
      for (const l of lines) {
        const k = l.product_code ?? ''
        const g = by.get(k) ?? { code: l.product_code, name: l.product_name, lines: [] }
        g.lines.push(l)
        by.set(k, g)
      }
      // Trong mã: thứ tự Bảng chi tiết. Các dòng một phiếu cùng giờ ghi nên DB trả
      // lộn xộn — thử lệnh TEST 14/11 thấy dòng đảo sau mỗi lần sửa.
      return [...by.values()]
        .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))
        .map((g) => ({ ...g, lines: [...g.lines].sort((a, b) => a.sort - b.sort) }))
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, m]) => ({
        date,
        // Q5: phiếu theo LỘ TRÌNH công đoạn → lệnh → tổ → giờ ghi. Một ngày nhiều
        // công đoạn thì công đoạn là thứ mắt tìm trước.
        phieu: [...m.values()]
          .sort(
            (a, b) =>
              (stageIdx.get(a.stage) ?? 999) - (stageIdx.get(b.stage) ?? 999) ||
              (a.doc?.lsx_code ?? '').localeCompare(b.doc?.lsx_code ?? '', 'vi', {
                numeric: true,
              }) ||
              (a.doc?.team_name ?? '').localeCompare(b.doc?.team_name ?? '', 'vi') ||
              (a.doc?.created_at ?? '').localeCompare(b.doc?.created_at ?? ''),
          )
          .map((ph) => {
            const ma = gomMa(ph.lines)
            return { ...ph, ma, lines: ma.flatMap((g) => g.lines) }
          }),
      }))
  }, [shown, docById, stageIdx])

  const tongPhieu = nhom.reduce((a, g) => a + g.phieu.length, 0)
  /**
   * Mặc định (Q1): gập. Mở sẵn khi phiếu có dòng cần soát, khi chỉ có một phiếu,
   * khi đang xem một phiếu (`?phieu=`), ở tab Cần soát hoặc đang tìm chữ — các
   * trường hợp đó người xem đến để thấy dòng.
   */
  const macDinhMo = (ph: NhomPhieu) =>
    tongPhieu === 1 ||
    !!p.phieu ||
    tab === 'soat' ||
    !!q ||
    ph.lines.some((l) => flags.has(l.id))
  const moPhieu = (ph: NhomPhieu) => moTay.get(ph.key) ?? macDinhMo(ph)
  const phieuDangBay = nhom.flatMap((g) => g.phieu)
  const tatCaMo = phieuDangBay.length > 0 && phieuDangBay.every(moPhieu)

  /** Hàng mã đang tô (bấm ô Tổng ngày) — phiếu cùng lệnh + công đoạn, cùng mã. */
  const maDangChon = (ph: NhomPhieu, code: string | null) =>
    !!maChon &&
    ph.stage === maChon.stage &&
    ph.lines[0]?.lsx_id === maChon.lsx &&
    code === maChon.code

  /** Bấm ô Tổng ngày: lọc đúng công đoạn, mở đúng phiếu, tô hàng mã. Bấm lại = bỏ. */
  const chonO = (lsx: string, stage: string, code: string | null) => {
    if (maChon && maChon.lsx === lsx && maChon.stage === stage && maChon.code === code) {
      setMaChon(null)
      setCd(null)
      return
    }
    setMaChon({ lsx, stage, code })
    setCd(stage)
    setMoTay((m) => {
      const n = new Map(m)
      for (const g of nhom)
        for (const ph of g.phieu)
          if (
            ph.stage === stage &&
            ph.lines.some((l) => l.lsx_id === lsx && l.product_code === code)
          )
            n.set(ph.key, true)
      return n
    })
    requestAnimationFrame(() =>
      document
        .querySelector('tr.mh.chon')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }
  /** Chip công đoạn bấm tay — bỏ ô Tổng ngày đang chọn. */
  const chonCd = (code: string | null) => {
    setMaChon(null)
    setCd(code)
  }

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
    const goc =
      mode === 'ly_do' ? (l.defect > 0 ? chuCuaDong(l, labelOf).value : '') : l.note
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
      if (d.worker != null && d.worker.trim() !== l.worker)
        e.worker_name = d.worker.trim()
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
  const chanO = chan
    ? { id: chan.id, field: chan.problem!.field, msg: chan.problem!.msg }
    : null

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

  /** Nhảy tới một dòng: mở phiếu chứa nó rồi đặt con trỏ vào ô Đạt. */
  const denDong = (l: SdgLine) => {
    if (cd && cd !== l.stage) chonCd(null)
    setMoTay((m) => new Map(m).set(l.doc_id ?? `le:${l.entry_date}|${l.stage}`, true))
    requestAnimationFrame(() => {
      const el =
        document.getElementById(oId(l.id, 'qty')) ??
        document.getElementById(`sdg-${l.id}`)
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
      startTaiLai(() => router.refresh())
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
      startTaiLai(() => router.refresh())
    } catch (e) {
      setLoi(apiErrorText(e, 'Không xoá được phiếu'))
    } finally {
      setBusy(false)
    }
  }

  const doiPhieu = (ph: NhomPhieu) =>
    setMoTay((m) => new Map(m).set(ph.key, !moPhieu(ph)))
  /** "Mở hết / Gập hết" — chỉ phiếu đang bày (ngày đang mở, chip đang chọn). */
  const moHet = (mo: boolean) =>
    setMoTay((m) => {
      const n = new Map(m)
      for (const ph of phieuDangBay) n.set(ph.key, mo)
      return n
    })

  /** Đường dẫn giữ các tham số đang chọn, đổi một vài cái. */
  const href = (o: { date?: string; to?: string | null; phieu?: null }) => {
    const sp = new URLSearchParams()
    const date = o.date ?? p.date
    if (date !== p.today) sp.set('date', date)
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
    taiLai,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    tongNgay,
    tongMo,
    setTongMo,
    maChon,
    maDangChon,
    chonO,
    moPhieu,
    doiPhieu,
    moHet,
    tatCaMo,
    nPhieuBay: phieuDangBay.length,
    cd,
    chonCd,
    cdCounts,
    href,
    go: (u: string) => router.push(u),
  } as const
}

export type SoDaGhiCtx = ReturnType<typeof useSoDaGhi>
