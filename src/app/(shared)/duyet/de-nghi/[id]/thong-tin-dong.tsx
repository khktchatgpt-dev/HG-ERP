'use client'

import Link from 'next/link'
import { NoticeBar } from '@/components/kit'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { chenhGia, dangVeCau, giaTruocCau, tonNhan, trungCau } from '@/lib/de-nghi-goi-y'
import type { DeNghiChiTiet, DongChiTiet } from '@/modules/dept/warehouse/de-nghi.service'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/**
 * Thông tin để LÃNH ĐẠO quyết một dòng mà không phải hỏi lại trên Zalo (Đ6 ·
 * DN-8): tồn thật hay chưa theo dõi, giá so với lần trước, trùng phiếu khác,
 * đơn mua Cung ứng đang về. Câu chữ chung với màn Kho (`lib/de-nghi-goi-y`),
 * cách bày riêng — mỗi dòng một khối chữ, đọc được ở 390px.
 */

/** " · tồn 36" / " · chưa theo dõi trên sổ" — đứng sau mã vật tư. */
export function TonChu({ l }: { l: DongChiTiet }) {
  const t = tonNhan(l)
  if (!t) return null
  if (t.chuaTheoDoi)
    return (
      <span
        className="italic"
        title="Mã này chưa từng nhập / xuất trên hệ thống — chưa biết kho còn bao nhiêu"
      >
        {' '}
        · chưa theo dõi trên sổ
      </span>
    )
  return (
    <span className={t.het ? 'font-semibold text-[var(--warn)]' : ''}>
      {' '}
      · tồn {t.text}
      {t.het ? ' (hết)' : ''}
    </span>
  )
}

/** Hàng gợi ý dưới dòng: giá lần trước + chênh, trùng, đang về. Không có gì thì không vẽ. */
export function ThongTinDong({ l }: { l: DongChiTiet }) {
  const gia = l.material_id ? giaTruocCau(l.gia_gan_nhat) : null
  const c = chenhGia(l.unit_price, l.gia_gan_nhat)
  const trung = trungCau(l.trung, l.unit)
  const ve = dangVeCau(l.dang_ve, l.unit)
  if (!gia && !trung && !ve) return null
  return (
    <span className="text-k-sm col-span-2 flex flex-col gap-0.5 text-[var(--ink-3)]">
      {gia && (
        <span>
          {gia}
          {c != null && Math.abs(c) >= 5 && (
            <b className={c > 0 ? 'text-[var(--warn)]' : 'text-[var(--ink-2)]'}>
              {' '}
              · dự kiến {c > 0 ? `cao hơn ${c}%` : `thấp hơn ${-c}%`}
            </b>
          )}
        </span>
      )}
      {trung && <span className="font-semibold text-[var(--warn)]">Trùng: {trung}</span>}
      {ve && <span className="text-[var(--act-text)]">Cung ứng: {ve}</span>}
    </span>
  )
}

/** Dải "phiếu trước của Kho": lần trước dự kiến bao nhiêu, chi thật bao nhiêu. */
export function PhieuTruoc({ t }: { t: NonNullable<DeNghiChiTiet['phieu_truoc']> }) {
  const ngay = t.approved_at ? isoToVn(todayVn(new Date(t.approved_at))).slice(0, 5) : ''
  const lech = t.du_kien > 0 && t.thuc_chi > 0 ? Math.round(((t.thuc_chi - t.du_kien) / t.du_kien) * 100) : null // prettier-ignore
  return (
    <NoticeBar tone="neutral" tag="Phiếu trước">
      <Link
        href={`/duyet/de-nghi/${t.id}`}
        className="num font-semibold text-[var(--act-text)] hover:underline"
      >
        {t.code}
      </Link>{' '}
      ({ngay}) dự kiến <span className="num">{fmt(t.du_kien)}</span> → Kho chi thật{' '}
      <b className="num">{fmt(t.thuc_chi)}</b>
      {lech != null && lech !== 0 && ` (${lech > 0 ? '+' : ''}${lech}%)`}, nhập đủ{' '}
      {t.du_dong}/{t.mua_dong} dòng.
    </NoticeBar>
  )
}
