'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Code, Ico, Tag } from '@/components/kit'
import {
  LOAI_PHIEU,
  LOAI_THEO_THU_TU,
  PHONG_NHAN,
  vungGap,
  type LoaiPhieu,
} from '@/lib/loai-phieu-duyet'
import type { SignItem } from '@/modules/core/exec/exec.service'
import { money } from '../approval-helpers'
import { KIND_ICON, itemKey, moneyText } from './hop-ky.shared'

/**
 * HỘP KÝ TRÊN ĐIỆN THOẠI (H3, bản vẽ HK-2): màn hẹp không bày được năm bảng.
 * Mở ra thấy khối "Cần ký trước" rồi DANH SÁCH NHÓM (mỗi loại một dòng: số
 * phiếu, phòng, lâu nhất, tổng); chạm một nhóm → phiếu của nhóm đó, mỗi phiếu
 * một khối chữ, chạm để mở màn duyệt của phiếu. Loại không có phiếu hiện mờ
 * (Q25) — người ký thấy đủ các loại mình phụ trách.
 *
 * Ký từ đây là ký trong màn duyệt của từng phiếu (đề nghị mua có màn duyệt
 * dựng cho điện thoại); không ký hàng loạt trên điện thoại.
 */
export function HopKyHep({ items, gap }: { items: SignItem[]; gap: SignItem[] }) {
  const [nhom, setNhom] = useState<LoaiPhieu | null>(null)

  if (nhom) {
    const khai = LOAI_PHIEU[nhom]
    const rows = items.filter((i) => i.kind === nhom)
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <button
          type="button"
          onClick={() => setNhom(null)}
          className="text-k-sm w-full border-b border-[var(--line)] px-4 py-2.5 text-left font-semibold text-[var(--act-text)]"
        >
          ‹ Tất cả nhóm
        </button>
        <div className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-4 py-2">
          <span className="text-k-label font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
            {PHONG_NHAN[khai.phong]}
          </span>
          <div className="font-semibold">
            {khai.ten} · {rows.length} phiếu
          </div>
        </div>
        {rows.map((i) => (
          <PhieuKhoi key={itemKey(i)} i={i} />
        ))}
        {khai.so && (
          <Link
            href={khai.so}
            className="text-k-sm block px-4 py-3 text-[var(--act-text)] hover:underline"
          >
            Sổ tra cứu {khai.ten.toLowerCase()} ›
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      {gap.length > 0 && (
        <div className="border-b border-[var(--line)] bg-[var(--surface-raised)]">
          <div className="text-k-sm px-4 pt-2.5 font-semibold text-[var(--warn)]">
            Cần ký trước · {gap.length}
          </div>
          {gap.map((i) => (
            <PhieuKhoi key={`gap-${itemKey(i)}`} i={i} gap />
          ))}
        </div>
      )}
      <ul className="m-0 list-none p-0" aria-label="Nhóm phiếu chờ ký">
        {LOAI_THEO_THU_TU.map((loai) => {
          const khai = LOAI_PHIEU[loai]
          const rows = items.filter((i) => i.kind === loai)
          const lau = rows.length ? Math.max(...rows.map((r) => r.waiting_days)) : 0
          return (
            <li key={loai} className="border-b border-[var(--hair)]">
              <button
                type="button"
                disabled={rows.length === 0}
                onClick={() => setNhom(loai)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-left enabled:hover:bg-[var(--act-wash)] disabled:text-[var(--ink-3)]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Ico name={KIND_ICON[loai]} size={14} />
                    {khai.ten}
                  </span>
                  <span className="text-k-sm text-[var(--ink-3)]">
                    {PHONG_NHAN[khai.phong]}
                    {rows.length > 0
                      ? ` · lâu nhất ${lau === 0 ? 'hôm nay' : `${lau} ngày`} · ${moneyText(rows)}`
                      : ' · không có phiếu chờ'}
                  </span>
                </span>
                <b className="num text-k-lg">
                  {rows.length}
                  {rows.length > 0 ? ' ›' : ''}
                </b>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Một phiếu, một khối chữ — chạm để mở màn duyệt / xem kỹ của phiếu. */
function PhieuKhoi({ i, gap = false }: { i: SignItem; gap?: boolean }) {
  const g = gap ? vungGap(i) : null
  const noiDung = i.po
    ? [i.po.loai, i.po.materials.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
    : i.dnm
      ? `${i.dnm.so_dong} dòng${i.dnm.chua_ma ? ` · ${i.dnm.chua_ma} chưa có mã` : ''}`
      : i.facts.join(' · ')
  return (
    <Link
      href={i.href}
      className="flex flex-col gap-0.5 border-b border-[var(--hair)] px-4 py-2.5 hover:bg-[var(--act-wash)]"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <Ico name={KIND_ICON[i.kind]} size={13} label={LOAI_PHIEU[i.kind].nhan} />
          <Code>{i.code}</Code>
        </span>
        <span className="text-k-sm text-[var(--ink-2)]">
          {i.waiting_days <= 0 ? 'hôm nay' : `chờ ${i.waiting_days} ngày`}
        </span>
      </span>
      <span>
        <b>{i.po?.supplier_short ?? i.party}</b>
        {i.owner_name && <span className="text-[var(--ink-3)]"> · {i.owner_name}</span>}
      </span>
      {noiDung && (
        <span className="text-k-sm truncate text-[var(--ink-2)]">{noiDung}</span>
      )}
      {g && (
        <span className="text-k-sm font-semibold text-[var(--warn)]">
          {LOAI_PHIEU[i.kind].nhan} · {g.cau}
        </span>
      )}
      <span className="flex items-baseline justify-between gap-2">
        {i.big || i.late_sign ? (
          <Tag tone={i.late_sign ? 'stop' : 'neutral'}>
            {i.late_sign ? 'chờ ký bù' : 'giá trị lớn — mở ra đọc'}
          </Tag>
        ) : (
          <span />
        )}
        <b className="num">{i.value > 0 ? money(i.value, i.currency) : '—'}</b>
      </span>
    </Link>
  )
}
