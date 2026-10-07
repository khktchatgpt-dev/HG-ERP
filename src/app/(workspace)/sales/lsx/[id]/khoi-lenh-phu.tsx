'use client'

import Link from 'next/link'
import { Panel, Nhan, TD, NUM, Thanh } from '../../_erp/ui'
import { DocumentFiles } from '@/components/DocumentFiles'
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status-ui'
import { fmtD, fmtDT, fmtN, Nhom, PO_LABEL, Truong, type ChangeView } from './lenh.shared'
import type { LenhCtx } from './useLenh'

/* ── Tổng quan: ba nhóm có tên ──────────────────────────────────────────── */
export function KhoiLenhTongQuan({ d }: { d: LenhCtx }) {
  const l = d.lsx
  return (
    <Panel
      title="Tổng quan"
      label="Tổng quan"
      actions={
        d.can.header ? (
          <button
            type="button"
            onClick={() => d.open('header')}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Sửa đầu lệnh
          </button>
        ) : undefined
      }
    >
      <div className="grid gap-x-6 gap-y-3 px-3 py-2 lg:grid-cols-3">
        <Nhom title="Chung">
          <Truong label="Khách hàng">
            <Link
              href={`/sales/customers/${l.customer_id}`}
              className="text-[var(--primary)] hover:underline"
            >
              {l.customer_name}
            </Link>
          </Truong>
          <Truong label="Người lập">{l.created_by_name}</Truong>
          <Truong label="Ngày nhận đơn" mono>
            {fmtD(l.received_date)}
          </Truong>
          <Truong label="Phát lệnh" mono>
            {fmtD(l.issued_at)}
          </Truong>
          <Truong label="Ưu tiên" mono>
            {l.priority ? String(l.priority) : null}
          </Truong>
          <Truong label="Container">{l.container_summary}</Truong>
        </Nhom>
        <Nhom title="Lịch">
          <Truong label="Hạn xuất" mono>
            {l.ship_date
              ? `${fmtD(l.ship_date)}${d.lots.some((x) => x.ship_date) ? ' · theo lô sớm nhất' : ''}`
              : null}
          </Truong>
          <Truong label="Hạn vật tư" mono>
            {fmtD(l.materials_due_at)}
          </Truong>
          <Truong label="Nhận vật tư" mono>
            {fmtD(l.materials_received_at)}
          </Truong>
          <Truong label="GĐ duyệt" mono>
            {fmtD(l.approved_at)}
          </Truong>
          <Truong label="Hoàn thành" mono>
            {fmtD(l.completed_at)}
          </Truong>
          <Truong label="Công đoạn">
            {d.jobs.total > 0 ? (
              <Thanh
                ratio={d.jobs.done / d.jobs.total}
                label={`${d.jobs.done}/${d.jobs.total}`}
                tone={d.jobs.done === d.jobs.total ? 'done' : undefined}
              />
            ) : (
              'chưa lên kế hoạch'
            )}
          </Truong>
        </Nhom>
        <Nhom title="Bản phát hành">
          <Truong label="Bản hiện tại" mono>{`bản ${l.revision}`}</Truong>
          <Truong label="Sửa lần cuối" mono>
            {l.revised_at ? fmtDT(l.revised_at) : null}
          </Truong>
          <Truong label="Lý do sửa">{l.revision_note}</Truong>
          {l.rejected_reason && (
            <Truong label="GĐ từ chối">
              <span className="text-[var(--stop)]">{l.rejected_reason}</span>
            </Truong>
          )}
        </Nhom>
      </div>
      {l.note && (
        <div className="border-border text-foreground border-t px-3 py-2 text-[13px] whitespace-pre-wrap">
          <span className="text-muted-foreground mr-2 text-xs">Ghi chú:</span>
          {l.note}
        </div>
      )}
    </Panel>
  )
}

/* ── Đơn trong lệnh ─────────────────────────────────────────────────────── */
export function KhoiLenhDon({ d }: { d: LenhCtx }) {
  return (
    <Panel
      title="Đơn trong lệnh"
      count={d.orders.length}
      label="Đơn trong lệnh"
      actions={
        d.can.merge ? (
          <button
            type="button"
            onClick={() => d.open('merge')}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            + Gộp đơn
          </button>
        ) : undefined
      }
    >
      <table className="w-full border-collapse">
        <tbody>
          {d.orders.map((o) => (
            <tr key={o.id}>
              <td className={`${TD} font-mono text-xs`}>
                <Link
                  href={`/sales/orders/${o.id}`}
                  className="text-[var(--primary)] hover:underline"
                >
                  {o.code}
                </Link>
                {o.customer_po_no && (
                  <span className="text-muted-foreground ml-1">
                    PO {o.customer_po_no}
                  </span>
                )}
              </td>
              <td className={TD}>
                <Nhan tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Nhan>
              </td>
              <td className={`${TD} ${NUM} text-xs`}>
                {fmtN(o.shipped)}/{fmtN(o.qty)}
              </td>
              <td className={`${TD} font-mono text-xs`}>{fmtD(o.due_date)}</td>
              <td className={`${TD} text-right`}>
                {d.can.header &&
                  ['draft', 'pending_approval', 'rejected'].includes(d.lsx.status) &&
                  d.orders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void d.removeOrder(o.id)}
                      disabled={d.busy}
                      className="text-xs text-[var(--stop)] hover:underline"
                      aria-label={`Gỡ đơn ${o.code}`}
                    >
                      Gỡ
                    </button>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted-foreground border-border border-t px-3 py-1.5 text-xs">
        Σ đơn {fmtN(d.tong.orderQty)} · đã xuất {fmtN(d.tong.shipped)} · lệnh{' '}
        {fmtN(d.tong.qty)}
        {d.tong.orderQty !== d.tong.qty && (
          <button
            type="button"
            onClick={() => d.open('sync')}
            className="ml-2 text-[var(--warn)] hover:underline"
          >
            lệch {fmtN(Math.abs(d.tong.orderQty - d.tong.qty))} — so với đơn
          </button>
        )}
      </div>
    </Panel>
  )
}

/* ── Lô xuất của Sale (0222) ────────────────────────────────────────────── */
export function KhoiLenhLo({ d }: { d: LenhCtx }) {
  const left = Object.entries(d.lotLeft).filter(([, v]) => v > 0)
  return (
    <Panel
      title="Đợt xuất"
      count={d.lots.length}
      label="Đợt xuất"
      note={
        d.lotIssues.length ? (
          <span className="text-[var(--stop)]">
            Lô lệch lệnh: {d.lotIssues.slice(0, 3).join(' · ')}
          </span>
        ) : left.length ? (
          <span className="text-[var(--warn)]">
            Chưa xếp hết:{' '}
            {left
              .map(([k, v]) => `${k} còn ${fmtN(v)}`)
              .slice(0, 4)
              .join(' · ')}
          </span>
        ) : d.lots.length ? (
          'Đã xếp đủ SL vào lô'
        ) : undefined
      }
      actions={
        d.can.lots ? (
          <Link
            href={`/sales/ke-hoach-xuat?lsx=${d.lsx.id}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Chia đợt
          </Link>
        ) : undefined
      }
    >
      {d.lots.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa chia đợt.{' '}
          {d.can.lots
            ? 'Chia đợt theo PO khách để hạn xuất và phiếu in đọc đúng lịch.'
            : 'Lệnh chưa duyệt — chia đợt sau khi gửi duyệt.'}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {d.lots.map((lot) => (
              <tr key={lot.id}>
                <td className={`${TD} text-muted-foreground w-10 font-mono text-xs`}>
                  #{lot.seq}
                </td>
                <td className={`${TD} font-mono text-xs`}>
                  {lot.ship_date ? (
                    fmtD(lot.ship_date)
                  ) : (
                    <span className="text-[var(--warn)]">chưa chốt lịch</span>
                  )}
                </td>
                <td className={`${TD} text-xs`}>{lot.po ?? '—'}</td>
                <td className={`${TD} ${NUM}`}>{fmtN(lot.qty)}</td>
                <td className={`${TD} truncate text-xs`} title={lot.note ?? ''}>
                  {lot.note ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60 font-medium">
              <td className={`${TD} border-b-0`} colSpan={3}>
                Cộng {d.lots.length} lô
              </td>
              <td className={`${TD} ${NUM} border-b-0`}>{fmtN(d.tong.lotQty)}</td>
              <td className={`${TD} border-b-0`} />
            </tr>
          </tfoot>
        </table>
      )}
    </Panel>
  )
}

/* ── Đơn mua vật tư của lệnh (ẩn tiền) ──────────────────────────────────── */
export function KhoiLenhVatTu({ d }: { d: LenhCtx }) {
  const by = new Map<string, number>()
  for (const p of d.pos) by.set(p.status, (by.get(p.status) ?? 0) + 1)
  return (
    <Panel
      title="Vật tư"
      count={d.pos.length}
      label="Vật tư"
      note="đơn mua gắn lệnh — Cung ứng lo, Sale chỉ xem tình trạng"
    >
      {d.pos.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có đơn mua nào gắn lệnh này.
        </p>
      ) : (
        <div className="px-3 py-2 text-[13px]">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {[...by.entries()].map(([st, n]) => (
              <Nhan
                key={st}
                tone={
                  st === 'received'
                    ? 'done'
                    : st === 'cancelled'
                      ? 'stop'
                      : ['draft', 'pending_approval'].includes(st)
                        ? 'warn'
                        : 'neutral'
                }
              >
                {PO_LABEL[st] ?? st} {n}
              </Nhan>
            ))}
          </div>
          <ul className="text-muted-foreground text-xs">
            {d.pos.slice(0, 8).map((p) => (
              <li key={p.id}>
                <span className="text-foreground font-mono">{p.code}</span> ·{' '}
                {p.supplier_name} · {PO_LABEL[p.status] ?? p.status}
              </li>
            ))}
            {d.pos.length > 8 && <li>… và {d.pos.length - 8} đơn nữa</li>}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/* ── Lịch sử ────────────────────────────────────────────────────────────── */
const TYPE_TITLE: Record<string, string> = {
  header_changed: 'Đổi đầu lệnh',
  revised: 'Bản phát lại',
  cancelled: 'Huỷ lệnh',
  synced_from_orders: 'Đồng bộ theo đơn',
}
const FIELD: Record<string, string> = {
  code: 'số lệnh',
  ship_date: 'hạn xuất',
  container_summary: 'container',
  received_date: 'ngày nhận',
  priority: 'ưu tiên',
}
function moTa(c: ChangeView): string {
  const ch = c.change
  const parts: string[] = []
  if (ch.type === 'revised')
    parts.push(`bản ${String(ch.revision)}, ${String(ch.changed_lines)} dòng đổi`)
  if (ch.type === 'synced_from_orders')
    parts.push(
      `${(ch.items as unknown[] | undefined)?.length ?? 0} việc áp, ${String(ch.manual ?? 0)} chỉnh tay`,
    )
  if (ch.source === 'ship_lots') parts.push('từ lô xuất')
  if (ch.fields && typeof ch.fields === 'object') {
    for (const [f, v] of Object.entries(
      ch.fields as Record<string, { from: unknown; to: unknown }>,
    )) {
      parts.push(`${FIELD[f] ?? f}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`)
    }
  }
  if (c.note) parts.push(c.note)
  return parts.join(' · ')
}

export function KhoiLenhLichSu({ d }: { d: LenhCtx }) {
  const l = d.lsx
  const moc = [
    l.issued_at && { at: l.issued_at, title: 'Phát lệnh', tone: '' },
    l.approved_at && { at: l.approved_at, title: 'GĐ duyệt', tone: 'text-[var(--done)]' },
    l.materials_received_at && {
      at: l.materials_received_at,
      title: 'Xưởng nhận vật tư',
      tone: '',
    },
    l.completed_at && {
      at: l.completed_at,
      title: 'Hoàn thành',
      tone: 'text-[var(--done)]',
    },
  ].filter(Boolean) as { at: string; title: string; tone: string }[]
  const rows = [
    ...moc.map((m) => ({
      id: m.title,
      at: m.at,
      title: m.title,
      tone: m.tone,
      detail: '',
      who: '',
    })),
    ...d.changes.map((c) => ({
      id: c.id,
      at: c.created_at,
      title: TYPE_TITLE[String(c.change.type)] ?? String(c.change.type),
      tone: c.change.type === 'cancelled' ? 'text-[var(--stop)]' : '',
      detail: moTa(c),
      who: c.changed_by_name ?? 'hệ thống',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Panel title="Lịch sử" count={rows.length} label="Lịch sử">
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">Chưa có mốc nào.</p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((r) => (
            <li key={r.id + r.at} className="flex gap-3 px-3 py-1.5 text-[13px]">
              <span className="text-muted-foreground w-[110px] shrink-0 font-mono text-xs tabular-nums">
                {fmtDT(r.at)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`font-medium ${r.tone}`}>{r.title}</span>
                {r.detail && <span className="text-muted-foreground"> — {r.detail}</span>}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">{r.who}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function KhoiLenhTaiLieu({ d }: { d: LenhCtx }) {
  return (
    <Panel title="Tài liệu" label="Tài liệu" note="PO khách · bản vẽ · file lệnh gốc">
      <div className="px-3 py-2">
        <DocumentFiles
          kind="production_order"
          id={d.lsx.id}
          canEdit={d.canOwn}
          title=""
        />
      </div>
    </Panel>
  )
}
