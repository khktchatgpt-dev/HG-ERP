'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { TABS, type DinhMuc, type Payload, type TabKey } from './bao-cao.shared'

/**
 * State màn Báo cáo. Kỳ / tổ đi qua URL (server tính lại) — một địa chỉ là một
 * báo cáo, gửi cho ai cũng mở ra đúng số. Định mức vs thực dùng tải theo lệnh
 * khi mở tab.
 */
export function useBaoCao(p: Payload, initialTab: TabKey | null) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>(
    initialTab && TABS.includes(initialTab) ? initialTab : 'to',
  )
  const [from, setFrom] = useState(p.from)
  const [to, setTo] = useState(p.to)
  const [team, setTeam] = useState<string>('')
  const [loi, setLoi] = useState<string | null>(null)

  const apDung = (f = from, t = to, tm = team) => {
    const q = new URLSearchParams({ from: f, to: t })
    if (tm) q.set('team', tm)
    q.set('tab', tab)
    router.push(`/thongke/bao-cao?${q}`)
  }
  const kyNhanh = (days: number) => {
    const t = p.today
    const d = new Date(`${t}T00:00:00`)
    d.setDate(d.getDate() - (days - 1))
    const f = d.toISOString().slice(0, 10)
    setFrom(f)
    setTo(t)
    apDung(f, t)
  }
  const thangNay = () => {
    const f = `${p.today.slice(0, 7)}-01`
    setFrom(f)
    setTo(p.today)
    apDung(f, p.today)
  }

  // ── Định mức vs thực dùng (theo lệnh, tải khi cần) ───────────────────────
  const [dmLsx, setDmLsx] = useState<string>(p.lsx[0]?.id ?? '')
  const [dm, setDm] = useState<DinhMuc | null>(null)
  const [dmBusy, setDmBusy] = useState(false)
  const taiDinhMuc = async (id = dmLsx) => {
    if (!id) return
    setDmBusy(true)
    setLoi(null)
    try {
      setDm(await api<DinhMuc>(`/api/dept/production/reports?type=dinh-muc&lsx=${id}`))
    } catch (e) {
      setLoi(apiErrorText(e, 'Không tải được định mức'))
    } finally {
      setDmBusy(false)
    }
  }
  const moTab = (t: TabKey) => {
    setTab(t)
    if (t === 'dinh_muc' && !dm && dmLsx) void taiDinhMuc(dmLsx)
  }
  const doiDmLsx = (id: string) => {
    setDmLsx(id)
    void taiDinhMuc(id)
  }

  // Bốn bảng cũ đi `reports` (reports.service); hai bảng mới đi `bao-cao`
  // (cùng payload màn đang bày). Cùng kỳ + tổ với URL.
  const excelHref = (type: 'san-luong' | 'phe' | 'treo' | 'ton') => {
    const ky = `from=${p.from}&to=${p.to}${team ? `&team=${team}` : ''}`
    return type === 'treo' || type === 'ton'
      ? `/api/dept/production/bao-cao?bang=${type}&${ky}`
      : `/api/dept/production/reports?type=${type}&${ky}&format=xlsx`
  }

  return {
    p,
    tab,
    moTab,
    from,
    setFrom,
    to,
    setTo,
    team,
    setTeam,
    apDung,
    kyNhanh,
    thangNay,
    loi,
    setLoi,
    dmLsx,
    doiDmLsx,
    dm,
    dmBusy,
    excelHref,
  } as const
}

export type BaoCaoCtx = ReturnType<typeof useBaoCao>
