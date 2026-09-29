'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Chip,
  Field,
  FieldGrid,
  Hint,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  TextArea,
  TextInput,
  TextLink,
  ToneText,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { nextSupplierCode } from '@/lib/supplier-code'
import { findSupplierDupes } from '@/lib/supplier-dup'
import { PhapLyNganHang, emptyPhapLy, phapLyBody, type PhapLy } from './phap-ly-ngan-hang'
import type { NccRow } from './NccScreen'

const VAT = ['0', '5', '8', '10'] as const
const hoSo = (id: string) => `/mua-hang/ncc/${id}`

/**
 * THÊM NHÀ CUNG CẤP — panel trong khu mới (29/09/2026, artboard 15/15b đã duyệt).
 *
 * Thay form 40 ô của khu cũ đã xoá. Ô trên panel chọn theo ĐỘ PHỦ đo trên 175
 * NCC: tên 175 · địa chỉ 158 · loại 137 · ĐT 133 · người liên hệ 128 · MST 100
 * · viết tắt 35 · tiền tệ 15. Pháp lý/ngân hàng (0–1/175) gập lại.
 *
 * Chống trùng hai mức, cùng hàm `lib/supplier-dup` với server:
 *  - MST đã có chủ → CHẶN, chỉ tới hồ sơ đang giữ MST (3/3 cặp trùng đo được là
 *    gõ nhầm). Server chặn lại lần nữa (409) cho mọi đường ghi.
 *  - Tên trùng sau khi bỏ cụm pháp lý → CẢNH BÁO, vẫn thêm được (chi nhánh).
 *
 * Thêm xong đi thẳng vào hồ sơ NCC mới: việc tiếp theo gần như luôn là soạn đơn.
 */
export function ThemNccSheet({
  rows,
  types,
  buyers,
  meId,
  onClose,
}: {
  rows: NccRow[]
  /** Loại NCC đang dùng, nhiều trước — gợi ý bấm nhanh. */
  types: string[]
  buyers: { id: string; name: string }[]
  meId: string
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    name: '',
    short_name: '',
    code: '',
    type: '',
    tax_no: '',
    contact_name: '',
    contact_phone: '',
    phone: '',
    address: '',
    currency: 'VND',
    vat: '',
    payment_terms: '',
    payment_net_days: '',
    buyer_id: buyers.some((b) => b.id === meId) ? meId : '',
    note: '',
  })
  const [legal, setLegal] = useState<PhapLy>(() => emptyPhapLy())
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  const dup = useMemo(() => findSupplierDupes(rows, { name: f.name, tax_no: f.tax_no }), [rows, f.name, f.tax_no]) // prettier-ignore
  const autoCode = useMemo(
    () =>
      f.name.trim()
        ? nextSupplierCode(
            f.name,
            rows.map((r) => r.code ?? ''),
          )
        : '',
    [rows, f.name],
  )
  const why = !f.name.trim()
    ? 'thiếu tên nhà cung cấp'
    : dup.taxOwner
      ? `MST trùng với ${dup.taxOwner.short_name ?? dup.taxOwner.name}`
      : null

  async function save() {
    if (why) return
    setBusy(true)
    try {
      const s = (x: string) => x.trim() || null
      const r = await api<{
        supplier: { id: string; code: string | null; name: string }
      }>('/api/dept/supply/suppliers', {
        method: 'POST',
        body: {
          name: f.name.trim(),
          short_name: s(f.short_name),
          code: s(f.code),
          type: s(f.type),
          tax_no: s(f.tax_no),
          contact_name: s(f.contact_name),
          contact_phone: s(f.contact_phone),
          phone: s(f.phone),
          address: s(f.address),
          currency: f.currency || null,
          // Trống = CHƯA KHAI (rơi về mức của mẫu đơn), khác hẳn 0%.
          vat_rate: f.vat === '' ? null : Number(f.vat),
          payment_terms: s(f.payment_terms),
          payment_net_days: f.payment_net_days.trim() === '' ? null : Number(f.payment_net_days), // prettier-ignore
          buyer_id: f.buyer_id || null,
          note: s(f.note),
          ...phapLyBody(legal),
        },
      })
      const sp = r.supplier
      toast.success(`Đã thêm ${sp.code ? `${sp.code} · ` : ''}${f.short_name.trim() || sp.name}`, 'Đang mở hồ sơ — pháp lý, ngân hàng khai ở nút Sửa khi cần.') // prettier-ignore
      router.push(hoSo(sp.id))
    } catch (e) {
      toast.error('Thêm không được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Thêm nhà cung cấp"
      subtitle="Khai đủ để lên đơn được ngay. Pháp lý, ngân hàng thêm sau cũng được — ở hồ sơ NCC."
      stakes="nhe"
      width={720}
      footer={
        <div className="flex w-full items-center gap-3">
          <span className="text-k-sm flex-1">
            {why && (
              <ToneText tone="stop" strong={false}>
                Chưa thêm được: {why}
              </ToneText>
            )}
          </span>
          <SheetActions
            stakes="nhe"
            busy={busy}
            disabled={!!why}
            onCancel={onClose}
            onConfirm={() => void save()}
            cancelLabel="Thôi"
            confirmLabel="Thêm và mở hồ sơ"
          />
        </div>
      }
    >
      <FieldGrid>
        <Field label="Tên nhà cung cấp *">
          <TextInput
            value={f.name}
            onCommit={set('name')}
            label="Tên nhà cung cấp"
            placeholder="tên trên báo giá / hoá đơn"
          />
        </Field>
        <Field label="Tên viết tắt">
          <TextInput
            value={f.short_name}
            onCommit={set('short_name')}
            label="Tên viết tắt"
            placeholder="hiện ở ô chọn NCC lúc soạn đơn"
          />
        </Field>
        <Field label="Mã NCC">
          <TextInput
            value={f.code}
            onCommit={set('code')}
            label="Mã NCC"
            mono
            placeholder={
              autoCode ? `để trống → máy cấp ${autoCode}` : 'để trống → máy cấp theo tên'
            }
          />
        </Field>
        <Field label="Mã số thuế">
          <TextInput value={f.tax_no} onCommit={set('tax_no')} label="Mã số thuế" mono />
        </Field>
        <Field label="Loại">
          <TextInput
            value={f.type}
            onCommit={set('type')}
            label="Loại"
            placeholder="gõ loại mới, hoặc bấm gợi ý dưới"
          />
        </Field>
      </FieldGrid>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Hint size="sm">Loại đang dùng:</Hint>
        {types.slice(0, 8).map((t) => (
          <Chip
            key={t}
            on={f.type === t}
            onClick={() => set('type')(f.type === t ? '' : t)}
          >
            {t}
          </Chip>
        ))}
      </div>

      {dup.taxOwner && (
        <div className="mt-3">
          <NoticeBar tag="MST đã có chủ" tone="stop">
            MST {f.tax_no.trim()} đang gắn cho{' '}
            <TextLink href={hoSo(dup.taxOwner.id)}>
              {dup.taxOwner.code ? `${dup.taxOwner.code} · ` : ''}
              {dup.taxOwner.name}
            </TextLink>{' '}
            ({dup.taxOwner.po_count} đơn) — một trong hai gõ sai. Sửa MST ở hồ sơ kia, sửa
            ô trên, hoặc xoá ô MST để thêm trước.
          </NoticeBar>
        </div>
      )}
      {dup.sameName.length > 0 && (
        <div className="mt-3">
          <NoticeBar tag="Có thể trùng">
            Danh mục đã có {dup.sameName.length} NCC cùng tên:{' '}
            {dup.sameName.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ' · '}
                <TextLink href={hoSo(r.id)}>{r.code ?? r.name}</TextLink>
                {` (${r.tax_no ? `MST ${r.tax_no}` : 'chưa MST'}, ${r.po_count} đơn)`}
              </span>
            ))}
            . Vẫn thêm được nếu là chi nhánh khác; là một thì mở hồ sơ kia mà dùng.
          </NoticeBar>
        </div>
      )}

      <div className="k-sec mt-4">Liên hệ</div>
      <FieldGrid>
        <Field label="Người liên hệ">
          <TextInput
            value={f.contact_name}
            onCommit={set('contact_name')}
            label="Người liên hệ"
            placeholder="tên người mình gọi"
          />
        </Field>
        <Field label="Số máy người liên hệ">
          <TextInput
            value={f.contact_phone}
            onCommit={set('contact_phone')}
            label="Số máy người liên hệ"
            mono
          />
        </Field>
        <Field label="Điện thoại công ty">
          <TextInput
            value={f.phone}
            onCommit={set('phone')}
            label="Điện thoại công ty"
            mono
          />
        </Field>
        <Field label="Địa chỉ">
          <TextInput value={f.address} onCommit={set('address')} label="Địa chỉ" />
        </Field>
      </FieldGrid>

      <div className="k-sec">Mua bán</div>
      <FieldGrid note="Đơn mới của NCC này tự lấy tiền tệ, VAT và điều khoản ở đây — sửa từng đơn vẫn được. Ô số ngày trống = chưa khai (khác 0 = trả ngay).">
        <Field label="Tiền tệ">
          <span className="flex gap-2">
            {['VND', 'USD'].map((c) => (
              <Chip key={c} on={f.currency === c} onClick={() => set('currency')(c)}>
                {c}
              </Chip>
            ))}
          </span>
        </Field>
        <Field label="Thuế VAT">
          <span className="flex flex-wrap gap-2">
            {VAT.map((v) => (
              <Chip
                key={v}
                on={f.vat === v}
                onClick={() => set('vat')(f.vat === v ? '' : v)}
              >
                {v}%
              </Chip>
            ))}
            <Chip on={f.vat === ''} onClick={() => set('vat')('')}>
              chưa rõ
            </Chip>
          </span>
        </Field>
        <Field label="Điều khoản thanh toán">
          <TextInput
            value={f.payment_terms}
            onCommit={set('payment_terms')}
            label="Điều khoản thanh toán"
            placeholder="COD, NET 30, công nợ cuối tháng…"
          />
        </Field>
        <Field label="Số ngày công nợ">
          <NumInput
            value={f.payment_net_days}
            onCommit={set('payment_net_days')}
            aria-label="Số ngày công nợ"
            align="left"
          />
        </Field>
        <Field label="Người phụ trách">
          <Pick
            label="Người phụ trách"
            value={f.buyer_id}
            onChange={set('buyer_id')}
            options={[
              { value: '', label: '— chưa gán' },
              ...buyers.map((b) => ({
                value: b.id,
                label: b.id === meId ? `${b.name} (tôi)` : b.name,
              })),
            ]}
          />
        </Field>
      </FieldGrid>

      <div className="mt-3">
        <PhapLyNganHang
          value={legal}
          onChange={(k, v) => setLegal((s) => ({ ...s, [k]: v }))}
        />
      </div>

      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={f.note}
        onChange={set('note')}
        rows={2}
        placeholder="Điều cần nhớ khi làm việc với NCC này"
      />
    </Sheet>
  )
}
