'use client'

import { useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { SpPreview, SpWritten } from '@/modules/dept/technical/sp-excel.service'

const API = '/api/dept/technical/products/sp-excel'
const CHUNK = 50

export type Loc = 'all' | 'create' | 'update' | 'error' | 'image' | 'unchanged'

/** State + xử lý của màn nhập Excel: tải lên → soi → ghi theo lô → tải lại file đã có mã. */
export function useNhapExcel() {
  const toast = useToast()
  const [file, setFile] = useState<{ name: string; path: string; size: number } | null>(
    null,
  )
  const [preview, setPreview] = useState<SpPreview | null>(null)
  const [loc, setLoc] = useState<Loc>('all')
  const [busy, setBusy] = useState(false)
  const [tienDo, setTienDo] = useState<string | null>(null)
  const [written, setWritten] = useState<SpWritten[] | null>(null)
  const [doneUrl, setDoneUrl] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)

  async function chonFile(f: File | null | undefined) {
    if (!f) return
    setBusy(true)
    setLoi(null)
    setWritten(null)
    setDoneUrl(null)
    setTienDo('Đang tải file lên…')
    try {
      // 1) xin chỗ trên Storage, 2) PUT thẳng file lên, 3) server đọc + soi.
      const { path, uploadUrl } = await api<{ path: string; uploadUrl: string }>(
        `${API}/upload-url`,
        { method: 'POST' },
      )
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type':
            f.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: f,
      })
      if (!put.ok) throw new Error(`Tải file lên không được (${put.status})`)
      setTienDo('Đang soi từng dòng…')
      const p = await api<SpPreview>(`${API}/preview`, { method: 'POST', body: { path } })
      setFile({ name: f.name, path, size: f.size })
      setPreview(p)
      setLoc('all')
    } catch (e) {
      setLoi(e instanceof ApiError || e instanceof Error ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
      setTienDo(null)
    }
  }

  async function ghi() {
    if (!preview || !file || busy) return
    const rows = preview.rows
      .filter((r) => r.action === 'create' || r.action === 'update')
      .map((r) => r.row)
    if (!rows.length) return
    setBusy(true)
    setLoi(null)
    const all: SpWritten[] = []
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setTienDo(
          `Đang ghi dòng ${i + 1}–${Math.min(i + CHUNK, rows.length)} / ${rows.length}…`,
        )
        const r = await api<{ written: SpWritten[] }>(`${API}/commit`, {
          method: 'POST',
          body: {
            path: file.path,
            rows: rows.slice(i, i + CHUNK),
            written: all
              .filter((w) => w.action === 'create')
              .map((w) => ({ row: w.row, code: w.code })),
          },
        })
        all.push(...r.written)
        setWritten([...all])
      }
      setTienDo('Đang điền mã vào file…')
      const fin = await api<{ url: string }>(`${API}/finish`, {
        method: 'POST',
        body: {
          path: file.path,
          filename: file.name,
          written: all.map((w) => ({
            row: w.row,
            code: w.code,
            version: w.version,
            imageRef: w.imageRef,
          })),
        },
      })
      setDoneUrl(fin.url)
      toast.success(
        'Đã ghi',
        `${all.length} dòng · ${all.filter((w) => w.action === 'create').length} SP mới`,
      )
    } catch (e) {
      setLoi(e instanceof ApiError || e instanceof Error ? e.message : 'Có lỗi')
      if (all.length)
        toast.error(
          `Đã ghi ${all.length}/${rows.length} dòng rồi dừng`,
          'Tải lại file để soi lại phần còn lại',
        )
    } finally {
      setBusy(false)
      setTienDo(null)
    }
  }

  function boFile() {
    setFile(null)
    setPreview(null)
    setWritten(null)
    setDoneUrl(null)
    setLoi(null)
  }

  const rows = preview
    ? preview.rows.filter((r) =>
        loc === 'all'
          ? true
          : loc === 'image'
            ? r.newImage && r.action !== 'error'
            : r.action === loc,
      )
    : []

  return {
    file,
    preview,
    rows,
    loc,
    setLoc,
    busy,
    tienDo,
    written,
    doneUrl,
    loi,
    chonFile,
    ghi,
    boFile,
  } as const
}

export type NhapExcelCtx = ReturnType<typeof useNhapExcel>
