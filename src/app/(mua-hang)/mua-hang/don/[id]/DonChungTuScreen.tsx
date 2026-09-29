'use client'

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
  Action,
  ActionGroup,
  ActionPane,
  Affected,
  Btn,
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
  HolderBar,
  Menu,
  Metric,
  MetricStrip,
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
import { DotSheet, DotSuaSheet, XacNhanSheet } from './NhanHangPanel'
import { CapNhatDanhMucSheet, DanExcelSheet } from './SoanDonPanels'
import { TaiChinhPanel } from './TaiChinhPanel'
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
import { clearDraft } from './soan-don'
import { ChiPhi, PhatSinh } from './tai-chinh-khoi'
import { TraoDoiKhung } from './trao-doi'
import { useDonChungTu } from './useDonChungTu'

export type { AdjustmentLite, PoDoc, StatusLineLite } from './don-chung-tu.shared'

/**
 * MÀN CHỨNG TỪ ĐƠN MUA — phần GHÉP BỐ CỤC.
 *
 * Tách 28/09/2026 (bước 3 kế hoạch chất lượng UI) từ một file 4.384 dòng:
 *  · `don-chung-tu.shared.tsx` — kiểu, hằng, ô lưới (ViewCell/EditCell);
 *  · `useDonChungTu.tsx`       — toàn bộ trạng thái + xử lý;
 *  · `dau-don.tsx`, `dong-hang.tsx`, `giao-nhan.tsx`, `tai-chinh-khoi.tsx`,
 *    `lich-su.tsx`, `trao-doi.tsx` — khối giao diện theo mục menu.
 * Lưới an toàn: `npm run ui:shots` chụp 9 cảnh của màn này (don-ct-*).
 */
export function DonChungTuScreen(p: Props) {
  const d = useDonChungTu(p)
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
    adjReason,
    setAdjReason,
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
    xacNhan,
    setXacNhan,
    dot,
    setDot,
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
    savedDraft,
    setSavedDraft,
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
    noteOver,
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
    lsx,
    supplierOpt,
    moqWarn,
    lsxOptions,
    supplierOptions,
    marks,
    bar,
    barItem,
    code,
    shipLines,
    shippedByLine,
    liveShipments,
    call,
    submitShipments,
    shipmentAct,
    lsxLabel,
    addFromPaste,
    onCreatedMaterial,
    toggleExtraLsx,
    draftKey,
    restoreDraft,
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
            <MetricStrip>
              <Metric
                label="Giá trị đặt"
                value={money(totals.grandTotal, header.currency)}
                basis={`${lines.length} dòng · gồm VAT ${header.vat === '' ? 0 : header.vat}%`}
              />
              <Metric
                label="Về kho"
                value={veKho ? `${Math.round(veKho.ratio * 100)}%` : null}
                tone={veKho ? (veKho.ratio >= 1 ? 'done' : undefined) : undefined}
                basis={
                  veKho ? `${veKho.du}/${veKho.tong} dòng vật tư kho` : 'đơn chưa gửi NCC'
                }
              />
              <Metric
                label="Đã có hoá đơn"
                value={
                  p.finance ? money(p.finance.invoiced_gross, header.currency) : null
                }
                basis={
                  p.finance
                    ? `${p.finance.invoices.length} hoá đơn · gồm VAT`
                    : 'chưa tải được'
                }
              />
              <Metric
                label="Đã trả"
                value={p.finance ? money(p.finance.paid, header.currency) : null}
                basis={
                  p.finance
                    ? `${p.finance.payments.length} phiếu chi gắn đơn`
                    : 'chưa tải được'
                }
              />
            </MetricStrip>
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
      <Crumb
        path={[{ label: 'Đơn mua', href: '/mua-hang/don' }, code]}
        position={p.position ? [p.position.index, p.position.total] : undefined}
      />

      {viewMode && po && viewHead}

      {!viewMode && (
        <>
          {/*
        THANH HÀNH ĐỘNG MỘT HÀNG (duyệt 26/09/2026, canvas "Đơn mua — gọn thanh
        nút & Trao đổi"). Bỏ 3 tab Đơn hàng / Nhận hàng / Tài chính (16 + 11 nút,
        tab Tài chính khoá vĩnh viễn, cao 150px): việc kế tiếp của đơn từng nằm ở
        TAB KHÁC với trục trạng thái. Nay nút chính = việc kế tiếp của BƯỚC, ≤ 3
        việc hay làm, còn lại vào "⋯ Thêm" theo nhóm — chỗ đặt do `barLayout`
        (thanh-nut.ts, có test) quyết.
      */}
          <ActionPane>
            {' '}
            {/* prettier-ignore */}
            {termsEdit && !editing ? (
              /* Sửa hẹp: thanh hành động thu về đúng hai nút, để không ai tưởng
             mình đang sửa được cả dòng hàng. */
              <SuaTaiChoNut d={d} as="action" />
            ) : editing ? (
              <>
                <ActionGroup label="Đang sửa">
                  <Action
                    primary
                    disabled={busy || !!problem}
                    title={problem ?? undefined}
                    onClick={() => void save()}
                  >
                    {p.mode === 'create' ? 'Tạo đơn' : 'Lưu'}
                  </Action>
                  <Action icon="huy" disabled={busy} onClick={askCancelEdit}>
                    Huỷ
                  </Action>
                </ActionGroup>
                {/*
              NHÓM "NHẬP NHANH" ĐÃ BỎ KHỎI ĐÂY (14/09/2026).

              Ba nút của nó là thao tác trên DÒNG, không phải trên chứng từ —
              và hai trong ba ("Dán từ Excel", "Khai vật tư mới") đã nằm sẵn ở
              thanh lưới, ngay trên bảng. Tức thanh hành động đang in lại cùng
              một nút ở chỗ xa bảng hơn.

              Đo trên đơn 17 dòng, khung 694px: thanh hành động cao 201px =
              37% của toàn bộ 542px nằm trên dòng đầu tiên, và chỉ 3/17 dòng
              nhìn thấy được. Bỏ nhóm này trả lại ~108px cho bảng — thứ duy
              nhất người dùng thật sự nhìn.

              Nút thứ ba ("Thêm … còn thiếu của lệnh") chuyển xuống thanh lưới
              cùng hai nút kia: cả ba đều đẻ ra dòng, nên phải đứng cạnh nhau.
            */}
                <ActionGroup label="Kiểm">
                  <Action
                    icon="in"
                    disabled={!p.company}
                    title={
                      p.company
                        ? 'Dựng đúng tờ phiếu sẽ gửi NCC từ bản đang gõ'
                        : 'Trang này chưa nạp đầu phiếu'
                    }
                    onClick={() => setPreview(true)}
                  >
                    {' '}
                    {/* prettier-ignore */}
                    Xem trước phiếu
                  </Action>
                </ActionGroup>
              </>
            ) : bar ? (
              <>
                <ActionGroup label="Bước này">
                  {[bar.primary, ...bar.quick].map((k, i) => {
                    const it = k ? barItem(k) : null
                    return (
                      it && (
                        <Action
                          key={k}
                          primary={i === 0 && k === bar.primary}
                          icon={it.icon}
                          disabled={busy || !!it.blocked}
                          title={it.blocked}
                          onClick={it.run}
                        >
                          {it.label}
                        </Action>
                      )
                    )
                  })}
                </ActionGroup>
                <ActionGroup label="Khác">
                  <Menu
                    label="⋯ Thêm"
                    ariaLabel="Các việc khác của đơn"
                    items={bar.more.flatMap(({ key, group }) => {
                      const it = barItem(key)
                      return it
                        ? [
                            {
                              label: it.label,
                              group,
                              danger: it.danger,
                              why: busy ? 'Đang xử lý việc trước…' : it.blocked,
                              onClick: it.run,
                            },
                          ]
                        : []
                    })}
                  />
                </ActionGroup>
              </>
            ) : null}
          </ActionPane>

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
            {po && (
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
          {po && (
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
          {drafting && savedDraft && (
            <NoticeBar
              tone="warn"
              tag="Bản nháp"
              action={{ label: 'Khôi phục', onClick: () => restoreDraft(savedDraft) }}
            >
              Có bản gõ dở tự lưu lúc{' '}
              <b className="num">{new Date(savedDraft.at).toLocaleString('vi-VN')}</b> (
              {savedDraft.lines.length} dòng).{' '}
              <GridBtn
                onClick={() => {
                  clearDraft(draftKey)
                  setSavedDraft(null)
                }}
              >
                Bỏ bản nháp
              </GridBtn>
            </NoticeBar>
          )}
          {/* THANH ĐANG SỬA — CÓ MẶT SUỐT chế độ sửa, không chỉ khi có lỗi.

          Bản cũ chỉ bày thanh này khi đơn còn thiếu thông tin. Nghĩa là đơn khai
          ĐÚNG và ĐỦ thì tuyệt nhiên không có dòng nào nói người dùng đang sửa dở
          — đúng lúc nguy hiểm nhất, vì lúc đó nút Lưu mở và mọi thứ trông như
          màn đọc bình thường.

          Nay một thanh, hai trạng thái: còn vướng thì nói vướng gì và chỉ tới ô;
          hết vướng thì nói "còn thay đổi chưa lưu" và cho Lưu ngay tại chỗ. Nút
          Lưu trên thanh hành động vẫn còn — người dùng cuộn xuống giữa lưới 40
          dòng thì thanh này là chỗ gần tay nhất. */}
          {blkUnsent}
          {drafting &&
            (problem ? (
              <NoticeBar
                tone="warn"
                tag="Chưa lưu được"
                action={{
                  label: /nhà cung cấp|lệnh|LSX|mẫu/i.test(problem)
                    ? 'Tới ô cần điền'
                    : 'Xem dòng hàng',
                  onClick: () => goToProblem(problem),
                }}
              >
                {problem}. Sửa xong thì nút Lưu tự mở.
              </NoticeBar>
            ) : (
              <NoticeBar
                tone="warn"
                tag="Đang sửa"
                action={{ label: busy ? 'Đang lưu…' : 'Lưu', onClick: () => void save() }}
              >
                {p.mode === 'create'
                  ? 'Đơn chưa được tạo — rời trang là mất.'
                  : 'Thay đổi chưa lưu. Rời trang khi chưa lưu thì đơn giữ nguyên bản cũ.'}
              </NoticeBar>
            ))}
        </>
      )}

      {!viewMode && (
        <DocBody
          wideAside={!!po}
          aside={
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
          }
        >
          {/* ══ 0. ĐẦU ĐƠN — ba nhóm, xếp CỘT, dùng lưới nhãn–giá trị của kit ══
            Vì sao nó ở TRÊN lưới: gần như ô nào ở đây cũng là ĐIỀU KIỆN của lưới
            — mẫu đơn quyết định lưới có cột nào, lệnh quyết định "Thêm còn
            thiếu" lấy nhu cầu ở đâu, NCC quyết định tiền tệ và giá gợi ý, thuế
            quyết định số ở chân lưới. Để dưới lưới thì gõ xong 20 dòng mới biết
            chọn nhầm mẫu.

            Vì sao KHÔNG còn là dải ngang tự chế (bản 15/09 đầu): mười ô nhãn-trên
            điều-khiển-dưới, mỗi ô một bề rộng, thả vào `flex-wrap` thì không cột
            nào thẳng cột nào và nhóm bị thụt bậc khi bẻ dòng — chủ dự án nói đúng
            là "rất rối, không ngăn nắp gì cả". Kit đã có sẵn thứ cần: `.k-fields`
            là lưới NHÃN–GIÁ TRỊ căn cột nghiêm ngặt, chính là "dày nhưng có kỷ
            luật căn chỉnh" mà sổ thiết kế đòi. Dựng tay một cái thứ hai kém hơn
            là tự chuốc.

            Ba nhóm xếp thành BA CỘT (không xếp chồng như khối "Đầu đơn" cũ) nên
            cao đúng 4 hàng, vẫn còn nguyên chỗ cho lưới. Mỗi nhóm bọc một lớp
            `div` riêng để luật `.k-fgrp + .k-fgrp` không kẻ vạch ngang giữa các
            cột. Nền TRẮNG — xem ghi chú ở `.k-gbar`: dưới nó là thanh công cụ rồi
            tới hàng tiêu đề cột, ba dải cùng tô là một mảng xám câm. */}
          {drafting && (
            <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--line)] bg-[var(--surface-card)] md:grid-cols-2 xl:grid-cols-3">
              <div>
                <FieldGroup title="Đặt cho lệnh nào">
                  <Field label="Mẫu đơn">
                    <Pick
                      label="Mẫu đơn"
                      value={template}
                      onChange={(t) => {
                        markDirty('template')
                        changeTemplate(t as PoTemplate)
                      }}
                      options={Object.values(PO_TEMPLATE_META).map((m) => ({ value: m.key, label: m.label }))} // prettier-ignore
                    />
                  </Field>
                  <Field label="Loại đơn">
                    <Pick
                      label="Loại đơn"
                      value={header.poType}
                      onChange={(v) =>
                        setHeader((h) => ({
                          ...h,
                          poType: v as PoHeader['poType'],
                          lsxId: v === 'standalone' ? '' : h.lsxId,
                        }))
                      }
                      options={[
                        { value: 'lsx', label: 'Theo lệnh sản xuất' },
                        { value: 'standalone', label: 'Ngoài lệnh (mua bù tồn)' },
                      ]}
                    />
                  </Field>
                  <Field label="Lệnh sản xuất">
                    {/* Ô bắt buộc mà còn trống thì NÓI NGAY TẠI Ô, không bắt người
                      dùng đọc dải vàng đầu trang rồi tự đoán ô nào. Chữ nằm cùng
                      hàng với ô chọn nên không tốn thêm chiều cao. */}
                    <span className="flex items-center gap-2">
                      <Combobox
                        label="Lệnh sản xuất"
                        disabled={header.poType !== 'lsx'}
                        value={header.lsxId}
                        onChange={(v) => setHeader((h) => ({ ...h, lsxId: v }))}
                        emptyLabel="— chọn lệnh —"
                        placeholder="Gõ số lệnh hoặc tên khách…"
                        options={lsxOptions}
                      />
                      {header.poType === 'lsx' && !header.lsxId && (
                        <span className="k-t-warn text-k-label shrink-0 whitespace-nowrap">
                          bắt buộc
                        </span>
                      )}
                    </span>
                  </Field>
                  {header.poType === 'lsx' && (
                    <Field label="Gộp thêm lệnh">
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
                    </Field>
                  )}
                </FieldGroup>
              </div>

              <div>
                <FieldGroup title="Đặt của ai">
                  <Field label="Nhà cung cấp">
                    <span className="flex items-center gap-2">
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
                      {!header.supplierId && (
                        <span className="k-t-warn text-k-label shrink-0 whitespace-nowrap">
                          bắt buộc
                        </span>
                      )}
                      {supplierOpt?.can_order === false && (
                        <span
                          className="k-t-stop text-k-label shrink-0 whitespace-nowrap"
                          title={supplierOpt.lock_reason ?? undefined}
                        >
                          đang khoá đặt hàng
                        </span>
                      )}
                    </span>
                  </Field>
                  <Field label="Số hợp đồng">
                    <TextInput
                      label="Số hợp đồng"
                      value={header.contractNo}
                      onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                      mono
                    />
                  </Field>
                  <Field label="Hạn giao">
                    <DateInput
                      label="Hạn giao"
                      value={header.expectedAt}
                      onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
                    />
                  </Field>
                  <Field label="Thời gian giao của NCC" inherited>
                    <span className="num">
                      {supplierOpt?.lead_time_days != null
                        ? `${supplierOpt.lead_time_days} ngày`
                        : '—'}
                    </span>
                  </Field>
                </FieldGroup>
              </div>

              <div>
                <FieldGroup title="Tính tiền thế nào">
                  <Field label="Tiền tệ">
                    <Pick
                      label="Tiền tệ"
                      value={header.currency}
                      onChange={(v) => {
                        markDirty('currency')
                        setHeader((h) => ({ ...h, currency: v }))
                      }}
                      options={PO_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </Field>
                  <Field label="Thuế suất %">
                    <NumInput
                      aria-label="Thuế suất"
                      value={numStr(header.vat)}
                      onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
                    />
                  </Field>
                  <Field label="Giá đã gồm VAT">
                    <Tick
                      label="Đơn giá đã gồm VAT"
                      checked={header.inclVat}
                      onChange={(v) => {
                        // Tự tick / bỏ tick = đã tự chỉnh: đổi mẫu sau đó không được áp lại.
                        markDirty('vat')
                        setHeader((h) => ({ ...h, inclVat: v }))
                      }}
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
                  <Field label="Điều khoản TT của NCC" inherited>
                    {supplierOpt?.payment_terms ?? '—'}
                  </Field>
                </FieldGroup>
              </div>

              {/* Nút của chính bộ kit, không phải <button> tự vẽ: cổng
                `hg/no-raw-control` chặn thẻ thô, mà gợi ý của nó
                (shadcn/button) sẽ TRỘN hai hệ token trong cùng một file. */}
              <div className="col-span-full flex justify-end border-t border-[var(--hair)] px-[var(--gutter)] py-1">
                <GridBtn
                  title="Năm điều khoản in nguyên văn lên phiếu gửi nhà cung cấp"
                  onClick={() => {
                    setHeadOpen(true)
                    goTo('dau-don')
                  }}
                >
                  Điều khoản in lên phiếu →
                </GridBtn>
              </div>
            </div>
          )}

          {blkLines}
          {blkPhatSinh}
          {blkNhuCau}
          {blkGiao}
          {blkChiPhi}
          {blkDauDon}
          {blkTimeline}
          {blkTaiLieu}
        </DocBody>
      )}

      <StatusBar
        left={[
          <>
            <b>{me.name}</b> · Mua hàng
          </>,
          editing || termsEdit
            ? 'Đang sửa — chưa lưu'
            : (PO_NEXT_HINT[(po?.status ?? 'draft') as PoStatus] ?? ''),
        ]}
        right={
          po
            ? `${po.code} · ${PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}`
            : 'Đơn mới'
        }
      />

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
              disabled={adjReason.trim().length < 5 || adjBlocked != null}
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
          <Field label="Vì sao điều chỉnh">
            <TextArea
              aria-label="Vì sao điều chỉnh"
              value={adjReason}
              onChange={setAdjReason}
              placeholder="VD: NCC báo tăng giá từ 25/09 (Zalo anh Nguyên); lệnh tăng 20 bộ"
            />
          </Field>
          {adjReason.trim().length < 5 && (
            <div className="k-t-warn text-k-sm">
              Ghi lý do (ít nhất 5 ký tự) — vào sổ phát sinh và thông báo.
            </div>
          )}
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
            setLines((ls) => ls.map((l) => (l.material_id === m.id ? refreshLineFromMaterial(template, l, m) : l))) // prettier-ignore
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
            po={previewHeaderFromDraft(header, { code: po?.code ?? '(cấp khi lưu)', supplierName: supplierOpt?.name ?? '—', lsxCode: lsxLabel, orderCode: header.poType === 'lsx' ? (lsx?.order_codes.join(', ') || null) : null, createdAt: po?.created_at ?? new Date().toISOString() })} // prettier-ignore
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
      {xacNhan && po && (
        <XacNhanSheet
          mode={xacNhan}
          poCode={po.code}
          defaultDate={po.expected_at?.slice(0, 10) ?? today}
          lines={shipLines}
          existing={xacNhan === 'add' ? shippedByLine : new Map()}
          busy={busy}
          onClose={() => setXacNhan(null)}
          onSubmit={submitShipments}
        />
      )}
      {dot && (dot.kind === 'edit' || dot.kind === 'split') && (
        <DotSuaSheet
          kind={dot.kind}
          shipment={dot.s}
          lines={shipLines}
          others={p.shipments
            .filter((s) => s.id !== dot.s.id && s.status !== 'cancelled')
            .flatMap((s) => s.lines)
            .reduce((m, l) => m.set(l.po_line_id, (m.get(l.po_line_id) ?? 0) + l.qty), new Map<string, number>())} // prettier-ignore
          busy={busy}
          onClose={() => setDot(null)}
          onSubmit={(d, reason, lines) =>
            shipmentAct(
              dot.s.id,
              { action: dot.kind, expected_date: d, reason, lines },
              dot.kind === 'split' ? 'Đã tách đợt lấy trước' : 'Đã sửa đợt giao',
            )
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
              ? shipmentAct(dot.s.id, { action: 'cancel', reason }, 'Đã huỷ đợt giao')
              : shipmentAct(dot.s.id, { action: 'reschedule', expected_date: d, reason }, 'Đã dời ngày đợt giao') // prettier-ignore
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
