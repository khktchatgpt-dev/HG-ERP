'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { calcPartDerived, SHAPE_OPTIONS } from '@/lib/bom-calc'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { nz, type HoSoView } from './ho-so.shared'
import {
  COLS,
  dongMoi,
  GEO,
  GROUP_LABEL,
  O,
  parseVn,
  rawOf,
  SO,
  TIER_RANK,
  tierOf,
  type Col,
  type ColKey,
  type Draft,
  type PartField,
  type Row,
  type Tier,
} from './dinh-muc.shared'
import type { HoSoCtx } from './useHoSo'

const SHAPE_LABEL: Record<string, string> = Object.fromEntries(
  SHAPE_OPTIONS.map((s) => [s.code, s.label]),
)

/**
 * TAB ĐỊNH MỨC — lưới theo BOM giấy, hai chế độ rõ ràng (08/10/2026, chủ dự
 * án: "chưa phân biệt được trạng thái chỉnh sửa hay là xem"):
 *   · XEM: chữ thường, vạch ngang mảnh, không ô nhập.
 *   · SỬA (bật ở đầu trang): mọi ô là ô nhập kẻ ô như Excel, Enter/↓ xuống
 *     dòng cùng cột, Tab sang ô, Esc trả ô; ô đổi tô vàng; kg · m² · tổng dài
 *     tính NGAY bằng đúng `calcPartDerived` server dùng; một nút LƯU (Ctrl+S)
 *     ghi mọi dòng đã đổi (PATCH dòng cũ, POST dòng mới). Rời chế độ sửa thì
 *     nháp bị bỏ (đầu trang đã hỏi trước).
 */
export function HoSoDinhMuc({
  d,
  c,
  canEditBom,
  onDirty,
}: {
  d: HoSoView
  c: HoSoCtx
  canEditBom: boolean
  /** Báo lên đầu trang số dòng chưa lưu — để nút "Xong" hỏi trước khi bỏ. */
  onDirty?: (n: number) => void
}) {
  const confirm = useConfirm()
  const sua = canEditBom && !c.khoa && c.cheDoSua
  const [nhom, setNhom] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [moi, setMoi] = useState<Row[]>([])
  const seq = useRef(0)
  const secRef = useRef<HTMLElement>(null)

  /* ── bậc bề rộng: đo chính khối này, không đo cửa sổ (sidebar ăn mất một phần) ── */
  const [tier, setTier] = useState<Tier>('xl')
  useLayoutEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setTier(tierOf(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cols = COLS.filter((x) => TIER_RANK[x.tier] <= TIER_RANK[tier])

  /* ── dữ liệu ── */
  const rowsAll: Row[] = useMemo(() => [...d.parts, ...moi], [d.parts, moi])
  const byGroup = new Map<string, Row[]>()
  for (const p of rowsAll)
    byGroup.set(p.group_code, [...(byGroup.get(p.group_code) ?? []), p])
  const order = [
    ...d.groups.filter((g) => byGroup.has(g.code)),
    ...[...byGroup.keys()]
      .filter((k) => !d.groups.some((g) => g.code === k))
      .map((k) => ({ code: k, label: k })),
  ]
  const shown = nhom ? order.filter((g) => g.code === nhom) : order
  const thieuIds = new Set(d.thieuSo.map((t) => t.id))
  const clusterName = new Map(d.clusters.map((x) => [x.id, x.name]))

  const val = (r: Row, f: PartField) => drafts[r.id]?.[f] ?? rawOf(r, f)
  const num = (r: Row, f: PartField) => parseVn(val(r, f))
  const bad = (r: Row, f: PartField) => SO.has(f) && num(r, f) === undefined
  const dirty = (r: Row, f: PartField) => drafts[r.id]?.[f] !== undefined
  /** Số dẫn xuất xem trước: đổi hình học thì tính lại tại chỗ, không thì lấy số đã lưu. */
  const dan = (r: Row) => {
    const dr = drafts[r.id]
    const touched = r.moi || (dr && Object.keys(dr).some((k) => GEO.has(k as PartField)))
    if (!touched)
      return {
        total_length_m: r.total_length_m,
        weight_kg: r.weight_kg,
        paint_area_m2: r.paint_area_m2,
      }
    const n = (f: PartField) => {
      const v = num(r, f)
      return v === undefined ? null : v
    }
    return calcPartDerived({
      profile_shape: val(r, 'profile_shape') || null,
      material_kind: r.material_kind,
      dim_a_mm: n('dim_a_mm'),
      dim_b_mm: n('dim_b_mm'),
      wall_thickness_mm: n('wall_thickness_mm'),
      cut_length_mm: n('cut_length_mm'),
      bend_waste_mm: n('bend_waste_mm'),
      tenon_mm: r.tenon_mm,
      kg_per_m: r.kg_per_m,
      qty: n('qty'),
    })
  }

  const nDirty = Object.values(drafts).reduce((a, x) => a + Object.keys(x).length, 0)
  const nBad = rowsAll.reduce(
    (a, r) => a + [...SO].filter((f) => dirty(r, f) && bad(r, f)).length,
    0,
  )
  const moiThieuTen = moi.filter((r) => !val(r, 'part_name').trim()).length
  const coThayDoi = nDirty > 0 || moi.length > 0
  /** Số DÒNG đang có thay đổi (dòng mới tính một). */
  const nDong = new Set([...Object.keys(drafts), ...moi.map((r) => r.id)]).size
  useEffect(() => {
    onDirty?.(nDong)
  }, [nDong, onDirty])
  /* Rời chế độ sửa → bỏ nháp (đầu trang đã hỏi khi còn dòng chưa lưu). */
  const [suaTruoc, setSuaTruoc] = useState(sua)
  if (suaTruoc !== sua) {
    setSuaTruoc(sua)
    if (!sua) {
      setDrafts({})
      setMoi([])
    }
  }

  function setCell(r: Row, f: PartField, v: string) {
    setDrafts((prev) => {
      const cur: Draft = { ...prev[r.id] }
      if (v === rawOf(r, f)) delete cur[f]
      else cur[f] = v
      const next = { ...prev }
      if (Object.keys(cur).length) next[r.id] = cur
      else delete next[r.id]
      return next
    })
  }

  /* ── rời trang khi còn ô chưa lưu → trình duyệt hỏi ── */
  useEffect(() => {
    if (!coThayDoi) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [coThayDoi])

  /* ── phím: Enter/↓ xuống dòng cùng cột, ↑ lên, Esc trả ô về số cũ ── */
  function nav(
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    r: Row,
    f: PartField,
  ) {
    const el = e.currentTarget
    const idx = Number(el.dataset.r)
    let to: number | null = null
    if (e.key === 'Enter' || e.key === 'ArrowDown') to = idx + 1
    else if (e.key === 'ArrowUp') to = idx - 1
    else if (e.key === 'Escape') {
      setCell(r, f, rawOf(r, f))
      return
    }
    if (to == null || el.tagName === 'SELECT') return
    const next = secRef.current?.querySelector<HTMLInputElement>(
      `[data-r="${to}"][data-c="${f}"]`,
    )
    if (!next) return
    e.preventDefault()
    next.focus()
    next.select?.()
  }

  function themDong(groupCode: string) {
    seq.current += 1
    const id = `new:${seq.current}`
    setMoi((m) => [...m, dongMoi(id, groupCode)])
    setTimeout(() => {
      secRef.current
        ?.querySelector<HTMLInputElement>(`[data-id="${id}"][data-c="part_name"]`)
        ?.focus()
    }, 0)
  }

  function huy() {
    setDrafts({})
    setMoi([])
  }

  async function luuTatCa() {
    if (!coThayDoi || busy) return
    if (nBad) {
      c.toast.error('Còn ô số không hợp lệ', 'Ô đỏ — gõ số, ví dụ 1750 hoặc 1,2')
      return
    }
    if (moiThieuTen) {
      c.toast.error(
        'Dòng mới chưa có tên chi tiết',
        `${moiThieuTen} dòng — gõ tên rồi lưu`,
      )
      return
    }
    setBusy(true)
    const jobs: { id: string; p: Promise<unknown> }[] = []
    for (const r of rowsAll) {
      const dr = drafts[r.id]
      if (!dr && !r.moi) continue
      const body: Record<string, string | number | null> = {}
      for (const [f, raw] of Object.entries(dr ?? {}) as [PartField, string][]) {
        body[f] = SO.has(f) ? (parseVn(raw) ?? null) : raw.trim() || null
      }
      if (r.moi) {
        body.group_code = r.group_code
        jobs.push({
          id: r.id,
          p: api(`/api/dept/technical/products/${d.id}/parts`, { method: 'POST', body }),
        })
      } else
        jobs.push({
          id: r.id,
          p: api(`/api/dept/technical/products/${d.id}/parts/${r.id}`, {
            method: 'PATCH',
            body,
          }),
        })
    }
    const res = await Promise.allSettled(jobs.map((j) => j.p))
    const okIds = new Set<string>()
    let loi: string | null = null
    res.forEach((x, i) => {
      if (x.status === 'fulfilled') okIds.add(jobs[i].id)
      else if (!loi) loi = x.reason instanceof ApiError ? x.reason.message : 'Có lỗi'
    })
    setDrafts((prev) => {
      const next = { ...prev }
      for (const id of okIds) delete next[id]
      return next
    })
    setMoi((m) => m.filter((r) => !okIds.has(r.id)))
    setBusy(false)
    if (okIds.size) c.router.refresh()
    if (loi) c.toast.error(`Lưu được ${okIds.size}/${jobs.length} dòng`, loi)
    else c.toast.success('Đã lưu định mức', `${okIds.size} dòng · kg, m² tính lại xong`)
  }

  async function xoa(r: Row) {
    if (r.moi) {
      setMoi((m) => m.filter((x) => x.id !== r.id))
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[r.id]
        return next
      })
      return
    }
    const ok = await confirm({
      title: `Xoá dòng "${r.part_name}"?`,
      description: 'Dòng định mức bị xoá khỏi hồ sơ. Không hoàn tác được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${d.id}/parts/${r.id}`, {
        method: 'DELETE',
      })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[r.id]
        return next
      })
      c.toast.success('Đã xoá dòng', r.part_name)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /* ── tổng ── */
  const sum = (xs: Row[], k: 'total_length_m' | 'weight_kg' | 'paint_area_m2') =>
    xs.reduce((a, r) => a + (dan(r)[k] ?? 0), 0)
  const dash = (s: string) => s || '—'
  const coKg = rowsAll.filter((r) => dan(r).weight_kg != null).length
  /** Dòng tổng: nhãn chiếm các cột trước nhóm "Tự tính". */
  const tongRow = (label: React.ReactNode, xs: Row[], key: string) => {
    const first = cols.findIndex((x) => x.group === 'fx')
    return (
      <tr key={key} className="sum">
        <td colSpan={first} className="num muted">
          {label}
        </td>
        {cols.slice(first).map((x) => (
          <td key={x.key} className={cn(x.num && 'num', x.group === 'fx' && 'calc')}>
            {x.key === 'tong'
              ? dash(nz(sum(xs, 'total_length_m'), 3))
              : x.key === 'kg'
                ? dash(nz(sum(xs, 'weight_kg'), 2))
                : x.key === 'm2'
                  ? dash(nz(sum(xs, 'paint_area_m2'), 3))
                  : ''}
          </td>
        ))}
      </tr>
    )
  }

  /** Tiêu đề hai tầng: cột lẻ rowSpan 2, nhóm qc/fx một ô trên + từng cột dưới. */
  const headTop: React.ReactNode[] = []
  const headBottom: React.ReactNode[] = []
  const seen = new Set<string>()
  for (const x of cols) {
    if (!x.group) {
      headTop.push(
        <th key={x.key} rowSpan={2} className={cn(x.num && 'num')} title={x.title}>
          {x.key === 'act' ? <span className="sr">Thao tác</span> : x.label}
        </th>,
      )
      continue
    }
    if (!seen.has(x.group)) {
      seen.add(x.group)
      const n = cols.filter((y) => y.group === x.group).length
      headTop.push(
        <th
          key={`g:${x.group}`}
          colSpan={n}
          className={cn('grp-h', x.group === 'fx' && 'fx')}
        >
          {GROUP_LABEL[x.group]}
          {x.group === 'fx' && <small>app tính, không nhận số gõ</small>}
        </th>,
      )
    }
    headBottom.push(
      <th
        key={x.key}
        className={cn(x.num && 'num', x.group === 'fx' && 'fx')}
        title={x.title}
      >
        {x.label}
      </th>,
    )
  }

  let flat = 0
  const ghiDuocNhom = nhom || d.groups[0]?.code || order[0]?.code || ''

  return (
    <section
      ref={secRef}
      aria-label="Định mức vật tư"
      id="dinh-muc"
      className="block"
      style={{ marginTop: 0 }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault()
          void luuTatCa()
        }
      }}
    >
      <div className="bar">
        <button
          type="button"
          className={cn('chip', !nhom && 'on')}
          aria-pressed={!nhom}
          onClick={() => setNhom('')}
        >
          Tất cả <span className="n">{rowsAll.length}</span>
        </button>
        {order.map((g) => (
          <button
            key={g.code}
            type="button"
            className={cn('chip', nhom === g.code && 'on')}
            aria-pressed={nhom === g.code}
            onClick={() => setNhom(nhom === g.code ? '' : g.code)}
          >
            {g.label} <span className="n">{byGroup.get(g.code)?.length ?? 0}</span>
          </button>
        ))}
        <span className="r">
          {sua && (
            <button
              type="button"
              className="btn"
              disabled={busy || !ghiDuocNhom}
              onClick={() => themDong(ghiDuocNhom)}
              title={`Thêm dòng vào nhóm ${order.find((g) => g.code === ghiDuocNhom)?.label ?? ''}`}
            >
              <Plus size={14} aria-hidden />
              <span className="t">Thêm dòng</span>
            </button>
          )}
          <a
            href={`/api/dept/technical/products/${d.id}/export`}
            className="btn"
            title="Xuất Excel định mức"
          >
            <FileSpreadsheet size={14} aria-hidden />
            <span className="t">Excel</span>
          </a>
        </span>
      </div>

      {rowsAll.length === 0 && !sua ? (
        <div className="pad">
          {d.check.bom === 'khong_ap_dung'
            ? 'Loại SP này không cần định mức (phụ kiện bán rời).'
            : 'Chưa có dòng định mức nào. Bật Sửa để gõ, hoặc đọc từ file BOM ở thư viện.'}
        </div>
      ) : (
        <table className={cn('luoi', sua && 'sua')} aria-label="Định mức vật tư">
          <colgroup>
            {cols.map((x) => (
              <col key={x.key} style={x.w ? { width: x.w } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>{headTop}</tr>
            <tr>{headBottom}</tr>
          </thead>
          {shown.map((g, gi) => {
            const rows = byGroup.get(g.code) ?? []
            const thieu = rows.filter((r) => thieuIds.has(r.id)).length
            return (
              <tbody key={g.code}>
                <tr className="grp">
                  <th scope="rowgroup" colSpan={cols.length}>
                    {gi + 1} · {g.label} <span className="n">{rows.length} dòng</span>
                    {sua && (
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => themDong(g.code)}
                        title={`Thêm dòng vào ${g.label}`}
                        aria-label={`Thêm dòng vào ${g.label}`}
                      >
                        <Plus size={13} aria-hidden />
                      </button>
                    )}
                    {rows.length > 0 &&
                      (thieu ? (
                        <span className="pend">{thieu} dòng thiếu số</span>
                      ) : (
                        <span className="ok">đủ số</span>
                      ))}
                  </th>
                </tr>
                {rows.map((r) => {
                  const idx = flat++
                  const dv = dan(r)
                  const laThanh = !!(
                    val(r, 'profile_shape') ||
                    r.kg_per_m ||
                    num(r, 'dim_a_mm')
                  )
                  const thieuDai = laThanh && num(r, 'cut_length_mm') == null
                  const thieuSl = num(r, 'qty') == null
                  const tdc = (f: PartField | PartField[], extra?: string) => {
                    const fs = Array.isArray(f) ? f : [f]
                    return cn(
                      extra,
                      fs.some((x) => dirty(r, x)) && 'dirty',
                      fs.some((x) => bad(r, x)) && 'bad',
                    )
                  }
                  const o = (
                    f: PartField,
                    opts?: { num?: boolean; ph?: string; show?: string },
                  ) => (
                    <O
                      sua={sua}
                      r={r}
                      f={f}
                      idx={idx}
                      value={val(r, f)}
                      show={opts?.show}
                      num={opts?.num}
                      ph={opts?.ph}
                      onChange={(v) => setCell(r, f, v)}
                      onKey={nav}
                    />
                  )
                  const soCell = (
                    key: ColKey,
                    f: PartField,
                    digits: number,
                    extra?: string,
                  ) => (
                    <td key={key} className={tdc(f, cn('num', extra))}>
                      {o(f, { num: true, show: nz(r[f] as number | null, digits) })}
                    </td>
                  )
                  const loaiXem = [
                    r.profile_shape
                      ? (SHAPE_LABEL[r.profile_shape] ?? r.profile_shape)
                      : '',
                    r.profile_code ?? '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const cell: Record<ColKey, React.ReactNode> = {
                    no: (
                      <td key="no" className="num muted">
                        {r.moi ? '+' : (r.part_no ?? '')}
                      </td>
                    ),
                    cum: (
                      <td key="cum" className={tdc('cluster_id')}>
                        {sua ? (
                          <select
                            className="cell"
                            aria-label="Bộ phận"
                            value={val(r, 'cluster_id')}
                            data-r={idx}
                            data-c="cluster_id"
                            onChange={(e) => setCell(r, 'cluster_id', e.target.value)}
                            onKeyDown={(e) => nav(e, r, 'cluster_id')}
                          >
                            <option value="">{''}</option>
                            {d.clusters.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="ro muted">
                            {r.cluster_id ? (clusterName.get(r.cluster_id) ?? '') : ''}
                          </span>
                        )}
                      </td>
                    ),
                    ten: (
                      <td
                        key="ten"
                        className={tdc('part_name')}
                        title={!sua && r.note ? `Ghi chú: ${r.note}` : undefined}
                      >
                        {o('part_name', { ph: 'tên chi tiết' })}
                      </td>
                    ),
                    ma: (
                      <td key="ma" className={tdc('material_code', 'code')}>
                        {o('material_code')}
                      </td>
                    ),
                    loai: (
                      <td key="loai" className={tdc(['profile_shape', 'profile_code'])}>
                        {sua ? (
                          <div className="loai">
                            <select
                              className="cell"
                              aria-label="Loại / dạng"
                              value={val(r, 'profile_shape')}
                              data-r={idx}
                              data-c="profile_shape"
                              onChange={(e) =>
                                setCell(r, 'profile_shape', e.target.value)
                              }
                            >
                              <option value="">{''}</option>
                              {SHAPE_OPTIONS.map((s) => (
                                <option key={s.code} value={s.code}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            {o('profile_code', { ph: 'mã' })}
                          </div>
                        ) : (
                          <span className="ro" title={loaiXem || undefined}>
                            {loaiXem}
                          </span>
                        )}
                      </td>
                    ),
                    a: soCell('a', 'dim_a_mm', 1),
                    b: soCell('b', 'dim_b_mm', 1),
                    dai: (
                      <td
                        key="dai"
                        className={tdc('cut_length_mm', cn('num', thieuDai && 'red'))}
                        title={
                          thieuDai ? 'Thanh có quy cách nhưng chưa có dài cắt' : undefined
                        }
                      >
                        {o('cut_length_mm', {
                          num: true,
                          ph: thieuDai ? 'thiếu' : undefined,
                          show: nz(r.cut_length_mm, 1),
                        })}
                      </td>
                    ),
                    d: soCell('d', 'wall_thickness_mm', 2),
                    hao: soCell('hao', 'bend_waste_mm', 1),
                    sl: (
                      <td
                        key="sl"
                        className={tdc('qty', cn('num', thieuSl && 'red'))}
                        title={thieuSl ? 'Chưa có số lượng' : undefined}
                      >
                        {o('qty', { num: true, ph: 'thiếu', show: nz(r.qty, 2) })}
                      </td>
                    ),
                    dvt: (
                      <td key="dvt" className={tdc('unit')}>
                        {o('unit')}
                      </td>
                    ),
                    tong: (
                      <td key="tong" className="num calc">
                        {dash(nz(dv.total_length_m, 3))}
                      </td>
                    ),
                    kg: (
                      <td key="kg" className="num calc">
                        {dash(nz(dv.weight_kg, 2))}
                      </td>
                    ),
                    m2: (
                      <td key="m2" className="num calc">
                        {dash(nz(dv.paint_area_m2, 3))}
                      </td>
                    ),
                    note: (
                      <td key="note" className={tdc('note', 'muted')}>
                        {o('note')}
                      </td>
                    ),
                    phoi: (
                      <td key="phoi" style={{ textAlign: 'center' }}>
                        {r.blank_confirmed_at ? (
                          <span style={{ color: 'var(--done)' }}>✓</span>
                        ) : (
                          <span className="muted">○</span>
                        )}
                      </td>
                    ),
                    act: (
                      <td key="act" style={{ textAlign: 'center' }}>
                        {sua && (
                          <button
                            type="button"
                            className="btn sm del"
                            disabled={busy}
                            onClick={() => void xoa(r)}
                            title={r.moi ? 'Bỏ dòng mới' : 'Xoá dòng'}
                            aria-label={r.moi ? 'Bỏ dòng mới' : `Xoá dòng ${r.part_name}`}
                          >
                            <Trash2 size={13} aria-hidden />
                          </button>
                        )}
                      </td>
                    ),
                  }
                  return (
                    <tr key={r.id} className={cn(r.moi && 'moi')}>
                      {cols.map((x: Col) => cell[x.key])}
                    </tr>
                  )
                })}
                {rows.length > 0 &&
                  tongRow(
                    <>
                      Tổng {g.label} · {rows.length - thieu}/{rows.length} dòng đủ số
                    </>,
                    rows,
                    `sum:${g.code}`,
                  )}
              </tbody>
            )
          })}
          <tfoot>
            {tongRow(
              <span style={{ fontStyle: 'normal' }}>
                Tổng {rowsAll.length} dòng · {byGroup.size} nhóm
              </span>,
              rowsAll,
              'sum:all',
            )}
          </tfoot>
        </table>
      )}

      {sua && coThayDoi && (
        <div className="savebar" role="status">
          <span>
            <b>{nDong}</b> dòng chưa lưu
            {nBad ? <span className="loi"> · {nBad} ô số không hợp lệ</span> : null}
            {moiThieuTen ? (
              <span className="loi"> · {moiThieuTen} dòng mới chưa có tên</span>
            ) : null}
          </span>
          <span className="r">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={huy}
              title="Bỏ mọi thay đổi chưa lưu"
            >
              <Undo2 size={14} aria-hidden />
              <span className="t">Bỏ thay đổi</span>
            </button>
            <button
              type="button"
              className="btn pri"
              disabled={busy || nBad > 0 || moiThieuTen > 0}
              onClick={() => void luuTatCa()}
              title="Lưu mọi dòng đã đổi (Ctrl+S)"
            >
              <Save size={14} aria-hidden />
              <span className="t">{busy ? 'Đang lưu…' : 'Lưu'}</span>
              <kbd>Ctrl+S</kbd>
            </button>
          </span>
        </div>
      )}

      {rowsAll.length > 0 && (
        <div className="why">
          <b>Vì sao kg = {nz(sum(rowsAll, 'weight_kg'), 2)}:</b> Σ kg từng dòng (tiết diện
          × dài cắt × tỉ trọng, hoặc kg/m × tổng dài). {coKg}/{rowsAll.length} dòng có kg;
          dòng thiếu quy cách, dài cắt hoặc SL KHÔNG cộng. m² sơn chỉ dòng kim loại.
        </div>
      )}
    </section>
  )
}
