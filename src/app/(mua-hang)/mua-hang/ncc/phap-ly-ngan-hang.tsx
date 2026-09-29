'use client'

import { FastTab, Field, FieldGrid, TextInput } from '@/components/kit'

/**
 * PHÁP LÝ & NGÂN HÀNG — khối GẬP dùng chung cho panel Thêm và Sửa hồ sơ NCC
 * (29/09/2026).
 *
 * Gập vì đo 29/09: 0–1 trên 175 NCC khai ngân hàng / tên trên hoá đơn — người
 * mua không khai lúc thêm. Nhưng phải CÓ chỗ khai: khu cũ `/planning/suppliers`
 * (nơi duy nhất sửa được số tài khoản) đã xoá cùng ngày.
 */
export const PHAP_LY_KEYS = [
  'company_name',
  'legal_rep',
  'registered_address',
  'bank_name',
  'bank_account',
  'swift_code',
] as const
export type PhapLy = Record<(typeof PHAP_LY_KEYS)[number], string>

export const emptyPhapLy = (src?: Partial<Record<keyof PhapLy, string | null>>): PhapLy =>
  Object.fromEntries(PHAP_LY_KEYS.map((k) => [k, src?.[k] ?? ''])) as PhapLy

/** Chuỗi trống → null (chưa khai) cho body API. */
export const phapLyBody = (v: PhapLy) =>
  Object.fromEntries(PHAP_LY_KEYS.map((k) => [k, v[k].trim() || null]))

export function PhapLyNganHang({
  value,
  onChange,
}: {
  value: PhapLy
  onChange: (k: keyof PhapLy, v: string) => void
}) {
  const khai = PHAP_LY_KEYS.filter((k) => value[k].trim()).length
  const o = (k: keyof PhapLy, label: string, mono = false) => (
    <Field label={label}>
      <TextInput
        value={value[k]}
        onCommit={(v) => onChange(k, v)}
        label={label}
        mono={mono}
      />
    </Field>
  )
  return (
    <FastTab
      title="Pháp lý & ngân hàng"
      defaultOpen={khai > 0}
      summary={[['Đã khai', `${khai}/${PHAP_LY_KEYS.length}`]]}
    >
      <FieldGrid note="Kế toán cần khi chuyển tiền và xuất hoá đơn. Không bắt buộc để lên đơn.">
        {o('company_name', 'Tên trên hoá đơn')}
        {o('legal_rep', 'Người đại diện pháp luật')}
        {o('registered_address', 'Địa chỉ đăng ký')}
        {o('bank_name', 'Ngân hàng')}
        {o('bank_account', 'Số tài khoản', true)}
        {o('swift_code', 'SWIFT (chuyển quốc tế)', true)}
      </FieldGrid>
    </FastTab>
  )
}
