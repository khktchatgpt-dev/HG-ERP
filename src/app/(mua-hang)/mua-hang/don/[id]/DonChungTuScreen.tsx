'use client'

import { useState } from 'react'
import { SuaVatTuSheet } from '@/app/(mua-hang)/mua-hang/vat-tu/sua-vat-tu'
import { QuickAddMaterial } from '@/app/(mua-hang)/mua-hang/don/_lib/QuickAddMaterial'
import { type PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import { refreshLineFromMaterial } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import {
  previewHeaderFromDraft,
  previewLinesFromDraft,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-preview'
import { PoPrintSheet } from '@/app/print/supply/PoPrintSheet'
import {
  Affected,
  Btn,
  CommitBar,
  Combobox,
  Consequence,
  CoverageBar,
  Crumb,
  DateInput,
  DocBody,
  DocHead,
  DocMenu,
  DocMenuPanel,
  DocScreen,
  DocStatus,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGroup,
  GridBtn,
  HeadChip,
  HeadChips,
  HeadField,
  HolderBar,
  Menu,
  NoticeBar,
  NumInput,
  Pick,
  PrimaryStep,
  Sheet,
  SheetActions,
  SmartLinks,
  StatusBar,
  StatusTrack,
  Tag,
  TextArea,
  TextInput,
  Tick,
} from '@/components/kit'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import { PO_CURRENCIES } from '@/lib/po-line'
import {
  PO_NEXT_HINT,
  PO_STATUS_LABEL,
  PO_TRACK_STEPS,
  receiptTrackTone,
  type PoStatus,
} from '@/lib/po-status'
import { FREE_LINE_TEMPLATES, PO_TEMPLATE_META, type PoTemplate } from '@/lib/po-template'
import { GhiPhiSheet, HuyPhiSheet } from './ChiPhiPanel'
import { CapNhatDanhMucSheet, DanExcelSheet } from './SoanDonPanels'
import { TaiChinhPanel } from './TaiChinhPanel'
import { NguyenNhanField } from './nguyen-nhan'
import { DongSuCoSheet, GhiSuCoSheet } from './TheoDoiPanel'
import { templateForSupplier } from './chung-tu'
import { BangKiem, ChuaGuiNcc, DauDon, NhaCungCapTomTat } from './dau-don'
import {
  Props,
  STATUS_ICON,
  daysBetween,
  dmy,
  fmtNum,
  money,
  numStr,
  signed,
  toNum,
} from './don-chung-tu.shared'
import { DongHang, NhuCau } from './dong-hang'
import { GiaoNhan } from './giao-nhan'
import { SuaTaiChoNut } from './sua-tai-cho-nut'
import { DongThoiGian, TaiLieu } from './lich-su'
import { BanNhap } from './ban-nhap'
import { ChiPhi, PhatSinh } from './tai-chinh-khoi'
import { TongQuanSo } from './tong-quan'
import { TraoDoiKhung } from './trao-doi'
import { useDonChungTu } from './useDonChungTu'
import './soan-don.css'

export type { AdjustmentLite, PoDoc, StatusLineLite } from './don-chung-tu.shared'

/**
 * MÀN CHỨNG TỪ ĐƠN MUA — phần GHÉP BỐ CỤC.
 *
 * Tách 28/09/2026 (bước 3 kế hoạch chất lượng UI) từ một file 4.384 dòng:
 *  · `don-chung-tu.shared.tsx` — kiểu, hằng, ô lưới (ViewCell/EditCell);
 *  · `useDonChungTu.tsx`       — toàn bộ trạng thái + xử lý;
 *  · `dau-don.tsx`, `dong-hang.tsx`, `giao-nhan.tsx`, `tai-chinh-khoi.tsx`,
 *    `lich-su.tsx`, `trao-doi.tsx` — khối giao diện theo mục menu.
 * Soi bằng mắt: `/design-lab/chup/don-ct-*` dựng 9 cảnh của màn này với dữ liệu đóng băng.
 */
export function DonChungTuScreen(p: Props) {
  const d = useDonChungTu(p)
  // Hàng phụ của đầu đơn — tự mở khi đơn đã có giá trị ở đó.
  const [headMore, setHeadMore] = useState<boolean | null>(null)
  const {
    router,
    muc,
    pickMuc,
    toast,
    po,
    me,
    today,
    editing,
    adjusting,
    drafting,
    viewMode,
    adjSheet,
    setAdjSheet,
    sentSheet,
    setSentSheet,
    sentNote,
    setSentNote,
    costs,
    phiOpen,
    setPhiOpen,
    phiVoid,
    setPhiVoid,
    suCoOpen,
    setSuCoOpen,
    suCoClose,
    setSuCoClose,
    termsEdit,
    startEdit,
    dateEdit,
    perms,
    header,
    setHeader,
    lines,
    setLines,
    busy,
    sheet,
    setSheet,
    paste,
    setPaste,
    quickAdd,
    setQuickAdd,
    editMaterial,
    setEditMaterial,
    preview,
    setPreview,
    enrich,
    setEnrich,
    enrichBusy,
    nhap,
    dirty,
    askCancel,
    setAskCancel,
    setHeadOpen,
    reason,
    setReason,
    date,
    setDate,
    dense,
    template,
    meta,
    totals,
    problem,
    adjPlan,
    adjErrors,
    adjBlocked,
    nextSeq,
    notifyWho,
    changeTemplate,
    save,
    saveTerms,
    markSent,
    askCancelEdit,
    cancelEdit,
    runAction,
    sheetInvalid,
    holder,
    track,
    recvIdx,
    veKho,
    supplierOpt,
    moqWarn,
    lsxOptions,
    supplierOptions,
    marks,
    code,
    liveShipments,
    call,
    lsxLabel,
    addFromPaste,
    onCreatedMaterial,
    toggleExtraLsx,
    confirmEnrich,
    goTo,
    goToProblem,
    trackLines,
    moneyRows,
    headActions,
    headMenu,
    nextItem,
    statusMoves,
    statusTone,
    daVeDu,
    lastReceipt,
    mucItems,
    hanText,
    vuong,
    markDirty,
  } = d
  const moreOpen = headMore ?? (header.poType === 'standalone' || header.extraLsxIds.length > 0 || !!header.contractNo || header.currency !== 'VND') // prettier-ignore
  const nccBody = <NhaCungCapTomTat d={d} />
  const notesPanel = <TraoDoiKhung d={d} />
  const blkChecks = <BangKiem d={d} />
  const blkUnsent = <ChuaGuiNcc d={d} />
  const blkLines = <DongHang d={d} />
  const blkPhatSinh = <PhatSinh d={d} />
  const blkNhuCau = <NhuCau d={d} />
  const blkGiao = <GiaoNhan d={d} />
  const blkChiPhi = <ChiPhi d={d} />
  const blkDauDon = <DauDon d={d} />
  const blkTimeline = <DongThoiGian d={d} />
  const blkTaiLieu = <TaiLieu d={d} />

  // Chip đầu trang bấm được khi người này sửa được đơn và không đang ở chế độ sửa nào.
  const chipEdit =
    !!po && perms.canEdit && !editing && !termsEdit && po.status !== 'cancelled'

  /* DÒNG HÀNG TRONG CHẾ ĐỘ SỬA (B3): chênh lệch tính bằng đúng hàm server dùng
     (`planAdjustment`) bày ngay trên lưới ở mục Dòng hàng; thanh nhắc ở đầu trang
     nói phát sinh bao nhiêu hoặc vướng gì — "Lưu" chung với hẹn giao / điều khoản
     / đợt, hộp lý do chỉ mở khi có đổi dòng. */
  const blkChenhBar =
    adjusting &&
    adjPlan &&
    (adjPlan.changes.length > 0 || adjPlan.headerChanges) && // prettier-ignore
    (adjBlocked ? (
      <NoticeBar
        tone="warn"
        tag="Chưa lưu được"
        action={{ label: 'Xem dòng hàng', onClick: () => goTo('dong-hang') }}
      >
        {adjBlocked}
        {adjErrors.length > 1 ? ` · và ${adjErrors.length - 1} vướng nữa` : ''}
      </NoticeBar>
    ) : (
      <NoticeBar
        tone="warn"
        tag={`Điều chỉnh lần ${nextSeq}`}
        action={{ label: 'Lưu', onClick: () => void saveTerms() }}
      >
        Phát sinh <b className="num">{signed(adjPlan.delta.total, header.currency)}</b> so
        với bản đang chạy — lưu là áp dụng ngay, không duyệt lại;{' '}
        {notifyWho
          ? `${notifyWho} nhận thông báo`
          : 'bạn là người đã duyệt đơn này nên không báo ai'}
        . Tới lúc bấm Lưu, Kho vẫn nhận theo bản cũ.
      </NoticeBar>
    ))
  const blkChenh = adjusting && adjPlan && po && (
    <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--line)] bg-[var(--surface-card)] md:grid-cols-2">
      <div>
        <FieldGroup title="Chênh lệch so với bản đang chạy">
          <Field label="Tổng đang chạy">
            <span className="num">
              {money(adjPlan.money.before.grandTotal, header.currency)}
            </span>
          </Field>
          <Field label="Tổng sau điều chỉnh">
            <span className="num">
              {money(adjPlan.money.after.grandTotal, header.currency)}
            </span>
          </Field>
          <Field label={`Phát sinh lần ${nextSeq}`}>
            <b className="num">{signed(adjPlan.delta.total, header.currency)}</b>
          </Field>
          <Field label="Tiền hàng: vì giá · vì lượng">
            <span
              className="num"
              title="vì giá = SL mới × (giá mới − giá cũ) · vì lượng = (SL mới − SL cũ) × giá cũ"
            >
              {signed(adjPlan.delta.byPrice, header.currency)} ·{' '}
              {signed(adjPlan.delta.byQty, header.currency)}
            </span>
          </Field>
        </FieldGroup>
      </div>
      <div>
        <FieldGroup title="Giữ nguyên khi điều chỉnh">
          <Field label="Nhà cung cấp" inherited>
            {po.supplier_name}
          </Field>
          <Field label="Lệnh · mẫu · tiền tệ" inherited>
            <span className="num">{po.lsx_code ?? 'ngoài LSX'}</span> · {meta.label} ·{' '}
            {po.currency}
          </Field>
          <Field label="Thuế suất %">
            <NumInput
              aria-label="Thuế suất"
              value={numStr(header.vat)}
              onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
            />
          </Field>
          {meta.hasDiscount && (
            <Field label="Chiết khấu">
              <NumInput
                aria-label="Chiết khấu"
                value={numStr(header.discount)}
                onCommit={(v) => setHeader((h) => ({ ...h, discount: toNum(v) }))}
              />
            </Field>
          )}
        </FieldGroup>
        <div className="text-k-label px-[var(--gutter)] pb-2 text-[var(--ink-3)]">
          Đổi nhà cung cấp thì Huỷ đơn rồi Nhân bản sang NCC mới. Hẹn giao, điều khoản
          (mục Tổng quan) và đợt giao (mục Giao &amp; nhận) lưu cùng một lượt với dòng
          hàng.
        </div>
      </div>
    </div>
  )

  const viewHead = po ? (
    <>
      <DocHead
        compact
        kind="Đơn đặt vật tư"
        code={code}
        sub={
          <>
            {termsEdit && (
              <>
                <Tag tone="warn">
                  {adjusting
                    ? `Đang sửa · điều chỉnh lần ${nextSeq} · chưa lưu`
                    : 'Đang sửa · chưa lưu'}
                </Tag>{' '}
              </>
            )}
            soạn {dmy(po.created_at)} · {po.assignee_name ?? '—'}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {termsEdit ? (
            <SuaTaiChoNut d={d} />
          ) : (
            <>
              {headActions.map(({ key, it }) => (
                <Btn key={key} icon={it.icon} disabled={busy} onClick={it.run}>
                  {it.label}
                </Btn>
              ))}
              {headMenu.length > 0 && (
                <Menu label="⋯" ariaLabel="Các việc khác của đơn" items={headMenu} />
              )}
            </>
          )}
        </div>
      </DocHead>
      <HeadChips>
        <HeadChip
          label="Nhà cung cấp"
          value={
            p.supplier?.code
              ? `${po.supplier_name} · ${p.supplier.code}`
              : po.supplier_name
          }
          onClick={() => router.push(`/mua-hang/ncc/${po.supplier_id}`)}
        />
        {daVeDu ? (
          <HeadChip
            label="Về đủ"
            value={
              lastReceipt ? `${dmy(lastReceipt.at)} · ${lastReceipt.code}` : 'đã về đủ'
            }
          />
        ) : (
          /* BẤM VÀO CHỖ MUỐN SỬA (B1, 28/09/2026): chip mở chế độ Sửa và đưa con
             trỏ vào đúng ô — thay cho ⋯ → Đổi hẹn giao ở tầng 3. */
          <HeadChip
            label="Hạn giao"
            /* Đang sửa: chip là chính ô nhập (artboard 14) — cùng state với ô ở khối Đầu đơn. */
            value={termsEdit && dateEdit.ok ? <DateInput label="Hạn giao — chip" value={header.expectedAt} onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))} /> : hanText} // prettier-ignore
            onClick={chipEdit && dateEdit.ok ? () => startEdit('Hạn giao') : undefined}
          />
        )}
        <HeadChip
          label="Tổng thanh toán"
          value={money(totals.grandTotal, header.currency)}
        />
        <HeadChip
          label="Lệnh SX"
          value={[po.lsx_code, ...p.extraLsx.map((l) => l.code)].filter(Boolean).join(' + ') || 'ngoài lệnh'} // prettier-ignore
          onClick={po.production_order_id ? () => router.push(`/mua-hang/yeu-cau/${po.production_order_id}`) : undefined} // prettier-ignore
        />
        {p.links?.source && (
          <HeadChip
            label="Bổ sung cho"
            value={p.links.source.code}
            onClick={() => router.push(`/mua-hang/don/${p.links!.source!.id}`)}
          />
        )}
      </HeadChips>
      {/* Hàng chip PHỤ, không khung (28/09/2026) — Thanh toán/Nơi giao đứng
          lẻ sau 4 chip chính khung đầy một hàng; chip khung thêm ở đây vỡ
          dòng còn 1-2 ô trống nửa hàng, đo trên PO-2026-0087. */}
      <HeadChips>
        <HeadChip
          label="Thanh toán"
          value={po.terms_payment}
          muted
          plain
          onClick={chipEdit ? () => startEdit('Thanh toán') : undefined}
        />
        <HeadChip
          label="Nơi giao"
          value={po.terms_delivery_place}
          muted
          plain
          onClick={chipEdit ? () => startEdit('Nơi giao') : undefined}
        />
      </HeadChips>
      <DocStatus
        status={PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}
        icon={STATUS_ICON[po.status as PoStatus] ?? 'thongTin'}
        tone={statusTone}
        marks={marks}
        holder={holder && holder.who !== '—' ? { who: holder.who, what: holder.what, mine: holder.mine, days: holder.since ? daysBetween(holder.since, today) : null } : undefined} // prettier-ignore
        next={nextItem ? <PrimaryStep label={nextItem.label} icon={nextItem.icon} busy={busy} onClick={nextItem.run} why={nextItem.blocked} /> : undefined} // prettier-ignore
        moves={statusMoves}
      />
      {blkChecks}
      {blkChenhBar}
      {blkUnsent}
      <DocBody>
        <DocMenu
          label="Nội dung đơn"
          items={mucItems}
          value={muc}
          onValueChange={pickMuc}
        >
          <DocMenuPanel value="tong-quan">
            <TongQuanSo d={d} />
            <div className="grid grid-cols-1 border-b border-[var(--line)] md:grid-cols-2">
              <div className="md:border-r md:border-[var(--line)]">
                <FastTab fixed title="Vướng gì" summary={[['Việc', vuong.length]]}>
                  {vuong.length === 0 ? (
                    <div className="text-k-body flex items-center gap-2 text-[var(--ink-2)]">
                      <Tag tone="done">Ổn</Tag> Không có gì vướng ở bước này.
                    </div>
                  ) : (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {vuong.map((v) => (
                        <li
                          key={v.text}
                          className="text-k-body flex items-center gap-2.5 border-t border-[var(--hair)] py-2 first:border-t-0 first:pt-0"
                        >
                          <Tag tone={v.tone}>{v.tag}</Tag>
                          <span className="min-w-0 grow">{v.text}</span>
                          <GridBtn onClick={() => pickMuc(v.muc)}>{v.goLabel} ›</GridBtn>
                        </li>
                      ))}
                    </ul>
                  )}
                </FastTab>
              </div>
              <FastTab fixed title="Nhà cung cấp">
                {nccBody}
              </FastTab>
            </div>
            {blkDauDon}
          </DocMenuPanel>
          <DocMenuPanel value="dong-hang">
            {blkChenh}
            {blkLines}
          </DocMenuPanel>
          <DocMenuPanel value="giao-nhan">{blkGiao}</DocMenuPanel>
          <DocMenuPanel value="tai-chinh">
            <TaiChinhPanel
              finance={p.finance ?? null}
              poId={po.id}
              orderedGross={totals.grandTotal}
              lineCount={lines.length}
              vatLabel={`VAT ${header.vat === '' ? 0 : header.vat}%`}
              termsPayment={po.terms_payment}
              termsInvoice={po.terms_invoice}
              canInvoice={!!p.canInvoice}
              onAskInvoice={() => pickMuc('trao-doi')}
              extra={
                <>
                  {blkPhatSinh}
                  {blkChiPhi}
                </>
              }
            />
          </DocMenuPanel>
          <DocMenuPanel value="trao-doi">
            <div id="trao-doi" className="max-w-3xl p-4">
              {notesPanel}
            </div>
          </DocMenuPanel>
          <DocMenuPanel value="lich-su">
            {blkTimeline}
            {blkTaiLieu}
          </DocMenuPanel>
        </DocMenu>
      </DocBody>
    </>
  ) : null

  return (
    <DocScreen dense={dense}>
      {viewMode && (
        <Crumb
          path={[{ label: 'Đơn mua', href: '/mua-hang/don' }, code]}
          position={p.position ? [p.position.index, p.position.total] : undefined}
        />
      )}

      {viewMode && po && viewHead}

      {!viewMode && (
        <>
          {/* Chế độ soạn/sửa KHÔNG còn thanh nút trên đầu (29/09/2026): Huỷ · Xem trước
              · Tạo đơn/Lưu nằm ở thanh chốt dính đáy, cạnh tổng tiền và câu chặn. */}
          <DocHead
            compact
            kind="Đơn đặt vật tư"
            code={code}
            /*
          NHÃN "ĐANG SỬA" BẮT THEO VIỆC, KHÔNG BẮT THEO "ĐÃ CÓ ĐƠN LƯU".

          Bản cũ viết `po ? (tiêu đề thường) : (<Tag>Đang sửa</Tag>)` — tức nhãn
          chỉ hiện khi CHƯA có đơn nào lưu, nghĩa là chỉ ở màn tạo mới. Sửa một
          đơn nháp ĐÃ LƯU thì `po` có giá trị nên rơi vào nhánh đầu và đầu chứng
          từ trông y hệt lúc đọc: cùng tiêu đề, cùng trục trạng thái, chỉ khác ở
          chỗ các ô đã thành ô nhập. Chủ dự án báo 15/09/2026 "không rõ cảnh báo
          rằng đang trong trạng thái chỉnh sửa" — đúng, và đây là dòng gây ra.
        */
            sub={
              editing ? (
                <>
                  <Tag tone="warn">
                    {p.mode === 'create' ? 'Đang tạo · chưa lưu' : 'Đang sửa · chưa lưu'}
                  </Tag>{' '}
                  {po?.supplier_name ?? supplierOpt?.name ?? 'chưa chọn nhà cung cấp'}
                </>
              ) : (
                <>
                  {po?.supplier_name} · soạn {dmy(po?.created_at)} bởi{' '}
                  {po?.assignee_name ?? '—'}
                </>
              )
            }
          >
            {po && !editing && (
              <>
                {/*
              MỐC THẬT CHO TỪNG BƯỚC — xem `marks` ở `StatusTrack`.

              Ba bước có cột lưu mốc (`approved_at`, `ordered_at`,
              `confirmed_at`); trống nghĩa là bước đó chưa từng chạy, và dải
              phải nói ra thay vì tick xanh. Hai bước "Chờ duyệt" và "Đang
              giao" không có cột nào — truyền `undefined` để dải không kết luận
              gì về chúng, đúng hơn là bịa ra một dấu ✓ hay một dấu hỏi.
            */}
                <StatusTrack
                  label="Trạng thái đơn"
                  steps={[...PO_TRACK_STEPS]}
                  at={track.at}
                  tone={track.tone}
                  marks={[
                    dmy(po.created_at),
                    undefined,
                    po.approved_at ? dmy(po.approved_at) : null,
                    po.ordered_at ? dmy(po.ordered_at) : null,
                    po.confirmed_at ? dmy(po.confirmed_at) : null,
                    undefined,
                  ]}
                  terminal={track.terminal}
                />
                <StatusTrack
                  label="Nhận hàng"
                  steps={['Chưa', 'Một phần', 'Đủ']}
                  at={recvIdx}
                  tone={receiptTrackTone(recvIdx)}
                />
                {/* VỀ ĐƯỢC BAO NHIÊU — con số, không phải ba cái chip.

                Trục "Nhận hàng" chỉ nói Chưa / Một phần / Đủ. "Một phần" là 1
                trong 4 dòng hay 39 trong 40 dòng thì cũng cùng một chữ, mà hai
                tình huống đó quyết định khác hẳn nhau: một cái phải gọi NCC
                ngay, một cái chờ nốt là xong. Chủ dự án hỏi đúng câu này —
                "có về hàng chưa, về được bao nhiêu".

                Đếm theo DÒNG chứ không theo số lượng cộng dồn: cộng 1.950 cái
                nút với 8.504 con sò ra một con số vô nghĩa. Dòng đã chốt thiếu
                tính là xong, cùng luật với `qty_open` mà sổ kho dùng. */}
                {veKho && (
                  <div>
                    <div className="k-track-lab">Về kho</div>
                    <CoverageBar
                      ratio={veKho.ratio}
                      label={`${veKho.du}/${veKho.tong} dòng`}
                    />
                  </div>
                )}
              </>
            )}
          </DocHead>

          {/* Nút thông minh — chép Odoo. Số đếm là lời hứa: bấm ra đúng chừng ấy. */}
          {po && !editing && (
            <SmartLinks
              items={[
                { label: 'đợt giao', count: liveShipments.length, onClick: () => goTo('dot-giao'), title: 'Kế hoạch giao NCC hẹn' }, // prettier-ignore
                { label: 'phiếu kho', count: p.warehouseDocs.length, onClick: () => goTo('kho'), title: 'Phiếu nhập / trả đã ghi vào đơn' }, // prettier-ignore
                ...(costs.length > 0 ? [{ label: 'phiếu phí', count: costs.length, onClick: () => goTo('chi-phi'), title: 'Phí vận chuyển / bốc xếp gắn đơn này (kể cả phiếu đã huỷ)' }] : []), // prettier-ignore
                { label: 'lệnh SX', count: (po.production_order_id ? 1 : 0) + p.extraLsx.length, onClick: () => po.production_order_id && router.push(`/mua-hang/yeu-cau/${po.production_order_id}`), disabled: !po.production_order_id }, // prettier-ignore
                { label: 'trao đổi', count: null, onClick: () => goTo('trao-doi'), title: 'Ghi chú và mốc máy ghi trên đơn này' }, // prettier-ignore
                { label: 'tài liệu', count: null, onClick: () => goTo('tai-lieu'), title: 'Báo giá, hợp đồng, chứng từ giao nhận' }, // prettier-ignore
              ]}
            />
          )}

          {holder && !editing && (
            <HolderBar
              mine={holder.mine}
              who={holder.who}
              what={holder.what}
              age={holder.since ? `${daysBetween(holder.since, today)} ngày` : undefined}
            />
          )}
          {blkChecks}
          {drafting && p.sourcePo && (
            <NoticeBar tone="warn" tag="Đơn bổ sung">
              Bổ sung cho <b>{p.sourcePo.code}</b> — dòng mồi sẵn là phần NCC còn giao
              thiếu. Đổi nhà cung cấp được ở Đầu đơn nếu NCC cũ không giao nổi.
            </NoticeBar>
          )}
          {drafting && moqWarn && (
            <NoticeBar tone="warn" tag="MOQ">
              {moqWarn}
            </NoticeBar>
          )}
          {drafting && <BanNhap nhap={nhap} />}
          {blkUnsent}
        </>
      )}

      {!viewMode && (
        <DocBody
          wideAside={!!po}
          // Lúc soạn: bỏ cột phải 268px (tiền đã ở thanh chốt đáy) — lưới chiếm trọn bề ngang.
          aside={
            drafting ? undefined : (
              <FactBox>
                <FactSection title="Tiền">
                  <FactKv rows={moneyRows} />
                </FactSection>
                <FactSection title="Nhà cung cấp">{nccBody}</FactSection>
                {/*
              TRAO ĐỔI Ở CỘT PHẢI (duyệt 26/09/2026 — chép chatter Odoo 17). Trước
              đó là khối gập thứ 6 ở thân, đỉnh y≈981: mở đơn ra không thấy ai đã
              nói gì, và cả hệ thống mới có 1 ghi chú. Mở sẵn lọc "Ghi chú" — mốc
              máy đã có khối "Dòng thời gian" riêng. "Gửi nhà cung cấp" đổi thành
              "Đã báo NCC · ghi lại": hệ thống KHÔNG gửi gì cho NCC, nhãn cũ nói sai.
            */}
                {po && (
                  <div id="trao-doi">
                    <FactSection title="Trao đổi">{notesPanel}</FactSection>
                  </div>
                )}
              </FactBox>
            )
          }
        >
          {/* ══ 0. ĐẦU ĐƠN — HÀNG CHIP (29/09/2026, artboard 19 · khuôn F) ══
            Ô nào ở đây cũng là ĐIỀU KIỆN của lưới (mẫu → cột, lệnh → nhu cầu,
            NCC → tiền tệ + giá gợi ý, thuế → chân lưới) nên vẫn đứng TRÊN lưới.
            Nhưng lưới 3 cột 13 ô cũ cao ~200px, 3 ô chỉ đọc, đẩy dòng hàng đầu
            xuống y≈435 — nay co thành một hàng `HeadField` (ô gõ thật trong chip,
            KHÔNG để ô nhập trong `HeadChip` vì đó là nút). Ô ít đổi (tiền tệ, VAT —
            thanh chốt đáy đã bày cả hai) vào hàng phụ, tự mở khi đơn có giá trị ở đó. */}
          {drafting && (
            <div className="flex flex-col gap-1 border-b border-[var(--line)] bg-[var(--surface-card)]">
              <HeadChips>
                <HeadField
                  label="Lệnh"
                  need={header.poType === 'lsx'}
                  empty={!header.lsxId}
                  width={150}
                >
                  <Combobox
                    label="Lệnh sản xuất"
                    disabled={header.poType !== 'lsx'}
                    value={header.lsxId}
                    onChange={(v) => setHeader((h) => ({ ...h, lsxId: v }))}
                    emptyLabel={header.poType === 'lsx' ? '— chọn lệnh —' : 'ngoài lệnh'}
                    placeholder="Gõ số lệnh hoặc tên khách…"
                    options={lsxOptions}
                  />
                </HeadField>
                <HeadField label="NCC" need empty={!header.supplierId} width={180}>
                  <Combobox
                    label="Nhà cung cấp"
                    value={header.supplierId}
                    onChange={(v) => {
                      const s = p.suppliers.find((x) => x.id === v)
                      setHeader((h) => ({
                        ...h,
                        supplierId: v,
                        // Tiền tệ theo NCC (gỗ báo USD) — trừ khi đã tự chọn.
                        currency: !dirty.current.currency && s?.currency ? s.currency.toUpperCase() : h.currency, // prettier-ignore
                      }))
                      // Mẫu theo đơn gần nhất của NCC (kéo theo VAT / "giá gồm VAT"
                      // của mẫu đó) — chỉ khi đơn mới và người soạn chưa tự chọn mẫu.
                      const t = templateForSupplier({ supplierId: v, current: template, touched: dirty.current.template, isNew: !po, last: p.lastTemplates ?? {} }) // prettier-ignore
                      if (t) {
                        changeTemplate(t)
                        toast.info(`Mẫu đơn: ${PO_TEMPLATE_META[t].label}`, 'Theo đơn gần nhất của NCC này — đổi được ở ô "Mẫu đơn".') // prettier-ignore
                      }
                    }}
                    emptyLabel="— chọn NCC —"
                    placeholder="Gõ tên nhà cung cấp…"
                    options={supplierOptions}
                  />
                </HeadField>
                <HeadField label="Mẫu" width={130}>
                  <Pick
                    label="Mẫu đơn"
                    width={130}
                    value={template}
                    onChange={(t) => {
                      markDirty('template')
                      changeTemplate(t as PoTemplate)
                    }}
                    options={Object.values(PO_TEMPLATE_META).map((m) => ({ value: m.key, label: m.label }))} // prettier-ignore
                  />
                </HeadField>
                <HeadField label="Hạn giao" width={116}>
                  <DateInput
                    label="Hạn giao"
                    value={header.expectedAt}
                    onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
                  />
                </HeadField>
                <GridBtn
                  onClick={() => setHeadMore(!moreOpen)}
                  title="Tiền tệ · VAT · Giá gồm VAT · Loại đơn · Gộp lệnh · Số HĐ"
                >
                  {moreOpen
                    ? 'Ẩn bớt'
                    : `${header.currency} · VAT ${header.vat === '' ? 0 : header.vat}% ▾`}
                </GridBtn>
              </HeadChips>
              {supplierOpt?.can_order === false && (
                <span
                  className="k-t-stop text-k-label px-[var(--gutter)]"
                  title={supplierOpt.lock_reason ?? undefined}
                >
                  NCC này đang khoá đặt hàng
                  {supplierOpt.lock_reason ? ` — ${supplierOpt.lock_reason}` : ''}
                </span>
              )}
              {moreOpen && (
                <HeadChips>
                  <HeadField label="Tiền" width={70}>
                    <Pick
                      label="Tiền tệ"
                      value={header.currency}
                      onChange={(v) => {
                        markDirty('currency')
                        setHeader((h) => ({ ...h, currency: v }))
                      }}
                      options={PO_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </HeadField>
                  <HeadField label="VAT %" width={48}>
                    <NumInput
                      aria-label="Thuế suất"
                      value={numStr(header.vat)}
                      onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
                    />
                  </HeadField>
                  <HeadField label="Loại đơn" width={150}>
                    <Pick
                      label="Loại đơn"
                      value={header.poType}
                      onChange={(v) => setHeader((h) => ({ ...h, poType: v as PoHeader['poType'], lsxId: v === 'standalone' ? '' : h.lsxId }))} // prettier-ignore
                      options={[
                        { value: 'lsx', label: 'Theo lệnh sản xuất' },
                        { value: 'standalone', label: 'Ngoài lệnh (mua bù tồn)' },
                      ]}
                    />
                  </HeadField>
                  {header.poType === 'lsx' && (
                    <HeadField label="Gộp lệnh">
                      <span className="flex flex-wrap items-center gap-1">
                        {header.extraLsxIds.map((id) => (
                          <GridBtn
                            key={id}
                            title="Bỏ lệnh này khỏi đơn"
                            onClick={() => toggleExtraLsx(id, false)}
                          >
                            {p.lsxs.find((l) => l.id === id)?.code ?? '?'} ×
                          </GridBtn>
                        ))}
                        <Combobox
                          label="Gộp thêm lệnh"
                          value=""
                          onChange={(v) => v && toggleExtraLsx(v, true)}
                          emptyLabel={header.extraLsxIds.length ? '+ thêm lệnh nữa' : '— một đơn, nhiều lệnh —'} // prettier-ignore
                          placeholder="Gõ số lệnh…"
                          options={lsxOptions.filter((o) => o.value !== header.lsxId && !header.extraLsxIds.includes(o.value))} // prettier-ignore
                        />
                      </span>
                    </HeadField>
                  )}
                  <HeadField label="Số HĐ" width={120}>
                    <TextInput
                      label="Số hợp đồng"
                      value={header.contractNo}
                      onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                      mono
                    />
                  </HeadField>
                  <HeadField label="Giá gồm VAT">
                    <Tick
                      label="Đơn giá đã gồm VAT"
                      checked={header.inclVat}
                      onChange={(v) => {
                        // Tự tick / bỏ tick = đã tự chỉnh: đổi mẫu sau đó không được áp lại.
                        markDirty('vat')
                        setHeader((h) => ({ ...h, inclVat: v }))
                      }}
                    />
                  </HeadField>
                  {meta.hasDiscount && (
                    <HeadField label="Chiết khấu" width={100}>
                      <NumInput
                        aria-label="Chiết khấu"
                        value={numStr(header.discount)}
                        onCommit={(v) => setHeader((h) => ({ ...h, discount: toNum(v) }))}
                      />
                    </HeadField>
                  )}
                  {supplierOpt &&
                    (supplierOpt.lead_time_days != null || supplierOpt.payment_terms) && (
                      <span className="text-k-label text-[var(--ink-3)]">
                        NCC giao{' '}
                        {supplierOpt.lead_time_days != null
                          ? `${supplierOpt.lead_time_days} ngày`
                          : '—'}{' '}
                        · thanh toán {supplierOpt.payment_terms ?? '—'}
                      </span>
                    )}
                </HeadChips>
              )}
            </div>
          )}

          {/* Lúc SOẠN chỉ còn việc soạn (duyệt 30/09/2026): dòng hàng → nhu cầu lệnh (khi còn
              thiếu) → chia đợt (khi bấm) → điều khoản & ghi chú. Khối chỉ để XEM thì ẩn. */}
          {blkLines}
          {blkNhuCau}
          {(d.shipCols.length > 0 || d.dotMo) && blkGiao}
          {blkDauDon}
        </DocBody>
      )}

      {drafting && (
        <CommitBar
          totals={[
            // Giá ĐÃ gồm VAT: VAT TÁCH RA từ tiền hàng — nói trên nhãn như phiếu in (05/10/2026).
            { label: header.inclVat ? 'Tiền hàng (đã gồm VAT)' : 'Tiền hàng', value: money(totals.subtotal, header.currency) }, // prettier-ignore
            { label: `VAT ${header.vat === '' ? 0 : header.vat}%${header.inclVat ? ' (đã gồm)' : ''}`, value: money(totals.vatAmount, header.currency) }, // prettier-ignore
          ]}
          grand={{
            label: 'Tổng thanh toán',
            value: money(totals.grandTotal, header.currency),
          }}
          blocked={problem ?? undefined}
          onGoBlocked={problem ? () => goToProblem(problem) : undefined}
          actions={
            <span className="flex shrink-0 items-center gap-2">
              <Btn icon="huy" disabled={busy} onClick={askCancelEdit}>
                Huỷ
              </Btn>
              <Btn icon="in" disabled={!p.company} onClick={() => setPreview(true)}>
                Xem trước
              </Btn>
              <Btn
                onClick={() => {
                  setHeadOpen(true)
                  goTo('dau-don')
                }}
              >
                Điều khoản
              </Btn>
              <Btn
                primary
                icon="luuNhap"
                busy={busy}
                disabled={!!problem}
                onClick={() => void save()}
              >
                {p.mode === 'create' ? 'Tạo đơn' : 'Lưu'}
              </Btn>
            </span>
          }
        />
      )}

      {viewMode && (
        <StatusBar
          left={[
            <>
              <b>{me.name}</b> · Mua hàng
            </>,
            editing || termsEdit
              ? 'Đang sửa — chưa lưu'
              : (PO_NEXT_HINT[(po?.status ?? 'draft') as PoStatus] ?? ''),
          ]}
          right={`${po?.code} · ${PO_STATUS_LABEL[po?.status as PoStatus] ?? po?.status}`}
        />
      )}

      {askCancel && (
        <Sheet
          open
          onClose={() => setAskCancel(false)}
          stakes="nang"
          title={
            adjusting
              ? 'Bỏ điều chỉnh?'
              : p.mode === 'create'
                ? 'Bỏ đơn đang soạn?'
                : 'Bỏ các thay đổi?'
          }
          subtitle={
            adjusting || termsEdit
              ? 'Các thay đổi chưa lưu sẽ mất — đơn giữ nguyên bản đang chạy.'
              : `${lines.length} dòng đang gõ sẽ mất. Bản nháp tự lưu cũng bị xoá.`
          }
          footer={
            <SheetActions
              stakes="nang"
              onCancel={() => setAskCancel(false)}
              onConfirm={cancelEdit}
              cancelLabel={adjusting ? 'Sửa tiếp' : 'Soạn tiếp'}
              confirmLabel={
                adjusting
                  ? 'Bỏ điều chỉnh'
                  : p.mode === 'create'
                    ? 'Bỏ đơn'
                    : 'Bỏ thay đổi'
              }
            />
          }
        >
          <Consequence>
            {adjusting
              ? 'Chưa có gì vào sổ: đơn, Kho và NCC vẫn theo bản đang chạy.'
              : 'Muốn giữ lại để làm tiếp sau thì bấm “Soạn tiếp” rồi Lưu — đơn lưu ở nháp, chưa gửi ai.'}
          </Consequence>
        </Sheet>
      )}
      {adjSheet && po && adjPlan && (
        <Sheet
          open
          onClose={() => setAdjSheet(false)}
          stakes="vua"
          width={640}
          title={`Áp dụng điều chỉnh lần ${nextSeq} · ${po.code}`}
          subtitle="Không cần duyệt lại. Phần chênh ghi thành phát sinh riêng để kế toán theo dõi."
          footer={
            <SheetActions
              stakes="vua"
              busy={busy}
              onCancel={() => setAdjSheet(false)}
              onConfirm={() => void saveTerms(true)}
              cancelLabel="Quay lại sửa"
              confirmLabel="Áp dụng"
              disabled={d.nn.block(d.adjLinkedLsx) != null || adjBlocked != null}
            />
          }
        >
          <Affected
            max={20}
            items={[
              ...adjPlan.changes.map((c) => ({ code: c.kind === 'added' ? `Thêm · dòng ${c.no}` : c.kind === 'removed' ? `Bỏ · dòng cũ ${c.no}` : `Dòng ${c.no}`, label: `${c.code ? `${c.code} ` : ''}${c.name}${c.kind === 'changed' ? ` — ${c.qty_before !== c.qty_after ? `SL ${fmtNum(c.qty_before ?? 0)} → ${fmtNum(c.qty_after ?? 0)} ` : ''}${c.price_before !== c.price_after ? `giá ${fmtNum(c.price_before ?? 0)} → ${fmtNum(c.price_after ?? 0)} ` : ''}${c.fields.length ? `đổi ${c.fields.join(', ')}` : ''}` : ''}`, amount: signed(c.amount_after - c.amount_before, header.currency) })), // prettier-ignore
              ...(adjPlan.headerChanges?.vat_rate ? [{ code: 'VAT', label: `${adjPlan.headerChanges.vat_rate[0] ?? 0}% → ${adjPlan.headerChanges.vat_rate[1] ?? 0}%` }] : []), // prettier-ignore
              ...(adjPlan.headerChanges?.discount_amount ? [{ code: 'Chiết khấu', label: `${fmtNum(adjPlan.headerChanges.discount_amount[0])} → ${fmtNum(adjPlan.headerChanges.discount_amount[1])}` }] : []), // prettier-ignore
            ]}
          />
          <FactKv
            rows={[
              ['Tổng đang chạy', <span key="a" className="num">{money(adjPlan.money.before.grandTotal, header.currency)}</span>], // prettier-ignore
              ['Tổng mới', <span key="b" className="num">{money(adjPlan.money.after.grandTotal, header.currency)}</span>], // prettier-ignore
              [`Phát sinh lần ${nextSeq}`, <b key="c" className="num">{signed(adjPlan.delta.total, header.currency)}</b>], // prettier-ignore
              ['Báo cho', <span key="d">{notifyWho ?? 'không ai — bạn là người đã duyệt đơn này'}</span>], // prettier-ignore
            ]}
          />
          <NguyenNhanField d={d} />
          <Consequence>
            Bản mới thay ngay bản đang chạy: Kho nhận theo số mới từ lúc này, đơn vẫn ở
            bước hiện tại. Khoản phát sinh vào sổ, không xoá được — muốn đảo thì điều
            chỉnh lần sau. Nhớ in phiếu gửi lại NCC rồi bấm “Ghi đã gửi NCC”.
          </Consequence>
        </Sheet>
      )}
      {sentSheet != null && po && (
        <Sheet
          open
          onClose={() => setSentSheet(null)}
          stakes="nhe"
          title={`Ghi đã gửi NCC bản điều chỉnh lần ${sentSheet}`}
          subtitle={`${po.code} · ${po.supplier_name}`}
          footer={
            <SheetActions
              stakes="nhe"
              busy={busy}
              onCancel={() => setSentSheet(null)}
              onConfirm={() => void markSent()}
              confirmLabel="Ghi đã gửi"
            />
          }
        >
          <Field label="Gửi qua đâu (tuỳ chọn)">
            <TextInput
              label="Gửi qua đâu"
              value={sentNote}
              onCommit={setSentNote}
              placeholder="Zalo anh Nguyên · email · in giấy gửi xe…"
            />
          </Field>
          <Consequence>
            Ghi mốc lên dòng thời gian đơn, tắt nhắc “chưa tới NCC”.
          </Consequence>
        </Sheet>
      )}
      {
        paste &&
        <DanExcelSheet allowFree={FREE_LINE_TEMPLATES.includes(template)} onClose={() => setPaste(false)} onConfirm={addFromPaste} /> // prettier-ignore
      }
      {
        editing &&
        <QuickAddMaterial open={quickAdd} onOpenChange={setQuickAdd} template={template} onCreated={onCreatedMaterial} /> // prettier-ignore
      }
      {editing && editMaterial && (
        // Panel kit dùng chung với danh mục (29/09/2026); dòng cùng vật tư hút lại số mới.
        <SuaVatTuSheet
          key={editMaterial}
          id={editMaterial}
          onClose={() => setEditMaterial(null)}
          onSaved={(m) => {
            setLines((ls) => { const nhieu = ls.filter((l) => l.material_id === m.id).length > 1; return ls.map((l) => (l.material_id === m.id ? refreshLineFromMaterial(template, l, m, nhieu) : l)) }) // prettier-ignore
            invalidateMaterialPickCache()
            setEditMaterial(null)
          }}
        />
      )}
      {enrich && (
        <CapNhatDanhMucSheet
          items={enrich.items}
          busy={enrichBusy}
          onSkip={() => { const d = enrich.dest; setEnrich(null); router.replace(d); router.refresh() }} // prettier-ignore
          onConfirm={(picked) => void confirmEnrich(picked)}
        />
      )}
      {preview && p.company && (
        <Sheet
          open
          onClose={() => setPreview(false)}
          width={900}
          title="Xem trước phiếu đặt hàng"
          subtitle="Dựng từ bản đang gõ — chưa lưu, chưa có số phiếu."
        >
          {' '}
          {/* prettier-ignore */}
          <PoPrintSheet
            company={p.company}
            tpl={p.tpl}
            po={previewHeaderFromDraft(header, { code: po?.code ?? '(cấp khi lưu)', supplierName: supplierOpt?.name ?? '—', lsxCode: lsxLabel, orderCode: null, createdAt: po?.created_at ?? new Date().toISOString() })} // prettier-ignore
            supplier={supplierOpt ? { name: supplierOpt.name } : null}
            lines={previewLinesFromDraft(template, lines)}
          />
        </Sheet>
      )}
      {phiOpen && po && (
        <GhiPhiSheet
          po={{ id: po.id, code: po.code, supplierId: po.supplier_id, supplierName: po.supplier_name }} // prettier-ignore
          me={p.me}
          payers={p.payers ?? []}
          busy={busy}
          onClose={() => setPhiOpen(false)}
          onSubmit={(body) =>
            call('/api/dept/supply/po-costs', 'POST', body, 'Đã ghi phiếu chi phí')
          }
        />
      )}
      {suCoOpen && po && (
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
          onSubmit={(resolution) =>
            call(
              `/api/dept/supply/po-issues/${suCoClose.id}/resolve`,
              'POST',
              { resolution },
              'Đã đóng sự cố',
            )
          }
        />
      )}
      {phiVoid && (
        <HuyPhiSheet
          cost={phiVoid}
          busy={busy}
          onClose={() => setPhiVoid(null)}
          onSubmit={(reason) =>
            call(
              `/api/dept/supply/po-costs/${phiVoid.id}/void`,
              'POST',
              { reason },
              'Đã huỷ phiếu chi phí',
            )
          }
        />
      )}
      {sheet && po && (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={`${sheet.action.label} · ${po.code}`}
          stakes={sheet.action.stakes}
          footer={
            <SheetActions
              stakes={sheet.action.stakes}
              busy={busy}
              onCancel={() => setSheet(null)}
              onConfirm={() => void runAction(sheet.action)}
              confirmLabel={sheet.action.confirmLabel ?? sheet.action.label}
              /**
               * `sheetInvalid` trước đây chỉ hiện DÒNG CHỮ nhắc mà không khoá
               * nút: bấm được, rồi zod ở biên trả 400 và người dùng nhận toast
               * "Không làm được". Đúng thứ luật kiểm của sổ thiết kế cấm —
               * hành động bị chặn phải nói vướng gì NGAY TẠI CHỖ, không cho
               * bấm rồi mới báo lỗi.
               */
              disabled={sheetInvalid}
            />
          }
        >
          {sheet.action.consequence && (
            <Consequence>{sheet.action.consequence}</Consequence>
          )}
          {sheet.action.needDate && (
            <label className="mb-3 block">
              <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
                Ngày giao mới
              </span>
              <DateInput value={date} onChange={setDate} label="Ngày giao mới" />
            </label>
          )}
          {sheet.action.needReason && (
            <label className="block">
              <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
                {sheet.action.reasonLabel}
              </span>
              <TextArea value={reason} onChange={setReason} rows={3} />
              <span className="text-k-sm mt-1 block leading-relaxed text-[var(--ink-3)]">
                {sheet.action.reasonHint}
              </span>
            </label>
          )}
          {sheetInvalid && (
            <p className="text-k-sm mt-3 font-semibold text-[var(--warn)]">
              {sheet.action.needDate && !date
                ? 'Chọn ngày giao mới trước đã.'
                : 'Viết một câu — người sau đọc để khỏi hỏi lại.'}
            </p>
          )}
          {sheet.action.id === 'delete' && (
            <Affected
              items={[
                {
                  code: po.code,
                  label: po.supplier_name,
                  amount: money(totals.grandTotal, po.currency),
                },
              ]}
            />
          )}
        </Sheet>
      )}
    </DocScreen>
  )
}
