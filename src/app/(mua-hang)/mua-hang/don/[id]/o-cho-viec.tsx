'use client'

import { useState } from 'react'
import { Combobox, HeadField, type ComboOption } from '@/components/kit'
import { fmtMoney } from '@/lib/po-line'
import { goiYMucDich } from '@/lib/po-muc-dich'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import type { ProjectOption } from '@/modules/dept/supply/projects.service'
import { HangMucSheet } from '@/app/(mua-hang)/mua-hang/hang-muc/hang-muc-sheet'

const HM = 'hm:'
const MOI = '@moi'

/** "128,4 tr" — số gọn cho dòng gợi ý. */
const gon = (n: number, cur: string) =>
  cur !== 'VND' ? `${fmtMoney(n, cur)} ${cur}` : n >= 1e6 ? `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : fmtMoney(n, cur) // prettier-ignore

function tieuHangMuc(h: ProjectOption): string {
  const tien = h.budget ? `${gon(h.ordered, h.currency)} / ${gon(h.budget, h.currency)}` : gon(h.ordered, h.currency) // prettier-ignore
  return `${h.n} đơn · ${tien}`
}

/**
 * Ô "CHO VIỆC" — đơn mua này mua cho việc gì (B2 bản vẽ Đầu đơn, 12/10/2026).
 *
 * Thay ô Lệnh + dòng "Ngoài lệnh" + hai ô Mục đích · Cho ai: một danh sách, hai
 * loại việc — lệnh sản xuất đang chạy, và hạng mục ngoài sản xuất đang mở (0230).
 * Gõ để tìm, Enter để chọn; việc chưa có thì "+ Tạo hạng mục mới…" mở hộp tạo
 * ngay tại chỗ rồi chọn luôn. Chọn hạng mục thì cạnh ô bày việc đó đã tiêu bao
 * nhiêu (so dự toán nếu có) — người soạn và Giám đốc cùng thấy một con số.
 *
 * Chỉ ĐƠN MỚI đổi được giữa lệnh và hạng mục: sửa nháp thì server giữ nguyên
 * lệnh chính (pos.service `update`); nháp ngoài lệnh vẫn đổi hạng mục được.
 */
export function OChoViec({
  header,
  setHeader,
  lsxOptions,
  hangMuc,
  onHangMucMoi,
  doiDuoc,
}: {
  header: Pick<PoHeader, 'poType' | 'lsxId' | 'projectId'>
  setHeader: (f: (h: PoHeader) => PoHeader) => void
  lsxOptions: ComboOption[]
  /** Hạng mục đang mở (+ hạng mục của chính đơn nếu đã đóng). */
  hangMuc: readonly ProjectOption[]
  /** Hạng mục vừa tạo trong hộp — thêm vào danh sách của màn. */
  onHangMucMoi: (h: ProjectOption) => void
  /** Đơn mới — đổi qua lại giữa lệnh và hạng mục được. */
  doiDuoc: boolean
}) {
  const [tao, setTao] = useState(false)
  const choLenh = doiDuoc || header.poType === 'lsx'
  const choHm = doiDuoc || header.poType === 'standalone'
  const options: ComboOption[] = [
    ...(choLenh ? lsxOptions.map((o) => ({ ...o, hint: `Lệnh SX${o.hint ? ` · ${o.hint}` : ''}` })) : []), // prettier-ignore
    ...(choHm
      ? hangMuc.map((h) => ({ value: HM + h.id, label: `${h.code} · ${h.name}`, hint: `Hạng mục · ${h.kind} · ${tieuHangMuc(h)}${h.status !== 'open' ? ' · đã đóng' : ''}` })) // prettier-ignore
      : []),
    ...(choHm ? [{ value: MOI, label: '+ Tạo hạng mục mới…', hint: 'việc ngoài sản xuất chưa có trong danh sách' }] : []), // prettier-ignore
  ]
  const value = header.poType === 'lsx' ? header.lsxId : header.projectId ? HM + header.projectId : '' // prettier-ignore
  const hm = header.poType === 'standalone' ? hangMuc.find((h) => h.id === header.projectId) : undefined // prettier-ignore
  const pct =
    hm?.budget && hm.ordered > 0 ? Math.round((hm.ordered / hm.budget) * 100) : null

  const chon = (v: string) => {
    if (v === MOI) return setTao(true)
    if (v.startsWith(HM)) return setHeader((h) => ({ ...h, poType: 'standalone', projectId: v.slice(HM.length), lsxId: '', extraLsxIds: [] })) // prettier-ignore
    if (!v) return // dòng "bỏ chọn" — giữ việc cũ, ô này không để trống được
    setHeader((h) => ({ ...h, poType: 'lsx', lsxId: v, projectId: '' }))
  }

  return (
    <>
      <HeadField
        label="Cho việc"
        need
        empty={!value}
        width={header.poType === 'standalone' ? 170 : 130}
      >
        <Combobox
          label="Cho việc"
          value={value}
          onChange={chon}
          emptyLabel="— chọn lệnh hoặc hạng mục —"
          placeholder="Gõ số lệnh, tên khách, hạng mục…"
          options={options}
        />
      </HeadField>
      {hm && (
        <span
          className={`text-k-label whitespace-nowrap ${pct != null && pct >= NGUONG_DU_TOAN ? 'k-t-warn' : 'text-[var(--ink-3)]'}`}
          title={`${hm.n} đơn (kể cả nháp) · đã đặt ${fmtMoney(hm.ordered, hm.currency)} ${hm.currency} (gồm VAT, trừ nháp + huỷ)${hm.budget ? ` · dự toán ${fmtMoney(hm.budget, hm.currency)}` : ''}`} // prettier-ignore
        >
          {/* Ngắn cho vừa một hàng đầu đơn — số đơn nằm ở title. */}
          {hm.budget
            ? `${gon(hm.ordered, hm.currency)} / ${gon(hm.budget, hm.currency)}`
            : `đã đặt ${gon(hm.ordered, hm.currency)}`}
          {pct != null ? ` (${pct}%)` : ''}
        </span>
      )}
      {tao && (
        <HangMucSheet
          goiYLoai={goiYMucDich(hangMuc.map((h) => h.kind))}
          onClose={() => setTao(false)}
          onSaved={(p) => {
            onHangMucMoi({ ...p, status: 'open', n: 0, ordered: 0 })
            setHeader((h) => ({ ...h, poType: 'standalone', projectId: p.id, lsxId: '', extraLsxIds: [] })) // prettier-ignore
          }}
        />
      )}
    </>
  )
}
