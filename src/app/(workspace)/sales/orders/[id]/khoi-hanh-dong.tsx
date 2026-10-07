'use client'

import { shipCapacity } from '@/lib/order-ship-status'
import { TH, TD, NUM } from '../../_erp/ui'
import {
  BTN_PRI,
  BTN_STOP,
  BTN_SUB,
  INPUT,
  TEXTAREA,
  fmtD,
  fmtN,
} from './don-hang.shared'
import type { DonHangCtx } from './useDonHang'

/**
 * KHỐI HÀNH ĐỘNG mở TẠI CHỖ dưới thanh đầu trang (không hộp thoại nổi): ghi
 * xuất một đợt nhiều dòng · xác nhận đã giao · huỷ đơn · phát lệnh. Mỗi khối
 * nói rõ vì sao chưa bấm được (luật kiểm #7) ngay cạnh nút.
 */
export function KhoiHanhDong({ d }: { d: DonHangCtx }) {
  if (!d.panel) return null
  return (
    <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
      {d.panel === 'ship' && <GhiXuat d={d} />}
      {d.panel === 'deliver' && <XacNhanGiao d={d} />}
      {d.panel === 'cancel' && <HuyDon d={d} />}
      {d.panel === 'issue' && <PhatLenh d={d} />}
    </div>
  )
}

function Chan({
  d,
  label,
  blocked,
  onSubmit,
  stop,
}: {
  d: DonHangCtx
  label: string
  blocked: string | null
  onSubmit: () => void
  stop?: boolean
}) {
  const msg = d.err ?? blocked
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={d.busy || !!blocked}
        className={stop ? BTN_STOP : BTN_PRI}
        aria-busy={d.busy}
      >
        {d.busy ? 'Đang ghi…' : label}
      </button>
      <button type="button" onClick={d.close} disabled={d.busy} className={BTN_SUB}>
        Đóng
      </button>
      {msg && (
        <span
          className={`text-xs ${d.err ? 'text-[var(--stop)]' : 'text-[var(--warn)]'}`}
        >
          {msg}
        </span>
      )}
    </div>
  )
}

function Tieu({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-foreground text-[14px] font-semibold">{title}</h3>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  )
}

/* ── Ghi xuất: một container = nhiều dòng ────────────────────────────────── */
function GhiXuat({ d }: { d: DonHangCtx }) {
  const s = d.ship
  const tol = d.order.qty_tolerance_pct
  return (
    <div>
      <Tieu
        title="Ghi xuất hàng — một đợt, nhiều dòng"
        sub="Số lượng mặc định là phần còn lại của từng dòng; sửa theo thực tế đóng cont. Cùng ngày và cùng số cont cho cả đợt."
      />
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="text-muted-foreground block">Ngày xuất</span>
          <input
            type="date"
            value={s.date}
            onChange={(e) => s.setDate(e.target.value)}
            className={`${INPUT} w-[150px]`}
          />
        </label>
        <label className="min-w-[280px] flex-1 text-xs">
          <span className="text-muted-foreground block">
            Số cont / booking / ghi chú đợt
          </span>
          <input
            value={s.note}
            onChange={(e) => s.setNote(e.target.value)}
            maxLength={500}
            placeholder="vd MSKU1234567 · booking HG-0912"
            className={INPUT}
          />
        </label>
      </div>
      <div className="border-border bg-card overflow-x-auto rounded-sm border">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-9`} />
              <th className={`${TH} w-[120px]`}>Mã SP</th>
              <th className={TH}>Tên</th>
              <th className={`${TH} w-20 text-right`}>SL đơn</th>
              <th className={`${TH} w-20 text-right`}>Đã xuất</th>
              <th className={`${TH} w-24 text-right`}>Còn xuất được</th>
              <th className={`${TH} w-[120px] text-right`}>Xuất đợt này</th>
              <th className={`${TH} w-[110px]`}>Tuần giao</th>
            </tr>
          </thead>
          <tbody>
            {d.openLines.map((l) => {
              const cap = shipCapacity(l.qty, l.shipped, tol)
              const on = !!s.pick[l.id]
              const v = Number(s.qty[l.id] ?? 0)
              const bad = on && (!(v > 0) || v > cap)
              return (
                <tr key={l.id} className={on ? '' : 'opacity-60'}>
                  <td className={`${TD} text-center`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => s.setPick(l.id, e.target.checked)}
                      aria-label={`Chọn dòng ${l.product_code}`}
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                    />
                  </td>
                  <td className={`${TD} font-mono text-xs`}>{l.product_code}</td>
                  <td className={`${TD} truncate`}>{l.product_name}</td>
                  <td className={`${TD} ${NUM}`}>{fmtN(l.qty)}</td>
                  <td className={`${TD} ${NUM}`}>{fmtN(l.shipped)}</td>
                  <td className={`${TD} ${NUM}`}>{fmtN(cap)}</td>
                  <td className={`${TD} text-right`}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={s.qty[l.id] ?? ''}
                      onChange={(e) => s.setQty(l.id, e.target.value)}
                      disabled={!on}
                      aria-label={`Số lượng xuất ${l.product_code}`}
                      className={`${INPUT} text-right font-mono tabular-nums ${bad ? 'border-[var(--stop)]' : ''}`}
                    />
                  </td>
                  <td className={`${TD} text-muted-foreground font-mono text-xs`}>
                    {fmtD(l.ship_date)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 font-medium">
              <td className={`${TD} border-b-0`} colSpan={6}>
                Xuất {s.lines.length} dòng
              </td>
              <td className={`${TD} ${NUM} border-b-0`}>
                {fmtN(s.lines.reduce((a, x) => a + (x.qty > 0 ? x.qty : 0), 0))}
              </td>
              <td className={`${TD} border-b-0`} />
            </tr>
          </tfoot>
        </table>
      </div>
      <Chan d={d} label="Ghi xuất" blocked={s.blocked} onSubmit={s.submit} />
    </div>
  )
}

/* ── Xác nhận đã giao ───────────────────────────────────────────────────── */
function XacNhanGiao({ d }: { d: DonHangCtx }) {
  const short = d.shortfall
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Xác nhận đã giao đơn ${d.order.code}`}
        sub={
          short > 0
            ? `Đã xuất ${fmtN(d.tong.shipped)}/${fmtN(d.tong.qty)} — thiếu ${fmtN(short)} so với mức đủ. Giao thiếu vẫn khép được, nhưng phải nói vì sao.`
            : `Đã xuất ${fmtN(d.tong.shipped)}/${fmtN(d.tong.qty)}. Đơn chuyển sang "Đã giao" và không sửa được nữa.`
        }
      />
      <label className="block text-xs">
        <span className="text-muted-foreground block">
          {short > 0 ? 'Lý do giao thiếu (bắt buộc)' : 'Ghi chú (tuỳ chọn)'}
        </span>
        <textarea
          value={d.deliver.note}
          onChange={(e) => d.deliver.setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className={TEXTAREA}
        />
      </label>
      <Chan
        d={d}
        label="Đã giao hàng"
        blocked={d.deliver.blocked}
        onSubmit={d.deliver.submit}
      />
    </div>
  )
}

/* ── Huỷ đơn ────────────────────────────────────────────────────────────── */
function HuyDon({ d }: { d: DonHangCtx }) {
  const im = d.cancelImpact
  const lines: string[] = []
  if (im?.lsx_active)
    lines.push(
      im.lsx_shared
        ? `Lệnh ${d.lsx?.code} còn phục vụ đơn khác — chỉ gỡ phần của đơn này khỏi lệnh (dòng chưa vào sản xuất).`
        : `Lệnh ${d.lsx?.code} sẽ bị huỷ theo.`,
    )
  if (im?.pos_auto.length)
    lines.push(`Đơn mua chưa gửi NCC tự huỷ: ${im.pos_auto.join(', ')}.`)
  if (im?.pos_manual.length)
    lines.push(
      `Đơn mua ĐÃ gửi NCC — Cung ứng phải xử lý tay: ${im.pos_manual.join(', ')}.`,
    )
  if (d.tong.shipped > 0)
    lines.push(
      `Đơn đã xuất ${fmtN(d.tong.shipped)} — cân nhắc "Xác nhận đã giao" kèm lý do giao thiếu thay vì huỷ.`,
    )
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Huỷ đơn ${d.order.code}`}
        sub="Huỷ là bất biến — đơn không mở lại được."
      />
      {lines.length > 0 && (
        <ul className="text-foreground mb-2 list-disc pl-5 text-xs">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <label className="block text-xs">
        <span className="text-muted-foreground block">Lý do huỷ (bắt buộc)</span>
        <textarea
          value={d.cancel.reason}
          onChange={(e) => d.cancel.setReason(e.target.value)}
          rows={2}
          maxLength={1000}
          className={TEXTAREA}
        />
      </label>
      <Chan
        d={d}
        label="Huỷ đơn"
        stop
        blocked={d.cancel.reason.trim() ? null : 'Nhập lý do huỷ'}
        onSubmit={d.cancel.submit}
      />
    </div>
  )
}

/* ── Phát lệnh sản xuất ─────────────────────────────────────────────────── */
function PhatLenh({ d }: { d: DonHangCtx }) {
  const s = d.issue
  return (
    <div className="max-w-3xl">
      <Tieu
        title="Phát lệnh sản xuất"
        sub="Lệnh sinh ra ở trạng thái Nháp: soạn dòng (đợt xuất, quy cách) rồi gửi Giám đốc duyệt. Gộp thêm đơn cùng khách nếu đi chung lệnh."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">
          <span className="text-muted-foreground block">Số lệnh *</span>
          <input
            value={s.code}
            onChange={(e) => s.setCode(e.target.value)}
            placeholder="vd 11/26-27 - MX"
            maxLength={50}
            className={`${INPUT} font-mono`}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block">Hạn xuất lệnh</span>
          <input
            type="date"
            value={s.shipDate}
            onChange={(e) => s.setShipDate(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block">Container</span>
          <input
            value={s.container}
            onChange={(e) => s.setContainer(e.target.value)}
            placeholder="vd 1 x 40'HC"
            maxLength={100}
            className={INPUT}
          />
        </label>
      </div>
      {d.mergeCandidates.length > 0 && (
        <div className="mt-3">
          <div className="text-muted-foreground mb-1 text-xs">
            Gộp đơn cùng khách vào lệnh này ({d.mergeCandidates.length} đơn chưa có lệnh)
          </div>
          <div className="flex flex-wrap gap-2">
            {d.mergeCandidates.map((o) => (
              <label
                key={o.id}
                className="border-border bg-card flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={s.mergeIds.includes(o.id)}
                  onChange={() => s.toggleMerge(o.id)}
                  aria-label={`Gộp đơn ${o.code}`}
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                />
                <span className="font-mono">{o.code}</span>
                <span className="text-muted-foreground">
                  · {o.line_count} dòng · hạn {fmtD(o.due_date)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <Chan d={d} label="Phát lệnh" blocked={s.blocked} onSubmit={s.submit} />
    </div>
  )
}
