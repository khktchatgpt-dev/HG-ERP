'use client'

import { Btn, Empty, NoticeBar, Sheet, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { MayTomTat } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { KyCongCtx } from './useKyCong'
import { dmy } from './ky-cong.shared'
import { luc, so } from './cham-cong.shared'

/** Từ mức này coi là "sắp đầy" — máy .203 89% đo 12/10/2026, ~3.500 lượt/tháng. */
const SAP_DAY = 85

const pct = (m: MayTomTat) =>
  m.luot != null && m.sucChua ? Math.round((m.luot / m.sucChua) * 100) : null

/**
 * NGĂN KÉO MÁY CHẤM CÔNG — phần thiết lập ít dùng, mở từ ⋯ (bản vẽ vòng 3): tình
 * trạng từng máy, kiểm kết nối, lịch sử các lần lấy (ai, lúc nào, khoảng nào).
 */
export function NganMay({ d }: { d: KyCongCtx }) {
  const may = d.k.du.may
  const c = 'border-b border-[var(--line-faint)]/40 px-2 py-1 whitespace-nowrap'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
  )
  const r = { textAlign: 'right' as const }
  const l = { textAlign: 'left' as const }
  return (
    <Sheet
      open={d.ngan === 'may'}
      onClose={() => d.setNgan(null)}
      title="Máy chấm công"
      subtitle="Chỉ đọc qua mạng xưởng (192.168.1.x) — không xoá, không sửa gì trên máy"
      stakes="nhe"
      width={680}
    >
      <div className="grid gap-3">
        <div className="flex">
          <Btn icon="lamMoi" busy={d.dangKiem} onClick={d.kiemMay}>
            {d.dangKiem ? 'Đang kiểm…' : 'Kiểm kết nối'}
          </Btn>
        </div>
        {may
          .filter((m) => (pct(m) ?? 0) >= SAP_DAY)
          .map((m) => (
            <NoticeBar key={m.id} tone="warn" tag={`${m.ten} sắp đầy`}>
              Đã dùng {pct(m)}% bộ nhớ ({so(m.luot!)} / {so(m.sucChua!)} lượt). Chỉ dọn
              log trên máy SAU KHI đã lấy về đủ các tháng cũ.
            </NoticeBar>
          ))}
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={h}>Máy</th>
              <th className={h}>Địa chỉ</th>
              <th className={h}>Lấy lần cuối</th>
              <th className={h} style={r}>
                Lượt / sức chứa
              </th>
              <th className={h}>Tình trạng</th>
            </tr>
          </thead>
          <tbody>
            {may.map((m) => {
              const p = pct(m)
              return (
                <tr key={m.id}>
                  <td
                    className={cn(c, 'font-semibold')}
                    title={m.serial ? `Serial ${m.serial}` : undefined}
                  >
                    {m.ten}
                  </td>
                  <td className={cn(c, 'num')} style={l}>
                    {m.ip}
                  </td>
                  <td className={cn(c, 'num')} style={l}>
                    {luc(m.keoLuc)}
                  </td>
                  <td
                    className={cn(
                      c,
                      'num',
                      p != null && p >= SAP_DAY && 'font-semibold text-[var(--warn)]',
                    )}
                  >
                    {m.luot != null && m.sucChua != null
                      ? `${so(m.luot)} / ${so(m.sucChua)}`
                      : '—'}
                  </td>
                  <td className={cn(c, 'whitespace-normal')}>
                    {m.loi ? (
                      <span title={m.loi}>
                        <Tag tone="stop">Lần trước lỗi</Tag>{' '}
                        <span className="text-[var(--ink-2)]">{m.loi}</span>
                      </span>
                    ) : m.keoLuc || m.luot != null ? (
                      p != null && p >= SAP_DAY ? (
                        <Tag tone="warn">Sắp đầy</Tag>
                      ) : (
                        <Tag tone="done">Kết nối được</Tag>
                      )
                    ) : (
                      <Tag>Chưa kiểm</Tag>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <h3 className="text-k-body font-semibold">Lịch sử lấy dữ liệu</h3>
        {d.k.lanLay.length === 0 ? (
          <Empty
            level={4}
            headline="Chưa có lần lấy nào được ghi lại"
            reason="Lịch sử bắt đầu ghi từ 12/10/2026 — lần lấy trước đó không có ở đây."
            next="Lấy về ở bước ① Dữ liệu; mỗi lần lấy ghi một dòng cho mỗi máy."
          />
        ) : (
          <table className="text-k-sm w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={h}>Lúc</th>
                <th className={h}>Người</th>
                <th className={h}>Khoảng</th>
                <th className={h}>Máy</th>
                <th className={h} style={r}>
                  Trong khoảng
                </th>
                <th className={h} style={r}>
                  Mới
                </th>
                <th className={h}>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {d.k.lanLay.map((x) => (
                <tr key={x.id}>
                  <td className={cn(c, 'num')} style={l}>
                    {luc(x.batDau)}
                  </td>
                  <td className={c}>{x.nguoi ?? '—'}</td>
                  <td className={cn(c, 'num')} style={l}>
                    {dmy(x.tu)} → {dmy(x.den)}
                  </td>
                  <td className={c}>{x.may}</td>
                  <td className={cn(c, 'num')}>
                    {x.luotTrongKhoang != null ? so(x.luotTrongKhoang) : '—'}
                  </td>
                  <td className={cn(c, 'num')}>
                    {x.luotMoi != null ? so(x.luotMoi) : '—'}
                  </td>
                  <td className={cn(c, 'whitespace-normal')}>
                    {x.ok ? (
                      <Tag tone="done">Xong</Tag>
                    ) : (
                      <span title={x.loi ?? undefined}>
                        <Tag tone="stop">Lỗi</Tag>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-k-sm text-[var(--ink-3)]">
          Khi app chạy trên Vercel cần một cầu nối nhỏ trên máy tính ở xưởng — làm ở bước
          riêng. Lịch sử bày 60 lần gần nhất.
        </p>
      </div>
    </Sheet>
  )
}
