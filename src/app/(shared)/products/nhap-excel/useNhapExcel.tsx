'use client'

import { useMemo, useState, type RefObject } from 'react'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import type {
  ImportPreview,
  WrittenRow,
} from '@/modules/dept/technical/product-import.service'
import {
  API,
  CHUNK,
  CHUNK_IMAGES,
  PACKING_CHUNK,
  matches,
  type Filter,
  type PackFilter,
  type Progress,
  type SheetTab,
} from './nhap-excel.shared'

/**
 * Toàn bộ state + xử lý của màn nhập Excel. File đi THẲNG lên Storage bằng URL ký
 * (Vercel cắt thân request ~4,5 MB); mọi bước sau chỉ gửi đường dẫn. Ghi theo lô:
 * dòng SP trước (50 dòng / 10 ảnh mới một lô), đóng gói sau (40 SP một lô).
 */
export function useNhapExcel(
  /** Ô chọn file ẩn + mốc đầu bảng — màn giữ ref, hook chỉ dùng trong xử lý sự kiện. */
  input: RefObject<HTMLInputElement | null>,
  top: RefObject<HTMLDivElement | null>,
) {
  const toast = useToast()
  const [file, setFile] = useState<{ name: string; path: string } | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [sheet, setSheet] = useState<SheetTab>('products')
  const [filter, setFilter] = useState<Filter>('write')
  const [packFilter, setPackFilter] = useState<PackFilter>('replace')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [written, setWritten] = useState<WrittenRow[] | null>(null)
  const [packed, setPacked] = useState<string[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const rows = useMemo(() => preview?.rows ?? [], [preview])
  const needle = q.trim().toLowerCase()
  const shown = rows.filter(
    (r) =>
      matches(r, filter) &&
      (!needle ||
        (r.code ?? '').toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle)),
  )
  const count = (f: Filter) => rows.filter((r) => matches(r, f)).length
  const errorRows = rows.filter((r) => r.action === 'error').map((r) => r.row)
  const toWrite = rows.filter((r) => r.action === 'create' || r.action === 'update')
  const newImages = toWrite.filter((r) => r.newImage != null).length
  const lacking = toWrite.filter((r) => r.gaps.core.length > 0).length

  const packItems = preview?.packing.items ?? []
  const packShown = packItems.filter((i) => i.action === packFilter)
  const toPack = packItems.filter((i) => i.action === 'replace').map((i) => i.code)
  const packErrors = packItems.filter((i) => i.action === 'error')
  const packErrorRows = packErrors.flatMap((i) => i.rows)
  const nothing = toWrite.length === 0 && toPack.length === 0
  const packLotCount = Math.ceil(toPack.length / PACKING_CHUNK)
  /** SP khác nhau sẽ được ghi — một SP vừa cập nhật vừa thay đóng gói chỉ đếm một lần. */
  const productsToWrite = new Set([
    ...toWrite.map((r) => r.code ?? `#${r.row}`),
    ...toPack,
  ]).size

  const blocked =
    errorRows.length > 0
      ? `${errorRows.length} dòng lỗi ở sheet Sản phẩm (dòng ${errorRows.slice(0, 6).join(', ')}${errorRows.length > 6 ? '…' : ''})${packErrors.length ? ` · ${packErrors.length} SP lỗi ở sheet Đóng gói` : ''} — bấm để xem`
      : packErrors.length > 0
        ? `Sheet Đóng gói: ${packErrors.length} SP lỗi (dòng ${packErrorRows.slice(0, 6).join(', ')}${packErrorRows.length > 6 ? '…' : ''}) — bấm để xem`
        : nothing
          ? 'File không có gì khác dữ liệu đang có'
          : undefined

  function goBlocked() {
    if (errorRows.length > 0) {
      setSheet('products')
      setFilter('error')
    } else {
      setSheet('packing')
      setPackFilter('error')
    }
    top.current?.scrollIntoView({ block: 'start' })
  }

  async function readFile(f: File) {
    if (!/\.xlsx$/i.test(f.name)) {
      toast.error(
        'Chỉ nhận file .xlsx',
        'File .xls cũ hãy mở bằng Excel rồi lưu lại thành .xlsx',
      )
      return
    }
    setBusy(true)
    try {
      // 1) Xin chỗ trên Storage, 2) PUT thẳng file lên đó, 3) server đọc + soi.
      const { path, uploadUrl } = await api<{ path: string; uploadUrl: string }>(`${API}/upload-url`, { method: 'POST' }) // prettier-ignore
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': f.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, // prettier-ignore
        body: f,
      })
      if (!put.ok) throw new Error(`Tải file lên không được (${put.status})`)
      const p = await api<ImportPreview>(`${API}/preview`, {
        method: 'POST',
        body: { path },
      })
      setFile({ name: f.name, path })
      setPreview(p)
      setWritten(null)
      setFailed(null)
      setDownloadUrl(null)
      setProgress(null)
      setPacked([])
      setOpen(null)
      setQ('')
      // Mở thẳng chỗ cần nhìn: lỗi trước, rồi tới thứ sẽ ghi.
      const onlyPacking = p.counts.create + p.counts.update === 0 && p.packing.counts.replace > 0 // prettier-ignore
      if (p.counts.error > 0) {
        setSheet('products')
        setFilter('error')
      } else if (p.packing.counts.error > 0 || onlyPacking) {
        setSheet('packing')
        setPackFilter(p.packing.counts.error > 0 ? 'error' : 'replace')
      } else {
        setSheet('products')
        setFilter('write')
      }
    } catch (err) {
      toast.error('Không đọc được file', apiErrorText(err, err instanceof Error ? err.message : 'Có lỗi')) // prettier-ignore
    } finally {
      setBusy(false)
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void readFile(f)
  }

  /** Kéo-thả file vào ô của màn trống (Q4). */
  const drop = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files?.[0]
      if (f) void readFile(f)
    },
  }

  async function commit() {
    if (!file || !preview || nothing) return
    setBusy(true)
    setFailed(null)
    // Lô đóng khi đủ 50 dòng HOẶC đủ 10 ảnh mới.
    const lots: number[][] = []
    let lot: number[] = []
    let lotImages = 0
    for (const r of toWrite) {
      const img = r.newImage != null ? 1 : 0
      if (lot.length && (lot.length >= CHUNK || lotImages + img > CHUNK_IMAGES)) {
        lots.push(lot)
        lot = []
        lotImages = 0
      }
      lot.push(r.row)
      lotImages += img
    }
    if (lot.length) lots.push(lot)
    // Đóng gói ghi SAU mọi dòng sản phẩm, 40 SP một lô.
    const packLots: string[][] = []
    for (let i = 0; i < toPack.length; i += PACKING_CHUNK) packLots.push(toPack.slice(i, i + PACKING_CHUNK)) // prettier-ignore
    const total = lots.length + packLots.length
    const done: WrittenRow[] = []
    const packedNow: string[] = []
    const createdSoFar = () =>
      done.filter((w) => w.action === 'create').map((w) => ({ row: w.row, code: w.code }))
    try {
      for (let i = 0; i < lots.length; i++) {
        setProgress({ done: done.length, total: toWrite.length, lot: i + 1, lots: total })
        const r = await api<{ written: WrittenRow[] }>(`${API}/commit`, {
          method: 'POST',
          body: { path: file.path, rows: lots[i], written: createdSoFar() },
        })
        done.push(...r.written)
      }
      for (let j = 0; j < packLots.length; j++) {
        setProgress({ done: done.length, total: toWrite.length, lot: lots.length + j + 1, lots: total }) // prettier-ignore
        const r = await api<{ packed: string[] }>(`${API}/commit`, {
          method: 'POST',
          body: { path: file.path, rows: [], written: createdSoFar(), packingCodes: packLots[j] }, // prettier-ignore
        })
        packedNow.push(...r.packed)
      }
      const c = done.filter((w) => w.action === 'create').length
      toast.success(
        `Đã ghi ${new Set([...done.map((w) => w.code), ...packedNow]).size} sản phẩm`,
        `${c} thêm mới · ${done.length - c} cập nhật${packedNow.length ? ` · ${packedNow.length} SP thay đóng gói` : ''}`,
      )
    } catch (err) {
      setFailed(apiErrorText(err))
    } finally {
      setProgress(null)
      setWritten(done)
      setPacked(packedNow)
      setBusy(false)
    }
  }

  async function download() {
    if (!file || !written) return
    if (downloadUrl) {
      window.location.href = downloadUrl
      return
    }
    setBusy(true)
    try {
      const { url } = await api<{ url: string }>(`${API}/finish`, {
        method: 'POST',
        body: {
          path: file.path,
          filename: file.name,
          written: written.map((w) => ({ row: w.row, code: w.code, version: w.version, imageRef: w.imageRef ?? null })), // prettier-ignore
        },
      })
      setDownloadUrl(url)
      window.location.href = url
    } catch (err) {
      toast.error('Không tạo được file', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  /** Mã thêm mới lúc ghi khác bản soi — có người vừa thêm SP cùng loại. */
  const codeChanged = useMemo(() => {
    if (!written) return []
    const before = new Map(rows.map((r) => [r.row, r.code]))
    return written.filter((w) => w.action === 'create' && before.get(w.row) !== w.code)
  }, [written, rows])

  return {
    file,
    preview,
    rows,
    shown,
    count,
    sheet,
    setSheet,
    filter,
    setFilter,
    packFilter,
    setPackFilter,
    packItems,
    packShown,
    q,
    setQ,
    open,
    toggle: (row: number) => setOpen((o) => (o === row ? null : row)),
    dragging,
    drop,
    busy,
    progress,
    packLotCount,
    written,
    packed,
    failed,
    codeChanged,
    errorRows,
    toWrite,
    toPack,
    packErrors,
    newImages,
    lacking,
    productsToWrite,
    nothing,
    blocked,
    goBlocked,
    onPick,
    pick: () => input.current?.click(),
    commit,
    download,
  } as const
}

export type NhapExcelCtx = ReturnType<typeof useNhapExcel>
