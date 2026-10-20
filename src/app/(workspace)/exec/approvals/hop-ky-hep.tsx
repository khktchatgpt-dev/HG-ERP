'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  LOAI_PHIEU,
  LOAI_THEO_THU_TU,
  PHONG_NHAN,
  vungGap,
  type LoaiPhieu,
} from '@/lib/loai-phieu-duyet'
import type { SignItem } from '@/modules/core/exec/exec.service'
import { money } from '../approval-helpers'
import { LOP_MAU, itemKey, moneyShort } from './hop-ky.shared'

/**
 * HỘP KÝ TRÊN ĐIỆN THOẠI (bản vẽ HK-4, viết tay — `hop-ky.css`): danh sách PHẲNG,
 * vạch màu loại bên trái, không thẻ. Mở ra thấy "Cần ký trước" rồi danh sách
 * nhóm (mỗi loại một dòng: số phiếu, phòng, lâu nhất, tổng); chạm một nhóm →
 * phiếu của nhóm, chạm phiếu để mở màn duyệt. Loại không có phiếu hiện mờ (Q25).
 *
 * Ký trên điện thoại là ký trong màn duyệt của từng phiếu (đề nghị mua có màn
 * duyệt dựng cho điện thoại); không ký hàng loạt ở đây.
 */
export function HopKyHep({
  items,
  gap,
  loais = LOAI_THEO_THU_TU,
}: {
  items: SignItem[]
  gap: SignItem[]
  /** Loại thuộc tab phòng đang mở. Chỉ MỘT loại → bày thẳng phiếu, bỏ bước chọn nhóm. */
  loais?: readonly LoaiPhieu[]
}) {
  const [chon, setNhom] = useState<LoaiPhieu | null>(null)
  const motLoai = loais.length === 1
  const nhom = motLoai ? loais[0] : chon

  if (nhom) {
    const khai = LOAI_PHIEU[nhom]
    const rows = items.filter((i) => i.kind === nhom)
    return (
      <div className="hk-grid">
        {!motLoai && (
          <button type="button" className="hk-p-row" onClick={() => setNhom(null)}>
            <span className="hk-sel">‹ Tất cả nhóm</span>
          </button>
        )}
        <div className={`hk-p-sec ${LOP_MAU[nhom]}`}>
          {PHONG_NHAN[khai.phong]} · {khai.ten} · {rows.length} phiếu
        </div>
        {/* Phiếu gấp lên đầu, kèm câu vì sao gấp. */}
        {[...gap.filter((i) => i.kind === nhom), ...rows.filter((i) => !vungGap(i))].map(
          (i) => (
            <Phieu key={itemKey(i)} i={i} gap={!!vungGap(i)} />
          ),
        )}
        {khai.so && (
          <Link href={khai.so} className="hk-p-row">
            <span className="hk-sel">Sổ tra cứu {khai.ten.toLowerCase()} ›</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="hk-grid">
      {gap.length > 0 && (
        <>
          <div className="hk-p-sec lp-gap">Cần ký trước · {gap.length}</div>
          {gap.map((i) => (
            <Phieu key={`gap-${itemKey(i)}`} i={i} gap />
          ))}
        </>
      )}
      <div className="hk-p-sec">Theo loại phiếu</div>
      {loais.map((loai) => {
        const khai = LOAI_PHIEU[loai]
        const rows = items.filter((i) => i.kind === loai)
        const lau = rows.length ? Math.max(...rows.map((r) => r.waiting_days)) : 0
        const tien = moneyShort(rows)
        return (
          <button
            key={loai}
            type="button"
            className={`hk-p-row ${LOP_MAU[loai]}`}
            disabled={rows.length === 0}
            onClick={() => setNhom(loai)}
          >
            <span>
              <b style={rows.length ? { color: 'var(--c)' } : undefined}>{khai.ten}</b>
              <br />
              <span className="s">
                {PHONG_NHAN[khai.phong]}
                {rows.length > 0
                  ? ` · lâu nhất ${lau === 0 ? 'hôm nay' : `${lau} ngày`}${tien ? ` · ${tien}` : ''}`
                  : ' · không có phiếu chờ'}
              </span>
            </span>
            <span className="n">
              {rows.length}
              {rows.length > 0 ? ' ›' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Một phiếu một dòng phẳng — chạm để mở màn duyệt / xem kỹ của phiếu. */
function Phieu({ i, gap = false }: { i: SignItem; gap?: boolean }) {
  const g = gap ? vungGap(i) : null
  const noiDung = i.po
    ? [i.po.loai, i.po.materials.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
    : i.dnm
      ? `${i.dnm.so_dong} dòng${i.dnm.chua_ma ? ` · ${i.dnm.chua_ma} chưa có mã` : ''}`
      : i.facts.join(' · ')
  return (
    <Link href={i.href} className={`hk-p-row ${LOP_MAU[i.kind]}`}>
      <span style={{ minWidth: 0 }}>
        <span className="hk-loai">
          <i aria-hidden />
          {LOAI_PHIEU[i.kind].nhan}
        </span>{' '}
        <span className="hk-ma">{i.code}</span>
        <br />
        <b>{i.po?.supplier_short ?? i.party}</b>
        {i.owner_name && <span className="hk-mut"> · {i.owner_name}</span>}
        {noiDung && (
          <span
            className="s"
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {noiDung}
          </span>
        )}
        {g && (
          <span className="hk-why" style={{ display: 'block', fontSize: 12 }}>
            {g.cau}
          </span>
        )}
        {(i.big || i.late_sign) && (
          <span className="hk-mut" style={{ display: 'block', fontSize: 12 }}>
            {i.late_sign ? 'chờ ký bù — mở ra đọc lý do' : 'giá trị lớn — mở ra đọc'}
          </span>
        )}
      </span>
      <span style={{ textAlign: 'right', alignSelf: 'center' }}>
        <b className="hk-num">{i.value > 0 ? money(i.value, i.currency) : '—'}</b>
        <br />
        <span className="s">
          {i.waiting_days <= 0 ? 'hôm nay' : `chờ ${i.waiting_days} ngày`}
        </span>
      </span>
    </Link>
  )
}
