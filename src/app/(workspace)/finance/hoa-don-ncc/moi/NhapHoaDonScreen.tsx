'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  CommitBar,
  DateInput,
  Empty,
  Grid,
  GridBody,
  GridCheck,
  GridHead,
  GridRow,
  HeadChip,
  HeadChips,
  HeadField,
  NoticeBar,
  NumInput,
  ScreenFrame,
  ScreenHeader,
  Td,
  TextInput,
  Th,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  draftBlockers,
  invoiceTotals,
  type DraftBasis,
  type DraftLine,
} from '@/lib/invoice-draft'

type Draft = {
  po: {
    id: string
    code: string
    currency: string
    supplier_id: string
    supplier_name: string
  }
  lines: DraftLine[]
  suggested_due_date: string | null
  net_days: number | null
  today: string
}

const money = (n: number, cur: string) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const dmy = (d: string) => d.split('-').reverse().join('/')

/** Cơ sở của số lượng mồi — phải nói ra, không để con số đứng trơ. */
const BASIS: Record<DraftBasis, { label: string; tone?: 'warn' | 'done' }> = {
  da_nhan: { label: 'theo hàng đã về', tone: 'done' },
  da_dat: { label: 'theo số đã đặt', tone: 'warn' },
  du_roi: { label: 'đã đủ hoá đơn' },
}

/**
 * NHẬP HOÁ ĐƠN NCC TỪ ĐƠN MUA — Khuôn F (bảng nhập liệu).
 *
 * Trước màn này, nút "Nhập hoá đơn" trên màn đối chiếu trỏ vào một route KHÔNG
 * TỒN TẠI, và cả phân hệ công nợ là phần báo cáo dựng trên một cái phễu chưa có
 * miệng — đo 11/09/2026: sổ TK 331 có đúng 1 tờ hoá đơn trên 5,68 tỷ đã cam kết.
 *
 * Lưới là nhân vật chính nên đầu đơn co thành dải chip; thanh chốt đáy nói vì
 * sao chưa lưu được bằng một câu BẤM ĐƯỢC.
 *
 * ⭐ MỌI SỐ MỒI SẴN ĐỀU SỬA ĐƯỢC, và mỗi dòng nói rõ số đó dựa trên cái gì. Số
 * phải trả là số trên TỜ GIẤY của NCC — phần mềm mồi để đỡ gõ, không để quyết.
 *
 * ⭐ LƯU RA NHÁP, KHÔNG TỰ VÀO SỔ. Vào sổ = sinh công nợ, nên đó là một hành
 * động riêng có chủ ý (nút "Vào sổ" ở màn hoá đơn), không phải hệ quả của việc
 * bấm Lưu.
 */
export function NhapHoaDonScreen({ draft }: { draft: Draft }) {
  const router = useRouter()
  const toast = useToast()
  const cur = draft.po.currency

  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(draft.today)
  const [dueDate, setDueDate] = useState(draft.suggested_due_date ?? '')
  const [vatRate, setVatRate] = useState('10')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  /** line_id → {selected, qty, price} đã sửa. Chưa đụng thì dùng số mồi. */
  const [edit, setEdit] = useState<
    Record<string, { selected?: boolean; qty?: string; price?: string }>
  >({})

  const rows = useMemo(
    () =>
      draft.lines.map((l) => {
        const e = edit[l.po_line_id] ?? {}
        const qty = e.qty != null ? Number(e.qty.replace(',', '.')) || 0 : l.qty
        const price =
          e.price != null ? Number(e.price.replace(',', '.')) || 0 : l.unit_price
        return {
          ...l,
          selected: e.selected ?? l.selected,
          qtyText: e.qty ?? String(l.qty),
          priceText: e.price ?? String(l.unit_price),
          qty,
          unit_price: price,
          amount: Math.round(qty * price * 100) / 100,
        }
      }),
    [draft.lines, edit],
  )

  const chosen = rows.filter((r) => r.selected)
  const totals = invoiceTotals(chosen, Number(vatRate.replace(',', '.')) || 0)
  const blockers = draftBlockers({
    invoice_no: invoiceNo,
    invoice_date: invoiceDate,
    lines: chosen,
    total_typed: totals.total,
    total_computed: totals.total,
  })

  /*
    Cảnh báo KHÔNG chặn lưu — chúng là chuyện có thật ngoài đời (NCC đòi trước
    khi giao, NCC đổi giá), việc của màn là bày ra để mắt soát chứ không phải
    cấm. Chặn những thứ này là đẩy kế toán ra ngoài hệ thống.
  */
  const aheadOfReceipt = chosen.filter((r) => r.basis === 'da_dat' && r.qty > 0)
  const overReceived = chosen.filter(
    (r) => r.remaining_received < -0.0005 || r.qty - r.remaining_received > 0.0005,
  )

  const set = (id: string, patch: { selected?: boolean; qty?: string; price?: string }) =>
    setEdit((p) => ({ ...p, [id]: { ...p[id], ...patch } }))

  async function save(): Promise<void> {
    if (blockers.length > 0 || busy) return
    setBusy(true)
    try {
      // API trả `{ invoice }`, không phải `{ id }` — đọc sai là điều hướng tới
      // `?hd=undefined` và tờ vừa lập không được tô sáng ở sổ.
      const created = await api<{ invoice: { id: string } }>(
        '/api/dept/accounting/supplier-invoices',
        {
          method: 'POST',
          body: {
            supplier_id: draft.po.supplier_id,
            invoice_no: invoiceNo.trim(),
            invoice_date: invoiceDate,
            due_date: dueDate || null,
            currency: cur,
            subtotal: totals.subtotal,
            vat_amount: totals.vat,
            total: totals.total,
            note: note.trim() || null,
            lines: chosen.map((r) => ({
              po_line_id: r.po_line_id,
              description: r.description,
              qty: r.qty,
              unit: r.unit,
              unit_price: r.unit_price,
              vat_rate: Number(vatRate.replace(',', '.')) || 0,
            })),
          },
        },
      )
      toast.success(
        `Đã lưu ${invoiceNo.trim()} ở dạng NHÁP — chưa sinh công nợ. Bấm "Vào sổ" ở sổ hoá đơn.`,
      )
      router.push(`/finance/hoa-don-ncc/so?hd=${created.invoice.id}`)
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Tài chính · Kế toán"
          title={`Nhập hoá đơn NCC cho ${draft.po.code}`}
          actions={
            <>
              <Btn href={`/finance/hoa-don-ncc?don=${draft.po.id}`}>Về đối chiếu</Btn>
              <Btn href={`/mua-hang/don/${draft.po.id}`}>Mở đơn mua</Btn>
            </>
          }
        />

        {/*
          Chip KẾ THỪA (bấm để đi tới) và ô GÕ THẲNG là hai thành phần khác nhau:
          `HeadChip` là <button>, nhét ô nhập vào là nút lồng nút và React hỏng
          hydration — vấp thật khi dựng màn này (DateInput có nút mở lịch).
        */}
        <HeadChips>
          <HeadChip label="Nhà cung cấp" value={draft.po.supplier_name} />
          <HeadChip label="Đơn mua" value={draft.po.code} />
          <HeadChip label="Tiền tệ" value={cur} />
          <HeadField label="Số hoá đơn" need empty={!invoiceNo.trim()} width={150}>
            <TextInput
              value={invoiceNo}
              onCommit={setInvoiceNo}
              mono
              label="Số hoá đơn NCC"
              placeholder="số trên tờ giấy"
            />
          </HeadField>
          <HeadField label="Ngày hoá đơn" need empty={!invoiceDate} width={126}>
            <DateInput
              value={invoiceDate}
              onChange={setInvoiceDate}
              label="Ngày hoá đơn"
            />
          </HeadField>
          <HeadField
            label={
              draft.net_days == null
                ? 'Hạn thanh toán'
                : `Hạn TT (${draft.net_days} ngày)`
            }
            width={126}
          >
            <DateInput value={dueDate} onChange={setDueDate} label="Hạn thanh toán" />
          </HeadField>
          <HeadField label="VAT %" width={58}>
            <NumInput
              value={vatRate}
              onCommit={setVatRate}
              align="left"
              aria-label="Thuế suất VAT"
            />
          </HeadField>
        </HeadChips>

        {/*
          Hạn thanh toán trống làm cả bảng tuổi nợ đọc sai: hoá đơn không hạn rơi
          vào rổ riêng và mọi rổ quá hạn trông nhỏ đi. Nói NGAY lúc nhập, chỗ sửa
          được, thay vì để kế toán phát hiện ở màn khác.
        */}
        {draft.net_days == null && (
          <NoticeBar
            tone="warn"
            tag="Thiếu điều khoản"
            action={{
              label: 'Mở hồ sơ NCC',
              onClick: () => router.push(`/planning/suppliers/${draft.po.supplier_id}`),
            }}
          >
            NCC này chưa khai số ngày thanh toán, nên không suy được hạn. Gõ tay hạn ở
            trên, hoặc khai một lần vào hồ sơ NCC để lần sau tự điền.
          </NoticeBar>
        )}
        {aheadOfReceipt.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Chưa về hàng"
            action={{
              label: 'Xem đối chiếu',
              onClick: () => router.push(`/finance/hoa-don-ncc?don=${draft.po.id}`),
            }}
          >
            {' '}
            {/* prettier-ignore */}
            <b>{aheadOfReceipt.length}</b> dòng đang lấy theo <b>số đã đặt</b> vì kho chưa
            ghi nhận hàng về. Vẫn lưu được — nhưng đó là ghi nợ cho hàng chưa nhận, nên
            hãy đối chiếu với phiếu giao của NCC trước khi vào sổ.
          </NoticeBar>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline="Đơn mua này không có dòng nào"
              reason="Hoá đơn NCC được lập từ các dòng của đơn mua. Đơn không có dòng thì không có gì để đòi tiền."
              next={<Btn href={`/mua-hang/don/${draft.po.id}`}>Mở đơn mua</Btn>}
            />
          ) : (
            <Grid minWidth={1060}>
              <GridHead>
                <Th width={34} />
                <Th>Vật tư</Th>
                <Th num width={96}>
                  Đã đặt
                </Th>
                <Th num width={96}>
                  Đã về
                </Th>
                <Th num width={110}>
                  Đã có HĐ
                </Th>
                <Th num width={120}>
                  SL hoá đơn
                </Th>
                <Th num width={130}>
                  Đơn giá
                </Th>
                <Th num width={130}>
                  Thành tiền
                </Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => (
                  <GridRow key={r.po_line_id} selected={r.selected}>
                    <GridCheck
                      checked={r.selected}
                      onChange={() => set(r.po_line_id, { selected: !r.selected })}
                      label={`Đưa ${r.description} vào hoá đơn`}
                    />
                    <Td>
                      <div>
                        {r.material_code && (
                          <span className="num k-strong mr-1">{r.material_code}</span>
                        )}
                        {r.description}
                      </div>
                      <div
                        className={
                          BASIS[r.basis].tone
                            ? `k-t-${BASIS[r.basis].tone} text-[11px]`
                            : 'text-[11px] text-[var(--ink-3)]'
                        }
                      >
                        {BASIS[r.basis].label}
                        {r.unit ? ` · ${r.unit}` : ''}
                      </div>
                    </Td>
                    <Td num>{num(r.qty_ordered)}</Td>
                    <Td num tone={r.qty_received > 0 ? 'done' : undefined}>
                      {r.qty_received ? num(r.qty_received) : '—'}
                    </Td>
                    <Td num>{r.qty_invoiced ? num(r.qty_invoiced) : '—'}</Td>
                    <Td num>
                      <NumInput
                        value={r.qtyText}
                        onCommit={(v) => set(r.po_line_id, { qty: v, selected: true })}
                        aria-label={`Số lượng hoá đơn của ${r.description}`}
                      />
                    </Td>
                    <Td num>
                      <NumInput
                        value={r.priceText}
                        onCommit={(v) => set(r.po_line_id, { price: v, selected: true })}
                        aria-label={`Đơn giá hoá đơn của ${r.description}`}
                      />
                    </Td>
                    <Td num>{r.selected ? money(r.amount, cur) : '—'}</Td>
                  </GridRow>
                ))}
              </GridBody>
            </Grid>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hair)] px-[var(--gutter)] py-3">
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">Ghi chú</span>
            <div className="min-w-[320px] flex-1">
              <TextInput
                value={note}
                onCommit={setNote}
                label="Ghi chú hoá đơn"
                placeholder="ví dụ: kèm phiếu giao 12/09, NCC báo thiếu 2 cây"
              />
            </div>
          </div>
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng chọn', value: `${chosen.length}/${rows.length}` },
            { label: 'Tiền hàng', value: `${money(totals.subtotal, cur)} ${cur}` },
            { label: `VAT ${vatRate}%`, value: money(totals.vat, cur) },
          ]}
          grand={{
            label: 'Tổng thanh toán',
            value: `${money(totals.total, cur)} ${cur}`,
          }}
          blocked={blockers[0]}
          actions={
            <Btn primary onClick={save} disabled={blockers.length > 0 || busy}>
              {busy ? 'Đang lưu…' : 'Lưu hoá đơn nháp'}
            </Btn>
          }
        />

        {/*
          Nói HẬU QUẢ của nút ngay cạnh nút. "Lưu" mà người dùng tưởng là đã ghi
          công nợ thì họ sẽ không bao giờ bấm Vào sổ, và sổ TK 331 vĩnh viễn
          trống trong khi màn hoá đơn đầy.
        */}
        <div className="border-t border-[var(--hair)] px-[var(--gutter)] py-2 text-[11.5px] text-[var(--ink-3)]">
          Lưu ra <b>NHÁP</b> — chưa sinh công nợ. Công nợ phát sinh khi bấm <b>Vào sổ</b>{' '}
          ở màn Hoá đơn; lúc đó tờ này mới vào sổ TK 331 và vào bảng tuổi nợ
          {dueDate ? ` (hạn ${dmy(dueDate)})` : ' — hiện CHƯA có hạn'}.
          {overReceived.length > 0 && (
            <>
              {' '}
              <span className="k-t-warn">
                {overReceived.length} dòng đang đòi nhiều hơn hàng đã về.
              </span>
            </>
          )}
        </div>
      </ScreenFrame>
    </div>
  )
}
