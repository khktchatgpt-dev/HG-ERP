'use client'

import { describeSyncItem, isAutoApplicable } from '@/lib/lsx-sync'
import { BTN_PRI, BTN_STOP, BTN_SUB, INPUT, TEXTAREA, fmtD, fmtN } from './lenh.shared'
import type { LenhCtx } from './useLenh'

/**
 * KHỐI HÀNH ĐỘNG mở TẠI CHỖ dưới dải ô đếm: sửa đầu lệnh · gửi duyệt / trình
 * lại · GĐ duyệt-từ chối · huỷ / xoá · đồng bộ từ đơn · gộp đơn. Mỗi khối nói
 * vì sao chưa bấm được ngay cạnh nút (luật kiểm #7).
 */
export function KhoiLenhHanhDong({ d }: { d: LenhCtx }) {
  if (!d.panel) return null
  return (
    <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
      {d.panel === 'header' && <SuaDauLenh d={d} />}
      {d.panel === 'submit' && <GuiDuyet d={d} />}
      {d.panel === 'resubmit' && <SuaDauLenh d={d} resubmit />}
      {d.panel === 'reject' && <TuChoi d={d} />}
      {d.panel === 'cancel' && <HuyLenh d={d} />}
      {d.panel === 'delete' && <XoaNhap d={d} />}
      {d.panel === 'sync' && <DongBo d={d} />}
      {d.panel === 'merge' && <GopDon d={d} />}
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
  d: LenhCtx
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

function SuaDauLenh({ d, resubmit }: { d: LenhCtx; resubmit?: boolean }) {
  const h = d.header
  return (
    <div className="max-w-3xl">
      <Tieu
        title={resubmit ? `Trình duyệt lại ${d.lsx.code}` : `Sửa đầu lệnh ${d.lsx.code}`}
        sub={
          resubmit
            ? `GĐ từ chối: "${d.lsx.rejected_reason ?? '—'}". Sửa theo lý do rồi trình lại; đơn trở về Chờ duyệt lệnh.`
            : d.published
              ? 'Lệnh đã duyệt — đổi hạn xuất / số lệnh / container sẽ được ghi vết và báo xưởng + Cung ứng.'
              : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {!resubmit && (
          <label className="text-xs">
            <span className="text-muted-foreground block">Số lệnh</span>
            <input
              value={h.code}
              onChange={(e) => h.setCode(e.target.value)}
              maxLength={50}
              className={`${INPUT} font-mono`}
            />
          </label>
        )}
        <label className="text-xs">
          <span className="text-muted-foreground block">
            Hạn xuất{' '}
            {h.lotsLockShip && (
              <span className="text-[var(--warn)]">
                (theo lô sớm nhất — sửa ở Kế hoạch xuất)
              </span>
            )}
          </span>
          <input
            type="date"
            value={h.ship}
            onChange={(e) => h.setShip(e.target.value)}
            disabled={h.lotsLockShip}
            className={INPUT}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block">Ngày nhận đơn</span>
          <input
            type="date"
            value={h.recv}
            onChange={(e) => h.setRecv(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground block">Container</span>
          <input
            value={h.cont}
            onChange={(e) => h.setCont(e.target.value)}
            maxLength={100}
            placeholder="1 x 40'HC"
            className={INPUT}
          />
        </label>
        {!resubmit && (
          <label className="text-xs">
            <span className="text-muted-foreground block">Ưu tiên (0–9)</span>
            <input
              type="number"
              min={0}
              max={9}
              value={h.priority}
              onChange={(e) => h.setPriority(e.target.value)}
              className={INPUT}
            />
          </label>
        )}
        <label className="text-xs sm:col-span-3">
          <span className="text-muted-foreground block">Ghi chú lệnh</span>
          <textarea
            value={h.note}
            onChange={(e) => h.setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            className={TEXTAREA}
          />
        </label>
      </div>
      <Chan
        d={d}
        label={resubmit ? 'Trình duyệt lại' : 'Lưu đầu lệnh'}
        blocked={!resubmit && !h.code.trim() ? 'Nhập số lệnh' : null}
        onSubmit={resubmit ? d.resubmit : h.save}
      />
    </div>
  )
}

function GuiDuyet({ d }: { d: LenhCtx }) {
  const blocked =
    d.tong.lines === 0 ? 'Lệnh chưa có dòng — bấm "Soạn dòng lệnh" trước' : null
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Gửi Giám đốc duyệt ${d.lsx.code}`}
        sub={`${fmtN(d.tong.lines)} dòng · ${fmtN(d.tong.qty)} SP · ${d.orders.length} đơn. Sau khi gửi, dòng lệnh khoá tới khi GĐ quyết; đơn chuyển sang Chờ duyệt lệnh.`}
      />
      {d.tong.bomMissing > 0 && (
        <p className="mb-2 text-xs text-[var(--warn)]">
          {d.tong.bomMissing} dòng có SP chưa có định mức — vẫn gửi được, Kỹ thuật sẽ được
          báo.
        </p>
      )}
      <Chan d={d} label="Gửi duyệt" blocked={blocked} onSubmit={d.submit} />
    </div>
  )
}

function TuChoi({ d }: { d: LenhCtx }) {
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Từ chối lệnh ${d.lsx.code}`}
        sub="Lệnh về Bị từ chối, đơn về Xác nhận; người lập sửa rồi trình lại."
      />
      <label className="block text-xs">
        <span className="text-muted-foreground block">Lý do (bắt buộc)</span>
        <textarea
          value={d.rejectReason}
          onChange={(e) => d.setRejectReason(e.target.value)}
          rows={2}
          maxLength={1000}
          className={TEXTAREA}
        />
      </label>
      <Chan
        d={d}
        label="Từ chối"
        stop
        blocked={d.rejectReason.trim() ? null : 'Nhập lý do'}
        onSubmit={() => void d.reject()}
      />
    </div>
  )
}

function HuyLenh({ d }: { d: LenhCtx }) {
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Huỷ lệnh ${d.lsx.code}`}
        sub={`${d.orders.length} đơn trở về Xác nhận và được gỡ khỏi lệnh (phát lại được). Xưởng + Cung ứng được báo; ${d.pos.length} đơn mua của lệnh KHÔNG tự huỷ — Cung ứng quyết.${d.jobs.done > 0 ? ' Lệnh đã có công đoạn xong — chỉ quản lý huỷ được.' : ''}`}
      />
      <label className="block text-xs">
        <span className="text-muted-foreground block">Lý do huỷ (bắt buộc)</span>
        <textarea
          value={d.cancelReason}
          onChange={(e) => d.setCancelReason(e.target.value)}
          rows={2}
          maxLength={1000}
          className={TEXTAREA}
        />
      </label>
      <Chan
        d={d}
        label="Huỷ lệnh"
        stop
        blocked={d.cancelReason.trim() ? null : 'Nhập lý do huỷ'}
        onSubmit={() => void d.cancel()}
      />
    </div>
  )
}

function XoaNhap({ d }: { d: LenhCtx }) {
  return (
    <div className="max-w-2xl">
      <Tieu
        title={`Xoá lệnh ${d.lsx.code}`}
        sub={`Lệnh ${d.lsx.status === 'draft' ? 'nháp' : 'bị từ chối'} chưa có hiệu lực — xoá hẳn (nhóm, dòng, lô đi theo). ${d.orders.length} đơn trở về Xác nhận để phát lệnh khác.`}
      />
      <Chan
        d={d}
        label="Xoá lệnh"
        stop
        blocked={null}
        onSubmit={() => void d.deleteDraft()}
      />
    </div>
  )
}

function DongBo({ d }: { d: LenhCtx }) {
  const s = d.sync
  if (!s) return null
  const auto = s.items.filter(isAutoApplicable)
  const manual = s.items.filter((it) => !isAutoApplicable(it))
  return (
    <div className="max-w-3xl">
      <Tieu
        title="Đồng bộ dòng lệnh theo đơn hàng"
        sub={
          s.items.length === 0
            ? 'Dòng lệnh đang khớp đơn — không có gì để đồng bộ.'
            : `${auto.length} việc áp được tự động · ${manual.length} việc phải chỉnh tay ở màn soạn dòng.${d.published ? ' Lệnh đã duyệt: áp xong sẽ sinh bản phát lại (xưởng in lại).' : ''}`
        }
      />
      {s.items.length > 0 && (
        <ul className="mb-2 list-disc pl-5 text-[13px]">
          {s.items.map((it, i) => (
            <li key={i} className={isAutoApplicable(it) ? '' : 'text-[var(--warn)]'}>
              {describeSyncItem(it)}
            </li>
          ))}
        </ul>
      )}
      {auto.length > 0 && d.published && (
        <label className="block text-xs">
          <span className="text-muted-foreground block">
            Lý do bản phát lại (bắt buộc)
          </span>
          <input
            value={d.syncNote}
            onChange={(e) => d.setSyncNote(e.target.value)}
            maxLength={1000}
            placeholder="Khách đổi SL theo PO mới"
            className={INPUT}
          />
        </label>
      )}
      <Chan
        d={d}
        label={`Áp ${auto.length} việc`}
        blocked={
          auto.length === 0
            ? 'Không có việc tự áp được'
            : d.published && !d.syncNote.trim()
              ? 'Ghi lý do bản phát lại'
              : null
        }
        onSubmit={() => void d.applySync()}
      />
    </div>
  )
}

function GopDon({ d }: { d: LenhCtx }) {
  return (
    <div className="max-w-3xl">
      <Tieu
        title="Gộp thêm đơn cùng khách vào lệnh"
        sub="Đơn đã xác nhận, chưa thuộc lệnh nào. Gộp xong nhớ Soạn dòng lệnh (nhóm mới được nạp từ đơn)."
      />
      <div className="flex flex-wrap gap-2">
        {d.mergeCandidates.map((o) => (
          <label
            key={o.id}
            className="border-border bg-card flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs"
          >
            <input
              type="checkbox"
              checked={d.mergeIds.includes(o.id)}
              onChange={() => d.toggleMerge(o.id)}
              aria-label={`Gộp đơn ${o.code}`}
              className="h-3.5 w-3.5 accent-[var(--primary)]"
            />
            <span className="font-mono">{o.code}</span>
            <span className="text-muted-foreground">· {o.line_count} dòng</span>
          </label>
        ))}
      </div>
      <Chan
        d={d}
        label="Gộp đơn"
        blocked={d.mergeIds.length ? null : 'Chọn đơn cần gộp'}
        onSubmit={() => void d.addOrders()}
      />
      <p className="text-muted-foreground mt-1 text-xs">
        Hạn giao từng đơn:{' '}
        {d.orders.map((o) => `${o.code} ${fmtD(o.due_date)}`).join(' · ')}
      </p>
    </div>
  )
}
