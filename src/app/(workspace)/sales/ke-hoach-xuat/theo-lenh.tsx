'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { tinhTrang, type LenhXuat, type TinhTrang } from '@/lib/ke-hoach-xuat'
import { Nhan, NUM, Panel, TD, TH, ToolBtn, type Tone } from '../_erp/ui'

const usd = (v: number | null) => (v == null ? '' : Math.round(v).toLocaleString('vi-VN'))
const so = (v: number) => (v ? v.toLocaleString('vi-VN') : '')
const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—'

/** Tình trạng một LỆNH trên danh sách: chưa chia > cần để ý > xong > bình thường. */
function ttLenh(l: LenhXuat, today: string): { tone: Tone; text: string; deY: number } {
  const deY = l.dots.filter((d) => tinhTrang(d, today).canDeY).length
  if (l.lsx_status === 'completed')
    return { tone: 'done', text: 'Lệnh đã hoàn thành', deY: 0 }
  if (l.chua_chia) return { tone: 'warn', text: 'Chưa chia đợt theo PO', deY }
  if (deY) return { tone: 'warn', text: `${deY} đợt cần để ý`, deY }
  if (l.muon) return { tone: 'warn', text: `${l.muon} đợt chưa có ngày`, deY }
  return { tone: 'neutral', text: 'Đủ kế hoạch', deY }
}

/**
 * KẾ HOẠCH XUẤT THEO LỆNH (06/10/2026) — chủ dự án: "thực tế sale lên kế hoạch
 * xuất hàng cho các lệnh sản xuất". Chép đúng sổ Excel của Sale (ảnh IBIZA):
 * mỗi lệnh = các PO khách (hàng) × SP (cột), ngày Factory Ship Date mỗi PO,
 * dòng TỔNG SỐ CÁI mỗi SP. Trên hệ thống = nhóm lệnh × dòng lệnh, nên chia đợt /
 * sửa ngày làm ở màn dòng lệnh (`/sales/lsx/[id]/dong`) — màn này đọc + chỉ chỗ.
 *
 * Master–detail kiểu ERP: lưới LỆNH trên (chọn một dòng) → lưới KẾ HOẠCH của
 * lệnh đó dưới, cột SP cuộn ngang, ghim # · PO · Ngày xuất.
 */
export function TheoLenh({ lenhs, today }: { lenhs: LenhXuat[]; today: string }) {
  const tts = useMemo(
    () => new Map(lenhs.map((l) => [l.lsx_id, ttLenh(l, today)])),
    [lenhs, today],
  )
  const [chon, setChon] = useState<string | null>(null)
  const sel = lenhs.find((l) => l.lsx_id === chon) ?? lenhs[0] ?? null

  return (
    <div className="space-y-4">
      <Panel
        label="Lệnh sản xuất"
        title="Lệnh sản xuất"
        count={lenhs.length}
        note="Chọn một lệnh để xem kế hoạch xuất của nó bên dưới"
      >
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className={TH}>Lệnh SX</th>
                <th className={TH}>Khách</th>
                <th className={TH}>Ngày giao khách</th>
                <th className={`${TH} text-right`}>Số đợt</th>
                <th className={`${TH} text-right`}>SL (cái)</th>
                <th className={`${TH} text-right`}>Trị giá USD</th>
                <th className={TH}>Vật tư</th>
                <th className={TH}>Kế hoạch xuất</th>
              </tr>
            </thead>
            <tbody>
              {lenhs.map((l) => {
                const on = sel?.lsx_id === l.lsx_id
                const t = tts.get(l.lsx_id)!
                return (
                  <tr
                    key={l.lsx_id}
                    onClick={() => setChon(l.lsx_id)}
                    aria-selected={on}
                    className={`cursor-pointer ${on ? 'bg-[var(--accent)]' : 'hover:bg-muted'}`}
                  >
                    <td
                      className={`${TD} font-mono whitespace-nowrap ${on ? 'border-l-2 border-l-[var(--primary)] font-semibold' : 'border-l-2 border-l-transparent'}`}
                    >
                      {l.lsx_code}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{l.customer}</td>
                    <td className={`${TD} font-mono whitespace-nowrap tabular-nums`}>
                      {ngay(l.ship_date)}
                    </td>
                    <td className={`${TD} ${NUM}`}>
                      {l.dots.length}
                      {l.muon > 0 && (
                        <span
                          className="ml-1 text-[var(--warn)]"
                          title="Đợt chưa có ngày riêng"
                        >
                          ({l.muon}*)
                        </span>
                      )}
                    </td>
                    <td className={`${TD} ${NUM}`}>
                      {so(l.sps.reduce((s, x) => s + x.qty, 0))}
                    </td>
                    <td className={`${TD} ${NUM} font-semibold`}>{usd(l.value)}</td>
                    <td className={`${TD} text-muted-foreground whitespace-nowrap`}>
                      {l.vt.po_total === 0
                        ? 'chưa có đơn mua'
                        : l.vt.po_open === 0
                          ? `đủ · ${l.vt.po_total} đơn`
                          : `${l.vt.po_open}/${l.vt.po_total} đơn chưa về đủ`}
                    </td>
                    <td className={TD}>
                      <Nhan tone={t.tone}>{t.text}</Nhan>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {sel && <KeHoachMotLenh l={sel} today={today} />}
    </div>
  )
}

/** Lưới kế hoạch của MỘT lệnh: đợt (PO) × SP — như sổ Excel của Sale. */
function KeHoachMotLenh({ l, today }: { l: LenhXuat; today: string }) {
  const tong = (k: string) => l.dots.reduce((s, d) => s + (d.sl[k] ?? 0), 0)
  const lech = l.sps.filter((sp) => tong(sp.key) !== sp.qty)
  const tts = new Map<string, TinhTrang>(l.dots.map((d) => [d.id, tinhTrang(d, today)]))
  // Ghim 3 cột trái: # (40) · PO / đợt (200) · Ngày xuất (110).
  const pin = (left: number, w: number) => ({ left, minWidth: w, width: w })
  return (
    <Panel
      label={`Kế hoạch xuất của ${l.lsx_code}`}
      title={
        <>
          Kế hoạch xuất · <span className="font-mono">{l.lsx_code}</span> · {l.customer}
        </>
      }
      note={`${l.dots.length} đợt · ${l.sps.length} SP · giao khách ${ngay(l.ship_date)}${l.cont ? ` · ${l.cont}` : ''}`}
      actions={
        <>
          <ToolBtn href={`/sales/lsx/${l.lsx_id}`}>Xem lệnh</ToolBtn>
          <ToolBtn href={`/sales/lsx/${l.lsx_id}/dong`} primary>
            Chia đợt / sửa ngày xuất
          </ToolBtn>
        </>
      }
    >
      {l.chua_chia && (
        <div className="text-foreground flex items-start gap-2 border-b border-[var(--warn)]/30 bg-[var(--warn)]/10 px-3 py-2 text-[13px]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" />
          <span>
            <b>Lệnh chưa chia theo PO khách.</b> Cả{' '}
            {so(l.sps.reduce((s, x) => s + x.qty, 0))} cái đang dồn vào một đợt, mượn ngày
            giao cuối {ngay(l.ship_date)}. Chia theo từng PO khách + Factory Ship Date
            (như sổ Excel) ở{' '}
            <Link
              href={`/sales/lsx/${l.lsx_id}/dong`}
              className="text-[var(--primary)] hover:underline"
            >
              dòng lệnh
            </Link>{' '}
            — kế hoạch xuất và lịch tháng tự tách ra đúng ngày.
          </span>
        </div>
      )}
      <div className="max-h-[520px] overflow-auto">
        <table className="border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${TH} sticky z-30 border-r text-right`} style={pin(0, 40)}>
                #
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(40, 200)}>
                PO khách / đợt
              </th>
              <th className={`${TH} sticky z-30 border-r`} style={pin(240, 110)}>
                Ngày xuất
              </th>
              {l.sps.map((sp) => (
                <th
                  key={sp.key}
                  className={`${TH} min-w-[96px] border-r text-right align-bottom whitespace-normal`}
                  title={sp.name ?? sp.code}
                >
                  <span className="text-foreground block font-mono text-[11px] font-semibold">
                    {sp.code}
                  </span>
                  <span className="block max-w-[120px] truncate text-[11px] font-normal">
                    {sp.name}
                  </span>
                </th>
              ))}
              <th className={`${TH} border-r text-right`}>Trị giá USD</th>
              <th className={TH}>Tình trạng</th>
            </tr>
            <tr>
              <td
                className="border-border sticky z-30 h-8 border-r border-b bg-[var(--accent)] px-3"
                style={pin(0, 40)}
              />
              <td
                colSpan={2}
                className="border-border text-foreground sticky z-30 h-8 border-r border-b bg-[var(--accent)] px-3 text-xs font-bold"
                style={pin(40, 310)}
              >
                TỔNG SỐ CÁI
              </td>
              {l.sps.map((sp) => (
                <td
                  key={sp.key}
                  className={`border-border h-8 border-r border-b bg-[var(--accent)] px-3 ${NUM} text-[14px] font-bold ${tong(sp.key) !== sp.qty ? 'text-[var(--stop)]' : 'text-foreground'}`}
                  title={`Lệnh: ${sp.qty.toLocaleString('vi-VN')}`}
                >
                  {so(tong(sp.key))}
                </td>
              ))}
              <td
                className={`border-border h-8 border-r border-b bg-[var(--accent)] px-3 ${NUM} text-[13px] font-bold`}
              >
                {usd(l.value)}
              </td>
              <td className="border-border h-8 border-b bg-[var(--accent)]" />
            </tr>
          </thead>
          <tbody>
            {l.dots.map((d, i) => {
              const t = tts.get(d.id)!
              return (
                <tr key={d.id} className="group">
                  <td
                    className={`${TD} ${NUM} bg-card text-muted-foreground group-hover:bg-muted sticky z-10 border-r text-xs`}
                    style={pin(0, 40)}
                  >
                    {i + 1}
                  </td>
                  <td
                    className={`${TD} bg-card group-hover:bg-muted sticky z-10 truncate border-r font-medium`}
                    style={pin(40, 200)}
                    title={d.label}
                  >
                    {d.label}
                    {d.order_code && d.order_code !== d.label && (
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        {d.order_code}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${TD} bg-card group-hover:bg-muted sticky z-10 border-r font-mono whitespace-nowrap tabular-nums`}
                    style={pin(240, 110)}
                  >
                    {ngay(d.ship_date)}
                    {d.date_src === 'lenh' && (
                      <span
                        className="ml-0.5 text-[var(--warn)]"
                        title="Đợt chưa có ngày riêng — mượn ngày giao cuối của lệnh"
                      >
                        *
                      </span>
                    )}
                  </td>
                  {l.sps.map((sp) => (
                    <td
                      key={sp.key}
                      className={`${TD} ${NUM} group-hover:bg-muted border-r text-[14px] font-semibold`}
                    >
                      {so(d.sl[sp.key] ?? 0)}
                    </td>
                  ))}
                  <td className={`${TD} ${NUM} group-hover:bg-muted border-r`}>
                    {usd(d.value)}
                  </td>
                  <td className={`${TD} group-hover:bg-muted`}>
                    <Nhan tone={t.tone}>{t.text}</Nhan>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-border text-muted-foreground border-t px-3 py-2 text-xs">
        Mỗi hàng là một đợt xuất (nhóm của lệnh, thường một PO khách); mỗi cột một SP của
        lệnh. TỔNG SỐ CÁI cộng các đợt —{' '}
        {lech.length ? (
          <b className="text-[var(--stop)]">
            {lech.length} SP lệch với SL lệnh (tô đỏ, rê chuột xem SL lệnh)
          </b>
        ) : (
          'khớp đúng SL lệnh từng SP'
        )}
        . <b className="text-[var(--warn)]">*</b> = đợt chưa có ngày xuất riêng.
      </p>
    </Panel>
  )
}
