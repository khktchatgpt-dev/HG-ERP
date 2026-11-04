'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { isSingleCell, parsePasteGrid, pasteFootprint } from '@/lib/entry-paste'
import { parsePasteNumber } from '@/lib/po-paste'
import {
  cellId,
  emptyDraft,
  num,
  readMore,
  rowProblems,
  subscribeMore,
  toDraft,
  visibleCols,
  writeMore,
  type DinhHinhProps,
  type Draft,
  type InitialRow,
} from './dinh-hinh.shared'

export type TabKey = 'chi_tiet' | 'lo_trinh'

/**
 * State + xử lý màn Định hình. Một bản nháp cho cả hai tab (chi tiết + lộ trình
 * theo cụm), một nút Lưu ghi đè trọn bộ như trước. Ô chốt giá trị lúc rời ô.
 */
export function useDinhHinh(p: DinhHinhProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Draft[]>(() => p.initialRows.map(toDraft))
  const [tab, setTab] = useState<TabKey>('chi_tiet')
  const [spLoc, setSpLoc] = useState('')
  const [seedProfile, setSeedProfile] = useState(false)
  // Ghi ngược lộ trình cụm lên hồ sơ SP — mặc định BẬT (chủ dự án 04/11/2026:
  // kế hoạch định hình trên lệnh là đường chính, hồ sơ SP đi theo). Bỏ tick khi
  // lệnh này là ngoại lệ một lần.
  const [syncProfile, setSyncProfile] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const more = useSyncExternalStore(subscribeMore, readMore, () => false)
  const toggleMore = () => writeMore(!more)
  const cols = useMemo(() => visibleCols(more), [more])

  const editable = p.canEdit && !p.lockedByEntries && !p.lsxClosed

  useEffect(() => {
    if (!editable) return
    document.querySelector<HTMLInputElement>('[data-cell="0:1"]:not([disabled])')?.focus()
  }, [editable])

  const patch = (k: string, x: Partial<Draft>) => {
    setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...x } : r)))
    setDirty(true)
    setLoi(null)
  }
  const addRow = (lineId: string) => {
    setRows((rs) => [...rs, emptyDraft(lineId)])
    setDirty(true)
  }
  const removeRow = (k: string) => {
    setRows((rs) => rs.filter((r) => r.key !== k))
    setDirty(true)
  }
  /**
   * Lộ trình RIÊNG LỆNH cho MỘT dòng (cụm hoặc chi tiết rời). Cụm chỉ mang nửa
   * "cụm"; chi tiết trong cụm giữ nửa của nó — không kéo theo (kéo theo đã ghi
   * `[]` = xoá chi tiết khỏi sổ, dính 03/11). Chốt first/final theo danh sách.
   */
  const setStages = (k: string, st: string[] | null) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== k) return r
        if (!st) return { ...r, stages: null }
        return {
          ...r,
          stages: st,
          ...(st.length ? { first_stage: st[0], final_stage: st[st.length - 1] } : {}),
        }
      }),
    )
    setDirty(true)
  }

  // ── Dòng đang bày + thứ tự phẳng cho bàn phím ───────────────────────────
  const lines = useMemo(
    () => p.orderLines.filter((l) => !spLoc || l.id === spLoc),
    [p.orderLines, spLoc],
  )
  const byLine = useMemo(() => {
    const m = new Map<string, Draft[]>()
    for (const r of rows)
      m.set(r.production_order_line_id, [...(m.get(r.production_order_line_id) ?? []), r])
    return m
  }, [rows])
  const order = useMemo(
    () => lines.flatMap((l) => (byLine.get(l.id) ?? []).map((r) => r.key)),
    [lines, byLine],
  )
  const rowIdx = useMemo(() => new Map(order.map((k, i) => [k, i])), [order])

  // ── Kiểm tại chỗ ────────────────────────────────────────────────────────
  const problems = useMemo(
    () =>
      rows.flatMap((r, i) =>
        rowProblems(r).map((pb) => ({ ...pb, rowKey: r.key, line: i + 1, name: r.name })),
      ),
    [rows],
  )
  const errCells = useMemo(
    () => new Set(problems.map((pb) => cellId(pb.rowKey, pb.key))),
    [problems],
  )
  const first = problems[0] ?? null
  const nCum = rows.filter((r) => r.kind === 'assembly').length
  const chuaDinhMuc = p.orderLines.filter((l) => !l.has_profile)

  const luuWhy = !p.canEdit
    ? 'Bạn không có quyền định hình'
    : p.lsxClosed
      ? 'Lệnh đã kết thúc — bảng chỉ để tra cứu'
      : p.lockedByEntries
        ? `lệnh đã có ${p.pbsCount} phiếu sản lượng — xoá phiếu ở Hồ sơ lệnh › Phiếu rồi mới sửa được`
        : rows.length === 0
          ? 'chưa có dòng nào'
          : first
            ? `dòng ${first.line}${first.name ? ` (${first.name})` : ''} ${first.msg}`
            : !dirty
              ? 'Chưa đổi gì'
              : null
  const goFirst = () => {
    if (!first) return
    setTab('chi_tiet')
    const el = document.getElementById(cellId(first.rowKey, first.key))
    el?.scrollIntoView({ block: 'center' })
    ;(el as HTMLElement | null)?.focus()
  }

  // ── Nạp / lưu ───────────────────────────────────────────────────────────
  const suggest = async (source: 'bom' | 'previous') => {
    if (busy) return
    setBusy(true)
    setLoi(null)
    try {
      const { lines: got } = await api<{ lines: InitialRow[] }>(
        `/api/dept/production/lsx/${p.lsx.id}/components/suggest?source=${source}`,
      )
      if (got.length === 0) {
        setLoi(
          source === 'bom'
            ? 'Không có gì để nạp — các SP của lệnh chưa có định mức trong hồ sơ'
            : 'Không có lệnh trước nào chứa các SP này',
        )
        return
      }
      setRows(got.map(toDraft))
      setDirty(true)
      setThongBao(
        `Đã nạp ${got.length} dòng${source === 'bom' ? ' từ BOM kỹ thuật' : ' từ lệnh trước'} — bản nháp trên màn, soát rồi Lưu mới ghi vào lệnh`,
      )
    } catch (e) {
      setLoi(apiErrorText(e, 'Không nạp được'))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (busy || luuWhy) return
    setBusy(true)
    setLoi(null)
    try {
      const res = await api<{
        seeded: { product_code: string; added: number }[]
        seed_skipped: { product_code: string; reason: string }[]
        routes_synced: { product_code: string; updated: number }[]
        routes_skipped: { product_code: string; reason: string }[]
        routes_missing: { product_code: string; cluster: string }[]
      }>(`/api/dept/production/lsx/${p.lsx.id}/components`, {
        method: 'PUT',
        body: {
          seed_profile: seedProfile,
          sync_profile_routes: syncProfile,
          lines: rows.map((r) => ({
            production_order_line_id: r.production_order_line_id,
            kind: r.kind,
            cluster: r.cluster.trim() || null,
            name: r.name.trim(),
            group_code: r.group_code || null,
            material_id: r.material_id,
            material_type: r.material_type,
            spec_thickness_mm: num(r.spec_thickness_mm),
            spec_width_mm: num(r.spec_width_mm),
            spec_length_mm: num(r.spec_length_mm),
            wall_thickness_mm: num(r.wall_thickness_mm),
            unit: r.unit.trim() || null,
            qty_per_unit: num(r.qty_per_unit),
            dm_kg: num(r.dm_kg),
            pcs_per_bar: r.pcs_per_bar,
            qty_per_assembly: r.qty_per_assembly,
            first_stage: r.first_stage,
            final_stage: r.final_stage,
            // Bản chụp lộ trình PHẢI đi kèm, không thì mỗi lần Lưu xoá sạch.
            stages: r.stages,
            note: r.note.trim() || null,
          })),
        },
      })
      const gio = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const seeded = res.seeded.length
        ? ` · khởi tạo hồ sơ: ${res.seeded.map((x) => `${x.product_code} (+${x.added})`).join(', ')}`
        : ''
      const skipped = res.seed_skipped.length
        ? ` · không khởi tạo: ${res.seed_skipped.map((x) => `${x.product_code}: ${x.reason}`).join('; ')}`
        : ''
      const lyDoBoQua: Record<string, string> = {
        locked: 'hồ sơ đã khoá',
        not_found: 'không còn hồ sơ',
      }
      const synced = (res.routes_synced ?? []).length
        ? ` · hồ sơ SP nhận lộ trình: ${res.routes_synced.map((x) => `${x.product_code} (${x.updated} cụm)`).join(', ')}`
        : ''
      const syncSkipped = (res.routes_skipped ?? []).length
        ? ` · hồ sơ SP không cập nhật: ${res.routes_skipped.map((x) => `${x.product_code} (${lyDoBoQua[x.reason] ?? x.reason})`).join(', ')}`
        : ''
      const syncMissing = (res.routes_missing ?? []).length
        ? ` · chỉ ghi trên lệnh (hồ sơ SP chưa có cụm): ${res.routes_missing.map((x) => `${x.cluster} của ${x.product_code}`).join(', ')}`
        : ''
      setThongBao(
        `Đã lưu bảng định hình ${rows.length} dòng lúc ${gio}${seeded}${skipped}${synced}${syncSkipped}${syncMissing}`,
      )
      setDirty(false)
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e, 'Không lưu được bảng'))
    } finally {
      setBusy(false)
    }
  }

  // ── Bàn phím & dán (nếp Excel, như Ghi sản lượng) ───────────────────────
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}:${col}"]:not([disabled])`,
    )
    if (!el) return false
    el.focus()
    el.select?.()
    return true
  }
  const step = (row: number, col: number, dr: number, dc: number) => {
    for (let i = 1; i <= (dr !== 0 ? order.length : cols.length); i++) {
      if (focusCell(row + dr * i, col + dc * i)) return
    }
  }
  const onCellKey =
    (row: number, col: number) =>
    (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.ctrlKey || e.metaKey) return
      const el = e.currentTarget
      const isInput = el instanceof HTMLInputElement
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        step(row, col, e.key === 'Enter' && e.shiftKey ? -1 : 1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        step(row, col, -1, 0)
      } else if (e.key === 'ArrowLeft' && (!isInput || el.selectionStart === 0)) {
        e.preventDefault()
        step(row, col, 0, -1)
      } else if (
        e.key === 'ArrowRight' &&
        (!isInput || el.selectionEnd === el.value.length)
      ) {
        e.preventDefault()
        step(row, col, 0, 1)
      }
    }
  const groupByLabel = useMemo(
    () => new Map(p.groups.map((g) => [g.label.toLocaleLowerCase('vi'), g.code])),
    [p.groups],
  )
  const onCellPaste =
    (row: number, col: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
      const grid = parsePasteGrid(e.clipboardData.getData('text/plain'))
      if (grid.length === 0 || isSingleCell(grid)) return
      e.preventDefault()
      const { fills, dropped } = pasteFootprint(
        grid,
        { row, col },
        { rows: order.length, cols: cols.length },
      )
      setRows((rs) => {
        const byKey = new Map(rs.map((r) => [r.key, { ...r }]))
        for (let r = 0; r < grid.length; r++) {
          const key = order[row + r]
          if (!key) continue
          const cur = byKey.get(key)!
          for (let c = 0; c < grid[r].length; c++) {
            const colDef = cols[col + c]
            if (!colDef) continue
            const raw = grid[r][c]
            if (colDef.kind === 'num') {
              ;(cur as Record<string, unknown>)[colDef.key] =
                raw === '' ? '' : (parsePasteNumber(raw)?.toString() ?? '')
            } else if (colDef.kind === 'select') {
              const code = raw.trim().toUpperCase()
              ;(cur as Record<string, unknown>)[colDef.key] = p.groups.some(
                (g) => g.code === code,
              )
                ? code
                : (groupByLabel.get(raw.trim().toLocaleLowerCase('vi')) ?? cur.group_code)
            } else {
              ;(cur as Record<string, unknown>)[colDef.key] = raw
            }
          }
        }
        return rs.map((r) => byKey.get(r.key)!)
      })
      setDirty(true)
      setThongBao(
        `Đã dán ${fills} ô${dropped > 0 ? ` — ${dropped} ô rơi ngoài lưới nên bị bỏ` : ''}`,
      )
    }

  return {
    p,
    rows,
    tab,
    setTab,
    spLoc,
    setSpLoc,
    lines,
    byLine,
    rowIdx,
    cols,
    more,
    toggleMore,
    editable,
    seedProfile,
    setSeedProfile,
    syncProfile,
    setSyncProfile,
    chuaDinhMuc,
    busy,
    dirty,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    patch,
    addRow,
    removeRow,
    setStages,
    errCells,
    problems,
    first,
    nCum,
    luuWhy,
    goFirst,
    suggest,
    save,
    onCellKey,
    onCellPaste,
  } as const
}

export type DinhHinhCtx = ReturnType<typeof useDinhHinh>
