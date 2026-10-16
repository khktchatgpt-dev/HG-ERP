'use client'

import { Btn, Empty, NoticeBar, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { MayTomTat } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { useKyCong, type KyCongCtx } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { DateInput } from '@/components/kit'
import { dm, dmy, thu, type KyCong } from './ky-cong.shared'
import { luc, so } from './cham-cong.shared'

/** Từ mức này coi là "sắp đầy" — máy .203 89% đo 12/10/2026, ~3.500 lượt/tháng. */
const SAP_DAY = 85

const pct = (m: MayTomTat) =>
  m.luot != null && m.sucChua ? Math.round((m.luot / m.sucChua) * 100) : null

/**
 * TRANG LẤY DỮ LIỆU TỪ MÁY — "đã lấy đủ chưa, máy có ổn không?" (tách trang
 * 17/10/2026). Khoảng lấy + nút Lấy về ở góc phải, dải số lượt từng ngày của kỳ,
 * tình trạng từng máy và lịch sử các lần lấy (trước là ngăn kéo Máy chấm công).
 */
export function LayDuLieuScreen({ k }: { k: KyCong }) {
  const d = useKyCong(k)
  const ngayCo = k.du.theoNgay.filter((n) => Object.keys(n.theoMay).length > 0).length
  const lan = k.lanLay[0]
  return (
    <KhungTrang
      ten="Lấy dữ liệu từ máy"
      thang={k.thang}
      onThang={d.xemThang}
      facts={[{ label: 'Ngày có lượt', value: `${ngayCo}/${k.du.theoNgay.length}` }]}
      actions={
        <Btn
          primary
          icon="lamMoi"
          busy={d.dangLay}
          aria-disabled={!!d.loiKhoang}
          onClick={d.layVe}
        >
          {d.dangLay ? 'Đang đọc máy…' : 'Lấy về từ máy'}
        </Btn>
      }
    >
      <div className="text-k-sm flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
        <span>Lấy từ máy, khoảng</span>
        <DateInput
          label="Lấy từ ngày"
          value={d.tu}
          onChange={d.setTu}
          disabled={d.dangLay}
        />
        <span className="text-[var(--ink-3)]">→</span>
        <DateInput
          label="Lấy đến ngày"
          value={d.den}
          onChange={d.setDen}
          disabled={d.dangLay}
        />
        <span>
          {lan ? (
            <>
              · lần cuối <b className="num text-[var(--ink)]">{luc(lan.batDau)}</b>
              {lan.nguoi && <> · {lan.nguoi}</>} ·{' '}
              <span className="num">
                {dm(lan.tu)} → {dm(lan.den)}
              </span>
            </>
          ) : (
            '· chưa có lần lấy nào được ghi lại'
          )}
        </span>
      </div>

      {d.loiKhoang && (
        <NoticeBar tone="stop" tag="Khoảng ngày">
          {d.loiKhoang}
        </NoticeBar>
      )}
      {d.dangLay && (
        <NoticeBar tone="neutral" tag="Đang đọc máy">
          Máy phải gửi hết log (~1,5 phút cho cả hai máy) rồi ERP mới lọc đúng khoảng{' '}
          {dmy(d.tu)} → {dmy(d.den)}. Đừng đóng trang.
        </NoticeBar>
      )}
      {d.ketQua?.may
        .filter((m) => !m.ok)
        .map((m) => (
          <NoticeBar key={m.ip} tone="stop" tag={m.ten}>
            {m.loi}
          </NoticeBar>
        ))}

      <DaiNgay d={d} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-card)] px-[var(--gutter)] py-3">
        <MayVaLichSu d={d} />
      </div>
    </KhungTrang>
  )
}

/** Dải ngày của kỳ: số lượt máy ghi mỗi ngày. Nét đứt = chưa lấy về hoặc không ai quẹt. */
function DaiNgay({ d }: { d: KyCongCtx }) {
  const ngays = d.k.du.theoNgay
  return (
    <div
      className="grid border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1"
      style={{ gridTemplateColumns: `repeat(${ngays.length}, minmax(0, 1fr))` }}
      aria-label="Số lượt máy ghi mỗi ngày trong kỳ"
    >
      {ngays.map((n) => {
        const tong = Object.values(n.theoMay).reduce((a, b) => a + b, 0)
        const sau = n.ngay > d.k.homNay
        return (
          <div
            key={n.ngay}
            title={`${dm(n.ngay)}: ${
              Object.entries(n.theoMay)
                .map(([m, c]) => `máy ${m} ${c}`)
                .join(' · ') || (sau ? 'chưa tới' : 'chưa có lượt')
            }`}
            className={cn(
              'border-r border-[var(--line-faint)]/40 py-0.5 text-center text-[10px] text-[var(--ink-3)]',
              thu(n.ngay) === 0 && 'bg-[var(--chrome)]/50',
              sau && 'opacity-40',
            )}
          >
            <b
              className="num block text-[11px] text-[var(--ink)]"
              style={{ textAlign: 'center' }}
            >
              {Number(n.ngay.slice(8))}
            </b>
            {tong ? so(tong) : '—'}
            <i
              className={cn(
                'mx-1 mt-0.5 block h-1',
                tong ? 'bg-[var(--done)]' : 'border-t border-dashed border-[var(--line)]',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Tình trạng từng máy + kiểm kết nối + lịch sử các lần lấy. */
function MayVaLichSu({ d }: { d: KyCongCtx }) {
  const k = d.k
  const may = k.du.may
  const c = 'border-b border-[var(--line-faint)]/40 px-2 py-1 whitespace-nowrap'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
  )
  const r = { textAlign: 'right' as const }
  const l = { textAlign: 'left' as const }
  return (
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
            Đã dùng {pct(m)}% bộ nhớ ({so(m.luot!)} / {so(m.sucChua!)} lượt). Chỉ dọn log
            trên máy SAU KHI đã lấy về đủ các tháng cũ.
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
      {k.lanLay.length === 0 ? (
        <Empty
          level={4}
          headline="Chưa có lần lấy nào được ghi lại"
          reason="Lịch sử bắt đầu ghi từ 12/10/2026 — lần lấy trước đó không có ở đây."
          next="Chọn khoảng ngày ở thanh trên rồi bấm “Lấy về từ máy”; mỗi lần lấy ghi một dòng cho mỗi máy."
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
            {k.lanLay.map((x) => (
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
  )
}
