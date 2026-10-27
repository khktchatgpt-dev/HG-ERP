'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Consequence,
  DateInput,
  Field,
  FieldGroup,
  NumInput,
  Pick,
  ScopeSwitch,
  Sheet,
  SheetActions,
  TextInput,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import {
  datTrenSanLoi,
  docTien,
  PREPAY_METHOD_LABEL,
  PREPAY_METHODS,
  type PrepayMethod,
} from '@/lib/mua-san'
import { money } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/*
  HỘP "ĐẶT TRÊN SÀN" (0278, bản vẽ "Đơn mua trên sàn" khung 2 + 2b, duyệt 27/10/2026).

  Với đơn sàn, bấm đặt trong app Shopee cũng là lúc sàn trừ tiền — nên bước này thay
  "NCC xác nhận" và ghi MỘT LẦN: mã đơn sàn, cách trả, số tiền app đã trừ. Server
  (`posService.confirm` + khối `san`) đổi đơn sang "Chờ giao", ghi mã đơn vào số tờ
  NCC và ghi phiếu chi trả trước (COD thì không — trả khi nhận, Kế toán ghi).

  Chặn TẠI CHỖ bằng đúng hàm server dùng (`datTrenSanLoi`): thiếu thì nút khoá và câu
  chặn nói thiếu gì. Lệch tiền so với tổng đơn chỉ CẢNH BÁO (câu 2 đã chốt): số app
  trừ là sự thật, đơn sửa sau bằng Điều chỉnh đơn.
*/

export function DatTrenSanSheet({ d }: { d: DonCtx }) {
  const po = d.po!
  const router = useRouter()
  const toast = useToast()
  const [orderNo, setOrderNo] = useState(po.supplier_doc_no ?? '')
  const [tracking, setTracking] = useState(po.marketplace_tracking_no ?? '')
  const [method, setMethod] = useState<PrepayMethod>('ck')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(d.p.me.id)
  const [eta, setEta] = useState(po.expected_at?.slice(0, 10) ?? '')
  const [busy, setBusy] = useState(false)

  const tien = method === 'cod' ? null : docTien(amount)
  const why = datTrenSanLoi({ order_no: orderNo, method, amount: tien })
  const tong = d.totals.grandTotal
  const lech = tien != null ? Math.round((tien - tong) * 100) / 100 : null
  const cur = po.currency
  const nguoi = d.p.payers?.length ? d.p.payers : [d.p.me]

  async function ghi() {
    if (why) return
    setBusy(true)
    try {
      // Ngày sàn hẹn khác hạn giao → khai một đợt giao đúng ngày đó (cùng lối "NCC hẹn").
      const lines = d.p.lines.filter((l) => l.material_id && Number(l.qty_ordered) > 0).map((l) => ({ po_line_id: l.id, qty: Number(l.qty_ordered) })) // prettier-ignore
      const doiNgay = eta && eta !== po.expected_at?.slice(0, 10)
      await api(`/api/dept/supply/pos/${po.id}/confirm`, {
        method: 'POST',
        body: {
          confirmed_note: `Đặt trên sàn${po.marketplace_shop ? ` — ${po.marketplace_shop}` : ''}`, // prettier-ignore
          shipments: doiNgay ? [{ expected_date: eta, lines }] : [],
          san: {
            order_no: orderNo.trim(),
            tracking_no: tracking.trim() || null,
            method,
            amount: tien,
            paid_by_user_id: method === 'ung' ? paidBy : null,
          },
        },
      })
      toast.success(`Đã ghi đặt trên sàn ${po.code} — đơn chờ giao`)
      d.setSheet(null)
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e, 'Không ghi được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      width={620}
      stakes="vua"
      onClose={() => d.setSheet(null)}
      title={`Đặt trên sàn · ${po.code}`}
      subtitle='Bấm đặt trong app xong thì ghi lại đây. Đơn sang "Chờ giao", số tiền vào công nợ như đã trả trước.'
      footer={
        <SheetActions
          stakes="vua"
          busy={busy}
          disabled={!!why}
          onCancel={() => d.setSheet(null)}
          onConfirm={() => void ghi()}
          confirmLabel="Ghi đã đặt trên sàn"
        />
      }
    >
      <FieldGroup title="Đơn trên sàn">
        <Field label="Mã đơn sàn *">
          <TextInput
            label="Mã đơn sàn"
            value={orderNo}
            onCommit={setOrderNo}
            mono
            placeholder="dán mã đơn trong app"
          />
        </Field>
        <Field label="Mã vận đơn">
          <TextInput
            label="Mã vận đơn"
            value={tracking}
            onCommit={setTracking}
            mono
            placeholder="để trống — điền sau được"
          />
        </Field>
        <Field label="Sàn hẹn giao">
          <DateInput label="Sàn hẹn giao" value={eta} onChange={setEta} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Tiền đã trả">
        <Field label="Trả bằng *">
          <ScopeSwitch
            label="Trả bằng"
            value={method}
            onChange={setMethod}
            options={PREPAY_METHODS.map((m) => ({
              value: m,
              label: PREPAY_METHOD_LABEL[m],
            }))}
          />
        </Field>
        {method !== 'cod' && (
          <Field label={`Số tiền app đã trừ (${cur}) *`}>
            <NumInput
              aria-label="Số tiền app đã trừ"
              value={amount}
              onCommit={setAmount}
              align="left"
              placeholder="gồm phí ship, đã trừ voucher"
            />
          </Field>
        )}
        {method === 'ung' && (
          <Field label="Người ứng">
            <Pick
              label="Người ứng tiền"
              value={paidBy}
              onChange={setPaidBy}
              options={nguoi.map((u) => ({ value: u.id, label: u.id === d.p.me.id ? `${u.name} (tôi)` : u.name }))} // prettier-ignore
              width={260}
            />
          </Field>
        )}
      </FieldGroup>

      {method === 'cod' ? (
        <Consequence>
          COD: chưa ghi phiếu chi. Trả tiền lúc nhận hàng, Kế toán ghi phiếu chi gắn đơn
          này.
        </Consequence>
      ) : (
        <div className="text-k-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-0.5 border border-[var(--hair)] bg-[var(--surface-raised)] px-3 py-2">
          <span>Tổng thanh toán của đơn</span>
          <span className="num text-right">{money(tong, cur)}</span>
          <span>Số app đã trừ</span>
          <span className="num text-right">{tien != null ? money(tien, cur) : '—'}</span>
          <span>Chênh</span>
          <span
            className={`num text-right font-semibold ${lech == null ? '' : Math.abs(lech) < 1 ? 'text-[var(--done)]' : 'text-[var(--warn)]'}`}
          >
            {lech == null ? '—' : Math.abs(lech) < 1 ? '0 · khớp' : money(lech, cur)}
          </span>
        </div>
      )}
      {lech != null && Math.abs(lech) >= 1 && (
        <p className="text-k-sm mt-2 text-[var(--warn)]">
          App trừ {lech < 0 ? 'ít' : 'nhiều'} hơn tổng đơn {money(Math.abs(lech), cur)}.
          Thường do voucher chưa ghi vào Chiết khấu hoặc phí ship chưa có dòng phí. Vẫn
          ghi được — số đã trả là số thật; sửa đơn sau bằng Điều chỉnh đơn.
        </p>
      )}
      {why && <p className="text-k-sm mt-2 font-semibold text-[var(--stop)]">{why}</p>}
    </Sheet>
  )
}
