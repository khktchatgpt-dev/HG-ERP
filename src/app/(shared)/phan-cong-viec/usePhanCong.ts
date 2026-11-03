'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  GIVEN_FILTERS,
  matchesGiven,
  matchesMine,
  MINE_FILTERS,
  type GivenFilter,
  type MineFilter,
} from '@/lib/task-flow'
import type { GivenBoard, MineBoard } from '@/modules/workflow/tasks/tasks.service'
import {
  ASSIGN_BLOCKED,
  khopTim,
  NUT,
  nhanNut,
  vuong,
  type Muc,
  type NutA,
  type Viec,
} from './pc-viec'

/** Việc chuông vừa mở (`?viec=`): mục + bộ lọc đang chứa nó. */
export type PhanCongFocus =
  | { id: string; muc: 'cua-toi'; filter: MineFilter }
  | { id: string; muc: 'giao'; filter: GivenFilter }

/** Bước cần gõ một câu trước khi gửi — ô gõ hiện trong ngăn phải. */
export type Buoc = 'submit' | 'reject' | 'cancel'

/** Báo dưới Action Pane: lý do nút khoá, hoặc kết quả vừa ghi. */
export type Bao = { text: string; ok?: boolean; moId?: string } | null

/**
 * TOÀN BỘ STATE + XỬ LÝ của trang Phân công việc bản 3. Màn chỉ vẽ.
 *
 * Q1: nút việc nằm ở Action Pane và áp cho DÒNG ĐANG CHỌN. Q2: luôn có một dòng được
 * chọn (dòng đầu sau lọc) để ngăn phải không bao giờ trống khi lưới có việc.
 */
export function usePhanCong({
  board,
  mine,
  today,
  focus,
}: {
  board: GivenBoard | null
  mine: MineBoard
  today: string
  focus: PhanCongFocus | null
}) {
  const router = useRouter()
  const canGive = board !== null
  const [muc, setMucState] = useState<Muc>(focus?.muc ?? (canGive ? 'giao' : 'cua-toi'))
  const tab: Muc = canGive ? muc : 'cua-toi'
  const [locMine, setLocMine] = useState<MineFilter>(
    focus?.muc === 'cua-toi'
      ? focus.filter
      : mine.summary.doing > 0 || mine.summary.waiting === 0
        ? 'doing'
        : 'waiting',
  )
  const [locGiao, setLocGiao] = useState<GivenFilter>(
    focus?.muc === 'giao'
      ? focus.filter
      : (board?.summary.to_approve ?? 0) > 0
        ? 'to_approve'
        : 'open',
  )
  const [q, setQ] = useState('')
  const [phong, setPhong] = useState('')
  const [chonId, setChonId] = useState<string | null>(focus?.id ?? null)
  // Ngăn phải đang là phiếu: giao việc mới, hoặc sửa việc đang chọn. null = chi tiết.
  const [phieu, setPhieu] = useState<'giao' | 'sua' | null>(null)
  const giaoMo = phieu !== null
  const setGiaoMo = (mo: boolean) => setPhieu(mo ? 'giao' : null)
  const [buoc, setBuoc] = useState<Buoc | null>(null)
  const [cau, setCau] = useState('')
  const [busy, setBusy] = useState(false)
  const [bao, setBao] = useState<Bao>(null)

  const items: Viec[] = tab === 'giao' ? (board?.items ?? []) : mine.items
  const rows = items
    .filter((t) =>
      tab === 'giao' ? matchesGiven(t, locGiao, today) : matchesMine(t, locMine, today),
    )
    .filter((t) => khopTim(t, q))
    .filter((t) => !phong || t.department_name === phong)
  const chon = rows.find((t) => t.id === chonId) ?? rows[0] ?? null
  const phongs = [
    ...new Set(items.map((t) => t.department_name).filter(Boolean)),
  ] as string[]

  function datMuc(m: Muc) {
    setMucState(m)
    setChonId(null)
    setPhong('')
    huyBuoc()
    setBao(null)
  }

  function chonDong(id: string) {
    setChonId(id)
    setGiaoMo(false)
    huyBuoc()
    setBao(null)
  }

  function huyBuoc() {
    setBuoc(null)
    setCau('')
  }

  function moGiao() {
    if (!canGive) return setBao({ text: ASSIGN_BLOCKED })
    setBao(null)
    huyBuoc()
    setGiaoMo(true)
  }

  async function ghi(path: string, body: unknown, xong: string) {
    if (!chon || busy) return
    setBusy(true)
    try {
      await api(`/api/tasks/${chon.id}/${path}`, { method: 'POST', body })
      huyBuoc()
      setBao({ text: xong, ok: true })
      router.refresh()
    } catch (e) {
      setBao({ text: apiErrorText(e, 'Chưa ghi được — thử lại') })
    } finally {
      setBusy(false)
    }
  }

  /** Bấm một nút Action Pane. Nút khoá vẫn bấm được: nói vướng gì ngay dưới thanh. */
  function bam(a: NutA, label: string) {
    const why = vuong(a, label, chon)
    if (why) return setBao({ text: why })
    setBao(null)
    setGiaoMo(false)
    if (!chon) return
    if (a === 'edit') {
      huyBuoc()
      return setPhieu('sua')
    }
    const ma = chon.task_code ?? 'việc'
    if (a === 'start')
      return void ghi('status', { status: 'in_progress' }, `Đã bắt đầu ${ma}.`)
    if (a === 'approve') return void ghi('approve', {}, `Đã duyệt Đạt ${ma}.`)
    if (a === 'restore') return void ghi('status', { status: 'todo' }, `Đã mở lại ${ma}.`)
    // submit / reject / cancel: gõ một câu (hoặc xác nhận) ở ngăn phải trước khi gửi.
    setBuoc(a as Buoc)
    setCau('')
  }

  function guiBuoc() {
    if (!chon || !buoc) return
    const ma = chon.task_code ?? 'việc'
    if (buoc === 'cancel')
      return void ghi('status', { status: 'cancelled' }, `Đã huỷ ${ma}.`)
    if (!cau.trim()) return
    if (buoc === 'submit') return void ghi('submit', { result: cau.trim() }, `Đã báo hoàn thành ${ma}.`) // prettier-ignore
    return void ghi('reject', { reason: cau.trim() }, `Đã trả lại ${ma}.`)
  }

  const nut = NUT[tab].map((n) => ({
    ...n,
    label: nhanNut(n.a, n.label, chon),
    khoa: vuong(n.a, n.label, chon) !== null,
  }))

  const dem = {
    mine: { n: mine.summary.doing, tre: mine.summary.overdue },
    giao: board ? { n: board.summary.open, cho: board.summary.to_approve } : null,
  }

  return {
    canGive,
    tab,
    datMuc,
    locMine,
    setLocMine: (f: MineFilter) => (setLocMine(f), setChonId(null)),
    locGiao,
    setLocGiao: (f: GivenFilter) => (setLocGiao(f), setChonId(null)),
    MINE_FILTERS,
    GIVEN_FILTERS,
    q,
    setQ,
    phong,
    setPhong,
    phongs,
    rows,
    chon,
    chonDong,
    giaoMo,
    phieu,
    moGiao,
    sauSua: (ma: string, changes: string[]) => {
      setPhieu(null)
      setBao(
        changes.length > 0
          ? {
              text: `Đã sửa ${ma}: ${changes.join(' · ')}. Người nhận được báo.`,
              ok: true,
            }
          : { text: 'Không có gì thay đổi.', ok: true },
      )
      router.refresh()
    },
    dongGiao: () => setGiaoMo(false),
    sauGiao: (id: string, ten: string, loiTep: string[]) => {
      setGiaoMo(false)
      setLocGiao('open')
      setChonId(id)
      setBao(
        loiTep.length > 0
          ? { text: `Đã giao cho ${ten}, nhưng ${loiTep.length} tệp chưa lên được: ${loiTep.join(', ')} — thêm lại ở ngăn phải.`, moId: id } // prettier-ignore
          : { text: `Đã giao cho ${ten}.`, ok: true },
      )
      router.refresh()
    },
    nut,
    bam,
    buoc,
    cau,
    setCau,
    huyBuoc,
    guiBuoc,
    busy,
    bao,
    tatBao: () => setBao(null),
    dem,
    refresh: () => router.refresh(),
  } as const
}

export type PhanCongCtx = ReturnType<typeof usePhanCong>
