'use client'

import {
  cartonPriceSuggest,
  lineAmount,
  lineBasis,
  lineQty2,
  lineUnit2Label,
  LSX_DEMAND_TEMPLATES,
  type Line,
  type Num,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import {
  CellHint,
  FastTab,
  Field,
  FieldGroup,
  Grid,
  GridBody,
  GridBtn,
  GridCheck,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  LineDetail,
  LineStatus,
  NumInput,
  Pick,
  Td,
  TextInput,
  Th,
} from '@/components/kit'
import { underDemand } from '@/lib/po-guards'
import { fmtMoney, packCount, roundMoney, roundUpToPack } from '@/lib/po-line'
import { suggestOrderQty, type PoTemplate } from '@/lib/po-template'
import { priceDrift } from '@/lib/po-tracking'
import { NhuCauGrid } from './SoanDonPanels'
import { XopGiaO, XopGiaXem } from './xop-gia'
import {
  EditCell,
  ViewCell,
  fmtNum,
  money,
  numStr,
  rowKey,
  signed,
  toNum,
} from './don-chung-tu.shared'
import { lineDetailSummary } from './soan-don'
import { TrungDong } from './trung-dong'
import { ThanhLuoi } from './thanh-luoi'
import { GhiChuTd, GhiChuTh, gridMinWidth } from './ghi-chu-dong'
import { OChuNo } from './o-chu-no'
import type { DonCtx } from './useDonChungTu'

/** Khối `blkLines` của màn chứng từ đơn mua. */
export function DongHang({ d }: { d: DonCtx }) {
  const {
    viewMode,
    lines,
    issues,
    totals,
    header,
    editing,
    editAct,
    start,
    goTo,
    po,
    sel,
    gridKeys,
    gridFields,
    adjusting,
    statusById,
    origById,
    curIdx,
    setPick,
    setSel,
    patch,
    template,
    setField,
    suggestByMat,
    qtyByMat,
    capLeft,
    adjRow,
    adjPlan,
    cur,
    detailOpen,
    setDetailOpen,
    detailFields,
    meta,
    lsxsOfPo,
    setEditMaterial,
    saveToCatalog,
  } = d
  return (
    <>
      {/* ══ 1. LƯỚI DÒNG — mở đầu, nhân vật chính ═══════════════════════ */}
      <FastTab
        fixed={viewMode}
        id="dong-hang"
        title="Dòng đơn hàng"
        defaultOpen
        flush
        summary={
          editing
            ? []
            : [
                ['Số dòng', <span key="a" className="num">{lines.length}</span>], // prettier-ignore
                ['Thiếu số', <span key="b" className={issues.length ? 'num k-t-warn' : 'num'}>{issues.length}</span>], // prettier-ignore
                ['Tổng', <span key="c" className="num">{money(totals.grandTotal, header.currency)}</span>], // prettier-ignore
              ]
        }
        actions={
          !editing ? (
            <>
              <GridBtn
                disabled={!editAct || !!editAct.blocked}
                title={editAct?.blocked}
                onClick={() => editAct && start(editAct)}
              >
                {editAct?.id === 'adjust' ? 'Sửa dòng hàng' : 'Chỉnh sửa vật tư'}
              </GridBtn>
              <GridSep />
              <GridBtn
                onClick={() => goTo('dot-giao')}
                disabled={!po}
                title="Đợt giao, ma trận nhận và các nút nhận hàng"
              >
                Giao &amp; nhận hàng
              </GridBtn>
            </>
          ) : (
            // Lúc soạn: thanh công cụ đứng CÙNG HÀNG tiêu đề khối — bớt một hàng (30/09/2026).
            <ThanhLuoi d={d} />
          )
        }
      >
        <TrungDong d={d} />

        <div onKeyDown={editing ? gridKeys : undefined}>
          {/* Ô GỌN (Đm/sp) không cộng bề rộng tối thiểu: nó lấy chỗ của cột tên vật tư
                (co giãn) để cột tiền vẫn trong màn ở 1280 — đo 26/09/2026. */}
          <Grid minWidth={gridMinWidth(gridFields.filter((f) => !f.compact).length)}>
            <GridHead>
              <Th width={30} />
              <Th width={36}>#</Th>
              <Th>Mã · tên vật tư</Th>
              {gridFields.map((f) => (
                <Th key={f.key} num={f.align === 'right' || f.kind !== 'text'}>
                  {f.label}
                </Th>
              ))}
              <Th>ĐVT</Th>
              <Th num>SL đặt</Th>
              <Th num>Đơn giá</Th>
              {template === 'foam' && <Th num>Đơn giá m³</Th>}
              <Th num>Thành tiền</Th>
              <GhiChuTh />
              {adjusting && <Th num>Đã nhận</Th>}
              {adjusting && <Th num>Phát sinh</Th>}
              {!editing && <Th>Trạng thái</Th>}
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const why = issues.find((x) => x.index === i)?.why ?? null
                const st = statusById.get(l.po_line_id ?? '')
                const org =
                  adjusting && l.po_line_id ? origById.get(l.po_line_id) : undefined
                const got = adjusting && l.po_line_id ? (st?.qty_received ?? 0) : 0
                const underGot = adjusting && l.qty !== '' && Number(l.qty) < got - 1e-9
                const kind: 'idle' | 'part' | 'done' | 'short' = !st
                  ? 'idle'
                  : st.closed_short_at
                    ? 'short'
                    : st.qty_open <= 0
                      ? 'done'
                      : st.qty_received > 0
                        ? 'part'
                        : 'idle'
                return (
                  <GridRow
                    key={rowKey(l)}
                    selected={i === curIdx}
                    onClick={() => setPick(i)}
                  >
                    <GridCheck
                      checked={sel.includes(rowKey(l))}
                      label={`Chọn dòng ${l.code || l.name}`}
                      onChange={() =>
                        setSel((s) =>
                          s.includes(rowKey(l))
                            ? s.filter((x) => x !== rowKey(l))
                            : [...s, rowKey(l)],
                        )
                      }
                    />
                    <Td num tone={why ? 'warn' : undefined}>
                      {i + 1}
                    </Td>
                    <Td>
                      {l.is_free && editing ? (
                        <OChuNo
                          label="Tên hàng"
                          value={l.name}
                          onCommit={(v) => patch(i, { name: v })}
                          placeholder="Tên hàng (dòng tự do)"
                        />
                      ) : (
                        // Ô tên có trần 340px (29/09): tên dài từng đẩy SL/giá khỏi màn.
                        // prettier-ignore
                        <span className="block max-w-[340px] truncate" title={`${l.code ? `${l.code} · ` : ''}${l.name}`}>{l.code && !l.is_free && !editing ? <a href={`/mua-hang/vat-tu/${l.material_id}`} className="num k-strong text-[var(--act)] hover:underline" title={`Hồ sơ ${l.code} — NCC đã bán, giá, lịch sử mua`}>{l.code}</a> : <span className="num k-strong">{l.code}</span>}{l.code ? ' · ' : ''}{l.name}{l.is_free && <span className="text-[var(--ink-3)]"> · tự do</span>}</span>
                      )}
                    </Td>
                    {gridFields.map((f) => (
                      <Td key={f.key} num={f.kind !== 'text'}>
                        {editing ? (
                          <EditCell
                            f={f}
                            l={l}
                            template={template}
                            onField={(v) => setField(i, f, v)}
                            onPatch={(part) => patch(i, part)}
                          />
                        ) : (
                          <ViewCell f={f} l={l} template={template} />
                        )}
                      </Td>
                    ))}
                    <Td>
                      {editing && l.is_free ? (
                        <TextInput
                          label="ĐVT"
                          value={l.unit}
                          onCommit={(v) => patch(i, { unit: v })}
                        />
                      ) : (
                        l.unit
                      )}
                    </Td>
                    <Td num tone={why?.includes('SL') || underGot ? 'warn' : undefined}>
                      {editing ? (
                        <>
                          <NumInput
                            aria-label="SL đặt"
                            value={numStr(l.qty)}
                            onCommit={(v) => patch(i, { qty: toNum(v) })}
                          />
                          {underGot && (
                            <CellHint
                              tone="warn"
                              title='Không đặt thấp hơn số Kho đã nhận. NCC không giao nữa thì dùng "Chốt thiếu" ở khối Giao & nhận hàng.'
                            >
                              ⚠ dưới SL đã nhận {fmtNum(got)}
                            </CellHint>
                          )}
                          {org &&
                            !underGot &&
                            Number(org.qty_ordered) !== Number(l.qty) && (
                              <CellHint title="Số của bản đang chạy">
                                từ {fmtNum(Number(org.qty_ordered))}
                              </CellHint>
                            )}
                          {(() => {
                            // Ô còn TRỐNG mới mời; đã gõ số thì gợi ý là nhiễu.
                            if (l.qty !== '') return null
                            const short = l.qty_demand !== '' ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0, dmNhan(template, l)) : null // prettier-ignore
                            // Gợi ý theo MÃ (nhu cầu lệnh) trừ SL các dòng cùng mã khác đã đặt — mã
                            // nằm nhiều dòng thì không mời đặt lại đủ số ở từng dòng (07/10/2026).
                            const theoMa = suggestByMat.get(l.material_id)
                            const raw =
                              short ??
                              (theoMa == null
                                ? null
                                : theoMa - (qtyByMat.get(l.material_id) ?? 0))
                            if (raw == null || raw <= 0) return null
                            const use = roundUpToPack(raw, l.pack_size)
                            return (
                              <CellHint
                                onClick={() => patch(i, { qty: use })}
                                title={`${short != null ? (dmNhan(template, l) != null ? `SL đơn hàng × Đm/sp (${fmtNum(Number(l.dm_per_sp))}) − tồn kho` : 'SL cần cho lệnh − tồn kho') : 'Đề xuất từ nhu cầu của lệnh'}${use !== raw ? ` (${fmtNum(raw)} làm tròn lên nguyên ${l.pack_unit || 'bao'})` : ''} — bấm để dùng`} // prettier-ignore
                              >
                                dùng {fmtNum(use)} ↩
                              </CellHint>
                            )
                          })()}
                        </>
                      ) : (
                        Number(l.qty || 0).toLocaleString('vi-VN')
                      )}
                      {(() => {
                        /*
                          ĐẶT ÍT HƠN NHU CẦU (P1, 27/09/2026) — màn cũ tô hổ phách ô
                          này để người duyệt thấy đơn không phủ hết lệnh; màn soạn
                          mới làm rơi mất. Nhu cầu tính CÙNG phép với gợi ý "dùng N"
                          (SL đơn hàng × Đm/sp − tồn) — một nguồn số. Chỉ nhắc, không
                          chặn: giao đợt khác / dùng hàng thay thế là chủ đích hợp lệ.
                        */
                        if (l.qty === '' || l.qty_demand === '') return null
                        const need = suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0, dmNhan(template, l)) // prettier-ignore
                        const gap = underDemand(Number(l.qty), need)
                        if (gap == null) return null
                        return (
                          <CellHint
                            tone="warn"
                            title={`Cần đặt ${fmtNum(need ?? 0)} theo nhu cầu lệnh (đã trừ tồn kho). Đặt ít hơn thì lệnh chưa đủ vật tư — chủ đích (giao đợt khác, hàng thay thế) thì cứ đặt, chỉ nhắc.`} // prettier-ignore
                          >
                            {' '}
                            {/* prettier-ignore */}⚠ thiếu {fmtNum(gap)} so với nhu cầu
                          </CellHint>
                        )
                      })()}
                      {(() => {
                        // So TỔNG các dòng cùng mã với trần — hai dòng mỗi dòng vừa trần
                        // mà cộng lại vượt thì vẫn phải nhắc (07/10/2026).
                        const cap = capLeft.get(l.material_id)
                        const tong = qtyByMat.get(l.material_id) ?? 0
                        if (cap == null || l.qty === '' || tong <= cap) return null
                        return (
                          <CellHint
                            tone="warn"
                            title="Trần tồn trừ tồn hiện có và lượng đã đặt chưa về. Vượt trần là chủ đích thì cứ đặt — chỉ nhắc, không chặn."
                          >
                            {' '}
                            {/* prettier-ignore */}⚠ vượt trần · thêm được {fmtNum(cap)}
                            {tong !== Number(l.qty)
                              ? ` (các dòng mã này cộng ${fmtNum(tong)})`
                              : ''}
                          </CellHint>
                        )
                      })()}
                      {(() => {
                        // Quy đổi ĐÓNG GÓI MUA — đúng phép chia nhân viên vẫn
                        // tự bấm trong Excel (13.596 con ÷ 500 → 28 bì).
                        const packs =
                          l.qty !== '' ? packCount(Number(l.qty), l.pack_size) : null
                        if (packs == null) return null
                        return (
                          <CellHint
                            title={`Đóng gói mua: 1 ${l.pack_unit} = ${fmtNum(l.pack_size ?? 0)} ${l.unit}`}
                          >
                            {' '}
                            {/* prettier-ignore */}
                            {Number.isInteger(packs) ? '=' : '≈'} {fmtNum(packs)}{' '}
                            {l.pack_unit}
                          </CellHint>
                        )
                      })()}
                    </Td>
                    <Td num tone={why?.includes('giá') ? 'warn' : undefined}>
                      {editing ? (
                        <>
                          {template === 'foam' ? (
                            <XopGiaO
                              label="Đơn giá"
                              theo="tam"
                              l={l}
                              template={template}
                              currency={header.currency}
                              onPatch={(part) => patch(i, part)}
                            />
                          ) : (
                            <NumInput
                              aria-label="Đơn giá"
                              value={numStr(l.price)}
                              onCommit={(v) => patch(i, { price: toNum(v) })}
                            />
                          )}
                          {org &&
                            Number(org.unit_price ?? 0) !== Number(l.price || 0) && (
                              <CellHint title="Đơn giá của bản đang chạy">
                                từ {fmtNum(Number(org.unit_price ?? 0))}
                              </CellHint>
                            )}
                          {(() => {
                            // GIÁ LỆCH LẦN MUA TRƯỚC ≥ 5% (P3, 27/09/2026) — cùng ngưỡng màn duyệt
                            // của Giám đốc đang tô. Chỉ nhắc: tăng giá có thể hợp lệ, nhưng người
                            // mua phải thấy trước khi gửi, không phải Giám đốc thấy lúc duyệt.
                            const d = priceDrift(l.price === '' ? null : Number(l.price), l.last_price) // prettier-ignore
                            if (d == null) return null
                            return (
                              <CellHint
                                tone="warn"
                                title={`Giá mua lần trước ${fmtNum(l.last_price ?? 0)}`}
                              >
                                {d > 0 ? '▲' : '▼'} {Math.abs(d)}% so với lần trước
                              </CellHint>
                            )
                          })()}
                          {(() => {
                            // Mẫu bao bì tính theo m²: máy dựng sẵn giá thùng
                            // để người mua đối chiếu với giá NCC chào.
                            const goi = cartonPriceSuggest(template, l)
                            if (goi == null || goi <= 0 || Number(l.price) === goi) return null // prettier-ignore
                            return (
                              <CellHint
                                onClick={() => patch(i, { price: goi })}
                                title="m²/thùng × đơn giá/m² + phí bản in — bấm để dùng"
                              >
                                dùng {fmtNum(goi)} ↩
                              </CellHint>
                            )
                          })()}
                        </>
                      ) : l.price === '' ? (
                        <span className="k-t-warn">—</span>
                      ) : template === 'foam' ? (
                        <XopGiaXem theo="tam" l={l} template={template} currency={header.currency} /> // prettier-ignore
                      ) : (
                        Number(l.price).toLocaleString('vi-VN')
                      )}
                    </Td>
                    {template === 'foam' && (
                      <Td num>
                        {editing ? (
                          <XopGiaO
                            label="Đơn giá m³"
                            theo="m3"
                            l={l}
                            template={template}
                            currency={header.currency}
                            onPatch={(part) => patch(i, part)}
                          />
                        ) : l.price === '' ? (
                          <span className="k-t-warn">—</span>
                        ) : (
                          <XopGiaXem theo="m3" l={l} template={template} currency={header.currency} /> // prettier-ignore
                        )}
                      </Td>
                    )}
                    <Td num>
                      {l.price === '' ? (
                        <span className="k-flag">chưa có giá</span>
                      ) : (
                        fmtMoney(
                          roundMoney(lineAmount(template, l), header.currency),
                          header.currency,
                        )
                      )}
                    </Td>
                    <GhiChuTd d={d} l={l} i={i} />
                    {adjusting && (
                      <Td num>
                        {l.po_line_id ? (
                          fmtNum(got)
                        ) : (
                          <span className="text-[var(--ink-3)]">mới</span>
                        )}
                      </Td>
                    )}
                    {adjusting && (
                      <Td num>
                        {(() => {
                          const c = adjRow.get(i)
                          if (!c) return <span className="text-[var(--ink-3)]">—</span>
                          const d = c.amount_after - c.amount_before
                          return (
                            <span
                              title={
                                c.kind === 'added'
                                  ? 'Dòng thêm mới'
                                  : `vì giá ${signed(c.by_price, header.currency)} · vì lượng ${signed(c.by_qty, header.currency)}${c.fields.length ? ` · đổi ${c.fields.join(', ')}` : ''}`
                              }
                            >
                              {signed(d, header.currency)}
                            </span>
                          )
                        })()}
                      </Td>
                    )}
                    {!editing && (
                      <Td>
                        <LineStatus kind={kind}>
                          {
                            {
                              idle: 'Chưa nhận',
                              part: 'Một phần',
                              done: 'Đủ',
                              short: 'Đóng thiếu',
                            }[kind]
                          }
                        </LineStatus>
                      </Td>
                    )}
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={3 + gridFields.length + 1}>
                Cộng {lines.length} dòng
                {issues.length > 0 ? ` · ${issues.length} thiếu số` : ''}
              </Td>
              <Td num>
                {lines
                  .reduce((s, l) => s + Number(l.qty || 0), 0)
                  .toLocaleString('vi-VN')}
              </Td>
              <Td />
              {template === 'foam' && <Td />}
              <Td num>
                {fmtMoney(roundMoney(totals.subtotal, header.currency), header.currency)}
              </Td>
              <Td />
              {adjusting && <Td />}
              {adjusting && (
                <Td num>
                  {adjPlan ? signed(adjPlan.delta.subtotal, header.currency) : null}
                </Td>
              )}
              {!editing && <Td />}
            </GridFoot>
          </Grid>
        </div>

        {/* ══ CHI TIẾT DÒNG ĐANG CHỌN — Dynamics Line details ═══════════ */}
        {cur ? (
          <LineDetail
            index={curIdx + 1}
            code={cur.code || cur.name || '(dòng tự do)'}
            open={detailOpen}
            onToggle={() => setDetailOpen(!detailOpen)}
            // Lúc gấp vẫn phải biết bên trong có gì — không có câu này thì
            // khay thành hộp kín và người dùng mở ra ở MỌI dòng để kiểm,
            // tức tệ hơn lúc chưa gấp.
            summary={detailOpen ? null : lineDetailSummary(cur, detailFields)}
          >
            <FieldGroup title="Thông số theo mẫu">
              {detailFields.length === 0 && (
                <Field label="—">Mẫu này không có thông số riêng</Field>
              )}
              {detailFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {editing ? (
                    <EditCell
                      f={f}
                      l={cur}
                      template={template}
                      onField={(v) => setField(curIdx, f, v)}
                      onPatch={(part) => patch(curIdx, part)}
                    />
                  ) : (
                    <ViewCell f={f} l={cur} template={template} />
                  )}
                </Field>
              ))}
            </FieldGroup>
            <FieldGroup title="Số lượng &amp; giá">
              <Field label="Quy đổi kho">
                <span className="num">
                  {(() => {
                    const v = lineQty2(template, cur)
                    return v == null
                      ? '—'
                      : `${v.toLocaleString('vi-VN')} ${cur.unit2_label || meta.priceUnit || ''}`
                  })()}
                </span>
              </Field>
              <Field label="Nhu cầu lệnh">
                <span className="num">
                  {cur.qty_demand === ''
                    ? '—'
                    : Number(cur.qty_demand).toLocaleString('vi-VN')}
                </span>
              </Field>
              <Field label="Tồn kho lúc soạn">
                <span className="num">
                  {cur.on_hand == null
                    ? 'chưa có sổ kho'
                    : cur.on_hand.toLocaleString('vi-VN')}
                </span>
              </Field>
              <Field label="Đóng gói mua">
                {cur.pack_size ? (
                  <span className="num">
                    1 {cur.pack_unit} = {cur.pack_size} {cur.unit}
                  </span>
                ) : (
                  '—'
                )}
              </Field>
              {/* NCC BÁO GIÁ THEO ĐƠN VỊ NÀO — chỗ quyết định tiền của dòng
                    nhôm/sơn: cùng một con số 62.000 mà "theo cây" với "theo kg"
                    lệch nhau vài lần. Bản cũ cho chọn ngay trên lưới; ở đây nằm
                    tại chi tiết dòng để lưới giữ 11 cột. */}
              <Field label="Giá theo">
                {editing && lineQty2(template, cur) != null ? (
                  <Pick
                    label="Giá theo đơn vị"
                    width={
                      180
                    } /* nhãn "Mặc định của mẫu …" dài — không ghim thì ô đè sang cột "Tương đương" */
                    value={cur.price_per || 'mac-dinh'}
                    onChange={
                      (v) =>
                        patch(curIdx, { price_per: (v === 'mac-dinh' ? '' : v) as Line['price_per'] }) // prettier-ignore
                    }
                    options={[
                      { value: 'mac-dinh', label: `Mặc định của mẫu ${meta.label.toLowerCase()}` }, // prettier-ignore
                      { value: 'unit', label: `Theo ĐVT mua (${cur.unit || 'đvt'})` },
                      { value: 'unit2', label: `Theo đơn vị quy đổi (${lineUnit2Label(template, cur)})` }, // prettier-ignore
                    ]}
                  />
                ) : cur.price_per === 'unit2' ? (
                  `đơn vị quy đổi (${lineUnit2Label(template, cur)})`
                ) : cur.price_per === 'unit' ? (
                  'ĐVT mua'
                ) : (
                  'mặc định của mẫu'
                )}
              </Field>
              {/* Giá ở đơn vị CÒN LẠI — số để so với báo giá của NCC, không
                    dùng để tính tiền. Chỉ dựng khi đủ SL, giá và hệ số quy đổi.
                    Chiều quy đổi theo CƠ SỞ TIỀN THẬT của dòng (`lineBasis`), không
                    theo ô "Giá theo": xốp m³ / kính m² để "mặc định của mẫu" là
                    tiền đã theo m³ — đọc ô chọn thì đảo chiều, ra 53 triệu/tấm. */}
              {(() => {
                const q2 = lineQty2(template, cur)
                const sl = cur.qty === '' ? 0 : Number(cur.qty)
                const gia = cur.price === '' ? 0 : Number(cur.price)
                if (q2 == null || q2 <= 0 || sl <= 0 || gia <= 0) return null
                const theoUnit2 = lineBasis(template, cur) === 'unit2'
                const quy = theoUnit2 ? (gia * q2) / sl : (gia * sl) / q2
                const nhan = theoUnit2 ? cur.unit || 'đvt' : lineUnit2Label(template, cur)
                return (
                  <Field label="Tương đương">
                    <span
                      className="num"
                      title="Số để đối chiếu báo giá của NCC — không dùng để tính tiền"
                    >
                      {' '}
                      {/* prettier-ignore */}≈{' '}
                      {fmtMoney(roundMoney(quy, header.currency), header.currency)} /{' '}
                      {nhan}
                    </span>
                  </Field>
                )
              })()}
              <Field label="Thành tiền">
                <b className="num">
                  {cur.price === ''
                    ? '—'
                    : money(lineAmount(template, cur), header.currency)}
                </b>
              </Field>
            </FieldGroup>
            {lsxsOfPo.length > 1 && (
              <FieldGroup title="Chia số lượng cho lệnh">
                {lsxsOfPo.map((lx) => (
                  <Field key={lx.id} label={lx.code}>
                    {editing ? (
                      <NumInput value={cur.lsx_split?.[lx.id] === undefined || cur.lsx_split[lx.id] === '' ? '' : String(cur.lsx_split[lx.id])} aria-label={`SL cho ${lx.code}`} onCommit={(v) => patch(curIdx, { lsx_split: { ...cur.lsx_split, [lx.id]: (v.trim() === '' ? '' : Number(v.replace(',', '.'))) as Num } })} /> // prettier-ignore
                    ) : (
                      <span className="num">{cur.lsx_split?.[lx.id] === undefined || cur.lsx_split[lx.id] === '' ? '—' : Number(cur.lsx_split[lx.id]).toLocaleString('vi-VN')}</span> // prettier-ignore
                    )}
                  </Field>
                ))}
              </FieldGroup>
            )}
            {editing && !cur.is_free && (
              <FieldGroup title="Danh mục vật tư">
                <Field label="Hồ sơ">
                  <span className="flex flex-wrap gap-1">
                    <GridBtn
                      onClick={() => setEditMaterial(cur.material_id)}
                      title="Sửa quy cách, nhóm, barem của vật tư này trong danh mục"
                    >
                      Sửa danh mục vật tư
                    </GridBtn>
                    {
                      cur.weight_per_m !== '' && cur.catalog_kg_m == null &&
                        <GridBtn onClick={() => void saveToCatalog(cur.material_id, 'kgm', Number(cur.weight_per_m))}>Lưu kg/m vào danh mục</GridBtn> // prettier-ignore
                    }
                    {
                      cur.weight_per_unit !== '' && cur.catalog_kg_unit == null &&
                        <GridBtn onClick={() => void saveToCatalog(cur.material_id, 'kgunit', Number(cur.weight_per_unit))}>Lưu kg/đv vào danh mục</GridBtn> // prettier-ignore
                    }
                    {cur.spec.trim() !== '' && (
                      <GridBtn
                        title="Ghi quy cách đang gõ vào hồ sơ vật tư — lần đặt sau tự điền"
                        onClick={() => void saveToCatalog(cur.material_id, 'spec', cur.spec.trim(), rowKey(cur))} // prettier-ignore
                      >
                        Lưu quy cách vào danh mục
                      </GridBtn>
                    )}
                  </span>
                </Field>
              </FieldGroup>
            )}
            {/* Ghi chú dòng: cột "Ghi chú" trên lưới (ghi-chu-dong.tsx, 30/09/2026). */}
            {cur.is_free && (
              <FieldGroup title="Loại dòng">
                <Field label="Loại dòng">Dòng tự do — không trừ kho</Field>
              </FieldGroup>
            )}
          </LineDetail>
        ) : (
          <div className="k-ft-note">
            Chưa có dòng nào.{' '}
            {editing
              ? 'Gõ mã vật tư ở ô tìm phía trên rồi Enter.'
              : 'Bấm Sửa để thêm dòng.'}
          </div>
        )}
      </FastTab>
    </>
  )
}

/** Khối `blkNhuCau` của màn chứng từ đơn mua. */
export function NhuCau({ d }: { d: DonCtx }) {
  const {
    drafting,
    header,
    pending,
    lsxLabel,
    addFromNeeds,
    needs,
    needsLoading,
    usedIds,
  } = d
  return (
    <>
      {/* ══ 1a. NHU CẦU CỦA LỆNH — chỉ khi đang soạn đơn theo lệnh ═══════ */}
      {drafting && header.poType === 'lsx' && header.lsxId && pending.length > 0 && (
        <FastTab
          id="nhu-cau"
          title="Nhu cầu của lệnh"
          flush
          defaultOpen={pending.length > 0}
          summary={[
            ['Lệnh', <span key="a" className="num">{lsxLabel ?? '—'}</span>], // prettier-ignore
            ['Còn thiếu', <span key="b" className={pending.length ? 'num k-t-warn' : 'num'}>{pending.length}</span>], // prettier-ignore
          ]}
          actions={
            <GridBtn
              disabled={pending.length === 0}
              onClick={() => void addFromNeeds(pending)}
            >
              + Thêm tất cả còn thiếu
            </GridBtn>
          }
        >
          <NhuCauGrid
            needs={needs}
            loading={needsLoading}
            usedIds={usedIds}
            onAdd={(l) => void addFromNeeds(l)}
          />
        </FastTab>
      )}
    </>
  )
}

/**
 * Định mức đem NHÂN vào gợi ý SL đặt. Mẫu tính "SL theo LSX × Định mức SP = SL đơn
 * hàng" (mây) đã nhân sẵn trong SL đơn hàng — trả null để không nhân lần hai.
 */
function dmNhan(template: PoTemplate, l: Line): number | null {
  if (LSX_DEMAND_TEMPLATES.has(template) || l.dm_per_sp === '') return null
  return Number(l.dm_per_sp)
}
