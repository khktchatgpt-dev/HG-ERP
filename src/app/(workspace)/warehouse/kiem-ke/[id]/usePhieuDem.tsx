'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { docDem, type DongDem, type DotDem, type Nhap } from './phieu-dem.shared'

/** Chờ người gõ ngừng tay bao lâu thì tự lưu (bản vẽ KK-3: "số tự lưu sau 2 giây"). */
const TU_LUU_MS = 2000

/**
 * TOÀN BỘ STATE + XỬ LÝ của phiếu đếm (Kho B7b). Màn và lưới chỉ đọc `d` và gọi
 * hàm; không ghi thẳng vào ref của hook.
 *
 * Lưu theo lô: mọi dòng đã gõ một số hợp lệ đi chung một lần gọi; dòng gõ chữ
 * không phải số thì giữ lại, không gửi, và nói tại chỗ.
 */
export function usePhieuDem(dot: DotDem, dong: DongDem[]) {
  const router = useRouter()
  const [nhap, setNhap] = useState<Record<string, Nhap>>({})
  const [dangLuu, setDangLuu] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [bao, setBao] = useState<string | null>(null)
  const [daThuGui, setDaThuGui] = useState(false)
  const [busy, setBusy] = useState<'start' | 'submit' | 'them' | null>(null)
  const [q, setQ] = useState('')
  const [ke, setKe] = useState('')
  const [chiChua, setChiChua] = useState(false)
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bản mới nhất cho hàm lưu chạy trong setTimeout (tránh đọc state cũ).
  const nhapRef = useRef(nhap)
  useEffect(() => {
    nhapRef.current = nhap
  })

  const dangDem = dot.status === 'counting'

  /** Số đếm hiệu lực của dòng: chữ đang gõ (nếu hợp lệ) hoặc số đã lưu. */
  const soDem = useCallback(
    (l: DongDem): number | null => {
      const n = nhap[l.id]
      if (n?.qty !== undefined) return docDem(n.qty)
      return l.dem
    },
    [nhap],
  )

  const chuaDem = useMemo(() => dong.filter((l) => soDem(l) == null), [dong, soDem])
  const sai = useMemo(
    () => dong.filter((l) => nhap[l.id]?.qty !== undefined && nhap[l.id].qty!.trim() !== '' && docDem(nhap[l.id].qty) == null), // prettier-ignore
    [dong, nhap],
  )
  const dirty = Object.keys(nhap).length > 0
  const keDs = useMemo(
    () => [...new Set(dong.map((l) => l.ke ?? '').filter(Boolean))].sort(),
    [dong],
  )
  const hien = useMemo(() => {
    const s = q.trim().toLowerCase()
    return dong.filter(
      (l) =>
        (!ke || l.ke === ke) &&
        (!chiChua || soDem(l) == null) &&
        (!s || l.code.toLowerCase().includes(s) || l.name.toLowerCase().includes(s)),
    )
  }, [dong, q, ke, chiChua, soDem])

  const luu = useCallback(async (): Promise<boolean> => {
    if (hen.current) clearTimeout(hen.current)
    const cur = nhapRef.current
    const counts = dong.flatMap((l) => {
      const n = cur[l.id]
      if (!n) return []
      const qty = n.qty !== undefined ? docDem(n.qty) : l.dem
      // Chưa có số hợp lệ → chưa gửi được (ghi chú không đứng một mình).
      if (qty == null) return []
      return [{ line_id: l.id, counted_qty: qty, note: n.note !== undefined ? n.note.trim() || null : l.note }] // prettier-ignore
    })
    if (counts.length === 0) return true
    setDangLuu(true)
    setLoi(null)
    try {
      await api(`/api/dept/warehouse/stocktakes/${dot.id}/counts`, {
        method: 'POST',
        body: { counts },
      })
      const daGui = new Set(counts.map((c) => c.line_id))
      setNhap((m) => {
        const out: Record<string, Nhap> = {}
        for (const [k, v] of Object.entries(m)) {
          // Giữ dòng chưa gửi được, và dòng người dùng gõ tiếp TRONG LÚC đang lưu.
          if (!daGui.has(k) || v !== cur[k]) out[k] = v
        }
        return out
      })
      router.refresh()
      return true
    } catch (e) {
      setLoi(apiErrorText(e, 'Không lưu được số đếm'))
      return false
    } finally {
      setDangLuu(false)
    }
  }, [dong, dot.id, router])

  const go = (id: string, p: Nhap) => {
    setBao(null)
    setNhap((m) => ({ ...m, [id]: { ...m[id], ...p } }))
    if (hen.current) clearTimeout(hen.current)
    hen.current = setTimeout(() => void luu(), TU_LUU_MS)
  }
  useEffect(
    () => () => {
      if (hen.current) clearTimeout(hen.current)
    },
    [],
  )

  // Rời trang khi còn số chưa lưu → hỏi (số đếm ngoài kệ khó lấy lại).
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  async function batDau() {
    setBusy('start')
    setLoi(null)
    try {
      const r = await api<{ lines: number }>(`/api/dept/warehouse/stocktakes/${dot.id}/start`, { method: 'POST' }) // prettier-ignore
      setBao(`Đã chốt sổ và sinh ${r.lines.toLocaleString('vi-VN')} dòng đếm. Bắt đầu đếm từ dòng đầu tiên.`) // prettier-ignore
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function gui() {
    setDaThuGui(true)
    if (chuaDem.length > 0 || sai.length > 0) return
    setBusy('submit')
    setLoi(null)
    try {
      if (!(await luu())) return
      await api(`/api/dept/warehouse/stocktakes/${dot.id}/submit`, { method: 'POST' })
      setBao('Đã gửi đối chiếu. Thủ kho xem chênh lệch và duyệt; số đếm không sửa được nữa trừ khi bị trả về.') // prettier-ignore
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function themMa(materialId: string): Promise<string | null> {
    setBusy('them')
    setLoi(null)
    try {
      const r = await api<{ line_id: string }>(
        `/api/dept/warehouse/stocktakes/${dot.id}/lines`,
        {
          method: 'POST',
          body: { material_id: materialId },
        },
      )
      router.refresh()
      return r.line_id
    } catch (e) {
      setLoi(apiErrorText(e))
      return null
    } finally {
      setBusy(null)
    }
  }

  /** Nhảy tới ô số đếm của dòng chưa đếm đầu tiên (câu chặn bấm được). */
  function toiChuaDem() {
    const dau = sai[0] ?? chuaDem[0]
    if (!dau) return
    setQ('')
    setKe('')
    requestAnimationFrame(() => {
      const el = document.getElementById(`dem-${dau.id}`) as HTMLInputElement | null
      el?.scrollIntoView({ block: 'center' })
      el?.focus()
    })
  }

  return {
    dot,
    dong,
    hien,
    nhap,
    soDem,
    chuaDem,
    sai,
    dirty,
    dangDem,
    dangLuu,
    loi,
    bao,
    setBao,
    daThuGui,
    busy,
    q,
    setQ,
    ke,
    setKe,
    keDs,
    chiChua,
    setChiChua,
    go,
    luu,
    batDau,
    gui,
    themMa,
    toiChuaDem,
  } as const
}

export type PhieuDemCtx = ReturnType<typeof usePhieuDem>
