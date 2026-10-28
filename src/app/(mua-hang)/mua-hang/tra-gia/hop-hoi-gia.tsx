'use client'

import { useState } from 'react'
import { parsePasteNumber } from '@/lib/po-paste'
import { HopThoai, INPUT, Nut, O } from '../_erp/ui'
import type { MonTinh, TraGiaCtx } from './useTraGia'

/**
 * GHI GIÁ HỎI ĐƯỢC — giá người mua vừa gọi điện / Zalo hỏi NCC. Vào so sánh như
 * giá đơn, nhưng KHÔNG lưu vào hệ thống (câu Q4 bản vẽ): chỉ sống trong danh
 * sách nháp trên máy và file Excel.
 */
export function HopHoiGia({ d, t }: { d: TraGiaCtx; t: MonTinh }) {
  const [ncc, setNcc] = useState('')
  const [gia, setGia] = useState('')
  const [ghiChu, setGhiChu] = useState('')
  const so = parsePasteNumber(gia)
  const dv = t.dv ?? t.m.dvt
  const thieu = !ncc.trim() ? 'Ghi tên nhà cung cấp' : !(so != null && so > 0) ? 'Ghi giá là một số dương' : null // prettier-ignore
  const dong = () => d.setHoiCho(null)
  const luu = () => {
    if (thieu || so == null) return
    d.ghiHoi(t.m.id, { ncc: ncc.trim(), gia: so, ghi_chu: ghiChu.trim() || null })
    dong()
  }
  return (
    <HopThoai
      title="Ghi giá hỏi được"
      aside={t.m.kq?.quy_cach?.label ?? t.m.text}
      width={460}
      onClose={dong}
      footer={
        <>
          <span className="mr-auto text-[12px] text-[var(--ink-3)]">
            Chỉ nằm trong danh sách này và file Excel.
          </span>
          <Nut onClick={dong}>Thôi</Nut>
          <Nut chinh khoa={thieu ?? undefined} onClick={luu}>
            Thêm vào so sánh
          </Nut>
        </>
      }
    >
      <O label="Nhà cung cấp" help="NCC chưa có trong danh mục vẫn ghi được.">
        <input
          aria-label="Nhà cung cấp"
          className={INPUT}
          list="tra-gia-ncc"
          value={ncc}
          onChange={(e) => setNcc(e.target.value)}
          placeholder="Gõ tên NCC"
          autoFocus
        />
        <datalist id="tra-gia-ncc">
          {d.tenNcc.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </O>
      <O
        label="Giá"
        help={
          dv
            ? `Theo đ/${dv}, chưa VAT — cùng đơn vị với các giá đang so.`
            : 'Chưa VAT, theo đơn vị bạn hỏi.'
        }
      >
        <input
          aria-label="Giá"
          className={`${INPUT} text-right font-mono`}
          inputMode="decimal"
          value={gia}
          onChange={(e) => setGia(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && luu()}
          placeholder="vd 112.000"
        />
      </O>
      <O label="Ghi chú">
        <input
          aria-label="Ghi chú"
          className={INPUT}
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          placeholder="vd báo qua Zalo, giao 5 ngày"
        />
      </O>
    </HopThoai>
  )
}
