'use client'

import { templateDefaults } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import {
  Checks,
  Combobox,
  DateInput,
  FactKv,
  FastTab,
  Field,
  FieldGroup,
  GridBtn,
  NoticeBar,
  NumInput,
  Pick,
  TextArea,
  TextInput,
  Tick,
} from '@/components/kit'
import { PO_CURRENCIES } from '@/lib/po-line'
import { TERM_FIELDS, dmy, dmyAt, money, numStr, toNum } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/** Khối `nccBody` của màn chứng từ đơn mua. */
export function NhaCungCapTomTat({ d }: { d: DonCtx }) {
  const { p, supplierOpt } = d
  return (
    <>
      <div className="k-strong" style={{ marginBottom: 4 }}>
        {p.supplier?.name ?? supplierOpt?.name ?? '—'}
      </div>
      {!p.supplier && !supplierOpt ? (
        <div className="text-k-sm text-[var(--ink-3)]">
          Chọn nhà cung cấp ở Đầu đơn — tiền tệ và điều khoản thanh toán tự theo hồ sơ.
        </div>
      ) : !p.facts ? (
        <FactKv
          rows={[
            ['Tiền tệ', <span key="a" className="num">{supplierOpt?.currency?.toUpperCase() ?? '—'}</span>], // prettier-ignore
            ['Thanh toán', <span key="b">{supplierOpt?.payment_terms ?? '—'}</span>], // prettier-ignore
            ['Lead time', <span key="c" className="num">{supplierOpt?.lead_time_days != null ? `${supplierOpt.lead_time_days} ngày` : '—'}</span>], // prettier-ignore
            ['Lịch sử mua', <span key="d" className="text-[var(--ink-3)]">hiện sau khi lưu đơn</span>], // prettier-ignore
          ]}
        />
      ) : (
        <FactKv
          rows={[
            ['Giao đúng hẹn', p.facts.onTime ? <span key="a" className="num k-t-done">{p.facts.onTime.hit} / {p.facts.onTime.of} đơn</span> : <span key="a" className="k-t-warn">chưa có lịch sử</span>], // prettier-ignore
            // GỌN 3 dòng (26/09/2026): cột phải nhường chỗ cho khối Trao đổi — 6
            // dòng dữ kiện NCC đẩy ô viết xuống gần đáy màn. "Mua gần nhất" bỏ:
            // hồ sơ NCC có đủ, ở đây nó không trả lời câu nào của đơn này.
            ['Đã đặt · nhận đủ', <span key="b" className="num">{p.facts.orders} · {p.facts.received} đơn</span>], // prettier-ignore
            ['Mã · MST', <span key="e" className="num">{p.supplier?.code ?? '—'} · {p.supplier?.tax_no ?? '—'}</span>], // prettier-ignore
          ]}
        />
      )}
    </>
  )
}

/** Khối `blkChecks` của màn chứng từ đơn mua. */
export function BangKiem({ d }: { d: DonCtx }) {
  const { editing, checks, blockers, po } = d
  return (
    <>
      {!editing && checks.length > 0 && (
        <Checks
          compact={blockers.length === 0}
          title={
            po?.status === 'approved'
              ? blockers.length > 0
                ? 'Chưa gửi NCC được'
                : 'Lưu ý trước khi gửi NCC'
              : blockers.length > 0
                ? 'Chưa gửi duyệt được'
                : 'Lưu ý trước khi gửi duyệt'
          }
          items={checks}
        />
      )}
    </>
  )
}

/** Khối `blkUnsent` của màn chứng từ đơn mua. */
export function ChuaGuiNcc({ d }: { d: DonCtx }) {
  const { editing, unsentAdj, po, perms, setSentNote, setSentSheet } = d
  return (
    <>
      {!editing && unsentAdj && po && (
        <NoticeBar
          tone="warn"
          tag={`Điều chỉnh lần ${unsentAdj.seq} chưa tới NCC`}
          action={
            perms.canEdit
              ? { label: 'Ghi đã gửi NCC', onClick: () => { setSentNote(''); setSentSheet(unsentAdj.seq) } } // prettier-ignore
              : undefined
          }
        >
          Áp dụng {dmyAt(unsentAdj.created_at)} — in phiếu đặt hàng gửi lại{' '}
          {po.supplier_name} để NCC làm theo số mới.
        </NoticeBar>
      )}
    </>
  )
}

/** Khối `blkDauDon` của màn chứng từ đơn mua. */
export function DauDon({ d }: { d: DonCtx }) {
  const {
    headOpen,
    drafting,
    po,
    supplierOpt,
    lsx,
    header,
    today,
    meta,
    toggleExtraLsx,
    p,
    lsxOptions,
    setHeader,
    termsEdit,
    markDirty,
    termsEditing,
    tplTerms,
    tplSigner,
    template,
    noteOver,
    dateEdit,
    editReason,
    setEditReason,
  } = d
  return (
    <>
      {/* ══ 2. ĐẦU ĐƠN — gấp, nhóm có tên, 3 cột ═══════════════════════ */}
      <FastTab
        key={headOpen ? 'dau-don-mo' : drafting ? 'dau-don-sua' : 'dau-don-xem'}
        id="dau-don"
        /*
            Lúc SỬA, khối này chỉ còn điều khoản + ghi chú (mọi ô đầu đơn đã lên
            dải trên), nên gọi nó "Đầu đơn" là sai tên và dải tóm tắt NCC/Lệnh/
            Hạn giao lặp y nguyên thứ vừa hiện cách đó hai dòng. Lúc ĐỌC thì khối
            này đúng là cả đầu đơn, giữ nguyên tên và tóm tắt.
          */
        title={drafting ? 'Điều khoản & ghi chú' : 'Đầu đơn'}
        defaultOpen={drafting || headOpen}
        flush
        summary={
          drafting
            ? []
            : [
                ['NCC', po?.supplier_name ?? supplierOpt?.name ?? '—'],
                ['Lệnh', <span key="l" className="num">{po?.lsx_code ?? lsx?.code ?? 'ngoài LSX'}</span>], // prettier-ignore
                ['Hạn giao', header.expectedAt ? <span key="h" className={`num ${header.expectedAt < today ? 'k-t-stop' : ''}`}>{dmy(header.expectedAt)}</span> : <span key="h" className="k-t-warn">chưa có</span>], // prettier-ignore
                ['Mẫu', meta.label],
              ]
        }
      >
        {/* Ba nhom nay CHI hien khi DOC don: luc sua, moi o cua chung
              da nam tren DAI DAU DON o dau luoi. Hai cho sua cung mot o
              la nguoi dung phai tu hoi cho nao moi that. */}
        {!drafting && (
          <>
            <FieldGroup title="Chung">
              {drafting ? (
                <>
                  {/* Mẫu đơn / Loại đơn / Lệnh / NCC KHÔNG lặp lại ở đây khi đang
                    sửa — chúng đã ở DẢI QUYẾT ĐỊNH trên đầu lưới. Hai chỗ sửa
                    cùng một ô là người dùng phải tự hỏi chỗ nào mới thật. Lúc
                    ĐỌC (không sửa) thì vẫn hiện đủ ở đây, vì khi đó không có
                    dải nào cả. */}
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
                        <span className="min-w-[180px]">
                          <Combobox
                            label="Gộp thêm lệnh"
                            value=""
                            onChange={(v) => v && toggleExtraLsx(v, true)}
                            emptyLabel={header.extraLsxIds.length ? '+ thêm lệnh nữa' : '— một đơn mua cho nhiều lệnh —'} // prettier-ignore
                            placeholder="Gõ số lệnh hoặc tên khách…"
                            options={lsxOptions.filter((o) => o.value !== header.lsxId && !header.extraLsxIds.includes(o.value))} // prettier-ignore
                          />
                        </span>
                      </span>
                    </Field>
                  )}
                  <Field label="Số hợp đồng">
                    <TextInput
                      label="Số hợp đồng"
                      value={header.contractNo}
                      onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                      mono
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Mẫu đơn">{meta.label}</Field>
                  <Field label="Nhà cung cấp">{po?.supplier_name}</Field>
                  <Field label="Lệnh sản xuất">
                    <span className="num">{po?.lsx_code ?? 'Ngoài LSX'}</span>
                  </Field>
                  <Field label="Đơn khách">
                    <span className="num">{po?.order_code ?? '—'}</span>
                  </Field>
                  <Field label="Người phụ trách">
                    {po?.assignee_name ?? 'chưa giao ai'}
                  </Field>
                  <Field label="Ngày đặt">
                    <span className="num">{dmy(po?.created_at)}</span>
                  </Field>
                  {/* Số hợp đồng in lên phiếu nên nó thuộc bộ "chữ trên phiếu",
                    sửa được cả khi đơn đã gửi — kế toán hay đòi ghi số HĐ sau. */}
                  <Field label="Số hợp đồng">
                    {termsEdit ? (
                      <TextInput
                        label="Số hợp đồng"
                        value={header.contractNo}
                        onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                        mono
                      />
                    ) : (
                      <span className="num">{po?.contract_no ?? '—'}</span>
                    )}
                  </Field>
                </>
              )}
            </FieldGroup>
            <FieldGroup title="Giao hàng">
              {drafting /* Hạn giao nằm trên DẢI QUYẾT ĐỊNH ở đầu lưới — không lặp ở đây. */ ? null : termsEditing &&
                dateEdit.ok ? (
                /*
                  HẸN GIAO SỬA TẠI CHỖ (B1, 28/09/2026) — trước đó là mục "Đổi hẹn giao"
                  ở tầng 3 của "⋯" kèm hộp bắt lý do, và 0/85 đơn có vết đổi hẹn.
                  Lý do để trống được; máy tự ghi "cũ → mới · ai".
                */
                <>
                  <Field label="Hạn giao">
                    <span className="flex flex-col gap-1">
                      <DateInput
                        label="Hạn giao"
                        value={header.expectedAt}
                        onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
                      />
                      {dateEdit.changed && (
                        <span className="text-k-sm text-[var(--ink-2)]">
                          đang là <s>{dmy(dateEdit.current) || 'chưa hẹn'}</s> → máy ghi
                          vết “Dời hẹn {dmy(dateEdit.current) || 'chưa hẹn'} →{' '}
                          {dmy(header.expectedAt)}”, đợt chưa giao trượt theo
                        </span>
                      )}
                    </span>
                  </Field>
                  {dateEdit.changed && (
                    <Field label="Lý do dời">
                      <TextInput
                        label="Lý do dời hẹn"
                        value={editReason}
                        onCommit={setEditReason}
                        placeholder="để trống được — ghi nếu NCC có nói vì sao"
                      />
                    </Field>
                  )}
                </>
              ) : (
                <Field
                  label="Hạn giao"
                  tone={
                    po?.expected_at && po.expected_at.slice(0, 10) < today
                      ? 'stop'
                      : undefined
                  }
                >
                  <span className="num">{dmy(po?.expected_at) || '—'}</span>
                  {termsEditing && !dateEdit.ok && (
                    <span className="text-k-sm ml-2 text-[var(--ink-3)]">
                      · {dateEdit.why}
                    </span>
                  )}
                </Field>
              )}
              <Field label="Thời gian giao của NCC" inherited>
                <span className="num">
                  {supplierOpt?.lead_time_days != null
                    ? `${supplierOpt.lead_time_days} ngày`
                    : '—'}
                </span>
              </Field>
            </FieldGroup>
            <FieldGroup title="Giá &amp; thuế">
              {drafting ? (
                <>
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
                </>
              ) : (
                <>
                  <Field label="Tiền tệ">
                    <span className="num">{po?.currency}</span>
                  </Field>
                  <Field label="Thuế suất">
                    <span className="num">
                      {po?.vat_rate ?? 0}%{po?.price_includes_vat ? ' · giá đã gồm' : ''}
                    </span>
                  </Field>
                  <Field label="Chiết khấu">
                    <span className="num">
                      {po?.discount_amount ? money(po.discount_amount, po.currency) : '—'}
                    </span>
                  </Field>
                </>
              )}
              <Field label="Điều khoản TT của NCC" inherited>
                {supplierOpt?.payment_terms ?? '—'}
              </Field>
            </FieldGroup>
          </>
        )}

        {/* ══ ĐIỀU KHOẢN — nhóm RIÊNG, có tên ═══════════════════════════════
              Năm điều khoản này in nguyên văn lên phiếu gửi NCC, nên chúng là
              một khối nghiệp vụ chứ không phải vài ô lẻ. Bản đầu rải chúng vào
              nhóm "Giao hàng" và "Giá & thuế" dưới nhãn chung chung ("Nơi giao",
              "Thanh toán") — chữ "điều khoản" không xuất hiện ở đâu, nên người
              soạn không tìm ra chỗ ghi (chủ dự án 10/09/2026). */}
        <FieldGroup title="Điều khoản — in lên phiếu gửi NCC">
          {TERM_FIELDS.map(([k, label, hint]) => (
            <Field
              key={k}
              label={label}
              inherited={termsEditing && header.terms[k] === tplTerms[k]}
            >
              {' '}
              {/* prettier-ignore */}
              {termsEditing ? (
                <TextArea
                  aria-label={label}
                  rows={2}
                  placeholder={hint}
                  value={header.terms[k]}
                  onChange={(v) => setHeader((h) => ({ ...h, terms: { ...h.terms, [k]: v } }))} // prettier-ignore
                />
              ) : (
                header.terms[k] || '—'
              )}
            </Field>
          ))}
          <Field
            label="Người ký"
            inherited={termsEditing && header.signerRole === tplSigner}
          >
            {termsEditing ? (
              <TextInput
                label="Người ký"
                value={header.signerRole}
                onCommit={(v) => setHeader((h) => ({ ...h, signerRole: v }))}
              />
            ) : (
              (po?.signer_role ?? meta.signerRole)
            )}
          </Field>
          {termsEditing && (
            <div
              style={{ gridColumn: '1 / -1' }}
              className="text-k-sm flex flex-wrap items-center gap-2 pt-1 text-[var(--ink-3)]"
            >
              <GridBtn
                title={`Nạp lại năm điều khoản và người ký theo mẫu ${meta.label.toLowerCase()}`}
                onClick={() => {
                  const d = templateDefaults(template)
                  setHeader((h) => ({ ...h, terms: d.terms, signerRole: d.signerRole }))
                }}
              >
                Lấy lại theo mẫu
              </GridBtn>
              <span>
                Ô nền nhạt là mặc định của mẫu <b>{meta.label}</b> — sửa ở đây chỉ đổi cho
                đơn này.
              </span>
            </div>
          )}
        </FieldGroup>

        <FieldGroup title="Ghi chú đơn">
          {termsEditing ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                value={header.note}
                onChange={(v) => setHeader((h) => ({ ...h, note: v }))}
                rows={3}
                placeholder="Ghi chú nội bộ — nhà cung cấp không thấy"
              />
              {noteOver > 0 && (
                <p className="text-k-sm mt-1 font-semibold text-[var(--stop)]">
                  Dài hơn mức cho phép {noteOver} ký tự — xoá bớt vết cũ ở cuối ghi chú
                  rồi lưu lại.
                </p>
              )}
            </div>
          ) : (
            <div style={{ gridColumn: '1 / -1' }} className="k-note k-note-text">
              {po?.note || 'Không có ghi chú.'}
            </div>
          )}
        </FieldGroup>
      </FastTab>
    </>
  )
}
