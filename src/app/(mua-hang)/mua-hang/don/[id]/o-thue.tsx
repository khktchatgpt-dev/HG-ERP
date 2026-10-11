'use client'

import { useState } from 'react'
import { Combobox, NumInput, Tick, type ComboOption } from '@/components/kit'
import {
  chuanThue,
  goiYThue,
  goiYThueNgan,
  khoaThue,
  KIEU_THUE,
  nhanThue,
  tuKhoaThue,
  viDuThue,
  type KieuThue,
  type ThueMacDinh,
} from '@/lib/po-thue'

const KHAC = 'khac'

/**
 * Ô THUẾ — MỘT lựa chọn thay hai ô "VAT %" + "giá gồm VAT" (B1 bản vẽ Đầu đơn,
 * 11/10/2026). Năm kiểu thật, kiểu của NCC đang chọn đứng đầu kèm số đơn; mỗi
 * dòng ghi sẵn phép tính trên 1.000.000 để người chọn biết tổng ra sao. Kiểu
 * hiếm (5%…) qua dòng "Thuế suất khác…" — bày ô % và ô "đã gồm" ngay cạnh.
 */
export function OThue({
  vat,
  inclVat,
  onChon,
  macDinh,
  width = 160,
}: {
  /** Thuế suất đang có trên đầu đơn ('' = chưa điền, coi như 0). */
  vat: number | ''
  inclVat: boolean
  /** Nhận kiểu vừa chọn — chỗ gọi ghi cả % lẫn "đã gồm" một lượt và đánh dấu đã tự chỉnh. */
  onChon: (k: KieuThue) => void
  /** Kiểu thường dùng của NCC đang chọn (lib/po-thue `thueMacDinh`) — null khi chưa biết. */
  macDinh: ThueMacDinh | null
  width?: number
}) {
  const cur = chuanThue(vat === '' ? 0 : vat, inclVat)
  const curKey = khoaThue(cur)
  const mdKey = macDinh ? khoaThue(macDinh) : null
  const [khac, setKhac] = useState(false)
  const keys = [
    ...(mdKey ? [mdKey] : []),
    ...KIEU_THUE.map(khoaThue),
    curKey, // kiểu hiếm đang có (vd. 5%) vẫn phải hiện được tên
  ].filter((k, i, a) => a.indexOf(k) === i)
  const options: ComboOption[] = [
    ...keys.map((k) => {
      const t = tuKhoaThue(k)!
      const cua = k === mdKey && macDinh?.nguon === 'don' ? `${macDinh.n} đơn của NCC này · ` : k === mdKey ? 'hồ sơ NCC · ' : '' // prettier-ignore
      return { value: k, label: nhanThue(t), hint: cua + viDuThue(t) }
    }),
    {
      value: KHAC,
      label: 'Thuế suất khác…',
      hint: 'gõ % (vd. 5) rồi chọn đã gồm / chưa gồm',
    },
  ]
  const goiY = goiYThueNgan(cur, macDinh)
  const goiYDai = goiYThue(cur, macDinh) ?? undefined
  return (
    <span className="inline-flex items-center gap-2">
      <Combobox
        label="Kiểu thuế"
        width={width}
        value={curKey}
        emptyLabel="— chọn kiểu thuế —"
        options={options}
        onChange={(v) => {
          if (v === KHAC) return setKhac(true)
          const k = tuKhoaThue(v)
          if (!k) return // dòng "bỏ chọn" — thuế không để trống
          setKhac(false)
          onChon(k)
        }}
      />
      {khac && (
        <>
          <NumInput
            aria-label="Thuế suất %"
            value={String(cur.rate)}
            onCommit={(v) => {
              const n = Number(v.replace(',', '.'))
              if (Number.isFinite(n) && n >= 0 && n <= 100) onChon(chuanThue(n, cur.incl))
            }}
          />
          <span className="text-k-label">%</span>
          <Tick
            label="Đơn giá đã gồm VAT"
            checked={cur.incl}
            onChange={(v) => onChon(chuanThue(cur.rate, v))}
          />
          <span className="text-k-label">đã gồm</span>
        </>
      )}
      {goiY && !khac && (
        <span
          className="text-k-label whitespace-nowrap text-[var(--ink-3)]"
          title={goiYDai}
        >
          {goiY}
        </span>
      )}
    </span>
  )
}
