'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import type { ShipmentInput } from '@/lib/po-shipments'
import type { PoIssue } from '@/modules/dept/supply/po-tracking.repo'
import {
  Btn,
  Consequence,
  Menu,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  useToast,
} from '@/components/kit'
import {
  ChungTuKhoGrid,
  DotGiaoGrid,
  DotSheet,
  DotSuaSheet,
  NhanTheoDotGrid,
  XacNhanSheet,
} from '../../don/[id]/NhanHangPanel'
import {
  DongSuCoSheet,
  GhiSuCoSheet,
  SuCoGrid,
  type TrackLine,
} from '../../don/[id]/TheoDoiPanel'
import {
  receiveActions,
  shipmentEmptyHint,
  type ShipmentLineRef,
  type ShipmentLite,
} from '../../don/[id]/nhan-hang'
import type { GiaoNhanData } from './tai-giao-nhan'

const so = (n: number) => n.toLocaleString('vi-VN')

/** Một việc chuyển trạng thái cần hộp xác nhận (chốt thiếu, xác nhận, đang giao…). */
type ViecXacNhan = {
  title: string
  consequence: string
  confirmLabel: string
  done: string
  /** Bắt lý do — chốt thiếu (vết của đơn). */
  lyDo?: { label: string; hint: string }
  path: string
  body: (reason: string) => unknown
}

/**
 * HỘP GIAO NHẬN của một đơn trên Theo dõi đơn hàng (01/10/2026, bản vẽ H1
 * canvas "Cung ứng · Hàng về" › Bản 5, chủ dự án duyệt).
 *
 * Từ đây MỌI việc ghi giao nhận làm ở Theo dõi đơn hàng; trang đơn chỉ còn xem
 * (bước 2). Không viết đường ghi mới: bảng và hộp thoại là CHÍNH các component
 * của trang đơn (NhanHangPanel / TheoDoiPanel), gọi đúng các route cũ —
 * `pos/[id]/shipments|confirm|advance|close-short|issues`, `shipments/[id]`,
 * `po-issues/[id]/resolve`. Luật khoá nút: `receiveActions` (nhan-hang.ts).
 */
export function GiaoNhanSheet({
  data,
  today,
  onClose,
}: {
  data: GiaoNhanData
  today: string
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const { po } = data
  const [busy, setBusy] = useState(false)
  const [xacNhan, setXacNhan] = useState<null | 'confirm' | 'add'>(null)
  const [dot, setDot] = useState<null | {
    kind: 'reschedule' | 'cancel' | 'edit' | 'split'
    s: ShipmentLite
  }>(null)
  const [suCoOpen, setSuCoOpen] = useState(false)
  const [suCoClose, setSuCoClose] = useState<PoIssue | null>(null)
  const [hoi, setHoi] = useState<ViecXacNhan | null>(null)
  const [lyDo, setLyDo] = useState('')

  // Cùng cách trang đơn dựng (useDonChungTu) — tiền đợt để trống: hộp này lo
  // số lượng giao nhận, tiền xem ở trang đơn.
  const shipLines: ShipmentLineRef[] = data.lines.flatMap((l) =>
    l.material_id
      ? [{ id: l.id, name: l.name, unit: l.unit, qty_ordered: l.qty_ordered, amount: null, price_approx: false }] // prettier-ignore
      : [],
  )
  const shipLinesById = new Map(shipLines.map((l) => [l.id, l]))
  const shippedByLine = new Map<string, number>()
  for (const s of data.shipments) {
    if (s.status === 'cancelled') continue
    for (const l of s.lines) shippedByLine.set(l.po_line_id, (shippedByLine.get(l.po_line_id) ?? 0) + l.qty) // prettier-ignore
  }
  const trackLines: TrackLine[] = data.lines.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    unit: l.unit,
    qty_ordered: l.qty_ordered,
  }))
  const trackById = new Map(trackLines.map((l) => [l.id, l]))
  const openStockLines = data.statusLines.filter(
    (s) => s.material_id != null && s.qty_open > 0 && !s.closed_short_at,
  )
  const recv = receiveActions({
    status: po.status,
    canEdit: data.canEdit,
    hasStockLines: shipLines.length > 0,
    openStockLines: openStockLines.length,
  })
  const partial = po.status === 'partial'
  /*
    HẸN GIAO BÙ chọn đúng đường (thử thật 01/10/2026 trên PO-2026-0086): đợt 1
    đã hẹn ĐỦ số đặt mà chỉ về một phần → phần thiếu VẪN nằm trong đợt đó, hộp
    "thêm đợt" ra "Còn lại 0" mọi dòng, không hẹn được gì. Khi đó giao bù = DỜI
    NGÀY phần còn lại của đợt đang mở (server cho dời cả đợt "xe đã tới"). Chỉ
    khi còn số chưa xếp vào đợt nào mới mở hộp thêm đợt.
  */
  const conChuaXep = openStockLines.some(
    (s) => (data.lines.find((l) => l.id === s.id)?.qty_ordered ?? 0) - (shippedByLine.get(s.id) ?? 0) > 1e-6, // prettier-ignore
  )
  const dotDangMo = [...data.shipments]
    .filter((s) => s.status === 'planned' || s.status === 'arrived')
    .sort((a, b) => b.seq - a.seq)
    .find((s) => s.lines.some((l) => openStockLines.some((o) => o.id === l.po_line_id)))
  const henGiaoBu = () =>
    !conChuaXep && dotDangMo
      ? setDot({ kind: 'reschedule', s: dotDangMo })
      : setXacNhan('add')
  const openIssues = data.issues.filter((i) => i.status === 'mo').length

  async function call(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    done: string,
  ) {
    setBusy(true)
    try {
      await api(path, { method, body })
      toast.success(done, po.code)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Không làm được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  const advance = (to: string) => ({ path: `/api/dept/supply/pos/${po.id}/advance`, body: () => ({ to }) }) // prettier-ignore
  const chotThieu = (line?: {
    id: string
    label: string
    missing: number
    unit: string
  }): ViecXacNhan => ({
    title: line ? `Chốt thiếu · ${line.label}` : 'Chốt phần thiếu cả đơn',
    consequence: line
      ? `Chốt ${so(line.missing)} ${line.unit} còn thiếu của dòng này. Các dòng khác không đổi. NCC đổi ý giao bù thì mở lại được.`
      : `${openStockLines.length} dòng còn thiếu sẽ chốt. NCC đổi ý giao bù thì mở lại được từng dòng.`,
    confirmLabel: 'Chốt phần thiếu',
    done: line ? 'Đã chốt thiếu dòng này' : 'Đã chốt phần thiếu',
    lyDo: {
      label: 'Vì sao NCC không giao nữa',
      hint: 'Ghi vào vết của đơn. Phần thiếu không còn tính là "đang đặt".',
    },
    path: `/api/dept/supply/pos/${po.id}/close-short`,
    body: (reason) => ({ action: 'close', line_id: line?.id ?? null, reason }),
  })

  const nhanNhan = partial ? 'Nhận tiếp' : 'Nhận hàng'
  const nhanWhy = !data.canReceive
    ? 'Tài khoản này không có quyền ghi phiếu kho'
    : recv.receive.why

  return (
    <Sheet
      open
      onClose={onClose}
      width={880}
      title={`Giao nhận · ${po.code}`}
      subtitle={[
        po.supplier_name,
        po.lsx_code ? `lệnh ${po.lsx_code}` : null,
        po.expected_at
          ? `hẹn ${po.expected_at.slice(0, 10).split('-').reverse().join('/')}`
          : 'chưa hẹn giao',
        po.assignee_name,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 border-y border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-2">
          <Tag tone={partial ? 'warn' : 'neutral'}>
            {PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}
          </Tag>
          <span className="text-k-sm">
            {openStockLines.length > 0
              ? partial
                ? `Còn ${openStockLines.length} dòng chờ về — NCC giao bù thì hẹn đợt mới; không giao nữa thì chốt thiếu.`
                : `${openStockLines.length} dòng chờ về.`
              : 'Không còn dòng nào chờ về.'}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {recv.receive.ok && data.canReceive ? (
              <Btn primary href={`/mua-hang/don/${po.id}/nhan`}>
                {nhanNhan}
              </Btn>
            ) : (
              <Btn primary disabled title={nhanWhy}>
                {nhanNhan}
              </Btn>
            )}
            <Btn
              disabled={busy || !recv.addShipment.ok}
              title={recv.addShipment.why}
              onClick={henGiaoBu}
            >
              {partial ? 'Hẹn giao bù…' : 'Thêm đợt giao…'}
            </Btn>
            <Btn
              disabled={busy || !recv.closeShort.ok}
              title={recv.closeShort.why}
              onClick={() => setHoi(chotThieu())}
            >
              Chốt thiếu cả đơn…
            </Btn>
            <Menu
              items={[
                {
                  label: 'NCC xác nhận',
                  why: recv.confirm.ok ? undefined : recv.confirm.why,
                  onClick: () =>
                    shipLines.length > 0
                      ? setXacNhan('confirm')
                      : setHoi({ title: 'NCC xác nhận', consequence: `Ghi nhận ${po.supplier_name} đã nhận đơn.`, confirmLabel: 'Ghi xác nhận', done: 'Đã ghi nhận NCC xác nhận', ...advance('confirmed') }), // prettier-ignore
                },
                {
                  label: 'Hàng đang trên đường',
                  why: recv.transit.ok ? undefined : recv.transit.why,
                  onClick: () => setHoi({ title: 'Hàng đang trên đường', consequence: 'NCC báo đã xuất hàng. Đơn chuyển sang "Đang giao" — hẹn giao và số lượng không đổi.', confirmLabel: 'Ghi đang giao', done: 'Đã chuyển sang đang giao', ...advance('in_transit') }), // prettier-ignore
                },
                {
                  label: 'Nghiệm thu ngoài sổ',
                  why: recv.acceptByHand.ok ? undefined : recv.acceptByHand.why,
                  onClick: () => setHoi({ title: 'Nghiệm thu ngoài sổ', consequence: 'Đóng đơn KHÔNG qua phiếu kho — chỉ cho đơn toàn dòng tự gõ (gỗ, gia công). Đơn sang "Đã nhận đủ".', confirmLabel: 'Nghiệm thu', done: 'Đã nghiệm thu', ...advance('received') }), // prettier-ignore
                },
                {
                  label: 'Ghi sự cố giao hàng',
                  why: data.canIssue ? undefined : 'Chỉ Cung ứng hoặc Kho ghi sự cố được',
                  onClick: () => setSuCoOpen(true),
                },
              ]}
            />
          </span>
        </div>

        <section aria-label="Từng dòng">
          <h3 className="k-fgrp-h px-4">Từng dòng · đặt / đã về / còn chờ</h3>
          <NhanTheoDotGrid
            batches={data.receiptBatches}
            lines={data.lines.flatMap((l) => (l.material_id ? [{ id: l.id, code: l.code ?? '', name: l.name, unit: l.unit, qty_ordered: l.qty_ordered }] : []))} // prettier-ignore
            status={data.statusLines}
            poStatus={po.status}
            canEdit={data.canEdit}
            busy={busy}
            onCloseShort={(l) => setHoi(chotThieu(l))}
            onReopen={(l) =>
              setHoi({
                title: `Mở lại · ${l.label}`,
                consequence:
                  'Dòng này chờ về trở lại: phần thiếu tính lại là "đang đặt"; đơn đã "về đủ" quay về "về một phần".',
                confirmLabel: 'Mở lại dòng',
                done: 'Đã mở lại dòng',
                path: `/api/dept/supply/pos/${po.id}/close-short`,
                body: () => ({ action: 'reopen', line_id: l.id }),
              })
            }
          />
        </section>

        <section aria-label="Đợt giao">
          <h3 className="k-fgrp-h px-4">Đợt giao · NCC hẹn</h3>
          <DotGiaoGrid
            shipments={data.shipments}
            linesById={shipLinesById}
            currency={po.currency}
            receivedByLine={new Map(data.statusLines.map((s) => [s.id, s.qty_received]))}
            linkedReceipts={new Map(Object.entries(data.shipmentReceipts).map(([sid, per]) => [sid, new Map(Object.entries(per))]))} // prettier-ignore
            confirmedNote={po.confirmed_note}
            emptyHint={shipmentEmptyHint(po.status, shipLines.length > 0)}
            canAct={data.canEdit}
            busy={busy}
            today={today}
            onArrived={(id) => void call(`/api/dept/supply/shipments/${id}`, 'PATCH', { action: 'arrived' }, 'Đã ghi nhận xe tới')} // prettier-ignore
            onReschedule={(s) => setDot({ kind: 'reschedule', s })}
            onCancel={(s) => setDot({ kind: 'cancel', s })}
            onEdit={(s) => setDot({ kind: 'edit', s })}
            onSplit={(s) => setDot({ kind: 'split', s })}
          />
        </section>

        <section aria-label="Phiếu nhập">
          <h3 className="k-fgrp-h px-4">
            Chứng từ kho · {data.warehouseDocs.length} phiếu
          </h3>
          {data.warehouseDocs.length > 0 ? (
            <ChungTuKhoGrid docs={data.warehouseDocs} />
          ) : (
            <p className="text-k-sm px-4 text-[var(--ink-2)]">
              Chưa có phiếu nhập nào cho đơn này.
            </p>
          )}
        </section>

        <section aria-label="Sự cố">
          <h3 className="k-fgrp-h px-4">
            Sự cố giao hàng · {openIssues} đang mở / {data.issues.length}
          </h3>
          <SuCoGrid
            issues={data.issues}
            linesById={trackById}
            canEdit={data.canIssue}
            onResolve={(i) => setSuCoClose(i)}
          />
        </section>

        <p className="text-k-sm px-4 pb-2 text-[var(--ink-3)]">
          Mọi việc ghi giao nhận làm ở đây.{' '}
          <Link
            href={`/mua-hang/don/${po.id}`}
            className="font-semibold text-[var(--act)] hover:underline"
          >
            Mở trang đơn {po.code}
          </Link>{' '}
          để xem tiền, dòng hàng, trao đổi.
        </p>
      </div>

      {xacNhan && (
        <XacNhanSheet
          mode={xacNhan}
          poCode={po.code}
          defaultDate={po.expected_at?.slice(0, 10) ?? today}
          lines={shipLines}
          existing={xacNhan === 'add' ? shippedByLine : new Map()}
          busy={busy}
          onClose={() => setXacNhan(null)}
          onSubmit={
            (ships: ShipmentInput[], note: string) =>
            xacNhan === 'add'
              ? call(`/api/dept/supply/pos/${po.id}/shipments`, 'POST', { shipments: ships }, partial ? 'Đã hẹn giao bù' : 'Đã thêm đợt giao') // prettier-ignore
              : call(`/api/dept/supply/pos/${po.id}/confirm`, 'POST', { confirmed_note: note || null, shipments: ships }, `Đã ghi nhận NCC xác nhận · ${ships.length} đợt`) // prettier-ignore
          }
        />
      )}
      {dot && (dot.kind === 'edit' || dot.kind === 'split') && (
        <DotSuaSheet
          kind={dot.kind}
          shipment={dot.s}
          lines={shipLines}
          others={data.shipments
            .filter((s) => s.id !== dot.s.id && s.status !== 'cancelled')
            .flatMap((s) => s.lines)
            .reduce((m, l) => m.set(l.po_line_id, (m.get(l.po_line_id) ?? 0) + l.qty), new Map<string, number>())} // prettier-ignore
          busy={busy}
          onClose={() => setDot(null)}
          onSubmit={
            (d, reason, lines) =>
            call(`/api/dept/supply/shipments/${dot.s.id}`, 'PATCH', { action: dot.kind, expected_date: d, reason, lines }, dot.kind === 'split' ? 'Đã tách đợt lấy trước' : 'Đã sửa đợt giao') // prettier-ignore
          }
        />
      )}
      {dot && (dot.kind === 'reschedule' || dot.kind === 'cancel') && (
        <DotSheet
          kind={dot.kind}
          shipment={dot.s}
          busy={busy}
          onClose={() => setDot(null)}
          onSubmit={
            (d, reason) =>
            dot.kind === 'cancel'
              ? call(`/api/dept/supply/shipments/${dot.s.id}`, 'PATCH', { action: 'cancel', reason }, 'Đã huỷ đợt giao') // prettier-ignore
              : call(`/api/dept/supply/shipments/${dot.s.id}`, 'PATCH', { action: 'reschedule', expected_date: d, reason }, 'Đã dời ngày đợt giao') // prettier-ignore
          }
        />
      )}
      {suCoOpen && (
        <GhiSuCoSheet
          lines={trackLines}
          busy={busy}
          onClose={() => setSuCoOpen(false)}
          onSubmit={(x) =>
            call(`/api/dept/supply/pos/${po.id}/issues`, 'POST', x, 'Đã ghi sự cố')
          }
        />
      )}
      {suCoClose && (
        <DongSuCoSheet
          issue={suCoClose}
          busy={busy}
          onClose={() => setSuCoClose(null)}
          onSubmit={
            (resolution) =>
            call(`/api/dept/supply/po-issues/${suCoClose.id}/resolve`, 'POST', { resolution }, 'Đã đóng sự cố') // prettier-ignore
          }
        />
      )}
      {hoi && (
        <Sheet
          open
          onClose={() => setHoi(null)}
          stakes="vua"
          title={`${hoi.title} · ${po.code}`}
          footer={
            <SheetActions
              onCancel={() => setHoi(null)}
              onConfirm={async () => {
                const ok = await call(hoi.path, 'POST', hoi.body(lyDo.trim()), hoi.done)
                if (ok) {
                  setHoi(null)
                  setLyDo('')
                }
              }}
              confirmLabel={hoi.confirmLabel}
              busy={busy}
              disabled={!!hoi.lyDo && lyDo.trim().length < 3}
            />
          }
        >
          <Consequence>{hoi.consequence}</Consequence>
          {hoi.lyDo && (
            <div className="mt-3">
              <div className="text-k-label mb-1 font-bold tracking-[.09em] text-[var(--ink-label)] uppercase">
                {hoi.lyDo.label} · bắt buộc
              </div>
              <TextArea
                value={lyDo}
                onChange={setLyDo}
                rows={2}
                aria-label={hoi.lyDo.label}
              />
              <p className="text-k-sm mt-1 text-[var(--ink-3)]">{hoi.lyDo.hint}</p>
            </div>
          )}
        </Sheet>
      )}
    </Sheet>
  )
}
