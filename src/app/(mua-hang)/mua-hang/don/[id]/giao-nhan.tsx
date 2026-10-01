'use client'

import { FastTab, GridBtn } from '@/components/kit'
import { earliestExpectedDate } from '@/lib/po-shipments'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { ChungTuKhoGrid, DotGiaoGrid, NhanTheoDotGrid } from './NhanHangPanel'
import { ChiaDotSoanGrid } from './SoanDonPanels'
import { SoHenGiaoGrid, SuCoGrid, XacNhanTheoDongGrid } from './TheoDoiPanel'
import { fmtNum } from './don-chung-tu.shared'
import { shipmentEmptyHint } from './nhan-hang'
import { columnsToShipments } from './soan-don'
import type { DonCtx } from './useDonChungTu'

/** Khối `blkGiao` của màn chứng từ đơn mua. */
export function GiaoNhan({ d }: { d: DonCtx }) {
  const {
    po,
    drafting,
    viewMode,
    shipCols,
    sentToSupplier,
    liveShipments,
    shipmentsDone,
    p,
    busy,
    recv,
    setXacNhan,
    router,
    lines,
    setShipCols,
    trackLines,
    shipLinesById,
    shipLines,
    perms,
    today,
    shipmentAct,
    setDot,
    start,
    closeShortAct,
    reopenAct,
    trackById,
    openIssues,
    setSuCoOpen,
    setSuCoClose,
    openShortLines,
    missingTotal,
    termsEdit,
    editCols,
    setEditCols,
    shipErrors,
    shipChanges,
  } = d
  // Chế độ SỬA TẠI CHỖ (B2, 28/09/2026): đợt đang hẹn sửa thẳng trong lưới chia
  // đợt của lúc soạn; đợt xe đã tới / đã nhận nằm ngoài, khoá — Kho giữ chúng.
  const suaDot = termsEdit && !drafting && !!po
  const lockedShipments = p.shipments.filter((s) => s.status !== 'planned' && s.status !== 'cancelled') // prettier-ignore
  return (
    <>
      {/* ══ 1b. GIAO & NHẬN HÀNG — hai sổ: NCC hẹn gì, Kho thực nhận gì ═══
            Mở sẵn khi đơn đã gửi NCC (từ đó trở đi đây là câu hỏi hằng ngày);
            trước đó gấp lại, chỉ tiêu đề nói "chưa có đợt". */}
      {(po || drafting) && (
        <FastTab
          fixed={viewMode}
          id="dot-giao"
          title={drafting ? 'Chia đợt giao' : 'Giao & nhận hàng'}
          flush
          defaultOpen={drafting ? shipCols.length > 0 : viewMode || sentToSupplier}
          summary={
            drafting
              ? [
                  [
                    'Đợt',
                    <span key="a" className="num">
                      {columnsToShipments(shipCols).length || '—'}
                    </span>,
                  ],
                ]
              : [
                  // prettier-ignore
                  ['Đợt giao', <span key="a" className="num">{liveShipments.length}</span>], // prettier-ignore
                  ['Đã nhận', <span key="b" className="num">{liveShipments.length > 0 ? `${shipmentsDone}/${liveShipments.length}` : '—'}</span>], // prettier-ignore
                  ['Phiếu kho', <span key="c" className="num">{p.warehouseDocs.length}</span>], // prettier-ignore
                ]
          }
          actions={
            !drafting ? (
              <>
                <GridBtn
                  disabled={busy || !recv.addShipment.ok}
                  title={recv.addShipment.why}
                  onClick={() => setXacNhan('add')}
                >
                  {' '}
                  {/* prettier-ignore */}
                  {po?.status === 'partial'
                    ? '+ Hẹn giao bù (đợt mới)'
                    : '+ Thêm đợt giao'}
                </GridBtn>
                {/* Cung ứng nhận hàng thay Kho (01/10/2026) — cửa phiếu nhập của Cung ứng. */}
                <GridBtn
                  disabled={!recv.receive.ok}
                  title={recv.receive.why}
                  onClick={() => po && router.push(`/mua-hang/don/${po.id}/nhan`)}
                >
                  {' '}
                  {/* prettier-ignore */}
                  {po?.status === 'partial' ? 'Nhận tiếp' : 'Nhận hàng'}
                </GridBtn>
              </>
            ) : undefined
          }
        >
          {drafting ? (
            <ChiaDotSoanGrid lines={lines} columns={shipCols} onChange={setShipCols} />
          ) : !po ? null : po.status === 'cancelled' ? (
            <div className="text-k-sm px-[var(--gutter)] py-3 text-[var(--ink-2)]">
              Đơn đã huỷ — kế hoạch giao và chứng từ kho không còn áp dụng.
            </div>
          ) : (
            <>
              {sentToSupplier && (
                <>
                  <div className="px-[var(--gutter)] pt-2">
                    <h3 className="k-fgrp-h">
                      Xác nhận theo dòng · đặt / NCC hẹn / đã về
                    </h3>
                    {/* Phân biệt với bảng "Theo dòng · Kho" phía dưới (29/09/2026):
                        đây là PHÍA NCC — họ nói gì, không phải Kho đã nhận gì. */}
                    <p className="text-k-sm mb-1 text-[var(--ink-3)]">
                      Phía NCC nói gì — đã nhận đơn chưa, hẹn ngày nào.
                    </p>
                  </div>
                  <XacNhanTheoDongGrid
                    lines={trackLines}
                    status={p.statusLines}
                    shipments={p.shipments}
                    po={po}
                  />
                </>
              )}
              <div className="px-[var(--gutter)] pt-3">
                <h3 className="k-fgrp-h">
                  {suaDot
                    ? 'Đợt giao · đang sửa — mỗi cột một đợt, ô trống = không đi đợt đó'
                    : 'Kế hoạch giao · NCC hẹn'}
                </h3>
              </div>
              {suaDot && (
                <>
                  <ChiaDotSoanGrid
                    lines={lines}
                    columns={editCols}
                    onChange={setEditCols}
                  />
                  <div className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-2)]">
                    {shipErrors.length > 0 ? (
                      <span className="k-t-stop">
                        Chưa lưu được: {shipErrors.join(' · ')}
                      </span>
                    ) : shipChanges > 0 ? (
                      <span>
                        <b className="num">{shipChanges}</b> đợt đổi — bấm <b>Lưu</b> ở
                        đầu trang để ghi; bỏ cột = huỷ đợt (máy ghi lý do).
                      </span>
                    ) : (
                      'Chưa đổi đợt nào. Đợt xe đã tới / đã nhận không sửa ở đây — Kho giữ.'
                    )}
                  </div>
                  {lockedShipments.length > 0 && (
                    <div className="px-[var(--gutter)] pt-2">
                      <h3 className="k-fgrp-h">Đợt đã tới / đã nhận · khoá</h3>
                    </div>
                  )}
                </>
              )}
              {(!suaDot || lockedShipments.length > 0) && (
                <DotGiaoGrid
                  shipments={suaDot ? lockedShipments : p.shipments}
                  linesById={shipLinesById}
                  currency={po.currency}
                  receivedByLine={new Map(p.statusLines.map((s) => [s.id, s.qty_received ?? 0]))} // prettier-ignore
                  linkedReceipts={new Map(Object.entries(p.shipmentReceipts).map(([sid, per]) => [sid, new Map(Object.entries(per))]))} // prettier-ignore
                  confirmedNote={po.confirmed_note}
                  emptyHint={shipmentEmptyHint(po.status, shipLines.length > 0)}
                  canAct={perms.canEdit && !drafting && !suaDot}
                  busy={busy}
                  today={today}
                  onArrived={(id) => void shipmentAct(id, { action: 'arrived' }, 'Đã ghi nhận xe tới')} // prettier-ignore
                  onReschedule={(s) => setDot({ kind: 'reschedule', s })}
                  onCancel={(s) => setDot({ kind: 'cancel', s })}
                  onEdit={(s) => setDot({ kind: 'edit', s })}
                  onSplit={(s) => setDot({ kind: 'split', s })}
                />
              )}
              {/* Bày sổ theo DÒNG từ lúc đơn rời tay mình, không đợi Kho lập
                    phiếu đầu tiên. Bản trước gác bằng `receiptBatches.length > 0`
                    nên đúng lúc cần nhất — NCC báo hết một mã mà chưa về gì —
                    thì bảng không hiện, và người mua chỉ còn nút chốt CẢ ĐƠN. */}
              {(p.receiptBatches.length > 0 || sentToSupplier) && (
                <>
                  <div className="px-[var(--gutter)] pt-3">
                    <h3 className="k-fgrp-h">
                      {p.receiptBatches.length > 0
                        ? 'Nhận theo đợt · sổ thực nhận của Kho'
                        : 'Theo dòng · Kho chưa lập phiếu nhập nào'}
                    </h3>
                    {/* Phân biệt với bảng "Xác nhận theo dòng" phía trên: đây
                        là PHÍA KHO — đã lập phiếu gì, còn thiếu bao nhiêu, và
                        là nơi bấm "Chốt thiếu" khi NCC không giao nữa. */}
                    <p className="text-k-sm mb-1 text-[var(--ink-3)]">
                      Phía Kho đã nhận gì — số thật trên phiếu nhập, chốt thiếu ở đây.
                    </p>
                  </div>
                  <NhanTheoDotGrid
                    batches={p.receiptBatches}
                    lines={p.lines.flatMap((l) => (l.id ? [{ id: l.id, code: l.material_code, name: l.material_name, unit: l.material_unit, qty_ordered: l.qty_ordered }] : []))} // prettier-ignore
                    status={p.statusLines}
                    poStatus={po?.status ?? 'draft'}
                    canEdit={perms.canEdit}
                    busy={busy}
                    onCloseShort={(l) => start(closeShortAct(l))}
                    onReopen={(l) => start(reopenAct(l))}
                  />
                </>
              )}
              <div className="px-[var(--gutter)] pt-3">
                <h3 className="k-fgrp-h">
                  Lịch sử hẹn giao · đề nghị → NCC cam kết → dời → thực nhận
                </h3>
              </div>
              <SoHenGiaoGrid
                commits={p.tracking?.commits ?? []}
                receipts={p.warehouseDocs.filter((d) => d.kind === 'receipt').map((d) => ({ code: d.code, at: d.at, entered_at: d.entered_at, qty_total: d.qty_total }))} // prettier-ignore
                linesById={trackById}
                currentEarliest={earliestExpectedDate(p.shipments)}
              />
              <div className="flex items-center gap-2 px-[var(--gutter)] pt-3" id="su-co">
                <h3 className="k-fgrp-h grow">
                  Sự cố giao hàng · {openIssues} đang mở /{' '}
                  {(p.tracking?.issues ?? []).length}
                </h3>
                <GridBtn
                  disabled={busy || !p.canIssue || !sentToSupplier}
                  title={!p.canIssue ? 'Chỉ Cung ứng hoặc Kho ghi sự cố được' : !sentToSupplier ? 'Đơn chưa gửi NCC — chưa có gì giao' : 'Hàng sai quy cách, thiếu, dư, hỏng, giao trễ'} // prettier-ignore
                  onClick={() => setSuCoOpen(true)}
                >
                  + Ghi sự cố
                </GridBtn>
              </div>
              <SuCoGrid
                issues={p.tracking?.issues ?? []}
                linesById={trackById}
                canEdit={!!p.canIssue}
                onResolve={(i) => setSuCoClose(i)}
              />
              {openShortLines > 0 && missingTotal <= 1e-6 && (
                <div className="text-k-sm px-[var(--gutter)] pt-2 text-[var(--ink-2)]">
                  {openShortLines} dòng đã về thiếu. NCC không giao nữa thì bấm “Chốt
                  thiếu” ở bảng theo dòng phía trên, rồi tạo đơn bổ sung (cùng hoặc khác
                  NCC) cho phần đã chốt.
                </div>
              )}
              {(missingTotal > 1e-6 || (p.links?.supplements.length ?? 0) > 0) && (
                <>
                  <div className="flex items-center gap-2 px-[var(--gutter)] pt-3">
                    <h3 className="k-fgrp-h grow">
                      Đơn bổ sung phần thiếu · {p.links?.supplements.length ?? 0}
                    </h3>
                    {missingTotal > 1e-6 && (
                      <GridBtn
                        disabled={!perms.canEdit}
                        title={perms.canEdit ? 'Mồi sẵn đơn mới = phần còn thiếu của từng dòng; đổi NCC khác được ngay trên màn' : 'Chỉ người phụ trách đơn tạo đơn bổ sung được'} // prettier-ignore
                        onClick={() => router.push(`/mua-hang/don/moi?bo-sung=${po.id}`)}
                      >
                        + Tạo đơn bổ sung phần đã chốt thiếu
                      </GridBtn>
                    )}
                  </div>
                  <div className="text-k-sm flex flex-wrap gap-2 px-[var(--gutter)] pb-2">
                    {(p.links?.supplements ?? []).length === 0 ? (
                      <span className="text-[var(--ink-2)]">
                        Đã chốt thiếu {fmtNum(missingTotal)} (cộng các dòng) — chưa có đơn
                        bổ sung nào.
                      </span>
                    ) : (
                      (p.links?.supplements ?? []).map((x) => (
                        <GridBtn
                          key={x.id}
                          onClick={() => router.push(`/mua-hang/don/${x.id}`)}
                        >
                          {x.code} · {PO_STATUS_LABEL[x.status as PoStatus] ?? x.status}
                        </GridBtn>
                      ))
                    )}
                  </div>
                </>
              )}
              <div className="px-[var(--gutter)] pt-3" id="kho">
                <h3 className="k-fgrp-h">
                  Chứng từ kho · {p.warehouseDocs.length} phiếu
                </h3>
              </div>
              {p.warehouseDocs.length > 0 ? (
                <ChungTuKhoGrid docs={p.warehouseDocs} />
              ) : (
                <div className="text-k-sm px-[var(--gutter)] pb-3 text-[var(--ink-2)]">
                  Chưa có phiếu nhập hay xuất trả nào ghi vào đơn này.
                </div>
              )}
            </>
          )}
        </FastTab>
      )}
    </>
  )
}
