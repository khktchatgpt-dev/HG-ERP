'use client'

import { Btn, Empty, Timeline, type Mark } from '@/components/kit'
import { cn } from '@/lib/utils'
import { tranBh } from '@/lib/luong/tinh-luong'
import type { BangLuongCtx } from './useBangLuong'
import { R, so, TD, TF, TH, tong } from './bang-luong.shared'

export function NganBhThue({ d }: { d: BangLuongCtx }) {
  const ps = d.b.phieu
  const nld = tong(ps, (p) => p.bhNld)
  const coSo = Math.round(nld / 0.105)
  const dong = [
    { ten: 'BHXH · BHYT · BHTN người lao động', tl: '10,5 %', tien: nld },
    {
      ten: 'BHXH · BHYT · BHTN doanh nghiệp',
      tl: '21,5 %',
      tien: tong(ps, (p) => p.bhDn),
    },
    { ten: 'Đoàn phí người lao động', tl: '0,5 %', tien: tong(ps, (p) => p.doanPhi) },
    { ten: 'Kinh phí công đoàn', tl: '2 %', tien: tong(ps, (p) => p.kpcd) },
  ]
  const chuaTru = ps.some((p) => !p.truThue && p.thue > 0)
  const nopThue = ps.filter((p) => p.thue > 0)
  return (
    <div className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Khoản</th>
            <th className={TH} style={R}>
              Cơ sở (lương đóng BH)
            </th>
            <th className={TH} style={R}>
              Tỷ lệ
            </th>
            <th className={TH} style={R}>
              Tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {dong.map((x) => (
            <tr key={x.ten}>
              <td className={TD}>{x.ten}</td>
              <td className={cn(TD, 'num')} style={R}>
                {so(coSo)}
              </td>
              <td className={cn(TD, 'num')} style={R}>
                {x.tl}
              </td>
              <td className={cn(TD, 'num')} style={R}>
                {so(x.tien)}
              </td>
            </tr>
          ))}
          <tr>
            <td className={TD}>
              Thuế TNCN{' '}
              {chuaTru
                ? 'tính được — CHƯA trừ trên bảng (Kế toán chưa khấu trừ)'
                : 'khấu trừ'}{' '}
              ({nopThue.length} người)
            </td>
            <td className={TD} />
            <td className={TD} />
            <td className={cn(TD, 'num')} style={R}>
              {so(tong(ps, (p) => p.thue))}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={4}
              className={cn(TF, 'font-normal whitespace-normal text-[var(--ink-3)]')}
            >
              Trần lương đóng BHXH kỳ này {so(tranBh(d.b.thang))} đ/người. Tiền tăng ca
              miễn thuế toàn bộ; giảm trừ bản thân 15,5 triệu, người phụ thuộc 6,2 triệu;
              biểu luỹ tiến 5 bậc (5 · 10 · 20 · 30 · 35 %). Kế toán rà lại số luật trước
              kỳ đầu.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function NganChuyenKhoan({ d }: { d: BangLuongCtx }) {
  const ps = d.b.phieu.filter((p) => p.thucLinh > 0)
  const nh = new Map<string, { so: number; tien: number }>()
  for (const p of ps) {
    const k = p.nganHang ?? '(chưa có ngân hàng)'
    const x = nh.get(k) ?? { so: 0, tien: 0 }
    nh.set(k, { so: x.so + 1, tien: x.tien + p.thucLinh })
  }
  const thieu = ps.filter((p) => !p.stk).length
  return (
    <div className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      <div className="text-k-sm flex items-center gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-2">
        <Btn icon="excel" href={`/api/dept/hr/luong/bang/${d.b.thang}/excel`}>
          Xuất file chuyển khoản
        </Btn>
        <span className="text-[var(--ink-3)]">
          tờ “Chuyển khoản” cùng cột với DS chuyển lương đang dùng
          {d.tt !== 'approved' && d.tt !== 'paid'
            ? ' · bảng chưa duyệt — file chỉ để đối chiếu'
            : ''}
          {thieu ? ` · ${thieu} người thiếu STK` : ''}
        </span>
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Ngân hàng</th>
            <th className={TH} style={R}>
              Người
            </th>
            <th className={TH} style={R}>
              Số tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {[...nh]
            .sort((a, b) => b[1].tien - a[1].tien)
            .map(([k, v]) => (
              <tr key={k}>
                <td className={TD}>{k}</td>
                <td className={cn(TD, 'num')} style={R}>
                  {v.so}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {so(v.tien)}
                </td>
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={TF}>Cộng</td>
            <td className={cn(TF, 'num')} style={R}>
              {ps.length}
            </td>
            <td className={cn(TF, 'num')} style={R}>
              {so(tong(ps, (p) => p.thucLinh))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const VIEC: Record<string, { ten: string; tone: Mark['tone'] }> = {
  calculate: { ten: 'Tính bảng lương', tone: 'act' },
  submit: { ten: 'Gửi Kế toán trưởng duyệt', tone: 'warn' },
  withdraw: { ten: 'Rút về nháp', tone: 'act' },
  approve: { ten: 'Kế toán trưởng duyệt', tone: 'done' },
  return: { ten: 'Kế toán trưởng trả lại', tone: 'stop' },
  reopen: { ten: 'Rút bảng đã duyệt về nháp', tone: 'warn' },
  paid: { ten: 'Đã chi', tone: 'done' },
}

export function NganThoiGian({ d }: { d: BangLuongCtx }) {
  if (!d.b.suKien.length)
    return (
      <Empty
        headline="Chưa có việc gì"
        reason="Dòng thời gian bắt đầu từ lần tính đầu tiên."
        next="Bấm Tính bảng lương."
      />
    )
  const marks: Mark[] = d.b.suKien.map((e, i) => {
    const v = VIEC[e.viec] ?? { ten: e.viec, tone: 'act' as const }
    const dt = e.data as { lan?: number; nguoi?: number; thucLinh?: number }
    return {
      key: `${i}-${e.luc}`,
      at: e.luc,
      label: v.ten,
      // Không người bấm = hệ thống tự tính khi Nhân sự chốt công.
      actor: e.boi ?? (e.viec === 'calculate' ? 'Hệ thống' : null),
      detail:
        [
          e.ghiChu,
          dt.lan ? `lần ${dt.lan}` : '',
          dt.nguoi ? `${dt.nguoi} người` : '',
          dt.thucLinh != null ? `thực lĩnh ${so(dt.thucLinh)}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || null,
      tone: v.tone,
    }
  })
  return (
    <div className="min-h-0 overflow-auto px-[var(--gutter)] py-3">
      <Timeline marks={marks} />
    </div>
  )
}
