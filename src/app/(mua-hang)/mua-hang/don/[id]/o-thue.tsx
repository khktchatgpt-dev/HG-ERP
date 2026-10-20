'use client'

import { useState } from 'react'
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
import { ChonNhom, khop, type DongChon, type NhomChon } from '../../_erp/chon-nhom'
import { INPUT } from '../../_erp/ui'

const KHAC = 'khac'

/**
 * Ô THUẾ — MỘT lựa chọn thay hai ô "VAT %" + "giá gồm VAT" (B1 bản vẽ Đầu đơn,
 * 11/10/2026). Viết tay, không qua kit (12/10: "ko dùng kit hiện tại").
 *
 * Danh sách theo bản vẽ: nhóm "Đơn trước của NCC này" (kiểu NCC đang dùng + số
 * đơn) rồi "Kiểu khác" (năm kiểu thật, mỗi kiểu kèm số đơn cả công ty), mỗi dòng
 * ghi sẵn phép tính trên 1.000.000. Kiểu hiếm (5%…) qua "Thuế suất khác…" — bày
 * ô % và ô "đã gồm" ngay cạnh.
 */
export function OThue({
  vat,
  inclVat,
  onChon,
  macDinh,
  dem = {},
  width = 160,
}: {
  /** Thuế suất đang có trên đầu đơn ('' = chưa điền, coi như 0). */
  vat: number | ''
  inclVat: boolean
  /** Nhận kiểu vừa chọn — chỗ gọi ghi cả % lẫn "đã gồm" một lượt và đánh dấu đã tự chỉnh. */
  onChon: (k: KieuThue) => void
  /** Kiểu thường dùng của NCC đang chọn (lib/po-thue `thueMacDinh`) — null khi chưa biết. */
  macDinh: ThueMacDinh | null
  /** Số đơn theo từng kiểu cả công ty (khoá `khoaThue`). */
  dem?: Record<string, number>
  width?: number
}) {
  const cur = chuanThue(vat === '' ? 0 : vat, inclVat)
  const curKey = khoaThue(cur)
  const mdKey = macDinh ? khoaThue(macDinh) : null
  const [khac, setKhac] = useState(false)
  const dong = (k: string, right?: string): DongChon => {
    const t = tuKhoaThue(k)!
    return { value: k, label: nhanThue(t), hint: viDuThue(t), right }
  }
  const khacKeys = [...KIEU_THUE.map(khoaThue), curKey].filter((k, i, a) => k !== mdKey && a.indexOf(k) === i) // prettier-ignore
  const nhom = (q: string): NhomChon[] => {
    const loc = (rs: DongChon[]) => rs.filter((r) => !q || khop(q, r.label, r.hint))
    const nccRows = mdKey
      ? [dong(mdKey, macDinh?.nguon === 'don' ? `${macDinh.n} đơn` : 'hồ sơ NCC')]
      : []
    const khacRows = [
      ...khacKeys.map((k) => dong(k, dem[k] ? `${dem[k]} đơn` : undefined)),
      {
        value: KHAC,
        label: 'Thuế suất khác…',
        hint: 'gõ % (vd. 5) rồi chọn đã gồm / chưa gồm',
      },
    ]
    return mdKey
      ? [
          { title: 'Đơn trước của NCC này', rows: loc(nccRows) },
          { title: 'Kiểu khác', rows: loc(khacRows) },
        ]
      : [{ title: 'Kiểu thuế', rows: loc(khacRows) }]
  }
  const goiY = goiYThueNgan(cur, macDinh)
  const goiYDai = goiYThue(cur, macDinh) ?? undefined
  return (
    <span className="inline-flex items-center gap-2">
      <ChonNhom
        label="Kiểu thuế"
        width={width}
        listWidth={420}
        value={curKey}
        text={nhanThue(cur)}
        nhom={nhom}
        onPick={(v) => {
          if (v === KHAC) return setKhac(true)
          const k = tuKhoaThue(v)
          if (!k) return
          setKhac(false)
          onChon(k)
        }}
      />
      {khac && (
        <>
          <input
            aria-label="Thuế suất %"
            inputMode="decimal"
            defaultValue={String(cur.rate)}
            className={`${INPUT} w-14 py-[3px] text-right`}
            onBlur={(e) => {
              const n = Number(e.target.value.replace(',', '.'))
              if (Number.isFinite(n) && n >= 0 && n <= 100) onChon(chuanThue(n, cur.incl))
            }}
          />
          <span className="text-[11px]">%</span>
          <label className="inline-flex items-center gap-1 text-[11px]">
            <input
              type="checkbox"
              aria-label="Đơn giá đã gồm VAT"
              checked={cur.incl}
              onChange={(e) => onChon(chuanThue(cur.rate, e.target.checked))}
            />
            đã gồm
          </label>
        </>
      )}
      {goiY && !khac && (
        <span
          className="text-[11px] whitespace-nowrap text-[var(--ink-3)]"
          title={goiYDai}
        >
          {goiY}
        </span>
      )}
    </span>
  )
}
