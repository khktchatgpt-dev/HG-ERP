'use client'

import { useState } from 'react'
import { Empty, SearchInput, Timeline, type Mark } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { KyCongCtx } from './useKyCong'
import { so } from './ky.shared'
import { TD, TH } from './ngan-to'

const R = { textAlign: 'right' as const }

export function NganNguoi({ d }: { d: KyCongCtx }) {
  const { k } = d
  const [tim, setTim] = useState('')
  const q = tim.trim().toLowerCase()
  const ds = k.nguoi
    .filter(
      (n) => !q || n.ma.toLowerCase().includes(q) || n.ten.toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        a.to.localeCompare(b.to, 'vi') ||
        a.ma.localeCompare(b.ma, 'vi', { numeric: true }),
    )
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <SearchInput
          value={tim}
          onChange={setTim}
          placeholder="Tìm mã, tên"
          width={200}
          label="Tìm người"
        />
        <span className="text-k-sm text-[var(--ink-3)]">
          {ds.length} / {k.nguoi.length} người · bấm tên để mở Bảng công của người đó
        </span>
      </div>
      <div className="min-h-0 overflow-auto">
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Mã</th>
              <th className={TH}>Họ tên</th>
              <th className={TH}>Tổ</th>
              <th className={TH} style={R}>
                Tổng giờ
              </th>
              <th className={TH} style={R}>
                Công
              </th>
              <th className={TH} style={R}>
                Thiếu lượt
              </th>
            </tr>
          </thead>
          <tbody>
            {ds.map((n) => (
              <tr key={n.ma}>
                <td
                  className={cn(TD, 'num text-[var(--ink-3)]')}
                  style={{ textAlign: 'left' }}
                >
                  {n.ma}
                </td>
                <td className={TD}>
                  <a
                    className="text-[var(--act-text)] hover:underline"
                    href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.ma)}?thang=${k.thang}`}
                  >
                    {n.ten}
                  </a>
                </td>
                <td className={cn(TD, 'text-[var(--ink-2)]')}>{n.to}</td>
                <td className={cn(TD, 'num')} style={R}>
                  {so(n.phut / 60, 2)}
                </td>
                <td className={cn(TD, 'num font-semibold')} style={R}>
                  {so(n.cong, 2)}
                </td>
                <td
                  className={cn(TD, 'num', n.thieu && 'font-semibold text-[var(--stop)]')}
                  style={R}
                >
                  {n.thieu || ''}
                </td>
              </tr>
            ))}
            {!q &&
              k.khongCham.map((n) => (
                <tr key={`kc-${n.ma}`} className="text-[var(--ink-3)]">
                  <td className={cn(TD, 'num')} style={{ textAlign: 'left' }}>
                    {n.ma}
                  </td>
                  <td className={TD}>{n.ten}</td>
                  <td className={TD}>{n.to ?? '—'}</td>
                  <td className={TD} colSpan={3}>
                    không chấm công — đủ công theo ngày làm việc của kỳ
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const TEN_VIEC: Record<string, { label: string; tone: Mark['tone'] }> = {
  team_confirm: { label: 'xác nhận', tone: 'done' },
  team_unconfirm: { label: 'bỏ xác nhận', tone: 'warn' },
  close: { label: 'Chốt kỳ', tone: 'done' },
  reopen_request: { label: 'Xin mở lại', tone: 'warn' },
  reopen_withdraw: { label: 'Rút yêu cầu mở lại', tone: 'act' },
  reopen_approve: { label: 'Kế toán trưởng duyệt mở lại', tone: 'warn' },
  reopen_reject: { label: 'Kế toán trưởng từ chối mở lại', tone: 'stop' },
  set_range: { label: 'Đặt khoảng kỳ', tone: 'act' },
}

const dmTl = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

export function NganThoiGian({ d }: { d: KyCongCtx }) {
  const { k } = d
  if (!k.suKien.length)
    return (
      <Empty
        headline="Kỳ này chưa có việc gì được ghi"
        reason="Dòng thời gian bắt đầu từ lần xác nhận tổ đầu tiên — kỳ còn tính sống từ lượt máy."
        next="Xác nhận tổ ở mục Theo tổ khi kỳ đã hết."
      />
    )
  const marks: Mark[] = k.suKien.map((e, i) => {
    const v = TEN_VIEC[e.viec] ?? { label: e.viec, tone: 'act' as const }
    const data = e.data as {
      cong?: number
      nguoi?: number
      ngay0?: number
      lan?: number
      tu?: string
      den?: string
      tu_cu?: string
      den_cu?: string
    }
    const chiTiet = [
      data.tu && data.den
        ? `${dmTl(data.tu_cu)} → ${dmTl(data.den_cu)} thành ${dmTl(data.tu)} → ${dmTl(data.den)}`
        : '',
      e.ghiChu,
      data.lan ? `lần ${data.lan}` : '',
      data.nguoi != null ? `${data.nguoi} người` : '',
      data.cong != null ? `${so(data.cong, 2)} công` : '',
      data.ngay0 ? `${data.ngay0} ngày tính 0 giờ` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    return {
      key: `${i}-${e.luc}`,
      at: e.luc,
      label: e.to ? `${e.to} ${v.label}` : v.label,
      actor: e.boi,
      detail: chiTiet || null,
      tone: v.tone,
    }
  })
  return (
    <div className="min-h-0 overflow-auto px-[var(--gutter)] py-3">
      <Timeline marks={marks} />
    </div>
  )
}
