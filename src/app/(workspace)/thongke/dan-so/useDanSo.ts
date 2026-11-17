'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { chuan, docDan, type DongDan } from '@/lib/dan-so'
import type {
  KetQuaGhi,
  TuyChonDanSo,
  XemDanSo,
} from '@/modules/dept/production/dan-so.service'

export type Buoc = 'dan' | 'xem' | 'xong'
export type Loc = 'all' | 'khop' | 'moi' | 'sua'

/** Sửa của người dùng trên một dòng dán: đổi tên (nhận gợi ý) / bỏ ô chữ sai. */
const cumKey = (ma: string | null, cum: string) => `${chuan(ma ?? '')}|${chuan(cum)}`

type Sua = { ten?: string; boO?: string[]; moi?: boolean }

/**
 * State + xử lý của màn Dán sổ Excel. Đọc vùng dán ở client (`lib/dan-so`, thuần),
 * tính xem trước ở server mỗi khi dòng đổi (xem trước và ghi dùng CHUNG một hàm
 * `tinh`, nên số người thấy = số được ghi).
 */
export function useDanSo(opt: TuyChonDanSo) {
  const [lsxId, setLsxId] = useState(opt.lenh[0]?.id ?? '')
  const [lineId, setLineId] = useState('')
  const [stage, setStage] = useState(opt.mac_dinh.stage ?? opt.stages[0]?.code ?? '')
  const [teamId, setTeamId] = useState(opt.mac_dinh.team ?? opt.teams[0]?.id ?? '')
  const [nam, setNam] = useState(opt.nam)
  const [text, setText] = useState('')
  const [buoc, setBuoc] = useState<Buoc>('dan')
  const [sua, setSua] = useState<Record<number, Sua>>({})
  /** Cụm của lệnh người dùng chọn cho (mã SP × chữ cột Cụm của file) — áp cho mọi dòng cùng khoá. */
  const [cumMap, setCumMap] = useState<Record<string, string>>({})
  const [loc, setLoc] = useState<Loc>('all')
  /** Kết quả xem trước + payload nó tính cho — khác payload hiện tại = đang tính lại. */
  const [ketXem, setKetXem] = useState<{ cho: unknown; r: XemDanSo } | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const [dangGhi, setDangGhi] = useState(false)
  const [ketQua, setKetQua] = useState<KetQuaGhi | null>(null)
  const [nhay, setNhay] = useState<number | null>(null)

  const lenh = opt.lenh.find((l) => l.id === lsxId) ?? null
  const doc = useMemo(() => docDan(text, nam), [text, nam])

  /** Dòng đã áp sửa của người dùng; dòng không còn số / ô sai thì bỏ. */
  const rows: DongDan[] = useMemo(
    () =>
      doc.dong
        .map((d) => {
          const s = sua[d.hang]
          const cum_ten = cumMap[cumKey(d.ma_sp, d.cum)]
          if (!s) return cum_ten ? { ...d, cum_ten } : d
          return {
            ...d,
            cum_ten,
            ten: s.ten ?? d.ten,
            them_moi: s.moi,
            sai: d.sai.filter((x) => !s.boO?.includes(x.iso)),
          }
        })
        .filter((d) => Object.keys(d.o).length > 0 || d.sai.length > 0),
    [doc, sua, cumMap],
  )

  const payload = useMemo(
    () => ({
      lsx_id: lsxId,
      line_id: lineId || null,
      stage,
      team_id: teamId,
      cot: doc.cot.map((c) => c.iso),
      rows: rows.map((r) => ({
        hang: r.hang,
        cum: r.cum,
        ten: r.ten,
        ma_sp: r.ma_sp,
        ct_sp: r.ct_sp && r.ct_sp > 0 ? r.ct_sp : null,
        dm: r.dm,
        can: r.can,
        o: r.o,
        sai: r.sai,
        them_moi: r.them_moi,
        cum_ten: r.cum_ten,
      })),
    }),
    [lsxId, lineId, stage, teamId, doc.cot, rows],
  )

  const thieu = !lsxId
    ? 'Chọn lệnh'
    : !stage
      ? 'Chọn công đoạn'
      : !teamId
        ? 'Chọn tổ'
        : text.trim() === ''
          ? 'Dán dữ liệu vào ô vàng'
          : !doc.ok
            ? (doc.loi[0] ?? 'Chưa đọc được vùng dán')
            : null

  // Xem trước: tính lại mỗi khi dòng / lệnh / tổ / công đoạn đổi.
  useEffect(() => {
    if (buoc !== 'xem') return
    let huy = false
    api<XemDanSo>('/api/dept/production/dan-so', {
      method: 'POST',
      body: { mode: 'xem', data: payload },
    })
      .then((r) => {
        if (huy) return
        setKetXem({ cho: payload, r })
        setLoi(null)
      })
      .catch((e) => {
        if (!huy) setLoi(apiErrorText(e, 'Không tính được xem trước'))
      })
    return () => {
      huy = true
    }
  }, [buoc, payload])

  const xem = ketXem?.r ?? null
  const dangTinh = buoc === 'xem' && ketXem?.cho !== payload

  const doiDauVao = (f: () => void) => {
    f()
    setSua({})
    setCumMap({})
    setKetXem(null)
    if (buoc !== 'dan') setBuoc('dan')
  }

  /** Dòng đã ghép số xem trước (cùng thứ tự `rows`). */
  const ghep = rows.map((r, i) => ({ r, x: xem?.dong[i] ?? null }))
  const dem = {
    all: ghep.length,
    khop: ghep.filter((g) => g.x && g.x.kieu === 'khop' && g.x.van_de.length === 0)
      .length,
    moi: ghep.filter((g) => g.x?.kieu === 'moi').length,
    sua: ghep.filter((g) => g.x && g.x.van_de.length > 0).length,
  }
  const hien = ghep.filter(
    (g) =>
      loc === 'all' ||
      (loc === 'khop' && g.x?.kieu === 'khop' && g.x.van_de.length === 0) ||
      (loc === 'moi' && g.x?.kieu === 'moi') ||
      (loc === 'sua' && g.x != null && g.x.van_de.length > 0),
  )

  const chan: { hang: number; text: string }[] = []
  for (const g of ghep) {
    if (g.x && g.x.van_de.length > 0)
      chan.push({ hang: g.r.hang, text: `${g.r.ten}: ${g.x.van_de[0]}` })
  }
  for (const c of xem?.cot_loi ?? []) {
    chan.push({ hang: 0, text: `Cột ${c.iso.slice(8)}/${c.iso.slice(5, 7)}: ${c.loi}` })
  }
  const khongCoGi = xem != null && xem.tom_tat.o_ghi === 0 && xem.tom_tat.moi === 0
  const whyGhi = dangTinh
    ? 'Đang tính…'
    : !xem
      ? 'Đang tính xem trước…'
      : chan.length > 0
        ? `Còn ${chan.length} chỗ cần sửa`
        : khongCoGi
          ? 'Không có ô nào mới để ghi'
          : null

  const xemTruoc = () => {
    setLoi(null)
    setLoc('all')
    setBuoc('xem')
  }
  const chonCum = (ma: string | null, cum: string, ten: string) =>
    setCumMap((m) => ({ ...m, [cumKey(ma, cum)]: ten }))
  const themMoi = (hang: number) =>
    setSua((s) => ({ ...s, [hang]: { ...s[hang], moi: true } }))
  const nhanGoiY = (hang: number, ten: string) =>
    setSua((s) => ({ ...s, [hang]: { ...s[hang], ten } }))
  const boO = (hang: number, iso: string) =>
    setSua((s) => ({ ...s, [hang]: { ...s[hang], boO: [...(s[hang]?.boO ?? []), iso] } }))
  const nhayToi = (hang: number) => {
    setLoc('all')
    setNhay(hang)
    window.setTimeout(() => setNhay(null), 1600)
  }
  const ghi = async () => {
    if (whyGhi) return
    setDangGhi(true)
    setLoi(null)
    try {
      const r = await api<KetQuaGhi>('/api/dept/production/dan-so', {
        method: 'POST',
        body: { mode: 'ghi', data: payload },
      })
      setKetQua(r)
      setBuoc('xong')
    } catch (e) {
      setLoi(apiErrorText(e, 'Không ghi được'))
    } finally {
      setDangGhi(false)
    }
  }
  const lamLai = () => {
    setText('')
    setSua({})
    setCumMap({})
    setKetXem(null)
    setKetQua(null)
    setBuoc('dan')
  }

  return {
    opt,
    lenh,
    lsxId,
    lineId,
    stage,
    teamId,
    nam,
    text,
    buoc,
    loc,
    xem,
    dangTinh,
    loi,
    dangGhi,
    ketQua,
    nhay,
    doc,
    rows,
    ghep,
    hien,
    dem,
    chan,
    thieu,
    whyGhi,
    setText,
    setLoc,
    chonLenh: (v: string) =>
      doiDauVao(() => {
        setLsxId(v)
        setLineId('')
      }),
    chonDong: (v: string) => doiDauVao(() => setLineId(v)),
    chonCD: (v: string) => doiDauVao(() => setStage(v)),
    chonTo: (v: string) => doiDauVao(() => setTeamId(v)),
    chonNam: (v: number) => doiDauVao(() => setNam(v)),
    xemTruoc,
    nhanGoiY,
    themMoi,
    chonCum,
    boO,
    nhayToi,
    ghi,
    lamLai,
  } as const
}

export type DanSoCtx = ReturnType<typeof useDanSo>
