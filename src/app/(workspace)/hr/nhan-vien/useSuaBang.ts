'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  COT_SUA,
  tongHop,
  type CotSua,
  type LoiO,
  type SuaBang,
} from '@/lib/nhan-su/sua-bang'
import type { NvLuoi } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'

type KetQua = { nguoi: number; o: number; loi: { ma: string | null; loi: string }[] }
type Bao = { ok: boolean; text: string } | null

/**
 * SỬA TRÊN BẢNG (B2, bản vẽ 02/11/2026 mục B) — chữ đang gõ theo người + ô, đếm ô đổi / ô sai,
 * lưu MỘT lần qua route sua-bang (đường nạp hồ sơ). Chữ gõ giữ theo id người nên đổi lọc / bộ
 * cột không mất; dòng đã điền vẫn ở lại tới khi lưu (lưới lọc theo dữ liệu đã lưu).
 */
export function useSuaBang(all: NvLuoi[], ds: NvLuoi[], setBao: (b: Bao) => void) {
  const router = useRouter()
  const [dangSua, setDangSua] = useState(false)
  const [sua, setSua] = useState<SuaBang>({})
  const [luuDang, setLuuDang] = useState(false)
  const nguoi = useMemo(() => new Map(all.map((n) => [n.id, n])), [all])
  const tong = useMemo(
    () => tongHop(sua, nguoi, { ids: ds.map((n) => n.id), cots: COT_SUA }),
    [sua, nguoi, ds],
  )
  const coChu = Object.keys(sua).length > 0

  // Rời trang khi còn chữ chưa lưu → trình duyệt hỏi lại (đóng tab, F5, gõ địa chỉ khác).
  useEffect(() => {
    if (!coChu) return
    const hoi = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', hoi)
    return () => window.removeEventListener('beforeunload', hoi)
  }, [coChu])

  function datO(id: string, cot: CotSua, v: string) {
    setSua((s) => ({ ...s, [id]: { ...s[id], [cot]: v } }))
  }
  /** Esc trên ô = trả ô về như cũ. */
  function traO(id: string, cot: CotSua) {
    setSua((s) => {
      const { [cot]: _bo, ...con } = s[id] ?? {}
      const out = { ...s }
      if (Object.keys(con).length) out[id] = con
      else delete out[id]
      return out
    })
  }
  function dan(o: { id: string; cot: CotSua; v: string }[]) {
    setSua((s) => {
      const out = { ...s }
      for (const x of o) out[x.id] = { ...out[x.id], [x.cot]: x.v }
      return out
    })
    setBao({ ok: true, text: `Đã dán ${o.length} ô — kiểm lại rồi bấm Lưu` })
  }

  /** Nhảy tới ô sai đầu tiên: mở nhóm đang thu gọn nếu cần (gọi từ màn), rồi focus. */
  function toi(l: LoiO) {
    const el = document.querySelector<HTMLInputElement>(
      `input[data-id="${l.id}"][data-cot="${l.cot}"]`,
    )
    if (el) {
      el.focus()
      el.select()
    } else
      setBao({
        ok: false,
        text: `Ô sai của ${nguoi.get(l.id)?.code} đang bị ẩn — bỏ lọc hoặc đổi bộ cột để thấy`,
      })
  }

  async function luu() {
    if (tong.loi.length || !tong.goi.length) return
    setLuuDang(true)
    try {
      const r = await api<KetQua>('/api/dept/hr/cham-cong/nhan-vien/sua-bang', {
        method: 'POST',
        body: { dong: tong.goi },
      })
      const hong = new Set(r.loi.map((l) => l.ma))
      // Người lưu được thì bỏ chữ gõ; người hỏng giữ nguyên để sửa tiếp.
      setSua((s) =>
        Object.fromEntries(
          Object.entries(s).filter(([id]) => hong.has(nguoi.get(id)?.code ?? null)),
        ),
      )
      setBao(
        r.loi.length
          ? {
              ok: false,
              text: `Đã lưu ${r.o} ô của ${r.nguoi} người; ${hong.size} người chưa lưu được: ${r.loi[0].ma} — ${r.loi[0].loi}`,
            }
          : { ok: true, text: `Đã lưu ${r.o} ô của ${r.nguoi} người` },
      )
      router.refresh()
    } catch (e) {
      setBao({ ok: false, text: `Chưa lưu được: ${apiErrorText(e)}` })
    } finally {
      setLuuDang(false)
    }
  }

  return {
    dangSua,
    /** Bật / tắt chế độ sửa. Còn chữ chưa lưu thì không tắt — nói lý do. */
    batSua: () => {
      if (dangSua && coChu) {
        setBao({
          ok: false,
          text: `Còn ${tong.o + tong.loi.length} ô chưa lưu — Lưu hoặc Bỏ thay đổi trước`,
        })
        return
      }
      setDangSua(!dangSua)
      setBao(null)
    },
    sua,
    tong,
    coChu,
    datO,
    traO,
    dan,
    toi,
    luu,
    luuDang,
    boHet: () => {
      setSua({})
      setBao(null)
    },
  } as const
}

export type SuaCtx = ReturnType<typeof useSuaBang>
