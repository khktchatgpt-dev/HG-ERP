'use client'

import { useRef, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { chiaDot, gopKetQua, ngayCanGhi } from '@/lib/dan-so-ghi'
import type {
  KetQuaGhi,
  TaiLenKetQua,
  XemDanSo,
} from '@/modules/dept/production/dan-so.service'

export type ToXem = { cho: boolean; xem: XemDanSo | null; loi: string | null }
export type Buoc = 'chon' | 'xem' | 'ghi' | 'xong'
export type TienDo = {
  da: number
  tong: number
  trangThai: 'cho' | 'dang' | 'xong' | 'loi'
}

const URL_DAN_SO = '/api/dept/production/dan-so'

/**
 * State + xử lý của màn Tải file nhập liệu: đọc file → xem trước từng tờ (dùng CHUNG hàm `tinh`
 * của Dán sổ) → ghi từng đợt 10 ngày từng tờ, có tiến độ và Dừng.
 */
export function useTaiLen() {
  const [buoc, setBuoc] = useState<Buoc>('chon')
  const [dangDoc, setDangDoc] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [kq, setKq] = useState<TaiLenKetQua | null>(null)
  const [xem, setXem] = useState<Record<string, ToXem>>({})
  const [tab, setTab] = useState('')
  const [tien, setTien] = useState<Record<string, TienDo>>({})
  const [ketQua, setKetQua] = useState<Record<string, KetQuaGhi>>({})
  const dungRef = useRef(false)

  const reset = () => {
    setBuoc('chon')
    setKq(null)
    setXem({})
    setTien({})
    setKetQua({})
    setLoi(null)
  }

  const chonFile = async (file: File) => {
    reset()
    setDangDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${URL_DAN_SO}/tai-len`, { method: 'POST', body: fd })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const j = (await res.json().catch(() => null)) as
        (TaiLenKetQua & { error?: string }) | null
      if (!res.ok || !j) throw new Error(j?.error ?? 'Không đọc được file')
      setKq(j)
      setTab(j.to[0]?.ten_to ?? '')
      setBuoc('xem')
      // Xem trước từng tờ lần lượt (mỗi tờ vài giây) — tờ vướng chặn ở mức tờ thì bỏ qua.
      setXem(
        Object.fromEntries(
          j.to.map((t) => [t.ten_to, { cho: !t.van_de.length, xem: null, loi: null }]),
        ),
      )
      for (const t of j.to) {
        if (t.van_de.length > 0) continue
        try {
          const x = await api<XemDanSo>(URL_DAN_SO, {
            method: 'POST',
            body: { mode: 'xem', data: t.payload },
          })
          setXem((s) => ({ ...s, [t.ten_to]: { cho: false, xem: x, loi: null } }))
        } catch (e) {
          setXem((s) => ({
            ...s,
            [t.ten_to]: {
              cho: false,
              xem: null,
              loi: apiErrorText(e, 'Không xem trước được'),
            },
          }))
        }
      }
    } catch (e) {
      setLoi(e instanceof Error ? e.message : 'Không đọc được file')
    } finally {
      setDangDoc(false)
    }
  }

  const dangTinh = Object.values(xem).some((x) => x.cho)
  /** Chỗ vướng: mức tờ + từng dòng bị chặn + lỗi xem trước. */
  const chan = (kq?.to ?? []).flatMap((t) => {
    const out: { to: string; text: string }[] = t.van_de.map((v) => ({
      to: t.ten_to,
      text: v,
    }))
    const x = xem[t.ten_to]
    if (x?.loi) out.push({ to: t.ten_to, text: x.loi })
    for (const d of x?.xem?.dong ?? []) {
      if (d.van_de.length > 0)
        out.push({ to: t.ten_to, text: `Dòng ${d.hang}: ${d.van_de[0]}` })
    }
    for (const c of x?.xem?.cot_loi ?? [])
      out.push({ to: t.ten_to, text: `Cột ${c.iso}: ${c.loi}` })
    return out
  })
  const tongO = (kq?.to ?? []).reduce(
    (a, t) => a + (xem[t.ten_to]?.xem?.tom_tat.o_ghi ?? 0),
    0,
  )
  const whyGhi = !kq
    ? 'Chọn file'
    : dangTinh
      ? 'Đang xem trước các tờ…'
      : chan.length > 0
        ? `Còn ${chan.length} chỗ cần sửa`
        : tongO === 0
          ? 'Không có ô nào mới để ghi'
          : null

  const ghi = async () => {
    if (!kq || whyGhi || buoc === 'ghi') return
    dungRef.current = false
    setBuoc('ghi')
    setLoi(null)
    const ketQuaMoi: Record<string, KetQuaGhi> = {}
    const ghiTo = kq.to.filter(
      (t) =>
        (xem[t.ten_to]?.xem?.tom_tat.o_ghi ?? 0) +
          (xem[t.ten_to]?.xem?.tom_tat.moi ?? 0) >
        0,
    )
    setTien(
      Object.fromEntries(
        ghiTo.map((t) => [
          t.ten_to,
          {
            da: 0,
            tong: ngayCanGhi(xem[t.ten_to].xem).length,
            trangThai: 'cho' as const,
          },
        ]),
      ),
    )
    try {
      for (const t of ghiTo) {
        const ngay = ngayCanGhi(xem[t.ten_to].xem)
        const dots: (string[] | null)[] = ngay.length > 0 ? chiaDot(ngay, 10) : [null]
        const parts: KetQuaGhi[] = []
        const da = () =>
          parts.reduce((a, p) => a + p.phieu.filter((x) => x.doc_no).length, 0)
        setTien((s) => ({ ...s, [t.ten_to]: { ...s[t.ten_to], trangThai: 'dang' } }))
        for (let i = 0; i < dots.length; i++) {
          const r = await api<KetQuaGhi>(URL_DAN_SO, {
            method: 'POST',
            body: { mode: 'ghi', data: t.payload, ...(dots[i] ? { ngay: dots[i] } : {}) },
          })
          parts.push(r)
          setTien((s) => ({ ...s, [t.ten_to]: { ...s[t.ten_to], da: da() } }))
          if (
            dungRef.current &&
            !(t === ghiTo[ghiTo.length - 1] && i === dots.length - 1)
          ) {
            ketQuaMoi[t.ten_to] = gopKetQua(parts)
            setKetQua({ ...ketQuaMoi })
            setLoi(
              `Đã dừng sau đợt này. Tải lại cùng file rồi bấm Ghi để ghi tiếp — ô đã ghi tự bỏ qua.`,
            )
            setBuoc('xong')
            return
          }
        }
        ketQuaMoi[t.ten_to] = gopKetQua(parts)
        setKetQua({ ...ketQuaMoi })
        setTien((s) => ({ ...s, [t.ten_to]: { ...s[t.ten_to], trangThai: 'xong' } }))
      }
      setBuoc('xong')
    } catch (e) {
      setKetQua({ ...ketQuaMoi })
      setLoi(
        `${apiErrorText(e, 'Không ghi được')} — tải lại cùng file rồi bấm Ghi để ghi tiếp, ô đã ghi tự bỏ qua.`,
      )
      setBuoc('xong')
    }
  }

  return {
    buoc,
    dangDoc,
    loi,
    kq,
    xem,
    tab,
    setTab,
    tien,
    ketQua,
    dangTinh,
    chan,
    tongO,
    whyGhi,
    chonFile,
    ghi,
    reset,
    dung: () => {
      dungRef.current = true
    },
  } as const
}

export type TaiLenCtx = ReturnType<typeof useTaiLen>
