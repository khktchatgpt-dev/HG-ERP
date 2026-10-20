'use client'

import { useState, type ReactNode } from 'react'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { PO_CURRENCIES } from '@/lib/po-line'
import { ChonNhom, khop } from '../../_erp/chon-nhom'
import { MenuBa, Nut } from '../../_erp/ui'
import { ChonMau } from './chon-mau'
import { money, numStr, toNum } from './don-chung-tu.shared'
import { hangMucSauDon, OChoViec } from './o-cho-viec'
import { OThue } from './o-thue'
import { moXemTruoc } from './xem-truoc'
import type { DonCtx } from './useDonChungTu'

/*
  ĐẦU ĐƠN LÚC SOẠN — chép bản vẽ "Đầu đơn mua: chọn thuế một chỗ, đơn ngoài lệnh
  thuộc về một hạng mục" (artifact H3bGKgpz…, khối A/B), viết tay KHÔNG qua kit
  (12/10/2026, chủ dự án: "ko dùng kit hiện tại").

    · Dòng tên: ĐƠN ĐẶT VẬT TƯ · mã · "Đang tạo · chưa lưu" — Xem trước · Tạo đơn ở
      GÓC PHẢI (bản cũ dồn mọi nút xuống thanh chốt đáy). Huỷ, Điều khoản vào ⋯.
    · Hàng ô: Cho việc · + gộp lệnh · NCC · Mẫu · Hạn giao · Thuế · "⋯ Tiền tệ ·
      Số HĐ · Chiết khấu" (mở hàng phụ).
    · Chân đơn: Tiền hàng (chưa VAT) · VAT · [hạng mục sau đơn này] · câu chặn
      bấm được · TỔNG THANH TOÁN.
*/

const HF =
  'inline-flex min-h-[34px] items-center rounded-[3px] border bg-[var(--surface-card)] pl-2'
const HL =
  'pr-2 text-[10.5px] font-bold uppercase tracking-[.05em] whitespace-nowrap text-[var(--ink-3)]'
const HV = 'flex items-center gap-1.5 border-l border-[var(--hair)] px-2 py-[5px]'

/** Một ô của hàng đầu đơn: nhãn hoa nhỏ trái, giá trị phải ngăn vạch (bản vẽ `.hf`). */
function Hf({
  label,
  need,
  empty,
  children,
}: {
  label: string
  need?: boolean
  empty?: boolean
  children: ReactNode
}) {
  // prettier-ignore
  return (
    <span className={`${HF} ${need && empty ? 'border-[var(--stop-line)]' : 'border-[var(--line)]'}`}>
      <span className={HL}>
        {label}
        {need && <span className="text-[var(--stop)]"> *</span>}
        {need && <span className="sr-only"> (bắt buộc)</span>}
      </span>
      <span className={HV}>{children}</span>
    </span>
  )
}

/** Chip nét đứt — "+ gộp lệnh", "⋯ Tiền tệ · Số HĐ · Chiết khấu". */
function ChipNet({
  on,
  onClick,
  title,
  children,
}: {
  on?: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  // prettier-ignore
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center rounded-[3px] border px-2.5 py-[6px] text-[12px] font-semibold whitespace-nowrap ${on ? 'border-[var(--act-line)] bg-[var(--act-wash)] text-[var(--act-text)]' : 'border-dashed border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-2)]'}`}
    >
      {children}
    </button>
  )
}

/** Ô ngày kiểu Việt Nam dd/mm/yyyy — gõ liền tự chèn "/", chỉ báo lên khi là ngày có thật. */
function ONgay({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (iso: string) => void
  label: string
}) {
  // prettier-ignore
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      className="w-[92px] bg-transparent font-mono text-[13px] outline-none"
      value={txt ?? isoToVn(value)}
      onChange={(e) => {
        const t = maskVnDate(e.target.value)
        setTxt(t)
        const iso = vnToIso(t)
        if (iso) onChange(iso)
        else if (!t) onChange('')
      }}
      onBlur={() => setTxt(null)}
    />
  )
}

/** Dòng tên + hàng ô + hàng phụ của đơn đang soạn. */
export function DauDonSoan({ d }: { d: DonCtx }) {
  const { p, po, header, setHeader, dirty, template, supplierOpt, meta, busy, problem } = d // prettier-ignore
  const [phu, setPhu] = useState<boolean | null>(null)
  const [gopMo, setGopMo] = useState(false)
  const phuMo = phu ?? (!!header.contractNo || header.currency !== 'VND')
  const gopHien = header.poType === 'lsx' && (gopMo || header.extraLsxIds.length > 0)
  const chonNcc = (v: string) => {
    const s = p.suppliers.find((x) => x.id === v)
    setHeader((h) => ({
      ...h,
      supplierId: v,
      // Tiền tệ theo NCC (gỗ báo USD) — trừ khi đã tự chọn.
      currency:
        !dirty.current.currency && s?.currency ? s.currency.toUpperCase() : h.currency,
    }))
    // Mẫu KHÔNG đổi theo NCC nữa (12/10/2026) — mẫu NCC hay dùng chỉ đứng đầu ô Mẫu (`ChonMau`).
    d.apThueNcc(v)
  }

  return (
    <div className="border-b border-[var(--line)] bg-[var(--surface)] text-[13px] text-[var(--ink)]">
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-2.5 pb-1.5">
        <span className="text-[11px] font-bold tracking-[.06em] text-[var(--ink-3)] uppercase">
          Đơn đặt vật tư
        </span>{' '}
        <span className="font-mono text-[18px] font-bold">{d.code}</span>
        <span className="rounded-[3px] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2 py-[2px] text-[11.5px] font-semibold text-[var(--warn)]">
          {p.mode === 'create' ? 'Đang tạo · chưa lưu' : 'Đang sửa · chưa lưu'}
        </span>
        <span className="text-[12.5px] text-[var(--ink-2)]">
          {po?.supplier_name ?? supplierOpt?.name ?? 'chưa chọn nhà cung cấp'}
        </span>{' '}
        <span className="ml-auto flex items-center gap-1.5">
          <Nut
            onClick={
              () =>
              moXemTruoc({ poId: po?.id ?? null, header, template, lines: d.lines, shipCols: d.shipCols, supplierName: supplierOpt?.name ?? '—' }) // prettier-ignore
            }
          >
            Xem trước
          </Nut>
          <Nut
            chinh
            busy={busy}
            khoa={problem ? `Chưa lưu được: ${problem}` : undefined}
            onClick={() => void d.save()}
          >
            {p.mode === 'create' ? 'Tạo đơn' : 'Lưu'}
          </Nut>
          <MenuBa
            items={[
              {
                label: 'Điều khoản & ghi chú',
                onClick: () => (d.setHeadOpen(true), d.goTo('dau-don')),
              },
              { label: 'Huỷ — bỏ bản đang soạn', onClick: d.askCancelEdit },
            ]}
          />
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-2 border-t border-[var(--hair)] bg-[var(--surface-card)] px-4 py-2">
        <OChoViec
          header={header}
          setHeader={setHeader}
          lsxOptions={d.lsxOptions}
          hangMuc={d.hangMuc}
          onHangMucMoi={d.themHangMuc}
          doiDuoc={!p.po}
          toi={p.me.name}
        />
        {gopHien ? (
          <Hf label="Gộp lệnh">
            {header.extraLsxIds.map((id) => (
              <button
                key={id}
                type="button"
                title="Bỏ lệnh này khỏi đơn"
                className="rounded-[3px] border border-[var(--line)] px-1.5 font-mono text-[12px] hover:border-[var(--stop)]"
                onClick={() => d.toggleExtraLsx(id, false)}
              >
                {p.lsxs.find((l) => l.id === id)?.code ?? '?'} ×
              </button>
            ))}
            <ChonNhom
              label="Gộp thêm lệnh"
              value=""
              text=""
              placeholder={header.extraLsxIds.length ? '+ thêm lệnh nữa' : 'Gõ số lệnh…'}
              width={140}
              listWidth={360}
              nhom={(q) => [
                {
                  title: 'Lệnh sản xuất đang chạy',
                  rows: d.lsxOptions
                    .filter(
                      (o) =>
                        o.value !== header.lsxId && !header.extraLsxIds.includes(o.value),
                    )
                    .filter((o) => !q || khop(q, o.label, o.hint)),
                },
              ]}
              onPick={(v) => d.toggleExtraLsx(v, true)}
            />
          </Hf>
        ) : (
          header.poType === 'lsx' && (
            <ChipNet onClick={() => setGopMo(true)} title="Một đơn mua cho nhiều lệnh">
              + gộp lệnh
            </ChipNet>
          )
        )}
        <Hf label="NCC" need empty={!header.supplierId}>
          <ChonNhom
            label="Nhà cung cấp"
            value={header.supplierId}
            text={supplierOpt?.name ?? ''}
            placeholder="Gõ tên nhà cung cấp…"
            width={200}
            listWidth={420}
            nhom={(q) => [{ title: 'Nhà cung cấp', rows: d.supplierOptions.filter((o) => !q || khop(q, o.label)) }]} // prettier-ignore
            onPick={chonNcc}
          />
        </Hf>
        <Hf label="Mẫu" need empty={!d.mauDaChon}>
          <ChonMau
            value={d.mauDaChon ? template : null}
            goiY={d.mauGoiY}
            nccTen={supplierOpt?.name}
            onChon={d.chonMau}
            className="bg-transparent text-[13px] outline-none"
          />
        </Hf>
        <Hf label="Hạn giao">
          <ONgay
            label="Hạn giao"
            value={header.expectedAt}
            onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
          />{' '}
        </Hf>
        <Hf label="Thuế">
          <OThue
            vat={header.vat}
            inclVat={header.inclVat}
            onChon={d.chonThue}
            macDinh={d.thueMd}
            dem={p.thueDem}
          />{' '}
        </Hf>
        <ChipNet
          on={phuMo}
          onClick={() => setPhu(!phuMo)}
          title="Ít đổi — tự mở khi đơn có giá trị ở đây"
        >
          {phuMo
            ? 'Ẩn bớt'
            : `⋯ Tiền tệ${header.currency !== 'VND' ? ` (${header.currency})` : ''} · Số HĐ${meta.hasDiscount ? ' · Chiết khấu' : ''}`}
        </ChipNet>
      </div>

      {supplierOpt?.can_order === false && (
        <div
          className="px-4 pb-1.5 text-[11.5px] text-[var(--stop)]"
          title={supplierOpt.lock_reason ?? undefined}
        >
          NCC này đang khoá đặt hàng
          {supplierOpt.lock_reason ? ` — ${supplierOpt.lock_reason}` : ''}
        </div>
      )}

      {phuMo && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] bg-[var(--surface-raised)] px-4 py-2">
          <Hf label="Tiền">
            <select
              aria-label="Tiền tệ"
              className="bg-transparent text-[13px] outline-none"
              value={header.currency}
              onChange={(e) => {
                d.markDirty('currency')
                setHeader((h) => ({ ...h, currency: e.target.value }))
              }}
            >
              {PO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Hf>
          <Hf label="Số HĐ">
            <input
              aria-label="Số hợp đồng"
              className="w-[120px] bg-transparent font-mono text-[13px] outline-none"
              defaultValue={header.contractNo}
              onBlur={(e) =>
                setHeader((h) => ({ ...h, contractNo: e.target.value.trim() }))
              }
            />
          </Hf>
          {meta.hasDiscount && (
            <Hf label="Chiết khấu">
              <input
                aria-label="Chiết khấu"
                inputMode="decimal"
                className="w-[100px] bg-transparent text-right font-mono text-[13px] outline-none"
                defaultValue={numStr(header.discount)}
                onBlur={(e) =>
                  setHeader((h) => ({ ...h, discount: toNum(e.target.value) }))
                }
              />
            </Hf>
          )}
          {supplierOpt &&
            (supplierOpt.lead_time_days != null || supplierOpt.payment_terms) && (
              <span className="text-[11.5px] text-[var(--ink-3)]">
                NCC giao{' '}
                {supplierOpt.lead_time_days != null
                  ? `${supplierOpt.lead_time_days} ngày`
                  : '—'}{' '}
                · thanh toán {supplierOpt.payment_terms ?? '—'}
              </span>
            )}
        </div>
      )}
    </div>
  )
}

/**
 * CHÂN ĐƠN LÚC SOẠN (bản vẽ): Tiền hàng (chưa VAT) · VAT · [hạng mục sau đơn này]
 * · câu chặn BẤM ĐƯỢC (nhảy tới đúng ô) · TỔNG THANH TOÁN. Nút đã lên dòng tên.
 */
export function ChanDonSoan({ d }: { d: DonCtx }) {
  const { header, totals, problem } = d
  const cur = header.currency
  const hmSau =
    header.poType === 'standalone'
      ? hangMucSauDon(
          d.hangMuc.find((x) => x.id === header.projectId),
          totals.grandTotal,
          cur,
        )
      : null
  const K = 'text-[var(--ink-3)]'
  return (
    <div className="sticky bottom-0 z-[5] flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-[var(--line)] bg-[var(--surface-card)] px-4 py-2 text-[12.5px] text-[var(--ink)]">
      <span>
        <span className={K}>
          {header.inclVat ? 'Tiền hàng (đã gồm VAT)' : 'Tiền hàng (chưa VAT)'}
        </span>{' '}
        <span className="font-mono">{money(totals.subtotal, cur)}</span>
      </span>
      <span>
        <span className={K}>
          VAT {header.vat === '' ? 0 : header.vat}%{header.inclVat ? ' (đã gồm)' : ''}
        </span>{' '}
        <span className="font-mono">{money(totals.vatAmount, cur)}</span>
      </span>
      {hmSau && <span className={K}>sau đơn này hạng mục lên {hmSau}</span>}
      {problem && (
        <button
          type="button"
          onClick={() => d.goToProblem(problem)}
          className="rounded-[3px] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2 py-[2px] text-[12px] font-semibold text-[var(--warn)] hover:underline"
        >
          Chưa lưu được: {problem} →
        </button>
      )}
      <span className="ml-auto font-bold">
        TỔNG THANH TOÁN{' '}
        <span className="font-mono text-[16px]">{money(totals.grandTotal, cur)}</span>
      </span>
    </div>
  )
}
