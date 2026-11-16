'use client'

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { isSingleCell, parsePasteGrid, pasteFootprint } from '@/lib/entry-paste'
import { chuanHoaO } from '@/lib/so-o-luoi'
import { khoaCum } from '@/lib/khoa-cum'
import { nhanTheoDot, nhomGomTheoMa } from '@/lib/gom-dot-ma'
import { khoaChiTiet } from '@/lib/lo-trinh-nhom'
import {
  EDIT_COLS,
  cellId,
  chuKyDong,
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
  // `tab` chỉ còn màn gộp Lộ trình công đoạn dùng ngầm (ma trận); màn Bảng chi
  // tiết không có tab nữa (04/11/2026) — giữ để `goFirst` đưa về lưới.
  const [tab, setTab] = useState<TabKey>('chi_tiet')
  // `initialSp` là id dòng lệnh (Lộ trình công đoạn) hoặc MÃ HÀNG (`?sp=` từ Ghi sản
  // lượng, 15/11) — mã thì lấy dòng ĐẦU của mã, đúng đại diện khi gom theo mã.
  const [spLoc, setSpLoc] = useState(
    () =>
      p.orderLines.find((l) => l.id === p.initialSp)?.id ??
      p.orderLines.find((l) => l.product_code === p.initialSp)?.id ??
      '',
  )
  const [seedProfile, setSeedProfile] = useState(false)
  // Ghi ngược lộ trình cụm lên hồ sơ SP — mặc định BẬT (chủ dự án 04/11/2026:
  // kế hoạch định hình trên lệnh là đường chính, hồ sơ SP đi theo). Bỏ tick khi
  // lệnh này là ngoại lệ một lần.
  const [syncProfile, setSyncProfile] = useState(true)
  const [busy, setBusy] = useState(false)
  // Lưu xong còn chờ máy chủ dựng lại bảng (router.refresh) — giữ nút khoá + báo
  // "đang cập nhật" tới khi bảng mới về (16/11/2026): lưu lần hai lúc bảng cũ
  // còn trên màn là ghi đè bằng bản cũ.
  const [taiLai, startTaiLai] = useTransition()
  const ban = busy || taiLai
  const [dirty, setDirty] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const more = useSyncExternalStore(subscribeMore, readMore, () => false)
  const toggleMore = () => writeMore(!more)
  const cols = useMemo(() => visibleCols(more), [more])

  const editable = p.canEdit && !p.lockedByEntries && !p.lsxClosed

  // ── GOM ĐỢT THEO MÃ (bản vẽ 15/11/2026 SNZSog1E…, Q2) ───────────────────
  // Quyết MỘT LẦN theo bảng lúc mở màn (gõ dở không làm nhóm tự tách / nhập).
  // Đợt đi theo bị ẩn; mọi sửa nằm trên đại diện; Lưu chép sang các đợt.
  const gom = useMemo(() => {
    if (!p.gomTheoMa) return new Map<string, string[]>()
    const by = new Map<string, InitialRow[]>()
    for (const r of p.initialRows)
      by.set(r.production_order_line_id, [
        ...(by.get(r.production_order_line_id) ?? []),
        r,
      ])
    return nhomGomTheoMa(p.orderLines, (id) => by.get(id) ?? [], chuKyDong)
  }, [p.gomTheoMa, p.initialRows, p.orderLines])
  const diTheo = useMemo(() => new Set([...gom.values()].flat()), [gom])
  /** Dòng lệnh BÀY (đại diện + mã một đợt + đợt không gom được). */
  const linesHien = useMemo(
    () => p.orderLines.filter((l) => !diTheo.has(l.id)),
    [p.orderLines, diTheo],
  )
  /** Số đợt + tổng SL một nhóm bày (đại diện gồm cả đợt đi theo). */
  const dotCua = (lineId: string) => {
    const ids = new Set([lineId, ...(gom.get(lineId) ?? [])])
    const ls = p.orderLines.filter((l) => ids.has(l.id))
    return { dot: ls.length, sl: ls.reduce((a, l) => a + l.qty, 0) }
  }
  const rowsHien = useMemo(
    () => rows.filter((r) => !diTheo.has(r.production_order_line_id)),
    [rows, diTheo],
  )
  /** Bộ dòng đem lưu — đại diện nhân ra mọi đợt của mã. */
  const rowsLuu = useMemo(() => nhanTheoDot(rowsHien, gom), [rowsHien, gom])

  useEffect(() => {
    if (!editable) return
    document.querySelector<HTMLInputElement>('[data-cell="0:1"]:not([disabled])')?.focus()
  }, [editable])

  const patch = (k: string, x: Partial<Draft>) => {
    setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...x } : r)))
    setDirty(true)
    setLoi(null)
  }
  // Dòng mới nằm cuối nhóm SP — có khi ngoài màn. Cuộn tới + đặt con trỏ vào
  // ô tên để người dùng thấy ngay dòng vừa thêm nằm đâu.
  const [moiKey, setMoiKey] = useState<string | null>(null)
  const addRow = (lineId: string) => {
    const dr = emptyDraft(lineId)
    setRows((rs) => [...rs, dr])
    setMoiKey(dr.key)
    setDirty(true)
  }
  useEffect(() => {
    if (!moiKey) return
    const el = document.getElementById(cellId(moiKey, 'name'))
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }, [moiKey])
  const removeRow = (k: string) => {
    setRows((rs) => rs.filter((r) => r.key !== k))
    setDirty(true)
  }
  // ── XOÁ DÒNG phải hỏi lại + hoàn tác được (13/11/2026, chủ dự án: "xoá không
  // có cảnh báo"). Bấm "Xoá" lần một: dòng tô đỏ, nút thành "Xoá?"; bấm lần
  // hai mới bỏ. Bỏ xong vẫn chỉ là bản nháp — dải trên lưới cho Hoàn tác tới khi Lưu.
  const [xoaCho, setXoaCho] = useState<string | null>(null)
  const [boVua, setBoVua] = useState<{ row: Draft; index: number } | null>(null)
  useEffect(() => {
    if (!xoaCho) return
    const t = setTimeout(() => setXoaCho(null), 4000)
    return () => clearTimeout(t)
  }, [xoaCho])
  const xinXoa = (k: string) => {
    if (xoaCho !== k) {
      setXoaCho(k)
      return
    }
    const index = rows.findIndex((r) => r.key === k)
    if (index >= 0) setBoVua({ row: rows[index], index })
    setXoaCho(null)
    removeRow(k)
  }
  const hoanTac = () => {
    if (!boVua) return
    setRows((rs) => [...rs.slice(0, boVua.index), boVua.row, ...rs.slice(boVua.index)])
    setBoVua(null)
    setDirty(true)
  }
  /** Dòng SP nhận "Thêm dòng" ở Action Pane: SP đang lọc, hoặc lệnh chỉ có một SP. */
  const lineThem = spLoc || (linesHien.length === 1 ? linesHien[0].id : null) || null
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
  /**
   * Đổi lộ trình NHIỀU dòng một lượt — bấm ô trên dòng tóm tắt một nhóm chi tiết
   * rời (bản vẽ 15/11/2026 QR43i6tr…, Q2). `null` / rỗng = về mặc định nhóm.
   */
  const setStagesMany = (m: ReadonlyMap<string, string[] | null>) => {
    if (!m.size) return
    setRows((rs) =>
      rs.map((r) => {
        if (!m.has(r.key)) return r
        const st = m.get(r.key)
        if (!st || st.length === 0) return { ...r, stages: null }
        return { ...r, stages: st, first_stage: st[0], final_stage: st[st.length - 1] }
      }),
    )
    setDirty(true)
  }
  /**
   * Chi tiết CÙNG TÊN + NHÓM ở các đợt khác cùng mã hàng (Q4): GIGA BN0231HG-AL có
   * 5 đợt, mỗi đợt một SP trên màn Lộ trình — không có cặp này thì bật May 5 lần.
   * Trả [nguồn, đích] + số đợt nhận.
   */
  const capDotKhac = (keys: readonly string[]) => {
    const src = rows.filter((r) => keys.includes(r.key))
    const lineId = src[0]?.production_order_line_id
    const ma = p.orderLines.find((l) => l.id === lineId)?.product_code
    const khac = new Set(
      p.orderLines.filter((l) => l.id !== lineId && l.product_code === ma).map((l) => l.id),
    )
    const theoKhoa = new Map(src.map((r) => [khoaChiTiet(r.name, r.group_code), r]))
    const cap: [Draft, Draft][] = []
    for (const r of rows) {
      if (r.kind !== 'part' || !khac.has(r.production_order_line_id)) continue
      const s = theoKhoa.get(khoaChiTiet(r.name, r.group_code))
      if (s) cap.push([s, r])
    }
    return { dot: new Set(cap.map(([, t]) => t.production_order_line_id)).size, cap }
  }
  const apChoDotCungMa = (keys: readonly string[]) => {
    const { dot, cap } = capDotKhac(keys)
    if (!cap.length) return 0
    const nguon = new Map(cap.map(([s, t]) => [t.key, s]))
    setRows((rs) =>
      rs.map((r) => {
        const s = nguon.get(r.key)
        return s
          ? { ...r, stages: s.stages, first_stage: s.first_stage, final_stage: s.final_stage }
          : r
      }),
    )
    setDirty(true)
    return dot
  }
  // Cụm cùng tên ở các SP KHÁC của lệnh (bản vẽ 4, 04/11/2026): khai một lần,
  // áp cho cả nhóm — lệnh 5 SP nhôm cùng "Cụm khung" không phải đánh 5 lần.
  const tenCum = (r: Draft) =>
    (r.cluster || r.name).replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')
  const anhEmCum = (k: string) => {
    const goc = rows.find((r) => r.key === k)
    if (!goc || goc.kind !== 'assembly') return []
    const ten = tenCum(goc)
    return rows.filter(
      (r) =>
        r.kind === 'assembly' &&
        r.key !== k &&
        r.production_order_line_id !== goc.production_order_line_id &&
        tenCum(r) === ten,
    )
  }
  const apChoCumCungTen = (k: string) => {
    const goc = rows.find((r) => r.key === k)
    if (!goc) return 0
    const ids = new Set(anhEmCum(k).map((r) => r.key))
    if (!ids.size) return 0
    setRows((rs) =>
      rs.map((r) =>
        ids.has(r.key)
          ? {
              ...r,
              stages: goc.stages,
              first_stage: goc.first_stage,
              final_stage: goc.final_stage,
            }
          : r,
      ),
    )
    setDirty(true)
    return ids.size
  }

  // ── Dòng đang bày + thứ tự phẳng cho bàn phím ───────────────────────────
  const lines = useMemo(
    () => linesHien.filter((l) => !spLoc || l.id === spLoc),
    [linesHien, spLoc],
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
      rowsHien.flatMap((r, i) =>
        rowProblems(r).map((pb) => ({ ...pb, rowKey: r.key, line: i + 1, name: r.name })),
      ),
    [rowsHien],
  )
  const errCells = useMemo(
    () => new Set(problems.map((pb) => cellId(pb.rowKey, pb.key))),
    [problems],
  )
  /** Câu lỗi theo ô — tooltip nói đúng vì sao đỏ, không chỉ "Ô bắt buộc". */
  const errMsg = useMemo(
    () => new Map(problems.map((pb) => [cellId(pb.rowKey, pb.key), pb.msg])),
    [problems],
  )
  const first = problems[0] ?? null
  const nCum = rowsHien.filter((r) => r.kind === 'assembly').length
  const chuaDinhMuc = p.orderLines.filter((l) => !l.has_profile)

  const luuWhy = !p.canEdit
    ? 'Bạn không có quyền định hình'
    : p.lsxClosed
      ? 'Lệnh đã kết thúc — bảng chỉ để tra cứu'
      : p.lockedByEntries
        ? p.pbsCount > 0
          ? `lệnh đã có ${p.pbsCount} phiếu sản lượng — xoá phiếu ở Sổ theo ngày rồi mới sửa được`
          : `lệnh đã có phiếu giao nhận — huỷ phiếu chưa nhận ở Giao nhận rồi mới sửa được`
        : rowsLuu.length === 0
          ? 'chưa có dòng nào'
          : first
            ? `dòng ${first.line}${first.name ? ` (${first.name})` : ''} ${first.msg}`
            : !dirty
              ? 'Chưa đổi gì'
              : null
  const goFirst = () => {
    if (!first) return
    setTab('chi_tiet')
    // Lỗi nằm ở cột quy cách đang ẩn → bật cột lên rồi mới tìm được ô.
    const an = !more && EDIT_COLS.some((c) => c.key === first.key && c.spec)
    if (an) writeMore(true)
    const toi = () => {
      const el = document.getElementById(cellId(first.rowKey, first.key))
      el?.scrollIntoView({ block: 'center' })
      ;(el as HTMLElement | null)?.focus()
    }
    if (an) requestAnimationFrame(toi)
    else toi()
  }

  // ── Nạp / lưu ───────────────────────────────────────────────────────────
  const suggest = async (source: 'bom' | 'previous') => {
    if (ban) return
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
      setBoVua(null)
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
    if (ban || luuWhy) return
    setBusy(true)
    setLoi(null)
    // Số chi tiết / CỤM của chi tiết trong cụm (dùng khi ghi sổ cụm trừ chi
    // tiết, entries.service) phải theo số cụm / SP vừa khai: 4 chân / SP mà cụm
    // chân ×2 thì 2 chân / cụm.
    const cumQty = new Map<string, number>()
    for (const r of rowsLuu) {
      const q = num(r.qty_per_unit)
      if (r.kind === 'assembly' && r.cluster.trim() && q && q > 0)
        cumQty.set(`${r.production_order_line_id}|${khoaCum(r.cluster)}`, q)
    }
    const soMoiCum = (r: Draft): number | null => {
      if (r.kind !== 'part' || !r.cluster.trim()) return r.qty_per_assembly
      const q = cumQty.get(`${r.production_order_line_id}|${khoaCum(r.cluster)}`)
      const perSp = num(r.qty_per_unit)
      return q && perSp ? Math.round((perSp / q) * 10000) / 10000 : r.qty_per_assembly
    }
    try {
      const res = await api<{
        seeded: { product_code: string; added: number }[]
        seed_skipped: { product_code: string; reason: string }[]
        routes_synced: { product_code: string; updated: number }[]
        routes_skipped: { product_code: string; reason: string }[]
        routes_missing: { product_code: string; cluster: string }[]
        qty_synced?: { product_code: string; updated: number }[]
      }>(`/api/dept/production/lsx/${p.lsx.id}/components`, {
        method: 'PUT',
        body: {
          seed_profile: seedProfile,
          sync_profile_routes: syncProfile,
          // Số cụm / SP thống kê đã GÕ (ô "chưa có" để trống thì không gửi) —
          // server ghi ngược hồ sơ SP để màn ghi hết báo "chưa có" (13/11/2026).
          cluster_qty: rowsLuu
            .filter(
              (r) =>
                r.kind === 'assembly' &&
                r.cluster.trim() &&
                (num(r.qty_per_unit) ?? 0) > 0,
            )
            .map((r) => ({
              production_order_line_id: r.production_order_line_id,
              cluster: r.cluster.trim(),
              qty: num(r.qty_per_unit)!,
            })),
          lines: rowsLuu.map((r) => ({
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
            // Cụm "chưa có" để trống → lệnh tạm tính 1 (số Phải làm vẫn ra).
            qty_per_unit: num(r.qty_per_unit) ?? (r.kind === 'assembly' ? 1 : null),
            dm_kg: num(r.dm_kg),
            pcs_per_bar: r.pcs_per_bar,
            qty_per_assembly: soMoiCum(r),
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
      const qtySynced = (res.qty_synced ?? []).length
        ? ` · hồ sơ SP nhận số cụm / SP: ${res.qty_synced!.map((x) => `${x.product_code} (${x.updated} cụm)`).join(', ')}`
        : ''
      const syncMissing = (res.routes_missing ?? []).length
        ? ` · chỉ ghi trên lệnh (hồ sơ SP chưa có cụm): ${res.routes_missing.map((x) => `${x.cluster} của ${x.product_code}`).join(', ')}`
        : ''
      setThongBao(
        `Đã lưu bảng định hình ${rowsLuu.length} dòng lúc ${gio}${seeded}${skipped}${synced}${qtySynced}${syncSkipped}${syncMissing}`,
      )
      setDirty(false)
      setBoVua(null)
      startTaiLai(() => router.refresh())
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
              // Cùng luật với gõ tay (lib/so-o-luoi); ô không đọc được GIỮ chữ để tô
              // đỏ — trước 15/11 nó thành ô trống không một lời báo.
              ;(cur as Record<string, unknown>)[colDef.key] = chuanHoaO(raw)
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
    rowsHien,
    rowsLuu,
    linesHien,
    dotCua,
    gomDuoc: gom.size > 0,
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
    busy: ban,
    taiLai,
    dirty,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    patch,
    addRow,
    removeRow,
    xoaCho,
    xinXoa,
    boVua,
    hoanTac,
    lineThem,
    setStages,
    setStagesMany,
    capDotKhac,
    apChoDotCungMa,
    anhEmCum,
    apChoCumCungTen,
    errCells,
    errMsg,
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
