'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Field,
  HeadChip,
  HeadChips,
  Sheet,
  SheetActions,
  Tag,
  TextInput,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { HOA_DON_DON_LABEL, hoaDonDon, PREPAY_METHOD_LABEL, type PrepayMethod } from '@/lib/mua-san' // prettier-ignore
import { DatTrenSanSheet } from './dat-tren-san'
import { dmy, money } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/*
  HÀNG CHIP PHỤ của đầu đơn (tách khỏi DonChungTuScreen 27/10/2026 — file đó đã chạm
  trần cỡ trong size-baseline).

  · Đơn NCC thường: Thanh toán · Nơi giao, chip không khung như trước (28/09/2026).
  · Đơn SÀN (0278, bản vẽ khung 3): Mã đơn sàn · Mã vận đơn · Đã trả trước · Hoá đơn
    GTGT. Thanh toán/Nơi giao của đơn sàn luôn là "trả trước khi đặt" / "shop gửi" —
    bày ra là chiếm chỗ của bốn thứ người ta thật sự hỏi.

  Hai thứ biết SAU khi đặt — mã vận đơn và "không có hoá đơn" — sửa ở hộp nhỏ ngay đây,
  ghi qua cửa sửa điều khoản (`PATCH …/terms`, mở mọi trạng thái trừ huỷ).
*/

type Sua = 'van-don' | 'hoa-don' | null

export function HangChipPhu({ d, chipEdit }: { d: DonCtx; chipEdit: boolean }) {
  const po = d.po!
  const [sua, setSua] = useState<Sua>(null)
  const san = !!d.supplierOpt?.is_marketplace

  if (!san)
    return (
      <HeadChips>
        <HeadChip
          label="Thanh toán"
          value={po.terms_payment}
          muted
          plain
          onClick={chipEdit ? () => d.startEdit('Thanh toán') : undefined}
        />
        <HeadChip
          label="Nơi giao"
          value={po.terms_delivery_place}
          muted
          plain
          onClick={chipEdit ? () => d.startEdit('Nơi giao') : undefined}
        />
      </HeadChips>
    )

  const fin = d.p.finance
  const tra = fin?.payments ?? []
  const cach = tra.find((x) => x.amount > 0)?.method as PrepayMethod | undefined
  const hd = hoaDonDon({
    invoice_waived_reason: po.invoice_waived_reason,
    posted_invoice_count: fin?.invoices.length ?? 0,
  })
  const sua_ = chipEdit ? (k: Sua) => () => setSua(k) : () => undefined
  return (
    <>
      <HeadChips>
        <HeadChip
          label="Mã đơn sàn"
          value={
            po.supplier_doc_no ? <span className="num">{po.supplier_doc_no}</span> : null
          }
        />
        <HeadChip
          label="Mã vận đơn"
          value={
            po.marketplace_tracking_no ? (
              <span className="num">{po.marketplace_tracking_no}</span>
            ) : null
          }
          onClick={chipEdit ? sua_('van-don') : undefined}
        />
        <HeadChip
          label="Đã trả trước"
          value={
            fin && fin.paid !== 0 ? (
              <span className="num">
                {money(fin.paid, fin.currency)}
                {cach && cach in PREPAY_METHOD_LABEL
                  ? ` · ${PREPAY_METHOD_LABEL[cach]}`
                  : ''}
              </span>
            ) : null
          }
        />
        <HeadChip
          label="Hoá đơn GTGT"
          value={
            <Tag tone={hd === 'received' ? 'done' : hd === 'waived' ? 'neutral' : 'warn'}>
              {HOA_DON_DON_LABEL[hd]}
            </Tag>
          }
          onClick={hd !== 'received' && chipEdit ? sua_('hoa-don') : undefined}
        />
      </HeadChips>
      {d.sheet?.action.id === 'place_san' && <DatTrenSanSheet d={d} />}
      {sua && <SuaSauDat d={d} kind={sua} onClose={() => setSua(null)} />}
    </>
  )
}

/** Hộp nhỏ sửa mã vận đơn / "không có hoá đơn" sau khi đặt — một ô, một nút. */
function SuaSauDat({
  d,
  kind,
  onClose,
}: {
  d: DonCtx
  kind: Exclude<Sua, null>
  onClose: () => void
}) {
  const po = d.po!
  const router = useRouter()
  const toast = useToast()
  const vanDon = kind === 'van-don'
  const [v, setV] = useState(
    (vanDon ? po.marketplace_tracking_no : po.invoice_waived_reason) ?? '',
  )
  const [busy, setBusy] = useState(false)

  async function luu() {
    setBusy(true)
    try {
      // PATCH /terms ghi CẢ BỘ chữ của phiếu — gửi lại nguyên các ô đang có, chỉ đổi một ô.
      await api(`/api/dept/supply/pos/${po.id}/terms`, {
        method: 'PATCH',
        body: {
          contract_no: po.contract_no,
          terms_quality: po.terms_quality,
          terms_delivery_place: po.terms_delivery_place,
          terms_payment: po.terms_payment,
          terms_invoice: po.terms_invoice,
          terms_lead_time: po.terms_lead_time,
          signer_role: po.signer_role,
          note: po.note,
          ...(vanDon
            ? { marketplace_tracking_no: v.trim() || null }
            : { invoice_waived_reason: v.trim() || null }),
        },
      })
      toast.success(vanDon ? `Đã ghi mã vận đơn ${po.code}` : `Đã ghi hoá đơn ${po.code}`)
      onClose()
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
      width={520}
      stakes="nhe"
      onClose={onClose}
      title={`${vanDon ? 'Mã vận đơn' : 'Không có hoá đơn GTGT'} · ${po.code}`}
      subtitle={
        vanDon
          ? 'Sàn cấp khi shop giao cho bên ship. Kho dùng để khớp kiện lúc nhận.'
          : 'Kế toán sẽ thấy đơn này "không có hoá đơn" và thôi chờ. Shop gửi hoá đơn sau thì hoá đơn vào sổ thắng dấu này. Xoá trắng ô = bỏ dấu.'
      }
      footer={
        <SheetActions
          stakes="nhe"
          busy={busy}
          disabled={!vanDon && !v.trim() && !po.invoice_waived_reason}
          onCancel={onClose}
          onConfirm={() => void luu()}
          confirmLabel="Lưu"
        />
      }
    >
      <Field label={vanDon ? 'Mã vận đơn' : 'Lý do *'}>
        <TextInput
          label={vanDon ? 'Mã vận đơn' : 'Lý do không có hoá đơn'}
          value={v}
          onCommit={setV}
          mono={vanDon}
          placeholder={vanDon ? 'SPXVN…' : 'Shop cá nhân, không xuất hoá đơn'}
        />
      </Field>
      {!vanDon && (
        <p className="text-k-sm mt-2 text-[var(--ink-3)]">
          Gợi ý: Shop cá nhân · Shop chỉ xuất hoá đơn bán lẻ · Đơn dưới mức shop xuất hoá
          đơn
          {po.invoice_waived_reason ? ` · đang ghi từ ${dmy(po.confirmed_at)}` : ''}
        </p>
      )}
    </Sheet>
  )
}
